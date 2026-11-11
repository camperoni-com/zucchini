# The mutation check (experimental)

> **Experimental.** The command, its options and the breaks file format may still change before 1.0. Changes
> will be in the changelog.

A passing contract only shows that it didn't fail. It doesn't show that it _could_ fail. A scenario can pass for
nothing: it checks the wrong element, a `contains` also matches the broken text, or the story's data never
reaches the case. The mutation check finds those contracts.

You list realistic bugs in a breaks file. For each one, `zucchini mutation` puts the bug in, runs the contracts
it concerns, and puts the file back. A break that made its contracts fail is **caught**. One that left them
passing is **missed**: a blind spot in your contracts.

Unlike a mutation-testing tool that generates thousands of random changes, the breaks are few and chosen by
you: the bugs you'd actually worry about, a handful per component.

## Running it

```sh
npx zucchini mutation --config vitest.zucchini.config.ts --breaks zucchini.breaks.ts
```

| Option              | Default     | What it does                                                         |
| ------------------- | ----------- | -------------------------------------------------------------------- |
| `--config <file>`   | required    | The Vitest config with the contract projects (`zucchiniProjects()`). |
| `--breaks <module>` | required    | The breaks file: a module exporting `breaks`.                        |
| `--browser <names>` | `chromium`  | `chromium`, `firefox`, `webkit`, comma-separated.                    |
| `--device <names>`  | `desktop`   | `desktop`, `mobile`, or both: `desktop,mobile`.                      |
| `--break <name>`    | every break | Runs only this break. Repeat it for several.                         |

It prints one line per break, caught or missed, and exits 1 when any break was missed, didn't run, or couldn't
be applied (its `find` text is no longer in the file). Run it on the devices your breaks need: a bug that only
shows on mobile is only caught with `--device mobile`.

Every break is reverted after its run, also when the run fails or you press Ctrl-C. The results file is put back
as it was, so a mutation run doesn't change what the living spec shows.

## The breaks file

A TypeScript (or JavaScript) module that exports `breaks`, an array of `Break`:

```ts
// zucchini.breaks.ts
import type { Break } from '@camperoni/zucchini'

export const breaks: Break[] = [
  // A contract break: the contract expects something the component doesn't do.
  {
    name: 'contract-badge-count',
    checks: 'the exact-value check reads the count',
    file: 'src/Badge/Badge.feature',
    find: 'has an exact value of "3"',
    replace: 'has an exact value of "4"',
  },
  // A code break: a realistic bug in the component.
  {
    name: 'code-badge-link-not-a-link',
    checks: 'a badge with a link renders as plain text',
    file: 'src/Badge/Badge.tsx',
    find: 'return href ? (',
    replace: 'return false ? (',
    contracts: ['src/Badge/Badge.feature'],
  },
]
```

| Field       | Required        | Meaning                                                                                   |
| ----------- | --------------- | ----------------------------------------------------------------------------------------- |
| `name`      | yes             | Short and unique. The report uses it, and `--break` picks it.                             |
| `checks`    | yes             | What it shows the contracts catch, in a few words.                                        |
| `file`      | yes             | The file to change, relative to the project root.                                         |
| `find`      | yes             | Text in that file. Its first occurrence is replaced.                                      |
| `replace`   | yes             | What it becomes.                                                                          |
| `contracts` | for code breaks | The feature files that should catch a code break.                                         |
| `devices`   | no              | For a contract break in a `@desktop` or `@mobile` Examples block: the devices it runs on. |

There are two kinds of break, told apart by the file:

- **A contract break** changes a `.feature` file, usually one expectation. The scenario (or Examples row) with
  that line must fail. It proves the steps really check what they claim.
- **A code break** changes anything else: the code a story renders. At least one scenario of its `contracts`
  must fail, on any browser and device the run covers. It proves the contracts would catch that regression.

Pick `find` text that occurs once, or make sure its first occurrence is the one you mean. A missed break is
worth a look before you fix it: sometimes the contract needs a sharper check, sometimes the story needs data
that reaches the case, and sometimes the break isn't a bug the contract can see at all. The demo's breaks file
has an example of that last kind, written down as a comment instead of a break.

## In CI

Zucchini's own CI runs the demo's breaks on every PR, on Chromium desktop and mobile, and a missed break fails
the build. In your project you can do the same, or run it by hand when you change a contract or a component.
