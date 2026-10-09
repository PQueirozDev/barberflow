import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const localEnv={...process.env,NEXT_PUBLIC_APP_URL:'http://localhost:3100',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3101',NEXT_PUBLIC_SUPABASE_ANON_KEY:'barberflow-local-test-anon',SUPABASE_SERVICE_ROLE_KEY:'barberflow-local-test-service',VERCEL:''};
const env=process.env.PLAYWRIGHT_BASE_URL?{...process.env}:localEnv;
if(!env.PLAYWRIGHT_CHANNEL&&process.platform==='win32'&&existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe'))env.PLAYWRIGHT_CHANNEL='chrome';
function run(file,args=[]){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file,...args],{env,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Comando falhou (código ${code}).`)));});}
try{
 // NEXT_PUBLIC_* is compiled into Next.js: rebuild with loopback URLs before fixture writes.
 if(!process.env.PLAYWRIGHT_BASE_URL){console.log('Preparando build isolado para E2E local; credenciais fictícias, sem acesso à produção.');await run('node_modules/next/dist/bin/next',['build']);}
 await run('node_modules/@playwright/test/cli.js',['test',...process.argv.slice(2)]);
}catch(error){console.error(error instanceof Error?error.message:'Falha no E2E.');process.exitCode=1;}
