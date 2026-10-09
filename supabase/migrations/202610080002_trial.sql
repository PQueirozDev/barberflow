begin;
-- FREE remains only as a historical storage value; it grants no entitlement.
alter table public.subscriptions alter column plan set default 'PRO';
alter table public.subscriptions alter column subscription_status set default 'trialing';
alter table public.subscriptions alter column subscription_expires_at set default (now()+interval '7 days');
update public.subscriptions set plan='PRO',subscription_status='trialing',subscription_expires_at=now()+interval '7 days'
where plan='FREE';

create function public.initialize_trial() returns trigger language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
begin
 -- Onboarding cannot submit a paid plan or an arbitrary trial expiry.
 new.plan:='PRO'; new.subscription_status:='trialing';
 new.subscription_expires_at:=now()+interval '7 days';
 new.provider:=null; new.provider_subscription_id:=null;
 return new;
end $$;
create trigger initialize_trial before insert on public.subscriptions for each row execute function public.initialize_trial();

create function public.enforce_booking_subscription() returns trigger language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
begin
 -- Existing appointments may still be confirmed, completed or cancelled.
 if new.status in ('PENDING','CONFIRMED') and
 (TG_OP='INSERT' or new.starts_at is distinct from old.starts_at or new.barber_id is distinct from old.barber_id or new.service_id is distinct from old.service_id or old.status='CANCELLED') then
  if not exists(select 1 from public.subscriptions where barbershop_id=new.barbershop_id and plan='PRO'
    and ((subscription_status='trialing' and subscription_expires_at>now())
      or (subscription_status='active' and (subscription_expires_at is null or subscription_expires_at>now())))) then
   raise exception 'Agendamentos temporariamente indisponíveis. Entre em contato com a barbearia.';
  end if;
 end if;
 return new;
end $$;
create trigger booking_subscription before insert or update on public.appointments for each row execute function public.enforce_booking_subscription();
revoke execute on function public.initialize_trial(),public.enforce_booking_subscription() from public,anon,authenticated;
commit;
