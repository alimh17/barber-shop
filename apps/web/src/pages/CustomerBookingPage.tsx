import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../auth/api'
import { bookAppointment, getAvailability, getBarberServices, getPublicBarbers, getSalons, myAppointments, personName, type AvailabilitySlot } from '../features/management/api'
import '../features/management/management.css'

const dateInZone = (zone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function CustomerBookingPage() {
  const client = useQueryClient()
  const [salonId, setSalonId] = useState('')
  const [barberId, setBarberId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [startAt, setStartAt] = useState('')
  const [note, setNote] = useState('')
  const salons = useQuery({ queryKey: ['public-salons'], queryFn: getSalons })
  const salon = salons.data?.find((item) => item.id === salonId)
  const today = dateInZone(salon?.timezone ?? 'Asia/Tehran')
  const barbers = useQuery({ queryKey: ['public-barbers', salonId], queryFn: () => getPublicBarbers(salonId), enabled: !!salonId })
  const services = useQuery({ queryKey: ['barber-services', barberId], queryFn: () => getBarberServices(barberId), enabled: !!barberId })
  const slots = useQuery({ queryKey: ['availability', salonId, barberId, serviceId, date], queryFn: () => getAvailability({ salonId, barberId, serviceId, date }), enabled: !!(salonId && barberId && serviceId && date) })
  const mine = useQuery({ queryKey: ['my-appointments'], queryFn: myAppointments })
  const mutation = useMutation({
    mutationFn: () => bookAppointment({ barberId, serviceId, startAt, note: note.trim() || undefined }),
    onSuccess: async () => {
      toast.success('درخواست نوبت ثبت شد و در انتظار تأیید است')
      setStartAt('')
      await Promise.all([client.invalidateQueries({ queryKey: ['my-appointments'] }), client.invalidateQueries({ queryKey: ['availability'] })])
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'ثبت نوبت انجام نشد')),
  })
  const reset = () => { setBarberId(''); setServiceId(''); setStartAt('') }
  return <div className="create-salon-page">
    <div className="page-title"><div><h1>رزرو نوبت</h1><p>نوبت شما پس از بررسی آرایشگر یا مدیر تأیید می‌شود.</p></div></div>
    <form className="salon-form" onSubmit={(event) => { event.preventDefault(); if (startAt) mutation.mutate() }}>
      <section><div className="form-grid">
        <label className="form-field"><span>سالن</span><select aria-label="سالن" value={salonId} onChange={(e) => { setSalonId(e.target.value); setDate(''); reset() }}><option value="">انتخاب سالن</option>{salons.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="form-field"><span>آرایشگر</span><select aria-label="آرایشگر" value={barberId} disabled={!salonId} onChange={(e) => { setBarberId(e.target.value); setServiceId(''); setStartAt('') }}><option value="">انتخاب آرایشگر</option>{barbers.data?.filter((b) => b.isActive).map((b) => <option key={b.id} value={b.id}>{personName(b.user)}</option>)}</select></label>
        <label className="form-field"><span>خدمت</span><select aria-label="خدمت" value={serviceId} disabled={!barberId} onChange={(e) => { setServiceId(e.target.value); setStartAt('') }}><option value="">انتخاب خدمت</option>{services.data?.filter((s) => s.service.isActive).map((s) => <option key={s.serviceId} value={s.serviceId}>{s.service.name}</option>)}</select></label>
        <label className="form-field"><span>تاریخ</span><input aria-label="تاریخ" type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setStartAt('') }} /></label>
      </div></section>
      <section><h2>زمان‌های آزاد</h2>{slots.isFetching && <p>در حال دریافت زمان‌ها...</p>}{slots.isError && <p role="alert">دریافت زمان‌ها ناموفق بود</p>}{slots.data?.slots.length === 0 && <p>زمان آزادی برای این روز وجود ندارد.</p>}<div className="slot-grid">{slots.data?.slots.map((slot: AvailabilitySlot) => <button type="button" key={slot.startAt} className={startAt === slot.startAt ? 'selected' : ''} onClick={() => setStartAt(slot.startAt)}>{slot.localStart.slice(11, 16)}</button>)}</div></section>
      <section><label className="form-field"><span>توضیحات (اختیاری)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} /></label></section>
      <footer className="form-actions"><button className="primary-button" disabled={!startAt || mutation.isPending}>{mutation.isPending ? 'در حال ثبت...' : 'ثبت درخواست نوبت'}</button></footer>
    </form>
    <section className="salon-form"><h2>نوبت‌های من</h2>{mine.isPending && <p>در حال بارگذاری...</p>}{mine.isError && <p role="alert">دریافت نوبت‌ها ناموفق بود</p>}{mine.data?.length === 0 && <p>هنوز نوبتی ثبت نکرده‌اید.</p>}{mine.data?.map((a) => <p key={a.id}>{a.salon?.name} - {a.service?.name} - {new Date(a.startAt).toLocaleString('fa-IR', { timeZone: salon?.timezone ?? 'Asia/Tehran' })} - {a.status === 'PENDING' ? 'در انتظار تأیید' : a.status === 'CONFIRMED' ? 'تأیید شده' : a.status === 'CANCELLED' ? 'لغو شده' : a.status}</p>)}</section>
  </div>
}
