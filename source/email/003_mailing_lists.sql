-- Flint Racing & STEM: mailing lists you can see and edit (Admin → Email → Mailing lists)
-- Applied to Supabase project FlintRacingandSTEM on Nov 17, 2026. No secrets live in this file.
--
-- A list is everyone who asked for that topic:
--   members who ticked it  +  questionnaire / kiosk guests who asked for updates  +  people Kendall adds by hand
-- minus anyone removed or unsubscribed from that list.
-- private.email_list keeps the hand-added people (status 'on') and the removals (status 'off').

create table if not exists private.email_list (
  email text not null check (private.email_ok(email)),
  topic text not null check (topic in ('workshops','council')),
  name text check (name is null or char_length(name) <= 80),
  status text not null default 'on' check (status in ('on','off')),
  source text not null default 'added' check (source in ('added','removed','unsubscribed')),
  note text check (note is null or char_length(note) <= 120),
  added_by uuid,
  updated_at timestamptz not null default now(),
  primary key (email, topic)
);
alter table private.email_list enable row level security;
revoke all on private.email_list from public, anon, authenticated;

-- Which lists a questionnaire or kiosk sign-up joined (same rule the lists have always used)
create or replace function private.inquiry_topics(p_interests text) returns text[]
language sql immutable set search_path = ''
as $$ select array_remove(array[
    case when coalesce(p_interests,'') ~* 'workshop' or coalesce(p_interests,'') !~* 'council' then 'workshops' end,
    case when coalesce(p_interests,'') ~* 'council' then 'council' end], null) $$;

create or replace function private.email_audience(p_topic text) returns table(email text, name text)
language sql stable security definer set search_path = ''
as $$
  select distinct on (q.e) q.e, q.n from (
    select lower(m.email) e, m.display_name n, 1 pri from public.members m
      where m.status = 'approved' and m.email is not null and p_topic = any(m.email_prefs)
    union all
    select l.email, l.name, 2 from private.email_list l where l.topic = p_topic and l.status = 'on'
    union all
    select lower(i.email), trim(i.first_name || ' ' || i.last_name), 3 from public.inquiries i
      where i.email_updates and p_topic = any(private.inquiry_topics(i.interests))
  ) q
  where private.email_ok(q.e)
    and not exists (select 1 from private.email_list x where x.email = q.e and x.topic = p_topic and x.status = 'off')
  order by q.e, q.pri
$$;

-- Asking again clears an old removal: a member ticking the box, or a new questionnaire / kiosk sign-up.
create or replace function private.tg_list_reconsent() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare t text[];
begin
  begin
    if tg_table_name = 'members' then
      if new.email is null then return null; end if;
      t := array(select x from unnest(new.email_prefs) x where x in ('workshops','council')
                 and (tg_op = 'INSERT' or not x = any(coalesce(old.email_prefs, '{}'))));
    elsif new.email_updates then
      t := private.inquiry_topics(new.interests);
    end if;
    if cardinality(coalesce(t, '{}')) > 0 then
      delete from private.email_list where email = lower(new.email) and topic = any(t) and status = 'off';
    end if;
  exception when others then raise warning 'list reconsent: %', sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists list_reconsent on public.members;
create trigger list_reconsent after insert or update of email_prefs on public.members for each row execute function private.tg_list_reconsent();
drop trigger if exists list_reconsent on public.inquiries;
create trigger list_reconsent after insert on public.inquiries for each row execute function private.tg_list_reconsent();

-- The unsubscribe link also takes them off any hand-added list and keeps them off.
create or replace function public.email_unsubscribe(p_e text, p_topic text, p_sig text, p_go boolean default false) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare em text;
begin
  if p_topic is null or p_topic not in ('workshops','council') or coalesce(p_e, '') !~ '^([0-9a-f]{2}){5,254}$' or coalesce(p_sig, '') !~ '^[0-9a-f]{40}$' then
    raise exception 'This unsubscribe link isn’t valid.'; end if;
  begin em := convert_from(decode(p_e, 'hex'), 'utf8'); exception when others then raise exception 'This unsubscribe link isn’t valid.'; end;
  if p_sig <> private.unsub_sig(em, p_topic) then raise exception 'This unsubscribe link isn’t valid.'; end if;
  if not coalesce(p_go, false) then return jsonb_build_object('email', em, 'topic', p_topic, 'done', false); end if;
  update public.members set email_prefs = array_remove(email_prefs, p_topic) where lower(email) = em and p_topic = any(email_prefs);
  update public.inquiries set email_updates = false where lower(email) = em and email_updates;
  if private.email_ok(em) then
    insert into private.email_list(email, topic, status, source) values (em, p_topic, 'off', 'unsubscribed')
      on conflict (email, topic) do update set status = 'off', source = 'unsubscribed', updated_at = now();
  end if;
  update private.email_outbox set status = 'skipped', error = 'Unsubscribed before it was sent' where kind = 'update' and to_email = em and status = 'queued' and template_key = 'update:' || p_topic;
  return jsonb_build_object('email', em, 'topic', p_topic, 'done', true);
end $$;

