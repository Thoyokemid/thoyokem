ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "can_submit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "can_cancel" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "can_amend" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "can_approve_doc" BOOLEAN NOT NULL DEFAULT false;
