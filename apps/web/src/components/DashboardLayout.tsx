import {
  Building2,
  CalendarDays,
  CirclePlus,
  LayoutDashboard,
  ChartNoAxesCombined,
  Bell,
  LogOut,
  Menu,
  Scissors,
  Settings,
  UserRound,
  UserRoundPlus,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { tehranLongDate } from '../features/management/api';
import { PwaInstallPrompt } from './PwaInstallPrompt';

const roleLabels = {
  SUPER_ADMIN: 'مدیر کل',
  ADMIN: 'مدیر مجموعه',
  BARBER: 'آرایشگر',
  CUSTOMER: 'مشتری',
};

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const { session, signOut } = useAuth();
  const user = session!.user;
  const displayName =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.phone;
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
  const links = [
    { to: '/dashboard', label: 'نمای کلی', icon: LayoutDashboard },
    { to: '/profile', label: 'پروفایل من', icon: UserRound },
    { to: '/settings/notifications', label: 'اعلان‌ها', icon: Bell },
    ...(isAdmin
      ? [
          { to: '/appointments', label: 'نوبت‌ها', icon: CalendarDays },
          { to: '/customers', label: 'مشتریان', icon: Users },
          {
            to: '/reports/revenue',
            label: 'گزارش درآمد',
            icon: ChartNoAxesCombined,
          },
        ]
      : []),
    ...(user.role === 'CUSTOMER'
      ? [{ to: '/book', label: 'رزرو نوبت', icon: CalendarDays }]
      : []),
    ...(user.role === 'BARBER'
      ? [{ to: '/my-revenue', label: 'درآمد من', icon: ChartNoAxesCombined }, { to: '/appointments', label: 'درخواست‌های نوبت', icon: CalendarDays }]
      : []),
    ...(user.role === 'SUPER_ADMIN'
      ? [{ to: '/salons/new', label: 'سالن جدید', icon: Building2 }]
      : []),
    ...(isAdmin
      ? [
          { to: '/services/new', label: 'خدمت جدید', icon: CirclePlus },
          { to: '/barbers/new', label: 'آرایشگر جدید', icon: UserRoundPlus },
          { to: '/team', label: 'مدیریت تیم', icon: Scissors },
          { to: '/settings/sms', label: 'پیامک سالن', icon: Settings },
        ]
      : []),
  ];

  return (
    <div className="app-shell">
      <button
        className="menu-button"
        onClick={() => setOpen(true)}
        aria-label="باز کردن منو"
      >
        <Menu />
      </button>
      {open ? (
        <button
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="بستن منو"
        />
      ) : null}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span>
            <Scissors size={20} />
          </span>
          <strong>قیچی</strong>
          <button onClick={() => setOpen(false)} aria-label="بستن">
            <X />
          </button>
        </div>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/profile">
            <UserRound size={19} />
            پروفایل من
          </NavLink>
          <button onClick={() => void signOut()}>
            <LogOut size={19} />
            خروج از حساب
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="today">
            <span>امروز</span>
            <strong>{tehranLongDate()}</strong>
          </div>
          <NavLink
            className="profile"
            to="/profile"
            aria-label="مشاهده پروفایل من"
          >
            <div>
              <strong>{displayName}</strong>
              <span>{roleLabels[user.role]}</span>
            </div>
            <span className="avatar">{displayName.charAt(0)}</span>
          </NavLink>
        </header>
        <main className="content">
          <PwaInstallPrompt />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
