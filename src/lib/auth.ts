import 'server-only';
import { redirect } from 'next/navigation';
import { configured, createSupabase } from '@/lib/supabase/server';
import type { Shop } from '@/types/domain';
export async function requireUser(){if(!configured())redirect('/login?setup=1');const db=await createSupabase();const{data:{user}}=await db.auth.getUser();if(!user)redirect('/login');return{db,user};}
export async function requireTenant(){const{db,user}=await requireUser();const{data:member,error}=await db.from('barbershop_members').select('barbershop_id').eq('user_id',user.id).limit(1).maybeSingle();if(error)throw new Error('Não foi possível carregar a barbearia. Verifique a migração do banco.');if(!member)redirect('/onboarding');const{data,error:shopError}=await db.from('barbershops').select('*').eq('id',member.barbershop_id).single();if(shopError||!data)throw new Error('Não foi possível carregar sua barbearia.');const shop=data as Shop;if(shop.suspended)redirect('/login?suspended=1');return{db,user,shop};}
export async function requireAdmin(){const{db,user}=await requireUser();const{data}=await db.from('profiles').select('role').eq('id',user.id).single();if(data?.role!=='ADMIN')redirect('/dashboard');return{db,user};}
