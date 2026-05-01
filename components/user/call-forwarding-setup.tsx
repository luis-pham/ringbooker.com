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

type SetupMethod = 'forward' | 'new_number';
type SetupState = 'choose_method' | 'forward_setup' | 'new_number_info' | 'testing' | 'success' | 'failed' | 'skipped';

type CallForwardingSetupProps = {
  ringbookerNumber: string;
  callForwardingPageUrl?: string;
  onComplete?: (method: SetupMethod) => void;
  onSkip?: () => void;
  initialMethod?: SetupMethod;
  initialCarrier?: string;
  initialCountry?: string;
  initialForwardingType?: ForwardingType;
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

export function getInitialSetupState(initialMethod?: SetupMethod): SetupState {
  if (initialMethod === 'forward') return 'forward_setup';
  if (initialMethod === 'new_number') return 'new_number_info';
  return 'choose_method';
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
}: CallForwardingSetupProps) {
  const [setupState, setSetupState] = useState<SetupState>(() => getInitialSetupState(initialMethod));
  const [selectedMethod, setSelectedMethod] = useState<SetupMethod | null>(initialMethod ?? null);
  const [selectedCountry, setSelectedCountry] = useState(initialCountry || 'us');
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(() => findCarrier(initialCountry || 'us', initialCarrier));
  const [selectedForwardingType, setSelectedForwardingType] = useState<ForwardingType>(initialForwardingType);
  const [countdown, setCountdown] = useState(10);
  const [lastResultFailed, setLastResultFailed] = useState(false);

  const country = useMemo(() => findCountry(selectedCountry), [selectedCountry]);
  const normalizedNumber = normalizeNumber(ringbookerNumber);
  const selectedCode = getForwardingCode(selectedCarrier, selectedForwardingType);
  const dialCode = selectedCode ? buildDialCode(selectedCode, normalizedNumber) : null;
  const selectedTypeMeta = FORWARDING_TYPE_META[selectedForwardingType];

  useEffect(() => {
    if (setupState !== 'testing') return;
    setCountdown(10);
    setLastResultFailed(false);
    const interval = window.setInterval(() => setCountdown((current) => Math.max(0, current - 1)), 1000);
    const timeout = window.setTimeout(() => {
      void runForwardingTest();
    }, 10000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
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
      const response = await fetch('/api/backend/user/test-call-forwarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: 'current' }),
      });
      const body = (await response.json().catch(() => null)) as { success?: boolean } | null;
      if (response.ok && body?.success) {
        setSetupState('success');
      } else {
        setLastResultFailed(true);
      }
    } catch {
      setLastResultFailed(true);
    }
  }

  function complete(method: SetupMethod) {
    void saveForwardingPatch({ setup_method: method });
    onComplete?.(method);
  }

  function renderMethodCard(method: SetupMethod, title: string, description: string, bullets: string[], recommended = false) {
    const selected = selectedMethod === method;
    return (
      <button type="button" className={`cf-method-card ${selected ? 'selected' : ''}`} onClick={() => setSelectedMethod(method)}>
        <span className={`cf-radio-circle ${selected ? 'selected' : ''}`} />
        <span className="cf-method-content">
          <span className="cf-method-title-row">
            <span className="cf-method-title">{title}</span>
            {recommended ? <span className="cf-recommended">Recommended</span> : null}
          </span>
          <span className="cf-method-desc">{description}</span>
          <span className="cf-bullets">{bullets.map((item) => <span key={item}>✓ {item}</span>)}</span>
        </span>
      </button>
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
.cf-setup{border:1.5px solid #e2e8f0;border-radius:14px;background:#fff;padding:20px;color:#111827}.cf-title{margin:0;font-size:16px;font-weight:700;color:#111827;line-height:1.25}.cf-sub{margin:6px 0 0;color:#64748b;font-size:14px;line-height:1.55}.cf-label{display:block;margin:0 0 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em}.cf-method-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.cf-method-card{display:flex;gap:12px;text-align:left;border:.5px solid #e2e8f0;border-radius:14px;background:#fff;padding:16px;cursor:pointer}.cf-method-card.selected{border-color:#7c3aed;background:#faf5ff}.cf-radio-circle{width:18px;height:18px;border-radius:999px;border:1.5px solid #cbd5e1;flex-shrink:0;margin-top:2px}.cf-radio-circle.selected{border-color:#7c3aed;background:radial-gradient(circle,#fff 0 35%,#7c3aed 38%)}.cf-method-content{display:grid;gap:8px}.cf-method-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cf-method-title{font-size:15px;font-weight:800;color:#111827}.cf-recommended{display:inline-flex;border-radius:999px;background:#dcfce7;color:#16a34a;padding:3px 9px;font-size:11px;font-weight:700}.cf-method-desc,.cf-bullets,.cf-help,.cf-note{font-size:13px;color:#64748b;line-height:1.5}.cf-bullets{display:grid;gap:3px;color:#475569}.cf-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px}.cf-primary{height:38px;border:0;border-radius:8px;background:#6d28d9;color:#fff;padding:8px 16px;font-size:14px;font-weight:700;cursor:pointer}.cf-primary:disabled{opacity:.45;cursor:not-allowed}.onb-help{font-size:13px;color:#64748b;margin:0}.onb-help-link{border:0;background:transparent;padding:8px 0;cursor:pointer;text-decoration:none;font-family:inherit;font-weight:400;line-height:1.5;text-align:inherit;transition:color .15s ease}.onb-help-link:hover{color:#334155;text-decoration:underline;text-underline-offset:2px}.onb-help-link:focus-visible{outline:2px solid rgba(124,58,237,.35);outline-offset:2px}.cf-select{height:40px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;background:#fff;color:#111827;width:100%}.cf-section{margin-top:18px}.cf-carrier-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cf-carrier-card{display:flex;align-items:center;gap:8px;border:.5px solid #e2e8f0;border-radius:12px;background:#fff;padding:10px;cursor:pointer}.cf-carrier-card.selected{border-color:#7c3aed;background:#faf5ff}.cf-logo-img{width:32px;height:20px;object-fit:contain;flex-shrink:0}.cf-logo-fallback{width:32px;height:20px;border-radius:3px;color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center}.cf-carrier-name{font-size:11px;color:#6b7280;font-weight:700}.cf-type-list{display:grid;gap:8px}.cf-type-row{display:flex;gap:10px;border:.5px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff;cursor:pointer;text-align:left}.cf-type-row.selected{border-color:#7c3aed;background:#faf5ff}.cf-type-row.disabled{opacity:.4;pointer-events:none}.cf-type-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:14px;font-weight:800;color:#111827}.cf-type-desc{display:block;margin-top:2px;font-size:13px;color:#64748b}.cf-number-box,.cf-code-box{display:flex;align-items:center;justify-content:space-between;gap:12px;border:.5px solid #e2e8f0;border-radius:10px;padding:10px 14px}.cf-code-box{background:#f8fafc}.cf-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:16px;font-weight:600;overflow-wrap:anywhere}.cf-copy{height:32px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;color:#475569;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer}.cf-steps{display:grid;gap:10px;margin:0;padding:0;list-style:none}.cf-step{display:flex;gap:10px;align-items:flex-start;color:#374151;font-size:14px;line-height:1.5}.cf-step-num{width:24px;height:24px;border-radius:999px;background:#ede9fe;color:#7c3aed;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.cf-back{margin-bottom:14px}.cf-info-card{border:.5px solid #e2e8f0;border-radius:14px;padding:16px;margin-top:16px;font-size:14px;line-height:1.6;color:#374151}.cf-blue{background:#e6f1fb;border:1px solid #b5d4f4;border-radius:12px;padding:12px;margin-top:14px;color:#1e3a5f;font-size:13px;line-height:1.55}.cf-feature-list{display:grid;gap:6px;margin-top:12px;color:#475569;font-size:13px}.cf-state{text-align:center;padding:28px 12px}.cf-spinner{width:40px;height:40px;border:3px solid #e2e8f0;border-top:3px solid #7c3aed;border-radius:50%;animation:cfSpin 1s linear infinite;margin:0 auto 14px}.cf-icon{width:56px;height:56px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;margin-bottom:12px}.cf-icon.success{background:#dcfce7;color:#16a34a}.cf-icon.warn{background:#fef3c7;color:#d97706}.cf-icon.neutral{background:#f1f5f9;color:#64748b}.cf-badge{display:inline-flex;margin-top:12px;border-radius:999px;background:#dcfce7;color:#16a34a;padding:5px 11px;font-size:12px;font-weight:800}.cf-tips{display:grid;gap:6px;text-align:left;max-width:390px;margin:14px auto 0;color:#475569;font-size:13px}.cf-guide{display:inline-flex;margin-top:10px;color:#6d28d9;font-size:13px;font-weight:700;text-decoration:none}@keyframes cfSpin{to{transform:rotate(360deg)}}@media(min-width:900px){.cf-carrier-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:640px){.cf-setup{padding:16px}.cf-method-grid{grid-template-columns:1fr}.cf-carrier-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cf-actions{flex-direction:column;align-items:stretch}.cf-primary{width:100%;order:1}.cf-actions .onb-help-link{order:2;text-align:center}.cf-number-box,.cf-code-box{align-items:flex-start;flex-direction:column}}
      `}</style>

      {setupState === 'choose_method' ? (
        <div>
          <div className="cf-method-grid">
            {renderMethodCard('forward', 'Forward my existing business number', "Keep your current number. Clients call the same number. RingBooker answers when you can't pick up.", ['No number change for clients', 'Works with existing marketing'], true)}
            {renderMethodCard('new_number', 'Use a new RingBooker number', 'Get a dedicated number from RingBooker. No setup required.', ['No forwarding setup needed', 'Ready immediately'])}
          </div>
          <div className="cf-actions">
            <button type="button" className="onb-help onb-help-link" onClick={() => setSetupState('skipped')}>Skip - set up later</button>
            <button type="button" className="cf-primary" disabled={!selectedMethod} onClick={() => selectedMethod && setSetupState(selectedMethod === 'forward' ? 'forward_setup' : 'new_number_info')}>Continue →</button>
          </div>
        </div>
      ) : null}

      {setupState === 'forward_setup' ? (
        <div>
          <button type="button" className="onb-help onb-help-link cf-back" onClick={() => setSetupState('choose_method')}>← Back</button>
          <h3 className="cf-title">Forward your existing number</h3>
          <p className="cf-sub">Select your country and carrier</p>
          <div className="cf-section"><label className="cf-label" htmlFor="cf-country">Country</label><select id="cf-country" className="cf-select" value={selectedCountry} onChange={(event) => { setSelectedCountry(event.target.value); setSelectedCarrier(null); void saveForwardingPatch({ forwarding_country: event.target.value }); }}>{CARRIER_DATA.map((item) => <option key={item.countryCode} value={item.countryCode}>{item.flag} {item.countryName}</option>)}</select></div>
          <div className="cf-section"><p className="cf-label">Select your carrier</p><div className="cf-carrier-grid">{country.carriers.map((carrier) => <button key={carrier.id} type="button" className={`cf-carrier-card ${selectedCarrier?.id === carrier.id ? 'selected' : ''}`} onClick={() => chooseCarrier(carrier)}><CarrierLogo carrier={carrier} /><span className="cf-carrier-name">{carrier.name}</span></button>)}</div></div>
          {selectedCarrier ? <>
            <div className="cf-section"><p className="cf-label">Which calls should RingBooker answer?</p><div className="cf-type-list">{FORWARDING_TYPE_ORDER.map((type) => { const available = selectedCarrier.forwardingCodes.some((code) => code.type === type); const meta = FORWARDING_TYPE_META[type]; return <button key={type} type="button" className={`cf-type-row ${selectedForwardingType === type ? 'selected' : ''} ${available ? '' : 'disabled'}`} onClick={() => available && chooseForwardingType(type)}><span className={`cf-radio-circle ${selectedForwardingType === type ? 'selected' : ''}`} /><span><span className="cf-type-title">{meta.label}{meta.recommended ? <span className="cf-recommended">Recommended</span> : null}</span><span className="cf-type-desc">{meta.description}</span></span></button>; })}</div></div>
            <div className="cf-section"><p className="cf-label">Your RingBooker number</p>{renderNumberBox()}</div>
            {dialCode ? <div className="cf-section"><p className="cf-label">Dial this code on your phone</p><div className="cf-code-box"><span className="cf-mono">{dialCode}</span><CopyButton value={dialCode} /></div></div> : null}
            <div className="cf-section"><p className="cf-label">Steps</p>{renderSteps()}{selectedCode?.cancelCode ? <p className="cf-note">To turn off: dial {selectedCode.cancelCode} and press call</p> : null}<a className="cf-guide" href={callForwardingPageUrl} target="_blank" rel="noreferrer">Need help? View full carrier guide →</a></div>
          </> : null}
          <div className="cf-actions"><button type="button" className="onb-help onb-help-link" onClick={() => setSetupState('skipped')}>Skip - set up later</button><button type="button" className="cf-primary" disabled={!selectedCarrier} onClick={() => setSetupState('testing')}>I've set it up - test my forwarding</button></div>
        </div>
      ) : null}

      {setupState === 'new_number_info' ? (
        <div>
          <h3 className="cf-title">Your new RingBooker number</h3><p className="cf-sub">Share this number with clients - RingBooker will answer all calls</p><div className="cf-info-card"><p className="cf-label">Your RingBooker number</p>{renderNumberBox()}<div className="cf-info-card" style={{ background: '#f8fafc' }}>No forwarding setup needed. Add this number to your Google Business Profile, website, and social profiles so clients can reach you.</div><div className="cf-feature-list"><span>✓ Ready to receive calls immediately</span><span>✓ No carrier setup required</span><span>✓ Supports English and Vietnamese</span></div><div className="cf-blue"><strong>Still have your old number?</strong><br />You can still forward calls from your existing number later from your dashboard under Phone Settings.</div></div><div className="cf-actions"><button type="button" className="onb-help onb-help-link" onClick={() => setSetupState('choose_method')}>← Back</button><button type="button" className="cf-primary" onClick={() => { setSelectedMethod('new_number'); setSetupState('success'); }}>Complete new number setup</button></div>
        </div>
      ) : null}

      {setupState === 'testing' ? <div className="cf-state"><div className="cf-spinner" /><h3 className="cf-title">Testing your forwarding...</h3><p className="cf-sub">Calling your business number now. Takes about 10 seconds.</p><p className="cf-sub">Checking in {countdown}s...</p>{lastResultFailed ? <div><div className="cf-icon warn">!</div><h3 className="cf-title">Not detected yet</h3><div className="cf-tips"><span>• Make sure you dialed the complete code</span><span>• Some carriers take 60 seconds to activate</span><span>• Try dialing the code again then re-test</span></div>{dialCode ? <div className="cf-code-box" style={{ marginTop: 14 }}><span className="cf-mono">{dialCode}</span><CopyButton value={dialCode} /></div> : null}<div className="cf-actions" style={{ justifyContent: 'center' }}><button type="button" className="onb-help onb-help-link" onClick={() => setSetupState('skipped')}>Skip</button><button type="button" className="cf-primary" onClick={() => setSetupState('testing')}>Test again</button></div></div> : null}</div> : null}
      {setupState === 'success' ? <div className="cf-state"><div className="cf-icon success">✓</div><h3 className="cf-title">{selectedMethod === 'new_number' ? "You're all set!" : 'Forwarding is working!'}</h3><p className="cf-sub">{selectedMethod === 'new_number' ? 'Your RingBooker number is ready.' : 'Missed calls will now be answered by RingBooker automatically.'}</p><div className="cf-badge">{selectedMethod === 'new_number' ? 'RingBooker number active' : `${selectedCarrier?.name ?? 'Carrier'} - ${selectedTypeMeta.label} confirmed`}</div><div className="cf-actions" style={{ justifyContent: 'center' }}><button type="button" className="cf-primary" onClick={() => complete(selectedMethod ?? 'forward')}>Complete setup ✓</button></div></div> : null}
      {setupState === 'failed' ? <div className="cf-state"><div className="cf-icon warn">!</div><h3 className="cf-title">Forwarding not detected</h3><div className="cf-tips"><span>• Make sure you dialed the complete code</span><span>• Some carriers take 60 seconds to activate</span><span>• Try dialing the code again then re-test</span></div><div className="cf-actions" style={{ justifyContent: 'center' }}><button type="button" className="onb-help onb-help-link" onClick={() => setSetupState('skipped')}>Skip</button><button type="button" className="cf-primary" onClick={() => setSetupState('testing')}>Test again</button></div></div> : null}
      {setupState === 'skipped' ? <div className="cf-state"><div className="cf-icon neutral">i</div><h3 className="cf-title">No problem!</h3><p className="cf-sub">Set up call handling anytime from your dashboard under Phone Settings.</p><div className="cf-actions" style={{ justifyContent: 'center' }}><button type="button" className="cf-primary" onClick={onSkip}>Go to dashboard</button></div></div> : null}
    </div>
  );
}
