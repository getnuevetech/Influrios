-- Drop retired /demo/ art from stored homepage banners, categories, and match cards.
-- An uploaded path stays.

UPDATE "CmsSection"
SET payload = jsonb_set(
  payload,
  '{images}',
  COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(image))
      FROM jsonb_array_elements_text(payload->'images') AS image
      WHERE image NOT LIKE '%/demo/%'
    ),
    '[]'::jsonb
  ),
  false
)
WHERE key IN ('hero', 'sponsored', 'cta', 'card_promo')
  AND jsonb_typeof(payload->'images') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(payload->'images') AS image
    WHERE image LIKE '%/demo/%'
  );

UPDATE "CmsSection"
SET payload = jsonb_set(
  payload,
  '{items}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(item->'image') = 'string' AND (item->>'image') LIKE '%/demo/%'
          THEN jsonb_set(item, '{image}', '""'::jsonb, false)
          ELSE item
        END
      )
      FROM jsonb_array_elements(payload->'items') AS item
    ),
    '[]'::jsonb
  ),
  false
)
WHERE key = 'categories'
  AND jsonb_typeof(payload->'items') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(payload->'items') AS item
    WHERE (item->>'image') LIKE '%/demo/%'
  );

UPDATE "CmsSection"
SET payload = jsonb_set(
  payload,
  '{matches}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(item->'image') = 'string' AND (item->>'image') LIKE '%/demo/%'
          THEN item - 'image'
          ELSE item
        END
      )
      FROM jsonb_array_elements(payload->'matches') AS item
    ),
    '[]'::jsonb
  ),
  false
)
WHERE key = 'collaboration'
  AND jsonb_typeof(payload->'matches') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(payload->'matches') AS item
    WHERE (item->>'image') LIKE '%/demo/%'
  );
