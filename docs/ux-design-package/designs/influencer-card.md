# Design — Influencer public profile / card

**Objective:** Present the full original Influencer Card scaled proportionally — no crop, no rebuild.  
**Evidence:** `/cursor/stores/self/media/visual-audit/screenshots/public/desktop/live-card-ag-olomola-2.png`, vanity/shortlink variants  
**Example profile labels from capture:** Ag Olomola · @ag.olomola · Lifestyle · Houston, United States · inflr.me/ag

---

## 1. Live card page (`/c/[slug]`)

```
[Public header]
        ┌──────────────────┐
        │ Full card art     │  ← entire card visible including
        │ photo · socials   │     QR + vanity URL + CTAs
        │ QR · Contact      │
        └──────────────────┘
        [Contact →]
[Footer]
```

- Scale with CSS transform / max-height so **all** card regions remain visible  
- Do not replace with Discover-style horizontal profile chrome  

---

## 2. Discover

- Demo cards: keep Demo labeling  
- When live directory enabled: opening a live influencer should show the **same card component** scaled in overlay or navigate to `/c/[slug]` — prefer navigation to card page if overlay would crop  

---

## 3. Vanity

- Prefer working shortlink; if primary host `/c/{vanity}` supported, redirect to canonical slug (CARD-VANITY-001)
