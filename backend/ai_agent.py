from langchain.tools import tool
from langchain.agents import create_agent
from agentmanager import AgentManager
from ai_settings import ai_features_enabled
import logging
import json

logger = logging.getLogger("docstudio.ai_agent")

agent_manager = AgentManager("main-manager")

# ---------------------------------------------------------------------------
# Tectonic-compatible LaTeX packages
# These are the ONLY packages guaranteed to compile with our Tectonic v0.15.0
# compiler. Do NOT use any package not on this list.
# ---------------------------------------------------------------------------
TECTONIC_SAFE_PACKAGES = """
ALLOWED LaTeX PACKAGES (Tectonic v0.15.0 — use ONLY these):
  Core layout & formatting:
    \\usepackage[margin=1in]{geometry}   % page margins
    \\usepackage{parskip}                % paragraph spacing
    \\usepackage{setspace}               % \\doublespacing, \\onehalfspacing
    \\usepackage{multicol}               % multi-column layouts
    \\usepackage{fancyhdr}               % headers and footers

  Math:
    \\usepackage{amsmath}                % align, equation, gather, etc.
    \\usepackage{amssymb}                % math symbols (\\mathbb, \\mathcal, etc.)
    \\usepackage{amsthm}                 % theorem environments
    \\usepackage{bm}                     % \\bm{} bold math
    \\usepackage{mathtools}              % extends amsmath
    \\usepackage{siunitx}                % SI units: \\SI{9.8}{\\meter\\per\\second}

  Figures & tables:
    \\usepackage{graphicx}               % \\includegraphics
    \\usepackage{float}                  % [H] placement
    \\usepackage{caption}                % \\caption customization
    \\usepackage{subcaption}             % subfigures
    \\usepackage{booktabs}               % \\toprule, \\midrule, \\bottomrule
    \\usepackage{array}                  % column formatting
    \\usepackage{tabularx}               % auto-width tables
    \\usepackage{longtable}              % multi-page tables

  Lists & enumeration:
    \\usepackage{enumitem}               % customize lists

  Color & boxes:
    \\usepackage{xcolor}                 % \\textcolor, \\colorbox

  Code listings:
    \\usepackage{listings}               % code blocks

  Algorithms:
    \\usepackage{algorithm}              % algorithm float
    \\usepackage{algpseudocode}          % pseudocode (part of algorithmicx)

  Citations & hyperlinks:
    \\usepackage{hyperref}               % \\href, \\url, clickable refs
    \\usepackage{natbib}                 % \\citep{}, \\citet{}

  Drawing:
    \\usepackage{tikz}                   % diagrams (load specific libraries as needed)
    \\usepackage{pgfplots}               % plots (add \\pgfplotsset{compat=1.18})

FORBIDDEN — do NOT use these (they break Tectonic or are redundant with XeTeX):
  fontenc, inputenc, lmodern, times, palatino, pslatex, psfig, epsfig,
  t1enc, utf8x, ucs, ae, zefonts, type1cm, fix-cm
"""


# ---------------------------------------------------------------------------
# Tool: generate a brand-new LaTeX document from a plain-English description
# ---------------------------------------------------------------------------
@tool
def generate_document(description: str, uploaded_filenames: str = "") -> str:
    """
    Generate a complete, compilable LaTeX document from a plain-English description.

    Args:
        description: What the user wants the document to contain.
        uploaded_filenames: Comma-separated list of uploaded image filenames the user
                            wants included (e.g. "figure1.png,figure2.png").

    Returns:
        A complete LaTeX document string starting with \\documentclass.
    """
    filenames = [f.strip() for f in uploaded_filenames.split(",") if f.strip()]

    figure_hint = ""
    if filenames:
        figure_hint = (
            "\n\nThe user has uploaded the following files. Include them as figures "
            "using \\includegraphics where appropriate:\n"
            + "\n".join(f"  - {fn}" for fn in filenames)
        )

    prompt = (
        "You are a LaTeX document generator. Produce a complete, compilable LaTeX document "
        "based on the description below.\n\n"
        f"{TECTONIC_SAFE_PACKAGES}\n\n"
        "REQUIRED PREAMBLE — always start with \\documentclass{{article}} and include the packages "
        "you need from the allowed list above.\n\n"
        "VECTOR NOTATION — for this document use:\n"
        "  - \\bm{v} for bold vector v (requires bm package)\n"
        "  - \\hat{\\bm{i}}, \\hat{\\bm{j}} for unit vectors î, ĵ\n"
        "  - Use \\[ ... \\] for display math, $ ... $ for inline\n"
        "  - Use \\text{m/s} inside math for units, not plain text\n\n"
        "OTHER REQUIREMENTS:\n"
        "- Produce professional academic formatting\n"
        "- End with \\end{document}\n"
        "- Output ONLY the raw LaTeX — no markdown fences, no explanation, no comments outside LaTeX\n"
        "- Every opened environment must be closed\n"
        "- Do NOT use \\hat{\\mathbf{i}} — use \\hat{\\bm{i}} instead (mathbf doesn't work in all math contexts)\n"
        f"{figure_hint}\n\n"
        f"Document description:\n{description}"
    )

    response = agent_manager.llm.invoke(prompt)
    latex = response.content if hasattr(response, "content") else str(response)

    # Strip markdown code fences if the model added them
    latex = latex.strip()
    if latex.startswith("```"):
        lines = latex.split("\n")
        latex = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    agent_manager.current_latex = latex
    logger.info("generate_document produced %d chars of LaTeX", len(latex))
    return latex


