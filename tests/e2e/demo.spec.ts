import { test, expect } from '@playwright/test';

test('demonstração navega, cadastra e altera reservas sem APIs de escrita',async({page})=>{
 const writes:string[]=[];page.on('request',r=>{if(r.method()!=='GET'&&r.method()!=='HEAD')writes.push(r.url());});
 await page.goto('/demonstracao');
 const nav=page.getByRole('navigation',{name:'Módulos da demonstração'});
 for(const section of ['Agenda','Agendamentos','Clientes','Profissionais','Serviços','Relatórios','Configurações','Página pública','Dashboard'])await nav.getByRole('button',{name:section,exact:true}).click();
 await nav.getByRole('button',{name:'Clientes',exact:true}).click();await page.getByRole('button',{name:'Cadastrar cliente',exact:true}).click();
 await page.getByLabel('Nome do cliente').fill('Cliente Fictício');await page.getByRole('button',{name:'Salvar simulação'}).click();await expect(page.getByRole('heading',{name:'Cliente Fictício',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Serviços',exact:true}).click();await page.getByRole('button',{name:'Cadastrar serviço',exact:true}).click();await page.getByLabel('Nome do serviço').fill('Serviço Fictício');await page.getByRole('button',{name:'Salvar simulação'}).click();
 await nav.getByRole('button',{name:'Agendamentos',exact:true}).click();await page.getByRole('button',{name:'Novo agendamento'}).click();
 await page.getByRole('combobox',{name:'Cliente',exact:true}).selectOption({label:'Cliente Fictício'});await page.getByLabel('Horário',{exact:true}).fill('11:00');await page.getByRole('button',{name:'Confirmar simulação'}).click();
 await expect(page.getByRole('status')).toHaveText('Agendamento fictício criado.');
 await page.getByRole('button',{name:'Reagendar Cliente Fictício',exact:true}).click();await page.getByLabel('Horário',{exact:true}).fill('12:00');await page.getByRole('button',{name:'Confirmar simulação'}).click();
 await expect(page.getByRole('status')).toHaveText('Horário alterado na demonstração.');
 await page.getByRole('button',{name:'Cancelar Cliente Fictício',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Agendamento cancelado na demonstração.');
 expect(writes).toEqual([]);
 await page.reload();await nav.getByRole('button',{name:'Clientes',exact:true}).click();await expect(page.getByRole('heading',{name:'Cliente Fictício',exact:true})).toHaveCount(0);
});
