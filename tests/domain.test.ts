import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingSchema,slugSchema } from '../src/lib/validation';
import { effectivePlan } from '../src/services/billing';
import { localDate,whatsappLink,instagramLink } from '../src/utils/format';

test('reserva aceita horários ISO com fuso retornados pelo Supabase',()=>{
 const value={slug:'corte-fino',serviceId:crypto.randomUUID(),barberId:crypto.randomUUID(),name:'Pedro',phone:'11999998888',whatsapp:'11999998888'};
 for(const startsAt of ['2026-12-20T14:00:00+00:00','2026-12-20T11:00:00-03:00','2026-12-20T14:00:00.000Z'])assert.equal(bookingSchema.safeParse({...value,startsAt}).success,true);
 assert.equal(bookingSchema.safeParse({...value,startsAt:'2026-12-20T14:00:00'}).success,false);
});
test('slug rejeita rotas reservadas e caracteres inseguros',()=>{for(const value of ['admin','dashboard','../../x','Uma Marca','ABCD','ab'])assert.equal(slugSchema.safeParse(value).success,false);assert.equal(slugSchema.parse('corte-fino'),'corte-fino');});
test('reserva normaliza telefones e rejeita IDs inválidos',()=>{const value={slug:'corte-fino',serviceId:crypto.randomUUID(),barberId:crypto.randomUUID(),startsAt:'2026-12-20T14:00:00.000Z',name:'Pedro',phone:'(11) 99999-8888',whatsapp:'(11) 99999-8888'};assert.equal(bookingSchema.parse(value).phone,'11999998888');assert.equal(bookingSchema.safeParse({...value,serviceId:'foreign'}).success,false);});
test('PRO expirado ou inadimplente recua para FREE',()=>{assert.equal(effectivePlan({plan:'PRO',subscription_status:'active',subscription_expires_at:'2000-01-01'}),'FREE');assert.equal(effectivePlan({plan:'PRO',subscription_status:'past_due',subscription_expires_at:null}),'FREE');assert.equal(effectivePlan({plan:'PRO',subscription_status:'active',subscription_expires_at:null}),'PRO');});
test('timezone não usa relógio local do navegador; links são seguros',()=>{assert.equal(localDate(new Date('2026-09-20T01:00:00Z'),'America/Sao_Paulo'),'2026-09-19');assert.ok(whatsappLink('(11) 99999-8888','Olá & sim').startsWith('https://wa.me/5511999998888?text='));assert.ok(instagramLink('javascript:alert(1)').startsWith('https://www.instagram.com/'));});

test('trial exige expiração finita e vence exatamente no prazo',()=>{const now=new Date('2026-10-08T00:00:00Z');assert.equal(effectivePlan({plan:'PRO',subscription_status:'trialing',subscription_expires_at:null},now),'FREE');assert.equal(effectivePlan({plan:'PRO',subscription_status:'trialing',subscription_expires_at:now.toISOString()},now),'FREE');assert.equal(effectivePlan({plan:'PRO',subscription_status:'trialing',subscription_expires_at:'2026-10-15T00:00:00Z'},now),'PRO');});