# ---------------------------------------------------------------------------
# Tool: apply a plain-English edit to the current LaTeX document
# ---------------------------------------------------------------------------
@tool
def edit_document(instruction: str) -> str:
    """
    Apply a plain-English edit instruction to the current LaTeX document.

    Args:
        instruction: What the user wants changed (e.g. "make the introduction longer",
                     "add a references section", "move results before discussion").

    Returns:
        The updated LaTeX document string.
    """
    current = agent_manager.current_latex
    if not current:
        return "No document exists yet. Please generate one first."

    prompt = (
        "You are a LaTeX document editor. Apply the instruction below to the LaTeX document "
        "and return the complete updated document.\n\n"
        "FILE REFERENCE RULE (highest priority):\n"
        "If the instruction references a file, figure, image, or attachment by name or @mention "
        "(e.g. '@figure1', 'add figure1.png', 'include the diagram') and that file does NOT "
        "already appear in the current document's \\includegraphics commands, you MUST NOT "
        "invent or generate placeholder content for it. Instead, return ONLY this message "
        "(do not return any LaTeX): "
        "'MISSING_FILE: Please upload the file first, then I can add it to the document.'\n\n"
        f"{TECTONIC_SAFE_PACKAGES}\n\n"
        "OTHER REQUIREMENTS:\n"
        "- Return the FULL updated document — not just the changed section\n"
        "- Keep all existing structure and packages unless the instruction changes them\n"
        "- Only use packages from the allowed list above\n"
        "- Output ONLY the raw LaTeX — no markdown fences, no explanation\n\n"
        f"Instruction: {instruction}\n\n"
        f"Current document:\n{current}"
    )

    response = agent_manager.llm.invoke(prompt)
    latex = response.content if hasattr(response, "content") else str(response)

    latex = latex.strip()
    if latex.startswith("```"):
        lines = latex.split("\n")
        latex = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    agent_manager.current_latex = latex
    logger.info("edit_document produced %d chars of LaTeX", len(latex))
    return latex


# ---------------------------------------------------------------------------
# Tool: create a structured plan from an assignment description
# ---------------------------------------------------------------------------
@tool
def create_plan(assignment_description: str, student_context: str = "") -> str:
    """
    Analyze an assignment and create a focused, student-specific plan.

    Args:
        assignment_description: The full text of the assignment prompt or
                                 description of what the student needs to work on.
                                 Must be the ACTUAL assignment content.
        student_context: What the student told you about their current readiness
                         (e.g. "already did lectures, ready to solve problems",
                          "starting from scratch", "start at problem 3").
                         Leave empty if not provided.

    Returns:
        A JSON string containing the plan steps array.
    """
    context_hint = ""
    if student_context.strip():
        context_hint = f"\n\nStudent's starting point: {student_context.strip()}\n"

    prompt = (
        "You are an academic assistant creating a focused, personalized plan for a student.\n\n"
        "ASSIGNMENT TYPE DETECTION — read the assignment and classify it first:\n"
        "  A) PROBLEM SET / HOMEWORK: numbered or lettered problems to solve (physics, math, engineering, etc.)\n"
        "  B) ESSAY / RESEARCH PAPER: writing assignment requiring thesis, research, drafting\n"
        "  C) LAB REPORT: experimental procedure and analysis write-up\n"
        "  D) OTHER: project, case study, etc.\n\n"
        "RULES BY TYPE:\n\n"
        "  For TYPE A (Problem Set):\n"
        "  - Create EXACTLY ONE step per problem/part. If there are 4 problems, create 4 steps.\n"
        "  - Title each step: 'Problem 1', 'Problem 2', etc. (or 'Problem 1a', '1b' if sub-parts exist)\n"
        "  - Description: paste or paraphrase the exact problem statement so the student sees it in the step\n"
        "  - Guidance: 2-3 sentences on the concept or approach to use (e.g. 'Apply Newton's second law...')\n"
        "  - input_prompt: 'Show me your work or tell me where you get stuck'\n"
        "  - DO NOT add generic phases like 'review lecture notes', 'research', 'draft', or 'revise'\n"
        "    UNLESS the student's starting point says they need concept review — if so, add ONE review\n"
        "    step at the start before the problems.\n\n"
        "  For TYPE B (Essay):\n"
        "  - Create 3-5 steps max. Do not pad with redundant steps.\n"
        "  - Typical flow: [Thesis/Argument] → [Outline] → [Draft] → [Revise] (skip steps already done)\n"
        "  - If student says they already have a thesis, skip the thesis step\n\n"
        "  For TYPE C/D:\n"
        "  - Follow the natural structure of the assignment (procedure → analysis → write-up, etc.)\n"
        "  - Keep to 3-6 steps\n\n"
        "STUDENT STARTING POINT:\n"
        "  - If student says they already understand the material / did lectures → skip any review steps,\n"
        "    start directly at the first problem or task\n"
        "  - If student says 'start at problem N' → begin the plan at that problem\n"
        "  - If student says 'starting from scratch' → add a brief concept review step first\n"
        f"{context_hint}\n"
        "OUTPUT FORMAT:\n"
        "Output ONLY valid JSON — an array of objects with keys:\n"
        "  \"title\": short step label (e.g. 'Problem 1' or 'Draft Introduction')\n"
        "  \"description\": what this step is or the actual problem statement\n"
        "  \"guidance\": 2-3 sentences of specific advice for this step\n"
        "  \"input_prompt\": exactly what you want the student to provide (be specific)\n"
        "No markdown fences, no explanation, no commentary.\n\n"
        "Assignment:\n"
        f"{assignment_description}"
    )

    response = agent_manager.llm.invoke(prompt)
    raw = response.content if hasattr(response, "content") else str(response)

    # Strip markdown fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    # Parse and enrich with status
    try:
        steps = json.loads(raw)
        for i, step in enumerate(steps):
            step["status"] = "active" if i == 0 else "pending"
            if "guidance" not in step:
                step["guidance"] = ""
            if "input_prompt" not in step:
                step["input_prompt"] = step.get("description", "") or ""
    except json.JSONDecodeError:
        logger.error("Failed to parse plan JSON: %s", raw[:200])
        steps = [{"title": "Get started", "description": raw[:200], "status": "active", "guidance": "", "input_prompt": ""}]

    agent_manager.set_plan(steps)
    logger.info("create_plan produced %d steps", len(steps))
    return json.dumps(steps)


