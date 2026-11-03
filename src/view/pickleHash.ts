// A short content hash of a pickle as it ran, so the spec view can tell a result recorded for an older
// version of a scenario (same name, edited steps or Examples values) from a current one. The view computes it
// in Node and the runner in the browser, so it uses only Web Crypto and TextEncoder, which both have.

/** What the hash covers. */
export interface PickleContent {
  /** Cucumber's pickle name: the scenario's name, with an outline row's values in its `<placeholders>`. */
  name: string
  /**
   * Every step the pickle runs, in order, Background steps first: the keyword as written (`Given`, `And`...,
   * without surrounding spaces) and the text with the row's values filled in. Doc strings and data tables are
   * not covered.
   */
  steps: readonly { keyword: string; text: string }[]
  /** The Examples row's cells, in column order; empty for a plain scenario. */
  values: readonly string[]
}

export const PICKLE_HASH_LENGTH = 12

/**
 * The first 12 hex digits of the SHA-256 of the UTF-8 JSON `[name, [[keyword, text], ...], [value, ...]]`,
 * e.g. `["Shows 3 on Default",[["Then","the badge shows \"3\""]],["Default","3"]]`.
 */
export const pickleHash = async ({ name, steps, values }: PickleContent): Promise<string> => {
  const input = JSON.stringify([name, steps.map((step) => [step.keyword, step.text]), values])
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, PICKLE_HASH_LENGTH)
}
