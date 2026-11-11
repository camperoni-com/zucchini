# Step catalog

Every step a contract can use. Generated from the step definitions by `npm run catalog`; don't edit it by hand.

10 steps: 10 from the library, 0 from the project.

## Library steps

### Then I should assert that the element with id {string} contains {string}

The text of the first element with this test id contains the value.

- Parameters: `string`, `string`
- Example: `Then I should assert that the element with id "day-length-label" contains "Full day"`

### Then I should assert that the element with id {string} has an exact value of {string}

The text of the first element with this test id is exactly the value.

- Parameters: `string`, `string`
- Example: `Then I should assert that the element with id "ages-label" has an exact value of "5-17 years old"`

### Then I should assert that the element with id {string} is of type {string}

The one element with this test id has this tag name (for example "a" or "button").

- Parameters: `string`, `string`
- Example: `Then I should assert that the element with id "map-marker-card-directions-link" is of type "a"`

### Then I should assert that the element with id {string} has an attribute {string} with value {string}

The one element with this test id has the attribute set to exactly the value.

- Parameters: `string`, `string`, `string`
- Example: `Then I should assert that the element with id "map-view-component" has an attribute "data-map-zoom" with value "6"`

### Then I should assert that the {string} element {string} visible

With "is_visible", the one element with this test id becomes visible; with "is_not_visible", none is visible.

- Parameters: `string`, `string`
- Example: `Then I should assert that the "favorite-icon-camp-id-0" element "is_visible" visible`

### When I click on the element with id {string}

Clicks the one element with this test id, once it is visible.

- Parameters: `string`
- Example: `When I click on the element with id "user-location-button"`

### When I click on the element which has an attribute {string} with value {string}

Clicks the one element whose attribute has exactly this value, once it is visible.

- Parameters: `string`, `string`
- Example: `When I click on the element which has an attribute "aria-label" with value "Zoom in"`

### When I {string} over the element with id {string}

With "hover" or "click", hovers or clicks the one element with this test id, then lets the UI settle.

- Parameters: `string`, `string`
- Example: `When I "hover" over the element with id "combinable-camp-id-0-label"`

### When I wait for {string} seconds

Pauses for the given number of seconds.

**Discouraged:** A fixed sleep hides timing bugs and slows every run; a step that checks the page waits for it on its own.

- Parameters: `string`
- Example: `When I wait for "2" seconds`

### When I {string} geolocation and set the location to {string}, {string}

With "allow", the page's location requests get the given location; with "deny", they fail as when the visitor blocks them.

- Parameters: `string`, `string`, `string`
- Example: `When I "allow" geolocation and set the location to "51.50", "-0.12"`

## Project steps

None.
