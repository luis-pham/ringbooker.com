import type { Shop } from '@/src/backend/domain/types';

import type { EvalRule, TestScenario } from './hair-salon-inbound';

export type { EvalRule, TestScenario };

/**
 * Nail salon shop override, applied on top of the shared hair-salon testShop fixture (see
 * runner.ts) so this file doesn't need its own full Shop fixture just to change vertical,
 * staff, and services.
 */
const nailSalonShopOverride: Partial<Shop> = {
  name: 'Luna Nail Studio',
  vertical: 'nail_salon',
  vertical_detail: 'full-service nail salon',
  staff: [
    { name: 'Mina Tran', role: 'Owner, Nail Technician', specialties: ['Gel manicure', 'Nail art'], active: true },
    { name: 'Cindy Pham', role: 'Nail Technician', specialties: ['Acrylics', 'Dip powder'], active: true },
  ],
  services: [
    { name: 'Gel Manicure', duration_min: 45, price: 42 },
    { name: 'Signature Pedicure', duration_min: 60, price: 58 },
    { name: 'Dip Powder Set', duration_min: 60, price: 55 },
  ],
  service_catalog: undefined,
};

export const nailSalonInboundScenarios: TestScenario[] = [
  {
    id: 'nail-salon-stated-day-time-preference-not-dropped',
    category: 'booking_flow',
    // Nail-salon analog of hair-salon's stated-preference scenario. nail-salon.txt's sample
    // wording "Do you want a specific technician?" is the same kind of scripted next question
    // that must not fire before addressing a stated day/time preference.
    callerUtterance:
      "Hi, I wanted to ask about a gel manicure. Do you have anything Thursday or Friday? I work during the week, so evenings would be easier, or I could maybe squeeze in a lunch break.",
    shopOverride: nailSalonShopOverride,
    rules: [
      {
        description: 'Must acknowledge the stated day(s) or time-of-day preference',
        check: 'llm_judge',
        prompt:
          'The caller mentioned Thursday or Friday, and said evenings or a lunch break would work for them. Does this response directly engage with that day and/or time-of-day preference (e.g. confirms a day, asks for a specific time within what they described, or offers times that fit) rather than ignoring it? Answer YES or NO only.',
      },
      {
        description: 'Must NOT ask an unrelated scripted question (e.g. technician preference) without addressing the stated preference first',
        check: 'llm_judge',
        prompt:
          'Does this response ask about technician/nail-tech preference, or any other unrelated scripted booking question, WITHOUT first acknowledging the caller\'s stated day/time preference (Thursday, Friday, evenings, or lunch)? Answer YES or NO only. YES means FAIL.',
      },
    ],
  },
];
