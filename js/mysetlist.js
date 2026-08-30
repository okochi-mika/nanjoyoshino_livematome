// ============================================================
// mysetlist.html: マイセトリの作成・編集・削除
// ============================================================

renderAuthNav();

let currentUser = null;

async function fetchSetlists() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("nanjo_mysetlists")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });
  return data || [];
}

async function fetchTracks(mysetlistId) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("nanjo_mysetlist_tracks")
    .select("id, title, video_id, position")
    .eq("mysetlist_id", mysetlistId)
    .order("position", { ascending: true });
  return data || [];
}

async function renumber(mysetlistId, tracks) {
  const supabase = getSupabase();
  const updates = tracks.map((t, i) =>
    supabase.from("nanjo_mysetlist_tracks").update({ position: i }).eq("id", t.id)
  );
  await Promise.all(updates);
}

async function renderSetlists() {
  const container = document.getElementById("setlist-container");
  const setlists = await fetchSetlists();

  if (setlists.length === 0) {
    container.innerHTML = `<p class="text-sm text-[var(--muted)]">まだマイセトリがありません。上のフォームから作成してください。</p>`;
    return;
  }

  container.innerHTML = setlists
    .map(
      (s) => `
    <div class="garden-card p-5" data-setlist-id="${s.id}">
      <div class="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <input class="setlist-name-input font-display text-base bg-transparent border-b border-transparent focus:border-[var(--line)] focus:outline-none" value="${escapeHtml(s.name)}" />
        <div class="flex items-center gap-2">
          <a href="player.html?mysetlist=${s.id}" class="btn-garden text-xs">再生する →</a>
          <button class="delete-setlist-btn btn-outline text-xs">削除</button>
        </div>
      </div>
      <div class="track-editor space-y-1"></div>
      <form class="add-track-form flex flex-col sm:flex-row gap-2 mt-4">
        <input type="text" required placeholder="曲名" class="track-title-input flex-1 border border-[var(--line)] rounded-full px-4 py-2 text-xs" />
        <input type="text" required placeholder="YouTube動画ID" class="track-video-input sm:w-40 border border-[var(--line)] rounded-full px-4 py-2 text-xs" />
        <button type="submit" class="btn-outline text-xs shrink-0">＋ 追加</button>
      </form>
    </div>
  `
    )
    .join("");

  container.querySelectorAll("[data-setlist-id]").forEach((card) => {
    wireSetlistCard(card, card.dataset.setlistId);
  });
}

async function wireSetlistCard(card, setlistId) {
  const supabase = getSupabase();
  const editorEl = card.querySelector(".track-editor");

  async function refreshTracks() {
    const tracks = await fetchTracks(setlistId);
    editorEl.innerHTML = tracks.length
      ? tracks
          .map(
            (t, i) => `
        <div class="track-row" data-track-id="${t.id}">
          <span class="track-num">${i + 1}</span>
          <span class="flex-1 text-sm truncate">${escapeHtml(t.title)}</span>
          <button class="btn-outline text-[10px] move-up-btn" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="btn-outline text-[10px] move-down-btn" ${i === tracks.length - 1 ? "disabled" : ""}>↓</button>
          <button class="btn-outline text-[10px] remove-track-btn">削除</button>
        </div>
      `
          )
          .join("")
      : `<p class="text-xs text-[var(--muted)] px-2 py-3">まだ曲が入っていません。</p>`;

    editorEl.querySelectorAll(".remove-track-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const trackId = btn.closest(".track-row").dataset.trackId;
        await supabase.from("nanjo_mysetlist_tracks").delete().eq("id", trackId);
        const remaining = await fetchTracks(setlistId);
        await renumber(setlistId, remaining);
        refreshTracks();
      });
    });

    editorEl.querySelectorAll(".move-up-btn").forEach((btn, idx) => {
      btn.addEventListener("click", async () => {
        if (idx === 0) return;
        const swapped = [...tracks];
        [swapped[idx - 1], swapped[idx]] = [swapped[idx], swapped[idx - 1]];
        await renumber(setlistId, swapped);
        refreshTracks();
      });
    });

    editorEl.querySelectorAll(".move-down-btn").forEach((btn, idx) => {
      btn.addEventListener("click", async () => {
        if (idx === tracks.length - 1) return;
        const swapped = [...tracks];
        [swapped[idx + 1], swapped[idx]] = [swapped[idx], swapped[idx + 1]];
        await renumber(setlistId, swapped);
        refreshTracks();
      });
    });
  }

  await refreshTracks();

  card.querySelector(".delete-setlist-btn").addEventListener("click", async () => {
    await supabase.from("nanjo_mysetlists").delete().eq("id", setlistId);
    renderSetlists();
  });

  const nameInput = card.querySelector(".setlist-name-input");
  nameInput.addEventListener("change", async () => {
    await supabase
      .from("nanjo_mysetlists")
      .update({ name: nameInput.value.trim() })
      .eq("id", setlistId);
  });

  card.querySelector(".add-track-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleInput = card.querySelector(".track-title-input");
    const videoInput = card.querySelector(".track-video-input");
    const tracks = await fetchTracks(setlistId);
    await supabase.from("nanjo_mysetlist_tracks").insert({
      mysetlist_id: setlistId,
      user_id: currentUser.id,
      title: titleInput.value.trim(),
      video_id: videoInput.value.trim(),
      position: tracks.length,
    });
    titleInput.value = "";
    videoInput.value = "";
    refreshTracks();
  });
}

document.getElementById("create-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const supabase = getSupabase();
  const input = document.getElementById("new-setlist-name");
  await supabase.from("nanjo_mysetlists").insert({
    user_id: currentUser.id,
    name: input.value.trim(),
  });
  input.value = "";
  renderSetlists();
});

onAuthReady((user) => {
  currentUser = user;
  const guest = document.getElementById("guest-notice");
  const content = document.getElementById("mysetlist-content");
  if (!user) {
    guest.classList.remove("hidden");
    content.classList.add("hidden");
    return;
  }
  guest.classList.add("hidden");
  content.classList.remove("hidden");
  renderSetlists();
});
