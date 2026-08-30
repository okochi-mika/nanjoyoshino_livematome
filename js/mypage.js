// ============================================================
// mypage.html: 表示名編集 / 参加記録 / お気に入り一覧
// ============================================================

renderAuthNav();

let currentUser = null;

async function loadAttended() {
  const supabase = getSupabase();
  const [{ data: rows }, manifest] = await Promise.all([
    supabase.from("attended").select("live_id, created_at").order("created_at", { ascending: false }),
    loadManifest(),
  ]);

  const el = document.getElementById("attended-list");
  if (!rows || rows.length === 0) {
    el.innerHTML = `<p class="text-sm text-[var(--muted)] p-4">まだ参加記録がありません。ツアーページから公演を選んで記録しましょう。</p>`;
    return;
  }

  el.innerHTML = rows
    .map((r) => {
      const found = findVenueByLiveId(manifest, r.live_id);
      if (!found) return "";
      const { tour, venue } = found;
      return `
        <div class="venue-row px-2 sm:px-3">
          <div>
            <p class="text-sm">${escapeHtml(venue.place)}</p>
            <p class="text-xs text-[var(--muted)]">${escapeHtml(tour.tourName)} ・ ${formatDate(venue.date, "long")}</p>
          </div>
          <a href="player.html?id=${encodeURIComponent(venue.liveId)}" class="btn-outline text-xs">セトリを見る</a>
        </div>
      `;
    })
    .join("");
}

async function loadFavorites() {
  const supabase = getSupabase();
  const { data: rows } = await supabase
    .from("favorites")
    .select("video_id, title, created_at")
    .order("created_at", { ascending: false });

  const el = document.getElementById("favorites-list");
  if (!rows || rows.length === 0) {
    el.innerHTML = `<p class="text-sm text-[var(--muted)] p-4">まだお気に入りの曲がありません。</p>`;
    return;
  }

  el.innerHTML = rows
    .map(
      (r) => `
      <div class="venue-row px-2 sm:px-3">
        <p class="text-sm truncate">${escapeHtml(normalizeTitle(r.title))}</p>
        <button class="heart-btn is-active" data-video-id="${escapeHtml(r.video_id)}">♥</button>
      </div>
    `
    )
    .join("");

  el.querySelectorAll(".heart-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("video_id", btn.dataset.videoId);
      loadFavorites();
    });
  });
}

function wireDisplayName(user) {
  const input = document.getElementById("display-name-input");
  input.value = getDisplayName(user);
  document.getElementById("save-name-btn").addEventListener("click", async () => {
    await updateDisplayName(input.value.trim());
    renderAuthNav();
  });
}

onAuthReady(async (user) => {
  currentUser = user;
  const guest = document.getElementById("guest-notice");
  const content = document.getElementById("mypage-content");

  if (!user) {
    guest.classList.remove("hidden");
    content.classList.add("hidden");
    return;
  }

  guest.classList.add("hidden");
  content.classList.remove("hidden");
  wireDisplayName(user);
  loadAttended();
  loadFavorites();
});
