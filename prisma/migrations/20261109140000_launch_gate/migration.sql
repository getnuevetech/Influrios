-- Collaboration funding stays off until Finance records these approvals and a reconciled staging trace.
CREATE TABLE "CollaborationLaunchGate" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "feeSchedulesApproved" BOOLEAN NOT NULL DEFAULT false,
  "taxTreatmentApproved" BOOLEAN NOT NULL DEFAULT false,
  "earningRefundPolicyApproved" BOOLEAN NOT NULL DEFAULT false,
  "providerRouteApproved" BOOLEAN NOT NULL DEFAULT false,
  "providerTraceReady" BOOLEAN NOT NULL DEFAULT false,
  "payoutTraceJson" JSONB,
  "refundTraceJson" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollaborationLaunchGate_pkey" PRIMARY KEY ("id")
);
