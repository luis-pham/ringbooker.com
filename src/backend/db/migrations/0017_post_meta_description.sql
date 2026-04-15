-- Optional SEO meta description per CMS post (Next.js blog detail + metadata + JSON-LD).
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
