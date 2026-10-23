import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Scissors, UserRoundPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../auth/api'
import { listUsers, personName, setBarberActive, userStatusLabels } from '../features/management/api'
import '../features/management/management.css'

export function TeamPage() {
  const queryClient = useQueryClient()

  const barbersQuery = useQuery({ queryKey: ['team', 'barbers'], queryFn: () => listUsers({ role: 'BARBER', limit: 100 }) })
  const adminsQuery = useQuery({ queryKey: ['team', 'admins'], queryFn: () => listUsers({ role: 'ADMIN', limit: 100 }) })

  const barbers = (barbersQuery.data?.items ?? []).flatMap((user) =>
    user.barber ? [{ user, barberId: user.barber.id, isActive: user.barber.isActive }] : [],
  )

  const toggle = useMutation({
    mutationFn: ({ barberId, isActive }: { barberId: string; isActive: boolean }) => setBarberActive(barberId, isActive),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['team', 'barbers'] })
      await queryClient.invalidateQueries({ queryKey: ['barbers'] })
      toast.success(vars.isActive ? 'آرایشگر فعال شد' : 'آرایشگر غیرفعال شد')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تغییر وضعیت آرایشگر انجام نشد.')),
  })

  return (
    <>
      <div className="page-title">
        <div>
          <h1>مدیریت تیم</h1>
          <p>آرایشگرها و مدیران سالن‌های شما</p>
        </div>
        <div className="mgmt-actions-row">
          <Link className="mgmt-secondary-link" to="/services/new">
            خدمت جدید
          </Link>
          <Link className="mgmt-primary-link" to="/barbers/new">
            <UserRoundPlus size={18} />
            آرایشگر جدید
          </Link>
        </div>
      </div>

      <h2 className="mgmt-section-title">آرایشگرها</h2>
      {barbersQuery.isPending ? (
        <div className="data-state">
          <span className="spinner" />
        </div>
      ) : null}
      {barbersQuery.isError ? (
        <div className="data-state error-state">
          <p>دریافت آرایشگرها انجام نشد.</p>
          <button type="button" onClick={() => void barbersQuery.refetch()}>
            تلاش دوباره
          </button>
        </div>
      ) : null}
      {barbersQuery.isSuccess && barbers.length === 0 ? (
        <div className="data-state">
          <Scissors />
          <p>هنوز آرایشگری ثبت نشده است.</p>
        </div>
      ) : null}
      {barbers.length ? (
        <section className="mgmt-panel">
          {barbers.map((row) => (
            <div className="mgmt-user-row" key={row.user.id}>
              <div>
                <strong>{personName(row.user)}</strong>
                <span dir="ltr">{row.user.phone}</span>
              </div>
              <label className="switch" title={row.isActive ? 'غیرفعال کردن' : 'فعال کردن'}>
                <input
                  type="checkbox"
                  checked={row.isActive}
                  disabled={toggle.isPending}
                  aria-label={`وضعیت ${personName(row.user)}`}
                  onChange={() => toggle.mutate({ barberId: row.barberId, isActive: !row.isActive })}
                />
                <span />
              </label>
            </div>
          ))}
        </section>
      ) : null}

      <h2 className="mgmt-section-title">مدیران</h2>
      {adminsQuery.isError ? (
        <div className="data-state error-state">
          <p>دریافت مدیران انجام نشد.</p>
        </div>
      ) : null}
      {adminsQuery.data?.items.length ? (
        <section className="mgmt-panel">
          {adminsQuery.data.items.map((user) => (
            <div className="mgmt-user-row" key={user.id}>
              <div>
                <strong>{personName(user)}</strong>
                <span dir="ltr">{user.phone}</span>
              </div>
              <span>{userStatusLabels[user.status] ?? user.status}</span>
            </div>
          ))}
        </section>
      ) : null}
    </>
  )
}
