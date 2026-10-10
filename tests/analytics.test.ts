import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analytics } from '../src/services/analytics';
import { addMonths } from '../src/utils/format';
import type { Appointment } from '../src/types/domain';

test('serviços concluídos não são contabilizados como recebimentos', () => {
 const item = {starts_at:'2026-10-09T12:00:00Z',status:'COMPLETED',price_cents:4000,customer_id:'c',services:{id:'s',name:'Corte'},barbers:{id:'b',name:'Barbeiro'}} as Appointment;
 const result = analytics([item,{...item,status:'CANCELLED',price_cents:9000}],[], '2026-10-01','2026-10-31','America/Sao_Paulo');
 assert.equal(result.completedValue,4000);
 assert.equal(result.estimated,4000);
 assert.equal('revenue' in result,false);
 assert.equal(result.cancelled,1);
});
test('agenda avança meses reais em janeiro, fevereiro e na virada do ano', () => {
 assert.equal(addMonths('2026-01-01',1),'2026-02-01');
 assert.equal(addMonths('2026-01-31',1),'2026-02-01');
 assert.equal(addMonths('2026-03-31',-1),'2026-02-01');
 assert.equal(addMonths('2026-12-15',1),'2027-01-01');
});
