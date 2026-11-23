// Which release each channel offers, and the channel in the address.
//   node --test tools/test_releases.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import '../releases.js';

const {offered, latestPrerelease, newestPrerelease, readChannel, withChannel} = globalThis;
const rel = (tag, published, more = {}) => ({tag, published, prerelease: false, images: [], ...more});
const pre = (tag, published) => rel(tag, published, {prerelease: true});
const tags = list => list.map(r => r.tag);

// A new pre-release above two full releases and an old pre-release, as index.json lists them.
const LIST = [
  pre('v1.18.0-lou-20rc2', '2026-11-25T10:00:00Z'),
  pre('v1.18.0-lou-20rc', '2026-11-24T10:00:00Z'),
  rel('v1.18.0-lou-18', '2026-11-16T16:18:05Z'),
  rel('v1.18.0-lou-17', '2026-11-15T19:31:55Z'),
  pre('v1.17.1-lou-14', '2026-10-12T06:26:01Z'),
];

test('the channel is release unless the address says prerelease', () => {
  assert.equal(readChannel(''), 'release');
  assert.equal(readChannel('?lang=en'), 'release');
  assert.equal(readChannel('?channel=release'), 'release');
  assert.equal(readChannel('?channel=nightly'), 'release');
  assert.equal(readChannel('?lang=en&channel=prerelease'), 'prerelease');
});

test('release never offers a pre-release or a draft', () => {
  assert.deepEqual(tags(offered(LIST, 'release')), ['v1.18.0-lou-18', 'v1.18.0-lou-17']);
  const draft = rel('v1.18.0-lou-19', '2026-11-26T10:00:00Z', {draft: true});
  assert.deepEqual(tags(offered([draft, ...LIST], 'release')), ['v1.18.0-lou-18', 'v1.18.0-lou-17']);
  assert.deepEqual(offered([pre('v1.18.0-lou-20rc', '2026-11-24T10:00:00Z')], 'release'), []);
});

test('release offers the newest full release first, whatever the order of the list', () => {
  assert.equal(offered([...LIST].reverse(), 'release')[0].tag, 'v1.18.0-lou-18');
});

test('prerelease offers only the newest pre-release', () => {
  assert.deepEqual(tags(offered(LIST, 'prerelease')), ['v1.18.0-lou-20rc2']);
  assert.deepEqual(tags(offered([...LIST].reverse(), 'prerelease')), ['v1.18.0-lou-20rc2']);
});

test('prerelease skips a draft', () => {
  const draft = pre('v1.18.0-lou-21rc', '2026-11-27T10:00:00Z');
  draft.draft = true;
  assert.deepEqual(tags(offered([draft, ...LIST], 'prerelease')), ['v1.18.0-lou-20rc2']);
});

test('a pre-release older than the latest full release is superseded: nothing is offered', () => {
  const list = [rel('v1.18.0-lou-20', '2026-12-01T10:00:00Z'), ...LIST];
  assert.deepEqual(offered(list, 'prerelease'), []);
  assert.equal(latestPrerelease(list), null);
  assert.equal(newestPrerelease(list).tag, 'v1.18.0-lou-20rc2');   // the page names it in its sentence
  assert.equal(offered(list, 'release')[0].tag, 'v1.18.0-lou-20');
});

test('no pre-release at all: nothing is offered', () => {
  const list = LIST.filter(r => !r.prerelease);
  assert.deepEqual(offered(list, 'prerelease'), []);
  assert.equal(newestPrerelease(list), null);
  assert.deepEqual(offered([], 'prerelease'), []);
});

test('a pre-release with no full release is offered', () => {
  assert.deepEqual(tags(offered([pre('v1.18.0-lou-20rc', '2026-11-24T10:00:00Z')], 'prerelease')), ['v1.18.0-lou-20rc']);
});

test('the channel goes into the address and comes back, and the rest stays', () => {
  const href = 'https://sweden-mesh.github.io/firmware/?lang=en&flasha#f=obs,ar,rc&install=new&hw=heltec_v4';
  const there = new URL(withChannel(href, 'prerelease'));
  assert.equal(readChannel(there.search), 'prerelease');
  assert.equal(there.searchParams.get('lang'), 'en');
  assert.ok(there.searchParams.has('flasha'));
  assert.equal(there.hash, '#f=obs,ar,rc&install=new&hw=heltec_v4');
  const back = new URL(withChannel(there.href, 'release'));
  assert.equal(readChannel(back.search), 'release');
  assert.ok(!back.searchParams.has('channel'));
  assert.equal(back.searchParams.get('lang'), 'en');
  assert.equal(back.hash, there.hash);
});
