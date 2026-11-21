from chrome import *

BADGES = {"collab": 2, "contracts": 1}
# Northwind Studio's side of the shared example records (Amara Cole rows match the influencer boards).
ATTN = [
    ("P", "Priya Nair is interested", "Free Tech Support · replied 21 Nov", "Review response", "pri"),
    ("J", "Content submitted for review", "Desk Setup Reel · Milestone 1 · Jordan Lee", "Review content", "pri"),
    ("A", "Sign agreement", "Holiday Gift Guide · Amara Cole signed 20 Nov", "Sign agreement", "sec"),
]
COLLABS = [
    ("Desk Setup Reel", "Jordan Lee · Instagram", ("violet", "Content in review"), "You", "2h ago"),
    ("Holiday Gift Guide", "Amara Cole · YouTube", ("amber", "Your signature needed"), "You", "1d ago"),
    ("Studio Tour Shorts", "Amara Cole · YouTube", ("gray", "Waiting for Amara Cole to sign"), "Influencer", "21 Nov"),
    ("Free Tech Support", "Request · 3 invited", ("blue", "1 response"), "You", "4h ago"),
    ("Winter Unboxing · Team", "3 influencers", ("gray", "Waiting for 1 teammate"), "Influencers", "1d ago"),
    ("Cable Kit Review", "Leo Martins · YouTube", ("gray", "Agreement signed · funding isn't available yet"), "—", "2d ago"),
]


def attention(mobile=False):
    rows = "".join(
        f'<div class="list-row"><span class="mono-ava">{a}</span><div class="t"><b>{t}</b><span>{s}</span></div>'
        + ("" if mobile else f'<span class="btn {k} sm">{c}</span>') + "</div>"
        + (f'<div class="list-row" style="border-top:0;padding-top:0"><span class="btn {k} sm" style="width:100%">{c}</span></div>' if mobile else "")
        for a, t, s, c, k in ATTN)
    return f'<div class="card"><div class="card-head"><h2>Needs your attention</h2><span class="nb" style="margin:0">3</span></div>{rows}</div>'


def stats(mobile=False):
    return f"""<div class="{'m-stats' if mobile else 'stats'}">
{stat("file-text","Active requests","3","1 response to review")}
{stat("handshake","Active collaborations","4","1 content review")}
{stat("file-text","Agreements to sign","1","Holiday Gift Guide")}
{stat("users","Waiting on influencers","2","Studio Tour Shorts · Winter Unboxing")}</div>"""


def collabs_table():
    rows = "".join(
        f'<tr><td><b>{t}</b><small>{s}</small></td><td>{pill(*p)}</td><td>{o}</td><td><small>{u}</small></td><td><span class="link">Open</span></td></tr>'
        for t, s, p, o, u in COLLABS)
    return f"""<div class="card"><div class="card-head"><h2>Recent collaborations</h2><span class="link">View all</span></div>
<table class="t"><thead><tr><th>Collaboration</th><th>Status</th><th>Next to act</th><th>Updated</th><th></th></tr></thead><tbody>{rows}</tbody></table></div>"""


def collabs_list():
    rows = "".join(
        f'<div class="list-row" style="align-items:flex-start"><div class="t"><b>{t}</b><span>{s} · {u}</span><div style="margin-top:6px">{pill(*p)}</div></div>{m_btn("pri" if o=="You" else "sec", "Review" if o=="You" else "Open")}</div>' for t, s, p, o, u in COLLABS)
    return f'<div class="card"><div class="card-head"><h2>Recent collaborations</h2><span class="link">View all</span></div>{rows}</div>'


def side_cards():
    return f"""<div class="card"><div class="card-head"><h2>Billing &amp; Subscription</h2>{pill("green","Active")}</div>
<dl class="kv"><dt>Plan</dt><dd>Business Pro</dd><dt>Billing</dt><dd>$99/mo · renews 1 Dec</dd><dt>Seats</dt><dd>1 of 3 used</dd></dl>
<div style="margin-top:12px"><span class="btn sec sm">Manage plan</span></div></div>
<div class="card"><div class="card-head"><h2>Saved influencers</h2><span class="link">Discover</span></div>
<div class="list-row"><span class="mono-ava">A</span><div class="t"><b>Amara Cole</b><span>Beauty · Accra</span></div></div>
<div class="list-row"><span class="mono-ava">P</span><div class="t"><b>Priya Nair</b><span>Lifestyle · London</span></div></div>
<div class="list-row"><span class="mono-ava">L</span><div class="t"><b>Leo Martins</b><span>Tech · Lisbon</span></div></div></div>
<div class="card"><div class="card-head"><h2>Recent activity</h2><span class="link">View all</span></div>
<div class="list-row"><div class="t"><b>Jordan Lee submitted content</b><span>Desk Setup Reel · 2h ago</span></div></div>
<div class="list-row"><div class="t"><b>Priya Nair replied to your invitation</b><span>Free Tech Support · 4h ago</span></div></div>
<div class="list-row"><div class="t"><b>You signed Studio Tour Shorts</b><span>Waiting for Amara Cole · 21 Nov</span></div></div></div>"""


