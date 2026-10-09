import { z } from 'zod';
import { MONTHLY_PRICE_CENTS } from '../services/billing';

const keySchema=z.string().trim().max(77).refine(value=>
 /^[0-9]{11}$|^[0-9]{14}$|^\+55[1-9][0-9]{10}$/.test(value)||
 /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)||
 /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value),'Chave Pix inválida.');
const merchant=z.string().trim().min(1).transform(value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()).pipe(z.string().regex(/^[A-Z0-9 .-]+$/));
export const pixConfigSchema=z.object({key:keySchema,name:merchant.pipe(z.string().max(25)),city:merchant.pipe(z.string().max(15))});
export type PixConfig=z.infer<typeof pixConfigSchema>;

export function crc16(value:string){let crc=0xffff;for(const byte of new TextEncoder().encode(value)){crc^=byte<<8;for(let i=0;i<8;i++)crc=((crc&0x8000)?(crc<<1)^0x1021:crc<<1)&0xffff;}return crc.toString(16).toUpperCase().padStart(4,'0');}
function tlv(id:string,value:string){const size=new TextEncoder().encode(value).length;if(size>99)throw new Error('Campo Pix muito longo.');return id+String(size).padStart(2,'0')+value;}
export function createPixPayload(config:PixConfig,txid:string){
 const receiver=pixConfigSchema.parse(config);
 if(!/^[a-zA-Z0-9]{1,25}$/.test(txid))throw new Error('Referência Pix inválida.');
 const value=tlv('00','01')+tlv('26',tlv('00','br.gov.bcb.pix')+tlv('01',receiver.key))+tlv('52','0000')+tlv('53','986')+
 tlv('54',(MONTHLY_PRICE_CENTS/100).toFixed(2))+tlv('58','BR')+tlv('59',receiver.name)+tlv('60',receiver.city)+tlv('62',tlv('05',txid))+'6304';
 return value+crc16(value);
}
