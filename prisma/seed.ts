import { Prisma, PrismaClient, PostStatus } from '@prisma/client';

const prisma = new PrismaClient();

type SeedPost = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverStats?: Array<{ num: string; label: string }>;
  status: PostStatus;
  publishedAt: Date;
  readTimeMin: number;
  views: number;
  featured: boolean;
  authorInitials: string;
  categories: string[];
  tags: string[];
  relatedSlugs: string[];
};

const authors = [
  { name: 'RingBooker Team', role: 'Salon Growth Expert', initials: 'RB' },
  { name: 'Jessica Martinez', role: 'Salon Operator', initials: 'JM' },
  { name: 'Sarah Chen', role: 'Salon Owner', initials: 'SC' },
  { name: 'Mai Nguyen', role: 'Nail Salon Owner', initials: 'MN' },
  { name: 'Vietnamese Success Team', role: 'Vietnamese Market Specialist', initials: 'VN' },
];

const categories = [
  { name: 'AI Receptionists', slug: 'ai-receptionists' },
  { name: 'Missed Calls', slug: 'missed-calls' },
  { name: 'After-Hours Calls', slug: 'after-hours-calls' },
  { name: 'Booking Tips', slug: 'booking-tips' },
  { name: 'Salon Operations', slug: 'salon-operations' },
  { name: 'Revenue Growth', slug: 'revenue-growth' },
  { name: 'Case Studies', slug: 'case-studies' },
];

const tags = [
  { name: 'AI Receptionist', slug: 'ai-receptionist' },
  { name: 'Missed Calls', slug: 'missed-calls' },
  { name: 'Revenue', slug: 'revenue' },
  { name: 'Salon Growth', slug: 'salon-growth' },
  { name: 'Booking', slug: 'booking' },
  { name: 'Hair Salon', slug: 'hair-salon' },
  { name: 'Nail Salon', slug: 'nail-salon' },
  { name: 'Case Study', slug: 'case-study' },
  { name: 'Vietnamese', slug: 'vietnamese' },
  { name: 'Operations', slug: 'operations' },
];

