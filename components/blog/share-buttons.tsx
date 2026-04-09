'use client';

import { useMemo, useState } from 'react';

export function ShareButtons() {
  const [copied, setCopied] = useState(false);

  const urls = useMemo(() => {
    if (typeof window === 'undefined') return { twitter: '#', linkedin: '#', current: '' };
    const current = window.location.href;
    const encoded = encodeURIComponent(current);
    return {
      twitter: `https://twitter.com/intent/tweet?url=${encoded}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
      current,
    };
  }, []);

  const copyLink = async () => {
    try {
      if (!urls.current) return;
      await navigator.clipboard.writeText(urls.current);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <a
        href={urls.twitter}
        target="_blank"
        rel="noreferrer"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-gray-200 bg-gray-50 transition hover:border-brand-purple hover:bg-violet-50"
        aria-label="Share on Twitter"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-gray-500 hover:fill-brand-purple">
          <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
        </svg>
      </a>

      <a
        href={urls.linkedin}
        target="_blank"
        rel="noreferrer"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-gray-200 bg-gray-50 transition hover:border-brand-purple hover:bg-violet-50"
        aria-label="Share on LinkedIn"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-gray-500 hover:fill-brand-purple">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </a>

      <button
        type="button"
        onClick={copyLink}
        className="flex h-[34px] min-w-[34px] items-center justify-center rounded-[10px] border border-gray-200 bg-gray-50 px-2 transition hover:border-brand-purple hover:bg-violet-50"
        aria-label="Copy link"
      >
        {copied ? (
          <span className="text-[11px] font-semibold text-brand-purple">Copied</span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-gray-500 hover:fill-brand-purple">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
          </svg>
        )}
      </button>
    </div>
  );
}
