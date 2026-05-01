export function getDemoRequestConfirmationEmail(params: {
  firstName: string;
  businessName?: string;
  businessType?: string;
}): {
  subject: string;
  text: string;
} {
  const name = params.firstName || 'there';

  return {
    subject: `We got your demo request, ${name} — talk soon!`,
    text: `Hi ${name},

Thanks for reaching out about RingBooker!

We received your demo request and will be in touch 
within 24 hours to schedule a time.

Here's what to expect:
- A quick 15-minute demo call
- We'll show how it works on your current number
- No pressure — just a walkthrough

In the meantime, you can try a live demo call 
anytime at:
https://ringbooker.com/demo

Talk soon,
The RingBooker Team

---
RingBooker · AI receptionist for beauty businesses
hello@ringbooker.com | ringbooker.com`,
  };
}
