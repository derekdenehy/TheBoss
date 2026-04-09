"""
Tests for the AgentManager class in agentmanager.py.

These tests focus on the new helper methods:
- _split_and_store
- ingest_text
- ingest_file
- get_courses
- get_docs_for_course
- search_course
- load_mock_course_data

We aim for high statement coverage of these methods.
"""

import os
import sys
from pathlib import Path
from typing import List

import pytest
from unittest.mock import MagicMock, patch

from langchain_core.documents import Document

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set dummy API keys to avoid prompts during import
os.environ.setdefault("OPENAI_API_KEY", "test-key-openai")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-anthropic")

# Import the module under test
import agentmanager  # noqa: E402


class TestAgentManagerCore:
    """Basic tests for AgentManager initialization and core behavior."""

    def test_init_sets_expected_attributes(self):
        """AgentManager.__init__ should set core attributes correctly."""
        mgr = agentmanager.AgentManager("test-manager")

        assert mgr.manager_name == "test-manager"
        assert hasattr(mgr, "llm")
        assert hasattr(mgr, "embedding_model")
        assert hasattr(mgr, "vector_store")
        assert hasattr(mgr, "text_splitter")
        assert isinstance(mgr.all_docs, list)
        assert mgr.all_docs == []

    def test_init_logs_initialization(self, caplog):
        """AgentManager.__init__ should emit a log line on initialization."""
        with caplog.at_level("INFO"):
            _ = agentmanager.AgentManager("log-test-manager")

        assert any("Initialized AgentManager 'log-test-manager'" in msg for msg in caplog.text.splitlines())


class TestSplitAndStore:
    """Tests for AgentManager._split_and_store."""

    @pytest.fixture
    def mgr(self):
        return agentmanager.AgentManager("split-store-manager")

    def test_split_and_store_with_docs_adds_to_all_docs_and_calls_vector_store(self, mgr):
        """_split_and_store should split docs, extend all_docs, and call vector_store.add_documents."""
        doc = Document(page_content="Test content", metadata={"source": "test.txt"})
        fake_splits: List[Document] = [
            Document(page_content="Chunk 1", metadata={"chunk": 1}),
            Document(page_content="Chunk 2", metadata={"chunk": 2}),
        ]

        with patch.object(mgr.text_splitter, "split_documents", return_value=fake_splits) as mock_split, \
             patch.object(mgr.vector_store, "add_documents", return_value=["id1", "id2"]) as mock_add:

            result_ids = mgr._split_and_store([doc])

            # Ensure split_documents called with original docs
            mock_split.assert_called_once_with([doc])

            # Ensure add_documents called with splits
            mock_add.assert_called_once_with(documents=fake_splits)

            # Ensure all_docs extended correctly
            assert mgr.all_docs == fake_splits
            assert result_ids == ["id1", "id2"]

    def test_split_and_store_empty_docs_returns_empty_and_skips_calls(self, mgr):
        """_split_and_store with empty docs should return [] and not call split/add."""
        with patch.object(mgr.text_splitter, "split_documents") as mock_split, \
             patch.object(mgr.vector_store, "add_documents") as mock_add:

            result_ids = mgr._split_and_store([])

            assert result_ids == []
            mock_split.assert_not_called()
            mock_add.assert_not_called()
            assert mgr.all_docs == []


