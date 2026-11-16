-- Last time a member opened a conversation. A newer message from someone else is unread.
CREATE TABLE "MessageThreadRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageThreadRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageThreadRead_userId_threadId_key" ON "MessageThreadRead"("userId", "threadId");
CREATE INDEX "MessageThreadRead_userId_idx" ON "MessageThreadRead"("userId");

ALTER TABLE "MessageThreadRead" ADD CONSTRAINT "MessageThreadRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
