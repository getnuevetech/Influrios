import re
from chrome import *

def txt(h):
    return re.sub(r"<[^>]+>","",h).strip()

# Six payout-readiness states (finding 3). Single source for earnings, home, hub, sidebar.
STATES = [
    dict(key="setup", label="Setup required", pill="violet",
         msg="Add your identity and payout account to receive collaboration payouts.",
         steps=[("todo", "Verify your identity", "About 5 minutes"), ("todo", "Add where you get paid", "Bank account in your name")],
         cta='<span class="btn pri">Set up payouts</span>',
         home=("lav", "wallet", "Set up payouts to get paid", "Add your identity and payout account before your first payout.", '<span class="btn pri">Set up payouts</span>'),
         hub="Set up payouts", badge=1),
    dict(key="pending", label="Verification pending", pill="blue",
         msg="We're checking your details. You don't need to do anything right now.",
         steps=[("done", "Identity submitted", "Sent 19 Nov"), ("wait", "Payout account in review", "Local bank ••4821 · Submitted 19 Nov")],
         cta='<span class="btn sec">View details</span>',
         home=("gray", "clock", "Payout verification in progress", "Check Earnings & Payouts for the latest status.", ""),
         hub="In review", badge=0),
    dict(key="ready", label="Ready", pill="green",
         msg="You can receive payouts to Local bank ••4821.",
         steps=[("done", "Identity verified", "Verified 20 Nov"), ("done", "Payout account verified", "Local bank ••4821")],
         cta='<span class="btn sec">Update payout account</span>',
         home=None, hub="Ready", badge=0),
    dict(key="restricted", label="Action required", pill="rose",
         msg="Your payout provider needs a clearer photo of your ID before payouts can continue.",
         steps=[("done", "Payout account added", "Local bank ••4821"), ("bad", "Upload a clearer ID photo", "Requested 21 Nov · Payouts are paused until this is done")],
         cta='<span class="btn pri">Upload ID photo</span>',
         home=("rose", "alert", "Payouts paused: one item needed", "Upload a clearer ID photo so we can send your earnings.", '<span class="btn pri">Upload ID photo</span>'),
         hub="Action required", badge=1),
    dict(key="unsupported", label="Not available in your country", pill="gray",
         msg="Collaboration payouts aren't available in Ghana yet.",
         steps=[("off", "Payouts not offered in Ghana", "Your profile, card, and invitations still work")],
         cta='<span class="btn sec">See supported countries</span>',
         home=("gray", "globe-off", "Payouts aren't available in Ghana yet", "Your profile, card and invitations still work.", ""),
         hub="Not available", badge=0),
    dict(key="unavailable", label="Status temporarily unavailable", pill="amber",
         msg="We can't check your payout status right now. Last confirmed: Ready, 20 Nov 14:02.",
         steps=[("done", "Identity verified", "Last confirmed 20 Nov"), ("done", "Payout account verified", "Last confirmed 20 Nov")],
         cta=f'<span class="btn sec">{i("refresh","sm")}Try again</span>',
         home=None, hub="Ready (last checked 20 Nov)", badge=0),
    dict(key="unavailable-none", label="Status unavailable", pill="gray",
         msg="We can't check your payout status right now. Please try again in a moment.",
         steps=[("off", "Payout status unavailable", "No confirmed status to show yet")],
         cta=f'<span class="btn sec">{i("refresh","sm")}Try again</span>',
         home=None, hub="Status unavailable", badge=0),
]
ICON = {"done": "check", "wait": "clock", "todo": "plus", "bad": "alert", "off": "globe-off"}


def receive_card(s):
    steps = "".join(
        f'<div class="step"><span class="sd {k}">{i(ICON[k],"sm")}</span><div class="st"><b>{t}</b><span>{d}</span></div></div>'
        for k, t, d in s["steps"])
    return f"""<div class="card"><div class="card-head"><h2>Receive payments</h2>{pill(s["pill"], s["label"])}</div>
<p style="color:#344054;margin-bottom:12px">{s["msg"]}</p><div class="steps">{steps}</div>
<div style="margin-top:14px;display:flex;gap:8px">{s["cta"]}</div></div>"""


