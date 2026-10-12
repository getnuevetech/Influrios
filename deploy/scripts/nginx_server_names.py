#!/usr/bin/env python3
"""Add inflr.me to nginx server_name lines that already name influrios.com.

Certbot saves the certificate first, then installs it only into a server
block whose server_name lists every requested host. A live file that still
says `server_name influrios.com www.influrios.com;` fails with:

    Could not automatically find a matching server block for inflr.me.

This edits those directives in place. ssl_certificate lines and Certbot
redirect blocks stay as they are.
"""

from __future__ import annotations

import re
import sys

SHORT_LINK_NAMES = ("inflr.me", "www.inflr.me")
ANCHOR = "influrios.com"


def with_short_link_names(text: str) -> str:
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    i = 0
    while i < len(lines):
        code = lines[i].split("#", 1)[0]
        if re.match(r"\s*server_name\b", code):
            block = [lines[i]]
            while ";" not in block[-1].split("#", 1)[0] and i + 1 < len(lines):
                i += 1
                block.append(lines[i])
            out.append(_patch_block(block))
        else:
            out.append(lines[i])
        i += 1
    return "".join(out)


def _patch_block(lines: list[str]) -> str:
    hosts = re.findall(r"[A-Za-z0-9._-]+", "\n".join(line.split("#", 1)[0] for line in lines))
    hosts = [name for name in hosts if name != "server_name"]
    if ANCHOR not in hosts:
        return "".join(lines)
    missing = [name for name in SHORT_LINK_NAMES if name not in hosts]
    if not missing:
        return "".join(lines)
    addition = " " + " ".join(missing)
    updated = list(lines)
    last = updated[-1]
    code, separator, comment = last.partition("#")
    if ";" not in code:
        return "".join(lines)
    code = code.replace(";", addition + ";", 1)
    updated[-1] = code + (separator + comment if separator else "")
    return "".join(updated)


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: nginx_server_names.py <nginx-site>", file=sys.stderr)
        sys.exit(2)
    path = sys.argv[1]
    if path == "-":
        sys.stdout.write(with_short_link_names(sys.stdin.read()))
        return
    with open(path, encoding="utf-8") as handle:
        sys.stdout.write(with_short_link_names(handle.read()))


if __name__ == "__main__":
    main()
