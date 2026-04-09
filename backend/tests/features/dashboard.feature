Feature: Dashboard Functionality
  As a student
  I want to view my to-do items and deadlines
  So that I can stay organized

  Background:
    Given the DocAI API is running
    And the system has mock course data loaded

  @smoke @critical
  Scenario: User views all to-do items
    When the user requests the dashboard with time horizon "all"
    Then the response should contain a list of to-do items
    And each item should have a course_id
    And each item should have a title
    And each item should have an item_type
    And the response status should be 200

  @smoke
  Scenario: User views this week's to-do items
    When the user requests the dashboard with time horizon "this_week"
    Then the response should contain a list of to-do items
    And the response status should be 200

  @smoke
  Scenario: User views this month's to-do items
    When the user requests the dashboard with time horizon "this_month"
    Then the response should contain a list of to-do items
    And the response status should be 200

