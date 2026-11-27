-- Remove the seeded demo agency workspace ("Northstar Influence") from live data.
-- Its roster, campaigns, clients, portfolios and seats cascade from the workspace row.
DELETE FROM "AgencyCampaignLink" WHERE "workspaceId" = 'agency_demo_1';
DELETE FROM "AgencyWorkspace" WHERE "id" = 'agency_demo_1';
