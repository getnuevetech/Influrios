-- SMS is not sent. Twilio is not the provider.
-- Stored credentials stay on the row and the row is turned off.

UPDATE "CommChannelSettings"
SET "smsEnabled" = false
WHERE "smsEnabled" = true;

UPDATE "IntegrationProvider"
SET "enabled" = false
WHERE "kind" = 'sms';

UPDATE "User"
SET "preferredCommChannel" = 'email'
WHERE "preferredCommChannel" = 'sms';
