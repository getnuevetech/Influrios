from chrome import *
import b_home_hub

DETAILS = """<dl class="kv"><dt>Proposed fee</dt><dd>$800</dd><dt>Deliverables</dt><dd>1 YouTube video · 1 Instagram story</dd><dt>Reply by</dt><dd>28 Nov</dd></dl>"""

# (key, title, status pill, message, actions html, product status)
STATES = [
    ("pending", "Waiting for your reply", "violet",
     "Northwind Studio invited you. Tell them if you're interested, ask a question, or decline.",
     '<span class="btn danger sm">Decline</span><span class="btn sec sm">Ask a question</span><span class="btn pri sm">I\'m interested</span>',
     "case 1 · REQUESTED / VIEWED"),
    ("question", "Question sent", "blue",
     "You asked: “Can the video go live in December?” Northwind Studio's reply will appear here and in Messages.",
     '<span class="btn danger sm">Decline</span><span class="btn sec sm">View conversation</span>',
     "case 2 · NEGOTIATING · turn = business"),
    ("replied", "Northwind Studio replied", "violet",
     "“Yes, December works. Final cut by 15 Dec.” Let Northwind Studio know how you'd like to continue.",
     '<span class="btn danger sm">Decline</span><span class="btn sec sm">Ask another question</span><span class="btn pri sm">I\'m interested</span>',
     "case 3 · NEGOTIATING · turn = invitee (needs P1-D1)"),
    ("interested", "Interested", "green",
     "You told Northwind Studio you're interested. This isn't an agreement yet. They'll send one if they choose you.",
     '<span class="btn danger sm">Decline</span><span class="btn sec sm">Ask a follow-up question</span>',
     "case 4 · RESPONDED · turn = business"),
    ("interested-followup", "Interested · question sent", "green",
     "You asked: “Can I use my own music?” Northwind Studio still decides on the invitation; their answer will appear here and in Messages.",
     '<span class="btn danger sm">Decline</span>',
     "case 5 · NEGOTIATING · turn stays business"),
    ("accepted", "Accepted", "green",
     "Northwind Studio accepted you and is preparing the agreement. You don't need to do anything yet.",
     '<span class="btn sec sm">Close</span>',
     "ACCEPTED by business · agreement not sent"),
    ("agreement", "Agreement ready to sign", "violet",
     "Northwind Studio sent the agreement. Review it and sign to start the collaboration.",
     '<span class="btn pri sm">Review and sign agreement</span>',
     "agreement sent · your signature pending"),
    ("declined", "You declined", "gray",
     "You declined this invitation on 22 Nov. Nothing was signed or funded.",
     '<span class="btn sec sm">Close</span>',
     "DECLINED"),
    ("expired", "Expired", "gray",
     "This invitation expired on 28 Nov. Northwind Studio can send a new one.",
     '<span class="btn sec sm">Close</span>',
     "EXPIRED"),
    ("withdrawn", "Withdrawn", "gray",
     "Northwind Studio withdrew this invitation on 23 Nov.<span style='display:block;margin-top:10px;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:12px;color:#344054'><b>Reason given:</b> “The campaign has moved to spring. We'll invite you again then.”</span><span style='display:block;margin-top:8px'>Nothing was signed or funded.</span>",
     '<span class="btn sec sm">Close</span>',
     "WITHDRAWN · recorded reason shown"),
]
TEAM = [
    ("team-pending", "Team invitation · Waiting for your reply", "violet",
     "Northwind Studio invited you with 2 other influencers. Your share: 40%. Accepting doesn't sign a contract.",
     '<span class="btn danger sm">Decline</span><span class="btn pri sm">Accept invitation</span>', "member invited"),
    ("team-accepted", "Team invitation · You accepted", "green",
     "Waiting for 1 more teammate. The agreement opens after everyone accepts.",
     '<span class="btn sec sm">Close</span>', "member accepted · proposal partial"),
    ("team-closed", "Team invitation · Closed", "gray",
     "Northwind Studio closed this team proposal after you accepted. Nothing was signed or funded, and there's nothing more for you to do.",
     '<span class="btn sec sm">Close</span>', "member accepted → proposal CLOSED by business"),
]
# Signatures after the business accepts (master-spec §2.2c). Influencer view; business view in caption.
SIGN = [
    ("sign-both", "Agreement ready to sign", "violet",
     "Northwind Studio sent the agreement. Neither of you has signed yet. Review it and sign when you're ready.",
     '<span class="btn pri sm">Review and sign agreement</span>',
     "both signatures pending · influencer task + business task", ("Free Tech Support", "Northwind Studio")),
    ("sign-other-first", "Your signature needed", "violet",
     "Northwind Studio signed on 21 Nov. Review the agreement and sign to complete it.",
     '<span class="btn pri sm">Review and sign agreement</span>',
     "business signed · your signature pending · Contracts 1", ("Studio Tour Shorts", "Northwind Studio")),
    ("sign-you-first", "Waiting for Northwind Studio to sign", "gray",
     "You signed on 20 Nov. Northwind Studio signs next. You don't need to do anything.",
     '<span class="btn sec sm">View agreement</span>',
     "you signed · business pending · no influencer task", ("Holiday Gift Guide", "Northwind Studio")),
    ("sign-all-funding-off", "Agreement signed", "green",
     "You and Northwind Studio both signed on 22 Nov. Funding isn't available for this collaboration yet. Northwind Studio handles the next step.",
     '<span class="btn sec sm">View agreement</span>',
     "all signed · funding unavailable · no task for either party", ("Free Tech Support", "Northwind Studio")),
]
EDGE = [
    ("saved", "Interested", "green",
     "We confirmed your response was saved. Northwind Studio can see you're interested.",
     '<span class="btn pri sm">Close</span>', "timeout → record lookup: saved"),
    ("processing", "Still processing", "amber",
     "Your response is still being processed.<span style='display:block;margin-top:10px;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:12px;color:var(--indigo)'>Your question: “Can the final cut move to 20 Dec?”</span>",
     '<span class="btn sec sm">Close</span><span class="btn pri sm">' + i("refresh", "sm") + 'Check again</span>', "timeout → record lookup: processing · draft kept"),
    ("unconfirmed", "Couldn't confirm", "rose",
     "We couldn't confirm your response. Your answer is still here.<span style='display:block;margin-top:10px;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:12px;color:var(--indigo)'>Your question: “Can the final cut move to 20 Dec?”</span>",
     '<span class="btn sec sm">Close</span><span class="btn pri sm">' + i("refresh", "sm") + 'Try again</span>', "no record / lookup failed · same key · draft kept"),
    ("concurrent", "This invitation was withdrawn", "gray",
     "Northwind Studio withdrew it before your reply arrived. Nothing was signed or funded.",
     '<span class="btn pri sm">Back to invitations</span>', "record lookup or reply: rejected (WITHDRAWN)"),
]


