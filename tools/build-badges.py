#!/usr/bin/env python3
"""Generate the README's badges as local SVG files.

The whole point of this repository is that it makes no third-party requests, so
pulling eight images off a badge CDN at the top of the README was a poor look —
it is also a dependency on a service that can change, rate-limit or disappear,
taking the top of the page with it.

These are drawn here instead: flat-square, two-tone, sized from the text. No
network, no build step, nothing to rotate. Re-run after editing BADGES.

    python3 tools/build-badges.py
"""

import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / ".github" / "badges"

# Verdana at 11px is what the usual badge services measure against, and these
# widths are what keep the two halves from crowding the text.
CHAR_W = 6.6
PAD = 10

# Darker than the usual badge palette on purpose. The familiar #4c1 green and
# #fe7d37 orange carry white text at about 2.1:1 and 2.6:1 — nowhere near the
# 4.5:1 that WCAG 1.4.3 wants for 11px text. A README that spends a section
# boasting about contrast should not open with eight examples of failing it.
# Same hues, enough darker to be legible. Enforced by check() below.
COLOURS = {
    "grey": "#555555",
    "green": "#2e7d32",
    "blue": "#0366d6",
    "orange": "#b35309",
    "purple": "#8a2be2",
    "lightgrey": "#6a737d",
    "cyan": "#1a7f8e",
}

# (filename, left label, right message, right colour)
BADGES = [
    ("build-step.svg", "build step", "none whatsoever", "green"),
    ("runtime-deps.svg", "runtime deps", "0", "blue"),
    ("first-load.svg", "first load", "306KB", "orange"),
    ("checks.svg", "checks", "211 steps across 3 viewports", "green"),
    ("axe.svg", "axe violations", "0", "green"),
    ("wcag.svg", "WCAG", "2.2 AA", "purple"),
    ("best-viewed.svg", "best viewed in", "any browser, actually", "lightgrey"),
    ("y2k.svg", "Y2K", "compliant", "cyan"),
]

TEMPLATE = '''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="20" role="img" aria-label="{label}: {msg}">
  <title>{label}: {msg}</title>
  <g shape-rendering="crispEdges">
    <rect width="{lw}" height="20" fill="{lc}"/>
    <rect x="{lw}" width="{rw}" height="20" fill="{rc}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="{lx}" y="14">{label}</text>
    <text x="{rx}" y="14">{msg}</text>
  </g>
</svg>
'''


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def build(label, msg, colour):
    lw = round(len(label) * CHAR_W) + PAD * 2
    rw = round(len(msg) * CHAR_W) + PAD * 2
    return TEMPLATE.format(
        w=lw + rw, lw=lw, rw=rw,
        lc=COLOURS["grey"], rc=COLOURS[colour],
        lx=lw / 2, rx=lw + rw / 2,
        label=esc(label), msg=esc(msg),
    )


def luminance(hex_colour):
    """Relative luminance per WCAG 2.x."""
    h = hex_colour.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    out = []
    for i in (0, 2, 4):
        v = int(h[i:i + 2], 16) / 255
        out.append(v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4)
    r, g, b = out
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def check():
    """Every badge colour must carry white text at 4.5:1 or better.

    The text is 11px, which WCAG counts as normal-size, so 4.5:1 applies — not
    the 3:1 large-text allowance. Refusing to emit is the point: a badge nobody
    can read is worse than no badge, and this is exactly the kind of thing that
    rots silently when someone adds a colour later.
    """
    failed = []
    for name in sorted(COLOURS):
        ratio = contrast("#ffffff", COLOURS[name])
        mark = "ok " if ratio >= 4.5 else "FAIL"
        print(f"  {mark}  white on {COLOURS[name]} ({name}): {ratio:.2f}:1")
        if ratio < 4.5:
            failed.append(f"{name} ({COLOURS[name]}) is {ratio:.2f}:1")
    if failed:
        raise SystemExit(
            "Refusing to write badges — white text fails WCAG 1.4.3 on:\n  "
            + "\n  ".join(failed)
        )


def main():
    print("contrast of white text on each badge colour:")
    check()
    print()
    OUT.mkdir(parents=True, exist_ok=True)
    for name, label, msg, colour in BADGES:
        (OUT / name).write_text(build(label, msg, colour), encoding="utf-8")
        print(f"ok   .github/badges/{name}  {label}: {msg}")
    print(f"\n{len(BADGES)} badges written to {OUT}")


if __name__ == "__main__":
    main()
