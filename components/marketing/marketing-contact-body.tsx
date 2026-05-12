'use client';

import { Suspense, useCallback, useState } from 'react';

const STEP1_IDS = [
  'contactFullName',
  'contactBusinessName',
  'contactEmail',
  'contactPhoneNumber',
  'contactBusinessType',
  'contactCurrentSetup',
  'contactBestTime',
] as const;

function readField(id: string): string {
  if (typeof document === 'undefined') return '';
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return el.value?.trim() ?? '';
  }
  return '';
}

function MarketingContactBodyInner() {
  const [currentStep, setCurrentStep] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [step1Errors, setStep1Errors] = useState<Partial<Record<(typeof STEP1_IDS)[number], string>>>({});

  const validateStep1 = useCallback((): boolean => {
    const next: Partial<Record<(typeof STEP1_IDS)[number], string>> = {};
    if (!readField('contactFullName')) next.contactFullName = 'Required';
    if (!readField('contactBusinessName')) next.contactBusinessName = 'Required';
    if (!readField('contactEmail')) next.contactEmail = 'Required';
    if (!readField('contactPhoneNumber')) next.contactPhoneNumber = 'Required';
    if (!readField('contactBusinessType')) next.contactBusinessType = 'Required';
    if (!readField('contactCurrentSetup')) next.contactCurrentSetup = 'Required';
    if (!readField('contactBestTime')) next.contactBestTime = 'Required';
    setStep1Errors(next);
    return Object.keys(next).length === 0;
  }, []);

  const goToStep2 = useCallback(() => {
    if (!validateStep1()) return;
    setCurrentStep(2);
  }, [validateStep1]);

  const goToStep1 = useCallback(() => {
    setCurrentStep(1);
  }, []);

  const fieldError = (id: (typeof STEP1_IDS)[number]) => step1Errors[id];

  return (
    <section className="hero-page contact-hero-reflow">
      <div className="contact-custom-shell">
        <nav aria-label="Breadcrumb" className="contact-breadcrumb contact-breadcrumb--shell">
          <a href="/">Home</a>
          <span className="contact-breadcrumb-sep">›</span>
          <span>Contact</span>
        </nav>
        <div className="contact-value-col">
          <span className="contact-value-badge" id="contactFormChip">
            Contact
          </span>
          <h1 className="contact-value-h1" id="contactHeroTitle">
            Contact RingBooker
          </h1>
          <p className="contact-value-sub" id="contactHeroSubtitle">
            Send us a note and we&apos;ll route it to the right RingBooker team member.
          </p>
          <ul className="contact-value-checklist" aria-label="Why RingBooker">
            <li className="contact-value-check-item">
              <span className="contact-value-check-icon" aria-hidden>
                ✓
              </span>
              <span>
                <strong>Keep your current number</strong>
                <span className="contact-value-check-desc">Forward the number clients already call.</span>
              </span>
            </li>
            <li className="contact-value-check-item">
              <span className="contact-value-check-icon" aria-hidden>
                ✓
              </span>
              <span>
                <strong>No new booking software</strong>
                <span className="contact-value-check-desc">Works with your current workflow.</span>
              </span>
            </li>
            <li className="contact-value-check-item">
              <span className="contact-value-check-icon" aria-hidden>
                ✓
              </span>
              <span>
                <strong>Built for booking recovery</strong>
                <span className="contact-value-check-desc">Covers after-hours, overflow, and missed calls.</span>
              </span>
            </li>
            <li className="contact-value-check-item">
              <span className="contact-value-check-icon" aria-hidden>
                ✓
              </span>
              <span>
                <strong>Multi-location routing</strong>
                <span className="contact-value-check-desc">Custom rules per location or team.</span>
              </span>
            </li>
          </ul>
        </div>

        <div className="contact-form-card" id="book-demo">
          <h2 id="contactFormTitle" className="contact-form-title-sr">
            Contact RingBooker
          </h2>

          <form id="contactRequestForm">
            <div className={`contact-step-panels contact-step-panels--step-${currentStep}`}>
              <div className="contact-step-indicator" aria-hidden="true">
                <div className="contact-step-indicator__nodes">
                  <span className={`contact-step-dot ${currentStep === 1 ? 'active' : 'done'}`}>{currentStep === 1 ? '1' : '✓'}</span>
                  <span className={`contact-step-line ${currentStep === 2 ? 'done' : ''}`} />
                  <span className={`contact-step-dot ${currentStep === 2 ? 'active' : ''}`}>2</span>
                </div>
              </div>

              <div className="contact-step-panel" data-contact-step="1" hidden={currentStep !== 1}>
                <h3 className="contact-step-heading">Your contact details</h3>
                <p className="contact-step-lead">Basic info so we can reach you and prepare for the call.</p>

                <div className="contact-field-row">
                  <div className="contact-field">
                    <label htmlFor="contactFullName">Full name</label>
                    <input id="contactFullName" placeholder="Jane Nguyen" required aria-invalid={fieldError('contactFullName') ? true : undefined} />
                    {fieldError('contactFullName') ? <span className="contact-field-error">{fieldError('contactFullName')}</span> : null}
                  </div>
                  <div className="contact-field">
                    <label htmlFor="contactBusinessName">Business name</label>
                    <input id="contactBusinessName" placeholder="Luxe Hair Studio" required aria-invalid={fieldError('contactBusinessName') ? true : undefined} />
                    {fieldError('contactBusinessName') ? <span className="contact-field-error">{fieldError('contactBusinessName')}</span> : null}
                  </div>
                </div>
                <div className="contact-field-row">
                  <div className="contact-field">
                    <label htmlFor="contactEmail">Email</label>
                    <input id="contactEmail" type="email" placeholder="jane@luxehair.com" required aria-invalid={fieldError('contactEmail') ? true : undefined} />
                    {fieldError('contactEmail') ? <span className="contact-field-error">{fieldError('contactEmail')}</span> : null}
                  </div>
                  <div className="contact-field">
                    <label htmlFor="contactPhoneNumber">Phone number</label>
                    <input id="contactPhoneNumber" placeholder="+1 (714) 555-0100" required aria-invalid={fieldError('contactPhoneNumber') ? true : undefined} />
                    {fieldError('contactPhoneNumber') ? <span className="contact-field-error">{fieldError('contactPhoneNumber')}</span> : null}
                  </div>
                </div>
                <div className="contact-field-row">
                  <div className="contact-field">
                    <label htmlFor="contactBusinessType">Business type</label>
                    <select id="contactBusinessType" required defaultValue="nail_shop" aria-invalid={fieldError('contactBusinessType') ? true : undefined}>
                      <option value="nail_shop">Nail salon</option>
                      <option value="hair_salon">Hair salon</option>
                      <option value="spa">Day spa</option>
                      <option value="med_spa">Med spa</option>
                      <option value="beauty_clinic">Beauty clinic</option>
                    </select>
                    {fieldError('contactBusinessType') ? <span className="contact-field-error">{fieldError('contactBusinessType')}</span> : null}
                  </div>
                  <div className="contact-field">
                    <label htmlFor="contactCurrentSetup">Main need</label>
                    <select id="contactCurrentSetup" required defaultValue="after_hours_overflow" aria-invalid={fieldError('contactCurrentSetup') ? true : undefined}>
                      <option value="after_hours_overflow">After-hours or overflow calls</option>
                      <option value="missed_call_text_back">Missed-call text back</option>
                      <option value="reschedules_cancellations">Reschedules or cancellations</option>
                      <option value="current_number_setup">Use my current number</option>
                      <option value="custom_workflow">Custom workflow or multi-location</option>
                    </select>
                    {fieldError('contactCurrentSetup') ? <span className="contact-field-error">{fieldError('contactCurrentSetup')}</span> : null}
                  </div>
                </div>
                <div className="contact-field contact-field--full">
                  <label htmlFor="contactBestTime">Best time to reach you</label>
                  <input id="contactBestTime" placeholder="Weekdays after 3 PM PST" required aria-invalid={fieldError('contactBestTime') ? true : undefined} />
                  {fieldError('contactBestTime') ? <span className="contact-field-error">{fieldError('contactBestTime')}</span> : null}
                </div>

                <div className="contact-step-nav contact-step-nav--1">
                  <span className="contact-step-label">Step 1 of 2</span>
                  <button type="button" className="contact-btn-continue" onClick={goToStep2}>
                    Continue →
                  </button>
                </div>
              </div>

              <div className="contact-step-panel" data-contact-step="2" hidden={currentStep !== 2}>
                <h3 className="contact-step-heading">Your setup details</h3>
                <p className="contact-step-lead">Help us understand your volume and technical needs.</p>

                <div id="enterpriseContactFields" style={{ display: 'none' }} className="contact-enterprise-fields">
                  <div className="contact-field-row">
                    <div className="contact-field">
                      <label htmlFor="contactNumberOfLocations">
                        Number of locations <span className="optional-tag">(optional)</span>
                      </label>
                      <input id="contactNumberOfLocations" type="number" min={1} placeholder="3" />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="contactEstimatedMonthlyCallVolume">
                        Monthly call volume <span className="optional-tag">(optional)</span>
                      </label>
                      <input id="contactEstimatedMonthlyCallVolume" placeholder="500-1,000 calls/month" />
                    </div>
                  </div>
                  <div className="contact-field-row">
                    <div className="contact-field">
                      <label htmlFor="contactCurrentPhoneProvider">
                        Phone provider <span className="optional-tag">(optional)</span>
                      </label>
                      <input id="contactCurrentPhoneProvider" placeholder="Verizon, Comcast, RingCentral..." />
                    </div>
                    <div className="contact-field">
                      <label htmlFor="contactCurrentBookingSoftware">
                        Booking software <span className="optional-tag">(optional)</span>
                      </label>
                      <input id="contactCurrentBookingSoftware" placeholder="Square, Vagaro, GlossGenius..." />
                    </div>
                  </div>

                  <div className="contact-advanced-block">
                    <button type="button" className="contact-advanced-toggle" onClick={() => setAdvancedOpen((v) => !v)} aria-expanded={advancedOpen}>
                      {advancedOpen ? '− Hide technical details' : '+ Add technical details (routing, integrations, escalation)'}
                    </button>
                    {advancedOpen ? (
                      <div className="contact-advanced-fields">
                        <div className="contact-field-row">
                          <div className="contact-field">
                            <label htmlFor="contactCurrentCrm">
                              CRM <span className="optional-tag">(optional)</span>
                            </label>
                            <input id="contactCurrentCrm" placeholder="HubSpot, Boulevard, none..." />
                          </div>
                          <div className="contact-field">
                            <label htmlFor="contactLanguagesNeeded">
                              Languages needed <span className="optional-tag">(optional)</span>
                            </label>
                            <input id="contactLanguagesNeeded" placeholder="English, Vietnamese, Spanish" />
                          </div>
                        </div>
                        <div className="contact-field contact-field--full">
                          <label htmlFor="contactLocationsText">
                            Locations list <span className="optional-tag">(optional)</span>
                          </label>
                          <textarea id="contactLocationsText" placeholder="List locations, cities, or business lines." />
                        </div>
                        <div className="contact-field contact-field--full">
                          <label htmlFor="contactRoutingRules">
                            Routing rules <span className="optional-tag">(optional)</span>
                          </label>
                          <textarea id="contactRoutingRules" placeholder="e.g. Vietnamese callers to owner, Botox consults to coordinator" />
                        </div>
                        <div className="contact-field contact-field--full">
                          <label htmlFor="contactEscalationRules">
                            Escalation rules <span className="optional-tag">(optional)</span>
                          </label>
                          <textarea id="contactEscalationRules" placeholder="e.g. Urgent complaints to manager, refunds to owner" />
                        </div>
                        <div className="contact-field contact-field--full">
                          <label htmlFor="contactIntegrationRequirements">
                            Integration requirements <span className="optional-tag">(optional)</span>
                          </label>
                          <textarea id="contactIntegrationRequirements" placeholder="Calendar, booking software, CRM, or custom workflow needs" />
                        </div>
                        <div className="contact-field-row">
                          <div className="contact-field">
                            <label htmlFor="contactMainContact">
                              Main contact <span className="optional-tag">(optional)</span>
                            </label>
                            <input id="contactMainContact" placeholder="Operations lead or owner" />
                          </div>
                          <div className="contact-field">
                            <label htmlFor="contactPreferredGoLiveTimeline">
                              Go-live timeline <span className="optional-tag">(optional)</span>
                            </label>
                            <input id="contactPreferredGoLiveTimeline" placeholder="Next 30 days, next quarter..." />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="contact-field contact-field--full">
                  <label htmlFor="contactHelpNeed">
                    Anything we should know? <span className="optional-tag">(optional)</span>
                  </label>
                  <textarea
                    id="contactHelpNeed"
                    placeholder="e.g. We miss calls during peak hours. Vietnamese callers route to owner."
                    defaultValue=""
                  />
                </div>

                <div className="contact-field contact-field--full contact-honeypot">
                  <label htmlFor="contactWebsite">Website</label>
                  <input id="contactWebsite" autoComplete="off" tabIndex={-1} />
                </div>
                <div className="contact-field contact-field--full">
                  <span className="contact-turnstile-label" id="contactTurnstileFieldLabel">
                    Human verification
                  </span>
                  <div className="contact-turnstile-frame" role="region" aria-labelledby="contactTurnstileFieldLabel">
                    <div id="contactTurnstileMount" />
                  </div>
                  <p className="contact-turnstile-hint" id="contactTurnstileHint" aria-live="polite" />
                </div>

                <button id="contactSubmitButton" type="submit" className="contact-btn-submit">
                  Send message
                </button>
                <p className="contact-helper-block" id="contactHelper">
                  Protected by captcha and rate limits.
                </p>
                <p className="contact-trust-foot">🔒 Protected by Cloudflare · rate limited</p>

                <div className="contact-step-nav contact-step-nav--2">
                  <button type="button" className="contact-btn-back" onClick={goToStep1}>
                    ← Back
                  </button>
                  <span className="contact-step-label contact-step-label--muted">Step 2 of 2</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export function MarketingContactBody() {
  return (
    <Suspense fallback={<section className="hero-page contact-hero-reflow" />}>
      <MarketingContactBodyInner />
    </Suspense>
  );
}
