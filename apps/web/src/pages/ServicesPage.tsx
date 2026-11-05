import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../auth/api';
import { getSalons, getBarbers } from '../features/salons/api';
import { attachBarberService, detachBarberService, listServices, updateService, type SalonService } from '../features/services/api';
import { getBarberServices } from '../features/management/api';
import './services-page.css';

export function ServicesPage() {
  const client = useQueryClient();
  const salonsQuery = useQuery({ queryKey: ['salons'], queryFn: getSalons });
  const [salonId, setSalonId] = useState('');
  const [editing, setEditing] = useState<SalonService | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(0);
  const effectiveSalonId = salonId || salonsQuery.data?.[0]?.id || '';
  const servicesQuery = useQuery({ queryKey: ['services', effectiveSalonId], queryFn: () => listServices(effectiveSalonId), enabled: !!effectiveSalonId });
  const barbersQuery = useQuery({ queryKey: ['barbers', effectiveSalonId], queryFn: () => getBarbers(effectiveSalonId), enabled: !!effectiveSalonId });
  const [barberId, setBarberId] = useState('');
  const activeBarberId = barberId || barbersQuery.data?.find(b => b.isActive)?.id || '';
  const assignedQuery = useQuery({ queryKey: ['barber-services', activeBarberId], queryFn: () => getBarberServices(activeBarberId), enabled: !!activeBarberId });
  const assigned = new Set((assignedQuery.data ?? []).map(item => item.serviceId));
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['services'] }),
      client.invalidateQueries({ queryKey: ['barber-services'] }),
    ]);
  }
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SalonService> }) => updateService(id, data),
    onSuccess: async () => { await refresh(); setEditing(null); toast.success('تغییرات ذخیره شد'); },
    onError: error => toast.error(getApiErrorMessage(error, 'ذخیره تغییرات انجام نشد')),
  });
  const assignment = useMutation({
    mutationFn: ({ serviceId, add }: { serviceId: string; add: boolean }) => add ? attachBarberService(activeBarberId, serviceId) : detachBarberService(activeBarberId, serviceId),
    onSuccess: async () => { await refresh(); toast.success('خدمات آرایشگر به‌روزرسانی شد'); },
    onError: error => toast.error(getApiErrorMessage(error, 'تغییر اختصاص خدمت انجام نشد')),
  });
  function beginEdit(service: SalonService) {
    setEditing(service); setName(service.name); setDescription(service.description ?? '');
    setDuration(service.duration); setPrice(Number(service.price));
  }
  return <main className="services-page" dir="rtl">
    <header className="services-header"><div><h1>مدیریت خدمات</h1><p>ویرایش، فعال‌سازی و اختصاص خدمات به آرایشگران سالن</p></div><Link className="services-add" to="/services/new">افزودن خدمت</Link></header>
    {salonsQuery.isError && <p role="alert">دریافت سالن‌ها ناموفق بود.</p>}
    {salonsQuery.isPending && <p>در حال بارگذاری سالن‌ها...</p>}
    {salonsQuery.data?.length === 0 && <p>سالن فعالی یافت نشد.</p>}
    {(salonsQuery.data?.length ?? 0) > 1 && <label className="services-field">سالن<select value={effectiveSalonId} onChange={e => { setSalonId(e.target.value); setBarberId(''); setEditing(null); }}>{salonsQuery.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    <section className="services-card">
      <h2>فهرست خدمات</h2>
      {servicesQuery.isPending && <p>در حال بارگذاری خدمات...</p>}
      {servicesQuery.isError && <p role="alert">{getApiErrorMessage(servicesQuery.error, 'دریافت خدمات ناموفق بود')}</p>}
      {servicesQuery.isSuccess && servicesQuery.data.length === 0 && <p>هنوز خدمتی برای این سالن ثبت نشده است.</p>}
      {servicesQuery.data?.map(service => <article className="services-item" key={service.id}>
        <div><strong>{service.name}</strong><p>{service.duration.toLocaleString('fa-IR')} دقیقه · {Number(service.price).toLocaleString('fa-IR')} تومان</p><small>{service.isActive ? 'فعال' : 'غیرفعال'}</small></div>
        <div className="services-actions"><button type="button" onClick={() => beginEdit(service)}>ویرایش</button><label className="services-toggle"><input type="checkbox" checked={service.isActive} disabled={update.isPending} onChange={e => update.mutate({ id: service.id, data: { isActive: e.target.checked } })} /> فعال</label></div>
      </article>)}
    </section>
    {editing && <form className="services-card services-form" onSubmit={e => { e.preventDefault(); if (name.trim().length < 2 || duration <= 0 || price < 0) return; update.mutate({ id: editing.id, data: { name: name.trim(), description, duration, price } }); }}>
      <h2>ویرایش خدمت</h2>
      <label>نام خدمت<input required minLength={2} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>مدت (دقیقه)<input required type="number" min={1} value={duration} onChange={e => setDuration(Number(e.target.value))} /></label>
      <label>قیمت (تومان)<input required type="number" min={0} value={price} onChange={e => setPrice(Number(e.target.value))} /></label>
      <label>توضیحات<textarea value={description} onChange={e => setDescription(e.target.value)} /></label>
      <div className="services-actions"><button className="services-add" type="submit" disabled={update.isPending}>ذخیره تغییرات</button><button type="button" onClick={() => setEditing(null)}>انصراف</button></div>
    </form>}
    <section className="services-card">
      <h2>اختصاص خدمت به آرایشگر</h2>
      <p>برای نمایش خدمت در صفحه رزرو، آن را به آرایشگر موردنظر اختصاص دهید.</p>
      <label className="services-field">انتخاب آرایشگر<select value={activeBarberId} onChange={e => setBarberId(e.target.value)}><option value="">انتخاب آرایشگر</option>{barbersQuery.data?.filter(b => b.isActive).map(b => <option key={b.id} value={b.id}>{[b.user.firstName, b.user.lastName].filter(Boolean).join(' ') || b.user.phone}</option>)}</select></label>
      {barbersQuery.isError && <p role="alert">دریافت آرایشگران ناموفق بود.</p>}
      {assignedQuery.isPending && activeBarberId && <p>در حال دریافت خدمات آرایشگر...</p>}
      {assignedQuery.isError && <p role="alert">دریافت خدمات آرایشگر ناموفق بود.</p>}
      {activeBarberId && assignedQuery.isSuccess && servicesQuery.data?.map(service => <label className="services-assignment" key={service.id}>
        <input type="checkbox" checked={assigned.has(service.id)} disabled={assignment.isPending || !service.isActive} onChange={e => assignment.mutate({ serviceId: service.id, add: e.target.checked })} />
        <span>{service.name} {!service.isActive && '(غیرفعال)'}</span>
      </label>)}
    </section>
  </main>;
}
