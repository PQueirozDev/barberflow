import { requireOwner } from '@/lib/auth';
import { tenantData } from '@/services/queries';
import { ShopEditor } from '@/components/dashboard/shop-editor';
export default async function ShopEditorPage(){await requireOwner();const{shop,services,barbers,links,hours}=await tenantData();return <ShopEditor data={{shop,services:services.filter(s=>s.active),barbers:barbers.filter(b=>b.active),barber_services:links,hours}}/>;}
