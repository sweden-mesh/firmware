// Checks the flasher's pure parts against a real merged image:
//   node tools/test_flasher.mjs <a -merged.bin of the hosted release>
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chipName, parsePartitions, updatePlan, mergedNeeds, sha256} from '../flasher.js';

const merged = new Uint8Array(readFileSync(process.argv[2]));
const table = merged.subarray(0x8000, 0x8000 + 0xc00);

assert.equal(chipName('esp32'), 'ESP32');
assert.equal(chipName('esp32s3'), 'ESP32-S3');
assert.equal(chipName('esp32c3'), 'ESP32-C3');
assert.equal(chipName('esp32c6'), 'ESP32-C6');
assert.equal(chipName('nrf52840'), null);

const parts = parsePartitions(table);
assert.deepEqual(parts.map(p => p.label), ['nvs', 'otadata', 'app0', 'app1', 'spiffs', 'coredump']);
assert.deepEqual(updatePlan(parts, 1_600_000), {otadata: {offset: 0xe000, size: 0x2000}});

// Refusals: no table, no app at 0x10000, an image larger than the slot.
assert.throws(() => updatePlan([], 1), /ingen partitionstabell/);
assert.throws(() => updatePlan(parts.filter(p => p.label !== 'app0'), 1), /ingen programplats/);
assert.throws(() => updatePlan(parts, 0x640001), /får inte plats/);
// A table with a factory app and no otadata: write, nothing to erase.
assert.deepEqual(updatePlan([{type: 0, subtype: 0, offset: 0x10000, size: 0x300000}], 1), {otadata: null});
// An erased table (all 0xFF) has no entries.
assert.equal(parsePartitions(new Uint8Array(0xc00).fill(0xff)).length, 0);

assert.equal(mergedNeeds(merged), 16 * 1048576);
assert.equal((await sha256(new TextEncoder().encode('abc'))).slice(0, 16), 'ba7816bf8f01cfea');
console.log('flasher: all checks pass');
