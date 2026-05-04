import fs from 'node:fs';
import path from 'node:path';
import HTMLtoJSX from 'htmltojsx';

const repoRoot = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com';
const templateRoot = '/Users/huypq/Documents/Projects/Others/ringbooker.ai/template';
const outputRoot = path.join(repoRoot, 'components');

// NOTE: Regenerating marketing-demo from template HTML can reintroduce legacy outbound UI.
// After `node scripts/generate-static-templates.mjs`, restore web-only `components/marketing/marketing-demo.tsx` from git if needed.

const definitions = [
  {
    key: 'marketing-home',
    input: path.join(templateRoot, 'marketing', 'home.html'),
    output: path.join(outputRoot, 'marketing', 'marketing-home.tsx'),
    exportName: 'MarketingHomeTemplate',
    scope: 'marketing',
  },
  {
    key: 'marketing-demo',
    input: path.join(templateRoot, 'marketing', 'demo.html'),
    output: path.join(outputRoot, 'marketing', 'marketing-demo.tsx'),
    exportName: 'MarketingDemoTemplate',
    scope: 'marketing',
  },
  {
    key: 'marketing-pricing',
    input: path.join(templateRoot, 'marketing', 'pricing.html'),
    output: path.join(outputRoot, 'marketing', 'marketing-pricing.tsx'),
    exportName: 'MarketingPricingTemplate',
    scope: 'marketing',
  },
  {
    key: 'marketing-how-it-works',
    input: path.join(templateRoot, 'marketing', 'how-it-works.html'),
    output: path.join(outputRoot, 'marketing', 'marketing-how-it-works.tsx'),
    exportName: 'MarketingHowItWorksTemplate',
    scope: 'marketing',
  },
  {
    key: 'marketing-contact',
    input: path.join(templateRoot, 'marketing', 'contact.html'),
    output: path.join(outputRoot, 'marketing', 'marketing-contact.tsx'),
    exportName: 'MarketingContactTemplate',
    scope: 'marketing',
  },
  {
    key: 'marketing-login',
    input: path.join(templateRoot, 'marketing', 'login.html'),
    output: path.join(outputRoot, 'marketing', 'marketing-login.tsx'),
    exportName: 'MarketingLoginTemplate',
    scope: 'marketing',
  },
  {
    key: 'user-dashboard',
    input: path.join(templateRoot, 'user', 'dashboard.html'),
    output: path.join(outputRoot, 'user', 'user-dashboard.tsx'),
    exportName: 'UserDashboardTemplate',
    scope: 'user',
  },
  {
    key: 'user-bookings',
    input: path.join(templateRoot, 'user', 'bookings.html'),
    output: path.join(outputRoot, 'user', 'user-bookings.tsx'),
    exportName: 'UserBookingsTemplate',
    scope: 'user',
  },
  {
    key: 'user-calls',
    input: path.join(templateRoot, 'user', 'calls.html'),
    output: path.join(outputRoot, 'user', 'user-calls.tsx'),
    exportName: 'UserCallsTemplate',
    scope: 'user',
  },
  {
    key: 'user-settings',
    input: path.join(templateRoot, 'user', 'settings.html'),
    output: path.join(outputRoot, 'user', 'user-settings.tsx'),
    exportName: 'UserSettingsTemplate',
    scope: 'user',
  },
  {
    key: 'user-billing',
    input: path.join(templateRoot, 'user', 'billing.html'),
    output: path.join(outputRoot, 'user', 'user-billing.tsx'),
    exportName: 'UserBillingTemplate',
    scope: 'user',
  },
  {
    key: 'admin-dashboard',
    input: path.join(templateRoot, 'admin', 'dashboard.html'),
    output: path.join(outputRoot, 'admin', 'admin-dashboard.tsx'),
    exportName: 'AdminDashboardTemplate',
    scope: 'admin',
  },
  {
    key: 'admin-shops',
    input: path.join(templateRoot, 'admin', 'shops.html'),
    output: path.join(outputRoot, 'admin', 'admin-shops.tsx'),
    exportName: 'AdminShopsTemplate',
    scope: 'admin',
  },
  {
    key: 'admin-shop-detail',
    input: path.join(templateRoot, 'admin', 'shop-detail.html'),
    output: path.join(outputRoot, 'admin', 'admin-shop-detail.tsx'),
    exportName: 'AdminShopDetailTemplate',
    scope: 'admin',
  },
  {
    key: 'admin-calls',
    input: path.join(templateRoot, 'admin', 'calls.html'),
    output: path.join(outputRoot, 'admin', 'admin-calls.tsx'),
    exportName: 'AdminCallsTemplate',
    scope: 'admin',
  },
  {
    key: 'admin-billing',
    input: path.join(templateRoot, 'admin', 'billing.html'),
    output: path.join(outputRoot, 'admin', 'admin-billing.tsx'),
    exportName: 'AdminBillingTemplate',
    scope: 'admin',
  },
  {
    key: 'admin-users',
    input: path.join(templateRoot, 'admin', 'users.html'),
    output: path.join(outputRoot, 'admin', 'admin-users.tsx'),
    exportName: 'AdminUsersTemplate',
    scope: 'admin',
  },
  {
    key: 'admin-system-health',
    input: path.join(templateRoot, 'admin', 'system-health.html'),
    output: path.join(outputRoot, 'admin', 'admin-system-health.tsx'),
    exportName: 'AdminSystemHealthTemplate',
    scope: 'admin',
  },
  {
    key: 'admin-login',
    input: path.join(templateRoot, 'admin', 'login.html'),
    output: path.join(outputRoot, 'admin', 'admin-login.tsx'),
    exportName: 'AdminLoginTemplate',
    scope: 'admin',
  },
  {
    key: 'admin-forgot-password',
    input: path.join(templateRoot, 'admin', 'forgot-password.html'),
    output: path.join(outputRoot, 'admin', 'admin-forgot-password.tsx'),
    exportName: 'AdminForgotPasswordTemplate',
    scope: 'admin',
  },
  {
    key: 'admin-reset-password',
    input: path.join(templateRoot, 'admin', 'reset-password.html'),
    output: path.join(outputRoot, 'admin', 'admin-reset-password.tsx'),
    exportName: 'AdminResetPasswordTemplate',
    scope: 'admin',
  },
];