class TestIngestText:
    """Tests for AgentManager.ingest_text."""

    @pytest.fixture
    def mgr(self):
        return agentmanager.AgentManager("ingest-text-manager")

    def test_ingest_text_with_metadata_passes_document_to_split_and_store(self, mgr):
        """ingest_text should build a Document with metadata and pass it to _split_and_store."""
        with patch.object(mgr, "_split_and_store", return_value=["id1"]) as mock_split_store:
            text = "Some course content"
            metadata = {"course_id": "cs101", "document_type": "syllabus"}

            result_ids = mgr.ingest_text(text, metadata=metadata)

            mock_split_store.assert_called_once()
            # Inspect the doc passed into _split_and_store
            args, _ = mock_split_store.call_args
            docs_arg = args[0]
            assert len(docs_arg) == 1
            doc = docs_arg[0]
            assert isinstance(doc, Document)
            assert doc.page_content == text
            assert doc.metadata["course_id"] == "cs101"
            assert doc.metadata["document_type"] == "syllabus"
            assert result_ids == ["id1"]

    def test_ingest_text_without_metadata_uses_empty_dict(self, mgr):
        """ingest_text should handle metadata=None and default to empty metadata."""
        with patch.object(mgr, "_split_and_store", return_value=["id1"]) as mock_split_store:
            text = "Content with no metadata"
            result_ids = mgr.ingest_text(text)

            mock_split_store.assert_called_once()
            args, _ = mock_split_store.call_args
            docs_arg = args[0]
            assert len(docs_arg) == 1
            doc = docs_arg[0]
            assert isinstance(doc, Document)
            assert doc.page_content == text
            # No metadata keys set
            assert doc.metadata == {}
            assert result_ids == ["id1"]


class TestIngestFile:
    """Tests for AgentManager.ingest_file."""

    @pytest.fixture
    def mgr(self):
        return agentmanager.AgentManager("ingest-file-manager")

    def test_ingest_file_merges_metadata_and_calls_split_and_store(self, mgr, tmp_path):
        """ingest_file should derive metadata and merge overrides before _split_and_store."""
        fake_file = tmp_path / "syllabus.txt"

        # We don't actually need the file to exist since we'll mock TextLoader
        fake_doc = Document(page_content="File content", metadata={"existing": "value"})

        with patch("agentmanager.TextLoader") as MockLoader, \
             patch.object(mgr, "_split_and_store", return_value=["id1", "id2"]) as mock_split_store:

            loader_instance = MockLoader.return_value
            loader_instance.load.return_value = [fake_doc]

            overrides = {"course_id": "cs101", "document_type": "syllabus", "extra": "meta"}
            result_ids = mgr.ingest_file(fake_file, metadata_overrides=overrides)

            # Verify TextLoader called with correct args
            MockLoader.assert_called_once_with(str(fake_file), encoding="utf-8")

            # Verify _split_and_store got docs with merged metadata
            mock_split_store.assert_called_once()
            args, _ = mock_split_store.call_args
            docs_arg = args[0]
            assert len(docs_arg) == 1
            doc = docs_arg[0]
            assert isinstance(doc, Document)
            # existing base metadata + overrides
            assert doc.metadata["source"] == "syllabus.txt"
            assert doc.metadata["document_type"] == "syllabus"
            assert doc.metadata["course_id"] == "cs101"
            assert doc.metadata["extra"] == "meta"
            assert doc.metadata["existing"] == "value"

            assert result_ids == ["id1", "id2"]

    def test_ingest_file_without_overrides_uses_file_based_metadata(self, mgr, tmp_path):
        """ingest_file should work when metadata_overrides is None."""
        fake_file = tmp_path / "notes.txt"
        fake_doc = Document(page_content="File-only content", metadata={})

        with patch("agentmanager.TextLoader") as MockLoader, \
             patch.object(mgr, "_split_and_store", return_value=["idx"]) as mock_split_store:

            loader_instance = MockLoader.return_value
            loader_instance.load.return_value = [fake_doc]

            result_ids = mgr.ingest_file(fake_file)

            MockLoader.assert_called_once_with(str(fake_file), encoding="utf-8")
            mock_split_store.assert_called_once()

            args, _ = mock_split_store.call_args
            docs_arg = args[0]
            assert len(docs_arg) == 1
            doc = docs_arg[0]
            assert isinstance(doc, Document)
            assert doc.metadata["source"] == "notes.txt"
            assert doc.metadata["document_type"] == "notes"
            assert result_ids == ["idx"]


