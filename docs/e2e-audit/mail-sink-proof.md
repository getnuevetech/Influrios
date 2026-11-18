# Notification sink proof (revision r2)

## Result: **PROVEN — controlled delivery**

| Field | Value |
|-------|--------|
| When | 2026-11-18T19:16:54.650Z |
| Recipient | `AUDIT_ADMIN_EMAIL` (allowlisted audit admin; domain `influrios.com`) |
| Action | Admin → Email → **Send test** (claim invitation SMTP test) |
| UI | `/admin/mail?sent=started` |
| Job | `cmwmi5v4b08nlpb01rxivghrn` |
| Outcome | **succeeded** |
| SMTP | `250 2.0.0 OK … gsmtp` |
| Media | `/cursor/stores/self/media/e2e-audit/mail-sink/` |
| JSON | [mail-sink-proof.json](./mail-sink-proof.json) |

### Claim boundary

- **Claimed:** SMTP accepted + job succeeded for an allowlisted AUDIT recipient (controlled delivery).
- **Not claimed:** Operator opened a personal webmail UI; real-customer inbox placement; SMS.

### Unblocks (once isolation attested)

J01 verify, J02 reset, J05 invites, J07–J08 notices, J11 signature notices, J16 billing mail, J23 — may target **AUDIT_* emails only**.

### BLK-MAIL-SINK

**Closed** for controlled-delivery proof. Remain cautious: never send to non-AUDIT addresses.
