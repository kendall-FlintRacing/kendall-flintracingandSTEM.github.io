-- Flint Racing & STEM: email notifications, part 2 (pre-approved messages, Admin tools, member choices, unsubscribe)
-- Applied to Supabase project FlintRacingandSTEM on Nov 16, 2026. No secrets live in this file.

-- One wake-up per transaction is plenty, however many messages it queued.
create or replace function private.email_kick() returns void
language plpgsql security definer set search_path = ''
as $$
declare u text; k text; tx text := txid_current()::text;
begin
  if current_setting('fr.email_kicked', true) = tx then return; end if;
  if not exists (select 1 from private.email_outbox where (status = 'queued' and next_try_at <= now()) or (status = 'sending' and claimed_at < now() - interval '10 minutes')) then return; end if;
  u := private.setting('email_fn_url'); k := private.secret('email_hook_key');
  if coalesce(u, '') = '' or coalesce(k, '') = '' then return; end if;
  perform net.http_post(url := u, body := '{}'::jsonb, headers := jsonb_build_object('Content-Type', 'application/json', 'x-fr-key', k), timeout_milliseconds := 8000);
  perform set_config('fr.email_kicked', tx, true);
exception when others then
  raise warning 'email_kick: %', sqlerrm;
end $$;

-- ---------- Pre-approved messages ----------
insert into private.email_templates(key, name, audience, hint, subject, body, auto_event, auto_send, sort) values
('inquiry_reply', 'Thanks for reaching out', 'inquiry', 'A first reply to anyone who fills out the questionnaire.',
 'Thanks for reaching out to Flint Racing and STEM',
 E'Hi {{first_name}},\n\nThank you for reaching out to Flint Racing and STEM. We received your note about {{interests}} and we''re glad you''re interested.\n\nSomeone from our team will follow up with you personally with next steps. In the meantime, you can see what''s coming up on our calendar:\n{{calendar_link}}\n\nIf you have questions, just reply to this email.\n\nFlint Racing and STEM',
 'inquiry_new', false, 10),
('account_invite', 'Create your account (instructions)', 'inquiry', 'Invites a family or volunteer to register a profile, with step-by-step instructions.',
 'Next step: create your Flint Racing account',
 E'Hi {{first_name}},\n\nThanks for your interest in Flint Racing and STEM. The next step is to create your free account, which takes about two minutes:\n\n1. Go to {{register_link}}\n2. Choose Family (for racers and their grown-ups) or Crew (for volunteers and helpers).\n3. Enter your name and email, then pick a 4-digit code you''ll remember. That code is how you sign in.\n4. Press Register.\n\nWe review every new profile, usually within a few days, and email you as soon as it''s approved. After that you can sign in to see workshop dates, times and places.\n\nIf you get stuck, just reply to this email.\n\nFlint Racing and STEM',
 null, false, 20),
('reg_link_race', 'Race registration form', 'inquiry', 'Sends the official race registration form link. Send after you confirm their place.',
 '2027 Flint Soap Box Derby race registration',
 E'Hi {{first_name}},\n\nThanks for reaching out to Flint Racing and STEM. To complete race registration, please fill out and sign the official All-American Soap Box Derby Local Race Registration Form here:\n\n{{race_link}}\n\nA parent or guardian needs to complete and sign their section. Reply to this email with any questions.\n\nFlint Racing and STEM',
 null, false, 30),
('reg_link_workshop', 'Building workshop registration form', 'inquiry', 'Sends the building workshop registration form link. Send after you confirm their place.',
 'Flint Racing building workshop registration',
 E'Hi {{first_name}},\n\nThanks for reaching out to Flint Racing and STEM. To complete building workshop registration, please fill out and sign the official All-American Soap Box Derby registration form, along with the T-shirt size and safe check-in details, here:\n\n{{workshop_link}}\n\nA parent or guardian needs to complete and sign their section. Reply to this email with any questions.\n\nFlint Racing and STEM',
 null, false, 40),
('account_received', 'We received your profile', 'member', 'Lets a new family or crew member know their profile is waiting for review.',
 'We received your Flint Racing profile',
 E'Hi {{first_name}},\n\nThanks for registering with Flint Racing and STEM. Your profile is in, and our team reviews every new profile, usually within a few days.\n\nYou''ll get another email as soon as it''s approved. Nothing else is needed from you right now.\n\nIf you have questions, just reply to this email.\n\nFlint Racing and STEM',
 'member_new', false, 50),
