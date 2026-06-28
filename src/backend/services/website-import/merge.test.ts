import test from 'node:test';
import assert from 'node:assert/strict';

import type { GooglePlacesSuggestion } from './google-places';
import { mergeImportSuggestions, type StaticImportFacts } from './merge';
import type { FaqSuggestion, ImportedServiceSuggestion, LlmImportExtraction, StaffSuggestion } from './types';

function svc(name: string, extra: Partial<ImportedServiceSuggestion> = {}): ImportedServiceSuggestion {
  return { categoryName: 'General Services', name, source: 'Website', confidence: 0.8, ...extra } as ImportedServiceSuggestion;
}

function emptyField() {
  return { value: null, confidence: 0, source: null };
}

function field<T>(value: T, confidence = 0.8, source = 'Website') {
  return { value, confidence, source };
}

function baseStaticFacts(overrides: Partial<StaticImportFacts> = {}): StaticImportFacts {
  return {
    sourceUrl: 'https://www.maisondemisalon.com/',
    sourceType: 'normal_website',
    name: emptyField(),
    primaryType: emptyField(),
    phone: emptyField(),
    website: emptyField(),
    address: emptyField(),
    timezone: emptyField(),
    hours: emptyField(),
    services: [],
    bookingUrl: emptyField(),
    ...overrides,
  };
}

const placesSameDomain: GooglePlacesSuggestion = {
  name: 'Maison De Mi',
  website: 'https://www.maisondemisalon.com/',
  matchConfidence: 0.9,
};

test('Google Places name wins over a generic scraped <title> name when Places lists the same domain', () => {
  const result = mergeImportSuggestions({
    staticFacts: baseStaticFacts({ name: field('Our Salon', 0.5, 'Title') }),
    googlePlaces: placesSameDomain,
  });
  assert.equal(result.businessProfile.name.value, 'Maison De Mi');
});

test('site JSON-LD name still wins over Google Places name', () => {
  const result = mergeImportSuggestions({
    staticFacts: baseStaticFacts({ name: field('Maison De Mi Salon & Spa', 0.9, 'JSON-LD') }),
    googlePlaces: placesSameDomain,
  });
  assert.equal(result.businessProfile.name.value, 'Maison De Mi Salon & Spa');
});

test('scraped website name is kept when Google Places lists a different domain', () => {
  const result = mergeImportSuggestions({
    staticFacts: baseStaticFacts({ name: field('Our Salon', 0.5, 'Title') }),
    googlePlaces: { name: 'Some Other Place', website: 'https://different-business.example/', matchConfidence: 0.9 },
  });
  assert.equal(result.businessProfile.name.value, 'Our Salon');
});

test('when the LLM returns a strong catalog, garbled static matrix-table services are dropped', () => {
  const result = mergeImportSuggestions({
    staticFacts: baseStaticFacts({
      services: [
        svc('Hair Cut Cash Price Credit Price Bang Cut', { sourceHint: 'service_matrix_table', categoryName: 'Hair Cut' }),
        svc('Clean Repeated Card Service', { sourceHint: 'repeated_card' }),
      ],
    }),
    llm: {
      serviceCatalog: {
        confidence: 0.85,
        services: [svc('Bang Cut', { categoryName: 'Hair Cut' }), svc('Short Hair Cut'), svc('Long Hair Cut')],
      },
    } as LlmImportExtraction,
  });
  const names = result.serviceCatalog.services.map((service) => service.name);
  assert.ok(!names.some((name) => /cash price credit price/i.test(name)), 'garbled matrix-table name should be dropped');
  assert.ok(names.includes('Bang Cut'), 'clean LLM service should be present');
  assert.ok(names.includes('Clean Repeated Card Service'), 'clean static (non-matrix) service should be kept');
});

