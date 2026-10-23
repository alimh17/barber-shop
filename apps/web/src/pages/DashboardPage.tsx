import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  Clock3,
  Scissors,
  TrendingUp,
  UserRoundCheck,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { SalonBarbersPanel } from '../features/salons/SalonBarbersPanel';
const appointments = [
  {
    time: '۱۰:۳۰',
    name: 'امیر رضایی',
    service: 'اصلاح مو و ریش',
    barber: 'سام راد',
    status: 'در حال انجام',
  },
  {
    time: '۱۱:۱۵',
    name: 'محمد نوروزی',
    service: 'اصلاح کلاسیک',
    barber: 'کیان نادری',
    status: 'تأیید شده',
  },
  {
    time: '۱۲:۰۰',
    name: 'پارسا احمدی',
    service: 'فید و استایل',
    barber: 'سام راد',
    status: 'در انتظار',
  },
  {
    time: '۱۳:۳۰',
    name: 'سینا کریمی',
    service: 'اصلاح مو',
    barber: 'کیان نادری',
    status: 'تأیید شده',
  },
];
export function DashboardPage() {
  const { session } = useAuth();
  const firstName = session?.user.fullName?.trim().split(/\s+/)[0] || 'دوست عزیز';
  const canCreateSalon = session?.user.role === 'SUPER_ADMIN';
  const canManageSalon = ['SUPER_ADMIN', 'ADMIN'].includes(session?.user.role ?? '');
  return (
    <>
      <div className="page-title">
        <div>
          <h1>سلام، {firstName} 👋</h1>
          <p>این هم خلاصه‌ای از وضعیت امروز آرایشگاه شماست.</p>
        </div>
        <button>
          <CalendarCheck size={19} />
          نوبت جدید
        </button>
      </div>
      <section className="stats-grid">
        <article>
          <span className="stat-icon green">
            <CalendarCheck />
          </span>
          <div>
            <p>نوبت‌های امروز</p>
            <strong>۱۲</strong>
            <small>
              <TrendingUp size={14} /> ۸٪ بیشتر از دیروز
            </small>
          </div>
        </article>
        <article>
          <span className="stat-icon gold">
            <Clock3 />
          </span>
          <div>
            <p>در انتظار</p>
            <strong>۳</strong>
            <small className="muted">نیازمند تأیید</small>
          </div>
        </article>
        <article>
          <span className="stat-icon blue">
            <UserRoundCheck />
          </span>
          <div>
            <p>مشتری جدید</p>
            <strong>۵</strong>
            <small>
              <TrendingUp size={14} /> این هفته ۱۸ نفر
            </small>
          </div>
        </article>
        <article>
          <span className="stat-icon purple">
            <Scissors />
          </span>
          <div>
            <p>آرایشگر فعال</p>
            <strong>۴</strong>
            <small className="muted">از ۵ نفر</small>
          </div>
        </article>
      </section>
      <section className="salon-management-callout">
        <div className="salon-callout-icon"><Building2 /></div>
        <div><h2>مدیریت سالن‌ها</h2><p>{canCreateSalon ? 'یک شعبه جدید بسازید و سپس تیم، خدمات و برنامه کاری آن را تکمیل کنید.' : 'فهرست سالن‌ها و آرایشگرهای فعال را مشاهده کنید. ایجاد سالن جدید فقط توسط مدیرکل انجام می‌شود.'}</p></div>
        {canManageSalon ? <div className="management-actions">
          {canCreateSalon ? <Link className="create-salon-link" to="/salons/new">ایجاد سالن جدید <Building2 /></Link> : null}
          <Link className="create-salon-link secondary" to="/services/new">ایجاد خدمت <Scissors /></Link>
          <Link className="create-salon-link secondary" to="/barbers/new">ایجاد آرایشگر <UserRoundPlus /></Link>
        </div> : <span className="access-label">نیازمند دسترسی مدیر مجموعه</span>}
      </section>
      <SalonBarbersPanel />
      <section className="dashboard-grid">
        <div className="appointments-panel">
          <div className="panel-heading">
            <div>
              <h2>نوبت‌های امروز</h2>
              <p>برنامه کاری چهارشنبه</p>
            </div>
            <Link to="/appointments">
              مشاهده همه <ArrowLeft size={16} />
            </Link>
          </div>
          <div className="appointments-list">
            {appointments.map((item) => (
              <div className="appointment-row" key={item.time}>
                <time>{item.time}</time>
                <span className="customer-avatar">{item.name.charAt(0)}</span>
                <div className="appointment-main">
                  <strong>{item.name}</strong>
                  <span>{item.service}</span>
                </div>
                <div className="barber-name">
                  <Users size={15} />
                  {item.barber}
                </div>
                <span
                  className={`status ${item.status === 'در حال انجام' ? 'doing' : item.status === 'در انتظار' ? 'waiting' : ''}`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        <aside className="day-progress">
          <div className="panel-heading">
            <div>
              <h2>ظرفیت امروز</h2>
              <p>۸ نوبت از ۱۲ نوبت</p>
            </div>
          </div>
          <div className="progress-ring">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" />
              <circle className="fill" cx="60" cy="60" r="50" />
            </svg>
            <div>
              <strong>۶۷٪</strong>
              <span>تکمیل</span>
            </div>
          </div>
          <div className="progress-legend">
            <p>
              <i className="booked" />
              رزرو شده <b>۸</b>
            </p>
            <p>
              <i />
              ظرفیت آزاد <b>۴</b>
            </p>
          </div>
          <div className="next-slot">
            <span>نزدیک‌ترین زمان آزاد</span>
            <strong>امروز، ساعت ۱۴:۱۵</strong>
          </div>
        </aside>
      </section>
    </>
  );
}
