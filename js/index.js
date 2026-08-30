// ============================================================
// index.html: ツアー一覧 + 曲名検索
// ============================================================

async function renderTourList() {
  const el = document.getElementById("tour-list");
  let manifest;
  try {
    manifest = await loadManifest();
  } catch (e) {
    console.error("manifest.jsonの読み込みに失敗しました:", e);
    el.innerHTML = `<p class="text-sm text-[var(--danger)]">
      ツアー情報を読み込めませんでした。file:// で直接開いていないか、
      MAMPなどのローカルサーバー経由（http://localhost/...）でアクセスしているか確認してください。
    </p>`;
    return;
  }

  if (manifest.tours.length === 0) {
    el.innerHTML = `<p class="text-sm text-[var(--muted)]">まだツアーが登録されていません。</p>`;
    return;
  }

  // 年が新しい順
  const tours = [...manifest.tours].sort((a, b) => (b.year || 0) - (a.year || 0));

  el.innerHTML = tours
    .map((tour) => {
      const venues = tour.venues || [];
      const dates = venues.map((v) => v.date).sort();
      const rangeLabel =
        dates.length > 1
          ? `${formatDate(dates[0])} 〜 ${formatDate(dates[dates.length - 1])}`
          : formatDate(dates[0]);

      const logoInner = tour.logo
        ? `<img src="${escapeHtml(tour.logo)}" alt="" class="w-full h-full object-cover rounded-2xl" />`
        : "";

      return `
        <a href="tour.html?id=${encodeURIComponent(tour.tourId)}" class="garden-card garden-card--soft p-5 block hover:shadow-md transition-shadow">
          <div class="w-full h-24 rounded-2xl garden-logo-fallback mb-4 flex items-center justify-center overflow-hidden">
            ${logoInner || `<span class="font-display text-[var(--sage)] text-sm">${escapeHtml(tour.shortName || tour.tourName)}</span>`}
          </div>
          <h3 class="font-display text-base leading-relaxed mb-2">${escapeHtml(tour.tourName).replace(/\n/g, "<br>")}</h3>
          <div class="flex items-center gap-2 text-xs text-[var(--muted)] mb-3">
            <span>${tour.year || ""}</span>
            <span>・</span>
            <span>全${venues.length}公演</span>
            <span>・</span>
            <span>${rangeLabel}</span>
          </div>
          <span class="pill">TOUR</span>
        </a>
      `;
    })
    .join("");
}

function wireSearch() {
  const input = document.getElementById("song-search-input");
  const results = document.getElementById("song-search-results");
  let indexPromise = null;
  let debounceTimer = null;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const q = input.value.trim();
      if (!q) {
        results.innerHTML = "";
        return;
      }
      if (!indexPromise) indexPromise = buildSearchIndex();
      results.innerHTML = `<p class="text-sm text-[var(--muted)]">検索中…</p>`;
      const index = await indexPromise;
      const hits = searchSongs(index, q);
      renderSearchResults(results, hits);
    }, 200);
  });
}

renderTourList();
wireSearch();
