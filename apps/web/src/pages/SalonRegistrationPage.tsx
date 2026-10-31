import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Building2, CheckCircle2, Clock3, AlertCircle, ArrowRight } from 'lucide-react';
import { api, getApiErrorMessage } from '../auth/api';
import { useAuth } from '../auth/auth-context';
import './salon-registration.css';

type Registration = { id: string; name: string; slug: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; rejectionReason?: string | null };
const statusText: Record<Registration['status'], string> = {
 PENDING: 'در انتظار بررسی مدیر کل',
 APPROVED: 'تأیید شده',
 REJECTED: 'رد شده',
};
export function SalonRegistrationPage() {
 const { session } = useAuth();
 const [name, setName] = useState('');
 const [slug, setSlug] = useState('');
 const [address, setAddress] = useState('');
 const [requests, setRequests] = useState<Registration[]>([]);
 const [error, setError] = useState('');
 const [loadError, setLoadError] = useState('');
 const [loading, setLoading] = useState(false);
 const [busy, setBusy] = useState(false);
 const load = useCallback(async () => {
   setLoading(true);
   setLoadError('');
   try {
     const { data } = await api.get<Registration[]>('/salon-registrations/mine');
     setRequests(data);
   } catch (err) {
     const code = axios.isAxiosError(err) ? err.response?.status : undefined;
     setLoadError(code === 404 ? 'سرویس ثبت سالن روی سرور فعال نیست. نسخه Backend باید به‌روزرسانی شود.' : code === 401 ? 'نشست شما منقضی شده است؛ دوباره وارد شوید.' : getApiErrorMessage(err, 'دریافت درخواست‌ها ناموفق بود. لطفاً دوباره تلاش کنید.'));
   } finally { setLoading(false); }
 }, []);
 useEffect(() => { if (session) queueMicrotask(() => void load()); }, [session, load]);
 if (!session) return <main className="registration-page" dir="rtl"><section className="registration-card"><Building2 size={36}/><h1>ثبت سالن جدید</h1><p>برای ثبت سالن، ابتدا شماره همراه خود را تأیید کنید.</p><Link className="mgmt-primary-link" to="/login?purpose=salon-registration">ورود با شماره همراه</Link></section></main>;
 const hasPending = requests.some(r => r.status === 'PENDING');
 const canSubmit = session.user.role === 'CUSTOMER' && !hasPending && !loadError && !loading;
 return <main className="registration-page" dir="rtl">
   <div className="registration-top"><Link to="/dashboard"><ArrowRight size={18}/> بازگشت به داشبورد</Link></div>
   <section className="registration-card">
     <div className="registration-heading"><span className="registration-icon"><Building2 size={26}/></span><div><h1>ثبت سالن جدید</h1><p>اطلاعات سالن خود را وارد کنید تا پس از بررسی مدیر کل، حساب مدیریت سالن فعال شود.</p></div></div>
     {session.user.role !== 'CUSTOMER' && <div className="registration-notice"><CheckCircle2 size={20}/> حساب شما از قبل نقش مدیریتی یا سازمانی دارد.</div>}
     {hasPending && <div className="registration-notice"><Clock3 size={20}/> درخواست شما ثبت شده و در انتظار تأیید مدیر کل است.</div>}
     {loadError && <div className="registration-error" role="alert"><AlertCircle size={19}/><span>{loadError}</span><button type="button" onClick={() => void load()}>تلاش مجدد</button></div>}
     {canSubmit && <form className="registration-form" onSubmit={async e => {
       e.preventDefault(); setBusy(true); setError('');
       try {
         await api.post('/salon-registrations', { name: name.trim(), slug: slug.trim().toLowerCase(), address: address.trim() });
         setName(''); setSlug(''); setAddress(''); await load();
       } catch (err) { setError(getApiErrorMessage(err, 'ثبت درخواست ناموفق بود.')); }
       finally { setBusy(false); }
     }}>
       <label>نام سالن <span>*</span><input required minLength={2} maxLength={120} placeholder="مثلاً سالن زیبایی آریا" value={name} onChange={e => setName(e.target.value)} /></label>
       <label>شناسه انگلیسی سالن <span>*</span><input required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="aria-salon" value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} /><small>فقط حروف انگلیسی کوچک، عدد و خط تیره</small></label>
       <label>آدرس سالن <span className="optional">(اختیاری)</span><textarea rows={3} placeholder="آدرس کامل سالن" value={address} onChange={e => setAddress(e.target.value)} /></label>
       {error && <div className="registration-error" role="alert"><AlertCircle size={19}/>{error}</div>}
       <button className="registration-submit" disabled={busy} type="submit">{busy ? 'در حال ثبت...' : 'ارسال درخواست ثبت سالن'}</button>
     </form>}
   </section>
   <section className="registration-card"><div className="registration-list-title"><h2>درخواست‌های من</h2><button type="button" onClick={() => void load()} disabled={loading}>به‌روزرسانی</button></div>
     {loading ? <p>در حال دریافت درخواست‌ها...</p> : requests.length ? requests.map(r => <article className="registration-item" key={r.id}><strong>{r.name}</strong><span dir="ltr">{r.slug}</span><span className={'registration-status status-' + r.status.toLowerCase()}>{statusText[r.status]}</span>{r.rejectionReason && <p>دلیل رد: {r.rejectionReason}</p>}</article>) : !loadError && <p>هنوز درخواستی ثبت نکرده‌اید.</p>}
   </section>
 </main>;
}
