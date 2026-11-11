// Renders one contract's view model: its scenarios, step groups, bound stories and statuses.
import type { ReactNode } from 'react'

import { describeRuns } from '../view/describeRuns.ts'
import type { ContractView, ExamplesView, ScenarioView, Status, StepView } from '../view/viewModel.ts'
import { formatTime, plural, STATUS_LABEL, storyHref } from './links.ts'

export const StatusPill = ({ status }: { status: Status }) => (
  <span className={`ls-pill ls-${status}`}>{STATUS_LABEL[status]}</span>
)

// Quoted values and <placeholders> stand out from the step's words.
const StepText = ({ text }: { text: string }) => (
  <>
    {text.split(/("[^"]*"|<[^>]+>)/).map((part, i): ReactNode => {
      if (/^<[^>]+>$/.test(part)) {
        return (
          <span key={i} className="ls-param">
            {part}
          </span>
        )
      }
      if (/^"[^"]*"$/.test(part)) {
        return (
          <span key={i} className="ls-value">
            {part}
          </span>
        )
      }
      return part
    })}
  </>
)

const failedOn = (browsers: readonly string[]) => `Failed on ${browsers.join(', ')}`

const Steps = ({ steps }: { steps: StepView[] }) => (
  <ol className="ls-steps">
    {steps.map((step) => (
      <li key={step.line} className="ls-step">
        <span className="ls-kw">{step.keyword}</span>
        <StepText text={step.text} />
      </li>
    ))}
  </ol>
)

const Examples = ({ examples }: { examples: ExamplesView }) => (
  <div className="ls-examples">
    <p className="ls-examples-name">Examples{examples.name ? `: ${examples.name}` : ''}</p>
    <table className="ls-table">
      <thead>
        <tr>
          <th aria-label="Result" />
          {examples.header.map((cell, c) => (
            <th key={c}>{cell}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {examples.rows.map((row) => (
          <tr key={row.line}>
            <td title={row.failedOn.length ? failedOn(row.failedOn) : STATUS_LABEL[row.status]}>
              <span className={`ls-dot ls-${row.status}`} />
              {row.failedOn.length ? <span className="ls-browsers">{row.failedOn.join(', ')}</span> : null}
              {row.status === 'changed' ? <span className="ls-row-changed">changed since last run</span> : null}
            </td>
            {row.cells.map((cell, c) => (
              <td key={c} className="ls-cell">
                {row.story && examples.header[c] === 'story' ? (
                  <a href={storyHref(row.story.id)} target="_top">
                    {cell}
                  </a>
                ) : (
                  cell
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const Scenario = ({ scenario }: { scenario: ScenarioView }) => (
  <article className="ls-scenario">
    <div className="ls-scenario-head">
      <StatusPill status={scenario.status} />
      <h3>{scenario.name}</h3>
      {scenario.ranAt ? (
        <span className="ls-ran">
          last run {formatTime(scenario.ranAt)}
          {scenario.ranOn.length ? ` in ${describeRuns(scenario.ranOn)}` : null}
        </span>
      ) : null}
    </div>
    {scenario.description ? <p className="ls-description">{scenario.description}</p> : null}
    <p className="ls-runs-on">
      Runs on{' '}
      {scenario.stories.length
        ? scenario.stories.map((story, i) => (
            <span key={story.id}>
              {i ? ', ' : ''}
              <a href={storyHref(story.id)} target="_top">
                {story.name}
              </a>
            </span>
          ))
        : 'no story'}
    </p>
    {scenario.failedOn.length ? <p className="ls-failed-on">{failedOn(scenario.failedOn)}</p> : null}
    {scenario.error ? <pre className="ls-error">{scenario.error}</pre> : null}
    {scenario.groups.map((group, i) =>
      group.title ? (
        <details key={i} className="ls-group">
          <summary>
            {group.title} <span>({plural(group.steps.length, 'step')})</span>
          </summary>
          <Steps steps={group.steps} />
        </details>
      ) : (
        <Steps key={i} steps={group.steps} />
      )
    )}
    {scenario.examples.map((examples, i) => (
      <Examples key={i} examples={examples} />
    ))}
  </article>
)

export const ContractSpec = ({ contract }: { contract: ContractView }) => (
  <>
    <h2>Contracts</h2>
    <p className="ls-meta">
      {plural(contract.scenarios.length, 'scenario')} in <code>{contract.file}</code>
    </p>
    {contract.scenarios.map((scenario) => (
      <Scenario key={scenario.line} scenario={scenario} />
    ))}
  </>
)
