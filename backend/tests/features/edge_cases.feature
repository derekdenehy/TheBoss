Feature: Edge Cases
  As a system
  I want to handle edge cases properly
  So that the application is robust

  Background:
    Given the DocAI API is running
    And the system has mock course data loaded

  @edge_case
  Scenario: User requests dashboard with invalid time horizon
    When the user requests the dashboard with time horizon "invalid_horizon"
    Then the response status should be 200
    And the response should contain a list of to-do items

  @edge_case
  Scenario: User requests sample test with zero questions
    Given the course "cs101" exists
    When the user requests a sample test for course "cs101" with 0 questions
    Then the response status should be 200
    And the response should contain a list of questions

  @edge_case
  Scenario: User requests sample test with maximum questions
    Given the course "cs101" exists
    When the user requests a sample test for course "cs101" with 100 questions
    Then the response status should be 200
    And the response should contain a list of questions

  @edge_case
  Scenario: User asks a very long question
    When the user asks a question with 1000 characters
    Then the response status should be 200
    And the response should contain course information

  @edge_case
  Scenario: User requests courses when no courses exist
    When the user requests the list of courses
    Then the response should contain a list of courses
    And the list may be empty

