'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { CARRIER_DATA, FORWARDING_TYPE_META, findCarrier, findCountry, type Carrier, type CountryCarriers, type ForwardingType } from '@/lib/call-forwarding/carrier-data';
import { useGoLive, type GoLiveStatusResponse, type KnowledgeGateItem } from '@/hooks/useGoLive';
import { useUserWorkspace } from '@/components/user/user-workspace-context';

type ShopPlan = 'starter' | 'professional' | 'enterprise';

export type GoLiveBillingResponse = {
  ok: boolean;
  shop?: { id: string; name: string; plan: ShopPlan; active: boolean };
  billing?: {
    checkoutAvailable?: boolean;
    checkoutDisabledReason?: string | null;
  };
  error?: string;
};

export type { GoLiveStatusResponse };

type StepId = 1 | 2 | 3 | 4;
type StepState = 'done' | 'active' | 'locked';
type DetectedCarrierState = {
  detected: boolean;
  carrier: string | null;
  line_type: string | null;
  raw_carrier_name: string | null;
};

function formatPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return 'Not set';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const n = digits.slice(1);
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function carrierInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase();
}

function countryShortLabel(country: CountryCarriers) {
  if (country.countryCode === 'gb') return 'UK';
  return country.countryCode.toUpperCase();
}

function carrierTypeLabel(carrier: Carrier) {
  const id = carrier.id.toLowerCase();
  const name = carrier.name.toLowerCase();
  if (id === 'other') return 'Other';
  if (name.includes('business') || ['comcast', 'nextiva', 'ringcentral', 'openphone', 'ooma'].includes(id)) return 'Business';
  if (['googlevoice', 'openphone', 'ringcentral', 'ooma', 'twilio'].includes(id)) return 'VoIP';
  return 'Mobile';
}

function carrierDisplayName(carrier: string | null | undefined): string {
  const map: Record<string, string> = {
    verizon: 'Verizon',
    att: 'AT&T',
    tmobile: 'T-Mobile',
    nextiva: 'Nextiva',
    ringcentral: 'RingCentral',
    google_voice: 'Google Voice',
    googlevoice: 'Google Voice',
    comcast: 'Comcast Business',
    ooma: 'Ooma',
    openphone: 'OpenPhone',
    twilio: 'Twilio',
  };
  return carrier ? map[carrier] ?? carrier : '';
}

function detectedCarrierToGridId(carrier: string | null): string | null {
  if (!carrier || carrier === 'other') return null;
  if (carrier === 'google_voice') return 'googlevoice';
  return carrier;
}

