-- Category switches, essential pauses, and member email preferences.
CREATE TABLE "EmailCategorySwitch" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCategorySwitch_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "EmailTemplatePause" (
    "templateKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplatePause_pkey" PRIMARY KEY ("templateKey")
);

CREATE TABLE "EmailPreference" (
    "email" TEXT NOT NULL,
    "collaborations" BOOLEAN NOT NULL DEFAULT true,
    "billing" BOOLEAN NOT NULL DEFAULT true,
    "outreach" BOOLEAN NOT NULL DEFAULT true,
    "productNews" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("email")
);