('account_approved', 'Account approved (sign-in instructions)', 'member', 'Tells them they''re approved and how to sign in. It never includes their code.',
 'Your Flint Racing account is ready',
 E'Hi {{first_name}},\n\nGood news: your Flint Racing and STEM profile is approved. Here''s how to sign in:\n\n1. Go to {{sign_in_link}}\n2. Choose the {{pass_name}}.\n3. Enter your email address and the 4-digit code you picked when you registered.\n\nOnce you''re in, your dashboard shows workshop dates, times and places, and you can choose which emails you get from us. Families use the same 4-digit code to check in at the workshop kiosk.\n\nForgot your code? Reply to this email and we''ll help you reset it.\n\nFlint Racing and STEM',
 'member_approved', false, 60),
('registration_received', 'We received your registration form', 'registration', 'Confirms a signed race or building workshop registration form.',
 'We received the registration for {{participant}}',
 E'Hi {{first_name}},\n\nThank you. We received the signed {{program}} registration form for {{participant}}.\n\nOur team will review it and follow up with you about fees and next steps. Submitting the form does not confirm a place yet.\n\nIf anything on the form needs to change, just reply to this email.\n\nFlint Racing and STEM',
 'registration_new', false, 70)
on conflict (key) do nothing;

-- ---------- Admin alerts: on for the accounts that are admins today ----------
insert into private.admin_notify(user_id, events)
  select user_id, '{inquiry,profile,kiosk,registration,volunteer}' from public.admins
on conflict (user_id) do nothing;

-- ---------- Member email choices: add "My account" ----------
create or replace function private.clean_prefs(p text[]) returns text[]
language sql immutable set search_path = ''
as $$
  select coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p,'{}')) x where x in ('account','workshops','council')),'{}');
$$;
update public.members set email_prefs = array_append(email_prefs, 'account') where not ('account' = any(email_prefs));

