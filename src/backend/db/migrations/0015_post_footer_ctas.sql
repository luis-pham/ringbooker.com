-- Optional CTA buttons shown at end of blog article (JSON array of { templateId, href }).
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "footerCtas" JSONB;
