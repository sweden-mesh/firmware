# firmware

One static page that leads to the right MeshCore firmware image from
[sweden-mesh/MeshCore-lou](https://github.com/sweden-mesh/MeshCore-lou/releases): type of node,
then features (Observer, auto-reply, remote control, later auto-scope), new install or update,
then the board. The answer is one file and how to flash it.

- `index.html` — the page. No build step, no framework.
- `index.json` — every image in the releases: board, base (stock or Observer), features, chip,
  file, size, sha256 and download URL. The page reads only this file, so a visitor makes one
  request to this site and is never rate limited by GitHub's API.
- `tools/build_index.py` — writes `index.json` from the releases.
- `.github/workflows/index.yml` — runs it hourly and on demand, and commits `index.json` when
  the releases changed. A new release shows up within the hour; run the workflow to see it now.

The binaries stay in the releases and are downloaded from there. The page cannot flash a board
itself: GitHub's release downloads cannot be read by another site's page.

Choices with no image of ours lead onward: no features to MeshCore's web flasher, the Observer
alone to agessaman's Observer firmware.

The choice lives in the URL, so a link can be shared: `#f=obs,ar,rc&install=new&hw=heltec_v4`.

## Hosting

GitHub Pages: Settings → Pages → Deploy from a branch → `main`, `/ (root)`.
The page is then at https://sweden-mesh.github.io/firmware/.

## Locally

```
python3 tools/build_index.py > index.json
python3 -m http.server
```