-- Families who register at the kiosk get account emails unless they turn them off on their dashboard.
create or replace function public.kiosk_register_family(p_name text, p_email text, p_phone text, p_kids jsonb, p_code text, p_adults integer, p_event uuid, p_prefs text[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare m public.members; d date := (now() at time zone 'America/Detroit')::date; names jsonb;
begin
  if not private.has_staff('workshop') then raise exception 'The kiosk needs a workshop staff sign-in'; end if;
  m := private.new_member(p_name, 'family', p_email, p_phone, p_kids, '{family}', 'Registered at the workshop check-in kiosk.', p_code, null, coalesce(p_prefs, '{}') || array['account'], 'approved', '{family}');
  select coalesce(jsonb_agg(k->>'name'),'[]'::jsonb) into names from jsonb_array_elements(m.kids) k;
  insert into public.workshop_signins(session_date, event_id, last_name, kids, volunteers, notes, created_by, member_id, kid_names, source)
    values (d, p_event, regexp_replace(trim(m.display_name), '^.*\s', ''), jsonb_array_length(names), least(greatest(coalesce(p_adults,0),0),10),
      'New family · registered at the kiosk', auth.uid(), m.id, names, 'kiosk');
  perform private.log(m.id, m.username, 'register', 'family · kiosk');
  return jsonb_build_object('ok', true, 'family', regexp_replace(trim(m.display_name), '^.*\s', ''), 'kids', names);
end $function$;

-- ---------- Who gets an update, and unsubscribe links ----------
create or replace function private.email_audience(p_topic text) returns table(email text, name text)
language sql stable security definer set search_path = ''
as $$
  select distinct on (q.e) q.e, q.n from (
    select lower(m.email) e, m.display_name n, 1 pri from public.members m
      where m.status = 'approved' and m.email is not null and p_topic = any(m.email_prefs)
    union all
    select lower(i.email), trim(i.first_name || ' ' || i.last_name), 2 from public.inquiries i
      where i.email_updates and case when p_topic = 'council' then i.interests ~* 'council' else (i.interests ~* 'workshop' or i.interests !~* 'council') end
  ) q where private.email_ok(q.e) order by q.e, q.pri
$$;

create or replace function private.unsub_sig(p_email text, p_topic text) returns text
language sql stable security definer set search_path = ''
as $$ select left(encode(extensions.hmac(convert_to(lower(p_email) || '|' || p_topic, 'utf8'), convert_to(private.secret('email_unsub_key'), 'utf8'), 'sha256'), 'hex'), 40) $$;

create or replace function private.unsub_url(p_email text, p_topic text) returns text
language sql stable security definer set search_path = ''
as $$ select coalesce(nullif(private.setting('email_site'), ''), 'https://flintracing.org') || '/#unsubscribe/' || encode(convert_to(lower(p_email), 'utf8'), 'hex') || '/' || p_topic || '/' || private.unsub_sig(p_email, p_topic) $$;

-- The link in every update. First call (p_go false) just checks the link; the second one unsubscribes.
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
  update private.email_outbox set status = 'skipped', error = 'Unsubscribed before it was sent' where kind = 'update' and to_email = em and status = 'queued' and template_key = 'update:' || p_topic;
  return jsonb_build_object('email', em, 'topic', p_topic, 'done', true);
end $$;

-- ---------- Admin → Email ----------
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
    'subscribers', jsonb_build_object('workshops', (select count(*) from private.email_audience('workshops')), 'council', (select count(*) from private.email_audience('council'))));
end $$;

create or replace function public.admin_email_settings(p_on boolean, p_from_name text, p_from_addr text, p_reply_to text, p_footer text) returns void
language plpgsql security definer set search_path = ''
as $$
declare fa text := lower(trim(coalesce(p_from_addr, ''))); rt text := lower(trim(coalesce(p_reply_to, '')));
  fn text := trim(regexp_replace(coalesce(p_from_name, ''), '[\r\n\t<>"@,;:]+', ' ', 'g'));
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if char_length(fn) < 2 or char_length(fn) > 60 then raise exception 'Add a sender name (2 to 60 characters).'; end if;
  if fa <> '' and not private.email_ok(fa) then raise exception 'The “from” address doesn’t look right.'; end if;
  if rt <> '' and not private.email_ok(rt) then raise exception 'The reply address doesn’t look right.'; end if;
  insert into private.settings(key, value) values ('email_on', case when coalesce(p_on, true) then 'true' else 'false' end), ('email_from_name', fn), ('email_from_addr', fa),
      ('email_reply_to', rt), ('email_footer', left(trim(regexp_replace(coalesce(p_footer, ''), '[\r\n\t]+', ' ', 'g')), 300))
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

create or replace function public.admin_email_notify(p_events text[], p_send_to text) returns void
language plpgsql security definer set search_path = ''
as $$
declare st text := lower(trim(coalesce(p_send_to, '')));
  ev text[] := coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_events, '{}')) x where x in ('inquiry','profile','kiosk','registration','volunteer')), '{}');
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if st <> '' and not private.email_ok(st) then raise exception 'That email address doesn’t look right.'; end if;
  insert into private.admin_notify(user_id, events, send_to) values (auth.uid(), ev, nullif(st, ''))
    on conflict (user_id) do update set events = excluded.events, send_to = excluded.send_to, updated_at = now();
end $$;

