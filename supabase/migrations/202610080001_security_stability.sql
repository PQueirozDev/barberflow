-- Incremental: apply once, in a transaction, after both September migrations.
-- No customer/appointment rewrite; no production data is removed.
begin;

create function public.has_shop_role(p_shop uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select exists(select 1 from public.barbershop_members m join public.barbershops b on b.id=m.barbershop_id
 where m.user_id=auth.uid() and m.barbershop_id=p_shop and m.role=any(p_roles) and not b.suspended)
$$;
create function public.is_owner(p_shop uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select public.has_shop_role(p_shop,array['OWNER'])
$$;
create function public.can_manage_operations(p_shop uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select public.has_shop_role(p_shop,array['OWNER','MANAGER'])
$$;

-- Keep the original helper's signature for existing clients/policies.
create or replace function public.is_member(shop uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select public.can_manage_operations(shop)
$$;

alter policy tenant_insert on public.barbers with check(public.is_owner(barbershop_id));
alter policy tenant_update on public.barbers using(public.is_owner(barbershop_id)) with check(public.is_owner(barbershop_id));
alter policy tenant_delete on public.barbers using(public.is_owner(barbershop_id));
alter policy member_read on public.barbershop_members using(user_id=auth.uid() or public.is_owner(barbershop_id) or public.is_admin());

-- Direct PostgREST writes must enforce the same financial rule as the RPC.
create function public.guard_service_finances() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='UPDATE' and new.barbershop_id<>old.barbershop_id then
   raise exception 'Não é permitido transferir registros entre barbearias.';
  end if;
  if not public.is_owner(new.barbershop_id) and
    ((tg_op='INSERT' and new.price_cents<>0) or (tg_op='UPDATE' and new.price_cents<>old.price_cents)) then
   raise exception 'Somente o proprietário pode alterar preços.';
  end if;
 end if;
 return new;
end $$;
create trigger service_finances before insert or update on public.services
 for each row execute function public.guard_service_finances();
-- Deleting a priced service is a financial/catalogue decision reserved to OWNER.
alter policy tenant_delete on public.services using(public.is_owner(barbershop_id));

create or replace function public.update_shop(p_shop uuid,p_data jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if not public.is_owner(p_shop) then raise exception 'Somente o proprietário pode alterar as configurações.'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_data->>'timezone') then raise exception 'Fuso horário inválido.'; end if;
 update public.barbershops set name=p_data->>'name',slug=p_data->>'slug',phone=p_data->>'phone',whatsapp=p_data->>'whatsapp',instagram=p_data->>'instagram',address=p_data->>'address',city=p_data->>'city',state=p_data->>'state',description=p_data->>'description',primary_color=p_data->>'primary_color',timezone=p_data->>'timezone',logo_url=nullif(p_data->>'logo_url',''),cover_url=nullif(p_data->>'cover_url',''),booking_enabled=(p_data->>'booking_enabled')::boolean,notifications_enabled=(p_data->>'notifications_enabled')::boolean where id=p_shop;
end $$;

create or replace function public.save_service(p_shop uuid,p_id uuid,p_data jsonb,p_barbers uuid[]) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result uuid; current_price integer; requested_price integer;
begin
 if not public.can_manage_operations(p_shop) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop::text,0));
 requested_price:=(p_data->>'price_cents')::integer;
 if p_id is not null then
  select price_cents into current_price from public.services where id=p_id and barbershop_id=p_shop for update;
  if not found then raise exception 'Serviço não encontrado.'; end if;
 end if;
 if not public.is_owner(p_shop) and requested_price is distinct from coalesce(current_price,0) then
  raise exception 'Somente o proprietário pode alterar preços.';
 end if;
 if exists(select 1 from unnest(p_barbers) x where not exists(select 1 from public.barbers where id=x and barbershop_id=p_shop)) then raise exception 'Barbeiro inválido.'; end if;
 if p_id is null then
  insert into public.services(barbershop_id,name,description,price_cents,duration_minutes,photo_url,active) values(p_shop,p_data->>'name',coalesce(p_data->>'description',''),requested_price,(p_data->>'duration_minutes')::integer,nullif(p_data->>'photo_url',''),(p_data->>'active')::boolean) returning id into result;
 else
  update public.services set name=p_data->>'name',description=p_data->>'description',price_cents=requested_price,duration_minutes=(p_data->>'duration_minutes')::integer,photo_url=nullif(p_data->>'photo_url',''),active=(p_data->>'active')::boolean where id=p_id and barbershop_id=p_shop returning id into result;
 end if;
 delete from public.barber_services where service_id=result and barbershop_id=p_shop;
 insert into public.barber_services(barbershop_id,service_id,barber_id) select p_shop,result,x from (select distinct unnest(p_barbers) x) d;
 return result;
end $$;

-- Employees/permissions are managed by OWNER; never accept global role changes.
-- Existing owners remain untouched. Lock serializes demotions and preserves a last owner.
create function public.set_member_role(p_shop uuid,p_user uuid,p_role text) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_shop::text,0));
 if not public.is_owner(p_shop) then raise exception 'Somente o proprietário pode gerenciar permissões.'; end if;
 if p_role is null or p_role not in ('OWNER','MANAGER') then raise exception 'Permissão inválida.'; end if;
 if not exists(select 1 from public.barbershop_members where barbershop_id=p_shop and user_id=p_user) then
  raise exception 'Usuário não pertence à barbearia.';
 end if;
 if p_role='MANAGER' and exists(select 1 from public.barbershop_members where barbershop_id=p_shop and user_id=p_user and role='OWNER')
  and (select count(*) from public.barbershop_members where barbershop_id=p_shop and role='OWNER')<=1 then
  raise exception 'A barbearia precisa manter um proprietário.';
 end if;
 update public.barbershop_members set role=p_role where barbershop_id=p_shop and user_id=p_user;
