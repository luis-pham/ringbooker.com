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
      const ratio = articleHeight > 0 ? (scrolled / articleHeight) * 100 : 0;
      const next = Math.min(Math.max(ratio, 0), 100);
      setProgress(next);
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
    <div className="fixed left-0 right-0 top-[68px] z-40 h-[3px] bg-gray-200">
      <div
        className="h-full rounded-r-sm bg-brand-purple transition-[width] duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
