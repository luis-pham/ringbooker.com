-- Hub index / "In this hub": hide a post from marketing hub list while keeping the article URL.
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "showInHub" BOOLEAN NOT NULL DEFAULT true;