-- ---------- Admin → Email → Mailing lists ----------
-- Everyone on a list, where they signed up, plus the people taken off it.
create or replace function public.admin_lists(p_topic text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if p_topic is null or p_topic not in ('workshops','council') then raise exception 'Unknown list'; end if;
  return jsonb_build_object(
    'counts', jsonb_build_object('workshops', (select count(*) from private.email_audience('workshops')), 'council', (select count(*) from private.email_audience('council'))),
    'people', (select coalesce(jsonb_agg(jsonb_build_object('email', a.email, 'name', a.name, 'sources', (
        select coalesce(jsonb_agg(distinct s), '[]'::jsonb) from (
          select 'member' s from public.members m where lower(m.email) = a.email and m.status = 'approved' and p_topic = any(m.email_prefs)
          union all select 'added' from private.email_list l where l.email = a.email and l.topic = p_topic and l.status = 'on'
          union all select case when i.role = 'Workshop guest' then 'kiosk' else 'questionnaire' end from public.inquiries i
            where lower(i.email) = a.email and i.email_updates and p_topic = any(private.inquiry_topics(i.interests))) z),
        'note', (select l.note from private.email_list l where l.email = a.email and l.topic = p_topic and l.status = 'on'),
        'since', (select min(t) from (
          select m.created_at t from public.members m where lower(m.email) = a.email
          union all select l.updated_at from private.email_list l where l.email = a.email and l.topic = p_topic and l.status = 'on'
          union all select i.created_at from public.inquiries i where lower(i.email) = a.email and i.email_updates) w)
      ) order by lower(coalesce(nullif(a.name, ''), a.email))), '[]'::jsonb) from private.email_audience(p_topic) a),
    'removed', (select coalesce(jsonb_agg(jsonb_build_object('email', l.email, 'name', l.name, 'how', l.source, 'at', l.updated_at) order by l.updated_at desc), '[]'::jsonb)
      from private.email_list l where l.topic = p_topic and l.status = 'off'));
end $$;

-- Add one person or a whole pasted sign-up sheet: [{"email":"…","name":"…"}, …] (500 at a time).
-- People who unsubscribed with the link are skipped unless p_force (they asked again).
create or replace function public.admin_list_add(p_topic text, p_people jsonb, p_note text default null, p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare x jsonb; em text; nm text; nt text := nullif(left(trim(regexp_replace(coalesce(p_note, ''), '[\r\n\t]+', ' ', 'g')), 120), '');
  added int := 0; back int := 0; already int := 0; bad jsonb := '[]'::jsonb; unsub jsonb := '[]'::jsonb; seen text[] := '{}'; prev private.email_list;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if p_topic is null or p_topic not in ('workshops','council') then raise exception 'Choose a list.'; end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) = 0 then raise exception 'Add at least one email address.'; end if;
  if jsonb_array_length(p_people) > 500 then raise exception 'Add up to 500 people at a time.'; end if;
  for x in select * from jsonb_array_elements(p_people) loop
    em := lower(trim(coalesce(x->>'email', '')));
    nm := nullif(left(trim(regexp_replace(coalesce(x->>'name', ''), '[\r\n\t<>"]+', ' ', 'g')), 80), '');
    if not private.email_ok(em) then bad := bad || to_jsonb(left(coalesce(x->>'email', ''), 80)); continue; end if;
    if em = any(seen) then continue; end if;
    seen := seen || em;
    select * into prev from private.email_list where email = em and topic = p_topic;
    if prev.status = 'off' and prev.source = 'unsubscribed' and not coalesce(p_force, false) then
      unsub := unsub || to_jsonb(em); continue;
    elsif prev.status = 'off' then
      update private.email_list set status = 'on', source = 'added', name = coalesce(nm, name), note = coalesce(nt, note), added_by = auth.uid(), updated_at = now() where email = em and topic = p_topic;
      back := back + 1;
    elsif exists (select 1 from private.email_audience(p_topic) a where a.email = em) then
      already := already + 1;
    else
      insert into private.email_list(email, topic, name, status, source, note, added_by) values (em, p_topic, nm, 'on', 'added', nt, auth.uid())
        on conflict (email, topic) do update set status = 'on', name = coalesce(excluded.name, private.email_list.name), updated_at = now();
      added := added + 1;
    end if;
  end loop;
  return jsonb_build_object('added', added, 'back', back, 'already', already, 'invalid', bad, 'unsubscribed', unsub);
end $$;

-- Take someone off a list, wherever they signed up. Members also see the box unticked on their dashboard.
create or replace function public.admin_list_remove(p_topic text, p_email text) returns void
language plpgsql security definer set search_path = ''
as $$
declare em text := lower(trim(coalesce(p_email, '')));
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if p_topic is null or p_topic not in ('workshops','council') then raise exception 'Unknown list'; end if;
  if not private.email_ok(em) then raise exception 'That email address doesn’t look right.'; end if;
  update public.members set email_prefs = array_remove(email_prefs, p_topic) where lower(email) = em and p_topic = any(email_prefs);
  insert into private.email_list(email, topic, name, status, source, added_by)
    values (em, p_topic, (select a.name from private.email_audience(p_topic) a where a.email = em limit 1), 'off', 'removed', auth.uid())
    on conflict (email, topic) do update set status = 'off', source = 'removed', added_by = auth.uid(), updated_at = now();
  update private.email_outbox set status = 'skipped', error = 'Taken off the list before it was sent' where kind = 'update' and to_email = em and status = 'queued' and template_key = 'update:' || p_topic;
end $$;

revoke all on function public.admin_lists(text), public.admin_list_add(text, jsonb, text, boolean), public.admin_list_remove(text, text) from public, anon, authenticated;
grant execute on function public.admin_lists(text), public.admin_list_add(text, jsonb, text, boolean), public.admin_list_remove(text, text) to authenticated;
revoke all on function private.inquiry_topics(text), private.tg_list_reconsent() from public, anon, authenticated;
