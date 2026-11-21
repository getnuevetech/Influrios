from chrome import *

INF_BADGES = {"collab": 1}  # payout Ready -> Earnings badge absent


def attention_card(compact=False):
    return f"""<div class="card"><div class="card-head"><h2>Needs your attention</h2><span class="nb" style="margin:0">1</span></div>
<div class="list-row"><span class="mono-ava">N</span><div class="t"><b>Free Tech Support</b><span>Northwind Studio invited you · Reply by 28 Nov</span></div>
<span class="btn pri sm">Review invitation</span></div></div>"""


def active_list():
    return f"""<div class="card"><div class="card-head"><h2>Active collaborations</h2><span class="link">View all</span></div>
<div class="list-row"><div class="t"><b>Spring Launch Reel</b><span>Lumen Skincare</span><div style="margin-top:6px">{pill("green","Funded")}</div></div></div>
<div class="list-row" style="border-top:0;padding-top:0"><span class="btn pri sm" style="width:100%">Submit content</span></div>
<div class="list-row"><div class="t"><b>Holiday Gift Guide</b><span>Northwind Studio</span><div style="margin-top:6px">{pill("gray","Waiting for Northwind Studio to sign")}</div></div></div>
<div class="list-row" style="border-top:0;padding-top:0"><span class="btn sec sm" style="width:100%">View agreement</span></div></div>"""


def active_table():
    return f"""<div class="card"><div class="card-head"><h2>Active collaborations</h2><span class="link">View all</span></div>
<table class="t"><thead><tr><th>Collaboration</th><th>Status</th><th>Next step</th></tr></thead><tbody>
<tr><td><b>Spring Launch Reel</b><small>Lumen Skincare</small></td><td>{pill("green","Funded")}</td><td><span class="btn pri sm">Submit content</span></td></tr>
<tr><td><b>Holiday Gift Guide</b><small>Northwind Studio</small></td><td>{pill("gray","Waiting for Northwind Studio to sign")}</td><td><span class="btn sec sm">View agreement</span></td></tr>
</tbody></table></div>"""


def build_home():
    desk = f"""<div class="ph"><h1>Welcome back, Amara</h1><p>Your work and next steps in one place.</p></div>
<div style="display:grid;grid-template-columns:1fr 330px;gap:20px;margin-top:18px">
 <div class="stack">
  {banner("invite","mail","1 new invitation","Northwind Studio invited you to Free Tech Support.",'<span class="btn white">Review invitation</span>')}
  <div class="stats">
   {stat("mail","Invitations","1","Waiting for your reply")}
   {stat("handshake","Active collaborations","2")}
   {stat("mail","Unread messages","2")}
   {stat("wallet","Released this month","$0")}
  </div>
  {attention_card()}
  {active_table()}
 </div>
 <div class="card" style="padding:18px"><div class="card-head"><h2>Influencer Card</h2></div>
  {card_img(292)}
  <div style="display:flex;gap:8px;margin-top:14px"><span class="btn sec sm">{i("copy","sm")}Copy link</span><span class="btn sec sm">Edit card</span></div>
 </div>
</div>"""
    mob = f"""<div class="ph"><h1>Welcome back, Amara</h1><p>Your work and next steps in one place.</p></div>
{banner("invite","mail","1 new invitation","Northwind Studio invited you to Free Tech Support.",'<span class="btn white">Review invitation</span>')}
<div class="m-stats">{stat("mail","Invitations","1","Waiting for your reply")}{stat("handshake","Active","2")}{stat("mail","Unread messages","2")}{stat("wallet","Released this month","$0")}</div>
{attention_card(True)}
<div class="card"><div class="card-head"><h2>Influencer Card</h2></div><div style="display:flex;justify-content:center">{card_img(300)}</div>
<div style="display:flex;gap:8px;margin-top:14px;justify-content:center"><span class="btn sec sm">{i("copy","sm")}Copy link</span><span class="btn sec sm">Edit card</span></div></div>
{active_list()}"""
    body = f"""<div class="row">
{frame("Desktop · 1280", app("inf","dash",INF_BADGES,3,desk,tall=True))}
{frame("Mobile · 390 (full page)", phone("inf","dash",INF_BADGES,3,mob,tall=True))}
<div>
{notes("Original influencer card (finding 1)",[
 "The card is the <b>live card component</b>, unchanged: avatar ring + verified tick, name, handle, specialty, location, platform tiles with VERIFIED / UNVERIFIED labels, QR with Influrios mark, short link.",
 "Scaled <b>proportionally</b> to the column width (desktop 292 px, mobile 300 px). Never cropped, never re-composed, no content omitted on mobile.",
 "Mobile shows the full card in its own section, before the active collaborations list.",
 "Board image is a capture of the live demo card (Amara Cole). Implementation renders <code>InfluencerCardView</code> itself, not an image.",
])}
{notes("Counts on this screen (finding 4 · DB1/DB3)",[
 "Banner, Invitations stat, and Needs your attention all show invitations <b>waiting for your reply</b> = turn is yours: new invitations and ones where the business answered your question (master-spec §1, §2.2a). Reading doesn't change it.",
 "Invitations where it is the business's turn (you said you're interested, or your question is unanswered) appear in the Collaborations hub, not here.",
 "Active collaborations = the same membership filter as the hub Active tab (2).",
 "Holiday Gift Guide: Amara has signed, so the business acts next. It shows “Waiting for Northwind Studio to sign” with no task (master-spec §2.2c, DB8), matching the business dashboard.",
 "Collaborations sidebar badge 1 = the one invitation waiting for your reply.",
])}
{notes("Payout readiness (finding 3)",[
 "This board is the <b>Ready</b> state, so home shows no payout message and the Earnings badge is absent.",
 "Every other payout state and its home message: <a class='link' href='earnings-payout.html'>earnings-payout.html</a>.",
])}
</div></div>"""
    page("influencer-home.html","Influencer home","Package 1 · Influencer","Influencer home",
         "Original card restored. All annotations moved outside the app. Counts follow the single projection: one invitation waiting for a reply, two active collaborations, payout Ready.",
         ["F1 original card","F2 no internal notes","F3 Ready state","F4 invitation counts","F6 typography","INV-DC-001","INV-DC-006"], body)


