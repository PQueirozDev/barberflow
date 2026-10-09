import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { testSchema } from './helpers/schema';

test('migração concede teste ao FREE existente e preserva assinatura PRO',async t=>{
 const db=new PGlite({extensions:{btree_gist,pgcrypto}});t.after(()=>db.close());
 await db.exec(testSchema);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&!f.endsWith('_trial.sql')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 const users=[crypto.randomUUID(),crypto.randomUUID()];
 for(let i=0;i<users.length;i++){
  await db.query('insert into auth.users(id) values($1)',[users[i]]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[users[i]]);
  await db.query('select create_barbershop($1::jsonb)',[JSON.stringify({name:'Fixture',slug:`trial-fixture-${i}`,phone:'11999998888',whatsapp:'11999998888',service_name:'Corte',price_cents:4000,duration_minutes:30,barber_name:'Fixture',opens_at:'09:00',closes_at:'18:00'})]);
 }
 await db.query("update subscriptions set plan='PRO',subscription_status='active',subscription_expires_at='2030-01-01T00:00:00Z' where barbershop_id=(select id from barbershops where slug='trial-fixture-1')");
 await db.exec(await readFile('supabase/migrations/202610080002_trial.sql','utf8'));
 const rows=(await db.query<{slug:string;plan:string;subscription_status:string;days:number;expires:string}>("select b.slug,s.plan,s.subscription_status,extract(epoch from(s.subscription_expires_at-now()))/86400 days,s.subscription_expires_at::text expires from subscriptions s join barbershops b on b.id=s.barbershop_id order by b.slug")).rows;
 assert.equal(rows[0].plan,'PRO');assert.equal(rows[0].subscription_status,'trialing');assert.ok(Number(rows[0].days)>6.99&&Number(rows[0].days)<=7);
 assert.equal(rows[1].subscription_status,'active');assert.equal(new Date(rows[1].expires).toISOString(),'2030-01-01T00:00:00.000Z');
});
