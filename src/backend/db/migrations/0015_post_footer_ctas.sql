-- Optional end-of-article CTAs (JSON array; see lib/blog/footer-cta-templates.ts for shape).
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "footerCtas" JSONB;
