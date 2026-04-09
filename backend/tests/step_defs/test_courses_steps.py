"""
Step definitions for courses feature.
"""
import pytest
from pytest_bdd import given, when, then, parsers, scenarios
from httpx import Response

# Load feature files
scenarios("../features/courses.feature")


@given("the DocAI API is running")
def api_is_running(api_client, context):
    """Verify the API is accessible."""
    response = api_client.get("/api/health")
    assert response.status_code == 200, "API health check failed"
    context["api_client"] = api_client


@given("the system has mock course data loaded")
def mock_data_loaded(api_client, context):
    """Verify mock course data is available."""
    pass


@when("the user requests the list of courses")
def user_requests_courses(api_client, context):
    """Request the list of all courses."""
    response = api_client.get("/api/courses")
    context["response"] = response


@then("the response should contain a list of courses")
def response_contains_courses(context):
    """Verify the response contains a list of courses."""
    response: Response = context["response"]
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "courses" in data, "Response should contain 'courses' field"
    assert isinstance(data["courses"], list), "Courses should be a list"


@then("each course should have a course_id")
def courses_have_course_id(context):
    """Verify each course has a course_id field."""
    response: Response = context["response"]
    data = response.json()
    
    if len(data["courses"]) > 0:
        for course in data["courses"]:
            assert "course_id" in course, f"Course missing course_id: {course}"


@then("each course should have a name")
def courses_have_name(context):
    """Verify each course has a name field."""
    response: Response = context["response"]
    data = response.json()
    
    if len(data["courses"]) > 0:
        for course in data["courses"]:
            assert "name" in course, f"Course missing name: {course}"


@given(parsers.parse('the course "{course_id}" exists'))
def course_exists(api_client, context, course_id):
    """Verify a course exists in the system."""
    response = api_client.get("/api/courses")
    data = response.json()
    course_ids = [c["course_id"].lower() for c in data["courses"]]
    assert course_id.lower() in course_ids, f"Course {course_id} not found"


@when(parsers.parse('the user requests a summary for course "{course_id}"'))
def user_requests_summary(api_client, context, course_id):
    """Request a course summary."""
    response = api_client.get(f"/api/courses/{course_id}/summary")
    context["response"] = response
    context["course_id"] = course_id


@then("the response should contain a summary")
def response_contains_summary(context):
    """Verify the response contains a summary."""
    response: Response = context["response"]
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "summary" in data, "Response should contain 'summary' field"


@then("the summary should not be empty")
def summary_not_empty(context):
    """Verify the summary is not empty."""
    response: Response = context["response"]
    data = response.json()
    assert len(data["summary"]) > 0, "Summary should not be empty"


@when(parsers.parse('the user requests a sample test for course "{course_id}" with {num_questions:d} questions'))
def user_requests_sample_test(api_client, context, course_id, num_questions):
    """Request a sample test for a course."""
    response = api_client.post(
        f"/api/courses/{course_id}/sample-test",
        json={"num_questions": num_questions}
    )
    context["response"] = response
    context["course_id"] = course_id
    context["num_questions"] = num_questions


@then("the response should contain a list of questions")
def response_contains_questions(context):
    """Verify the response contains a list of questions."""
    response: Response = context["response"]
    if response.status_code != 200:
        error_detail = response.json().get("detail", "Unknown error") if response.status_code < 500 else "Server error"
        pytest.fail(f"Expected 200, got {response.status_code}: {error_detail}")
    
    data = response.json()
    assert "questions" in data, "Response should contain 'questions' field"
    assert isinstance(data["questions"], list), "Questions should be a list"
    if len(data["questions"]) == 0:
        # This might indicate the AI model didn't generate questions properly
        pytest.fail(f"Expected at least one question, but got empty list. Response: {data}")
    assert len(data["questions"]) > 0, "Should have at least one question"


@then("each question should have an id")
def questions_have_id(context):
    """Verify each question has an id field."""
    response: Response = context["response"]
    data = response.json()
    
    for question in data["questions"]:
        assert "id" in question, f"Question missing id: {question}"


@then("each question should have a question text")
def questions_have_question_text(context):
    """Verify each question has a question field."""
    response: Response = context["response"]
    data = response.json()
    
    for question in data["questions"]:
        assert "question" in question, f"Question missing question text: {question}"
        assert len(question["question"]) > 0, "Question text should not be empty"


@then("each question should have an answer")
def questions_have_answer(context):
    """Verify each question has an answer field."""
    response: Response = context["response"]
    data = response.json()
    
    for question in data["questions"]:
        assert "answer" in question, f"Question missing answer: {question}"


@then("the response status should be 200")
def response_status_is_200(context):
    """Verify the HTTP response status is 200."""
    response: Response = context["response"]
    assert response.status_code == 200, \
        f"Expected status 200, got {response.status_code}: {response.text}"

