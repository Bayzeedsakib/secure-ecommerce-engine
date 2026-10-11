import { Prisma } from '../generated/prisma/client.js';

// P2002: unique constraint failed (e.g. an email that is already registered).
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

// P2025: the record to update or delete does not exist.
export function isNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}
