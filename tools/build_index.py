#!/usr/bin/env python3
"""Write index.json: every firmware image in the releases of the source repository.

    python3 tools/build_index.py [owner/repo] > index.json

The page reads this file instead of GitHub's API, so a visitor makes one request to
this site and is never rate limited. GITHUB_TOKEN, when set, raises the API limit for
this script; the releases are public either way.

The latest full release gets "hosted": "fw/<tag>/", where the site serves its ESP32 images.

Image names: <board>-<mcu>-v<x.y.z>-lou-<nn>-<features>-<hash>[-merged].<ext>, and the
older -ar-<nn>-<hash> names, which carried every feature.
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

REPO = sys.argv[1] if len(sys.argv) > 1 else "sweden-mesh/MeshCore-lou"
NAME = re.compile(
    r"^(?P<board>.+?)-(?P<mcu>esp32s3|esp32c6|esp32c3|esp32|nrf52840|rp2040|stm32\w*)"
    r"-v(?P<base_version>\d+\.\d+\.\d+)-(?:lou-(?P<rev>\d+)-(?P<features>[a-z]+)|ar-(?P<old_rev>\d+))"
    r"-[0-9a-f]+(?P<merged>-merged)?\.(?P<ext>bin|uf2|zip|hex)$")


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def image(asset):
    m = NAME.match(asset["name"])
    if not m:
        return None
    board = m["board"]
    form = "merged" if m["merged"] else m["ext"]
    return {
        "board": board,
        "hw": re.sub(r"_repeater(_observer_mqtt)?$", "", board),
        "type": "repeater",
        "base": "observer" if board.endswith("_observer_mqtt") else "core",
        "features": m["features"] or "arrc",
        "mcu": m["mcu"],
        "form": form,
        "file": asset["name"],
        "url": asset["browser_download_url"],
        "size": asset["size"],
        "sha256": (asset.get("digest") or "").removeprefix("sha256:"),
    }


def main():
    releases = []
    page = 1
    while True:
        batch = get(f"https://api.github.com/repos/{REPO}/releases?per_page=50&page={page}")
        if not batch:
            break
        for r in batch:
            if r["draft"]:
                continue
            images = [i for i in map(image, r["assets"]) if i]
            if images:
                releases.append({
                    "tag": r["tag_name"],
                    "prerelease": r["prerelease"],
                    "published": r["published_at"],
                    "url": r["html_url"],
                    "images": sorted(images, key=lambda i: (i["board"], i["features"], i["form"])),
                })
        page += 1
    releases.sort(key=lambda r: r["published"] or "", reverse=True)
    # The site hosts the ESP32 images of one release, the latest full one, next to the page
    # (deploy.yml); the page offers to flash only the images of the release marked here.
    hosted = next((r for r in releases if not r["prerelease"]), None)
    if hosted:
        hosted["hosted"] = f"fw/{hosted['tag']}/"
    json.dump({
        "repo": REPO,
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "releases": releases,
    }, sys.stdout, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
