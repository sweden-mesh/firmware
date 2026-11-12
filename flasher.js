// Flashes an ESP32 board from the page over Web Serial, with Espressif's esptool-js
// (vendored). Design: planning/firmware/web-flasher-design-20261111.md in the workspace.
//
// Update: the board's partition table must have an app at 0x10000; the image is written
// there and, when the table has otadata, otadata is erased, so the bootloader starts the
// image just written even on a node that was once updated over Wi-Fi and boots its second
// app slot. Settings (SPIFFS) and NVS are not touched.
// New install: the whole flash is erased and the merged image is written at 0x0.

const ESPTOOL = './vendor/esptool-js-0.7.0/bundle.js';
const APP0 = 0x10000;
const TABLE = 0x8000, TABLE_SIZE = 0xc00;
const BAUD = 460800;

// The name esptool-js reports for the chip an image is built for.
export function chipName(mcu){
  const m = /^esp32(s2|s3|c2|c3|c5|c6|h2)?$/.exec(mcu);
  if (!m) return null;
  return m[1] ? `ESP32-${m[1].toUpperCase()}` : 'ESP32';
}

// The partition table at 0x8000: 32-byte entries, magic 0xAA50, until the first other.
export function parsePartitions(bytes){
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts = [];
  for (let o = 0; o + 32 <= bytes.length; o += 32){
    if (view.getUint16(o, true) !== 0x50aa) break;
    const label = new TextDecoder().decode(bytes.subarray(o + 12, o + 28)).replace(/\0.*$/s, '');
    parts.push({type: bytes[o + 2], subtype: bytes[o + 3], offset: view.getUint32(o + 4, true),
                size: view.getUint32(o + 8, true), label});
  }
  return parts;
}

// What an update may do on a board with this table: write an image of `size` bytes at
// 0x10000, and erase otadata if there is one. Throws, in Swedish, when it may not.
export function updatePlan(parts, size){
  if (!parts.length)
    throw new Error('Kortet har ingen partitionstabell som går att läsa. Välj "Ny installation".');
  const app = parts.find(p => p.type === 0 && p.offset === APP0);
  if (!app)
    throw new Error('Kortet har ingen programplats på 0x10000: det kör något annat än MeshCore. Välj "Ny installation".');
  if (size > app.size)
    throw new Error(`Filen (${size} byte) får inte plats i kortets programplats (${app.size} byte). Välj "Ny installation".`);
  const ota = parts.find(p => p.type === 1 && p.subtype === 0);
  return {otadata: ota ? {offset: ota.offset, size: ota.size} : null};
}

// The flash a merged image needs: the end of its own partition table's last partition.
export function mergedNeeds(image){
  const parts = parsePartitions(image.subarray(TABLE, TABLE + TABLE_SIZE));
  return parts.reduce((end, p) => Math.max(end, p.offset + p.size), 0);
}

export async function sha256(bytes){
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('');
}

async function fetchImage(url, expected, onStep){
  onStep('Hämtar filen…');
  const r = await fetch(url, {cache: 'no-cache'});
  if (!r.ok) throw new Error(`Filen kunde inte hämtas (${r.status}).`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  onStep('Kontrollerar filen…');
  if (await sha256(bytes) !== expected) throw new Error('Filen stämmer inte med sin kontrollsumma. Inget har skrivits.');
  return bytes;
}

// Flashes `img` (a row of index.json) from `url`. `fresh` is a new install. `port` comes
// from navigator.serial.requestPort(), which must be called from the click itself.
// onStep(text), onProgress(fraction), onLog(line).
export async function flash({port, img, url, fresh, onStep, onProgress, onLog}){
  const {ESPLoader, Transport} = await import(ESPTOOL);
  const want = chipName(img.mcu);
  const image = await fetchImage(url, img.sha256, onStep);
  const terminal = {clean(){}, writeLine: l => onLog(l), write: l => onLog(l)};
  const transport = new Transport(port, false);
  try {
    onStep('Ansluter till kortet…');
    const loader = new ESPLoader({transport, baudrate: BAUD, terminal});
    try {
      await loader.main();
    } catch (e){
      throw new Error('Kortet svarar inte. Håll ned BOOT, tryck på RESET, släpp BOOT och försök igen.');
    }
    const have = loader.chip.CHIP_NAME;
    if (have !== want) throw new Error(`Kortet har en ${have}, filen är för en ${want}. Inget har skrivits. Kontrollera att du valt rätt hårdvara.`);

    let files;
    if (fresh){
      const size = await loader.detectFlashSize();
      const bytes = size ? loader.flashSizeBytes(size) : 0;
      const needs = mergedNeeds(image);
      if (bytes && needs > bytes)
        throw new Error(`Filen behöver ${needs / 1048576} MB flashminne, kortet har ${bytes / 1048576} MB. Inget har skrivits. Kontrollera att du valt rätt hårdvara.`);
      files = [{data: image, address: 0}];
    } else {
      onStep('Läser kortets partitionstabell…');
      const plan = updatePlan(parsePartitions(await loader.readFlash(TABLE, TABLE_SIZE)), image.length);
      files = [{data: image, address: APP0}];
      if (plan.otadata) files.push({data: new Uint8Array(plan.otadata.size).fill(0xff), address: plan.otadata.offset});
    }

    onStep(fresh ? 'Raderar flashminnet och skriver…' : 'Skriver…');
    const total = files.reduce((n, f) => n + f.data.length, 0);
    const before = files.map((f, i) => files.slice(0, i).reduce((n, g) => n + g.data.length, 0));
    await loader.writeFlash({
      fileArray: files, flashMode: 'keep', flashFreq: 'keep', flashSize: 'keep',
      eraseAll: fresh, compress: true,
      reportProgress: (i, written, size) => onProgress((before[i] + written / size * files[i].data.length) / total),
    });
    onProgress(1);
    onStep('Startar om kortet…');
    await loader.after('hard_reset');
  } finally {
    await transport.disconnect().catch(() => {});
  }
}
