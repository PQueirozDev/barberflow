-- Read-only launch verification. Does not read customer records or create test users.
select 'tenant_rls' as check_name,
  count(*)=13 and bool_and(c.relrowsecurity) as passed
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
('profiles','barbershops','barbershop_members','barbers','services','barber_services',
 'customers','business_hours','barber_availability','blocked_times','appointments','subscriptions','rate_limits')
union all
select 'appointment_gist_exclusion',exists(
 select 1 from pg_constraint where conrelid='public.appointments'::regclass
 and contype='x' and pg_get_constraintdef(oid) like 'EXCLUDE USING gist%')
union all
select 'new_authorization_rpcs',
 to_regprocedure('public.is_owner(uuid)') is not null and
 to_regprocedure('public.can_manage_operations(uuid)') is not null and
 to_regprocedure('public.manage_appointment_checked(uuid,text,timestamptz,uuid,uuid,timestamptz)') is not null
union all
select 'booking_rpc_private',not has_function_privilege('anon',
 'public.book_appointment(text,uuid,uuid,timestamptz,text,text,text,text)','EXECUTE')
union all
select 'rate_limit_rpc_private',not has_function_privilege('anon',
 'public.consume_rate_limit(text,integer,integer)','EXECUTE')
union all
select 'trial_triggers',count(*)=2 from pg_trigger
 where not tgisinternal and
 ((tgrelid='public.subscriptions'::regclass and tgname='initialize_trial') or
 (tgrelid='public.appointments'::regclass and tgname='booking_subscription'))
union all
select 'pix_rls',count(*)=2 and bool_and(c.relrowsecurity)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('pix_invoices','pix_review_events')
union all
select 'terms_acceptance',to_regprocedure('public.onboard_with_terms(jsonb,text)') is not null
 and (select count(*)=2 from information_schema.columns where table_schema='public'
 and table_name='profiles' and column_name in ('terms_accepted_at','terms_version'));
