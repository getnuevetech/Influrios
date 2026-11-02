-- Durable auth attempt lockout across web process restarts / replicas.
CREATE TABLE "AuthLockout" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fails" INTEGER NOT NULL DEFAULT 0,
    "windowStarted" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthLockout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthLockout_scope_ip_subject_key" ON "AuthLockout"("scope", "ip", "subject");
CREATE INDEX "AuthLockout_lockedUntil_idx" ON "AuthLockout"("lockedUntil");
