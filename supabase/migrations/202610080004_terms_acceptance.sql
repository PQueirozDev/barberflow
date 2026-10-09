begin;
alter table public.profiles add column terms_accepted_at timestamptz;
alter table public.profiles add column terms_version text;
create function public.onboard_with_terms(p_data jsonb,p_terms_version text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare shop uuid;
begin
 if auth.uid() is null then raise exception 'Acesso negado.'; end if;
 if p_terms_version is distinct from '2026-10-08' then raise exception 'Leia e aceite a versão atual dos Termos de Uso.'; end if;
 shop:=public.create_barbershop(p_data);
 update public.profiles set terms_accepted_at=now(),terms_version=p_terms_version where id=auth.uid();
 return shop;
end $$;
revoke execute on function public.onboard_with_terms(jsonb,text) from public,anon;
grant execute on function public.onboard_with_terms(jsonb,text) to authenticated;
commit;
