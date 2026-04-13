'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { postSchema, slugify, type PostFormData } from '@/app/admin/blog/post-schema';

import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

type BlogPostFormProps = {
  mode: 'create' | 'edit';
  categories: CategoryOption[];
  initialData?: PostFormData;
  postId?: string;
  onSubmitAction: (data: PostFormData) => Promise<unknown>;
};

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });
const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), { ssr: false });

const defaultValues: PostFormData = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  status: 'DRAFT',
  categoryIds: [],
  tags: [],
  featured: false,
  coverImageUrl: '',
  coverStats: [],
  readTimeMin: 5,
};

export function BlogPostForm(props: BlogPostFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState((props.initialData?.tags ?? []).join(', '));
  const [slugTouched, setSlugTouched] = useState(Boolean(props.initialData?.slug));
  const [coverUploading, setCoverUploading] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: props.initialData ?? defaultValues,
    mode: 'onBlur',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'coverStats',
  });

  const title = form.watch('title');
  const content = form.watch('content');
  const status = form.watch('status');
  const selectedCategoryIds = form.watch('categoryIds');
  const coverImageUrl = form.watch('coverImageUrl');

  useEffect(() => {
    if (!slugTouched) {
      form.setValue('slug', slugify(title), { shouldValidate: true });
    }
  }, [title, slugTouched, form]);

  const readTimeHint = useMemo(() => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const estimate = Math.max(1, Math.ceil(words / 220));
    return `${estimate} min estimated`;
  }, [content]);

  const isEdit = props.mode === 'edit';

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{isEdit ? 'Edit blog post' : 'Create new blog post'}</h1>
          <p className="mt-1 text-sm text-slate-600">Use MDX to create structured blog content with live preview.</p>
        </div>
        <Link
          href="/admin/blog"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Back to list
        </Link>
      </div>

      <form
        className="space-y-6"
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          const normalizedTags = tagsInput
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
          const payload: PostFormData = {
            ...values,
            tags: normalizedTags,
            coverStats: values.coverStats.filter((item) => item.num.trim() && item.label.trim()),
          };
          startTransition(async () => {
            try {
              await props.onSubmitAction(payload);
              router.push('/admin/blog');
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to save post');
            }
          });
        })}
      >
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Title</span>
            <input
              {...form.register('title')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
              placeholder="How AI Receptionists Help Nail Salons Capture More Calls"
            />
            <FormError message={form.formState.errors.title?.message} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Slug</span>
            <input
              {...form.register('slug')}
              onChange={(event) => {
                setSlugTouched(true);
                form.setValue('slug', slugify(event.target.value), { shouldValidate: true });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
              placeholder="ai-receptionist-nail-salon-growth"
            />
            <FormError message={form.formState.errors.slug?.message} />
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Excerpt</span>
            <textarea
              {...form.register('excerpt')}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
              placeholder="Short SEO summary for the blog post..."
            />
            <FormError message={form.formState.errors.excerpt?.message} />
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-base font-semibold text-slate-900">Cover image</h2>
          <p className="mb-4 text-sm text-slate-600">
            Shown on the blog list, featured block, and above the article. JPEG, PNG, WebP, or GIF — up to 2.5MB.
          </p>
          <input type="hidden" {...form.register('coverImageUrl')} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="relative h-44 w-full max-w-md shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {coverImageUrl?.trim() ? (
                <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">No cover image</div>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <input
                ref={coverFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={coverUploading}
                className="max-w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-purple file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90 disabled:opacity-50"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setError(null);
                  setCoverUploading(true);
                  try {
                    const body = new FormData();
                    body.append('file', file);
                    const res = await fetch('/api/admin/blog/cover-image', {
                      method: 'POST',
                      body,
                      credentials: 'include',
                    });
                    const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
                    if (!res.ok || !json.ok || !json.url) {
                      throw new Error(json.error ?? 'Upload failed');
                    }
                    form.setValue('coverImageUrl', json.url, { shouldValidate: true, shouldDirty: true });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Cover upload failed');
                  } finally {
                    setCoverUploading(false);
                    event.target.value = '';
                  }
                }}
              />
              {coverUploading ? <p className="text-xs text-slate-500">Uploading…</p> : null}
              {coverImageUrl?.trim() ? (
                <button
                  type="button"
                  className="w-fit text-sm font-medium text-rose-600 underline-offset-2 hover:underline"
                  onClick={() => {
                    form.setValue('coverImageUrl', '', { shouldValidate: true, shouldDirty: true });
                    if (coverFileInputRef.current) coverFileInputRef.current.value = '';
                  }}
                >
                  Remove cover
                </button>
              ) : null}
            </div>
          </div>
          <FormError message={form.formState.errors.coverImageUrl?.message} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">MDX Content</h2>
            <p className="text-xs text-slate-500">{readTimeHint}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2" data-color-mode="light">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <MDEditor
                value={content}
                onChange={(value) => form.setValue('content', value ?? '', { shouldValidate: true, shouldDirty: true })}
                height={520}
                preview="edit"
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <MarkdownPreview source={content || 'Start writing your post...'} style={{ padding: 16, minHeight: 520 }} />
            </div>
          </div>
          <FormError message={form.formState.errors.content?.message} />
        </section>

        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Status</span>
            <select
              {...form.register('status')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Read time (minutes)</span>
            <input
              type="number"
              min={1}
              max={60}
              {...form.register('readTimeMin', { valueAsNumber: true })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
            />
            <FormError message={form.formState.errors.readTimeMin?.message} />
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Tags (comma separated)</span>
            <input
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
              placeholder="salon growth, ai receptionist, booking automation"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            <input type="checkbox" {...form.register('featured')} className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple" />
            Feature this post
          </label>

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold text-slate-700">Categories</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {props.categories.map((category) => {
                const checked = selectedCategoryIds.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      checked ? 'border-brand-purple bg-violet-50 text-violet-800' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...selectedCategoryIds, category.id]
                          : selectedCategoryIds.filter((value) => value !== category.id);
                        form.setValue('categoryIds', next, { shouldValidate: true });
                      }}
                    />
                    <span>{category.name}</span>
                  </label>
                );
              })}
            </div>
            <FormError message={form.formState.errors.categoryIds?.message} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Cover stats (max 3)</h2>
            <button
              type="button"
              onClick={() => append({ num: '', label: '' })}
              disabled={fields.length >= 3}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add stat
            </button>
          </div>

          <div className="space-y-3">
            {fields.length === 0 ? <p className="text-sm text-slate-500">No stats yet.</p> : null}
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                <input
                  {...form.register(`coverStats.${index}.num`)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
                  placeholder="45%"
                />
                <input
                  {...form.register(`coverStats.${index}.label`)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
                  placeholder="Increase in answered calls"
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-8">
          <p className="text-sm text-slate-500">Current status: {status}</p>
          <div className="flex items-center gap-2">
            {isEdit && props.postId ? (
              <Link
                href={`/blog/${form.getValues('slug')}`}
                target="_blank"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Preview
              </Link>
            ) : null}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Saving...' : isEdit ? 'Save changes' : 'Create post'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-rose-600">{message}</p>;
}
