# Full-platform audit — evidence INDEX

Committed evidence for the full-platform audit package. All paths are relative to this directory (`docs/full-platform-audit/media/`).

**Package baseline:** `main` @ `5a5f4c0` (includes #536 + merged #537).
**Audit execution host:** live probes @ `40b6288` (pre–#537 deploy).
**Layout note:** mirrors prior e2e-audit practice of keeping screenshots/logs beside the pack under `docs/…/media*`.

## Totals

## Privacy redaction

Fixture emails matching configured `AUDIT_*_EMAIL` secrets were replaced with `audit-*-@example.invalid` in text/CSV/JSON evidence before commit. Screenshots may still show live UI chrome.


| Slice | Files | Approx size |
|-------|------:|------------:|
| `admin/` | 78 | 8.7 MiB |
| `auth/` | 94 | 38.8 MiB |
| `billing/` | 53 | 9.4 MiB |
| `collab/` | 125 | 16.1 MiB |
| `nt-chase/` | 84 | 14.6 MiB |
| `dashboard-consistency/` | 99 | 16.9 MiB |
| **All** | **533** | **104.6 MiB** |

### By file type

| Ext | Count |
|-----|------:|
| `.png` | 497 |
| `.json` | 25 |
| `.txt` | 5 |
| `.bin` | 2 |
| `.csv` | 2 |
| `.tsv` | 2 |

## Key Fail evidence (quick links)

| Root cause / row | Path |
|-----------------|------|
| RC-SEC INV-R-074 | [admin/01-admin-login-public.png](./admin/01-admin-login-public.png) |
| RC-CATALOG INV-R-006 | [billing/01-pricing-desktop.png](./billing/01-pricing-desktop.png) |
| RC-CATALOG annual | [billing/40-pricing-annual.png](./billing/40-pricing-annual.png) |
| RC-CATALOG annual CTAs | [billing/41d-billing-annual-ctas.png](./billing/41d-billing-annual-ctas.png) |
| RC-CATALOG upgrade | [billing/44c-upgrade-dialog.png](./billing/44c-upgrade-dialog.png) |
| RC-PORTAL admin | [billing/32-admin-billing.png](./billing/32-admin-billing.png) |
| RC-PORTAL / RC-INVOICE member | [billing/12-billing-member.png](./billing/12-billing-member.png) |
| RC-DISCOVERY | [auth/retest-P-07-discover-business.png](./auth/retest-P-07-discover-business.png) |
| RC-MAIL health | [admin/06-admin-mail-health.png](./admin/06-admin-mail-health.png) |
| RC-MAIL detail | [admin/60-mail-health-detail.png](./admin/60-mail-health-detail.png) |
| RC-EXPORT bin | [admin/export-INV-D-003.bin](./admin/export-INV-D-003.bin) |
| RC-EXPORT intel UI | [admin/14-admin-intelligence.png](./admin/14-admin-intelligence.png) |
| RC-JOBS INV-J-020/021 | [nt-chase/inv-j-jobs-page.png](./nt-chase/inv-j-jobs-page.png) |
| RC-DASHBOARD INV-DC-001/002 | [dashboard-consistency/re-inf-home.png](./dashboard-consistency/re-inf-home.png); [re-inf-hub.png](./dashboard-consistency/re-inf-hub.png); [re-inf-earnings.png](./dashboard-consistency/re-inf-earnings.png) |
| RC-DASHBOARD INV-DC-012/015 | [dashboard-consistency/re-inf-invitation-open.png](./dashboard-consistency/re-inf-invitation-open.png); [re-inf-team-invite-detail.png](./dashboard-consistency/re-inf-team-invite-detail.png) |
| ACCEPT-CONDITIONAL INV-C-014 | [nt-chase/inv-c-014-setup-reminders.png](./nt-chase/inv-c-014-setup-reminders.png) |

## Slice directories

| Directory | Contents |
|-----------|----------|
| [admin/](./admin/) | Admin routes, mail health, jobs, messaging round-trip, exports, JSON harness logs |
| [auth/](./auth/) | Signup/login/logout, profiles, discovery/demo directory, retests |
| [billing/](./billing/) | Pricing, member billing, portal, upgrade dialogs, Stripe probes |
| [collab/](./collab/) | Collaboration hubs, deliverables, review (#536 revalidate), desktop/mobile/manual |
| [nt-chase/](./nt-chase/) | IPS-25 Not-tested chase screenshots + JSON (incl. INV-J-020/021 jobs page) |
| [dashboard-consistency/](./dashboard-consistency/) | **IPS-29 / RC-DASHBOARD** contradiction coverage (INV-DC-*); `results.json` / `reverify.json` |

## Text / machine logs (full set committed)

Prefer these over screenshots when asserting API/status outcomes:

| Path | Bytes |
|------|------:|
| [admin/deep-results.json](./admin/deep-results.json) | 12387 |
| [admin/export-INV-D-002-influrios-accounts-influencer.csv](./admin/export-INV-D-002-influrios-accounts-influencer.csv) | 713 |
| [admin/export-INV-D-003.bin](./admin/export-INV-D-003.bin) | 1785 |
| [admin/export-INV-D-004-influrios-legal-acceptances.csv](./admin/export-INV-D-004-influrios-legal-acceptances.csv) | 32320 |
| [admin/followup-results.json](./admin/followup-results.json) | 16431 |
| [admin/harness-results.json](./admin/harness-results.json) | 74493 |
| [admin/messaging-results.json](./admin/messaging-results.json) | 2503 |
| [admin/messaging-roundtrip.json](./admin/messaging-roundtrip.json) | 1589 |
| [admin/messaging-tab-results.json](./admin/messaging-tab-results.json) | 1999 |
| [auth/results.json](./auth/results.json) | 54151 |
| [billing/deepen2.json](./billing/deepen2.json) | 7490 |
| [billing/results.json](./billing/results.json) | 42488 |
| [billing/stripe-api-invoice-in_1UddzZ1geYv2y1v8tm2vcCBe.json](./billing/stripe-api-invoice-in_1UddzZ1geYv2y1v8tm2vcCBe.json) | 6012 |
| [billing/stripe-catalog-probe.json](./billing/stripe-catalog-probe.json) | 812 |
| [collab/desktop-business-download-status.txt](./collab/desktop-business-download-status.txt) | 25 |
| [collab/desktop-influencer-download-status.txt](./collab/desktop-influencer-download-status.txt) | 25 |
| [collab/matrix-update-meta.json](./collab/matrix-update-meta.json) | 293 |
| [collab/mobile-influencer-download-status.txt](./collab/mobile-influencer-download-status.txt) | 25 |
| [collab/results.tsv](./collab/results.tsv) | 37398 |
| [collab/signed-out-deny.txt](./collab/signed-out-deny.txt) | 112 |
| [collab/summary-deep2.json](./collab/summary-deep2.json) | 11466 |
| [collab/summary-deepen-1795214437477.json](./collab/summary-deepen-1795214437477.json) | 3531 |
| [collab/summary-final.json](./collab/summary-final.json) | 45882 |
| [collab/summary-influencer-desktop-1795214397597.json](./collab/summary-influencer-desktop-1795214397597.json) | 10571 |
| [collab/summary-mobile-1795214575951.json](./collab/summary-mobile-1795214575951.json) | 20906 |
| [nt-chase/chase-results.json](./nt-chase/chase-results.json) | 43610 |
| [nt-chase/chase-results.tsv](./nt-chase/chase-results.tsv) | 21849 |
| [nt-chase/inv-i-007-download-meta.json](./nt-chase/inv-i-007-download-meta.json) | 96 |
| [nt-chase/inv-i-009-places.json](./nt-chase/inv-i-009-places.json) | 624 |
| [nt-chase/inv-i-010-qr-ag-olomola-2.bin](./nt-chase/inv-i-010-qr-ag-olomola-2.bin) | 2978 |
| [nt-chase/inv-i-010-qr-ag-olomola-2.json](./nt-chase/inv-i-010-qr-ag-olomola-2.json) | 111 |
| [nt-chase/inv-i-010-qr-meta.json](./nt-chase/inv-i-010-qr-meta.json) | 71 |
| [nt-chase/inv-j-jobs-body.txt](./nt-chase/inv-j-jobs-body.txt) | 6495 |

## Full file listing

<details>
<summary>All 533 evidence paths</summary>

| Path | Bytes |
|------|------:|
| [admin/01-admin-login-public.png](./admin/01-admin-login-public.png) | 44261 |
| [admin/02-admin-home-after-login.png](./admin/02-admin-home-after-login.png) | 173643 |
| [admin/03-admin-accounts.png](./admin/03-admin-accounts.png) | 166070 |
| [admin/04-admin-mail.png](./admin/04-admin-mail.png) | 137598 |
| [admin/05-admin-mail-templates.png](./admin/05-admin-mail-templates.png) | 202676 |
| [admin/06-admin-mail-health.png](./admin/06-admin-mail-health.png) | 123905 |
| [admin/07-admin-jobs.png](./admin/07-admin-jobs.png) | 193839 |
| [admin/08-admin-payment-settings.png](./admin/08-admin-payment-settings.png) | 187284 |
| [admin/09-admin-signing.png](./admin/09-admin-signing.png) | 163807 |
| [admin/10-admin-social.png](./admin/10-admin-social.png) | 230554 |
| [admin/100-biz-messages-tab.png](./admin/100-biz-messages-tab.png) | 113715 |
| [admin/100-inf-messages-tab.png](./admin/100-inf-messages-tab.png) | 54864 |
| [admin/101-biz-sent.png](./admin/101-biz-sent.png) | 117091 |
| [admin/102-inf-sees-biz-message.png](./admin/102-inf-sees-biz-message.png) | 112999 |
| [admin/103-inf-replied.png](./admin/103-inf-replied.png) | 123248 |
| [admin/104-creator-messages-vs-workroom.png](./admin/104-creator-messages-vs-workroom.png) | 66739 |
| [admin/105-biz-sees-reply.png](./admin/105-biz-sees-reply.png) | 126472 |
| [admin/11-admin-search.png](./admin/11-admin-search.png) | 119430 |
| [admin/12-admin-agency-cms.png](./admin/12-admin-agency-cms.png) | 148458 |
| [admin/13-admin-legal.png](./admin/13-admin-legal.png) | 203166 |
| [admin/14-admin-intelligence.png](./admin/14-admin-intelligence.png) | 144363 |
| [admin/15-admin-mail-after-test.png](./admin/15-admin-mail-after-test.png) | 136514 |
| [admin/16-admin-jobs-detail.png](./admin/16-admin-jobs-detail.png) | 192043 |
| [admin/20-influencer-home.png](./admin/20-influencer-home.png) | 220514 |
| [admin/21-influencer-messages.png](./admin/21-influencer-messages.png) | 54864 |
| [admin/22-influencer-thread.png](./admin/22-influencer-thread.png) | 54864 |
| [admin/23-influencer-notifications.png](./admin/23-influencer-notifications.png) | 125759 |
| [admin/24-influencer-bell.png](./admin/24-influencer-bell.png) | 125759 |
| [admin/25-influencer-inbox.png](./admin/25-influencer-inbox.png) | 9309 |
| [admin/30-business-home.png](./admin/30-business-home.png) | 148274 |
| [admin/31-business-messages-or-collab.png](./admin/31-business-messages-or-collab.png) | 9309 |
| [admin/32-business-agency-cta.png](./admin/32-business-agency-cta.png) | 9309 |
| [admin/40-agency-destination.png](./admin/40-agency-destination.png) | 249193 |
| [admin/41-agency-invite-invalid.png](./admin/41-agency-invite-invalid.png) | 21969 |
| [admin/50-admin-login-mobile.png](./admin/50-admin-login-mobile.png) | 39072 |
| [admin/51-admin-home-mobile.png](./admin/51-admin-home-mobile.png) | 72892 |
| [admin/52-admin-accounts-mobile.png](./admin/52-admin-accounts-mobile.png) | 69465 |
| [admin/53-admin-jobs-mobile.png](./admin/53-admin-jobs-mobile.png) | 87478 |
| [admin/54-admin-mail-mobile.png](./admin/54-admin-mail-mobile.png) | 74909 |
| [admin/55-influencer-messages-mobile.png](./admin/55-influencer-messages-mobile.png) | 23620 |
| [admin/56-influencer-notifications-mobile.png](./admin/56-influencer-notifications-mobile.png) | 79960 |
| [admin/60-mail-health-detail.png](./admin/60-mail-health-detail.png) | 123905 |
| [admin/61-jobs-after-mail-test.png](./admin/61-jobs-after-mail-test.png) | 193320 |
| [admin/62-admin-guests.png](./admin/62-admin-guests.png) | 128928 |
| [admin/63-admin-short-links.png](./admin/63-admin-short-links.png) | 161696 |
| [admin/64-admin-faq.png](./admin/64-admin-faq.png) | 114041 |
| [admin/65-admin-access.png](./admin/65-admin-access.png) | 177462 |
| [admin/66-templates-dialog.png](./admin/66-templates-dialog.png) | 202676 |
| [admin/67-admin-stats.png](./admin/67-admin-stats.png) | 128930 |
| [admin/70-influencer-action-inbox.png](./admin/70-influencer-action-inbox.png) | 188372 |
| [admin/71-notif-counts.png](./admin/71-notif-counts.png) | 125759 |
| [admin/72-business-action-inbox.png](./admin/72-business-action-inbox.png) | 161904 |
| [admin/73-business-workroom.png](./admin/73-business-workroom.png) | 139365 |
| [admin/75-business-account-notif.png](./admin/75-business-account-notif.png) | 107250 |
| [admin/76-business-billing.png](./admin/76-business-billing.png) | 148274 |
| [admin/77-agency-invite.png](./admin/77-agency-invite.png) | 21969 |
| [admin/80-taxonomy-dialog.png](./admin/80-taxonomy-dialog.png) | 132819 |
| [admin/81-guests-form.png](./admin/81-guests-form.png) | 129016 |
| [admin/82-plans-dialog.png](./admin/82-plans-dialog.png) | 182937 |
| [admin/83-account-dialog.png](./admin/83-account-dialog.png) | 185646 |
| [admin/84-smtp-test-template.png](./admin/84-smtp-test-template.png) | 202676 |
| [admin/85-payment-fees-switches.png](./admin/85-payment-fees-switches.png) | 172250 |
| [admin/86-admin-legal.png](./admin/86-admin-legal.png) | 203166 |
| [admin/90-biz-collab-list.png](./admin/90-biz-collab-list.png) | 138727 |
| [admin/92-inf-inbox-tasks.png](./admin/92-inf-inbox-tasks.png) | 188372 |
| [admin/94-agency-views.png](./admin/94-agency-views.png) | 239733 |
| [admin/95-biz-inbox.png](./admin/95-biz-inbox.png) | 161904 |
| [admin/97-inf-workroom-messages.png](./admin/97-inf-workroom-messages.png) | 106238 |
| [admin/99-inf-messages-after.png](./admin/99-inf-messages-after.png) | 54864 |
| [admin/deep-results.json](./admin/deep-results.json) | 12387 |
| [admin/export-INV-D-002-influrios-accounts-influencer.csv](./admin/export-INV-D-002-influrios-accounts-influencer.csv) | 713 |
| [admin/export-INV-D-003.bin](./admin/export-INV-D-003.bin) | 1785 |
| [admin/export-INV-D-004-influrios-legal-acceptances.csv](./admin/export-INV-D-004-influrios-legal-acceptances.csv) | 32320 |
| [admin/followup-results.json](./admin/followup-results.json) | 16431 |
| [admin/harness-results.json](./admin/harness-results.json) | 74493 |
| [admin/messaging-results.json](./admin/messaging-results.json) | 2503 |
| [admin/messaging-roundtrip.json](./admin/messaging-roundtrip.json) | 1589 |
| [admin/messaging-tab-results.json](./admin/messaging-tab-results.json) | 1999 |
| [auth/inv-a-001-signup-submit.png](./auth/inv-a-001-signup-submit.png) | 78154 |
| [auth/inv-a-001-validation-desktop.png](./auth/inv-a-001-validation-desktop.png) | 119749 |
| [auth/inv-a-001-validation-mobile.png](./auth/inv-a-001-validation-mobile.png) | 106751 |
| [auth/inv-a-002-bad-password-desktop.png](./auth/inv-a-002-bad-password-desktop.png) | 124454 |
| [auth/inv-a-002-bad-password-mobile.png](./auth/inv-a-002-bad-password-mobile.png) | 39662 |
| [auth/inv-a-002-login-business-desktop.png](./auth/inv-a-002-login-business-desktop.png) | 295687 |
| [auth/inv-a-002-login-business-mobile.png](./auth/inv-a-002-login-business-mobile.png) | 274446 |
| [auth/inv-a-002-login-influencer-desktop.png](./auth/inv-a-002-login-influencer-desktop.png) | 290888 |
| [auth/inv-a-002-login-influencer-mobile.png](./auth/inv-a-002-login-influencer-mobile.png) | 262265 |
| [auth/inv-a-003-logout-desktop.png](./auth/inv-a-003-logout-desktop.png) | 121426 |
| [auth/inv-a-004-verify-page.png](./auth/inv-a-004-verify-page.png) | 78154 |
| [auth/inv-a-005-reset-request-desktop.png](./auth/inv-a-005-reset-request-desktop.png) | 2666168 |
| [auth/inv-a-006-password-form.png](./auth/inv-a-006-password-form.png) | 290888 |
| [auth/inv-a-010-business-signup-form.png](./auth/inv-a-010-business-signup-form.png) | 1394169 |
| [auth/inv-a-010-signup-role-business.png](./auth/inv-a-010-signup-role-business.png) | 116932 |
| [auth/inv-a-012-claim-start.png](./auth/inv-a-012-claim-start.png) | 173004 |
| [auth/inv-a-017-details-after.png](./auth/inv-a-017-details-after.png) | 965051 |
| [auth/inv-a-017-details-before.png](./auth/inv-a-017-details-before.png) | 961496 |
| [auth/inv-a-020-social-panel.png](./auth/inv-a-020-social-panel.png) | 506695 |
| [auth/inv-a-023-publish-controls.png](./auth/inv-a-023-publish-controls.png) | 627807 |
| [auth/inv-a-024-business-profile-desktop.png](./auth/inv-a-024-business-profile-desktop.png) | 140968 |
| [auth/inv-a-024-business-profile-mobile.png](./auth/inv-a-024-business-profile-mobile.png) | 95371 |
| [auth/inv-a-024-business-profile-save.png](./auth/inv-a-024-business-profile-save.png) | 2675570 |
| [auth/inv-m-002-header-desktop.png](./auth/inv-m-002-header-desktop.png) | 2666120 |
| [auth/inv-m-002-header-mobile.png](./auth/inv-m-002-header-mobile.png) | 1087766 |
| [auth/inv-m-018-reminders-desktop.png](./auth/inv-m-018-reminders-desktop.png) | 290888 |
| [auth/inv-m-018-reminders-mobile.png](./auth/inv-m-018-reminders-mobile.png) | 263934 |
| [auth/inv-p-002-card-preview-desktop.png](./auth/inv-p-002-card-preview-desktop.png) | 133980 |
| [auth/inv-p-002-card-preview-mobile.png](./auth/inv-p-002-card-preview-mobile.png) | 99834 |
| [auth/inv-r-002-discover-influencer-desktop.png](./auth/inv-r-002-discover-influencer-desktop.png) | 580621 |
| [auth/inv-r-002-discover-influencer-mobile.png](./auth/inv-r-002-discover-influencer-mobile.png) | 551698 |
| [auth/inv-r-002-route-desktop.png](./auth/inv-r-002-route-desktop.png) | 603298 |
| [auth/inv-r-002-route-mobile.png](./auth/inv-r-002-route-mobile.png) | 625724 |
| [auth/inv-r-003-route-desktop.png](./auth/inv-r-003-route-desktop.png) | 1740077 |
| [auth/inv-r-003-route-mobile.png](./auth/inv-r-003-route-mobile.png) | 1469720 |
| [auth/inv-r-005-route-desktop.png](./auth/inv-r-005-route-desktop.png) | 1394169 |
| [auth/inv-r-005-route-mobile.png](./auth/inv-r-005-route-mobile.png) | 952367 |
| [auth/inv-r-013-route-desktop.png](./auth/inv-r-013-route-desktop.png) | 121426 |
| [auth/inv-r-013-route-mobile.png](./auth/inv-r-013-route-mobile.png) | 36710 |
| [auth/inv-r-014-route-desktop.png](./auth/inv-r-014-route-desktop.png) | 116932 |
| [auth/inv-r-014-route-mobile.png](./auth/inv-r-014-route-mobile.png) | 104939 |
| [auth/inv-r-015-route-desktop.png](./auth/inv-r-015-route-desktop.png) | 116932 |
| [auth/inv-r-015-route-mobile.png](./auth/inv-r-015-route-mobile.png) | 104931 |
| [auth/inv-r-016-route-desktop.png](./auth/inv-r-016-route-desktop.png) | 172572 |
| [auth/inv-r-016-route-mobile.png](./auth/inv-r-016-route-mobile.png) | 157800 |
| [auth/inv-r-028-desktop.png](./auth/inv-r-028-desktop.png) | 506695 |
| [auth/inv-r-028-mobile.png](./auth/inv-r-028-mobile.png) | 205233 |
| [auth/inv-r-031-desktop.png](./auth/inv-r-031-desktop.png) | 72192 |
| [auth/inv-r-031-mobile.png](./auth/inv-r-031-mobile.png) | 38349 |
| [auth/inv-r-033-desktop.png](./auth/inv-r-033-desktop.png) | 290888 |
| [auth/inv-r-033-mobile.png](./auth/inv-r-033-mobile.png) | 263934 |
| [auth/inv-r-034-route-desktop.png](./auth/inv-r-034-route-desktop.png) | 64609 |
| [auth/inv-r-034-route-mobile.png](./auth/inv-r-034-route-mobile.png) | 31656 |
| [auth/inv-r-035-desktop.png](./auth/inv-r-035-desktop.png) | 89489 |
| [auth/inv-r-035-mobile.png](./auth/inv-r-035-mobile.png) | 57539 |
| [auth/inv-r-036-desktop.png](./auth/inv-r-036-desktop.png) | 69844 |
| [auth/inv-r-036-mobile.png](./auth/inv-r-036-mobile.png) | 34780 |
| [auth/inv-r-037-desktop.png](./auth/inv-r-037-desktop.png) | 290888 |
| [auth/inv-r-037-mobile.png](./auth/inv-r-037-mobile.png) | 263934 |
| [auth/inv-r-043-desktop.png](./auth/inv-r-043-desktop.png) | 627807 |
| [auth/inv-r-043-mobile.png](./auth/inv-r-043-mobile.png) | 362757 |
| [auth/inv-r-044-desktop.png](./auth/inv-r-044-desktop.png) | 961496 |
| [auth/inv-r-044-mobile.png](./auth/inv-r-044-mobile.png) | 491465 |
| [auth/inv-r-045-desktop.png](./auth/inv-r-045-desktop.png) | 961496 |
| [auth/inv-r-045-mobile.png](./auth/inv-r-045-mobile.png) | 491465 |
| [auth/inv-r-046-desktop.png](./auth/inv-r-046-desktop.png) | 506695 |
| [auth/inv-r-046-mobile.png](./auth/inv-r-046-mobile.png) | 205233 |
| [auth/inv-r-047-desktop.png](./auth/inv-r-047-desktop.png) | 528642 |
| [auth/inv-r-047-mobile.png](./auth/inv-r-047-mobile.png) | 245094 |
| [auth/inv-t-001-account-tabs-desktop.png](./auth/inv-t-001-account-tabs-desktop.png) | 72192 |
| [auth/inv-t-001-account-tabs-mobile.png](./auth/inv-t-001-account-tabs-mobile.png) | 38349 |
| [auth/inv-t-002-business-account-desktop.png](./auth/inv-t-002-business-account-desktop.png) | 121426 |
| [auth/inv-t-002-business-account-mobile.png](./auth/inv-t-002-business-account-mobile.png) | 24498 |
| [auth/inv-t-003-profile-tabs-desktop.png](./auth/inv-t-003-profile-tabs-desktop.png) | 627807 |
| [auth/inv-t-003-profile-tabs-mobile.png](./auth/inv-t-003-profile-tabs-mobile.png) | 362757 |
| [auth/p-07-discover-business-desktop.png](./auth/p-07-discover-business-desktop.png) | 603298 |
| [auth/p-07-discover-business-mobile.png](./auth/p-07-discover-business-mobile.png) | 552252 |
| [auth/p-28-consistency-relogin-dashboard.png](./auth/p-28-consistency-relogin-dashboard.png) | 627807 |
| [auth/results.json](./auth/results.json) | 54151 |
| [auth/retest-INV-A-005-reset-mobile.png](./auth/retest-INV-A-005-reset-mobile.png) | 42082 |
| [auth/retest-INV-A-024-save.png](./auth/retest-INV-A-024-save.png) | 1102028 |
| [auth/retest-INV-T-002-business-account.png](./auth/retest-INV-T-002-business-account.png) | 63725 |
| [auth/retest-P-07-discover-business.png](./auth/retest-P-07-discover-business.png) | 385144 |
| [auth/retest-logout-mobile-before.png](./auth/retest-logout-mobile-before.png) | 263934 |
| [auth/retest-logout-mobile-menu.png](./auth/retest-logout-mobile-menu.png) | 200140 |
| [auth/retest-logout-mobile-protected.png](./auth/retest-logout-mobile-protected.png) | 36710 |
| [auth/retest-password--account-password.png](./auth/retest-password--account-password.png) | 290888 |
| [auth/retest-password--account-tab-account.png](./auth/retest-password--account-tab-account.png) | 72192 |
| [auth/retest-password--account-tab-security.png](./auth/retest-password--account-tab-security.png) | 69052 |
| [auth/retest3-biz-profile-save.png](./auth/retest3-biz-profile-save.png) | 145309 |
| [auth/retest3-mobile-logout-protected.png](./auth/retest3-mobile-logout-protected.png) | 36710 |
| [auth/retest3-mobile-nav.png](./auth/retest3-mobile-nav.png) | 1089977 |
| [auth/retest4-mobile-logout-icon.png](./auth/retest4-mobile-logout-icon.png) | 255597 |
| [auth/retest4-mobile-logout-protected.png](./auth/retest4-mobile-logout-protected.png) | 36710 |
| [billing/01-pricing-desktop.png](./billing/01-pricing-desktop.png) | 72119 |
| [billing/01m-pricing-mobile.png](./billing/01m-pricing-mobile.png) | 68603 |
| [billing/02-billing-guest.png](./billing/02-billing-guest.png) | 126788 |
| [billing/03-billing-success.png](./billing/03-billing-success.png) | 126788 |
| [billing/04-billing-cancel.png](./billing/04-billing-cancel.png) | 126788 |
| [billing/10-influencer-login.png](./billing/10-influencer-login.png) | 303963 |
| [billing/11-account-billing.png](./billing/11-account-billing.png) | 85505 |
| [billing/12-billing-member.png](./billing/12-billing-member.png) | 150895 |
| [billing/12m-billing-mobile.png](./billing/12m-billing-mobile.png) | 125164 |
| [billing/13-creator-earnings.png](./billing/13-creator-earnings.png) | 284714 |
| [billing/14-creator-payouts.png](./billing/14-creator-payouts.png) | 273691 |
| [billing/14b-payouts-detail.png](./billing/14b-payouts-detail.png) | 273691 |
| [billing/20-business-login.png](./billing/20-business-login.png) | 335965 |
| [billing/21-business-billing.png](./billing/21-business-billing.png) | 160056 |
| [billing/22-business-plans.png](./billing/22-business-plans.png) | 67357 |
| [billing/22b-business-plans-annual.png](./billing/22b-business-plans-annual.png) | 67357 |
| [billing/23-account-billing-business.png](./billing/23-account-billing-business.png) | 87618 |
| [billing/24-agency-upgrade-cta.png](./billing/24-agency-upgrade-cta.png) | 191986 |
| [billing/30-admin-login.png](./billing/30-admin-login.png) | 299142 |
| [billing/31-admin-plans.png](./billing/31-admin-plans.png) | 185070 |
| [billing/31b-admin-plan-edit.png](./billing/31b-admin-plan-edit.png) | 243747 |
| [billing/32-admin-billing.png](./billing/32-admin-billing.png) | 126558 |
| [billing/33-admin-discounts.png](./billing/33-admin-discounts.png) | 124286 |
| [billing/34-admin-payment-settings.png](./billing/34-admin-payment-settings.png) | 873405 |
| [billing/35-admin-finance.png](./billing/35-admin-finance.png) | 93735 |
| [billing/36-admin-marketplace.png](./billing/36-admin-marketplace.png) | 325690 |
| [billing/37-admin-fees-switches.png](./billing/37-admin-fees-switches.png) | 674935 |
| [billing/38-admin-gateways.png](./billing/38-admin-gateways.png) | 399354 |
| [billing/40-pricing-annual.png](./billing/40-pricing-annual.png) | 71158 |
| [billing/40b-choose-plus-annual-guest.png](./billing/40b-choose-plus-annual-guest.png) | 71158 |
| [billing/40c-pricing-annual-cta-state.png](./billing/40c-pricing-annual-cta-state.png) | 71158 |
| [billing/41-billing-annual.png](./billing/41-billing-annual.png) | 157360 |
| [billing/41d-billing-annual-ctas.png](./billing/41d-billing-annual-ctas.png) | 157360 |
| [billing/43-payment-method.png](./billing/43-payment-method.png) | 149921 |
| [billing/44-upgrade-review.png](./billing/44-upgrade-review.png) | 171868 |
| [billing/44b-downgrade-review.png](./billing/44b-downgrade-review.png) | 171736 |
| [billing/44c-upgrade-dialog.png](./billing/44c-upgrade-dialog.png) | 171868 |
| [billing/46-account-billing.png](./billing/46-account-billing.png) | 85505 |
| [billing/46b-account-billing-autorenew.png](./billing/46b-account-billing-autorenew.png) | 85505 |
| [billing/47-business-billing-annual.png](./billing/47-business-billing-annual.png) | 167174 |
| [billing/47b-biz-annual.png](./billing/47b-biz-annual.png) | 167174 |
| [billing/50-discount-create.png](./billing/50-discount-create.png) | 133912 |
| [billing/50b-discount-create-dialog.png](./billing/50b-discount-create-dialog.png) | 133912 |
| [billing/51-plan-edit.png](./billing/51-plan-edit.png) | 243747 |
| [billing/52-plan-pricing.png](./billing/52-plan-pricing.png) | 243677 |
| [billing/53-billing-settings.png](./billing/53-billing-settings.png) | 206480 |
| [billing/54-marketplace.png](./billing/54-marketplace.png) | 325690 |
| [billing/55-payout-processing-detail.png](./billing/55-payout-processing-detail.png) | 284714 |
| [billing/55b-payout-detail.png](./billing/55b-payout-detail.png) | 284714 |
| [billing/deepen2.json](./billing/deepen2.json) | 7490 |
| [billing/results.json](./billing/results.json) | 42488 |
| [billing/stripe-api-invoice-in_1UddzZ1geYv2y1v8tm2vcCBe.json](./billing/stripe-api-invoice-in_1UddzZ1geYv2y1v8tm2vcCBe.json) | 6012 |
| [billing/stripe-catalog-probe.json](./billing/stripe-catalog-probe.json) | 812 |
| [collab/desktop/business-approve-confirm.png](./collab/desktop/business-approve-confirm.png) | 119290 |
| [collab/desktop/business-business-hub.png](./collab/desktop/business-business-hub.png) | 138727 |
| [collab/desktop/business-cancel-surface.png](./collab/desktop/business-cancel-surface.png) | 119290 |
| [collab/desktop/business-checkout-probe.png](./collab/desktop/business-checkout-probe.png) | 9309 |
| [collab/desktop/business-contract-detail.png](./collab/desktop/business-contract-detail.png) | 130960 |
| [collab/desktop/business-contract-wizard.png](./collab/desktop/business-contract-wizard.png) | 388573 |
| [collab/desktop/business-contracts-list.png](./collab/desktop/business-contracts-list.png) | 130960 |
| [collab/desktop/business-contracts.png](./collab/desktop/business-contracts.png) | 130960 |
| [collab/desktop/business-fund-attempt.png](./collab/desktop/business-fund-attempt.png) | 387884 |
| [collab/desktop/business-fund-cta-result.png](./collab/desktop/business-fund-cta-result.png) | 387884 |
| [collab/desktop/business-funding-gate-_collaboration.png](./collab/desktop/business-funding-gate-_collaboration.png) | 138727 |
| [collab/desktop/business-funding-gate-_payments.png](./collab/desktop/business-funding-gate-_payments.png) | 139365 |
| [collab/desktop/business-inbox.png](./collab/desktop/business-inbox.png) | 215157 |
| [collab/desktop/business-landing.png](./collab/desktop/business-landing.png) | 138727 |
| [collab/desktop/business-milestone-open.png](./collab/desktop/business-milestone-open.png) | 119290 |
| [collab/desktop/business-milestones.png](./collab/desktop/business-milestones.png) | 119290 |
| [collab/desktop/business-overview-popup.png](./collab/desktop/business-overview-popup.png) | 140127 |
| [collab/desktop/business-payments.png](./collab/desktop/business-payments.png) | 139365 |
| [collab/desktop/business-propose.png](./collab/desktop/business-propose.png) | 76094 |
| [collab/desktop/business-records.png](./collab/desktop/business-records.png) | 140813 |
| [collab/desktop/business-request-after-save.png](./collab/desktop/business-request-after-save.png) | 138727 |
| [collab/desktop/business-request-composer.png](./collab/desktop/business-request-composer.png) | 138727 |
| [collab/desktop/business-request-detail.png](./collab/desktop/business-request-detail.png) | 80772 |
| [collab/desktop/business-review-hub.png](./collab/desktop/business-review-hub.png) | 119290 |
| [collab/desktop/business-team.png](./collab/desktop/business-team.png) | 401724 |
| [collab/desktop/business-withdraw-close.png](./collab/desktop/business-withdraw-close.png) | 138727 |
| [collab/desktop/business-workroom-files.png](./collab/desktop/business-workroom-files.png) | 90439 |
| [collab/desktop/business-workroom.png](./collab/desktop/business-workroom.png) | 119290 |
| [collab/desktop/influencer-cancel-surface.png](./collab/desktop/influencer-cancel-surface.png) | 105862 |
| [collab/desktop/influencer-contract-detail.png](./collab/desktop/influencer-contract-detail.png) | 125277 |
| [collab/desktop/influencer-contracts-list.png](./collab/desktop/influencer-contracts-list.png) | 125277 |
| [collab/desktop/influencer-contracts.png](./collab/desktop/influencer-contracts.png) | 125277 |
| [collab/desktop/influencer-funding-gate_collaboration.png](./collab/desktop/influencer-funding-gate_collaboration.png) | 140066 |
| [collab/desktop/influencer-funding-gate_payments.png](./collab/desktop/influencer-funding-gate_payments.png) | 132105 |
| [collab/desktop/influencer-hub-collabs.png](./collab/desktop/influencer-hub-collabs.png) | 179039 |
| [collab/desktop/influencer-hub-opps.png](./collab/desktop/influencer-hub-opps.png) | 140066 |
| [collab/desktop/influencer-inbox.png](./collab/desktop/influencer-inbox.png) | 305502 |
| [collab/desktop/influencer-intent-add.png](./collab/desktop/influencer-intent-add.png) | 105862 |
| [collab/desktop/influencer-intent-revise.png](./collab/desktop/influencer-intent-revise.png) | 105862 |
| [collab/desktop/influencer-intent-submit.png](./collab/desktop/influencer-intent-submit.png) | 105862 |
| [collab/desktop/influencer-invitations.png](./collab/desktop/influencer-invitations.png) | 179039 |
| [collab/desktop/influencer-landing.png](./collab/desktop/influencer-landing.png) | 140066 |
| [collab/desktop/influencer-opportunities.png](./collab/desktop/influencer-opportunities.png) | 140066 |
| [collab/desktop/influencer-payments.png](./collab/desktop/influencer-payments.png) | 132105 |
| [collab/desktop/influencer-team.png](./collab/desktop/influencer-team.png) | 295823 |
| [collab/desktop/influencer-workroom-files.png](./collab/desktop/influencer-workroom-files.png) | 83775 |
| [collab/desktop/influencer-workroom.png](./collab/desktop/influencer-workroom.png) | 105862 |
| [collab/desktop/invite-invalid-token.png](./collab/desktop/invite-invalid-token.png) | 72891 |
| [collab/desktop/login-business.png](./collab/desktop/login-business.png) | 335965 |
| [collab/desktop/login-influencer-resume.png](./collab/desktop/login-influencer-resume.png) | 303963 |
| [collab/desktop/login-influencer.png](./collab/desktop/login-influencer.png) | 302154 |
| [collab/desktop/payments-prefund.png](./collab/desktop/payments-prefund.png) | 139365 |
| [collab/desktop-business-download-status.txt](./collab/desktop-business-download-status.txt) | 25 |
| [collab/desktop-influencer-download-status.txt](./collab/desktop-influencer-download-status.txt) | 25 |
| [collab/manual/biz-active-entry.png](./collab/manual/biz-active-entry.png) | 138727 |
| [collab/manual/biz-approve-confirm-focus.png](./collab/manual/biz-approve-confirm-focus.png) | 157164 |
| [collab/manual/biz-contract-open.png](./collab/manual/biz-contract-open.png) | 130960 |
| [collab/manual/biz-funding-gate-copy.png](./collab/manual/biz-funding-gate-copy.png) | 139365 |
| [collab/manual/biz-funding-start-result.png](./collab/manual/biz-funding-start-result.png) | 124069 |
| [collab/manual/biz-payments-detail.png](./collab/manual/biz-payments-detail.png) | 124069 |
| [collab/manual/biz-payments.png](./collab/manual/biz-payments.png) | 139365 |
| [collab/manual/biz-request-changes-focus.png](./collab/manual/biz-request-changes-focus.png) | 157164 |
| [collab/manual/biz-request-new.png](./collab/manual/biz-request-new.png) | 80772 |
| [collab/manual/biz-review-hub-focus.png](./collab/manual/biz-review-hub-focus.png) | 157164 |
| [collab/manual/biz-tab-active.png](./collab/manual/biz-tab-active.png) | 138727 |
| [collab/manual/biz-tab-invitations.png](./collab/manual/biz-tab-invitations.png) | 138727 |
| [collab/manual/biz-tab-opportunities.png](./collab/manual/biz-tab-opportunities.png) | 138727 |
| [collab/manual/biz-tab-requests.png](./collab/manual/biz-tab-requests.png) | 138727 |
| [collab/manual/biz-withdraw-menu.png](./collab/manual/biz-withdraw-menu.png) | 138727 |
| [collab/manual/cor23-approve-after-click.png](./collab/manual/cor23-approve-after-click.png) | 159123 |
| [collab/manual/cor23-approve-step.png](./collab/manual/cor23-approve-step.png) | 157164 |
| [collab/manual/cor23-request-changes-step.png](./collab/manual/cor23-request-changes-step.png) | 152819 |
| [collab/manual/inf-hub-collabs.png](./collab/manual/inf-hub-collabs.png) | 179039 |
| [collab/manual/inf-inbox-task-open.png](./collab/manual/inf-inbox-task-open.png) | 305502 |
| [collab/manual/inf-inbox-tasks.png](./collab/manual/inf-inbox-tasks.png) | 305502 |
| [collab/manual/inf-opportunities-final.png](./collab/manual/inf-opportunities-final.png) | 140066 |
| [collab/manual/inf-review-focus.png](./collab/manual/inf-review-focus.png) | 109832 |
| [collab/manual/reprobe-hub.png](./collab/manual/reprobe-hub.png) | 157164 |
| [collab/manual/reprobe-hub2.png](./collab/manual/reprobe-hub2.png) | 157164 |
| [collab/manual/reprobe-rc2.png](./collab/manual/reprobe-rc2.png) | 156860 |
| [collab/manual/reprobe-rc4.png](./collab/manual/reprobe-rc4.png) | 152819 |
| [collab/matrix-update-meta.json](./collab/matrix-update-meta.json) | 293 |
| [collab/mobile/business-business-hub.png](./collab/mobile/business-business-hub.png) | 69778 |
| [collab/mobile/business-checkout-probe.png](./collab/mobile/business-checkout-probe.png) | 6157 |
| [collab/mobile/business-contract-wizard.png](./collab/mobile/business-contract-wizard.png) | 311484 |
| [collab/mobile/business-contracts.png](./collab/mobile/business-contracts.png) | 57788 |
| [collab/mobile/business-fund-cta-result.png](./collab/mobile/business-fund-cta-result.png) | 311883 |
| [collab/mobile/business-funding-gate_collaboration.png](./collab/mobile/business-funding-gate_collaboration.png) | 69778 |
| [collab/mobile/business-funding-gate_payments.png](./collab/mobile/business-funding-gate_payments.png) | 92277 |
| [collab/mobile/business-inbox.png](./collab/mobile/business-inbox.png) | 171350 |
| [collab/mobile/business-landing.png](./collab/mobile/business-landing.png) | 69778 |
| [collab/mobile/business-milestone-open.png](./collab/mobile/business-milestone-open.png) | 65707 |
| [collab/mobile/business-overview-popup.png](./collab/mobile/business-overview-popup.png) | 71325 |
| [collab/mobile/business-payments.png](./collab/mobile/business-payments.png) | 92277 |
| [collab/mobile/business-propose.png](./collab/mobile/business-propose.png) | 70610 |
| [collab/mobile/business-records.png](./collab/mobile/business-records.png) | 96996 |
| [collab/mobile/business-request-detail.png](./collab/mobile/business-request-detail.png) | 36893 |
| [collab/mobile/business-team.png](./collab/mobile/business-team.png) | 271829 |
| [collab/mobile/business-workroom.png](./collab/mobile/business-workroom.png) | 65707 |
| [collab/mobile/influencer-cancel-surface.png](./collab/mobile/influencer-cancel-surface.png) | 67394 |
| [collab/mobile/influencer-contract-detail.png](./collab/mobile/influencer-contract-detail.png) | 59234 |
| [collab/mobile/influencer-contracts-list.png](./collab/mobile/influencer-contracts-list.png) | 59234 |
| [collab/mobile/influencer-funding-gate_collaboration.png](./collab/mobile/influencer-funding-gate_collaboration.png) | 110597 |
| [collab/mobile/influencer-funding-gate_payments.png](./collab/mobile/influencer-funding-gate_payments.png) | 91688 |
| [collab/mobile/influencer-inbox.png](./collab/mobile/influencer-inbox.png) | 259419 |
| [collab/mobile/influencer-intent-add.png](./collab/mobile/influencer-intent-add.png) | 67394 |
| [collab/mobile/influencer-intent-revise.png](./collab/mobile/influencer-intent-revise.png) | 67394 |
| [collab/mobile/influencer-intent-submit.png](./collab/mobile/influencer-intent-submit.png) | 67394 |
| [collab/mobile/influencer-invitations.png](./collab/mobile/influencer-invitations.png) | 157920 |
| [collab/mobile/influencer-opportunities.png](./collab/mobile/influencer-opportunities.png) | 110597 |
| [collab/mobile/influencer-payments.png](./collab/mobile/influencer-payments.png) | 91688 |
| [collab/mobile/influencer-team.png](./collab/mobile/influencer-team.png) | 183626 |
| [collab/mobile/influencer-workroom-files.png](./collab/mobile/influencer-workroom-files.png) | 55874 |
| [collab/mobile/influencer-workroom.png](./collab/mobile/influencer-workroom.png) | 67394 |
| [collab/mobile/invite-invalid-token.png](./collab/mobile/invite-invalid-token.png) | 68281 |
| [collab/mobile/login-business.png](./collab/mobile/login-business.png) | 308223 |
| [collab/mobile/login-influencer.png](./collab/mobile/login-influencer.png) | 276019 |
| [collab/mobile-influencer-download-status.txt](./collab/mobile-influencer-download-status.txt) | 25 |
| [collab/results.tsv](./collab/results.tsv) | 37398 |
| [collab/signed-out-deny.txt](./collab/signed-out-deny.txt) | 112 |
| [collab/summary-deep2.json](./collab/summary-deep2.json) | 11466 |
| [collab/summary-deepen-1795214437477.json](./collab/summary-deepen-1795214437477.json) | 3531 |
| [collab/summary-final.json](./collab/summary-final.json) | 45882 |
| [collab/summary-influencer-desktop-1795214397597.json](./collab/summary-influencer-desktop-1795214397597.json) | 10571 |
| [collab/summary-mobile-1795214575951.json](./collab/summary-mobile-1795214575951.json) | 20906 |
| [nt-chase/chase-results.json](./nt-chase/chase-results.json) | 43610 |
| [nt-chase/chase-results.tsv](./nt-chase/chase-results.tsv) | 21849 |
| [nt-chase/inv-a-007-account-details.png](./nt-chase/inv-a-007-account-details.png) | 72192 |
| [nt-chase/inv-a-008-notif-prefs.png](./nt-chase/inv-a-008-notif-prefs.png) | 92366 |
| [nt-chase/inv-a-019-managed-intro.png](./nt-chase/inv-a-019-managed-intro.png) | 686260 |
| [nt-chase/inv-a-021-links.png](./nt-chase/inv-a-021-links.png) | 482370 |
| [nt-chase/inv-a-022-kyc.png](./nt-chase/inv-a-022-kyc.png) | 68704 |
| [nt-chase/inv-a-025-workspace.png](./nt-chase/inv-a-025-workspace.png) | 123606 |
| [nt-chase/inv-a-027-saved.png](./nt-chase/inv-a-027-saved.png) | 119987 |
| [nt-chase/inv-a-029-transition.png](./nt-chase/inv-a-029-transition.png) | 151186 |
| [nt-chase/inv-a-034-refresh.png](./nt-chase/inv-a-034-refresh.png) | 106306 |
| [nt-chase/inv-a-036-inquiry.png](./nt-chase/inv-a-036-inquiry.png) | 123606 |
| [nt-chase/inv-a-039-transition.png](./nt-chase/inv-a-039-transition.png) | 118387 |
| [nt-chase/inv-a-042-match.png](./nt-chase/inv-a-042-match.png) | 123606 |
| [nt-chase/inv-a-043-plans.png](./nt-chase/inv-a-043-plans.png) | 57006 |
| [nt-chase/inv-a-051-after-click.png](./nt-chase/inv-a-051-after-click.png) | 129530 |
| [nt-chase/inv-a-051-contract-msg.png](./nt-chase/inv-a-051-contract-msg.png) | 117403 |
| [nt-chase/inv-a-053-discount.png](./nt-chase/inv-a-053-discount.png) | 171440 |
| [nt-chase/inv-a-055-create-deal.png](./nt-chase/inv-a-055-create-deal.png) | 116142 |
| [nt-chase/inv-a-062-change-order.png](./nt-chase/inv-a-062-change-order.png) | 105213 |
| [nt-chase/inv-a-064-dispute.png](./nt-chase/inv-a-064-dispute.png) | 116142 |
| [nt-chase/inv-a-065-series.png](./nt-chase/inv-a-065-series.png) | 116142 |
| [nt-chase/inv-a-069-dashboard.png](./nt-chase/inv-a-069-dashboard.png) | 129530 |
| [nt-chase/inv-a-078-mentorship.png](./nt-chase/inv-a-078-mentorship.png) | 217727 |
| [nt-chase/inv-a-079-trust.png](./nt-chase/inv-a-079-trust.png) | 247686 |
| [nt-chase/inv-c-006-financial-reports.png](./nt-chase/inv-c-006-financial-reports.png) | 137589 |
| [nt-chase/inv-c-007-mentorship-gate.png](./nt-chase/inv-c-007-mentorship-gate.png) | 217727 |
| [nt-chase/inv-c-007-paid-mentoring.png](./nt-chase/inv-c-007-paid-mentoring.png) | 118701 |
| [nt-chase/inv-c-009-ai-tailor.png](./nt-chase/inv-c-009-ai-tailor.png) | 171440 |
| [nt-chase/inv-c-014-setup-reminders.png](./nt-chase/inv-c-014-setup-reminders.png) | 207153 |
| [nt-chase/inv-c-015-delete-protect.png](./nt-chase/inv-c-015-delete-protect.png) | 123606 |
| [nt-chase/inv-c-017-mobile-login.png](./nt-chase/inv-c-017-mobile-login.png) | 255124 |
| [nt-chase/inv-c-018-cms-menu.png](./nt-chase/inv-c-018-cms-menu.png) | 142956 |
| [nt-chase/inv-d-007-media-kit.png](./nt-chase/inv-d-007-media-kit.png) | 128638 |
| [nt-chase/inv-d-008-after.png](./nt-chase/inv-d-008-after.png) | 129530 |
| [nt-chase/inv-d-008-contracts.png](./nt-chase/inv-d-008-contracts.png) | 117403 |
| [nt-chase/inv-i-007-download-meta.json](./nt-chase/inv-i-007-download-meta.json) | 96 |
| [nt-chase/inv-i-007-files-tab.png](./nt-chase/inv-i-007-files-tab.png) | 73785 |
| [nt-chase/inv-i-007-workroom.png](./nt-chase/inv-i-007-workroom.png) | 94831 |
| [nt-chase/inv-i-009-places.json](./nt-chase/inv-i-009-places.json) | 624 |
| [nt-chase/inv-i-010-qr-ag-olomola-2.bin](./nt-chase/inv-i-010-qr-ag-olomola-2.bin) | 2978 |
| [nt-chase/inv-i-010-qr-ag-olomola-2.json](./nt-chase/inv-i-010-qr-ag-olomola-2.json) | 111 |
| [nt-chase/inv-i-010-qr-meta.json](./nt-chase/inv-i-010-qr-meta.json) | 71 |
| [nt-chase/inv-j-001-jobs-detail.png](./nt-chase/inv-j-001-jobs-detail.png) | 162672 |
| [nt-chase/inv-j-001-jobs-search.png](./nt-chase/inv-j-001-jobs-search.png) | 161501 |
| [nt-chase/inv-j-jobs-body.txt](./nt-chase/inv-j-jobs-body.txt) | 6495 |
| [nt-chase/inv-j-jobs-page.png](./nt-chase/inv-j-jobs-page.png) | 162672 |
| [nt-chase/inv-m-001-header.png](./nt-chase/inv-m-001-header.png) | 1096664 |
| [nt-chase/inv-m-007-creator-nav.png](./nt-chase/inv-m-007-creator-nav.png) | 207153 |
| [nt-chase/inv-m-009-business-nav.png](./nt-chase/inv-m-009-business-nav.png) | 129530 |
| [nt-chase/inv-m-footer.png](./nt-chase/inv-m-footer.png) | 408390 |
| [nt-chase/inv-n-inbox-scan.png](./nt-chase/inv-n-inbox-scan.png) | 167084 |
| [nt-chase/inv-n-kinds-centre.png](./nt-chase/inv-n-kinds-centre.png) | 113293 |
| [nt-chase/inv-p-006-record.png](./nt-chase/inv-p-006-record.png) | 116142 |
| [nt-chase/inv-p-023-review-save.png](./nt-chase/inv-p-023-review-save.png) | 144391 |
| [nt-chase/inv-p-024-attempt-0.png](./nt-chase/inv-p-024-attempt-0.png) | 477742 |
| [nt-chase/inv-p-024-qr-after.png](./nt-chase/inv-p-024-qr-after.png) | 482370 |
| [nt-chase/inv-p-024-qr.png](./nt-chase/inv-p-024-qr.png) | 482370 |
| [nt-chase/inv-r-001-desktop.png](./nt-chase/inv-r-001-desktop.png) | 1096674 |
| [nt-chase/inv-r-001-mobile.png](./nt-chase/inv-r-001-mobile.png) | 255124 |
| [nt-chase/inv-r-007-desktop.png](./nt-chase/inv-r-007-desktop.png) | 319138 |
| [nt-chase/inv-r-007-mobile.png](./nt-chase/inv-r-007-mobile.png) | 109311 |
| [nt-chase/inv-r-008-desktop.png](./nt-chase/inv-r-008-desktop.png) | 245904 |
| [nt-chase/inv-r-009-desktop.png](./nt-chase/inv-r-009-desktop.png) | 248869 |
| [nt-chase/inv-r-010-desktop.png](./nt-chase/inv-r-010-desktop.png) | 121426 |
| [nt-chase/inv-r-010-mobile.png](./nt-chase/inv-r-010-mobile.png) | 36710 |
| [nt-chase/inv-r-011-desktop.png](./nt-chase/inv-r-011-desktop.png) | 92206 |
| [nt-chase/inv-r-012-desktop.png](./nt-chase/inv-r-012-desktop.png) | 95283 |
| [nt-chase/inv-r-021-desktop.png](./nt-chase/inv-r-021-desktop.png) | 22345 |
| [nt-chase/inv-r-021-retest.png](./nt-chase/inv-r-021-retest.png) | 479577 |
| [nt-chase/inv-r-022-desktop.png](./nt-chase/inv-r-022-desktop.png) | 22345 |
| [nt-chase/inv-r-022-retest.png](./nt-chase/inv-r-022-retest.png) | 606291 |
| [nt-chase/inv-r-023-desktop.png](./nt-chase/inv-r-023-desktop.png) | 22345 |
| [nt-chase/inv-r-038-mobile.png](./nt-chase/inv-r-038-mobile.png) | 46696 |
| [nt-chase/inv-r-038.png](./nt-chase/inv-r-038.png) | 113712 |
| [nt-chase/inv-r-040.png](./nt-chase/inv-r-040.png) | 128638 |
| [nt-chase/inv-r-048.png](./nt-chase/inv-r-048.png) | 68704 |
| [nt-chase/inv-r-053.png](./nt-chase/inv-r-053.png) | 291194 |
| [nt-chase/inv-r-054.png](./nt-chase/inv-r-054.png) | 123606 |
| [nt-chase/inv-r-055.png](./nt-chase/inv-r-055.png) | 123606 |
| [nt-chase/inv-r-061-062-opps.png](./nt-chase/inv-r-061-062-opps.png) | 106306 |
| [nt-chase/inv-r-065-records-list.png](./nt-chase/inv-r-065-records-list.png) | 111973 |
| [nt-chase/inv-r-071-team-detail.png](./nt-chase/inv-r-071-team-detail.png) | 81981 |
| [nt-chase/inv-r-071-team-list.png](./nt-chase/inv-r-071-team-list.png) | 269264 |

| [dashboard-consistency/admin-expire-sweep-jobs.png](./dashboard-consistency/admin-expire-sweep-jobs.png) | 555975 |
| [dashboard-consistency/after-view-influencer-desktop-collab.png](./dashboard-consistency/after-view-influencer-desktop-collab.png) | 121426 |
| [dashboard-consistency/after-view-influencer-desktop-home.png](./dashboard-consistency/after-view-influencer-desktop-home.png) | 121426 |
| [dashboard-consistency/after-view-influencer-desktop-inbox.png](./dashboard-consistency/after-view-influencer-desktop-inbox.png) | 121426 |
| [dashboard-consistency/after-view-influencer-desktop-money.png](./dashboard-consistency/after-view-influencer-desktop-money.png) | 121426 |
| [dashboard-consistency/after-view-influencer-desktop-notifications.png](./dashboard-consistency/after-view-influencer-desktop-notifications.png) | 121426 |
| [dashboard-consistency/before-business-desktop-collab.png](./dashboard-consistency/before-business-desktop-collab.png) | 123606 |
| [dashboard-consistency/before-business-desktop-home.png](./dashboard-consistency/before-business-desktop-home.png) | 295687 |
| [dashboard-consistency/before-business-desktop-inbox.png](./dashboard-consistency/before-business-desktop-inbox.png) | 190391 |
| [dashboard-consistency/before-business-desktop-money.png](./dashboard-consistency/before-business-desktop-money.png) | 116142 |
| [dashboard-consistency/before-business-desktop-notifications.png](./dashboard-consistency/before-business-desktop-notifications.png) | 42100 |
| [dashboard-consistency/before-business-mobile-collab.png](./dashboard-consistency/before-business-mobile-collab.png) | 61440 |
| [dashboard-consistency/before-business-mobile-home.png](./dashboard-consistency/before-business-mobile-home.png) | 274343 |
| [dashboard-consistency/before-business-mobile-inbox.png](./dashboard-consistency/before-business-mobile-inbox.png) | 152230 |
| [dashboard-consistency/before-business-mobile-money.png](./dashboard-consistency/before-business-mobile-money.png) | 78555 |
| [dashboard-consistency/before-business-mobile-notifications.png](./dashboard-consistency/before-business-mobile-notifications.png) | 40011 |
| [dashboard-consistency/before-influencer-desktop-collab.png](./dashboard-consistency/before-influencer-desktop-collab.png) | 159170 |
| [dashboard-consistency/before-influencer-desktop-home.png](./dashboard-consistency/before-influencer-desktop-home.png) | 290888 |
| [dashboard-consistency/before-influencer-desktop-inbox.png](./dashboard-consistency/before-influencer-desktop-inbox.png) | 267647 |
| [dashboard-consistency/before-influencer-desktop-money.png](./dashboard-consistency/before-influencer-desktop-money.png) | 250536 |
| [dashboard-consistency/before-influencer-desktop-notifications.png](./dashboard-consistency/before-influencer-desktop-notifications.png) | 141783 |
| [dashboard-consistency/before-influencer-mobile-collab.png](./dashboard-consistency/before-influencer-mobile-collab.png) | 137544 |
| [dashboard-consistency/before-influencer-mobile-home.png](./dashboard-consistency/before-influencer-mobile-home.png) | 263934 |
| [dashboard-consistency/before-influencer-mobile-inbox.png](./dashboard-consistency/before-influencer-mobile-inbox.png) | 226712 |
| [dashboard-consistency/before-influencer-mobile-money.png](./dashboard-consistency/before-influencer-mobile-money.png) | 214900 |
| [dashboard-consistency/before-influencer-mobile-notifications.png](./dashboard-consistency/before-influencer-mobile-notifications.png) | 108865 |
| [dashboard-consistency/biz-invite-composer-after.png](./dashboard-consistency/biz-invite-composer-after.png) | 78628 |
| [dashboard-consistency/biz-invite-composer-start.png](./dashboard-consistency/biz-invite-composer-start.png) | 76607 |
| [dashboard-consistency/biz-post-refresh-business-desktop-collab.png](./dashboard-consistency/biz-post-refresh-business-desktop-collab.png) | 123606 |
| [dashboard-consistency/biz-post-refresh-business-desktop-home.png](./dashboard-consistency/biz-post-refresh-business-desktop-home.png) | 295687 |
| [dashboard-consistency/biz-post-refresh-business-desktop-inbox.png](./dashboard-consistency/biz-post-refresh-business-desktop-inbox.png) | 190391 |
| [dashboard-consistency/biz-post-refresh-business-desktop-money.png](./dashboard-consistency/biz-post-refresh-business-desktop-money.png) | 116142 |
| [dashboard-consistency/biz-post-refresh-business-desktop-notifications.png](./dashboard-consistency/biz-post-refresh-business-desktop-notifications.png) | 42100 |
| [dashboard-consistency/biz-post-relogin-business-desktop-collab.png](./dashboard-consistency/biz-post-relogin-business-desktop-collab.png) | 121426 |
| [dashboard-consistency/biz-post-relogin-business-desktop-home.png](./dashboard-consistency/biz-post-relogin-business-desktop-home.png) | 121426 |
| [dashboard-consistency/biz-post-relogin-business-desktop-inbox.png](./dashboard-consistency/biz-post-relogin-business-desktop-inbox.png) | 121426 |
| [dashboard-consistency/biz-post-relogin-business-desktop-money.png](./dashboard-consistency/biz-post-relogin-business-desktop-money.png) | 121426 |
| [dashboard-consistency/biz-post-relogin-business-desktop-notifications.png](./dashboard-consistency/biz-post-relogin-business-desktop-notifications.png) | 121426 |
| [dashboard-consistency/biz-pre-refresh-business-desktop-collab.png](./dashboard-consistency/biz-pre-refresh-business-desktop-collab.png) | 123606 |
| [dashboard-consistency/biz-pre-refresh-business-desktop-home.png](./dashboard-consistency/biz-pre-refresh-business-desktop-home.png) | 295687 |
| [dashboard-consistency/biz-pre-refresh-business-desktop-inbox.png](./dashboard-consistency/biz-pre-refresh-business-desktop-inbox.png) | 190391 |
| [dashboard-consistency/biz-pre-refresh-business-desktop-money.png](./dashboard-consistency/biz-pre-refresh-business-desktop-money.png) | 116142 |
| [dashboard-consistency/biz-pre-refresh-business-desktop-notifications.png](./dashboard-consistency/biz-pre-refresh-business-desktop-notifications.png) | 42100 |
| [dashboard-consistency/biz-withdraw-surface.png](./dashboard-consistency/biz-withdraw-surface.png) | 123606 |
| [dashboard-consistency/inf-invitations-tab.png](./dashboard-consistency/inf-invitations-tab.png) | 121426 |
| [dashboard-consistency/inf-opportunities.png](./dashboard-consistency/inf-opportunities.png) | 121426 |
| [dashboard-consistency/post-refresh-influencer-desktop-collab.png](./dashboard-consistency/post-refresh-influencer-desktop-collab.png) | 159170 |
| [dashboard-consistency/post-refresh-influencer-desktop-home.png](./dashboard-consistency/post-refresh-influencer-desktop-home.png) | 290888 |
| [dashboard-consistency/post-refresh-influencer-desktop-inbox.png](./dashboard-consistency/post-refresh-influencer-desktop-inbox.png) | 267647 |
| [dashboard-consistency/post-refresh-influencer-desktop-money.png](./dashboard-consistency/post-refresh-influencer-desktop-money.png) | 250536 |
| [dashboard-consistency/post-refresh-influencer-desktop-notifications.png](./dashboard-consistency/post-refresh-influencer-desktop-notifications.png) | 141783 |
| [dashboard-consistency/post-relogin-influencer-desktop-collab.png](./dashboard-consistency/post-relogin-influencer-desktop-collab.png) | 159170 |
| [dashboard-consistency/post-relogin-influencer-desktop-home.png](./dashboard-consistency/post-relogin-influencer-desktop-home.png) | 290888 |
| [dashboard-consistency/post-relogin-influencer-desktop-inbox.png](./dashboard-consistency/post-relogin-influencer-desktop-inbox.png) | 267647 |
| [dashboard-consistency/post-relogin-influencer-desktop-money.png](./dashboard-consistency/post-relogin-influencer-desktop-money.png) | 250536 |
| [dashboard-consistency/post-relogin-influencer-desktop-notifications.png](./dashboard-consistency/post-relogin-influencer-desktop-notifications.png) | 141783 |
| [dashboard-consistency/pre-invite-action-influencer-desktop-collab.png](./dashboard-consistency/pre-invite-action-influencer-desktop-collab.png) | 121426 |
| [dashboard-consistency/pre-invite-action-influencer-desktop-home.png](./dashboard-consistency/pre-invite-action-influencer-desktop-home.png) | 121426 |
| [dashboard-consistency/pre-invite-action-influencer-desktop-inbox.png](./dashboard-consistency/pre-invite-action-influencer-desktop-inbox.png) | 121426 |
| [dashboard-consistency/pre-invite-action-influencer-desktop-money.png](./dashboard-consistency/pre-invite-action-influencer-desktop-money.png) | 121426 |
| [dashboard-consistency/pre-invite-action-influencer-desktop-notifications.png](./dashboard-consistency/pre-invite-action-influencer-desktop-notifications.png) | 121426 |
| [dashboard-consistency/pre-refresh-influencer-desktop-collab.png](./dashboard-consistency/pre-refresh-influencer-desktop-collab.png) | 159170 |
| [dashboard-consistency/pre-refresh-influencer-desktop-home.png](./dashboard-consistency/pre-refresh-influencer-desktop-home.png) | 290888 |
| [dashboard-consistency/pre-refresh-influencer-desktop-inbox.png](./dashboard-consistency/pre-refresh-influencer-desktop-inbox.png) | 267647 |
| [dashboard-consistency/pre-refresh-influencer-desktop-money.png](./dashboard-consistency/pre-refresh-influencer-desktop-money.png) | 250536 |
| [dashboard-consistency/pre-refresh-influencer-desktop-notifications.png](./dashboard-consistency/pre-refresh-influencer-desktop-notifications.png) | 141783 |
| [dashboard-consistency/re-admin-jobs-expire.png](./dashboard-consistency/re-admin-jobs-expire.png) | 555975 |
| [dashboard-consistency/re-biz-collab.png](./dashboard-consistency/re-biz-collab.png) | 123606 |
| [dashboard-consistency/re-biz-home.png](./dashboard-consistency/re-biz-home.png) | 295687 |
| [dashboard-consistency/re-biz-notif-before.png](./dashboard-consistency/re-biz-notif-before.png) | 42100 |
| [dashboard-consistency/re-biz-refresh.png](./dashboard-consistency/re-biz-refresh.png) | 123606 |
| [dashboard-consistency/re-biz-relogin.png](./dashboard-consistency/re-biz-relogin.png) | 295687 |
| [dashboard-consistency/re-inf-after-mark-read-home.png](./dashboard-consistency/re-inf-after-mark-read-home.png) | 290888 |
| [dashboard-consistency/re-inf-earnings.png](./dashboard-consistency/re-inf-earnings.png) | 250536 |
| [dashboard-consistency/re-inf-home-after-invite-action.png](./dashboard-consistency/re-inf-home-after-invite-action.png) | 290888 |
| [dashboard-consistency/re-inf-home-bell-after-1.png](./dashboard-consistency/re-inf-home-bell-after-1.png) | 290431 |
| [dashboard-consistency/re-inf-home-bell-after-2.png](./dashboard-consistency/re-inf-home-bell-after-2.png) | 290136 |
| [dashboard-consistency/re-inf-home.png](./dashboard-consistency/re-inf-home.png) | 290888 |
| [dashboard-consistency/re-inf-hub-after-invite-action.png](./dashboard-consistency/re-inf-hub-after-invite-action.png) | 159170 |
| [dashboard-consistency/re-inf-hub.png](./dashboard-consistency/re-inf-hub.png) | 159170 |
| [dashboard-consistency/re-inf-invitation-after-action.png](./dashboard-consistency/re-inf-invitation-after-action.png) | 83358 |
| [dashboard-consistency/re-inf-invitation-open.png](./dashboard-consistency/re-inf-invitation-open.png) | 83358 |
| [dashboard-consistency/re-inf-mobile-earnings.png](./dashboard-consistency/re-inf-mobile-earnings.png) | 214900 |
| [dashboard-consistency/re-inf-mobile-home.png](./dashboard-consistency/re-inf-mobile-home.png) | 263934 |
| [dashboard-consistency/re-inf-mobile-hub.png](./dashboard-consistency/re-inf-mobile-hub.png) | 137544 |
| [dashboard-consistency/re-inf-notif-after-mark.png](./dashboard-consistency/re-inf-notif-after-mark.png) | 141783 |
| [dashboard-consistency/re-inf-notif-after-open.png](./dashboard-consistency/re-inf-notif-after-open.png) | 290888 |
| [dashboard-consistency/re-inf-notif-before.png](./dashboard-consistency/re-inf-notif-before.png) | 141783 |
| [dashboard-consistency/re-inf-notif-fresh.png](./dashboard-consistency/re-inf-notif-fresh.png) | 141783 |
| [dashboard-consistency/re-inf-notif-open-dialog.png](./dashboard-consistency/re-inf-notif-open-dialog.png) | 158169 |
| [dashboard-consistency/re-inf-open-unread-sig.png](./dashboard-consistency/re-inf-open-unread-sig.png) | 160560 |
| [dashboard-consistency/re-inf-refresh.png](./dashboard-consistency/re-inf-refresh.png) | 290888 |
| [dashboard-consistency/re-inf-relogin.png](./dashboard-consistency/re-inf-relogin.png) | 290888 |
| [dashboard-consistency/re-inf-team-invite-detail.png](./dashboard-consistency/re-inf-team-invite-detail.png) | 83358 |
| [dashboard-consistency/results.json](./dashboard-consistency/results.json) | 32874 |
| [dashboard-consistency/reverify.json](./dashboard-consistency/reverify.json) | 8885 |
| [dashboard-consistency/summary.json](./dashboard-consistency/summary.json) | 493 |
| [dashboard-consistency/unread-after-open-business.png](./dashboard-consistency/unread-after-open-business.png) | 295687 |
| [dashboard-consistency/unread-after-open-influencer.png](./dashboard-consistency/unread-after-open-influencer.png) | 290888 |

</details>

## Related docs

- [../README.md](../README.md)
- [../coverage-status.md](../coverage-status.md)
- [../remediation-plan.md](../remediation-plan.md) (**PROVISIONAL**)
- [../coverage-matrix.md](../coverage-matrix.md)
- [../execution/](../execution/)

