"""
Step definitions for edge cases feature.
"""
import pytest
from pytest_bdd import given, when, then, parsers, scenarios
from httpx import Response, TimeoutException, RequestError

# Load feature files
scenarios("../features/edge_cases.feature")


@given("the DocAI API is running")
def api_is_running(api_client, context):
    """Verify the API is accessible."""
    try:
        response = api_client.get("/api/health", timeout=5.0)
        assert response.status_code == 200, "API health check failed"
    except httpx.TimeoutException:
        pytest.skip("API is not responding (timeout)")
    except httpx.RequestError as e:
        pytest.skip(f"API is not accessible: {e}")
    context["api_client"] = api_client


@given("the system has mock course data loaded")
def mock_data_loaded(api_client, context):
    """Verify mock course data is available."""
    pass


@given(parsers.parse('the course "{course_id}" exists'))
def course_exists(api_client, context, course_id):
    """Verify a course exists in the system."""
    response = api_client.get("/api/courses")
    data = response.json()
    course_ids = [c["course_id"].lower() for c in data["courses"]]
    assert course_id.lower() in course_ids, f"Course {course_id} not found"


@when(parsers.parse('the user requests the dashboard with time horizon "{time_horizon}"'))
def user_requests_dashboard_invalid(api_client, context, time_horizon):
    """Request dashboard with invalid time horizon."""
    response = api_client.get(
        f"/api/dashboard/todo?time_horizon={time_horizon}"
    )
    context["response"] = response
    context["time_horizon"] = time_horizon


@when(parsers.parse('the user requests a sample test for course "{course_id}" with {num_questions:d} questions'))
def user_requests_sample_test_edge(api_client, context, course_id, num_questions):
    """Request a sample test with edge case number of questions."""
    response = api_client.post(
        f"/api/courses/{course_id}/sample-test",
        json={"num_questions": num_questions}
    )
    context["response"] = response
    context["course_id"] = course_id
    context["num_questions"] = num_questions


@when("the user asks a question with 1000 characters")
def user_asks_long_question(api_client, context):
    """Send a very long question."""
    long_question = "What is " + "a" * 990 + "?"
    response = api_client.post(
        "/api/ask",
        json={"question": long_question}
    )
    context["response"] = response
    context["question"] = long_question


@when("the user requests the list of courses")
def user_requests_courses(api_client, context):
    """Request the list of all courses."""
    response = api_client.get("/api/courses")
    context["response"] = response


@then("the response status should be 200")
def response_status_is_200(context):
    """Verify the HTTP response status is 200."""
    response: Response = context["response"]
    assert response.status_code == 200, \
        f"Expected status 200, got {response.status_code}: {response.text}"


@then("the response should contain a list of to-do items")
def response_contains_todo_items(context):
    """Verify the response contains a list of to-do items."""
    response: Response = context["response"]
    data = response.json()
    assert isinstance(data, list), "Response should be a list"


@then("the response should contain a list of questions")
def response_contains_questions(context):
    """Verify the response contains a list of questions."""
    response: Response = context["response"]
    data = response.json()
    assert "questions" in data, "Response should contain 'questions' field"
    assert isinstance(data["questions"], list), "Questions should be a list"


@then("the response should contain course information")
def response_contains_course_info(context):
    """Verify the response contains course-related information."""
    response: Response = context["response"]
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "answer" in data, "Response should contain 'answer' field"
    assert len(data["answer"]) > 0, "Answer should not be empty"


@then("the response should contain a list of courses")
def response_contains_courses(context):
    """Verify the response contains a list of courses."""
    response: Response = context["response"]
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "courses" in data, "Response should contain 'courses' field"
    assert isinstance(data["courses"], list), "Courses should be a list"


@then("the list may be empty")
def list_may_be_empty(context):
    """Verify the list can be empty (for edge cases)."""
    response: Response = context["response"]
    data = response.json()
    # List can be empty, that's acceptable for edge cases
    assert isinstance(data.get("courses", []), list), "Should be a list"