def dashboard():
    return f"""<div class="ph"><h1>Welcome back, Dana</h1><p>Here's what needs a decision for Northwind Studio.</p></div>
<div style="display:grid;grid-template-columns:1fr 330px;gap:20px;margin-top:18px">
<div class="stack">{attention()}{stats()}{collabs_table()}
<div class="card" style="display:flex;align-items:center;gap:14px"><div class="t" style="flex:1"><b style="font-size:15px">Start a new request</b><p style="color:var(--muted);font-size:13px">Describe the campaign, then invite influencers who fit.</p></div><span class="btn pri">New request</span><span class="btn sec">Discover influencers</span></div>
</div><div class="stack">{side_cards()}</div></div>"""


def response_popup_body():
    return f"""<div style="margin-bottom:12px">{pill("green","Interested")}</div>
<dl class="kv"><dt>Request</dt><dd>Free Tech Support</dd><dt>Influencer</dt><dd>Priya Nair · @priya.demo</dd><dt>Proposed fee</dt><dd>$800</dd><dt>Reply by</dt><dd>28 Nov</dd></dl>
<p style="margin-top:12px">“Happy to do this. I can deliver the video in the first week of December.”</p>
<div class="hint" style="margin-top:12px">Accepting records your decision and tells Priya Nair. You then prepare the agreement for both of you to review and sign. Nothing is charged.</div>"""


def outcome(cap, pk, ptxt, msg, acts):
    return f"""<div class="mini"><div class="mini-cap">{cap}</div>
<div class="card"><div class="dlg-head"><div><h3>Free Tech Support</h3><p style="color:var(--muted);font-size:12px">Priya Nair · Response</p></div>{pill(pk, ptxt)}</div>
<p style="margin:12px 0;font-size:13px;color:#344054">{msg}</p>
<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid var(--line-soft);padding-top:12px">{acts}</div></div></div>"""


OUTCOMES = [
    outcome("1 · Accept saved, then preparation opens", "green", "Accepted",
            "You accepted Priya Nair. Next, prepare the agreement.",
            '<span class="btn sec sm">Later</span><span class="btn pri sm">Prepare agreement</span>'),
    outcome("2 · Accept saved, preparation failed to open", "amber", "Accepted · agreement not sent",
            "Your acceptance is saved. We couldn't open the agreement. Nothing was sent to Priya Nair yet.",
            '<span class="btn sec sm">Close</span><span class="btn pri sm">' + i("refresh", "sm") + 'Prepare agreement</span>'),
    outcome("3 · Reopened later (dashboard row / direct link)", "amber", "Accepted · agreement not sent",
            "You accepted Priya Nair on 21 Nov. The agreement hasn't been sent.",
            '<span class="btn pri sm">Prepare agreement</span>'),
]


