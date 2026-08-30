// ============================================================
// player.html: セトリ再生
// ?id=<liveId> … 公演のセットリストを再生
// ============================================================

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

let tracks = []; // { title, id }
let playQueue = []; // tracks配列のインデックス列（再生可能な曲のみ）
let queuePos = -1;
let ytPlayer = null;
let ytReady = false;
let pendingPlayIndex = null;

async function loadPlaylist() {
  const liveId = getQueryParam("id");
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

  headerEl.innerHTML = `<p class="text-sm text-[var(--muted)]">再生する公演が指定されていません。</p>`;
  backLink.href = "index.html";
  backLink.textContent = "← ツアー一覧に戻る";
}

function renderTrackList() {
  const el = document.getElementById("track-list");
  el.innerHTML = tracks
    .map((t, i) => {
      const playable = hasVideo(t);
      return `
        <div class="track-row ${playable ? "" : "is-empty"}" data-index="${i}" data-video-id="${playable ? escapeHtml(t.id) : ""}">
          <span class="track-num">${i + 1}</span>
          <span class="flex-1 text-sm truncate">
            ${escapeHtml(normalizeTitle(t.title))}
            ${t.note ? `<span class="badge-status badge-status--placeholder ml-1" title="${escapeHtml(t.note)}">${escapeHtml(t.note)}</span>` : ""}
          </span>
          ${playable ? "" : `<span class="text-[10px] text-[var(--muted)]">準備中</span>`}
        </div>
      `;
    })
    .join("");

  el.querySelectorAll(".track-row:not(.is-empty)").forEach((row) => {
    row.addEventListener("click", () => {
      const idx = parseInt(row.dataset.index, 10);
      playTrackAt(idx);
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
let _errorRetriedIndex = null;

window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player("yt-player", {
    height: "100%",
    width: "100%",
    // origin を明示しておくと、一部のブラウザ環境で発生する
    // 「エラーが発生しました。しばらくしてからもう一度お試しください」
    // という初期化エラーを避けやすくなる。
    playerVars: { rel: 0, origin: window.location.origin },
    events: {
      onReady: () => {
        ytReady = true;
        if (pendingPlayIndex !== null) {
          playVideoAtIndex(pendingPlayIndex);
          pendingPlayIndex = null;
        }
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          _errorRetriedIndex = null; // 再生できたので再試行フラグをリセット
        }
        if (e.data === YT.PlayerState.ENDED) {
          playNext();
        }
      },
      onError: (e) => {
        // 一時的な読み込み失敗の場合、同じ曲を1回だけ自動で再試行する。
        const currentIndex = playQueue[queuePos];
        console.error("YouTubeプレイヤーエラー:", e.data, "track index:", currentIndex);
        if (currentIndex !== undefined && _errorRetriedIndex !== currentIndex) {
          _errorRetriedIndex = currentIndex;
          setTimeout(() => playVideoAtIndex(currentIndex), 800);
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
  renderTrackList();

  document.getElementById("shuffle-btn").addEventListener("click", shuffleQueue);
  document.getElementById("next-btn").addEventListener("click", playNext);
}

main();
