"""
Tests for new endpoints in main.py:

- GET  /api/courses
- GET  /api/courses/{course_id}/summary
- POST /api/courses/{course_id}/sample-test
- GET  /api/dashboard/todo

These tests mock underlying agent_manager and tool calls to avoid real LLM/vector
store usage.
"""

import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

# Ensure parent dir on path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Dummy API keys to avoid interactive prompts
os.environ.setdefault("OPENAI_API_KEY", "test-key-openai")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-anthropic")

# Make sure langchain.agents.create_agent exists before importing ai_agent/main
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

import main  # noqa: E402

client = TestClient(main.app)


class TestCoursesEndpoint:
    def test_list_courses_success(self, monkeypatch):
        """GET /api/courses returns normalized course list."""
        fake_courses = [
            {"course_id": "cs101", "name": "CS101"},
            {"course_id": "MATH150", "name": "MATH 150"},
        ]
        monkeypatch.setattr(main.agent_manager, "get_courses", lambda: fake_courses)

        resp = client.get("/api/courses")
        assert resp.status_code == 200
        data = resp.json()
        assert "courses" in data
        assert len(data["courses"]) == 2
        assert data["courses"][0]["course_id"] == "cs101"

    def test_list_courses_error(self, monkeypatch):
        """GET /api/courses -> 500 when underlying get_courses raises."""
        def boom():
            raise RuntimeError("boom")
        monkeypatch.setattr(main.agent_manager, "get_courses", boom)

        resp = client.get("/api/courses")
        assert resp.status_code == 500
        assert resp.json()["detail"] == "Failed to list courses."


class TestCourseSummaryEndpoint:
    def test_course_summary_success(self, monkeypatch):
        """GET /api/courses/{course_id}/summary returns summary text."""
        class DummyTool:
            def run(self, course_id):
                return f"Summary for {course_id}"

        monkeypatch.setattr(main, "summarize_lectures", DummyTool())

        resp = client.get("/api/courses/cs101/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["course_id"] == "cs101"
        assert "Summary for cs101" in data["summary"]

    def test_course_summary_error(self, monkeypatch):
        """GET /api/courses/{course_id}/summary -> 500 on error."""
        class DummyTool:
            def run(self, course_id):
                raise RuntimeError("oops")
        monkeypatch.setattr(main, "summarize_lectures", DummyTool())

        resp = client.get("/api/courses/cs101/summary")
        assert resp.status_code == 500
        assert resp.json()["detail"] == "Failed to summarize lectures."


class TestSampleTestEndpoint:
    def test_sample_test_success(self, monkeypatch):
        """POST /api/courses/{course_id}/sample-test returns parsed questions."""
        class DummyTool:
            def run(self, course_id, num_questions):
                payload = {
                    "course_id": course_id,
                    "questions": [
                        {
                            "id": 1,
                            "type": "short_answer",
                            "question": "Q1?",
                            "answer": "A1",
                        }
                    ],
                }
                return json.dumps(payload)

        monkeypatch.setattr(main, "generate_sample_test", DummyTool())

        resp = client.post(
            "/api/courses/cs101/sample-test",
            json={"num_questions": 1},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["course_id"] == "cs101"
        assert len(data["questions"]) == 1
        assert data["questions"][0]["question"] == "Q1?"

    def test_sample_test_bad_json(self, monkeypatch):
        """POST /api/courses/{course_id}/sample-test -> 502 when tool returns invalid JSON."""
        class DummyTool:
            def run(self, course_id, num_questions):
                return "NOT JSON"

        monkeypatch.setattr(main, "generate_sample_test", DummyTool())

        resp = client.post("/api/courses/cs101/sample-test", json={"num_questions": 3})
        assert resp.status_code == 502
        assert "Model produced invalid JSON" in resp.json()["detail"]


class TestDashboardTodoEndpoint:
    def test_dashboard_todo_success(self, monkeypatch):
        """GET /api/dashboard/todo returns parsed TodoItem list."""
        class DummyTool:
            def run(self, time_horizon):
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
                return json.dumps(todos)

        monkeypatch.setattr(main, "course_todo_tool", DummyTool())

        resp = client.get("/api/dashboard/todo?time_horizon=this_week")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        assert item["course_id"] == "cs101"
        assert item["item_type"] == "assignment"

    def test_dashboard_todo_bad_json_returns_empty_list(self, monkeypatch):
        """GET /api/dashboard/todo returns [] when tool emits invalid JSON."""
        class DummyTool:
            def run(self, time_horizon):
                return "NOT JSON"

        monkeypatch.setattr(main, "course_todo_tool", DummyTool())

        resp = client.get("/api/dashboard/todo")
        assert resp.status_code == 200
        data = resp.json()
        assert data == []


if __name__ == "__main__":
    pytest.main(
        [
            __file__,
            "-v",
            "--cov=main",
            "--cov-report=term-missing",
            "--cov-branch",
        ]
    )
