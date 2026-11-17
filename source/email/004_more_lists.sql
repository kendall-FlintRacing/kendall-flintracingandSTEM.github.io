-- Flint Racing & STEM: more mailing lists, lists Kendall can create, and updates sent to several lists at once
-- Applied to Supabase project FlintRacingandSTEM on Nov 17, 2026. No secrets live in this file.

-- ---------- The lists ----------
create table if not exists private.email_lists (
  key text primary key check (key ~ '^[a-z][a-z0-9]{1,23}$'),
  name text not null check (char_length(name) between 2 and 60),
  about text check (about is null or char_length(about) <= 160),
  member_choice boolean not null default false,   -- members can tick it on Register / My dashboard / kiosk
  roles text[] not null default '{}',             -- approved members with any of these roles are on it
  include_admins boolean not null default false,  -- every admin account is on it
  builtin boolean not null default false,
  sort int not null default 100,
  created_at timestamptz not null default now()
);
alter table private.email_lists enable row level security;
revoke all on private.email_lists from public, anon, authenticated;

insert into private.email_lists(key, name, about, member_choice, roles, include_admins, builtin, sort) values
  ('building',   'Building workshops', 'Building workshop dates, registration and reminders', true,  '{}',          false, true, 10),
  ('workshops',  'Seasonal workshops', 'Workshop, camp and fun run dates as they’re set',     true,  '{}',          false, true, 20),
  ('volunteers', 'Volunteers',         'Volunteer shifts, race-day help and crew news',       true,  '{volunteer}', false, true, 30),
  ('council',    'Leadership Council', 'Council news, opportunities and special offers',      true,  '{council}',   false, true, 40),
  ('teachers',   'Teachers',           'For teachers who plan and lead workshops',            false, '{teacher}',   false, true, 50),
  ('coaches',    'Coaches',            'For coaches and team mentors',                        false, '{}',          false, true, 60),
  ('admins',     'Admins',             'Everyone with an admin account',                      false, '{}',          true,  true, 70)
on conflict (key) do nothing;

-- People added to or taken off a list. (The earlier private.email_list table only allowed two lists; it stays, empty and unused.)
create table if not exists private.list_people (
  email text not null check (private.email_ok(email)),
  topic text not null check (topic ~ '^[a-z][a-z0-9]{1,23}$'),
  name text check (name is null or char_length(name) <= 80),
  status text not null default 'on' check (status in ('on','off')),
  source text not null default 'added' check (source in ('added','removed','unsubscribed')),
  note text check (note is null or char_length(note) <= 120),
  added_by uuid,
  updated_at timestamptz not null default now(),
  primary key (email, topic)
);
alter table private.list_people enable row level security;
revoke all on private.list_people from public, anon, authenticated;
insert into private.list_people select email, topic, name, status, source, note, added_by, updated_at from private.email_list on conflict do nothing;

create or replace function private.list_ok(p_key text) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.email_lists where key = p_key) $$;

-- Lists a questionnaire or kiosk sign-up joined, from the interests they ticked.
create or replace function private.inquiry_topics(p_interests text) returns text[]
language sql immutable set search_path = ''
as $$
  with t as (select coalesce(p_interests, '') s),
  k as (select array_remove(array[
      case when s ~* 'building' then 'building' end,
      case when s ~* 'steam|seasonal|camp|weekday' or (s ~* 'workshop' and s !~* 'building') then 'workshops' end,
      case when s ~* 'volunteer' then 'volunteers' end,
      case when s ~* 'council' then 'council' end], null) a from t)
  select case when cardinality(a) = 0 then array['workshops'] else a end from k
$$;

