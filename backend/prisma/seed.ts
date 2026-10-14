import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role } from '../src/generated/prisma/enums.js';
import { BCRYPT_ROUNDS } from '../src/auth/auth.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Unsplash photo ids, cropped to the 4:3 product card size.
const image = (photoId: string) =>
  `https://images.unsplash.com/photo-${photoId}?w=600&h=450&fit=crop&auto=format&q=80`;

const PRODUCTS = [
  {
    name: 'Wireless Headphones',
    category: 'Audio',
    priceCents: 8999,
    stock: 15,
    photo: '1505740420928-5e560c06d30e',
    description:
      'Over-ear Bluetooth headphones with active noise cancelling and 30-hour battery life.',
  },
  {
    name: 'Wireless Earbuds',
    category: 'Audio',
    priceCents: 12999,
    stock: 18,
    photo: '1572569511254-d8f925fe2cbb',
    description:
      'True wireless earbuds with a pocket-sized charging case and transparency mode.',
  },
  {
    name: 'Portable Speaker',
    category: 'Audio',
    priceCents: 4999,
    stock: 20,
    photo: '1608043152269-423dbba4e7e1',
    description:
      'Water-resistant speaker with deep bass, ideal for travel and the outdoors.',
  },
  {
    name: 'Ultrabook Laptop 14"',
    category: 'Computing',
    priceCents: 89999,
    stock: 6,
    photo: '1593642702821-c8da6771f0c6',
    description:
      'Thin and light laptop with a 14" display, 16 GB RAM and all-day battery.',
  },
  {
    name: '27" 4K Monitor',
    category: 'Computing',
    priceCents: 32999,
    stock: 5,
    photo: '1527443224154-c4a3942d3acf',
    description: 'IPS panel with HDR support and USB-C power delivery.',
  },
  {
    name: 'Mechanical Keyboard',
    category: 'Computing',
    priceCents: 7499,
    stock: 10,
    photo: '1625948515291-69613efd103f',
    description:
      'Compact 65% layout with hot-swappable switches and PBT keycaps.',
  },
  {
    name: 'Wireless Mouse',
    category: 'Computing',
    priceCents: 3499,
    stock: 25,
    photo: '1527864550417-7fd91fc51a46',
    description: 'Ergonomic shape with silent clicks and a 12-month battery.',
  },
  {
    name: 'Mirrorless Camera',
    category: 'Photography',
    priceCents: 64999,
    stock: 4,
    photo: '1516035069371-29a1b244cc32',
    description:
      '24 MP mirrorless camera with 4K video and interchangeable lenses.',
  },
  {
    name: 'Smart Watch',
    category: 'Wearables',
    priceCents: 19999,
    stock: 8,
    photo: '1546868871-7041f2a55e12',
    description:
      'Fitness tracking, heart-rate monitor and a week of battery life.',
  },
  {
    name: 'Fitness Band',
    category: 'Wearables',
    priceCents: 5999,
    stock: 30,
    photo: '1575311373937-040b8e1fd5b6',
    description: 'Lightweight band for steps, sleep and workouts.',
  },
  {
    name: 'Desk Lamp',
    category: 'Home Office',
    priceCents: 2499,
    stock: 22,
    photo: '1507473885765-e6ed057f782c',
    description:
      'LED lamp with adjustable colour temperature and a wireless charging base.',
  },
  {
    name: 'Limited Edition Backpack',
    category: 'Accessories',
    priceCents: 6999,
    stock: 1,
    photo: '1553062407-98eeb64c6a62',
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
    data: PRODUCTS.map(({ photo, ...product }) => ({
      ...product,
      imageUrl: image(photo),
    })),
  });
  console.log(`Created ${PRODUCTS.length} products`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
