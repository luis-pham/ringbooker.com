'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  buildDialCode,
  CARRIER_DATA,
  getForwardingTypeCopy,
  type Carrier,
  type ForwardingCode,
  type ForwardingType,
} from '@/lib/call-forwarding/carrier-data';

type Phase = 'select' | 'instructions' | 'testing' | 'success' | 'failed' | 'skipped';

type CallForwardingSetupProps = {
  ringbookerNumber: string;
  onComplete?: () => void;
  onSkip?: () => void;
};

function normalizeNumber(value: string) {
  return value.trim().replace(/[\s().-]/g, '');
}

function carrierInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
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

  return (
    <button type="button" className="cf-copy" onClick={copy} disabled={!value}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CarrierLogo({ carrier }: { carrier: Carrier }) {
  if (carrier.logoPath) {
    return <img src={carrier.logoPath} alt={`${carrier.name} logo`} className="cf-logo-img" />;
  }
  return (
    <div className="cf-logo-fallback" style={{ background: carrier.color }} aria-hidden>
      {carrierInitials(carrier.name)}
    </div>
  );
}

function getSelectedCode(carrier: Carrier, selectedType: ForwardingType): ForwardingCode | null {
  return carrier.forwardingCodes.find((item) => item.type === selectedType) ?? carrier.forwardingCodes[0] ?? null;
}

export function CallForwardingSetup({ ringbookerNumber, onComplete, onSkip }: CallForwardingSetupProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [countryCode, setCountryCode] = useState(CARRIER_DATA[0]?.countryCode ?? 'US');
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [selectedType, setSelectedType] = useState<ForwardingType>('no_answer');
  const [countdown, setCountdown] = useState(10);

  const country = useMemo(
    () => CARRIER_DATA.find((item) => item.countryCode === countryCode) ?? CARRIER_DATA[0],
    [countryCode],
  );
  const normalizedNumber = normalizeNumber(ringbookerNumber);
  const selectedCode = selectedCarrier ? getSelectedCode(selectedCarrier, selectedType) : null;
  const dialCode = selectedCode ? buildDialCode(selectedCode, normalizedNumber) : null;
  const selectedTypeCopy = getForwardingTypeCopy(selectedType);

  useEffect(() => {
    if (!selectedCarrier) return;
    const hasDefault = selectedCarrier.forwardingCodes.some((item) => item.type === selectedCarrier.defaultType);
    setSelectedType(hasDefault ? selectedCarrier.defaultType : selectedCarrier.forwardingCodes[0]?.type ?? selectedCarrier.defaultType);
  }, [selectedCarrier]);

  useEffect(() => {
    if (phase !== 'testing') return;
    setCountdown(10);
    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  function selectCarrier(carrier: Carrier) {
    setSelectedCarrier(carrier);
    setPhase('instructions');
  }

  async function testForwarding() {
    if (!selectedCarrier) return;
    setPhase('testing');
    const hasDialCodes = selectedCarrier.forwardingCodes.length > 0;
    try {
      const response = await fetch('/api/backend/user/test-call-forwarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: 'current', carrierId: selectedCarrier.id, hasDialCodes }),
      });
      const body = (await response.json().catch(() => null)) as { success?: boolean } | null;
      setPhase(response.ok && body?.success ? 'success' : 'failed');
    } catch {
      setPhase('failed');
    }
  }

  function skip() {
    setPhase('skipped');
    onSkip?.();
  }

  return (
    <div className="cf-setup">
      <style>{`
.cf-setup{border:1.5px solid #e2e8f0;border-radius:14px;background:#fff;padding:20px;color:#111827}
.cf-select{display:grid;gap:16px}.cf-label{display:block;margin:0 0 8px;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em}.cf-select-input{height:40px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:14px;background:#fff;color:#111827;width:100%}.cf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cf-carrier{display:flex;align-items:center;gap:10px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;padding:13px;text-align:left;cursor:pointer;transition:.16s ease}.cf-carrier:hover,.cf-carrier.active{border-color:#7c3aed;background:#faf5ff}.cf-logo-img{width:32px;height:20px;object-fit:contain;flex-shrink:0}.cf-logo-fallback{width:32px;height:20px;border-radius:3px;color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}.cf-carrier-name{font-size:14px;font-weight:700;color:#111827}.cf-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px}.cf-head-title{display:flex;align-items:center;gap:10px}.cf-back{border:0;background:transparent;color:#64748b;font-size:13px;font-weight:700;cursor:pointer}.cf-number-box,.cf-code-box{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin-top:8px}.cf-code-box{background:#f8fafc;border-color:#e5e7eb}.cf-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:16px;font-weight:600;color:#111827;overflow-wrap:anywhere}.cf-copy{height:32px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;color:#475569;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer}.cf-copy:disabled{opacity:.5;cursor:not-allowed}.cf-section{margin-top:18px}.cf-radio-list{display:grid;gap:8px;margin-top:8px}.cf-radio{display:flex;gap:10px;border:1px solid #e2e8f0;border-radius:12px;padding:12px;cursor:pointer}.cf-radio.active{border-color:#7c3aed;background:#faf5ff}.cf-radio input{margin-top:3px}.cf-radio-title{font-size:14px;font-weight:800;color:#111827}.cf-radio-desc{font-size:13px;color:#64748b;margin-top:2px;line-height:1.45}.cf-info{border-radius:12px;background:#f8fafc;padding:14px;color:#475569;font-size:14px;line-height:1.55}.cf-steps{display:grid;gap:10px;margin:10px 0 0;padding:0;list-style:none}.cf-step{display:flex;gap:10px;align-items:flex-start;color:#374151;font-size:14px;line-height:1.5}.cf-step-num{width:24px;height:24px;border-radius:999px;background:#ede9fe;color:#7c3aed;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.cf-note{margin-top:10px;color:#64748b;font-size:13px}.cf-actions{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:20px}.cf-primary{height:38px;border:0;border-radius:8px;background:#6d28d9;color:#fff;padding:8px 16px;font-size:14px;font-weight:700;cursor:pointer}.cf-secondary{border:0;background:transparent;color:#64748b;font-weight:700;cursor:pointer}.cf-state{text-align:center;padding:28px 12px}.cf-spinner{width:34px;height:34px;border-radius:999px;border:3px solid #ede9fe;border-top-color:#7c3aed;margin:0 auto 14px;animation:cfSpin 1s linear infinite}.cf-icon{width:48px;height:48px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;margin-bottom:12px}.cf-icon.success{background:#dcfce7;color:#16a34a}.cf-icon.warn{background:#fef3c7;color:#d97706}.cf-icon.neutral{background:#f1f5f9;color:#64748b}.cf-state h3{margin:0;font-size:22px;color:#111827}.cf-state p{margin:8px auto 0;max-width:420px;color:#64748b;font-size:14px;line-height:1.6}.cf-badge{display:inline-flex;margin-top:12px;border-radius:999px;background:#dcfce7;color:#16a34a;padding:5px 11px;font-size:12px;font-weight:800}.cf-tips{display:inline-grid;text-align:left;gap:7px;margin:14px auto 0;color:#475569;font-size:14px}.cf-failed-code{max-width:460px;margin:16px auto 0}.cf-app-note{margin-top:8px}.cf-single-type{border:1px solid #e2e8f0;border-radius:12px;background:#fafafa;padding:12px;margin-top:8px}
@keyframes cfSpin{to{transform:rotate(360deg)}}
@media(min-width:900px){.cf-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:640px){.cf-setup{padding:16px}.cf-grid{grid-template-columns:1fr 1fr}.cf-actions{flex-direction:column;align-items:stretch}.cf-primary{width:100%;order:1}.cf-secondary{order:2}.cf-head{flex-direction:column}.cf-number-box,.cf-code-box{align-items:flex-start;flex-direction:column}}
      `}</style>

      {phase === 'select' ? (
        <div className="cf-select">
          <div>
            <label className="cf-label" htmlFor="cf-country">Country</label>
            <select id="cf-country" className="cf-select-input" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
              {CARRIER_DATA.map((item) => (
                <option key={item.countryCode} value={item.countryCode}>{item.flag} {item.countryName}</option>
              ))}
            </select>
          </div>
          <div className="cf-grid">
            {country?.carriers.map((carrier) => (
              <button key={carrier.id} type="button" className={`cf-carrier ${selectedCarrier?.id === carrier.id ? 'active' : ''}`} onClick={() => selectCarrier(carrier)}>
                <CarrierLogo carrier={carrier} />
                <span className="cf-carrier-name">{carrier.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {phase === 'instructions' && selectedCarrier ? (
        <div>
          <div className="cf-head">
            <div className="cf-head-title">
              <CarrierLogo carrier={selectedCarrier} />
              <div>
                <div className="cf-carrier-name">{selectedCarrier.name}</div>
                <div className="cf-radio-desc">Call forwarding setup</div>
              </div>
            </div>
            <button type="button" className="cf-back" onClick={() => setPhase('select')}>Change carrier</button>
          </div>

          <div className="cf-section">
            <p className="cf-label">Your RingBooker number</p>
            <div className="cf-number-box">
              <span className="cf-mono">{normalizedNumber || 'Being assigned...'}</span>
              <CopyButton value={normalizedNumber} />
            </div>
          </div>

          <div className="cf-section">
            <p className="cf-label">Choose forwarding type</p>
            {selectedCarrier.forwardingCodes.length === 0 ? (
              <div className="cf-info cf-app-note">This provider requires app/dashboard setup - no dial code needed.</div>
            ) : selectedCarrier.forwardingCodes.length === 1 ? (
              <div className="cf-single-type">
                <div className="cf-radio-title">{selectedTypeCopy.label}</div>
                <div className="cf-radio-desc">{selectedTypeCopy.description}</div>
              </div>
            ) : (
              <div className="cf-radio-list">
                {selectedCarrier.forwardingCodes.map((item) => {
                  const copy = getForwardingTypeCopy(item.type);
                  return (
                    <label key={item.type} className={`cf-radio ${selectedType === item.type ? 'active' : ''}`}>
                      <input type="radio" name="forwarding-type" checked={selectedType === item.type} onChange={() => setSelectedType(item.type)} />
                      <span>
                        <span className="cf-radio-title">{copy.label}{item.type === selectedCarrier.defaultType ? ' (Recommended)' : ''}</span>
                        <span className="cf-radio-desc">{copy.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {dialCode ? (
            <div className="cf-section">
              <p className="cf-label">Dial code</p>
              <div className="cf-code-box">
                <span className="cf-mono">{dialCode}</span>
                <CopyButton value={dialCode} />
              </div>
            </div>
          ) : null}

          <div className="cf-section">
            <p className="cf-label">Steps</p>
            <ol className="cf-steps">
              {selectedCarrier.getSteps(selectedType, normalizedNumber).map((step, index) => (
                <li className="cf-step" key={step}>
                  <span className="cf-step-num">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {selectedCode?.cancelCode ? <p className="cf-note">To turn off: dial <strong>{selectedCode.cancelCode}</strong></p> : null}
          </div>

          <div className="cf-actions">
            <button type="button" className="cf-secondary" onClick={skip}>Skip - set up later</button>
            <button type="button" className="cf-primary" onClick={testForwarding}>I've set it up - test my forwarding</button>
          </div>
        </div>
      ) : null}

      {phase === 'testing' ? (
        <div className="cf-state">
          <div className="cf-spinner" />
          <h3>Testing your forwarding...</h3>
          <p>Calling your business number now. Takes about 10 seconds.</p>
          <p>{countdown}s remaining</p>
        </div>
      ) : null}

      {phase === 'success' && selectedCarrier ? (
        <div className="cf-state">
          <div className="cf-icon success">✓</div>
          <h3>Forwarding is working!</h3>
          <div className="cf-badge">{selectedCarrier.name} - {selectedTypeCopy.label} confirmed</div>
          <div className="cf-actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="cf-primary" onClick={onComplete}>Complete setup</button>
          </div>
        </div>
      ) : null}

      {phase === 'failed' && selectedCarrier ? (
        <div className="cf-state">
          <div className="cf-icon warn">!</div>
          <h3>Not detected yet</h3>
          <div className="cf-tips">
            <span>Make sure you dialed the complete code</span>
            <span>Some carriers take 60 seconds to activate</span>
            <span>Try dialing the code again then retest</span>
          </div>
          {dialCode ? (
            <div className="cf-failed-code">
              <div className="cf-code-box">
                <span className="cf-mono">{dialCode}</span>
                <CopyButton value={dialCode} />
              </div>
            </div>
          ) : null}
          <div className="cf-actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="cf-secondary" onClick={skip}>Skip</button>
            <button type="button" className="cf-primary" onClick={testForwarding}>Test again</button>
          </div>
        </div>
      ) : null}

      {phase === 'skipped' ? (
        <div className="cf-state">
          <div className="cf-icon neutral">i</div>
          <h3>No problem!</h3>
          <p>Set up call forwarding anytime from your dashboard under Phone Settings.</p>
          <div className="cf-actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="cf-primary" onClick={onSkip}>Continue</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