end $$;

-- Brazilian domestic format (10/11 digits) preserves the existing customer key.
create function public.normalize_br_phone(p_phone text) returns text
language plpgsql immutable security invoker set search_path=pg_catalog,public,pg_temp as $$
declare n text;
begin
 if p_phone is null or length(p_phone)>30 or p_phone !~ '^(\+55[ .-]?)?[0-9() .-]+$' then raise exception 'Telefone inválido. Informe DDD e número brasileiro.'; end if;
 n:=regexp_replace(p_phone,'[^0-9]','','g');
 if length(n) in (12,13) and left(n,2)='55' then n:=substr(n,3); end if;
 if left(n,2) not in ('11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99')
 or n !~ '^[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$' then raise exception 'Telefone inválido. Informe DDD e número brasileiro.'; end if;
 return n;
end $$;

-- Personal data updates require a tenant-authenticated, intentional operation.
create function public.update_customer(p_shop uuid,p_customer uuid,p_data jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare clean_phone text; clean_whatsapp text; clean_email text; customer_name text;
begin
 if not public.can_manage_operations(p_shop) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop::text,0));
 clean_phone:=public.normalize_br_phone(p_data->>'phone'); clean_whatsapp:=public.normalize_br_phone(p_data->>'whatsapp');
 clean_email:=nullif(trim(p_data->>'email'),'');customer_name:=trim(p_data->>'name');
 if customer_name is null or length(customer_name) not between 2 and 120 or length(coalesce(clean_email,''))>254 or (clean_email is not null and clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Dados do cliente inválidos.'; end if;
 if exists(select 1 from public.customers c where c.barbershop_id=p_shop and c.id<>p_customer and regexp_replace(c.phone,'[^0-9]','','g') in (clean_phone,'55'||clean_phone)) then raise exception 'Este telefone já pertence a outro cadastro.'; end if;
 update public.customers set name=customer_name,phone=clean_phone,whatsapp=clean_whatsapp,email=clean_email where id=p_customer and barbershop_id=p_shop;
 if not found then raise exception 'Cliente não encontrado.'; end if;
end $$;

-- Internal validator supports the duration snapshot, rather than repricing an old reservation.
create function public.appointment_slot_available(p_shop uuid,p_service uuid,p_barber uuid,p_start timestamptz,p_minutes integer,p_exclude uuid default null) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select p_minutes between 5 and 480 and exists(
 select 1 from public.barbershops b
 join public.services s on s.id=p_service and s.barbershop_id=b.id and s.active
 join public.barbers r on r.id=p_barber and r.barbershop_id=b.id and r.active
 join public.barber_services bs on bs.barbershop_id=b.id and bs.barber_id=r.id and bs.service_id=s.id
 join public.business_hours h on h.barbershop_id=b.id and h.weekday=extract(dow from p_start at time zone b.timezone)
 join public.barber_availability v on v.barbershop_id=b.id and v.barber_id=r.id and v.weekday=h.weekday
 where b.id=p_shop and not b.suspended and b.booking_enabled and p_start>now()
 and (p_start at time zone b.timezone)::date between (now() at time zone b.timezone)::date and (now() at time zone b.timezone)::date+90
 and p_start>=(((p_start at time zone b.timezone)::date+greatest(h.opens_at,v.opens_at)) at time zone b.timezone)
 and p_start+make_interval(mins=>p_minutes)<=(((p_start at time zone b.timezone)::date+least(h.closes_at,v.closes_at)) at time zone b.timezone)
 and mod(extract(epoch from p_start-(((p_start at time zone b.timezone)::date+greatest(h.opens_at,v.opens_at)) at time zone b.timezone)),300)=0
 and not exists(select 1 from public.blocked_times t where t.barbershop_id=b.id and (t.barber_id is null or t.barber_id=r.id) and tstzrange(t.starts_at,t.ends_at,'[)')&&tstzrange(p_start,p_start+make_interval(mins=>p_minutes),'[)'))
 and not exists(select 1 from public.appointments a where a.barber_id=r.id and a.status in ('PENDING','CONFIRMED','COMPLETED') and (p_exclude is null or a.id<>p_exclude) and tstzrange(a.starts_at,a.ends_at,'[)')&&tstzrange(p_start,p_start+make_interval(mins=>p_minutes),'[)')))
$$;

-- Authenticated rescheduling offers slots using the same snapshot as its validator.
-- Public callers cannot exclude an appointment or infer its original duration.
create or replace function public.available_slots(p_slug text,p_service uuid,p_barber uuid,p_date date,p_exclude uuid default null) returns table(starts_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 with context as (
 select b.*,coalesce((select (extract(epoch from a.ends_at-a.starts_at)/60)::integer from public.appointments a
  where a.id=p_exclude and a.barbershop_id=b.id and a.service_id=s.id and public.can_manage_operations(b.id)),s.duration_minutes) duration_minutes
 from public.barbershops b join public.services s on s.barbershop_id=b.id and s.id=p_service and s.active
 join public.barbers r on r.barbershop_id=b.id and r.id=p_barber and r.active
 join public.barber_services bs on bs.barbershop_id=b.id and bs.barber_id=r.id and bs.service_id=s.id
 where b.slug=p_slug and b.booking_enabled and not b.suspended
 and p_date between (now() at time zone b.timezone)::date and (now() at time zone b.timezone)::date+90
 ), candidates as (
 select distinct c.id,c.duration_minutes,tick as slot from context c
 join public.business_hours h on h.barbershop_id=c.id and h.weekday=extract(dow from p_date)
 join public.barber_availability v on v.barbershop_id=c.id and v.barber_id=p_barber and v.weekday=h.weekday
 cross join lateral generate_series((p_date+greatest(h.opens_at,v.opens_at)) at time zone c.timezone,
 ((p_date+least(h.closes_at,v.closes_at)) at time zone c.timezone)-make_interval(mins=>c.duration_minutes),interval '5 minutes') tick
 where greatest(h.opens_at,v.opens_at)<least(h.closes_at,v.closes_at)
 ) select slot from candidates c where slot>now()
 and not exists(select 1 from public.blocked_times t where t.barbershop_id=c.id and (t.barber_id is null or t.barber_id=p_barber) and tstzrange(t.starts_at,t.ends_at,'[)')&&tstzrange(slot,slot+make_interval(mins=>c.duration_minutes),'[)'))
 and not exists(select 1 from public.appointments a where a.barber_id=p_barber and a.status in ('PENDING','CONFIRMED','COMPLETED')
 and (p_exclude is null or not public.can_manage_operations(c.id) or a.id<>p_exclude)
 and tstzrange(a.starts_at,a.ends_at,'[)')&&tstzrange(slot,slot+make_interval(mins=>c.duration_minutes),'[)')) order by slot
$$;

create or replace function public.book_appointment(p_slug text,p_service uuid,p_barber uuid,p_start timestamptz,p_name text,p_phone text,p_whatsapp text,p_email text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.barbershops; s public.services; c uuid; a public.appointments; sub public.subscriptions; clean_phone text; clean_whatsapp text;
begin
 select * into b from public.barbershops where slug=p_slug and not suspended and booking_enabled;
 if b.id is null then raise exception 'Agendamentos indisponíveis.'; end if;
 clean_phone:=public.normalize_br_phone(p_phone); clean_whatsapp:=public.normalize_br_phone(p_whatsapp);
 if p_name is null or length(trim(p_name)) not between 2 and 120 or length(coalesce(p_email,''))>254 or (coalesce(p_email,'')<>'' and p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Dados do cliente inválidos.'; end if;
 if not public.consume_rate_limit('booking:'||b.id||':'||clean_phone,5,3600) then raise exception 'Limite de tentativas atingido. Tente mais tarde.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(b.id::text,0));
 perform 1 from public.barbers where id=p_barber and barbershop_id=b.id for update;
 select * into s from public.services where id=p_service and barbershop_id=b.id and active;
 if s.id is null or not public.appointment_slot_available(b.id,p_service,p_barber,p_start,s.duration_minutes) then raise exception 'Horário indisponível. Escolha outro horário.'; end if;
 select * into sub from public.subscriptions where barbershop_id=b.id;
 if sub.id is null or sub.plan='FREE' or sub.subscription_status not in ('active','trialing') or (sub.subscription_expires_at is not null and sub.subscription_expires_at<now()) then
  if (select count(*) from public.appointments where barbershop_id=b.id and status<>'CANCELLED' and date_trunc('month',starts_at at time zone b.timezone)=date_trunc('month',p_start at time zone b.timezone))>=50 then raise exception 'Limite mensal de agendamentos atingido.'; end if;
 end if;
 -- Match legacy formatting/+55 without altering, merging or exposing stored personal data.
 select id into c from public.customers where barbershop_id=b.id
  and regexp_replace(phone,'[^0-9]','','g') in (clean_phone,'55'||clean_phone)
  order by (phone=clean_phone) desc,created_at,id limit 1;
 if c is null then
  insert into public.customers(barbershop_id,name,phone,whatsapp,email) values(b.id,trim(p_name),clean_phone,clean_whatsapp,nullif(trim(p_email),''))
  on conflict(barbershop_id,phone) do nothing returning id into c;
  if c is null then select id into c from public.customers where barbershop_id=b.id and phone=clean_phone; end if;
 end if;
 insert into public.appointments(barbershop_id,service_id,barber_id,customer_id,starts_at,ends_at,price_cents) values(b.id,s.id,p_barber,c,p_start,p_start+make_interval(mins=>s.duration_minutes),s.price_cents) returning * into a;
 return jsonb_build_object('code',a.code,'starts_at',a.starts_at,'ends_at',a.ends_at,'price_cents',a.price_cents,'service',s.name,'barber',(select name from public.barbers where id=p_barber),'shop',b.name,'whatsapp',b.whatsapp,'customer',trim(p_name),'timezone',b.timezone);
end $$;

create function public.manage_appointment_checked(p_id uuid,p_status text,p_start timestamptz default null,p_barber uuid default null,p_service uuid default null,p_expected_updated_at timestamptz default null) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare a public.appointments; s public.services; target_barber uuid; target_start timestamptz; minutes integer; changed boolean; reactivating boolean;
begin
 select * into a from public.appointments where id=p_id;
 if a.id is null or not public.can_manage_operations(a.barbershop_id) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(a.barbershop_id::text,0));
 select * into a from public.appointments where id=p_id for update;
 if not public.can_manage_operations(a.barbershop_id) then raise exception 'Acesso negado.'; end if;
 if p_expected_updated_at is not null and a.updated_at<>p_expected_updated_at then raise exception 'Este agendamento foi alterado por outra pessoa. Atualize a página.'; end if;
 if p_status is null or p_status not in ('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW') then raise exception 'Status inválido.'; end if;
 target_barber:=coalesce(p_barber,a.barber_id); target_start:=coalesce(p_start,a.starts_at);
 changed:=target_start<>a.starts_at or target_barber<>a.barber_id or coalesce(p_service,a.service_id)<>a.service_id;
 reactivating:=a.status='CANCELLED' and p_status in ('PENDING','CONFIRMED');
 if a.status in ('COMPLETED','NO_SHOW') and (p_status<>a.status or changed) then raise exception 'Atendimento encerrado não pode ser alterado.'; end if;
 if a.status='CANCELLED' and not reactivating and (p_status<>'CANCELLED' or changed) then raise exception 'Transição de status inválida.'; end if;
 if reactivating and p_start is null then raise exception 'Para reativar, selecione um horário disponível.'; end if;
 if a.status='PENDING' and p_status not in ('PENDING','CONFIRMED','CANCELLED','NO_SHOW')
  or a.status='CONFIRMED' and p_status not in ('CONFIRMED','COMPLETED','CANCELLED','NO_SHOW') then raise exception 'Transição de status inválida.'; end if;
 if changed or reactivating then
  if p_status not in ('PENDING','CONFIRMED') then raise exception 'Remarcação exige status pendente ou confirmado.'; end if;
  perform 1 from public.barbers where id=target_barber and barbershop_id=a.barbershop_id for update;
  select * into s from public.services where id=coalesce(p_service,a.service_id) and barbershop_id=a.barbershop_id and active;
  if s.id is null then raise exception 'Serviço inválido.'; end if;
  minutes:=case when s.id=a.service_id then (extract(epoch from a.ends_at-a.starts_at)/60)::integer else s.duration_minutes end;
  if s.id<>a.service_id and s.price_cents<>a.price_cents and not public.is_owner(a.barbershop_id) then raise exception 'Somente o proprietário pode alterar preços.'; end if;
  if not public.appointment_slot_available(a.barbershop_id,s.id,target_barber,target_start,minutes,a.id) then raise exception 'Horário indisponível. Escolha outro horário.'; end if;
  -- Reactivation/moving to a new month must not bypass FREE quota.
  if not exists(select 1 from public.subscriptions where barbershop_id=a.barbershop_id and plan='PRO' and subscription_status in ('active','trialing') and (subscription_expires_at is null or subscription_expires_at>=now()))
   and (select count(*) from public.appointments x join public.barbershops b on b.id=x.barbershop_id where x.barbershop_id=a.barbershop_id and x.id<>a.id and x.status<>'CANCELLED' and date_trunc('month',x.starts_at at time zone b.timezone)=date_trunc('month',target_start at time zone b.timezone))>=50 then raise exception 'Limite mensal de agendamentos atingido.'; end if;
  update public.appointments set starts_at=target_start,ends_at=target_start+make_interval(mins=>minutes),barber_id=target_barber,service_id=s.id,price_cents=case when s.id=a.service_id then a.price_cents else s.price_cents end,status=p_status where id=p_id;
 elsif p_status<>a.status then
  if p_status in ('COMPLETED','NO_SHOW') and a.starts_at>now() then raise exception 'O atendimento ainda não começou.'; end if;
  update public.appointments set status=p_status where id=p_id;
 end if;
end $$;

-- Backward-compatible signature; current UI additionally supplies optimistic version.
create or replace function public.manage_appointment(p_id uuid,p_status text,p_start timestamptz default null,p_barber uuid default null,p_service uuid default null) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin perform public.manage_appointment_checked(p_id,p_status,p_start,p_barber,p_service,null); end $$;

create or replace function public.consume_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare n integer;
begin
 if p_key is null or length(p_key) not between 1 and 200 or p_limit is null or p_limit not between 1 and 10000 or p_seconds is null or p_seconds not between 1 and 86400 then raise exception 'Limite inválido.'; end if;
 insert into public.rate_limits(key,hits,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set hits=case when rate_limits.expires_at<=now() then 1 else least(rate_limits.hits+1,p_limit+1) end,expires_at=case when rate_limits.expires_at<=now() then now()+make_interval(secs=>p_seconds) else rate_limits.expires_at end returning hits into n;
 delete from public.rate_limits where expires_at<now()-interval '1 day';
 return n<=p_limit;
end $$;
create index rate_limits_expiry_idx on public.rate_limits(expires_at);
-- Index for the legacy phone lookup used on every public booking.
create index customers_phone_digits_idx on public.customers(barbershop_id,(regexp_replace(phone,'[^0-9]','','g')));

-- A manager may upload service images; shop/employee images remain owner-only.
alter policy shop_media_insert on storage.objects with check(bucket_id='barbershops' and exists(
 select 1 from public.barbershop_members m where m.user_id=auth.uid() and m.barbershop_id::text=(storage.foldername(name))[1]
 and (public.is_owner(m.barbershop_id) or (public.can_manage_operations(m.barbershop_id) and (storage.foldername(name))[2]='services'))));
alter policy shop_media_delete on storage.objects using(bucket_id='barbershops' and exists(
 select 1 from public.barbershop_members m where m.user_id=auth.uid() and m.barbershop_id::text=(storage.foldername(name))[1]
 and (public.is_owner(m.barbershop_id) or (public.can_manage_operations(m.barbershop_id) and (storage.foldername(name))[2]='services'))));

revoke all on function public.has_shop_role(uuid,text[]),public.is_owner(uuid),public.can_manage_operations(uuid),public.guard_service_finances(),public.set_member_role(uuid,uuid,text),public.normalize_br_phone(text),public.appointment_slot_available(uuid,uuid,uuid,timestamptz,integer,uuid),public.manage_appointment_checked(uuid,text,timestamptz,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.is_owner(uuid),public.can_manage_operations(uuid),public.set_member_role(uuid,uuid,text),public.manage_appointment_checked(uuid,text,timestamptz,uuid,uuid,timestamptz) to authenticated;
revoke all on function public.update_customer(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_customer(uuid,uuid,jsonb) to authenticated;

-- Harden all existing application definers, including retained operational RPCs.
alter function public.handle_new_user() set search_path=pg_catalog,public,pg_temp;
alter function public.is_admin() set search_path=pg_catalog,public,pg_temp;
alter function public.public_shop(text) set search_path=pg_catalog,public,pg_temp;
alter function public.available_slots(text,uuid,uuid,date,uuid) set search_path=pg_catalog,public,pg_temp;
alter function public.create_barbershop(jsonb) set search_path=pg_catalog,public,pg_temp;
alter function public.admin_update_shop(uuid,boolean,text) set search_path=pg_catalog,public,pg_temp;
alter function public.replace_hours(uuid,uuid,jsonb) set search_path=pg_catalog,public,pg_temp;
alter function public.add_block(uuid,uuid,text,text,text) set search_path=pg_catalog,public,pg_temp;
commit;
