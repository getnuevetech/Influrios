-- Display name used on email template tests. Existing mail keeps the address alone.
ALTER TABLE "MailSettings" ADD COLUMN "fromName" TEXT NOT NULL DEFAULT '';
