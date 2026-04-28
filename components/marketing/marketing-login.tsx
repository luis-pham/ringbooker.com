import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';

const styles: string[] = [
  String.raw`
    :root{
      --purple:var(--mk-brand-purple,#8B5CF6);
      --purple-dark:var(--mk-brand-purple-dark,#7C3AED);
      --purple-ultra:var(--mk-brand-purple-wash,#F5F3FF);
      --text-dark:var(--mk-text-strong,#111827);
      --text-gray:var(--mk-text-muted,#64748B);
      --text-light:var(--mk-text-soft,#94A3B8);
      --bg:var(--mk-bg-page,#fff);
      --bg-gray:var(--mk-bg-section,#F9FAFB);
      --border:var(--mk-border-soft,#E8ECF1);
      --r-pill:var(--mk-radius-pill,999px);
      --shadow:var(--mk-shadow-soft,0 24px 60px rgba(17,24,39,.08));
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:'Mona Sans Variable',sans-serif;
      color:var(--text-dark);
      background:radial-gradient(ellipse 80% 55% at 50% 0%,#EDE9FE 0%,#FDF4FF 45%,#fff 72%);
      min-height:100vh;
      overflow-x:hidden;
      display:flex;
      flex-direction:column;
    }
    a{text-decoration:none;color:inherit}

    .page{
      flex:1;
      display:flex;
      flex-direction:column;
    }

    .topbar{
      padding:28px 24px 0;
      display:flex;
      justify-content:center;
    }
    .brand{
      display:flex;
      align-items:center;
      gap:11px;
      font-weight:800;
      font-size:20px;
      color:var(--text-dark);
    }
    .brand-icon{
      position:relative;
      width:38px;height:38px;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;
    }
    .brand-icon .ripple{
      position:absolute;border-radius:50%;background:var(--purple);
    }
    .brand-icon .r3{width:38px;height:38px;opacity:.10}
    .brand-icon .r2{width:30px;height:30px;opacity:.18}
    .brand-icon .core{
      width:24px;height:24px;border-radius:50%;
      background:var(--purple);
      display:flex;align-items:center;justify-content:center;
      position:relative;z-index:1;
      box-shadow:0 10px 24px rgba(139,92,246,.24);
    }
    .brand-icon svg{width:13px;height:13px;fill:#fff}
    .brand-icon-sm{width:32px;height:32px}
    .brand-icon-sm .r3{width:32px;height:32px}
    .brand-icon-sm .r2{width:24px;height:24px}
    .brand-icon-sm .core{width:18px;height:18px}
    .brand-icon-sm svg{width:10px;height:10px}

    .login-wrap{
      flex:1;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:32px 24px 56px;
    }
    .login-card{
      width:min(100%,460px);
      background:rgba(255,255,255,.92);
      border:1px solid rgba(229,231,235,.9);
      border-radius:var(--mk-radius-frame,32px);
      box-shadow:var(--shadow);
      backdrop-filter:blur(18px);
      padding:30px;
    }
    .login-head{
      margin-bottom:24px;
      text-align:left;
    }
    .tag{
      display:inline-flex;
      align-items:center;
      gap:7px;
      padding:7px 12px;
      border-radius:999px;
      background:#F5F3FF;
      color:var(--purple-dark);
      font-size:11px;
      font-weight:800;
      margin-bottom:14px;
    }
    .login-head h1{
      font-size:34px;
      line-height:1.08;
      letter-spacing:-1.2px;
      margin-bottom:10px;
    }
    .login-head p{
      color:var(--text-gray);
      font-size:14px;
      line-height:1.7;
    }
    .form{
      display:grid;
      gap:14px;
    }
    .field{
      display:grid;
      gap:8px;
    }
    .field label{
      font-size:14px;
      font-weight:700;
      color:var(--text-dark);
    }
    .field input{
      width:100%;
      border:1px solid var(--border);
      border-radius:var(--mk-radius-input,16px);
      padding:15px 16px;
      font:inherit;
      color:var(--text-dark);
      background:#fff;
      outline:none;
      transition:border-color .2s, box-shadow .2s;
    }
    .field input:focus{
      border-color:#C4B5FD;
      box-shadow:var(--mk-focus-ring,0 0 0 4px rgba(139,92,246,.10));
    }
    .row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:14px;
      flex-wrap:wrap;
      margin-top:2px;
      margin-bottom:2px;
    }
    .check{
      display:flex;
      align-items:center;
      gap:10px;
      font-size:14px;
      color:var(--text-gray);
      font-weight:600;
    }
    .check input{accent-color:var(--purple)}
    .link{
      font-size:14px;
      color:var(--purple-dark);
      font-weight:700;
    }
    .btn{
      width:100%;
      border:none;
      border-radius:999px;
      padding:15px 20px;
      font:inherit;
      font-size:15px;
      font-weight:800;
      cursor:pointer;
      transition:transform .15s, background .2s, border-color .2s;
    }
    .btn-primary{
      background:var(--text-dark);
      color:#fff;
    }
    .btn-primary:hover{background:#1f2937;transform:translateY(-1px)}
    .btn-secondary{
      background:#fff;
      color:var(--text-dark);
      border:1.5px solid var(--border);
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
    }
    .btn-secondary:hover{border-color:#C4B5FD}
    .divider{
      display:flex;
      align-items:center;
      gap:12px;
      color:var(--text-light);
      font-size:14px;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:.08em;
      margin:2px 0;
    }
    .divider::before,.divider::after{
      content:"";
      flex:1;
      height:1px;
      background:var(--border);
    }
    .login-foot{
      margin-top:22px;
      padding-top:18px;
      border-top:1px solid var(--border);
      display:grid;
      gap:10px;
      text-align:center;
    }
    .login-foot p{
      font-size:14px;
      color:var(--text-gray);
      line-height:1.7;
    }
    .fine{
      font-size:14px!important;
      color:var(--text-light)!important;
    }

    footer{
      background:var(--bg-gray);
      border-top:1px solid var(--border);
      padding:36px 24px 28px;
      margin-top:auto;
    }
    .footer-inner{
      max-width:1100px;
      margin:0 auto;
    }
    .footer-grid{
      display:grid;
      grid-template-columns:2fr 1fr 1fr 1fr;
      gap:40px;
      margin-bottom:34px;
    }
    .footer-brand{
      display:flex;
      align-items:center;
      gap:10px;
      font-weight:800;
      font-size:17px;
      margin-bottom:14px;
    }
    .footer-desc{
      font-size:13.5px;
      color:var(--text-gray);
      line-height:1.65;
      margin-bottom:18px;
      max-width:360px;
    }
    .footer-col h4{
      font-size:11.5px;
      font-weight:700;
      color:var(--text-dark);
      text-transform:uppercase;
      letter-spacing:.07em;
      margin-bottom:14px;
    }
    .footer-col a{
      display:block;
      font-size:13.5px;
      color:var(--text-gray);
      margin-bottom:10px;
      transition:color .2s;
    }
    .footer-col a:hover{color:var(--text-dark)}
    .footer-bottom{
      border-top:1px solid var(--border);
      padding-top:18px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
    }
    .footer-bottom p{
      font-size:14px;
      color:var(--text-light);
    }

    @media (max-width: 760px){
      .login-card{padding:22px;border-radius:26px}
      .login-head h1{font-size:28px}
      .row{align-items:flex-start;flex-direction:column}
      .footer-grid{grid-template-columns:1fr 1fr;gap:24px}
    }
    @media (max-width: 520px){
      .topbar{padding-top:22px}
      .login-wrap{padding:20px 16px 42px}
      .footer-grid{grid-template-columns:1fr}
    }
    .legacy-marketing > nav,
    .legacy-marketing > footer,
    .legacy-marketing > .topbar{display:none !important}
  `,
];

