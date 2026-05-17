import { fetchUserSettings } from '@/lib/api';
import ScheduleForm from './ScheduleForm';

export default async function SchedulePage() {
  const settings = await fetchUserSettings();
  return <ScheduleForm initialSchedule={settings.workoutSchedule} />;
}
