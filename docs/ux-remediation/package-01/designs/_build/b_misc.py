from chrome import *
import b_home_hub
import b_business


def side_only(role, active, badges, cap):
    return f'<div class="frame-wrap"><div class="frame-cap">{cap}</div><div style="height:640px;border-radius:14px;overflow:hidden;border:1px solid #d9def0;display:flex">{sidebar(role, active, badges)}</div></div>'


def build_badges():
    rows = [
        ("Collaborations (influencer)", "Invitations waiting for your reply + collaboration tasks on your turn (submit content, revise)", "You reply (Interested / question / decline / accept), the task completes, or the invitation is withdrawn or expires", "Hub Invitations tab badge + Needs your attention"),
        ("Earnings &amp; Payouts", "1 when payout state is Setup required or Action required AND you have active collaborations or unpaid earnings", "State becomes Verification pending, Ready, Not available, or Temporarily unavailable (badge holds last known)", "Receive payments card shows the state and the one CTA"),
        ("Collaborations (business)", "Responses to review + content to review", "Business accepts, replies, declines, approves or requests revision", "Dashboard Needs your attention + Collaborations › Requests"),
        ("Contracts (business)", "Agreements waiting for your signature", "You sign, or the agreement is cancelled", "Contracts › To sign"),
        ("Bell", "Unread notices", "Opening an unread notice", "Notifications › Unread"),
        ("Action inbox", "None (destination only)", "—", "Each row = one task; duplicates merged (see action-inbox board)"),
        ("Messages", "None (home shows Unread messages stat)", "—", "Messages"),
    ]
    table = "".join(f"<tr>{''.join(f'<td>{c}</td>' for c in r)}</tr>" for r in rows)
    body = f"""<div class="row">
{side_only("inf","dash",{"collab":1},"Influencer · Ready, 1 invitation waiting")}
{side_only("inf","dash",{"collab":1,"earn":1},"Influencer · Action required on payouts")}
{side_only("inf","dash",{},"Influencer · Verification pending, invite answered")}
{side_only("biz","dash",{"collab":2,"contracts":1},"Business · 2 collaboration + 1 signature")}
</div>
<div class="section-title">Badge contract (master-spec §3)</div>
<table class="spec-table"><thead><tr><th>Badge</th><th>Counts</th><th>Clears when</th><th>Destination that explains it</th></tr></thead><tbody>{table}</tbody></table>"""
    page("sidebar-badges.html", "Sidebar badges", "Package 1 · Shared", "Sidebar badge semantics",
         "Each badge counts only what its destination shows and clears on the persisted state change, never on read alone.",
         ["F3 payout badge", "F4 clear rules", "F6 icons + type", "Terminology: Influencer", "DB1", "DB2"], body)


def drawer(role, active, badges):
    return f'<div class="drawer-scrim"></div><div class="drawer"><div class="sheet-head"><h2>Menu</h2><span class="dlg-x">{i("close","sm")}</span></div><nav class="nav">{nav_links(role, active, badges)}</nav>' \
           f'<div class="side-foot" style="margin-top:auto">{"<span>Plus</span><span>Billing &amp; Plan</span>" if role=="inf" else "<span>Business Pro</span><span>Manage plan</span>"}</div></div>'


def build_mobile_nav():
    inf = phone("inf", "dash", {"collab": 1, "earn": 1}, 3, b_home_hub.attention_card(), overlay=drawer("inf", "dash", {"collab": 1, "earn": 1}), more_open=True)
    biz = phone("biz", "dash", {"collab": 2, "contracts": 1}, 2, b_business.attention(True), overlay=drawer("biz", "dash", {"collab": 2, "contracts": 1}), fid="mobile-business", more_open=True)
    body = f"""<div class="row">
{frame("Influencer · More drawer open", inf)}
{frame("Business · More drawer open", biz)}
<div>{notes("MOB1",[
 "Fixed nav bar: 3 most used destinations + <b>More</b> in four equal slots. It never scrolls horizontally, and More is always fully visible at 320–430 px.",
 "More carries the sum of badges for destinations not in the bar (influencer: Earnings is in the bar; business: Contracts is in the bar).",
 "Drawer lists every sidebar destination in the same order, labels, icons and badges as desktop, including Billing &amp; Plans and Collaboration Payments.",
 "Business label is “Discover Influencers”.",
 "Focus trap, Esc closes, <code>aria-expanded</code> on More. The bell stays in the top bar.",
])}</div></div>"""
    page("mobile-auth-nav.html", "Mobile navigation", "Package 1 · Shared", "Signed-in mobile navigation",
         "Chips + More drawer for both roles. Same destinations and badges as desktop.",
         ["MOB1", "F5 business mobile", "F6 icons + type", "Terminology: Influencer"], body)