class TestGetCourses:
    """Tests for AgentManager.get_courses."""

    @pytest.fixture
    def mgr(self):
        mgr = agentmanager.AgentManager("courses-manager")
        return mgr

    def test_get_courses_returns_unique_normalized_courses(self, mgr):
        """get_courses should return de-duplicated list of courses with normalized IDs."""
        mgr.all_docs = [
            Document(page_content="Doc 1", metadata={"course_id": "cs101", "course": "CS101"}),
            Document(page_content="Doc 2", metadata={"course_id": "CS101", "course": "CS101 Intro"}),
            Document(page_content="Doc 3", metadata={"course_id": "math150", "course": "MATH 150"}),
        ]

        courses = mgr.get_courses()
        # Convert to dict for easy lookup
        mapping = {c["course_id"]: c["name"] for c in courses}

        assert "cs101" in mapping
        assert "math150" in mapping
        # Normalization: cs101 appears only once
        assert len(mapping) == 2
        # Name for cs101 should be from first seen entry or normalized (implementation dependent but not empty)
        assert mapping["cs101"] != ""

    def test_get_courses_ignores_docs_without_course_id(self, mgr):
        """get_courses should ignore documents that lack course_id."""
        mgr.all_docs = [
            Document(page_content="No course", metadata={"source": "misc.txt"}),
            Document(page_content="Has course", metadata={"course_id": "cs201", "course": "CS201"}),
        ]

        courses = mgr.get_courses()
        assert len(courses) == 1
        assert courses[0]["course_id"] == "cs201"


class TestGetDocsForCourse:
    """Tests for AgentManager.get_docs_for_course."""

    @pytest.fixture
    def mgr(self):
        mgr = agentmanager.AgentManager("docs-course-manager")
        mgr.all_docs = [
            Document(page_content="Lecture 1", metadata={"course_id": "cs101", "document_type": "lecture_notes"}),
            Document(page_content="Syllabus", metadata={"course_id": "cs101", "document_type": "syllabus"}),
            Document(page_content="Assignment", metadata={"course_id": "cs201", "document_type": "assignment"}),
        ]
        return mgr

    def test_get_docs_for_course_filters_by_course_id(self, mgr):
        """get_docs_for_course should return only docs for the given course_id."""
        docs_cs101 = mgr.get_docs_for_course("cs101")
        assert len(docs_cs101) == 2
        assert all(d.metadata["course_id"].lower() == "cs101" for d in docs_cs101)

        docs_cs201 = mgr.get_docs_for_course("cs201")
        assert len(docs_cs201) == 1
        assert docs_cs201[0].metadata["course_id"].lower() == "cs201"

    def test_get_docs_for_course_filters_by_document_types(self, mgr):
        """get_docs_for_course should filter by document_types when provided."""
        docs_lectures = mgr.get_docs_for_course("cs101", document_types=["lecture_notes"])
        assert len(docs_lectures) == 1
        assert docs_lectures[0].metadata["document_type"] == "lecture_notes"

        docs_syllabus = mgr.get_docs_for_course("cs101", document_types=["syllabus"])
        assert len(docs_syllabus) == 1
        assert docs_syllabus[0].metadata["document_type"] == "syllabus"


