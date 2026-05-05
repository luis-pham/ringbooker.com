-- Optional CMS headline for browser `<title>` / social title (prefix before cluster suffix).
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "seo_title" TEXT;
