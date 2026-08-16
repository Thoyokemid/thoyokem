// Manual mock — the real lib/db.ts pulls in the generated Prisma Client,
// which is ESM-only (`import.meta`) and can't be loaded by ts-jest's
// CommonJS transform. Tests that only exercise pure functions (e.g.
// calculateStockBalance) don't need a real client, just something importable.
export const prisma = new Proxy(
  {},
  {
    get() {
      throw new Error('lib/db prisma client is mocked in tests — no real DB access available');
    },
  }
);
