// Which releases the page offers, from index.json's list: the full releases, newest first,
// and never a pre-release or a draft.
// Loaded by index.html and by tools/test_releases.mjs.
{
  const when = r => r.published || '';
  globalThis.offered = releases =>
    releases.filter(r => !r.draft && !r.prerelease).sort((a, b) => when(b).localeCompare(when(a)));
}
