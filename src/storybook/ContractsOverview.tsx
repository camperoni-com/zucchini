// The overview page: every component's contracts with their status, then the stories without a contract.
import { Unstyled } from '@storybook/addon-docs/blocks'

import { StatusPill } from './ContractSpec.tsx'
import { docsHref, formatTime, plural, storyHref } from './links.ts'
import { spec } from './specModule.ts'
import { SPEC_CSS } from './styles.ts'

const DocsLink = ({ title, componentId }: { title: string; componentId?: string }) =>
  componentId ? (
    <a href={docsHref(componentId)} target="_top">
      {title}
    </a>
  ) : (
    <>{title}</>
  )

export const ContractsOverview = () => {
  const scenarios = spec.contracts.flatMap((c) => c.scenarios)
  const uncovered = spec.uncovered.reduce((n, s) => n + s.stories.length, 0)
  return (
    <Unstyled>
      <style>{SPEC_CSS}</style>
      <section className="ls ls-overview" data-testid="zucchini-overview">
        <p className="ls-meta">
          {plural(spec.contracts.length, 'component')} with a contract, {plural(scenarios.length, 'scenario')}.{' '}
          {spec.ranAt ? `Results from ${formatTime(spec.ranAt)}.` : 'The contracts have not run yet.'}
        </p>
        <h2>Contracts</h2>
        {spec.contracts.map((contract) => (
          <div key={contract.file} className="ls-contract">
            <div className="ls-contract-head">
              <StatusPill status={contract.status} />
              <h3>
                <DocsLink title={contract.title || contract.name} componentId={contract.componentId} />
              </h3>
              <code className="ls-ran">{contract.file}</code>
            </div>
            <ul className="ls-scenario-list">
              {contract.scenarios.map((scenario) => (
                <li key={scenario.line}>
                  <span className={`ls-dot ls-${scenario.status}`} /> {scenario.name}{' '}
                  <span className="ls-ran">({plural(scenario.stories.length, 'story', 'stories')})</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <h2>Stories without a contract</h2>
        <p className="ls-meta">
          {plural(uncovered, 'story', 'stories')} with no contract: they render in Storybook, but nothing checks them.
        </p>
        {spec.uncovered.map((file) => (
          <div key={file.title} className="ls-contract">
            <h3>
              <DocsLink title={file.title} componentId={file.componentId} />
            </h3>
            <ul className="ls-scenario-list">
              {file.stories.map((story) => (
                <li key={story.id}>
                  <a href={storyHref(story.id)} target="_top">
                    {story.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </Unstyled>
  )
}
