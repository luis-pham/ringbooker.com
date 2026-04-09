import Link from 'next/link';

import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';

export default function BlogNotFoundPage() {
  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader />
      <main className="min-h-[70vh] bg-white px-6 pb-16 pt-36 md:px-12">
        <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-gray-50 p-10 text-center">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-purple">404</div>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-gray-900">Article not found</h1>
          <p className="mx-auto mb-8 max-w-xl text-gray-500">
            The blog article you requested does not exist or is no longer published.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/blog" className="rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white">
              Back to Blog
            </Link>
            <Link href="/demo" className="rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700">
              Try Live Demo
            </Link>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
