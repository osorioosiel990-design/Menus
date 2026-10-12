-- Install after the initial catalog schema and platform super-admin migrations.
-- The function creates the restaurant and its owner membership atomically.

grant insert on table public.restaurants, public.restaurant_members to authenticated;

create policy platform_admins_insert_restaurants
  on public.restaurants for insert to authenticated
  with check (public.is_platform_admin());

create policy platform_admins_insert_memberships
  on public.restaurant_members for insert to authenticated
  with check (public.is_platform_admin());

create or replace function public.create_restaurant_for_owner(
  p_name text,
  p_slug text,
  p_owner_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  new_restaurant_id uuid;
begin
  if (select public.is_platform_admin()) is not true then
    raise exception using
      errcode = '42501',
      message = 'Solo un super administrador puede crear restaurantes.';
  end if;

  insert into public.restaurants (name, slug, is_active)
  values (p_name, p_slug, false)
  returning id into new_restaurant_id;

  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (new_restaurant_id, p_owner_id, 'owner');

  return new_restaurant_id;
end;
$function$;

revoke all on function public.create_restaurant_for_owner(text, text, uuid) from public, anon;
grant execute on function public.create_restaurant_for_owner(text, text, uuid) to authenticated;
