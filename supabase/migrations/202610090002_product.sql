begin;
-- Additive only. No historical appointment is treated as a payment.
alter table public.appointments add constraint appointments_tenant_id unique(barbershop_id,id);
create table public.service_payments (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null references public.barbershops(id),
 appointment_id uuid not null, amount_cents integer not null check(amount_cents between 0 and 10000000),
 method text not null check(method in ('CASH','PIX','CARD')), paid_at timestamptz not null,
 recorded_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 voided_at timestamptz, voided_by uuid references public.profiles(id), void_reason text,
 foreign key(barbershop_id,appointment_id) references public.appointments(barbershop_id,id),
 check((voided_at is null and voided_by is null and void_reason is null) or (voided_at is not null and voided_by is not null and length(trim(void_reason)) between 5 and 200))
);
create unique index service_payment_once on public.service_payments(appointment_id) where voided_at is null;
create index service_payment_period on public.service_payments(barbershop_id,paid_at);
alter table public.service_payments enable row level security;
create policy service_payment_read on public.service_payments for select to authenticated using(public.can_manage_operations(barbershop_id));
grant select on public.service_payments to authenticated;
revoke all on public.service_payments from anon;

create function public.record_service_payment(p_appointment uuid,p_method text,p_paid_at timestamptz) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare a public.appointments; existing public.service_payments; result uuid;
begin
 select * into a from public.appointments where id=p_appointment;
 if a.id is null or not public.can_manage_operations(a.barbershop_id) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(a.barbershop_id::text,0));
 select * into a from public.appointments where id=p_appointment for update;
 if not public.can_manage_operations(a.barbershop_id) then raise exception 'Acesso negado.'; end if;
 if a.status<>'COMPLETED' then raise exception 'Conclua o atendimento antes de registrar o recebimento.'; end if;
 if p_method is null or p_method not in ('CASH','PIX','CARD') or p_paid_at is null or p_paid_at>now()+interval '1 minute' or p_paid_at<a.starts_at then raise exception 'Dados do recebimento inválidos.'; end if;
 select * into existing from public.service_payments where appointment_id=a.id and voided_at is null;
 if existing.id is not null then
  if existing.method<>p_method then raise exception 'Recebimento já registrado. Atualize a página.'; end if;
  return existing.id;
 end if;
 insert into public.service_payments(barbershop_id,appointment_id,amount_cents,method,paid_at,recorded_by)
 values(a.barbershop_id,a.id,a.price_cents,p_method,p_paid_at,auth.uid()) returning id into result;
 return result;
end $$;

create function public.void_service_payment(p_payment uuid,p_reason text) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare payment public.service_payments;
begin
 select * into payment from public.service_payments where id=p_payment;
 if payment.id is null or not public.is_owner(payment.barbershop_id) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(payment.barbershop_id::text,0));
 if not public.is_owner(payment.barbershop_id) then raise exception 'Acesso negado.'; end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 200 then raise exception 'Informe o motivo da anulação.'; end if;
 update public.service_payments set voided_at=now(),voided_by=auth.uid(),void_reason=trim(p_reason) where id=p_payment and voided_at is null;
end $$;

