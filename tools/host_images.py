#!/usr/bin/env python3
"""Copy a release's ESP32 images and nRF52 DFU packages into the site, each checked against
index.json, and write fw/hosted.json for the regional sites' flashers.

    python3 tools/host_images.py index.json <tag> <downloaded dir> <site dir>

Every ESP32 image and nRF52 .zip index.json lists for <tag> must be in <downloaded dir> with
the sha256 GitHub reported for it; the first missing or different file stops the build, so the
site never serves an image the page would refuse. They land in <site dir>/fw/<tag>/.

<site dir>/fw/hosted.json is what a regional site's flasher reads: the hosted tag, the folder,
and one row per image (hw, base, features, mcu, form, file, size, sha256), without the
GitHub URLs, which a page cannot read anyway.
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def hosted(image):
    """ESP32 app and merged images, and nRF52 DFU packages (serial DFU needs the .zip)."""
    return image["mcu"].startswith("esp32") or (image["mcu"].startswith("nrf52") and image["form"] == "zip")


ROW = ("hw", "board", "base", "features", "mcu", "form", "file", "size", "sha256")


def main():
    index_path, tag, src, site = sys.argv[1:5]
    index = json.load(open(index_path))
    release = next(r for r in index["releases"] if r["tag"] == tag)
    images = [i for i in release["images"] if hosted(i)]
    if not images:
        sys.exit(f"{tag}: no ESP32 images in index.json")
    dest = Path(site) / "fw" / tag
    dest.mkdir(parents=True, exist_ok=True)
    total = 0
    for image in images:
        path = Path(src) / image["file"]
        if not path.is_file():
            sys.exit(f"missing: {image['file']}")
        if not image["sha256"]:
            sys.exit(f"no sha256 in index.json: {image['file']}")
        if sha256(path) != image["sha256"]:
            sys.exit(f"sha256 differs: {image['file']}")
        shutil.copyfile(path, dest / image["file"])
        total += image["size"]
    with open(Path(site) / "fw" / "hosted.json", "w") as f:
        json.dump({
            "repo": index["repo"],
            "tag": tag,
            "base": f"fw/{tag}/",
            "images": [{k: i[k] for k in ROW} for i in images],
        }, f, separators=(",", ":"))
        f.write("\n")
    print(f"{tag}: {len(images)} images, {total / 1e6:.0f} MB, in {dest}")


if __name__ == "__main__":
    main()
