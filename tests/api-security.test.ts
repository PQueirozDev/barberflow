import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertOrigin,availabilitySchema,publicError,readPublicJson,passwordSchema } from '../src/lib/api-security';
import { phoneSchema } from '../src/lib/validation';
import { appointmentDateRange } from '../src/lib/date-range';
import { allowedNextStatuses } from '../src/lib/appointment-status';

test('origem rejeita ausência, origem externa e host parecido',()=>{
 const req=(origin?:string)=>new Request('https://barberflow.example/api/appointments',{headers:origin?{origin}:{}});
 assert.doesNotThrow(()=>assertOrigin(req('https://barberflow.example'),'https://barberflow.example'));
 for(const origin of [undefined,'https://barberflow.example.attacker.com','https://attacker.com','null'])assert.throws(()=>assertOrigin(req(origin),'https://barberflow.example'));
});
test('erros públicos não expõem detalhes SQL, JWT ou infraestrutura',()=>{
 for(const message of ['relation customers does not exist','JWT secret-value','fetch failed at https://private.example','duplicate key (phone)=secret','unexpected internal error'])assert.equal(publicError({message}),'Não foi possível concluir. Tente novamente.');
 assert.equal(publicError({message:'Horário indisponível. Escolha outro horário.'}),'Horário indisponível. Escolha outro horário.');
});
test('corpo JSON tem limite real mesmo sem Content-Length',async()=>{
 const req=(body:string)=>new Request('https://example.com',{method:'POST',headers:{'Content-Type':'application/json'},body});
 assert.deepEqual(await readPublicJson(req('{"name":"Fixture"}')),{name:'Fixture'});
 await assert.rejects(readPublicJson(req('x'.repeat(16385))),/excessivos/);
 await assert.rejects(readPublicJson(req('{broken')));
 await assert.rejects(readPublicJson(new Request('https://example.com',{method:'POST',body:'{}'})),/Formato/);
});
test('validação rejeita datas inexistentes, telefone inválido e senha curta',()=>{
 const value={slug:'fixture',serviceId:crypto.randomUUID(),barberId:crypto.randomUUID(),date:'2026-02-28'};
 assert.ok(availabilitySchema.safeParse(value).success);assert.equal(availabilitySchema.safeParse({...value,date:'2026-02-30'}).success,false);
 for(const n of ['(11) 99999-8888','+55 (11) 99999-8888','5511999998888'])assert.equal(phoneSchema.parse(n),'11999998888');
 assert.equal(phoneSchema.parse('(55) 99999-8888'),'55999998888');
 for(const n of ['11811112222','00999998888','+12025551234','11999998888abc'])assert.equal(phoneSchema.safeParse(n).success,false);
 assert.equal(passwordSchema.safeParse('curta').success,false);
});
test('filtro SQL cobre o dia local inteiro em diferentes fusos',()=>{
 assert.deepEqual(appointmentDateRange('2026-10-08','2026-10-08','America/Sao_Paulo'),{from:'2026-10-08T03:00:00.000Z',until:'2026-10-09T03:00:00.000Z'});
 assert.deepEqual(appointmentDateRange('2026-10-08','2026-10-08','America/Rio_Branco'),{from:'2026-10-08T05:00:00.000Z',until:'2026-10-09T05:00:00.000Z'});
});
test('interface apresenta apenas transições válidas e reativação explícita',()=>{
 assert.deepEqual(allowedNextStatuses('CANCELLED'),['CANCELLED']);
 assert.deepEqual(allowedNextStatuses('CANCELLED',true),['PENDING','CONFIRMED']);
 assert.deepEqual(allowedNextStatuses('COMPLETED'),['COMPLETED']);
 assert.deepEqual(allowedNextStatuses('NO_SHOW',true),[]);
 assert.ok(!allowedNextStatuses('CONFIRMED').includes('PENDING'));
});
