import { withLogContext } from '@/src/backend/observability/logger';
import type { EmailCategory, EmailService, EmailSendResult } from '@/src/backend/services/email/types';

type ResendSendResponse = {
  id?: string;
  error?: {
    message?: string;
  };
};

export class ResendEmailService implements EmailService {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
  ) {}

  async sendEmail(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    category: EmailCategory;
    idempotencyKey: string;
    shopId?: string;
    replyTo?: string;
    from?: string;
  }): Promise<EmailSendResult> {
    const log = withLogContext({
      provider: 'resend',
      shopId: params.shopId,
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify({
        from: params.from ?? this.fromEmail,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
        reply_to: params.replyTo,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      log.error(
        {
          status: response.status,
          category: params.category,
          bodyText,
        },
        'resend_email_send_failed',
      );
      throw new Error(`resend_email_send_failed:${response.status}`);
    }

    const body = (await response.json()) as ResendSendResponse;
    if (body.error?.message) {
      throw new Error(`resend_email_send_failed:${body.error.message}`);
    }

    log.info(
      {
        category: params.category,
        providerMessageId: body.id,
      },
      'resend_email_sent',
    );

    return {
      providerMessageId: body.id,
    };
  }
}
