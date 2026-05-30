import type { Shop } from '@/src/backend/domain/types';

export interface TestScenario {
  id: string;
  category: 'answer_first' | 'booking_flow' | 'edge_case' | 'tone';
  callerUtterance: string;
  shopOverride?: Partial<Shop>;
  rules: EvalRule[];
}

export interface EvalRule {
  description: string;
  check: 'contains' | 'not_contains' | 'starts_with' | 'llm_judge';
  value?: string;
  prompt?: string;
}

export const hairSalonInboundScenarios: TestScenario[] = [
  {
    id: 'hours-full-week',
    category: 'answer_first',
    callerUtterance: 'What are your hours?',
    rules: [
      {
        description: 'Must include multiple days of the week',
        check: 'llm_judge',
        prompt:
          'Does this response give a full weekly schedule starting from Monday or Tuesday, in AM/PM format (e.g. 9 AM, 7 PM), with at least 4 days mentioned? Answer YES or NO only.',
      },
      {
        description: 'Must NOT ask what service caller wants',
        check: 'not_contains',
        value: 'what service',
      },
      {
        description: 'Must mention Monday is closed',
        check: 'llm_judge',
        prompt: 'Does this response mention that Monday is closed? Answer YES or NO only.',
      },
      {
        description: 'Must NOT ask booking question before answering',
        check: 'llm_judge',
        prompt:
          'Before giving the weekly hours, does this response ask for a booking detail like service, appointment, date, or time? Generic follow-up questions after the hours do not count. Answer YES or NO only. YES means FAIL.',
      },
    ],
  },
  {
    id: 'price-single-service',
    category: 'answer_first',
    callerUtterance: "How much is a women's haircut?",
    rules: [
      {
        description: 'Must state price $75',
        check: 'contains',
        value: '75',
      },
      {
        description: 'Must mention duration',
        check: 'llm_judge',
        prompt: 'Does this response mention how long the service takes (duration/time)? Answer YES or NO only.',
      },
      {
        description: 'Must NOT ask qualifying question before answering',
        check: 'llm_judge',
        prompt: 'Does the response answer the price question directly without asking another question first? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'price-color-service',
    category: 'answer_first',
    callerUtterance: 'How much does balayage cost?',
    rules: [
      {
        description: 'Must mention price',
        check: 'contains',
        value: '220',
      },
      {
        description: 'Must mention duration or time commitment',
        check: 'llm_judge',
        prompt: 'Does this response mention how long balayage takes? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'service-availability-check',
    category: 'answer_first',
    callerUtterance: 'Do you do keratin treatments?',
    rules: [
      {
        description: 'Must answer yes directly',
        check: 'llm_judge',
        prompt: 'Does this response confirm that the salon offers keratin treatments? Answer YES or NO only.',
      },
      {
        description: 'Must NOT ask booking question first',
        check: 'llm_judge',
        prompt: 'Does the response answer the yes/no question before asking anything about booking? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'staff-inquiry',
    category: 'answer_first',
    callerUtterance: 'Who are your stylists?',
    rules: [
      {
        description: 'Must name at least 2 stylists',
        check: 'llm_judge',
        prompt: 'Does this response name at least 2 specific stylists? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'location-parking',
    category: 'answer_first',
    callerUtterance: 'Where are you located and is there parking?',
    rules: [
      {
        description: 'Must give address',
        check: 'llm_judge',
        prompt: 'Does this response include a street address or location? Answer YES or NO only.',
      },
      {
        description: 'Must mention parking',
        check: 'llm_judge',
        prompt: 'Does this response address the parking question? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'explicit-booking-intent',
    category: 'booking_flow',
    callerUtterance: 'I want to book a haircut',
    rules: [
      {
        description: 'Must go into booking flow',
        check: 'llm_judge',
        prompt: 'Does this response start the booking process by asking for a day/time or other booking detail? Answer YES or NO only.',
      },
      {
        description: 'Must NOT give a long info response first',
        check: 'llm_judge',
        prompt: 'Does the response immediately help with booking rather than giving a long informational answer? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'booking-with-stylist-preference',
    category: 'booking_flow',
    callerUtterance: 'I want to book with Jessica for a color',
    rules: [
      {
        description: 'Must acknowledge Jessica',
        check: 'llm_judge',
        prompt: 'Does this response acknowledge the stylist preference for Jessica? Answer YES or NO only.',
      },
      {
        description: 'Must ask for day/time',
        check: 'llm_judge',
        prompt: 'Does this response ask about preferred day or time? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'booking-vague-time',
    category: 'booking_flow',
    callerUtterance: 'Can I come in Saturday morning?',
    rules: [
      {
        description: 'Must ask for more specific time',
        check: 'llm_judge',
        prompt: 'Does this response ask for a more specific time within Saturday morning? Answer YES or NO only.',
      },
      {
        description: 'Response must be concise',
        check: 'llm_judge',
        prompt: 'Is this response under 30 words? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'square-creates-booking-not-link',
    category: 'booking_flow',
    callerUtterance: 'I want to book a haircut Saturday at 10am, my name is Sarah',
    shopOverride: {
      selected_integration: 'square_appointments',
      booking_method: 'app',
      booking_url: 'https://legacy-booking.example/salon',
      google_cal_credentials_encrypted: JSON.stringify({
        provider: 'square_appointments',
        access_token: 'square-access-token',
        refresh_token: 'square-refresh-token',
        merchant_id: 'square-merchant-id',
        location_id: 'square-location-id',
        service_variation_id: 'square-service-variation-id',
      }),
    },
    rules: [
      {
        description: 'Must attempt create_booking not send link',
        check: 'llm_judge',
        prompt:
          'The shop has Square Appointments connected with full sync. The AI response mentions confirming a booking or says "you are booked" or "all set". Does it sound like a direct booking was made rather than just sending a link? Answer YES or NO only.',
      },
      {
        description: 'Must NOT say "booking link sent"',
        check: 'not_contains',
        value: 'booking link',
      },
    ],
  },
  {
    id: 'link-only-sends-booking-link',
    category: 'booking_flow',
    callerUtterance: 'I want to book a balayage next Friday',
    shopOverride: {
      selected_integration: 'fresha',
      booking_method: 'app',
      booking_url: 'https://fresha.com/test',
    },
    rules: [
      {
        description: 'Must send booking link for link-only provider',
        check: 'llm_judge',
        prompt:
          'The shop uses Fresha link-only (no direct booking API). Does the AI response mention sending a booking link or texting a link to the caller? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'question-then-booking',
    category: 'edge_case',
    callerUtterance: 'How long does a balayage take? I might want to book one',
    rules: [
      {
        description: 'Must answer duration question first',
        check: 'llm_judge',
        prompt: 'Does this response answer the duration question before asking booking details? Answer YES or NO only.',
      },
      {
        description: 'Must offer booking after answering',
        check: 'llm_judge',
        prompt: 'Does this response offer to help with booking after answering the question? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'walkins',
    category: 'edge_case',
    callerUtterance: 'Do you take walk-ins?',
    rules: [
      {
        description: 'Must answer the walk-in question directly',
        check: 'llm_judge',
        prompt: 'Does this response directly answer whether walk-ins are accepted? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'cancellation-policy',
    category: 'edge_case',
    callerUtterance: 'What is your cancellation policy?',
    rules: [
      {
        description: 'Must state cancellation notice requirement',
        check: 'llm_judge',
        prompt: 'Does this response mention a cancellation notice period or fee? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'tone-natural',
    category: 'tone',
    callerUtterance: 'Hi there',
    rules: [
      {
        description: 'Must NOT say "How may I assist you"',
        check: 'not_contains',
        value: 'How may I assist',
      },
      {
        description: 'Must sound natural and warm',
        check: 'llm_judge',
        prompt: 'Does this response sound like a friendly American receptionist rather than a robot or formal assistant? Answer YES or NO only.',
      },
      {
        description: 'Must be short',
        check: 'llm_judge',
        prompt: 'Is this response under 15 words? Answer YES or NO only.',
      },
    ],
  },
  {
    id: 'tone-no-corporate-language',
    category: 'tone',
    callerUtterance: 'Can you help me?',
    rules: [
      {
        description: 'Must not use robotic phrases',
        check: 'llm_judge',
        prompt:
          'Does this response contain any of these robotic phrases: "How may I assist", "I have successfully", "Please provide", "Is there anything else I can assist you with", "utilize", "I apologize for the inconvenience"? Answer YES if any are present, NO if none. YES means FAIL.',
      },
    ],
  },
];
