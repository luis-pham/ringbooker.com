'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { postSchema, slugify, type PostFormData } from '@/app/admin/blog/post-schema';
import {
  BLOG_FOOTER_ARTICLE_PRESETS,
  getBlogFooterArticlePreset,
  getBlogFooterButton,
  type BlogFooterArticleKind,
} from '@/lib/blog/footer-cta-templates';
import { BLOG_PATH_PREFIX_LABEL, BLOG_PATH_PREFIXES, postPublicPath } from '@/lib/blog/path-prefixes';

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

/** Browser console: set NEXT_PUBLIC_LOG_BLOG_COVER=1 (rebuild) or run `next dev`. */
const COVER_UPLOAD_DEBUG =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_LOG_BLOG_COVER === '1';

const defaultValues: PostFormData = {
  title: '',
  slug: '',
  excerpt: '',
  metaDescription: '',
  content: '',
  status: 'DRAFT',
  categoryIds: [],
  tags: [],
  featured: false,
  coverImageUrl: '',
  coverStats: [],
  readTimeMin: 5,
  pathPrefix: 'blog',
  footerCtas: [],
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

  const {
    fields: footerCtaFields,
    append: appendFooterCta,
    remove: removeFooterCta,
  } = useFieldArray({
    control: form.control,
    name: 'footerCtas',
  });

  const title = form.watch('title');
  const slugWatch = form.watch('slug');
  const pathPrefixWatch = form.watch('pathPrefix');
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
            pathPrefix: values.pathPrefix ?? 'blog',
            tags: normalizedTags,
            coverStats: values.coverStats.filter(
              (item: { num: string; label: string }) => item.num.trim() && item.label.trim(),
            ),
            footerCtas: values.footerCtas ?? [],
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
            <Controller
              control={form.control}
              name="slug"
              render={({ field }) => (
                <input
                  {...field}
                  onChange={(event) => {
                    setSlugTouched(true);
                    field.onChange(slugify(event.target.value));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
                  placeholder="ai-receptionist-nail-salon-growth"
                />
              )}
            />
            <FormError message={form.formState.errors.slug?.message} />
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Public URL path</span>
            <p className="mb-1.5 text-xs text-slate-500">
              Article URL is this path + slug (e.g. <code className="rounded bg-slate-100 px-1">/trust/your-post-slug</code> or{' '}
              <code className="rounded bg-slate-100 px-1">/industries/nail-salon/your-post-slug</code>).
            </p>
            <select
              {...form.register('pathPrefix')}
              className="w-full max-w-xl rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
            >
              {BLOG_PATH_PREFIXES.map((p) => (
                <option key={p} value={p}>
                  /{p}/ — {BLOG_PATH_PREFIX_LABEL[p]}
                </option>
              ))}
            </select>
            <FormError message={form.formState.errors.pathPrefix?.message} />
            {slugWatch?.trim() ? (
              <p className="mt-1.5 font-mono text-xs text-violet-700">
                Preview: {postPublicPath(pathPrefixWatch ?? 'blog', slugWatch)}
              </p>
            ) : null}
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

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Meta description (SEO)</span>
            <textarea
              {...form.register('metaDescription')}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
              placeholder="Optional. Shown in search results and link previews when set. Plain text, ~155–160 characters is ideal."
            />
            <p className="text-xs text-slate-500">
              Leave blank to use the excerpt (and body fallbacks) for meta tags and structured data — same as before.
            </p>
            <FormError message={form.formState.errors.metaDescription?.message} />
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-base font-semibold text-slate-900">Cover image</h2>
          <p className="mb-4 text-sm text-slate-600">
            Shown on the blog list, featured block, and above the article. JPEG, PNG, WebP, or GIF — up to 2.5MB.
          </p>
          <Controller
            control={form.control}
            name="coverImageUrl"
            render={({ field }) => <input type="hidden" {...field} value={field.value ?? ''} />}
          />
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
                    let json: { ok?: boolean; url?: string; error?: string } = {};
                    const text = await res.text();
                    if (COVER_UPLOAD_DEBUG) {
                      console.info('[rb-cover-upload]', {
                        httpStatus: res.status,
                        bodyPreview: text.slice(0, 400),
                      });
                    }
                    try {
                      json = text ? (JSON.parse(text) as typeof json) : {};
                    } catch {
                      if (COVER_UPLOAD_DEBUG) {
                        console.warn('[rb-cover-upload] response is not JSON', { httpStatus: res.status });
                      }
                      throw new Error(`Upload failed (${res.status}). Check server logs.`);
                    }
                    if (!res.ok || !json.ok || !json.url) {
                      const code = json.error ?? 'upload_failed';
                      const hint =
                        code === 'unauthorized'
                          ? 'Session expired — sign in again.'
                          : code === 'storage_failed'
                            ? 'Server could not save the file (read-only disk on host, or permission error).'
                            : code === 'invalid_file_type'
                              ? 'Use JPEG, PNG, WebP, or GIF.'
                              : code === 'file_too_large'
                                ? 'File too large (max 2.5MB).'
                                : code;
                      throw new Error(hint);
                    }
                    form.setValue('coverImageUrl', json.url, {
                      shouldValidate: true,
                      shouldDirty: true,
                      shouldTouch: true,
                    });
                    if (COVER_UPLOAD_DEBUG) {
                      console.info('[rb-cover-upload] set coverImageUrl', { url: json.url });
                    }
                  } catch (err) {
                    if (COVER_UPLOAD_DEBUG) {
                      console.warn('[rb-cover-upload] catch', err);
                    }
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
                    form.setValue('coverImageUrl', '', {
                      shouldValidate: true,
                      shouldDirty: true,
                      shouldTouch: true,
                    });
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

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">End-of-article CTAs</h2>
              <p className="mt-1 text-sm text-slate-600">
                Pick an article type: copy and primary/secondary buttons are fixed; you set both links (paths like{' '}
                <code className="rounded bg-slate-100 px-1">/pricing</code> or full URLs). Max 6 blocks; each type once.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const preset = BLOG_FOOTER_ARTICLE_PRESETS[0];
                appendFooterCta({
                  kind: preset.id,
                  primaryHref: getBlogFooterButton(preset.primaryButtonId).suggestedHref,
                  secondaryHref: getBlogFooterButton(preset.secondaryButtonId).suggestedHref,
                });
              }}
              disabled={footerCtaFields.length >= 6}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add CTA block
            </button>
          </div>

          <div className="space-y-3">
            {footerCtaFields.length === 0 ? (
              <p className="text-sm text-slate-500">No footer CTAs — the article ends after the markdown body only.</p>
            ) : null}
            {footerCtaFields.map((field, index) => {
              const kind = form.watch(`footerCtas.${index}.kind`) as BlogFooterArticleKind;
              const preset = getBlogFooterArticlePreset(kind);
              const primaryPh = getBlogFooterButton(preset.primaryButtonId).suggestedHref;
              const secondaryPh = getBlogFooterButton(preset.secondaryButtonId).suggestedHref;
              const kindRegister = form.register(`footerCtas.${index}.kind`);
              return (
                <div key={field.id} className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Article type</span>
                    <select
                      {...kindRegister}
                      onChange={(e) => {
                        kindRegister.onChange(e);
                        const nextKind = e.target.value as BlogFooterArticleKind;
                        const prevPreset = getBlogFooterArticlePreset(kind);
                        const pPrev = getBlogFooterButton(prevPreset.primaryButtonId).suggestedHref;
                        const sPrev = getBlogFooterButton(prevPreset.secondaryButtonId).suggestedHref;
                        const primaryNow = form.getValues(`footerCtas.${index}.primaryHref`)?.trim() ?? '';
                        const secondaryNow = form.getValues(`footerCtas.${index}.secondaryHref`)?.trim() ?? '';
                        const nextPreset = getBlogFooterArticlePreset(nextKind);
                        const pNext = getBlogFooterButton(nextPreset.primaryButtonId).suggestedHref;
                        const sNext = getBlogFooterButton(nextPreset.secondaryButtonId).suggestedHref;
                        if (!primaryNow || primaryNow === pPrev) {
                          form.setValue(`footerCtas.${index}.primaryHref`, pNext, { shouldValidate: true, shouldDirty: true });
                        }
                        if (!secondaryNow || secondaryNow === sPrev) {
                          form.setValue(`footerCtas.${index}.secondaryHref`, sNext, { shouldValidate: true, shouldDirty: true });
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-purple/30 transition focus:ring"
                    >
                      {BLOG_FOOTER_ARTICLE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <FormError message={form.formState.errors.footerCtas?.[index]?.kind?.message} />
                  </label>
                  <p className="rounded-lg border border-violet-100/80 bg-white px-3 py-2 text-sm leading-relaxed text-slate-600">
                    {preset.ctaBody}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">Primary:</span> {getBlogFooterButton(preset.primaryButtonId).label}{' '}
                    <span className="mx-1 text-slate-400">·</span>
                    <span className="font-semibold text-slate-600">Secondary:</span>{' '}
                    {getBlogFooterButton(preset.secondaryButtonId).label}
                  </p>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary link</span>
                      <input
                        {...form.register(`footerCtas.${index}.primaryHref`)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none ring-brand-purple/30 transition focus:ring"
                        placeholder={primaryPh}
                      />
                      <FormError message={form.formState.errors.footerCtas?.[index]?.primaryHref?.message} />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secondary link</span>
                      <input
                        {...form.register(`footerCtas.${index}.secondaryHref`)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none ring-brand-purple/30 transition focus:ring"
                        placeholder={secondaryPh}
                      />
                      <FormError message={form.formState.errors.footerCtas?.[index]?.secondaryHref?.message} />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeFooterCta(index)}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 md:mb-0.5"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
                href={postPublicPath(pathPrefixWatch ?? 'blog', slugWatch)}
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