const scripts: string[] = [

];

export const templateTitle = "RingBooker User Login";

export function MarketingLoginTemplate() {
  return (
    <MarketingLayout
      styles={styles}
      scripts={scripts}
      scriptPrefix="marketing-login"
    >
      <>
        <MarketingChromeStyles />
        <MarketingHeader />
      <div className="page legacy-marketing">
        <div className="topbar">
          <a href="/" className="brand">
            <div className="brand-icon">
              <div className="ripple r3" />
              <div className="ripple r2" />
              <div className="core">
                <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
              </div>
            </div>
            <span>RingBooker</span>
          </a>
        </div>
        <section className="login-wrap">
          <div className="login-card">
            <div className="login-head">
              <div className="tag">Merchant login</div>
              <h1>Welcome back.</h1>
              <p>Sign in with your user account to open the RingBooker shop panel.</p>
            </div>
            <form className="form">
              <div className="field">
                <label>Email address</label>
                <input type="email" placeholder="user@luxehair.com" />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" placeholder="Enter your password" />
              </div>
              <div className="row">
                <label className="check">
                  <input type="checkbox" defaultChecked />
                  <span>Keep me signed in</span>
                </label>
                <a href="/admin/forgot-password" className="link">Forgot password?</a>
              </div>
              <button type="button" className="btn btn-primary">Sign in to user portal</button>
              <div className="divider">or</div>
              <button type="button" className="btn btn-secondary">Continue with Google</button>
            </form>
            <div className="login-foot">
              <p>New salon account? <a href="/contact" className="link">Start your 14-day free trial</a></p>
              <p className="fine">Paddle handles subscription billing. Customer deposit and payment flows are not part of this MVP login flow.</p>
            </div>
          </div>
        </section>
        <footer>
          <div className="footer-inner">
            <div className="footer-grid">
              <div>
                <div className="footer-brand">
                  <div className="brand-icon brand-icon-sm">
                    <div className="ripple r3" />
                    <div className="ripple r2" />
                    <div className="core">
                      <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
                    </div>
                  </div>
                  RingBooker
                </div>
                <p className="footer-desc">AI phone agent for booking-heavy businesses. Answer calls, book appointments, and follow up automatically.</p>
              </div>
              <div className="footer-col">
                <h4>Product</h4>
                <a href="/demo">Live Demo</a>
                <a href="/pricing">Pricing</a>
                <a href="/how-it-works">How It Works</a>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <a href="/contact">Contact</a>
                <a href="/faq">FAQ</a>
                <a href="/contact">Support</a>
              </div>
              <div className="footer-col">
                <h4>Legal</h4>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
              </div>
            </div>
            <div className="footer-bottom">
              <p>© 2026 RingBooker. All rights reserved.</p>
              <p>Merchant portal access</p>
            </div>
          </div>
        </footer>
      </div>
        <MarketingFooter />
      </>

    </MarketingLayout>
  );
}
