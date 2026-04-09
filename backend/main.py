# AI Document Studio — FastAPI backend
# Run with: uvicorn main:app --reload --host 0.0.0.0 --port 8000

import sys
if sys.version_info >= (3, 14):
    print(
        "\n*** This backend requires Python 3.11 or 3.12. You are on Python {}.{}.\n"
        "Pydantic/FastAPI do not support 3.14 yet. Install Python 3.12 and use it for this project:\n"
        "  - Install: https://www.python.org/downloads/ or: winget install Python.Python.3.12\n"
        "  - In the backend folder: remove venv, then run: py -3.12 -m venv venv\n"
        "  - Then: .\\venv\\Scripts\\activate  and  pip install -r requirements.txt\n"
        .format(sys.version_info.major, sys.version_info.minor),
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from dotenv import load_dotenv
    from pathlib import Path
    load_dotenv(override=True)
    load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)
except ImportError:
    pass

from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from contextlib import asynccontextmanager
from ai_agent import agent_manager
from ai_settings import ai_features_enabled, anthropic_key_configured, describe_why_ai_disabled
import anthropic
import subprocess
import tempfile
import shutil
import uuid
import logging
import os
import json
import re
import base64
import io
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Optional

try:
    import pdfplumber
    _PDFPLUMBER_AVAILABLE = True
except ImportError:
    _PDFPLUMBER_AVAILABLE = False

try:
    import pytesseract
    from pdf2image import convert_from_path
    from PIL import Image
    _OCR_AVAILABLE = True
except ImportError:
    _OCR_AVAILABLE = False

logger = logging.getLogger("docstudio")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    logger.addHandler(handler)

# ---------------------------------------------------------------------------
# Direct Anthropic client — lazy; avoids requiring a key when AI is off
# ---------------------------------------------------------------------------
_anthropic_client = None
_MODEL = "claude-sonnet-4-5-20250929"


def _get_anthropic_client():
    """Return Anthropic SDK client, or None if AI is disabled or key missing."""
    global _anthropic_client
    if not ai_features_enabled() or not anthropic_key_configured():
        return None
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic()
    return _anthropic_client

# ---------------------------------------------------------------------------
# Document templates
# ---------------------------------------------------------------------------
TEMPLATES = {
    "auto": {
        "name": "Auto (recommended)",
        "latex_hint": "Automatically choose the best LaTeX formatting based on the assignment type.",
    },
    "homework": {
        "name": "Homework Solution",
        "latex_hint": (
            "Use \\documentclass[12pt]{article} with 1-inch margins. "
            "Number each problem clearly. Show all work step-by-step. "
            "Box final answers with \\boxed{}. "
            "Use enumerate for multi-part problems labeled (a), (b), etc."
        ),
    },
    "problem_set": {
        "name": "Problem Set",
        "latex_hint": (
            "Use \\documentclass[12pt]{article}. "
            "Each problem gets its own \\section*{Problem N}. "
            "Sub-parts labeled with \\subsection*{Part (a)}, etc. "
            "Show full derivations with align environments."
        ),
    },
    "lab_report": {
        "name": "Lab Report",
        "latex_hint": (
            "Use \\documentclass[12pt]{article} with \\usepackage{setspace}\\doublespacing. "
            "Include sections: Abstract, Introduction, Methods, Results, Discussion, Conclusion, References. "
            "Use figure and table environments with captions. "
            "Include \\usepackage{siunitx} for units."
        ),
    },
    "essay": {
        "name": "Essay / Research Paper",
        "latex_hint": (
            "Use \\documentclass[12pt]{article} with \\usepackage{setspace}\\doublespacing. "
            "Double-spaced, 1-inch margins. "
            "Sections: Introduction, body paragraphs (each a \\section{}), Conclusion. "
            "Include \\usepackage{natbib} for citations. Use \\citep{} and \\citet{}."
        ),
    },
}

