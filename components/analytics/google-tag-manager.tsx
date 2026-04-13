import Script from 'next/script';

const DEFAULT_GTM_ID = 'GTM-W3SF4NH5';

function resolveGtmContainerId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GTM_ID;
  if (raw === '') return null;
  const trimmed = raw?.trim();
  if (trimmed === 'false' || trimmed === '0') return null;
  return trimmed || DEFAULT_GTM_ID;
}

/**
 * Google Tag Manager — script + noscript per official install snippet.
 * Set NEXT_PUBLIC_GTM_ID to override, empty string or "false" to skip (e.g. local).
 */
export function GoogleTagManager() {
  const gtmId = resolveGtmContainerId();
  if (!gtmId) return null;

  const initScript = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`;

  return (
    <>
      <Script id="google-tag-manager" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: initScript }} />
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height={0}
          width={0}
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}
