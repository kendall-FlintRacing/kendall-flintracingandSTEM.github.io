-- Leadership Council meetings scheduled by admins (Admin → Events): time, place, notes,
-- an email to every approved council member when scheduled / changed / cancelled, and an automatic
-- reminder the day before. Meetings also count as attendance sessions for service hours (unless cancelled).

alter table public.council_meetings add column if not exists start_time text;
alter table public.council_meetings add column if not exists end_time text;
alter table public.council_meetings add column if not exists location text;
alter table public.council_meetings add column if not exists notes text;
alter table public.council_meetings add column if not exists cancelled_at timestamptz;
alter table public.council_meetings add column if not exists remind boolean not null default true;
alter table public.council_meetings add column if not exists reminded_at timestamptz;
alter table public.council_meetings add column if not exists updated_at timestamptz;

create or replace function private.fmt_hm(p text) returns text
language sql immutable set search_path = ''
as $$ select case when p ~ '^\d{1,2}:\d{2}$' then to_char(('2000-01-01 ' || p)::timestamp, 'FMHH12:MI AM') end $$;

create or replace function private.council_meeting_when(m public.council_meetings) returns text
language sql stable set search_path = ''
as $$
  select to_char(m.meeting_date, 'FMDay, FMMonth FMDD')
    || coalesce(case when m.end_time is not null then ', from ' || private.fmt_hm(m.start_time) || ' to ' || private.fmt_hm(m.end_time)
                     else ' at ' || private.fmt_hm(m.start_time) end, '')
    || coalesce(' at ' || nullif(trim(m.location), ''), '')
$$;

-- Email every approved council member about one meeting. p_kind: new | update | cancel | remind. Returns how many were queued.
create or replace function private.council_meeting_mail(p_id uuid, p_kind text, p_change text default null) returns int
language plpgsql security definer set search_path = ''
as $$
declare m public.council_meetings; r record; n int := 0; v_batch uuid := gen_random_uuid(); subj text; body text; first text; v_when text;
begin
  select * into m from public.council_meetings where id = p_id;
  if m.id is null then return 0; end if;
  v_when := private.council_meeting_when(m);
  subj := case p_kind
    when 'cancel' then 'Cancelled: Leadership Council meeting on ' || to_char(m.meeting_date, 'FMDy, FMMon FMDD')
    when 'update' then 'Updated: Leadership Council meeting on ' || to_char(m.meeting_date, 'FMDy, FMMon FMDD')
    when 'remind' then 'Reminder: Leadership Council meets tomorrow'
    else 'Leadership Council meeting: ' || to_char(m.meeting_date, 'FMDy, FMMon FMDD') end;
  for r in select distinct on (lower(mm.email)) mm.email, mm.display_name from public.members mm
           where mm.status = 'approved' and 'council' = any(mm.roles) and private.email_ok(lower(trim(coalesce(mm.email, ''))))
  loop
    first := split_part(trim(coalesce(r.display_name, '')), ' ', 1);
    body := 'Hi' || case when first <> '' then ' ' || first else '' end || ',' || E'\n\n' ||
      case p_kind
        when 'cancel' then 'The Leadership Council meeting on ' || v_when || ' is cancelled.'
        when 'update' then 'The Leadership Council meeting has changed.' || coalesce(E'\n\n' || p_change, '') || E'\n\n' || 'Now: ' || v_when || '.'
        when 'remind' then 'A reminder that Leadership Council meets tomorrow, ' || v_when || '.'
        else 'Leadership Council meets ' || v_when || '.' end ||
      case when p_kind <> 'cancel' then E'\n\n' || 'If you’re available, we’d love to see you there. No need to reply to this email.' else '' end ||
      case when p_kind <> 'cancel' and nullif(trim(coalesce(m.notes, '')), '') is not null then E'\n\n' || trim(m.notes) else '' end ||
      E'\n\n' || 'All of our scheduled meetings are in your Leadership Council portal: https://flintracing.org/#council' ||
      E'\n\n' || 'Flint Racing & STEM';
    if private.email_queue('update', r.email, r.display_name, subj, body, null, 'council_meetings', m.id, 'council_meeting_' || p_kind, auth.uid(), v_batch, null) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Admin: schedule a new meeting or change one. Returns the meeting id and how many emails were queued.
