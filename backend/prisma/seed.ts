import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role } from '../src/generated/prisma/enums.js';
import { BCRYPT_ROUNDS } from '../src/auth/auth.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const image = (seed: string) => `https://picsum.photos/seed/${seed}/600/450`;

const PRODUCTS = [
  {
    name: 'Wireless Headphones',
    category: 'Audio',
    priceCents: 8999,
    stock: 15,
    seed: 'headphones',
    description:
      'Over-ear Bluetooth headphones with active noise cancelling and 30-hour battery life.',
  },
  {
    name: 'Portable Speaker',
    category: 'Audio',
    priceCents: 4999,
    stock: 20,
    seed: 'speaker',
    description:
      'Water-resistant speaker with deep bass, ideal for travel and the outdoors.',
  },
  {
    name: 'Mechanical Keyboard',
    category: 'Computing',
    priceCents: 7499,
    stock: 10,
    seed: 'keyboard',
    description:
      'Compact 75% layout with hot-swappable switches and RGB backlight.',
  },
  {
    name: 'Ergonomic Mouse',
    category: 'Computing',
    priceCents: 3499,
    stock: 25,
    seed: 'mouse',
    description:
      'Vertical design that reduces wrist strain, with silent clicks.',
  },
  {
    name: '27" 4K Monitor',
    category: 'Computing',
    priceCents: 32999,
    stock: 5,
    seed: 'monitor',
    description: 'IPS panel with HDR support and USB-C power delivery.',
  },
  {
    name: 'USB-C Hub',
    category: 'Accessories',
    priceCents: 2999,
    stock: 40,
    seed: 'usbhub',
    description:
      '7-in-1 hub with HDMI, SD card reader and 100W pass-through charging.',
  },
  {
    name: 'Laptop Stand',
    category: 'Accessories',
    priceCents: 3999,
    stock: 18,
    seed: 'laptopstand',
    description:
      'Adjustable aluminium stand that raises your screen to eye level.',
  },
  {
    name: 'Smart Watch',
    category: 'Wearables',
    priceCents: 19999,
    stock: 8,
    seed: 'smartwatch',
    description:
      'Fitness tracking, heart-rate monitor and a week of battery life.',
  },
  {
    name: 'Fitness Band',
    category: 'Wearables',
    priceCents: 5999,
    stock: 30,
    seed: 'fitnessband',
    description: 'Lightweight band for steps, sleep and workouts.',
  },
  {
    name: 'Webcam 1080p',
    category: 'Computing',
    priceCents: 5499,
    stock: 12,
    seed: 'webcam',
    description:
      'Full HD webcam with auto light correction and dual microphones.',
  },
  {
    name: 'Desk Lamp',
    category: 'Home Office',
    priceCents: 2499,
    stock: 22,
    seed: 'desklamp',
    description:
      'LED lamp with adjustable colour temperature and a wireless charging base.',
  },
  {
    name: 'Limited Edition Backpack',
    category: 'Accessories',
    priceCents: 6999,
    stock: 1,
    seed: 'backpack',
    description:
      'Only one left: useful for testing what happens when stock runs out.',
  },
];

async function main() {
  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ?? 'admin@shop.test'
  ).toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      name: 'Store Admin',
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, BCRYPT_ROUNDS),
      role: Role.ADMIN,
    },
    update: { role: Role.ADMIN },
  });
  console.log(`Admin account: ${adminEmail}`);

  if ((await prisma.product.count()) > 0) {
    console.log('Products already exist, skipping product seed');
    return;
  }

  await prisma.product.createMany({
    data: PRODUCTS.map(({ seed, ...product }) => ({
      ...product,
      imageUrl: image(seed),
    })),
  });
  console.log(`Created ${PRODUCTS.length} products`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