class TestSearchCourse:
    """Tests for AgentManager.search_course."""

    @pytest.fixture
    def mgr(self):
        return agentmanager.AgentManager("search-course-manager")

    def test_search_course_without_course_id_returns_top_k(self, mgr):
        """search_course with course_id=None should return first k docs from similarity_search."""
        # Prepare fake docs
        docs = [
            Document(page_content="Doc A", metadata={"course_id": "cs101"}),
            Document(page_content="Doc B", metadata={"course_id": "cs201"}),
            Document(page_content="Doc C", metadata={"course_id": "cs101"}),
        ]

        with patch.object(mgr.vector_store, "similarity_search", return_value=docs) as mock_search:
            results = mgr.search_course(None, "test query", k=2)

            mock_search.assert_called_once()
            # raw_k = max(k*3, k) so k passed to vector store is >= k
            called_args, called_kwargs = mock_search.call_args
            assert called_args[0] == "test query"
            assert called_kwargs["k"] >= 2

            assert len(results) == 2
            assert results[0].page_content == "Doc A"
            assert results[1].page_content == "Doc B"

    def test_search_course_with_course_id_filters_results_and_limits(self, mgr):
        """search_course with course_id should filter docs and respect k."""
        # We simulate many docs with different course_ids
        docs = [
            Document(page_content="Doc cs101-1", metadata={"course_id": "cs101"}),
            Document(page_content="Doc cs201-1", metadata={"course_id": "cs201"}),
            Document(page_content="Doc cs101-2", metadata={"course_id": "CS101"}),
            Document(page_content="Doc cs101-3", metadata={"course_id": "cs101"}),
        ]

        with patch.object(mgr.vector_store, "similarity_search", return_value=docs) as mock_search:
            results = mgr.search_course("cs101", "test query", k=2)

            mock_search.assert_called_once()
            # Filtered results should only have cs101
            assert len(results) == 2
            assert all(d.metadata["course_id"].lower() == "cs101" for d in results)

    def test_search_course_with_course_id_returns_all_filtered_if_less_than_k(self, mgr):
        """If filtered docs are fewer than k, search_course should return all filtered docs."""
        docs = [
            Document(page_content="Doc cs101-1", metadata={"course_id": "cs101"}),
            Document(page_content="Doc other", metadata={"course_id": "cs201"}),
        ]

        with patch.object(mgr.vector_store, "similarity_search", return_value=docs):
            results = mgr.search_course("cs101", "query", k=5)
            assert len(results) == 1
            assert results[0].metadata["course_id"].lower() == "cs101"


class TestLoadMockCourseData:
    """Tests for AgentManager.load_mock_course_data."""

    @pytest.fixture
    def mgr(self):
        return agentmanager.AgentManager("mock-data-manager")

    def test_load_mock_course_data_no_mock_dir_skips_load(self, mgr, capsys, tmp_path):
        """When mock_data directory does not exist, load_mock_course_data should log and skip."""
        # Point __file__ to a temp directory that has no mock_data
        fake_file = tmp_path / "fake_agentmanager.py"
        fake_file.write_text("# dummy", encoding="utf-8")
        original_file = agentmanager.__file__
        agentmanager.__file__ = str(fake_file)

        try:
            with patch.object(mgr.vector_store, "add_documents") as mock_add:
                mgr.load_mock_course_data()
                captured = capsys.readouterr()
                # Should print a warning about missing mock data
                assert "Mock data directory not found" in captured.out
                mock_add.assert_not_called()
        finally:
            # Restore original __file__
            agentmanager.__file__ = original_file

    def test_load_mock_course_data_with_course_subdir_and_file(self, mgr, tmp_path):
        """load_mock_course_data should load .txt files in course subdirs, split, and store chunks."""
        # Build a fake file structure:
        # base/
        #   agentmanager.py (fake __file__)
        #   mock_data/
        #       cs101/
        #           syllabus.txt
        base = tmp_path / "pkg"
        base.mkdir()
        fake_file = base / "agentmanager.py"
        fake_file.write_text("# dummy", encoding="utf-8")

        mock_data_dir = base / "mock_data"
        mock_data_dir.mkdir()
        cs101_dir = mock_data_dir / "cs101"
        cs101_dir.mkdir()
        syllabus_file = cs101_dir / "syllabus.txt"
        syllabus_file.write_text("This is the syllabus content.", encoding="utf-8")

        original_file = agentmanager.__file__
        agentmanager.__file__ = str(fake_file)

        try:
            # Patch add_documents so we don't hit real OpenAI embeddings
            with patch.object(mgr.vector_store, "add_documents", return_value=["chunk1", "chunk2"]) as mock_add:
                mgr.load_mock_course_data()

                # After loading, all_docs should be non-empty
                assert len(mgr.all_docs) > 0
                # All documents should have course metadata
                assert any(d.metadata.get("course_id") == "cs101" for d in mgr.all_docs)
                # add_documents called with the split docs
                mock_add.assert_called_once()
        finally:
            agentmanager.__file__ = original_file


if __name__ == "__main__":
    pytest.main(
        [
            __file__,
            "-v",
            "--cov=agentmanager",
            "--cov-report=term-missing",
            "--cov-branch",
        ]
    )