create table public.shop_features (
 barbershop_id uuid primary key references public.barbershops(id),waitlist_enabled boolean not null default false
);
alter table public.shop_features enable row level security;
create policy features_read on public.shop_features for select to authenticated using(public.can_manage_operations(barbershop_id));
grant select on public.shop_features to authenticated;
create function public.set_waitlist_enabled(p_shop uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if not public.is_owner(p_shop) then raise exception 'Acesso negado.'; end if;
 insert into public.shop_features(barbershop_id,waitlist_enabled) values(p_shop,p_enabled)
 on conflict(barbershop_id) do update set waitlist_enabled=excluded.waitlist_enabled;
end $$;
create function public.public_features(p_slug text) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select jsonb_build_object('waitlist_enabled',coalesce(f.waitlist_enabled,false)) from public.barbershops b
 left join public.shop_features f on f.barbershop_id=b.id where b.slug=p_slug and not b.suspended
$$;
create table public.waitlist_entries (
 id uuid primary key default gen_random_uuid(),barbershop_id uuid not null references public.barbershops(id),
 service_id uuid not null,barber_id uuid not null,requested_date date not null,
 period text not null check(period in ('ANY','MORNING','AFTERNOON')),name text not null check(length(trim(name)) between 2 and 120),
 phone text not null,consented_at timestamptz not null default now(),created_at timestamptz not null default now(),
 status text not null default 'WAITING' check(status in ('WAITING','CONTACTED','CLOSED')),
 foreign key(barbershop_id,service_id) references public.services(barbershop_id,id),
 foreign key(barbershop_id,barber_id) references public.barbers(barbershop_id,id)
);
create unique index waitlist_open_once on public.waitlist_entries(barbershop_id,phone,requested_date,service_id,barber_id) where status in ('WAITING','CONTACTED');
create index waitlist_day on public.waitlist_entries(barbershop_id,requested_date,status);
alter table public.waitlist_entries enable row level security;
create policy waitlist_read on public.waitlist_entries for select to authenticated using(public.can_manage_operations(barbershop_id));
grant select on public.waitlist_entries to authenticated;
revoke all on public.waitlist_entries from anon;
create function public.join_waitlist(p_slug text,p_service uuid,p_barber uuid,p_date date,p_period text,p_name text,p_phone text,p_consent boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.barbershops; phone text;
begin
 select * into b from public.barbershops where slug=p_slug and not suspended and booking_enabled;
 if b.id is null or not exists(select 1 from public.shop_features where barbershop_id=b.id and waitlist_enabled) then raise exception 'Lista de espera indisponível.'; end if;
 if p_consent is distinct from true then raise exception 'Autorize o contato para entrar na lista de espera.'; end if;
 phone:=public.normalize_br_phone(p_phone);
 if p_name is null or length(trim(p_name)) not between 2 and 120 or p_period is null or p_period not in ('ANY','MORNING','AFTERNOON') or p_date is null or p_date not between (now() at time zone b.timezone)::date and (now() at time zone b.timezone)::date+90 then raise exception 'Dados da lista de espera inválidos.'; end if;
 if not exists(select 1 from public.services s join public.barber_services bs on bs.service_id=s.id join public.barbers r on r.id=bs.barber_id where s.id=p_service and s.barbershop_id=b.id and s.active and r.id=p_barber and r.active) then raise exception 'Dados da lista de espera inválidos.'; end if;
 if not exists(select 1 from public.subscriptions where barbershop_id=b.id and plan='PRO' and ((subscription_status='trialing' and subscription_expires_at>now()) or (subscription_status='active' and (subscription_expires_at is null or subscription_expires_at>now())))) then raise exception 'Lista de espera indisponível.'; end if;
 insert into public.waitlist_entries(barbershop_id,service_id,barber_id,requested_date,period,name,phone) values(b.id,p_service,p_barber,p_date,p_period,trim(p_name),phone) on conflict do nothing;
end $$;
create function public.close_waitlist(p_id uuid,p_status text) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare shop uuid;
begin
 select barbershop_id into shop from public.waitlist_entries where id=p_id;
 if shop is null or not public.can_manage_operations(shop) then raise exception 'Acesso negado.'; end if;
 if p_status is null or p_status not in ('CONTACTED','CLOSED') then raise exception 'Status inválido.'; end if;
 update public.waitlist_entries set status=p_status where id=p_id and status<>'CLOSED';
end $$;
create function public.waitlist_opportunities(p_shop uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb;
begin
 if not public.can_manage_operations(p_shop) then raise exception 'Acesso negado.'; end if;
 select coalesce(jsonb_agg(to_jsonb(w)||jsonb_build_object('service',s.name,'barber',r.name,'opportunity',slots.starts_at) order by w.requested_date,w.created_at),'[]'::jsonb) into result
 from (select * from public.waitlist_entries where barbershop_id=p_shop and status in ('WAITING','CONTACTED') order by requested_date,created_at limit 50) w
 join public.services s on s.id=w.service_id join public.barbers r on r.id=w.barber_id join public.barbershops b on b.id=w.barbershop_id
 left join lateral (select min(x.starts_at) starts_at from public.available_slots(b.slug,w.service_id,w.barber_id,w.requested_date) x where (w.period='ANY' or (w.period='MORNING' and (x.starts_at at time zone b.timezone)::time<'12:00') or (w.period='AFTERNOON' and (x.starts_at at time zone b.timezone)::time>='12:00'))) slots on true;
 return result;
end $$;

create table public.loyalty_programs (
 id uuid primary key default gen_random_uuid(),barbershop_id uuid not null references public.barbershops(id),
 visits_required integer not null check(visits_required between 2 and 100),reward text not null check(length(trim(reward)) between 2 and 200),
 starts_at timestamptz not null default now(),ends_at timestamptz,
 check(ends_at is null or ends_at>=starts_at),unique(barbershop_id,id)
);
create unique index loyalty_active_program on public.loyalty_programs(barbershop_id) where ends_at is null;
create table public.loyalty_redemptions (
 id uuid primary key default gen_random_uuid(),barbershop_id uuid not null references public.barbershops(id),program_id uuid not null,customer_id uuid not null,
 cycle integer not null check(cycle>0),reward text not null,redeemed_at timestamptz not null default now(),redeemed_by uuid not null references public.profiles(id),
 foreign key(barbershop_id,program_id) references public.loyalty_programs(barbershop_id,id),
 foreign key(barbershop_id,customer_id) references public.customers(barbershop_id,id),unique(program_id,customer_id,cycle)
);
alter table public.loyalty_programs enable row level security;
alter table public.loyalty_redemptions enable row level security;
create policy loyalty_program_read on public.loyalty_programs for select to authenticated using(public.can_manage_operations(barbershop_id));
create policy loyalty_redemption_read on public.loyalty_redemptions for select to authenticated using(public.can_manage_operations(barbershop_id));
grant select on public.loyalty_programs,public.loyalty_redemptions to authenticated;
create function public.configure_loyalty(p_shop uuid,p_enabled boolean,p_visits integer,p_reward text) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare active public.loyalty_programs;
begin
 if not public.is_owner(p_shop) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop::text,0));
 if not public.is_owner(p_shop) then raise exception 'Acesso negado.'; end if;
 if p_enabled is null then raise exception 'Configuração inválida.'; end if;
 select * into active from public.loyalty_programs where barbershop_id=p_shop and ends_at is null;
 if p_enabled then
  if p_visits is null or p_visits not between 2 and 100 or p_reward is null or length(trim(p_reward)) not between 2 and 200 then raise exception 'Configuração de fidelidade inválida.'; end if;
  if active.id is not null then
   if active.visits_required=p_visits and active.reward=trim(p_reward) then return; end if;
   raise exception 'Encerre o programa atual antes de criar novas regras.';
  end if;
  insert into public.loyalty_programs(barbershop_id,visits_required,reward) values(p_shop,p_visits,trim(p_reward));
 else
  update public.loyalty_programs set ends_at=now() where id=active.id;
 end if;
end $$;
create function public.redeem_loyalty(p_program uuid,p_customer uuid,p_cycle integer) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare program public.loyalty_programs; visits integer; redeemed integer;
begin
 select * into program from public.loyalty_programs where id=p_program;
 if program.id is null or not public.can_manage_operations(program.barbershop_id) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(program.barbershop_id::text,0));
 select * into program from public.loyalty_programs where id=p_program;
 if not public.can_manage_operations(program.barbershop_id) or not exists(select 1 from public.customers where id=p_customer and barbershop_id=program.barbershop_id) then raise exception 'Acesso negado.'; end if;
 if exists(select 1 from public.loyalty_redemptions where program_id=p_program and customer_id=p_customer and cycle=p_cycle) then return; end if;
 select count(*) into visits from public.appointments where barbershop_id=program.barbershop_id and customer_id=p_customer and status='COMPLETED' and starts_at>=program.starts_at and (program.ends_at is null or starts_at<program.ends_at);
 select count(*) into redeemed from public.loyalty_redemptions where program_id=p_program and customer_id=p_customer;
 if p_cycle is null or p_cycle<>redeemed+1 or visits<(redeemed+1)*program.visits_required then raise exception 'Visitas insuficientes para esta recompensa.'; end if;
 insert into public.loyalty_redemptions(barbershop_id,program_id,customer_id,cycle,reward,redeemed_by) values(program.barbershop_id,p_program,p_customer,p_cycle,program.reward,auth.uid());
