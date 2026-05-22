import type { ReactNode } from 'react';

/** Section H2 — line 1 + italic accent + optional line 2 (matches marketing-home `.sec-title em`).
 * 2-arg: breaks before accent so long titles always render on 2 rows.
 * 3-arg: accent stays on line 1, `after` wraps to line 2 (original behavior). */
export function mkSectionTitle(before: string, accent: string, after?: string): ReactNode {
  return (
    <>
      {before}
      {after !== undefined ? ' ' : <br />}
      <em>{accent}</em>
      {after !== undefined ? (
        <>
          <br />
          {after}
        </>
      ) : null}
    </>
  );
}
