Feature: Disclosure

    A button that shows and hides a panel below it.

    @story:Closed
    Scenario: Opens on a click and closes on another
        # Starts closed
        Then I should assert that the "disclosure-panel" element "is_not_visible" visible
        And I should assert that the element with id "disclosure-toggle" has an attribute "aria-expanded" with value "false"

        # A click opens it
        When I click on the element with id "disclosure-toggle"
        Then I should assert that the "disclosure-panel" element "is_visible" visible
        And I should assert that the element with id "disclosure-toggle" has an attribute "aria-expanded" with value "true"

        # Another click closes it
        When I click on the element which has an attribute "aria-expanded" with value "true"
        Then I should assert that the "disclosure-panel" element "is_not_visible" visible

    @story:Open
    Scenario: Can start open
        Then I should assert that the "disclosure-panel" element "is_visible" visible
        And I should assert that the element with id "disclosure-panel" contains "every browser"
