// ============================================================
// player.html: セトリ再生
// ?id=<liveId>          … 公演のセットリストを再生
// ?mysetlist=<uuid>     … 自分のマイセトリを再生（Supabase）
// ============================================================

renderAuthNav();

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

let currentUser = null;
let tracks = []; // { title, id }
let favoriteVideoIds = new Set();
let playQueue = []; // tracks配列のインデックス列（再生可能な曲のみ）
let queuePos = -1;
let ytPlayer = null;
let ytReady = false;
let pendingPlayIndex = null;

async function loadPlaylist() {
  const liveId = getQueryParam("id");
  const mysetlistId = getQueryParam("mysetlist");
  const headerEl = document.getElementById("playlist-header");
  const backLink = document.getElementById("back-link");

  if (liveId) {
    const [live, manifest] = await Promise.all([loadLive(liveId), loadManifest()]);
    tracks = live.tracks;
    const found = findVenueByLiveId(manifest, liveId);
    backLink.href = found ? `tour.html?id=${encodeURIComponent(found.tour.tourId)}` : "index.html";
    backLink.textContent = "← ツアーに戻る";
    headerEl.innerHTML = `
      <h1 class="font-display text-xl mb-1">${escapeHtml(live.venueName)}</h1>
      <p class="text-sm text-[var(--muted)]">${escapeHtml(live.tourName)} ・ ${formatDate(live.date, "long")}</p>
    `;
    return;
  }

  if (mysetlistId) {
    const supabase = getSupabase();
    const { data: setlist } = await supabase
      .from("mysetlists")
      .select("id, name")
      .eq("id", mysetlistId)
      .single();
    const { data: rows } = await supabase
      .from("mysetlist_tracks")
      .select("title, video_id, position")
      .eq("mysetlist_id", mysetlistId)
      .order("position", { ascending: true });

    tracks = (rows || []).map((r) => ({ title: r.title, id: r.video_id }));
    backLink.href = "mysetlist.html";
    backLink.textContent = "← マイセトリ一覧に戻る";
    headerEl.innerHTML = `
      <h1 class="font-display text-xl mb-1">${escapeHtml(setlist?.name || "マイセトリ")}</h1>
      <p class="text-sm text-[var(--muted)]">あなたが作成したセットリスト</p>
    `;
    return;
  }

  headerEl.innerHTML = `<p class="text-sm text-[var(--muted)]">再生する公演が指定されていません。</p>`;
  backLink.href = "index.html";
  backLink.textContent = "← ツアー一覧に戻る";
}

async function fetchFavorites() {
  if (!currentUser) return new Set();
  const supabase = getSupabase();
  const { data, error } = await supabase.from("favorites").select("video_id");
  if (error) {
    console.error(error);
    return new Set();
  }
  return new Set(data.map((r) => r.video_id));
}

async function toggleFavorite(videoId, title, btn) {
  if (!currentUser) {
    openLoginModal();
    return;
  }
  const supabase = getSupabase();
  const isFav = favoriteVideoIds.has(videoId);

  if (isFav) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("video_id", videoId);
    if (!error) {
      favoriteVideoIds.delete(videoId);
      btn.classList.remove("is-active");
      btn.textContent = "♡";
    }
  } else {
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: currentUser.id, video_id: videoId, title });
    if (!error) {
      favoriteVideoIds.add(videoId);
      btn.classList.add("is-active");
      btn.textContent = "♥";
    }
  }
}

function renderTrackList() {
  const el = document.getElementById("track-list");
  el.innerHTML = tracks
    .map((t, i) => {
      const playable = hasVideo(t);
      const isFav = playable && favoriteVideoIds.has(t.id);
      return `
        <div class="track-row ${playable ? "" : "is-empty"}" data-index="${i}" data-video-id="${playable ? escapeHtml(t.id) : ""}">
          <span class="track-num">${i + 1}</span>
          <span class="flex-1 text-sm truncate">
            ${escapeHtml(normalizeTitle(t.title))}
            ${t.note ? `<span class="badge-status badge-status--placeholder ml-1" title="${escapeHtml(t.note)}">${escapeHtml(t.note)}</span>` : ""}
          </span>
          ${
            playable
              ? `<button class="heart-btn ${isFav ? "is-active" : ""}" data-video-id="${escapeHtml(t.id)}" data-title="${escapeHtml(t.title)}">${isFav ? "♥" : "♡"}</button>`
              : `<span class="text-[10px] text-[var(--muted)]">準備中</span>`
          }
        </div>
      `;
    })
    .join("");

  el.querySelectorAll(".track-row:not(.is-empty)").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.classList.contains("heart-btn")) return;
      const idx = parseInt(row.dataset.index, 10);
      playTrackAt(idx);
    });
  });

  el.querySelectorAll(".heart-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.videoId, btn.dataset.title, btn);
    });
  });
}

function highlightPlaying(index) {
  document.querySelectorAll(".track-row").forEach((row) => {
    row.classList.toggle("is-playing", parseInt(row.dataset.index, 10) === index);
  });
}

function buildDefaultQueue() {
  playQueue = tracks
    .map((t, i) => i)
    .filter((i) => hasVideo(tracks[i]));
}

function playTrackAt(index) {
  const posInQueue = playQueue.indexOf(index);
  queuePos = posInQueue >= 0 ? posInQueue : 0;
  playVideoAtIndex(index);
}

function playVideoAtIndex(index) {
  const track = tracks[index];
  if (!track || !hasVideo(track)) return;
  highlightPlaying(index);
  if (ytReady && ytPlayer) {
    ytPlayer.loadVideoById(track.id);
  } else {
    pendingPlayIndex = index;
  }
}

function playNext() {
  if (playQueue.length === 0) return;
  queuePos = (queuePos + 1) % playQueue.length;
  playVideoAtIndex(playQueue[queuePos]);
}

function shuffleQueue() {
  buildDefaultQueue();
  for (let i = playQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [playQueue[i], playQueue[j]] = [playQueue[j], playQueue[i]];
  }
  queuePos = -1;
  playNext();
}

/* ---------- YouTube IFrame API ---------- */
window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player("yt-player", {
    height: "100%",
    width: "100%",
    playerVars: { rel: 0 },
    events: {
      onReady: () => {
        ytReady = true;
        if (pendingPlayIndex !== null) {
          playVideoAtIndex(pendingPlayIndex);
          pendingPlayIndex = null;
        }
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.ENDED) {
          playNext();
        }
      },
    },
  });
};

async function main() {
  try {
    await loadPlaylist();
  } catch (e) {
    console.error("公演データの読み込みに失敗しました:", e);
    document.getElementById("playlist-header").innerHTML = `<p class="text-sm text-[var(--danger)]">
      公演データを読み込めませんでした。file:// で直接開いていないか、
      MAMPなどのローカルサーバー経由（http://localhost/...）でアクセスしているか確認してください。
    </p>`;
    return;
  }
  buildDefaultQueue();

  onAuthReady(async (user) => {
    currentUser = user;
    favoriteVideoIds = await fetchFavorites();
    renderTrackList();
  });

  document.getElementById("shuffle-btn").addEventListener("click", shuffleQueue);
  document.getElementById("next-btn").addEventListener("click", playNext);
}

main();
