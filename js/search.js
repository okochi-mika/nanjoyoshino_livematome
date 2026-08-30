// ============================================================
// 曲名検索
// 全ツアー・全公演のライブJSONを読み込み、曲名を正規化して重複統合。
// 「この曲を歌ったのはどのツアーのどの会場か」を検索結果に出す。
// ============================================================

let _searchIndexPromise = null;

function buildSearchIndex() {
  if (_searchIndexPromise) return _searchIndexPromise;

  _searchIndexPromise = loadManifest().then(async (manifest) => {
    const liveIds = [];
    for (const tour of manifest.tours) {
      for (const venue of tour.venues) liveIds.push(venue.liveId);
    }

    const lives = await Promise.all(liveIds.map((id) => loadLive(id)));

    // dedupeKey -> { displayTitle, occurrences: [...] }
    const index = new Map();

    for (const live of lives) {
      live.tracks.forEach((track, i) => {
        const key = dedupeKey(track.title);
        if (!key) return;
        if (!index.has(key)) {
          index.set(key, {
            displayTitle: normalizeTitle(track.title),
            occurrences: [],
          });
        }
        index.get(key).occurrences.push({
          tourId: live.tourId,
          tourName: live.tourName,
          venueName: live.venueName,
          date: live.date,
          liveId: live.liveId,
          trackIndex: i,
          videoId: track.id || null,
        });
      });
    }

    // 各公演内は日付順に並べておく
    for (const entry of index.values()) {
      entry.occurrences.sort((a, b) => (a.date < b.date ? -1 : 1));
    }

    return index;
  });

  return _searchIndexPromise;
}

function searchSongs(index, queryRaw) {
  const query = dedupeKey(queryRaw);
  if (!query) return [];
  const hits = [];
  for (const [key, entry] of index.entries()) {
    if (key.includes(query)) {
      hits.push(entry);
    }
  }
  // 曲名の五十音/アルファベット順に
  hits.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle, "ja"));
  return hits;
}

function renderSearchResults(container, hits) {
  if (hits.length === 0) {
    container.innerHTML = `<p class="text-sm text-[var(--muted)] py-6 text-center">該当する曲が見つかりませんでした。</p>`;
    return;
  }

  container.innerHTML = hits
    .map((entry) => {
      const occ = entry.occurrences
        .map(
          (o) => `
        <a href="player.html?id=${encodeURIComponent(o.liveId)}"
           class="pill pill--muted hover:opacity-80">
          ${escapeHtml(o.venueName)} ・ ${formatDate(o.date)}
        </a>`
        )
        .join("");
      return `
        <div class="search-hit">
          <p class="font-display text-base mb-2">${escapeHtml(entry.displayTitle)}</p>
          <div class="flex flex-wrap gap-2">${occ}</div>
        </div>
      `;
    })
    .join("");
}
