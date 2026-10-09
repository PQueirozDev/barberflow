// Loopback-only Supabase HTTP stand-in. Auth delivery is deliberately simulated.
import { createServer } from 'node:http';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { testSchema } from './schema';

async function main(){
 const db=new PGlite({extensions:{btree_gist,pgcrypto}});await db.exec(testSchema);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 const user=crypto.randomUUID();await db.query('insert into auth.users(id) values($1)',[user]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.query('select create_barbershop($1::jsonb)',[JSON.stringify({name:'HTTP Fixture',slug:'http-fixture',phone:'11999998888',whatsapp:'11999998888',service_name:'Corte',price_cents:4000,duration_minutes:30,barber_name:'Fixture',opens_at:'09:00',closes_at:'18:00'})]);
 await db.exec("select set_config('request.jwt.claim.sub','',false)");
 const serviceId=(await db.query<{id:string}>('select id from services')).rows[0].id,barberId=(await db.query<{id:string}>('select id from barbers')).rows[0].id;
 const date=(await db.query<{d:string}>("select to_char(current_date+case when extract(dow from current_date+1)=0 then 2 else 1 end,'YYYY-MM-DD') d")).rows[0].d;
 const server=createServer(async(req,res)=>{
  const reply=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   const url=new URL(req.url||'/','http://127.0.0.1:3101');
   if(url.pathname==='/health')return reply(200,{ok:true});
   if(url.pathname==='/fixture')return reply(200,{slug:'http-fixture',serviceId,barberId,date,startsAt:`${date}T09:00:00-03:00`,name:'Fixture',phone:'11999998888',whatsapp:'11999998888'});
   if(url.pathname==='/test/reset'){await db.exec('delete from rate_limits');return reply(200,{ok:true});}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>32768)return reply(413,{message:'body too large'});}
   const input=body?JSON.parse(body):{};
   if(url.pathname==='/auth/v1/recover')return reply(200,{});
   if(url.pathname==='/auth/v1/token')return reply(400,{error_code:'invalid_credentials',msg:'Invalid login credentials'});
   if(url.pathname==='/auth/v1/user')return reply(401,{error_code:'bad_jwt',msg:'Expired session'});
   const rpc=url.pathname.split('/rest/v1/rpc/')[1];
   if(rpc==='consume_rate_limit'){const result=await db.query<{v:boolean}>('select consume_rate_limit($1,$2,$3) v',[input.p_key,input.p_limit,input.p_seconds]);return reply(200,result.rows[0].v);}
   if(rpc==='available_slots'){const result=await db.query('select * from available_slots($1,$2,$3,$4,$5)',[input.p_slug,input.p_service,input.p_barber,input.p_date,input.p_exclude]);return reply(200,result.rows);}
   if(rpc==='public_shop'){const result=await db.query<{v:unknown}>('select public_shop($1) v',[input.p_slug]);return reply(200,result.rows[0].v);}
   if(rpc==='book_appointment'){const result=await db.query<{v:unknown}>('select book_appointment($1,$2,$3,$4,$5,$6,$7,$8) v',[input.p_slug,input.p_service,input.p_barber,input.p_start,input.p_name,input.p_phone,input.p_whatsapp,input.p_email]);return reply(200,result.rows[0].v);}
   return reply(404,{message:'Unknown local test endpoint'});
  }catch(error){return reply(400,{message:error instanceof Error?error.message:'Test error'});}
 });
 server.listen(3101,'127.0.0.1');
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0);}));
}
main().catch(()=>{console.error('Local test fixture failed to initialize.');process.exitCode=1;});
