Feature: UseMyLocation

    Asks the browser where the visitor is, and shows it, or says the visitor blocked it.

    @story:Default
    Scenario Outline: Shows where the visitor is
        When I "allow" geolocation and set the location to "<latitude>", "<longitude>"
        And I click on the element with id "locate-button"
        Then I should assert that the element with id "location" has an exact value of "<shown>"

        Examples:
            | latitude | longitude | shown          |
            | 51.5007  | -0.1246   | 51.50, -0.12   |
            | 37.7749  | -122.4194 | 37.77, -122.42 |

    @story:Default
    Scenario: Says so when the visitor blocks it
        When I "deny" geolocation and set the location to "", ""
        And I click on the element with id "locate-button"
        Then I should assert that the element with id "location-error" contains "Location is blocked"
        And I should assert that the "location" element "is_not_visible" visible
