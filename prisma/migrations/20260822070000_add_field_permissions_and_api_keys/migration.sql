CREATE TABLE IF NOT EXISTS "field_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "doctype" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "field_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "field_permissions_role_id_doctype_field_key"
    ON "field_permissions"("role_id", "doctype", "field");

ALTER TABLE "field_permissions"
    ADD CONSTRAINT "field_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("role_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "last_used_at" TEXT,
    "revoked_at" TEXT,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
