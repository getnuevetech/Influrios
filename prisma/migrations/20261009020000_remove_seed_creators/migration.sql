-- Remove unclaimed sample influencers. A claimed profile, or an edited name or bio, stays.
DELETE FROM "Creator"
WHERE claimed = false
  AND "profileState" = 'UNCLAIMED'
  AND "userId" IS NULL
  AND (
    (
      slug = 'sofia-martinez'
      AND "displayName" = 'Sofia Martinez'
      AND bio = $bio$Helping people create brighter, more confident routines through honest beauty content, travel moments, and brand stories that feel real.$bio$
    ) OR (
      slug = 'daniel-kim'
      AND "displayName" = 'Daniel Kim'
      AND bio = $bio$Destination storytelling with a focus on tourism partnerships and multi-city itineraries.$bio$
    ) OR (
      slug = 'priya-sharma'
      AND "displayName" = 'Priya Sharma'
      AND bio = $bio$Room transformations and accessible design for urban apartments.$bio$
    ) OR (
      slug = 'marcus-lee'
      AND "displayName" = 'Marcus Lee'
      AND bio = $bio$Strength training and recovery education for busy professionals.$bio$
    ) OR (
      slug = 'amara-okonkwo'
      AND "displayName" = 'Amara Okonkwo'
      AND bio = $bio$Protective styles and natural-hair education for beauty audiences in Houston and beyond.$bio$
    ) OR (
      slug = 'jordan-blake'
      AND "displayName" = 'Jordan Blake'
      AND bio = $bio$Consumer tech reviews and integrated smart-home walkthroughs.$bio$
    )
  );

-- Clear homepage featured cards only when they are still exactly the six sample slugs.
UPDATE "CmsSection"
SET payload = jsonb_set(payload, '{cards}', '[]'::jsonb, false)
WHERE key = 'featured'
  AND jsonb_typeof(payload->'cards') = 'array'
  AND (
    SELECT coalesce(jsonb_agg(slug ORDER BY slug), '[]'::jsonb)
    FROM (
      SELECT elem->>'slug' AS slug
      FROM jsonb_array_elements(payload->'cards') elem
    ) sample_cards
  ) = '["amara-okonkwo","daniel-kim","jordan-blake","marcus-lee","priya-sharma","sofia-martinez"]'::jsonb;

-- Clear collaboration pairs only when they are still exactly the sample preset list.
UPDATE "CmsSection"
SET payload = jsonb_set(payload, '{matches}', '[]'::jsonb, false)
WHERE key = 'collaboration'
  AND jsonb_typeof(payload->'matches') = 'array'
  AND (
    SELECT coalesce(
      jsonb_agg(pair ORDER BY pair->>'title', pair->>'left', pair->>'right'),
      '[]'::jsonb
    )
    FROM (
      SELECT jsonb_build_object(
        'title', elem->>'title',
        'left', elem->>'leftSlug',
        'right', elem->>'rightSlug'
      ) AS pair
      FROM jsonb_array_elements(payload->'matches') elem
    ) sample_pairs
  ) = '[
    {"left":"sofia-martinez","right":"amara-okonkwo","title":"Beauty Influencer + Skincare Partner"},
    {"left":"amara-okonkwo","right":"jordan-blake","title":"Fashion Influencer + Streetwear Label"},
    {"left":"jordan-blake","right":"marcus-lee","title":"Fitness Influencer + Wellness Brand"},
    {"left":"marcus-lee","right":"jordan-blake","title":"Food Influencer + Kitchen Brand"},
    {"left":"amara-okonkwo","right":"priya-sharma","title":"Hair Stylist + Hair Supplier"},
    {"left":"sofia-martinez","right":"daniel-kim","title":"Interior Designer + Woodwork Influencer"},
    {"left":"marcus-lee","right":"sofia-martinez","title":"Lifestyle Influencer + Home Brand"},
    {"left":"daniel-kim","right":"amara-okonkwo","title":"Supplier + Stylist Restock Drop"},
    {"left":"priya-sharma","right":"daniel-kim","title":"Tech Reviewer + Gadget Launch"},
    {"left":"priya-sharma","right":"sofia-martinez","title":"Travel Influencer + Tourism Brand"}
  ]'::jsonb;
