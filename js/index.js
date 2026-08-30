// ============================================================
// index.html: ツアー一覧 + 曲名検索
// ============================================================

// 1枚分のツアー/イベントカードのHTMLを組み立てる
function renderTourCard(tour) {
  const venues = tour.venues || [];
  const dates = venues.map((v) => v.date).sort();
  const rangeLabel =
    dates.length > 1
      ? `${formatDate(dates[0])} 〜 ${formatDate(dates[dates.length - 1])}`
      : formatDate(dates[0]);

  const isEvent = tour.tourType === "event";
  const logoClass = isEvent ? "garden-logo-fallback--event" : "garden-logo-fallback";
  const cardClass = isEvent ? "garden-card--event" : "garden-card--soft";
  const pillClass = isEvent ? "pill pill--event" : "pill";
  const logoTextClass = isEvent ? "text-[var(--amber)]" : "text-[var(--sage)]";

  const logoInner = tour.logo
    ? `<img src="${escapeHtml(tour.logo)}" alt="" class="w-full h-full object-cover rounded-2xl" />`
    : "";

  return `
    <a href="tour.html?id=${encodeURIComponent(tour.tourId)}" class="garden-card ${cardClass} p-5 block hover:shadow-md transition-shadow">
      <div class="w-full h-24 rounded-2xl ${logoClass} mb-4 flex items-center justify-center overflow-hidden">
        ${logoInner || `<span class="font-display ${logoTextClass} text-sm">${escapeHtml(tour.shortName || tour.tourName)}</span>`}
      </div>
      <h3 class="font-display text-base leading-relaxed mb-2">${escapeHtml(tour.tourName).replace(/\n/g, "<br>")}</h3>
      <div class="flex items-center gap-2 text-xs text-[var(--muted)] mb-3">
        <span>${tour.year || ""}</span>
        <span>・</span>
        <span>全${venues.length}公演</span>
        <span>・</span>
        <span>${rangeLabel}</span>
      </div>
      <span class="${pillClass}">${isEvent ? "EVENT" : "TOUR"}</span>
    </a>
  `;
}

async function renderTourList() {
  const tourEl = document.getElementById("tour-list");
  const eventEl = document.getElementById("event-list");
  const eventSection = document.getElementById("event-section");

  let manifest;
  try {
    manifest = await loadManifest();
  } catch (e) {
    console.error("manifest.jsonの読み込みに失敗しました:", e);
    const errorHtml = `<p class="text-sm text-[var(--danger)]">
      ツアー情報を読み込めませんでした。file:// で直接開いていないか、
      MAMPなどのローカルサーバー経由（http://localhost/...）でアクセスしているか確認してください。
    </p>`;
    tourEl.innerHTML = errorHtml;
    if (eventSection) eventSection.hidden = true;
    return;
  }

  if (manifest.tours.length === 0) {
    tourEl.innerHTML = `<p class="text-sm text-[var(--muted)]">まだツアーが登録されていません。</p>`;
    if (eventSection) eventSection.hidden = true;
    return;
  }

  // ツアー（複数会場を回る公演）と、記念イベント等の単独公演を分けて表示する
  // （tourTypeが"event"のものはイベント一覧側に出す。未設定のものは従来通りツアー扱い）
  const allSorted = [...manifest.tours].sort((a, b) => (b.year || 0) - (a.year || 0));
  const tours = allSorted.filter((t) => t.tourType !== "event");
  const events = allSorted.filter((t) => t.tourType === "event");

  tourEl.innerHTML =
    tours.length > 0
      ? tours.map(renderTourCard).join("")
      : `<p class="text-sm text-[var(--muted)]">まだツアーが登録されていません。</p>`;

  if (eventEl) {
    eventEl.innerHTML = events.map(renderTourCard).join("");
  }
  if (eventSection) {
    // イベントが1件も無ければセクションごと隠す
    eventSection.hidden = events.length === 0;
  }
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