# ---------------------------------------------------------------------------
# Tool: generate guidance for a specific plan step
# ---------------------------------------------------------------------------
@tool
def advance_step(step_index: int, student_context: str = "") -> str:
    """
    Generate detailed guidance and resources for a specific plan step.
    Called when the student moves to a new step or needs help with the current one.

    Args:
        step_index: The 0-based index of the step to provide guidance for.
        student_context: Any additional context from the student about what
                          they've done so far or what they need help with.

    Returns:
        Guidance text for the student.
    """
    plan = agent_manager.current_plan
    if not plan or step_index < 0 or step_index >= len(plan):
        return "No active plan or invalid step index."

    step = plan[step_index]
    completed_summary = ""
    for i in range(step_index):
        completed_summary += f"  - Step {i+1} ({plan[i]['title']}): completed\n"

    is_problem_step = any(
        kw in step.get("title", "").lower()
        for kw in ["problem", "part ", "question", "exercise", "prob "]
    )

    if student_context and is_problem_step:
        # Student submitted work on a problem — act as a tutor reviewing it
        prompt = (
            "You are a patient, expert tutor helping a student work through a specific problem. "
            "The student has submitted their attempt or question below.\n\n"
            "IMPORTANT — GEOMETRY VERIFICATION (do this before any math):\n"
            "If this problem involves a figure, diagram, or spatial setup (vectors, motion, forces, etc.), "
            "you MUST start your response with a brief 'Geometry check' section that states:\n"
            "  - The coordinate system you are using (e.g. x = right, y = up)\n"
            "  - The direction each body/object is moving based on the figure\n"
            "  - What reference direction any angle (like θ) is measured FROM\n"
            "Keep this to 2-4 bullet points. This lets the student verify your setup before you proceed.\n\n"
            "Then:\n"
            "1. Identify what the student got right\n"
            "2. Spot where they went wrong or got stuck (be specific)\n"
            "3. Give a targeted hint — do NOT just give the full answer\n"
            "4. Ask a follow-up question to check understanding\n\n"
            "Be conversational, encouraging, and concise (under 300 words).\n\n"
            f"Problem: {step['title']}\n"
            f"Problem statement: {step['description']}\n\n"
            f"Student's attempt/question:\n{student_context}\n\n"
            "Start with 'Geometry check:' if a figure/diagram is involved, then give your tutoring feedback."
        )
    elif student_context:
        # Student submitted context for a non-problem step
        prompt = (
            "You are an academic assistant helping a student with their assignment. "
            "They've shared what they've done or are asking a question about the current step.\n\n"
            f"Plan has {len(plan)} steps. Current step {step_index + 1}: "
            f"'{step['title']}' — {step['description']}\n\n"
            f"Completed steps:\n{completed_summary if completed_summary else '  (none yet)'}\n\n"
            f"Student's input:\n{student_context}\n\n"
            "Respond with specific, actionable feedback. Acknowledge what they've done, "
            "address any gaps, and tell them clearly whether they're ready to move on. "
            "Be concise (under 200 words)."
        )
    else:
        # No student context — give orientation guidance for this step
        prompt = (
            "You are an academic assistant. A student is starting a new step in their plan. "
            "Give a brief, encouraging orientation (2-3 sentences) for this step — "
            "what to focus on and one concrete tip for getting started.\n\n"
            f"Step {step_index + 1} of {len(plan)}: '{step['title']}'\n"
            f"Description: {step['description']}\n\n"
            f"Completed so far:\n{completed_summary if completed_summary else '  (none yet)'}\n\n"
            "Keep it under 100 words. Be encouraging and specific to this step."
        )

    response = agent_manager.llm.invoke(prompt)
    guidance = response.content if hasattr(response, "content") else str(response)

    # Only overwrite the step's guidance when the student provided context (e.g. submitted
    # step input from the plan panel). Otherwise return guidance without changing the plan,
    # so the step text doesn't keep changing while the user is on that step.
    if (student_context or "").strip():
        plan[step_index]["guidance"] = guidance
        logger.info("advance_step updated guidance for step %d (student context provided)", step_index)
    else:
        existing = (plan[step_index].get("guidance") or "").strip()
        if existing:
            return existing
        plan[step_index]["guidance"] = guidance
        logger.info("advance_step set initial guidance for step %d", step_index)
    return guidance


