import { Building2, CalendarDays, CirclePlus, LayoutDashboard, LogOut, Menu, Scissors, Settings, UserRoundPlus, Users, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'

const roleLabels = { SUPER_ADMIN: 'مدیر کل', ADMIN: 'مدیر مجموعه', BARBER: 'آرایشگر', CUSTOMER: 'مشتری' }

export function DashboardLayout() {
  const [open, setOpen] = useState(false)
  const { session, signOut } = useAuth()
  const user = session!.user
  const displayName = user.fullName || user.phone
  const links = [
    { to: '/dashboard', label: 'نمای کلی', icon: LayoutDashboard },
    { to: '/appointments', label: 'نوبت‌ها', icon: CalendarDays },
    { to: '/customers', label: 'مشتریان', icon: Users },
    ...(user.role === 'SUPER_ADMIN' ? [{ to: '/salons/new', label: 'سالن جدید', icon: Building2 }] : []),
    ...(['SUPER_ADMIN', 'ADMIN'].includes(user.role) ? [
      { to: '/services/new', label: 'خدمت جدید', icon: CirclePlus },
      { to: '/barbers/new', label: 'آرایشگر جدید', icon: UserRoundPlus },
    ] : []),
    ...(['SUPER_ADMIN', 'ADMIN'].includes(user.role) ? [{ to: '/team', label: 'مدیریت تیم', icon: Scissors }] : []),
  ]
  return <div className="app-shell"><button className="menu-button" onClick={() => setOpen(true)} aria-label="باز کردن منو"><Menu /></button>{open ? <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="بستن منو" /> : null}<aside className={`sidebar ${open ? 'open' : ''}`}><div className="sidebar-brand"><span><Scissors size={20} /></span><strong>قیچی</strong><button onClick={() => setOpen(false)} aria-label="بستن"><X /></button></div><nav>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={20} />{label}</NavLink>)}</nav><div className="sidebar-bottom"><a href="#settings"><Settings size={19} />تنظیمات</a><button onClick={() => void signOut()}><LogOut size={19} />خروج از حساب</button></div></aside><div className="workspace"><header className="topbar"><div className="today"><span>امروز</span><strong>چهارشنبه، ۲۳ مهر</strong></div><div className="profile"><div><strong>{displayName}</strong><span>{roleLabels[user.role]}</span></div><span className="avatar">{displayName.charAt(0)}</span></div></header><main className="content"><Outlet /></main></div></div>
}