const posts: SeedPost[] = [
  {
    slug: 'why-salon-calls-go-unanswered',
    title: "Why Salon Calls Go Unanswered — And the Booking Intent You're Missing",
    excerpt:
      "Every time your phone rings while you're mid-service, you're facing an impossible choice. Here's why missed calls become lost booking intent and how to estimate the impact.",
    content: `
<h2 id="the-math">The Math Behind Missed Calls</h2>
<p>Most salon owners think of a missed call as one lost appointment. In reality it is often a lost long-term client.</p>
<p>If your shop misses 3 high-intent calls per day, the annual impact can be significant.</p>
<h2 id="what-actually-works">What Actually Works</h2>
<p>The first fix is simple: make sure every call gets answered with business-aware context and booking options.</p>
`,
    coverStats: [
      { num: 'Peak', label: 'Calls missed in service hours' },
      { num: 'Estimate', label: 'Impact depends on ticket size' },
      { num: 'Fast', label: 'First response protects intent' },
    ],
    status: PostStatus.PUBLISHED,
    publishedAt: new Date('2025-06-12T08:00:00.000Z'),
    readTimeMin: 8,
    views: 12400,
    featured: true,
    authorInitials: 'RB',
    categories: ['Missed Calls', 'Revenue Growth'],
    tags: ['Missed Calls', 'Revenue', 'AI Receptionist', 'Salon Growth'],
    relatedSlugs: [
      'how-ai-receptionists-change-the-game-for-busy-hair-stylists',
      'how-sarah-went-from-70-to-95-saturday-occupancy',
      'will-your-clients-know-they-are-talking-to-ai',
    ],
  },
  {
    slug: 'how-ai-receptionists-change-the-game-for-busy-hair-stylists',
    title: 'How AI Receptionists Are Changing the Game for Busy Hair Stylists',
    excerpt:
      'From answering calls mid-cut to booking appointments at 2am, this is how AI is transforming salon front desks.',
    content: `
<h2>Why stylists lose calls</h2>
<p>When stylists are with clients, call handling is naturally delayed. AI voice agents help close that gap.</p>
<h2>What improves after deployment</h2>
<p>Shops typically see improved pickup rate, faster confirmation flows, and better follow-up consistency.</p>
`,
    coverStats: [
      { num: '24/7', label: 'Coverage' },
      { num: '3x', label: 'Faster response' },
      { num: '40%', label: 'More bookings' },
    ],
    status: PostStatus.PUBLISHED,
    publishedAt: new Date('2025-06-08T08:00:00.000Z'),
    readTimeMin: 6,
    views: 8700,
    featured: false,
    authorInitials: 'JM',
    categories: ['AI Receptionists'],
    tags: ['AI Receptionist', 'Booking', 'Hair Salon', 'Operations'],
    relatedSlugs: ['why-62-percent-of-salon-calls-go-unanswered', 'will-your-clients-know-they-are-talking-to-ai'],
  },
  {
    slug: 'how-sarah-went-from-70-to-95-saturday-occupancy',
    title: 'How Sarah Went from 70% to 95% Saturday Occupancy in 30 Days',
    excerpt: 'A real case study from a 3-chair salon and the change that filled weekend slots.',
    content: `
<h2>Before AI call coverage</h2>
<p>Saturday demand existed, but response latency and callback delay reduced conversion.</p>
<h2>After rollout</h2>
<p>Automated answering plus same-call booking improved occupancy and reduced no-shows.</p>
`,
    coverStats: [
      { num: '95%', label: 'Saturday occupancy' },
      { num: '+30%', label: 'Booking growth' },
      { num: '30d', label: 'Time to result' },
    ],
    status: PostStatus.PUBLISHED,
    publishedAt: new Date('2025-06-03T08:00:00.000Z'),
    readTimeMin: 5,
    views: 6200,
    featured: false,
    authorInitials: 'SC',
    categories: ['Revenue Growth', 'Case Studies'],
    tags: ['Revenue', 'Case Study', 'Salon Growth'],
    relatedSlugs: ['why-62-percent-of-salon-calls-go-unanswered', 'from-voicemail-to-fully-booked-dallas-nail-salon'],
  },
  {
    slug: 'five-booking-system-mistakes-costing-salons-thousands',
    title: '5 Booking System Mistakes Costing Your Salon Thousands Every Month',
    excerpt:
      'Most salon owners do not realize their booking setup is leaking revenue. Here are five practical fixes.',
    content: `
<h2>Common booking configuration mistakes</h2>
<p>Long confirmation gaps, unclear service mapping, and missing reminders often reduce conversion.</p>
<h2>Quick fixes</h2>
<p>Standardize service durations, tighten reminder timing, and align call scripts with booking rules.</p>
`,
    coverStats: [
      { num: '5', label: 'Critical mistakes' },
      { num: '+18%', label: 'Recovery potential' },
      { num: '7d', label: 'Fix timeline' },
    ],
    status: PostStatus.PUBLISHED,
    publishedAt: new Date('2025-05-28T08:00:00.000Z'),
    readTimeMin: 7,
    views: 5800,
    featured: false,
    authorInitials: 'RB',
    categories: ['Booking Tips'],
    tags: ['Booking', 'Revenue', 'Salon Growth'],
    relatedSlugs: ['why-62-percent-of-salon-calls-go-unanswered'],
  },
  {
    slug: 'huong-dan-chu-tiem-nail-viet-khong-bo-lo-cuoc-goi-dat-lich',
    title: 'Hướng dẫn cho chủ tiệm nail Việt tại Mỹ: Cách không bỏ lỡ cuộc gọi đặt lịch',
    excerpt:
      'Hơn 80% tiệm nail tại Mỹ do người Việt vận hành. Bài viết này tổng hợp cách tối ưu để không mất khách do cuộc gọi nhỡ.',
    content: `
<h2>Thực trạng cuộc gọi nhỡ</h2>
<p>Trong giờ cao điểm, nhiều tiệm không thể nghe máy kịp thời vì đang phục vụ khách tại ghế.</p>
<h2>Giải pháp vận hành</h2>
<p>Kết hợp AI nhận cuộc gọi và lịch hẹn giúp chủ tiệm giảm thất thoát khách mới.</p>
`,
    coverStats: [
      { num: '80%+', label: 'Vietnamese-owned nail shops' },
      { num: '24/7', label: 'Call capture window' },
      { num: '15m', label: 'Setup target' },
    ],
    status: PostStatus.PUBLISHED,
    publishedAt: new Date('2025-05-20T08:00:00.000Z'),
    readTimeMin: 6,
    views: 4300,
    featured: false,
    authorInitials: 'VN',
    categories: ['Salon Operations'],
    tags: ['Vietnamese', 'Nail Salon', 'AI Receptionist'],
    relatedSlugs: ['from-voicemail-to-fully-booked-dallas-nail-salon'],
  },
  {
    slug: 'from-voicemail-to-fully-booked-dallas-nail-salon',
    title: "From Voicemail to Fully Booked: A Dallas Nail Salon's 3-Month Journey",
    excerpt:
      'Mai\'s Nail Studio was missing 8–10 calls a day. Three months later, weekend slots were booked weeks ahead.',
    content: `
<h2>Initial baseline</h2>
<p>The shop relied heavily on callbacks and manual tracking, causing lead drop-off.</p>
<h2>Three-month outcome</h2>
<p>With AI-assisted call handling, booking consistency and retention improved measurably.</p>
`,
    coverStats: [
      { num: '3m', label: 'Measured period' },
      { num: '10/day', label: 'Missed calls before' },
      { num: '3w', label: 'Saturday waitlist' },
    ],
    status: PostStatus.PUBLISHED,
    publishedAt: new Date('2025-05-14T08:00:00.000Z'),
    readTimeMin: 9,
    views: 5100,
    featured: false,
    authorInitials: 'MN',
    categories: ['Case Studies'],
    tags: ['Case Study', 'Nail Salon', 'Revenue'],
    relatedSlugs: ['how-sarah-went-from-70-to-95-saturday-occupancy'],
  },
  {
    slug: 'will-your-clients-know-they-are-talking-to-ai',
    title: "Will Your Clients Know They're Talking to AI? (Honest Answer)",
    excerpt:
      'We asked salon clients about their call experience with AI receptionists. The results were surprisingly positive.',
    content: `
<h2>Perception findings</h2>
<p>Most callers prioritize fast, accurate answers over whether the voice is human or AI.</p>
<h2>Where trust comes from</h2>
<p>Transparent confirmation, reliable booking, and tone consistency drive user trust.</p>
`,
    coverStats: [
      { num: '500', label: 'Client interviews' },
      { num: '82%', label: 'Positive call experience' },
      { num: '5m', label: 'Average call duration' },
    ],
    status: PostStatus.PUBLISHED,
    publishedAt: new Date('2025-05-07T08:00:00.000Z'),
    readTimeMin: 5,
    views: 4800,
    featured: false,
    authorInitials: 'RB',
    categories: ['AI Receptionists'],
    tags: ['AI Receptionist', 'Operations', 'Booking'],
    relatedSlugs: ['how-ai-receptionists-change-the-game-for-busy-hair-stylists'],
  },
  {
    slug: 'ringbooker-vs-truelark-for-nail-salons-2026',
    title: 'RingBooker vs TrueLark for Nail Salons (2026 Comparison)',
    excerpt:
      'A practical comparison for nail shop operators evaluating AI receptionist platforms by setup speed, call quality, and control.',
    content: `
<h2>Comparison criteria</h2>
<p>Setup effort, live booking capability, and operational transparency are the top decision factors.</p>
<h2>Who should choose what</h2>
<p>Small and mid-size shops often prefer faster rollout and simple controls; larger teams may optimize differently.</p>
`,
    coverStats: [
      { num: '2026', label: 'Updated comparison' },
      { num: '4', label: 'Evaluation dimensions' },
      { num: '1', label: 'Best-fit recommendation' },
    ],
    status: PostStatus.PUBLISHED,
    publishedAt: new Date('2025-06-18T08:00:00.000Z'),
    readTimeMin: 6,
    views: 3500,
    featured: false,
    authorInitials: 'RB',
    categories: ['Case Studies', 'Revenue Growth'],
    tags: ['Case Study', 'Nail Salon', 'AI Receptionist'],
    relatedSlugs: ['why-62-percent-of-salon-calls-go-unanswered'],
  },
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Re-point posts from legacy category slugs to the new set; drops empty legacy categories. */
async function remapCategorySlugsByJoin(map: Record<string, string>) {
  for (const [fromSlug, toSlug] of Object.entries(map)) {
    if (fromSlug === toSlug) continue;
    const from = await prisma.category.findUnique({ where: { slug: fromSlug }, select: { id: true } });
    const to = await prisma.category.findUnique({ where: { slug: toSlug }, select: { id: true } });
    if (!from || !to) continue;

    const links = await prisma.categoryOnPost.findMany({ where: { categoryId: from.id } });
    for (const link of links) {
      const duplicate = await prisma.categoryOnPost.findUnique({
        where: { postId_categoryId: { postId: link.postId, categoryId: to.id } },
      });
      if (duplicate) {
        await prisma.categoryOnPost.delete({
          where: { postId_categoryId: { postId: link.postId, categoryId: from.id } },
        });
      } else {
        await prisma.$transaction([
          prisma.categoryOnPost.delete({
            where: { postId_categoryId: { postId: link.postId, categoryId: from.id } },
          }),
          prisma.categoryOnPost.create({ data: { postId: link.postId, categoryId: to.id } }),
        ]);
      }
    }

    const stillLinked = await prisma.categoryOnPost.count({ where: { categoryId: from.id } });
    if (stillLinked === 0) {
      await prisma.category.delete({ where: { id: from.id } }).catch(() => undefined);
    }
  }
}

async function main() {
  const authorByInitials = new Map<string, { id: string }>();

  for (const author of authors) {
    const row = await prisma.author.upsert({
      where: { initials: author.initials },
      update: { name: author.name, role: author.role },
      create: author,
      select: { id: true },
    });
    authorByInitials.set(author.initials, row);
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }

  await remapCategorySlugsByJoin({
    'ai-for-salons': 'ai-receptionists',
    'vietnamese-owners': 'salon-operations',
  });

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name },
      create: tag,
    });
  }

  const postBySlug = new Map<string, { id: string }>();
  for (const post of posts) {
    const author = authorByInitials.get(post.authorInitials);
    if (!author) throw new Error(`Missing author for initials ${post.authorInitials}`);

    const coverStatsJson = post.coverStats ? (post.coverStats as Prisma.InputJsonValue) : undefined;

    const row = await prisma.post.upsert({
      where: { pathPrefix_slug: { pathPrefix: 'blog', slug: post.slug } },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        coverStats: coverStatsJson,
        status: post.status,
        publishedAt: post.publishedAt,
        readTimeMin: post.readTimeMin,
        views: post.views,
        featured: post.featured,
        authorId: author.id,
        pathPrefix: 'blog',
      },
      create: {
        pathPrefix: 'blog',
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        coverStats: coverStatsJson,
        status: post.status,
        publishedAt: post.publishedAt,
        readTimeMin: post.readTimeMin,
        views: post.views,
        featured: post.featured,
        authorId: author.id,
      },
      select: { id: true },
    });
    postBySlug.set(post.slug, row);
  }

  for (const post of posts) {
    const postRow = postBySlug.get(post.slug);
    if (!postRow) continue;

    await prisma.categoryOnPost.deleteMany({ where: { postId: postRow.id } });
    await prisma.tagOnPost.deleteMany({ where: { postId: postRow.id } });

    for (const categoryName of post.categories) {
      const categorySlug = slugify(categoryName);
      const category = await prisma.category.findUnique({ where: { slug: categorySlug }, select: { id: true } });
      if (!category) continue;
      await prisma.categoryOnPost.create({
        data: { postId: postRow.id, categoryId: category.id },
      });
    }

    for (const tagName of post.tags) {
      const tagSlug = slugify(tagName);
      const tag = await prisma.tag.findUnique({ where: { slug: tagSlug }, select: { id: true } });
      if (!tag) continue;
      await prisma.tagOnPost.create({
        data: { postId: postRow.id, tagId: tag.id },
      });
    }
  }

  for (const post of posts) {
    const postRow = postBySlug.get(post.slug);
    if (!postRow) continue;
    const relatedIds = post.relatedSlugs
      .map((slug) => postBySlug.get(slug)?.id)
      .filter((id): id is string => Boolean(id));

    await prisma.post.update({
      where: { id: postRow.id },
      data: {
        relatedTo: {
          set: relatedIds.map((id) => ({ id })),
        },
      },
    });
  }

  console.log(`Seeded ${posts.length} posts with categories, tags, and related links.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
