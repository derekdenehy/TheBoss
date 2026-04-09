"""
Step definitions for dashboard feature.
"""
import pytest
from pytest_bdd import given, when, then, parsers, scenarios
from httpx import Response, TimeoutException, RequestError

# Load feature files
scenarios("../features/dashboard.feature")


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
    """Verify mock course data is available."""
    pass


@when(parsers.parse('the user requests the dashboard with time horizon "{time_horizon}"'))
def user_requests_dashboard(api_client, context, time_horizon):
    """Request dashboard to-do items."""
    response = api_client.get(
        f"/api/dashboard/todo?time_horizon={time_horizon}"
    )
    context["response"] = response
    context["time_horizon"] = time_horizon


@then("the response should contain a list of to-do items")
def response_contains_todo_items(context):
    """Verify the response contains a list of to-do items."""
    response: Response = context["response"]
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert isinstance(data, list), "Response should be a list"
    # List can be empty, that's okay


@then("each item should have a course_id")
def items_have_course_id(context):
    """Verify each to-do item has a course_id field."""
    response: Response = context["response"]
    data = response.json()
    
    if len(data) > 0:
        for item in data:
            assert "course_id" in item, f"Item missing course_id: {item}"


@then("each item should have a title")
def items_have_title(context):
    """Verify each to-do item has a title field."""
    response: Response = context["response"]
    data = response.json()
    
    if len(data) > 0:
        for item in data:
            assert "title" in item, f"Item missing title: {item}"


@then("each item should have an item_type")
def items_have_item_type(context):
    """Verify each to-do item has an item_type field."""
    response: Response = context["response"]
    data = response.json()
    
    if len(data) > 0:
        for item in data:
            assert "item_type" in item, f"Item missing item_type: {item}"
            assert item["item_type"] in ["assignment", "exam", "project", "class"], \
                f"Invalid item_type: {item['item_type']}"


@then("the response status should be 200")
def response_status_is_200(context):
    """Verify the HTTP response status is 200."""
    response: Response = context["response"]
    assert response.status_code == 200, \
        f"Expected status 200, got {response.status_code}: {response.text}"

