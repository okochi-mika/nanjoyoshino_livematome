-- ============================================================
-- 南條愛乃セトリアーカイブ - Supabase スキーマ
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
-- favorites: お気に入り曲（曲＝YouTube動画ID単位、ライブをまたいでグローバル）
-- ------------------------------------------------------------
drop table if exists public.favorites cascade;

create table public.favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  video_id   text not null,
  title      text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table public.favorites enable row level security;

create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id);
create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);
create policy "favorites_update_own" on public.favorites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.favorites to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- attended: 参加した公演の記録（会場単位 = live_id ごと）
-- live_id は data/lives/{tourId}/{venueId}.json 内の liveId と対応する
-- （例: 2024_fantasic_garden_osaka）。ツアー単位ではなく公演単位で記録する。
-- ------------------------------------------------------------
drop table if exists public.attended cascade;

create table public.attended (
  user_id    uuid not null references auth.users(id) on delete cascade,
  live_id    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, live_id)
);

alter table public.attended enable row level security;

create policy "attended_select_own" on public.attended
  for select using (auth.uid() = user_id);
create policy "attended_insert_own" on public.attended
  for insert with check (auth.uid() = user_id);
create policy "attended_update_own" on public.attended
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "attended_delete_own" on public.attended
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.attended to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- mysetlists: 自分だけのオリジナルセットリスト（複数作成可）
-- ------------------------------------------------------------
drop table if exists public.mysetlists cascade;

create table public.mysetlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mysetlists enable row level security;

create policy "mysetlists_select_own" on public.mysetlists
  for select using (auth.uid() = user_id);
create policy "mysetlists_insert_own" on public.mysetlists
  for insert with check (auth.uid() = user_id);
create policy "mysetlists_update_own" on public.mysetlists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mysetlists_delete_own" on public.mysetlists
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.mysetlists to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- mysetlist_tracks: マイセトリに入っている曲（並び順 position 付き）
-- user_idをここにも直接持たせることで、mysetlistsへのサブクエリを避ける。
-- ------------------------------------------------------------
drop table if exists public.mysetlist_tracks cascade;

create table public.mysetlist_tracks (
  id            uuid primary key default gen_random_uuid(),
  mysetlist_id  uuid not null references public.mysetlists(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  video_id      text not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.mysetlist_tracks enable row level security;

create policy "mysetlist_tracks_select_own" on public.mysetlist_tracks
  for select using (auth.uid() = user_id);
create policy "mysetlist_tracks_insert_own" on public.mysetlist_tracks
  for insert with check (auth.uid() = user_id);
create policy "mysetlist_tracks_update_own" on public.mysetlist_tracks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mysetlist_tracks_delete_own" on public.mysetlist_tracks
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.mysetlist_tracks to authenticated;

notify pgrst, 'reload schema';
