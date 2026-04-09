Feature: Course Management
  As a student
  I want to view and interact with my courses
  So that I can access course-specific information

  Background:
    Given the DocAI API is running
    And the system has mock course data loaded

  @smoke @critical
  Scenario: User lists all courses
    When the user requests the list of courses
    Then the response should contain a list of courses
    And each course should have a course_id
    And each course should have a name
    And the response status should be 200

  @smoke
  Scenario: User generates a course summary
    Given the course "cs101" exists
    When the user requests a summary for course "cs101"
    Then the response should contain a summary
    And the summary should not be empty
    And the response status should be 200

  @smoke
  Scenario: User generates a sample test
    Given the course "cs101" exists
    When the user requests a sample test for course "cs101" with 5 questions
    Then the response should contain a list of questions
    And each question should have an id
    And each question should have a question text
    And each question should have an answer
    And the response status should be 200