function CopyButton({ value }: { value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return <button type="button" className="btn" disabled={!value} onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>;
}

function KnowledgeGateBanner({ items }: { items: KnowledgeGateItem[] }) {
  const blocking = items.filter((item) => item.blocking);
  const optional = items.filter((item) => !item.blocking);
  if (blocking.every((item) => item.passed)) return null;
  return (
    <section className="card gl-gate-card" aria-label="Go Live readiness">
      <div className="panel-head">
        <div>
          <span className="tag orange">Required before Go Live</span>
          <h3>Finish your AI knowledge</h3>
          <p className="sub">RingBooker needs the basics before answering real callers.</p>
        </div>
      </div>
      <div className="gl-gate-list">
        {[...blocking, ...optional].map((item) => (
          <div className={`gl-gate-item ${item.passed ? 'done' : item.blocking ? 'missing' : 'warn'}`} key={item.key}>
            <span className="gl-gate-dot">{item.passed ? '✓' : item.blocking ? '!' : 'i'}</span>
            <span>{item.label}{!item.blocking ? ' (optional)' : ''}</span>
            {!item.passed ? <a href={item.fixPath}>Fix →</a> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function GoLiveStepCard({
  step,
  title,
  meta,
  state,
  expanded,
  onSelect,
  children,
}: {
  step: StepId;
  title: string;
  meta: string;
  state: StepState;
  expanded: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`card gl-step-card gl-step-card--${state} ${expanded ? 'expanded' : ''}`}>
      <button type="button" className="gl-step-head" disabled={state === 'locked'} onClick={onSelect}>
        <span className="gl-step-num">{state === 'done' ? '✓' : step}</span>
        <span className="gl-step-copy">
          <strong>{title}</strong>
          <small>{meta}</small>
        </span>
        <span className="gl-step-chevron">⌄</span>
      </button>
      {expanded && state !== 'locked' ? <div className="gl-step-body">{children}</div> : null}
    </section>
  );
}

function NumberDisplayRow({ businessPhone, ringbookerNumber, provisionStatus }: {
  businessPhone: string | null;
  ringbookerNumber: string | null;
  provisionStatus: string;
}) {
  return (
    <div className="gl-number-grid">
      <div className="card soft gl-number-card">
        <span className="gl-section-label">Your business number</span>
        <strong>{formatPhone(businessPhone)}</strong>
        <p className="sub">Customers keep calling this number.</p>
      </div>
      <div className="card soft gl-number-card">
        <span className="gl-section-label">RingBooker number</span>
        <div className="gl-number-row">
          <strong>{provisionStatus === 'provisioning' ? 'Setting up...' : formatPhone(ringbookerNumber)}</strong>
          <CopyButton value={ringbookerNumber} />
        </div>
        <p className="sub">Used behind the scenes for call forwarding.</p>
      </div>
    </div>
  );
}

function CarrierLogo({ carrier }: { carrier: Carrier }) {
  if (carrier.logoPath) return <img src={carrier.logoPath} alt={`${carrier.name} logo`} className="gl-carrier-logo" />;
  return <span className="gl-carrier-fallback" style={{ background: carrier.color }} aria-hidden>{carrierInitials(carrier.name)}</span>;
}

function CountrySelector({ selected, onSelect }: { selected: string; onSelect: (country: string) => void }) {
  return (
    <div className="gl-country-row">
      {CARRIER_DATA.map((country) => (
        <button key={country.countryCode} type="button" className={`gl-country-pill ${selected === country.countryCode ? 'selected' : ''}`} onClick={() => onSelect(country.countryCode)}>
          <span>{country.flag}</span>
          <span className="gl-country-name">{country.countryName}</span>
          <span className="gl-country-short">{countryShortLabel(country)}</span>
        </button>
      ))}
    </div>
  );
}

function CarrierPicker({ countryCode, selected, onSelect }: { countryCode: string; selected: string | null; onSelect: (id: string) => void }) {
  const carriers = findCountry(countryCode).carriers;
  return (
    <div className="gl-carrier-grid">
      {carriers.map((carrier) => (
        <button key={carrier.id} type="button" className={`gl-carrier-card ${selected === carrier.id ? 'selected' : ''}`} onClick={() => onSelect(carrier.id)}>
          <CarrierLogo carrier={carrier} />
          <span className="gl-carrier-copy">
            <strong>{carrier.name}</strong>
            <small>{carrierTypeLabel(carrier)}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function DetectedCarrierSummary({
  countryCode,
  carrierId,
  carrierName,
  lineType,
  onChange,
}: {
  countryCode: string;
  carrierId: string | null;
  carrierName: string;
  lineType: string | null;
  onChange: () => void;
}) {
  const carrier = carrierId ? findCarrier(countryCode, carrierId) : null;
  return (
    <div className="gl-detected-carrier">
      {carrier ? <CarrierLogo carrier={carrier} /> : <span className="gl-carrier-fallback gl-carrier-fallback--muted" aria-hidden>{carrierInitials(carrierName)}</span>}
      <span className="gl-detected-copy">
        <strong>{carrierName}</strong>
        {lineType ? <small>{lineType}</small> : null}
      </span>
      <span className="tag green gl-detected-badge">Detected</span>
      <button type="button" className="gl-inline-link" onClick={onChange}>Wrong carrier? Change →</button>
    </div>
  );
}

function ForwardingTypeSelector({
  selected,
  showAdvanced,
  onToggleAdvanced,
  onSelect,
}: {
  selected: ForwardingType;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onSelect: (type: ForwardingType) => void;
}) {
  const recommended = FORWARDING_TYPE_META.no_answer;
  const advancedTypes: ForwardingType[] = ['all', 'busy', 'unreachable'];
  void showAdvanced;
  void onToggleAdvanced;
  return (
    <div className="gl-forwarding-options">
      <button type="button" className={`gl-type-card ${selected === 'no_answer' ? 'selected' : ''}`} onClick={() => onSelect('no_answer')}>
        <span className={`gl-radio-dot ${selected === 'no_answer' ? 'selected' : ''}`} />
        <span>
          <strong>No-answer calls <em>Recommended</em></strong>
          <small>{recommended.description}. Best for most businesses.</small>
        </span>
      </button>
      {advancedTypes.map((type) => {
        const meta = FORWARDING_TYPE_META[type];
        return (
          <button key={type} type="button" className={`gl-type-card ${selected === type ? 'selected' : ''}`} onClick={() => onSelect(type)}>
            <span className={`gl-radio-dot ${selected === type ? 'selected' : ''}`} />
            <span><strong>{meta.label}</strong><small>{meta.description}</small></span>
          </button>
        );
      })}
    </div>
  );
}

function DialCodeBlock({
  dialCode,
  turnOffCode,
  instructions,
}: {
  dialCode: string | null;
  turnOffCode: string | null;
  instructions: string[];
}) {
  if (!dialCode && !instructions.length) return null;
  return (
    <div className="gl-dial-wrap">
      {dialCode ? (
        <div className="gl-dial-box">
          <span className="gl-section-label">Dial this on your business phone</span>
          <div className="gl-dial-code">
            <code>{dialCode}</code>
            <CopyButton value={dialCode} />
          </div>
          <p className="gl-dial-hint">Open your dialer, type this exactly, then tap call.</p>
        </div>
      ) : null}
      {turnOffCode ? <p className="sub gl-turn-off">Changed your mind? Dial {turnOffCode} to turn it off.</p> : null}
      <ol className="gl-instructions">
        {(instructions.length ? instructions : ["Open your phone's dialer app", 'Paste or type the code above, then press call', "You'll hear a tone - then come back and tap Done below"]).slice(0, 4).map((step, index) => (
          <li key={`${index}-${step}`}><span>{index + 1}</span>{step}</li>
        ))}
      </ol>
      <a className="gl-guide-link" href="/current-number/call-forwarding" target="_blank" rel="noreferrer">Not sure what to dial? See step-by-step guide →</a>
    </div>
  );
}

function GoLiveStyles() {
  return (
    <style>{`
.gl-hero{display:grid;gap:12px}.gl-layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:18px}.gl-sidebar{position:sticky;top:82px;align-self:start;display:grid;gap:8px}.gl-sidebar-btn{width:100%;border:1px solid var(--border);background:var(--surface-card);border-radius:12px;padding:12px;text-align:left;display:flex;gap:10px;align-items:flex-start;color:var(--text-gray);cursor:pointer}.gl-sidebar-btn.active{border-color:var(--purple-dark);background:var(--purple-ultra);color:var(--text-dark)}.gl-sidebar-btn:disabled{opacity:.45;cursor:not-allowed}.gl-sidebar-num{width:24px;height:24px;border-radius:999px;background:#f3f4f6;color:var(--text-gray);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0}.gl-sidebar-btn.active .gl-sidebar-num{background:var(--purple-light);color:var(--purple-dark)}.gl-sidebar-copy{display:grid;gap:3px}.gl-sidebar-copy strong{font-size:13px;font-weight:600}.gl-sidebar-copy small{font-size:11px;line-height:1.35}.gl-mobile-steps{display:none}.gl-desktop-panel{min-width:0}.gl-step-card{padding:0;overflow:hidden}.gl-step-card--active{border-color:var(--purple-dark)}.gl-step-card--locked{opacity:.48}.gl-step-head{width:100%;border:0;background:transparent;padding:16px 18px;display:flex;align-items:center;gap:12px;text-align:left;color:inherit;cursor:pointer}.gl-step-head:disabled{cursor:not-allowed}.gl-step-num{width:30px;height:30px;border-radius:999px;border:1px solid var(--border);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0}.gl-step-card--active .gl-step-num{border-color:var(--purple-dark);color:var(--purple-dark);background:var(--purple-ultra)}.gl-step-card--done .gl-step-num{border-color:var(--green);background:#ecfdf5;color:#047857}.gl-step-copy{display:grid;gap:4px;min-width:0}.gl-step-copy strong{font-size:15px;font-weight:600;color:var(--text-dark)}.gl-step-copy small{font-size:12px;color:var(--text-gray);line-height:1.35}.gl-step-chevron{margin-left:auto;color:var(--text-light)}.gl-step-card.expanded .gl-step-chevron{transform:rotate(180deg)}.gl-step-body{border-top:1px solid var(--border);padding:18px}.gl-gate-card{border-color:#fed7aa;background:#fff7ed}.gl-gate-list{display:grid;gap:8px}.gl-gate-item{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text-gray)}.gl-gate-item a{margin-left:auto;color:var(--purple-dark);font-weight:500}.gl-gate-dot{width:22px;height:22px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:#f3f4f6;color:var(--text-gray);flex-shrink:0}.gl-gate-item.done .gl-gate-dot{background:#ecfdf5;color:#047857}.gl-gate-item.missing .gl-gate-dot{background:#fef2f2;color:#b91c1c}.gl-gate-item.warn .gl-gate-dot{background:#fff7ed;color:#c2410c}.gl-section-label{display:block;margin:0 0 8px;color:var(--text-light);font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}.gl-number-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.gl-number-card{margin:0;padding:16px}.gl-number-card strong{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px}.gl-number-card p.sub{margin:8px 0 0}.gl-number-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.gl-country-row{display:flex;flex-wrap:wrap;gap:8px}.gl-country-pill{border:1px solid var(--border);background:var(--surface-card);border-radius:999px;padding:9px 14px;display:inline-flex;align-items:center;gap:7px;color:var(--text-gray);font-size:13px;font-weight:500;cursor:pointer}.gl-country-pill.selected{border-color:var(--purple-dark);background:var(--purple-ultra);color:var(--purple-dark)}.gl-country-short{display:none}.gl-carrier-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.gl-carrier-card{min-height:62px;border:1px solid var(--border);background:var(--surface-card);border-radius:12px;display:flex;align-items:center;gap:9px;padding:10px;cursor:pointer;color:var(--text-dark);text-align:left}.gl-carrier-card:hover{border-color:var(--purple-light)}.gl-carrier-card.selected{border-color:var(--purple-dark);background:var(--purple-ultra);color:var(--purple-dark)}.gl-carrier-logo{width:30px;height:30px;border-radius:7px;object-fit:contain;flex-shrink:0}.gl-carrier-fallback{width:30px;height:30px;border-radius:7px;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0}.gl-carrier-fallback--muted{background:var(--text-light)!important}.gl-carrier-copy{display:grid;gap:3px;min-width:0}.gl-carrier-copy strong{font-size:13px;font-weight:500;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gl-carrier-copy small{font-size:10.5px;color:var(--text-light);line-height:1}.gl-detected-carrier{border:1px solid var(--border);background:var(--surface-card);border-radius:12px;padding:11px 12px;display:flex;align-items:center;gap:10px}.gl-detected-copy{display:grid;gap:2px;min-width:0}.gl-detected-copy strong{font-size:13px;font-weight:600;color:var(--text-dark)}.gl-detected-copy small{font-size:11px;color:var(--text-light);text-transform:capitalize}.gl-detected-badge{margin-left:auto}.gl-inline-link{border:0;background:transparent;color:var(--text-gray);font-size:12px;text-decoration:underline;cursor:pointer;padding:0}.gl-inline-link:hover{color:var(--purple-dark)}.gl-forwarding-options{display:grid;gap:8px}.gl-type-grid{display:grid;gap:8px}.gl-type-card{border:1px solid var(--border);background:var(--surface-card);border-radius:12px;padding:12px;text-align:left;cursor:pointer;display:flex;gap:10px;align-items:flex-start;width:100%}.gl-type-card.selected{border-color:var(--purple-dark);background:var(--purple-ultra)}.gl-type-card strong{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600}.gl-type-card strong em{font-style:normal;border-radius:999px;background:var(--purple-light);color:var(--purple-dark);font-size:10px;font-weight:600;padding:2px 7px}.gl-type-card small{display:block;margin-top:4px;color:var(--text-gray);font-size:12px;line-height:1.35}.gl-radio-dot{width:16px;height:16px;border-radius:999px;border:1.5px solid var(--border);flex-shrink:0;margin-top:1px}.gl-radio-dot.selected{border-color:var(--purple-dark);background:radial-gradient(circle,#fff 0 35%,var(--purple-dark) 38%)}.gl-advanced-toggle{border:0;background:transparent;color:var(--purple-dark);font-size:13px;font-weight:500;padding:2px 0;text-align:left;cursor:pointer;display:inline-flex;gap:6px;align-items:center;justify-self:start}.gl-advanced-mobile{display:none}.gl-dial-wrap{display:grid;gap:12px}.gl-dial-box{border:1px solid var(--border);background:#f3f4f6;border-radius:12px;padding:13px}.gl-dial-box .gl-section-label{margin-bottom:9px}.gl-dial-code{display:flex;align-items:center;justify-content:space-between;gap:12px}.gl-dial-code code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:19px;font-weight:700;color:var(--text-dark);overflow-wrap:anywhere}.gl-dial-hint{margin:8px 0 0;color:var(--text-gray);font-size:12px;line-height:1.4}.gl-turn-off{margin:0!important}.gl-instructions{display:grid;gap:10px;margin:0;padding:0;list-style:none}.gl-instructions li{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--text-gray);line-height:1.5}.gl-instructions span{width:24px;height:24px;border-radius:999px;background:var(--purple-light);color:var(--purple-dark);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0}.gl-guide-link{color:var(--purple-dark);font-size:13px;font-weight:500}.gl-action-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;align-items:center}.gl-action-row .gl-later-link{border:0;background:transparent;color:var(--text-gray);font-size:12px;text-decoration:underline;padding:0;min-height:auto}.gl-message{font-size:13px;line-height:1.5;color:var(--text-gray);margin:12px 0 0}.gl-message.error{color:#b91c1c}.gl-live-banner{border-color:#bbf7d0;background:#f0fdf4;color:#166534}.gl-live-banner h3{color:#166534}.gl-empty-note{margin:0;color:var(--text-gray);font-size:13px;line-height:1.6}.gl-loading{padding:30px;text-align:center}.gl-spinner{width:32px;height:32px;border:3px solid #e5e7eb;border-top-color:var(--purple-dark);border-radius:999px;animation:glSpin 1s linear infinite;margin:0 auto 10px}@keyframes glSpin{to{transform:rotate(360deg)}}@media(max-width:767px){.gl-layout{display:block}.gl-sidebar,.gl-desktop-panel{display:none}.gl-mobile-steps{display:grid;gap:12px}.gl-number-grid{grid-template-columns:1fr}.gl-step-body{padding:16px}.gl-action-row{flex-direction:column;align-items:flex-start}.gl-action-row .btn:not(.gl-later-link){width:100%;min-height:48px}.gl-country-pill{padding:7px 12px;font-size:12px}.gl-country-name{display:none}.gl-country-short{display:inline}.gl-carrier-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gl-carrier-card{min-height:50px}.gl-carrier-logo,.gl-carrier-fallback{width:26px;height:26px}.gl-carrier-copy small{display:none}.gl-detected-carrier{align-items:flex-start;flex-wrap:wrap}.gl-detected-badge{margin-left:0}.gl-dial-code code{font-size:15px}.gl-dial-code .btn{flex-shrink:0}}`}</style>
  );
}

export function GoLiveForwardingPanel({
  initialBilling = null,
  initialStatus = null,
}: {
  initialBilling?: GoLiveBillingResponse | null;
  initialStatus?: GoLiveStatusResponse | null;
}) {
  const { setWorkspace } = useUserWorkspace();
  const goLive = useGoLive(initialStatus);
  const [selectedStep, setSelectedStep] = useState<StepId>(1);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialCode, setDialCode] = useState<string | null>(null);
  const [turnOffCode, setTurnOffCode] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [smsOwnerOptedIn, setSmsOwnerOptedIn] = useState(false);
  const [detectedCarrier, setDetectedCarrier] = useState<DetectedCarrierState | null>(null);
  const [carrierDetectionLoaded, setCarrierDetectionLoaded] = useState(false);
  const [showCarrierGrid, setShowCarrierGrid] = useState(true);

  useEffect(() => {
    if (initialBilling?.ok && initialBilling.shop) {
      setWorkspace({ shopName: initialBilling.shop.name, plan: initialBilling.shop.plan, active: initialBilling.shop.active });
    }
  }, [initialBilling, setWorkspace]);

  const billingReady = goLive.status.billing.paymentMethodAdded && ['trial', 'active'].includes(goLive.status.billing.status);
  const numberReady = goLive.status.provision.status === 'ready' && Boolean(goLive.status.provision.ringbookerNumber);
  const forwardingConfigured = goLive.status.forwarding.status === 'configured' || goLive.status.forwarding.status === 'verified';
  const forwardingVerified = goLive.status.forwarding.status === 'verified';
  const liveEnabled = goLive.status.liveAnswering.enabled;

  const steps = useMemo(() => {
    const active: StepId = !forwardingConfigured ? 1 : !forwardingVerified ? 2 : !billingReady ? 3 : 4;
    return [
      { step: 1 as StepId, title: 'Forward missed calls to RingBooker', meta: 'One code to dial · ~2 min', done: forwardingConfigured, locked: false },
      { step: 2 as StepId, title: 'Test it works', meta: "We'll call to confirm", done: forwardingVerified, locked: !forwardingConfigured },
      { step: 3 as StepId, title: 'Add your card', meta: billingReady ? `Trial active${formatDate(goLive.status.billing.trialEndsAt) ? ` until ${formatDate(goLive.status.billing.trialEndsAt)}` : ''}` : 'Starts free 14-day trial', done: billingReady, locked: !forwardingVerified },
      { step: 4 as StepId, title: 'Switch it on', meta: 'Go live instantly', done: liveEnabled, locked: !billingReady || !forwardingVerified || !goLive.canGoLive },
    ].map((item) => ({ ...item, state: item.done ? 'done' as StepState : item.locked ? 'locked' as StepState : item.step === active ? 'active' as StepState : 'active' as StepState }));
  }, [billingReady, forwardingConfigured, forwardingVerified, liveEnabled, goLive.canGoLive, goLive.status.billing.trialEndsAt]);

  useEffect(() => {
    if (!forwardingConfigured) setSelectedStep(1);
    else if (!forwardingVerified) setSelectedStep(2);
    else if (!billingReady) setSelectedStep(3);
    else setSelectedStep(4);
  }, [billingReady, forwardingConfigured, forwardingVerified]);

  const selectedCarrier = goLive.selectedCarrier;
  const selectedCarrierRecord = findCarrier(goLive.selectedCountry, selectedCarrier ?? undefined);
  const selectedCarrierHasDialCodes = (selectedCarrierRecord?.forwardingCodes.length ?? 0) > 0;
  const detectedGridCarrier = detectedCarrierToGridId(detectedCarrier?.carrier ?? null);

  useEffect(() => {
    if (selectedStep !== 1 || carrierDetectionLoaded) return;
    let active = true;
    void fetch('/api/backend/user/go-live/detected-carrier', { credentials: 'include' })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | ({ ok?: boolean } & DetectedCarrierState)
          | null;
        if (!active) return;
        if (!res.ok || !body?.ok) {
          setShowCarrierGrid(true);
          return;
        }
        setDetectedCarrier({
          detected: body.detected === true,
          carrier: body.carrier ?? null,
          line_type: body.line_type ?? null,
          raw_carrier_name: body.raw_carrier_name ?? null,
        });
        const gridCarrier = detectedCarrierToGridId(body.carrier ?? null);
        if (body.detected === true && gridCarrier) {
          goLive.selectCarrier(gridCarrier);
          setShowCarrierGrid(false);
        } else {
          setShowCarrierGrid(true);
        }
      })
      .catch(() => {
        if (active) setShowCarrierGrid(true);
      })
      .finally(() => {
        if (active) setCarrierDetectionLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [carrierDetectionLoaded, goLive, selectedStep]);

  useEffect(() => {
    if (!detectedCarrier?.detected || !detectedGridCarrier || showCarrierGrid) return;
    if (goLive.selectedCarrier === detectedGridCarrier) return;
    goLive.selectCarrier(detectedGridCarrier);
  }, [detectedCarrier?.detected, detectedGridCarrier, goLive, showCarrierGrid]);

  useEffect(() => {
    if (!numberReady || !selectedCarrier) {
      setDialCode(null);
      setTurnOffCode(null);
      setInstructions([]);
      return;
    }
    let active = true;
    void goLive.getDialCode()
      .then((result) => {
        if (!active) return;
        setDialCode(result.dialCode);
        setTurnOffCode(result.turnOffCode);
        setInstructions(result.instructions);
      })
      .catch(() => {
        if (!active) return;
        setDialCode(null);
        setTurnOffCode(null);
        setInstructions(selectedCarrierRecord?.appSteps ?? []);
      });
    return () => {
      active = false;
    };
  }, [goLive, numberReady, selectedCarrier, selectedCarrierRecord?.appSteps, goLive.selectedCountry, goLive.selectedForwardingType]);

  async function run(label: string, action: () => Promise<void>, success?: string) {
    setBusyAction(label);
    setMessage(null);
    try {
      await action();
      if (success) setMessage(success);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyAction(null);
    }
  }

  async function saveSmsOwnerOptInIfChecked() {
    if (!smsOwnerOptedIn) return;
    const res = await fetch('/api/backend/user/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sms_owner_opted_in: true }),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
    if (!res.ok || !body?.ok) {
      throw new Error(body?.message ?? body?.error ?? 'Could not save SMS alert preference.');
    }
  }

  async function startTrialWithOptionalSmsConsent() {
    await saveSmsOwnerOptInIfChecked();
    await goLive.startTrial();
  }

  function renderStepContent(step: StepId) {
    if (step === 1) {
      return (
        <div>
          <NumberDisplayRow businessPhone={goLive.businessPhone} ringbookerNumber={goLive.status.provision.ringbookerNumber} provisionStatus={goLive.status.provision.status} />
          {!numberReady ? <p className="gl-empty-note">Set up call forwarding to create your RingBooker number and show the dial code for your business phone.</p> : null}
          {!numberReady ? (
            <div className="gl-action-row">
              <button type="button" className="btn user-save" disabled={busyAction === 'provision'} onClick={() => run('provision', goLive.provisionNumber, 'Setting up your RingBooker number...')}>{busyAction === 'provision' ? 'Setting up...' : 'Set up call forwarding'}</button>
            </div>
          ) : null}
          {numberReady ? (
            <>
              <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                {goLive.countryPickerVisible ? <div><span className="gl-section-label">Country</span><CountrySelector selected={goLive.selectedCountry} onSelect={goLive.selectCountry} /></div> : null}
                <div>
                  <span className="gl-section-label">Who is your phone provider?</span>
                  {detectedCarrier?.detected && detectedCarrier.carrier && detectedCarrier.carrier !== 'other' ? (
                    <DetectedCarrierSummary
                      countryCode={goLive.selectedCountry}
                      carrierId={detectedCarrierToGridId(detectedCarrier.carrier)}
                      carrierName={carrierDisplayName(detectedCarrier.carrier)}
                      lineType={detectedCarrier.line_type}
                      onChange={() => setShowCarrierGrid(true)}
                    />
                  ) : null}
                  {showCarrierGrid ? <CarrierPicker countryCode={goLive.selectedCountry} selected={goLive.selectedCarrier} onSelect={goLive.selectCarrier} /> : null}
                  <button type="button" className="gl-advanced-toggle gl-country-change" onClick={goLive.showCountryPicker}>Wrong country? Change</button>
                </div>
                {selectedCarrierHasDialCodes ? (
                  <div><span className="gl-section-label">When should RingBooker answer?</span><ForwardingTypeSelector selected={goLive.selectedForwardingType} showAdvanced={showAdvancedOptions} onToggleAdvanced={() => setShowAdvancedOptions((value) => !value)} onSelect={goLive.selectForwardingType} /></div>
                ) : null}
                <div><DialCodeBlock dialCode={dialCode} turnOffCode={turnOffCode} instructions={instructions} /></div>
              </div>
              <div className="gl-action-row">
                <button type="button" className="btn user-save" disabled={!goLive.selectedCarrier || busyAction === 'configured'} onClick={() => run('configured', goLive.markConfigured, 'Forwarding setup saved. Run verification next.')}>{busyAction === 'configured' ? 'Saving...' : "Done — I've set it up"}</button>
                <button type="button" className="btn gl-later-link" onClick={() => setSelectedStep(2)}>I'll do this later</button>
              </div>
            </>
          ) : null}
        </div>
      );
    }

    if (step === 2) {
      return (
        <div>
          <p className="gl-empty-note">We'll call you to make sure RingBooker is receiving calls.</p>
          {goLive.forwardingTestStatus === 'pending' ? <p className="gl-message">Waiting for a forwarded call. Call your current business number from another phone and let it forward to RingBooker.</p> : null}
          {goLive.forwardingTestStatus === 'failed' ? <p className="gl-message error">The call didn't reach RingBooker. Make sure you dialed the forwarding code correctly, then try again.</p> : null}
          {forwardingVerified ? <section className="card soft gl-live-banner" style={{ marginTop: 14 }}><h3>✓ It works — RingBooker is receiving calls</h3><p className="sub">Your forwarding setup is verified.</p></section> : null}
          <div className="gl-action-row">
            {!forwardingVerified ? <button type="button" className="btn user-save" disabled={busyAction === 'verify'} onClick={() => run('verify', goLive.runVerification, 'Verification started. Call your business number from another phone.')}>{busyAction === 'verify' ? 'Starting...' : 'Run the test call'}</button> : null}
            {!forwardingVerified ? <button type="button" className="btn" disabled={busyAction === 'confirm'} onClick={() => run('confirm', goLive.confirmForwarding, 'Forwarding marked verified.')}>{busyAction === 'confirm' ? 'Saving...' : 'I completed the test'}</button> : null}
            <a className="btn" href="/current-number/call-forwarding" target="_blank" rel="noreferrer">Need help?</a>
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div>
          <NumberDisplayRow businessPhone={goLive.businessPhone} ringbookerNumber={goLive.status.provision.ringbookerNumber} provisionStatus={goLive.status.provision.status} />
          {billingReady && numberReady ? (
            <span className="tag green">✓ Your RingBooker answering number is ready</span>
          ) : billingReady ? (
            <p className="gl-message">Payment method is added. Create your forwarding number next.</p>
          ) : (
            <p className="gl-message">No charge for 14 days · Cancel anytime. Live answering stays off until forwarding is verified and you enable it.</p>
          )}
          {!billingReady ? (
            <label
              className="checkbox-line"
              style={{ alignItems: 'flex-start', color: 'var(--text-gray)', display: 'flex', fontSize: 12, fontWeight: 400, gap: 9, lineHeight: 1.5, marginBottom: 12, marginTop: 12 }}
            >
              <input
                type="checkbox"
                checked={smsOwnerOptedIn}
                onChange={(event) => setSmsOwnerOptedIn(event.currentTarget.checked)}
              />
              <span>Send me SMS alerts for new bookings, missed calls, and handoff requests. Msg &amp; data rates may apply. Reply STOP to opt out.</span>
            </label>
          ) : null}
          <div className="gl-action-row">
            {!billingReady ? <button type="button" className="btn user-save" disabled={busyAction === 'trial'} onClick={() => run('trial', startTrialWithOptionalSmsConsent)}>{busyAction === 'trial' ? 'Opening...' : 'Add card and start free trial'}</button> : null}
            <a className="btn" href="/user/billing">Open Billing</a>
          </div>
        </div>
      );
    }

    return (
      <div>
        {liveEnabled ? <section className="card soft gl-live-banner"><h3>RingBooker is now answering missed calls on your business line.</h3><p className="sub">Forwarded calls can now be answered by RingBooker.</p></section> : <p className="gl-empty-note">Billing, forwarding, and verification must be complete before live answering can be enabled.</p>}
        <div className="gl-action-row">
          {!liveEnabled ? <button type="button" className="btn user-save" disabled={!goLive.canGoLive || busyAction === 'enable'} onClick={() => run('enable', goLive.enableLive, 'Live answering is now active.')}>{busyAction === 'enable' ? 'Enabling...' : 'Switch on live answering'}</button> : null}
          {liveEnabled ? <button type="button" className="btn" disabled={busyAction === 'disable'} onClick={() => { if (window.confirm('Callers will no longer be answered by RingBooker. Your forwarding setup stays intact.')) void run('disable', goLive.disableLive, 'Live answering is disabled.'); }}>{busyAction === 'disable' ? 'Disabling...' : 'Disable live answering'}</button> : null}
          <a className="btn" href="/user/calls">View call logs</a>
        </div>
        {!goLive.canGoLive && !liveEnabled ? <p className="gl-message error">Complete setup above before going live.</p> : null}
      </div>
    );
  }

  if (goLive.isLoading) {
    return <><GoLiveStyles /><section className="card gl-loading"><div className="gl-spinner" /><p className="sub">Loading Go Live status...</p></section></>;
  }

  return (
    <div className="section-stack gl-hero" id="go-live-forwarding">
      <GoLiveStyles />
      <KnowledgeGateBanner items={goLive.gate} />
      {message || goLive.error ? <p className={`gl-message ${goLive.error ? 'error' : ''}`}>{message ?? goLive.error}</p> : null}

      <div className="gl-mobile-steps">
        {steps.map((step) => (
          <GoLiveStepCard key={step.step} step={step.step} title={step.title} meta={step.meta} state={step.state} expanded={selectedStep === step.step || step.state === 'active'} onSelect={() => step.state !== 'locked' && setSelectedStep(step.step)}>
            {renderStepContent(step.step)}
          </GoLiveStepCard>
        ))}
      </div>

      <div className="gl-layout">
        <aside className="gl-sidebar" aria-label="Go Live steps">
          {steps.map((step) => (
            <button key={step.step} type="button" className={`gl-sidebar-btn ${selectedStep === step.step ? 'active' : ''}`} disabled={step.state === 'locked'} onClick={() => setSelectedStep(step.step)}>
              <span className="gl-sidebar-num">{step.done ? '✓' : step.step}</span>
              <span className="gl-sidebar-copy"><strong>{step.title}</strong><small>{step.meta}</small></span>
            </button>
          ))}
        </aside>
        <main className="gl-desktop-panel">
          <GoLiveStepCard step={selectedStep} title={steps.find((step) => step.step === selectedStep)?.title ?? 'Go Live'} meta={steps.find((step) => step.step === selectedStep)?.meta ?? ''} state={steps.find((step) => step.step === selectedStep)?.state ?? 'active'} expanded onSelect={() => undefined}>
            {renderStepContent(selectedStep)}
          </GoLiveStepCard>
        </main>
      </div>
    </div>
  );
}
