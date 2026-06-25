import type { ReactNode } from 'react';

/** Section H2 — short line 1 + longer line 2 with accent (matches marketing-home `.sec-title em`).
 * 2-arg: line 1 = `before`, line 2 = `<em>accent</em>`.
 * 3-arg: line 1 = `before` only, line 2 = `<em>accent</em>` + `after`. */
export function mkSectionTitle(before: string, accent: string, after?: string, line2Before?: string): ReactNode {
  return (
    <>
      {before}
      <br />
      {line2Before ? <>{line2Before} </> : null}
      <em>{accent}</em>
      {after !== undefined ? <> {after}</> : null}
    </>
  );
}
