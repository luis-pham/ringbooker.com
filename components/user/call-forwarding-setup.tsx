'use client';

import React, { useEffect, useMemo, useState } from 'react';

import {
  buildDialCode,
  CARRIER_DATA,
  findCarrier,
  findCountry,
  FORWARDING_TYPE_META,
  getForwardingCode,
  type Carrier,
  type ForwardingType,
} from '@/lib/call-forwarding/carrier-data';

type SetupMethod = 'forward';
type SetupState = 'forward_setup' | 'testing' | 'success' | 'failed' | 'skipped';

type CallForwardingSetupProps = {
  ringbookerNumber: string;
  callForwardingPageUrl?: string;
  onComplete?: (method: SetupMethod) => void;
  onSkip?: () => void;
  /** Legacy DB values always map to forward UI (RingBooker forwarding number behind the scenes). */
  initialMethod?: SetupMethod | 'new_number';
  initialCarrier?: string;
  initialCountry?: string;
  initialForwardingType?: ForwardingType;
  /** Hide "test forwarding" CTA — use when verification is not yet reliable (e.g. post-provision onboarding). */
  suppressForwardingTestCta?: boolean;
};

const FORWARDING_TYPE_ORDER: ForwardingType[] = ['no_answer', 'all', 'busy', 'unreachable'];

function normalizeNumber(value: string) {
  return value.trim().replace(/[\s().-]/g, '');
}

function carrierInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }
  return <button type="button" className="cf-copy" onClick={copy} disabled={!value}>{copied ? 'Copied' : 'Copy'}</button>;
}

function CarrierLogo({ carrier }: { carrier: Carrier }) {
  if (carrier.logoPath) return <img src={carrier.logoPath} alt={`${carrier.name} logo`} className="cf-logo-img" />;
  return <div className="cf-logo-fallback" style={{ background: carrier.color }} aria-hidden>{carrierInitials(carrier.name)}</div>;
}

export function getInitialSetupState(_initialMethod?: SetupMethod | 'new_number'): SetupState {
  return 'forward_setup';
}

export function getGeneratedDialCode(carrier: Carrier | null, type: ForwardingType, number: string): string | null {
  const code = getForwardingCode(carrier, type);
  return code ? buildDialCode(code, normalizeNumber(number)) : null;
}

