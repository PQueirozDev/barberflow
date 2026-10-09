import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc16,createPixPayload,pixConfigSchema } from '../src/lib/pix';

test('CRC16 reproduz o vetor oficial do Banco Central',()=>{
 const example='00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
 assert.equal(crc16(example),'1D3D');
});
test('Pix contém valor fixo, referência única e campos válidos sem truncamento',()=>{
 const txid='ZEKRO01234567890123456789';
 const payload=createPixPayload({key:'123e4567-e12b-12d1-a456-426655440000',name:'José Teste',city:'São Paulo'},txid);
 function decode(value:string){const fields=new Map<string,string>();let position=0;while(position<value.length){const id=value.slice(position,position+2),size=Number(value.slice(position+2,position+4));assert.ok(size>0);fields.set(id,value.slice(position+4,position+4+size));position+=4+size;}assert.equal(position,value.length);return fields;}
 const fields=decode(payload);assert.equal(fields.get('54'),'49.90');assert.equal(fields.get('53'),'986');assert.equal(fields.get('58'),'BR');assert.equal(fields.get('59'),'JOSE TESTE');assert.equal(fields.get('60'),'SAO PAULO');
 assert.equal(decode(fields.get('62')!).get('05'),txid);assert.equal(decode(fields.get('26')!).get('01'),'123e4567-e12b-12d1-a456-426655440000');
 assert.equal(fields.get('63'),crc16(payload.slice(0,-4)));
 assert.throws(()=>createPixPayload({key:'invalid',name:'Fixture',city:'Fixture'},'abc'));
 assert.throws(()=>createPixPayload({key:'11999999999',name:'Fixture',city:'Fixture'},'../../bad'));
 assert.equal(pixConfigSchema.safeParse({key:'11999999999',name:'x'.repeat(26),city:'Fixture'}).success,false);
});
