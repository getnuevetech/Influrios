# Design — Mobile public navigation & login

**Objective:** Restore discoverability of nav + Log in on small screens.  
**Evidence:** `/cursor/stores/self/media/visual-audit/screenshots/public/mobile/home.png`  
**Issues:** MOBILE-NAV-001, MOBILE-LOGIN-001

---

## 1. Header (menu closed)

```
[Logo Influrios]     [🔍] [☰ Menu] [Join Influrios]
```

- Menu button `aria-label="Open menu"`  
- Join remains visible  
- Optional: text “Log in” if space; otherwise inside menu only is OK **if** menu is obvious

---

## 2. Menu open (full-screen or sheet)

```
╔ Menu ══════════════════════ ✕ ╗
║ Home                           ║
║ Discover                       ║
║ Categories                     ║
║ Collaboration                  ║
║ For Businesses                 ║
║ Pricing                        ║
║────────────────────────────────║
║ Log in                         ║
║ [Join Influrios →]             ║
╚════════════════════════════════╝
```

- Focus trap; Esc closes; return focus to ☰  
- Log in → `/login`  
- Join → role-aware entry (claim vs business) per nav map

---

## 3. Login path

From menu Log in → existing `/login` form (already captured desktop/mobile).  
Empty validation already OK.

---

## 4. Empty / error

N/A beyond standard login errors.
