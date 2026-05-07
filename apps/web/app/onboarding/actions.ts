'use server';

import { redirect } from 'next/navigation';
import { createCycle } from '@/lib/api';

export async function createFirstCycle(programId: string): Promise<void> {
  await createCycle(programId);
  redirect('/cycle/1');
}
