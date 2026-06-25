import { MarketingLegalPage } from '@/components/marketing/marketing-legal';

export type MarketingAboutContent = {
  breadcrumb: string;
  hero: {
    h1: string;
    subtitle: string;
  };
  intro: string[];
  company: {
    heading: string;
    paragraphs: string[];
  };
};

function renderParagraphWithEmail(text: string) {
  const email = 'support@ringbooker.com';
  if (!text.includes(email)) return text;
  const [before, after] = text.split(email);
  return (
    <>
      {before}
      <strong>{email}</strong>
      {after}
    </>
  );
}

export function MarketingAboutPage({ content }: { content: MarketingAboutContent }) {
  return (
    <MarketingLegalPage
      breadcrumbLabel={content.breadcrumb}
      title={content.hero.h1}
      subtitle={content.hero.subtitle}
      intro={
        <>
          {content.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </>
      }
      sections={[
        {
          title: content.company.heading,
          content: (
            <>
              {content.company.paragraphs.map((paragraph) => (
                <p key={paragraph}>{renderParagraphWithEmail(paragraph)}</p>
              ))}
            </>
          ),
        },
      ]}
    />
  );
}
