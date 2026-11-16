-- Flint Racing & STEM: email notifications, part 1 (queue, settings, messages, sending hooks)
-- Applied to Supabase project FlintRacingandSTEM on Nov 16, 2026. No secrets live in this file.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Two random keys kept encrypted in Vault: one lets only this database wake the sending function,
-- one signs unsubscribe links.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'email_hook_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'email_hook_key', 'Shared key between the database and the send-email function');
  end if;
  if not exists (select 1 from vault.secrets where name = 'email_unsub_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'email_unsub_key', 'Signs unsubscribe links');
  end if;
end $$;

create or replace function private.secret(p_name text) returns text
language sql stable security definer set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1 $$;

create or replace function private.setting(p_key text) returns text
language sql stable security definer set search_path = ''
as $$ select value from private.settings where key = p_key $$;

insert into private.settings(key, value) values
  ('email_on', 'true'),
  ('email_from_name', 'Flint Racing & STEM'),
  ('email_from_addr', ''),
  ('email_reply_to', 'info@flintsoapbox.org'),
  ('email_footer', 'Flint Racing & STEM · Flint, Michigan · flintracing.org'),
  ('email_site', 'https://flintracing.org'),
  ('email_fn_url', 'https://zoypyxeaxxxjvkmsjgro.supabase.co/functions/v1/send-email'),
  ('email_provider', '{}')
on conflict (key) do nothing;

-- ---------- Tables (private schema: not reachable from the website's API) ----------
create table if not exists private.email_templates (
  key text primary key,
  name text not null,
  audience text not null check (audience in ('inquiry','member','registration')),
  hint text,
  subject text not null check (char_length(subject) between 3 and 150),
  body text not null check (char_length(body) between 10 and 8000),
  auto_event text check (auto_event in ('inquiry_new','member_new','member_approved','registration_new')),
  auto_send boolean not null default false,
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists private.email_outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('admin_alert','reply','auto','update','test')),
  to_email text not null,
  to_name text,
  subject text not null,
  body text not null,
  reply_to text,
  ref_table text,
  ref_id uuid,
  template_key text,
  batch uuid,
  unsub_url text,
  created_by uuid,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  attempts int not null default 0,
  next_try_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  error text
);
create index if not exists email_outbox_due_idx on private.email_outbox (next_try_at) where status in ('queued','sending');
create index if not exists email_outbox_recent_idx on private.email_outbox (created_at desc);
create index if not exists email_outbox_ref_idx on private.email_outbox (ref_table, ref_id);

create table if not exists private.admin_notify (
  user_id uuid primary key references auth.users(id) on delete cascade,
  events text[] not null default '{}',
  send_to text,
  updated_at timestamptz not null default now()
);

alter table private.email_templates enable row level security;
alter table private.email_outbox enable row level security;
alter table private.admin_notify enable row level security;
revoke all on private.email_templates, private.email_outbox, private.admin_notify from public, anon, authenticated;

create index if not exists inquiries_created_at_idx on public.inquiries (created_at desc);

-- ---------- Helpers ----------
create or replace function private.email_ok(p text) returns boolean
language sql immutable set search_path = ''
as $$ select p is not null and char_length(p) <= 254 and p ~ '^[^@[:space:]<>,;:"''()]+@[^@[:space:]<>,;:"''()]+\.[A-Za-z]{2,24}$' $$;

-- Words typed by the public that get dropped into a message: keep plain characters only, so nobody
-- can use the forms to send links or odd formatting to someone else's inbox.
create or replace function private.email_safe(p text, p_max int) returns text
language sql immutable set search_path = ''
as $$ select left(trim(regexp_replace(regexp_replace(coalesce(p,''), '[^[:alnum:] ,&''()/+#-]', '', 'g'), '\s+', ' ', 'g')), p_max) $$;

create or replace function private.email_fill(p text, v jsonb) returns text
language plpgsql immutable set search_path = ''
as $$
declare k text; val text; o text := coalesce(p, '');
begin
  for k, val in select key, value from jsonb_each_text(coalesce(v, '{}'::jsonb)) loop
    o := replace(o, '{{' || k || '}}', coalesce(val, ''));
  end loop;
  return regexp_replace(o, '\{\{[a-z_]+\}\}', '', 'g');
end $$;

create or replace function private.email_vars(p_table text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare site text := coalesce(nullif(private.setting('email_site'), ''), 'https://flintracing.org'); v jsonb;
  i public.inquiries; m public.members; r public.race_registrations;
begin
  v := jsonb_build_object('site', site, 'sign_in_link', site || '/#access', 'calendar_link', site || '/#calendar',
    'race_link', site || '/#race-registration', 'workshop_link', site || '/#workshop-registration', 'register_link', site || '/#new-profile');
  if p_table = 'inquiries' then
    select * into i from public.inquiries where id = p_id;
    if i.id is null then return null; end if;
    return v || jsonb_build_object('to_email', lower(i.email), 'to_name', private.email_safe(i.first_name || ' ' || i.last_name, 80),
      'first_name', coalesce(nullif(private.email_safe(i.first_name, 40), ''), 'there'), 'name', private.email_safe(i.first_name || ' ' || i.last_name, 80),
      'interests', coalesce(nullif(lower(private.email_safe(i.interests, 160)), ''), 'our programs'), 'organization', private.email_safe(i.organization, 80));
  elsif p_table = 'members' then
    select * into m from public.members where id = p_id;
    if m.id is null then return null; end if;
    return v || jsonb_build_object('to_email', lower(m.email), 'to_name', private.email_safe(m.display_name, 80),
      'first_name', coalesce(nullif(private.email_safe(split_part(trim(m.display_name), ' ', 1), 40), ''), 'there'), 'name', private.email_safe(m.display_name, 80),
      'username', m.username, 'pass_name', case when m.kind = 'family' then 'Family Pass (car #8)' else 'Crew Pass (car #12)' end,
      'prefs', to_jsonb(m.email_prefs));
  elsif p_table = 'race_registrations' then
    select * into r from public.race_registrations where id = p_id;
    if r.id is null then return null; end if;
    return v || jsonb_build_object('to_email', lower(r.parent_email), 'to_name', private.email_safe(r.parent_name, 80),
      'first_name', coalesce(nullif(private.email_safe(split_part(trim(r.parent_name), ' ', 1), 40), ''), 'there'), 'name', private.email_safe(r.parent_name, 80),
      'participant', coalesce(nullif(private.email_safe(r.participant_name, 80), ''), 'your racer'),
      'program', case when r.program = 'building_workshop' then 'building workshop' else 'race' end, 'division', private.email_safe(r.division, 40));
  end if;
  return null;
end $$;

-- Put one message in the queue. Returns null (and queues nothing) when email is switched off or the address is bad.
create or replace function private.email_queue(p_kind text, p_to text, p_to_name text, p_subject text, p_body text, p_reply_to text,
  p_ref_table text, p_ref_id uuid, p_template text, p_by uuid, p_batch uuid, p_unsub text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; addr text := lower(trim(coalesce(p_to, '')));
begin
  if coalesce(private.setting('email_on'), 'true') <> 'true' then return null; end if;
  if not private.email_ok(addr) then return null; end if;
  insert into private.email_outbox(kind, to_email, to_name, subject, body, reply_to, ref_table, ref_id, template_key, created_by, batch, unsub_url)
    values (p_kind, addr, nullif(left(regexp_replace(coalesce(p_to_name, ''), '[\r\n\t<>"]+', ' ', 'g'), 80), ''),
      left(trim(regexp_replace(coalesce(p_subject, ''), '[\r\n\t]+', ' ', 'g')), 180), left(coalesce(p_body, ''), 20000),
      case when private.email_ok(lower(trim(coalesce(p_reply_to, '')))) then lower(trim(p_reply_to)) end,
      p_ref_table, p_ref_id, p_template, p_by, p_batch, p_unsub)
    returning id into v_id;
  return v_id;
end $$;

-- Wake the sending function (only when something is due). Never raises: a failed wake-up must not block a form.
create or replace function private.email_kick() returns void
language plpgsql security definer set search_path = ''
as $$
declare u text; k text;
begin
  if not exists (select 1 from private.email_outbox where (status = 'queued' and next_try_at <= now()) or (status = 'sending' and claimed_at < now() - interval '10 minutes')) then return; end if;
  u := private.setting('email_fn_url'); k := private.secret('email_hook_key');
  if coalesce(u, '') = '' or coalesce(k, '') = '' then return; end if;
  perform net.http_post(url := u, body := '{}'::jsonb, headers := jsonb_build_object('Content-Type', 'application/json', 'x-fr-key', k), timeout_milliseconds := 8000);
exception when others then
  raise warning 'email_kick: %', sqlerrm;
end $$;

create or replace function private.tg_email_kick() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin perform private.email_kick(); return null; end $$;

drop trigger if exists email_outbox_kick on private.email_outbox;
create trigger email_outbox_kick after insert on private.email_outbox for each statement execute function private.tg_email_kick();

-- Tell each admin who asked for this kind of alert. At most 30 alerts an hour per inbox, then one "lots of activity" note.
create or replace function private.email_alert(p_event text, p_subject text, p_body text, p_reply_to text, p_ref_table text, p_ref_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare a record; n int; site text := coalesce(nullif(private.setting('email_site'), ''), 'https://flintracing.org');
begin
  for a in select coalesce(nullif(trim(n2.send_to), ''), u.email::text) addr from private.admin_notify n2
      join public.admins ad on ad.user_id = n2.user_id join auth.users u on u.id = n2.user_id where p_event = any(n2.events) loop
    select count(*) into n from private.email_outbox where kind = 'admin_alert' and to_email = lower(a.addr) and created_at > now() - interval '1 hour';
    if n < 30 then
      perform private.email_queue('admin_alert', a.addr, null, p_subject, p_body, p_reply_to, p_ref_table, p_ref_id, 'alert:' || p_event, null, null, null);
    elsif n = 30 then
      perform private.email_queue('admin_alert', a.addr, null, 'Lots of new activity on flintracing.org',
        'More than 30 new submissions came in during the last hour, so email alerts are paused until things slow down.' || E'\n\n' ||
        'Everything is saved. Open Admin to see it all: ' || site || '/#admin', null, null, null, 'alert:overflow', null, null, null);
    end if;
  end loop;
end $$;

-- Send a pre-approved message automatically, if its "send automatically" switch is on.
create or replace function private.email_auto(p_event text, p_table text, p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare t private.email_templates; v jsonb; addr text;
begin
  select * into t from private.email_templates where auto_event = p_event and auto_send order by sort limit 1;
  if t.key is null then return; end if;
  v := private.email_vars(p_table, p_id);
  if v is null then return; end if;
  addr := v->>'to_email';
  if not private.email_ok(addr) then return; end if;
  if p_table = 'members' and not coalesce(v->'prefs' ? 'account', false) then return; end if;
  -- one automatic message per address per day for each message, and a ceiling for the whole site
  if exists (select 1 from private.email_outbox where kind = 'auto' and template_key = t.key and to_email = addr and created_at > now() - interval '24 hours') then return; end if;
  if (select count(*) from private.email_outbox where kind = 'auto' and created_at > now() - interval '1 hour') >= 40 then return; end if;
  perform private.email_queue('auto', addr, v->>'to_name', private.email_fill(t.subject, v), private.email_fill(t.body, v), null, p_table, p_id, t.key, null, null, null);
end $$;

-- ---------- What triggers an email ----------
create or replace function private.tg_email_inquiry() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare site text; nm text;
begin
  begin
    if new.role = 'Workshop guest' then return null; end if;  -- kiosk mailing-list sign-ups: no alert
    site := coalesce(nullif(private.setting('email_site'), ''), 'https://flintracing.org');
    nm := trim(new.first_name || ' ' || new.last_name);
    perform private.email_alert('inquiry', 'New inquiry: ' || left(nm, 60) || ' · ' || left(new.interests, 70),
      'A new inquiry came in on flintracing.org.' || E'\n\n' ||
      'Name: ' || nm || E'\n' ||
      'They are: ' || new.role || coalesce(' · ' || nullif(new.organization, ''), '') || E'\n' ||
      'Interested in: ' || new.interests || E'\n' ||
      case when new.youth_count is not null or coalesce(new.youth_ages, '') <> '' then 'Young people: ' || concat_ws(', ', new.youth_count::text, 'ages ' || nullif(new.youth_ages, '')) || E'\n' else '' end ||
      'Email: ' || new.email || E'\n' ||
      coalesce('Phone: ' || nullif(new.phone, '') || E'\n', '') ||
      'Best way to reach them: ' || new.contact_by || coalesce(' · ' || nullif(new.best_time, ''), '') || E'\n' ||
      case when new.email_updates then 'Wants email updates: yes' || E'\n' else '' end ||
      coalesce(E'\n' || 'Their message:' || E'\n' || nullif(new.message, '') || E'\n', '') || E'\n' ||
      'Reply to this email to write back to ' || new.first_name || ' directly, or send a pre-approved reply from Admin:' || E'\n' || site || '/#admin',
      new.email, 'inquiries', new.id);
    perform private.email_auto('inquiry_new', 'inquiries', new.id);
  exception when others then
    raise warning 'email (inquiry): %', sqlerrm;
  end;
  return null;
end $$;

create or replace function private.tg_email_member() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare site text; kiosk boolean;
begin
  begin
    site := coalesce(nullif(private.setting('email_site'), ''), 'https://flintracing.org');
    if tg_op = 'INSERT' then
      kiosk := new.status = 'approved';
      -- an admin's own participant profile is made automatically: nothing to announce
      if exists (select 1 from auth.users u join public.admins a on a.user_id = u.id where lower(u.email) = lower(new.email)) then return null; end if;
      perform private.email_alert(case when kiosk then 'kiosk' else 'profile' end,
        case when kiosk then 'New family at the kiosk: ' else 'New profile to approve: ' end || left(new.display_name, 60),
        case when kiosk then 'A family registered at the workshop check-in kiosk. They are already approved.'
             else 'Someone registered a profile on flintracing.org and is waiting for your approval.' end || E'\n\n' ||
        'Name: ' || new.display_name || E'\n' ||
        'Type: ' || case when new.kind = 'family' then 'Family' || ' (' || jsonb_array_length(new.kids) || ' racer' || case when jsonb_array_length(new.kids) = 1 then '' else 's' end || ')' else 'Crew' end || E'\n' ||
        case when new.kind <> 'family' and cardinality(new.requested) > 0 then 'Asked for: ' || array_to_string(new.requested, ', ') || E'\n' else '' end ||
        'Username: ' || new.username || E'\n' ||
        coalesce('Email: ' || nullif(new.email, '') || E'\n', '') ||
        coalesce('Phone: ' || nullif(new.phone, '') || E'\n', '') ||
        coalesce(E'\n' || 'Note from them:' || E'\n' || nullif(new.about, '') || E'\n', '') || E'\n' ||
        case when kiosk then 'See their profile in Admin → Members: ' else 'Approve them and choose their roles in Admin → Members: ' end || site || '/#admin',
        new.email, 'members', new.id);
      perform private.email_auto(case when kiosk then 'member_approved' else 'member_new' end, 'members', new.id);
    elsif new.status = 'approved' and old.status is distinct from 'approved' and old.approved_at is null then
      perform private.email_auto('member_approved', 'members', new.id);
    end if;
  exception when others then
    raise warning 'email (member): %', sqlerrm;
  end;
  return null;
end $$;

create or replace function private.tg_email_registration() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare site text; prog text;
begin
  begin
    site := coalesce(nullif(private.setting('email_site'), ''), 'https://flintracing.org');
    prog := case when new.program = 'building_workshop' then 'building workshop' else 'race' end;
    -- No birth date, address or medical details in email: those stay in Admin.
    perform private.email_alert('registration', 'New ' || prog || ' registration: ' || left(new.participant_name, 60),
      'A signed ' || prog || ' registration form came in on flintracing.org.' || E'\n\n' ||
      'Participant: ' || new.participant_name || E'\n' ||
      'Division: ' || new.division || E'\n' ||
      'Parent or guardian: ' || new.parent_name || ' (' || new.relationship || ')' || E'\n' ||
      'Email: ' || new.parent_email || E'\n' ||
      'Phone: ' || new.phone || E'\n\n' ||
      'The full form is in Admin → Registrations: ' || site || '/#admin',
      new.parent_email, 'race_registrations', new.id);
    perform private.email_auto('registration_new', 'race_registrations', new.id);
  exception when others then
    raise warning 'email (registration): %', sqlerrm;
  end;
  return null;
end $$;

create or replace function private.tg_email_volunteer() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare site text;
begin
  begin
    site := coalesce(nullif(private.setting('email_site'), ''), 'https://flintracing.org');
    perform private.email_alert('volunteer', 'New race-day volunteer: ' || left(new.first_name || ' ' || new.last_name, 60),
      'Someone signed up to volunteer on race day.' || E'\n\n' ||
      'Name: ' || new.first_name || ' ' || new.last_name || E'\n' ||
      'Email: ' || new.email || E'\n' ||
      coalesce('Phone: ' || nullif(new.phone, '') || E'\n', '') ||
      'Would like to help with: ' || case new.area when 'event' then 'the event' when 'track' then 'the track' else 'either the event or the track' end || E'\n' ||
      coalesce('Shift: ' || nullif(new.shift, '') || E'\n', '') ||
      case when new.over18 then '' else 'Under 18' || E'\n' end ||
      coalesce(E'\n' || 'Note from them:' || E'\n' || nullif(new.notes, '') || E'\n', '') || E'\n' ||
      'Confirm and assign them in Volunteer lists: ' || site || '/#volunteers',
      new.email, 'race_volunteers', new.id);
  exception when others then
    raise warning 'email (volunteer): %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists email_on_inquiry on public.inquiries;
create trigger email_on_inquiry after insert on public.inquiries for each row execute function private.tg_email_inquiry();
drop trigger if exists email_on_member_new on public.members;
create trigger email_on_member_new after insert on public.members for each row execute function private.tg_email_member();
drop trigger if exists email_on_member_approved on public.members;
create trigger email_on_member_approved after update of status on public.members for each row execute function private.tg_email_member();
drop trigger if exists email_on_registration on public.race_registrations;
create trigger email_on_registration after insert on public.race_registrations for each row execute function private.tg_email_registration();
drop trigger if exists email_on_volunteer on public.race_volunteers;
create trigger email_on_volunteer after insert on public.race_volunteers for each row execute function private.tg_email_volunteer();

-- The questionnaire is open to the public. Cap how fast it can be filled so it can't be used to flood the inbox.
create or replace function private.tg_inquiry_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.inquiries where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'We’re getting a lot of messages right now. Please try again in a few minutes, or email info@flintsoapbox.org.';
  end if;
  return new;
end $$;
drop trigger if exists inquiries_guard on public.inquiries;
create trigger inquiries_guard before insert on public.inquiries for each row execute function private.tg_inquiry_guard();

-- ---------- The sending function's two doors (service role only, and only with the database's own key) ----------
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
    'reply_to', private.setting('email_reply_to'), 'footer', private.setting('email_footer'), 'site', private.setting('email_site'));
end $$;

create or replace function public.email_done(p_key text, p_id uuid, p_result text, p_provider_id text default null, p_error text default null, p_wait_minutes int default null) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_key is null or p_key <> private.secret('email_hook_key') then raise exception 'forbidden'; end if;
  if p_result = 'sent' then
    update private.email_outbox set status = 'sent', sent_at = now(), provider_id = left(p_provider_id, 80), error = null where id = p_id and status = 'sending';
  elsif p_result = 'failed' then
    update private.email_outbox set status = 'failed', error = left(p_error, 300) where id = p_id and status = 'sending';
  elsif p_result = 'wait' then   -- the provider's daily or monthly allowance ran out: try again later, without using up a try
    update private.email_outbox set status = 'queued', attempts = greatest(attempts - 1, 0), error = left(p_error, 300),
      next_try_at = now() + make_interval(mins => least(greatest(coalesce(p_wait_minutes, 60), 1), 1440)) where id = p_id and status = 'sending';
  else                            -- 'retry': a hiccup; back off 2, 8, 18, 32 minutes, then give up
    update private.email_outbox set status = case when attempts >= 5 then 'failed' else 'queued' end, error = left(p_error, 300),
      next_try_at = now() + make_interval(mins => 2 * attempts * attempts) where id = p_id and status = 'sending';
  end if;
end $$;

revoke all on function public.email_claim(text, int, boolean, text) from public, anon, authenticated;
revoke all on function public.email_done(text, uuid, text, text, text, int) from public, anon, authenticated;
grant execute on function public.email_claim(text, int, boolean, text) to service_role;
grant execute on function public.email_done(text, uuid, text, text, text, int) to service_role;

-- Keep private helpers private even if the schema were ever exposed.
revoke all on function private.secret(text), private.setting(text), private.email_ok(text), private.email_safe(text, int), private.email_fill(text, jsonb),
  private.email_vars(text, uuid), private.email_queue(text, text, text, text, text, text, text, uuid, text, uuid, uuid, text), private.email_kick(),
  private.tg_email_kick(), private.email_alert(text, text, text, text, text, uuid), private.email_auto(text, text, uuid),
  private.tg_email_inquiry(), private.tg_email_member(), private.tg_email_registration(), private.tg_email_volunteer(), private.tg_inquiry_guard()
  from public, anon, authenticated;

-- Retry anything left over every 5 minutes; clear messages older than 6 months once a day.
select cron.unschedule(jobname) from cron.job where jobname in ('fr-email-sweep', 'fr-email-tidy');
select cron.schedule('fr-email-sweep', '*/5 * * * *', $$select private.email_kick()$$);
select cron.schedule('fr-email-tidy', '17 8 * * *', $$delete from private.email_outbox where created_at < now() - interval '180 days'$$);
