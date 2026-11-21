from chrome import *

# INF_BADGES / INF_BELL come from chrome.py (shared example records).

ATTN = [
    ("N", "Free Tech Support", "Northwind Studio invited you · Reply by 28 Nov", "pri", "Review invitation"),
    ("L", "Spring Launch Reel · Milestone 1", "Lumen Skincare · Submit content by 25 Nov", "pri", "Submit content"),
    ("L", "Spring Launch Reel · Milestone 2", "Lumen Skincare · Submit content by 9 Dec", "sec", "Open"),
    ("N", "Studio Tour Shorts", "Northwind Studio signed · Your signature is needed", "pri", "Review and sign"),
]


def attention_card(compact=False):
    if compact:
        rows = "".join(f'<div class="list-row"><span class="mono-ava">{a}</span><div class="t"><b>{t}</b><span>{s}</span></div>{m_btn(k, "Open" if k=="sec" else "Review")}</div>' for a, t, s, k, c in ATTN)
    else:
        rows = "".join(f'<div class="list-row"><span class="mono-ava">{a}</span><div class="t"><b>{t}</b><span>{s}</span></div><span class="btn {k} sm">{c}</span></div>' for a, t, s, k, c in ATTN)
    return f"""<div class="card"><div class="card-head"><h2>Needs your attention</h2><span class="nb" style="margin:0">{len(ATTN)}</span></div>{rows}</div>"""


ACTIVE = [
    ("Spring Launch Reel", "Lumen Skincare", ("green", "Funded · simulation"), ("pri", "Submit content")),
    ("Studio Tour Shorts", "Northwind Studio", ("violet", "Your signature needed"), ("pri", "Review and sign")),
    ("Holiday Gift Guide", "Northwind Studio", ("gray", "You signed · Waiting for Northwind Studio to sign"), ("sec", "View agreement")),
]


def active_list():
    rows = "".join(f'<div class="list-row" style="align-items:flex-start"><div class="t"><b>{t}</b><span>{b}</span><div style="margin-top:6px">{pill(*p)}</div></div>{m_btn(bt[0], "Open" if bt[0]=="sec" else "Review")}</div>' for t, b, p, bt in ACTIVE)
    return f"""<div class="card"><div class="card-head"><h2>Active collaborations</h2><span class="link">View all</span></div>{rows}</div>"""


def active_table():
    rows = "".join(f'<tr><td><b>{t}</b><small>{b}</small></td><td>{pill(*p)}</td><td><span class="btn {bt[0]} sm">{bt[1]}</span></td></tr>' for t, b, p, bt in ACTIVE)
    return f"""<div class="card"><div class="card-head"><h2>Active collaborations</h2><span class="link">View all</span></div>
<table class="t"><thead><tr><th>Collaboration</th><th>Status</th><th>Next step</th></tr></thead><tbody>{rows}</tbody></table></div>"""


def build_home():
    desk = f"""<div class="ph"><h1>Welcome back, Amara</h1><p>Your work and next steps in one place.</p></div>
<div style="display:grid;grid-template-columns:1fr 330px;gap:20px;margin-top:18px">
 <div class="stack">
  {banner("invite","mail","1 new invitation","Northwind Studio invited you to Free Tech Support.",'<span class="btn white">Review invitation</span>')}
  <div class="stats">
   {stat("mail","Invitations","1","Waiting for your reply")}
   {stat("handshake","Active collaborations","3")}
   {stat("mail","Unread messages","1")}
   {stat("wallet","Paid out this month","$0")}
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
<div class="m-stats">{stat("mail","Invitations","1","Waiting for your reply")}{stat("handshake","Active","3")}{stat("mail","Unread messages","1")}{stat("wallet","Paid out this month","$0")}</div>
{attention_card(True)}
<div class="card"><div class="card-head"><h2>Influencer Card</h2></div><div style="display:flex;justify-content:center">{card_img(300)}</div>
<div style="display:flex;gap:8px;margin-top:14px;justify-content:center"><span class="btn sec sm">{i("copy","sm")}Copy link</span><span class="btn sec sm">Edit card</span></div></div>
{active_list()}"""
    body = f"""<div class="row">
{frame("Desktop · 1280", app("inf","dash",INF_BADGES,INF_BELL,desk,tall=True))}
{frame("Mobile · 390 (full page)", phone("inf","dash",INF_BADGES,INF_BELL,mob,tall=True))}
<div>
{notes("Original influencer card (finding 1)",[
 "The card is the <b>live card component</b>, unchanged: avatar ring + verified tick, name, handle, specialty, location, platform tiles with VERIFIED / UNVERIFIED labels, QR with Influrios mark, short link.",
 "Scaled <b>proportionally</b> to the column width (desktop 292 px, mobile 300 px). Never cropped, never re-composed, no content omitted on mobile.",
 "Mobile shows the full card in its own section, before the active collaborations list.",
 "Board image is a capture of the live demo card (Amara Cole). Implementation renders <code>InfluencerCardView</code> itself, not an image.",
])}
{notes("Shared example records (correction 1)",[
 "Every influencer board uses the same records: <b>4 tasks</b> on Amara's turn = reply to Free Tech Support · submit Spring Launch Reel Milestone 1 · submit Milestone 2 · sign Studio Tour Shorts.",
 "Collaborations badge <b>3</b> = 1 invitation + 2 content tasks. Contracts badge <b>1</b> = Studio Tour Shorts. Needs your attention <b>4</b> = 3 + 1. Action inbox: 4 rows. Bell 2 before the invitation notice is opened.",
 "Banner and Invitations stat = invitations <b>waiting for your reply</b> (1). Reading doesn't change it (master-spec §1, §2.2a).",
 "Active collaborations 3 = the same filter as the hub Active tab: Spring Launch Reel, Studio Tour Shorts, Holiday Gift Guide.",
 "Holiday Gift Guide: Amara signed on 20 Nov, so it shows “You signed · Waiting for Northwind Studio to sign” with no task here, in the inbox, or in notifications. Northwind's dashboard shows the matching Sign agreement task.",
 "“Funded · simulation”: live deposits are closed, so any held amount in examples is a simulation and is labelled as one.",
 "Mobile rows keep an Open / Review button on every row (correction 4).",
])}
{notes("Payout readiness (finding 3)",[
 "This board is the <b>Ready</b> state, so home shows no payout message and the Earnings badge is absent.",
 "Every other payout state and its home message: <a class='link' href='earnings-payout.html'>earnings-payout.html</a>.",
])}
</div></div>"""
    page("influencer-home.html","Influencer home","Package 1 · Influencer","Influencer home",
         "Original card restored. All annotations moved outside the app. Counts come from the shared example records: four tasks (one invitation, two content milestones, one signature), three active collaborations, payout Ready.",
         ["F1 original card","F2 no internal notes","F3 Ready state","F4 invitation counts","F6 typography","INV-DC-001","INV-DC-006"], body)


