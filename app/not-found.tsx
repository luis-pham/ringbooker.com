import Link from 'next/link';

/** Root not-found — avoids Next.js collect-page-data failures when this route is implicit-only. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-6 px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Page not found</h1>
      <p className="text-gray-600">The page you are looking for does not exist or has been moved.</p>
      <Link href="/" className="font-semibold text-violet-700 underline-offset-2 hover:underline">
        Back to home
      </Link>
    </main>
  );
}
