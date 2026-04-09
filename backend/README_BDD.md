# BDD Testing with pytest-bdd

This project uses **Behavior-Driven Development (BDD)** with `pytest-bdd` to write acceptance tests in natural language.

## What is BDD?

BDD (Behavior-Driven Development) is a software development approach that:
- Uses natural language (Gherkin syntax) to describe behavior
- Focuses on user stories and acceptance criteria
- Makes tests readable by non-technical stakeholders
- Uses Given/When/Then format

## Project Structure

```
backend/tests/
├── features/              # Gherkin feature files (.feature)
│   ├── chat.feature
│   ├── dashboard.feature
│   └── courses.feature
├── step_defs/            # Step definitions (Python code)
│   ├── test_chat_steps.py
│   ├── test_dashboard_steps.py
│   └── test_courses_steps.py
└── conftest.py           # Pytest fixtures and configuration
```

## Running BDD Tests

### Prerequisites

1. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Start the API server:**
   ```bash
   # In one terminal
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Run BDD tests:**

   **Option 1: Using the test runner script (recommended):**
   ```bash
   cd backend
   ./run_bdd_tests.sh
   ```

   **Option 2: Using pytest directly:**
   ```bash
   cd backend
   pytest -c pytest-bdd.ini
   ```

   **Option 3: Run specific tests:**
   ```bash
   # Run only chat tests
   pytest tests/step_defs/test_chat_steps.py -v
   
   # Run only smoke tests (critical path)
   pytest -c pytest-bdd.ini -m smoke
   
   # Run only error handling tests
   pytest -c pytest-bdd.ini -m error
   
   # Run tests matching a keyword
   pytest -c pytest-bdd.ini -k "chat"
   ```

### Running Specific Features

```bash
# Run only chat tests
pytest tests/features/chat.feature -v

# Run only dashboard tests
pytest tests/features/dashboard.feature -v

# Run only courses tests
pytest tests/features/courses.feature -v
```

### Running with Coverage

```bash
pytest tests/features/ --cov=. --cov-report=html
```

## Writing New Features

### 1. Create a Feature File

Create a `.feature` file in `tests/features/`:

```gherkin
Feature: New Feature Name
  As a user
  I want to do something
  So that I can achieve a goal

  Scenario: User does something
    Given some precondition
    When the user performs an action
    Then something should happen
```

### 2. Implement Step Definitions

Create step definitions in `tests/step_defs/`:

```python
from pytest_bdd import given, when, then

@given("some precondition")
def some_precondition(context):
    # Implementation
    pass

@when("the user performs an action")
def user_performs_action(context):
    # Implementation
    pass

@then("something should happen")
def something_should_happen(context):
    # Implementation
    pass
```

## Current Test Coverage

### Chat Feature (`chat.feature`)
- User asks general questions about courses
- User asks about assignments
- User asks about specific courses

### Dashboard Feature (`dashboard.feature`)
- User views all to-do items
- User views this week's to-do items
- User views this month's to-do items

### Courses Feature (`courses.feature`) - 3 scenarios
- ✅ User lists all courses (`@smoke @critical`)
- ✅ User generates course summary (`@smoke`)
- ✅ User generates sample test (`@smoke`)

### Error Handling Feature (`error_handling.feature`) - 5 scenarios
- ✅ API returns 404 for non-existent endpoint (`@smoke @error`)
- ✅ API returns 422 for invalid request body (`@error`)
- ✅ API handles empty question gracefully (`@error`)
- ✅ API handles invalid course ID (`@error`)
- ✅ API handles missing required fields (`@error`)

### Edge Cases Feature (`edge_cases.feature`) - 5 scenarios
- ✅ User requests dashboard with invalid time horizon (`@edge_case`)
- ✅ User requests sample test with zero questions (`@edge_case`)
- ✅ User requests sample test with maximum questions (`@edge_case`)
- ✅ User asks a very long question (`@edge_case`)
- ✅ User requests courses when no courses exist (`@edge_case`)

**Total: 19 acceptance test scenarios**

## Configuration

The API base URL can be configured via environment variable:

```bash
export API_BASE_URL=http://localhost:8000
pytest tests/features/ -v
```

Default is `http://localhost:8000`.

## Test Tags

Tests are organized with tags for easy filtering:

- `@smoke` - Critical path tests (run these first)
- `@critical` - Most important user flows
- `@error` - Error handling scenarios
- `@edge_case` - Edge case and boundary testing

**Run tests by tag:**
```bash
pytest -c pytest-bdd.ini -m smoke        # Run only smoke tests
pytest -c pytest-bdd.ini -m "smoke and critical"  # Run critical smoke tests
pytest -c pytest-bdd.ini -m error        # Run only error tests
pytest -c pytest-bdd.ini -m "not edge_case"  # Skip edge cases
```

## Tips

1. **Readable Tests**: Write feature files in plain English that stakeholders can understand
2. **Reusable Steps**: Reuse step definitions across different scenarios
3. **Context Object**: Use the `context` fixture to share data between steps
4. **API Client**: Use the `api_client` fixture for making HTTP requests
5. **Test Tags**: Use tags to organize and filter tests (`@smoke`, `@error`, etc.)
6. **Test Runner**: Use `./run_bdd_tests.sh` for convenient test execution

## Example Feature File

```gherkin
Feature: User Authentication
  As a user
  I want to log in
  So that I can access my courses

  Scenario: Successful login
    Given the user is not logged in
    When the user provides valid credentials
    Then the user should be logged in
    And the user should see their dashboard
```