def mini(s):
    key, title, pk, msg, acts, status = s[:6]
    ct, cb = s[6] if len(s) > 6 else ("Free Tech Support", "Northwind Studio")
    return f"""<div class="mini"><div class="mini-cap">{title} · <span style="text-transform:none;font-weight:600">{status}</span></div>
<div class="card"><div class="dlg-head"><div><h3>{ct}</h3><p style="color:var(--muted);font-size:12px">{cb}</p></div>{pill(pk, title.split(" · ")[-1] if title.startswith("Team invitation") else title)}</div>
<p style="margin:12px 0;font-size:13px;color:#344054">{msg}</p>
<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid var(--line-soft);padding-top:12px">{acts}</div></div></div>"""


def build_invite():
    popup = dialog("Free Tech Support", "Northwind Studio · Invitation",
                   f'<div style="margin-bottom:12px">{pill("violet","Waiting for your reply")}</div>{DETAILS}'
                   '<p style="margin-top:14px">Help us launch our support channel with an honest walkthrough of our setup service.</p>'
                   '<div class="hint" style="margin-top:14px">Replying doesn\'t sign a contract or start a payment. “I\'m interested” lets Northwind Studio know; they send an agreement if they choose you.</div>',
                   STATES[0][4])
    desk = app("inf", "collab", INF_BADGES, INF_BELL, '<div class="stack">' + b_home_hub.hub_content() + '</div>', overlay=popup)
    msheet = sheet("Free Tech Support", "Northwind Studio · Invitation",
                   f'<div>{pill("violet","Waiting for your reply")}</div>{DETAILS}<p style="font-size:14px;color:#344054">Help us launch our support channel with an honest walkthrough of our setup service.</p>'
                   '<div class="hint">Replying doesn\'t sign a contract or start a payment.</div>',
                   '<span class="btn pri">I\'m interested</span><span class="btn sec">Ask a question</span><span class="btn danger">Decline</span>')
    mob = phone("inf", "collab", INF_BADGES, INF_BELL, b_home_hub.hub_content(True), overlay=msheet)
    rows = [
        ("Waiting for your reply", "Invitee", "Interested · Ask a question · Decline", "Listed", "Yes: banner, stat, attention, badge"),
        ("Question sent", "Business", "Decline · View conversation", "Listed: “Waiting for Northwind Studio”", "No"),
        ("Business replied (to your question)", "Invitee", "I'm interested · Ask another question · Decline", "Listed: “Waiting for your reply”", "Yes, again, until you respond"),
        ("Interested", "Business", "Ask a follow-up question · Decline", "Listed: “Waiting for Northwind Studio”", "No"),
        ("Interested · follow-up sent / answered", "Business (turn stays)", "Decline (+ follow-up again once answered)", "Listed: “Waiting for Northwind Studio”", "No: the business still decides"),
        ("Accepted (by business), agreement not sent", "Business", "None", "Leaves Invitations → Active “Accepted · Northwind Studio is preparing the agreement”", "No influencer task"),
        ("Agreement sent · both signatures pending", "Both", "Review and sign agreement", "Active: “Agreement ready to sign”", "Task: Contracts badge + attention (business also has its own sign task)"),
        ("Agreement · business signed, you pending", "Invitee", "Review and sign agreement", "Active: “Your signature needed”", "Task: Contracts badge + attention"),
        ("Agreement · you signed, business pending", "Business", "View agreement", "Active: “Waiting for Northwind Studio to sign”", "No influencer task"),
        ("Agreement signed · funding unavailable", "Nobody yet", "View agreement", "Active: “Agreement signed”", "No task for either party"),
        ("Declined / Expired / Withdrawn (reason shown)", "Nobody", "None (Close)", "Leaves open list → Closed filter", "No; related notice action-required clears"),
        ("Team · invited", "Invitee", "Accept invitation · Decline", "Listed", "Yes"),
        ("Team · you accepted", "Teammates", "None", "Listed: “Waiting for teammates”", "No"),
        ("Team · closed after you accepted", "Nobody", "None (Close)", "Leaves open list → Closed filter", "No; nothing signed or funded"),
    ]
    table = "".join(f"<tr>{''.join(f'<td>{c}</td>' for c in r)}</tr>" for r in rows)
    body = f"""<div class="row">
{frame("Desktop · 1280 · Pending invitation open (centered popup)", desk)}
{frame("Mobile · 390 · Full-screen sheet", mob)}
<div>
{notes("Transitions (finding 4) · product semantics",[
 "Marketplace invitations follow <code>APPLICATION_TRANSITIONS</code>: “I'm interested” → RESPONDED, Ask a question → NEGOTIATING, Decline → DECLINED. None of these accepts work or drafts a contract. Only the business moves it to ACCEPTED.",
 "Asking a question <b>does not complete</b> the invitation. It stays open, with the business to act next. Decline is still available.",
 "Whose turn it is (<code>turn</code> = invitee / business / none) is persisted and changes only on actions. A business answer changes the turn only as the §2.2b matrix says: before interest is recorded it returns the turn to you (“Northwind Studio replied”: I'm interested · Ask another question · Decline); after interest, a follow-up answer keeps the business's turn and arrives as a message only.",
 "<b>Reading never changes turn.</b> Opening the invitation, the reply notice or the Messages thread marks them read, but the banner, attention row, badge and task stay until you respond.",
 "<b>Defect P1-D1 (code):</b> today there's no NEGOTIATING → RESPONDED transition, so interest can't be recorded after a question. The design is the target; the code must add that transition. The limitation is not adopted as UX.",
 "Actions follow one matrix (master-spec §2.2b) on status + turn + interest recorded + open question; the server enforces the same matrix. Follow-up questions after Interested are an explicit exception: turn stays with the business and nothing is added to your counts.",
 "Team invitations only offer Accept / Decline (team-proposal member status). No Interested or question.",
 "Badge, banner and attention clear <b>only when turn leaves the invitee</b> (a persisted response, or withdrawn / expired).",
])}
{notes("Failure, retry, concurrency",[
 "One idempotency key per <b>logical submission</b>, bound to the signed-in actor + invitation + payload. Retries of an unresolved submission reuse it; after an outcome, the next submission gets a new key even with identical text. The same key with a different binding is refused.",
 "Timeout: show “We couldn't confirm your response” and look up the <b>idempotency record</b>, not the invitation status (which can look unchanged while the write is still processing). Outcomes: <b>saved</b> → success · <b>rejected</b> → reason · <b>processing</b> → Check again · <b>no record / lookup failed</b> → Try again with the same key.",
 "The draft is kept and <b>locked</b> while its submission is unresolved, including after Close. It can be edited only after the outcome is saved or rejected.",
 "Buttons disable while sending, to prevent a double submit.",
 "Concurrent withdrawal or expiry: the server rejects the reply (“no longer open”). The popup swaps to the withdrawn message, and the list, badge and attention refresh from the server. No optimistic decrement before success.",
])}
</div></div>
<div class="section-title">Marketplace invitation states (popup status area)</div>
<div class="grid-3">{"".join(mini(s) for s in STATES)}</div>
<div class="section-title">Team invitation (invited · accepted · closed after you accepted)</div>
<div class="grid-3">{"".join(mini(s) for s in TEAM)}</div>
<div class="section-title">Signatures after the business accepts (influencer view; scenario named in each caption, outside the UI)</div>
<div class="grid-3" style="grid-template-columns:repeat(4,1fr)">{"".join(mini(s) for s in SIGN)}</div>
<p style="font-size:12px;color:var(--muted);margin-top:8px">Studio Tour Shorts and Holiday Gift Guide are the shared example records. The two Free Tech Support panels are later states of that invitation, shown for coverage only. Business view of the same four: Sign agreement task · Waiting for Amara Cole to sign · Sign agreement task · Agreement signed with “Funding isn't available for this collaboration yet”.</p>
<div class="section-title">Timeout outcomes (saved / processing / couldn't confirm / rejected)</div>
<div class="grid-3">{"".join(mini(s) for s in EDGE)}</div>
<div class="section-title">Who acts next, and what clears (also in flows.md §D)</div>
<table class="spec-table"><thead><tr><th>State</th><th>Next to act</th><th>Invitee actions</th><th>Hub Invitations tab</th><th>Counts toward home banner / attention / Collaborations badge</th></tr></thead><tbody>{table}</tbody></table>"""
    page("team-invite-respond.html", "Invitation transitions", "Package 1 · Influencer", "Invitations — respond and transitions",
         "Marketplace and team invitations: every state, what the influencer can do, who acts next, and when badges and attention clear. Includes failure, retry and concurrent withdrawal.",
         ["F4 invitation transitions", "F2 customer copy", "F6 typography", "INV-DC-015", "INV-DC-012"], body)


