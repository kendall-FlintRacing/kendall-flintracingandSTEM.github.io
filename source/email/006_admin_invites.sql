-- Admin invites: an admin adds someone's email ahead of time. When that person creates an account in the
-- Staff Garage and confirms their email, Admin turns on by itself. Confirmation is required, so nobody can
-- claim an invite without access to that inbox.

create table if not exists private.admin_invites (
  email text primary key,
  name text,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz
);
alter table private.admin_invites enable row level security;
revoke all on private.admin_invites from public, anon, authenticated;

-- Runs when an account is created or its email is confirmed. Never raises: sign-up must not fail because of this.
create or replace function private.tg_admin_invite() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_email text := lower(trim(coalesce(new.email, '')));
begin
  if new.email_confirmed_at is null or v_email = '' then return new; end if;
  if exists (select 1 from private.admin_invites i where i.email = v_email and i.used_at is null and i.cancelled_at is null) then
    insert into public.admins(user_id) values (new.id) on conflict do nothing;
    update private.admin_invites set used_at = now(), used_by = new.id where email = v_email;
  end if;
  return new;
exception when others then
  return new;
end $$;

create or replace trigger admin_invite_on_confirm
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function private.tg_admin_invite();

-- Add an invite. If the account already exists and is confirmed, Admin turns on right away.
create or replace function public.admin_invite_add(p_email text, p_name text, p_send boolean default true) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_name text := nullif(left(trim(regexp_replace(coalesce(p_name, ''), '[\r\n\t<>"]+', ' ', 'g')), 80), '');
  v_uid uuid; v_conf timestamptz; v_sent boolean := false; v_first text; v_from text;
begin
  if not private.is_admin() then raise exception 'Only an admin can add admins'; end if;
  if not private.email_ok(v_email) then raise exception 'That email address doesn’t look right.'; end if;
  select id, email_confirmed_at into v_uid, v_conf from auth.users where lower(email) = v_email limit 1;
  if v_uid is not null and v_conf is not null then
    insert into public.admins(user_id) values (v_uid) on conflict do nothing;
    insert into private.admin_invites(email, name, invited_by, used_at, used_by) values (v_email, v_name, auth.uid(), now(), v_uid)
      on conflict (email) do update set used_at = now(), used_by = v_uid, cancelled_at = null;
    return jsonb_build_object('status', 'granted', 'email', v_email);
  end if;
  insert into private.admin_invites(email, name, invited_by) values (v_email, v_name, auth.uid())
    on conflict (email) do update set name = coalesce(excluded.name, private.admin_invites.name), invited_by = auth.uid(),
      created_at = now(), used_at = null, used_by = null, cancelled_at = null;
  if coalesce(p_send, true) then
    if (select count(*) from private.email_outbox where template_key = 'admin_invite' and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'That’s a lot of invites in one hour. Try again a little later.';
    end if;
    v_first := coalesce(split_part(v_name, ' ', 1), '');
    select coalesce(u.raw_user_meta_data->>'full_name', 'Kendall') into v_from from auth.users u where u.id = auth.uid();
    v_sent := private.email_queue('reply', v_email, v_name, 'You’re invited to be an admin on flintracing.org',
      'Hi' || case when v_first <> '' then ' ' || v_first else '' end || ',' || E'\n\n' ||
      initcap(coalesce(v_from, 'Kendall')) || ' has set you up as an admin on the Flint Racing & STEM website.' || E'\n\n' ||
      'To finish setting up your account:' || E'\n' ||
      '1. Open https://flintracing.org/#access' || E'\n' ||
      '2. On the Staff Garage card, choose "New admin account".' || E'\n' ||
      '3. Use this email address: ' || v_email || E'\n' ||
      '4. Pick a password, then click the link in the confirmation email we send you.' || E'\n\n' ||
      'Admin access turns on by itself once your email is confirmed. Then sign in on the same page and choose "Admin dashboard".' || E'\n\n' ||
      'If you weren’t expecting this, you can ignore this email.',
      null, null, null, 'admin_invite', auth.uid(), null, null) is not null;
  end if;
  return jsonb_build_object('status', 'invited', 'email', v_email, 'sent', v_sent);
end $$;

create or replace function public.admin_invite_cancel(p_email text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  update private.admin_invites set cancelled_at = now() where email = lower(trim(coalesce(p_email, ''))) and used_at is null;
end $$;

create or replace function public.admin_invites_open() returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('email', i.email, 'name', i.name, 'created_at', i.created_at,
      'has_account', exists(select 1 from auth.users u where lower(u.email) = i.email)) order by i.created_at desc)
    from private.admin_invites i where i.used_at is null and i.cancelled_at is null), '[]'::jsonb);
end $$;

revoke all on function public.admin_invite_add(text, text, boolean), public.admin_invite_cancel(text), public.admin_invites_open() from public, anon;
grant execute on function public.admin_invite_add(text, text, boolean), public.admin_invite_cancel(text), public.admin_invites_open() to authenticated;
revoke all on function private.tg_admin_invite() from public, anon, authenticated;
