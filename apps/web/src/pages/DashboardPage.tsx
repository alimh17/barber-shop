import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarCheck,
  CalendarPlus,
  Clock3,
  Building2,
  Scissors,
  UserRoundCheck,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { SalonBarbersPanel } from '../features/salons/SalonBarbersPanel';
import {
  appointmentStatusLabels,
  listAppointments,
  listUsers,
  personName,
  tehranDate,
  tehranLongDate,
  tehranTime,
  type AppointmentRecord,
} from '../features/management/api';
import '../features/management/management.css';

const byStart = (a: AppointmentRecord, b: AppointmentRecord) =>
  a.startAt.localeCompare(b.startAt);
const toFa = (n: number) => n.toLocaleString('fa-IR');

export function DashboardPage() {
  const [renderedAt] = useState(() => Date.now());
  const { session } = useAuth();
  const firstName =
    session?.user.fullName?.trim().split(/\s+/)[0] || 'دوست عزیز';
  const canCreateSalon = session?.user.role === 'SUPER_ADMIN';
  const canManageSalon = ['SUPER_ADMIN', 'ADMIN'].includes(
    session?.user.role ?? '',
  );

  const appointmentsQuery = useQuery({
    queryKey: ['appointments'],
    queryFn: listAppointments,
    enabled: canManageSalon,
  });
  const barbersQuery = useQuery({
    queryKey: ['team', 'barbers'],
    queryFn: () => listUsers({ role: 'BARBER', limit: 100 }),
    enabled: canManageSalon,
  });

  const today = tehranDate();
  const all = appointmentsQuery.data ?? [];
  const todays = all
    .filter((a) => tehranDate(a.startAt) === today)
    .sort(byStart);
  const booked = todays.filter((a) => a.status !== 'CANCELLED');
  const pendingCount = all.filter((a) => a.status === 'PENDING').length;
  const completedToday = todays.filter((a) => a.status === 'COMPLETED').length;
  const activeBarbers = (barbersQuery.data?.items ?? []).filter(
    (u) => u.barber?.isActive,
  ).length;
  const nextAppointment = booked.find(
    (a) =>
      new Date(a.startAt).getTime() >= renderedAt &&
      (a.status === 'PENDING' || a.status === 'CONFIRMED'),
  );

  return (
    <>
      <div className="page-title">
        <div>
          <h1>سلام، {firstName} 👋</h1>
          <p>این هم خلاصه‌ای از وضعیت امروز آرایشگاه شماست.</p>
        </div>
        {canManageSalon ? (
          <Link className="mgmt-primary-link" to="/appointments/new">
            <CalendarPlus size={19} />
            نوبت جدید
          </Link>
        ) : null}
      </div>

      {canManageSalon ? (
        <section className="stats-grid">
          <article>
            <span className="stat-icon green">
              <CalendarCheck />
            </span>
            <div>
              <p>نوبت‌های امروز</p>
              <strong>{toFa(booked.length)}</strong>
              <small className="muted">{tehranLongDate()}</small>
            </div>
          </article>
          <article>
            <span className="stat-icon gold">
              <Clock3 />
            </span>
            <div>
              <p>در انتظار</p>
              <strong>{toFa(pendingCount)}</strong>
              <small className="muted">نیازمند تأیید</small>
            </div>
          </article>
          <article>
            <span className="stat-icon blue">
              <UserRoundCheck />
            </span>
            <div>
              <p>تکمیل‌شده امروز</p>
              <strong>{toFa(completedToday)}</strong>
              <small className="muted">از {toFa(booked.length)} نوبت</small>
            </div>
          </article>
          <article>
            <span className="stat-icon purple">
              <Scissors />
            </span>
            <div>
              <p>آرایشگر فعال</p>
              <strong>{toFa(activeBarbers)}</strong>
              <small className="muted">
                از {toFa(barbersQuery.data?.meta.total ?? 0)} نفر
              </small>
            </div>
          </article>
        </section>
      ) : null}

      <section className="salon-management-callout">
        <div className="salon-callout-icon">
          <Building2 />
        </div>
        <div>
          <h2>مدیریت سالن‌ها</h2>
          <p>
            {canCreateSalon
              ? 'یک شعبه جدید بسازید و سپس تیم، خدمات و برنامه کاری آن را تکمیل کنید.'
              : 'فهرست سالن‌ها و آرایشگرهای فعال را مشاهده کنید. ایجاد سالن جدید فقط توسط مدیرکل انجام می‌شود.'}
          </p>
        </div>
        {canManageSalon ? (
          <div className="management-actions">
            {canCreateSalon ? (
              <Link className="create-salon-link" to="/salons/new">
                ایجاد سالن جدید <Building2 />
              </Link>
            ) : null}
            <Link className="create-salon-link secondary" to="/services/new">
              ایجاد خدمت <Scissors />
            </Link>
            <Link className="create-salon-link secondary" to="/barbers/new">
              ایجاد آرایشگر <UserRoundPlus />
            </Link>
          </div>
        ) : (
          <span className="access-label">نیازمند دسترسی مدیر مجموعه</span>
        )}
      </section>

      <SalonBarbersPanel />

      {canManageSalon ? (
        <section className="dashboard-grid">
          <div className="appointments-panel">
            <div className="panel-heading">
              <div>
                <h2>نوبت‌های امروز</h2>
                <p>برنامه کاری {tehranLongDate()}</p>
              </div>
              <Link to="/appointments">
                مشاهده همه <ArrowLeft size={16} />
              </Link>
            </div>

            {appointmentsQuery.isPending ? (
              <div className="data-state">
                <span className="spinner" />
                <p>در حال دریافت نوبت‌ها…</p>
              </div>
            ) : null}
            {appointmentsQuery.isError ? (
              <div className="data-state error-state">
                <p>دریافت نوبت‌ها انجام نشد.</p>
              </div>
            ) : null}
            {appointmentsQuery.isSuccess && todays.length === 0 ? (
              <div className="data-state">
                <CalendarCheck />
                <p>امروز نوبتی ثبت نشده است.</p>
              </div>
            ) : null}

            {todays.length ? (
              <div className="appointments-list">
                {todays.map((a) => (
                  <div className="appointment-row" key={a.id}>
                    <time>{tehranTime(a.startAt)}</time>
                    <span className="customer-avatar">
                      {personName(a.customer?.user).charAt(0)}
                    </span>
                    <div className="appointment-main">
                      <strong>{personName(a.customer?.user)}</strong>
                      <span>{a.service?.name ?? 'خدمت'}</span>
                    </div>
                    <div className="barber-name">
                      <Users size={15} />
                      {personName(a.barber?.user)}
                    </div>
                    <span
                      className={`status ${a.status === 'PENDING' ? 'waiting' : a.status === 'COMPLETED' ? 'doing' : a.status === 'CANCELLED' || a.status === 'NO_SHOW' ? 'cancelled' : ''}`}
                    >
                      {appointmentStatusLabels[a.status]}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="day-progress">
            <div className="panel-heading">
              <div>
                <h2>نوبت بعدی</h2>
                <p>
                  {toFa(completedToday)} از {toFa(booked.length)} نوبت امروز
                  تکمیل شده
                </p>
              </div>
            </div>
            <div className="next-slot">
              {nextAppointment ? (
                <>
                  <span>ساعت {tehranTime(nextAppointment.startAt)}</span>
                  <strong>
                    {personName(nextAppointment.customer?.user)} ·{' '}
                    {nextAppointment.service?.name ?? 'خدمت'}
                  </strong>
                </>
              ) : (
                <>
                  <span>وضعیت</span>
                  <strong>نوبت آزاد دیگری برای امروز نیست</strong>
                </>
              )}
            </div>
          </aside>
        </section>
      ) : null}
    </>
  );
}
