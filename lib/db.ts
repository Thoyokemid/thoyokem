import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

// Reused across requests on the same warm serverless instance, same reasoning
// as the old getGoogleSheetsClient() singleton in lib/sheets.ts.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
