export function IphoneStatusBar() {
  return (
    <div className="iph-status" aria-hidden>
      <span className="iph-time">9:41</span>
      <div className="iph-island" />
      <span className="iph-signals">
        <span className="iph-signal-cell" aria-hidden>
          <span /><span /><span /><span />
        </span>
        <span className="iph-signal-wifi" aria-hidden>
          <svg viewBox="0 0 16 12" width="14" height="11">
            <path d="M8 2.4c2.2 0 4.2 1 5.5 2.6l1.2-1.2C13 1.8 10.6.6 8 .6S3 1.8 1.3 3.8l1.2 1.2C3.8 3.4 5.8 2.4 8 2.4zm0 3.2c1.3 0 2.5.5 3.4 1.4l1.2-1.2C11 4.6 9.6 4 8 4s-3 .6-4.6 1.4l1.2 1.2c.9-.9 2.1-1.4 3.4-1.4zm0 3.2c.6 0 1.2.2 1.7.6l1.2-1.2C10 7.2 9 6.8 8 6.8s-2 .4-2.9 1l1.2 1.2c.5-.4 1.1-.6 1.7-.6zM8 12l1.6-1.6H6.4L8 12z" />
          </svg>
        </span>
        <span className="iph-signal-batt" aria-hidden>
          <svg viewBox="0 0 24 12">
            <rect x="1" y="1" width="19" height="10" rx="2.5" fill="none" stroke="#fff" strokeWidth="1.2" opacity=".9" />
            <rect x="20.5" y="4" width="2" height="4" rx=".8" fill="#fff" opacity=".9" />
            <rect x="2.5" y="2.5" width="14" height="7" rx="1.5" fill="#fff" />
          </svg>
        </span>
      </span>
    </div>
  );
}
