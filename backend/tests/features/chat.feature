Feature: Chat Functionality
  As a student
  I want to ask questions about my courses
  So that I can quickly find information

  Background:
    Given the DocAI API is running
    And the system has mock course data loaded

  @smoke @critical
  Scenario: User asks a general question about courses
    When the user asks "What courses do I have?"
    Then the response should contain course information
    And the response status should be 200

  @smoke
  Scenario: User asks about assignments
    When the user asks "What assignments are due this week?"
    Then the response should contain assignment information
    And the response status should be 200

  @smoke
  Scenario: User asks about a specific course
    When the user asks "Tell me about CS101"
    Then the response should contain information about CS101
    And the response status should be 200