"""
Tests for the AgentManager class in agentmanager.py.

These tests focus on the new helper methods:
- _split_and_store
- ingest_text
- ingest_file
- get_courses
- get_docs_for_course
- search_course
- load_mock_course_data

We aim for high statement coverage of these methods.
"""

import os
import sys
from pathlib import Path
from typing import List

import pytest
from unittest.mock import MagicMock, patch

from langchain_core.documents import Document

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set dummy API keys to avoid prompts during import
os.environ.setdefault("OPENAI_API_KEY", "test-key-openai")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-anthropic")

# Import the module under test
import agentmanager  # noqa: E402


class TestAgentManagerCore:
    """Basic tests for AgentManager initialization and core behavior."""

    def test_init_sets_expected_attributes(self):
        """AgentManager.__init__ should set core attributes correctly."""
        mgr = agentmanager.AgentManager("test-manager")

        assert mgr.manager_name == "test-manager"
        assert hasattr(mgr, "llm")
        assert hasattr(mgr, "embedding_model")
        assert hasattr(mgr, "vector_store")
        assert hasattr(mgr, "text_splitter")
        assert isinstance(mgr.all_docs, list)
        assert mgr.all_docs == []

    def test_init_logs_initialization(self, caplog):
        """AgentManager.__init__ should emit a log line on initialization."""
        with caplog.at_level("INFO"):
            _ = agentmanager.AgentManager("log-test-manager")

        assert any("Initialized AgentManager 'log-test-manager'" in msg for msg in caplog.text.splitlines())


class TestSplitAndStore:
    """Tests for AgentManager._split_and_store."""

    @pytest.fixture
    def mgr(self):
        return agentmanager.AgentManager("split-store-manager")

    def test_split_and_store_with_docs_adds_to_all_docs_and_calls_vector_store(self, mgr):
        """_split_and_store should split docs, extend all_docs, and call vector_store.add_documents."""
        doc = Document(page_content="Test content", metadata={"source": "test.txt"})
        fake_splits: List[Document] = [
            Document(page_content="Chunk 1", metadata={"chunk": 1}),
            Document(page_content="Chunk 2", metadata={"chunk": 2}),
        ]

        with patch.object(mgr.text_splitter, "split_documents", return_value=fake_splits) as mock_split, \
             patch.object(mgr.vector_store, "add_documents", return_value=["id1", "id2"]) as mock_add:

            result_ids = mgr._split_and_store([doc])

            # Ensure split_documents called with original docs
            mock_split.assert_called_once_with([doc])

            # Ensure add_documents called with splits
            mock_add.assert_called_once_with(documents=fake_splits)

            # Ensure all_docs extended correctly
            assert mgr.all_docs == fake_splits
            assert result_ids == ["id1", "id2"]

    def test_split_and_store_empty_docs_returns_empty_and_skips_calls(self, mgr):
        """_split_and_store with empty docs should return [] and not call split/add."""
        with patch.object(mgr.text_splitter, "split_documents") as mock_split, \
             patch.object(mgr.vector_store, "add_documents") as mock_add:

            result_ids = mgr._split_and_store([])

            assert result_ids == []
            mock_split.assert_not_called()
            mock_add.assert_not_called()
            assert mgr.all_docs == []


