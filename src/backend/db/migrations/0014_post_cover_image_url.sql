-- Blog post hero / card image (Prisma model Post)
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
