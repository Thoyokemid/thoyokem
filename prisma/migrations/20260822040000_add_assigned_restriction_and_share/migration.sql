ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "restrict_to_assigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "grants_access" BOOLEAN NOT NULL DEFAULT false;
