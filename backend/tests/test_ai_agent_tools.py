"""
Tests for additional tools in ai_agent.py:

- list_courses
- summarize_lectures
- generate_sample_test
- course_todo_tool
"""

import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from langchain_core.documents import Document

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set dummy API keys to avoid prompts during import
os.environ.setdefault("OPENAI_API_KEY", "test-key-openai")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-anthropic")

# Mock create_agent before importing ai_agent (same pattern as general_tool tests)
from unittest.mock import MagicMock as _MagicMock

try:
    import langchain.agents as agents_module
    if not hasattr(agents_module, "create_agent"):
        def mock_create_agent(*args, **kwargs):
            return _MagicMock()
        agents_module.create_agent = mock_create_agent
except (ImportError, AttributeError):
    import sys as _sys
    mock_agents = _MagicMock()
    mock_agents.create_agent = _MagicMock(return_value=_MagicMock())
    _sys.modules["langchain.agents"] = mock_agents

# Import the module under test
import ai_agent  # noqa: E402


class TestListCourses:
    """Tests for list_courses tool."""

    def test_list_courses_success(self, monkeypatch):
        """list_courses returns JSON-encoded courses from agent_manager.get_courses."""
        fake_courses = [
            {"course_id": "cs101", "name": "CS101"},
            {"course_id": "math150", "name": "MATH 150"},
        ]
        # Patch method on agent_manager (same style as vector_store in general_tool tests)
        monkeypatch.setattr(ai_agent.agent_manager, "get_courses", lambda: fake_courses)

        result = ai_agent.list_courses.run(tool_input=None)
        data = json.loads(result)
        assert isinstance(data, list)
        assert data == fake_courses

    def test_list_courses_error(self, monkeypatch):
        """list_courses returns JSON error object when get_courses raises."""
        def _boom():
            raise RuntimeError("boom")

        monkeypatch.setattr(ai_agent.agent_manager, "get_courses", _boom)

        result = ai_agent.list_courses.run(tool_input=None)
        data = json.loads(result)
        assert "error" in data
        assert data["error"] == "Failed to list courses"
        assert "boom" in data["details"]


class TestSummarizeLectures:
    """Tests for summarize_lectures tool."""

    def test_summarize_lectures_no_docs(self, monkeypatch):
        """If no docs are found, summarize_lectures returns a friendly message."""
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=50: [],
        )

        result = ai_agent.summarize_lectures.run("cs101")
        assert "couldn't find any lecture materials" in result.lower()
        assert "cs101" in result

    def test_summarize_lectures_happy_path(self, monkeypatch):
        """When docs exist and LLM returns an object with .content, summary is returned."""
        docs = [
            Document(page_content="Lecture about sorting algorithms.", metadata={"source": "lec1.txt"}),
            Document(page_content="Lecture about graphs.", metadata={"source": "lec2.txt"}),
        ]
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=50: docs,
        )

        # Replace the whole llm with a MagicMock that *already has* .invoke
        fake_llm = MagicMock()
        fake_response = MagicMock()
        fake_response.content = "Summary: sorting and graph algorithms."
        fake_llm.invoke.return_value = fake_response
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.summarize_lectures.run("cs101")

        # We expect the summary text to be returned directly
        assert "sorting" in result.lower()
        assert "graph" in result.lower()
        fake_llm.invoke.assert_called_once()
        # Prompt sanity check
        (prompt_arg,), _ = fake_llm.invoke.call_args
        assert "LECTURE MATERIALS" in prompt_arg

    def test_summarize_lectures_string_response(self, monkeypatch):
        """When LLM returns a string directly (line 126), it should work."""
        docs = [
            Document(page_content="Lecture content.", metadata={"source": "lec1.txt"}),
        ]
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=50: docs,
        )

        fake_llm = MagicMock()
        fake_llm.invoke.return_value = "This is a string summary directly."
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.summarize_lectures.run("cs101")
        assert "string summary" in result.lower()

    def test_summarize_lectures_exception_handling(self, monkeypatch):
        """When an exception occurs, it should return an error message (lines 132-134)."""
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=50: [Document(page_content="test", metadata={})],
        )

        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = RuntimeError("LLM failed")
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.summarize_lectures.run("cs101")
        assert "Failed to summarize" in result
        assert "cs101" in result


