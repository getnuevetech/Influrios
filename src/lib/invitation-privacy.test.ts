import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { inviteCreatorsIndependently, listMarketplaceApplications, transitionMarketplaceApplication } from "./marketplace-listings";

async function databaseReady() {
  if (!process.env.DATABASE_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("independent campaign invitations", () => {
  it("keeps each invitation private when one influencer accepts", async (t) => {
    if (!(await databaseReady())) {
      t.skip("DATABASE_URL is not available");
      return;
    }
    const stamp = Date.now().toString(36);
    const workspace = await prisma.businessWorkspace.create({
      data: { name: `Privacy ${stamp}`, plan: "BUSINESS_FREE", industry: "Test", updatedAt: new Date() },
    });
    const request = await prisma.marketplaceBusinessRequest.create({
      data: {
        brand: workspace.name,
        category: "Beauty",
        budget: "1000",
        location: "Chicago",
        summary: "One campaign, private invitations",
        lookingFor: "Influencers",
        status: "published",
        workspaceId: workspace.id,
      },
    });
    try {
      const ada = await inviteCreatorsIndependently({
        workspaceId: workspace.id,
        actorUserId: "business",
        creatorSlugs: [`ada-${stamp}`],
        requestId: request.id,
        offerText: `Ada offer ${stamp}`,
      });
      const bea = await inviteCreatorsIndependently({
        workspaceId: workspace.id,
        actorUserId: "business",
        creatorSlugs: [`bea-${stamp}`],
        requestId: request.id,
        offerText: `Bea offer ${stamp}`,
      });
      assert.equal(ada.ok, true);
      assert.equal(bea.ok, true);
      if (!ada.ok || !bea.ok) return;
      assert.notEqual(ada.ids[0], bea.ids[0]);

      await transitionMarketplaceApplication({ id: ada.ids[0]!, toStatus: "VIEWED", actorUserId: "ada" });
      await transitionMarketplaceApplication({ id: ada.ids[0]!, toStatus: "ACCEPTED", actorUserId: "ada" });

      const beaRow = await prisma.marketplaceApplication.findUnique({ where: { id: bea.ids[0] } });
      assert.equal(beaRow?.status, "REQUESTED");
      assert.equal(beaRow?.offerText, `Bea offer ${stamp}`);

      const adaView = await listMarketplaceApplications({ creatorSlug: `ada-${stamp}` });
      assert.equal(adaView.length, 1);
      assert.equal(adaView[0]?.offerText, `Ada offer ${stamp}`);
      assert.equal(adaView.some((row) => row.offerText.includes("Bea")), false);

      const again = await inviteCreatorsIndependently({
        workspaceId: workspace.id,
        actorUserId: "business",
        creatorSlugs: [`ada-${stamp}`],
        requestId: request.id,
        offerText: "replacement",
      });
      assert.equal(again.ok && again.ids[0], ada.ids[0]);
    } finally {
      await prisma.marketplaceApplication.deleteMany({ where: { businessRequestId: request.id } });
      await prisma.marketplaceBusinessRequest.delete({ where: { id: request.id } });
      await prisma.businessWorkspace.delete({ where: { id: workspace.id } });
    }
  });
});