def hub_content(mobile=False):
    status = f"""<div class="{'m-stats' if mobile else 'stats'}">
 {stat("mail","Invitations","3","1 waiting for your reply")}
 {stat("handshake","Active","2","1 needs content")}
 {stat("wallet","Payment readiness",pill("green","Ready"),"You can receive payouts")}
 {stat("check","Completed","4")}
</div>"""
    ROWS = [
        ("N", "Free Tech Support", "Northwind Studio · Reply by 28 Nov", ("violet", "Waiting for your reply"), ("pri", "Review")),
        ("L", "Autumn Glow Series", "Lumen Skincare · You asked a question on 19 Nov", ("blue", "Waiting for Lumen Skincare"), ("sec", "Open")),
        ("W", "Winter Unboxing · Team", "Northwind Studio · with 2 influencers · You accepted", ("green", "Waiting for teammates"), ("sec", "Open")),
    ]
    if mobile:
        rows = "".join(f'<div class="list-row" style="align-items:flex-start"><span class="mono-ava">{a}</span><div class="t"><b>{t}</b><span>{sub}</span><div style="margin-top:6px">{pill(*pl)}</div></div></div>' for a, t, sub, pl, bt in ROWS)
    else:
        rows = "".join(f'<div class="list-row"><span class="mono-ava">{a}</span><div class="t"><b>{t}</b><span>{sub}</span></div>{pill(*pl)}<span class="btn {bt[0]} sm">{bt[1]}</span></div>' for a, t, sub, pl, bt in ROWS)
    tabs = '<div class="tabs"><a>Overview</a><a class="on">Invitations <span class="nb">1</span></a><a>Applications</a><a>Active</a><a>Completed</a></div>' if not mobile else '<div class="tabs" style="gap:14px;font-size:13px"><a class="on">Invitations <span class="nb">1</span></a><a>Active</a><a>Applications</a></div>'
    return f"""<div class="ph"><h1>Collaborations</h1><p>Invitations, applications, and active work.</p></div>
{status}
<div class="card">{tabs}<div style="margin-top:6px">{rows}</div></div>"""


def build_hub():
    body = f"""<div class="row">
{frame("Desktop · 1280 · Invitations tab", app("inf","collab",INF_BADGES,3,'<div class="stack">'+hub_content()+'</div>'))}
{frame("Mobile · 390", phone("inf","collab",INF_BADGES,3,hub_content(True)))}
<div>
{notes("Projection (DB1 · finding 4)",[
 "Invitations card shows <b>open</b> invitations (3) with the <b>waiting for your reply</b> subset (1). Home shows only the subset, so the two screens agree.",
 "<b>Team invitations are listed here</b> like marketplace invitations (P1-AUD-04, found in the IPS-44 run): pending ones count as waiting; accepted-awaiting-teammates rows stay listed with “Waiting for teammates”.",
 "The Invitations tab badge and the Collaborations sidebar badge count only invitations waiting for your reply (1).",
 "Question sent and Interested rows stay listed with a status naming who acts next. They drop out of the badge until the business replies.",
 "Empty copy “No invitations are waiting” appears only when open invitations = 0.",
])}
{notes("Payment readiness (finding 3)",[
 "This card uses the same six-state readiness as Earnings. Label + one-line message per state are defined in <a class='link' href='earnings-payout.html'>earnings-payout.html</a>.",
 "No hub-only readiness logic.",
])}
</div></div>"""
    page("collaborations-hub.html","Collaborations hub","Package 1 · Influencer","Collaborations hub",
         "Status cards, tab badges, and list rows read the same invitation, active, and payout projections as home.",
         ["F3 readiness card","F4 invitation states","F6 typography","INV-DC-001","INV-DC-002","INV-DC-006"], body)
