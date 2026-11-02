// The spec view's styles, scoped under .ls so they neither leak into nor pick up the docs page's.
export const SPEC_CSS = `
.ls { --ls-ink: #1b2422; --ls-muted: #5b6864; --ls-line: #d9dfda; --ls-sunk: #f4f6f3; --ls-accent: #2b48b0;
  --ls-pass: #1e7a4c; --ls-pass-soft: #e3f2ea; --ls-fail: #b23a2e; --ls-fail-soft: #f8e6e3; --ls-nr: #5b6864;
  --ls-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--ls-ink); font-size: 14px; line-height: 1.5; margin: 48px 0 24px; }
.ls h2 { font-size: 22px; font-weight: 700; margin: 0 0 4px; padding-bottom: 6px; border-bottom: 1px solid var(--ls-line); }
.ls h3 { font-size: 16px; font-weight: 700; margin: 0; }
.ls a { color: var(--ls-accent); text-decoration: none; }
.ls a:hover { text-decoration: underline; }
.ls-meta { color: var(--ls-muted); margin: 8px 0 16px; }
.ls-meta code, .ls-note code { font-family: var(--ls-mono); font-size: 12px; }
.ls-note { color: var(--ls-muted); font-style: italic; margin: 32px 0 8px; }
.ls-scenario { border: 1px solid var(--ls-line); border-radius: 8px; padding: 14px 16px; margin: 0 0 14px; background: #fff; }
.ls-scenario-head { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.ls-pill { display: inline-block; font-size: 12px; font-weight: 600; padding: 1px 9px; border-radius: 999px; white-space: nowrap; }
.ls-passed { color: var(--ls-pass); background: var(--ls-pass-soft); }
.ls-failed { color: var(--ls-fail); background: var(--ls-fail-soft); }
.ls-not-run { color: var(--ls-nr); border: 1px dashed var(--ls-line); background: var(--ls-sunk); font-weight: 500; }
.ls-runs-on { margin: 6px 0 10px; color: var(--ls-muted); }
.ls-ran { color: var(--ls-muted); font-size: 12px; }
.ls-error { font-family: var(--ls-mono); font-size: 12px; color: var(--ls-fail); background: var(--ls-fail-soft); padding: 6px 8px; border-radius: 6px; margin: 6px 0; white-space: pre-wrap; }
.ls-description { margin: 4px 0 8px; white-space: pre-line; }
.ls-steps { list-style: none; margin: 0; padding: 0; }
.ls-step { padding: 2px 0; }
.ls-kw { font-weight: 700; color: var(--ls-accent); margin-right: 6px; }
.ls-value { font-family: var(--ls-mono); font-size: 12.5px; background: var(--ls-sunk); border-radius: 4px; padding: 0 3px; }
.ls-param { font-family: var(--ls-mono); font-size: 12.5px; color: var(--ls-accent); }
.ls-group { margin: 4px 0; border-left: 3px solid var(--ls-line); padding-left: 10px; }
.ls-group > summary { cursor: pointer; color: var(--ls-ink); font-weight: 600; padding: 2px 0; list-style: none; }
.ls-group > summary::-webkit-details-marker { display: none; }
.ls-group > summary::before { content: '\\25B8'; display: inline-block; width: 1.1em; color: var(--ls-muted); }
.ls-group[open] > summary::before { content: '\\25BE'; }
.ls-group > summary span { color: var(--ls-muted); font-weight: 400; }
.ls-examples { margin: 12px 0 0; overflow-x: auto; }
.ls-examples-name { font-weight: 600; margin: 0 0 4px; }
.ls-table { border-collapse: collapse; font-size: 12.5px; }
.ls-table th, .ls-table td { border: 1px solid var(--ls-line); padding: 3px 8px; text-align: left; vertical-align: top; }
.ls-table th { background: var(--ls-sunk); font-weight: 600; }
.ls-table td.ls-cell { font-family: var(--ls-mono); }
.ls-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.ls-dot.ls-passed { background: var(--ls-pass); }
.ls-dot.ls-failed { background: var(--ls-fail); }
.ls-dot.ls-not-run { background: transparent; border: 1px solid var(--ls-muted); }
.ls-overview { margin-top: 0; }
.ls-overview h2 { margin-top: 32px; }
.ls-contract { margin: 18px 0; }
.ls-contract-head { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.ls-scenario-list { margin: 6px 0 0; padding-left: 20px; }
.ls-scenario-list li { margin: 2px 0; }
`
