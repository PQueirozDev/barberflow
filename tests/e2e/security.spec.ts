import { expect,test } from '@playwright/test';
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL),'Fixture HTTP usada somente em ambiente local.');
test.beforeEach(async({request})=>{expect((await request.post('http://127.0.0.1:3101/test/reset')).ok()).toBeTruthy();});
const origin={Origin:'http://localhost:3100'};

test('rotas de escrita rejeitam origem ausente/externa antes de acessar o banco',async({request})=>{
 for(const route of ['appointments','login','register','recover','reset-password']){
  for(const headers of [{} as Record<string,string>,{Origin:'https://attacker.example'}]){
   const response=await request.post(`/api/${route}`,{headers,data:{}});
   expect(response.status()).toBe(400);expect(await response.json()).toEqual({error:'Origem da solicitação inválida.'});
  }
 }
});
test('entradas públicas inválidas recebem erro seguro',async({request})=>{
 const response=await request.post('/api/appointments',{headers:origin,data:{phone:'invalid'}});
 expect(response.status()).toBe(400);expect(await response.json()).toEqual({error:'Confira os dados informados.'});
 const date=await request.get('/api/availability?slug=http-fixture&serviceId=invalid&barberId=invalid&date=2026-02-30');
 expect(date.status()).toBe(400);expect(await date.json()).toEqual({error:'Confira os dados informados.'});
 const large=await request.post('/api/login',{headers:{...origin,'Content-Type':'application/json'},data:JSON.stringify({extra:'x'.repeat(17000)})});
 expect(large.status()).toBe(400);expect(await large.json()).toEqual({error:'Não foi possível concluir. Tente novamente.'});
});
test('reserva HTTP protege o cadastro, rejeita conflito e conta tentativas falhas',async({request})=>{
 const fixture=await (await request.get('http://127.0.0.1:3101/fixture')).json();
 // Different test execution/project gets a fresh phone/time to avoid existing fixtures.
 const slots=await (await request.get(`/api/availability?${new URLSearchParams({slug:fixture.slug,serviceId:fixture.serviceId,barberId:fixture.barberId,date:fixture.date})}`)).json();
 expect(slots.length).toBeGreaterThan(0);fixture.startsAt=slots[0].starts_at;
 const first=await request.post('/api/appointments',{headers:origin,data:fixture});expect(first.status()).toBe(201);
 const receipt=await first.json();expect(receipt.phone).toBeUndefined();expect(receipt.email).toBeUndefined();expect(receipt.customer_id).toBeUndefined();expect(first.headers()['cache-control']).toBe('no-store');
 for(let n=0;n<4;n++){const conflict=await request.post('/api/appointments',{headers:origin,data:fixture});expect(conflict.status()).toBe(409);expect((await conflict.json()).error).toContain('Horário indisponível');}
 const limited=await request.post('/api/appointments',{headers:origin,data:fixture});expect(limited.status()).toBe(429);
});
test('login e recuperação têm rate limit; redefinição exige sessão e senha válida',async({request})=>{
 for(let n=0;n<15;n++){const login=await request.post('/api/login',{headers:origin,data:{email:'fixture@example.com',password:'invalid-password'}});expect(login.status()).toBe(401);}
 expect((await request.post('/api/login',{headers:origin,data:{email:'fixture@example.com',password:'invalid-password'}})).status()).toBe(429);
 for(let n=0;n<3;n++){const recover=await request.post('/api/recover',{headers:origin,data:{email:'unknown@example.com'}});expect(recover.status()).toBe(200);expect(await recover.json()).toEqual({ok:true});}
 expect((await request.post('/api/recover',{headers:origin,data:{email:'unknown@example.com'}})).status()).toBe(429);
 expect((await request.post('/api/reset-password',{headers:origin,data:{password:'short'}})).status()).toBe(400);
 expect((await request.post('/api/reset-password',{headers:origin,data:{password:'strong-password-fixture'}})).status()).toBe(401);
});
test('consulta de horários tem limite persistente',async({request})=>{
 const f=await (await request.get('http://127.0.0.1:3101/fixture')).json();
 const url=`/api/availability?${new URLSearchParams({slug:f.slug,serviceId:f.serviceId,barberId:f.barberId,date:f.date})}`;
 for(let n=0;n<120;n++)expect((await request.get(url)).status()).toBe(200);
 expect((await request.get(url)).status()).toBe(429);
});
