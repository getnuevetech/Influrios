-- Optional authenticator-app second step for admin sign-in (off until turned on in Admin users).
ALTER TABLE "AdminUser" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "totpPendingSecret" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN "totpLastStep" INTEGER;
