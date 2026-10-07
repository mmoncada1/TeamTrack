-- Private team and player photos. Object names begin with the owning team UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-pictures', 'profile-pictures', false, 2621440,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy profile_pictures_read on storage.objects for select to authenticated
  using (bucket_id = 'profile-pictures'
    and public.can_access_team((storage.foldername(name))[1]::uuid));

create policy profile_pictures_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-pictures'
    and public.can_access_team((storage.foldername(name))[1]::uuid));

create policy profile_pictures_update on storage.objects for update to authenticated
  using (bucket_id = 'profile-pictures'
    and public.can_access_team((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'profile-pictures'
    and public.can_access_team((storage.foldername(name))[1]::uuid));

create policy profile_pictures_delete on storage.objects for delete to authenticated
  using (bucket_id = 'profile-pictures'
    and public.can_access_team((storage.foldername(name))[1]::uuid));
