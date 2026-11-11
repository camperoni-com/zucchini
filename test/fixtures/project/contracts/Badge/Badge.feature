Feature: Badge

    @story:Default
    Scenario: Shows the metro
        Given I am in the "Bay Area" metro
        Then I should assert that the element with id "metro" contains "Bay Area"
