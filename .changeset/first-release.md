---
'@camperoni/zucchini': minor
---

First release. Generic, imperative Gherkin steps as component contracts for Storybook:

- ten library steps keyed on test ids, plus your project's own steps;
- contracts beside their stories, bound by `@story:` tag or a `story` column;
- a generated step catalog and a contract linter, with discouraged steps flagged as warnings;
- a runner on Vitest browser mode for Chromium, Firefox and WebKit, on desktop and mobile;
- the living spec: each component's docs page shows its contracts and their last result in every browser,
  plus an overview page;
- the `zucchini` command: `catalog`, `lint`, `contracts`, `merge-results` and the experimental `mutation`
  check.
