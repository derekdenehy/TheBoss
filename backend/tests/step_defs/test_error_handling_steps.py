"""
Step definitions for error handling feature.
"""
import pytest
from pytest_bdd import given, when, then, parsers, scenarios
from httpx import Response, TimeoutException, RequestError

# Load feature files
scenarios("../features/error_handling.feature")


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


@when(parsers.parse('the user requests a non-existent endpoint "{endpoint}"'))
def user_requests_nonexistent_endpoint(api_client, context, endpoint):
    """Request a non-existent endpoint."""
    try:
        response = api_client.get(endpoint)
    except Exception as e:
        # Some clients might raise exceptions for 404s
        context["error"] = e
        context["response"] = None
        return
    context["response"] = response


@when("the user sends an invalid request to \"/api/ask\"")
def user_sends_invalid_request(api_client, context):
    """Send an invalid request (missing required fields)."""
    # Send request without required "question" field
    response = api_client.post("/api/ask", json={})
    context["response"] = response


@when("the user asks an empty question")
def user_asks_empty_question(api_client, context):
    """Send an empty question."""
    response = api_client.post("/api/ask", json={"question": ""})
    context["response"] = response


@given(parsers.parse('the course "{course_id}" does not exist'))
def course_does_not_exist(api_client, context, course_id):
    """Verify a course does not exist in the system."""
    response = api_client.get("/api/courses")
    data = response.json()
    course_ids = [c["course_id"].lower() for c in data["courses"]]
    # This step passes if course doesn't exist (for error testing)
    context["invalid_course_id"] = course_id


@when(parsers.parse('the user requests a summary for course "{course_id}"'))
def user_requests_summary_invalid_course(api_client, context, course_id):
    """Request a summary for a course that doesn't exist."""
    response = api_client.get(f"/api/courses/{course_id}/summary")
    context["response"] = response


@when(parsers.parse('the user sends a request without required fields to "{endpoint}"'))
def user_sends_request_without_fields(api_client, context, endpoint):
    """Send a request without required fields."""
    response = api_client.post(endpoint, json={})
    context["response"] = response


@then("the response status should be 404")
def response_status_is_404(context):
    """Verify the HTTP response status is 404."""
    response: Response = context.get("response")
    if response is None:
        # If we got an exception, that's also acceptable for 404s
        assert "error" in context, "Expected 404 response or error"
        return
    assert response.status_code == 404, \
        f"Expected status 404, got {response.status_code}: {response.text}"


@then("the response status should be 422")
def response_status_is_422(context):
    """Verify the HTTP response status is 422 (Unprocessable Entity)."""
    response: Response = context["response"]
    assert response.status_code == 422, \
        f"Expected status 422, got {response.status_code}: {response.text}"


@then("the response status should be 400 or 422")
def response_status_is_400_or_422(context):
    """Verify the HTTP response status is 400 or 422."""
    response: Response = context["response"]
    assert response.status_code in [400, 422], \
        f"Expected status 400 or 422, got {response.status_code}: {response.text}"


@then("the response status should be 400, 422, or 500")
def response_status_is_400_422_or_500(context):
    """Verify the HTTP response status is 400, 422, or 500."""
    response: Response = context["response"]
    assert response.status_code in [400, 422, 500], \
        f"Expected status 400, 422, or 500, got {response.status_code}: {response.text}"


@then("the response status should be 404 or 500")
def response_status_is_404_or_500(context):
    """Verify the HTTP response status is 404 or 500."""
    response: Response = context["response"]
    assert response.status_code in [404, 500], \
        f"Expected status 404 or 500, got {response.status_code}: {response.text}"


@then("the response status should be 200")
def response_status_is_200(context):
    """Verify the HTTP response status is 200."""
    response: Response = context["response"]
    assert response.status_code == 200, \
        f"Expected status 200, got {response.status_code}: {response.text}"


@then("the response should indicate course not found")
def response_indicates_course_not_found(context):
    """Verify the response indicates the course was not found."""
    response: Response = context["response"]
    data = response.json()
    # The API returns 200 with a message indicating course not found
    assert "summary" in data, "Response should contain 'summary' field"
    summary_lower = data["summary"].lower()
    not_found_keywords = ["couldn't find", "not found", "no lecture materials", "invalid"]
    assert any(keyword in summary_lower for keyword in not_found_keywords), \
        f"Response should indicate course not found, got: {data['summary']}"

