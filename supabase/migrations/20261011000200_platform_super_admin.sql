-- Add a platform-level super admin without changing restaurant membership roles.
-- Apply only after 20261011000100_initial_catalog_schema.sql.

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;

create policy platform_admins_read_self
  on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- SECURITY INVOKER plus the self-only SELECT policy prevents the function
-- from becoming a privilege-escalation endpoint or exposing the admin roster.
create function public.is_platform_admin()
returns boolean
language sql
stable
set search_path = ''
as $function$
  select exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.user_id = (select auth.uid())
  );
$function$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create policy platform_admins_read_restaurants
  on public.restaurants for select to authenticated
  using (public.is_platform_admin());
create policy platform_admins_update_restaurants
  on public.restaurants for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy platform_admins_read_memberships
  on public.restaurant_members for select to authenticated
  using (public.is_platform_admin());

create policy platform_admins_read_categories
  on public.categories for select to authenticated
  using (public.is_platform_admin());
create policy platform_admins_insert_categories
  on public.categories for insert to authenticated
  with check (public.is_platform_admin());
create policy platform_admins_update_categories
  on public.categories for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy platform_admins_delete_categories
  on public.categories for delete to authenticated
  using (public.is_platform_admin());

create policy platform_admins_read_products
  on public.products for select to authenticated
  using (public.is_platform_admin());
create policy platform_admins_insert_products
  on public.products for insert to authenticated
  with check (public.is_platform_admin());
create policy platform_admins_update_products
  on public.products for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy platform_admins_delete_products
  on public.products for delete to authenticated
  using (public.is_platform_admin());

create policy platform_admins_list_catalog_images
  on storage.objects for select to authenticated
  using (bucket_id = 'restaurant-catalog' and public.is_platform_admin());
create policy platform_admins_upload_catalog_images
  on storage.objects for insert to authenticated
  with check (bucket_id = 'restaurant-catalog' and public.is_platform_admin());
create policy platform_admins_update_catalog_images
  on storage.objects for update to authenticated
  using (bucket_id = 'restaurant-catalog' and public.is_platform_admin())
  with check (bucket_id = 'restaurant-catalog' and public.is_platform_admin());
create policy platform_admins_delete_catalog_images
  on storage.objects for delete to authenticated
  using (bucket_id = 'restaurant-catalog' and public.is_platform_admin());