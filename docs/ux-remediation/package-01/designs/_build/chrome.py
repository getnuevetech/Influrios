"""Shared chrome for Package 1 boards. Mirrors src/components/account-shell.tsx.

Everything rendered by app()/phone() is customer-facing UI only.
Engineering explanations go in notes() which renders OUTSIDE the frame.
"""
import html
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SPRITE = open(os.path.join(HERE, "..", "assets", "icons.svg")).read()


def i(name, cls=""):
    return f'<svg class="ico {cls}" aria-hidden="true"><use href="#i-{name}"/></svg>'


# Navigation exactly as account-shell.tsx, with Package 1 terminology fix
# ("Discover Creators" -> "Discover Influencers").
INF_NAV = [
    ("dash", "Dashboard", "home"),
    ("inbox", "Action inbox", "bell"),
    ("profile", "My Profile", "user"),
    ("collab", "Collaborations", "handshake"),
    ("contracts", "Contracts", "file-text"),
    ("earn", "Earnings & Payouts", "wallet"),
    ("msg", "Messages", "mail"),
    ("settings", "Settings", "settings"),
]
BIZ_NAV = [
    ("dash", "Dashboard", "home"),
    ("inbox", "Action inbox", "bell"),
    ("company", "Company Profile", "building"),
    ("discover", "Discover Influencers", "search"),
    ("collab", "Collaborations", "handshake"),
    ("contracts", "Contracts", "file-text"),
    ("analytics", "Analytics", "intelligence"),
    ("team", "Team", "users"),
    ("billing", "Billing & Plans", "id-card"),
    ("payments", "Collaboration Payments", "shield-pay"),
    ("verify", "Verification", "id-card"),
    ("settings", "Settings", "settings"),
]
WHO = {
    "inf": ("Amara Cole", "Influencer", "A", "Search opportunities, brands, or anything..."),
    "biz": ("Dana Reyes", "Northwind Studio", "D", "Search influencers, campaigns, or anything..."),
}


def nav_links(role, active, badges):
    items = INF_NAV if role == "inf" else BIZ_NAV
    out = []
    for key, label, icon in items:
        b = badges.get(key)
        nb = f'<span class="nb">{b}</span>' if b else ""
        on = ' class="on"' if key == active else ""
        out.append(f'<a{on}>{i(icon)}<span>{html.escape(label)}</span>{nb}</a>')
    return "".join(out)


def sidebar(role, active, badges):
    foot = '<span>Plus</span><span>Billing &amp; Plan</span>' if role == "inf" else '<span>Business Pro</span><span>Manage plan</span>'
    return (
        f'<aside class="side"><div class="wordmark"><span class="mark">∞</span>Influrios</div>'
        f'<nav class="nav">{nav_links(role, active, badges)}</nav>'
        f'<div class="side-foot">{foot}</div></aside>'
    )


def topbar(role, bell):
    name, sub, ini, ph = WHO[role]
    cnt = f'<span class="cnt">{bell}</span>' if bell else ""
    return (
        f'<div class="top"><div class="searchbox">{i("search")}<span>{ph}</span></div><div class="grow"></div>'
        f'<span class="iconbtn" aria-label="Notifications, {bell or 0} unread">{i("bell")}{cnt}</span>'
        f'<div class="who"><span class="ava">{ini}</span><div><b>{name}</b><span>{sub}</span></div></div>'
        f'<span class="iconbtn">{i("logout")}</span></div>'
    )


def app(role, active, badges, bell, content, overlay="", tall=False, fid="desktop"):
    cls = "app tall" if tall else "app"
    return (
        f'<div class="{cls}" id="{fid}">{sidebar(role, active, badges)}'
        f'<div class="main">{topbar(role, bell)}<div class="content">{content}</div></div>{overlay}</div>'
    )