test('a confident small LLM catalog still beats noisy static service extraction', () => {
  const result = mergeImportSuggestions({
    staticFacts: baseStaticFacts({
      services: [
        svc('Hair Cut Cash Price Credit Price Bang Cut', { sourceHint: 'service_matrix_table', categoryName: 'Hair Cut' }),
        svc('Clean Repeated Card Service', { sourceHint: 'repeated_card' }),
      ],
    }),
    llm: {
      serviceCatalog: {
        confidence: 0.9,
        services: [svc('Adult Hair Cut', { categoryName: 'Hair Cut', source: 'AI', confidence: 0.92 })],
      },
    } as LlmImportExtraction,
  });
  const names = result.serviceCatalog.services.map((service) => service.name);
  assert.deepEqual(names, ['Adult Hair Cut', 'Clean Repeated Card Service']);
});

test('LLM service names merge with static prices across category drift and drop promo prices', () => {
  const result = mergeImportSuggestions({
    staticFacts: baseStaticFacts({
      services: [
        svc('Blow-Dry Style', { categoryName: 'Haircuts', source: 'Website', confidence: 0.8, priceAmount: 50, priceType: 'from', sourceHint: 'heading_sibling' }),
        svc('GIFT FOR YOU +', { categoryName: 'General Services', source: 'Website', confidence: 0.8, priceAmount: 20, priceType: 'fixed', sourceHint: 'heading_sibling' }),
      ],
    }),
    llm: {
      serviceCatalog: {
        confidence: 0.86,
        services: [svc('Blow-Dry Style', { categoryName: 'Haircuts & Styles', source: 'AI', confidence: 0.75, priceAmount: null })],
      },
    } as LlmImportExtraction,
  });

  assert.deepEqual(result.serviceCatalog.services.map((service) => service.name), ['Blow-Dry Style']);
  assert.equal(result.serviceCatalog.services[0]?.categoryName, 'Haircuts & Styles');
  assert.equal(result.serviceCatalog.services[0]?.priceAmount, 50);
  assert.equal(result.serviceCatalog.services.some((service) => /gift/i.test(service.name)), false);
});

test('LLM secondary knowledge wins duplicate staff and FAQ keys', () => {
  const staticStaff: StaffSuggestion = { name: 'Mia Chen', source: 'website', confidence: 0.62 };
  const llmStaff: StaffSuggestion = { name: 'Mia Chen', role: 'Color Specialist', specialties: ['Balayage'], source: 'llm', confidence: 0.88 };
  const staticFaq: FaqSuggestion = { question: 'Do you accept walk-ins?', answer: 'Maybe. Please call.', source: 'website', confidence: 0.6 };
  const llmFaq: FaqSuggestion = { question: 'Do you accept walk-ins?', answer: 'Walk-ins are welcome when a stylist is available.', source: 'llm', confidence: 0.86 };
  const result = mergeImportSuggestions({
    staticFacts: baseStaticFacts({
      staffSuggestions: [staticStaff],
      faqSuggestions: [staticFaq],
    }),
    llm: {
      staffSuggestions: [llmStaff],
      faqSuggestions: [llmFaq],
    } as LlmImportExtraction,
  });
  assert.equal(result.staffSuggestions.length, 1);
  assert.equal(result.staffSuggestions[0]?.source, 'llm');
  assert.equal(result.staffSuggestions[0]?.role, 'Color Specialist');
  assert.equal(result.faqSuggestions.length, 1);
  assert.equal(result.faqSuggestions[0]?.source, 'llm');
  assert.equal(result.faqSuggestions[0]?.answer, 'Walk-ins are welcome when a stylist is available.');
});

test('without an LLM catalog, static services (even matrix) are kept as the only source', () => {
  const result = mergeImportSuggestions({
    staticFacts: baseStaticFacts({
      services: [svc('Eyebrow Wax', { sourceHint: 'service_matrix_table' })],
    }),
  });
  assert.ok(result.serviceCatalog.services.map((service) => service.name).includes('Eyebrow Wax'));
});
