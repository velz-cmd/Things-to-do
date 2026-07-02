#!/usr/bin/env python3
"""Push key=value env file to a Vercel project (all targets)."""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"')
        if value and not value.startswith("PASTE_"):
            out[key] = value
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("env_file", nargs="?", default="vercel-import.env")
    parser.add_argument("--app-url", default="")
    args = parser.parse_args()

    env = load_env(Path(args.env_file))
    if args.app_url:
        env["APP_URL"] = args.app_url
        env["NEXT_PUBLIC_APP_URL"] = args.app_url

    ok = fail = 0
    for key, value in sorted(env.items()):
        for target in ("production", "preview", "development"):
            proc = subprocess.run(
                ["npx", "vercel@54", "env", "add", key, target, "--force", "--yes"],
                input=value.encode(),
                cwd=Path(__file__).resolve().parents[1],
                capture_output=True,
            )
            if proc.returncode == 0:
                ok += 1
            else:
                fail += 1
                err = proc.stderr.decode(errors="replace")[:120]
                print(f"FAIL {key} {target}: {err}", file=sys.stderr)
            time.sleep(0.04)

    print(f"Pushed {len(env)} keys — {ok} ok, {fail} failed")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
