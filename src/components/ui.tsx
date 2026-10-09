import Link from 'next/link';
import { ArrowUpRight, CalendarDays } from 'lucide-react';
import type { Status } from '@/types/domain';
import { statusLabels } from '@/utils/format';
export function Logo({light=false}:{light?:boolean}){return <Link href="/" className={`logo ${light?'text-white':''}`}><span><svg viewBox="0 0 32 32" width="21" height="21" fill="none" aria-hidden="true"><path d="M7 8h18L7 24h18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>zekro</Link>;}
export function PageHeader({eyebrow,title,description,children}:{eyebrow?:string;title:string;description?:string;children?:React.ReactNode}){return <div className="page-heading"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p className="muted mt-2">{description}</p>}</div>{children}</div>;}
export function EmptyState({title='Tudo pronto para começar',description,href,label='Começar'}:{title?:string;description:string;href?:string;label?:string}){return <div className="empty-state"><span className="empty-icon"><CalendarDays size={26}/></span><h3>{title}</h3><p>{description}</p>{href&&<Link href={href} className="btn btn-dark mt-5">{label}<ArrowUpRight size={16}/></Link>}</div>;}
export function Badge({status}:{status:Status}){return <span className={`badge status-${status.toLowerCase()}`}>{statusLabels[status]}</span>;}
export function Field({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Stat({label,value,detail,icon}:{label:string;value:React.ReactNode;detail?:string;icon?:React.ReactNode}){return <div className="stat-card"><div className="flex justify-between items-center"><p>{label}</p><span className="muted">{icon}</span></div><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>;}