NOTIFS = [
    # (unread_before, kind, title, sub, action_required)
    (True, "Invitation", "Northwind Studio invited you to Free Tech Support", "21 Nov · Reply by 28 Nov", True),
    (True, "Message", "Lumen Skincare sent a message about Spring Launch Reel", "21 Nov · “Looking forward to Milestone 1.”", False),
    (False, "Agreement", "Studio Tour Shorts agreement is ready", "21 Nov · Northwind Studio signed · Review and sign", True),
    (False, "Payment", "Lumen Skincare funded Spring Launch Reel (simulation)", "20 Nov · Simulated funding · no money moved", False),
    (False, "Agreement", "Holiday Gift Guide agreement was ready", "18 Nov · Opens the agreement as it is now", False),
]


def build_notifications():
    def rows(after=False, mobile=False):
        out = []
        for idx, (unread, kind, t, sub, ar) in enumerate(NOTIFS):
            if after and idx == 0:
                unread = False
            dot = '<span style="width:8px;height:8px;border-radius:9px;background:var(--violet);flex:0 0 auto" aria-label="Unread"></span>' if unread else '<span style="width:8px;flex:0 0 auto"></span>'
            tag = pill("violet", "Action required") if ar else ""
            w = 700 if unread else 500
            if mobile:
                out.append(f'<div class="list-row" style="align-items:flex-start">{dot}<div class="t"><b style="font-weight:{w}">{t}</b><span>{kind} · {sub}</span>{("<div style=margin-top:6px>"+tag+"</div>") if tag else ""}</div>{m_btn("sec","Open")}</div>')
            else:
                out.append(f'<div class="list-row">{dot}<div class="t"><b style="font-weight:{w}">{t}</b><span>{kind} · {sub}</span></div>{tag}<span class="btn sec sm">Open</span></div>')
        return "".join(out)

    def filters(after):
        unread = sum(1 for k, n in enumerate(NOTIFS) if n[0] and not (after and k == 0))
        ar = sum(1 for n in NOTIFS if n[4])
        return f'<div style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap">{pill("violet","All 5")}{pill("gray",f"Unread {unread}")}{pill("gray",f"Action required {ar}")}</div>'

    def centre(after, mobile=False):
        head = '<div class="ph"><h1>Notifications</h1><p>Unread means you haven\'t opened it. Action required means a task is still open.</p></div>' if not mobile else '<div class="ph"><h1>Notifications</h1></div>'
        return f'{head}<div class="card">{filters(after)}{rows(after, mobile)}</div>'

    popup = dialog("Northwind Studio invited you", "Invitation · 21 Nov",
                   f'{DETAILS}<div class="hint" style="margin-top:14px">Your reply is still needed. This notice stays under Action required until you respond.</div>',
                   '<span class="btn sec">Close</span><span class="btn pri">Review invitation</span>', "sm")
    # Desktop: after opening the unread invitation notice. Bell 2 -> 1, Unread 2 -> 1, its dot gone, Action required stays 2.
    desk = app("inf", None, INF_BADGES, INF_BELL_AFTER, '<div class="stack">' + centre(True) + '</div>', overlay=popup)
    # Mobile: before opening. Bell 2, Unread 2.
    mob = phone("inf", None, INF_BADGES, INF_BELL, centre(False, True))
    hist = f"""<div class="mini"><div class="mini-cap">Historical notice opened · “Holiday Gift Guide agreement was ready” (18 Nov)</div>
<div class="card"><div class="dlg-head"><div><h3>Holiday Gift Guide</h3><p style="color:var(--muted);font-size:12px">Northwind Studio · Agreement</p></div>{pill("gray","Waiting for Northwind Studio to sign")}</div>
<p style="margin:12px 0;font-size:13px;color:#344054">You signed this agreement on 20 Nov. Northwind Studio signs next. You don't need to do anything.</p>
<div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid var(--line-soft);padding-top:12px"><span class="btn sec sm">Close</span><span class="btn sec sm">View agreement</span></div></div></div>"""
    signed = f"""<div class="mini"><div class="mini-cap">Agreement notice opened · “Studio Tour Shorts agreement is ready” (read, action required)</div>
<div class="card"><div class="dlg-head"><div><h3>Studio Tour Shorts</h3><p style="color:var(--muted);font-size:12px">Northwind Studio · Agreement</p></div>{pill("violet","Your signature needed")}</div>
<p style="margin:12px 0;font-size:13px;color:#344054">Northwind Studio signed on 21 Nov. Review the agreement and sign to complete it.</p>
<div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid var(--line-soft);padding-top:12px"><span class="btn sec sm">Close</span><span class="btn pri sm">Review and sign agreement</span></div></div></div>"""
    trans = """<table class="spec-table"><thead><tr><th>Moment</th><th>Bell</th><th>Unread filter</th><th>Invitation row dot</th><th>Action required</th></tr></thead><tbody>
<tr><td>Before opening (mobile frame)</td><td>2</td><td>2</td><td>Shown</td><td>2</td></tr>
<tr><td>Invitation notice opened (desktop frame)</td><td>1</td><td>1</td><td>Removed</td><td>2 (reply still needed)</td></tr>
<tr><td>Amara replies (Interested / question / decline)</td><td>1</td><td>1</td><td>—</td><td>1 (Studio Tour Shorts only)</td></tr>
<tr><td>Amara signs Studio Tour Shorts</td><td>1</td><td>1</td><td>—</td><td>0</td></tr></tbody></table>"""
    body = f"""<div class="row">
{frame("Desktop · 1280 · After opening the invitation notice", desk)}
{frame("Mobile · 390 · Before opening", mob)}
<div>
{notes("Rules (DB5 · correction 2)",[
 "Opening an <b>unread</b> notice updates three things together, in the same render: the bell (2 → 1), the Unread filter (2 → 1) and that row's dot. No page reload needed (P1-AUD-12).",
 "<b>Action required</b> follows the live task, not read state. The invitation notice keeps Action required until Amara responds; opening it doesn't clear it.",
 "Action required counts <b>notices</b>, not tasks. Here it is 2: the Free Tech Support invitation notice and the Studio Tour Shorts agreement notice, each pointing to a task that is still open. The inbox has 4 tasks because the two milestone tasks have no notice. Task counts (attention 4, badges 3 + 1, inbox 4) are defined separately (master-spec §3).",
 "<b>Historical notices open the current state.</b> “Holiday Gift Guide agreement was ready” is from 18 Nov; Amara signed on 20 Nov, so opening it shows “Waiting for Northwind Studio to sign” with View agreement, never a Sign button.",
 "Clearing action-required never deletes a notice and never changes read state. Unrelated notices are untouched.",
 "Funding examples say “(simulation)”: live deposits are closed and nothing here claims money is held in escrow.",
 "Notifications is reached from the bell, so no sidebar item or mobile tab is highlighted on this page.",
])}
</div></div>
<div class="section-title">Read state through the task (shared example records)</div>
{trans}
<div class="section-title">Agreement notices open the current state</div>
<div class="grid-3">{hist}{signed}</div>"""
    page("notifications.html", "Notifications", "Package 1 · Influencer", "Notifications centre + open",
         "Unread and action-required stay separate. Opening a notice updates the bell, the Unread filter and the row together; only completing the task clears action-required.",
         ["F4 clear rules", "F2 customer copy", "F6 typography", "INV-DC-020", "INV-DC-005", "P1-AUD-12"], body)
