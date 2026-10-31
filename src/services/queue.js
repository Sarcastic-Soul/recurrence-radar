/** One async queue for all background work (analysis, demo seed/remove). */
import { Queue } from '@forge/events';

const queue = new Queue({ key: 'rr-analyze' });

export function enqueue(body, delayInSeconds = 0) {
  return queue.push(delayInSeconds ? { body, delayInSeconds } : { body });
}
