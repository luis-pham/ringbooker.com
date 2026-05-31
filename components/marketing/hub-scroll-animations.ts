/** Scroll-reveal animations for solution / content hub pages (mirrors vertical landing effects). */
const STYLE_ID = 'hub-scroll-animations-styles';
const THRESHOLD = 0.15;

type StaggerVariant = 'up' | 'left' | 'fade';

const PRE: Record<StaggerVariant, string> = {
  up: 'hub-anim-up-pre',
  left: 'hub-anim-left-pre',
  fade: 'hub-anim-fade-pre',
};

const IN: Record<StaggerVariant, string> = {
  up: 'hub-anim-up-in',
  left: 'hub-anim-left-in',
  fade: 'hub-anim-fade-in',
};

function staggerDelay(variant: StaggerVariant, index: number): number {
  if (variant === 'left') return index * 250;
  if (variant === 'fade') return (index + 1) * 120;
  return index * 120;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = [
    '@keyframes hub-anim-blob-float{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-12px)}}',
    '.hub-anim-blob-float{animation:hub-anim-blob-float 7s ease-in-out infinite;will-change:transform}',
    '.hub-anim-blob-float--alt{animation-delay:-3.5s}',
    '.hub-anim-up-pre{opacity:0;transform:translateY(20px);transition:opacity 450ms ease-out,transform 450ms ease-out}',
    '.hub-anim-up-in{opacity:1;transform:translateY(0)}',
    '.hub-anim-left-pre{opacity:0;transform:translateX(-16px);transition:opacity 500ms ease-out,transform 500ms ease-out}',
    '.hub-anim-left-in{opacity:1;transform:translateX(0)}',
    '.hub-anim-fade-pre{opacity:0;transition:opacity 400ms ease-out}',
    '.hub-anim-fade-in{opacity:1}',
  ].join('');
  document.head.appendChild(style);
}

function observeOnce(target: Element, onEnter: (el: Element) => void): () => void {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        onEnter(entry.target);
      });
    },
    { threshold: THRESHOLD },
  );
  observer.observe(target);
  return () => observer.disconnect();
}

function bindStaggerGrid(grid: Element): () => void {
  const variant = (grid.getAttribute('data-hub-stagger') || 'up') as StaggerVariant;
  const pre = PRE[variant] ?? PRE.up;
  const inn = IN[variant] ?? IN.up;
  const items = Array.from(grid.querySelectorAll('[data-hub-stagger-item]'));
  if (!items.length) return () => {};

  items.forEach((item) => item.classList.add(pre));
  return observeOnce(grid, () => {
    items.forEach((item, index) => {
      window.setTimeout(() => item.classList.add(inn), staggerDelay(variant, index));
    });
  });
}

function parseStatValue(raw: string): { count: number; suffix: string; prefix: string } | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^([^0-9]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  const count = Number.parseFloat(match[2] ?? '');
  if (!Number.isFinite(count)) return null;
  return { prefix: match[1] ?? '', count, suffix: match[3] ?? '' };
}

function animateCounter(el: HTMLElement, target: number, prefix: string, suffix: string, delay: number): void {
  const duration = 1200;
  window.setTimeout(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const value = Math.round(easeOutExpo(t) * target);
      el.textContent = `${prefix}${value}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, delay);
}

function bindStatStrip(strip: Element): () => void {
  const values = Array.from(strip.querySelectorAll<HTMLElement>('[data-hub-stat-value]'));
  const parsed = values.map((el) => {
    const raw = el.getAttribute('data-hub-stat-value') || el.textContent || '';
    const spec = parseStatValue(raw);
    if (spec) {
      el.textContent = `${spec.prefix}0${spec.suffix}`;
    }
    return { el, spec };
  });

  return observeOnce(strip, () => {
    parsed.forEach(({ el, spec }, index) => {
      if (!spec) return;
      animateCounter(el, spec.count, spec.prefix, spec.suffix, index * 120);
    });
  });
}

export function initHubScrollAnimations(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  if (!('IntersectionObserver' in window)) return () => {};

  injectStyles();

  const cleanups: Array<() => void> = [];

  document.querySelectorAll('[data-hub-stagger-grid]').forEach((grid) => {
    cleanups.push(bindStaggerGrid(grid));
  });

  document.querySelectorAll('[data-hub-stat-strip]').forEach((strip) => {
    cleanups.push(bindStatStrip(strip));
  });

  document.querySelectorAll('.html-hub-page .hero-blob-1').forEach((el) => {
    el.classList.add('hub-anim-blob-float');
  });
  document.querySelectorAll('.html-hub-page .hero-blob-2').forEach((el) => {
    el.classList.add('hub-anim-blob-float', 'hub-anim-blob-float--alt');
  });

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