def earnings_page(s, mobile=False):
    summary = f"""<div class="{'m-stats' if mobile else 'stats'}">{stat("wallet","Available","$0")}{stat("clock","In escrow","$1,200","Spring Launch Reel")}{stat("check","Paid out","$2,450","All time")}{stat("file-text","This month","$0")}</div>"""
    return f"""<div class="ph"><h1>Earnings &amp; Payouts</h1><p>What you've earned and where it's paid.</p></div>
{summary}{receive_card(s)}"""


def mini(s):
    h = s["home"]
    home = banner(*h) if h else '<div class="hint" style="background:#fff;border:1px dashed var(--line);text-align:center">No payout message on home</div>'
    nb = f'<span class="nb">{s["badge"]}</span>' if s["badge"] else ""
    return f"""<div class="mini"><div class="mini-cap">{s["label"]}</div>
{receive_card(s)}
<div class="mini-cap">Home</div>{home}
<div class="mini-cap">Hub · sidebar</div>
<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span style="font-size:13px;font-weight:600">Payment readiness</span>{pill(s["pill"], s["hub"])}</div>
<nav class="nav" style="padding:0;background:#fff;border:1px solid var(--line);border-radius:14px"><a style="margin:4px">{i("wallet")}<span>Earnings &amp; Payouts</span>{nb}</a></nav></div>"""


def build():
    by = {s["key"]: s for s in STATES}
    rows = "".join(
        f'<tr><td><b>{s["label"]}</b></td><td>{s["msg"]}</td><td>{txt(s["cta"])}</td>'
        f'<td>{"“"+s["home"][2]+"”" if s["home"] else "None"}</td><td>{s["hub"]}</td><td>{s["badge"] or "0"}</td></tr>' for s in STATES)
    body = f"""<div class="row">
{frame("Desktop · 1280 · Verification pending", app("inf","earn",{"collab":1},3,'<div class="stack">'+earnings_page(by["pending"])+'</div>'))}
{frame("Mobile · 390 · Action required", phone("inf","earn",{"collab":1,"earn":1},3,earnings_page(by["restricted"],True),tall=True))}
<div>
{notes("Readiness rules (finding 3)",[
 "<b>Ready</b> requires identity verified <b>and</b> the payout provider confirming payouts are enabled for the account. A saved bank account alone (<code>accountOnFile</code>) is not Ready.",
 "<b>Verification pending</b>: everything the user can do is done. Completed steps show as done. No “Complete setup” or “Continue” asks. Home shows a calm notice with no CTA, and the Earnings badge is 0.",
 "<b>Action required</b> names the one outstanding item and links straight to it. Steps already done stay done.",
 "<b>Unsupported</b>: no setup CTA, because there is nothing the user can do. Badge 0.",
 "<b>Temporarily unavailable</b> (provider unreachable): show the last confirmed state with its timestamp and Try again. Never fall back to Setup required, and never raise the badge.",
 "<b>No confirmed history</b> + unreachable: show “Status unavailable”. Never infer Ready or Setup required. No home message, badge 0.",
 "Copy makes no timing or email promises. Add them only when the provider gives a timing and a notification flow is implemented.",
 "Earnings badge = 1 only for Setup required and Action required, and only while the user has active collaborations or unpaid earnings.",
])}
</div></div>
<div class="section-title">All six states (+ unavailable with no history) · Earnings · Home · Hub · Sidebar</div>
<div class="grid-3">{"".join(mini(s) for s in STATES)}</div>
<div class="section-title">State table (also in master-spec §2)</div>
<table class="spec-table"><thead><tr><th>State</th><th>Message</th><th>Primary CTA</th><th>Home</th><th>Hub label</th><th>Earnings badge</th></tr></thead><tbody>{rows}</tbody></table>"""
    page("earnings-payout.html","Payout readiness","Package 1 · Influencer","Payout readiness — six states",
         "One readiness value drives Earnings, home, the hub card and the sidebar badge. Each state has its own message and CTA. Pending never re-asks finished steps.",
         ["F3 payout states","F2 customer copy","F6 typography","INV-DC-002","INV-C-014","INV-N-004"], body)
