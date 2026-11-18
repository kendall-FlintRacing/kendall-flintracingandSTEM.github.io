-- Live race page: donations from viewers.
-- A gift is private (admins only). If the donor adds a shout-out, it goes to Track operations for approval
-- marked as a donor shout-out; once approved the live page thanks them by name (never the amount).
-- Payment itself happens on the Square link; the site can't see whether it went through, so admins check Square before approving.

alter table public.shoutouts add column if not exists donation boolean not null default false;

create table if not exists public.race_gifts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  email text,
  amount numeric,
  message text,
  shoutout_id uuid references public.shoutouts(id) on delete set null,
  status text not null default 'new' check (status in ('new','confirmed','not_received'))
);
alter table public.race_gifts enable row level security;
create policy "admins read race gifts" on public.race_gifts for select using ((select private.is_admin()));
create policy "admins update race gifts" on public.race_gifts for update using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins delete race gifts" on public.race_gifts for delete using ((select private.is_admin()));

-- Visitors can't mark their own shout-out as a donor one; only race_gift() does that.
alter policy "anyone sends a shout-out" on public.shoutouts with check (status = 'pending' and donation = false);

create or replace function public.race_gift(p_name text, p_email text, p_amount numeric, p_message text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_name text := nullif(left(trim(regexp_replace(coalesce(p_name, ''), '[\r\n\t<>]+', ' ', 'g')), 60), '');
  v_email text := lower(trim(coalesce(p_email, ''))); v_msg text := nullif(left(trim(coalesce(p_message, '')), 280), '');
  v_amt numeric := case when p_amount is null then null else round(p_amount, 2) end; v_so uuid; v_id uuid; v_link text;
begin
  if (select count(*) from public.race_gifts where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Lots of people are giving right now. Please try again in a minute.'; end if;
  if v_amt is not null and (v_amt < 1 or v_amt > 100000) then raise exception 'Enter an amount between $1 and $100,000.'; end if;
  if v_email <> '' and not private.email_ok(v_email) then raise exception 'That email address doesn’t look right.'; end if;
  if v_msg is not null and v_name is null then raise exception 'Add your name so we can thank you with your shout-out.'; end if;
  if v_msg is not null then
    insert into public.shoutouts(name, message, status, donation) values (v_name, v_msg, 'pending', true) returning id into v_so;
  end if;
  insert into public.race_gifts(name, email, amount, message, shoutout_id) values (v_name, nullif(v_email, ''), v_amt, v_msg, v_so) returning id into v_id;
  perform private.email_alert('inquiry', 'Race day donation' || coalesce(' from ' || v_name, '') || coalesce(': $' || v_amt::text, ''),
    coalesce(v_name, 'Someone') || ' started a donation on the live race page' || coalesce(' ($' || v_amt::text || ')', '') || '.' || E'\n\n' ||
    case when v_msg is not null then 'They added a shout-out: "' || v_msg || '"' || E'\n' || 'It’s waiting in Track operations. Check Square for the payment before approving it.' else 'They chose to keep it private (no shout-out).' end ||
    coalesce(E'\n\n' || 'Email: ' || nullif(v_email, ''), ''),
    nullif(v_email, ''), 'race_gifts', v_id);
  select (value::jsonb)->>'link' into v_link from public.site_content where key = 'data|donate';
  return jsonb_build_object('id', v_id, 'shoutout', v_so, 'link', v_link);
end $$;

revoke all on function public.race_gift(text, text, numeric, text) from public;
grant execute on function public.race_gift(text, text, numeric, text) to anon, authenticated;
