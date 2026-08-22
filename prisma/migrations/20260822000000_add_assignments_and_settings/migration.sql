-- Baseline migration documenting the `assignments` and `settings` tables,
-- which were originally created directly via raw SQL (not `prisma db push`)
-- because `db push`/`migrate dev` conflicted with the `search_vector`
-- generated columns on Customer/Item/Supplier/StaffList. This migration
-- brings migration history back in sync with the live schema; it is written
-- to be a no-op if the objects already exist (they do, on every current
-- environment), and creates them from scratch on a fresh database.

CREATE TABLE IF NOT EXISTS "assignments" (
    "assignment_id" TEXT NOT NULL,
    "doctype" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "assigned_to" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "note" TEXT,
    "timestamp" TEXT NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("assignment_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "assignments_doctype_document_assigned_to_key"
    ON "assignments"("doctype", "document_id", "assigned_to");

CREATE INDEX IF NOT EXISTS "assignments_assigned_to_idx" ON "assignments"("assigned_to");

CREATE INDEX IF NOT EXISTS "assignments_doctype_document_id_idx" ON "assignments"("doctype", "document_id");

CREATE TABLE IF NOT EXISTS "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);
