-- Admin features that used to share another feature's permission now have their own.
-- Every existing role keeps what it could do: a role holding the old permission gets the new ones.
-- Voiding/deleting agreements stays Super Admin only (contracts.void / contracts.delete).
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['homepage.view', 'landing.view', 'faq.view', 'site_stats.view']::text[])) WHERE 'banners.view' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['homepage.edit', 'landing.edit', 'faq.edit', 'site_stats.edit']::text[])) WHERE 'banners.edit' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['search.view']::text[])) WHERE 'gateways.view' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['search.edit', 'billing.edit']::text[])) WHERE 'gateways.edit' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['referrals.view']::text[])) WHERE 'shortlinks.view' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['referrals.edit']::text[])) WHERE 'shortlinks.edit' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['listings.view']::text[])) WHERE 'collaborations.view' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['listings.edit']::text[])) WHERE 'collaborations.edit' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['kyc.view', 'tax.view', 'discounts.view']::text[])) WHERE 'collab_finance.view' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['kyc.review', 'tax.edit', 'discounts.manage']::text[])) WHERE 'collab_finance.manage' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['discounts.view', 'discounts.manage']::text[])) WHERE 'commerce.manage' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['payouts.view']::text[])) WHERE 'marketplace.view' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['payouts.view', 'payouts.release']::text[])) WHERE 'marketplace.manage' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['support.view']::text[])) WHERE 'accounts.view' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['support.view', 'support.reply']::text[])) WHERE 'accounts.edit' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['wallet.view']::text[])) WHERE 'cards.view' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['wallet.view', 'wallet.edit']::text[])) WHERE 'cards.edit' = ANY("permissions");
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['access.security']::text[])) WHERE 'access.manage_users' = ANY("permissions");
