// The step catalog: every step a contract can use, as JSON for agents and tools and as Markdown for people.
// It is generated from the step definitions themselves, so it can't drift from the code.
import { compileSteps } from '../steps/expressions.ts'
import type { Discouraged, StepDefinition, StepKeyword } from '../steps/types.ts'

export type StepSource = 'library' | 'project'

export interface CatalogEntry {
  keyword: StepKeyword
  wording: string
  parameters: string[]
  meaning: string
  example: string
  source: StepSource
  /** Only on steps to avoid. */
  discouraged?: Discouraged
}

export interface Catalog {
  /** The command that regenerates the catalog. */
  generatedBy: string
  steps: CatalogEntry[]
}

export const buildCatalog = ({
  library,
  project = [],
  generatedBy,
}: {
  library: readonly StepDefinition[]
  project?: readonly StepDefinition[]
  generatedBy: string
}): Catalog => {
  const sourced = [
    ...library.map((step) => ({ ...step, source: 'library' as const })),
    ...project.map((step) => ({ ...step, source: 'project' as const })),
  ]
  return {
    generatedBy,
    steps: compileSteps(sourced).map(({ step, parameterTypes, matches }) => {
      if (!matches(step.example)) {
        throw new Error(`The example of "${step.wording}" doesn't match its wording: "${step.example}"`)
      }
      return {
        keyword: step.keyword,
        wording: step.wording,
        parameters: parameterTypes,
        meaning: step.meaning,
        example: step.example,
        source: step.source,
        ...(step.discouraged ? { discouraged: step.discouraged } : {}),
      }
    }),
  }
}

export const catalogToJson = (catalog: Catalog) => `${JSON.stringify(catalog, null, 2)}\n`

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

/** "Reason. Use X instead.", the way the catalog and the linter put it. */
export const discouragedText = ({ reason, instead }: Discouraged) =>
  instead ? `${reason} Use ${instead} instead.` : reason

export const catalogToMarkdown = (catalog: Catalog) => {
  const library = catalog.steps.filter((step) => step.source === 'library')
  const project = catalog.steps.filter((step) => step.source === 'project')
  const section = (title: string, steps: CatalogEntry[]) => [
    `## ${title}`,
    '',
    ...(steps.length ? [] : ['None.', '']),
    ...steps.flatMap((step) => [
      `### ${step.keyword} ${step.wording}`,
      '',
      step.meaning,
      '',
      ...(step.discouraged ? [`**Discouraged:** ${discouragedText(step.discouraged)}`, ''] : []),
      `- Parameters: ${step.parameters.length ? step.parameters.map((p) => `\`${p}\``).join(', ') : 'none'}`,
      `- Example: \`${step.keyword} ${step.example}\``,
      '',
    ]),
  ]
  return [
    '# Step catalog',
    '',
    `Every step a contract can use. Generated from the step definitions by \`${catalog.generatedBy}\`; don't edit it by hand.`,
    '',
    `${count(catalog.steps.length, 'step')}: ${library.length} from the library, ${project.length} from the project.`,
    '',
    ...section('Library steps', library),
    ...section('Project steps', project),
  ]
    .join('\n')
    .replace(/\n+$/, '\n')
}
