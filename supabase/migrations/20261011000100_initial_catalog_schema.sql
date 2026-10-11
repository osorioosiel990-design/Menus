-- Multi-restaurant public catalogs. Apply with the Supabase SQL Editor or CLI.
-- Bootstrap owner membership is intentionally not granted through the client API.

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 63),
  description text not null default '' check (char_length(description) <= 2000),
  logo_url text,
  cover_image_url text,
  phone text check (phone is null or char_length(phone) <= 40),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 40),
  address text check (address is null or char_length(address) <= 500),
  opening_hours jsonb not null default '{}'::jsonb
    check (jsonb_typeof(opening_hours) = 'object'),
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  theme_settings jsonb not null default '{"accent":"#bc4f34","ink":"#273c32","paper":"#f4f2eb"}'::jsonb
    check (
      jsonb_typeof(theme_settings) = 'object'
      and theme_settings - array['accent', 'ink', 'paper']::text[] = '{}'::jsonb
      and (theme_settings ->> 'accent' is null or theme_settings ->> 'accent' ~ '^#[0-9A-Fa-f]{6}$')
      and (theme_settings ->> 'ink' is null or theme_settings ->> 'ink' ~ '^#[0-9A-Fa-f]{6}$')
      and (theme_settings ->> 'paper' is null or theme_settings ->> 'paper' ~ '^#[0-9A-Fa-f]{6}$')
    ),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, slug)
);

create table public.restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor')),
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create unique index restaurant_members_one_owner_per_restaurant
  on public.restaurant_members (restaurant_id)
  where role = 'owner';
create index restaurant_members_user_id_idx on public.restaurant_members (user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, id)
);

create index categories_public_order_idx
  on public.categories (restaurant_id, is_active, display_order);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 140),
  description text not null default '' check (char_length(description) <= 1200),
  price numeric(12, 2) not null check (price >= 0),
  image_path text,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_category_same_restaurant_fk
    foreign key (restaurant_id, category_id)
    references public.categories (restaurant_id, id)
    on delete cascade,
  constraint products_image_path_is_relative
    check (
      image_path is null
      or (
        image_path ~ ('^' || restaurant_id::text || '/products/[^/]+$')
        and image_path !~ '(^|/)\.\.?(/|$)'
      )
    ),
  unique (restaurant_id, id)
);

create index products_public_order_idx
  on public.products (restaurant_id, category_id, display_order);
create index products_public_featured_idx
  on public.products (restaurant_id, is_featured)
  where is_featured;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;

create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- SECURITY DEFINER avoids recursive RLS checks when policies inspect membership.
create function public.is_restaurant_member(target_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.restaurant_members as member
    where member.restaurant_id = target_restaurant
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin', 'editor')
  );
$function$;

create function public.is_restaurant_admin(target_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.restaurant_members as member
    where member.restaurant_id = target_restaurant
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  );
$function$;

create function public.is_restaurant_content_manager(target_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.restaurant_members as member
    where member.restaurant_id = target_restaurant
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin', 'editor')
  );
$function$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.is_restaurant_member(uuid) from public, anon;
revoke all on function public.is_restaurant_admin(uuid) from public, anon;
revoke all on function public.is_restaurant_content_manager(uuid) from public, anon;
grant execute on function public.is_restaurant_member(uuid) to authenticated;
grant execute on function public.is_restaurant_admin(uuid) to authenticated;
grant execute on function public.is_restaurant_content_manager(uuid) to authenticated;

alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;

revoke all on public.restaurants, public.restaurant_members, public.categories, public.products
  from anon, authenticated;
grant select on public.restaurants, public.categories, public.products to anon, authenticated;
grant insert, update, delete on public.restaurants, public.categories, public.products to authenticated;
grant select on public.restaurant_members to authenticated;

create policy restaurants_read_active
  on public.restaurants for select to anon, authenticated
  using (is_active);
create policy restaurants_read_membership
  on public.restaurants for select to authenticated
  using (public.is_restaurant_member(id));
create policy restaurants_update_admin
  on public.restaurants for update to authenticated
  using (public.is_restaurant_admin(id))
  with check (public.is_restaurant_admin(id));

create policy restaurant_members_read_self_or_admin
  on public.restaurant_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_restaurant_admin(restaurant_id));

create policy categories_read_public_active
  on public.categories for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.restaurants as restaurant
      where restaurant.id = categories.restaurant_id and restaurant.is_active
    )
  );
create policy categories_read_members
  on public.categories for select to authenticated
  using (public.is_restaurant_content_manager(restaurant_id));
create policy categories_insert_members
  on public.categories for insert to authenticated
  with check (public.is_restaurant_content_manager(restaurant_id));
create policy categories_update_members
  on public.categories for update to authenticated
  using (public.is_restaurant_content_manager(restaurant_id))
  with check (public.is_restaurant_content_manager(restaurant_id));
create policy categories_delete_members
  on public.categories for delete to authenticated
  using (public.is_restaurant_content_manager(restaurant_id));

create policy products_read_public_active
  on public.products for select to anon, authenticated
  using (
    exists (
      select 1 from public.restaurants as restaurant
      where restaurant.id = products.restaurant_id and restaurant.is_active
    )
    and exists (
      select 1 from public.categories as category
      where category.id = products.category_id
        and category.restaurant_id = products.restaurant_id
        and category.is_active
    )
  );
create policy products_read_members
  on public.products for select to authenticated
  using (public.is_restaurant_content_manager(restaurant_id));
create policy products_insert_members
  on public.products for insert to authenticated
  with check (public.is_restaurant_content_manager(restaurant_id));
create policy products_update_members
  on public.products for update to authenticated
  using (public.is_restaurant_content_manager(restaurant_id))
  with check (public.is_restaurant_content_manager(restaurant_id));
create policy products_delete_members
  on public.products for delete to authenticated
  using (public.is_restaurant_content_manager(restaurant_id));

-- Public read is intentional for catalog images. Writes remain tenant-scoped.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-catalog',
  'restaurant-catalog',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy catalog_images_list_active_restaurants
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'restaurant-catalog'
    and exists (
      select 1 from public.restaurants as restaurant
      where restaurant.id::text = (storage.foldername(name))[1]
        and restaurant.is_active
    )
  );
create policy catalog_images_list_members
  on storage.objects for select to authenticated
  using (
    bucket_id = 'restaurant-catalog'
    and cardinality(storage.foldername(name)) >= 2
    and public.is_restaurant_content_manager(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
        else null
      end
    )
  );
create policy catalog_images_upload_members
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'restaurant-catalog'
    and cardinality(storage.foldername(name)) >= 2
    and public.is_restaurant_content_manager(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
        else null
      end
    )
  );
create policy catalog_images_update_members
  on storage.objects for update to authenticated
  using (
    bucket_id = 'restaurant-catalog'
    and cardinality(storage.foldername(name)) >= 2
    and public.is_restaurant_content_manager(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
        else null
      end
    )
  )
  with check (
    bucket_id = 'restaurant-catalog'
    and cardinality(storage.foldername(name)) >= 2
    and public.is_restaurant_content_manager(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
        else null
      end
    )
  );
create policy catalog_images_delete_members
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'restaurant-catalog'
    and cardinality(storage.foldername(name)) >= 2
    and public.is_restaurant_content_manager(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
        else null
      end
    )
  );
