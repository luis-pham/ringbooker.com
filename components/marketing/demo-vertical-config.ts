export type DemoVerticalSlug = 'nail-salon' | 'hair-salon' | 'day-spa' | 'med-spa' | 'beauty-clinic';

export type DemoServiceCategory = {
  id: string;
  label: string;
  items: Array<{
    name: string;
    price: number;
    duration?: string;
    enabled: boolean;
  }>;
};

export type DemoVerticalConfig = {
  slug: DemoVerticalSlug;
  businessType: string;
  eyebrow: string;
  icon: string;
  accent: string;
  title: string;
  subtitle: string;
  defaultBusinessName: string;
  defaultCity: string;
  hours: {
    primary: string;
    secondary: string;
  };
  staffLabel: string;
  staffPlaceholder: string;
  serviceLabel: string;
  quickScenario: string;
  persona: string;
  tone: string;
  safetyNote: string;
  demoVsReal: string;
  tryAsking: string[];
  quickStartPrompts: string[];
  serviceCategories: DemoServiceCategory[];
  smsPreview: string;
  promptRules: string[];
};

export const DEMO_VERTICALS: Record<DemoVerticalSlug, DemoVerticalConfig> = {
  'nail-salon': {
    slug: 'nail-salon',
    businessType: 'nail-salon',
    eyebrow: 'RingBooker demo for nail salons',
    icon: 'N',
    accent: '#7C3AED',
    title: 'Hear How RingBooker Answers Nail Salon Calls',
    subtitle:
      'Try a live demo call — booking, pricing, reschedule, and after-hours — with sample nail studio context.',
    defaultBusinessName: 'ABC Nails Studio',
    defaultCity: 'Garden Grove, CA',
    hours: { primary: 'Mon-Sat 9am-7pm', secondary: 'Sun 10am-5pm' },
    staffLabel: 'Technicians',
    staffPlaceholder: 'Lan, Mai, Thu',
    serviceLabel: 'Fast-turn nail services',
    quickScenario: 'Quick nail salon demo with bilingual booking, pricing, and reschedule flow.',
    persona: 'Upbeat, quick, warm nail salon phone assistant.',
    tone: 'Friendly, direct, bilingual when the caller uses Vietnamese.',
    safetyNote: 'Demo only. It calls the number you enter and never changes your real salon line.',
    demoVsReal:
      'This demo is outbound and web-only. Production RingBooker is inbound, works on your current number, and is configured separately from this demo.',
    tryAsking: [
      'I want to book a gel manicure.',
      'Do you have walk-in availability today?',
      'How much is an acrylic full set?',
      'Can I reschedule tomorrow’s appointment?',
      'Do you do dip powder?',
      'Xin chào, tôi muốn đặt lịch làm nail.',
    ],
    quickStartPrompts: ['Gel manicure booking', 'Acrylic pricing', 'Try Vietnamese', 'Reschedule tomorrow'],
    serviceCategories: [
      {
        id: 'manicure',
        label: 'Manicure',
        items: [
          { name: 'Regular Manicure', price: 18, duration: '30 min', enabled: true },
          { name: 'Gel Manicure', price: 32, duration: '45 min', enabled: true },
          { name: 'Dip Powder', price: 40, duration: '60 min', enabled: true },
          { name: 'Acrylic Full Set', price: 50, duration: '75 min', enabled: true },
        ],
      },
      {
        id: 'pedicure',
        label: 'Pedicure',
        items: [
          { name: 'Regular Pedicure', price: 28, duration: '35 min', enabled: true },
          { name: 'Gel Pedicure', price: 42, duration: '50 min', enabled: true },
          { name: 'Deluxe Pedicure', price: 55, duration: '60 min', enabled: true },
        ],
      },
    ],
    smsPreview: 'ABC Nails: Thanks! Demo appointment details captured. RingBooker would text the booking summary and next step here.',
    promptRules: [
      'Support English and Vietnamese naturally.',
      'Ask one booking question at a time.',
      'If Sunday hours are asked, answer from the configured hours.',
    ],
  },
  'hair-salon': {
    slug: 'hair-salon',
    businessType: 'hair-salon',
    eyebrow: 'RingBooker demo for hair salons',
    icon: 'H',
    accent: '#B45309',
    title: 'Hear How RingBooker Answers Hair Salon Calls',
    subtitle:
      'Try a live demo call — stylist preference, color consults, and rebooking — with sample salon context.',
    defaultBusinessName: 'Willow Hair Lounge',
    defaultCity: 'Austin, TX',
    hours: { primary: 'Tue-Sat 9am-6pm', secondary: 'Sun-Mon closed' },
    staffLabel: 'Stylists',
    staffPlaceholder: 'Mia, Jordan, Alex',
    serviceLabel: 'Hair services',
    quickScenario: 'Quick stylist-aware demo with booking, duration, and reschedule flow.',
    persona: 'Polished, conversational hair salon coordinator.',
    tone: 'Professional but relaxed; understands stylist preference and consultation needs.',
    safetyNote: 'Demo only. It does not touch your salon booking system or your live phone routing.',
    demoVsReal:
      'This page sends a one-time outbound demo call. The real RingBooker product answers inbound overflow and after-hours calls on your current number.',
    tryAsking: [
      'Can I book a cut with Mia?',
      'What is the price range for balayage?',
      'Can I reschedule my color appointment?',
      'How long does a keratin treatment take?',
      'What is your next available opening?',
    ],
    quickStartPrompts: ['Balayage with stylist', 'Keratin duration', 'Haircut reschedule', 'Color consult'],
    serviceCategories: [
      {
        id: 'cut-style',
        label: 'Cut & style',
        items: [
          { name: 'Women’s Haircut', price: 65, duration: '60 min', enabled: true },
          { name: 'Men’s Haircut', price: 40, duration: '45 min', enabled: true },
          { name: 'Blowout', price: 45, duration: '45 min', enabled: true },
        ],
      },
      {
        id: 'color',
        label: 'Color',
        items: [
          { name: 'Balayage Consultation', price: 0, duration: '20 min', enabled: true },
          { name: 'Partial Highlights', price: 145, duration: '2 hr', enabled: true },
          { name: 'Keratin Treatment', price: 220, duration: '2.5 hr', enabled: true },
        ],
      },
    ],
    smsPreview: 'Willow Hair Lounge: Demo request captured. RingBooker would text the stylist, service, time, and follow-up instructions here.',
    promptRules: [
      'Ask whether the caller has a stylist preference before confirming hair services.',
      'Frame complex color work as consultation-first.',
      'Never guarantee a specific stylist without saying availability must be checked.',
    ],
  },
  'day-spa': {
    slug: 'day-spa',
    businessType: 'day-spa',
    eyebrow: 'RingBooker demo for day spas',
    icon: 'S',
    accent: '#0D9488',
    title: 'Hear How RingBooker Answers Day Spa Calls',
    subtitle:
      'Try a live demo call — massage bookings, packages, and schedule changes — with calm spa pacing.',
    defaultBusinessName: 'Serene Day Spa',
    defaultCity: 'Scottsdale, AZ',
    hours: { primary: 'Mon-Sat 10am-7pm', secondary: 'Sun 10am-4pm' },
    staffLabel: 'Providers',
    staffPlaceholder: 'Avery, Naomi, Sam',
    serviceLabel: 'Spa experiences',
    quickScenario: 'Quick spa demo with package questions, couples massage, and rebooking.',
    persona: 'Calm, sensory, unhurried spa concierge.',
    tone: 'Relaxed, premium, reassuring, never rushed.',
    safetyNote: 'Demo only. It will not change your spa schedule or route real guest calls.',
    demoVsReal:
      'The demo is an outbound web call. Production RingBooker answers inbound missed, overflow, and after-hours calls on your existing number.',
    tryAsking: [
      'Can I book a couples massage?',
      'Do you offer 90-minute massage options?',
      'Can I cancel and rebook my appointment?',
      'What is included in the facial package?',
      'Do you offer gift card options?',
    ],
    quickStartPrompts: ['Couples massage', 'Package question', 'Cancel + rebook', 'After 5pm'],
    serviceCategories: [
      {
        id: 'massage',
        label: 'Massage',
        items: [
          { name: 'Signature Massage', price: 120, duration: '60 min', enabled: true },
          { name: 'Deep Tissue Massage', price: 140, duration: '60 min', enabled: true },
          { name: 'Couples Massage', price: 260, duration: '60 min', enabled: true },
        ],
      },
      {
        id: 'facial',
        label: 'Facials',
        items: [
          { name: 'Hydrating Facial', price: 115, duration: '50 min', enabled: true },
          { name: 'Spa Day Package', price: 220, duration: '2 hr', enabled: true },
        ],
      },
    ],
    smsPreview: 'Serene Day Spa: Demo details captured. RingBooker would text the package, preferred time, and confirmation path here.',
    promptRules: [
      'Use a calm pace and keep answers concise.',
      'For packages, ask occasion and preferred date before suggesting options from the provided list.',
      'Never pressure the caller to book.',
    ],
  },
  'med-spa': {
    slug: 'med-spa',
    businessType: 'med-spa',
    eyebrow: 'RingBooker demo for med spas',
    icon: 'M',
    accent: '#4F46E5',
    title: 'Hear How RingBooker Answers Med Spa Calls',
    subtitle:
      'Try a live demo call — consult requests, pricing boundaries, and provider handoff — with med spa tone.',
    defaultBusinessName: 'Astra Med Spa',
    defaultCity: 'Newport Beach, CA',
    hours: { primary: 'Mon-Fri 9am-6pm', secondary: 'Sat 10am-3pm' },
    staffLabel: 'Providers',
    staffPlaceholder: 'Dr. Lee, Nurse Ava, Morgan',
    serviceLabel: 'Consultation-led services',
    quickScenario: 'Quick med spa demo with consult-first pricing and provider handoff.',
    persona: 'High-trust med spa scheduling coordinator.',
    tone: 'Credible, careful, consultation-first, never pushy.',
    safetyNote: 'Demo only. It does not provide medical advice, alter patient records, or touch your real routing.',
    demoVsReal:
      'This web demo is outbound and isolated. Production RingBooker handles inbound call recovery on your current number with your approved guardrails.',
    tryAsking: [
      'Can you tell me Botox pricing?',
      'What does a consultation involve?',
      'Can I reschedule my appointment?',
      'What is the downtime for this treatment?',
      'Who are the providers?',
    ],
    quickStartPrompts: ['Botox consult', 'Laser pricing boundary', 'Provider request', 'Reschedule consult'],
    serviceCategories: [
      {
        id: 'consults',
        label: 'Consults',
        items: [
          { name: 'Injectables Consultation', price: 0, duration: '20 min', enabled: true },
          { name: 'Laser Consultation', price: 0, duration: '20 min', enabled: true },
          { name: 'Skin Consultation', price: 50, duration: '30 min', enabled: true },
        ],
      },
      {
        id: 'treatments',
        label: 'Treatments',
        items: [
          { name: 'Botox / Dysport', price: 0, duration: 'Consult required', enabled: true },
          { name: 'Laser Hair Removal', price: 0, duration: 'Consult required', enabled: true },
          { name: 'Microneedling', price: 275, duration: '60 min', enabled: true },
        ],
      },
    ],
    smsPreview: 'Astra Med Spa: Demo consultation request captured. RingBooker would text the consult details and approved next steps here.',
    promptRules: [
      'Do not recommend treatments, dosing, candidacy, or medical outcomes.',
      'For pricing questions, explain that exact pricing depends on consultation unless a listed price is provided.',
      'Offer human/provider handoff for clinical questions.',
    ],
  },
  'beauty-clinic': {
    slug: 'beauty-clinic',
    businessType: 'beauty-clinic',
    eyebrow: 'RingBooker demo for beauty clinics',
    icon: 'C',
    accent: '#A21CAF',
    title: 'Hear How RingBooker Answers Beauty Clinic Calls',
    subtitle:
      'Try a live demo call — appointment intent, session follow-ups, and careful handoff — with clinic context.',
    defaultBusinessName: 'Northline Beauty Clinic',
    defaultCity: 'Seattle, WA',
    hours: { primary: 'Mon-Fri 8:30am-5:30pm', secondary: 'Sat by appointment' },
    staffLabel: 'Clinicians',
    staffPlaceholder: 'Dr. Patel, Erin, Sofia',
    serviceLabel: 'Clinic services',
    quickScenario: 'Quick clinic demo with appointment intent, pre-care boundary, and handoff.',
    persona: 'Clinical, privacy-first appointment coordinator.',
    tone: 'Clear, respectful, restrained, patient-oriented.',
    safetyNote: 'Demo only. It does not access patient records, collect sensitive history, or change live clinic routing.',
    demoVsReal:
      'This page runs an isolated outbound demo. Production RingBooker is configured separately to answer inbound calls on your existing clinic number.',
    tryAsking: [
      'What are the options for acne scar treatment?',
      'How many sessions are usually needed?',
      'Can I reschedule my laser session?',
      'What are the pre-treatment instructions?',
      'What is the recovery time?',
    ],
    quickStartPrompts: ['Follow-up session', 'Pre-care question', 'Human handoff', 'Saturday availability'],
    serviceCategories: [
      {
        id: 'appointments',
        label: 'Appointments',
        items: [
          { name: 'New Patient Consultation', price: 75, duration: '30 min', enabled: true },
          { name: 'Follow-up Visit', price: 0, duration: '20 min', enabled: true },
          { name: 'Skin Treatment Session', price: 180, duration: '60 min', enabled: true },
        ],
      },
      {
        id: 'support',
        label: 'Support',
        items: [
          { name: 'Pre-care Guidance Callback', price: 0, duration: 'Human handoff', enabled: true },
          { name: 'Post-visit Question', price: 0, duration: 'Human handoff', enabled: true },
        ],
      },
    ],
    smsPreview:
      'Northline Beauty Clinic: Demo request captured. RingBooker would text appointment details and the clinic-approved follow-up path here.',
    promptRules: [
      'Use patient framing, not casual customer language.',
      'Do not ask for sensitive medical history in the demo.',
      'Route clinical or privacy-sensitive questions to a human callback.',
    ],
  },
};

export const DEMO_VERTICAL_ORDER: DemoVerticalSlug[] = [
  'nail-salon',
  'hair-salon',
  'day-spa',
  'med-spa',
  'beauty-clinic',
];
