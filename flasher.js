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
// 0x10000, and erase otadata if there is one. Throws when it may not, in the words of t(key, vars).
export function updatePlan(parts, size, t){
  if (!parts.length)
    throw new Error(t('fl.notable'));
  const app = parts.find(p => p.type === 0 && p.offset === APP0);
  if (!app)
    throw new Error(t('fl.noapp'));
  if (size > app.size)
    throw new Error(t('fl.toobig', {size, app: app.size}));
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

async function fetchImage(url, expected, onStep, t){
  onStep(t('fl.fetch'));
  const r = await fetch(url, {cache: 'no-cache'});
  if (!r.ok) throw new Error(t('fl.fetch.fail', {status: r.status}));
  const bytes = new Uint8Array(await r.arrayBuffer());
  onStep(t('fl.check'));
  if (await sha256(bytes) !== expected) throw new Error(t('fl.sha'));
  return bytes;
}

// Flashes `img` (a row of index.json) from `url`. `fresh` is a new install. `port` comes
// from navigator.serial.requestPort(), which must be called from the click itself.
// onStep(text), onProgress(fraction), onLog(line); t(key, vars) gives the page's text for a key.
export async function flash({port, img, url, fresh, onStep, onProgress, onLog, t}){
  const {ESPLoader, Transport} = await import(ESPTOOL);
  const want = chipName(img.mcu);
  const image = await fetchImage(url, img.sha256, onStep, t);
  const terminal = {clean(){}, writeLine: l => onLog(l), write: l => onLog(l)};
  const transport = new Transport(port, false);
  try {
    onStep(t('fl.connect'));
    const loader = new ESPLoader({transport, baudrate: BAUD, terminal});
    try {
      await loader.main();
    } catch (e){
      throw new Error(t('fl.noanswer'));
    }
    const have = loader.chip.CHIP_NAME;
    if (have !== want) throw new Error(t('fl.chip', {have, want}));

    let files;
    if (fresh){
      const size = await loader.detectFlashSize();
      const bytes = size ? loader.flashSizeBytes(size) : 0;
      const needs = mergedNeeds(image);
      if (bytes && needs > bytes)
        throw new Error(t('fl.size', {needs: needs / 1048576, has: bytes / 1048576}));
      files = [{data: image, address: 0}];
    } else {
      onStep(t('fl.table'));
      const plan = updatePlan(parsePartitions(await loader.readFlash(TABLE, TABLE_SIZE)), image.length, t);
      files = [{data: image, address: APP0}];
      if (plan.otadata) files.push({data: new Uint8Array(plan.otadata.size).fill(0xff), address: plan.otadata.offset});
    }

    onStep(t(fresh ? 'fl.erasewrite' : 'fl.write'));
    const total = files.reduce((n, f) => n + f.data.length, 0);
    const before = files.map((f, i) => files.slice(0, i).reduce((n, g) => n + g.data.length, 0));
    await loader.writeFlash({
      fileArray: files, flashMode: 'keep', flashFreq: 'keep', flashSize: 'keep',
      eraseAll: fresh, compress: true,
      reportProgress: (i, written, size) => onProgress((before[i] + written / size * files[i].data.length) / total),
    });
    onProgress(1);
    onStep(t('fl.restart'));
    await loader.after('hard_reset');
  } finally {
    await release(transport, port, onLog);
  }
}

// Lets go of the serial port, so another program can open it without the page being reloaded.
// The library's disconnect can hang after the reset (a stream stays locked), so each step has a
// time limit and says in the log how it went: close the reader, close the port, and if the port
// will not close, give it up (which closes it; the browser then asks for the port again next time).
async function release(transport, port, onLog){
  const wait = (ms, v) => new Promise(r => setTimeout(() => r(v), ms));
  const step = async (name, run, ms) => {
    try {
      const r = await Promise.race([run().then(() => 'ok'), wait(ms, 'timeout')]);
      onLog(`port: ${name} ${r}`);
      return r === 'ok';
    } catch (e){
      onLog(`port: ${name} ${e.name || 'error'}: ${e.message || e}`);
      return e.name === 'InvalidStateError';   // already closed
    }
  };
  const state = () => `readable ${port.readable ? (port.readable.locked ? 'locked' : 'open') : 'none'}, writable ${port.writable ? (port.writable.locked ? 'locked' : 'open') : 'none'}`;
  onLog('port: ' + state());
  // The page asks for the port at every flash, so giving it up afterwards costs the visitor nothing.
  const forget = () => port.forget ? step('forget', () => port.forget(), 2000) : null;
  if (await step('disconnect', () => transport.disconnect(), 3000)) return forget();
  if (port.readable && port.readable.locked && transport.reader)
    await step('reader cancel', () => transport.reader.cancel(), 1000);
  await wait(200);
  onLog('port: ' + state());
  await step('close', () => port.close(), 2000);
  await forget();
}
