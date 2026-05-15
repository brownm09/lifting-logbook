import 'server-only';
import { fetchUserSettings } from './api';

export async function getActiveProgram(): Promise<string> {
  try {
    const settings = await fetchUserSettings();
    return settings.activeProgram ?? process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';
  } catch {
    return process.env.NEXT_PUBLIC_DEFAULT_PROGRAM ?? '5-3-1';
  }
}