class TestGenerateSampleTest:
    """Tests for generate_sample_test tool."""

    def test_generate_sample_test_valid_json_from_llm(self, monkeypatch):
        """If LLM returns valid JSON, generate_sample_test re-encodes and returns it."""
        docs = [
            Document(page_content="Lecture on trees.", metadata={"source": "lec1.txt"}),
        ]
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=50: docs,
        )

        llm_output = {
            "course_id": "cs101",
            "questions": [
                {
                    "id": 1,
                    "type": "short_answer",
                    "question": "What is a tree?",
                    "answer": "An acyclic connected graph.",
                }
            ],
        }

        fake_llm = MagicMock()
        fake_llm.invoke.return_value = json.dumps(llm_output)
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.generate_sample_test.run("cs101", 1)
        data = json.loads(result)
        assert data["course_id"] == "cs101"
        assert len(data["questions"]) == 1
        assert data["questions"][0]["question"] == "What is a tree?"
        fake_llm.invoke.assert_called_once()

    def test_generate_sample_test_invalid_json_fallback(self, monkeypatch):
        """If LLM returns invalid JSON, generate_sample_test falls back to trivial questions."""
        docs = [
            Document(page_content="Doc A content", metadata={"source": "a.txt"}),
            Document(page_content="Doc B content", metadata={"source": "b.txt"}),
        ]
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=50: docs,
        )

        fake_llm = MagicMock()
        fake_llm.invoke.return_value = "NOT JSON"
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.generate_sample_test.run("cs101", 3)
        data = json.loads(result)
        # Fallback should still have course_id and some questions
        assert data["course_id"] == "cs101"
        assert "warning" in data
        # At most len(docs) questions (min(num_questions, len(docs)))
        assert len(data["questions"]) == len(docs)
        assert all(q["type"] == "short_answer" for q in data["questions"])
        fake_llm.invoke.assert_called_once()

    def test_generate_sample_test_no_docs(self, monkeypatch):
        """When no docs are found, should return empty questions list (lines 166-167)."""
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=50: [],
        )

        result = ai_agent.generate_sample_test.run("cs101", 5)
        data = json.loads(result)
        assert data["course_id"] == "cs101"
        assert data["questions"] == []
        assert "warning" in data

    def test_generate_sample_test_object_response(self, monkeypatch):
        """When LLM returns an object with .content attribute (line 209)."""
        docs = [
            Document(page_content="Lecture content.", metadata={"source": "lec1.txt"}),
        ]
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=50: docs,
        )

        fake_llm = MagicMock()
        fake_response = MagicMock()
        fake_response.content = json.dumps({"course_id": "cs101", "questions": [{"id": 1, "type": "short_answer", "question": "Q?", "answer": "A"}]})
        fake_llm.invoke.return_value = fake_response
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.generate_sample_test.run("cs101", 1)
        data = json.loads(result)
        assert data["course_id"] == "cs101"
        assert len(data["questions"]) == 1

    def test_generate_sample_test_exception_handling(self, monkeypatch):
        """When an exception occurs, should return error JSON (lines 240-242)."""
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=50: [Document(page_content="test", metadata={})],
        )

        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = RuntimeError("LLM failed")
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.generate_sample_test.run("cs101", 5)
        data = json.loads(result)
        assert data["course_id"] == "cs101"
        assert data["questions"] == []
        assert "error" in data
        assert "LLM failed" in data["error"]