const marketingMap = [
  ['home.html', '/'],
  ['demo.html', '/demo'],
  ['pricing.html', '/pricing'],
  ['how-it-works.html', '/how-it-works'],
  ['contact.html', '/contact'],
  ['login.html', '/user/login'],
];

const userMap = [
  ['dashboard.html', '/user'],
  ['bookings.html', '/user/bookings'],
  ['calls.html', '/user/calls'],
  ['settings.html', '/user/settings'],
  ['account.html', '/user/account'],
  ['billing.html', '/user/billing'],
];

const adminMap = [
  ['dashboard.html', '/admin'],
  ['shops.html', '/admin/shops'],
  ['shop-detail.html', '/admin/shops/luxe-hair-studio'],
  ['calls.html', '/admin/calls'],
  ['demos.html', '/admin/demos'],
  ['billing.html', '/admin/billing'],
  ['users.html', '/admin/users'],
  ['system-health.html', '/admin/system-health'],
  ['login.html', '/admin/login'],
  ['forgot-password.html', '/admin/forgot-password'],
  ['reset-password.html', '/admin/reset-password'],
];

function escapeTemplateLiteral(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
}

function rewriteInternalLinks(input, scope) {
  const scopedMap = [
    ...marketingMap,
    ...(scope === 'user' ? userMap : []),
    ...(scope === 'admin' ? adminMap : []),
  ];

  let output = input;
  for (const [from, to] of scopedMap) {
    output = output.replaceAll(`href="${from}"`, `href="${to}"`);
  }
  return output;
}

