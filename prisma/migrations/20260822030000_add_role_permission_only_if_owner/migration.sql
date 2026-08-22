ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "only_if_owner" BOOLEAN NOT NULL DEFAULT false;