class TestCourseTodoTool:
    """Tests for course_todo_tool."""

    def test_course_todo_tool_no_docs_returns_empty_list(self, monkeypatch):
        """If no docs are found, course_todo_tool returns an empty JSON list."""
        monkeypatch.setenv("USE_LLM_TODO", "true")
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=100: [],
        )

        result = ai_agent.course_todo_tool.run("this_week")
        data = json.loads(result)
        assert isinstance(data, list)
        assert data == []

    def test_course_todo_tool_valid_json_from_llm(self, monkeypatch):
        """If LLM returns valid JSON array, course_todo_tool returns it as-is."""
        monkeypatch.setenv("USE_LLM_TODO", "true")
        docs = [
            Document(
                page_content="HW1 due Sept 10.",
                metadata={"course_id": "cs101", "course": "CS101", "source": "syllabus.txt"},
            )
        ]
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=100: docs,
        )

        todos = [
            {
                "course_id": "cs101",
                "course_name": "CS101",
                "title": "HW1",
                "item_type": "assignment",
                "due_at": "2025-09-10T23:59:00",
                "occurs_at": None,
                "source": "syllabus.txt",
            }
        ]

        fake_llm = MagicMock()
        fake_llm.invoke.return_value = json.dumps(todos)
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.course_todo_tool.run("all")
        data = json.loads(result)
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["course_id"] == "cs101"
        assert data[0]["item_type"] == "assignment"
        fake_llm.invoke.assert_called_once()

    def test_course_todo_tool_mock_items_all(self, monkeypatch):
        """Test mock_todo_items filtering with time_horizon='all' (lines 377-402)."""
        monkeypatch.delenv("USE_LLM_TODO", raising=False)
        result = ai_agent.course_todo_tool.run("all")
        data = json.loads(result)
        assert isinstance(data, list)
        assert len(data) > 0  # Should return all mock items

    def test_course_todo_tool_mock_items_this_week(self, monkeypatch):
        """Test mock_todo_items filtering with time_horizon='this_week'."""
        monkeypatch.delenv("USE_LLM_TODO", raising=False)
        result = ai_agent.course_todo_tool.run("this_week")
        data = json.loads(result)
        assert isinstance(data, list)
        # Should filter to items within 7 days

    def test_course_todo_tool_mock_items_this_month(self, monkeypatch):
        """Test mock_todo_items filtering with time_horizon='this_month'."""
        monkeypatch.delenv("USE_LLM_TODO", raising=False)
        result = ai_agent.course_todo_tool.run("this_month")
        data = json.loads(result)
        assert isinstance(data, list)
        # Should filter to items within 30 days

    def test_course_todo_tool_object_response(self, monkeypatch):
        """When LLM returns an object with .content attribute (line 451)."""
        monkeypatch.setenv("USE_LLM_TODO", "true")
        docs = [Document(page_content="test", metadata={})]
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=100: docs,
        )

        fake_llm = MagicMock()
        fake_response = MagicMock()
        fake_response.content = json.dumps([{"course_id": "cs101", "title": "Test"}])
        fake_llm.invoke.return_value = fake_response
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.course_todo_tool.run("all")
        data = json.loads(result)
        assert isinstance(data, list)

    def test_course_todo_tool_non_list_parsed(self, monkeypatch):
        """When parsed JSON is not a list, wrap it in a list (line 456)."""
        monkeypatch.setenv("USE_LLM_TODO", "true")
        docs = [Document(page_content="test", metadata={})]
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=100: docs,
        )

        fake_llm = MagicMock()
        # Return a single object instead of a list
        fake_llm.invoke.return_value = json.dumps({"course_id": "cs101", "title": "Test"})
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.course_todo_tool.run("all")
        data = json.loads(result)
        assert isinstance(data, list)
        assert len(data) == 1

    def test_course_todo_tool_invalid_json(self, monkeypatch):
        """When LLM returns invalid JSON, return empty list (lines 463-465)."""
        monkeypatch.setenv("USE_LLM_TODO", "true")
        docs = [Document(page_content="test", metadata={})]
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=100: docs,
        )

        fake_llm = MagicMock()
        fake_llm.invoke.return_value = "NOT JSON"
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.course_todo_tool.run("all")
        data = json.loads(result)
        assert isinstance(data, list)
        assert data == []

    def test_course_todo_tool_exception_handling(self, monkeypatch):
        """When an exception occurs, return error JSON (lines 466-468)."""
        monkeypatch.setenv("USE_LLM_TODO", "true")
        monkeypatch.setattr(
            ai_agent.agent_manager,
            "search_course",
            lambda course_id, query, k=100: [Document(page_content="test", metadata={})],
        )

        fake_llm = MagicMock()
        fake_llm.invoke.side_effect = RuntimeError("LLM failed")
        monkeypatch.setattr(ai_agent.agent_manager, "llm", fake_llm)

        result = ai_agent.course_todo_tool.run("all")
        data = json.loads(result)
        assert "error" in data
        assert "LLM failed" in data["details"]


if __name__ == "__main__":
    pytest.main(
        [
            __file__,
            "-v",
            "--cov=ai_agent",
            "--cov-report=term-missing",
            "--cov-branch",
        ]
    )
