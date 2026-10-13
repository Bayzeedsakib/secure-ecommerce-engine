import { execSync } from 'node:child_process';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

// Creates the test database if needed and applies all migrations to it once
// before any suite runs. The development database is never touched.
export default async function setup(project: TestProject) {
  const databaseUrl = project.config.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set in vitest.config.e2e.ts');
  }
  const url = new URL(databaseUrl);
  const databaseName = url.pathname.slice(1);

  if (!/^\w+_test$/.test(databaseName)) {
    throw new Error(
      `Refusing to run tests against "${databaseName}": name must end in _test`,
    );
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
