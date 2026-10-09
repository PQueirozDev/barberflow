import 'server-only';
import { createHash } from 'node:crypto';
import { pixConfigSchema,createPixPayload } from './pix';

export function getPixConfig(){
 const result=pixConfigSchema.safeParse({key:process.env.PIX_KEY,name:process.env.PIX_RECEIVER_NAME,city:process.env.PIX_RECEIVER_CITY});
 if(!result.success)return null;
 try{createPixPayload(result.data,'VALIDATION');}catch{return null;}
 return {...result.data,hash:createHash('sha256').update(JSON.stringify(result.data)).digest('hex')};
}