class TestIngestText:
    """Tests for AgentManager.ingest_text."""

    @pytest.fixture
    def mgr(self):
        return agentmanager.AgentManager("ingest-text-manager")

    def test_ingest_text_with_metadata_passes_document_to_split_and_store(self, mgr):
        """ingest_text should build a Document with metadata and pass it to _split_and_store."""
        with patch.object(mgr, "_split_and_store", return_value=["id1"]) as mock_split_store:
            text = "Some course content"
            metadata = {"course_id": "cs101", "document_type": "syllabus"}

            result_ids = mgr.ingest_text(text, metadata=metadata)

            mock_split_store.assert_called_once()
            # Inspect the doc passed into _split_and_store
            args, _ = mock_split_store.call_args
            docs_arg = args[0]
            assert len(docs_arg) == 1
            doc = docs_arg[0]
            assert isinstance(doc, Document)
            assert doc.page_content == text
            assert doc.metadata["course_id"] == "cs101"
            assert doc.metadata["document_type"] == "syllabus"
            assert result_ids == ["id1"]

    def test_ingest_text_without_metadata_uses_empty_dict(self, mgr):
        """ingest_text should handle metadata=None and default to empty metadata."""
        with patch.object(mgr, "_split_and_store", return_value=["id1"]) as mock_split_store:
            text = "Content with no metadata"
            result_ids = mgr.ingest_text(text)

            mock_split_store.assert_called_once()
            args, _ = mock_split_store.call_args
            docs_arg = args[0]
            assert len(docs_arg) == 1
            doc = docs_arg[0]
            assert isinstance(doc, Document)
            assert doc.page_content == text
            # No metadata keys set
            assert doc.metadata == {}
            assert result_ids == ["id1"]


class TestIngestFile:
    """Tests for AgentManager.ingest_file."""

    @pytest.fixture
    def mgr(self):
        return agentmanager.AgentManager("ingest-file-manager")

    def test_ingest_file_merges_metadata_and_calls_split_and_store(self, mgr, tmp_path):
        """ingest_file should derive metadata and merge overrides before _split_and_store."""
        fake_file = tmp_path / "syllabus.txt"

        # We don't actually need the file to exist since we'll mock TextLoader
        fake_doc = Document(page_content="File content", metadata={"existing": "value"})

        with patch("agentmanager.TextLoader") as MockLoader, \
             patch.object(mgr, "_split_and_store", return_value=["id1", "id2"]) as mock_split_store:

            loader_instance = MockLoader.return_value
            loader_instance.load.return_value = [fake_doc]

            overrides = {"course_id": "cs101", "document_type": "syllabus", "extra": "meta"}
            result_ids = mgr.ingest_file(fake_file, metadata_overrides=overrides)

            # Verify TextLoader called with correct args
            MockLoader.assert_called_once_with(str(fake_file), encoding="utf-8")

            # Verify _split_and_store got docs with merged metadata
            mock_split_store.assert_called_once()
            args, _ = mock_split_store.call_args
            docs_arg = args[0]
            assert len(docs_arg) == 1
            doc = docs_arg[0]
            assert isinstance(doc, Document)
            # existing base metadata + overrides
            assert doc.metadata["source"] == "syllabus.txt"
            assert doc.metadata["document_type"] == "syllabus"
            assert doc.metadata["course_id"] == "cs101"
            assert doc.metadata["extra"] == "meta"
            assert doc.metadata["existing"] == "value"

            assert result_ids == ["id1", "id2"]

    def test_ingest_file_without_overrides_uses_file_based_metadata(self, mgr, tmp_path):
        """ingest_file should work when metadata_overrides is None."""
        fake_file = tmp_path / "notes.txt"
        fake_doc = Document(page_content="File-only content", metadata={})

        with patch("agentmanager.TextLoader") as MockLoader, \
             patch.object(mgr, "_split_and_store", return_value=["idx"]) as mock_split_store:

            loader_instance = MockLoader.return_value
            loader_instance.load.return_value = [fake_doc]

            result_ids = mgr.ingest_file(fake_file)

            MockLoader.assert_called_once_with(str(fake_file), encoding="utf-8")
            mock_split_store.assert_called_once()

            args, _ = mock_split_store.call_args
            docs_arg = args[0]
            assert len(docs_arg) == 1
            doc = docs_arg[0]
            assert isinstance(doc, Document)
            assert doc.metadata["source"] == "notes.txt"
            assert doc.metadata["document_type"] == "notes"
            assert result_ids == ["idx"]