create or replace function public.admin_email_template_save(p_key text, p_subject text, p_body text, p_auto boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare s text := trim(regexp_replace(coalesce(p_subject, ''), '[\r\n\t]+', ' ', 'g')); b text := trim(coalesce(p_body, ''));
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if char_length(s) < 3 or char_length(s) > 150 then raise exception 'The subject needs 3 to 150 characters.'; end if;
  if char_length(b) < 10 or char_length(b) > 8000 then raise exception 'The message needs 10 to 8,000 characters.'; end if;
  update private.email_templates set subject = s, body = b, auto_send = coalesce(p_auto, false) and auto_event is not null, updated_at = now(), updated_by = auth.uid() where key = p_key;
  if not found then raise exception 'Message not found'; end if;
end $$;

-- What a pre-approved message will say for one person (so it can be read, and adjusted, before sending).
create or replace function public.admin_email_preview(p_table text, p_id uuid, p_template text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare t private.email_templates; v jsonb;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if p_table not in ('inquiries','members','race_registrations') then raise exception 'Unknown record'; end if;
  select * into t from private.email_templates where key = p_template;
  if t.key is null then raise exception 'Message not found'; end if;
  v := private.email_vars(p_table, p_id);
  if v is null then raise exception 'That record is gone.'; end if;
  return jsonb_build_object('to', v->>'to_email', 'to_name', v->>'to_name', 'subject', private.email_fill(t.subject, v), 'body', private.email_fill(t.body, v));
end $$;

-- Send a reply to the email address on a record. The address always comes from the record itself.
create or replace function public.admin_email_send(p_table text, p_id uuid, p_template text, p_subject text default null, p_body text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare t private.email_templates; v jsonb; addr text; s text; b text; v_id uuid;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if p_table not in ('inquiries','members','race_registrations') then raise exception 'Unknown record'; end if;
  if coalesce(private.setting('email_on'), 'true') <> 'true' then raise exception 'Email is switched off. Turn it on in Admin → Email.'; end if;
  select * into t from private.email_templates where key = p_template;
  if t.key is null then raise exception 'Message not found'; end if;
  v := private.email_vars(p_table, p_id);
  if v is null then raise exception 'That record is gone.'; end if;
  addr := v->>'to_email';
  if not private.email_ok(addr) then raise exception 'There’s no usable email address on this record.'; end if;
  s := trim(regexp_replace(private.email_fill(coalesce(nullif(trim(p_subject), ''), t.subject), v), '[\r\n\t]+', ' ', 'g'));
  b := trim(private.email_fill(coalesce(nullif(trim(p_body), ''), t.body), v));
  if char_length(s) < 3 or char_length(s) > 150 then raise exception 'The subject needs 3 to 150 characters.'; end if;
  if char_length(b) < 10 or char_length(b) > 8000 then raise exception 'The message needs 10 to 8,000 characters.'; end if;
  if (select count(*) from private.email_outbox where kind = 'reply' and created_at > now() - interval '24 hours') >= 300 then
    raise exception 'That’s a lot of replies for one day. Try again tomorrow.'; end if;
  v_id := private.email_queue('reply', addr, v->>'to_name', s, b, null, p_table, p_id, t.key, auth.uid(), null, null);
  if v_id is null then raise exception 'Couldn’t queue that email.'; end if;
  if p_table = 'inquiries' then update public.inquiries set status = 'in progress' where id = p_id and status = 'new'; end if;
  return jsonb_build_object('ok', true, 'to', addr, 'id', v_id);
end $$;

-- Which records already had an email, plus the pre-approved messages that fit this kind of record (one call per Admin tab).
create or replace function public.admin_email_refs(p_table text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare aud text := case p_table when 'inquiries' then 'inquiry' when 'members' then 'member' when 'race_registrations' then 'registration' end; v_ready boolean := false;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if aud is null then raise exception 'Unknown record'; end if;
  begin v_ready := coalesce((nullif(private.setting('email_provider'), '')::jsonb->>'ready')::boolean, false); exception when others then v_ready := false; end;
  return jsonb_build_object(
    'on', coalesce(private.setting('email_on'), 'true') = 'true',
    'ready', v_ready,
    'templates', (select coalesce(jsonb_agg(jsonb_build_object('key', t.key, 'name', t.name, 'auto', t.auto_send, 'event', t.auto_event) order by t.sort), '[]'::jsonb)
                    from private.email_templates t where t.audience = aud),
    'refs', (select coalesce(jsonb_agg(jsonb_build_object('ref', q.ref_id, 'name', coalesce(q.name, 'Email'), 'status', q.status, 'at', q.created_at, 'auto', q.kind = 'auto') order by q.created_at desc), '[]'::jsonb)
      from (select o.ref_id, t.name, o.status, o.created_at, o.kind from private.email_outbox o left join private.email_templates t on t.key = o.template_key
             where o.ref_table = p_table and o.kind in ('reply','auto') order by o.created_at desc limit 1000) q));
end $$;

create or replace function public.admin_email_log() returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'at', q.created_at, 'kind', q.kind, 'to', q.to_email, 'subject', q.subject, 'status', q.status,
      'error', q.error, 'sent_at', q.sent_at, 'tries', q.attempts) order by q.created_at desc), '[]'::jsonb)
    from (select * from private.email_outbox order by created_at desc limit 200) q);
end $$;