SYSTEM_PROMPT = """You are DocAI, a homework and document assistant. You help students work through assignments and create beautifully formatted PDF documents — all LaTeX is handled automatically under the hood; the student never sees raw code.

═══════════════════════════════════════════
INITIAL MODE — first message with a file
═══════════════════════════════════════════
When a student uploads a file or describes their assignment:
1. Briefly summarize what you see (assignment type, number of problems, topic)
2. Always end with these mode-choice buttons:
<!--CHOICES:[{"label":"Plan it for me","value":"planning"},{"label":"Write with me","value":"writing"},{"label":"Just do it","value":"execution"}]-->

EXCEPTION — DIRECT REQUEST: If the student explicitly asks you to solve, generate, create, give LaTeX, make a document, give an answer key, or compile anything — skip the choices and generate the document immediately.

═══════════════════════════════════════════
PLANNING MODE
═══════════════════════════════════════════
When the student's message is exactly "planning":
1. Read the attached assignment files carefully
2. Identify: assignment type (problem set / essay / lab report) and scope
3. Ask ONE starting-point question. Then embed choices.

   For a PROBLEM SET:
   "I see you have N problems on [topic]. Where are you starting from?"
   <!--CHOICES:[{"label":"Ready to solve — start at Problem 1","value":"plan_ready"},{"label":"Need a quick concept review first","value":"plan_review"},{"label":"Start at a specific problem","value":"plan_custom"}]-->

   For an ESSAY / PAPER:
   "This looks like a [topic] essay. Do you have a thesis yet?"
   <!--CHOICES:[{"label":"Starting fresh — help me form a thesis","value":"plan_review"},{"label":"I already have a thesis","value":"plan_ready"},{"label":"Just need an outline","value":"plan_custom"}]-->

When the student responds with their starting point, CREATE THE PLAN and embed it as:
<!--PLAN:[array of step objects here]-->

Plan step JSON format (array, no markdown fences):
[
  {
    "title": "Problem 1",
    "description": "Exact problem statement here (copy it verbatim if possible)",
    "your_turn": "Specific micro-task for the student — see rules below",
    "status": "active"
  },
  {
    "title": "Problem 2",
    "description": "...",
    "your_turn": "...",
    "status": "pending"
  }
]

THE `your_turn` FIELD — this is the most important field. It must be:
- A SPECIFIC, LOW-EFFORT task (not "show me your work" — that's too vague and intimidating)
- Something that takes 30 seconds to answer
- Phrased as a genuine question or tiny action
- Different for each step — no copy-paste

Good examples of `your_turn` prompts:
  Problem (physics/math): "What's given in this problem? Just list the numbers and what they represent."
  Problem (vectors/geometry): "Read the figure. Which direction does each object move — left, right, up, down?"
  Problem (forces): "Draw a quick free body diagram (even on paper). How many forces act on the object?"
  Problem (conceptual): "Which principle do you think applies here — conservation of energy, Newton's laws, or kinematics?"
  Problem (multi-part): "Which part feels most confusing — (a), (b), or (c)? Start there."
  Essay step: "What's your one-sentence answer to the essay question? Even a rough draft is fine."
  Essay step: "What's the strongest piece of evidence you have for your argument?"

Bad examples (too vague, don't use):
  "Show me your work"
  "Tell me where you get stuck"
  "What do you think?"

Plan creation rules:
- Problem sets: EXACTLY one step per problem (not per part). No "review lecture notes" steps unless student asked for review.
- Essays: 3-5 steps max (Thesis → Outline → Draft → Revise). Skip steps the student said they've done.
- First step always has "status": "active"; all others "status": "pending"
- DO NOT include a `guidance` field — guidance is given AFTER the student responds, not upfront
- After embedding <!--PLAN:...-->, add a brief text like "Here's your plan — {N} steps. Step 1 is ready for you."

CRITICAL — PROBLEM IDENTIFICATION (prevents misreading figures):
Engineering/physics PDFs contain multiple problems and complex diagrams. When building the plan:
- The "description" for each step must come ONLY from that specific problem's text. Copy problem numbers and text verbatim.
- For diagram elements (springs, pulleys, walls, cables, gears, etc.) that appear only in figures (not in text): do NOT list them in the description — write "See Problem N figure" instead. You WILL misread which diagram belongs to which problem if you guess.
- Title each step "Problem N" using the number in the document — do NOT name a step after what you think the figure shows (e.g. "Rolling disk with spring") because you may attribute elements from a different problem's figure.

TUTORING IN PLANNING MODE:
- When student submits "[Step N – Title]:\n<their response>", give targeted feedback:
  1. Start with what they got right
  2. Point out ONE thing to reconsider (hint, not the answer)
  3. Ask ONE follow-up question that moves them forward
  Keep it under 150 words. Be direct and encouraging.
- When student sends "setup_ok", they confirmed your geometry — now solve the full problem with that setup
- When student sends "setup_wrong", ask what to correct, re-state the corrected setup, ask for confirmation again

ANTI-HALLUCINATION RULE — PROBLEM SETUP:
When first engaging with a problem step, BEFORE asking about forces or setup:
1. State the SPECIFIC elements from that problem only: "In Problem N, I see [only what is written in the problem text]."
2. For anything that appears only in the figure, say "I can see a figure — can you confirm: does the problem have [X]?"
3. If the student says your description is wrong (e.g. "there's no spring"), respond IMMEDIATELY: "You're right, I misread the figure. Please tell me what elements you actually see and we'll work from there." Do NOT defend the wrong description or continue tutoring based on it.

═══════════════════════════════════════════
WRITING MODE (collaborative paper writing)
═══════════════════════════════════════════
When the student's message is exactly "writing":
1. Read the assignment and briefly analyze it (topic, requirements, page count)
2. If they have no thesis: help them form one with 1-2 guiding questions
3. Once you have a thesis, propose an outline AND embed it as:
<!--OUTLINE:[array of section objects here]-->

Outline section JSON format:
[
  {"title": "Introduction", "description": "Establish context and state thesis", "subsections": ["hook", "background", "thesis statement"], "target_length": "1 paragraph", "status": "pending", "content": ""},
  {"title": "Body: [Argument 1]", "description": "...", "subsections": [...], "target_length": "2-3 paragraphs", "status": "pending", "content": ""},
  ...
  {"title": "Conclusion", ...}
]

After embedding <!--OUTLINE:...-->, show a readable summary and ask for approval:
<!--CHOICES:[{"label":"Looks good, let's write","value":"approve_outline"},{"label":"I want to change it","value":"revise_outline"}]-->

WRITING SECTION BY SECTION:
After outline is approved (student sends "approve_outline" or the context says outline is approved):
- Write the current pending section in clear academic prose
- Present the draft to the student
- Always include:
<!--CHOICES:[{"label":"Approve — add to document","value":"approve_paragraph"},{"label":"Revise this section","value":"revise_paragraph"},{"label":"Skip this section","value":"skip_paragraph"}]-->
- When "approve_paragraph": generate the FULL updated LaTeX document with this section properly added
- When "revise_paragraph": ask what to change, rewrite the section
- When "skip_paragraph": move to the next section

═══════════════════════════════════════════
EXECUTION MODE
═══════════════════════════════════════════
When student selects "execution" or makes a direct document request:
Generate the complete LaTeX document immediately. No back-and-forth.

═══════════════════════════════════════════
DOCUMENT / LATEX GENERATION
═══════════════════════════════════════════
When generating a LaTeX document:
- ALWAYS wrap it in ```latex ... ``` fences — this triggers auto-compilation to PDF
- The student NEVER sees the LaTeX; they only see the compiled PDF
- Use ONLY packages from this Tectonic-compatible list (do NOT use fontenc, inputenc, lmodern, times, palatino, psfig, epsfig, t1enc, utf8x — they break Tectonic):
  Layout: geometry, parskip, setspace, multicol, fancyhdr
  Math: amsmath, amssymb, amsthm, bm, mathtools, siunitx
  Figures/tables: graphicx, float, caption, subcaption, booktabs, array, tabularx, longtable
  Lists: enumitem
  Color: xcolor
  Code: listings
  Algorithms: algorithm, algpseudocode
  Citations/links: hyperref, natbib
  Drawing: tikz, pgfplots. In TikZ: use named pics (e.g. pic type) and at={(x,y)} for coordinates; never use raw numbers or expressions as pic names or key names (e.g. avoid keys like /tikz/pics/0--63.51).
- Use \\bm{v} for bold vectors, \\hat{\\bm{i}} for unit vectors
- Use \\boxed{} to highlight final answers
- Every opened environment must be closed
- Output raw LaTeX inside the fences only — no explanation inside the fence

When editing an existing document: apply the change and output the FULL updated document in ```latex fences.

FILE REFERENCE RULE — CRITICAL (prevents hallucination):
If the user's message references a file, figure, image, or attachment by @mention or filename
(e.g. "@figure1", "add figure1.png", "include the diagram") and that file has NOT been
provided to you as an uploaded image or document block in this conversation, you MUST NOT
invent, fabricate, or generate placeholder content for it.
Instead, respond with ONLY:
  "I don't see [filename] in your uploaded files. Please upload it first and I'll add it to the document."
Never guess or hallucinate the contents of a missing file. It is always better to ask.

═══════════════════════════════════════════
GEOMETRY & DIAGRAM PROBLEMS
═══════════════════════════════════════════
Before solving any spatial/vector problem:
1. State your coordinate system (e.g., "x = right, y = up, origin at C")
2. State each object's direction of motion AS READ FROM THE FIGURE
3. State what angle θ is measured from

Format as a "**Setup:**" bullet list before the math.

═══════════════════════════════════════════
CONTENT GROUNDING RULE — HIGHEST PRIORITY
═══════════════════════════════════════════
When the user uploads a file (resume, assignment, notes, etc.) and asks you to use it,
you MUST treat that file as the ONLY source of truth for its content.

BEFORE generating any document from an uploaded file:
1. Read the file carefully
2. Mentally list the key facts you can see (name, dates, jobs, etc.)
3. Use ONLY those facts — never fill in, invent, or "complete" missing information

If you cannot read or find certain information in the file, write a placeholder like
[MISSING: job title] rather than guessing. NEVER invent:
- Names, dates, or contact info
- Job titles, companies, or descriptions
- Education details, GPAs, or certifications
- Any other personal or factual information

This rule applies even if the invented information "looks right" or "seems typical."
When in doubt, leave a placeholder and tell the user what you couldn't find.

═══════════════════════════════════════════
LAB REPORT — DATA ANALYSIS WORKFLOW
═══════════════════════════════════════════
When a student uploads data files (CSV, XLSX) for a lab report:

1. DATA READING: The file content is provided as a formatted text table — read it carefully.
   Column names and values are exactly as given. Do not invent data.

2. ANALYSIS STRATEGY — use the run_python tool to:
   - Perform curve fitting (scipy.optimize.curve_fit), scaling analysis, statistics
   - Generate ALL required figures (each as a separate file)
   - Print fit parameters and R² values so you can report them

3. FIGURE GENERATION RULES (inside run_python code):
   - Use matplotlib with plt.rcParams for publication quality
   - Single-column figures: figsize=(3.4, 2.8); two-column: figsize=(7, 3)
   - Always: plt.tight_layout(); plt.savefig('fig_name.pdf', bbox_inches='tight', dpi=150)
   - Label axes with units, include legend, gridlines optional
   - Save each figure as a SEPARATE PDF file (e.g. fig_washburn.pdf, fig_latetime.pdf)
   - The uploaded data files are available in the working directory by their original filename

4. AFTER running Python, figures are registered as uploaded files. Reference them in LaTeX:
   \\includegraphics[width=\\columnwidth]{fig_washburn.pdf}

5. DELIVERABLES CHECKLIST — always recheck the assignment for what plots/sections are required
   before generating the LaTeX. Never skip a required figure.

6. DATA FILE READING in Python:
   import pandas as pd
   df = pd.read_csv('filename.csv')   # use the exact original filename

7. SCIPY FITTING PATTERN:
   from scipy.optimize import curve_fit
   import numpy as np
   def linear(x, a, b): return a*x + b
   popt, pcov = curve_fit(linear, x_data, y_data)
   r2 = 1 - np.sum((y_data - linear(x_data, *popt))**2) / np.sum((y_data - np.mean(y_data))**2)

═══════════════════════════════════════════
GENERAL BEHAVIOR
═══════════════════════════════════════════
- Read uploaded files thoroughly — they are sent directly to you as document blocks
- Be direct. Don't ask unnecessary clarifying questions when the request is clear.
- For problem sets: show complete numbered steps, state givens, approach, and boxed answer
- For multi-part problems: label each part clearly (a), (b), etc."""

UPLOADS_DIR = Path(__file__).parent / "uploads"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB — keep in sync with nginx client_max_body_size


@asynccontextmanager
async def lifespan(app: FastAPI):
    UPLOADS_DIR.mkdir(exist_ok=True)
    logger.info("AI Document Studio starting up. Uploads dir: %s", UPLOADS_DIR)
    yield
    logger.info("Shutting down.")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/ai-status")
async def ai_status():
    """Report whether chat can call the model (for UI banners). Infrastructure stays in place when off."""
    chat_available = ai_features_enabled() and anthropic_key_configured()
    return {
        "chat_available": chat_available,
        "ai_features_enabled": ai_features_enabled(),
        "anthropic_configured": anthropic_key_configured(),
        "hint": (
            None
            if chat_available
            else (
                "AI chat is off: add ANTHROPIC_API_KEY to .env to enable, or set THEBOSS_AI_ENABLED=false "
                "to silence this. Re-enable with THEBOSS_AI_ENABLED=true after keys are set."
            )
        ),
    }


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PlanStep(BaseModel):
    title: str
    description: str
    status: str = "pending"        # "pending" | "active" | "completed"
    guidance: str = ""

class Choice(BaseModel):
    label: str
    value: str

class AskIn(BaseModel):
    question: str
    file_ids: list[str] = []
    file_purposes: Optional[dict[str, str]] = None  # file_id -> "assignment" | "reference" | "figure"
    file_has_diagrams: Optional[dict[str, bool]] = None  # file_id -> True if user marked "has diagrams"
    file_mentioned: Optional[dict[str, bool]] = None  # file_id -> True if user @-mentioned this file
    current_latex: str = ""
    mode: str = "initial"          # "initial" | "planning" | "writing" | "execution"
    plan: list[dict] = []          # Current plan state from frontend
    current_step_index: int = -1   # Which step is active
    outline: list[dict] = []       # Current outline state from frontend (writing mode)
    # Full conversation history so the model remembers earlier turns
    # Each entry: {"role": "user"|"assistant", "content": "<text>"}
    history: list[dict] = []
    # Complete message history for persistence (not capped like history)
    # If provided, this is saved to DB instead of reconstructing from history
    all_messages: list[dict] = []
    # Document template preference
    template: str = "auto"         # "auto" | "homework" | "problem_set" | "lab_report" | "essay"
    # Conversation persistence
    conversation_id: Optional[str] = None  # If set, auto-save after response

