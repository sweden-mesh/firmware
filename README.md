# firmware

One static page, in Swedish, that leads to the right MeshCore firmware image from
[sweden-mesh/MeshCore-lou](https://github.com/sweden-mesh/MeshCore-lou/releases): type of node,
then features (Observer, auto-reply, remote control, later auto-scope), install or clear flash,
then the board. The answer is one file and how to flash it.

- `index.html` — the page. No build step, no framework.
- `index.json` — every image in the releases: board, base (stock or Observer), features, chip,
  file, size, sha256 and download URL. The latest full release is marked `hosted`. The page
  reads only this file, so a visitor makes one request to this site and is never rate limited
  by GitHub's API.
- `flasher.js` — flashes an ESP32 board from the page over Web Serial (Chrome, Edge), with
  `vendor/esptool-js-0.7.0/` (see its README).
- `tools/build_index.py` — writes `index.json` from the releases.
- `tools/host_images.py` — copies the hosted release's ESP32 images into the site, each checked
  against its sha256.
- `tools/test_flasher.mjs` — checks the flasher's chip, partition-table and checksum logic:
  `node tools/test_flasher.mjs <a -merged.bin>`.
- `.github/workflows/index.yml` — runs `build_index.py` hourly and on demand, commits
  `index.json` when the releases changed, and then publishes the site. A new release shows up
  within the hour; run the workflow to see it now.
- `.github/workflows/deploy.yml` — publishes the site (below), on every push to `main`.

## Flashing from the page

For ESP32 images of the hosted release the result has a **Flasha via USB** button. It checks
that the board's chip matches the image and that the file matches its sha256, then:

- **Uppdatera:** reads the board's partition table, requires an app slot at `0x10000` that the
  image fits, writes the image there and erases `otadata`. A node once updated over Wi-Fi boots
  its second slot, and would otherwise never start the new image. Settings stay.
- **Ny installation:** checks the board has the flash the image needs, erases all of it and
  writes the merged image at `0x0`.

Until it has been tested on real boards the button shows only with `?flasha` in the address:
https://sweden-mesh.github.io/firmware/?flasha. Other chips and browsers get the download link
and written steps, as do older releases.

After the file, step 5 writes the console commands for the features chosen: the county's
region and `set autoreply on` for auto-reply, and the command key for remote control. The
region comes from [zombiefredrik/meshcore-se-regioner](https://github.com/zombiefredrik/meshcore-se-regioner):
the name the county decided (`lokalt`), else the name measured in use (`uppmatt`), else the
list's proposal (`forslag`); the SCB code only if the list cannot be read.

Choices with no image of ours lead onward: no features to MeshCore's web flasher, the Observer
alone to agessaman's Observer firmware.

The choice lives in the URL, so a link can be shared: `#f=obs,ar,rc&install=new&hw=heltec_v4`.

## Hosting

GitHub Pages, source "GitHub Actions" (Settings → Pages). `deploy.yml` builds the site from the
page, `index.json`, `flasher.js`, `vendor/` and the hosted release's ESP32 images, `.bin` and
`-merged.bin` under `fw/<tag>/` (284 files, 449 MB at lou-15). GitHub's release downloads
cannot be read by another site's page, so the page can only flash images served from here.
The images go into the Pages artifact, never into git, and are cached by tag, so they are
downloaded again only for a new release.

Limits: a Pages site may be 1 GB, so one release is hosted at a time; about 100 GB of traffic a
month, some 60 000 flashes. The page is at https://sweden-mesh.github.io/firmware/.

## Locally

```
python3 tools/build_index.py > index.json
python3 -m http.server
```

Locally the hosted images are missing, so the button fails at "Hämtar filen" unless a copy of
`fw/<tag>/` is put next to the page.
