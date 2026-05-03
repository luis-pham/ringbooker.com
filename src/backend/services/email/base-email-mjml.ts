import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import mjml2html from 'mjml';

import { logger } from '@/src/backend/observability/logger';

import type { BaseEmailInput } from './base-email-types';
import { escapeHtmlAttr, escapeHtmlText, isAbsoluteHttpOrHttpsUrl } from './base-email-escape';

const BLOCK = (name: string) => ({
  start: `<!--@@${name}@@-->`,
  end: `<!--@@/${name}@@-->`,
});

function removeMarkedBlock(source: string, name: string): string {
  const { start, end } = BLOCK(name);
  const re = new RegExp(`${escapeReg(start)}[\\s\\S]*?${escapeReg(end)}\\s*`, 'g');
  return source.replace(re, '');
}

function unwrapMarkedBlock(source: string, name: string): string {
  const { start, end } = BLOCK(name);
  return source.split(start).join('').split(end).join('');
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveBaseMailMjmlPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const fromModule = join(here, '..', '..', '..', '..', 'html', 'base_mail.mjml');
  if (existsSync(fromModule)) return fromModule;
  return join(process.cwd(), 'html', 'base_mail.mjml');
}

let cachedMjmlSource: string | null = null;

function loadMjmlTemplate(): string {
  if (cachedMjmlSource) return cachedMjmlSource;
  const path = resolveBaseMailMjmlPath();
  cachedMjmlSource = readFileSync(path, 'utf8');
  return cachedMjmlSource;
}

function hasCtaPair(input: BaseEmailInput): boolean {
  return Boolean(input.ctaLabel?.trim() && input.ctaUrl?.trim());
}

/**
 * Compiles `html/base_mail.mjml` with optional sections and token replacement.
 * Throws if CTA pair is present but `ctaUrl` is not an absolute http(s) URL.
 */
export async function renderBaseEmailHtml(input: BaseEmailInput): Promise<string> {
  const hasCta = hasCtaPair(input);
  if (hasCta && !isAbsoluteHttpOrHttpsUrl(input.ctaUrl!.trim())) {
    logger.error({ ctaUrl: input.ctaUrl }, 'base_email_cta_url_not_absolute');
    throw new Error('base_email_cta_url_not_absolute');
  }

  let mj = loadMjmlTemplate();

  const heroSubtitle = input.heroSubtitleHtml?.trim();
  if (!heroSubtitle) mj = removeMarkedBlock(mj, 'RB_HERO_SUBTITLE');
  else mj = unwrapMarkedBlock(mj, 'RB_HERO_SUBTITLE');

  const greeting = input.greetingHtml?.trim();
  if (!greeting) mj = removeMarkedBlock(mj, 'RB_GREETING');
  else mj = unwrapMarkedBlock(mj, 'RB_GREETING');

  if (!hasCta) {
    mj = removeMarkedBlock(mj, 'RB_CTA');
    mj = removeMarkedBlock(mj, 'RB_LINK_FALLBACK');
  } else {
    mj = unwrapMarkedBlock(mj, 'RB_CTA');
    mj = unwrapMarkedBlock(mj, 'RB_LINK_FALLBACK');
  }

  const secondary = input.secondaryBodyHtml?.trim();
  if (!secondary) mj = removeMarkedBlock(mj, 'RB_SECONDARY');
  else mj = unwrapMarkedBlock(mj, 'RB_SECONDARY');

  const signature = input.signatureHtml?.trim();
  if (!signature) mj = removeMarkedBlock(mj, 'RB_SIGNATURE');
  else mj = unwrapMarkedBlock(mj, 'RB_SIGNATURE');

  const security = input.securityNote?.trim();
  if (!security) mj = removeMarkedBlock(mj, 'RB_SECURITY');
  else mj = unwrapMarkedBlock(mj, 'RB_SECURITY');

  const ctaUrl = hasCta ? input.ctaUrl!.trim() : '';
  const ctaLabel = hasCta ? input.ctaLabel!.trim() : '';

  const replacements: Record<string, string> = {
    '{{rb_email_title}}': escapeHtmlText(input.title),
    '{{rb_preview_text}}': escapeHtmlText(input.previewText),
    '{{rb_hero_title}}': escapeHtmlText(input.heroTitle),
    '{{rb_hero_subtitle_html}}': heroSubtitle ? heroSubtitle : '',
    '{{rb_greeting_html}}': greeting ? greeting : '',
    '{{rb_body_html}}': input.bodyHtml,
    '{{rb_secondary_body_html}}': secondary ? secondary : '',
    '{{rb_signature_html}}': signature ? signature : '',
    '{{rb_security_note}}': security ? escapeHtmlText(security) : '',
    '{{rb_cta_url}}': hasCta ? escapeHtmlAttr(ctaUrl) : '',
    '{{rb_cta_label}}': hasCta ? escapeHtmlText(ctaLabel) : '',
    '{{rb_cta_url_display}}': hasCta ? escapeHtmlText(ctaUrl) : '',
  };

  for (const [token, value] of Object.entries(replacements)) {
    if (mj.includes(token)) mj = mj.split(token).join(value);
  }

  const stray = mj.match(/\{\{rb_[a-z_]+\}\}/gi);
  if (stray?.length) {
    logger.error({ stray }, 'base_email_unresolved_mjml_tokens');
    throw new Error('base_email_unresolved_mjml_tokens');
  }

  const rawResult = mjml2html(mj, { validationLevel: 'soft', minify: true });
  const result = (await Promise.resolve(rawResult)) as unknown as {
    html: string;
    errors?: unknown[];
  };
  const { html, errors } = result;
  if (errors?.length) {
    logger.warn({ errors }, 'base_email_mjml_compile_warnings');
  }
  return html;
}
