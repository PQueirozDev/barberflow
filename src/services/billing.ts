export type Plan='FREE'|'PRO';
export type Subscription={plan:Plan;subscription_status:string;subscription_expires_at:string|null;provider?:string|null};
export const TRIAL_DAYS=7;
export const MONTHLY_PRICE_CENTS=4990;
// FREE is retained for historical records, never offered as a product.
export const plans={FREE:{name:'Acesso encerrado',monthlyAppointments:0},PRO:{name:'Zekro Pro',monthlyAppointments:Infinity}} as const;
export function effectivePlan(subscription:Subscription|null,now=new Date()):Plan {
 if(subscription?.plan!=='PRO')return 'FREE';
 const validExpiry=!!subscription.subscription_expires_at&&new Date(subscription.subscription_expires_at)>now;
 return (subscription.subscription_status==='trialing'&&validExpiry)||(subscription.subscription_status==='active'&&(!subscription.subscription_expires_at||validExpiry))?'PRO':'FREE';
}
export interface BillingProvider {createCheckout(input:{shopId:string;returnUrl:string}):Promise<{url:string}>;cancelSubscription(providerSubscriptionId:string):Promise<void>;verifyWebhook(rawBody:string,signature:string):Promise<{eventId:string;subscriptionId:string;status:string}>;}
// Providers futuros devem verificar assinatura, deduplicar eventId e resolver tenant
// pelo provider_subscription_id persistido, nunca por IDs enviados pelo navegador.