class SaveConversationIn(BaseModel):
    messages: list[dict] = []
    current_latex: str = ""
    conversation_mode: str = "initial"
    plan_steps: Optional[list[dict]] = None
    current_step_index: int = -1
    outline_state: Optional[list[dict]] = None
    outline_approved: bool = False
    uploaded_file_ids: list[str] = []
    selected_template: str = "auto"
    latex_history: Optional[list] = None  # list of {latex, timestamp, label} dicts

class CreateConversationIn(BaseModel):
    title: str = "New conversation"

class AskOut(BaseModel):
    answer: str
    latex: str = ""
    choices: Optional[list[dict]] = None
    plan: Optional[list[dict]] = None
    outline: Optional[list[dict]] = None
    writing_progress: Optional[dict] = None
    paragraph_draft: Optional[str] = None
    mode: str = "initial"
    usage: Optional[dict] = None  # {"input_tokens": int, "output_tokens": int} from Anthropic
    generated_figures: Optional[list[dict]] = None  # [{file_id, filename}] from run_python tool

class CompileIn(BaseModel):
    latex: str
    conversation_id: Optional[str] = None  # If set and auth provided, save first-page thumbnail for list

class CompleteStepIn(BaseModel):
    step_index: int


# ---------------------------------------------------------------------------
# Helper: extract text content from LangChain message
# ---------------------------------------------------------------------------

def extract_text(content) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                parts.append(part.get("text", ""))
            elif isinstance(part, str):
                parts.append(part)
        return "".join(parts)
    return str(content)


# ---------------------------------------------------------------------------
# Python execution tool (for data analysis and plot generation)
# ---------------------------------------------------------------------------

PYTHON_TOOL = {
    "name": "run_python",
    "description": (
        "Execute Python code for data analysis and figure generation. "
        "Use matplotlib to create publication-quality plots. "
        "Save each figure with plt.savefig('filename.pdf', bbox_inches='tight'). "
        "Uploaded data files (CSV, XLSX) are available in the working directory by their original filename. "
        "Available libraries: pandas, numpy, matplotlib, scipy, math."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "Python code to execute. Print results to stdout for analysis output.",
            },
        },
        "required": ["code"],
    },
}


def _execute_python(code: str, tmpdir: str) -> dict:
    """Run Python code in a subprocess, return {output, figures}.
    Figures are any PDF/PNG files created in tmpdir (excluding the script itself)."""
    tmppath = Path(tmpdir)
    code_file = tmppath / "analysis.py"
    code_file.write_text(code, encoding="utf-8")

    # Copy all currently uploaded files into tmpdir so pandas can read them by name
    for _fid, fpath in agent_manager.uploads.items():
        if fpath.exists():
            try:
                dest_copy = tmppath / fpath.name
                if not dest_copy.exists():
                    shutil.copy(fpath, dest_copy)
            except Exception:
                pass

    try:
        proc = subprocess.run(
            [sys.executable, str(code_file)],
            capture_output=True,
            text=True,
            timeout=90,
            cwd=str(tmppath),
        )
        output = proc.stdout or ""
        if proc.returncode != 0 and proc.stderr:
            output += f"\n[stderr]:\n{proc.stderr[:3000]}"
        elif proc.stderr:
            output += f"\n[warnings]: {proc.stderr[:500]}"

        # Collect generated figure files
        figure_exts = {".pdf", ".png", ".svg"}
        figures = [
            f for f in tmppath.iterdir()
            if f.suffix.lower() in figure_exts and f.stem != "analysis"
        ]
        return {"output": output or "Executed successfully (no output).", "figures": figures}
    except subprocess.TimeoutExpired:
        return {"output": "Timeout: code ran >90 s. Simplify or reduce data size.", "figures": []}
    except Exception as exc:
        return {"output": f"Execution error: {exc}", "figures": []}


def _build_session_context(payload) -> str:
    """Build a short session context block from current state.
    Prepended to SYSTEM_PROMPT so the model always knows what files and state exist."""
    parts = [
        "═══════════════════════════════════════════",
        "SESSION CONTEXT (auto-updated each turn)",
        "═══════════════════════════════════════════",
    ]

    # Mode & template
    mode_str = payload.mode if payload.mode and payload.mode != "initial" else "chat"
    parts.append(f"Mode: {mode_str}")
    if payload.template and payload.template != "auto":
        parts.append(f"Template: {payload.template}")

    # Uploaded files with purpose and column info
    if payload.file_ids:
        file_lines = []
        purposes = payload.file_purposes or {}
        has_diags_map = payload.file_has_diagrams or {}
        for fid in payload.file_ids:
            path = agent_manager.uploads.get(fid)
            if not path:
                continue
            purpose = purposes.get(fid) or agent_manager.get_file_purpose(fid)
            text = agent_manager.upload_texts.get(fid, "")
            ext = path.suffix.lower()

            extra = ""
            if ext in (".csv", ".tsv", ".xlsx", ".xls") and text:
                # Pull the "Columns:" line we stored at upload time
                for line in text.splitlines():
                    if line.startswith("Columns:") or line.startswith("Shape:"):
                        extra += f" — {line.strip()}"
                        if line.startswith("Columns:"):
                            break
            elif ext == ".pdf" and has_diags_map.get(fid):
                extra = " — has diagrams"

            file_lines.append(f"  - {path.name} [{purpose}]{extra}")
        if file_lines:
            parts.append("Uploaded files:")
            parts.extend(file_lines)
    else:
        parts.append("Uploaded files: none")

    # Active LaTeX document
    latex_src = payload.current_latex or agent_manager.current_latex
    if latex_src:
        parts.append(f"Active LaTeX document: yes ({len(latex_src):,} chars)")
    else:
        parts.append("Active LaTeX document: none")

    # Plan state
    if payload.plan:
        idx = payload.current_step_index
        total = len(payload.plan)
        if 0 <= idx < total:
            parts.append(f"Plan: step {idx + 1}/{total} — {payload.plan[idx].get('title', '')}")
        else:
            parts.append(f"Plan: {total} steps defined")

    return "\n".join(parts)


def parse_choices_from_answer(answer: str):
    """Extract <!--CHOICES:[...]-->  from the AI answer text.
    Returns (clean_answer, choices_list_or_None)."""
    pattern = r'<!--CHOICES:(\[.*?\])-->'
    match = re.search(pattern, answer, re.DOTALL)
    if match:
        try:
            choices = json.loads(match.group(1))
            clean = answer[:match.start()].rstrip() + answer[match.end():]
            return clean.strip(), choices
        except json.JSONDecodeError:
            pass
    return answer, None


def parse_plan_from_answer(answer: str):
    """Extract <!--PLAN:[...]-->  from the AI answer text.
    Returns (clean_answer, plan_list_or_None)."""
    pattern = r'<!--PLAN:(\[.*?\])-->'
    match = re.search(pattern, answer, re.DOTALL)
    if match:
        try:
            plan = json.loads(match.group(1))
            clean = answer[:match.start()].rstrip() + answer[match.end():]
            return clean.strip(), plan
        except json.JSONDecodeError:
            logger.warning("Failed to parse PLAN tag JSON")
    return answer, None


def parse_outline_from_answer(answer: str):
    """Extract <!--OUTLINE:[...]-->  from the AI answer text.
    Returns (clean_answer, outline_list_or_None)."""
    pattern = r'<!--OUTLINE:(\[.*?\])-->'
    match = re.search(pattern, answer, re.DOTALL)
    if match:
        try:
            outline = json.loads(match.group(1))
            clean = answer[:match.start()].rstrip() + answer[match.end():]
            return clean.strip(), outline
        except json.JSONDecodeError:
            logger.warning("Failed to parse OUTLINE tag JSON")
    return answer, None


def _file_to_content_blocks(file_path: Path, max_pages: int = 20) -> list:
    """Convert an uploaded file to content blocks for multimodal messages.

    PDFs are sent as native document blocks — Claude reads all pages directly
    without any image conversion or external dependencies.
    Images are sent as base64 image blocks.

    Returns a list of content block dicts compatible with LangChain/Anthropic.
    """
    ext = file_path.suffix.lower()
    blocks = []

    if ext == ".pdf":
        # Send the PDF natively as a document block.
        # Claude reads all pages directly — no pdf2image/Tesseract needed,
        # no page limit, and no risk of text being missed in diagram-heavy PDFs.
        try:
            raw = file_path.read_bytes()
            # Anthropic caps individual documents at ~32 MB; warn if close.
            if len(raw) > 30 * 1024 * 1024:
                logger.warning(
                    "PDF %s is %.1f MB — may exceed Anthropic document size limit",
                    file_path.name, len(raw) / 1024 / 1024,
                )
            b64 = base64.standard_b64encode(raw).decode("utf-8")
            blocks.append({
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": b64,
                },
            })
            logger.info(
                "Sending %s as native PDF document block (%.1f KB)",
                file_path.name, len(raw) / 1024,
            )
        except Exception as e:
            logger.warning("Failed to read PDF %s: %s", file_path.name, e)

    elif ext in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        # Send image files directly as base64 image blocks.
        try:
            raw = file_path.read_bytes()
            mime = {
                ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".gif": "image/gif", ".webp": "image/webp",
            }.get(ext, "image/png")
            b64 = base64.standard_b64encode(raw).decode("utf-8")
            blocks.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64}"},
            })
            logger.info("Sending %s as image block (%.1f KB)", file_path.name, len(raw) / 1024)
        except Exception as e:
            logger.warning("Failed to read image %s: %s", file_path.name, e)

    return blocks


# ---------------------------------------------------------------------------
# Dev: Webpack HMR sometimes requests hot-update.json via proxy → return no-op
# ---------------------------------------------------------------------------

