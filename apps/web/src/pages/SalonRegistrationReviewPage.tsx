import { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock3, XCircle, RefreshCw } from 'lucide-react';
import { api, getApiErrorMessage } from '../auth/api';
import './salon-registration-review.css';

type Registration = {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  createdAt: string;
  applicant: { phone: string; firstName?: string | null; lastName?: string | null };
};

const statuses = {
  PENDING: 'در انتظار بررسی',
  APPROVED: 'تأیید شده',
  REJECTED: 'رد شده',
};

export function SalonRegistrationReviewPage() {
  const [items, setItems] = useState<Registration[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<Registration[]>('/salon-registrations');
      setItems(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'دریافت درخواست‌ها ناموفق بود.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    if (busyId) return;
    if (action === 'reject' && reason.trim().length < 3) {
      setError('دلیل رد درخواست باید حداقل ۳ کاراکتر باشد.');
      return;
    }
    if (action === 'approve' && !window.confirm('آیا از تأیید این درخواست و ایجاد سالن اطمینان دارید؟')) return;
    setBusyId(id);
    setError('');
    try {
      await api.post('/salon-registrations/' + id + '/' + action, action === 'reject' ? { reason: reason.trim() } : {});
      setRejectId(null);
      setReason('');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'ثبت تصمیم ناموفق بود.'));
    } finally {
      setBusyId(null);
    }
  }

  const visible = filter === 'ALL' ? items : items.filter(item => item.status === 'PENDING');
  const pendingCount = items.filter(item => item.status === 'PENDING').length;

  return <main className="review-page" dir="rtl">
    <header className="review-header">
      <div><h1><Building2 size={26} /> درخواست‌های ثبت سالن</h1><p>درخواست متقاضیان سالن را بررسی و تأیید یا رد کنید.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading || !!busyId}><RefreshCw size={17} /> به‌روزرسانی</button>
    </header>
    <div className="review-filters">
      <button type="button" className={filter === 'PENDING' ? 'active' : ''} onClick={() => setFilter('PENDING')}>در انتظار بررسی ({pendingCount})</button>
      <button type="button" className={filter === 'ALL' ? 'active' : ''} onClick={() => setFilter('ALL')}>همه درخواست‌ها ({items.length})</button>
    </div>
    {error && <div role="alert" className="review-error">{error}</div>}
    {loading ? <p className="review-empty">در حال دریافت درخواست‌ها...</p> : visible.length === 0 ? <p className="review-empty">درخواستی در این بخش وجود ندارد.</p> :
      <div className="review-list">{visible.map(item => <article className="review-card" key={item.id}>
        <div className="review-card-head">
          <div><h2>{item.name}</h2><span dir="ltr">{item.slug}</span></div>
          <span className={'review-status review-' + item.status.toLowerCase()}>{item.status === 'PENDING' ? <Clock3 size={16} /> : item.status === 'APPROVED' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}{statuses[item.status]}</span>
        </div>
        <div className="review-details">
          <p><strong>متقاضی:</strong> {[item.applicant.firstName, item.applicant.lastName].filter(Boolean).join(' ') || 'ثبت نشده'}</p>
          <p><strong>شماره تماس:</strong> <span dir="ltr">{item.applicant.phone}</span></p>
          <p><strong>تاریخ درخواست:</strong> {new Date(item.createdAt).toLocaleDateString('fa-IR')}</p>
          {item.address && <p><strong>آدرس:</strong> {item.address}</p>}
          {item.rejectionReason && <p><strong>دلیل رد:</strong> {item.rejectionReason}</p>}
        </div>
        {item.status === 'PENDING' && <div className="review-actions">
          <button type="button" className="review-approve" disabled={!!busyId} onClick={() => void decide(item.id, 'approve')}>تأیید و ایجاد سالن</button>
          <button type="button" className="review-reject" disabled={!!busyId} onClick={() => { setRejectId(rejectId === item.id ? null : item.id); setReason(''); }}>رد درخواست</button>
          {rejectId === item.id && <div className="review-reason"><label htmlFor={'reason-' + item.id}>دلیل رد درخواست</label><textarea id={'reason-' + item.id} value={reason} maxLength={500} onChange={e => setReason(e.target.value)} placeholder="دلیل رد را برای متقاضی بنویسید" /><button type="button" disabled={!!busyId || reason.trim().length < 3} onClick={() => void decide(item.id, 'reject')}>ثبت رد درخواست</button></div>}
        </div>}
      </article>)}</div>}
  </main>;
}
