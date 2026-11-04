-- =============================================================================
-- ASSOCIA COMPTA — 0008 : Relations vers profiles (jointures PostgREST)
-- =============================================================================
-- Les profils sont créés par trigger à l'inscription ; on rattrape d'éventuels
-- utilisateurs antérieurs avant d'ajouter les clés étrangères.
insert into public.profiles (id, email)
select u.id, coalesce(u.email, '') from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

alter table public.memberships
  add constraint memberships_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade;
alter table public.support_tickets
  add constraint support_tickets_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade;