async function saveForwardingPatch(patch: Record<string, unknown>) {
  await fetch('/api/backend/user/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function CallForwardingSetup({
  ringbookerNumber,
  callForwardingPageUrl = '/current-number/call-forwarding',
  onComplete,
  onSkip,
  initialMethod,
  initialCarrier,
  initialCountry = 'us',
  initialForwardingType = 'no_answer',
  suppressForwardingTestCta = false,
}: CallForwardingSetupProps) {
  void initialMethod;

  const [setupState, setSetupState] = useState<SetupState>('forward_setup');
  const [selectedMethod] = useState<SetupMethod>('forward');
  const [selectedCountry, setSelectedCountry] = useState(initialCountry || 'us');
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(() => findCarrier(initialCountry || 'us', initialCarrier));
  const [selectedForwardingType, setSelectedForwardingType] = useState<ForwardingType>(initialForwardingType);
  const [lastResultFailed, setLastResultFailed] = useState(false);

  const country = useMemo(() => findCountry(selectedCountry), [selectedCountry]);
  const normalizedNumber = normalizeNumber(ringbookerNumber);
  const selectedCode = getForwardingCode(selectedCarrier, selectedForwardingType);
  const dialCode = selectedCode ? buildDialCode(selectedCode, normalizedNumber) : null;
  const selectedTypeMeta = FORWARDING_TYPE_META[selectedForwardingType];

  useEffect(() => {
    if (setupState !== 'testing') return;
    setLastResultFailed(false);
    void runForwardingTest();
  }, [setupState]);

  function chooseCarrier(carrier: Carrier) {
    const nextType = carrier.forwardingCodes.some((item) => item.type === carrier.defaultType)
      ? carrier.defaultType
      : carrier.forwardingCodes[0]?.type ?? carrier.defaultType;
    setSelectedCarrier(carrier);
    setSelectedForwardingType(nextType);
    void saveForwardingPatch({ forwarding_carrier: carrier.id, forwarding_country: selectedCountry, forwarding_type: nextType });
  }

  function chooseForwardingType(type: ForwardingType) {
    setSelectedForwardingType(type);
    void saveForwardingPatch({ forwarding_type: type });
  }

  async function runForwardingTest() {
    try {
      const start = await fetch('/api/backend/user/go-live/start-forwarding-test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const startBody = (await start.json().catch(() => null)) as { ok?: boolean } | null;
      if (!start.ok || !startBody?.ok) {
        setLastResultFailed(true);
        return;
      }
      const deadline = Date.now() + 11 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const st = await fetch('/api/backend/user/go-live/status', { credentials: 'include' });
        const stBody = (await st.json().catch(() => null)) as { ok?: boolean; forwardingSetupVerified?: boolean } | null;
        if (stBody?.ok && stBody.forwardingSetupVerified) {
          setSetupState('success');
          return;
        }
      }
      setLastResultFailed(true);
    } catch {
      setLastResultFailed(true);
    }
  }

  function complete(method: SetupMethod) {
    void saveForwardingPatch({ setup_method: method });
    onComplete?.(method);
  }

  function renderMethodIntro() {
    return (
      <div className="cf-blue" style={{ marginBottom: 16 }}>
        <strong>Use your current business number.</strong>
        <br />
        Your customers keep calling the number they already know. This RingBooker forwarding number is used only behind the scenes when you turn on call forwarding with your carrier.
      </div>
    );
  }

  function renderNumberBox() {
    return (
      <div className="cf-number-box">
        <span className="cf-mono">{normalizedNumber || 'Being assigned...'}</span>
        <CopyButton value={normalizedNumber} />
      </div>
    );
  }

  function renderSteps() {
    const steps = selectedCarrier?.appSteps?.length
      ? selectedCarrier.appSteps
      : ['Open your phone dialer', dialCode ? `Dial ${dialCode} and press call` : 'Dial the forwarding code from your carrier', "You'll hear a confirmation tone - forwarding is now active"];
    return (
      <ol className="cf-steps">
        {steps.map((step, index) => <li className="cf-step" key={step}><span className="cf-step-num">{index + 1}</span><span>{step}</span></li>)}
      </ol>
    );
  }

  return (
    <div className="cf-setup">
      <style>{`
.cf-setup{border:0;border-radius:14px;background:#fff;padding:0;color:#111827}.cf-title{margin:0;font-size:15px;font-weight:500;color:#111827;line-height:1.25}.cf-sub{margin:6px 0 0;color:#64748b;font-size:14px;line-height:1.55}.cf-label{display:block;margin:0 0 5px;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}.cf-method-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.cf-method-card{display:flex;gap:12px;text-align:left;border:.5px solid #e2e8f0;border-radius:14px;background:#fff;padding:16px;cursor:pointer}.cf-method-card.selected{border-color:#7c3aed;background:#faf5ff}.cf-radio-circle{width:18px;height:18px;border-radius:999px;border:1.5px solid #cbd5e1;flex-shrink:0;margin-top:2px}.cf-radio-circle.selected{border-color:#7c3aed;background:radial-gradient(circle,#fff 0 35%,#7c3aed 38%)}.cf-method-content{display:grid;gap:8px;align-content:start}.cf-method-title-row{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap}.cf-method-title{font-size:15px;font-weight:500;color:#111827;line-height:1.3}.cf-recommended{display:inline-flex;border-radius:999px;background:#dcfce7;color:#16a34a;padding:3px 9px;font-size:11px;font-weight:500}.cf-method-desc,.cf-bullets,.cf-help,.cf-note{font-size:13px;color:#64748b;line-height:1.5}.cf-bullets{display:grid;gap:3px;color:#475569}.cf-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px}.cf-primary{display:inline-flex;align-items:center;justify-content:center;height:38px;border:0;border-radius:8px;background:#6d28d9;color:#fff;padding:8px 16px;font-size:13px;font-weight:500;cursor:pointer;box-shadow:0 8px 18px rgba(109,40,217,.18)}.cf-primary:hover:not(:disabled){background:#5b21b6;box-shadow:0 12px 24px rgba(109,40,217,.24)}.cf-primary:disabled{opacity:.45;cursor:not-allowed}.onb-help{font-size:13px;color:#64748b;margin:0}.onb-help-link{border:0;background:transparent;padding:8px 0;cursor:pointer;text-decoration:none;font-family:inherit;font-weight:400;line-height:1.5;text-align:inherit;transition:color .15s ease}.onb-help-link:hover{color:#334155;text-decoration:underline;text-underline-offset:2px}.onb-help-link:focus-visible{outline:2px solid rgba(124,58,237,.35);outline-offset:2px}.cf-select{height:40px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;background:#fff;color:#111827;width:100%;box-sizing:border-box}.cf-section--country .cf-select{display:block}@media(min-width:641px){.cf-section--country .cf-select{max-width:280px}}.cf-section{margin-top:18px}.cf-carrier-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cf-carrier-card{display:flex;align-items:center;gap:8px;border:.5px solid #e2e8f0;border-radius:12px;background:#fff;padding:10px;cursor:pointer}.cf-carrier-card.selected{border-color:#7c3aed;background:#faf5ff}.cf-logo-img{width:32px;height:20px;object-fit:contain;flex-shrink:0}.cf-logo-fallback{width:32px;height:20px;border-radius:3px;color:#fff;font-size:8px;font-weight:600;display:flex;align-items:center;justify-content:center}.cf-carrier-name{font-size:11px;color:#6b7280;font-weight:500}.cf-type-list{display:grid;gap:8px}.cf-type-row{display:flex;gap:10px;border:.5px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff;cursor:pointer;text-align:left}.cf-type-row.selected{border-color:#7c3aed;background:#faf5ff}.cf-type-row.disabled{opacity:.4;pointer-events:none}.cf-type-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:14px;font-weight:500;color:#111827}.cf-type-desc{display:block;margin-top:2px;font-size:13px;color:#64748b}.cf-number-box,.cf-code-box{display:flex;align-items:center;justify-content:space-between;gap:12px;border:.5px solid #e2e8f0;border-radius:10px;padding:10px 14px}.cf-code-box{background:#f8fafc}.cf-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:16px;font-weight:600;overflow-wrap:anywhere}.cf-copy{height:32px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;color:#475569;padding:6px 12px;font-size:12px;font-weight:500;cursor:pointer}.cf-steps{display:grid;gap:10px;margin:0;padding:0;list-style:none}.cf-step{display:flex;gap:10px;align-items:flex-start;color:#374151;font-size:14px;line-height:1.5}.cf-step-num{width:24px;height:24px;border-radius:999px;background:#ede9fe;color:#7c3aed;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0}.cf-back{margin-bottom:14px}.cf-info-card{border:.5px solid #e2e8f0;border-radius:14px;padding:16px;margin-top:16px;font-size:14px;line-height:1.6;color:#374151}.cf-blue{background:#e6f1fb;border:1px solid #b5d4f4;border-radius:12px;padding:12px;margin-top:14px;color:#1e3a5f;font-size:13px;line-height:1.55}.cf-feature-list{display:grid;gap:6px;margin-top:12px;color:#475569;font-size:13px}.cf-state{text-align:center;padding:28px 12px}.cf-spinner{width:40px;height:40px;border:3px solid #e2e8f0;border-top:3px solid #7c3aed;border-radius:50%;animation:cfSpin 1s linear infinite;margin:0 auto 14px}.cf-icon{width:56px;height:56px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:600;margin-bottom:12px}.cf-icon.success{background:#dcfce7;color:#16a34a}.cf-icon.warn{background:#fef3c7;color:#d97706}.cf-icon.neutral{background:#f1f5f9;color:#64748b}.cf-badge{display:inline-flex;margin-top:12px;border-radius:999px;background:#dcfce7;color:#16a34a;padding:5px 11px;font-size:12px;font-weight:500}.cf-tips{display:grid;gap:6px;text-align:left;max-width:390px;margin:14px auto 0;color:#475569;font-size:13px}.cf-guide{display:inline-flex;margin-top:10px;color:#6d28d9;font-size:13px;font-weight:500;text-decoration:none}html[data-user-theme="dark"] .cf-setup{border:0;background:#161b22;color:#e6edf3}html[data-user-theme="dark"] .cf-title{color:#e6edf3}html[data-user-theme="dark"] .cf-sub{color:#8b949e}html[data-user-theme="dark"] .cf-label{color:#8b949e}html[data-user-theme="dark"] .cf-method-card,html[data-user-theme="dark"] .cf-carrier-card,html[data-user-theme="dark"] .cf-type-row{border-color:#30363d;background:#161b22}html[data-user-theme="dark"] .cf-method-card.selected,html[data-user-theme="dark"] .cf-carrier-card.selected,html[data-user-theme="dark"] .cf-type-row.selected{border-color:#58a6ff;background:rgba(56,139,253,.12)}html[data-user-theme="dark"] .cf-radio-circle{border-color:#484f58}html[data-user-theme="dark"] .cf-radio-circle.selected{border-color:#58a6ff;background:radial-gradient(circle,#21262d 0 35%,#58a6ff 38%)}html[data-user-theme="dark"] .cf-method-title,html[data-user-theme="dark"] .cf-type-title{color:#e6edf3}html[data-user-theme="dark"] .cf-method-desc,html[data-user-theme="dark"] .cf-type-desc,html[data-user-theme="dark"] .cf-note,html[data-user-theme="dark"] .cf-bullets,html[data-user-theme="dark"] .cf-help{color:#8b949e}html[data-user-theme="dark"] .cf-recommended{background:rgba(63,185,80,.15);color:#3fb950}html[data-user-theme="dark"] .cf-select{border-color:#30363d;background:#0d1117;color:#e6edf3}html[data-user-theme="dark"] .cf-number-box,html[data-user-theme="dark"] .cf-code-box{border-color:#30363d;background:#0d1117}html[data-user-theme="dark"] .cf-mono{color:#e6edf3}html[data-user-theme="dark"] .cf-copy{border-color:#30363d;background:#21262d;color:#8b949e}html[data-user-theme="dark"] .cf-step{color:#e6edf3}html[data-user-theme="dark"] .cf-step-num{background:rgba(88,166,255,.15);color:#79c0ff}html[data-user-theme="dark"] .cf-blue{background:#21262d;border-color:#30363d;color:#8b949e}html[data-user-theme="dark"] .cf-feature-list{color:#8b949e}html[data-user-theme="dark"] .cf-spinner{border-color:#30363d;border-top-color:#a371f7}html[data-user-theme="dark"] .cf-icon.success{background:rgba(63,185,80,.15);color:#3fb950}html[data-user-theme="dark"] .cf-icon.warn{background:rgba(210,153,34,.15);color:#d29922}html[data-user-theme="dark"] .cf-icon.neutral{background:#21262d;color:#8b949e}html[data-user-theme="dark"] .cf-badge{background:rgba(63,185,80,.15);color:#3fb950}html[data-user-theme="dark"] .cf-tips{color:#8b949e}html[data-user-theme="dark"] .cf-guide{color:#a371f7}html[data-user-theme="dark"] .onb-help{color:#8b949e}html[data-user-theme="dark"] .onb-help-link{color:#8b949e}html[data-user-theme="dark"] .onb-help-link:hover{color:#e6edf3}html[data-user-theme="dark"] .cf-primary{background:#1f6feb;box-shadow:none}html[data-user-theme="dark"] .cf-primary:hover:not(:disabled){background:#388bfd;box-shadow:none}html[data-user-theme="dark"] .cf-info-card{border-color:#30363d;background:#161b22;color:#e6edf3}@keyframes cfSpin{to{transform:rotate(360deg)}}@media(min-width:900px){.cf-carrier-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}@media(max-width:640px){.cf-method-grid{grid-template-columns:1fr}.cf-carrier-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cf-actions{flex-direction:column;align-items:stretch}.cf-primary{width:100%;order:1}.cf-actions .onb-help-link{order:2;text-align:center}.cf-number-box,.cf-code-box{align-items:flex-start;flex-direction:column}}
      `}</style>

      {setupState === 'forward_setup' ? (
        <div>
          {renderMethodIntro()}
          <h3 className="cf-title">Forward from your current business line</h3>
          <p className="cf-sub">Select your country and carrier to see forwarding codes for your RingBooker forwarding number.</p>
          <div className="cf-section cf-section--country"><label className="cf-label" htmlFor="cf-country">Country</label><select id="cf-country" className="cf-select" value={selectedCountry} onChange={(event) => { setSelectedCountry(event.target.value); setSelectedCarrier(null); void saveForwardingPatch({ forwarding_country: event.target.value }); }}>{CARRIER_DATA.map((item) => <option key={item.countryCode} value={item.countryCode}>{item.flag} {item.countryName}</option>)}</select></div>
          <div className="cf-section"><p className="cf-label">Select your carrier</p><div className="cf-carrier-grid">{country.carriers.map((carrier) => <button key={carrier.id} type="button" className={`cf-carrier-card ${selectedCarrier?.id === carrier.id ? 'selected' : ''}`} onClick={() => chooseCarrier(carrier)}><CarrierLogo carrier={carrier} /><span className="cf-carrier-name">{carrier.name}</span></button>)}</div></div>
          {selectedCarrier ? <>
            <div className="cf-section"><p className="cf-label">Which calls should RingBooker answer?</p><div className="cf-type-list">{FORWARDING_TYPE_ORDER.map((type) => { const available = selectedCarrier.forwardingCodes.some((code) => code.type === type); const meta = FORWARDING_TYPE_META[type]; return <button key={type} type="button" className={`cf-type-row ${selectedForwardingType === type ? 'selected' : ''} ${available ? '' : 'disabled'}`} onClick={() => available && chooseForwardingType(type)}><span className={`cf-radio-circle ${selectedForwardingType === type ? 'selected' : ''}`} /><span><span className="cf-type-title">{meta.label}{meta.recommended ? <span className="cf-recommended">Recommended</span> : null}</span><span className="cf-type-desc">{meta.description}</span></span></button>; })}</div></div>
            <div className="cf-section"><p className="cf-label">RingBooker forwarding number</p>{renderNumberBox()}<p className="cf-note" style={{ marginTop: 8 }}>Dial this on your carrier using the code below — customers still call your published business number.</p></div>
            {dialCode ? <div className="cf-section"><p className="cf-label">Dial this code on your phone</p><div className="cf-code-box"><span className="cf-mono">{dialCode}</span><CopyButton value={dialCode} /></div></div> : null}
            <div className="cf-section"><p className="cf-label">Steps</p>{renderSteps()}{selectedCode?.cancelCode ? <p className="cf-note">To turn off: dial {selectedCode.cancelCode} and press call</p> : null}<a className="cf-guide" href={callForwardingPageUrl} target="_blank" rel="noreferrer">Need help? View full carrier guide →</a></div>
          </> : null}
          <div className="cf-actions">
            <button type="button" className="onb-help onb-help-link" onClick={() => setSetupState('skipped')}>Skip — set up later</button>
            {suppressForwardingTestCta ? (
              <span className="cf-note" style={{ textAlign: 'right', flex: 1 }}>
                Complete forwarding on your phone using the steps above. Live answering stays off until a later verification step.
              </span>
            ) : (
              <button type="button" className="cf-primary" disabled={!selectedCarrier} onClick={() => setSetupState('testing')}>
                Optional check — try connectivity test
              </button>
            )}
          </div>
        </div>
      ) : null}

      {setupState === 'testing' ? <div className="cf-state"><div className="cf-spinner" /><h3 className="cf-title">Waiting for your forwarded call…</h3><p className="cf-sub">Call your current business number from another phone so your carrier forwards to RingBooker. This can take a minute after you start forwarding at your carrier.</p>{lastResultFailed ? <div><div className="cf-icon warn">!</div><h3 className="cf-title">Not detected yet</h3><div className="cf-tips"><span>• Place a real call to your business line (not the RingBooker forwarding number)</span><span>• Confirm forwarding targets your RingBooker forwarding number</span><span>• Tests expire after about 10 minutes — try starting again</span></div>{dialCode ? <div className="cf-code-box" style={{ marginTop: 14 }}><span className="cf-mono">{dialCode}</span><CopyButton value={dialCode} /></div> : null}<div className="cf-actions" style={{ justifyContent: 'center' }}><button type="button" className="onb-help onb-help-link" onClick={() => setSetupState('skipped')}>Skip</button><button type="button" className="cf-primary" onClick={() => setSetupState('testing')}>Test again</button></div></div> : null}</div> : null}
      {setupState === 'success' ? <div className="cf-state"><div className="cf-icon success">✓</div><h3 className="cf-title">Check finished</h3><p className="cf-sub">If forwarding is active on your carrier, missed or overflow calls can reach RingBooker on your forwarding number. This does not enable live answering yet.</p><div className="cf-badge">{`${selectedCarrier?.name ?? 'Carrier'} — ${selectedTypeMeta.label}`}</div><div className="cf-actions" style={{ justifyContent: 'center' }}><button type="button" className="cf-primary" onClick={() => complete(selectedMethod)}>Continue ✓</button></div></div> : null}
      {setupState === 'failed' ? <div className="cf-state"><div className="cf-icon warn">!</div><h3 className="cf-title">Forwarding not detected</h3><div className="cf-tips"><span>• Make sure you dialed the complete code</span><span>• Some carriers take 60 seconds to activate</span><span>• Try dialing the code again then re-test</span></div><div className="cf-actions" style={{ justifyContent: 'center' }}><button type="button" className="onb-help onb-help-link" onClick={() => setSetupState('skipped')}>Skip</button><button type="button" className="cf-primary" onClick={() => setSetupState('testing')}>Test again</button></div></div> : null}
      {setupState === 'skipped' ? <div className="cf-state"><div className="cf-icon neutral">i</div><h3 className="cf-title">No problem!</h3><p className="cf-sub">Set up call handling anytime from your dashboard under Phone Settings.</p><div className="cf-actions" style={{ justifyContent: 'center' }}><button type="button" className="cf-primary" onClick={onSkip}>Go to dashboard</button></div></div> : null}
    </div>
  );
}
