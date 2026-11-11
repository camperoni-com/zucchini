# Working on Zucchini (for coding agents)

Instructions for AI coding agents, and a quick map for anyone new. People should start with
[CONTRIBUTING.md](CONTRIBUTING.md); everything there applies here too.

## Rules

- **Sign off every commit** with `git commit -s`. The DCO check fails a pull request with an unsigned commit, and
  the sign-off must match the commit's author.
- **Commit messages** follow Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`, `test:`), in plain
  English that says what changed for the user.
- **Tests first.** Write a failing test for one behaviour, make it pass, repeat. Test through public interfaces
  (the CLI, the exported functions, the demo), not internals.
- **Pull requests go into `main`** and merge as fast-forwards once CI is green. One change per pull request.
- **Add a changeset** (`npx changeset`) when users get something different. Before 1.0, a breaking change is
  `minor` and everything else `patch`. Tests, CI and docs alone don't need one.
- **The step wording is frozen** until the planned wording redesign: don't rename or reword existing steps.
  A step meant to be replaced is marked `discouraged` instead, which makes the linter warn.
- **Public text is for strangers.** README, docs, issues, pull requests and commit messages explain things for
  someone who has never seen the project.

## Checks

| Command                   | What it checks                                                         |
| ------------------------- | ---------------------------------------------------------------------- |
| `npm test`                | Unit tests.                                                            |
| `npm run typecheck`       | TypeScript.                                                            |
| `npm run lint`            | ESLint and Prettier, no warnings allowed.                              |
| `npm run test:packed`     | Packs the package and uses it from a throwaway project.                |
| `npm run release:dry-run` | Dry-runs publishing the next patch and a `next` prerelease.            |
| `npm run demo:install`    | Packs Zucchini into `examples/demo`; run it after changing the source. |

In `examples/demo`: `npm run contracts -- --browser chromium`, `npm run mutation`, `npm run lint` and
`npm run catalog:check`. CI runs the demo's contracts on Chromium, Firefox and WebKit.

## Map

| Path            | What's there                                                                  |
| --------------- | ----------------------------------------------------------------------------- |
| `src/steps`     | The step library: each step's wording, parameters, meaning, example and code. |
| `src/catalog`   | Generates the step catalog (Markdown and JSON) from the step definitions.     |
| `src/contracts` | Parses `.feature` contracts, binds them to stories, and the linter.           |
| `src/runner`    | Runs contracts in Vitest browser mode on `@lotun/vitest-cucumber`.            |
| `src/view`      | Turns contracts and results into the living spec's view model.                |
| `src/storybook` | The Storybook doc blocks, the overview page and the Vite plugin.              |
| `src/mutation`  | The mutation check (experimental).                                            |
| `src/cli`       | The `zucchini` command and its subcommands.                                   |
| `src/config`    | `defineConfig` and config loading.                                            |
| `test/fixtures` | Small projects the unit tests run against.                                    |
| `test/packed`   | The packed-install test.                                                      |
| `examples/demo` | The demo Storybook: showcase, end-to-end test and the live site's source.     |
| `docs`          | Reference and mutation-check docs.                                            |

## Things that bite

- The runner finds its own files with `sibling()` by extension, so they resolve as `.ts` in this repo and as
  `.js` once built. Keep that working when you add a runner entry, and add it to `tsdown.config.ts`.
- `prepack` builds with `--logLevel error`: any build output would break `npm pack --json`, which the packed
  test reads.
- `./storybook` imports `virtual:zucchini/contracts`, which only exists inside Vite. Don't import it from Node
  code or tests.
- `src/view/describeRuns.ts` runs in the browser inside the doc blocks, so it imports nothing.
- Playwright's mobile emulation sends mouse events along with a tap, so a contract can't tell hover from tap.

## Releases

See [RELEASING.md](RELEASING.md). "Version packages" pull requests are opened by hand with
`npm run version-packages`, because the organization doesn't let workflows open pull requests.