function parseTemplate(definition) {
  const rawHtml = fs.readFileSync(definition.input, 'utf8');
  const title = rawHtml.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? 'RingBooker';
  const bodyMatch = rawHtml.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);

  if (!bodyMatch) {
    throw new Error(`Missing body in template ${definition.input}`);
  }

  const bodyAttributes = bodyMatch[1] ?? '';
  const bodyClass = bodyAttributes.match(/class="([^"]+)"/i)?.[1];
  let bodyHtml = bodyMatch[2] ?? '';

  const styles = Array.from(rawHtml.matchAll(/<style>([\s\S]*?)<\/style>/gi)).map(
    (match) => match[1] ?? '',
  );

  for (const match of rawHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/gi)) {
    const href = match[1];
    if (!href || href.startsWith('http')) continue;
    const cssPath = path.resolve(path.dirname(definition.input), href);
    if (fs.existsSync(cssPath)) {
      styles.push(fs.readFileSync(cssPath, 'utf8'));
    }
  }

  const scripts = [];
  bodyHtml = bodyHtml.replace(/<script>([\s\S]*?)<\/script>/gi, (_, scriptContent) => {
    scripts.push(scriptContent);
    return '';
  });

  bodyHtml = bodyHtml.replace(/\sonclick="[^"]*"/gi, '');

  bodyHtml = rewriteInternalLinks(bodyHtml, definition.scope);

  if (definition.key === 'marketing-home') {
    for (let index = 0; index < styles.length; index += 1) {
      styles[index] = styles[index]
        .replace(
          '.reveal{opacity:0;transform:translateY(20px);transition:opacity .6s ease,transform .6s ease}',
          '.reveal{opacity:1;transform:none}',
        )
        .replace('.reveal.vis{opacity:1;transform:none}', '.reveal.vis{opacity:1;transform:none}');
    }

    scripts.push(`
document.getElementById('tog-m')?.addEventListener('click', () => setPrice('monthly'))
document.getElementById('tog-a')?.addEventListener('click', () => setPrice('annual'))
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => toggleFaq(btn))
})
`);
  }

  return { title, bodyClass, bodyHtml, styles, scripts };
}

function generateModule(definition) {
  const template = parseTemplate(definition);
  const converter = new HTMLtoJSX({ createClass: false });
  const jsxBody = converter
    .convert(template.bodyHtml)
    .replace(/defaultValue(\s*\/>)/g, 'defaultValue=""$1')
    .replace(/\sclassName(?=[\s/>])/g, '');
  const bodyLines = jsxBody
    .split('\n')
    .map((line) => (line ? `      ${line}` : ''))
    .join('\n');
  const layoutComponentByScope = {
    marketing: 'MarketingLayout',
    user: 'UserLayout',
    admin: 'AdminLayout',
  };
  const layoutImportByScope = {
    marketing: "@/components/marketing/marketing-layout",
    user: "@/components/user/user-layout",
    admin: "@/components/admin/admin-layout",
  };
  const layoutComponent = layoutComponentByScope[definition.scope];
  const layoutImport = layoutImportByScope[definition.scope];

  return `import { ${layoutComponent} } from '${layoutImport}';

const styles: string[] = [
${template.styles.map((style) => `  String.raw\`${escapeTemplateLiteral(style)}\`,`).join('\n')}
];

const scripts: string[] = [
${template.scripts.map((script) => `  String.raw\`${escapeTemplateLiteral(script)}\`,`).join('\n')}
];

export const templateTitle = ${JSON.stringify(template.title)};

export function ${definition.exportName}() {
  return (
    <${layoutComponent}
      styles={styles}
      scripts={scripts}
      scriptPrefix=${JSON.stringify(definition.key)}${template.bodyClass ? `
      bodyClass=${JSON.stringify(template.bodyClass)}` : ''}
    >
${bodyLines}
    </${layoutComponent}>
  );
}
`;
}

for (const definition of definitions) {
  fs.mkdirSync(path.dirname(definition.output), { recursive: true });
  fs.writeFileSync(definition.output, generateModule(definition));
}

console.log(`Generated ${definitions.length} static template TSX modules.`);
