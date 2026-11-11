Feature: Tooltip

    A tip that shows while the pointer is over its trigger, or after a tap on touch screens.

    @story:Default @desktop
    Scenario: Shows while the pointer is over the trigger
        # Hovering shows it
        Then I should assert that the "tooltip" element "is_not_visible" visible
        When I "hover" over the element with id "tooltip-trigger"
        Then I should assert that the element with id "tooltip" contains "Chromium, Firefox and WebKit"

        # Moving away hides it (the fixed wait is only here to show how a discouraged step is flagged)
        When I "hover" over the element with id "elsewhere"
        And I wait for "1" seconds
        Then I should assert that the "tooltip" element "is_not_visible" visible

    @story:Default @mobile
    Scenario: Shows after a tap on a touch screen
        When I "click" over the element with id "tooltip-trigger"
        Then I should assert that the "tooltip" element "is_visible" visible
        And I should assert that the element with id "tooltip" has an exact value of "Contracts run in Chromium, Firefox and WebKit."
