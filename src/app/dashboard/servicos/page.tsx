import { tenantData } from '@/services/queries';
import { Catalog } from '@/components/dashboard/catalog';
export default async function Services(){const{services,barbers,links,shop}=await tenantData();return <Catalog kind="services" services={services} barbers={barbers} links={links} shopId={shop.id}/>;}