-- Everyone on a list, one row per way they joined (before removals).
create or replace function private.email_audience_src(p_topic text) returns table(email text, name text, src text, pri int)
language sql stable security definer set search_path = ''
as $$
  with l as (select * from private.email_lists where key = p_topic)
  select lower(m.email), m.display_name, 'member', 1 from public.members m, l
    where l.member_choice and m.status = 'approved' and m.email is not null and p_topic = any(m.email_prefs)
  union all
  select lower(m.email), m.display_name, 'role', 2 from public.members m, l
    where cardinality(l.roles) > 0 and m.status = 'approved' and m.email is not null and m.roles && l.roles
  union all
  select lower(u.email::text), coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email::text, '@', 1)), 'admin', 3
    from public.admins a join auth.users u on u.id = a.user_id, l where l.include_admins
  union all
  select e.email, e.name, 'added', 4 from private.list_people e where e.topic = p_topic and e.status = 'on'
  union all
  select lower(i.email), trim(i.first_name || ' ' || i.last_name), case when i.role = 'Workshop guest' then 'kiosk' else 'questionnaire' end, 5
    from public.inquiries i, l where l.member_choice and i.email_updates and p_topic = any(private.inquiry_topics(i.interests))
$$;

create or replace function private.email_audience(p_topic text) returns table(email text, name text)
language sql stable security definer set search_path = ''
as $$
  select distinct on (q.email) q.email, q.name from private.email_audience_src(p_topic) q
  where private.email_ok(q.email)
    and not exists (select 1 from private.list_people x where x.email = q.email and x.topic = p_topic and x.status = 'off')
  order by q.email, q.pri
$$;

-- Members may pick "My account" plus any list marked as a member choice.
create or replace function private.clean_prefs(p text[]) returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p,'{}')) x
    where x = 'account' or exists (select 1 from private.email_lists l where l.key = x and l.member_choice)),'{}');
$$;

-- The site asks which lists to offer families and crew (names only; no people).
create or replace function public.public_email_lists() returns jsonb
language sql stable security definer set search_path = ''
as $$ select coalesce(jsonb_agg(jsonb_build_object('key', key, 'name', name, 'about', about) order by sort, name), '[]'::jsonb) from private.email_lists where member_choice $$;
revoke all on function public.public_email_lists() from public;
grant execute on function public.public_email_lists() to anon, authenticated;

-- Asking again clears an old removal.
create or replace function private.tg_list_reconsent() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare t text[];
begin
  begin
    if tg_table_name = 'members' then
      if new.email is null then return null; end if;
      t := array(select x from unnest(new.email_prefs) x where x <> 'account'
                 and (tg_op = 'INSERT' or not x = any(coalesce(old.email_prefs, '{}'))));
    elsif new.email_updates then
      t := private.inquiry_topics(new.interests);
    end if;
    if cardinality(coalesce(t, '{}')) > 0 then
      delete from private.list_people where email = lower(new.email) and topic = any(t) and status = 'off';
    end if;
  exception when others then raise warning 'list reconsent: %', sqlerrm;
  end;
  return null;
end $$;

-- ---------- Unsubscribe links now name every list the update went to: "workshops.building" ----------
create or replace function private.unsub_url(p_email text, p_topic text) returns text
language sql stable security definer set search_path = ''
as $$ select coalesce(nullif(private.setting('email_site'), ''), 'https://flintracing.org') || '/#unsubscribe/' || encode(convert_to(lower(p_email), 'utf8'), 'hex') || '/' || p_topic || '/' || private.unsub_sig(p_email, p_topic) $$;

