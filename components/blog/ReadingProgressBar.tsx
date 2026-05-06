'use client';

import { useEffect, useState } from 'react';

export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const article = document.querySelector<HTMLElement>('.article-body');
      if (!article) {
        setProgress(0);
        return;
      }
      const articleTop = article.getBoundingClientRect().top + window.scrollY;
      const articleHeight = article.offsetHeight;
      const scrolled = window.scrollY - articleTop + window.innerHeight * 0.6;
      const pct = Math.min(Math.max((scrolled / Math.max(articleHeight, 1)) * 100, 0), 100);
      setProgress(pct);
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, []);

  return (
    <div className="fixed left-0 right-0 top-[68px] z-[99] h-[1px] bg-gray-200">
      <div className="h-full rounded-r-sm bg-brand-purple transition-[width] duration-100 ease-linear" style={{ width: `${progress}%` }} />
    </div>
  );
}
