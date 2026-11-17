# Contracts redesign — approved designs

Source boards used for the Contracts Agreements / Templates redesign:

| File | Board |
|------|--------|
| `246e8ac6-6529-46aa-af21-8f74b5aafae7.png` | Formal Collaboration Agreement specimen + Schedule A milestones + execution blocks |
| `162b84b2-0869-4bfe-b908-4c2285e5331a.png` | Traditional two-page Influencer Collaboration Agreement specimen |
| `195cf530-ecfa-46ab-8d50-c39dffdc1ed3.png` | Earlier list + popup mock (party names corrected in production: business × influencer, not Influrios) |
| `94587037-ab81-4872-ad0a-3a9a9f061dd4.png` | Contracts list + centered agreement popup (Overview / Document / Signers / Activity) |
| `b5eb928b-33e3-4861-a2e0-ae96e59b36a8.png` | Templates catalog + Review AI changes modal |

Implementation notes:

- Signature status and funding status stay separate badges.
- Shared agreement financial schedule uses Gross / Influencer fee / Net (never gross under “Influencer Amount”).
- Influrios is the platform recorder, not a contracting party on ordinary business–influencer agreements.
- Executed PDF bytes stay immutable; corrections that change signed terms require a versioned amendment.