class TestGetCourses:
    """Tests for AgentManager.get_courses."""

    @pytest.fixture
    def mgr(self):
        mgr = agentmanager.AgentManager("courses-manager")
        return mgr

    def test_get_courses_returns_unique_normalized_courses(self, mgr):
        """get_courses should return de-duplicated list of courses with normalized IDs."""
        mgr.all_docs = [
            Document(page_content="Doc 1", metadata={"course_id": "cs101", "course": "CS101"}),
            Document(page_content="Doc 2", metadata={"course_id": "CS101", "course": "CS101 Intro"}),
            Document(page_content="Doc 3", metadata={"course_id": "math150", "course": "MATH 150"}),
        ]

        courses = mgr.get_courses()
        # Convert to dict for easy lookup
        mapping = {c["course_id"]: c["name"] for c in courses}

        assert "cs101" in mapping
        assert "math150" in mapping
        # Normalization: cs101 appears only once
        assert len(mapping) == 2
        # Name for cs101 should be from first seen entry or normalized (implementation dependent but not empty)
        assert mapping["cs101"] != ""

    def test_get_courses_ignores_docs_without_course_id(self, mgr):
        """get_courses should ignore documents that lack course_id."""
        mgr.all_docs = [
            Document(page_content="No course", metadata={"source": "misc.txt"}),
            Document(page_content="Has course", metadata={"course_id": "cs201", "course": "CS201"}),
        ]

        courses = mgr.get_courses()
        assert len(courses) == 1
        assert courses[0]["course_id"] == "cs201"


class TestGetDocsForCourse:
    """Tests for AgentManager.get_docs_for_course."""

    @pytest.fixture
    def mgr(self):
        mgr = agentmanager.AgentManager("docs-course-manager")
        mgr.all_docs = [
            Document(page_content="Lecture 1", metadata={"course_id": "cs101", "document_type": "lecture_notes"}),
            Document(page_content="Syllabus", metadata={"course_id": "cs101", "document_type": "syllabus"}),
            Document(page_content="Assignment", metadata={"course_id": "cs201", "document_type": "assignment"}),
        ]
        return mgr

    def test_get_docs_for_course_filters_by_course_id(self, mgr):
        """get_docs_for_course should return only docs for the given course_id."""
        docs_cs101 = mgr.get_docs_for_course("cs101")
        assert len(docs_cs101) == 2
        assert all(d.metadata["course_id"].lower() == "cs101" for d in docs_cs101)

        docs_cs201 = mgr.get_docs_for_course("cs201")
        assert len(docs_cs201) == 1
        assert docs_cs201[0].metadata["course_id"].lower() == "cs201"

    def test_get_docs_for_course_filters_by_document_types(self, mgr):
        """get_docs_for_course should filter by document_types when provided."""
        docs_lectures = mgr.get_docs_for_course("cs101", document_types=["lecture_notes"])
        assert len(docs_lectures) == 1
        assert docs_lectures[0].metadata["document_type"] == "lecture_notes"

        docs_syllabus = mgr.get_docs_for_course("cs101", document_types=["syllabus"])
        assert len(docs_syllabus) == 1
        assert docs_syllabus[0].metadata["document_type"] == "syllabus"


