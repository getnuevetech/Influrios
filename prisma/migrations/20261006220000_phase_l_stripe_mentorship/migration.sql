-- Stored Stripe customer and Connect ids, and paid mentorship checkout state.

ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "InfluencerPayoutProfile" ADD COLUMN "stripeConnectAccountId" TEXT;
ALTER TABLE "MentorshipRequest" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE "MentorshipRequest" ADD COLUMN "paymentProvider" TEXT;
ALTER TABLE "MentorshipRequest" ADD COLUMN "checkoutRef" TEXT;
ALTER TABLE "MentorshipRequest" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CommChannelSettings" DROP COLUMN "smsProviderNote";