# ---------------------------------------------------------------------------
# Tool: read an uploaded file's content
# ---------------------------------------------------------------------------
@tool
def read_file(file_id: str) -> str:
    """
    Read the full text content of an uploaded file. Use this when you need to
    see what's inside a file the student uploaded. You only receive file metadata
    (name, type, size) automatically — call this tool to actually read it.

    Call this when:
    - The student asks about or references an uploaded file
    - You need to understand a file's content to help the student
    - You want to determine if a file is a reference doc or a figure

    After reading, you should call categorize_file to classify the file.

    Args:
        file_id: The file_id of the uploaded file to read.

    Returns:
        The full text content of the file, or an error message.
    """
    path = agent_manager.uploads.get(file_id)
    if not path:
        return f"File {file_id} not found in uploads."

    text = agent_manager.upload_texts.get(file_id, "")
    if not text:
        filename = path.name if path else file_id
        return (
            f"No text content available for '{filename}'. "
            f"This is likely an image file — consider categorizing it as 'figure'."
        )

    filename = path.name
    return f"=== Content of {filename} ({len(text)} chars) ===\n\n{text}"


# ---------------------------------------------------------------------------
# Tool: categorize an uploaded file's purpose
# ---------------------------------------------------------------------------
@tool
def categorize_file(file_id: str, purpose: str) -> str:
    """
    Categorize an uploaded file as either a 'reference' document (for research
    and context) or a 'figure' (an image/diagram to include in the final document).

    Call this when you understand from the conversation what a file is for.
    Reference files get chunked and indexed for smart retrieval.
    Figure files are kept as-is for LaTeX \\includegraphics.

    Args:
        file_id: The file_id of the uploaded file to categorize.
        purpose: Either 'reference' or 'figure'.

    Returns:
        Confirmation message.
    """
    if purpose not in ("reference", "figure"):
        return f"Invalid purpose '{purpose}'. Must be 'reference' or 'figure'."

    path = agent_manager.uploads.get(file_id)
    if not path:
        return f"File {file_id} not found in uploads."

    agent_manager.set_file_purpose(file_id, purpose)
    filename = path.name

    if purpose == "reference":
        return (
            f"Categorized '{filename}' as reference material. "
            f"Its content has been indexed for smart retrieval — "
            f"I'll pull relevant sections as needed instead of reading the whole thing each time."
        )
    else:
        return (
            f"Categorized '{filename}' as a figure. "
            f"It will be available for \\includegraphics in the final document."
        )


# ---------------------------------------------------------------------------
# Tool: search reference documents for relevant context
# ---------------------------------------------------------------------------
@tool
def search_references(query: str, k: int = 4) -> str:
    """
    Search through ingested reference documents to find relevant passages.
    Use this when you need specific information from the student's uploaded
    reference materials to help answer a question or provide guidance.

    Args:
        query: What you're looking for (e.g. "arguments about climate change",
               "methodology section requirements", "grading criteria").
        k: How many relevant chunks to return (default 4).

    Returns:
        Relevant passages from reference documents, or a message if none found.
    """
    context = agent_manager.get_reference_context(query, k=k)
    if not context:
        return "No relevant passages found in reference documents. The student may not have uploaded reference materials yet, or they haven't been categorized."
    return f"Relevant passages from reference documents:\n\n{context}"


# ---------------------------------------------------------------------------
# Tool: analyze an assignment prompt to extract requirements
# ---------------------------------------------------------------------------
@tool
def analyze_assignment(assignment_text: str) -> str:
    """
    Analyze an assignment prompt to extract key requirements like topic,
    page count, citation style, rubric criteria, and deadlines.

    Call this when the student uploads or describes an assignment and you
    need to understand what's being asked before proposing an outline.

    Args:
        assignment_text: The full text of the assignment prompt.

    Returns:
        A JSON string with extracted assignment requirements.
    """
    prompt = (
        "You are an academic assignment analyzer. Read the assignment below and extract "
        "key requirements into a structured summary.\n\n"
        "Extract:\n"
        "- topic: The main topic or subject area\n"
        "- page_count: Required page count or word count (null if not specified)\n"
        "- citation_style: Required citation format — APA, MLA, Chicago, etc. (null if not specified)\n"
        "- key_requirements: Array of specific requirements mentioned\n"
        "- rubric_criteria: Array of grading criteria if mentioned\n"
        "- suggested_sections: Array of sections the assignment implies (e.g. intro, lit review, methods)\n"
        "- deadline: Deadline if mentioned (null if not specified)\n\n"
        "Output ONLY valid JSON with these keys. No markdown fences, no explanation.\n\n"
        f"Assignment:\n{assignment_text}"
    )

    response = agent_manager.llm.invoke(prompt)
    raw = response.content if hasattr(response, "content") else str(response)

    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    # Validate JSON
    try:
        parsed = json.loads(raw)
        logger.info("analyze_assignment extracted: topic=%s", parsed.get("topic", "unknown"))
    except json.JSONDecodeError:
        logger.error("Failed to parse assignment analysis JSON: %s", raw[:200])
        raw = json.dumps({"topic": "unknown", "key_requirements": [raw[:200]]})

    return raw


