import { UserLayout } from '@/components/user/user-layout';
import { userDashboardStyles } from '@/components/user/user-dashboard';

export const userCallsStyles: string[] = [...userDashboardStyles];

export const userCallsScripts: string[] = [];

export const templateTitle = 'Calls, transcripts, and missed revenue recovery.';

export function UserCallsTemplate() {
  return (
    <UserLayout
      styles={userCallsStyles}
      scripts={userCallsScripts}
      scriptPrefix="user-calls"
    >
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" /></svg></div></div><span>RingBooker</span></div>
            <div className="nav-section"><div className="nav-label">User Portal</div><div className="nav-list"><a className="nav-item" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a><a className="nav-item" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a><a className="nav-item active" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a><a className="nav-item" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a><a className="nav-item" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a></div></div>
            <div className="sidebar-spacer" />
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title"><h1>Calls, transcripts, and missed revenue recovery.</h1><p>Review how your AI phone agent handled every caller.</p></div>
            <div className="top-actions overview-top-actions"><a className="btn" href="/user/settings">Edit business info</a><a className="btn user-save" href="/user/bookings">View bookings</a></div>
          </div>
          <section className="grid grid-3">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span className="tag green">Handled</span></div><div className="stat-value">142</div><div className="stat-meta">Calls answered this week</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z" /><path d="M4 8l8 6 8-6" /></svg></div><span className="tag purple">Recovered</span></div><div className="stat-value">19</div><div className="stat-meta">Missed calls converted by text back</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4.5A8 8 0 1 1 21 12Z" /></svg></div><span className="tag orange">Avg 2m 14s</span></div><div className="stat-value">31</div><div className="stat-meta">Calls that became bookings</div></div>
          </section>
          <section className="grid grid-2" style={{marginTop: 18}}>
            <div className="card">
              <div className="panel-head"><div><h3>Recent calls</h3><p className="sub">A high-level timeline of outcomes.</p></div><span className="badge-right">Telnyx + LiveKit</span></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">EL</div><div><h4>Booked appointment</h4><p>Emma L. · Balayage + Trim · 2m 41s</p></div></div><span className="tag green">Booked</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">JT</div><div><h4>Pricing question only</h4><p>Gel extensions price and availability · 1m 12s</p></div></div><span className="tag purple">Info only</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">MK</div><div><h4>Caller hung up early</h4><p>Missed-call text sent after 2 minutes</p></div></div><span className="tag orange">Recovered</span></div>
                <div className="list-item"><div className="item-main"><div className="avatar">AH</div><div><h4>User handoff</h4><p>Complaint about previous service · transferred</p></div></div><span className="tag red">Transferred</span></div>
              </div>
            </div>
            <div className="card soft">
              <div className="panel-head"><div><h3>Transcript preview</h3><p className="sub">The latest conversation summary.</p></div></div>
              <div className="note" style={{background: '#fff', borderRadius: 20}}>
                <strong>Caller:</strong> “Hi, do you have anything for Thursday after work?”<br /><br />
                <strong>RingBooker:</strong> “Yes — Thursday at 6:00 PM is available for a wash and blowout. Would you like me to book that?”<br /><br />
                <strong>Caller:</strong> “Yes, with Sophia if possible.”<br /><br />
                <strong>RingBooker:</strong> “Perfect. I’ve booked you for Thursday at 6:00 PM with Sophia. You’ll receive a confirmation text right away.”
              </div>
              <div className="progress-list" style={{marginTop: 18}}>
                <div className="progress-item"><strong>Booked calls</strong><div className="bar"><span style={{width: '72%'}} /></div><span>31</span></div>
                <div className="progress-item"><strong>Info-only calls</strong><div className="bar"><span style={{width: '38%'}} /></div><span>26</span></div>
                <div className="progress-item"><strong>Transferred calls</strong><div className="bar"><span style={{width: '14%'}} /></div><span>4</span></div>
              </div>
            </div>
          </section>
          <div className="footer-inline"><span>RingBooker user portal concept · aligned to the public landing page styling.</span><span>Mona Sans Variable · Stable layout · Shared design system</span></div>
        </main>
      </div>

    </UserLayout>
  );
}
