function buildBreadcrumbListSchema(path: string, label: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ringbooker.com/' },
      { '@type': 'ListItem', position: 2, name: label, item: `https://ringbooker.com${path}` },
    ],
  };
}

export function buildPricingSchemas(data: {
  schema: {
    provider: {
      name: string;
      url: string;
      description: string;
      telephone: string;
      email: string;
      same_as: string[];
    };
    page_name: string;
    page_description: string;
  };
  plans: Array<{
    id: string;
    name: string;
    description: string;
    price_monthly?: number;
    price_annual?: number;
    price_label?: string;
    cta_href: string;
  }>;
  faq: Array<{ q: string; a: string }>;
}) {
  const { schema, plans, faq } = data;

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: schema.page_name,
    description: schema.page_description,
    url: 'https://ringbooker.com/pricing',
    provider: {
      '@type': 'SoftwareApplication',
      name: schema.provider.name,
      url: schema.provider.url,
    },
  };

  const paidPlans = plans.filter((plan) => plan.price_monthly);
  const softwareApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: schema.provider.name,
    url: schema.provider.url,
    description: schema.provider.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: paidPlans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      description: plan.description,
      price: plan.price_monthly?.toString(),
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: plan.price_monthly,
        priceCurrency: 'USD',
        billingIncrement: 1,
        unitCode: 'MON',
      },
      url: `https://ringbooker.com${plan.cta_href}`,
    })),
    sameAs: schema.provider.same_as,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: schema.provider.telephone,
      email: schema.provider.email,
      contactType: 'customer support',
    },
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return [webPage, softwareApp, faqPage, buildBreadcrumbListSchema('/pricing', 'Pricing')];
}

export function buildIndustrySchemas(slug: string, data: any) {
  const { schema, faq } = data;
  const url = `https://ringbooker.com/industries/${slug}`;

  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: schema.service_type,
    description: schema.page_description,
    url,
    provider: {
      '@type': 'Organization',
      name: 'RingBooker',
      url: 'https://ringbooker.com',
    },
    areaServed: {
      '@type': 'Country',
      name: schema.service_area,
    },
    audience: {
      '@type': 'Audience',
      audienceType: schema.audience,
    },
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: schema.page_name,
    description: schema.page_description,
    url,
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item: any) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return [service, webPage, faqPage];
}

export function buildAboutSchemas(data: any) {
  const { schema } = data;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: schema.org.name,
      legalName: schema.org.legal_name,
      url: schema.org.url,
      email: schema.org.email,
      telephone: schema.org.telephone,
      foundingLocation: {
        '@type': 'Place',
        name: schema.org.founding_location,
      },
      sameAs: schema.org.same_as,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: schema.page_name,
      description: schema.page_description,
      url: 'https://ringbooker.com/about',
      about: {
        '@type': 'Organization',
        name: schema.org.name,
        url: schema.org.url,
      },
    },
    buildBreadcrumbListSchema('/about', 'About'),
  ];
}

export function buildHowItWorksSchemas(data: any) {
  const { schema, sections, faq } = data;
  const steps = sections.find((s: any) => s.id === 'three-step-flow')?.steps ?? [];

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: schema.page_name,
      description: schema.page_description,
      url: 'https://ringbooker.com/how-it-works',
      step: steps.map((s: any) => ({
        '@type': 'HowToStep',
        position: s.number,
        name: s.title,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.items.map((item: any) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
    buildBreadcrumbListSchema('/how-it-works', 'How It Works'),
  ];
}

export function buildContactSchemas(data: any) {
  const { schema, faq } = data;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: schema.page_name,
      description: schema.page_description,
      url: 'https://ringbooker.com/contact',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.items.map((item: any) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
    buildBreadcrumbListSchema('/contact', 'Contact'),
  ];
}

export function buildHomeSchemas(data: any) {
  const { faq } = data;

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.items.map((item: any) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return [faqPage];
}

export function buildHubSchemas(data: any) {
  const { schema, meta } = data;
  const faqItems = data.faq?.items ?? data.faqs ?? [];

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: schema.page_name,
    description: schema.page_description,
    url: `https://ringbooker.com${meta.canonical}`,
    about: {
      '@type': 'Thing',
      name: schema.topic,
    },
  };

  const faqPage = faqItems.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item: any) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.a,
          },
        })),
      }
    : null;

  return [webPage, faqPage].filter(Boolean);
}
