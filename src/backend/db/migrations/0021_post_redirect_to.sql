-- Optional same-site path: when set, the post's public URL issues a permanent redirect (see BlogPostView).
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "redirectTo" TEXT;
