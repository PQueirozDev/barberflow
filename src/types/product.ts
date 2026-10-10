import type { Customer } from './domain';
export type AnalyticsSummary={expected:number;received:number;payments:number;completedValue:number;completed:number;cancelled:number;customers:number;newCustomers:number;today:number;week:number;capacityMinutes:number;occupiedMinutes:number;occupancy:number|null;services:Ranking[];barbers:Ranking[];daily:{date:string;completed:number;appointments:number;received:number}[]};
export type Ranking={id:string;name:string;count:number;received:number};
export type Payment={id:string;appointment_id:string;amount_cents:number;method:'CASH'|'PIX'|'CARD';paid_at:string;created_at:string;voided_at:string|null;void_reason:string|null;appointments:{starts_at:string;customers:{name:string};services:{name:string};barbers:{name:string}}};
export type CustomerSummary=Customer&{visits:number;last_visit:string|null;received:number;favorite:string|null};
export type LoyaltyProgram={id:string;visits_required:number;reward:string;starts_at:string;ends_at:string|null};
export type WaitlistEntry={id:string;name:string;phone:string;requested_date:string;period:'ANY'|'MORNING'|'AFTERNOON';status:'WAITING'|'CONTACTED';service:string;barber:string;opportunity:string|null};
