-- Phase L.2: store CMS banner / featured / value-prop content on CmsSection.payload.

ALTER TABLE "CmsSection" ADD COLUMN "payload" JSONB;
