# Collaboration & Business Landing — Design QA Checklist

**Designs:** `docs/design-references/collaboration/public-landing-v3.png`, `docs/design-references/business/for-businesses-v2.png`  
**CMS:** `/admin/collaboration-landing`, `/admin/business-landing`, `/admin/homepage` (match cards)  
**Plan:** W2.1

## Desktop (≥1200px)

| Check | Collab `/collaboration` | Business `/business` |
|---|---|---|
| Hero brand + headline + one supporting line + CTA group | ☐ | ☐ |
| No fake scale stats in first viewport | ☐ | ☐ |
| Category / dual-path cards present and labeled Influencer (not Creator-as-role) | ☐ | ☐ |
| Featured matches / suggestions section | ☐ | ☐ |
| Mentorship / business CTAs per design | ☐ | ☐ |
| Nav: Discover Influencers where required | ☐ | ☐ |

## Mobile (<768px)

| Check | Collab | Business |
|---|---|---|
| Stacked hero readable, no horizontal overflow | ☐ | ☐ |
| Cards / carousels usable with touch | ☐ | ☐ |
| CTAs tap targets ≥44px | ☐ | ☐ |

## CMS smoke (operator)

1. ☐ Edit collaboration landing copy in admin → Save → hard-refresh `/collaboration` shows change without deploy.  
2. ☐ Edit business landing copy → `/business` updates.  
3. ☐ Edit homepage match title containing “Beauty Creator” → persists as “Beauty Influencer” (normalize-on-save); “Content Creator” unchanged.  
4. ☐ Disable one CMS section / pillar if applicable → layout remains balanced.

## Sign-off

| Role | Name | Date | Notes |
|---|---|---|---|
| Design / product | | | |
| Engineering | | | |

When all boxes are checked, mark W2.1 Exit complete in `docs/FULL_IMPLEMENTATION_PLAN.md`.