create or replace function public.admin_email_retry(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  update private.email_outbox set status = 'queued', attempts = 0, next_try_at = now(), error = null where id = p_id and status in ('failed','skipped');
  if not found then raise exception 'That email can’t be sent again.'; end if;
  perform private.email_kick();
end $$;

-- A test message to yourself. Also the way to check that the email service is connected.
create or replace function public.admin_email_test() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare addr text; v_id uuid;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if coalesce(private.setting('email_on'), 'true') <> 'true' then raise exception 'Email is switched off. Turn it on first.'; end if;
  select coalesce(nullif(trim(n.send_to), ''), u.email::text) into addr from auth.users u left join private.admin_notify n on n.user_id = u.id where u.id = auth.uid();
  if (select count(*) from private.email_outbox where kind = 'test' and created_at > now() - interval '1 hour') >= 10 then raise exception 'That’s enough tests for now. Try again in an hour.'; end if;
  v_id := private.email_queue('test', addr, null, 'Test email from flintracing.org',
    'This is a test from the Flint Racing & STEM website.' || E'\n\n' || 'If you’re reading this in your inbox, email is connected and working.', null, null, null, 'test', auth.uid(), null, null);
  if v_id is null then raise exception 'Couldn’t queue the test email.'; end if;
  return jsonb_build_object('ok', true, 'to', addr, 'id', v_id);
end $$;

-- Send an update to everyone who asked for a topic. p_test sends one copy to the admin only.
create or replace function public.admin_email_update(p_topic text, p_subject text, p_body text, p_test boolean default false) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare s text := trim(regexp_replace(coalesce(p_subject, ''), '[\r\n\t]+', ' ', 'g')); b text := trim(coalesce(p_body, '')); n int; v_batch uuid := gen_random_uuid(); addr text; fn text;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if p_topic is null or p_topic not in ('workshops','council') then raise exception 'Choose who the update is for.'; end if;
  if coalesce(private.setting('email_on'), 'true') <> 'true' then raise exception 'Email is switched off. Turn it on first.'; end if;
  if char_length(s) < 3 or char_length(s) > 150 then raise exception 'The subject needs 3 to 150 characters.'; end if;
  if char_length(b) < 10 or char_length(b) > 8000 then raise exception 'The message needs 10 to 8,000 characters.'; end if;
  if coalesce(p_test, false) then
    select coalesce(nullif(trim(nn.send_to), ''), u.email::text), coalesce(nullif(private.email_safe(split_part(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ' ', 1), 40), ''), 'there')
      into addr, fn from auth.users u left join private.admin_notify nn on nn.user_id = u.id where u.id = auth.uid();
    perform private.email_queue('test', addr, null, '[Test] ' || s, private.email_fill(b, jsonb_build_object('first_name', fn)), null, null, null, 'update:' || p_topic, auth.uid(), null, private.unsub_url(addr, p_topic));
    return jsonb_build_object('ok', true, 'test', true, 'to', addr);
  end if;
  if (select count(distinct batch) from private.email_outbox where kind = 'update' and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Three updates have already gone out in the last day. Try again tomorrow.'; end if;
  select count(*) into n from private.email_audience(p_topic);
  if n = 0 then raise exception 'No one has asked for these emails yet.'; end if;
  if n > 2000 then raise exception 'That list is too large to send from the website.'; end if;
  insert into private.email_outbox(kind, to_email, to_name, subject, body, template_key, created_by, batch, unsub_url)
    select 'update', a.email, nullif(left(regexp_replace(coalesce(a.name, ''), '[\r\n\t<>"]+', ' ', 'g'), 80), ''), left(s, 180),
      private.email_fill(b, jsonb_build_object('first_name', coalesce(nullif(private.email_safe(split_part(trim(coalesce(a.name, '')), ' ', 1), 40), ''), 'there'))),
      'update:' || p_topic, auth.uid(), v_batch, private.unsub_url(a.email, p_topic)
    from private.email_audience(p_topic) a;
  return jsonb_build_object('ok', true, 'count', n);
end $$;

-- ---------- Who may call what ----------
revoke all on function public.admin_email_overview(), public.admin_email_settings(boolean, text, text, text, text), public.admin_email_notify(text[], text),
  public.admin_email_template_save(text, text, text, boolean), public.admin_email_preview(text, uuid, text), public.admin_email_send(text, uuid, text, text, text),
  public.admin_email_refs(text), public.admin_email_log(), public.admin_email_retry(uuid), public.admin_email_test(), public.admin_email_update(text, text, text, boolean),
  public.email_unsubscribe(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_email_overview(), public.admin_email_settings(boolean, text, text, text, text), public.admin_email_notify(text[], text),
  public.admin_email_template_save(text, text, text, boolean), public.admin_email_preview(text, uuid, text), public.admin_email_send(text, uuid, text, text, text),
  public.admin_email_refs(text), public.admin_email_log(), public.admin_email_retry(uuid), public.admin_email_test(), public.admin_email_update(text, text, text, boolean)
  to authenticated;
grant execute on function public.email_unsubscribe(text, text, text, boolean) to anon, authenticated;
revoke all on function private.email_audience(text), private.unsub_sig(text, text), private.unsub_url(text, text) from public, anon, authenticated;
