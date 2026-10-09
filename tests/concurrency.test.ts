import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,sep,basename } from 'node:path';
import { createServer } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';
import { testSchema } from './helpers/schema';

test('PostgreSQL nativo: concorrência entre conexões independentes', {timeout:120_000},async t=>{
 // Only a newly-created local cluster. Never reads DATABASE_URL/.env/Supabase.
 const socket=createServer();await new Promise<void>(resolve=>socket.listen(0,'127.0.0.1',resolve));
 const address=socket.address();if(!address||typeof address==='string')throw new Error('Porta local indisponível.');const port=address.port;
 await new Promise<void>((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));
 const databaseDir=await mkdtemp(join(tmpdir(),'barberflow-postgres-test-'));
 if(!resolve(databaseDir).startsWith(resolve(tmpdir())+sep)||!basename(databaseDir).startsWith('barberflow-postgres-test-'))throw new Error('Diretório de teste fora da pasta temporária.');
 const cluster=new EmbeddedPostgres({databaseDir,user:'postgres',password:crypto.randomUUID(),port,persistent:false,createPostgresUser:false,initdbFlags:['--locale=C','--encoding=UTF8'],postgresFlags:['-c','listen_addresses=127.0.0.1'],onLog:()=>{},onError:()=>{}});
 const clients:ReturnType<typeof cluster.getPgClient>[]=[];
 t.after(async()=>{for(const client of clients)await client.end();await cluster.stop();});
 await cluster.initialise();await cluster.start();
 for(let i=0;i<3;i++){const c=cluster.getPgClient('postgres','127.0.0.1');await c.connect();clients.push(c);}
 const [root,left,right]=clients;
 for(const c of clients)await c.query("set statement_timeout='15s'");
 await root.query(testSchema);
 for(const f of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await root.query(await readFile(`supabase/migrations/${f}`,'utf8'));
 const owner=crypto.randomUUID();await root.query('insert into auth.users(id) values($1)',[owner]);
 await root.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const input={name:'Concorrência',slug:'concurrency-fixture',phone:'11999998888',whatsapp:'11999998888',service_name:'Corte',price_cents:4000,duration_minutes:30,barber_name:'Fixture',opens_at:'09:00',closes_at:'18:00'};
 const shop=(await root.query('select create_barbershop($1::jsonb) id',[JSON.stringify(input)])).rows[0].id;
 const barber=(await root.query('select id from barbers')).rows[0].id,service=(await root.query('select id from services')).rows[0].id;
 const date=(await root.query("select to_char(current_date+case when extract(dow from current_date+1)=0 then 2 else 1 end,'YYYY-MM-DD') d")).rows[0].d;
 const start=(h:string)=>`${date}T${h}:00-03:00`;
 const book=(client:typeof left,h:string,phone:string)=>client.query('select book_appointment($1,$2,$3,$4,$5,$6,$6)',[input.slug,service,barber,start(h),'Fixture',phone]);
 await t.test('duas reservas simultâneas: exatamente uma é criada',async()=>{
  const results=await Promise.allSettled([book(left,'09:00','11988887777'),book(right,'09:00','11988886666')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const rejected=results.find(r=>r.status==='rejected');assert.ok(rejected?.status==='rejected'&&/Horário indisponível/.test(rejected.reason.message));
  assert.equal((await root.query('select count(*)::int n from appointments')).rows[0].n,1);
 });
 const appointment=(await root.query('select * from appointments')).rows[0];
 await t.test('EXCLUDE GiST rejeita uma de duas inserções diretas concorrentes',async()=>{
  const sql="insert into appointments(barbershop_id,barber_id,service_id,customer_id,starts_at,ends_at,price_cents) values($1,$2,$3,$4,$5,$5::timestamptz+interval '30 minutes',4000)";
  const args=[shop,barber,service,appointment.customer_id,start('10:00')];
  const results=await Promise.allSettled([left.query(sql,args),right.query(sql,args)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  // PostgreSQL may break an exclusion-index deadlock by aborting one writer.
  const rejected=results.find(r=>r.status==='rejected');assert.ok(rejected?.status==='rejected'&&['23P01','40P01'].includes(rejected.reason.code));
 });
 for(const c of [left,right]){await c.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await c.query('set role authenticated');}
 await t.test('remarcações simultâneas detectam a versão obsoleta',async()=>{
  // Full-precision text: pg Date conversion would truncate PostgreSQL microseconds.
  const version=(await root.query('select updated_at::text version from appointments where id=$1',[appointment.id])).rows[0].version;
  const sql='select manage_appointment_checked($1,$2,$3,null,null,$4)';
  const results=await Promise.allSettled([left.query(sql,[appointment.id,'CONFIRMED',start('11:00'),version]),right.query(sql,[appointment.id,'CONFIRMED',start('12:00'),version])]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const rejected=results.find(r=>r.status==='rejected');assert.ok(rejected?.status==='rejected'&&/outra pessoa/.test(rejected.reason.message));
 });
 await t.test('cancelamento e remarcação concorrentes não sobrescrevem um ao outro',async()=>{
  const version=(await root.query('select updated_at::text version from appointments where id=$1',[appointment.id])).rows[0].version;
  const sql='select manage_appointment_checked($1,$2,$3,null,null,$4)';
  const results=await Promise.allSettled([left.query(sql,[appointment.id,'CANCELLED',null,version]),right.query(sql,[appointment.id,'CONFIRMED',start('13:00'),version])]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const rejected=results.find(r=>r.status==='rejected');assert.ok(rejected?.status==='rejected'&&/outra pessoa/.test(rejected.reason.message));
 });
 for(const c of [left,right])await c.query('reset role');
 await t.test('teste expirado bloqueia reservas simultâneas sem apagar histórico',async()=>{
  await root.query("update subscriptions set subscription_expires_at=now()-interval '1 second',subscription_status='trialing' where barbershop_id=$1",[shop]);
  const results=await Promise.allSettled([book(left,'15:00','11977776666'),book(right,'16:00','11977775555')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,0);
  for(const r of results)assert.ok(r.status==='rejected'&&/temporariamente indisponíveis/.test(r.reason.message));
 });
});
