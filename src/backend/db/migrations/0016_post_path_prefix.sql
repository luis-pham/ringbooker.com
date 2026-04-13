-- Multi-path blog URLs: /{pathPrefix}/{slug} (pathPrefix may include slashes, e.g. industries/nail-salon).
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "pathPrefix" TEXT NOT NULL DEFAULT 'blog';

UPDATE "Post" SET "pathPrefix" = 'blog' WHERE "pathPrefix" IS NULL OR trim("pathPrefix") = '';

ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_slug_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Post_pathPrefix_slug_key" ON "Post" ("pathPrefix", "slug");
