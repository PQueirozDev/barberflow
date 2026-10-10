import { dateSchema } from './api-security';
import { localDate } from '../utils/format';

export function reportPeriod(params:{from?:string;to?:string},timezone:string) {
 const today=localDate(new Date(),timezone);
 const from=params.from||today.slice(0,8)+'01',to=params.to||today;
 if(!dateSchema.safeParse(from).success||!dateSchema.safeParse(to).success||from>to||(Date.parse(to)-Date.parse(from))/86400000>365) return {from:today.slice(0,8)+'01',to:today,error:'Selecione datas válidas em um período de até 366 dias.'};
 return {from,to,error:undefined};
}
export function pageNumber(value?:string){return Math.min(100000,Math.max(1,Math.trunc(Number(value)||1)));}
