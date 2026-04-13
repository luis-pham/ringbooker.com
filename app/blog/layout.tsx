/**
 * Wraps `/blog` and `/blog/[slug]` so `revalidatePath('/blog', 'layout')` invalidates
 * the list and every post page (e.g. after delete, related / Keep Reading updates).
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