@app.get("/main.{chunk_hash}.hot-update.json")
async def webpack_hot_update(chunk_hash: str):
    """CRA proxy can forward HMR requests here; return no-update so we don't 404."""
    return {"c": []}


# ---------------------------------------------------------------------------
# Basic endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/api/hello")
async def hello():
    return {"message": "AI Document Studio"}


# ---------------------------------------------------------------------------
# Auth sync (create/update public.users from Supabase JWT)
# ---------------------------------------------------------------------------

def _verify_supabase_jwt(token: str) -> Optional[dict]:
    """Verify Supabase access token via Supabase Auth API and return payload (sub, email, etc.) or None."""
    if not token:
        return None

    # --- Strategy 1: call Supabase Auth API (preferred, no extra secret needed) ---
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if supabase_url and supabase_key:
        try:
            req = urllib.request.Request(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": supabase_key,
                },
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                user_data = json.loads(resp.read().decode())
            # Map to the same shape that jwt.decode would return
            return {
                "sub": user_data.get("id"),
                "email": user_data.get("email"),
                "user_metadata": user_data.get("user_metadata", {}),
            }
        except Exception as e:
            logger.warning("Supabase Auth API verify failed: %s", e)
            # fall through to JWT-secret strategy
            pass

    # --- Strategy 2: local JWT decode (requires SUPABASE_JWT_SECRET) ---
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        return None
    try:
        import jwt
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except Exception:
        return None


