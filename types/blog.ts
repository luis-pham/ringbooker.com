import type { Author, Category, CategoryOnPost, Post, Tag, TagOnPost } from '@prisma/client';

export type PostWithRelations = Post & {
  author: Author;
  categories: (CategoryOnPost & { category: Category })[];
  tags: (TagOnPost & { tag: Tag })[];
};

export type CategoryWithCount = Category & {
  _count: { posts: number };
};
