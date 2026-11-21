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
     "Northwind Studio withdrew this invitation. Nothing was signed or funded.",
     '<span class="btn sec sm">Close</span>',
     "WITHDRAWN"),
]
TEAM = [
    ("team-pending", "Team invitation · Waiting for your reply", "violet",
     "Northwind Studio invited you with 2 other influencers. Your share: 40%. Accepting doesn't sign a contract.",
     '<span class="btn danger sm">Decline</span><span class="btn pri sm">Accept invitation</span>', "member invited"),
    ("team-accepted", "Team invitation · You accepted", "green",
     "Waiting for 1 more teammate. The agreement opens after everyone accepts.",
     '<span class="btn sec sm">Close</span>', "member accepted · proposal partial"),
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
    key, title, pk, msg, acts, status = s
    return f"""<div class="mini"><div class="mini-cap">{title} · <span style="text-transform:none;font-weight:600">{status}</span></div>
<div class="card"><div class="dlg-head"><div><h3>Free Tech Support</h3><p style="color:var(--muted);font-size:12px">Northwind Studio</p></div>{pill(pk, title.split(" · ")[-1] if title.startswith("Team invitation") else title)}</div>
<p style="margin:12px 0;font-size:13px;color:#344054">{msg}</p>
<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid var(--line-soft);padding-top:12px">{acts}</div></div></div>"""


def build_invite():
    popup = dialog("Free Tech Support", "Northwind Studio · Invitation",
                   f'<div style="margin-bottom:12px">{pill("violet","Waiting for your reply")}</div>{DETAILS}'
                   '<p style="margin-top:14px">Help us launch our support channel with an honest walkthrough of our setup service.</p>'
                   '<div class="hint" style="margin-top:14px">Replying doesn\'t sign a contract or start a payment. “I\'m interested” lets Northwind Studio know; they send an agreement if they choose you.</div>',
                   STATES[0][4])
    desk = app("inf", "collab", {"collab": 1}, 3, '<div class="stack">' + b_home_hub.hub_content() + '</div>', overlay=popup)
    msheet = sheet("Free Tech Support", "Northwind Studio · Invitation",
                   f'<div>{pill("violet","Waiting for your reply")}</div>{DETAILS}<p style="font-size:14px;color:#344054">Help us launch our support channel with an honest walkthrough of our setup service.</p>'
                   '<div class="hint">Replying doesn\'t sign a contract or start a payment.</div>',
                   '<span class="btn pri">I\'m interested</span><span class="btn sec">Ask a question</span><span class="btn danger">Decline</span>')
    mob = phone("inf", "collab", {"collab": 1}, 3, b_home_hub.hub_content(True), overlay=msheet)
    rows = [
        ("Waiting for your reply", "Invitee", "Interested · Ask a question · Decline", "Listed", "Yes: banner, stat, attention, badge"),
        ("Question sent", "Business", "Decline · View conversation", "Listed: “Waiting for Northwind Studio”", "No"),
        ("Business replied (to your question)", "Invitee", "I'm interested · Ask another question · Decline", "Listed: “Waiting for your reply”", "Yes, again, until you respond"),
        ("Interested", "Business", "Ask a follow-up question · Decline", "Listed: “Waiting for Northwind Studio”", "No"),
        ("Interested · follow-up sent / answered", "Business (turn stays)", "Decline (+ follow-up again once answered)", "Listed: “Waiting for Northwind Studio”", "No: the business still decides"),
        ("Accepted (by business), agreement not sent", "Business", "None", "Leaves Invitations → Active “Accepted · Northwind Studio is preparing the agreement”", "No influencer task"),
        ("Agreement ready to sign", "Invitee", "Review and sign agreement", "Contracts", "Task: Contracts badge + attention"),
        ("Declined / Expired / Withdrawn", "Nobody", "None (Close)", "Leaves open list → Closed filter", "No; related notice action-required clears"),
        ("Team · invited", "Invitee", "Accept invitation · Decline", "Listed", "Yes"),
        ("Team · you accepted", "Teammates", "None", "Listed: “Waiting for teammates”", "No"),
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
<div class="section-title">Team invitation · timeout outcomes (saved / processing / couldn't confirm / rejected)</div>
<div class="grid-3">{"".join(mini(s) for s in TEAM + EDGE)}</div>
<div class="section-title">Who acts next, and what clears (also in flows.md §D)</div>
<table class="spec-table"><thead><tr><th>State</th><th>Next to act</th><th>Invitee actions</th><th>Hub Invitations tab</th><th>Counts toward home banner / attention / Collaborations badge</th></tr></thead><tbody>{table}</tbody></table>"""
    page("team-invite-respond.html", "Invitation transitions", "Package 1 · Influencer", "Invitations — respond and transitions",
         "Marketplace and team invitations: every state, what the influencer can do, who acts next, and when badges and attention clear. Includes failure, retry and concurrent withdrawal.",
         ["F4 invitation transitions", "F2 customer copy", "F6 typography", "INV-DC-015", "INV-DC-012"], body)


def build_notifications():
    rows_data = [
        ("Unread", "Invitation", "Northwind Studio invited you to Free Tech Support", "Reply by 28 Nov", "violet", "Action required"),
        ("Unread", "Payment", "Lumen Skincare funded Spring Launch Reel", "$1,200 is in escrow", None, None),
        ("Unread", "Message", "Lumen Skincare replied about Autumn Glow Series", "“Yes, December works.”", None, None),
        ("Read", "Agreement", "Holiday Gift Guide agreement is ready", "Review and sign to start", None, None),
    ]
    def rows(mobile=False):
        out = []
        for st, kind, t, sub, pk, pt in rows_data:
            dot = '<span style="width:8px;height:8px;border-radius:9px;background:var(--violet);flex:0 0 auto"></span>' if st == "Unread" else '<span style="width:8px;flex:0 0 auto"></span>'
            tag = pill(pk, pt) if pk else ""
            if mobile:
                out.append(f'<div class="list-row" style="align-items:flex-start">{dot}<div class="t"><b style="font-weight:{700 if st=="Unread" else 500}">{t}</b><span>{kind} · {sub}</span>{('<div style="margin-top:6px">'+tag+'</div>') if tag else ''}</div></div>')
            else:
                out.append(f'<div class="list-row">{dot}<div class="t"><b style="font-weight:{700 if st=="Unread" else 500}">{t}</b><span>{kind} · {sub}</span></div>{tag}</div>')
        return "".join(out)
    filters = f'<div style="display:flex;gap:8px;margin-bottom:6px">{pill("violet","All")}{pill("gray","Unread 3")}{pill("gray","Action required 1")}</div>'
    centre = f'<div class="ph"><h1>Notifications</h1><p>Unread means you haven\'t opened it. Action required means a task is still open.</p></div><div class="card">{filters}{rows()}</div>'
    popup = dialog("Northwind Studio invited you", "Invitation · 21 Nov",
                   f'{DETAILS}<div class="hint" style="margin-top:14px">Your reply is still needed. This notice stays under Action required until you respond.</div>',
                   '<span class="btn sec">Close</span><span class="btn pri">Review invitation</span>', "sm")
    desk = app("inf", "dash", {"collab": 1}, 2, '<div class="stack">' + centre + '</div>', overlay=popup)
    mob = phone("inf", "dash", {"collab": 1}, 3, f'<div class="ph"><h1>Notifications</h1></div><div class="card">{filters}{rows(True)}</div>')
    body = f"""<div class="row">
{frame("Desktop · 1280 · Unread invitation opened (bell 3 → 2)", desk)}
{frame("Mobile · 390 · Centre", mob)}
<div>
{notes("Rules (DB5 · finding 4)",[
 "Opening an <b>Unread</b> notice marks it read: bell 3 → 2. Opening a read notice changes nothing.",
 "“Action required” is a filter on the live task, not on read state. It clears only when the invitation leaves the invitee's turn (Interested, question, decline, accept), withdrawn or expired.",
 "Clearing action-required never deletes a notice and never changes read state. The notice stays in All, and stays Unread if it was never opened. Unrelated notices are untouched.",
 "Filter label “Action required 1” counts live tasks only (matches the Collaborations badge). Historical kind counts aren't shown as live attention.",
 "Popup CTA routes to the invitation popup in the hub (same centered pattern). On mobile the notice opens as a full-screen sheet.",
])}
</div></div>"""
    page("notifications.html", "Notifications", "Package 1 · Influencer", "Notifications centre + open",
         "Unread and action-required stay separate. Opening a notice updates the bell; only completing the task clears action-required.",
         ["F4 clear rules", "F2 customer copy", "F6 typography", "INV-DC-020", "INV-DC-005"], body)
