# firmware-picker

One static page that finds the right repeater image in the
[MeshCore-observer releases](https://github.com/the-louie/MeshCore-observer/releases): pick a
release and a board, tick "clear flash" for a fresh install, and it lists one file per flavour.

It reads the release list from GitHub's API in the browser (no build step, no server), so a new
release appears without touching this repository. Image names are parsed as
`<board>-<mcu>-v<x.y.z>-lou-<nn>-<features>-<hash>[-merged].<ext>`; the pre-split
`-ar-<nn>-<hash>` names count as every feature.

- Another repository: `index.html?repo=owner/name`.
- A link to one board: the page keeps release, board and clear flash in the URL (`#r=…&hw=…&clear=1`).
- Unauthenticated API use is limited to 60 requests an hour per visitor's IP; the page makes one.

## Hosting

GitHub Pages: push this repository, then Settings → Pages → Deploy from a branch → `main`, `/ (root)`.
Any static host works the same way; it is one HTML file.
