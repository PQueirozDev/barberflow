'use client';
import { useState } from 'react';
export function PixCopy({payload}:{payload:string}){
 const [message,setMessage]=useState('');
 async function copy(){try{await navigator.clipboard.writeText(payload);setMessage('Código copiado. Cole no aplicativo do seu banco.');}catch{setMessage('Selecione e copie o código abaixo manualmente.');}}
 return <div className="form-stack"><label className="field"><span>Pix copia e cola</span><textarea readOnly value={payload} rows={4} className="text-xs break-all" onFocus={event=>event.target.select()}/></label><button type="button" onClick={copy} className="btn btn-outline">Copiar código Pix</button>{message&&<p role="status" className="text-xs muted">{message}</p>}</div>;
}
