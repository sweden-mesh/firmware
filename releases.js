// Which releases the page offers, from index.json's list: the full releases, newest first,
// and never a pre-release or a draft.
// Loaded by index.html and by tools/test_releases.mjs.
{
  const when = r => r.published || '';
  globalThis.offered = releases =>
    releases.filter(r => !r.draft && !r.prerelease).sort((a, b) => when(b).localeCompare(when(a)));
}

// The feature code of the image to offer for what is ticked. From lou-21 an Observer board has one
// image, with auto-reply and remote control both in it and each switched on by a setting: a release
// with no Observer image of exactly the ticked code offers its full one ('arrc'). Boards without
// Wi-Fi, and releases that still have the three Observer images, get the exact code.
globalThis.imageCode = (images, base, code) => {
  if (base !== 'observer' || !code) return code;
  const has = c => (images || []).some(i => i.base === 'observer' && i.features === c);
  return has(code) || !has('arrc') ? code : 'arrc';
};