@app.post("/api/auth/sync")
async def auth_sync(authorization: Optional[str] = Header(None)):
    """
    Sync Supabase Auth user to public.users. Call with header:
    Authorization: Bearer <access_token>
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[7:].strip()
    payload = _verify_supabase_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    auth_user_id = payload.get("sub")
    email = payload.get("email") or ""
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Token missing sub")
    try:
        from db.operations import get_user_by_auth_id, create_user
        existing = get_user_by_auth_id(auth_user_id)
        if existing:
            return {"ok": True, "user_id": str(existing["id"])}
        full_name = (payload.get("user_metadata") or {}).get("full_name")
        create_user(auth_user_id=auth_user_id, email=email, full_name=full_name)
        return {"ok": True}
    except Exception as e:
        logger.exception("Auth sync failed: %s", e)
        raise HTTPException(status_code=500, detail="Sync failed")


def _get_user_from_token(authorization: Optional[str]) -> dict:
    """Extract and verify user from Authorization header. Raises HTTPException on failure."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[7:].strip()
    payload = _verify_supabase_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    auth_user_id = payload.get("sub")
    if not auth_user_id:
        raise HTTPException(status_code=401, detail="Token missing sub")
    from db.operations import get_user_by_auth_id
    user = get_user_by_auth_id(auth_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _get_user_optional(authorization: Optional[str]) -> Optional[dict]:
    """Like _get_user_from_token but returns None instead of raising. Used when auth is optional."""
    try:
        return _get_user_from_token(authorization)
    except HTTPException:
        return None


# Thumbnails dir for conversation list (first page of compiled PDF)
THUMBNAILS_DIR = Path(__file__).resolve().parent / "thumbnails"


def _try_save_conversation_thumbnail(pdf_bytes: bytes, conversation_id: Optional[str], authorization: Optional[str]) -> None:
    """If conversation_id and auth are present and user owns the conversation, generate first-page thumbnail and save."""
    if not conversation_id or not authorization:
        return
    user = _get_user_optional(authorization)
    if not user:
        return
    try:
        from db.operations import get_conversation, update_conversation
        convo = get_conversation(conversation_id)
        if not convo or convo.get("user_id") != user["id"]:
            return
        import fitz
        THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
        thumb_path = THUMBNAILS_DIR / f"{conversation_id}.jpg"
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if doc.page_count == 0:
            doc.close()
            return
        page = doc[0]
        # Target ~200px wide for list thumbnails
        w = page.rect.width
        scale = 200 / w if w > 0 else 0.3
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("jpeg", jpeg_quality=85)
        doc.close()
        thumb_path.write_bytes(img_bytes)
        update_conversation(conversation_id, thumbnail_url=f"/api/thumbnails/{conversation_id}")
        logger.info("Saved thumbnail for conversation %s", conversation_id)
    except Exception as e:
        logger.warning("Could not save conversation thumbnail: %s", e)


# ---------------------------------------------------------------------------
# Conversation persistence
# ---------------------------------------------------------------------------

@app.post("/api/conversations")
async def create_conversation_endpoint(payload: CreateConversationIn, authorization: Optional[str] = Header(None)):
    """Create a new conversation."""
    user = _get_user_from_token(authorization)
    try:
        from db.operations import create_conversation
        convo = create_conversation(user_id=user["id"], title=payload.title)
        logger.info("Created conversation %s for user %s", convo["id"], user["id"])
        return convo
    except Exception as e:
        logger.exception("Create conversation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create conversation")


@app.get("/api/conversations")
async def list_conversations_endpoint(authorization: Optional[str] = Header(None)):
    """List user's conversations, most recent first."""
    user = _get_user_from_token(authorization)
    try:
        from db.operations import list_conversations
        convos = list_conversations(user_id=user["id"])
        return {"conversations": convos}
    except Exception as e:
        logger.exception("List conversations failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to list conversations")


@app.get("/api/conversations/{conversation_id}")
async def load_conversation_endpoint(conversation_id: str, authorization: Optional[str] = Header(None)):
    """Load a conversation's full state. Also restores latex_history to AgentManager."""
    user = _get_user_from_token(authorization)
    try:
        from db.operations import get_conversation
        convo = get_conversation(conversation_id)
        if not convo or convo["user_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="Conversation not found")
        # Restore version history into AgentManager so undo/redo works after load
        saved_history = convo.get("latex_history") or []
        if saved_history:
            agent_manager.latex_history = saved_history
            agent_manager.latex_future = []
            logger.info("Restored %d latex history versions for conversation %s", len(saved_history), conversation_id)
        return convo
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Load conversation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to load conversation")


@app.put("/api/conversations/{conversation_id}")
async def save_conversation_endpoint(conversation_id: str, payload: SaveConversationIn, authorization: Optional[str] = Header(None)):
    """Save/update conversation state (auto-save)."""
    user = _get_user_from_token(authorization)
    try:
        from db.operations import get_conversation, update_conversation
        convo = get_conversation(conversation_id)
        if not convo or convo["user_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="Conversation not found")
        update_conversation(
            conversation_id,
            messages=payload.messages,
            current_latex=payload.current_latex,
            conversation_mode=payload.conversation_mode,
            plan_steps=payload.plan_steps,
            current_step_index=payload.current_step_index,
            outline_state=payload.outline_state,
            outline_approved=payload.outline_approved,
            uploaded_file_ids=payload.uploaded_file_ids,
            selected_template=payload.selected_template,
        )
        # latex_history may be missing in older DB schemas — save separately
        if payload.latex_history is not None:
            try:
                update_conversation(conversation_id, latex_history=payload.latex_history)
            except Exception:
                pass
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Save conversation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save conversation")


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: str, authorization: Optional[str] = Header(None)):
    """Delete a conversation."""
    user = _get_user_from_token(authorization)
    try:
        from db.operations import get_conversation, delete_conversation
        convo = get_conversation(conversation_id)
        if not convo or convo["user_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="Conversation not found")
        thumb_path = THUMBNAILS_DIR / f"{conversation_id}.jpg"
        if thumb_path.exists():
            try:
                thumb_path.unlink()
            except OSError as e:
                logger.warning("Could not delete thumbnail %s: %s", thumb_path, e)
        delete_conversation(conversation_id)
        logger.info("Deleted conversation %s", conversation_id)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Delete conversation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete conversation")


# ---------------------------------------------------------------------------
# File upload
# ---------------------------------------------------------------------------

@app.post("/api/files/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    """Accept an image or PDF upload and store it for use in document generation."""
    cl = request.headers.get("content-length")
    if cl and int(cl) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_BYTES // (1024*1024)} MB.",
        )
    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix or ""
    dest = UPLOADS_DIR / f"{file_id}{ext}"

    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        logger.exception("Error saving upload: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save file.")

    # Register in agent_manager so the compile step can find it
    agent_manager.uploads[file_id] = dest
    logger.info("Uploaded file %s -> %s", file.filename, dest)

    # Extract text from PDFs so the AI can read the content
    extracted_chars = 0
    if ext.lower() == ".pdf":
        full_text = ""

        # Step 1: Try pdfplumber (fast, works for text-based PDFs)
        if _PDFPLUMBER_AVAILABLE:
            try:
                pages_text = []
                with pdfplumber.open(dest) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            pages_text.append(page_text)
                full_text = "\n\n".join(pages_text).strip()
                if full_text:
                    logger.info("pdfplumber extracted %d chars from %s", len(full_text), file.filename)
            except Exception as e:
                logger.warning("pdfplumber failed for %s: %s", file.filename, e)

        # Step 2: If pdfplumber got nothing, try OCR (for scanned/image-based PDFs)
        if not full_text and _OCR_AVAILABLE:
            try:
                logger.info("Attempting OCR on image-based PDF: %s", file.filename)
                images = convert_from_path(str(dest), dpi=300)
                ocr_pages = []
                for i, img in enumerate(images):
                    page_text = pytesseract.image_to_string(img)
                    if page_text and page_text.strip():
                        ocr_pages.append(page_text.strip())
                full_text = "\n\n".join(ocr_pages).strip()
                if full_text:
                    logger.info("OCR extracted %d chars from %s (%d pages)",
                                len(full_text), file.filename, len(images))
            except Exception as e:
                logger.warning("OCR failed for %s: %s", file.filename, e)

        agent_manager.upload_texts[file_id] = full_text
        extracted_chars = len(full_text)

    elif ext.lower() in (".csv", ".tsv"):
        # Parse CSV/TSV with pandas and convert to a readable text table
        try:
            import pandas as pd
            sep = "\t" if ext.lower() == ".tsv" else ","
            df = pd.read_csv(dest, sep=sep)
            header = (
                f"Data file: {file.filename}\n"
                f"Shape: {len(df)} rows × {len(df.columns)} columns\n"
                f"Columns: {', '.join(str(c) for c in df.columns.tolist())}\n\n"
            )
            # Show full table (up to 500 rows to avoid token overflow)
            full_text = header + df.head(500).to_string(index=False)
            agent_manager.upload_texts[file_id] = full_text
            extracted_chars = len(full_text)
            logger.info("pandas extracted %d chars from CSV %s", extracted_chars, file.filename)
        except Exception as e:
            logger.warning("pandas CSV read failed for %s: %s", file.filename, e)
            agent_manager.upload_texts[file_id] = ""

    elif ext.lower() in (".xlsx", ".xls"):
        # Parse Excel with pandas — extract all sheets
        try:
            import pandas as pd
            xl = pd.ExcelFile(dest)
            parts = []
            for sheet in xl.sheet_names:
                df = xl.parse(sheet)
                sheet_header = (
                    f"Sheet '{sheet}': {len(df)} rows × {len(df.columns)} columns\n"
                    f"Columns: {', '.join(str(c) for c in df.columns.tolist())}\n"
                )
                parts.append(sheet_header + df.head(500).to_string(index=False))
            full_text = f"Excel file: {file.filename}\n\n" + "\n\n".join(parts)
            agent_manager.upload_texts[file_id] = full_text
            extracted_chars = len(full_text)
            logger.info("pandas extracted %d chars from Excel %s (%d sheets)",
                        extracted_chars, file.filename, len(xl.sheet_names))
        except Exception as e:
            logger.warning("pandas Excel read failed for %s: %s", file.filename, e)
            agent_manager.upload_texts[file_id] = ""

    else:
        # Images and other files: no text to extract
        agent_manager.upload_texts[file_id] = ""

    return {
        "file_id": file_id,
        "filename": file.filename,
        "path": str(dest),
        "extracted_chars": extracted_chars,
    }


# ---------------------------------------------------------------------------
# LaTeX compilation
# ---------------------------------------------------------------------------

def _find_tectonic() -> Optional[str]:
    """Find tectonic binary: env > PATH > project root > Windows AppData."""
    env_path = os.environ.get("TECTONIC_PATH")
    if env_path and Path(env_path).exists():
        return env_path
    found = shutil.which("tectonic")
    if found:
        return found
    project_root = Path(__file__).resolve().parent.parent
    local_exe = project_root / "tectonic.exe"
    if local_exe.exists():
        return str(local_exe)
    win_path = Path(os.path.expanduser("~")) / "AppData" / "Local" / "tectonic" / "tectonic.exe"
    if win_path.exists():
        return str(win_path)
    return None


def _compile_via_latexonline(latex: str, max_attempts: int = 3) -> Optional[bytes]:
    """Try to compile LaTeX using the latexonline.cc API.
    Retries up to max_attempts times with exponential backoff.
    Returns PDF bytes on success, None on failure."""
    import time
    url = "https://latexonline.cc/compile"
    data = urllib.parse.urlencode({"text": latex}).encode("utf-8")
    for attempt in range(1, max_attempts + 1):
        try:
            req = urllib.request.Request(url, data=data, method="POST")
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
            with urllib.request.urlopen(req, timeout=45) as resp:
                if resp.status == 200:
                    pdf_bytes = resp.read()
                    if pdf_bytes[:4] == b"%PDF":
                        logger.info(
                            "LaTeX compiled via latexonline.cc (%d bytes, attempt %d)",
                            len(pdf_bytes), attempt,
                        )
                        return pdf_bytes
                    logger.warning(
                        "latexonline.cc returned non-PDF content on attempt %d", attempt
                    )
                else:
                    logger.warning(
                        "latexonline.cc returned HTTP %d on attempt %d", resp.status, attempt
                    )
        except Exception as e:
            logger.warning("latexonline.cc attempt %d/%d failed: %s", attempt, max_attempts, e)
        if attempt < max_attempts:
            time.sleep(2 ** (attempt - 1))  # 1s, 2s backoff
    logger.error("latexonline.cc failed after %d attempts", max_attempts)
    return None


@app.post("/api/compile")
async def compile_latex(payload: CompileIn, authorization: Optional[str] = Header(None)):
    """Compile a LaTeX string to PDF. Tries local tectonic first,
    falls back to latexonline.cc API if tectonic is not available.
    If conversation_id and Authorization are provided, saves first-page thumbnail for the conversation list."""
    if not payload.latex.strip():
        raise HTTPException(status_code=400, detail="LaTeX string is empty.")

    tectonic_bin = _find_tectonic()

    # If tectonic is available, use it (supports uploaded figures)
    if tectonic_bin:
        with tempfile.TemporaryDirectory() as tmpdir:
            tex_path = Path(tmpdir) / "document.tex"
            tex_path.write_text(payload.latex, encoding="utf-8")

            # Copy any uploaded files into the temp dir so \includegraphics works
            for file_id, file_path in agent_manager.uploads.items():
                if file_path.exists():
                    shutil.copy(file_path, Path(tmpdir) / file_path.name)

            try:
                result = subprocess.run(
                    [tectonic_bin, str(tex_path)],
                    capture_output=True,
                    timeout=60,
                    cwd=tmpdir,
                )
            except subprocess.TimeoutExpired:
                raise HTTPException(status_code=504, detail="LaTeX compilation timed out.")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Compilation error: {e}")

            pdf_path = Path(tmpdir) / "document.pdf"
            if not pdf_path.exists():
                stderr = result.stderr.decode("utf-8", errors="replace")
                stdout = result.stdout.decode("utf-8", errors="replace")
                # Try latexonline as fallback (e.g. fontconfig or TikZ errors in container)
                pdf_bytes = _compile_via_latexonline(payload.latex)
                if pdf_bytes:
                    logger.warning(
                        "Tectonic failed (fontconfig/TikZ/etc), used latexonline.cc fallback. STDERR: %s",
                        stderr[:500],
                    )
                    _try_save_conversation_thumbnail(pdf_bytes, payload.conversation_id, authorization)
                    return Response(content=pdf_bytes, media_type="application/pdf")
                # No fallback success — return the tectonic error to the user
                error_lines = [l for l in stderr.splitlines() if l.startswith("!") or "error" in l.lower()]
                short_error = "\n".join(error_lines[:5]) if error_lines else stderr[-600:]
                logger.error("Tectonic failed:\nSTDERR: %s\nSTDOUT: %s", stderr, stdout)
                raise HTTPException(
                    status_code=422,
                    detail=f"LaTeX compilation failed:\n{short_error}",
                )

            pdf_bytes = pdf_path.read_bytes()

        _try_save_conversation_thumbnail(pdf_bytes, payload.conversation_id, authorization)
        return Response(content=pdf_bytes, media_type="application/pdf")

    # Fallback: try latexonline.cc API (no figure support)
    logger.info("Tectonic not found, trying latexonline.cc API")
    pdf_bytes = _compile_via_latexonline(payload.latex)
    if pdf_bytes:
        _try_save_conversation_thumbnail(pdf_bytes, payload.conversation_id, authorization)
        return Response(content=pdf_bytes, media_type="application/pdf")

    raise HTTPException(
        status_code=500,
        detail="No LaTeX compiler available. Deploy with the backend Dockerfile (installs tectonic), or check outbound access to latexonline.cc.",
    )


@app.get("/api/thumbnails/{conversation_id}")
async def get_conversation_thumbnail(conversation_id: str, authorization: Optional[str] = Header(None)):
    """Serve the first-page thumbnail image for a conversation. Requires auth; user must own the conversation."""
    user = _get_user_from_token(authorization)
    try:
        from db.operations import get_conversation
        convo = get_conversation(conversation_id)
        if not convo or convo.get("user_id") != user["id"]:
            raise HTTPException(status_code=404, detail="Not found")
        thumb_path = THUMBNAILS_DIR / f"{conversation_id}.jpg"
        if not thumb_path.exists():
            raise HTTPException(status_code=404, detail="Thumbnail not found")
        return Response(content=thumb_path.read_bytes(), media_type="image/jpeg")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Thumbnail serve failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to load thumbnail")


# ---------------------------------------------------------------------------
# Plan step completion
# ---------------------------------------------------------------------------

@app.post("/api/plan/complete-step")
async def complete_step(payload: CompleteStepIn):
    """Mark a plan step as completed and advance to the next one."""
    # Validate step index matches backend state
    if payload.step_index != agent_manager.current_step_index:
        logger.warning(
            "Step index mismatch: frontend=%d backend=%d, syncing to frontend",
            payload.step_index, agent_manager.current_step_index,
        )
        agent_manager.current_step_index = payload.step_index
    new_idx = agent_manager.complete_current_step()
    plan_finished = new_idx is None

    # If there's a next step, generate guidance for it (requires LLM)
    guidance = ""
    if not plan_finished and new_idx is not None and agent_manager.has_llm():
        step = agent_manager.current_plan[new_idx]
        prompt = (
            f"The student just completed step {payload.step_index + 1} and is moving to "
            f"step {new_idx + 1}: '{step['title']}' — {step['description']}. "
            "Give a brief, encouraging transition message (2-3 sentences) with a tip "
            "for getting started on this step."
        )
        response = agent_manager.llm.invoke(prompt)
        guidance = response.content if hasattr(response, "content") else str(response)
        agent_manager.current_plan[new_idx]["guidance"] = guidance

    return {
        "plan": agent_manager.current_plan,
        "current_step_index": agent_manager.current_step_index,
        "plan_finished": plan_finished,
        "guidance": guidance,
    }


# ---------------------------------------------------------------------------
# Writing mode: paragraph approval
# ---------------------------------------------------------------------------

class ApproveParaIn(BaseModel):
    section_index: int

class SkipSectionIn(BaseModel):
    section_index: int

@app.post("/api/writing/approve-paragraph")
async def approve_paragraph(payload: ApproveParaIn):
    """Approve the current paragraph draft and add it to the document."""
    if not agent_manager.paragraph_draft:
        raise HTTPException(status_code=400, detail="No paragraph draft to approve.")

    # The add_approved_paragraph tool handles LaTeX conversion,
    # but here we handle the direct API path for the frontend button
    next_idx = agent_manager.approve_paragraph()
    progress = agent_manager.get_writing_progress()

    return {
        "outline": agent_manager.current_outline,
        "writing_progress": progress,
        "latex": agent_manager.current_latex,
        "next_section_index": next_idx,
        "is_finished": progress["is_finished"],
    }

@app.post("/api/writing/skip-section")
async def skip_section(payload: SkipSectionIn):
    """Skip the current section and move to the next one."""
    next_idx = agent_manager.skip_section()
    progress = agent_manager.get_writing_progress()

    return {
        "outline": agent_manager.current_outline,
        "writing_progress": progress,
        "next_section_index": next_idx,
        "is_finished": progress["is_finished"],
    }

@app.get("/api/writing/progress")
async def writing_progress():
    """Get the current writing progress."""
    return {
        "outline": agent_manager.current_outline,
        "writing_progress": agent_manager.get_writing_progress(),
        "outline_approved": agent_manager.outline_approved,
        "paragraph_draft": agent_manager.paragraph_draft,
    }


# ---------------------------------------------------------------------------
# Session reset
# ---------------------------------------------------------------------------

@app.post("/api/session/reset")
async def reset_session():
    """Reset the conversation session state."""
    agent_manager.reset_session()
    return {"ok": True}


# ---------------------------------------------------------------------------
# LaTeX version history & undo
# ---------------------------------------------------------------------------

@app.get("/api/history")
async def get_history():
    """Return the list of saved LaTeX versions (metadata only, no full source)."""
    summary = agent_manager.get_latex_history_summary()
    return {
        "versions": summary,
        "current_chars": len(agent_manager.current_latex),
        "can_undo": len(agent_manager.latex_history) > 0,
        "can_redo": len(agent_manager.latex_future) > 0,
        "history_count": len(agent_manager.latex_history),
        "future_count": len(agent_manager.latex_future),
    }


@app.post("/api/history/undo")
async def undo_latex():
    """Restore the previous LaTeX version and recompile to PDF."""
    latex = agent_manager.undo_latex()
    if latex is None:
        raise HTTPException(status_code=400, detail="No previous version to undo to.")

    # Recompile the restored version
    tectonic_bin = _find_tectonic()
    pdf_bytes = None

    if tectonic_bin:
        with tempfile.TemporaryDirectory() as tmpdir:
            tex_path = Path(tmpdir) / "document.tex"
            tex_path.write_text(latex, encoding="utf-8")
            for file_id, file_path in agent_manager.uploads.items():
                if file_path.exists():
                    shutil.copy(file_path, Path(tmpdir) / file_path.name)
            try:
                result = subprocess.run(
                    [tectonic_bin, str(tex_path)],
                    capture_output=True, timeout=60, cwd=tmpdir,
                )
                pdf_path = Path(tmpdir) / "document.pdf"
                if result.returncode == 0 and pdf_path.exists():
                    pdf_bytes = pdf_path.read_bytes()
            except Exception as e:
                logger.warning("Tectonic failed on undo: %s", e)

    if pdf_bytes is None:
        pdf_bytes = _compile_via_latexonline(latex)

    if pdf_bytes:
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "X-Latex-Chars": str(len(latex)),
                "X-History-Remaining": str(len(agent_manager.latex_history)),
                "X-Future-Remaining": str(len(agent_manager.latex_future)),
            },
        )

    raise HTTPException(status_code=500, detail="Could not compile the restored version.")


@app.post("/api/history/redo")
async def redo_latex():
    """Restore the next (redo) LaTeX version and recompile to PDF."""
    latex = agent_manager.redo_latex()
    if latex is None:
        raise HTTPException(status_code=400, detail="No future version to redo to.")

    tectonic_bin = _find_tectonic()
    pdf_bytes = None

    if tectonic_bin:
        with tempfile.TemporaryDirectory() as tmpdir:
            tex_path = Path(tmpdir) / "document.tex"
            tex_path.write_text(latex, encoding="utf-8")
            for file_id, file_path in agent_manager.uploads.items():
                if file_path.exists():
                    shutil.copy(file_path, Path(tmpdir) / file_path.name)
            try:
                result = subprocess.run(
                    [tectonic_bin, str(tex_path)],
                    capture_output=True, timeout=60, cwd=tmpdir,
                )
                pdf_path = Path(tmpdir) / "document.pdf"
                if result.returncode == 0 and pdf_path.exists():
                    pdf_bytes = pdf_path.read_bytes()
            except Exception as e:
                logger.warning("Tectonic failed on redo: %s", e)

    if pdf_bytes is None:
        pdf_bytes = _compile_via_latexonline(latex)

    if pdf_bytes:
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "X-Latex-Chars": str(len(latex)),
                "X-History-Remaining": str(len(agent_manager.latex_history)),
                "X-Future-Remaining": str(len(agent_manager.latex_future)),
            },
        )

    raise HTTPException(status_code=500, detail="Could not compile the redo version.")


@app.get("/api/latex")
async def get_current_latex():
    """Return the current LaTeX source (e.g. after undo, so the frontend can sync state)."""
    return {"latex": agent_manager.current_latex or ""}


# ---------------------------------------------------------------------------
# Chat / ask
# ---------------------------------------------------------------------------

@app.post("/api/ask")
async def ask(payload: AskIn):
    """
    Send a message to the AI agent. Returns the agent's text reply,
    the current LaTeX document, choices for the user, and plan state.
    """
    logger.info(
        "POST /api/ask question=%r file_ids=%s mode=%s",
        payload.question, payload.file_ids, payload.mode,
    )

    if not ai_features_enabled():
        raise HTTPException(status_code=503, detail=describe_why_ai_disabled())
    if not anthropic_key_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "ANTHROPIC_API_KEY is not set. Add it to .env to use chat, or set THEBOSS_AI_ENABLED=false "
                "to run without AI prompts."
            ),
        )

    client = _get_anthropic_client()
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="AI client could not be initialized. Check ANTHROPIC_API_KEY and THEBOSS_AI_ENABLED.",
        )

    # Sync mode from frontend
    if payload.mode != "initial":
        agent_manager.current_mode = payload.mode

    # Handle outline approval action
    if payload.question == "approve_outline" and agent_manager.current_outline:
        agent_manager.approve_outline()

    # Sync plan state from frontend if provided
    if payload.plan:
        agent_manager.current_plan = payload.plan
        agent_manager.current_step_index = payload.current_step_index

    # Sync outline state from frontend if provided
    if payload.outline:
        agent_manager.current_outline = payload.outline

    # Apply user-set file purposes and diagram flags
    if payload.file_purposes:
        for fid, purpose in payload.file_purposes.items():
            if purpose in ("assignment", "reference", "figure") and agent_manager.uploads.get(fid):
                agent_manager.set_file_purpose(fid, purpose)
    if payload.file_has_diagrams:
        for fid, has_diag in payload.file_has_diagrams.items():
            agent_manager.set_file_has_diagrams(fid, bool(has_diag))

    # Detect geometry setup-check requests (from the "Verify Setup" button in PlanPanel)
    # These must be answered with ONLY a setup description — no math, no solution.
    is_setup_check = payload.question.startswith("[Setup Check –")

    # Build file context — send files directly to the model as images/text
    question = payload.question

    if is_setup_check:
        question += (
            "\n\n[SYSTEM INSTRUCTION: This is a SETUP CHECK request. "
            "You MUST respond with ONLY the geometric setup — no equations, no calculations, no solution. "
            "Format your response as:\n"
            "**Setup:**\n"
            "- Coordinate system: ...\n"
            "- [Object A]: direction of motion = ...\n"
            "- [Object B]: direction of motion = ...\n"
            "- Angle θ measured from: ...\n\n"
            "Then end with EXACTLY this line: 'Does this match what you see in the figure?'\n"
            "Then include this choices tag:\n"
            '<!--CHOICES:[{"label":"✓ Yes, setup is correct — now solve","value":"setup_ok"},'
            '{"label":"✗ Correction needed","value":"setup_wrong"}]-->\n'
            "Do NOT include any math or attempt any part of the solution.]"
        )
    file_content_blocks = []  # Multimodal content blocks for the message
    figure_filenames = []
    reference_names = []
    file_labels = []  # Human-readable labels for attached files

    for fid in payload.file_ids:
        path = agent_manager.uploads.get(fid)
        if not path or not path.exists():
            continue

        purpose = agent_manager.get_file_purpose(fid)
        text = agent_manager.upload_texts.get(fid, "")
        ext = path.suffix.lower()

        is_file_mentioned = bool(payload.file_mentioned and payload.file_mentioned.get(fid))
        if purpose == "figure" and not is_file_mentioned:
            figure_filenames.append(path.name)
            continue

        if purpose == "reference":
            reference_names.append(path.name)

        # ── Decide whether to send full binary or cheap text ──────────
        # Full content is sent when:
        #   - First time seeing the file (model needs the visual layout)
        #   - Assignment with "has diagrams" flag (needs visuals every turn)
        #   - User @-mentioned this file (explicit request to look at it)
        # Otherwise: send extracted text only (much cheaper)
        already_sent = agent_manager.was_file_sent_full(fid)
        has_diagrams = agent_manager.get_file_has_diagrams(fid)
        use_full = (not already_sent
                    or (purpose == "assignment" and has_diagrams)
                    or is_file_mentioned)

        if use_full:
            blocks = _file_to_content_blocks(path)
            if blocks:
                file_content_blocks.extend(blocks)
                file_labels.append(f"{path.name} (file_id: {fid})")
                agent_manager.mark_file_sent_full(fid)
                logger.info("Sending %s FULL to model as %d block(s)", path.name, len(blocks))
            elif text:
                # File couldn't be converted to blocks — fall back to text
                question += f"\n\n[CONTENT OF {path.name} (file_id: {fid})]:\n{text}"
                file_labels.append(f"{path.name} (file_id: {fid}, text)")
                agent_manager.mark_file_sent_full(fid)
                logger.info("Sending %s FULL as text (%d chars)", path.name, len(text))
            else:
                question += (
                    f"\n\n[FILE UPLOAD NOTE: '{path.name}' (file_id: {fid}) was uploaded "
                    f"but its content could not be read (unsupported format or read error). "
                    f"Do NOT guess or describe what it might contain. "
                    f"Instead, tell the user you couldn't read the file and ask them to "
                    f"describe its contents or try a different format.]"
                )
                file_labels.append(f"{path.name} (file_id: {fid}, unreadable)")
        else:
            # Subsequent turn, no diagrams flag → send as text (much cheaper)
            if text:
                question += f"\n\n[CONTENT OF {path.name} (file_id: {fid})]:\n{text}"
                file_labels.append(f"{path.name} (file_id: {fid}, text-repeat)")
                logger.info("Sending %s as TEXT-ONLY repeat (%d chars, saving tokens)", path.name, len(text))
            else:
                # No text available and not sending full — remind model it exists
                question += (
                    f"\n\n[NOTE: '{path.name}' (file_id: {fid}) was shown to you earlier "
                    f"in this conversation. Refer to your earlier analysis of this file.]"
                )
                file_labels.append(f"{path.name} (file_id: {fid}, previously-seen)")
                logger.info("Sending %s as reference-only (no text, previously seen)", path.name)

    # Add file context labels to the question
    if file_labels:
        question += f"\n\n[ATTACHED FILES with this message: {', '.join(file_labels)}. The images below are the actual file contents — you can read them directly.]"
    # (reference_names logged for debug; no special action needed)

    # Tell the AI about figure files
    if figure_filenames:
        question += f"\n\n[Figure files for \\includegraphics: {', '.join(figure_filenames)}]"

    # When user only sent a mode choice ("planning", "writing", "execution"), remind model to use files
    q_stripped = (payload.question or "").strip().lower()
    if q_stripped in ("planning", "writing", "execution") and file_labels:
        question += (
            "\n\n[IMPORTANT: The user just selected a mode. The assignment is in the attached files above. "
            "Read those files carefully to understand the specific problems/tasks. "
            "Do NOT use a generic template — base your response on the actual assignment content.]"
        )

    # Inject template preference into the question context
    template_key = (payload.template or "auto").lower()
    if template_key != "auto" and template_key in TEMPLATES:
        tpl = TEMPLATES[template_key]
        question += (
            f"\n\n[TEMPLATE PREFERENCE: The student has selected the '{tpl['name']}' template. "
            f"When generating a LaTeX document, apply this formatting: {tpl['latex_hint']}]"
        )

    # If there is existing LaTeX, inject the FULL document so the model can edit it accurately
    if payload.current_latex:
        agent_manager.current_latex = payload.current_latex
        question += (
            "\n\n[CURRENT DOCUMENT — edit this, do not rewrite from scratch]:\n"
            "```latex\n"
            f"{payload.current_latex}\n"
            "```\n"
            "If the user is requesting any changes, additions, formatting tweaks, or edits: "
            "output the FULL updated document in ```latex fences. "
            "Use ONLY the content already in this document as your source of truth — "
            "do NOT invent or change any names, facts, dates, or details unless the user explicitly asks."
        )

    # Inject mode context so the model knows the current state
    if payload.mode == "planning" and agent_manager.current_plan:
        step_idx = agent_manager.current_step_index
        if 0 <= step_idx < len(agent_manager.current_plan):
            step = agent_manager.current_plan[step_idx]
            # Check whether the student is explicitly asking to generate a document
            doc_keywords = [
                "generate", "create", "compile", "make", "write", "produce",
                "answer key", "solution", "document", "pdf", "latex", "answer sheet",
            ]
            q_lower = (payload.question or "").lower()
            wants_document = any(kw in q_lower for kw in doc_keywords)
            if wants_document:
                question += (
                    f"\n\n[SYSTEM CONTEXT: The student is in PLANNING MODE (step "
                    f"{step_idx + 1} of {len(agent_manager.current_plan)}: '{step['title']}'). "
                    f"The student is explicitly asking you to CREATE or COMPILE a document. "
                    f"Generate the complete LaTeX document in ```latex fences immediately. "
                    f"Do NOT refuse or only show the solution as plain text in chat.]"
                )
            else:
                question += (
                    f"\n\n[SYSTEM CONTEXT: The student is in PLANNING MODE, currently on "
                    f"step {step_idx + 1} of {len(agent_manager.current_plan)}: "
                    f"'{step['title']}' — {step['description']}. "
                    f"Act as a tutor. If they ask to generate a document, output it as LaTeX in ```latex fences.]"
                )

    # Inject writing mode context
    if payload.mode == "writing":
        progress = agent_manager.get_writing_progress()
        if agent_manager.current_outline and agent_manager.outline_approved:
            sec_idx = agent_manager.paragraph_section_index
            if 0 <= sec_idx < len(agent_manager.current_outline):
                sec = agent_manager.current_outline[sec_idx]
                question += (
                    f"\n\n[SYSTEM CONTEXT: WRITING MODE — outline approved. "
                    f"Currently writing section {sec_idx + 1} of {progress['total']}: "
                    f"'{sec.get('title', '')}' — {sec.get('description', '')}. "
                    f"Progress: {progress['completed']} sections approved, {progress['skipped']} skipped. "
                    f"Write this section in academic prose, present the draft, and include approval CHOICES.]"
                )
            elif progress["is_finished"]:
                question += (
                    "\n\n[SYSTEM CONTEXT: WRITING MODE — all sections complete! "
                    "Congratulate the student and offer final editing / PDF compilation.]"
                )
        elif agent_manager.current_outline and not agent_manager.outline_approved:
            question += (
                "\n\n[SYSTEM CONTEXT: WRITING MODE — outline proposed, awaiting approval. "
                "Present the outline and ask for approval with CHOICES.]"
            )
        else:
            question += (
                "\n\n[SYSTEM CONTEXT: WRITING MODE — no outline yet. "
                "Analyze the assignment, help with thesis formation, then propose an outline.]"
            )

    # Build the messages list for the Anthropic API.
    # History turns are plain text; only the current message carries file attachments.
    messages = []
    for turn in payload.history:
        role = turn.get("role", "user")
        # Anthropic API uses "user" / "assistant" roles
        api_role = "assistant" if role == "assistant" else "user"
        messages.append({"role": api_role, "content": turn.get("content", "")})

    # Current user message — text + any file blocks
    if file_content_blocks:
        # Convert our internal block format to Anthropic API format
        current_content = []
        for block in file_content_blocks:
            if block.get("type") == "document":
                current_content.append(block)  # already Anthropic-compatible
            elif block.get("type") == "image_url":
                # Convert image_url format to Anthropic image block
                url = block.get("image_url", {}).get("url", "")
                if url.startswith("data:"):
                    mime, data = url[5:].split(";base64,", 1)
                    current_content.append({
                        "type": "image",
                        "source": {"type": "base64", "media_type": mime, "data": data},
                    })
        current_content.append({"type": "text", "text": question})
        messages.append({"role": "user", "content": current_content})
    else:
        messages.append({"role": "user", "content": question})

    logger.info(
        "Calling Anthropic API: %d history turns + 1 current message, %d file blocks",
        len(payload.history), len(file_content_blocks),
    )

    try:
        generated_figures: list[dict] = []

        # Build the full system prompt: static base + dynamic session context
        session_ctx = _build_session_context(payload)
        full_system_prompt = SYSTEM_PROMPT + "\n\n" + session_ctx
        logger.info("Session context injected (%d chars)", len(session_ctx))

        with tempfile.TemporaryDirectory() as _python_tmpdir:
            response = client.messages.create(
                model=_MODEL,
                max_tokens=16000,
                system=full_system_prompt,
                messages=messages,
                tools=[PYTHON_TOOL],
            )

            # ── Tool-use agentic loop ────────────────────────────────────────
            # Claude may call run_python one or more times before giving its
            # final text answer. We execute the code, feed results back, and
            # repeat until stop_reason != "tool_use" (max 6 iterations).
            for _tool_iter in range(6):
                if response.stop_reason != "tool_use":
                    break

                tool_results = []
                assistant_content = []  # serialisable copy of response content

                for block in response.content:
                    b_type = getattr(block, "type", None)
                    if b_type == "text":
                        assistant_content.append({"type": "text", "text": block.text})
                    elif b_type == "tool_use":
                        assistant_content.append({
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        })
                        if block.name == "run_python":
                            code = block.input.get("code", "")
                            logger.info("Executing run_python (iter %d): %d chars of code",
                                        _tool_iter, len(code))
                            result = _execute_python(code, _python_tmpdir)

                            # Register any generated figures as uploads
                            fig_names = []
                            for fig_path in result["figures"]:
                                fig_fid = str(uuid.uuid4())
                                dest_fig = UPLOADS_DIR / f"{fig_fid}_{fig_path.name}"
                                shutil.copy(fig_path, dest_fig)
                                agent_manager.uploads[fig_fid] = dest_fig
                                agent_manager.upload_texts[fig_fid] = ""
                                generated_figures.append({
                                    "file_id": fig_fid,
                                    "filename": fig_path.name,
                                    "path": str(dest_fig),
                                })
                                fig_names.append(fig_path.name)
                                logger.info("Registered generated figure %s -> %s",
                                            fig_path.name, dest_fig)

                            tool_output = result["output"]
                            if fig_names:
                                tool_output += (
                                    f"\n\nGenerated figures saved: {fig_names}. "
                                    "These are now registered as uploaded files. "
                                    "Use them in LaTeX with "
                                    + ", ".join(f"\\includegraphics{{{n}}}" for n in fig_names)
                                )

                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": tool_output,
                            })

                # Continue the conversation with tool results
                messages.append({"role": "assistant", "content": assistant_content})
                messages.append({"role": "user", "content": tool_results})

                response = client.messages.create(
                    model=_MODEL,
                    max_tokens=16000,
                    system=full_system_prompt,
                    messages=messages,
                    tools=[PYTHON_TOOL],
                )

        # Extract final text from the (non-tool-use) response
        final_answer = ""
        for block in response.content:
            if getattr(block, "type", None) == "text":
                final_answer += block.text

        if not final_answer:
            raise HTTPException(status_code=502, detail="Model produced no response.")

        # Auto-detect LaTeX: look for a complete document in a ```latex fence or bare \documentclass
        latex = ""
        fence_match = re.search(r"```(?:latex|tex)\s*(\\documentclass.*?\\end\{document\})\s*```", final_answer, re.DOTALL | re.IGNORECASE)
        if fence_match:
            latex = fence_match.group(1).strip()
        else:
            bare_match = re.search(r"(\\documentclass\b.*?\\end\{document\})", final_answer, re.DOTALL)
            if bare_match:
                latex = bare_match.group(1).strip()

        if latex:
            # Save current version to history before overwriting
            agent_manager.push_latex_version(label=payload.question[:80] if payload.question else "")
            agent_manager.current_latex = latex
            # Remove the raw LaTeX block from the displayed answer so the chat stays clean
            final_answer = re.sub(r"```(?:latex|tex)\s*\\documentclass.*?\\end\{document\}\s*```", "", final_answer, flags=re.DOTALL | re.IGNORECASE).strip()
            final_answer = re.sub(r"\\documentclass\b.*?\\end\{document\}", "", final_answer, flags=re.DOTALL).strip()
            if not final_answer:
                final_answer = "Here's your document — it's compiling to PDF now."
            logger.info("Extracted %d chars of LaTeX from response", len(latex))
        else:
            # Truncated document (hit token limit before \end{document}) — still hide the raw
            # code block from chat so it doesn't leak as unformatted text
            truncated = re.sub(
                r"```(?:latex|tex)\s*\\documentclass.*?(?:```|$)",
                "",
                final_answer,
                flags=re.DOTALL | re.IGNORECASE,
            ).strip()
            if truncated != final_answer:
                final_answer = truncated or (
                    "⚠️ The document was too long and got cut off mid-generation. "
                    "Try asking for fewer problems at a time, or split the request into parts."
                )
                logger.warning("LaTeX response was truncated before \\end{document} — raw block hidden from chat")

        # Parse embedded structured data from the answer (in order: plan, outline, choices)
        final_answer, new_plan = parse_plan_from_answer(final_answer)
        if new_plan:
            agent_manager.set_plan(new_plan)
            agent_manager.current_mode = "planning"
            logger.info("Extracted plan with %d steps from response", len(new_plan))

        final_answer, new_outline = parse_outline_from_answer(final_answer)
        if new_outline:
            # Enrich with tracking fields if missing
            for sec in new_outline:
                if "status" not in sec:
                    sec["status"] = "pending"
                if "content" not in sec:
                    sec["content"] = ""
            agent_manager.set_outline(new_outline)
            agent_manager.current_mode = "writing"
            logger.info("Extracted outline with %d sections from response", len(new_outline))

        clean_answer, choices = parse_choices_from_answer(final_answer)

        # Determine the mode to return (may have been updated above)
        returned_mode = agent_manager.current_mode

        # ── Token usage extraction ──────────────────────────────────
        usage = {"input_tokens": 0, "output_tokens": 0}
        u = getattr(response, "usage", None)
        logger.info("[TOKEN DEBUG] response.usage type=%s value=%s", type(u).__name__, u)
        if u is not None:
            # Anthropic SDK returns a Usage object with int attributes
            try:
                usage["input_tokens"] = int(u.input_tokens) if u.input_tokens else 0
                usage["output_tokens"] = int(u.output_tokens) if u.output_tokens else 0
            except (AttributeError, TypeError):
                # Fallback for dict-like usage (shouldn't happen with current SDK)
                if isinstance(u, dict):
                    usage["input_tokens"] = int(u.get("input_tokens", 0) or 0)
                    usage["output_tokens"] = int(u.get("output_tokens", 0) or 0)
                else:
                    logger.warning("[TOKEN DEBUG] Could not extract tokens from usage object: %s", repr(u))

            # Also capture cache tokens if present (Anthropic prompt caching)
            cache_read = getattr(u, "cache_read_input_tokens", 0) or 0
            cache_create = getattr(u, "cache_creation_input_tokens", 0) or 0
            if cache_read or cache_create:
                usage["cache_read_input_tokens"] = int(cache_read)
                usage["cache_creation_input_tokens"] = int(cache_create)

        # Cost estimation (Claude Sonnet 4.5 pricing: $3/MTok in, $15/MTok out)
        est_cost = (usage["input_tokens"] * 3.0 + usage["output_tokens"] * 15.0) / 1_000_000
        usage["estimated_cost_usd"] = round(est_cost, 6)

        logger.info(
            "Anthropic usage: input=%s output=%s est_cost=$%.4f",
            usage["input_tokens"], usage["output_tokens"], est_cost,
        )

        result = AskOut(
            answer=clean_answer,
            latex=latex,
            choices=choices,
            plan=agent_manager.current_plan if agent_manager.current_plan else None,
            outline=agent_manager.current_outline if agent_manager.current_outline else None,
            writing_progress=agent_manager.get_writing_progress() if agent_manager.current_outline else None,
            paragraph_draft=agent_manager.paragraph_draft if agent_manager.paragraph_draft else None,
            mode=returned_mode,
            usage=usage,
            generated_figures=generated_figures if generated_figures else None,
        ).model_dump()

        # Auto-save conversation if conversation_id provided
        if payload.conversation_id:
            try:
                from db.operations import update_conversation
                # Build updated message history (append the new assistant reply)
                # Prefer all_messages (full history) over history (rolling window)
                base_messages = payload.all_messages if payload.all_messages else payload.history
                updated_messages = list(base_messages)
                updated_messages.append({"role": "user", "content": payload.question})
                updated_messages.append({"role": "assistant", "content": clean_answer})
                # Auto-generate title from first user message if conversation is new
                title_update = {}
                if len(base_messages) == 0:
                    title_update["title"] = (payload.question[:50].strip() + ("..." if len(payload.question) > 50 else ""))
                # Critical save: messages + core state (columns present in all schema versions)
                update_conversation(
                    payload.conversation_id,
                    messages=updated_messages,
                    current_latex=latex or payload.current_latex,
                    conversation_mode=returned_mode,
                    plan_steps=agent_manager.current_plan if agent_manager.current_plan else None,
                    current_step_index=agent_manager.current_step_index,
                    outline_state=agent_manager.current_outline if agent_manager.current_outline else None,
                    outline_approved=agent_manager.outline_approved,
                    uploaded_file_ids=payload.file_ids,
                    selected_template=payload.template,
                    **title_update,
                )
                logger.info("Auto-saved conversation %s", payload.conversation_id)
                # Non-critical save: latex_history (column added in migration 002;
                # older deployments may not have it — fail gracefully so messages are never lost)
                try:
                    update_conversation(
                        payload.conversation_id,
                        latex_history=agent_manager.latex_history,
                    )
                except Exception as lh_err:
                    logger.debug("Could not save latex_history for conversation %s: %s", payload.conversation_id, lh_err)
            except Exception as e:
                logger.warning("Failed to auto-save conversation %s: %s", payload.conversation_id, e)

        return result

    except HTTPException:
        raise
    except anthropic.APIError as e:
        logger.exception("Anthropic API error: %s", e)
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")
    except Exception as e:
        logger.exception("Error in /api/ask: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error.")