# ---------------------------------------------------------------------------
# Tool: propose a structured paper outline
# ---------------------------------------------------------------------------
@tool
def propose_outline(thesis: str, assignment_summary: str) -> str:
    """
    Generate a structured paper outline based on a thesis statement and
    assignment requirements. The outline will guide paragraph-by-paragraph writing.

    Call this after the student has a thesis statement (or you've helped them
    form one) and you understand the assignment requirements.

    Args:
        thesis: The student's thesis statement or central argument.
        assignment_summary: A summary of assignment requirements (from analyze_assignment
                            or the student's description).

    Returns:
        A JSON string with the outline structure, also stored for the writing workflow.
    """
    # Check for reference material to inform the outline
    ref_context = agent_manager.get_reference_context(thesis, k=3)
    ref_hint = ""
    if ref_context:
        ref_hint = (
            "\n\nThe student has uploaded reference materials. Here are relevant passages "
            "that may inform the outline structure:\n" + ref_context
        )

    prompt = (
        "You are an academic writing assistant. Create a detailed paper outline based on "
        "the thesis and assignment requirements below.\n\n"
        "Requirements for the outline:\n"
        "- Each section should have: title, description (what it covers), "
        "subsections (array of key points), and target_length (e.g. '1-2 paragraphs')\n"
        "- Include standard academic sections: Introduction, Body sections, Conclusion\n"
        "- The introduction should establish context and state the thesis\n"
        "- Body sections should each support the thesis with distinct arguments/evidence\n"
        "- The conclusion should synthesize and restate significance\n"
        "- Tailor the number of sections to the assignment's page/word count\n"
        "- Be specific about what each section should argue or discuss\n\n"
        "Output ONLY valid JSON — an object with keys:\n"
        "  \"thesis\": the thesis statement,\n"
        "  \"citation_style\": inferred citation style or 'APA' as default,\n"
        "  \"sections\": array of {\"title\", \"description\", \"subsections\": [], \"target_length\"}\n"
        "No markdown fences, no explanation.\n\n"
        f"Thesis: {thesis}\n\n"
        f"Assignment requirements: {assignment_summary}"
        f"{ref_hint}"
    )

    response = agent_manager.llm.invoke(prompt)
    raw = response.content if hasattr(response, "content") else str(response)

    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        outline_data = json.loads(raw)
        sections = outline_data.get("sections", [])
        # Enrich with status tracking
        for section in sections:
            section["status"] = "pending"
            section["content"] = ""
        agent_manager.set_outline(sections)
        logger.info("propose_outline created %d sections", len(sections))
    except json.JSONDecodeError:
        logger.error("Failed to parse outline JSON: %s", raw[:200])
        outline_data = {"thesis": thesis, "sections": [], "error": "Failed to parse outline"}

    return raw


# ---------------------------------------------------------------------------
# Tool: write a single paragraph for a specific outline section
# ---------------------------------------------------------------------------
@tool
def write_paragraph(section_index: int, context: str = "") -> str:
    """
    Write a single paragraph (or short section) for the given outline section.
    The paragraph will be presented to the student for approval before being
    added to the document.

    Call this one section at a time during writing mode. After the student
    approves, call add_approved_paragraph to add it to the LaTeX document.

    Args:
        section_index: The 0-based index of the outline section to write for.
        context: Additional context from the student (e.g. specific points they
                 want emphasized, feedback from a previous draft).

    Returns:
        The paragraph text (plain text with citations, not LaTeX).
    """
    outline = agent_manager.current_outline
    if not outline or section_index < 0 or section_index >= len(outline):
        return "No outline available or invalid section index."

    section = outline[section_index]

    # Search references for relevant content
    ref_context = agent_manager.get_reference_context(
        f"{section.get('title', '')} {section.get('description', '')}", k=3
    )
    ref_hint = ""
    if ref_context:
        ref_hint = (
            "\n\nRelevant passages from the student's reference materials:\n" + ref_context
        )

    # Build context of previously written sections
    prev_sections = ""
    for i in range(section_index):
        s = outline[i]
        if s.get("content"):
            prev_sections += f"\n--- {s['title']} ---\n{s['content']}\n"

    prompt = (
        "You are an academic writing assistant helping a student write their paper "
        "one section at a time. Write the content for the section described below.\n\n"
        "Requirements:\n"
        "- Write in clear, academic prose appropriate for a college-level paper\n"
        "- Follow the section description and subsection points\n"
        "- If reference material is provided, incorporate relevant information with citations\n"
        "- Use in-text citations like (Author, Year) where appropriate\n"
        "- Match the target length indicated\n"
        "- Write in plain text (not LaTeX) — it will be converted later\n"
        "- Be substantive and specific, not generic\n\n"
        f"Section title: {section.get('title', 'Untitled')}\n"
        f"Section description: {section.get('description', '')}\n"
        f"Key points to cover: {', '.join(section.get('subsections', []))}\n"
        f"Target length: {section.get('target_length', '1-2 paragraphs')}\n"
    )

    if context:
        prompt += f"\nStudent's additional instructions: {context}\n"
    if prev_sections:
        prompt += f"\nPreviously written sections for context:{prev_sections}\n"
    if ref_hint:
        prompt += ref_hint

    prompt += "\n\nWrite ONLY the section content. No headers, no labels, just the paragraphs."

    response = agent_manager.llm.invoke(prompt)
    paragraph = response.content if hasattr(response, "content") else str(response)
    paragraph = paragraph.strip()

    # Store as draft awaiting approval
    agent_manager.save_paragraph_draft(section_index, paragraph)
    logger.info("write_paragraph produced %d chars for section %d", len(paragraph), section_index)
    return paragraph