M_CHIPS = {
    "inf": [("dash", "Dashboard"), ("collab", "Collaborations"), ("earn", "Earnings")],
    "biz": [("dash", "Dashboard"), ("collab", "Collaborations"), ("contracts", "Contracts")],
}


def phone(role, active, badges, bell, content, overlay="", tall=False, fid="mobile"):
    cnt = f'<span class="cnt">{bell}</span>' if bell else ""
    chips = []
    for key, label in M_CHIPS[role]:
        b = badges.get(key)
        nb = f'<span class="nb">{b}</span>' if b else ""
        on = " on" if key == active else ""
        chips.append(f'<span class="m-chip{on}">{label}{nb}</span>')
    hidden = sum(v for k, v in badges.items() if k not in dict(M_CHIPS[role]))
    more_b = f'<span class="nb">{hidden}</span>' if hidden else ""
    chips.append(f'<span class="m-chip">{i("menu", "sm")}More{more_b}</span>')
    cls = "phone tall" if tall else "phone"
    return (
        f'<div class="{cls}" id="{fid}"><div class="m-top"><div class="wordmark"><span class="mark">∞</span>Influrios</div>'
        f'<div class="grow"></div><span class="iconbtn" aria-label="Notifications, {bell or 0} unread">{i("bell")}{cnt}</span>'
        f'<span class="ava" style="width:36px;height:36px">{WHO[role][2]}</span></div>'
        f'<div class="m-chips">{"".join(chips)}</div><div class="m-content">{content}</div>{overlay}</div>'
    )


def frame(cap, inner):
    return f'<div class="frame-wrap"><div class="frame-cap">{cap}</div>{inner}</div>'


def notes(title, items):
    lis = "".join(f"<li>{x}</li>" for x in items)
    return f'<div class="notes"><h3>{title}</h3><ol>{lis}</ol></div>'


def page(fname, title, eyebrow, h1, lead, findings, body):
    tags = "".join(f'<span class="finding">{f}</span>' for f in findings)
    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title><link rel="stylesheet" href="_design-system.css"></head>
<body>{SPRITE}
<div class="board"><header class="board-head"><div class="eyebrow">{eyebrow}</div><h1>{h1}</h1><p>{lead}</p><div class="findings">{tags}</div></header>
{body}
</div></body></html>
"""
    with open(os.path.join(HERE, "..", fname), "w") as fh:
        fh.write(doc)


# ---------- reusable customer UI fragments ----------
def stat(icon, k, v, s=""):
    sub = f'<div class="s">{s}</div>' if s else ""
    return f'<div class="stat"><div class="si">{i(icon, "sm")}</div><div class="k">{k}</div><div class="v">{v}</div>{sub}</div>'


def banner(kind, icon, title, sub, cta=""):
    return f'<div class="banner {kind}"><span class="bi">{i(icon)}</span><div class="bt"><b>{title}</b><span>{sub}</span></div>{cta}</div>'


def pill(kind, text):
    return f'<span class="pill {kind}">{text}</span>'


def dialog(title, sub, body, foot, size=""):
    return (
        f'<div class="scrim"><div class="dialog {size}"><div class="dlg-head"><div><h2>{title}</h2><p>{sub}</p></div>'
        f'<span class="dlg-x">{i("close", "sm")}</span></div><div class="dlg-body">{body}</div>'
        f'<div class="dlg-foot">{foot}</div></div></div>'
    )


def sheet(title, sub, body, foot):
    return (
        f'<div class="sheet"><div class="sheet-head"><div><h2>{title}</h2><p style="color:var(--muted);font-size:13px;margin-top:2px">{sub}</p></div>'
        f'<span class="dlg-x">{i("close", "sm")}</span></div><div class="sheet-body">{body}</div><div class="sheet-foot">{foot}</div></div>'
    )


def card_img(width):
    return f'<div style="width:{width}px"><img class="ocard" src="assets/influencer-card-original.png" alt="Amara Cole influencer card"></div>'
