-- Remove the retired sample workspace only when it is still unowned and still the sample brief.
DELETE FROM "BusinessWorkspace" AS workspace
WHERE workspace.id = 'demo-business'
  AND workspace.name = 'Luminous Beauty'
  AND workspace.industry = 'Skincare & Wellness'
  AND workspace."ownerUserId" IS NULL
  AND (
    SELECT count(*) FROM "BusinessBrief" AS brief WHERE brief."workspaceId" = workspace.id
  ) = 1
  AND EXISTS (
    SELECT 1 FROM "BusinessBrief" AS brief
    WHERE brief.id = 'brief-clean-launch'
      AND brief."workspaceId" = workspace.id
      AND brief.title = 'Clean Skincare Launch'
      AND brief.summary = 'Seeking beauty educators for a 3-post launch series with honest routine content.'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "BusinessShortlistItem" AS item
    WHERE item."workspaceId" = workspace.id
      AND item."creatorSlug" NOT IN ('sofia-martinez', 'amara-okonkwo')
  )
  AND NOT EXISTS (
    SELECT 1 FROM "BusinessInquiry" AS inquiry WHERE inquiry."workspaceId" = workspace.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ManagedMatchRequest" AS request WHERE request."workspaceId" = workspace.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM "MarketplaceBusinessRequest" AS listing WHERE listing."workspaceId" = workspace.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM "CollaborationFunding" AS funding WHERE funding."workspaceId" = workspace.id
  );