# ---------------------------------------------------------------------------
# Tool: add an approved paragraph to the LaTeX document
# ---------------------------------------------------------------------------
@tool
def add_approved_paragraph(section_index: int) -> str:
    """
    Convert the currently approved paragraph draft into LaTeX and add it to
    the document. If no document exists yet, create the document skeleton
    from the outline first.

    Call this ONLY after the student has approved the paragraph draft.
    This will update the current_latex document and trigger recompilation.

    Args:
        section_index: The 0-based index of the outline section being added.

    Returns:
        The updated LaTeX document string.
    """
    outline = agent_manager.current_outline
    if not outline or section_index < 0 or section_index >= len(outline):
        return "No outline available or invalid section index."

    draft = agent_manager.paragraph_draft
    if not draft:
        return "No paragraph draft to approve."

    section = outline[section_index]
    current = agent_manager.current_latex

    if not current:
        # First paragraph — create the document skeleton
        section_titles = [s.get("title", f"Section {i+1}") for i, s in enumerate(outline)]
        prompt = (
            "You are a LaTeX document generator. Create a document skeleton for an academic paper "
            "with the following sections. Include the first section's content.\n\n"
            f"{TECTONIC_SAFE_PACKAGES}\n\n"
            "Requirements:\n"
            "- Start with \\documentclass{article}\n"
            "- Include geometry, setspace, natbib from the allowed packages above\n"
            "- Use \\doublespacing for academic formatting\n"
            "- Create \\section{} for each section listed below\n"
            "- Insert the provided paragraph text into the first section\n"
            "- Leave other sections with a %% TODO comment\n"
            "- End with \\end{document}\n"
            "- Output ONLY raw LaTeX — no markdown fences\n\n"
            f"Sections: {', '.join(section_titles)}\n\n"
            f"Content for '{section.get('title', 'Introduction')}':\n{draft}"
        )
    else:
        # Add to existing document
        prompt = (
            "You are a LaTeX document editor. Add the following paragraph content to the "
            "correct section of the existing LaTeX document.\n\n"
            "Requirements:\n"
            "- Find the section matching the title below (or the %% TODO placeholder)\n"
            "- Replace the %% TODO comment with the paragraph content, properly formatted in LaTeX\n"
            "- Convert any in-text citations like (Author, Year) to \\cite{} commands\n"
            "- Keep ALL existing content and structure intact\n"
            "- Return the FULL updated document\n"
            "- Output ONLY raw LaTeX — no markdown fences\n\n"
            f"Section to update: {section.get('title', 'Untitled')}\n\n"
            f"Paragraph content to add:\n{draft}\n\n"
            f"Current document:\n{current}"
        )

    response = agent_manager.llm.invoke(prompt)
    latex = response.content if hasattr(response, "content") else str(response)

    latex = latex.strip()
    if latex.startswith("```"):
        lines = latex.split("\n")
        latex = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    agent_manager.current_latex = latex

    # Mark paragraph as approved in the agent manager
    agent_manager.approve_paragraph()

    logger.info("add_approved_paragraph updated LaTeX (%d chars) for section %d", len(latex), section_index)
    return latex


# ---------------------------------------------------------------------------
# Build the agent
# ---------------------------------------------------------------------------
tools = [generate_document, edit_document, create_plan, advance_step,
         read_file, categorize_file, search_references,
         analyze_assignment, propose_outline, write_paragraph, add_approved_paragraph]

