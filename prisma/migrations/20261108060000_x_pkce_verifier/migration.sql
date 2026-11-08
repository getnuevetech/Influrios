-- X OAuth 2.0 stores the PKCE verifier until the authorization code is exchanged.
ALTER TABLE "SocialConnection" ADD COLUMN "pkceVerifier" TEXT;
