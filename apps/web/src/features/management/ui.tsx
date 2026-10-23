import { appointmentStatusLabels, type AppointmentStatus } from './api'

const tones: Record<AppointmentStatus, string> = {
  PENDING: 'waiting',
  CONFIRMED: '',
  COMPLETED: 'done',
  CANCELLED: 'cancelled',
  NO_SHOW: 'cancelled',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`mgmt-badge ${tones[status]}`}>{appointmentStatusLabels[status]}</span>
}

export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (next: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <nav className="mgmt-pager" aria-label="صفحه‌بندی">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        قبلی
      </button>
      <span>
        صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
      </span>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        بعدی
      </button>
    </nav>
  )
}
