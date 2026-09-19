export type Plan='FREE'|'PRO';
export type Subscription={plan:Plan;subscription_status:string;subscription_expires_at:string|null;provider?:string|null};
export const plans={FREE:{name:'Grátis',monthlyAppointments:50},PRO:{name:'Pro',monthlyAppointments:Infinity}} as const;
export function effectivePlan(subscription:Subscription|null,now=new Date()):Plan {return subscription?.plan==='PRO'&&['active','trialing'].includes(subscription.subscription_status)&&(!subscription.subscription_expires_at||new Date(subscription.subscription_expires_at)>now)?'PRO':'FREE';}
export interface BillingProvider {createCheckout(input:{shopId:string;returnUrl:string}):Promise<{url:string}>;cancelSubscription(providerSubscriptionId:string):Promise<void>;verifyWebhook(rawBody:string,signature:string):Promise<{eventId:string;subscriptionId:string;status:string}>;}
// Providers futuros devem verificar assinatura, deduplicar eventId e resolver tenant
// pelo provider_subscription_id persistido, nunca por IDs enviados pelo navegador.