create or replace function public.admin_council_meeting_save(p_id uuid, p_date date, p_start text, p_end text, p_location text,
  p_title text, p_notes text, p_notify boolean default true, p_remind boolean default true) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare old public.council_meetings; v_id uuid; v_hours numeric; v_title text := left(coalesce(nullif(trim(p_title), ''), 'Leadership Council meeting'), 120);
  v_start text := nullif(trim(coalesce(p_start, '')), ''); v_end text := nullif(trim(coalesce(p_end, '')), ''); chg text[] := '{}'; sent int := 0; v_new public.council_meetings;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  if p_date is null then raise exception 'Pick a date.'; end if;
  if v_start is not null and v_start !~ '^\d{2}:\d{2}$' then raise exception 'Start time doesn’t look right.'; end if;
  if v_end is not null and v_end !~ '^\d{2}:\d{2}$' then raise exception 'End time doesn’t look right.'; end if;
  if v_start is not null and v_end is not null and v_end <= v_start then raise exception 'The meeting has to end after it starts.'; end if;
  v_hours := case when v_start is not null and v_end is not null
    then least(12, greatest(0.25, round((extract(epoch from (v_end::time - v_start::time)) / 3600)::numeric * 4) / 4)) else 1 end;
  if p_id is null then
    insert into public.council_meetings(meeting_date, title, hours, start_time, end_time, location, notes, remind, created_by_user, author_name, updated_at)
      values (p_date, v_title, v_hours, v_start, v_end, nullif(left(trim(coalesce(p_location, '')), 160), ''), nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
              coalesce(p_remind, true), auth.uid(), 'Admin', now())
      returning id into v_id;
    if coalesce(p_notify, true) then sent := private.council_meeting_mail(v_id, 'new'); end if;
    return jsonb_build_object('id', v_id, 'sent', sent, 'changed', false);
  end if;
  select * into old from public.council_meetings where id = p_id;
  if old.id is null then raise exception 'That meeting wasn’t found.'; end if;
  update public.council_meetings set meeting_date = p_date, title = v_title, hours = v_hours, start_time = v_start, end_time = v_end,
      location = nullif(left(trim(coalesce(p_location, '')), 160), ''), notes = nullif(left(trim(coalesce(p_notes, '')), 1000), ''),
      remind = coalesce(p_remind, true), cancelled_at = null, updated_at = now(),
      reminded_at = case when p_date <> old.meeting_date or v_start is distinct from old.start_time then null else old.reminded_at end
    where id = p_id returning * into v_new;
  if old.cancelled_at is not null then chg := chg || 'This meeting is back on (it was cancelled).'::text; end if;
  if p_date <> old.meeting_date or v_start is distinct from old.start_time or v_end is distinct from old.end_time then
    chg := chg || ('Rescheduled. It was ' || private.council_meeting_when(old) || '.')::text;
  end if;
  if coalesce(v_new.location, '') <> coalesce(old.location, '') then chg := chg || ('New place: ' || coalesce(v_new.location, 'to be announced') || '.')::text; end if;
  if coalesce(v_new.notes, '') <> coalesce(old.notes, '') and v_new.notes is not null then chg := chg || 'The meeting details were updated.'::text; end if;
  if coalesce(p_notify, true) then sent := private.council_meeting_mail(p_id, 'update', nullif(array_to_string(chg, E'\n'), '')); end if;
  return jsonb_build_object('id', p_id, 'sent', sent, 'changed', cardinality(chg) > 0);
end $$;

create or replace function public.admin_council_meeting_cancel(p_id uuid, p_notify boolean default true) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare sent int := 0;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  update public.council_meetings set cancelled_at = now(), updated_at = now() where id = p_id and cancelled_at is null;
  if not found then raise exception 'That meeting wasn’t found, or it’s already cancelled.'; end if;
  if coalesce(p_notify, true) then sent := private.council_meeting_mail(p_id, 'cancel'); end if;
  return jsonb_build_object('sent', sent);
end $$;

create or replace function public.admin_council_meetings() returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'meetings', coalesce((select jsonb_agg(to_jsonb(m) order by m.meeting_date desc, m.start_time) from public.council_meetings m), '[]'::jsonb),
    'reach', (select count(distinct lower(email)) from public.members where status = 'approved' and 'council' = any(roles) and private.email_ok(lower(trim(coalesce(email, ''))))),
    'members', (select count(*) from public.members where status = 'approved' and 'council' = any(roles)));
end $$;

-- Daily: email the reminder for tomorrow's meetings (Detroit time).
create or replace function private.council_meeting_reminders() returns int
language plpgsql security definer set search_path = ''
as $$
declare m record; n int := 0; tmr date := (now() at time zone 'America/Detroit')::date + 1;
begin
  for m in select id from public.council_meetings where meeting_date = tmr and cancelled_at is null and remind and reminded_at is null loop
    n := n + private.council_meeting_mail(m.id, 'remind');
    update public.council_meetings set reminded_at = now() where id = m.id;
  end loop;
  return n;
end $$;

revoke all on function public.admin_council_meeting_save(uuid, date, text, text, text, text, text, boolean, boolean), public.admin_council_meeting_cancel(uuid, boolean), public.admin_council_meetings() from public, anon;
grant execute on function public.admin_council_meeting_save(uuid, date, text, text, text, text, text, boolean, boolean), public.admin_council_meeting_cancel(uuid, boolean), public.admin_council_meetings() to authenticated;
revoke all on function private.council_meeting_mail(uuid, text, text), private.council_meeting_reminders() from public, anon, authenticated;

-- 9 am Detroit in winter (10 am in summer)
select cron.schedule('fr-council-reminders', '0 14 * * *', 'select private.council_meeting_reminders()');

-- Added after: "Email reminder now" button (migration council_meeting_remind_now) — public.admin_council_meeting_remind(p_id)
-- sends the standard meeting email again; refuses if an email about the meeting went out in the last 10 minutes.
-- Also (migration council_confirm_skip_cancelled): public.council_confirm ignores cancelled meetings.
