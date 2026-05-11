import { UserLayout } from '@/components/user/user-layout';
import { userDashboardStyles } from '@/components/user/user-dashboard';

const styles: string[] = [
  ...userDashboardStyles,
  String.raw`
.bookings-stats .stat-card{border-radius:22px}
@media (max-width:860px){
  .bookings-stats .stat-card{border-radius:16px}
}
`,
];

const scripts: string[] = [];

export const userBookingsStyles = styles;
export const userBookingsScripts = scripts;
export const templateTitle = 'Bookings and calendar flow.';

export function UserBookingsTemplate() {
  return (
    <UserLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="user-bookings"
    >
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" /></svg></div></div><span>RingBooker</span></div>
            <div className="nav-section"><div className="nav-label">User Portal</div><div className="nav-list"><a className="nav-item" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a><a className="nav-item active" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a><a className="nav-item" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a><a className="nav-item" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a><a className="nav-item" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a></div></div>
            <div className="sidebar-spacer" />
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title"><h1>Bookings and calendar flow.</h1><p>See appointment requests and bookings RingBooker has captured or created.</p></div>
            <div className="top-actions overview-top-actions"><a className="btn" href="/user/knowledge">Edit business info</a><a className="btn user-save" href="/user/bookings">View bookings</a></div>
          </div>
          <section className="grid grid-3 bookings-stats">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span className="tag purple">This week</span></div><div className="stat-value">42</div><div className="stat-meta">Upcoming bookings</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4.5A8 8 0 1 1 21 12Z" /></svg></div><span className="tag orange">Needs attention</span></div><div className="stat-value">8</div><div className="stat-meta">Pending confirmations</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 19h16" /><path d="M7 15l3-3 3 2 4-5" /></svg></div><span className="tag green">Recovered</span></div><div className="stat-value">11</div><div className="stat-meta">Bookings from missed-call text back</div></div>
          </section>
          <section className="grid grid-2" style={{marginTop: 18}}>
            <div className="card">
              <div className="panel-head"><div><h3>Upcoming appointments</h3><p className="sub">Sorted by soonest time slot.</p></div><span className="badge-right">Google Calendar synced</span></div>
              <table className="table">
                <thead><tr><th>Client</th><th>Service</th><th>Stylist</th><th>When</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>Emma L.</td><td>Balayage + Trim</td><td>Sophia</td><td>Today · 2:30 PM</td><td><span className="tag green">Confirmed</span></td></tr>
                  <tr><td>Jasmine T.</td><td>Gel Manicure</td><td>Ana</td><td>Today · 4:00 PM</td><td><span className="tag purple">Booked by AI</span></td></tr>
                  <tr><td>Nicole V.</td><td>Root Touch-up</td><td>Maria</td><td>Tomorrow · 10:00 AM</td><td><span className="tag orange">Reminder sent</span></td></tr>
                  <tr><td>Grace H.</td><td>Pedicure</td><td>Ana</td><td>Tomorrow · 1:15 PM</td><td><span className="tag green">Confirmed</span></td></tr>
                  <tr><td>Sarah K.</td><td>Wash + Blowout</td><td>No preference</td><td>Thu · 6:00 PM</td><td><span className="tag red">Awaiting reply</span></td></tr>
                </tbody>
              </table>
            </div>
            <div className="card soft">
              <div className="panel-head"><div><h3>Calendar rules</h3><p className="sub">How RingBooker decides what to offer callers.</p></div></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">1</div><div><h4>Check availability when connected</h4><p>AI can check live availability when a connected calendar integration is configured.</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">2</div><div><h4>Suggest alternatives when available</h4><p>When availability data is connected, nearby times can be offered; otherwise the request is captured for follow-up.</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">3</div><div><h4>Confirm after the call</h4><p>Successful bookings can trigger confirmation and reminder messages.</p></div></div></div>
                <div className="list-item"><div className="item-main"><div className="avatar">4</div><div><h4>Manual fallback still works</h4><p>If there is no calendar sync, the booking is still captured for the business.</p></div></div></div>
              </div>
            </div>
          </section>
          <div className="footer-inline"><span>RingBooker user portal concept · aligned to the public landing page styling.</span><span>Mona Sans Variable · Stable layout · Shared design system</span></div>
        </main>
      </div>

    </UserLayout>
  );
}
