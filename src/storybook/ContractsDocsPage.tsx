// Storybook's default autodocs page followed by the component's contracts. Set it as the global
// `parameters.docs.page` in the project's preview, so no story file changes.
import { DocsPage } from '@storybook/addon-docs/blocks'

import { ContractsBlock } from './ContractsBlock.tsx'

export const ContractsDocsPage = () => (
  <>
    <DocsPage />
    <ContractsBlock />
  </>
)