def build_states():
    def m(cap, inner):
        return f'<div class="mini"><div class="mini-cap">{cap}</div>{inner}</div>'
    sk = '<div class="card"><div class="sk" style="height:16px;width:45%"></div><div class="sk" style="height:38px;margin-top:12px"></div><div class="sk" style="height:38px;margin-top:8px"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="sk" style="height:80px"></div><div class="sk" style="height:80px"></div></div>'
    minis = [
        m("Loading · home (either role)", sk + '<p style="font-size:12px;color:var(--muted)">Badges keep their last value until counts load.</p>'),
        m("Empty · influencer invitations", '<div class="card"><h3>Invitations</h3><p style="color:var(--muted);font-size:13px;margin:6px 0 12px">No invitations are waiting. Businesses find you through your card and profile.</p><span class="btn sec sm">Share your card</span></div>'),
        m("Error · earnings", banner("rose", "alert", "We couldn't load your earnings", "Your balances haven't changed.", '<span class="btn sec sm">' + i("refresh", "sm") + 'Try again</span>')),
        m("Success · reply sent", '<div class="card"><div class="dlg-head"><h3>Free Tech Support</h3>' + pill("green", "Interested") + '</div><p style="font-size:13px;margin-top:8px;color:#344054">We let Northwind Studio know you\'re interested.</p></div><div class="toast" style="position:static">' + i("check", "sm") + 'Reply sent</div>'),
        m("Retry · still failing", banner("amber", "refresh", "Still having trouble", "We'll keep your page as it was. Try again in a minute.", '<span class="btn sec sm">Try again</span>')),
        m("Permission · wrong role or signed out", '<div class="card" style="text-align:center"><span class="mono-ava" style="margin:0 auto 10px">' + i("lock", "sm") + '</span><h3>This page is for business accounts</h3><p style="color:var(--muted);font-size:13px;margin:6px 0 12px">You\'re signed in as an influencer.</p><span class="btn pri sm">Go to your dashboard</span></div>'),
    ]
    mob = phone("inf", "dash", {"collab": 1}, 3, '<div class="ph"><h1>Welcome back, Amara</h1></div>' + banner("rose", "alert", "We couldn't load your dashboard", "Check your connection.", '<span class="btn sec sm">' + i("refresh", "sm") + 'Try again</span>') + sk)
    body = f"""<div class="row">{frame("Mobile · error with retry", mob)}<div class="grid-3" style="grid-template-columns:repeat(3,400px)">{''.join(minis)}</div></div>
<div class="section-title">Per-surface state matrix: flows.md §J · business states: business-dashboard.html · payout states: earnings-payout.html · invitation failure/concurrency: team-invite-respond.html</div>"""
    page("states.html", "Shared states", "Package 1 · Shared", "Loading · empty · error · success · retry · permission",
         "Customer-facing copy for every shared state, with no internal wording. Errors keep the last known counts.",
         ["F2 customer copy", "F6 typography", "§8 states"], body)