create or replace function public.email_unsubscribe(p_e text, p_topic text, p_sig text, p_go boolean default false) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare em text; t text[]; k text; names text[];
begin
  if coalesce(p_topic, '') !~ '^[a-z][a-z0-9]{1,23}(\.[a-z][a-z0-9]{1,23}){0,19}$' or coalesce(p_e, '') !~ '^([0-9a-f]{2}){5,254}$' or coalesce(p_sig, '') !~ '^[0-9a-f]{40}$' then
    raise exception 'This unsubscribe link isn’t valid.'; end if;
  begin em := convert_from(decode(p_e, 'hex'), 'utf8'); exception when others then raise exception 'This unsubscribe link isn’t valid.'; end;
  if p_sig <> private.unsub_sig(em, p_topic) then raise exception 'This unsubscribe link isn’t valid.'; end if;
  t := array(select x from unnest(string_to_array(p_topic, '.')) x where private.list_ok(x));
  names := array(select l.name from private.email_lists l where l.key = any(t) order by l.sort, l.name);
  if not coalesce(p_go, false) then return jsonb_build_object('email', em, 'topic', p_topic, 'names', to_jsonb(names), 'done', false); end if;
  foreach k in array t loop
    update public.members set email_prefs = array_remove(email_prefs, k) where lower(email) = em and k = any(email_prefs);
    if private.email_ok(em) then
      insert into private.list_people(email, topic, status, source) values (em, k, 'off', 'unsubscribed')
        on conflict (email, topic) do update set status = 'off', source = 'unsubscribed', updated_at = now();
    end if;
  end loop;
  -- a questionnaire "send me updates" tick only covers the lists it joined: stop it once all of those are off
  update public.inquiries i set email_updates = false where lower(i.email) = em and i.email_updates
    and not exists (select 1 from unnest(private.inquiry_topics(i.interests)) x
                    where not exists (select 1 from private.list_people o where o.email = em and o.topic = x and o.status = 'off'));
  update private.email_outbox set status = 'skipped', error = 'Unsubscribed before it was sent'
    where kind = 'update' and to_email = em and status = 'queued' and string_to_array(substr(template_key, 8), '.') && t;
  return jsonb_build_object('email', em, 'topic', p_topic, 'names', to_jsonb(names), 'done', true);
end $$;

-- ---------- Admin → Email → Mailing lists ----------
create or replace function private.lists_meta() returns jsonb
language sql stable security definer set search_path = ''
as $$ select coalesce(jsonb_agg(jsonb_build_object('key', l.key, 'name', l.name, 'about', l.about, 'member_choice', l.member_choice, 'roles', to_jsonb(l.roles),
    'include_admins', l.include_admins, 'builtin', l.builtin, 'count', (select count(*) from private.email_audience(l.key))) order by l.sort, l.name), '[]'::jsonb) from private.email_lists l $$;