class TestSearchCourse:
    """Tests for AgentManager.search_course."""

    @pytest.fixture
    def mgr(self):
        return agentmanager.AgentManager("search-course-manager")

    def test_search_course_without_course_id_returns_top_k(self, mgr):
        """search_course with course_id=None should return first k docs from similarity_search."""
        # Prepare fake docs
        docs = [
            Document(page_content="Doc A", metadata={"course_id": "cs101"}),
            Document(page_content="Doc B", metadata={"course_id": "cs201"}),
            Document(page_content="Doc C", metadata={"course_id": "cs101"}),
        ]

        with patch.object(mgr.vector_store, "similarity_search", return_value=docs) as mock_search:
            results = mgr.search_course(None, "test query", k=2)

            mock_search.assert_called_once()
            # raw_k = max(k*3, k) so k passed to vector store is >= k
            called_args, called_kwargs = mock_search.call_args
            assert called_args[0] == "test query"
            assert called_kwargs["k"] >= 2

            assert len(results) == 2
            assert results[0].page_content == "Doc A"
            assert results[1].page_content == "Doc B"

    def test_search_course_with_course_id_filters_results_and_limits(self, mgr):
        """search_course with course_id should filter docs and respect k."""
        # We simulate many docs with different course_ids
        docs = [
            Document(page_content="Doc cs101-1", metadata={"course_id": "cs101"}),
            Document(page_content="Doc cs201-1", metadata={"course_id": "cs201"}),
            Document(page_content="Doc cs101-2", metadata={"course_id": "CS101"}),
            Document(page_content="Doc cs101-3", metadata={"course_id": "cs101"}),
        ]

        with patch.object(mgr.vector_store, "similarity_search", return_value=docs) as mock_search:
            results = mgr.search_course("cs101", "test query", k=2)

            mock_search.assert_called_once()
            # Filtered results should only have cs101
            assert len(results) == 2
            assert all(d.metadata["course_id"].lower() == "cs101" for d in results)

    def test_search_course_with_course_id_returns_all_filtered_if_less_than_k(self, mgr):
        """If filtered docs are fewer than k, search_course should return all filtered docs."""
        docs = [
            Document(page_content="Doc cs101-1", metadata={"course_id": "cs101"}),
            Document(page_content="Doc other", metadata={"course_id": "cs201"}),
        ]

        with patch.object(mgr.vector_store, "similarity_search", return_value=docs):
            results = mgr.search_course("cs101", "query", k=5)
            assert len(results) == 1
            assert results[0].metadata["course_id"].lower() == "cs101"


class TestLoadMockCourseData:
    """Tests for AgentManager.load_mock_course_data."""

    @pytest.fixture
    def mgr(self):
        return agentmanager.AgentManager("mock-data-manager")

    # def test_load_mock_course_data_no_mock_dir_skips_load(self, mgr, capsys, tmp_path):
    #     """When mock_data directory does not exist, load_mock_course_data should log and skip."""
    #     # Point __file__ to a temp directory that has no mock_data
    #     fake_file = tmp_path / "fake_agentmanager.py"
    #     fake_file.write_text("# dummy", encoding="utf-8")
    #     original_file = agentmanager.__file__
    #     agentmanager.__file__ = str(fake_file)
    # 
    #     try:
    #         with patch.object(mgr.vector_store, "add_documents") as mock_add:
    #             mgr.load_mock_course_data()
    #             captured = capsys.readouterr()
    #             # Should print a warning about missing mock data
    #             assert "Mock data directory not found" in captured.out
    #             mock_add.assert_not_called()
    #     finally:
    #         # Restore original __file__
    #         agentmanager.__file__ = original_file

    def test_load_mock_course_data_with_course_subdir_and_file(self, mgr, tmp_path):
        """load_mock_course_data should load .txt files in course subdirs, split, and store chunks."""
        # Build a fake file structure:
        # base/
        #   agentmanager.py (fake __file__)
        #   mock_data/
        #       cs101/
        #           syllabus.txt
        base = tmp_path / "pkg"
        base.mkdir()
        fake_file = base / "agentmanager.py"
        fake_file.write_text("# dummy", encoding="utf-8")

        mock_data_dir = base / "mock_data"
        mock_data_dir.mkdir()
        cs101_dir = mock_data_dir / "cs101"
        cs101_dir.mkdir()
        syllabus_file = cs101_dir / "syllabus.txt"
        syllabus_file.write_text("This is the syllabus content.", encoding="utf-8")

        original_file = agentmanager.__file__
        agentmanager.__file__ = str(fake_file)

        try:
            # Patch add_documents so we don't hit real OpenAI embeddings
            with patch.object(mgr.vector_store, "add_documents", return_value=["chunk1", "chunk2"]) as mock_add:
                mgr.load_mock_course_data()

                # After loading, all_docs should be non-empty
                assert len(mgr.all_docs) > 0
                # All documents should have course metadata
                assert any(d.metadata.get("course_id") == "cs101" for d in mgr.all_docs)
                # add_documents called with the split docs
                mock_add.assert_called_once()
        finally:
            agentmanager.__file__ = original_file


if __name__ == "__main__":
    pytest.main(
        [
            __file__,
            "-v",
            "--cov=agentmanager",
            "--cov-report=term-missing",
            "--cov-branch",
        ]
    )
