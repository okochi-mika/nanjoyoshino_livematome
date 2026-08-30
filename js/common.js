// ============================================================
// 共通ユーティリティ / Supabase初期化 / 認証まわり
// 全ページ（index / tour / player / mypage / mysetlist）から読み込む。
// ============================================================

/* ---------- Supabase client ---------- */
let _supabaseClient = null;
function getSupabase() {
  if (!_supabaseClient) {
    _supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_PUBLISHABLE_KEY
    );
  }
  return _supabaseClient;
}

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

/* ---------- 認証 ----------
   onAuthStateChange は初回に必ず一度発火するため、手動初期化と二重に
   走らないよう、呼び出し世代(generation)をインクリメントして
   古い結果は破棄する。
------------------------------------------------- */
let _authGeneration = 0;
let _authReadyCallbacks = [];
let _authHasFired = false;
let _lastAuthUser = null;

// onAuthReadyは「認証状態が確定したら呼ばれる」コールバックを登録する。
// 各ページはmanifest.jsonやライブJSONのfetchを挟んでから登録することが多く、
// その間に最初のfire()が完了してしまうと、後から登録したコールバックが
// 一生呼ばれないままになる（実際にこのバグで一覧が表示されない不具合が
// あったため、既に確定済みの状態は登録時に即リプレイするようにしている）。
function onAuthReady(cb) {
  _authReadyCallbacks.push(cb);
  if (_authHasFired) {
    Promise.resolve().then(() => cb(_lastAuthUser)).catch((e) => console.error(e));
  }
}

function initAuthWatcher() {
  const myGeneration = ++_authGeneration;

  const fire = async (session) => {
    if (myGeneration !== _authGeneration) return; // 古い呼び出しは破棄
    const user = session?.user || null;
    _authHasFired = true;
    _lastAuthUser = user;
    for (const cb of _authReadyCallbacks) {
      try {
        await cb(user);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Supabase SDK自体が読み込めていない場合（CDN障害・広告ブロッカー等）でも
  // ページの他の機能（一覧表示・検索など）を止めないよう、ここは例外を握りつぶす。
  try {
    if (!window.supabase) throw new Error("Supabase SDKが読み込まれていません");
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => fire(data.session));
    supabase.auth.onAuthStateChange((_event, session) => fire(session));
  } catch (e) {
    console.error("認証機能を初期化できませんでした:", e);
    fire(null); // ログアウト状態として扱う
  }
}

async function signInWithGoogle() {
  const supabase = getSupabase();
  const redirectTo = window.location.origin + window.location.pathname;
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}

async function signOut() {
  const supabase = getSupabase();
  return supabase.auth.signOut();
}

async function updateDisplayName(name) {
  const supabase = getSupabase();
  return supabase.auth.updateUser({ data: { display_name: name } });
}

function getDisplayName(user) {
  const meta = user?.user_metadata || {};
  // display_name はマイページで自分で設定した表示名。
  // 未設定の場合はGoogleアカウントの名前(full_name/name)にフォールバックする。
  return (
    meta.display_name ||
    meta.full_name ||
    meta.name ||
    user?.email?.split("@")[0] ||
    "ゲスト"
  );
}

/* ---------- ヘッダーの認証UIを共通で描画 ----------
   #auth-nav という要素があるページで呼ぶ想定。
------------------------------------------------- */
function renderAuthNav() {
  const el = document.getElementById("auth-nav");
  if (!el) return;

  onAuthReady((user) => {
    if (user) {
      el.innerHTML = `
        <a href="mypage.html" class="link-quiet text-sm">${escapeHtml(getDisplayName(user))} さん</a>
        <button id="auth-signout" class="btn-outline text-xs">ログアウト</button>
      `;
      document.getElementById("auth-signout")?.addEventListener("click", async () => {
        await signOut();
        location.reload();
      });
    } else {
      el.innerHTML = `
        <button id="auth-open-login" class="btn-garden text-xs">ログイン</button>
      `;
      document.getElementById("auth-open-login")?.addEventListener("click", openLoginModal);
    }
  });

  initAuthWatcher();
}

/* ---------- 簡易ログインモーダル(Googleログイン) ----------
   下川みくに版はメールのマジックリンクだったが、南條愛乃版は想定ファン数が
   桁違いに多く、Supabase組み込みメール送信のレート制限では間に合わないため、
   メール送信が発生しないGoogle OAuthに変更している。
------------------------------------------------- */
function openLoginModal() {
  if (document.getElementById("login-modal")) return;
  const wrap = document.createElement("div");
  wrap.id = "login-modal";
  wrap.className =
    "fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4";
  wrap.innerHTML = `
    <div class="garden-card p-6 w-full max-w-sm text-center">
      <p class="font-display text-lg mb-2">ログイン</p>
      <p class="text-sm text-[var(--muted)] mb-5">Googleアカウントでログインすると、お気に入り登録・参加記録・マイセトリ作成が使えます。</p>
      <button id="google-login-btn" class="btn-garden text-sm w-full justify-center">Googleでログイン</button>
      <button id="login-cancel" class="btn-outline text-xs mt-3">閉じる</button>
      <p id="login-message" class="text-xs text-[var(--danger)] mt-3 hidden"></p>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) wrap.remove();
  });
  document.getElementById("login-cancel").addEventListener("click", () => wrap.remove());
  document.getElementById("google-login-btn").addEventListener("click", async () => {
    const msg = document.getElementById("login-message");
    const { error } = await signInWithGoogle();
    if (error) {
      msg.textContent = `エラー: ${error.message}`;
      msg.classList.remove("hidden");
    }
    // 成功時はGoogleの認証画面にリダイレクトされるため、ここでの後処理は不要。
  });
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
