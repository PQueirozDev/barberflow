import { tenantData } from '@/services/queries';
import { Catalog } from '@/components/dashboard/catalog';
export default async function Barbers(){const{services,barbers,links,shop}=await tenantData();return <Catalog kind="barbers" services={services} barbers={barbers} links={links} shopId={shop.id}/>;}
