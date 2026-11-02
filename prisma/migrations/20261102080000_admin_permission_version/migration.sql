-- Admin cookie sessions stamp permissionVersion; demote/deactivate bumps it so
-- getAdminSession rejects stale cookies instead of waiting for exp.
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "permissionVersion" INTEGER NOT NULL DEFAULT 1;
