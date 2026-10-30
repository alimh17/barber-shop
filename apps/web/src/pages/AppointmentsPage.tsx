import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Clock3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../auth/api';
import { useAuth } from '../auth/auth-context';
import { PersianDateInput } from '../components/PersianDateInput';
import {
  appointmentStatusLabels,
  changeAppointmentStatus,
  formatToman,
  listAppointments,
  nextStatuses,
  personName,
  statusActionLabels,
  tehranDate,
  tehranDisplayDate,
  tehranTime,
  type AppointmentRecord,
  type AppointmentStatus,
} from '../features/management/api';
import { StatusBadge } from '../features/management/ui';
import '../features/management/management.css';

type StatusFilter = 'ALL' | AppointmentStatus;

const statusFilters: StatusFilter[] = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const isBarber = session?.user.role === 'BARBER';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [date, setDate] = useState('');

  const query = useQuery({
    queryKey: ['appointments'],
    queryFn: listAppointments,
  });

  const mutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: AppointmentStatus }) =>
      changeAppointmentStatus(id, next),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success(
        `وضعیت نوبت به «${appointmentStatusLabels[vars.next]}» تغییر کرد`,
      );
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'تغییر وضعیت انجام نشد.')),
  });

  const items = useMemo(
    () =>
      (query.data ?? [])
        .filter(
          (a) =>
            (statusFilter === 'ALL' || a.status === statusFilter) &&
            (!date || tehranDate(a.startAt) === date),
        )
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [query.data, statusFilter, date],
  );

  return (
    <>
      <div className="page-title">
        <div>
          <h1>نوبت‌ها</h1>
          <p>نوبت‌های سالن‌های تحت مدیریت شما</p>
        </div>
        {!isBarber && (
          <Link className="mgmt-primary-link" to="/appointments/new">
            <CalendarPlus size={19} />
            نوبت جدید
          </Link>
        )}
      </div>

      <section className="mgmt-toolbar">
        <div className="mgmt-chips" role="tablist">
          {statusFilters.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${statusFilter === f ? 'active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f === 'ALL' ? 'همه' : appointmentStatusLabels[f]}
            </button>
          ))}
        </div>
        <PersianDateInput
          className="mgmt-date"
          value={date}
          onChange={setDate}
          aria-label="فیلتر تاریخ شمسی"
        />
      </section>

      {query.isPending ? (
        <div className="data-state">
          <span className="spinner" />
          <p>در حال دریافت نوبت‌ها…</p>
        </div>
      ) : null}
      {query.isError ? (
        <div className="data-state error-state">
          <p>{getApiErrorMessage(query.error, 'دریافت نوبت‌ها انجام نشد.')}</p>
          <button type="button" onClick={() => void query.refetch()}>
            تلاش دوباره
          </button>
        </div>
      ) : null}
      {query.isSuccess && items.length === 0 ? (
        <div className="data-state">
          <Clock3 />
          <p>نوبتی با این فیلتر پیدا نشد.</p>
        </div>
      ) : null}

      {items.length ? (
        <div className="mgmt-list">
          {items.map((appointment) => (
            <AppointmentRow
              key={appointment.id}
              appointment={appointment}
              isBarber={isBarber}
              busy={
                mutation.isPending && mutation.variables?.id === appointment.id
              }
              onChange={(next) => mutation.mutate({ id: appointment.id, next })}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function AppointmentRow({
  appointment,
  isBarber,
  busy,
  onChange,
}: {
  appointment: AppointmentRecord;
  isBarber: boolean;
  busy: boolean;
  onChange: (next: AppointmentStatus) => void;
}) {
  const actions = isBarber
    ? appointment.status === 'PENDING'
      ? nextStatuses.PENDING
      : []
    : nextStatuses[appointment.status];

  const handleAction = (next: AppointmentStatus) => {
    if (next === 'CANCELLED' && !window.confirm('این نوبت لغو شود؟')) return;
    onChange(next);
  };

  return (
    <article className="mgmt-card">
      <div className="mgmt-card-time">
        <strong>{tehranTime(appointment.startAt)}</strong>
        <span>{tehranDisplayDate(appointment.startAt)}</span>
      </div>
      <div className="mgmt-card-main">
        <strong>{personName(appointment.customer?.user)}</strong>
        <span>
          {appointment.service?.name ?? 'خدمت'} ·{' '}
          {personName(appointment.barber?.user)}
        </span>
        {appointment.note ? <small>{appointment.note}</small> : null}
      </div>
      <div className="mgmt-card-meta">
        <StatusBadge status={appointment.status} />
        <span>{formatToman(appointment.price)}</span>
      </div>
      {actions.length ? (
        <div className="mgmt-card-actions">
          {actions.map((next) => (
            <button
              key={next}
              type="button"
              disabled={busy}
              className={
                next === 'CANCELLED' || next === 'NO_SHOW'
                  ? 'ghost-danger'
                  : 'ghost'
              }
              onClick={() => handleAction(next)}
            >
              {statusActionLabels[next]}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
