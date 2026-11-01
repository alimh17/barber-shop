import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../auth/api';
import { getSalons, getBarbers } from '../features/salons/api';
import { api } from '../auth/api';
import './services-page.css';
import './working-hours.css';

type Day = 'SATURDAY'|'SUNDAY'|'MONDAY'|'TUESDAY'|'WEDNESDAY'|'THURSDAY'|'FRIDAY';
type WorkingHour = { dayOfWeek: Day; startTime: string; endTime: string; isActive: boolean };
const days: { id: Day; label: string }[] = [
  { id: 'SATURDAY', label: 'شنبه' }, { id: 'SUNDAY', label: 'یکشنبه' },
  { id: 'MONDAY', label: 'دوشنبه' }, { id: 'TUESDAY', label: 'سه‌شنبه' },
  { id: 'WEDNESDAY', label: 'چهارشنبه' }, { id: 'THURSDAY', label: 'پنجشنبه' },
  { id: 'FRIDAY', label: 'جمعه' },
];
export function WorkingHoursPage() {
  const client = useQueryClient();
  const salons = useQuery({ queryKey: ['salons'], queryFn: getSalons });
  const [salonId, setSalonId] = useState('');
  const effectiveSalonId = salonId || salons.data?.[0]?.id || '';
  const barbers = useQuery({ queryKey: ['barbers', effectiveSalonId], queryFn: () => getBarbers(effectiveSalonId), enabled: !!effectiveSalonId });
  const [barberId, setBarberId] = useState('');
  const activeBarberId = barberId || barbers.data?.find(b => b.isActive)?.id || '';
  const hours = useQuery({ queryKey: ['working-hours', activeBarberId], queryFn: async () => (await api.get<WorkingHour[]>('/barbers/' + activeBarberId + '/working-hours')).data, enabled: !!activeBarberId });
  const mutation = useMutation({
    mutationFn: async ({ day, start, end, enabled }: { day: Day; start: string; end: string; enabled: boolean }) => {
      if (enabled) return api.put('/barbers/' + activeBarberId + '/working-hours/' + day, { startTime: start, endTime: end });
      return api.delete('/barbers/' + activeBarberId + '/working-hours/' + day);
    },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['working-hours', activeBarberId] }); await client.invalidateQueries({ queryKey: ['availability'] }); toast.success('ساعات کاری ذخیره شد'); },
    onError: e => toast.error(getApiErrorMessage(e, 'ثبت ساعات کاری ناموفق بود')),
  });
  return <main className="services-page" dir="rtl">
    <header className="services-header"><div><h1>ساعات کاری آرایشگران</h1><p>برای نمایش زمان‌های آزاد در رزرو نوبت، روزها و ساعت‌های کاری هر آرایشگر را ثبت کنید.</p></div><Link to="/appointments/new">ثبت نوبت</Link></header>
    {salons.isError && <p role="alert">دریافت سالن‌ها ناموفق بود.</p>}
    {(salons.data?.length ?? 0) > 1 && <label className="services-field">سالن<select value={effectiveSalonId} onChange={e => { setSalonId(e.target.value); setBarberId(''); }}>{salons.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    <section className="services-card">
      <label className="services-field">آرایشگر<select value={activeBarberId} onChange={e => setBarberId(e.target.value)}><option value="">انتخاب آرایشگر</option>{barbers.data?.filter(b => b.isActive).map(b => <option key={b.id} value={b.id}>{[b.user.firstName, b.user.lastName].filter(Boolean).join(' ') || b.user.phone}</option>)}</select></label>
      {barbers.isError && <p role="alert">دریافت آرایشگران ناموفق بود.</p>}
      {hours.isPending && activeBarberId && <p>در حال دریافت ساعات کاری...</p>}
      {hours.isError && <p role="alert">دریافت ساعات کاری ناموفق بود.</p>}
      {hours.isSuccess && days.map(day => <WorkingDayRow key={activeBarberId + day.id} day={day} existing={hours.data.find(h => h.dayOfWeek === day.id)} disabled={mutation.isPending} onSave={(start,end,enabled) => mutation.mutate({ day: day.id, start, end, enabled })} />)}
    </section>
  </main>;
}
function WorkingDayRow({ day, existing, disabled, onSave }: { day: { id: Day; label: string }; existing?: WorkingHour; disabled: boolean; onSave: (start: string,end: string,enabled: boolean) => void }) {
  const [enabled, setEnabled] = useState(Boolean(existing?.isActive));
  const [start, setStart] = useState(existing?.startTime ?? '09:00');
  const [end, setEnd] = useState(existing?.endTime ?? '18:00');
  const valid = start < end;
  return <div className="working-day">
    <strong>{day.label}</strong>
    <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> روز کاری</label>
    <label>از <input aria-label={'شروع ' + day.label} type="time" value={start} disabled={!enabled} onChange={e => setStart(e.target.value)} /></label>
    <label>تا <input aria-label={'پایان ' + day.label} type="time" value={end} disabled={!enabled} onChange={e => setEnd(e.target.value)} /></label>
    <button type="button" disabled={disabled || (enabled && !valid) || (!enabled && !existing)} onClick={() => onSave(start,end,enabled)}>ذخیره</button>
    {enabled && !valid && <small role="alert">ساعت پایان باید بعد از شروع باشد.</small>}
  </div>;
}
