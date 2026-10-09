import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { testSchema } from './helpers/schema';

test('regressões: papéis, privacidade, transições e limites',async t=>{
 const db=new PGlite({extensions:{btree_gist,pgcrypto}});t.after(()=>db.close());
 await db.exec(testSchema);
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(`supabase/migrations/${f}`,'utf8'));
 const owner=crypto.randomUUID(),manager=crypto.randomUUID(),other=crypto.randomUUID();
 await db.query('insert into auth.users(id) values($1),($2),($3)',[owner,manager,other]);
 async function as(id:string,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);}
 async function root(){await db.exec("reset role;select set_config('request.jwt.claim.sub','',false)");}
 const input={name:'Fixture',slug:'security-fixture',phone:'11999998888',whatsapp:'11999998888',service_name:'Corte',price_cents:4000,duration_minutes:30,barber_name:'Fixture',opens_at:'09:00',closes_at:'18:00'};
 await as(owner);const shop=(await db.query<{id:string}>('select create_barbershop($1::jsonb) id',[JSON.stringify(input)])).rows[0].id;
 const barber=(await db.query<{id:string}>('select id from barbers')).rows[0].id, service=(await db.query<{id:string}>('select id from services')).rows[0].id;
 await as(other);const shopB=(await db.query<{id:string}>('select create_barbershop($1::jsonb) id',[JSON.stringify({...input,slug:'security-other'})])).rows[0].id;
 await root();await db.query("insert into barbershop_members(barbershop_id,user_id,role) values($1,$2,'MANAGER')",[shop,manager]);
 const date=(await db.query<{d:string}>("select to_char(current_date+case when extract(dow from current_date+1)=0 then 2 else 1 end,'YYYY-MM-DD') d")).rows[0].d;
 const start=(h:string)=>`${date}T${h}:00-03:00`;
 const booking=(h:string,phone='11988887777',name='Original',whatsapp=phone,email='original@example.com')=>db.query<{receipt:Record<string,unknown>}>('select book_appointment($1,$2,$3,$4,$5,$6,$7,$8) receipt',[input.slug,service,barber,start(h),name,phone,whatsapp,email]);
 const manage=(id:string,status:string,h?:string)=>db.query('select manage_appointment($1,$2,$3)',[id,status,h?start(h):null]);
 await t.test('MANAGER não muda configurações, equipe, preços, plano ou propriedade',async()=>{
  await as(manager);assert.equal((await db.query<{v:boolean}>('select is_owner($1) v',[shop])).rows[0].v,false);
  await assert.rejects(db.query('select update_shop($1,$2::jsonb)',[shop,JSON.stringify(input)]),/proprietário/);
  assert.equal((await db.query('update barbers set name=$1 where id=$2 returning id',['Intruso',barber])).rows.length,0);
  await assert.rejects(db.query('insert into barbers(barbershop_id,name) values($1,$2)',[shop,'Intruso']),/row-level/);
  await assert.rejects(db.query('update services set price_cents=1 where id=$1',[service]),/proprietário/);
  await assert.rejects(db.query('insert into services(barbershop_id,name,price_cents,duration_minutes) values($1,$2,1,30)',[shop,'Novo']),/proprietário/);
  await assert.rejects(db.query("update subscriptions set plan='PRO' where barbershop_id=$1",[shop]));
  await assert.rejects(db.query('select set_member_role($1,$2,$3)',[shop,manager,'OWNER']),/proprietário/);
  await assert.rejects(db.query("update barbershop_members set role='OWNER' where user_id=$1",[manager]));
 });
 await t.test('OWNER gerencia preços e permissões; último proprietário é preservado',async()=>{
  await as(owner);await db.query('update services set price_cents=4100 where id=$1',[service]);
  await db.query('update services set price_cents=4000 where id=$1',[service]);
  await db.query('select set_member_role($1,$2,$3)',[shop,manager,'OWNER']);
  await db.query('select set_member_role($1,$2,$3)',[shop,manager,'MANAGER']);
  await assert.rejects(db.query('select set_member_role($1,$2,$3)',[shop,owner,'MANAGER']),/manter um proprietário/);
  await assert.rejects(db.query('select set_member_role($1,$2,$3)',[shop,other,'MANAGER']),/não pertence/);
 });
 await t.test('MANAGER pode serviços operacionais, horários e bloqueios; RPC bloqueia alteração financeira',async()=>{
  await as(manager);await db.query('update services set description=$1 where id=$2',['Permitido',service]);
  const data={name:'Corte',description:'Permitido',price_cents:4000,duration_minutes:30,photo_url:'',active:true};
  await db.query('select save_service($1,$2,$3::jsonb,$4::uuid[])',[shop,service,JSON.stringify(data),[barber]]);
  await assert.rejects(db.query('select save_service($1,$2,$3::jsonb,$4::uuid[])',[shop,service,JSON.stringify({...data,price_cents:1}),[barber]]),/proprietário/);
  await db.query('select add_block($1,$2,$3,$4,$5)',[shop,barber,date+'T17:00',date+'T18:00','Fixture']);
  await db.query('delete from blocked_times where barbershop_id=$1',[shop]);
  await db.query('select replace_hours($1,null,$2::jsonb)',[shop,JSON.stringify(Array.from({length:7},(_,weekday)=>({weekday,opens_at:'09:00',closes_at:'18:00'})))]);
 });
 await t.test('nenhum papel operacional acessa ou escreve outro tenant',async()=>{
  for(const user of [owner,manager]){await as(user);assert.equal((await db.query('select * from customers where barbershop_id=$1',[shopB])).rows.length,0);await assert.rejects(db.query('select replace_hours($1,null,$2::jsonb)',[shopB,'[]']),/Acesso negado/);await assert.rejects(db.query('select update_shop($1,$2::jsonb)',[shopB,'{}']),/proprietário/);}
 });
 await t.test('Storage separa imagens de serviço/equipe e bloqueia membros suspensos',async()=>{
  await as(manager);await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['barbershops',`${shop}/services/fixture.png`]);
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['barbershops',`${shop}/fixture.png`]),/row-level/);
  await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['barbershops',`${shopB}/services/fixture.png`]),/row-level/);
  await as(owner);await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['barbershops',`${shop}/owner.png`]);
  await root();await db.query('update barbershops set suspended=true where id=$1',[shop]);
  await as(owner);await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['barbershops',`${shop}/blocked.png`]),/row-level/);
  await root();await db.query('update barbershops set suspended=false where id=$1',[shop]);
 });
 await t.test('EXECUTE: público não reserva diretamente nem chama funções internas',async()=>{
  for(const role of ['anon','authenticated']){await as(role==='anon'?'':manager,role);await assert.rejects(booking('09:00'),/permission denied/);await assert.rejects(db.query('select appointment_slot_available($1,$2,$3,$4,30)',[shop,service,barber,start('09:00')]),/permission denied/);await assert.rejects(db.query('select normalize_br_phone($1)',['11999998888']),/permission denied/);}
  await as('','anon');await assert.rejects(db.query('select manage_appointment_checked($1,$2)',[crypto.randomUUID(),'CANCELLED']),/permission denied/);
 });
 let appointment:string;
 await t.test('reserva sem login não sobrescreve cadastro pelo mesmo telefone/+55',async()=>{
  await as('','service_role');await booking('09:00');const receipt=(await booking('10:00','+55 (11) 98888-7777','Outro Nome','21999998888','intruso@example.com')).rows[0].receipt;
  const customers=(await db.query<{name:string;whatsapp:string;email:string}>('select name,whatsapp,email from customers where barbershop_id=$1',[shop])).rows;
  assert.equal(customers.length,1);assert.deepEqual(customers[0],{name:'Original',whatsapp:'11988887777',email:'original@example.com'});
  assert.equal(receipt.customer,'Outro Nome');for(const key of ['phone','email','customer_id','id'])assert.equal(receipt[key],undefined);
  appointment=(await db.query<{id:string}>('select id from appointments where starts_at=$1',[start('09:00')])).rows[0].id;
 });
 await t.test('normalização SQL rejeita telefone/WhatsApp inválidos e nome ausente',async()=>{
  await root();for(const phone of ['00000000000','11811112222','+1 202 555 1234','11999998888abc'])await assert.rejects(db.query('select normalize_br_phone($1)',[phone]),/Telefone inválido/);
  assert.equal((await db.query<{v:string}>('select normalize_br_phone($1) v',['+55 (11) 99999-8888'])).rows[0].v,'11999998888');
  await assert.rejects(booking('11:00','11999998888','Válido','invalido'),/Telefone inválido/);
  await assert.rejects(db.query('select book_appointment($1,$2,$3,$4,null,$5,$5)',[input.slug,service,barber,start('11:00'),'11999998888']),/Dados do cliente/);
 });
 await t.test('cadastro só é atualizado por membro autenticado do mesmo tenant',async()=>{
  await root();const customer=(await db.query<{id:string}>('select id from customers where barbershop_id=$1',[shop])).rows[0].id;
  const data={name:'Original corrigido',phone:'11988887777',whatsapp:'11988887777',email:'original@example.com'};
  await as('','anon');await assert.rejects(db.query('select update_customer($1,$2,$3::jsonb)',[shop,customer,JSON.stringify(data)]),/permission denied/);
  await as(other);await assert.rejects(db.query('select update_customer($1,$2,$3::jsonb)',[shop,customer,JSON.stringify(data)]),/Acesso negado/);
  await as(manager);await db.query('select update_customer($1,$2,$3::jsonb)',[shop,customer,JSON.stringify(data)]);
  assert.equal((await db.query<{name:string}>('select name from customers where id=$1',[customer])).rows[0].name,'Original corrigido');
  await assert.rejects(db.query('select update_customer($1,$2,$3::jsonb)',[shop,customer,JSON.stringify({...data,whatsapp:'invalid'})]),/Telefone inválido/);
 });
 await t.test('cancelamento não permite mudança terminal nem reativação implícita',async()=>{
  await as(manager);await manage(appointment,'CANCELLED');
  await assert.rejects(manage(appointment,'NO_SHOW'),/Transição/);
  await assert.rejects(manage(appointment,'CONFIRMED'),/reativar/);
  await assert.rejects(manage(appointment,'COMPLETED'),/Transição/);
 });
 await t.test('reativação revalida conflito, grade, bloqueios e horário comercial',async()=>{
  await as(manager);await assert.rejects(manage(appointment,'CONFIRMED','10:00'),/Horário indisponível/);
  await assert.rejects(manage(appointment,'CONFIRMED','08:00'),/Horário indisponível/);
  await assert.rejects(manage(appointment,'CONFIRMED','17:45'),/Horário indisponível/);
  await assert.rejects(manage(appointment,'CONFIRMED','09:01'),/Horário indisponível/);
  await db.query('select add_block($1,$2,$3,$4,$5)',[shop,barber,date+'T11:00',date+'T12:00','Fixture']);
  await assert.rejects(manage(appointment,'CONFIRMED','11:00'),/Horário indisponível/);
  await db.query('delete from blocked_times where barbershop_id=$1',[shop]);
  await manage(appointment,'CONFIRMED','11:00');
  await assert.rejects(manage(appointment,'PENDING'),/Transição/);
 });
 await t.test('remarcação preserva snapshots; edição concorrente obsoleta é rejeitada',async()=>{
  await root();const previous=(await db.query<{updated_at:Date;price_cents:number;duration:number}>('select updated_at,price_cents,extract(epoch from ends_at-starts_at)/60 duration from appointments where id=$1',[appointment])).rows[0];
  await db.query('update services set price_cents=9900,duration_minutes=60 where id=$1',[service]);
  await as(manager);assert.equal((await db.query('select * from available_slots($1,$2,$3,$4,$5) where starts_at=$6',[input.slug,service,barber,date,appointment,start('17:30')])).rows.length,1);
  await as('','anon');assert.equal((await db.query('select * from available_slots($1,$2,$3,$4,$5) where starts_at=$6',[input.slug,service,barber,date,appointment,start('17:30')])).rows.length,0);
  await as(manager);await db.query('select manage_appointment_checked($1,$2,$3,null,null,$4)',[appointment,'CONFIRMED',start('12:00'),previous.updated_at]);
  const after=(await db.query<{price_cents:number;duration:number}>('select price_cents,extract(epoch from ends_at-starts_at)/60 duration from appointments where id=$1',[appointment])).rows[0];
  assert.equal(after.price_cents,previous.price_cents);assert.equal(after.duration,previous.duration);
  await assert.rejects(db.query('select manage_appointment_checked($1,$2,null,null,null,$3)',[appointment,'CANCELLED',previous.updated_at]),/outra pessoa/);
  await root();await db.query('update services set price_cents=4000,duration_minutes=30 where id=$1',[service]);
 });
 await t.test('COMPLETED/NO_SHOW são terminais e não voltam para agenda',async()=>{
  await root();await db.query("update appointments set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',status='CONFIRMED' where id=$1",[appointment]);
  await as(manager);await manage(appointment,'COMPLETED');await manage(appointment,'COMPLETED');
  await assert.rejects(manage(appointment,'CONFIRMED'),/encerrado/);await assert.rejects(manage(appointment,'CONFIRMED','14:00'),/encerrado/);
  await root();await db.query("update appointments set status='NO_SHOW' where id=$1",[appointment]);await as(manager);await assert.rejects(manage(appointment,'CONFIRMED','14:00'),/encerrado/);
 });
 await t.test('outro tenant não pode administrar o agendamento conhecido',async()=>{await as(other);await assert.rejects(manage(appointment,'CANCELLED'),/Acesso negado/);});
 await t.test('rate limiting persistente isola buckets, rejeita configuração inválida e renova expiração',async()=>{
  await as('','service_role');for(let i=0;i<3;i++)assert.equal((await db.query<{v:boolean}>('select consume_rate_limit($1,3,60) v',['fixture-limit'])).rows[0].v,true);
  assert.equal((await db.query<{v:boolean}>('select consume_rate_limit($1,3,60) v',['fixture-limit'])).rows[0].v,false);
  assert.equal((await db.query<{v:boolean}>('select consume_rate_limit($1,3,60) v',['other-limit'])).rows[0].v,true);
  await db.query("update rate_limits set expires_at=now()-interval '1 second' where key=$1",['fixture-limit']);
  assert.equal((await db.query<{v:boolean}>('select consume_rate_limit($1,3,60) v',['fixture-limit'])).rows[0].v,true);
  await assert.rejects(db.query('select consume_rate_limit($1,0,60)',['invalid']),/Limite inválido/);
 });
 await t.test('definers não herdam EXECUTE de PUBLIC e mantêm search_path protegido',async()=>{
  await root();const rows=(await db.query<{proname:string;proconfig:string[];anon:boolean}>("select p.proname,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef")).rows;
  for(const row of rows){assert.ok(row.proconfig?.some(v=>v.startsWith('search_path=pg_catalog, public')),row.proname);assert.equal(row.anon,['public_shop','available_slots'].includes(row.proname),row.proname);}
 });
 await t.test('teste dura sete dias, expiração bloqueia reservas e membros não estendem prazo',async()=>{
  await root();const sub=(await db.query<{days:number;plan:string;subscription_status:string}>("select extract(epoch from(subscription_expires_at-created_at))/86400 days,plan,subscription_status from subscriptions where barbershop_id=$1",[shopB])).rows[0];
  assert.ok(Math.abs(Number(sub.days)-7)<0.01);assert.equal(sub.plan,'PRO');assert.equal(sub.subscription_status,'trialing');
  await as(manager);await assert.rejects(db.query("update subscriptions set subscription_expires_at=now()+interval '1 year' where barbershop_id=$1",[shop]));
  await root();await db.query("update subscriptions set subscription_expires_at=now()-interval '1 second' where barbershop_id=$1",[shop]);
  await as('', 'service_role');await assert.rejects(booking('17:00','11922223333'),/temporariamente indisponíveis/);
 });
});
