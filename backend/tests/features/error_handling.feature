Feature: Error Handling
  As a system
  I want to handle errors gracefully
  So that users get meaningful feedback

  Background:
    Given the DocAI API is running

  @smoke @error
  Scenario: API returns 404 for non-existent endpoint
    When the user requests a non-existent endpoint "/api/nonexistent"
    Then the response status should be 404

  @error
  Scenario: API returns 422 for invalid request body
    When the user sends an invalid request to "/api/ask"
    Then the response status should be 422

  @error
  Scenario: API handles empty question gracefully
    When the user asks an empty question
    Then the response status should be 400, 422, or 500

  @error
  Scenario: API handles invalid course ID
    Given the course "invalid_course_999" does not exist
    When the user requests a summary for course "invalid_course_999"
    Then the response status should be 200
    And the response should indicate course not found

  @error
  Scenario: API handles missing required fields
    When the user sends a request without required fields to "/api/ask"
    Then the response status should be 422