def build_inbox():
    rows = [
        ("Submit content", "Spring Launch Reel · Milestone 1 · due 25 Nov", "Lumen Skincare", "3 updates", "pri", "Submit"),
        ("Submit content", "Spring Launch Reel · Milestone 2 · due 9 Dec", "Lumen Skincare", "", "sec", "Open"),
        ("Reply to invitation", "Free Tech Support · reply by 28 Nov", "Northwind Studio", "2 updates", "pri", "Review"),
        ("Sign agreement", "Holiday Gift Guide", "Northwind Studio", "", "sec", "Review"),
    ]
    def lst(mobile=False):
        out = []
        for t, s, b, upd, k, c in rows:
            u = f' · <span style="color:var(--violet);font-weight:600">{upd}</span>' if upd else ""
            btn = "" if mobile else f'<span class="btn {k} sm">{c}</span>'
            out.append(f'<div class="list-row"><span class="mono-ava">{b[0]}</span><div class="t"><b>{t}</b><span>{s} · {b}{u}</span></div>{btn}</div>')
        return "".join(out)
    content = f'<div class="ph"><h1>Action inbox</h1><p>One row for each thing you need to do.</p></div><div class="card"><div class="card-head"><h2>To do</h2>{pill("violet","4 tasks")}</div>{lst()}</div>'
    desk = app("inf", "inbox", {"collab": 1}, 3, '<div class="stack">' + content + '</div>')
    mob = phone("inf", "dash", {"collab": 1}, 3, f'<div class="ph"><h1>Action inbox</h1></div><div class="card">{lst(True)}</div>')
    body = f"""<div class="row">
{frame("Desktop · 1280", desk)}
{frame("Mobile · 390", mob)}
<div>{notes("Deduplication (Package 1 · from #533 INBOX-DUP-001)",[
 "One row per <b>task identity</b> = (collaboration/funding id, milestone id or invitation id, action kind).",
 "Genuinely distinct tasks stay separate: Milestone 1 and Milestone 2 of the same collaboration are two rows.",
 "Repeated events for the same task (reminders, re-sent notices, status pings) merge into the one row. The row shows the latest date and “N updates”.",
 "When the task completes, the row leaves To do and the <b>action-required</b> flag clears on that task's notices. The notices <b>stay in Notifications history</b>, keeping their own read/unread state. Nothing is deleted, and unrelated unread messages or notices are not marked read.",
 "Counts: Collaborations badge and Needs your attention count deduplicated tasks, never raw notices.",
 "Acceptance A-INBOX-01: ≤ 1 open row per task identity; two distinct milestones never collapse.",
])}</div></div>"""
    page("action-inbox.html", "Action inbox", "Package 1 · Influencer", "Action inbox — deduplicated tasks",
         "Duplicate representations of the same task merge into one row. Distinct tasks stay separate.",
         ["Pkg1 dedupe (A-INBOX-01)", "F2 customer copy", "F6 typography"], body)


def build_admin():
    content = f"""<div class="ph"><h1>Jobs</h1><p>Scheduled work and failures.</p></div>
{banner("rose","alert","2 jobs failed in the last 24 hours","Open each failure to see what happened and retry.",'<span class="btn sec sm">View failures</span>')}
<div class="card"><table class="t"><thead><tr><th>Job</th><th>Last run</th><th>Result</th><th></th></tr></thead><tbody>
<tr><td><b>invitation_expiry_sweep</b></td><td><small>21 Nov 02:00</small></td><td>{pill("rose","Failed")}</td><td><span class="btn sec sm">Retry</span></td></tr>
<tr><td><b>quote_expiry_sweep</b></td><td><small>21 Nov 02:05</small></td><td>{pill("rose","Failed")}</td><td><span class="btn sec sm">Retry</span></td></tr>
<tr><td><b>milestone_auto_approval</b></td><td><small>21 Nov 03:00</small></td><td>{pill("green","Succeeded")}</td><td></td></tr></tbody></table></div>"""
    adm = f'<div class="app" id="desktop"><aside class="side"><div class="wordmark"><span class="mark">∞</span>Influrios Admin</div><nav class="nav"><a>{i("home")}<span>Overview</span></a><a>{i("users")}<span>Users</span></a><a>{i("wallet")}<span>Marketplace ledger</span></a><a class="on">{i("clock")}<span>Jobs</span><span class="nb" style="background:var(--rose)">2</span></a><a>{i("mail")}<span>Mail</span></a><a>{i("settings")}<span>Settings</span></a></nav></aside><div class="main"><div class="top"><div class="grow"></div><div class="who"><span class="ava">S</span><div><b>Ops admin</b><span>Super admin</span></div></div></div><div class="content"><div class="stack">{content}</div></div></div></div>'
    body = f"""<div class="row">{frame("Admin · Jobs alert", adm)}<div>{notes("Package 1 scope for admin",[
 "Only the shared rule applies: an alert count sits on the item that opens the screen explaining it (Jobs 2 → 2 failed rows).",
 "Admin chrome, job recovery depth, the contract ledger and reconciliation are Package 5 (master-spec §10).",
 "Live deposits stay closed. No admin funding actions.",
])}</div></div>"""
    page("admin-shared-note.html", "Admin shared note", "Package 1 · Admin (light)", "Admin — shared count rule",
         "Package 1 touches admin only through the shared count rule.", ["F6 typography", "Pkg5 boundary"], body)


BUILDERS = [build_badges, build_mobile_nav, build_states, build_inbox, build_admin]
