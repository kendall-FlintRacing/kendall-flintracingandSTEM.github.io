-- Flint Racing & STEM: remove a list you made, with Undo / Restore (Admin → Email → Mailing lists)
-- Applied to Supabase project FlintRacingandSTEM on Nov 17, 2026 as migrations lists_remove and lists_restore.
-- Removing only hides the list (removed_at); people added to it and members' ticks are kept, so Restore brings it back as it was.
alter table private.email_lists add column if not exists removed_at timestamptz;
-- list_ok(), lists_meta(), public_email_lists() and admin_list_save() ignore removed lists;
-- clean_prefs() keeps a removed list's tick quietly; admin_lists() also returns removed_lists.
-- public.admin_list_remove_list(p_key): only lists you made; skips updates queued only to that list.
-- public.admin_list_restore(p_key): brings it back unless another live list now uses the same name.
-- (Full function text is in the Supabase migrations of the same names.)
