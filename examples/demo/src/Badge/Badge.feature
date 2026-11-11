Feature: Badge

    A small status pill: a label, an optional count, and a tone that colours it. With a link, the whole
    badge is the link.

    @story:Default
    Scenario: Shows its label in the neutral tone
        Then I should assert that the element with id "badge-label" has an exact value of "Draft"
        And I should assert that the element with id "badge" has an attribute "data-tone" with value "neutral"
        And I should assert that the element with id "badge" is of type "span"

    @story:With_Count
    Scenario: Shows the count after the label
        Then I should assert that the element with id "badge" contains "Unread"
        And I should assert that the element with id "badge-count" has an exact value of "3"

    Scenario Outline: The tone follows the badge's meaning
        Then I should assert that the element with id "badge" has an attribute "data-tone" with value "<tone>"

        Examples:
            | story      | tone    |
            | Success    | success |
            | With Count | warning |

    @story:As_Link
    Scenario: A badge with a link is the link
        Then I should assert that the element with id "badge" is of type "a"
        And I should assert that the element with id "badge" has an attribute "href" with value "/changelog"
