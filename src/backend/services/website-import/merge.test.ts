import test from 'node:test';
import assert from 'node:assert/strict';

import type { GooglePlacesSuggestion } from './google-places';
import { mergeImportSuggestions, type StaticImportFacts } from './merge';
import type { ImportedServiceSuggestion, LlmImportExtraction } from './types';

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

test('without an LLM catalog, static services (even matrix) are kept as the only source', () => {
  const result = mergeImportSuggestions({
    staticFacts: baseStaticFacts({
      services: [svc('Eyebrow Wax', { sourceHint: 'service_matrix_table' })],
    }),
  });
  assert.ok(result.serviceCatalog.services.map((service) => service.name).includes('Eyebrow Wax'));
});
