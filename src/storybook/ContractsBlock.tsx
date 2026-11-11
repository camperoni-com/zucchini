// A docs block showing the contracts of the component whose docs page it is on.
import { Unstyled, useOf } from '@storybook/addon-docs/blocks'

import { ContractSpec } from './ContractSpec.tsx'
import { spec } from './specModule.ts'
import { SPEC_CSS } from './styles.ts'

export const ContractsBlock = () => {
  const { preparedMeta } = useOf('meta', ['meta'])
  const contract = spec.contracts.find((c) => c.title === preparedMeta.title)
  return (
    <Unstyled>
      <style>{SPEC_CSS}</style>
      <section className="ls" data-testid="zucchini-contracts">
        {contract ? (
          <ContractSpec contract={contract} />
        ) : (
          <p className="ls-note">No contract for this component yet.</p>
        )}
      </section>
    </Unstyled>
  )
}
