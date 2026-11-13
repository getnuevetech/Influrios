-- Stored drafts and published versions of the email catalog. A row does not send mail.
CREATE TABLE "EmailTemplateRecord" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "bodyJson" JSONB NOT NULL,
    "cta" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplateRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailTemplateRecord_templateKey_kind_idx" ON "EmailTemplateRecord"("templateKey", "kind");
