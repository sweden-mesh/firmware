# esptool-js 0.7.0

Espressif's [esptool-js](https://github.com/espressif/esptool-js), the browser bundle
(`bundle.js`) of the npm package `esptool-js@0.7.0`, unchanged. The page loads it from here
rather than from a CDN, so no third party serves code to it. It is one ES module with no
network access of its own; it includes [pako](https://github.com/nodeca/pako) (MIT).

- npm tarball `esptool-js-0.7.0.tgz`, integrity
  `sha512-9wHuW/s9t4Vs6HKcr3pra3gbRVWwaN0eabMWodWH4KEJHEYZxgmWwZ3s0F4xcWVCZOc/L98bGZ4uWoZvR8KBKA==`
  (checked against the registry, 2026-11-11)
- `bundle.js` sha256 `00ebe6fb0b202976d3e2a3c6b9a6bd438c26a81d2af6739c95ac276a64c1a84e`
- Licence: Apache-2.0, `LICENSE`.

To upgrade: `npm pack esptool-js@<version>`, check its integrity against `npm view`, copy
`package/bundle.js` and `package/LICENSE` into a new `vendor/esptool-js-<version>/`, update
the import in `index.html`, and remove this directory.
