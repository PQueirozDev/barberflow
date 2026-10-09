import { readFile } from 'node:fs/promises';
const templates=[['confirmation','Confirme seu email — Barberflow'],['recovery','Redefina sua senha — Barberflow']];
async function main(){
 const config={};
 for(const [type,subject] of templates){const html=await readFile(new URL(`../supabase/templates/${type}.html`,import.meta.url),'utf8');if(!html.includes('{{ .ConfirmationURL }}'))throw new Error('Template sem link de autenticação.');config[`mailer_subjects_${type}`]=subject;config[`mailer_templates_${type}_content`]=html;}
 if(process.argv.includes('--check')){console.log('Templates locais válidos. Nenhuma configuração remota alterada.');return;}
 const required=['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','SMTP_FROM_EMAIL','SMTP_FROM_NAME'];
 const missing=required.filter(key=>!process.env[key]);if(missing.length)throw new Error(`Defina as variáveis: ${missing.join(', ')}.`);
 const port=Number(process.env.SMTP_PORT);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('SMTP_PORT inválida.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.SMTP_FROM_EMAIL))throw new Error('SMTP_FROM_EMAIL inválida.');
 Object.assign(config,{smtp_host:process.env.SMTP_HOST,smtp_port:port,smtp_user:process.env.SMTP_USER,smtp_pass:process.env.SMTP_PASSWORD,smtp_admin_email:process.env.SMTP_FROM_EMAIL,smtp_sender_name:process.env.SMTP_FROM_NAME});
 if(!process.argv.includes('--apply')){console.log('Configuração SMTP e templates validados. Modo de simulação; valores secretos não exibidos.');return;}
 const ref=process.env.SMTP_PROJECT_REF;
 if(!ref||!/^[a-z]{20}$/.test(ref)||!process.env.SUPABASE_ACCESS_TOKEN)throw new Error('Defina SMTP_PROJECT_REF e SUPABASE_ACCESS_TOKEN para aplicação manual.');
 const environment=process.env.SMTP_TARGET_ENV;
 if(!['staging','production'].includes(environment))throw new Error('Defina SMTP_TARGET_ENV como staging ou production.');
 if(environment==='production'&&!process.argv.includes(`--confirm-production=${ref}`))throw new Error('Produção exige autorização e a confirmação explícita do projeto.');
 const result=await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`,{method:'PATCH',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(config),signal:AbortSignal.timeout(30_000)});
 // Never log the API response, which can include SMTP credentials.
 if(!result.ok)throw new Error(`Falha ao configurar email (HTTP ${result.status}). Nenhuma credencial foi registrada no log.`);
 console.log('SMTP e templates atualizados no projeto informado. Valide entrega e redirects.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Falha ao preparar email.');process.exitCode=1;});