def hub_content(mobile=False):
    status = f"""<div class="{'m-stats' if mobile else 'stats'}">
 {stat("mail","Invitations","3","1 waiting for your reply")}
 {stat("handshake","Active","3","2 content tasks · 1 to sign")}
 {stat("wallet","Payment readiness",pill("green","Ready"),"You can receive payouts")}
 {stat("check","Completed","4")}
</div>"""
    ROWS = [
        ("N", "Free Tech Support", "Northwind Studio · Reply by 28 Nov", ("violet", "Waiting for your reply"), ("pri", "Review")),
        ("L", "Autumn Glow Series", "Lumen Skincare · You asked a question on 19 Nov", ("blue", "Waiting for Lumen Skincare"), ("sec", "Open")),
        ("N", "Winter Unboxing · Team", "Northwind Studio · with 2 influencers · You accepted", ("green", "Waiting for teammates"), ("sec", "Open")),
    ]
    if mobile:
        rows = "".join(f'<div class="list-row" style="align-items:flex-start"><span class="mono-ava">{a}</span><div class="t"><b>{t}</b><span>{sub}</span><div style="margin-top:6px">{pill(*pl)}</div></div>{m_btn(*bt)}</div>' for a, t, sub, pl, bt in ROWS)
        tabs = '<div class="tabs" style="gap:8px 16px;font-size:13px;flex-wrap:wrap"><a>Overview</a><a class="on">Invitations <span class="nb">1</span></a><a>Applications</a><a>Active <span class="nb">2</span></a><a>Completed</a></div>'
    else:
        rows = "".join(f'<div class="list-row"><span class="mono-ava">{a}</span><div class="t"><b>{t}</b><span>{sub}</span></div>{pill(*pl)}<span class="btn {bt[0]} sm">{bt[1]}</span></div>' for a, t, sub, pl, bt in ROWS)
        tabs = '<div class="tabs"><a>Overview</a><a class="on">Invitations <span class="nb">1</span></a><a>Applications</a><a>Active <span class="nb">2</span></a><a>Completed</a></div>'
    return f"""<div class="ph"><h1>Collaborations</h1><p>Invitations, applications, and active work.</p></div>
{status}
<div class="card">{tabs}<div style="margin-top:6px">{rows}</div></div>"""


def build_hub():
    body = f"""<div class="row">
{frame("Desktop · 1280 · Invitations tab", app("inf","collab",INF_BADGES,INF_BELL,'<div class="stack">'+hub_content()+'</div>'))}
{frame("Mobile · 390", phone("inf","collab",INF_BADGES,INF_BELL,hub_content(True)))}
<div>
{notes("Projection (DB1 · finding 4)",[
 "Invitations card shows <b>open</b> invitations (3) with the <b>waiting for your reply</b> subset (1). Home shows only the subset, so the two screens agree.",
 "<b>Team invitations are listed here</b> like marketplace invitations (P1-AUD-04, found in the IPS-44 run): pending ones count as waiting; accepted-awaiting-teammates rows stay listed with “Waiting for teammates”.",
 "Tab badges: Invitations 1 (waiting for your reply) + Active 2 (Spring Launch Reel Milestones 1 and 2). The Collaborations sidebar badge is their sum, <b>3</b>, so it counts the invitation <b>and</b> the content tasks.",
 "Studio Tour Shorts' signature task is counted on <b>Contracts</b> (1), not here; the Active stat names it (“1 to sign”) so the row is explained.",
 "Mobile keeps all five tabs (Overview · Invitations · Applications · Active · Completed), wrapping instead of dropping any, and every row keeps its Open / Review button.",
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
