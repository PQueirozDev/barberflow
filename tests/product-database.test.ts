import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { testSchema } from './helpers/schema';

test('Zekro 2: onboarding, recebimentos, espera, fidelidade e agregações isoladas',async t=>{
 const db=new PGlite({extensions:{btree_gist,pgcrypto}});t.after(()=>db.close());await db.exec(testSchema);
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(`supabase/migrations/${f}`,'utf8'));
 const owner=crypto.randomUUID(),other=crypto.randomUUID(),manager=crypto.randomUUID();
 await db.query('insert into auth.users(id) values($1),($2),($3)',[owner,other,manager]);
 async function as(user:string,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec(`set role ${role}`);}
 const input={name:'Fixture 2',slug:'product-fixture',phone:'11999998888',whatsapp:'11999998888',service_name:'Corte',price_cents:4000,duration_minutes:30,barber_name:'Fixture',opens_at:'09:00',closes_at:'18:00',primary_color:'#153d2e',timezone:'America/Sao_Paulo',weekdays:[0,1,2,3,4,5,6]};
 await as(owner);const shop=(await db.query<{id:string}>('select onboard_v2($1::jsonb,$2) id',[JSON.stringify(input),'2026-10-08'])).rows[0].id;
 const service=(await db.query<{id:string}>('select id from services')).rows[0].id,barber=(await db.query<{id:string}>('select id from barbers')).rows[0].id;
 await t.test('onboarding repetido reutiliza tenant e preserva serviços/horários',async()=>{
  assert.equal((await db.query<{id:string}>('select onboard_v2($1::jsonb,$2) id',[JSON.stringify(input),'2026-10-08'])).rows[0].id,shop);
  assert.equal((await db.query('select * from services')).rows.length,1);assert.equal((await db.query('select * from business_hours')).rows.length,7);
 });
 await as(other);const shopB=(await db.query<{id:string}>('select onboard_v2($1::jsonb,$2) id',[JSON.stringify({...input,slug:'product-other'}),'2026-10-08'])).rows[0].id;
 await db.exec('reset role');await db.query("insert into barbershop_members(barbershop_id,user_id,role) values($1,$2,'MANAGER')",[shop,manager]);
 await as(owner);const customer=(await db.query<{id:string}>('select create_customer($1,$2::jsonb) id',[shop,JSON.stringify({name:'Cliente fictício',phone:'11988887777',whatsapp:'11988887777',email:''})])).rows[0].id;
 await db.exec('reset role');
 const appointment=(await db.query<{id:string}>("insert into appointments(barbershop_id,service_id,barber_id,customer_id,starts_at,ends_at,price_cents,status) values($1,$2,$3,$4,now()-interval '2 hours',now()-interval '90 minutes',4000,'COMPLETED') returning id",[shop,service,barber,customer])).rows[0].id;
 const today=(await db.query<{d:string}>("select (now() at time zone 'America/Sao_Paulo')::date::text d")).rows[0].d;
 const summary=()=>db.query<{v:{received:number;completedValue:number;capacityMinutes:number;occupancy:number|null}}>('select shop_analytics($1,$2,$3) v',[shop,today,today]);
 let payment:string;
 await t.test('conclusão sozinha não é receita; pagamento é único e não muda assinatura',async()=>{
  await as(manager);assert.equal((await summary()).rows[0].v.received,0);
  const before=await db.query('select * from subscriptions where barbershop_id=$1',[shop]);
  payment=(await db.query<{id:string}>('select record_service_payment($1,$2,now()) id',[appointment,'PIX'])).rows[0].id;
  assert.equal((await db.query<{id:string}>('select record_service_payment($1,$2,now()) id',[appointment,'PIX'])).rows[0].id,payment);
  assert.equal((await summary()).rows[0].v.received,4000);assert.deepEqual(await db.query('select * from subscriptions where barbershop_id=$1',[shop]),before);
  await assert.rejects(db.query('select record_service_payment($1,$2,now())',[appointment,'CARD']),/já registrado/);
  await assert.rejects(db.query("insert into service_payments(barbershop_id,appointment_id,amount_cents,method,paid_at,recorded_by) values($1,$2,1,'PIX',now(),$3)",[shop,appointment,manager]));
 });
 await t.test('outro tenant e anônimo não acessam financeiro, métricas ou espera',async()=>{
  await as(other);assert.equal((await db.query('select * from service_payments')).rows.length,0);
  for(const sql of ['select record_service_payment($1,\'PIX\',now())','select void_service_payment($1,\'Anulação teste\')'])await assert.rejects(db.query(sql,[sql.includes('void_')?payment:appointment]),/Acesso negado/);
  await assert.rejects(summary(),/Acesso negado/);await assert.rejects(db.query('select customer_directory($1)',[shop]),/Acesso negado/);
  await as('','anon');await assert.rejects(summary());await assert.rejects(db.query('select * from service_payments'));await assert.rejects(db.query('select * from waitlist_entries'));
 });
 await t.test('anulação exige OWNER e motivo; mantém histórico e tira valor da receita',async()=>{
  await as(manager);await assert.rejects(db.query('select void_service_payment($1,$2)',[payment,'Erro de registro']),/Acesso negado/);
  await as(owner);await assert.rejects(db.query('select void_service_payment($1,$2)',[payment,'x']),/motivo/);await db.query('select void_service_payment($1,$2)',[payment,'Erro de registro']);
  assert.equal((await summary()).rows[0].v.received,0);assert.equal((await db.query('select * from service_payments')).rows.length,1);
 });
 await t.test('ocupação usa união de janelas sem duplicar capacidade',async()=>{
  await as(owner);const before=(await summary()).rows[0].v.capacityMinutes;
  await db.exec('reset role');await db.query('insert into business_hours(barbershop_id,weekday,opens_at,closes_at) select barbershop_id,weekday,opens_at,closes_at from business_hours where barbershop_id=$1',[shop]);
  await as(owner);assert.equal((await summary()).rows[0].v.capacityMinutes,before);assert.equal(before,540);
 });
 const tomorrow=(await db.query<{d:string}>("select ((now() at time zone 'America/Sao_Paulo')::date+1)::text d")).rows[0].d;
 const join=()=>db.query('select join_waitlist($1,$2,$3,$4,$5,$6,$7,true)',[input.slug,service,barber,tomorrow,'ANY','Cliente espera','11977776666']);
 await t.test('espera exige ativação e consentimento, não reserva e não duplica',async()=>{
  await as('','service_role');await assert.rejects(join(),/indisponível/);await as(owner);await db.query('select set_waitlist_enabled($1,true)',[shop]);
  await as('','service_role');await assert.rejects(db.query('select join_waitlist($1,$2,$3,$4,$5,$6,$7,false)',[input.slug,service,barber,tomorrow,'ANY','Fixture','11977776666']),/Autorize/);await join();await join();
  await as(owner);assert.equal((await db.query('select * from waitlist_entries')).rows.length,1);assert.equal((await db.query('select * from appointments')).rows.length,1);
  const rows=(await db.query<{v:{id:string;opportunity:string}[]}>('select waitlist_opportunities($1) v',[shop])).rows[0].v;assert.ok(rows[0].opportunity);
  await db.query('select close_waitlist($1,$2)',[rows[0].id,'CONTACTED']);assert.equal((await db.query('select * from appointments')).rows.length,1);
  await as('','anon');const publicData=(await db.query<{v:Record<string,unknown>}>('select public_features($1) v',[input.slug])).rows[0].v;assert.deepEqual(publicData,{waitlist_enabled:true});
 });
 await t.test('fidelidade conta somente concluídos e impede resgate duplicado',async()=>{
  await as(manager);await assert.rejects(db.query('select configure_loyalty($1,true,2,$2)',[shop,'Barba de presente']),/Acesso negado/);
  await as(owner);await db.query('select configure_loyalty($1,true,2,$2)',[shop,'Barba de presente']);
  const program=(await db.query<{id:string}>('select id from loyalty_programs')).rows[0].id;
  await db.exec('reset role');await db.query("update loyalty_programs set starts_at=now()-interval '7 days' where id=$1",[program]);
  await db.query("insert into appointments(barbershop_id,service_id,barber_id,customer_id,starts_at,ends_at,price_cents,status) values($1,$2,$3,$4,now()-interval '4 hours',now()-interval '3 hours',4000,'CANCELLED')",[shop,service,barber,customer]);
  await as(manager);await assert.rejects(db.query('select redeem_loyalty($1,$2,1)',[program,customer]),/insuficientes/);
  await db.exec('reset role');await db.query("insert into appointments(barbershop_id,service_id,barber_id,customer_id,starts_at,ends_at,price_cents,status) values($1,$2,$3,$4,now()-interval '6 hours',now()-interval '5 hours',4000,'COMPLETED')",[shop,service,barber,customer]);
  await as(manager);await db.query('select redeem_loyalty($1,$2,1)',[program,customer]);await db.query('select redeem_loyalty($1,$2,1)',[program,customer]);
  assert.equal((await db.query('select * from loyalty_redemptions')).rows.length,1);await assert.rejects(db.query('select redeem_loyalty($1,$2,2)',[program,customer]),/insuficientes/);
  await as(other);await assert.rejects(db.query('select redeem_loyalty($1,$2,1)',[program,customer]),/Acesso negado/);
  assert.equal((await db.query('select * from loyalty_redemptions where barbershop_id=$1',[shop])).rows.length,0);
  assert.notEqual(shop,shopB);
 });
});
