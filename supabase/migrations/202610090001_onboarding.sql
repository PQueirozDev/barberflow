begin;
-- Keep the existing entry points compatible; new UI uses an idempotent wrapper.
create function public.onboard_v2(p_data jsonb,p_terms_version text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare shop uuid; barber uuid; hours jsonb; days jsonb;
begin
 if auth.uid() is null then raise exception 'Acesso negado.'; end if;
 if p_terms_version is distinct from '2026-10-08' then raise exception 'Leia e aceite a versão atual dos Termos de Uso.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select barbershop_id into shop from public.barbershop_members where user_id=auth.uid() order by created_at,id limit 1;
 if shop is not null then return shop; end if;
 days:=p_data->'weekdays';
 if days is null or jsonb_typeof(days)<>'array' then raise exception 'Escolha os dias de funcionamento.'; end if;
 if jsonb_array_length(days) not between 1 and 7 or exists(select 1 from jsonb_array_elements_text(days) d where d !~ '^[0-6]$') then raise exception 'Escolha os dias de funcionamento.'; end if;
 if coalesce(p_data->>'primary_color','') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Cor inválida.'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_data->>'timezone') then raise exception 'Fuso horário inválido.'; end if;
 perform public.normalize_br_phone(p_data->>'whatsapp');
 if p_data->>'slug' in ('termos','privacidade','contato','robots','sitemap','opengraph-image') then raise exception 'Este endereço é reservado.'; end if;
 shop:=public.onboard_with_terms(p_data,p_terms_version);
 update public.barbershops set primary_color=p_data->>'primary_color',timezone=p_data->>'timezone' where id=shop;
 select id into barber from public.barbers where barbershop_id=shop;
 select jsonb_agg(jsonb_build_object('weekday',d::integer,'opens_at',p_data->>'opens_at','closes_at',p_data->>'closes_at')) into hours from (select distinct jsonb_array_elements_text(days) d) selected;
 perform public.replace_hours(shop,null,hours);
 perform public.replace_hours(shop,barber,hours);
 return shop;
end $$;
revoke all on function public.onboard_v2(jsonb,text) from public,anon;
grant execute on function public.onboard_v2(jsonb,text) to authenticated;
commit;
