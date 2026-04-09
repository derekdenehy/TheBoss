from langchain.chat_models import init_chat_model
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
import os
import logging
from pathlib import Path
from typing import Dict, List, Optional

from ai_settings import ai_features_enabled, anthropic_key_configured

logger = logging.getLogger("docstudio.agentmanager")


class AgentManager:
    def __init__(self, manager_name: str):
        self.manager_name = manager_name
        self._llm = None
        if ai_features_enabled() and anthropic_key_configured():
            self._llm = init_chat_model("anthropic:claude-sonnet-4-5")
        elif ai_features_enabled() and not anthropic_key_configured():
            logger.warning(
                "THEBOSS_AI_ENABLED requests AI but ANTHROPIC_API_KEY is missing — "
                "LLM tools will be unavailable until the key is set."
            )

        # In-memory map of uploaded files: { file_id -> Path }
        self.uploads: Dict[str, Path] = {}

        # Extracted text content from uploaded files: { file_id -> text }
        # Populated on upload for PDFs; empty string for images (not text-extractable)
        self.upload_texts: Dict[str, str] = {}

        # File purpose tracking: { file_id -> "assignment" | "reference" | "figure" }
        self.file_purposes: Dict[str, str] = {}
        # Tracks whether assignment files have diagrams (need full PDF every turn)
        self.file_has_diagrams: Dict[str, bool] = {}
        # Tracks file_ids that have already been sent as full content at least once
        self.files_sent_full: set = set()

        # Holds the current LaTeX source for the active document session
        self.current_latex: str = ""

        # Version history for undo — list of {latex, timestamp, label}
        self.latex_history: List[dict] = []
        self.MAX_LATEX_HISTORY: int = 20
        # Redo stack — versions ahead of current (cleared when a new version is committed)
        self.latex_future: List[dict] = []

        # ---------------------------------------------------------------------------
        # Vector store & RAG infrastructure (lazy-initialized)
        # ---------------------------------------------------------------------------
        self._embedding_model = None
        self._vector_store = None

        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )

        # Master list of all ingested document chunks (for filtering/querying)
        self.all_docs: List[Document] = []

        # Track which file_ids have been ingested into the vector store
        self.ingested_file_ids: set = set()

        # ---------------------------------------------------------------------------
        # Conversation mode & planning state
        # ---------------------------------------------------------------------------
        self.current_mode: str = "initial"
        self.current_plan: List[dict] = []
        self.current_step_index: int = -1
        self.step_queue: List[int] = []

        # ---------------------------------------------------------------------------
        # Writing mode state (collaborative paper writing)
        # ---------------------------------------------------------------------------
        self.current_outline: List[dict] = []       # [{title, description, subsections, content, status}]
        self.outline_approved: bool = False
        self.paragraph_draft: str = ""               # Current paragraph awaiting user approval
        self.paragraph_section_index: int = -1       # Which outline section the draft belongs to
        self.approved_sections: List[str] = []       # Approved paragraph texts in order

        logger.info("Initialized AgentManager '%s'", self.manager_name)

    @property
    def llm(self):
        """LangChain chat model; only available when AI features and Anthropic key are configured."""
        if self._llm is None:
            raise RuntimeError(
                "AI LLM is not initialized. Set ANTHROPIC_API_KEY and ensure AI is not disabled "
                "(see THEBOSS_AI_ENABLED in .env.example)."
            )
        return self._llm

    def has_llm(self) -> bool:
        return self._llm is not None

    # ---------------------------------------------------------------------------
    # Lazy-init properties for embedding model and vector store
    # These only hit the OpenAI API when first needed (not at server startup)
    # ---------------------------------------------------------------------------

    @property
    def embedding_model(self):
        if self._embedding_model is None:
            from langchain_openai import OpenAIEmbeddings
            self._embedding_model = OpenAIEmbeddings()
            logger.info("Embedding model initialized (lazy)")
        return self._embedding_model

    @property
    def vector_store(self):
        if self._vector_store is None:
            from langchain_community.vectorstores import FAISS
            _seed = Document(page_content="initialization seed", metadata={"_seed": True})
            self._vector_store = FAISS.from_documents([_seed], self.embedding_model)
            logger.info("FAISS vector store initialized (lazy)")
        return self._vector_store

    @vector_store.setter
    def vector_store(self, value):
        self._vector_store = value

    # ---------------------------------------------------------------------------
    # RAG: split, store, and search
    # ---------------------------------------------------------------------------

    def _split_and_store(self, docs: List[Document]) -> List[str]:
        """Split documents into chunks and add them to the vector store.
        Returns the list of IDs assigned by the vector store."""
        if not docs:
            return []
        splits = self.text_splitter.split_documents(docs)
        self.all_docs.extend(splits)
        ids = self.vector_store.add_documents(documents=splits)
        logger.info("Split %d docs into %d chunks, stored %d", len(docs), len(splits), len(ids))
        return ids

    def ingest_text(self, text: str, metadata: Optional[dict] = None) -> List[str]:
        """Ingest raw text into the vector store with optional metadata.
        Returns the list of chunk IDs."""
        meta = metadata if metadata is not None else {}
        doc = Document(page_content=text, metadata=meta)
        return self._split_and_store([doc])

    def ingest_file(self, file_path, metadata_overrides: Optional[dict] = None) -> List[str]:
        """Load a text file, merge metadata, and ingest into the vector store.
        Returns the list of chunk IDs."""
        from langchain_community.document_loaders import TextLoader
        file_path = Path(file_path)
        loader = TextLoader(str(file_path), encoding="utf-8")
        docs = loader.load()

        # Derive base metadata from filename
        stem = file_path.stem           # e.g. "syllabus" from "syllabus.txt"
        base_meta = {
            "source": file_path.name,
            "document_type": stem,
        }

        # Merge: existing doc metadata < base_meta < overrides
        for doc in docs:
            merged = {**doc.metadata, **base_meta}
            if metadata_overrides:
                merged.update(metadata_overrides)
            doc.metadata = merged

        return self._split_and_store(docs)

    def ingest_uploaded_file(self, file_id: str) -> List[str]:
        """Ingest an already-uploaded file into the vector store.
        Uses extracted text if available. Marks the file as ingested."""
        if file_id in self.ingested_file_ids:
            logger.info("File %s already ingested, skipping", file_id)
            return []

        text = self.upload_texts.get(file_id, "")
        path = self.uploads.get(file_id)
        if not text:
            logger.warning("No text available for file %s, cannot ingest", file_id)
            return []

        filename = path.name if path else file_id
        metadata = {
            "file_id": file_id,
            "source": filename,
            "document_type": "reference",
        }
        ids = self.ingest_text(text, metadata=metadata)
        self.ingested_file_ids.add(file_id)
        logger.info("Ingested uploaded file %s (%s) — %d chunks", file_id, filename, len(ids))
        return ids

    def search(self, query: str, k: int = 4, file_id: Optional[str] = None) -> List[Document]:
        """Semantic search across all ingested documents.
        Optionally filter by file_id. Returns top-k relevant chunks."""
        if self._vector_store is None:
            # No vector store yet — nothing has been ingested
            return []
        raw_k = max(k * 3, 10)  # over-fetch to allow filtering
        try:
            results = self.vector_store.similarity_search(query, k=raw_k)
        except Exception as e:
            logger.warning("Vector search failed: %s", e)
            return []

        # Filter out seed document
        results = [d for d in results if not d.metadata.get("_seed")]

        # Filter by file_id if specified
        if file_id:
            results = [d for d in results if d.metadata.get("file_id") == file_id]

        return results[:k]

    def search_course(self, course_id: Optional[str], query: str, k: int = 4) -> List[Document]:
        """Search with optional course_id filtering.
        Matches the interface expected by tests."""
        if self._vector_store is None:
            return []
        raw_k = max(k * 3, 10)
        results = self.vector_store.similarity_search(query, k=raw_k)

        # Filter out seed
        results = [d for d in results if not d.metadata.get("_seed")]

        if course_id:
            normalized = course_id.lower()
            results = [d for d in results if d.metadata.get("course_id", "").lower() == normalized]

        return results[:k]

    def get_courses(self) -> List[dict]:
        """Return de-duplicated list of courses from all ingested documents."""
        seen = {}
        for doc in self.all_docs:
            cid = doc.metadata.get("course_id")
            if not cid:
                continue
            norm = cid.lower()
            if norm not in seen:
                name = doc.metadata.get("course", cid)
                seen[norm] = {"course_id": norm, "name": name}
        return list(seen.values())

    def get_docs_for_course(self, course_id: str, document_types: Optional[List[str]] = None) -> List[Document]:
        """Return all ingested docs for a course, optionally filtered by type."""
        normalized = course_id.lower()
        results = [
            d for d in self.all_docs
            if d.metadata.get("course_id", "").lower() == normalized
        ]
        if document_types:
            results = [d for d in results if d.metadata.get("document_type") in document_types]
        return results

    def load_mock_course_data(self) -> None:
        """Load .txt files from mock_data/<course_id>/ subdirectories."""
        from langchain_community.document_loaders import TextLoader
        mock_dir = Path(__file__).parent / "mock_data"
        if not mock_dir.exists():
            print("Mock data directory not found:", mock_dir)
            return

        all_split_docs = []
        for course_dir in sorted(mock_dir.iterdir()):
            if not course_dir.is_dir():
                continue
            course_id = course_dir.name
            for txt_file in sorted(course_dir.glob("*.txt")):
                loader = TextLoader(str(txt_file), encoding="utf-8")
                docs = loader.load()
                for doc in docs:
                    doc.metadata["course_id"] = course_id
                    doc.metadata["source"] = txt_file.name
                    doc.metadata["document_type"] = txt_file.stem
                splits = self.text_splitter.split_documents(docs)
                all_split_docs.extend(splits)
                logger.info("Loaded %s/%s — %d chunks", course_id, txt_file.name, len(splits))

        if all_split_docs:
            self.all_docs.extend(all_split_docs)
            self.vector_store.add_documents(documents=all_split_docs)
            logger.info("Mock data loaded: %d total chunks", len(all_split_docs))

    # ---------------------------------------------------------------------------
    # File purpose management
    # ---------------------------------------------------------------------------

    # ---------------------------------------------------------------------------
    # LaTeX version history
    # ---------------------------------------------------------------------------

    def push_latex_version(self, label: str = "") -> None:
        """Save the current LaTeX to history before overwriting it.
        Call this BEFORE updating current_latex with a new version.
        Committing a new version clears the redo stack (branching model)."""
        import time
        if not self.current_latex:
            return
        self.latex_history.append({
            "latex": self.current_latex,
            "timestamp": time.time(),
            "label": label or f"Version {len(self.latex_history) + 1}",
        })
        if len(self.latex_history) > self.MAX_LATEX_HISTORY:
            self.latex_history.pop(0)
        # A new commit discards any redo future (standard branching undo/redo behaviour)
        self.latex_future = []
        logger.info("Pushed LaTeX version to history (%d versions stored)", len(self.latex_history))

    def undo_latex(self) -> Optional[str]:
        """Restore the most recent version from history.
        Pushes the current version onto the redo stack before restoring.
        Returns the restored LaTeX string, or None if history is empty."""
        import time
        if not self.latex_history:
            logger.warning("undo_latex called but history is empty")
            return None
        # Save current to redo stack so the user can redo
        if self.current_latex:
            self.latex_future.append({
                "latex": self.current_latex,
                "timestamp": time.time(),
                "label": "undo-point",
            })
        prev = self.latex_history.pop()
        self.current_latex = prev["latex"]
        logger.info("Undid to previous version '%s' (%d history, %d future)", prev["label"], len(self.latex_history), len(self.latex_future))
        return self.current_latex

    def redo_latex(self) -> Optional[str]:
        """Restore the next version from the redo stack.
        Pushes the current version back onto the history stack before restoring.
        Returns the restored LaTeX string, or None if future is empty."""
        import time
        if not self.latex_future:
            logger.warning("redo_latex called but future is empty")
            return None
        # Save current back to history
        if self.current_latex:
            self.latex_history.append({
                "latex": self.current_latex,
                "timestamp": time.time(),
                "label": "redo-point",
            })
        nxt = self.latex_future.pop()
        self.current_latex = nxt["latex"]
        logger.info("Redid to next version (%d history, %d future)", len(self.latex_history), len(self.latex_future))
        return self.current_latex

    def get_latex_history_summary(self) -> List[dict]:
        """Return history metadata (without full latex) for UI display."""
        import time
        return [
            {
                "index": i,
                "label": v["label"],
                "timestamp": v["timestamp"],
                "chars": len(v["latex"]),
            }
            for i, v in enumerate(self.latex_history)
        ]

    def set_file_purpose(self, file_id: str, purpose: str) -> None:
        """Set the purpose of an uploaded file.
        purpose: 'assignment' | 'reference' | 'figure'
        If purpose is 'reference', auto-ingest into vector store."""
        self.file_purposes[file_id] = purpose
        logger.info("File %s categorized as '%s'", file_id, purpose)

        if purpose == "reference":
            self.ingest_uploaded_file(file_id)

    def get_file_purpose(self, file_id: str) -> str:
        """Get the current purpose of an uploaded file."""
        return self.file_purposes.get(file_id, "assignment")

    def set_file_has_diagrams(self, file_id: str, has_diagrams: bool) -> None:
        """Mark whether an assignment file needs full visual PDF every turn."""
        self.file_has_diagrams[file_id] = has_diagrams

    def get_file_has_diagrams(self, file_id: str) -> bool:
        return self.file_has_diagrams.get(file_id, False)

    def mark_file_sent_full(self, file_id: str) -> None:
        """Record that this file has been sent as full content at least once."""
        self.files_sent_full.add(file_id)

    def was_file_sent_full(self, file_id: str) -> bool:
        return file_id in self.files_sent_full

    def get_reference_context(self, query: str, k: int = 4) -> str:
        """Get relevant context from reference documents for a query.
        Returns a formatted string of relevant chunks."""
        results = self.search(query, k=k)
        if not results:
            return ""
        parts = []
        for i, doc in enumerate(results, 1):
            source = doc.metadata.get("source", "unknown")
            parts.append(f"[Source: {source}]\n{doc.page_content}")
        return "\n\n---\n\n".join(parts)

    # ---------------------------------------------------------------------------
    # Planning state
    # ---------------------------------------------------------------------------

    def set_plan(self, steps: List[dict]) -> None:
        """Set a new plan and activate the first step."""
        self.current_plan = steps
        self.current_mode = "planning"
        self.current_step_index = 0
        if self.current_plan:
            self.current_plan[0]["status"] = "active"
        logger.info("Plan set with %d steps", len(steps))

    def complete_current_step(self) -> Optional[int]:
        """Mark the current step as completed and advance to the next.
        Returns the new active step index, or None if plan is finished."""
        if self.current_step_index < 0 or self.current_step_index >= len(self.current_plan):
            return None
        self.current_plan[self.current_step_index]["status"] = "completed"
        next_idx = self.current_step_index + 1
        if next_idx < len(self.current_plan):
            self.current_plan[next_idx]["status"] = "active"
            self.current_step_index = next_idx
            logger.info("Advanced to step %d: %s", next_idx, self.current_plan[next_idx]["title"])
            return next_idx
        else:
            self.current_step_index = -1
            logger.info("All plan steps completed")
            return None

    # ---------------------------------------------------------------------------
    # Writing mode management
    # ---------------------------------------------------------------------------

    def set_outline(self, outline: List[dict]) -> None:
        """Store a paper outline and reset writing state."""
        self.current_outline = outline
        self.outline_approved = False
        self.paragraph_draft = ""
        self.paragraph_section_index = -1
        self.approved_sections = []
        # Set first section as pending
        for section in self.current_outline:
            section.setdefault("status", "pending")
            section.setdefault("content", "")
        logger.info("Outline set with %d sections", len(outline))

    def approve_outline(self) -> None:
        """Mark the outline as approved, ready for writing."""
        self.outline_approved = True
        self.paragraph_section_index = 0
        if self.current_outline:
            self.current_outline[0]["status"] = "active"
        self.current_mode = "writing"
        logger.info("Outline approved, entering writing mode")

    def save_paragraph_draft(self, section_index: int, text: str) -> None:
        """Store a draft paragraph awaiting user approval."""
        self.paragraph_draft = text
        self.paragraph_section_index = section_index
        if 0 <= section_index < len(self.current_outline):
            self.current_outline[section_index]["status"] = "draft"
        logger.info("Paragraph draft saved for section %d (%d chars)", section_index, len(text))

    def approve_paragraph(self) -> Optional[int]:
        """Approve the current paragraph draft and advance to next section.
        Returns the next section index, or None if all sections are done."""
        if self.paragraph_section_index < 0:
            return None

        idx = self.paragraph_section_index
        if 0 <= idx < len(self.current_outline):
            self.current_outline[idx]["status"] = "approved"
            self.current_outline[idx]["content"] = self.paragraph_draft
        self.approved_sections.append(self.paragraph_draft)
        self.paragraph_draft = ""

        # Advance to next pending section
        next_idx = self._find_next_pending_section(idx + 1)
        if next_idx is not None:
            self.paragraph_section_index = next_idx
            self.current_outline[next_idx]["status"] = "active"
            logger.info("Paragraph approved, advancing to section %d", next_idx)
            return next_idx
        else:
            self.paragraph_section_index = -1
            logger.info("All sections written")
            return None

    def skip_section(self) -> Optional[int]:
        """Skip the current section and move to the next.
        Returns next section index, or None if done."""
        idx = self.paragraph_section_index
        if 0 <= idx < len(self.current_outline):
            self.current_outline[idx]["status"] = "skipped"
        self.paragraph_draft = ""

        next_idx = self._find_next_pending_section(idx + 1)
        if next_idx is not None:
            self.paragraph_section_index = next_idx
            self.current_outline[next_idx]["status"] = "active"
            logger.info("Section %d skipped, advancing to %d", idx, next_idx)
            return next_idx
        else:
            self.paragraph_section_index = -1
            logger.info("Section skipped, all sections done")
            return None

    def _find_next_pending_section(self, start: int) -> Optional[int]:
        """Find the next section with status 'pending' starting from index."""
        for i in range(start, len(self.current_outline)):
            if self.current_outline[i].get("status") in ("pending", None):
                return i
        return None

    def get_writing_progress(self) -> dict:
        """Return writing progress summary."""
        total = len(self.current_outline)
        completed = sum(1 for s in self.current_outline if s.get("status") == "approved")
        skipped = sum(1 for s in self.current_outline if s.get("status") == "skipped")
        current_title = ""
        if 0 <= self.paragraph_section_index < total:
            current_title = self.current_outline[self.paragraph_section_index].get("title", "")
        return {
            "completed": completed,
            "skipped": skipped,
            "total": total,
            "current_section_index": self.paragraph_section_index,
            "current_section_title": current_title,
            "is_finished": completed + skipped >= total,
        }

    def reset_session(self) -> None:
        """Reset all session state for a new conversation."""
        self.current_latex = ""
        self.latex_history = []
        self.latex_future = []
        self.current_mode = "initial"
        self.current_plan = []
        self.current_step_index = -1
        self.step_queue = []
        self.file_purposes = {}
        self.file_has_diagrams = {}
        self.files_sent_full = set()
        self.ingested_file_ids = set()
        # Writing mode state
        self.current_outline = []
        self.outline_approved = False
        self.paragraph_draft = ""
        self.paragraph_section_index = -1
        self.approved_sections = []
        # Note: we keep the vector store and all_docs intact across resets
        # so reference material persists. Call reset_vectors() to clear.
        logger.info("Session reset")

    def reset_vectors(self) -> None:
        """Fully clear the vector store and all ingested documents."""
        from langchain_community.vectorstores import FAISS
        _seed = Document(page_content="initialization seed", metadata={"_seed": True})
        self._vector_store = FAISS.from_documents([_seed], self.embedding_model)
        self.all_docs = []
        self.ingested_file_ids = set()
        logger.info("Vector store cleared")
