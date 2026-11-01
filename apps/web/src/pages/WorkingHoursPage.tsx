import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../auth/api';
import { getSalons, getBarbers } from '../features/salons/api';
import './services-page.css';
import './working-hours.css';

type Day = 'SATURDAY' | 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY';
type WorkingHour = { dayOfWeek: Day; startTime: string; endTime: string; isActive: boolean };
type DayDraft = { enabled: boolean; start: string; end: string };
const days: { id: Day; label: string }[] = [
  { id: 'SATURDAY', label: 'شنبه' },
  { id: 'SUNDAY', label: 'یکشنبه' },
  { id: 'MONDAY', label: 'دوشنبه' },
  { id: 'TUESDAY', label: 'سه‌شنبه' },
  { id: 'WEDNESDAY', label: 'چهارشنبه' },
  { id: 'THURSDAY', label: 'پنجشنبه' },
  { id: 'FRIDAY', label: 'جمعه' },
];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
function buildDraft(hours: WorkingHour[]): Record<Day, DayDraft> {
  return Object.fromEntries(days.map(day => {
    const existing = hours.find(hour => hour.dayOfWeek === day.id);
    return [day.id, { enabled: Boolean(existing?.isActive), start: existing?.startTime ?? '09:00', end: existing?.endTime ?? '20:00' }];
  })) as Record<Day, DayDraft>;
}
function sameDraft(a: DayDraft, b: DayDraft) {
  return a.enabled === b.enabled && (!a.enabled || (a.start === b.start && a.end === b.end));
}
export function WorkingHoursPage() {
  const client = useQueryClient();
  const salons = useQuery({ queryKey: ['salons'], queryFn: getSalons });
  const [salonId, setSalonId] = useState('');
  const effectiveSalonId = salonId || salons.data?.[0]?.id || '';
  const barbers = useQuery({ queryKey: ['barbers', effectiveSalonId], queryFn: () => getBarbers(effectiveSalonId), enabled: !!effectiveSalonId });
  const [barberId, setBarberId] = useState('');
  const activeBarberId = barberId || barbers.data?.find(barber => barber.isActive)?.id || '';
  const hours = useQuery({
    queryKey: ['working-hours', activeBarberId],
    queryFn: async () => (await api.get<WorkingHour[]>('/barbers/' + activeBarberId + '/working-hours')).data,
    enabled: !!activeBarberId,
  });
  const [overrides, setOverrides] = useState<Record<string, Record<Day, DayDraft>>>({});
  const initial = useMemo(() => buildDraft(hours.data ?? []), [hours.data]);
  const draft = hours.isSuccess ? (overrides[activeBarberId] ?? initial) : null;
  const changes = days.filter(day => draft && !sameDraft(draft[day.id], initial[day.id]));
  const invalid = days.some(day => {
    const row = draft?.[day.id];
    return row?.enabled && (!timePattern.test(row.start) || !timePattern.test(row.end) || row.start >= row.end);
  });
  const save = useMutation({
    mutationFn: async ({ barber, updates, existing }: { barber: string; updates: { day: Day; row: DayDraft }[]; existing: WorkingHour[] }) => {
      const results = await Promise.allSettled(updates.map(({ day, row }) =>
        row.enabled
          ? api.put('/barbers/' + barber + '/working-hours/' + day, { startTime: row.start, endTime: row.end })
          : existing.some(hour => hour.dayOfWeek === day)
            ? api.delete('/barbers/' + barber + '/working-hours/' + day)
            : Promise.resolve(),
      ));
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length) throw new Error(failures.length + ' روز ذخیره نشد. لطفاً دوباره تلاش کنید.');
    },
    onSuccess: async () => {
      setOverrides(current => { const next = { ...current }; delete next[activeBarberId]; return next; });
      await client.invalidateQueries({ queryKey: ['working-hours', activeBarberId] });
      await client.invalidateQueries({ queryKey: ['availability'] });
      toast.success('ساعات کاری با موفقیت ذخیره شد');
    },
    onError: error => {
      void client.invalidateQueries({ queryKey: ['working-hours', activeBarberId] });
      toast.error(getApiErrorMessage(error, 'ذخیره ساعات کاری ناموفق بود'));
    },
  });
  function changeDay(day: Day, patch: Partial<DayDraft>) {
    setOverrides(current => ({ ...current, [activeBarberId]: { ...(current[activeBarberId] ?? initial), [day]: { ...(current[activeBarberId] ?? initial)[day], ...patch } } }));
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || invalid || !changes.length || !hours.data || !activeBarberId) return;
    save.mutate({ barber: activeBarberId, updates: changes.map(day => ({ day: day.id, row: draft[day.id] })), existing: hours.data });
  }
  return <main className="services-page working-hours-page" dir="rtl">
    <header className="services-header"><div><h1>ساعات کاری آرایشگران</h1><p>برای نمایش زمان‌های آزاد در رزرو نوبت، روزها و ساعت‌های کاری هر آرایشگر را ثبت کنید.</p></div></header>
    {salons.isError && <p role="alert">دریافت سالن‌ها ناموفق بود.</p>}
    {(salons.data?.length ?? 0) > 1 && <label className="services-field">سالن<select value={effectiveSalonId} disabled={save.isPending} onChange={event => { setSalonId(event.target.value); setBarberId(''); }}>{salons.data?.map(salon => <option key={salon.id} value={salon.id}>{salon.name}</option>)}</select></label>}
    <form className="services-card" onSubmit={submit}>
      <label className="services-field">آرایشگر<select value={activeBarberId} disabled={save.isPending} onChange={event => setBarberId(event.target.value)}><option value="">انتخاب آرایشگر</option>{barbers.data?.filter(barber => barber.isActive).map(barber => <option key={barber.id} value={barber.id}>{[barber.user.firstName, barber.user.lastName].filter(Boolean).join(' ') || barber.user.phone}</option>)}</select></label>
      {barbers.isError && <p role="alert">دریافت آرایشگران ناموفق بود.</p>}
      {hours.isPending && activeBarberId && <p>در حال دریافت ساعات کاری...</p>}
      {hours.isError && <p role="alert">دریافت ساعات کاری ناموفق بود.</p>}
      {hours.isSuccess && draft && days.map(day => {
        const row = draft[day.id];
        return <div className="working-day" key={day.id}>
          <strong>{day.label}</strong>
          <label className="working-day-toggle"><input type="checkbox" checked={row.enabled} disabled={save.isPending} onChange={event => changeDay(day.id, { enabled: event.target.checked })} /> روز کاری</label>
          <label>از <input aria-label={'شروع ' + day.label} type="text" inputMode="numeric" dir="ltr" maxLength={5} placeholder="09:00" value={row.start} disabled={!row.enabled || save.isPending} onChange={event => changeDay(day.id, { start: event.target.value })} /></label>
          <label>تا <input aria-label={'پایان ' + day.label} type="text" inputMode="numeric" dir="ltr" maxLength={5} placeholder="20:00" value={row.end} disabled={!row.enabled || save.isPending} onChange={event => changeDay(day.id, { end: event.target.value })} /></label>
          {row.enabled && (!timePattern.test(row.start) || !timePattern.test(row.end) || row.start >= row.end) && <small role="alert">ساعت را به صورت ۲۴ ساعته وارد کنید؛ پایان باید بعد از شروع باشد.</small>}
        </div>;
      })}
      {hours.isSuccess && <div className="working-hours-footer">
        <button className="working-hours-save" type="submit" disabled={!changes.length || invalid || save.isPending}>{save.isPending ? 'در حال ذخیره...' : 'ذخیره ساعات کاری'}</button>
        {changes.length > 0 && <span>{changes.length.toLocaleString('fa-IR')} روز تغییر کرده است</span>}
      </div>}
    </form>
  </main>;
}
