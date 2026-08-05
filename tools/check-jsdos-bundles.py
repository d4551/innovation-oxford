#!/usr/bin/env python3
"""Verify the shipped js-dos bundles actually start their game.

A bundle can be perfectly well-formed — correct `.jsdos/` metadata, every game
file present — and still boot to nothing but a DOS prompt, because the
`[autoexec]` block names a program that is not in the archive. That failure is
invisible from the outside: the emulator loads, a canvas appears at a real
video mode, and DOSBox sits at `C:\\>` printing "Illegal command".

This checks what the bundle will actually do:

    python3 tools/check-jsdos-bundles.py

Exits non-zero on the first bundle that would not start.
"""

import pathlib
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAMES_DIR = ROOT / "games"
REQUIRED = [".jsdos/dosbox.conf", ".jsdos/readme.txt", ".jsdos/jsdos.json"]


def autoexec_commands(conf: str) -> list[str]:
    """The commands under [autoexec], in order, comments and blanks dropped."""
    lines = conf.splitlines()
    try:
        start = next(i for i, line in enumerate(lines) if line.strip().lower() == "[autoexec]")
    except StopIteration:
        return []
    out = []
    for line in lines[start + 1:]:
        text = line.strip()
        if text.startswith("["):
            break
        if text and not text.startswith("#"):
            out.append(text)
    return out


def check(path: pathlib.Path) -> list[str]:
    problems = []
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())

        for required in REQUIRED:
            if required not in names:
                problems.append(f"missing {required}")
        # The extractor builds directories from explicit entries; without this
        # one the config never reaches the emulated filesystem and DOSBox exits
        # 101 before printing anything.
        if ".jsdos/" not in names:
            problems.append("missing the explicit .jsdos/ directory entry")
        if problems:
            return problems

        commands = autoexec_commands(z.read(".jsdos/dosbox.conf").decode("utf-8", "replace"))
        if not commands:
            return ["[autoexec] is empty — nothing would start"]

        # The last command is the one that starts the game; everything before
        # it mounts and changes drive.
        entry = commands[-1]
        lowered = {name.lower() for name in names}
        if entry.lower() not in lowered:
            listed = sorted(n for n in names if n.lower().endswith((".exe", ".com", ".bat")))
            problems.append(
                f"[autoexec] runs {entry}, which is not in the bundle "
                f"(it holds {', '.join(listed) or 'no executables at all'})"
            )
    return problems


def main() -> int:
    bundles = sorted(GAMES_DIR.glob("*.jsdos"))
    if not bundles:
        print(f"no bundles found in {GAMES_DIR}", file=sys.stderr)
        return 1

    failed = False
    for path in bundles:
        problems = check(path)
        name = path.relative_to(ROOT)
        if problems:
            failed = True
            for problem in problems:
                print(f"FAIL {name}: {problem}", file=sys.stderr)
        else:
            with zipfile.ZipFile(path) as z:
                entry = autoexec_commands(z.read(".jsdos/dosbox.conf").decode())[-1]
            print(f"ok   {name}: starts {entry}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
