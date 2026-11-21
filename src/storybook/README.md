# storybook

## Overview

The Storybook side of the living spec: the doc blocks that show each component's contracts on its docs page,
an overview page of every contract, and the Vite plugin that gives them their data. The plugin builds the spec
data in Node with `buildSpecData` from [`../view`](../view/README.md) and serves it as the virtual module
`virtual:zucchini/contracts`. The components import that module and render it in the browser.

This directory backs two package entries:

- `@camperoni/zucchini/storybook` is built from `index.ts`.
- `@camperoni/zucchini/vite` is built from `vitePlugin.ts`.

Both are set in `tsdown.config.ts` and the `exports` of `package.json`.

## Interface

- `ContractsDocsPage` (`ContractsDocsPage.tsx`, exported from `index.ts`): takes no props. Renders Storybook's
  `<DocsPage />` followed by the component's contracts. Set it as the global `parameters.docs.page` in the
  project's Storybook preview. The contracts are wrapped in an element with `data-testid="zucchini-contracts"`.
- `ContractsOverview` (`ContractsOverview.tsx`, exported from `index.ts`): takes no props. Lists every contract
  with its status, a link to its docs page, its file and its scenarios, then "Stories without a contract". Put
  it on an MDX page the project owns, for example under `<Meta title="Living Spec/Contracts" />`. Its root has
  `data-testid="zucchini-overview"`.
- `zucchiniPlugin({ root?, dir?, results? }) => Plugin` (`vitePlugin.ts`, the `./vite` entry): the Vite plugin,
  named `zucchini`. `root` defaults to `process.cwd()`. `dir` and `results` are relative to `root` and override
  the config's `contracts` and `results`.
- `SPEC_MODULE_ID` (`vitePlugin.ts`): `'virtual:zucchini/contracts'`.
- Internal, not exported from the package:
  - `ContractsBlock` (`ContractsBlock.tsx`): picks the contract for the current docs page.
  - `ContractSpec` and `StatusPill` (`ContractSpec.tsx`): render one contract and a status label.
  - `storyHref`, `docsHref`, `STATUS_LABEL`, `formatTime` and `plural` (`links.ts`).
  - `spec` (`specModule.ts`): the virtual module's data, typed as `SpecData`.
  - `SPEC_CSS` (`styles.ts`).
  - The ambient declaration of `virtual:zucchini/contracts` (`virtual.d.ts`).

## Invariants

- The `./storybook` entry imports `virtual:zucchini/contracts` (through `specModule.ts`), which exists only
  inside a Vite build that has `zucchiniPlugin` installed. The build leaves it unbundled
  (`deps.neverBundle` in `tsdown.config.ts`). Don't import this entry, or anything that imports
  `specModule.ts`, from Node code or tests.
- `vitePlugin.ts` runs only in Node. It uses the `resolveId` and `load` hooks and `addWatchFile`, to stay
  compatible across Vite versions. It resolves only `virtual:zucchini/contracts` (to
  `\0virtual:zucchini/contracts`) and loads only that id.
- The virtual module is `export default <JSON of SpecData>`, so the spec data must stay JSON-serializable.
  `specModule.ts` casts it to `SpecData` without checking it at runtime.
- Explicit plugin options win over the config loaded by `loadConfig(root)` (`../config/load.ts`).
- `ContractsBlock` must render inside a Storybook docs context with meta (`useOf('meta', ['meta'])`). It finds
  the contract whose `title` equals the meta's `title` exactly, and otherwise shows "No contract for this
  component yet.".
- Links are relative to the Storybook manager (`./?path=/story/<id>`, `./?path=/docs/<componentId>--docs`)
  and open with `target="_top"`, because docs render inside the preview iframe. A contract without a
  `componentId` gets no docs link.
- In an Examples table, a cell links to its story only in the column headed `story`, and only when the row has
  a story.
- Every style in `SPEC_CSS` is scoped under `.ls` / `.ls-*`, and the components render inside `<Unstyled>`, so
  the spec and the docs page don't restyle each other.
- `react`, `storybook` and `@storybook/addon-docs` are peer dependencies.

## Side Effects

- When Vite loads the virtual module, the plugin loads the project config, which may dynamically import
  `zucchini.config.ts` or `zucchini.config.mts` from `root`. It then calls `buildSpecData`, which globs and
  reads the `.feature` and story files under `dir` and reads the results file if one exists.
- The plugin calls `this.addWatchFile` for every file `buildSpecData` reports, so editing a contract, a story
  file or the results reloads the module in dev.
- `ContractsBlock` and `ContractsOverview` render an inline `<style>` with `SPEC_CSS` each time they render.
- Story and docs links navigate the top-level Storybook window.

## Verification

- Run: `npm test` (unit tests in `vitePlugin.spec.ts`)
- In a real Storybook: run `npm run demo:install`, then `npm run build-storybook` in `examples/demo`. The
  demo's `.storybook/main.ts` installs `zucchiniPlugin()`, and its `.storybook/preview.ts` uses
  `ContractsDocsPage`.
