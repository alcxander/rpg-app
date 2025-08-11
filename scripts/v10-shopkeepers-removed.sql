-- Adds soft-delete fields if they don't exist.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'shopkeepers' and column_name = 'removed'
  ) then
    alter table public.shopkeepers add column removed boolean default false;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'shopkeepers' and column_name = 'removed_at'
  ) then
    alter table public.shopkeepers add column removed_at timestamptz null;
  end if;
end $$;
