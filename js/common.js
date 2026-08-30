// ============================================================
// 共通ユーティリティ
// 全ページ（index / tour / player）から読み込む。
// ログイン・お気に入り・参加記録・マイセトリ機能は無し
// （閲覧者数が多く想定されるため、アカウント管理を持たないシンプルな
// 静的サイトにしている）。
// ============================================================

/* ---------- 曲名の正規化 / 重複統合キー ----------
   トラック番号、全角/半角、大文字/小文字、波ダッシュ差異などを吸収して
   「同じ曲」をひとつにまとめるためのキーを作る。
------------------------------------------------- */
function normalizeTitle(raw) {
  if (!raw) return "";
  let s = raw;
  // 先頭の "01. " "1." "①" などのトラック番号を除去
  s = s.replace(/^\s*[(（]?\d{1,3}[)）]?[.、\s]+/u, "");
  s = s.replace(/^\s*[①-⑳]\s*/u, "");
  // 全角英数字 -> 半角
  s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  // 波ダッシュ系の表記ゆれを統一
  s = s.replace(/[〜～∼]/g, "~");
  // 全角スペース -> 半角、前後トリム、連続空白の圧縮
  s = s.replace(/　/g, " ").trim().replace(/\s+/g, " ");
  return s;
}

function dedupeKey(raw) {
  return normalizeTitle(raw).toLowerCase();
}

/* ---------- 日付表示 ---------- */
function formatDate(yyyymmdd, style = "dot") {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || "";
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  if (style === "long") return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
  return `${y}.${m}.${d}`;
}

/* ---------- manifest.json 読み込み ---------- */
let _manifestPromise = null;
function loadManifest() {
  if (!_manifestPromise) {
    _manifestPromise = fetch("data/manifest.json").then((r) => r.json());
  }
  return _manifestPromise;
}

function findTourById(manifest, tourId) {
  return manifest.tours.find((t) => t.tourId === tourId) || null;
}

function findVenueByLiveId(manifest, liveId) {
  for (const tour of manifest.tours) {
    const venue = tour.venues.find((v) => v.liveId === liveId);
    if (venue) return { tour, venue };
  }
  return null;
}

/* ---------- ライブJSON読み込み(キャッシュ付き) ----------
   ファイルは data/lives/{tourId}/{venueId}.json に格納されている
   （ツアー数が増えてもdata/livesの直下がフラットに膨れないよう、
   ツアーごとにサブフォルダで分けている）。liveIdからtourId/venueIdを
   逆引きするためにmanifest.jsonを先に読む。
------------------------------------------------- */
const _liveCache = new Map();
function loadLive(liveId) {
  if (!_liveCache.has(liveId)) {
    _liveCache.set(
      liveId,
      loadManifest().then((manifest) => {
        const found = findVenueByLiveId(manifest, liveId);
        if (!found) {
          throw new Error(`manifest.jsonに liveId="${liveId}" が見つかりません`);
        }
        const path = `data/lives/${found.tour.tourId}/${found.venue.venueId}.json`;
        return fetch(path).then((r) => r.json());
      })
    );
  }
  return _liveCache.get(liveId);
}

/* ---------- XSS対策の簡易エスケープ ---------- */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

/* ---------- YouTube動画IDが未設定のプレースホルダー判定 ---------- */
function hasVideo(track) {
  return !!track && !!track.id;
}
