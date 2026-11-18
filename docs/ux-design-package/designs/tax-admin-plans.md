# Design — Tax configuration & admin plan/billing split

**Objective:** Simple Country + Product/charge tax setup; clean plan vs billing IA.  
**Evidence:** `admin-plans.png`, payment-settings captures (`admin-payment-fees.png`, section UIs)  
**Note:** Payment Standard v2 paused — this is UX structure only.

---

## 1. Tax list

```
Payment settings → Tax
[+ Add tax rule]
┌ Country │ Product/charge │ Rate │ Status │ Actions ┐
│ United States │ Influencer Plus subscription │ … │ Active │ View Edit │
```

---

## 2. Edit popup

```
╔ Tax rule ═══════════════════════ ✕ ╗
║ Country *        [United States ▾] ║
║ Product/charge * [Plus monthly ▾]  ║
║ Rate / method    […]               ║
║ Preview                            ║
║   Base …                           ║
║   Tax  …  (or Exempt / 0)          ║
║   Total …                          ║
║────────────────────────────────────║
║ [Cancel]                  [Save]   ║
╚════════════════════════════════════╝
```

- No duplicate “Applied to” if same as Product/charge  
- No filing-owner/status controls here  

---

## 3. Admin plans

Keep Plans & features matrix + Create plan dialog.  
Billing activity separate — customer subscriptions/invoices only.
