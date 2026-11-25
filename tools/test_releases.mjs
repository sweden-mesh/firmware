// Which releases the page offers.
//   node --test tools/test_releases.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import '../releases.js';

const {offered, imageCode} = globalThis;
const rel = (tag, published, more = {}) => ({tag, published, prerelease: false, images: [], ...more});
const pre = (tag, published) => rel(tag, published, {prerelease: true});
const tags = list => list.map(r => r.tag);

// A pre-release above two full releases and an old pre-release, as index.json lists them.
const LIST = [
  pre('v1.18.0-lou-20rc', '2026-11-24T10:00:00Z'),
  rel('v1.18.0-lou-18', '2026-11-16T16:18:05Z'),
  rel('v1.18.0-lou-17', '2026-11-15T19:31:55Z'),
  pre('v1.17.1-lou-14', '2026-10-12T06:26:01Z'),
];

test('a pre-release or a draft is never offered', () => {
  assert.deepEqual(tags(offered(LIST)), ['v1.18.0-lou-18', 'v1.18.0-lou-17']);
  const draft = rel('v1.18.0-lou-19', '2026-11-26T10:00:00Z', {draft: true});
  assert.deepEqual(tags(offered([draft, ...LIST])), ['v1.18.0-lou-18', 'v1.18.0-lou-17']);
  assert.deepEqual(offered([pre('v1.18.0-lou-20rc', '2026-11-24T10:00:00Z')]), []);
  assert.deepEqual(offered([]), []);
});

test('the newest full release comes first, whatever the order of the list', () => {
  assert.equal(offered([...LIST].reverse())[0].tag, 'v1.18.0-lou-18');
  assert.equal(LIST[0].tag, 'v1.18.0-lou-20rc');   // the list given is left as it was
});

test('an Observer board is offered the full image when the release has no exact one', () => {
  const img = (base, features) => ({base, features, hw: 'Board'});
  const lou20 = [img('observer', 'ar'), img('observer', 'rc'), img('observer', 'arrc'), img('core', 'ar'), img('core', 'rc'), img('core', 'arrc')];
  const lou21 = [img('observer', 'arrc'), img('core', 'ar'), img('core', 'rc'), img('core', 'arrc')];
  for (const code of ['ar', 'rc', 'arrc']) assert.equal(imageCode(lou20, 'observer', code), code);   // three images: the exact one
  for (const code of ['ar', 'rc', 'arrc']) assert.equal(imageCode(lou21, 'observer', code), 'arrc'); // one image: the full one
  for (const code of ['ar', 'rc', 'arrc']) assert.equal(imageCode(lou21, 'core', code), code);       // no Wi-Fi: always the exact one
  assert.equal(imageCode(lou21, 'observer', ''), '');                  // nothing ticked: no image of ours, as before
  assert.equal(imageCode([img('core', 'ar')], 'observer', 'ar'), 'ar'); // a release with no Observer image at all: nothing is invented
  assert.equal(imageCode(undefined, 'observer', 'rc'), 'rc');
});

