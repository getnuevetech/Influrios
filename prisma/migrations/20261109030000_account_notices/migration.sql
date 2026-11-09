-- Unread account events. Opening one marks it read. It does not accept or expire the invitation.
CREATE TABLE "AccountNotice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountNotice_userId_kind_sourceId_key" ON "AccountNotice"("userId", "kind", "sourceId");
CREATE INDEX "AccountNotice_userId_readAt_idx" ON "AccountNotice"("userId", "readAt");

ALTER TABLE "AccountNotice" ADD CONSTRAINT "AccountNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
