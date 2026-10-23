import { useQuery } from '@tanstack/react-query'
import { Building2, RefreshCw, Scissors, UserRound } from 'lucide-react'
import { useState } from 'react'
import { getApiErrorMessage } from '../../auth/api'
import { getBarbers, getSalons } from './api'

export function SalonBarbersPanel() {
  const [salonId, setSalonId] = useState('')
  const salonsQuery = useQuery({ queryKey: ['salons'], queryFn: getSalons })
  const salons = salonsQuery.data ?? []
  const effectiveSalonId = salonId || salons[0]?.id || ''

  const barbersQuery = useQuery({
    queryKey: ['barbers', effectiveSalonId],
    queryFn: () => getBarbers(effectiveSalonId),
    enabled: Boolean(effectiveSalonId),
  })
  const selectedSalon = salons.find((salon) => salon.id === effectiveSalonId)

  return <section className="salon-panel" aria-labelledby="salon-panel-title">
    <div className="panel-heading">
      <div><h2 id="salon-panel-title">سالن و آرایشگرها</h2><p>اطلاعات زنده از سرویس سالن‌ها و آرایشگرها</p></div>
      <button className="refresh-button" onClick={() => void Promise.all([salonsQuery.refetch(), barbersQuery.refetch()])} aria-label="بروزرسانی اطلاعات"><RefreshCw /></button>
    </div>

    {salonsQuery.isPending ? <div className="data-state"><span className="spinner"/><p>در حال دریافت سالن‌ها…</p></div> : null}
    {salonsQuery.isError ? <div className="data-state error-state"><p>{getApiErrorMessage(salonsQuery.error, 'دریافت سالن‌ها انجام نشد.')}</p><button onClick={() => void salonsQuery.refetch()}>تلاش دوباره</button></div> : null}
    {!salonsQuery.isPending && !salonsQuery.isError && salons.length === 0 ? <div className="data-state"><Building2/><p>هنوز سالن فعالی ثبت نشده است.</p></div> : null}

    {salons.length > 0 ? <>
      <label className="salon-select" htmlFor="salon"><span>انتخاب سالن</span><select id="salon" value={effectiveSalonId} onChange={(event) => setSalonId(event.target.value)}>{salons.map((salon) => <option key={salon.id} value={salon.id}>{salon.name}</option>)}</select></label>
      {selectedSalon ? <div className="salon-summary"><Building2/><div><strong>{selectedSalon.name}</strong><span>{selectedSalon.address || 'آدرس سالن ثبت نشده است'}</span></div></div> : null}
      {barbersQuery.isPending ? <div className="data-state"><span className="spinner"/><p>در حال دریافت آرایشگرها…</p></div> : null}
      {barbersQuery.isError ? <div className="data-state error-state"><p>{getApiErrorMessage(barbersQuery.error, 'دریافت آرایشگرها انجام نشد.')}</p><button onClick={() => void barbersQuery.refetch()}>تلاش دوباره</button></div> : null}
      {barbersQuery.data?.length === 0 ? <div className="data-state"><Scissors/><p>برای این سالن آرایشگر فعالی وجود ندارد.</p></div> : null}
      {barbersQuery.data?.length ? <div className="barbers-list">{barbersQuery.data.map((barber) => { const name = [barber.user.firstName, barber.user.lastName].filter(Boolean).join(' ') || barber.user.phone; return <article key={barber.id}><span className="barber-avatar"><UserRound/></span><div><strong>{name}</strong><small dir="ltr">{barber.user.phone}</small></div><span className={barber.isActive ? 'barber-active' : 'barber-inactive'}>{barber.isActive ? 'فعال' : 'غیرفعال'}</span></article> })}</div> : null}
    </> : null}
  </section>
}
