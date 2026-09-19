create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, name text not null default '',
 role text not null default 'USER' check(role in ('USER','ADMIN')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,name) values(new.id,left(coalesce(new.raw_user_meta_data->>'name',''),120)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.barbershops (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 120),
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,59}$' and slug not in ('admin','api','auth','login','cadastro','onboarding','dashboard','demonstracao','recuperar-senha','redefinir-senha','b','barbearia')),
 phone text not null default '', whatsapp text not null default '', instagram text not null default '', address text not null default '', city text not null default '', state text not null default '', description text not null default '',
 logo_url text, cover_url text, primary_color text not null default '#b8d968' check(primary_color ~ '^#[0-9a-fA-F]{6}$'),
 timezone text not null default 'America/Sao_Paulo', booking_enabled boolean not null default true, suspended boolean not null default false,
 notifications_enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.barbershop_members (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null references barbershops on delete cascade,
 user_id uuid not null references profiles on delete cascade, role text not null default 'OWNER' check(role in ('OWNER','MANAGER')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(barbershop_id,user_id)
);
create table public.barbers (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null references barbershops on delete cascade,
 name text not null check(length(name) between 2 and 120), photo_url text, phone text not null default '', email text not null default '', specialties text not null default '', description text not null default '', active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(barbershop_id,id)
);
create table public.services (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null references barbershops on delete cascade,
 name text not null check(length(name) between 2 and 120), description text not null default '', price_cents integer not null check(price_cents between 0 and 10000000), duration_minutes integer not null check(duration_minutes between 5 and 480), photo_url text, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(barbershop_id,id)
);
create table public.barber_services (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null references barbershops on delete cascade, barber_id uuid not null, service_id uuid not null,
 foreign key(barbershop_id,barber_id) references barbers(barbershop_id,id) on delete cascade,
 foreign key(barbershop_id,service_id) references services(barbershop_id,id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(barber_id,service_id)
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null references barbershops on delete cascade,
 name text not null check(length(name) between 2 and 120), phone text not null, whatsapp text not null, email text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(barbershop_id,phone), unique(barbershop_id,id)
);
create table public.business_hours (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null references barbershops on delete cascade,
 weekday integer not null check(weekday between 0 and 6), opens_at time not null, closes_at time not null, check(opens_at < closes_at),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.barber_availability (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null references barbershops on delete cascade, barber_id uuid not null,
 weekday integer not null check(weekday between 0 and 6), opens_at time not null, closes_at time not null, check(opens_at < closes_at),
 foreign key(barbershop_id,barber_id) references barbers(barbershop_id,id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.blocked_times (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null references barbershops on delete cascade, barber_id uuid,
 starts_at timestamptz not null, ends_at timestamptz not null, reason text not null default 'Folga', check(ends_at>starts_at),
 foreign key(barbershop_id,barber_id) references barbers(barbershop_id,id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.appointments (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null references barbershops on delete cascade,
 barber_id uuid not null, service_id uuid not null, customer_id uuid not null,
 starts_at timestamptz not null, ends_at timestamptz not null, price_cents integer not null check(price_cents>=0),
 status text not null default 'CONFIRMED' check(status in ('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),
 code uuid not null unique default gen_random_uuid(), check(ends_at>starts_at),
 foreign key(barbershop_id,barber_id) references barbers(barbershop_id,id),
 foreign key(barbershop_id,service_id) references services(barbershop_id,id),
 foreign key(barbershop_id,customer_id) references customers(barbershop_id,id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 exclude using gist (barber_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where(status in ('PENDING','CONFIRMED','COMPLETED'))
);
create table public.subscriptions (
 id uuid primary key default gen_random_uuid(), barbershop_id uuid not null unique references barbershops on delete cascade,
 plan text not null default 'FREE' check(plan in ('FREE','PRO')), subscription_status text not null default 'active' check(subscription_status in ('active','trialing','past_due','cancelled')),
 subscription_expires_at timestamptz, provider text, provider_subscription_id text unique,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.rate_limits (key text primary key, hits integer not null, expires_at timestamptz not null);
alter table rate_limits enable row level security;

create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='ADMIN') $$;
create function public.is_member(shop uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from barbershop_members m join barbershops b on b.id=m.barbershop_id where m.user_id=auth.uid() and m.barbershop_id=shop and not b.suspended) $$;
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','barbershops','barbershop_members','barbers','services','barber_services','customers','business_hours','barber_availability','blocked_times','appointments','subscriptions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()',t);
 if t not in ('profiles','barbershops','barbershop_members','subscriptions') then
 execute format('create policy tenant_read on public.%I for select to authenticated using(public.is_member(barbershop_id) or public.is_admin())',t);
 if t not in ('appointments','customers') then
 execute format('create policy tenant_insert on public.%I for insert to authenticated with check(public.is_member(barbershop_id))',t);
 execute format('create policy tenant_update on public.%I for update to authenticated using(public.is_member(barbershop_id)) with check(public.is_member(barbershop_id))',t);
 execute format('create policy tenant_delete on public.%I for delete to authenticated using(public.is_member(barbershop_id))',t);
 end if;
 execute format('create index on public.%I(barbershop_id)',t);
 end if;
 end loop;
end $$;
create policy profile_read on profiles for select to authenticated using(id=auth.uid() or is_admin());
create policy shop_read on barbershops for select to authenticated using(is_member(id) or is_admin() or exists(select 1 from barbershop_members m where m.barbershop_id=barbershops.id and m.user_id=auth.uid()));
create policy member_read on barbershop_members for select to authenticated using(user_id=auth.uid() or is_admin());
create policy subscription_read on subscriptions for select to authenticated using(is_member(barbershop_id) or is_admin());
create index on barbershop_members(user_id);
create index on appointments(barbershop_id,starts_at);
create index on blocked_times(barbershop_id,starts_at,ends_at);

create function public.consume_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into rate_limits(key,hits,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set hits=case when rate_limits.expires_at<now() then 1 else rate_limits.hits+1 end, expires_at=case when rate_limits.expires_at<now() then now()+make_interval(secs=>p_seconds) else rate_limits.expires_at end returning hits into n;
 delete from rate_limits where expires_at<now()-interval '1 day';
 return n<=p_limit;
end $$;

create function public.public_shop(p_slug text) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('shop',jsonb_build_object('id',b.id,'name',b.name,'slug',b.slug,'description',b.description,'logo_url',b.logo_url,'cover_url',b.cover_url,'primary_color',b.primary_color,'whatsapp',b.whatsapp,'instagram',b.instagram,'address',b.address,'city',b.city,'state',b.state,'timezone',b.timezone,'booking_enabled',b.booking_enabled),
 'services',coalesce((select jsonb_agg(to_jsonb(s)-'created_at'-'updated_at') from services s where s.barbershop_id=b.id and s.active),'[]'::jsonb),
 'barbers',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'photo_url',r.photo_url,'specialties',r.specialties,'description',r.description)) from barbers r where r.barbershop_id=b.id and r.active),'[]'::jsonb),
 'barber_services',coalesce((select jsonb_agg(jsonb_build_object('barber_id',bs.barber_id,'service_id',bs.service_id)) from barber_services bs where bs.barbershop_id=b.id),'[]'::jsonb),
 'hours',coalesce((select jsonb_agg(jsonb_build_object('weekday',h.weekday,'opens_at',h.opens_at,'closes_at',h.closes_at)) from business_hours h where h.barbershop_id=b.id),'[]'::jsonb))
 from barbershops b where b.slug=p_slug and not b.suspended
$$;

create function public.available_slots(p_slug text,p_service uuid,p_barber uuid,p_date date,p_exclude uuid default null) returns table(starts_at timestamptz) language sql stable security definer set search_path=public as $$
 with context as (
 select b.*,s.duration_minutes from barbershops b join services s on s.barbershop_id=b.id and s.id=p_service and s.active
 join barbers r on r.barbershop_id=b.id and r.id=p_barber and r.active
 join barber_services bs on bs.barbershop_id=b.id and bs.barber_id=r.id and bs.service_id=s.id
 where b.slug=p_slug and b.booking_enabled and not b.suspended
 and p_date between (now() at time zone b.timezone)::date and (now() at time zone b.timezone)::date+90
 ), candidates as (
 select distinct c.id,c.duration_minutes, tick as slot from context c
 join business_hours h on h.barbershop_id=c.id and h.weekday=extract(dow from p_date)
 join barber_availability a on a.barbershop_id=c.id and a.barber_id=p_barber and a.weekday=h.weekday
 cross join lateral generate_series((p_date+greatest(h.opens_at,a.opens_at)) at time zone c.timezone, ((p_date+least(h.closes_at,a.closes_at)) at time zone c.timezone)-make_interval(mins=>c.duration_minutes),interval '5 minutes') tick
 where greatest(h.opens_at,a.opens_at)<least(h.closes_at,a.closes_at)
 ) select slot from candidates c where slot>now()
 and not exists(select 1 from blocked_times t where t.barbershop_id=c.id and (t.barber_id is null or t.barber_id=p_barber) and tstzrange(t.starts_at,t.ends_at,'[)') && tstzrange(slot,slot+make_interval(mins=>c.duration_minutes),'[)'))
 and not exists(select 1 from appointments a where a.barber_id=p_barber and a.status in ('PENDING','CONFIRMED','COMPLETED') and (p_exclude is null or not is_member(c.id) or a.id<>p_exclude) and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(slot,slot+make_interval(mins=>c.duration_minutes),'[)')) order by slot
$$;

create function public.book_appointment(p_slug text,p_service uuid,p_barber uuid,p_start timestamptz,p_name text,p_phone text,p_whatsapp text,p_email text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare b barbershops; s services; c uuid; a appointments; sub subscriptions; clean_phone text;
begin
 select * into b from barbershops where slug=p_slug and not suspended and booking_enabled;
 if b.id is null then raise exception 'Agendamentos indisponíveis.'; end if;
 clean_phone:=regexp_replace(p_phone,'[^0-9]','','g');
 if length(trim(p_name)) not between 2 and 120 or clean_phone !~ '^[0-9]{10,15}$' or regexp_replace(p_whatsapp,'[^0-9]','','g') !~ '^[0-9]{10,15}$' or length(coalesce(p_email,''))>254 or (coalesce(p_email,'')<>'' and p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Dados do cliente inválidos.'; end if;
 if not consume_rate_limit('booking:'||b.id||':'||clean_phone,5,3600) then raise exception 'Limite de tentativas atingido. Tente mais tarde.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(b.id::text,0));
 perform 1 from barbers where id=p_barber and barbershop_id=b.id for update;
 select * into s from services where id=p_service and barbershop_id=b.id and active;
 if s.id is null or not exists(select 1 from available_slots(p_slug,p_service,p_barber,(p_start at time zone b.timezone)::date) x where x.starts_at=p_start) then raise exception 'Horário indisponível. Escolha outro horário.'; end if;
 select * into sub from subscriptions where barbershop_id=b.id;
 if sub.plan='FREE' or sub.subscription_status not in ('active','trialing') or (sub.subscription_expires_at is not null and sub.subscription_expires_at<now()) then
 if (select count(*) from appointments where barbershop_id=b.id and status<>'CANCELLED' and date_trunc('month',starts_at at time zone b.timezone)=date_trunc('month',p_start at time zone b.timezone))>=50 then raise exception 'Limite mensal de agendamentos atingido.'; end if;
 end if;
 insert into customers(barbershop_id,name,phone,whatsapp,email) values(b.id,trim(p_name),clean_phone,regexp_replace(p_whatsapp,'[^0-9]','','g'),nullif(p_email,''))
 on conflict(barbershop_id,phone) do update set name=excluded.name,whatsapp=excluded.whatsapp,email=coalesce(excluded.email,customers.email) returning id into c;
 insert into appointments(barbershop_id,service_id,barber_id,customer_id,starts_at,ends_at,price_cents) values(b.id,s.id,p_barber,c,p_start,p_start+make_interval(mins=>s.duration_minutes),s.price_cents) returning * into a;
 return jsonb_build_object('code',a.code,'starts_at',a.starts_at,'ends_at',a.ends_at,'price_cents',a.price_cents,'service',s.name,'barber',(select name from barbers where id=p_barber),'shop',b.name,'whatsapp',b.whatsapp,'customer',trim(p_name),'timezone',b.timezone);
end $$;

create function public.create_barbershop(p_data jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare shop uuid; barber uuid; service uuid; d integer; open_time time; close_time time;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if exists(select 1 from barbershop_members where user_id=auth.uid()) then raise exception 'Sua conta já possui uma barbearia.'; end if;
 open_time:=(p_data->>'opens_at')::time; close_time:=(p_data->>'closes_at')::time;
 if open_time is null or close_time is null or close_time<=open_time then raise exception 'Horário inválido.'; end if;
 insert into barbershops(name,slug,phone,whatsapp,instagram,address,city,state,description) values(p_data->>'name',p_data->>'slug',coalesce(p_data->>'phone',''),coalesce(p_data->>'whatsapp',''),coalesce(p_data->>'instagram',''),coalesce(p_data->>'address',''),coalesce(p_data->>'city',''),coalesce(p_data->>'state',''),coalesce(p_data->>'description','')) returning id into shop;
 insert into barbershop_members(barbershop_id,user_id) values(shop,auth.uid());
 insert into subscriptions(barbershop_id) values(shop);
 insert into services(barbershop_id,name,price_cents,duration_minutes) values(shop,p_data->>'service_name',(p_data->>'price_cents')::integer,(p_data->>'duration_minutes')::integer) returning id into service;
 insert into barbers(barbershop_id,name,specialties) values(shop,p_data->>'barber_name',coalesce(p_data->>'specialties','')) returning id into barber;
 insert into barber_services(barbershop_id,barber_id,service_id) values(shop,barber,service);
 for d in 1..6 loop
 insert into business_hours(barbershop_id,weekday,opens_at,closes_at) values(shop,d,open_time,close_time);
 insert into barber_availability(barbershop_id,barber_id,weekday,opens_at,closes_at) values(shop,barber,d,open_time,close_time);
 end loop;
 return shop;
end $$;

create function public.update_shop(p_shop uuid,p_data jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_member(p_shop) then raise exception 'Acesso negado.'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_data->>'timezone') then raise exception 'Fuso horário inválido.'; end if;
 update barbershops set name=p_data->>'name',slug=p_data->>'slug',phone=p_data->>'phone',whatsapp=p_data->>'whatsapp',instagram=p_data->>'instagram',address=p_data->>'address',city=p_data->>'city',state=p_data->>'state',description=p_data->>'description',primary_color=p_data->>'primary_color',timezone=p_data->>'timezone',logo_url=nullif(p_data->>'logo_url',''),cover_url=nullif(p_data->>'cover_url',''),booking_enabled=(p_data->>'booking_enabled')::boolean,notifications_enabled=(p_data->>'notifications_enabled')::boolean where id=p_shop;
end $$;

create function public.manage_appointment(p_id uuid,p_status text,p_start timestamptz default null,p_barber uuid default null,p_service uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare a appointments; b barbershops; s services; target_barber uuid; target_start timestamptz;
begin
 select * into a from appointments where id=p_id;
 if a.id is null or not is_member(a.barbershop_id) then raise exception 'Acesso negado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(a.barbershop_id::text,0));
 select * into a from appointments where id=p_id for update;
 select * into b from barbershops where id=a.barbershop_id;
 target_barber:=coalesce(p_barber,a.barber_id); target_start:=coalesce(p_start,a.starts_at);
 select * into s from services where id=coalesce(p_service,a.service_id) and barbershop_id=b.id;
 if s.id is null then raise exception 'Serviço inválido.'; end if;
 if p_start is not null or target_barber<>a.barber_id or s.id<>a.service_id or (a.status in ('CANCELLED','NO_SHOW') and p_status in ('PENDING','CONFIRMED','COMPLETED')) then
 if p_status not in ('PENDING','CONFIRMED') then raise exception 'Remarcação exige status pendente ou confirmado.'; end if;
 perform 1 from barbers where id=target_barber and barbershop_id=b.id for update;
 if not exists(select 1 from available_slots(b.slug,s.id,target_barber,(target_start at time zone b.timezone)::date,a.id) x where x.starts_at=target_start) then raise exception 'Horário indisponível.'; end if;
 update appointments set starts_at=target_start,ends_at=target_start+make_interval(mins=>s.duration_minutes),barber_id=target_barber,service_id=s.id,price_cents=s.price_cents,status=p_status where id=p_id;
 else
 if p_status in ('COMPLETED','NO_SHOW') and a.starts_at>now() then raise exception 'O atendimento ainda não começou.'; end if;
 update appointments set status=p_status where id=p_id;
 end if;
end $$;

create function public.admin_update_shop(p_shop uuid,p_suspended boolean,p_plan text) returns void language plpgsql security definer set search_path=public as $$
begin if not is_admin() then raise exception 'Acesso negado.'; end if;
 update barbershops set suspended=p_suspended where id=p_shop;
 update subscriptions set plan=p_plan where barbershop_id=p_shop;
end $$;

-- Revogação explícita: funções SECURITY DEFINER não devem herdar EXECUTE de PUBLIC.
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_admin(),public.is_member(uuid) to authenticated;
grant execute on function public.public_shop(text),public.available_slots(text,uuid,uuid,date,uuid) to anon,authenticated;
grant execute on function public.book_appointment(text,uuid,uuid,timestamptz,text,text,text,text),public.consume_rate_limit(text,integer,integer) to service_role;
grant execute on function public.create_barbershop(jsonb),public.update_shop(uuid,jsonb),public.manage_appointment(uuid,text,timestamptz,uuid,uuid),public.admin_update_shop(uuid,boolean,text) to authenticated;
grant select on all tables in schema public to authenticated;
grant insert,update,delete on barbers,services,barber_services,business_hours,barber_availability,blocked_times to authenticated;
grant all on all tables in schema public to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('barbershops','barbershops',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy shop_media_read on storage.objects for select to anon,authenticated using(bucket_id='barbershops');
create policy shop_media_insert on storage.objects for insert to authenticated with check(bucket_id='barbershops' and (storage.foldername(name))[1] in(select barbershop_id::text from public.barbershop_members where user_id=auth.uid()));
create policy shop_media_delete on storage.objects for delete to authenticated using(bucket_id='barbershops' and (storage.foldername(name))[1] in(select barbershop_id::text from public.barbershop_members where user_id=auth.uid()));
