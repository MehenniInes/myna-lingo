import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Languages
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'French' },
    { code: 'ar', name: 'Arabic' },
  ];

  for (const lang of languages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: {},
      create: lang,
    });
  }
  console.log(`✅ Languages seeded`);

  // 2. Packages
  const packages = [
    { id: 'pkg-30', minutes: 30, priceDA: 500, sortOrder: 1 },
    { id: 'pkg-60', minutes: 60, priceDA: 900, sortOrder: 2 },
    { id: 'pkg-120', minutes: 120, priceDA: 1600, sortOrder: 3 },
  ];

  for (const pkg of packages) {
    await prisma.package.upsert({
      where: { id: pkg.id },
      update: { minutes: pkg.minutes, priceDA: pkg.priceDA, sortOrder: pkg.sortOrder },
      create: pkg,
    });
  }
  console.log(`✅ Packages seeded`);

  // 3. Get the English language for demo podcast
  const enLang = await prisma.language.findUnique({ where: { code: 'en' } });

  // 4. Demo Podcast (only if none exist)
  if (enLang) {
    const podcastCount = await prisma.podcast.count();
    if (podcastCount === 0) {
      await prisma.podcast.create({
        data: {
          title: 'Exploring Algiers',
          description: 'A beginner-friendly podcast about daily life in Algiers.',
          coverUrl: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?auto=format&fit=crop&q=80&w=300',
          audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          languageId: enLang.id,
          level: 'A1',
          category: 'Culture',
          durationSec: 180,
          priceDA: 200,
          xpReward: 50,
          isActive: true,
        },
      });
      console.log(`✅ Demo podcast seeded`);
    }
  }

  // 5. Demo Activity (only if none exist)
  const activityCount = await prisma.learningActivity.count();
  if (activityCount === 0) {
    await prisma.learningActivity.create({
      data: {
        type: 'ICEBREAKER',
        title: 'Introduce Yourself',
        description: 'Practice your first conversation',
        content: { prompt: 'Say hello and tell me your name.' },
        xpReward: 20,
        isActive: true,
      },
    });
    console.log(`✅ Demo activity seeded`);
  }

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });