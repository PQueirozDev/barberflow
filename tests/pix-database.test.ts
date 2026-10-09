import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { testSchema } from './helpers/schema';

test('Pix manual: isolamento, conferência administrativa e liberação única',async t=>{
 const db=new PGlite({extensions:{btree_gist,pgcrypto}});t.after(()=>db.close());await db.exec(testSchema);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 const owner=crypto.randomUUID(),manager=crypto.randomUUID(),other=crypto.randomUUID(),admin=crypto.randomUUID();
 await db.query('insert into auth.users(id) values($1),($2),($3),($4)',[owner,manager,other,admin]);
 await db.query("update profiles set role='ADMIN' where id=$1",[admin]);
 async function as(user:string,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec(`set role ${role}`);}
 async function root(){await db.exec('reset role');}
 const input={name:'Fixture',slug:'pix-fixture',phone:'11999998888',whatsapp:'11999998888',service_name:'Corte',price_cents:4000,duration_minutes:30,barber_name:'Fixture',opens_at:'09:00',closes_at:'18:00'};
 await as(owner);const shop=(await db.query<{id:string}>('select create_barbershop($1::jsonb) id',[JSON.stringify(input)])).rows[0].id;
 await as(other);const shopB=(await db.query<{id:string}>('select create_barbershop($1::jsonb) id',[JSON.stringify({...input,slug:'pix-other'})])).rows[0].id;
 await root();await db.query("insert into barbershop_members(barbershop_id,user_id,role) values($1,$2,'MANAGER')",[shop,manager]);
 const hash='a'.repeat(64),reference='E'+ '1'.repeat(31);
 async function request(shopId=shop,destination=hash){return(await db.query<{id:string}>('select request_pix_invoice($1,$2) id',[shopId,destination])).rows[0].id;}
 async function expiry(shopId=shop){return(await db.query<{expires:string}>("select subscription_expires_at::text expires from subscriptions where barbershop_id=$1",[shopId])).rows[0].expires;}
 await as(owner);const invoice=await request();const initial=await expiry();
 await t.test('OWNER solicita valor fixo; tentativas repetidas reutilizam referência',async()=>{
  assert.equal(await request(),invoice);const row=(await db.query<{amount_cents:number;txid:string}>('select amount_cents,txid from pix_invoices where id=$1',[invoice])).rows[0];assert.equal(row.amount_cents,4990);assert.equal(row.txid.length,25);
  await assert.rejects(db.query('insert into pix_invoices(barbershop_id,created_by,destination_hash,amount_cents) values($1,$2,$3,1)',[shop,owner,hash]));
 });
 await t.test('MANAGER, outro tenant e anônimo não leem nem aprovam solicitações',async()=>{
  for(const user of [manager,other]){await as(user);assert.equal((await db.query('select id from pix_invoices where id=$1',[invoice])).rows.length,0);await assert.rejects(request(),/Acesso negado/);await assert.rejects(db.query('select report_pix_payment($1)',[invoice]),/Acesso negado/);await assert.rejects(db.query('select confirm_pix_payment($1,$2,4990)',[invoice,reference]),/Acesso negado/);}
  await as('','anon');await assert.rejects(db.query('select * from pix_invoices'));await assert.rejects(request());
 });
 await t.test('avisar pagamento não libera acesso e OWNER não se aprova',async()=>{
  await as(owner);await db.query('select report_pix_payment($1)',[invoice]);await db.query('select report_pix_payment($1)',[invoice]);assert.equal(await expiry(),initial);
  await assert.rejects(db.query('select confirm_pix_payment($1,$2,4990)',[invoice,reference]),/Acesso negado/);
  await assert.rejects(db.query("update pix_invoices set status='CONFIRMED' where id=$1",[invoice]));
 });
 await t.test('ADMIN exige R$ 49,90 e identificador válido, preserva teste e libera só uma vez',async()=>{
  await as(admin);await assert.rejects(db.query('select confirm_pix_payment($1,$2,1)',[invoice,reference]),/Confira o valor/);await assert.rejects(db.query('select confirm_pix_payment($1,$2,4990)',[invoice,'fake']),/identificador/);
  await db.query('select confirm_pix_payment($1,$2,4990)',[invoice,reference]);const after=await expiry();assert.equal(new Date(after).getTime()-new Date(initial).getTime(),30*86400000);
  await db.query('select confirm_pix_payment($1,$2,4990)',[invoice,reference]);assert.equal(await expiry(),after);assert.equal((await db.query('select id from pix_review_events where invoice_id=$1',[invoice])).rows.length,1);
  await assert.rejects(db.query('select confirm_pix_payment($1,$2,4990)',[invoice,'E'+'2'.repeat(31)]),/outro identificador/);
 });
 await t.test('mesmo crédito bancário não libera outra barbearia e recusa não muda assinatura',async()=>{
  await as(other);const another=await request(shopB);const before=await expiry(shopB);await as(admin);
  await assert.rejects(db.query('select confirm_pix_payment($1,$2,4990)',[another,reference]),/unique constraint/);assert.equal(await expiry(shopB),before);
  await db.query('select reject_pix_payment($1,$2)',[another,'Crédito não identificado no extrato.']);assert.equal(await expiry(shopB),before);
  await assert.rejects(db.query('select confirm_pix_payment($1,$2,4990)',[another,'E'+'3'.repeat(31)]),/encerrada/);
 });
 await t.test('nova renovação acrescenta 30 dias sem reutilizar solicitação paga',async()=>{
  await as(owner);const next=await request();assert.notEqual(next,invoice);const before=await expiry();await as(admin);await db.query('select confirm_pix_payment($1,$2,4990)',[next,'E'+'4'.repeat(31)]);
  assert.equal(new Date(await expiry()).getTime()-new Date(before).getTime(),30*86400000);
 });
 await t.test('onboarding guarda versão aceita em transação e rejeita versão incorreta',async()=>{
  const newcomer=crypto.randomUUID();await root();await db.query('insert into auth.users(id) values($1)',[newcomer]);await as(newcomer);
  await assert.rejects(db.query('select onboard_with_terms($1::jsonb,$2)',[JSON.stringify({...input,slug:'pix-terms'}),'old']),/versão atual/);
  await db.query('select onboard_with_terms($1::jsonb,$2)',[JSON.stringify({...input,slug:'pix-terms'}),'2026-10-08']);
  const profile=(await db.query<{terms_version:string;terms_accepted_at:Date}>('select terms_version,terms_accepted_at from profiles where id=$1',[newcomer])).rows[0];assert.equal(profile.terms_version,'2026-10-08');assert.ok(profile.terms_accepted_at);
 });
 await t.test('aviso não reativa assinatura expirada; confirmação inicia novo prazo',async()=>{
  await root();await db.query("update subscriptions set subscription_expires_at=now()-interval '1 day',subscription_status='trialing' where barbershop_id=$1",[shopB]);
  await as(other);const invoice=await request(shopB);const before=await expiry(shopB);await db.query('select report_pix_payment($1)',[invoice]);assert.equal(await expiry(shopB),before);
  await as(admin);await db.query('select confirm_pix_payment($1,$2,4990)',[invoice,'E'+'5'.repeat(31)]);
  assert.ok(Math.abs(new Date(await expiry(shopB)).getTime()-Date.now()-30*86400000)<5000);
 });
});
