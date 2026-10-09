import type { Status } from '../types/domain';
export function allowedNextStatuses(status: Status, reschedule = false): Status[] {
  if (reschedule) return status === 'PENDING' || status === 'CANCELLED' ? ['PENDING','CONFIRMED'] : status === 'CONFIRMED' ? ['CONFIRMED'] : [];
  const transitions: Record<Status, Status[]> = {
    PENDING: ['PENDING','CONFIRMED','CANCELLED','NO_SHOW'],
    CONFIRMED: ['CONFIRMED','COMPLETED','CANCELLED','NO_SHOW'],
    COMPLETED: ['COMPLETED'], CANCELLED: ['CANCELLED'], NO_SHOW: ['NO_SHOW'],
  };
  return transitions[status];
}
