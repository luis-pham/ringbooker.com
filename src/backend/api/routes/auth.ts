import type { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomBytes, randomUUID } from 'node:crypto';

import { getCountryConfig } from '@/lib/countries/config';
import { createShopWithPlaceholderPhoneRetry } from '@/src/backend/domain/signup-placeholder-phone';
import type { Shop } from '@/src/backend/domain/types';
import { isShopSetupWizardComplete } from '@/src/backend/domain/shop-onboarding';
import type {
  AuthUsersRepository,
  BillingCustomersRepository,
  BillingSubscriptionsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import type { SalesPreparedDemosRepository } from '@/src/backend/ports/sales-prepared-demos';
import { createNoCardTrialForShop } from '@/src/backend/services/billing/no-card-trial';
import { emailRecipientDomain } from '@/src/backend/services/email/recipient-domain';
import { sendSignupWelcomeEmail } from '@/src/backend/services/email/signup-welcome';
import type { EmailService } from '@/src/backend/services/email/types';
import { notifySalesLifecycle } from '@/src/backend/services/sales-integration/sales-webhook';
import type { PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';
import { logger } from '@/src/backend/observability/logger';
import { hashEmailVerificationToken } from '@/src/backend/security/email-verification';
import { hashPassword, verifyPassword } from '@/src/backend/security/password';
import {
  ADMIN_SESSION_COOKIE,
  USER_SESSION_COOKIE,
  signSessionToken,
} from '@/src/backend/security/session';
import {
  authLoginSchema,
  buildDefaultShopNameFromEmail,
  clearUserGoogleOAuthCookies,
  computeUserPostAuthRedirectPath,
  createAndSendEmailVerification,
  createOAuthFallbackPasswordHash,
  enforceRateLimit,
  enforceRateLimitWithIdentity,
  enforceSameOriginForCookieMutation,
  forgotPasswordSchema,
  getAppBaseUrl,
  getClientIp,
  hashPasswordResetToken,
  normalizeCfIpCountry,
  RATE_LIMIT_POLICIES,
  readSession,
  requireSession,
  resetPasswordSchema,
  securityAudit,
  sendPasswordResetEmail,
  signupPhoneSearchSchema,
  toBrandSlug,
  userSignupSchema,
  verifyAttributionCookie,
  verifyEmailSchema,
  verifyGoogleIdToken,
} from '../app-shared';

type AuthDeps = {
  phoneProvisioningService?: PhoneProvisioningService;
  authUsersRepository?: AuthUsersRepository;
  shopsRepository?: ShopsRepository;
  billingCustomersRepository?: BillingCustomersRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  salesPreparedDemosRepository?: SalesPreparedDemosRepository;
  emailService?: EmailService;
};

export function registerAuthRoutes(app: Hono, path: (route: string) => string, deps: AuthDeps): void {
  app.post(path('/auth/user/signup/phone-search'), async (c) => {
    /**
     * Reserved for future **post-payment** RingBooker forwarding number selection / admin tooling.
     * Not used by self-serve signup (`UserSignupForm` does not call this).
     * P1: tie to POST /user/phone-numbers/provision-forwarding-number only after payment + intent.
     */
    const body = await c.req.json().catch(() => null);
    const parsed = signupPhoneSearchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const limited = await enforceRateLimit(
      c,
      RATE_LIMIT_POLICIES.auth_signup_phone_search,
      `signup_phone_search:${parsed.data.countryCode}:${parsed.data.locality ?? 'all'}`,
    );
    if (limited) return limited;
    if (!deps.phoneProvisioningService) {
      return c.json({ ok: false, error: 'phone_provisioning_unavailable' }, 503);
    }

    const numbers = await deps.phoneProvisioningService.searchAvailableNumbers({
      countryCode: parsed.data.countryCode,
      locality: parsed.data.locality,
      administrativeArea: parsed.data.administrativeArea,
      limit: parsed.data.limit ?? 12,
    });
    return c.json({
      ok: true,
      numbers,
    });
  });

  app.post(path('/auth/user/signup'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const body = await c.req.json().catch(() => null);
    const rawPlan =
      body && typeof body === 'object' && 'plan' in body ? (body as { plan?: unknown }).plan : undefined;
    const hasValidTrialPlan = rawPlan === 'starter' || rawPlan === 'professional';
    const parsed = userSignupSchema.safeParse(body);
    if (!parsed.success) {
      if (!hasValidTrialPlan) {
        return c.json(
          {
            ok: false,
            error: 'plan_required',
            message: 'Please choose a trial plan first.',
          },
          400,
        );
      }
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const normalizedEmail = parsed.data.email.toLowerCase();
    const limited = await enforceRateLimit(
      c,
      RATE_LIMIT_POLICIES.auth_signup_user,
      `user_signup:${normalizedEmail}`,
    );
    if (limited) return limited;
    if (!deps.authUsersRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'signup_dependencies_unavailable' }, 500);
    }
    if (!deps.billingCustomersRepository || !deps.billingSubscriptionsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'billing_dependencies_unavailable' }, 500);
    }

    const existing = await deps.authUsersRepository.findByEmail(normalizedEmail);
    if (existing) {
      return c.json(
        {
          ok: false,
          error: 'email_already_exists',
          message: 'Account already exists. Please log in to continue.',
        },
        409,
      );
    }

    const shopName = parsed.data.shopName?.trim() || buildDefaultShopNameFromEmail(normalizedEmail);
    /* Business main line when provided — never Telnyx-provisioned during signup (P0 onboarding sprint). */
    const businessLineRaw =
      (parsed.data.phoneNumber?.trim() || '') || (parsed.data.userPhone?.trim() || '');
    const userProvidedPhone = businessLineRaw.length >= 6 ? businessLineRaw : null;
    const ownerPhoneFromForm =
      parsed.data.userPhone?.trim().length && parsed.data.userPhone.trim().length >= 6
        ? parsed.data.userPhone.trim()
        : null;

    // When user provides a real phone, create directly. Otherwise retry up to 5x on placeholder collision.
    const createdShop = userProvidedPhone
      ? await deps.shopsRepository.create({
          name: shopName,
          brand_slug: parsed.data.brandSlug ?? toBrandSlug(shopName),
          phone_number: userProvidedPhone,
          user_phone: ownerPhoneFromForm ?? userProvidedPhone,
          user_name: parsed.data.userName ?? null,
          timezone: parsed.data.timezone,
          plan: parsed.data.plan,
          active: true,
        })
      : await createShopWithPlaceholderPhoneRetry((placeholder) =>
          deps.shopsRepository!.create({
            name: shopName,
            brand_slug: parsed.data.brandSlug ?? toBrandSlug(shopName),
            phone_number: placeholder,
            user_phone: placeholder,
            user_name: parsed.data.userName ?? null,
            timezone: parsed.data.timezone,
            plan: parsed.data.plan,
            active: true,
          }),
        );

    // Deterministic sales attribution: if this signup came from a /try/<slug> demo
    // (rb_ref cookie), stamp the shop with the originating lead and report the signup.
    try {
      const refSlug = verifyAttributionCookie(getCookie(c, 'rb_ref'));
      if (refSlug && deps.salesPreparedDemosRepository) {
        const prepared = await deps.salesPreparedDemosRepository.findBySlug(refSlug);
        if (prepared) {
          await deps.shopsRepository.setSalesAttribution(createdShop.id, {
            salesLeadId: prepared.salesLeadId,
            method: 'demo_token',
          });
          void notifySalesLifecycle({ salesLeadId: prepared.salesLeadId, event: 'signedup' });
        }
      }
    } catch (error) {
      logger.warn({ err: error }, 'sales_attribution_stamp_failed');
    }

    const authUser = await deps.authUsersRepository.create({
      email: normalizedEmail,
      role: 'user',
      shopId: createdShop.id,
      passwordHash: hashPassword(parsed.data.password),
      active: true,
      mfaEnabled: false,
    });

    const trial = await createNoCardTrialForShop(
      {
        billingCustomersRepository: deps.billingCustomersRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
      },
      {
        shopId: createdShop.id,
        email: authUser.email,
        plan: parsed.data.plan,
      },
    );

    const verification = await createAndSendEmailVerification({
      authUsersRepository: deps.authUsersRepository,
      emailService: deps.emailService,
      authUserId: authUser.id,
      email: authUser.email,
      shopId: createdShop.id,
      shopName: createdShop.name,
      appBaseUrl: getAppBaseUrl(c.req),
      idempotencyPrefix: 'email-verification',
    });

    const token = await signSessionToken({
      role: 'user',
      email: authUser.email,
      shopId: authUser.shopId ?? undefined,
      emailVerified: Boolean(authUser.emailVerifiedAt),
      ttlHours: parsed.data.remember ? 24 * 14 : 24,
    });
    setCookie(c, USER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: (parsed.data.remember ? 24 * 14 : 24) * 3600,
    });
    deleteCookie(c, ADMIN_SESSION_COOKIE, { path: '/' });

    securityAudit({
      action: 'auth_signup_success',
      actorType: 'user',
      actorId: authUser.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId: createdShop.id,
        phoneNumber: createdShop.phone_number,
      },
    });

    logger.info(
      {
        event: 'signup_completed',
        shopId: createdShop.id,
        authUserId: authUser.id,
        signupMethod: 'email_password',
        recipientDomain: emailRecipientDomain(authUser.email),
      },
      'signup_completed',
    );

    await sendSignupWelcomeEmail({
      emailService: deps.emailService,
      email: authUser.email,
      shopName: createdShop.name,
      shopId: createdShop.id,
      authUserId: authUser.id,
      signupMethod: 'email_password',
      trialEndsAt: trial.subscription.trialEndsAt ?? undefined,
      shopTimezone: createdShop.timezone,
      appBaseUrl: getAppBaseUrl(c.req),
      idempotencyKey: `signup-welcome:${authUser.id}`,
    });

    const postAuthRedirect = computeUserPostAuthRedirectPath({ shop: createdShop, shopId: createdShop.id });

    return c.json(
      {
        ok: true,
        role: 'user',
        shopId: createdShop.id,
        emailVerified: false,
        onboardingRequired: !isShopSetupWizardComplete(createdShop),
        postAuthRedirect,
        billing: {
          subscriptionStatus: trial.subscription.status,
          trialEndsAt: trial.subscription.trialEndsAt ?? null,
          paymentMethodStatus: trial.subscription.paymentMethodStatus ?? 'none',
          liveCallsEnabled: trial.accessState.liveCallsEnabled,
        },
        shop: {
          id: createdShop.id,
          name: createdShop.name,
          phone_number: createdShop.phone_number,
        },
        ...(process.env.NODE_ENV !== 'production' ? { verificationToken: verification.rawToken } : {}),
      },
      201,
    );
  });

  app.post(path('/auth/verify-email'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_verify_email, 'auth_verify_email');
    if (limited) return limited;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);
    }
    const body = await c.req.json().catch(() => null);
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const tokenHash = hashEmailVerificationToken(parsed.data.token);
    const token = await deps.authUsersRepository.findEmailVerificationToken(tokenHash);
    if (!token) return c.json({ ok: false, error: 'verification_token_not_found' }, 404);

    const authUser = await deps.authUsersRepository.findById(token.authUserId);
    if (!authUser || authUser.role !== 'user' || !authUser.active) {
      return c.json({ ok: false, error: 'verification_account_unavailable' }, 404);
    }
    if (token.usedAt) {
      return c.json({
        ok: false,
        error: 'verification_token_used',
        status: authUser.emailVerifiedAt ? 'already_verified' : 'used',
      }, 409);
    }
    if (new Date(token.expiresAt).getTime() <= Date.now()) {
      return c.json({ ok: false, error: 'verification_token_expired', status: 'expired' }, 410);
    }

    await deps.authUsersRepository.markEmailVerificationTokenUsed(token.id);
    await deps.authUsersRepository.markEmailVerified(authUser.id);
    const currentSession = await readSession(c);
    if (currentSession?.role === 'user' && currentSession.email.toLowerCase() === authUser.email.toLowerCase()) {
      const refreshedToken = await signSessionToken({
        role: 'user',
        email: authUser.email,
        shopId: authUser.shopId ?? undefined,
        emailVerified: true,
        ttlHours: 24 * 14,
      });
      setCookie(c, USER_SESSION_COOKIE, refreshedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'Lax',
        path: '/',
        maxAge: 24 * 14 * 3600,
      });
    }
    securityAudit({
      action: 'auth_email_verified',
      actorType: 'user',
      actorId: authUser.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
    });
    return c.json({ ok: true, status: 'verified' });
  });

  app.post(path('/auth/resend-verification'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.authUsersRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);
    }
    const authUser = await deps.authUsersRepository.findByEmail(sessionResult.email);
    if (!authUser || authUser.role !== 'user' || !authUser.active) {
      return c.json({ ok: false, error: 'account_unavailable' }, 404);
    }
    if (authUser.emailVerifiedAt) {
      return c.json({ ok: false, error: 'email_already_verified', emailVerified: true }, 409);
    }
    const limited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.auth_resend_verification,
      `auth_resend_verification:${authUser.id}`,
    );
    if (limited) return limited;
    const shop = authUser.shopId ? await deps.shopsRepository.findById(authUser.shopId) : null;
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    await deps.authUsersRepository.invalidateUnusedEmailVerificationTokens(authUser.id);
    const verification = await createAndSendEmailVerification({
      authUsersRepository: deps.authUsersRepository,
      emailService: deps.emailService,
      authUserId: authUser.id,
      email: authUser.email,
      shopId: shop.id,
      shopName: shop.name,
      appBaseUrl: getAppBaseUrl(c.req),
      idempotencyPrefix: 'email-verification-resend',
    });
    return c.json({
      ok: true,
      sent: true,
      ...(process.env.NODE_ENV !== 'production' ? { verificationToken: verification.rawToken } : {}),
    });
  });

  app.get(path('/auth/user/google/start'), async (c) => {
    const appBaseUrl = getAppBaseUrl(c.req);
    const intentRaw = c.req.query('intent');
    const planRaw = c.req.query('plan');
    const intent: 'login' | 'signup' = intentRaw === 'signup' ? 'signup' : 'login';
    if (intent === 'signup') {
      if (planRaw !== 'starter' && planRaw !== 'professional') {
        return c.redirect(`${appBaseUrl}/pricing?reason=plan_required`, 302);
      }
    }
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_google_user, `auth_google_start:${intent}`);
    if (limited) return limited;
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    if (!clientId) {
      return c.json({ ok: false, error: 'google_oauth_not_configured' }, 503);
    }

    const oauthState = randomUUID();
    setCookie(c, 'rb_google_oauth_state', oauthState, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    });
    setCookie(c, 'rb_google_oauth_intent', intent, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    });
    if (intent === 'signup' && (planRaw === 'starter' || planRaw === 'professional')) {
      setCookie(c, 'rb_google_oauth_selected_plan', planRaw, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'Lax',
        path: '/',
        maxAge: 600,
      });
    } else {
      deleteCookie(c, 'rb_google_oauth_selected_plan', { path: '/' });
    }
    const redirectUri = `${appBaseUrl}/api/backend/auth/user/google/callback`;
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'select_account');
    googleAuthUrl.searchParams.set('state', oauthState);

    return c.redirect(googleAuthUrl.toString(), 302);
  });

  app.get(path('/auth/user/google/callback'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_google_user, 'auth_google_callback');
    if (limited) {
      clearUserGoogleOAuthCookies(c);
      return limited;
    }
    if (!deps.authUsersRepository || !deps.shopsRepository) {
      clearUserGoogleOAuthCookies(c);
      return c.json({ ok: false, error: 'signup_dependencies_unavailable' }, 500);
    }
    if (!deps.billingCustomersRepository || !deps.billingSubscriptionsRepository || !deps.shopAccessStatesRepository) {
      clearUserGoogleOAuthCookies(c);
      return c.json({ ok: false, error: 'billing_dependencies_unavailable' }, 500);
    }
    const state = c.req.query('state');
    const code = c.req.query('code');
    const oauthError = c.req.query('error');
    const oauthStateCookie = getCookie(c, 'rb_google_oauth_state');
    const oauthIntent = getCookie(c, 'rb_google_oauth_intent') ?? 'login';
    const oauthSelectedPlanRaw = getCookie(c, 'rb_google_oauth_selected_plan');
    clearUserGoogleOAuthCookies(c);

    const appBaseUrl = getAppBaseUrl(c.req);
    if (oauthError || !code || !state || !oauthStateCookie || state !== oauthStateCookie) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_oauth_denied`, 302);
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_oauth_not_configured`, 302);
    }
    const redirectUri = `${appBaseUrl}/api/backend/auth/user/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenResponse.ok) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_exchange_failed`, 302);
    }
    const tokenBody = (await tokenResponse.json()) as { id_token?: string };
    const idToken = tokenBody.id_token;
    if (!idToken) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_missing_id_token`, 302);
    }

    let googleProfile: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
    try {
      googleProfile = await verifyGoogleIdToken(idToken);
    } catch {
      return c.redirect(`${appBaseUrl}/user/login?error=google_verify_failed`, 302);
    }
    if (!googleProfile.emailVerified) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_email_not_verified`, 302);
    }
    if (googleProfile.aud !== clientId) {
      return c.redirect(`${appBaseUrl}/user/login?error=google_invalid_audience`, 302);
    }

    let authUser = await deps.authUsersRepository.findByEmail(googleProfile.email);
    if (authUser && authUser.role !== 'user') {
      return c.redirect(`${appBaseUrl}/user/login?error=google_role_conflict`, 302);
    }
    if (authUser && !authUser.active) {
      return c.redirect(`${appBaseUrl}/user/login?error=account_inactive`, 302);
    }
    if (authUser && oauthIntent === 'signup') {
      return c.redirect(`${appBaseUrl}/user/login?error=account_exists`, 302);
    }

    let createdViaGoogleSignup = false;
    let shop: Shop | null = null;
    if (!authUser) {
      if (oauthIntent === 'login') {
        return c.redirect(`${appBaseUrl}/user/login?error=no_ringbooker_account`, 302);
      }
      const selectedPlan =
        oauthSelectedPlanRaw === 'starter' || oauthSelectedPlanRaw === 'professional' ? oauthSelectedPlanRaw : null;
      if (!selectedPlan) {
        return c.redirect(`${appBaseUrl}/pricing?reason=plan_required`, 302);
      }
      const shopName = buildDefaultShopNameFromEmail(googleProfile.email);
      const signupCountry = normalizeCfIpCountry(c.req.header('CF-IPCountry')) ?? 'US';
      const signupCountryConfig = getCountryConfig(signupCountry);
      shop = await createShopWithPlaceholderPhoneRetry((placeholder) =>
        deps.shopsRepository!.create({
          name: shopName,
          brand_slug: toBrandSlug(shopName),
          phone_number: placeholder,
          user_phone: placeholder,
          user_name: googleProfile.name?.trim() || null,
          timezone: process.env.DEFAULT_SHOP_TIMEZONE ?? signupCountryConfig.defaultTimezone,
          plan: selectedPlan!,
          active: true,
        }),
      );
      authUser = await deps.authUsersRepository.create({
        email: googleProfile.email,
        role: 'user',
        shopId: shop.id,
        passwordHash: createOAuthFallbackPasswordHash(),
        active: true,
        mfaEnabled: false,
      });
      await deps.authUsersRepository.markEmailVerified(authUser.id);
      authUser = { ...authUser, emailVerifiedAt: new Date().toISOString() };
      await createNoCardTrialForShop(
        {
          billingCustomersRepository: deps.billingCustomersRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          shopAccessStatesRepository: deps.shopAccessStatesRepository,
        },
        {
          shopId: shop.id,
          email: authUser.email,
          plan: selectedPlan,
        },
      );
      createdViaGoogleSignup = true;
    } else if (authUser.shopId) {
      if (!authUser.emailVerifiedAt) {
        await deps.authUsersRepository.markEmailVerified(authUser.id);
        authUser = { ...authUser, emailVerifiedAt: new Date().toISOString() };
      }
      shop = await deps.shopsRepository.findById(authUser.shopId ?? '');
    }

    const token = await signSessionToken({
      role: 'user',
      email: authUser.email,
      shopId: authUser.shopId ?? undefined,
      emailVerified: Boolean(authUser.emailVerifiedAt),
      ttlHours: 24 * 14,
    });
    setCookie(c, USER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: 24 * 14 * 3600,
    });
    deleteCookie(c, ADMIN_SESSION_COOKIE, { path: '/' });

    securityAudit({
      action: createdViaGoogleSignup ? 'auth_google_signup_success' : 'auth_google_success',
      actorType: 'user',
      actorId: googleProfile.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        intent: oauthIntent,
        shopId: authUser.shopId ?? shop?.id ?? null,
      },
    });

    if (createdViaGoogleSignup && shop) {
      logger.info(
        {
          event: 'signup_completed',
          shopId: shop.id,
          authUserId: authUser.id,
          signupMethod: 'google',
          recipientDomain: emailRecipientDomain(authUser.email),
        },
        'signup_completed',
      );
      const trial = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
      await sendSignupWelcomeEmail({
        emailService: deps.emailService,
        email: authUser.email,
        shopName: shop.name,
        shopId: shop.id,
        authUserId: authUser.id,
        signupMethod: 'google',
        trialEndsAt: trial?.trialEndsAt ?? undefined,
        shopTimezone: shop.timezone,
        appBaseUrl,
        idempotencyKey: `google-signup-welcome:${authUser.id}`,
      });
    }

    const postAuthRedirect = computeUserPostAuthRedirectPath({ shop, shopId: authUser.shopId });
    // Only route through the conversion interstitial for a genuine new signup — a returning
    // user logging in via Google must keep going straight to postAuthRedirect, unchanged.
    const redirectTarget =
      createdViaGoogleSignup && shop
        ? `/signup/thank-you?shopId=${encodeURIComponent(shop.id)}&next=${encodeURIComponent(postAuthRedirect)}`
        : postAuthRedirect;
    return c.redirect(`${appBaseUrl}${redirectTarget}`, 302);
  });

  app.post(path('/auth/user/login'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const body = await c.req.json().catch(() => null);
    const parsed = authLoginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const limited = await enforceRateLimit(
      c,
      RATE_LIMIT_POLICIES.auth_login_user,
      `user_login:${parsed.data.email.toLowerCase()}`,
    );
    if (limited) return limited;

    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);
    }
    const authUser = await deps.authUsersRepository.findByEmail(parsed.data.email.toLowerCase());
    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    if (!authUser || authUser.role !== 'user' || !authUser.active || !verifyPassword(parsed.data.password, authUser.passwordHash)) {
      securityAudit({
        action: 'auth_login_failed',
        actorType: 'user',
        actorId: parsed.data.email.toLowerCase(),
        ip,
        path: c.req.path,
      });
      return c.json({ ok: false, error: 'invalid_credentials' }, 401);
    }

    const token = await signSessionToken({
      role: 'user',
      email: authUser.email,
      shopId: authUser.shopId ?? undefined,
      emailVerified: Boolean(authUser.emailVerifiedAt),
      ttlHours: parsed.data.remember ? 24 * 14 : 24,
    });

    setCookie(c, USER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: (parsed.data.remember ? 24 * 14 : 24) * 3600,
    });
    deleteCookie(c, ADMIN_SESSION_COOKIE, { path: '/' });
    securityAudit({
      action: 'auth_login_success',
      actorType: 'user',
      actorId: authUser.email,
      ip,
      path: c.req.path,
    });

    const shop =
      authUser.shopId && deps.shopsRepository ? await deps.shopsRepository.findById(authUser.shopId) : null;

    const postAuthRedirect = computeUserPostAuthRedirectPath({ shop, shopId: authUser.shopId });

    return c.json({
      ok: true,
      role: 'user',
      shopId: authUser.shopId ?? undefined,
      onboardingRequired: shop ? !isShopSetupWizardComplete(shop) : false,
      postAuthRedirect,
    });
  });

  app.post(path('/auth/admin/login'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const body = await c.req.json().catch(() => null);
    const parsed = authLoginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const limited = await enforceRateLimit(
      c,
      RATE_LIMIT_POLICIES.auth_login_admin,
      `admin_login:${parsed.data.email.toLowerCase()}`,
    );
    if (limited) return limited;

    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);
    }
    const authUser = await deps.authUsersRepository.findByEmail(parsed.data.email.toLowerCase());
    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    if (!authUser || authUser.role !== 'admin' || !authUser.active || !verifyPassword(parsed.data.password, authUser.passwordHash)) {
      securityAudit({
        action: 'auth_login_failed',
        actorType: 'admin',
        actorId: parsed.data.email.toLowerCase(),
        ip,
        path: c.req.path,
      });
      return c.json({ ok: false, error: 'invalid_credentials' }, 401);
    }

    const token = await signSessionToken({
      role: 'admin',
      email: authUser.email,
      ttlHours: parsed.data.remember ? 24 * 14 : 24,
    });

    setCookie(c, ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Lax',
      path: '/',
      maxAge: (parsed.data.remember ? 24 * 14 : 24) * 3600,
    });
    deleteCookie(c, USER_SESSION_COOKIE, { path: '/' });
    securityAudit({
      action: 'auth_login_success',
      actorType: 'admin',
      actorId: authUser.email,
      ip,
      path: c.req.path,
    });

    return c.json({
      ok: true,
      role: 'admin',
    });
  });

  app.post(path('/auth/user/forgot-password'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_forgot_user, 'auth_forgot_user');
    if (limited) return limited;
    const body = await c.req.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    if (!deps.authUsersRepository) return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);

    const email = parsed.data.email.toLowerCase();
    const authUser = await deps.authUsersRepository.findByEmail(email);
    let resetToken: string | undefined;
    if (authUser && authUser.role === 'user' && authUser.active) {
      resetToken = `${randomUUID()}${randomBytes(12).toString('hex')}`;
      await deps.authUsersRepository.createPasswordResetToken({
        userId: authUser.id,
        tokenHash: hashPasswordResetToken(resetToken),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      });
      securityAudit({
        action: 'auth_password_reset_requested',
        actorType: 'user',
        actorId: authUser.email,
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      await sendPasswordResetEmail({
        emailService: deps.emailService,
        email,
        resetToken,
        role: 'user',
        appBaseUrl: getAppBaseUrl(c.req),
      });
    }

    // Identical response whether or not the account exists — anything else lets an
    // attacker enumerate registered emails.
    return c.json({
      ok: true,
      accepted: true,
      ...(process.env.NODE_ENV !== 'production' && resetToken ? { resetToken } : {}),
    });
  });

  app.post(path('/auth/admin/forgot-password'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_forgot_admin, 'auth_forgot_admin');
    if (limited) return limited;
    const body = await c.req.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    if (!deps.authUsersRepository) return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);

    const email = parsed.data.email.toLowerCase();
    const authUser = await deps.authUsersRepository.findByEmail(email);
    let resetToken: string | undefined;
    if (authUser && authUser.role === 'admin' && authUser.active) {
      resetToken = `${randomUUID()}${randomBytes(12).toString('hex')}`;
      await deps.authUsersRepository.createPasswordResetToken({
        userId: authUser.id,
        tokenHash: hashPasswordResetToken(resetToken),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      });
      securityAudit({
        action: 'auth_password_reset_requested',
        actorType: 'admin',
        actorId: authUser.email,
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      await sendPasswordResetEmail({
        emailService: deps.emailService,
        email,
        resetToken,
        role: 'admin',
        appBaseUrl: getAppBaseUrl(c.req),
      });
    }

    // Identical response whether or not the account exists — anything else lets an
    // attacker enumerate registered admin emails.
    return c.json({
      ok: true,
      accepted: true,
      ...(process.env.NODE_ENV !== 'production' && resetToken ? { resetToken } : {}),
    });
  });

  app.post(path('/auth/reset-password'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_reset_password, 'auth_reset_password');
    if (limited) return limited;
    const body = await c.req.json().catch(() => null);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    if (!deps.authUsersRepository) return c.json({ ok: false, error: 'auth_repository_unavailable' }, 500);

    const consumed = await deps.authUsersRepository.consumePasswordResetToken(hashPasswordResetToken(parsed.data.token));
    if (!consumed) return c.json({ ok: false, error: 'invalid_or_expired_token' }, 400);

    await deps.authUsersRepository.updatePasswordHash(consumed.userId, hashPassword(parsed.data.newPassword));
    securityAudit({
      action: 'auth_password_reset_completed',
      actorType: 'public',
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { userId: consumed.userId },
    });

    return c.json({ ok: true, updated: true });
  });

  app.post(path('/auth/logout'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    deleteCookie(c, USER_SESSION_COOKIE, { path: '/' });
    deleteCookie(c, ADMIN_SESSION_COOKIE, { path: '/' });
    securityAudit({
      action: 'auth_logout',
      actorType: 'public',
      ip,
      path: c.req.path,
    });
    return c.json({ ok: true });
  });

  app.get(path('/auth/me'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.auth_session_read, 'auth_me');
    if (limited) return limited;
    const session = await readSession(c);
    if (!session) return c.json({ ok: true, session: null });
    const authUser = session.role === 'user' && deps.authUsersRepository
      ? await deps.authUsersRepository.findByEmail(session.email).catch(() => null)
      : null;
    return c.json({
      ok: true,
      session: {
        ...session,
        emailVerified: session.role === 'user' ? Boolean(authUser?.emailVerifiedAt ?? session.emailVerified) : undefined,
      },
    });
  });
}
