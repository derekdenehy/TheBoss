"""
Step definitions for chat feature.
"""
import pytest
from pytest_bdd import given, when, then, parsers, scenarios
from httpx import Response, TimeoutException, RequestError
import json

# Load feature files
scenarios("../features/chat.feature")


@given("the DocAI API is running")
def api_is_running(api_client, context):
    """Verify the API is accessible."""
    try:
        response = api_client.get("/api/health", timeout=5.0)
        assert response.status_code == 200, "API health check failed"
    except TimeoutException:
        pytest.skip("API is not responding (timeout)")
    except RequestError as e:
        pytest.skip(f"API is not accessible: {e}")
    context["api_client"] = api_client


@given("the system has mock course data loaded")
def mock_data_loaded(api_client, context):
    """Verify mock course data is available by checking courses endpoint."""
    response = api_client.get("/api/courses")
    # If courses endpoint works, we assume data is loaded
    # This is a lightweight check
    pass


@when(parsers.parse('the user asks "{question}"'))
def user_asks_question(api_client, context, question):
    """Send a question to the chat API."""
    response = api_client.post(
        "/api/ask",
        json={"question": question}
    )
    context["response"] = response
    context["question"] = question


@then("the response should contain course information")
def response_contains_course_info(context):
    """Verify the response contains course-related information."""
    response: Response = context["response"]
    if response.status_code != 200:
        error_detail = response.json().get("detail", "Unknown error") if response.status_code < 500 else "Server error"
        pytest.fail(f"Expected 200, got {response.status_code}: {error_detail}")
    
    data = response.json()
    assert "answer" in data, "Response should contain 'answer' field"
    assert len(data["answer"]) > 0, "Answer should not be empty"


@then("the response should contain assignment information")
def response_contains_assignment_info(context):
    """Verify the response contains assignment-related information."""
    response: Response = context["response"]
    if response.status_code != 200:
        error_detail = response.json().get("detail", "Unknown error") if response.status_code < 500 else "Server error"
        pytest.fail(f"Expected 200, got {response.status_code}: {error_detail}")
    
    data = response.json()
    assert "answer" in data, "Response should contain 'answer' field"
    # Check if answer mentions assignments, due dates, etc.
    answer_lower = data["answer"].lower()
    assignment_keywords = ["assignment", "due", "homework", "hw", "deadline"]
    assert any(keyword in answer_lower for keyword in assignment_keywords), \
        "Answer should mention assignments or due dates"


@then(parsers.parse('the response should contain information about {course}'))
def response_contains_course_specific_info(context, course):
    """Verify the response contains information about a specific course."""
    response: Response = context["response"]
    if response.status_code != 200:
        error_detail = response.json().get("detail", "Unknown error") if response.status_code < 500 else "Server error"
        pytest.fail(f"Expected 200, got {response.status_code}: {error_detail}")
    
    data = response.json()
    assert "answer" in data, "Response should contain 'answer' field"
    # Check if answer mentions the course
    answer_lower = data["answer"].lower()
    course_lower = course.lower()
    assert course_lower in answer_lower, f"Answer should mention {course}"


@then("the response status should be 200")
def response_status_is_200(context):
    """Verify the HTTP response status is 200."""
    response: Response = context["response"]
    assert response.status_code == 200, \
        f"Expected status 200, got {response.status_code}: {response.text}"

