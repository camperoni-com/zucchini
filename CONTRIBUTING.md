# Contributing to Zucchini

Thanks for helping. Issues and pull requests are welcome.

## Sign off your commits (DCO)

Zucchini uses the [Developer Certificate of Origin](https://developercertificate.org/) instead of a contributor
license agreement. By signing off a commit, you certify that you wrote it, or otherwise have the right to submit
it under the project's MIT license.

Sign off with `-s`:

```sh
git commit -s -m "fix: what changed"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line, which must match the commit's author. A check on
every pull request looks for it. If you forgot, sign off the commits already on your branch and push again:

```sh
git rebase --signoff main
git push --force-with-lease
```

## Set up

Zucchini needs Node 22.12 or later (Node 24 is what CI uses).

```sh
npm ci
```

## Check your change

| Command               | What it checks                                                                  |
| --------------------- | ------------------------------------------------------------------------------- |
| `npm test`            | The unit tests.                                                                 |
| `npm run typecheck`   | TypeScript.                                                                     |
| `npm run lint`        | ESLint and Prettier.                                                            |
| `npm run test:packed` | Packs the package, installs it into a throwaway project and uses it from there. |

### The demo

`examples/demo` is a small Storybook whose components carry their contracts. It installs Zucchini from a packed
tarball, the way a user gets it from npm, so it's also Zucchini's end-to-end test:

```sh
npm run demo:install          # pack Zucchini and install it into the demo
cd examples/demo
npx playwright install chromium
npm run contracts -- --browser chromium   # desktop and mobile
npm run mutation              # the deliberate breaks (experimental)
npm run storybook             # see the living spec at http://localhost:6006
```

Run `npm run demo:install` again after changing Zucchini's code. CI runs the demo's contracts on Chromium,
Firefox and WebKit, and its breaks on Chromium.

## Add a changeset

If your change affects what users get, add a changeset:

```sh
npx changeset
```

Pick the bump and write a sentence or two for the changelog. Before 1.0, a breaking change is a `minor` bump and
everything else a `patch`. Changes to tests, CI or docs alone don't need one.

## Releases

See [RELEASING.md](RELEASING.md).
