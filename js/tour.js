// ============================================================
// tour.html: ツアー詳細（会場一覧）
// ============================================================

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function statusBadge(status) {
  if (status === "official") {
    return `<span class="badge-status badge-status--official">公式確認済</span>`;
  }
  if (status === "fan-sourced") {
    return `<span class="badge-status badge-status--fan-sourced">参戦記録ベース</span>`;
  }
  return `<span class="badge-status badge-status--placeholder">セットリスト確認中</span>`;
}

async function main() {
  const tourId = getQueryParam("id");
  const headerEl = document.getElementById("tour-header");
  const listEl = document.getElementById("venue-list");

  let manifest;
  try {
    manifest = await loadManifest();
  } catch (e) {
    console.error("manifest.jsonの読み込みに失敗しました:", e);
    headerEl.innerHTML = `<p class="text-sm text-[var(--danger)]">
      ツアー情報を読み込めませんでした。file:// で直接開いていないか、
      MAMPなどのローカルサーバー経由（http://localhost/...）でアクセスしているか確認してください。
    </p>`;
    return;
  }

  const tour = findTourById(manifest, tourId);

  if (!tour) {
    headerEl.innerHTML = `<p class="text-sm text-[var(--muted)]">ツアーが見つかりませんでした。</p>`;
    return;
  }

  headerEl.innerHTML = `
    <div class="w-full h-28 rounded-2xl garden-logo-fallback mb-5 flex items-center justify-center">
      <span class="font-display text-[var(--sage)]">${escapeHtml(tour.shortName || tour.tourName)}</span>
    </div>
    <h1 class="font-display text-xl mb-1">${escapeHtml(tour.tourName)}</h1>
    <p class="text-sm text-[var(--muted)]">${tour.year || ""} ・ 全${tour.venues.length}公演</p>
  `;

  listEl.innerHTML = tour.venues
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((v) => {
      return `
      <div class="venue-row px-2 sm:px-3">
        <div>
          <p class="text-sm">${escapeHtml(v.prefecture ? v.prefecture + " ／ " : "")}${escapeHtml(v.place)}</p>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-[var(--muted)] font-variant-numeric-tabular">${formatDate(v.date, "long")}</span>
            ${statusBadge(v.setlistStatus)}
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <a href="player.html?id=${encodeURIComponent(v.liveId)}" class="btn-garden text-xs">セトリを見る →</a>
        </div>
      </div>
    `;
    })
    .join("");
}

main();
