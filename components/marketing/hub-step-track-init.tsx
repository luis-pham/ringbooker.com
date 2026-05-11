'use client';

import { useEffect } from 'react';

/**
 * Binds hub `step_track` mobile pill tabs + horizontal card scroller (works-with, trust, …).
 * Client effect so listeners attach after App Router client navigations (inline scripts do not re-run).
 */
export function HubStepTrackInit() {
  useEffect(() => {
    const wrappers = document.querySelectorAll('.step-track-mobile-nav');
    const cleanups: Array<() => void> = [];

    wrappers.forEach((nav) => {
      const root = nav.parentElement;
      if (!root) return;
      const buttons = Array.from(nav.querySelectorAll('[data-step-nav-btn]')) as HTMLAnchorElement[];
      const scroller = root.querySelector('[data-step-scroller]') as HTMLElement | null;
      const cards = scroller
        ? (Array.from(scroller.querySelectorAll('[data-step-card]')) as HTMLElement[])
        : [];
      if (!scroller || buttons.length === 0 || cards.length === 0) return;

      const setActive = (idx: number) => {
        buttons.forEach((btn, i) => btn.classList.toggle('is-active', i === idx));
      };

      const updateActiveByScroll = () => {
        const scrollerRect = scroller.getBoundingClientRect();
        const mid = scrollerRect.left + scrollerRect.width / 2;
        let bestIdx = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        cards.forEach((card, i) => {
          const r = card.getBoundingClientRect();
          const c = r.left + r.width / 2;
          const dist = Math.abs(c - mid);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        });
        setActive(bestIdx);
      };

      const clickHandlers: Array<(e: Event) => void> = [];
      buttons.forEach((btn, i) => {
        const handler = (e: Event) => {
          e.preventDefault();
          const card = cards[i];
          if (!card) return;
          const scrollerRect = scroller.getBoundingClientRect();
          const cardRect = card.getBoundingClientRect();
          const delta =
            cardRect.left + cardRect.width / 2 - (scrollerRect.left + scrollerRect.width / 2);
          scroller.scrollBy({ left: delta, behavior: 'smooth' });
          setActive(i);
        };
        btn.addEventListener('click', handler);
        clickHandlers.push(handler);
      });

      let raf = 0;
      const onScroll = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(updateActiveByScroll);
      };
      scroller.addEventListener('scroll', onScroll, { passive: true });

      const onResize = () => updateActiveByScroll();
      window.addEventListener('resize', onResize, { passive: true });

      requestAnimationFrame(() => updateActiveByScroll());

      cleanups.push(() => {
        if (raf) cancelAnimationFrame(raf);
        scroller.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        buttons.forEach((btn, i) => {
          const h = clickHandlers[i];
          if (h) btn.removeEventListener('click', h);
        });
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
