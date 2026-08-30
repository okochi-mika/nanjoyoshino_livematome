-- ============================================================
-- 南條愛乃セトリアーカイブ - Supabase スキーマ
--
-- 【重要】このサイトは下川みくにセトリサイトと同じSupabaseプロジェクトに
-- 相乗りしている（Supabase無料枠は1アカウントにつきプロジェクト2件までのため）。
-- そのため、テーブル名はすべて "nanjo_" プレフィックスを付けて、
-- 下川みくにサイト側のテーブル（favorites / attended / mysetlists / mysetlist_tracks、
-- プレフィックス無し）と絶対に衝突しないようにしてある。
--
-- 実行前に必ず確認すること:
--   - このファイル内のテーブル名は全て nanjo_ で始まっている（DROP TABLE対象に
--     下川みくに側の本物のテーブルが絶対に含まれないようにするため）。
--   - 万が一 "favorites" のようにプレフィックス無しの名前で実行してしまうと、
--     下川みくにサイトの本物のデータが DROP TABLE で消えてしまうので厳禁。
--
-- 下川みくに版で得た教訓を踏襲し、各テーブルに user_id を直接持たせて
-- RLSを auth.uid() = user_id だけで書けるようにしている（サブクエリ回避）。
--
-- 注意: RLS(CREATE POLICY)だけでは "permission denied for table X" になる。
-- 必ず GRANT ... TO authenticated; を忘れないこと。
-- テーブルごとに以下の順番で実行する:
--   DROP TABLE -> CREATE TABLE -> ENABLE RLS -> CREATE POLICY -> GRANT -> NOTIFY pgrst
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- nanjo_favorites: お気に入り曲（曲＝YouTube動画ID単位、ライブをまたいでグローバル）
-- ------------------------------------------------------------
drop table if exists public.nanjo_favorites cascade;

create table public.nanjo_favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  video_id   text not null,
  title      text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table public.nanjo_favorites enable row level security;

create policy "nanjo_favorites_select_own" on public.nanjo_favorites
  for select using (auth.uid() = user_id);
create policy "nanjo_favorites_insert_own" on public.nanjo_favorites
  for insert with check (auth.uid() = user_id);
create policy "nanjo_favorites_update_own" on public.nanjo_favorites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nanjo_favorites_delete_own" on public.nanjo_favorites
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.nanjo_favorites to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- nanjo_attended: 参加した公演の記録（会場単位 = live_id ごと）
-- live_id は data/lives/{tourId}/{venueId}.json 内の liveId と対応する
-- （例: 2024_fantasic_garden_osaka）。ツアー単位ではなく公演単位で記録する。
-- ------------------------------------------------------------
drop table if exists public.nanjo_attended cascade;

create table public.nanjo_attended (
  user_id    uuid not null references auth.users(id) on delete cascade,
  live_id    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, live_id)
);

alter table public.nanjo_attended enable row level security;

create policy "nanjo_attended_select_own" on public.nanjo_attended
  for select using (auth.uid() = user_id);
create policy "nanjo_attended_insert_own" on public.nanjo_attended
  for insert with check (auth.uid() = user_id);
create policy "nanjo_attended_update_own" on public.nanjo_attended
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nanjo_attended_delete_own" on public.nanjo_attended
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.nanjo_attended to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- nanjo_mysetlists: 自分だけのオリジナルセットリスト（複数作成可）
-- ------------------------------------------------------------
drop table if exists public.nanjo_mysetlists cascade;

create table public.nanjo_mysetlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nanjo_mysetlists enable row level security;

create policy "nanjo_mysetlists_select_own" on public.nanjo_mysetlists
  for select using (auth.uid() = user_id);
create policy "nanjo_mysetlists_insert_own" on public.nanjo_mysetlists
  for insert with check (auth.uid() = user_id);
create policy "nanjo_mysetlists_update_own" on public.nanjo_mysetlists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nanjo_mysetlists_delete_own" on public.nanjo_mysetlists
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.nanjo_mysetlists to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- nanjo_mysetlist_tracks: マイセトリに入っている曲（並び順 position 付き）
-- user_idをここにも直接持たせることで、nanjo_mysetlistsへのサブクエリを避ける。
-- ------------------------------------------------------------
drop table if exists public.nanjo_mysetlist_tracks cascade;

create table public.nanjo_mysetlist_tracks (
  id            uuid primary key default gen_random_uuid(),
  mysetlist_id  uuid not null references public.nanjo_mysetlists(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  video_id      text not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.nanjo_mysetlist_tracks enable row level security;

create policy "nanjo_mysetlist_tracks_select_own" on public.nanjo_mysetlist_tracks
  for select using (auth.uid() = user_id);
create policy "nanjo_mysetlist_tracks_insert_own" on public.nanjo_mysetlist_tracks
  for insert with check (auth.uid() = user_id);
create policy "nanjo_mysetlist_tracks_update_own" on public.nanjo_mysetlist_tracks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nanjo_mysetlist_tracks_delete_own" on public.nanjo_mysetlist_tracks
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.nanjo_mysetlist_tracks to authenticated;

notify pgrst, 'reload schema';
