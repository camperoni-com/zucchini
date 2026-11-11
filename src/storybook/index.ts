// The Storybook side of the living spec:
// - ContractsDocsPage: set it as the global `parameters.docs.page` in the project's preview, so every component's
//   docs page shows its contracts after Storybook's default docs.
// - ContractsOverview: the overview of every contract, for a page of the project's own:
//
//     {/* src/Contracts.mdx */}
//     import { Meta } from '@storybook/addon-docs/blocks'
//     import { ContractsOverview } from '@camperoni/zucchini/storybook'
//
//     <Meta title="Living Spec/Contracts" />
//     <ContractsOverview />
export { ContractsDocsPage } from './ContractsDocsPage.tsx'
export { ContractsOverview } from './ContractsOverview.tsx'
