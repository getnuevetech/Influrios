# Design — Contracts

**Objective:** Professional agreement viewing with integrity; list stays simple.  
**Evidence:** influencer/business `contracts.png`  
**Example:** Campaigns with IDs like IC-9BMTKC2J · Signature status Fully signed (from capture)

---

## 1. Desktop list

Keep Agreements | Templates tabs, search, status filter, **View agreement**.

---

## 2. Agreement viewer (full-screen dialog)

```
╔ Collaboration Agreement · IC-… ══════════ ✕ ╗
║ Header · Parties · Version                   ║
║ Numbered clauses                             ║
║ Tables: deliverables / financial schedule    ║
║ Signature blocks                             ║
║ Page markers                                 ║
║──────────────────────────────────────────────║
║ [Download PDF]  [Sign if pending]  [Close]   ║
╚══════════════════════════════════════════════╝
```

- Not a narrow under-table panel  
- Executed docs read-only; amendments = new version  
- Resolve placeholder / contradictory status before sign CTA enabled  

---

## 3. Mobile

Full-screen viewer; sticky action bar

---

## 4. Empty / error / confirmation

- Empty templates vs empty agreements — distinct copy  
- Sign confirm: “You are signing version N as [Party]”
