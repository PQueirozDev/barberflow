'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { ActionResult } from '@/types/domain';
export function ActionForm({action,children,label='Salvar alterações',className='',onSuccess}:{action:(data:FormData)=>Promise<ActionResult>;children:React.ReactNode;label?:string;className?:string;onSuccess?:()=>void}){
 const[busy,setBusy]=useState(false);const[result,setResult]=useState<ActionResult>({});const router=useRouter();
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setResult({});try{const response=await action(new FormData(e.currentTarget));setResult(response);if(response.redirect)router.push(response.redirect);if(response.success){router.refresh();onSuccess?.();}}catch{setResult({error:'Não foi possível salvar. Tente novamente.'});}finally{setBusy(false);}}
 return <form onSubmit={submit} className={`form-stack ${className}`}><fieldset disabled={busy} className="contents">{children}</fieldset>{result.error&&<p role="alert" className="notice error">{result.error}</p>}{result.success&&<p role="status" className="notice success">{result.success}</p>}<button disabled={busy} className="btn btn-dark self-start" type="submit">{busy&&<Loader2 size={16} className="animate-spin"/>}{busy?'Salvando…':label}</button></form>;
}
