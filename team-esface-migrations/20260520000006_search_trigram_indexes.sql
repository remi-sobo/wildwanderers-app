-- ============================================================
-- Search performance: pg_trgm + GIN indexes for the ⌘K palette.
--
-- Already applied via MCP. File is here so local + remote agree.
-- ============================================================

create extension if not exists pg_trgm;

create index if not exists athletes_first_name_trgm_idx
  on athletes using gin (first_name gin_trgm_ops);
create index if not exists athletes_last_name_trgm_idx
  on athletes using gin (last_name gin_trgm_ops);

create index if not exists profiles_first_name_trgm_idx
  on profiles using gin (first_name gin_trgm_ops);
create index if not exists profiles_last_name_trgm_idx
  on profiles using gin (last_name gin_trgm_ops);

create index if not exists teams_name_trgm_idx
  on teams using gin (name gin_trgm_ops);
create index if not exists knowledge_base_items_name_trgm_idx
  on knowledge_base_items using gin (name gin_trgm_ops);
create index if not exists schedule_events_title_trgm_idx
  on schedule_events using gin (title gin_trgm_ops);
create index if not exists feed_posts_title_trgm_idx
  on feed_posts using gin (title gin_trgm_ops);

create index if not exists milestone_definitions_name_trgm_idx
  on milestone_definitions using gin (name gin_trgm_ops);
