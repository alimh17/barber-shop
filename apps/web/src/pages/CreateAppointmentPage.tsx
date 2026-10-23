import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarPlus, Save } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../auth/api'
import {
  createAdminAppointment,
  getAvailability,
  getBarberServices,
  listUsers,
  personName,
  tehranDate,
  type AvailabilitySlot,
  type ManagedUser,
} from '../features/management/api'
import '../features/management/management.css'

const localTime = (slot: AvailabilitySlot) => slot.localStart.slice(11, 16)

export function CreateAppointmentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [barberId, setBarberId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(() => tehranDate())
  const [startAt, setStartAt] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customer, setCustomer] = useState<ManagedUser | null>(null)
  const [note, setNote] = useState('')

  const barbersQuery = useQuery({ queryKey: ['team', 'barbers'], queryFn: () => listUsers({ role: 'BARBER', limit: 100 }) })
  const barbers = (barbersQuery.data?.items ?? []).flatMap((user) =>
    user.barber && user.barber.isActive ? [{ user, barberId: user.barber.id, salonId: user.barber.salonId }] : [],
  )
  const selectedBarber = barbers.find((b) => b.barberId === barberId)

  const servicesQuery = useQuery({
    queryKey: ['barber-services', barberId],
    queryFn: () => getBarberServices(barberId),
    enabled: Boolean(barberId),
  })
  const services = (servicesQuery.data ?? []).filter((s) => s.service.isActive)

  const slotsQuery = useQuery({
    queryKey: ['availability', selectedBarber?.salonId, barberId, serviceId, date],
    queryFn: () => getAvailability({ salonId: selectedBarber?.salonId ?? '', barberId, serviceId, date }),
    enabled: Boolean(selectedBarber && serviceId && date),
  })
  const slots = slotsQuery.data?.slots ?? []

  const customerTerm = customerSearch.trim()
  const customersQuery = useQuery({
    queryKey: ['customer-search', customerTerm],
    queryFn: () => listUsers({ role: 'CUSTOMER', search: customerTerm, limit: 10 }),
    enabled: customerTerm.length >= 3,
  })
  const customerOptions = customersQuery.data?.items ?? []

  const mutation = useMutation({
    mutationFn: () =>
      createAdminAppointment({
        customerId: customer?.id ?? '',
        barberId,
        serviceId,
        startAt,
        note: note.trim() || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('نوبت ثبت شد')
      navigate('/appointments')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'ثبت نوبت انجام نشد. زمان یا اطلاعات را بررسی کنید.')),
  })

  const canSubmit = Boolean(customer && barberId && serviceId && startAt) && !mutation.isPending

  const pickBarber = (id: string) => {
    setBarberId(id)
    setServiceId('')
    setStartAt('')
  }
  const pickService = (id: string) => {
    setServiceId(id)
    setStartAt('')
  }
  const pickDate = (value: string) => {
    setDate(value)
    setStartAt('')
  }

  return (
    <div className="create-salon-page">
      <div className="page-title salon-form-title">
        <div>
          <Link to="/appointments" className="back-link-inline">
            <ArrowRight /> بازگشت به نوبت‌ها
          </Link>
          <h1>ثبت نوبت جدید</h1>
          <p>آرایشگر، خدمت، زمان و مشتری را انتخاب کنید.</p>
        </div>
        <span className="form-title-icon">
          <CalendarPlus />
        </span>
      </div>

      <form
        className="salon-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSubmit) mutation.mutate()
        }}
      >
        <section>
          <div className="form-section-heading">
            <span>۱</span>
            <div>
              <h2>آرایشگر و خدمت</h2>
              <p>فقط آرایشگرهای فعال نمایش داده می‌شوند.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="form-field">
              <span>
                آرایشگر <b>*</b>
              </span>
              <select value={barberId} onChange={(e) => pickBarber(e.target.value)}>
                <option value="">انتخاب آرایشگر</option>
                {barbers.map((b) => (
                  <option key={b.barberId} value={b.barberId}>
                    {personName(b.user)}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>
                خدمت <b>*</b>
              </span>
              <select value={serviceId} onChange={(e) => pickService(e.target.value)} disabled={!barberId}>
                <option value="">{barberId ? 'انتخاب خدمت' : 'ابتدا آرایشگر را انتخاب کنید'}</option>
                {services.map((s) => (
                  <option key={s.serviceId} value={s.serviceId}>
                    {s.service.name} ({s.service.duration.toLocaleString('fa-IR')} دقیقه)
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field full-width">
              <span>
                تاریخ <b>*</b>
              </span>
              <input type="date" min={tehranDate()} value={date} onChange={(e) => pickDate(e.target.value)} />
            </label>
          </div>
        </section>

        <section>
          <div className="form-section-heading">
            <span>۲</span>
            <div>
              <h2>زمان نوبت</h2>
              <p>فقط بازه‌های آزاد نمایش داده می‌شوند.</p>
            </div>
          </div>
          {!selectedBarber || !serviceId ? <p className="inline-note">آرایشگر و خدمت را انتخاب کنید.</p> : null}
          {slotsQuery.isPending && selectedBarber && serviceId ? (
            <div className="data-state">
              <span className="spinner" />
            </div>
          ) : null}
          {slotsQuery.isError ? <p className="form-api-error">دریافت زمان‌های آزاد انجام نشد.</p> : null}
          {slotsQuery.data?.dayOff ? <p className="inline-note">این روز برای آرایشگر تعطیل است.</p> : null}
          {slotsQuery.data && !slotsQuery.data.dayOff && slots.length === 0 ? (
            <p className="inline-note">در این روز زمان آزادی نیست.</p>
          ) : null}
          {slots.length ? (
            <div className="slot-grid">
              {slots.map((slot) => (
                <button
                  key={slot.startAt}
                  type="button"
                  className={startAt === slot.startAt ? 'selected' : ''}
                  onClick={() => setStartAt(slot.startAt)}
                >
                  {localTime(slot)}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section>
          <div className="form-section-heading">
            <span>۳</span>
            <div>
              <h2>مشتری</h2>
              <p>حداقل ۳ حرف از نام یا شماره موبایل را وارد کنید.</p>
            </div>
          </div>
          <label className="form-field">
            <span>
              جستجوی مشتری <b>*</b>
            </span>
            <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="نام یا شماره موبایل" />
          </label>
          {customer ? (
            <p className="inline-note">
              انتخاب شده: <strong>{personName(customer)}</strong> ({customer.phone})
            </p>
          ) : null}
          {customerTerm.length >= 3 && customersQuery.isFetching ? <p className="inline-note">در حال جستجو…</p> : null}
          {customerTerm.length >= 3 && customersQuery.isSuccess && customerOptions.length === 0 ? (
            <p className="inline-note">مشتری‌ای با این مشخصات پیدا نشد.</p>
          ) : null}
          {customerOptions.length ? (
            <div className="picker-list">
              {customerOptions.map((c) => (
                <button key={c.id} type="button" className={customer?.id === c.id ? 'selected' : ''} onClick={() => setCustomer(c)}>
                  <strong>{personName(c)}</strong>
                  <small>{c.phone}</small>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section>
          <div className="form-section-heading">
            <span>۴</span>
            <div>
              <h2>یادداشت</h2>
              <p>اختیاری</p>
            </div>
          </div>
          <label className="form-field full-width">
            <span>یادداشت</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </section>

        <footer className="form-actions">
          <Link to="/appointments">انصراف</Link>
          <button className="primary-button" disabled={!canSubmit}>
            <Save />
            {mutation.isPending ? 'در حال ثبت…' : 'ثبت نوبت'}
          </button>
        </footer>
      </form>
    </div>
  )
}
