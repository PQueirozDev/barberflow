begin;
create function public.shop_analytics(p_shop uuid,p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare tz text; first_at timestamptz; until_at timestamptz; today date; result jsonb; capacity numeric; occupied numeric;
begin
 if not public.can_manage_operations(p_shop) then raise exception 'Acesso negado.'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'Selecione um período de até 366 dias.'; end if;
 select timezone into tz from public.barbershops where id=p_shop;
 first_at:=p_from::timestamp at time zone tz;until_at:=(p_to+1)::timestamp at time zone tz;today:=(now() at time zone tz)::date;
 -- Union intersecting windows before measuring; subtract blocks and count occupied
 -- portions only inside configured capacity. Historical schedules are not snapshotted.
 with windows as (
  select r.id barber_id,d::date as workday,tstzrange((d::date+greatest(h.opens_at,v.opens_at)) at time zone tz,(d::date+least(h.closes_at,v.closes_at)) at time zone tz,'[)') span
  from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
  join public.business_hours h on h.barbershop_id=p_shop and h.weekday=extract(dow from d)
  join public.barber_availability v on v.barbershop_id=p_shop and v.weekday=h.weekday
  join public.barbers r on r.id=v.barber_id and r.barbershop_id=p_shop and r.active
  where greatest(h.opens_at,v.opens_at)<least(h.closes_at,v.closes_at)
 ), scheduled as (select barber_id,workday,range_agg(span) spans from windows group by barber_id,workday),
 available as (
  select w.barber_id,w.workday,w.spans-coalesce((select range_agg(tstzrange(b.starts_at,b.ends_at,'[)')) from public.blocked_times b where b.barbershop_id=p_shop and (b.barber_id is null or b.barber_id=w.barber_id) and b.starts_at<until_at and b.ends_at>first_at),'{}'::tstzmultirange) spans from scheduled w
 ), measured as (
  select a.spans,a.spans*coalesce((select range_agg(tstzrange(x.starts_at,x.ends_at,'[)')) from public.appointments x where x.barbershop_id=p_shop and x.barber_id=a.barber_id and x.status in ('PENDING','CONFIRMED','COMPLETED') and x.starts_at<until_at and x.ends_at>first_at),'{}'::tstzmultirange) booked from available a
 ) select coalesce(sum((select sum(extract(epoch from upper(s)-lower(s))/60) from unnest(spans) s)),0),coalesce(sum((select sum(extract(epoch from upper(s)-lower(s))/60) from unnest(booked) s)),0) into capacity,occupied from measured;
 with period as (select * from public.appointments where barbershop_id=p_shop and starts_at>=first_at and starts_at<until_at),
 paid as (select * from public.service_payments where barbershop_id=p_shop and paid_at>=first_at and paid_at<until_at and voided_at is null),
 services as (
  select s.id,s.name,(select count(*) from period a where a.service_id=s.id and a.status='COMPLETED') count,
  coalesce((select sum(p.amount_cents) from paid p join public.appointments a on a.id=p.appointment_id where a.service_id=s.id),0) received
  from public.services s where s.barbershop_id=p_shop
 ), barbers as (
  select b.id,b.name,(select count(*) from period a where a.barber_id=b.id and a.status='COMPLETED') count,
  coalesce((select sum(p.amount_cents) from paid p join public.appointments a on a.id=p.appointment_id where a.barber_id=b.id),0) received
  from public.barbers b where b.barbershop_id=p_shop
 ), daily as (
  select d::date date,(select count(*) from period a where (a.starts_at at time zone tz)::date=d::date and a.status='COMPLETED') completed,
  (select count(*) from period a where (a.starts_at at time zone tz)::date=d::date and a.status in ('PENDING','CONFIRMED','COMPLETED')) appointments,
  coalesce((select sum(p.amount_cents) from paid p where (p.paid_at at time zone tz)::date=d::date),0) received
  from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
 ) select jsonb_build_object(
 'expected',coalesce((select sum(price_cents) from period where status in ('PENDING','CONFIRMED','COMPLETED')),0),
 'received',coalesce((select sum(amount_cents) from paid),0),'payments',(select count(*) from paid),
 'completedValue',coalesce((select sum(price_cents) from period where status='COMPLETED'),0),
 'completed',(select count(*) from period where status='COMPLETED'),'cancelled',(select count(*) from period where status='CANCELLED'),
 'customers',(select count(*) from public.customers where barbershop_id=p_shop),
 'newCustomers',(select count(*) from public.customers where barbershop_id=p_shop and created_at>=first_at and created_at<until_at),
 'today',(select count(*) from public.appointments where barbershop_id=p_shop and status in ('PENDING','CONFIRMED','COMPLETED') and starts_at>=today::timestamp at time zone tz and starts_at<(today+1)::timestamp at time zone tz),
 'week',(select count(*) from public.appointments where barbershop_id=p_shop and status in ('PENDING','CONFIRMED','COMPLETED') and starts_at>=today::timestamp at time zone tz and starts_at<(today+7)::timestamp at time zone tz),
 'capacityMinutes',capacity,'occupiedMinutes',occupied,'occupancy',case when capacity>0 then round(100*occupied/capacity,1) else null end,
 'services',coalesce((select jsonb_agg(to_jsonb(s) order by count desc,name) from services s where count>0 or received>0),'[]'::jsonb),
 'barbers',coalesce((select jsonb_agg(to_jsonb(b) order by count desc,name) from barbers b where count>0 or received>0),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(to_jsonb(d) order by date) from daily d),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.shop_analytics(uuid,date,date) from public,anon;
grant execute on function public.shop_analytics(uuid,date,date) to authenticated;

-- Paginated customer summary avoids sending all historical visits to the browser.
create function public.customer_directory(p_shop uuid,p_search text default '',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb;
begin
 if not public.can_manage_operations(p_shop) then raise exception 'Acesso negado.'; end if;
 if p_page is null or p_page<1 or p_page>100000 or p_search is null or length(p_search)>120 then raise exception 'Busca inválida.'; end if;
 with matches as (select * from public.customers where barbershop_id=p_shop and (position(lower(p_search) in lower(name))>0 or position(p_search in phone)>0)),
 page as (select * from matches order by name,id offset (p_page-1)*50 limit 50),
 items as (select c.*, (select count(*) from public.appointments a where a.customer_id=c.id and a.barbershop_id=p_shop and a.status='COMPLETED') visits,
 (select max(starts_at) from public.appointments a where a.customer_id=c.id and a.barbershop_id=p_shop and a.status='COMPLETED') last_visit,
 coalesce((select sum(p.amount_cents) from public.service_payments p join public.appointments a on a.id=p.appointment_id where a.customer_id=c.id and p.barbershop_id=p_shop and p.voided_at is null),0) received,
 (select s.name from public.appointments a join public.services s on s.id=a.service_id where a.customer_id=c.id and a.barbershop_id=p_shop and a.status='COMPLETED' group by s.id,s.name order by count(*) desc,s.name limit 1) favorite
 from page c)
 select jsonb_build_object('total',(select count(*) from matches),'items',coalesce((select jsonb_agg(to_jsonb(i) order by name,id) from items i),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.customer_directory(uuid,text,integer) from public,anon;
grant execute on function public.customer_directory(uuid,text,integer) to authenticated;
create index appointments_customer_history on public.appointments(barbershop_id,customer_id,starts_at);
create function public.unpaid_appointments(p_shop uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb;
begin
 if not public.can_manage_operations(p_shop) then raise exception 'Acesso negado.'; end if;
 select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('customers',jsonb_build_object('name',c.name),'services',jsonb_build_object('name',s.name)) order by a.starts_at,a.id),'[]'::jsonb) into result
 from (select * from public.appointments a where a.barbershop_id=p_shop and a.status='COMPLETED' and not exists(select 1 from public.service_payments p where p.appointment_id=a.id and p.voided_at is null) order by a.starts_at,a.id limit 100) a
 join public.customers c on c.id=a.customer_id join public.services s on s.id=a.service_id;
 return result;
end $$;
revoke all on function public.unpaid_appointments(uuid) from public,anon;
grant execute on function public.unpaid_appointments(uuid) to authenticated;
commit;
