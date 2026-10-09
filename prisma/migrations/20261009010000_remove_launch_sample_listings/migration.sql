-- Remove fictional launch-sample marketplace rows. An edited brand or summary is kept.
DELETE FROM "MarketplaceBusinessRequest"
WHERE (
  id = 'br-sephora'
  AND brand = 'Lumina Beauty Co.'
  AND summary = 'Looking for beauty + hair educators for a clean-skincare launch series.'
) OR (
  id = 'br-airbnb'
  AND brand = 'WanderStay'
  AND summary = 'Need travel + local food pairs for destination itinerary content.'
) OR (
  id = 'br-samsung'
  AND brand = 'NexHome Tech'
  AND summary = 'Smart-home recovery setup walkthroughs with fitness creators.'
);

DELETE FROM "MarketplaceCreatorOpportunity"
WHERE (
  id = 'co-daniel'
  AND "creatorSlug" = 'daniel-kim'
  AND summary = 'Open to destination partnerships and co-created food itineraries.'
) OR (
  id = 'co-priya'
  AND "creatorSlug" = 'priya-sharma'
  AND summary = 'Seeking woodwork partners for full-room makeover series.'
) OR (
  id = 'co-marcus'
  AND "creatorSlug" = 'marcus-lee'
  AND summary = 'Wants a nutrition collaborator for a 30-day training + meals series.'
);
