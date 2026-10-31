/** On install / upgrade: create or update the SQL schema. */
import { ensureSchema } from '../db/schema';

export async function lifecycleTrigger() {
  try {
    await ensureSchema();
  } catch (err) {
    console.error('Schema migration failed', err);
  }
}