def build():
    pfoot = '<span class="btn danger">Not a fit</span><span class="btn sec">Reply</span><span class="btn pri">Accept</span>'
    desk = app("biz", "dash", BADGES, 2, dashboard(), tall=True)
    desk_pop = app("biz", "dash", BADGES, 2, dashboard(), overlay=dialog("Priya Nair is interested", "Free Tech Support · Response", response_popup_body(), pfoot), fid="desktop-popup")
    mob_content = f"""<div class="ph"><h1>Welcome back, Dana</h1><p>Here's what needs a decision for Northwind Studio.</p></div>
{attention(True)}{stats(True)}{collabs_list()}
<div class="card"><b style="font-size:15px">Start a new request</b><p style="color:var(--muted);font-size:13px;margin:4px 0 12px">Describe the campaign, then invite influencers who fit.</p><span class="btn pri" style="width:100%">New request</span></div>
{side_cards()}"""
    mob = phone("biz", "dash", BADGES, 2, mob_content, tall=True)
    mob_pop = phone("biz", "dash", BADGES, 2, attention(True), overlay=sheet("Priya Nair is interested", "Free Tech Support · Response", response_popup_body(),
                    '<span class="btn pri">Accept</span><span class="btn sec">Reply</span><span class="btn danger">Not a fit</span>'), fid="mobile-popup")

    empty = f"""<div class="mini"><div class="mini-cap">Empty · new workspace</div>
<div class="card"><h3>Needs your attention</h3><p style="color:var(--muted);font-size:13px;margin-top:6px">Nothing needs a decision right now.</p></div>
<div class="card"><h3>Start your first collaboration</h3><p style="color:var(--muted);font-size:13px;margin:6px 0 12px">Post a request, then invite influencers who fit your brand.</p>
<div style="display:flex;gap:8px"><span class="btn pri sm">New request</span><span class="btn sec sm">Discover influencers</span></div></div>
<div class="card"><h3>Recent collaborations</h3><p style="color:var(--muted);font-size:13px;margin-top:6px">Your collaborations will appear here.</p></div></div>"""
    loading = """<div class="mini"><div class="mini-cap">Loading</div>
<div class="card"><div class="sk" style="height:16px;width:50%"></div><div class="sk" style="height:40px;margin-top:12px"></div><div class="sk" style="height:40px;margin-top:8px"></div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="sk" style="height:84px"></div><div class="sk" style="height:84px"></div></div>
<div class="card"><div class="sk" style="height:16px;width:40%"></div><div class="sk" style="height:28px;margin-top:12px"></div><div class="sk" style="height:28px;margin-top:8px"></div></div></div>"""
    error = f"""<div class="mini"><div class="mini-cap">Error · partial failure</div>
{banner("rose","alert","We couldn't load your collaborations","Your other dashboard sections are up to date.",'<span class="btn sec sm">'+i("refresh","sm")+'Try again</span>')}
<div class="card"><h3>Needs your attention</h3><div class="list-row"><span class="mono-ava">P</span><div class="t"><b>Priya Nair is interested</b><span>Free Tech Support</span></div></div></div>
<div class="card"><h3>Billing &amp; Subscription</h3><p style="font-size:13px;margin-top:6px">Business Pro · Active</p></div></div>"""
    body = f"""<div class="row">
{frame("Desktop · 1280 · Full dashboard", desk)}
{frame("Mobile · 390 · Full dashboard", mob)}
{frame("Desktop · Attention item opened (centered popup)", desk_pop)}
{frame("Mobile · Attention item opened (sheet)", mob_pop)}
<div>
{notes("Complete business dashboard (finding 5)",[
 "Order: Needs your attention → summaries → recent collaborations → start a request. Right column: billing, saved influencers, recent activity. Every card links to its destination page.",
 "Every attention row opens its item in a centered popup (desktop) or sheet (mobile), with the real decision buttons. It doesn't just link out.",
 "Collaborations badge 2 = response to review + content to review. Contracts badge 1 = agreement waiting for your signature. Attention shows 3 = 2 + 1, so each count sits on the item that opens it.",
 "Stats use the same projections as the destinations: Active requests = Collaborations › Requests; Agreements to sign = Contracts filter.",
 "“Discover Influencers” replaces “Discover Creators” in the sidebar and CTAs (Package 1 terminology).",
 "Funding/deposit actions stay out: live deposits closed. A fully signed agreement shows “Agreement signed · funding isn't available yet” with no task; Fund collaboration appears only when funding is available (master-spec §2.2c, DB8). No money stat on the dashboard.",
 "Shared example records: Holiday Gift Guide (Amara signed 20 Nov → <b>your</b> sign task) and Studio Tour Shorts (you signed 21 Nov → “Waiting for Amara Cole to sign”, no task) mirror the influencer boards exactly.",
])}
{notes("Accept, then prepare (correction 3)",[
 "The popup's buttons are <b>Accept · Reply · Not a fit</b>. Accept persists the acceptance first. Only after it is saved does agreement preparation open.",
 "If preparation fails to open, the acceptance stays saved and the item shows <b>“Accepted · agreement not sent”</b> with <b>Prepare agreement</b>. It never offers Accept again, and retrying never creates a second acceptance.",
 "The same state appears on the dashboard row, the request page and the direct link, with the same single action.",
])}
</div></div>
<div class="section-title">After Accept (outcomes; never a second Accept)</div>
<div class="grid-3">{"".join(OUTCOMES)}</div>
<div class="section-title">Empty · loading · error</div>
<div class="grid-3">{empty}{loading}{error}</div>"""
    page("business-dashboard.html", "Business dashboard", "Package 1 · Business", "Business dashboard — complete",
         "Replaces the partial business-chrome example with a complete desktop and mobile dashboard, opened popups, and empty, loading and error states.",
         ["F5 complete dashboard", "F2 customer copy", "F6 typography", "Terminology: Influencer", "INV-DC-032/033 regression"], body)
