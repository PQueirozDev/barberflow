create function public.save_service(p_shop uuid,p_id uuid,p_data jsonb,p_barbers uuid[]) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not is_member(p_shop) then raise exception 'Acesso negado.'; end if;
 if exists(select 1 from unnest(p_barbers) x where not exists(select 1 from barbers where id=x and barbershop_id=p_shop)) then raise exception 'Barbeiro inválido.'; end if;
 if p_id is null then
 insert into services(barbershop_id,name,description,price_cents,duration_minutes,photo_url,active) values(p_shop,p_data->>'name',coalesce(p_data->>'description',''),(p_data->>'price_cents')::integer,(p_data->>'duration_minutes')::integer,nullif(p_data->>'photo_url',''),(p_data->>'active')::boolean) returning id into result;
 else
 update services set name=p_data->>'name',description=p_data->>'description',price_cents=(p_data->>'price_cents')::integer,duration_minutes=(p_data->>'duration_minutes')::integer,photo_url=nullif(p_data->>'photo_url',''),active=(p_data->>'active')::boolean where id=p_id and barbershop_id=p_shop returning id into result;
 if result is null then raise exception 'Serviço não encontrado.'; end if;
 end if;
 delete from barber_services where service_id=result and barbershop_id=p_shop;
 insert into barber_services(barbershop_id,service_id,barber_id) select p_shop,result,x from (select distinct unnest(p_barbers) x) d;
 return result;
end $$;
create function public.replace_hours(p_shop uuid,p_barber uuid,p_hours jsonb) returns void language plpgsql security definer set search_path=public as $$
declare h jsonb;
begin
 if not is_member(p_shop) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop::text,0));
 if p_barber is not null and not exists(select 1 from barbers where id=p_barber and barbershop_id=p_shop) then raise exception 'Barbeiro inválido.'; end if;
 if jsonb_array_length(p_hours)>14 then raise exception 'Excesso de janelas.'; end if;
 if p_barber is null then delete from business_hours where barbershop_id=p_shop; else delete from barber_availability where barbershop_id=p_shop and barber_id=p_barber; end if;
 for h in select * from jsonb_array_elements(p_hours) loop
 if p_barber is null then insert into business_hours(barbershop_id,weekday,opens_at,closes_at) values(p_shop,(h->>'weekday')::integer,(h->>'opens_at')::time,(h->>'closes_at')::time);
 else insert into barber_availability(barbershop_id,barber_id,weekday,opens_at,closes_at) values(p_shop,p_barber,(h->>'weekday')::integer,(h->>'opens_at')::time,(h->>'closes_at')::time); end if;
 end loop;
end $$;
create function public.add_block(p_shop uuid,p_barber uuid,p_start text,p_end text,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare tz text; s timestamptz; e timestamptz;
begin
 if not is_member(p_shop) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop::text,0));
 select timezone into tz from barbershops where id=p_shop;
 s:=p_start::timestamp at time zone tz; e:=p_end::timestamp at time zone tz;
 if e<=s then raise exception 'Fim deve ser posterior ao início.'; end if;
 if exists(select 1 from appointments where barbershop_id=p_shop and (p_barber is null or barber_id=p_barber) and status in ('CONFIRMED','PENDING') and tstzrange(starts_at,ends_at,'[)')&&tstzrange(s,e,'[)')) then raise exception 'Há agendamentos neste período. Remarque ou cancele antes de bloquear.'; end if;
 insert into blocked_times(barbershop_id,barber_id,starts_at,ends_at,reason) values(p_shop,p_barber,s,e,p_reason);
end $$;
revoke all on function public.save_service(uuid,uuid,jsonb,uuid[]),public.replace_hours(uuid,uuid,jsonb),public.add_block(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.save_service(uuid,uuid,jsonb,uuid[]),public.replace_hours(uuid,uuid,jsonb),public.add_block(uuid,uuid,text,text,text) to authenticated;
