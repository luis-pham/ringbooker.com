import type { Hono } from 'hono';
import {
  enforceRateLimit,
  enforceRateLimitWithIdentity,
  securityAudit,
  getClientIp,
  RATE_LIMIT_POLICIES,
  blogPostListQuerySchema,
  publicContactRequestSchema,
  verifyTurnstileToken,
  escapeHtml,
  emailDefaultFrom,
  emailFounderFrom,
  emailReplyTo,
  contactSalesEmail,
  buildDemoRequestCustomerEmailPayload,
  renderBaseEmailHtml,
} from '../app-shared';
import { randomUUID } from 'node:crypto';
import { logger } from '@/src/backend/observability/logger';
import { normalizePhone } from '@/lib/phone-number';
import { getEnv } from '@/src/backend/config/env';
import type { BlogPostsRepository, ContactRequestsRepository } from '../app-shared';
import type { EmailService } from '../app-shared';

type PublicDeps = {
  blogPostsRepository?: BlogPostsRepository;
  contactRequestsRepository?: ContactRequestsRepository;
  emailService?: EmailService;
};

export function registerPublicRoutes(app: Hono, path: (route: string) => string, deps: PublicDeps): void {
  app.get(path('/public/blog/posts'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_status, 'public_blog_posts');
    if (limited) return limited;
    if (!deps.blogPostsRepository) return c.json({ ok: false, error: 'blog_repository_unavailable' }, 500);
    const parsed = blogPostListQuerySchema.safeParse({
      limit: c.req.query('limit'),
      query: c.req.query('query'),
    });
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_query' }, 400);
    const posts = await deps.blogPostsRepository.listPublished({
      limit: parsed.data.limit,
      query: parsed.data.query,
    });
    return c.json({ ok: true, posts });
  });

  app.get(path('/public/blog/posts/:slug'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_status, 'public_blog_post_detail');
    if (limited) return limited;
    if (!deps.blogPostsRepository) return c.json({ ok: false, error: 'blog_repository_unavailable' }, 500);
    const slug = c.req.param('slug');
    if (!slug) return c.json({ ok: false, error: 'invalid_slug' }, 400);
    const post = await deps.blogPostsRepository.findBySlug(slug);
    if (!post) return c.json({ ok: false, error: 'not_found' }, 404);
    return c.json({ ok: true, post });
  });

  app.post(path('/public/contact/request'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_contact_request, 'public_contact_request');
    if (limited) return limited;

    const body = await c.req.json().catch(() => null);
    const parsed = publicContactRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      securityAudit({
        action: 'public_contact_honeypot_triggered',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      return c.json({ ok: false, error: 'invalid_request' }, 400);
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const sessionLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_contact_request_session,
      `public_contact_request_session:${parsed.data.sessionId}`,
    );
    if (sessionLimited) return sessionLimited;

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const emailDailyLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_contact_request_email_daily,
      `public_contact_request_email_daily:${normalizedEmail}`,
    );
    if (emailDailyLimited) return emailDailyLimited;

    const ipEmailLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_contact_request_ip_email,
      `public_contact_request_ip_email:${ip}:${normalizedEmail}`,
    );
    if (ipEmailLimited) return ipEmailLimited;

    const captcha = await verifyTurnstileToken({
      token: parsed.data.captchaToken,
      ip,
    });
    if (!captcha.ok) {
      securityAudit({
        action: 'public_contact_captcha_failed',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { reason: captcha.reason },
      });
      return c.json({ ok: false, error: 'captcha_failed' }, 403);
    }

    const normalizedPhone = normalizePhone(parsed.data.phoneNumber);
    if (!normalizedPhone) {
      return c.json({ ok: false, error: 'invalid_phone' }, 400);
    }

    const requestId = `contact-${randomUUID()}`;
    const receivedAt = new Date().toISOString();
    const locationCount = parsed.data.locationCount ?? parsed.data.numberOfLocations ?? null;
    const estimatedCallVolume = parsed.data.estimatedCallVolume ?? parsed.data.estimatedMonthlyCallVolume ?? null;
    const bookingSoftware = parsed.data.bookingSoftware ?? parsed.data.currentBookingSoftware ?? null;
    const routingNeeds = parsed.data.routingNeeds ?? parsed.data.routingRules ?? null;
    const goLiveTimeline = parsed.data.goLiveTimeline ?? parsed.data.preferredGoLiveTimeline ?? null;
    const sourceDetail = parsed.data.source ?? null;

    if (deps.contactRequestsRepository) {
      try {
        await deps.contactRequestsRepository.create({
          requestId,
          fullName: parsed.data.fullName,
          businessName: parsed.data.businessName,
          email: normalizedEmail,
          phoneNumber: normalizedPhone,
          businessType: parsed.data.businessType,
          currentSetup: parsed.data.currentSetup,
          helpNeed: parsed.data.helpNeed,
          bestTime: parsed.data.bestTime,
          intent: parsed.data.intent,
          sourceDetail,
          planInterest: parsed.data.planInterest,
          locationCount,
          estimatedCallVolume,
          bookingSoftware,
          routingNeeds,
          goLiveTimeline,
          numberOfLocations: parsed.data.numberOfLocations ?? null,
          locationsText: parsed.data.locationsText ?? null,
          mainContact: parsed.data.mainContact ?? null,
          currentPhoneProvider: parsed.data.currentPhoneProvider ?? null,
          currentBookingSoftware: parsed.data.currentBookingSoftware ?? null,
          currentCrm: parsed.data.currentCrm ?? null,
          estimatedMonthlyCallVolume: parsed.data.estimatedMonthlyCallVolume ?? null,
          languagesNeeded: parsed.data.languagesNeeded ?? null,
          routingRules: parsed.data.routingRules ?? null,
          escalationRules: parsed.data.escalationRules ?? null,
          integrationRequirements: parsed.data.integrationRequirements ?? null,
          preferredGoLiveTimeline: parsed.data.preferredGoLiveTimeline ?? null,
          source: 'marketing_contact_form',
          ip,
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            requestId,
          },
          'public_contact_persist_failed',
        );
      }
    }

    const salesTo = contactSalesEmail();
    if (getEnv().EMAIL_PROVIDER === 'noop') {
      logger.warn(
        { requestId },
        'public_contact_email_skipped_set_EMAIL_PROVIDER_resend_and_RESEND_API_KEY',
      );
    }
    if (deps.emailService && salesTo) {
      const leadName = parsed.data.businessName || normalizedEmail;
      const subject =
        parsed.data.intent === 'enterprise'
          ? `[Enterprise inquiry] Custom setup request from ${leadName}`
          : parsed.data.intent === 'demo'
            ? `[Demo request] ${leadName}`
            : `[Contact] ${leadName}`;
      const lines = [
        `Request ID: ${requestId}`,
        `Received At: ${receivedAt}`,
        `Intent: ${parsed.data.intent}`,
        sourceDetail ? `Source: ${sourceDetail}` : 'Source: —',
        `Plan Interest: ${parsed.data.planInterest}`,
        `Name: ${parsed.data.fullName}`,
        `Business: ${parsed.data.businessName}`,
        `Email: ${normalizedEmail}`,
        `Phone: ${normalizedPhone}`,
        `Business Type: ${parsed.data.businessType}`,
        `Current Setup: ${parsed.data.currentSetup}`,
        `Best Time: ${parsed.data.bestTime}`,
        locationCount ? `Number of locations: ${locationCount}` : null,
        estimatedCallVolume ? `Estimated Monthly Call Volume: ${estimatedCallVolume}` : null,
        bookingSoftware ? `Booking Software: ${bookingSoftware}` : null,
        routingNeeds ? `Routing Needs: ${routingNeeds}` : null,
        goLiveTimeline ? `Preferred Go-live Timeline: ${goLiveTimeline}` : null,
        parsed.data.locationsText ? `Locations: ${parsed.data.locationsText}` : null,
        parsed.data.currentPhoneProvider ? `Phone Provider: ${parsed.data.currentPhoneProvider}` : null,
        parsed.data.currentCrm ? `CRM: ${parsed.data.currentCrm}` : null,
        parsed.data.languagesNeeded ? `Languages Needed: ${parsed.data.languagesNeeded}` : null,
        parsed.data.escalationRules ? `Escalation Rules: ${parsed.data.escalationRules}` : null,
        parsed.data.integrationRequirements ? `Integration Requirements: ${parsed.data.integrationRequirements}` : null,
        '',
        'Help Request:',
        parsed.data.helpNeed,
      ].filter((line): line is string => typeof line === 'string');
      try {
        await deps.emailService.sendEmail({
          to: salesTo,
          subject,
          text: lines.join('\n'),
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
              <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
              <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;margin:0">${escapeHtml(lines.join('\n'))}</pre>
            </div>
          `,
          category: 'contact_request',
          idempotencyKey: `public_contact:${requestId}`,
          from: emailDefaultFrom(),
          replyTo: normalizedEmail,
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            requestId,
            salesTo,
          },
          'public_contact_email_send_failed',
        );
      }
    }

    if (deps.emailService && parsed.data.intent === 'demo') {
      const firstName = parsed.data.fullName.trim().split(/\s+/).filter(Boolean)[0] ?? '';
      try {
        const { input, text } = buildDemoRequestCustomerEmailPayload({
          firstName,
          businessName: parsed.data.businessName,
          businessType: parsed.data.businessType,
          demoCtaUrl: 'https://ringbooker.com/demo',
        });
        const html = await renderBaseEmailHtml(input);
        await deps.emailService.sendEmail({
          from: emailFounderFrom(),
          to: normalizedEmail,
          subject: input.title,
          text,
          html,
          category: 'demo_request_confirmation',
          idempotencyKey: `public_contact_customer:${requestId}`,
          replyTo: emailReplyTo(),
        });
      } catch (error) {
        logger.error(
          {
            err: error,
            requestId,
            to: normalizedEmail,
          },
          'public_contact_confirmation_email_failed',
        );
      }
    }

    securityAudit({
      action: 'public_contact_requested',
      actorType: 'public',
      ip,
      path: c.req.path,
      details: {
        requestId,
        businessType: parsed.data.businessType,
        currentSetup: parsed.data.currentSetup,
        intent: parsed.data.intent,
        source: sourceDetail,
        planInterest: parsed.data.planInterest,
      },
    });

    return c.json({
      ok: true,
      requestId,
      message: 'request_received',
    });
  });

  /**
   * Legacy public outbound visitor demo — permanently disabled.
   * Browser voice demos use `POST /public/demo/web-session` instead (no visitor phone dial).
   */
}
