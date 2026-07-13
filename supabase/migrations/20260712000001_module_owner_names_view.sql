-- Migration: module_owner_names_view
-- A read-only view exposing ONLY owner display names (never contact_email or
-- other profile fields) so the public module Catalog can label modules "by
-- <owner>". Owner display names are already public via the modules-full edge
-- function that Free-Dispatcher consumes, so this is consistent.
--
-- security_invoker = false (definer): the view runs with its owner's privileges
-- and therefore bypasses owner_profiles' RLS (which otherwise restricts a user
-- to their own row). Column exposure is limited to the two columns selected.

create or replace view public.module_owner_names
  with (security_invoker = false) as
  select id, display_name
  from public.owner_profiles;

comment on view public.module_owner_names is
  'Read-only owner display names (no contact info) for the public module Catalog.';

grant select on public.module_owner_names to anon, authenticated;
