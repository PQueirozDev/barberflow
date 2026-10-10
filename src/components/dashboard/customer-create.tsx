'use client';
import { useState } from 'react';
import { Modal } from '@/components/modal';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/ui';
import { createCustomer } from '@/services/product-actions';
export function CustomerCreate(){const[open,setOpen]=useState(false);return <><button className="btn btn-dark" onClick={()=>setOpen(true)}>Cadastrar cliente</button>{open&&<Modal title="Cadastrar cliente" onClose={()=>setOpen(false)}><ActionForm action={createCustomer} onSuccess={()=>setOpen(false)}><Field label="Nome"><input name="name" minLength={2} maxLength={120} required/></Field><Field label="Telefone com DDD"><input name="phone" type="tel" maxLength={30} required/></Field><Field label="WhatsApp com DDD"><input name="whatsapp" type="tel" maxLength={30} required/></Field><Field label="Email (opcional)"><input name="email" type="email" maxLength={254}/></Field><p className="text-sm muted">Confirme os dados com o cliente. Um telefone já cadastrado deve ser atualizado no cadastro existente.</p></ActionForm></Modal>}</>;}
