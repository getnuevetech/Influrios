# COR-22 — Deliverable links: accept bare domains; normalize to https://

**Priority:** P1 · **Kind:** product / ux · **Package:** R4 workroom (paused)  
**Evidence class:** **code-observed** (`LINK` regex + unit test); field placeholder **reproduced**; bare-domain submit **not executed** as headed fail capture  
**Atlas / boards:** Board 6 · `design-boards/normalized-links.html`

## Finding (evidenced)

The link field placeholder is `https://`, and the server **requires** a literal `https://` prefix:

```6:6:src/lib/milestone-delivery.ts
const LINK = /^https:\/\/\S+$/i;
```

```62:62:src/lib/milestone-delivery.ts
  if (linkUrl && !LINK.test(linkUrl)) return { ok: false as const, error: "The work link must start with https://." };
```

Unit test explicitly rejects `http://example.com` and only accepts full `https://…` (`payment-route.test.ts`).

**User impact:** Pasting a bare domain (`drive.google.com/file/…`, `www.behance.net/…`) fails. Combined with COR-20, the failure often ejects the user to Collaboration payments and wipes the form.

Screenshot: `j14r35-creator-submit-open.png` shows the field with `https://` placeholder priming the rigid rule.

## Required behavior (design)

| Input | Result |
|-------|--------|
| `https://example.com/path` | Accept as-is |
| `example.com` / `www.example.com/x` | **Normalize** to `https://example.com` / `https://www.example.com/x`, then accept |
| Leading/trailing whitespace | Trim, then normalize |
| `http://example.com` | Reject **or** upgrade to https per product choice — **recommended:** reject with inline “Use a secure https link” (do not silently fetch http) |
| `javascript:…`, `data:…`, `file:…`, `ftp:…` | Reject with inline explanation of unsafe scheme |
| Empty link | Allowed if note or files satisfy completeness |
| After normalize | Persist the **normalized** URL on the submission |

### Inline copy (examples)

- Bare domain accepted quietly after normalize (optional subtle “Saved as https://…”).  
- Unsafe: “That link isn’t allowed. Use a normal https web address.”  
- http: “Only secure https links can be submitted.”

Errors obey COR-20 (stay in popup; preserve note/files; Retry).

### Flow

```
User pastes "drive.google.com/file/d/…"
  → client may show normalized preview
  → server normalizes + validates
      ├─ OK → store https://drive.google.com/file/d/…
      └─ unsafe → inline error; keep raw input for edit
```

## Acceptance tests (future IPS-14)

1. Submit note + `example.com/cut` → stored link `https://example.com/cut`; version created.  
2. Submit `https://example.com/cut` → unchanged.  
3. Submit `http://example.com/cut` → inline reject; popup stays; note preserved.  
4. Submit `javascript:alert(1)` → inline unsafe reject; no navigation to `/payments`.  
5. Whitespace-padded bare domain normalizes correctly.  
6. Business review shows clickable https link.  
7. Unit tests cover normalize helper (replace rigid prefix-only regex).

## Non-goals

- Do not proxy or fetch the remote URL server-side in this remediation.  
- Do not invent allow-lists of commercial domains beyond scheme/safety rules.
