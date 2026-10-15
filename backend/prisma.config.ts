import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read lazily so `npm install` (which runs `prisma generate`) works before
    // .env exists; commands that talk to the database still need it.
    url: process.env.DATABASE_URL ?? '',
  },
});