system_prompt = (
    "You are AI Document Studio, an intelligent assistant that helps students with "
    "academic assignments and document creation.\n\n"
    "CONVERSATION MODES:\n"
    "You operate in four modes based on what the student needs:\n\n"
    "1. INITIAL MODE (first interaction):\n"
    "   DIRECT LATEX REQUESTS (highest priority): If the student's message explicitly asks for LaTeX, "
    "a solution document, an answer key, or says anything like 'return LaTeX', 'give me the code', "
    "'solve and format as LaTeX', 'Overleaf', etc. — call generate_document IMMEDIATELY. "
    "Do NOT show mode-selection buttons. Do NOT ask clarifying questions. Just generate and return the LaTeX.\n\n"
    "   For all other first interactions: analyze what the student shared and respond with a brief summary. "
    "Then ask how they'd like to work on it by INCLUDING this JSON at the END of your message:\n"
    '   <!--CHOICES:[{"label":"Plan it for me","value":"planning"},{"label":"Write with me","value":"writing"},{"label":"Just do it","value":"execution"}]-->\n\n'
    "2. PLANNING MODE:\n"
    "   When the student chooses 'Plan it for me' (message is 'planning'), do NOT call create_plan yet.\n"
    "   First, briefly read the assignment (from the attached files) and identify what type it is and "
    "how many problems/tasks it has. Then ask the student ONE question about where they're starting:\n"
    "   - For a problem set: say something like 'I see you have [N] problems on [topic]. Where are you starting?'\n"
    "     Then show choices like:\n"
    '     <!--CHOICES:[{"label":"Ready to solve — skip the review","value":"plan_ready"},{"label":"Need a quick concept review first","value":"plan_review"},{"label":"Start at a specific problem","value":"plan_custom"}]-->\n'
    "   - For an essay/paper: ask if they have a thesis yet or are starting from scratch:\n"
    '     <!--CHOICES:[{"label":"Starting fresh","value":"plan_review"},{"label":"I have a thesis already","value":"plan_ready"},{"label":"Just need an outline","value":"plan_custom"}]-->\n\n'
    "   When the student responds with one of these choices (or any plain text about their starting point):\n"
    "   - 'plan_ready' or 'skip review' or 'ready to solve' → call create_plan(assignment_description, "
    "'Student is ready to solve — skip any concept review, start directly at first problem/task')\n"
    "   - 'plan_review' or 'from scratch' → call create_plan(assignment_description, "
    "'Student wants concept review first, then step through each problem')\n"
    "   - 'plan_custom' or they name a specific problem → ask which problem to start at, "
    "then call create_plan(assignment_description, 'Student wants to start at problem N')\n"
    "   - Any other plain text describing their situation → use that as the student_context in create_plan\n\n"
    "   After creating the plan, briefly describe what you made (e.g. '4 steps — one per problem') "
    "and introduce the first active step. When the student submits input from the plan panel, "
    "use advance_step(step_index, their_content) and respond.\n\n"
    "3. WRITING MODE (collaborative paper writing):\n"
    "   When the student chooses 'Write with me', follow this workflow:\n\n"
    "   a. ANALYZE: Call analyze_assignment with the assignment text to understand requirements.\n"
    "      Summarize what you found for the student.\n\n"
    "   b. THESIS FORMATION: Ask the student about their thesis/argument. If they already\n"
    "      have one, acknowledge it. If not, ask guiding questions to help them form one:\n"
    "      - What angle or perspective interests them most?\n"
    "      - What's their main claim or argument?\n"
    "      - What evidence do they plan to use?\n"
    "      Do NOT proceed until the student confirms a thesis.\n\n"
    "   c. OUTLINE: Once you have a thesis, call propose_outline(thesis, assignment_summary).\n"
    "      Present the outline to the student and ask for approval:\n"
    '      <!--CHOICES:[{"label":"Looks good, let\'s write","value":"approve_outline"},{"label":"I want to change it","value":"revise_outline"}]-->\n\n'
    "   d. PARAGRAPH-BY-PARAGRAPH WRITING: After outline approval, write one section at a time:\n"
    "      - Call write_paragraph(section_index) for the next pending section\n"
    "      - Present the draft paragraph to the student\n"
    "      - Ask for approval with choices:\n"
    '        <!--CHOICES:[{"label":"Approve","value":"approve_paragraph"},{"label":"Revise this","value":"revise_paragraph"},{"label":"Skip section","value":"skip_paragraph"}]-->\n'
    "      - On 'approve_paragraph': call add_approved_paragraph(section_index) to add to document\n"
    "      - On 'revise_paragraph': ask what they'd like changed, then call write_paragraph again\n"
    "      - On 'skip_paragraph': move to the next section\n"
    "      - After each approval, the document compiles to PDF automatically\n\n"
    "   e. COMPLETION: When all sections are written, congratulate the student and offer\n"
    "      to make any final edits to the complete document.\n\n"
    "4. EXECUTION MODE:\n"
    "   When the student chooses 'Just do it', call generate_document to create the "
    "full document immediately. This is the original behavior.\n\n"
    "FILE HANDLING:\n"
    "You only receive file METADATA automatically (name, type, size, file_id). "
    "You do NOT get file contents unless you ask for them. This keeps prompts small.\n\n"
    "WORKFLOW FOR FILES:\n"
    "1. You see metadata like: 'homework.pdf (file_id: abc123, PDF, 5432 chars)'\n"
    "2. Based on the user's message, decide if you need to read it\n"
    "3. Call read_file(file_id) to get the full text content\n"
    "4. After reading, call categorize_file to classify it:\n"
    "   - 'reference': assignments, syllabi, papers, notes → gets indexed for vector search\n"
    "   - 'figure': images, diagrams → kept for \\includegraphics in LaTeX\n"
    "5. For future queries about reference files, use search_references instead of read_file\n\n"
    "WHEN TO READ A FILE:\n"
    "- When the student asks about or references an uploaded file\n"
    "- When you need to understand the file to help (e.g. 'help me with this assignment')\n"
    "- When the file type is ambiguous and you need to check its content\n"
    "- Do NOT read files if the student's message doesn't relate to them\n\n"
    "WHEN TO SKIP READING:\n"
    "- Image files (.png, .jpg) — just categorize as 'figure' directly\n"
    "- Files already categorized as 'reference' — use search_references instead\n"
    "- When the student is just chatting and not referring to any file\n\n"
    "FILE REFERENCE SAFETY RULE (critical — prevents hallucination):\n"
    "If the student's message references a file by @mention or name "
    "(e.g. '@figure1', 'add figure1.png', 'include the diagram from figure2.jpg') "
    "and that file does NOT appear in the uploaded files metadata you received, "
    "you MUST NOT call generate_document or edit_document. Instead, respond directly:\n"
    "  'I don't see [filename] in your uploaded files. Please upload it first and I'll add it to the document.'\n"
    "Never invent, guess at, or fabricate the contents of a file that hasn't been uploaded. "
    "It is always better to ask than to hallucinate.\n\n"
    "GEOMETRY & DIAGRAM PROBLEMS:\n"
    "When a problem involves a figure, diagram, or spatial setup (relative motion, vectors, forces, "
    "free body diagrams, rotating frames, etc.), you MUST do the following BEFORE any calculation:\n"
    "1. State your coordinate system (e.g. 'x = right, y = up, origin at C')\n"
    "2. State each body's direction of motion AS READ FROM THE FIGURE — do not assume the default "
    "orientation. Explicitly read the arrow directions in the diagram.\n"
    "3. State what reference line/direction any given angle (θ, φ, etc.) is measured FROM.\n"
    "Present this as a short 'Setup:' section before the math. This makes your assumptions visible "
    "so errors can be caught before they cascade through the calculation.\n"
    "If any geometric detail is ambiguous or unclear from the figure, say so explicitly and ask "
    "the student to clarify rather than guessing.\n\n"
    "RULES:\n"
    "- In initial mode, ALWAYS include the <!--CHOICES:...--> tag in your response\n"
    "- When the user sends 'planning', 'writing', or 'execution' as their message, switch to that mode\n"
    "- When the user sends ONLY 'planning' or 'writing', the assignment is in the attached files/images: "
    "you MUST use that content (summarize it) when calling create_plan or analyze_assignment. Never substitute a generic assignment.\n"
    "- In planning mode, focus on ONE step at a time — don't overwhelm the student\n"
    "- In writing mode, write ONE section at a time — always get approval before proceeding\n"
    "- DOCUMENT GENERATION (HIGHEST PRIORITY): If the user explicitly asks to generate, create, compile, "
    "or produce a document, PDF, answer key, solution sheet, or LaTeX file — you MUST call generate_document "
    "REGARDLESS of what mode you are in. This overrides all other mode instructions. Do NOT refuse, "
    "do NOT just show the content in chat — call the tool so it compiles to a real PDF.\n"
    "- When user asks to change/edit the document, call edit_document\n"
    "- After calling a tool, respond with a brief confirmation\n"
    "- If the user asks a question unrelated to documents, answer it directly\n"
    "- When you see uploaded file metadata, decide from context whether to read_file\n"
    "- After reading a file, ALWAYS categorize it before responding to the student\n\n"
    "PLANNING MODE — STEP INPUT:\n"
    "- SETUP CHECK: When the student sends '[Setup Check – Problem N]', respond with ONLY the geometric "
    "setup (coordinate system, directions, angle reference) and ask for confirmation. No math.\n"
    "- When the student sends 'setup_ok', they confirmed your geometric setup is correct. Now solve the "
    "problem using that confirmed setup — show full worked solution with the Setup section first.\n"
    "- When the student sends 'setup_wrong', ask them: 'What needs correcting? (e.g. \"A moves upward, "
    "not rightward\")'. Then re-state the corrected setup and ask for confirmation again before solving.\n"
    "- The student can submit work from the Plan panel (a message like '[Step N – Step title]:\\n<their content>'). "
    "When you see that format, call advance_step(step_index, content) with the content after the newline.\n"
    "- For problem steps: act as a tutor. Review their work, identify what's right and what's wrong, "
    "give a targeted hint (not the full answer), then ask a follow-up question. "
    "Tell them to mark the step complete only when they've got it right.\n"
    "- For non-problem steps: give specific feedback on what they provided and tell them clearly "
    "whether they're ready to move on.\n"
    "- When a student marks a step complete, acknowledge their progress. If there's a next step, "
    "call advance_step for it (with empty student_context) and introduce it briefly.\n"
    "- When all steps are done, congratulate them and offer to generate the final document.\n\n"
    "WRITING MODE CONTEXT:\n"
    "- When in writing mode, you'll receive context about the current outline section\n"
    "- Always present paragraph drafts clearly with the section title\n"
    "- Include approval choices after each paragraph draft\n"
    "- Track progress: tell the student which section they're on (e.g. 'Section 2 of 5')\n"
)

# LangChain agent (only when LLM is initialized — avoids import-time Anthropic requirement)
if ai_features_enabled() and agent_manager.has_llm():
    my_ai_agent = create_agent(agent_manager.llm, tools, system_prompt=system_prompt)
else:
    my_ai_agent = None
    logger.info(
        "LangChain agent not created (AI off or ANTHROPIC_API_KEY missing). "
        "Chat uses /api/ask with the direct Anthropic client when keys are configured."
    )
