-- Phase E: admin-managed creator invitations. Email delivery stays queued until SMTP exists.

CREATE TABLE "InvitationTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvitationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvitationTemplate_key_key" ON "InvitationTemplate"("key");

CREATE TABLE "InvitationCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvitationCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvitationSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "defaultExpiryDays" INTEGER NOT NULL DEFAULT 14,
    "defaultFollowUpDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvitationSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutreachSuppression" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutreachSuppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutreachSuppression_value_key" ON "OutreachSuppression"("value");

CREATE TABLE "CreatorInvitation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "creatorSlug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "templateId" TEXT NOT NULL,
    "campaignId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "followUpAt" TIMESTAMP(3),
    "draftId" TEXT,
    "openedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreatorInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreatorInvitation_token_key" ON "CreatorInvitation"("token");

CREATE TABLE "InvitationEvent" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvitationEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CreatorInvitation" ADD CONSTRAINT "CreatorInvitation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InvitationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreatorInvitation" ADD CONSTRAINT "CreatorInvitation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "InvitationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvitationEvent" ADD CONSTRAINT "InvitationEvent_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "CreatorInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "InvitationTemplate" ("id", "key", "name", "subject", "body", "active", "sortOrder", "updatedAt")
VALUES (
  'tpl_claim_card',
  'claim_card',
  'Claim your card',
  '{{name}}, your Influrios profile is ready',
  'Hi {{name}}, we prepared your Influrios profile. Open {{link}} before {{expiry}} to claim {{profile}}.',
  true,
  0,
  CURRENT_TIMESTAMP
);

INSERT INTO "InvitationCampaign" ("id", "name", "active", "createdAt", "updatedAt")
VALUES ('camp_creator_outreach', 'Creator outreach', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "InvitationSettings" ("id", "defaultExpiryDays", "defaultFollowUpDays", "updatedAt")
VALUES ('default', 14, 7, CURRENT_TIMESTAMP);
