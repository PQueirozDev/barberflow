begin;
create table public.pix_invoices (
 id uuid primary key default gen_random_uuid(),
 barbershop_id uuid not null references public.barbershops(id),
 created_by uuid not null references auth.users(id),
 txid text not null unique default left(replace(gen_random_uuid()::text,'-',''),25) check(txid ~ '^[a-zA-Z0-9]{1,25}$'),
 destination_hash text not null check(destination_hash ~ '^[a-f0-9]{64}$'),
 amount_cents integer not null default 4990 check(amount_cents=4990),
 access_days integer not null default 30 check(access_days=30),
 status text not null default 'PENDING' check(status in ('PENDING','REPORTED','CONFIRMED','REJECTED')),
 created_at timestamptz not null default now(), reported_at timestamptz,
 confirmed_at timestamptz, confirmed_by uuid references auth.users(id),
 bank_reference text unique, access_starts_at timestamptz, access_ends_at timestamptz,
 rejection_reason text,
 check((status='CONFIRMED')=(confirmed_at is not null)),
 check(status<>'CONFIRMED' or (confirmed_by is not null and bank_reference is not null and bank_reference ~ '^E[a-zA-Z0-9]{31}$' and access_starts_at is not null and access_ends_at is not null and access_ends_at>access_starts_at))
);
create unique index pix_open_invoice on public.pix_invoices(barbershop_id,destination_hash) where status in ('PENDING','REPORTED');
create index pix_review_queue on public.pix_invoices(status,created_at);
alter table public.pix_invoices enable row level security;
create policy pix_read on public.pix_invoices for select to authenticated using(public.is_owner(barbershop_id) or public.is_admin());
grant select on public.pix_invoices to authenticated;
revoke all on public.pix_invoices from anon;

create table public.pix_review_events (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.pix_invoices(id),
 actor_id uuid not null references auth.users(id), action text not null check(action in ('CONFIRMED','REJECTED')),
 created_at timestamptz not null default now()
);
alter table public.pix_review_events enable row level security;
create policy pix_audit_read on public.pix_review_events for select to authenticated using(public.is_admin());
grant select on public.pix_review_events to authenticated;

create function public.request_pix_invoice(p_shop uuid,p_destination_hash text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare invoice uuid;
begin
 if not public.is_owner(p_shop) then raise exception 'Acesso negado.'; end if;
 perform 1 from public.barbershops where id=p_shop and not suspended for update;
 if not found then raise exception 'Acesso negado.'; end if;
 if not public.is_owner(p_shop) then raise exception 'Acesso negado.'; end if;
 if p_destination_hash is null or p_destination_hash !~ '^[a-f0-9]{64}$' then raise exception 'Configuração Pix inválida.'; end if;
 select id into invoice from public.pix_invoices where barbershop_id=p_shop and destination_hash=p_destination_hash and status in ('PENDING','REPORTED');
 if invoice is not null then return invoice; end if;
 if (select count(*) from public.pix_invoices where barbershop_id=p_shop and created_at>now()-interval '24 hours')>=5 then raise exception 'Limite de solicitações atingido. Tente mais tarde.'; end if;
 insert into public.pix_invoices(barbershop_id,created_by,destination_hash) values(p_shop,auth.uid(),p_destination_hash) returning id into invoice;
 return invoice;
end $$;

create function public.report_pix_payment(p_invoice uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare invoice public.pix_invoices;
begin
 select * into invoice from public.pix_invoices where id=p_invoice for update;
 if invoice.id is null or not public.is_owner(invoice.barbershop_id) then raise exception 'Acesso negado.'; end if;
 if invoice.status not in ('PENDING','REPORTED') then raise exception 'Solicitação encerrada.'; end if;
 update public.pix_invoices set status='REPORTED',reported_at=coalesce(reported_at,now()) where id=p_invoice;
 -- Reporting is only a request for review. It NEVER grants subscription access.
end $$;

create function public.confirm_pix_payment(p_invoice uuid,p_bank_reference text,p_received_cents integer) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare invoice public.pix_invoices; sub public.subscriptions; grant_start timestamptz;
begin
 if not public.is_admin() then raise exception 'Acesso negado.'; end if;
 if p_received_cents is distinct from 4990 or p_bank_reference is null or p_bank_reference !~ '^E[a-zA-Z0-9]{31}$' then raise exception 'Confira o valor recebido e o identificador bancário do Pix.'; end if;
 -- Same shop-first lock order as booking prevents subscription/booking deadlocks.
 select * into invoice from public.pix_invoices where id=p_invoice;
 if invoice.id is null then raise exception 'Solicitação não encontrada.'; end if;
 perform 1 from public.barbershops where id=invoice.barbershop_id for update;
 select * into invoice from public.pix_invoices where id=p_invoice for update;
 if invoice.status='CONFIRMED' then
  if invoice.bank_reference<>p_bank_reference then raise exception 'Pagamento já confirmado com outro identificador.'; end if;
  return;
 end if;
 if invoice.status='REJECTED' then raise exception 'Solicitação encerrada.'; end if;
 select * into sub from public.subscriptions where barbershop_id=invoice.barbershop_id for update;
 if sub.id is null then raise exception 'Assinatura não encontrada.'; end if;
 if sub.plan='PRO' and sub.subscription_status='active' and sub.subscription_expires_at is null then raise exception 'Assinatura sem vencimento: revisão administrativa necessária.'; end if;
 grant_start:=now();
 if sub.plan='PRO' and sub.subscription_status in ('active','trialing') and sub.subscription_expires_at>now() then grant_start:=sub.subscription_expires_at; end if;
 update public.pix_invoices set status='CONFIRMED',confirmed_at=now(),confirmed_by=auth.uid(),bank_reference=p_bank_reference,
 access_starts_at=grant_start,access_ends_at=grant_start+interval '30 days' where id=p_invoice;
 update public.subscriptions set plan='PRO',subscription_status='active',subscription_expires_at=grant_start+interval '30 days',provider='manual_pix' where id=sub.id;
 insert into public.pix_review_events(invoice_id,actor_id,action) values(p_invoice,auth.uid(),'CONFIRMED');
end $$;

create function public.reject_pix_payment(p_invoice uuid,p_reason text) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare invoice public.pix_invoices;
begin
 if not public.is_admin() then raise exception 'Acesso negado.'; end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 200 then raise exception 'Informe o motivo da recusa.'; end if;
 select * into invoice from public.pix_invoices where id=p_invoice for update;
 if invoice.id is null then raise exception 'Solicitação não encontrada.'; end if;
 if invoice.status not in ('PENDING','REPORTED') then raise exception 'Solicitação encerrada.'; end if;
 update public.pix_invoices set status='REJECTED',rejection_reason=trim(p_reason) where id=p_invoice;
 insert into public.pix_review_events(invoice_id,actor_id,action) values(p_invoice,auth.uid(),'REJECTED');
end $$;

revoke execute on function public.request_pix_invoice(uuid,text),public.report_pix_payment(uuid),public.confirm_pix_payment(uuid,text,integer),public.reject_pix_payment(uuid,text) from public,anon;
grant execute on function public.request_pix_invoice(uuid,text),public.report_pix_payment(uuid),public.confirm_pix_payment(uuid,text,integer),public.reject_pix_payment(uuid,text) to authenticated;
commit;
