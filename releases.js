// Which releases the page offers, from index.json's list. Two channels: 'release' offers the
// full releases, newest first, and never a pre-release or a draft; 'prerelease' offers one
// release at most, the newest pre-release, and none when a full release is newer than it.
// The channel is ?channel=prerelease in the address; anything else is 'release'.
// Loaded by index.html and by tools/test_releases.mjs.
{
  const when = r => r.published || '';
  const newestFirst = list => [...list].sort((a, b) => when(b).localeCompare(when(a)));
  const full = releases => newestFirst(releases.filter(r => !r.draft && !r.prerelease));

  // The newest pre-release, superseded or not.
  globalThis.newestPrerelease = releases =>
    newestFirst(releases.filter(r => !r.draft && r.prerelease))[0] || null;

  // The pre-release to offer: the newest one, unless a full release came after it.
  globalThis.latestPrerelease = releases => {
    const pre = newestPrerelease(releases), rel = full(releases)[0];
    return pre && (!rel || when(pre) > when(rel)) ? pre : null;
  };

  globalThis.offered = (releases, channel) =>
    channel === 'prerelease' ? [latestPrerelease(releases)].filter(Boolean) : full(releases);

  globalThis.readChannel = search =>
    new URLSearchParams(search).get('channel') === 'prerelease' ? 'prerelease' : 'release';

  // The address with the channel in it; every other parameter and the #choices stay.
  globalThis.withChannel = (href, channel) => {
    const u = new URL(href);
    if (channel === 'prerelease') u.searchParams.set('channel', 'prerelease');
    else u.searchParams.delete('channel');
    return u.href;
  };
}
