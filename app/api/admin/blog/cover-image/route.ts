import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/src/backend/security/session';

export const runtime = 'nodejs';

/** Set `LOG_BLOG_COVER=1` in env for extra detail (mime steps, absolute paths). */
const COVER_LOG_VERBOSE = process.env.LOG_BLOG_COVER === '1' || process.env.LOG_BLOG_COVER === 'true';

function coverLog(message: string, meta?: Record<string, unknown>) {
  const line = meta && Object.keys(meta).length > 0 ? `${message} ${JSON.stringify(meta)}` : message;
  console.info(`[cover-image] ${line}`);
}

const MAX_BYTES = 2.5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** When `File.type` is empty or generic (common on some browsers/OS), infer from bytes or filename. */
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function mimeFromFileName(name: string): string | null {
  const lower = name.trim().toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return null;
}

function resolveMime(file: Blob & { name?: string }, buf: Buffer): string | null {
  const declared = (file.type || '').trim();
  if (ALLOWED_MIME.has(declared)) return declared;
  return sniffImageMime(buf) ?? mimeFromFileName(typeof file.name === 'string' ? file.name : '') ?? null;
}

function extFromMime(mime: string): string | null {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return null;
}

export async function POST(request: Request) {
  coverLog('POST begin', { cwd: process.cwd(), verbose: COVER_LOG_VERBOSE });

  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const session = token ? await verifySessionToken(token) : null;
  if (!session || session.role !== 'admin') {
    coverLog('reject unauthorized', { hasCookie: Boolean(token), role: session?.role ?? null });
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  coverLog('auth ok', { role: session.role });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    coverLog('reject invalid_form', { message: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, error: 'invalid_form' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    coverLog('reject missing_file', { formKeys: [...formData.keys()] });
    return NextResponse.json({ ok: false, error: 'missing_file' }, { status: 400 });
  }

  const fileName = typeof (file as { name?: string }).name === 'string' ? (file as { name: string }).name : '';
  const declaredType = (file.type || '').trim() || '(empty)';

  if (file.size > MAX_BYTES) {
    coverLog('reject file_too_large', { size: file.size, max: MAX_BYTES, fileName });
    return NextResponse.json({ ok: false, error: 'file_too_large' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = resolveMime(file as Blob & { name?: string }, buf);
  if (COVER_LOG_VERBOSE) {
    const sniffed = sniffImageMime(buf);
    coverLog('mime detail', {
      fileName,
      declaredType,
      sniffed,
      fromName: mimeFromFileName(fileName),
      resolved: mime,
    });
  }
  if (!mime || !ALLOWED_MIME.has(mime)) {
    coverLog('reject invalid_file_type', { fileName, declaredType, resolvedMime: mime });
    return NextResponse.json({ ok: false, error: 'invalid_file_type' }, { status: 400 });
  }

  const ext = extFromMime(mime);
  if (!ext) {
    coverLog('reject invalid_file_type no ext', { mime });
    return NextResponse.json({ ok: false, error: 'invalid_file_type' }, { status: 400 });
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'blog');
  try {
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}${ext}`;
    const absPath = path.join(dir, name);
    await writeFile(absPath, buf);
    const url = `/uploads/blog/${name}`;
    coverLog('ok', {
      publicUrl: url,
      bytesWritten: buf.length,
      mime,
      ...(COVER_LOG_VERBOSE ? { absPath, uploadDir: dir } : {}),
    });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cover-image] write failed', { message, ...(COVER_LOG_VERBOSE ? { dir, cwd: process.cwd() } : {}) });
    return NextResponse.json({ ok: false, error: 'storage_failed' }, { status: 503 });
  }
}