create or replace function public.admin_lists(p_topic text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if not private.list_ok(p_topic) then raise exception 'Unknown list'; end if;
  return jsonb_build_object(
    'lists', private.lists_meta(),
    'counts', (select jsonb_object_agg(x->>'key', (x->>'count')::int) from jsonb_array_elements(private.lists_meta()) x),
    'people', (select coalesce(jsonb_agg(jsonb_build_object('email', a.email, 'name', a.name,
        'sources', (select coalesce(jsonb_agg(distinct s.src), '[]'::jsonb) from private.email_audience_src(p_topic) s where s.email = a.email),
        'note', (select l.note from private.list_people l where l.email = a.email and l.topic = p_topic and l.status = 'on'),
        'since', (select min(t) from (
          select m.created_at t from public.members m where lower(m.email) = a.email
          union all select l.updated_at from private.list_people l where l.email = a.email and l.topic = p_topic and l.status = 'on'
          union all select i.created_at from public.inquiries i where lower(i.email) = a.email and i.email_updates) w)
      ) order by lower(coalesce(nullif(a.name, ''), a.email))), '[]'::jsonb) from private.email_audience(p_topic) a),
    'removed', (select coalesce(jsonb_agg(jsonb_build_object('email', l.email, 'name', l.name, 'how', l.source, 'at', l.updated_at) order by l.updated_at desc), '[]'::jsonb)
      from private.list_people l where l.topic = p_topic and l.status = 'off'));
end $$;

create or replace function public.admin_list_add(p_topic text, p_people jsonb, p_note text default null, p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare x jsonb; em text; nm text; nt text := nullif(left(trim(regexp_replace(coalesce(p_note, ''), '[\r\n\t]+', ' ', 'g')), 120), '');
  added int := 0; back int := 0; already int := 0; bad jsonb := '[]'::jsonb; unsub jsonb := '[]'::jsonb; seen text[] := '{}'; prev private.list_people;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if not private.list_ok(p_topic) then raise exception 'Choose a list.'; end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) = 0 then raise exception 'Add at least one email address.'; end if;
  if jsonb_array_length(p_people) > 500 then raise exception 'Add up to 500 people at a time.'; end if;
  for x in select * from jsonb_array_elements(p_people) loop
    em := lower(trim(coalesce(x->>'email', '')));
    nm := nullif(left(trim(regexp_replace(coalesce(x->>'name', ''), '[\r\n\t<>"]+', ' ', 'g')), 80), '');
    if not private.email_ok(em) then bad := bad || to_jsonb(left(coalesce(x->>'email', ''), 80)); continue; end if;
    if em = any(seen) then continue; end if;
    seen := seen || em;
    prev := null;
    select * into prev from private.list_people where email = em and topic = p_topic;
    if prev.status = 'off' and prev.source = 'unsubscribed' and not coalesce(p_force, false) then
      unsub := unsub || to_jsonb(em); continue;
    elsif prev.status = 'off' then
      update private.list_people set status = 'on', source = 'added', name = coalesce(nm, name), note = coalesce(nt, note), added_by = auth.uid(), updated_at = now() where email = em and topic = p_topic;
      back := back + 1;
    elsif exists (select 1 from private.email_audience(p_topic) a where a.email = em) then
      already := already + 1;
    else
      insert into private.list_people(email, topic, name, status, source, note, added_by) values (em, p_topic, nm, 'on', 'added', nt, auth.uid())
        on conflict (email, topic) do update set status = 'on', name = coalesce(excluded.name, private.list_people.name), updated_at = now();
      added := added + 1;
    end if;
  end loop;
  return jsonb_build_object('added', added, 'back', back, 'already', already, 'invalid', bad, 'unsubscribed', unsub);
end $$;

create or replace function public.admin_list_remove(p_topic text, p_email text) returns void
language plpgsql security definer set search_path = ''
as $$
declare em text := lower(trim(coalesce(p_email, '')));
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if not private.list_ok(p_topic) then raise exception 'Unknown list'; end if;
  if not private.email_ok(em) then raise exception 'That email address doesn’t look right.'; end if;
  update public.members set email_prefs = array_remove(email_prefs, p_topic) where lower(email) = em and p_topic = any(email_prefs);
  insert into private.list_people(email, topic, name, status, source, added_by)
    values (em, p_topic, (select a.name from private.email_audience(p_topic) a where a.email = em limit 1), 'off', 'removed', auth.uid())
    on conflict (email, topic) do update set status = 'off', source = 'removed', added_by = auth.uid(), updated_at = now();
  update private.email_outbox set status = 'skipped', error = 'Taken off the list before it was sent'
    where kind = 'update' and to_email = em and status = 'queued' and p_topic = any(string_to_array(substr(template_key, 8), '.'));
end $$;

-- Make a new list, or rename one / change whether members can pick it.
create or replace function public.admin_list_save(p_key text, p_name text, p_about text, p_member_choice boolean) returns text
language plpgsql security definer set search_path = ''
as $$
declare nm text := trim(regexp_replace(coalesce(p_name, ''), '[\r\n\t<>"]+', ' ', 'g')); ab text := nullif(left(trim(regexp_replace(coalesce(p_about, ''), '[\r\n\t<>]+', ' ', 'g')), 160), '');
  k text; base text; i int := 1;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if char_length(nm) < 2 or char_length(nm) > 60 then raise exception 'Give the list a name (2 to 60 characters).'; end if;
  if exists (select 1 from private.email_lists where lower(name) = lower(nm) and key is distinct from p_key) then raise exception 'There’s already a list with that name.'; end if;
  if p_key is null then
    if (select count(*) from private.email_lists) >= 30 then raise exception 'That’s a lot of lists. Remove one you don’t use first.'; end if;
    base := left(regexp_replace(lower(nm), '[^a-z0-9]', '', 'g'), 20);
    if base !~ '^[a-z]' then base := 'list' || base; end if;
    if char_length(base) < 2 then base := 'list'; end if;
    k := base;
    while exists (select 1 from private.email_lists where key = k) loop i := i + 1; k := left(base, 20) || i; end loop;
    insert into private.email_lists(key, name, about, member_choice, builtin, sort) values (k, nm, ab, coalesce(p_member_choice, false), false, 100 + (select count(*) from private.email_lists));
    return k;
  end if;
  update private.email_lists set name = nm, about = ab, member_choice = coalesce(p_member_choice, member_choice) where key = p_key;
  if not found then raise exception 'Unknown list'; end if;
  return p_key;
end $$;

-- Remove a list you made (built-in lists stay). Hand-added people on it are cleared; nothing else changes.
create or replace function public.admin_list_delete(p_key text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if exists (select 1 from private.email_lists where key = p_key and builtin) then raise exception 'The starting lists can’t be removed.'; end if;
  update public.members set email_prefs = array_remove(email_prefs, p_key) where p_key = any(email_prefs);
  delete from private.email_lists where key = p_key;
  if not found then raise exception 'Unknown list'; end if;
end $$;

-- ---------- Send an update to one or more lists (each person gets one copy) ----------
create or replace function public.admin_email_send_update(p_topics text[], p_subject text, p_body text, p_test boolean default false) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s text := trim(regexp_replace(coalesce(p_subject, ''), '[\r\n\t]+', ' ', 'g')); b text := trim(coalesce(p_body, '')); n int; v_batch uuid := gen_random_uuid(); addr text; fn text;
  t text[] := array(select distinct x from unnest(coalesce(p_topics, '{}')) x where private.list_ok(x) order by x);
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if cardinality(t) = 0 then raise exception 'Choose at least one list.'; end if;
  if coalesce(private.setting('email_on'), 'true') <> 'true' then raise exception 'Email is switched off. Turn it on first.'; end if;
  if char_length(s) < 3 or char_length(s) > 150 then raise exception 'The subject needs 3 to 150 characters.'; end if;
  if char_length(b) < 10 or char_length(b) > 8000 then raise exception 'The message needs 10 to 8,000 characters.'; end if;
  if coalesce(p_test, false) then
    select coalesce(nullif(trim(nn.send_to), ''), u.email::text), coalesce(nullif(private.email_safe(split_part(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ' ', 1), 40), ''), 'there')
      into addr, fn from auth.users u left join private.admin_notify nn on nn.user_id = u.id where u.id = auth.uid();
    perform private.email_queue('test', addr, null, '[Test] ' || s, private.email_fill(b, jsonb_build_object('first_name', fn)), null, null, null,
      'update:' || array_to_string(t, '.'), auth.uid(), null, private.unsub_url(addr, array_to_string(t, '.')));
    return jsonb_build_object('ok', true, 'test', true, 'to', addr);
  end if;
  if (select count(distinct batch) from private.email_outbox where kind = 'update' and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Three updates have already gone out in the last day. Try again tomorrow.'; end if;
  select count(distinct a.email) into n from unnest(t) k cross join lateral private.email_audience(k) a;
  if n = 0 then raise exception 'No one is on those lists yet.'; end if;
  if n > 2000 then raise exception 'That’s too many people to send to from the website at once.'; end if;
  insert into private.email_outbox(kind, to_email, to_name, subject, body, template_key, created_by, batch, unsub_url)
    select 'update', u.email, nullif(left(regexp_replace(coalesce(u.name, ''), '[\r\n\t<>"]+', ' ', 'g'), 80), ''), left(s, 180),
      private.email_fill(b, jsonb_build_object('first_name', coalesce(nullif(private.email_safe(split_part(trim(coalesce(u.name, '')), ' ', 1), 40), ''), 'there'))),
      'update:' || array_to_string(u.topics, '.'), auth.uid(), v_batch, private.unsub_url(u.email, array_to_string(u.topics, '.'))
    from (select a.email, min(a.name) as name, array_agg(distinct k order by k) as topics
            from unnest(t) k cross join lateral private.email_audience(k) a group by a.email) u;
  return jsonb_build_object('ok', true, 'count', n);
end $$;

-- How many different people a set of lists reaches (duplicates counted once), for the Send screen.
create or replace function public.admin_lists_reach(p_topics text[]) returns int
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  return (select count(distinct a.email) from unnest(coalesce(p_topics, '{}')) k cross join lateral private.email_audience(k) a where private.list_ok(k));
end $$;

-- Overview: every list with its count.
create or replace function public.admin_email_overview() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); me private.admin_notify; my_email text; prov jsonb;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  select * into me from private.admin_notify where user_id = uid;
  select email::text into my_email from auth.users where id = uid;
  begin prov := coalesce(nullif(private.setting('email_provider'), ''), '{}')::jsonb; exception when others then prov := '{}'::jsonb; end;
  return jsonb_build_object(
    'settings', jsonb_build_object('on', coalesce(private.setting('email_on'), 'true') = 'true', 'from_name', coalesce(private.setting('email_from_name'), ''),
      'from_addr', coalesce(private.setting('email_from_addr'), ''), 'reply_to', coalesce(private.setting('email_reply_to'), ''), 'footer', coalesce(private.setting('email_footer'), '')),
    'provider', prov,
    'me', jsonb_build_object('email', my_email, 'events', coalesce(to_jsonb(me.events), '[]'::jsonb), 'send_to', coalesce(me.send_to, '')),
    'templates', (select coalesce(jsonb_agg(jsonb_build_object('key', t.key, 'name', t.name, 'audience', t.audience, 'hint', t.hint, 'subject', t.subject, 'body', t.body,
        'auto_event', t.auto_event, 'auto_send', t.auto_send, 'updated_at', t.updated_at) order by t.sort), '[]'::jsonb) from private.email_templates t),
    'counts', jsonb_build_object(
      'waiting', (select count(*) from private.email_outbox where status in ('queued','sending')),
      'sent', (select count(*) from private.email_outbox where status = 'sent' and created_at > now() - interval '30 days'),
      'failed', (select count(*) from private.email_outbox where status = 'failed' and created_at > now() - interval '30 days'),
      'today', (select count(*) from private.email_outbox where status = 'sent' and sent_at > now() - interval '24 hours')),
    'lists', private.lists_meta());
end $$;

-- The sending function also learns the list names, for the "why you're getting this" line.
create or replace function public.email_claim(p_key text, p_limit int, p_ready boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_rows jsonb;
begin
  if p_key is null or p_key <> private.secret('email_hook_key') then raise exception 'forbidden'; end if;
  insert into private.settings(key, value) values ('email_provider', jsonb_build_object('ready', coalesce(p_ready, false), 'at', now(), 'note', left(coalesce(p_note, ''), 200))::text)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  update private.email_outbox set status = 'skipped', error = 'Waited more than 7 days, so it was not sent' where status = 'queued' and created_at < now() - interval '7 days';
  if not coalesce(p_ready, false) or coalesce(private.setting('email_on'), 'true') <> 'true' then
    return jsonb_build_object('rows', '[]'::jsonb);
  end if;
  with c as (
    select id from private.email_outbox
     where (status = 'queued' and next_try_at <= now()) or (status = 'sending' and claimed_at < now() - interval '10 minutes')
     order by (kind = 'update'), created_at limit least(greatest(coalesce(p_limit, 10), 1), 25) for update skip locked),
  u as (
    update private.email_outbox o set status = 'sending', attempts = o.attempts + 1, claimed_at = now() from c where o.id = c.id
    returning o.id, o.kind, o.to_email, o.to_name, o.subject, o.body, o.reply_to, o.unsub_url, o.template_key, o.attempts, o.created_at)
  select coalesce(jsonb_agg(to_jsonb(u) order by (u.kind = 'update'), u.created_at), '[]'::jsonb) into v_rows from u;
  return jsonb_build_object('rows', v_rows, 'from_name', private.setting('email_from_name'), 'from_addr', private.setting('email_from_addr'),
    'reply_to', private.setting('email_reply_to'), 'footer', private.setting('email_footer'), 'site', private.setting('email_site'),
    'lists', (select coalesce(jsonb_object_agg(key, name), '{}'::jsonb) from private.email_lists));
end $$;

revoke all on function public.admin_list_save(text, text, text, boolean), public.admin_list_delete(text), public.admin_email_send_update(text[], text, text, boolean), public.admin_lists_reach(text[]) from public, anon, authenticated;
grant execute on function public.admin_list_save(text, text, text, boolean), public.admin_list_delete(text), public.admin_email_send_update(text[], text, text, boolean), public.admin_lists_reach(text[]) to authenticated;
revoke all on function private.list_ok(text), private.email_audience_src(text), private.lists_meta() from public, anon, authenticated;

-- the earlier one-list send step is retired (kept, but nobody can call it)
revoke all on function public.admin_email_update(text, text, text, boolean) from public, anon, authenticated;
