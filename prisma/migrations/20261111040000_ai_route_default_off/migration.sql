-- New function routes stay off. Existing rows keep the flag they already have.
ALTER TABLE "AiFunctionRoute" ALTER COLUMN "enabled" SET DEFAULT false;