end $$;
create function public.loyalty_progress(p_shop uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb;
begin
 if not public.can_manage_operations(p_shop) then raise exception 'Acesso negado.'; end if;
 select coalesce(jsonb_agg(to_jsonb(row) order by visits desc,name),'[]'::jsonb) into result from (
  select c.id customer_id,c.name,g.id program_id,g.reward,g.visits_required,
   (select count(*) from public.appointments a where a.barbershop_id=p_shop and a.customer_id=c.id and a.status='COMPLETED' and a.starts_at>=g.starts_at and (g.ends_at is null or a.starts_at<g.ends_at)) visits,
   (select count(*) from public.loyalty_redemptions r where r.program_id=g.id and r.customer_id=c.id) redeemed
  from public.customers c join public.loyalty_programs g on g.barbershop_id=p_shop and g.ends_at is null
  order by c.name,c.id limit 500
 ) row;
 return result;
end $$;

create function public.create_customer(p_shop uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare clean_phone text; clean_whatsapp text; clean_email text; result uuid;
begin
 if not public.can_manage_operations(p_shop) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop::text,0));
 clean_phone:=public.normalize_br_phone(p_data->>'phone');clean_whatsapp:=public.normalize_br_phone(p_data->>'whatsapp');clean_email:=nullif(trim(p_data->>'email'),'');
 if coalesce(length(trim(p_data->>'name')),0) not between 2 and 120 or length(coalesce(clean_email,''))>254 or (clean_email is not null and clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Dados do cliente inválidos.'; end if;
 select id into result from public.customers c where c.barbershop_id=p_shop and regexp_replace(c.phone,'[^0-9]','','g') in (clean_phone,'55'||clean_phone) order by created_at,id limit 1;
 if result is not null then raise exception 'Este telefone já pertence a outro cadastro.'; end if;
 insert into public.customers(barbershop_id,name,phone,whatsapp,email) values(p_shop,trim(p_data->>'name'),clean_phone,clean_whatsapp,clean_email) returning id into result;
 return result;
end $$;

revoke all on function public.record_service_payment(uuid,text,timestamptz),public.void_service_payment(uuid,text),public.set_waitlist_enabled(uuid,boolean),public.public_features(text),public.join_waitlist(text,uuid,uuid,date,text,text,text,boolean),public.close_waitlist(uuid,text),public.waitlist_opportunities(uuid),public.configure_loyalty(uuid,boolean,integer,text),public.redeem_loyalty(uuid,uuid,integer),public.loyalty_progress(uuid),public.create_customer(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_service_payment(uuid,text,timestamptz),public.void_service_payment(uuid,text),public.set_waitlist_enabled(uuid,boolean),public.close_waitlist(uuid,text),public.waitlist_opportunities(uuid),public.configure_loyalty(uuid,boolean,integer,text),public.redeem_loyalty(uuid,uuid,integer),public.loyalty_progress(uuid),public.create_customer(uuid,jsonb) to authenticated;
grant execute on function public.public_features(text) to anon,authenticated;
grant execute on function public.join_waitlist(text,uuid,uuid,date,text,text,text,boolean) to service_role;
commit;
