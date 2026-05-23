import type { ReactNode } from 'react';

type VerticalHeroGridProps = {
  copy: ReactNode;
  copyAfter?: ReactNode;
  phone: ReactNode;
};

/** Phone size is controlled purely by CSS aspect-ratio (9/20) + max-width on .cp-frame.
 *  No JS height calculation needed — always renders as portrait regardless of copy length. */
export function VerticalHeroGrid({ copy, copyAfter, phone }: VerticalHeroGridProps) {
  return (
    <section className="vertical-hero-grid mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_300px] lg:items-start">
      <div>
        <div className="vertical-hero-copy">
          {copy}
        </div>
        {copyAfter}
      </div>
      <div className="vertical-hero-visual hidden lg:block">
        {phone}
      </div>
    </section>
  );
}
