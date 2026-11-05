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
  const [decision, setDecision] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
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
    setBusyId(id);
    setError('');
    try {
      await api.post('/salon-registrations/' + id + '/' + action, action === 'reject' ? { reason: reason.trim() } : {});
      setDecision(null);
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
          <button type="button" className="review-approve" disabled={!!busyId} onClick={() => { setDecision({ id: item.id, action: 'approve' }); setError(''); }}>تأیید و ایجاد سالن</button>
          <button type="button" className="review-reject" disabled={!!busyId} onClick={() => { setDecision({ id: item.id, action: 'reject' }); setReason(''); setError(''); }}>رد درخواست</button>
        </div>}
      </article>)}</div>}
    {decision && <div className="review-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busyId) setDecision(null); }}>
      <div className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-modal-title" dir="rtl">
        <h2 id="review-modal-title">{decision.action === 'approve' ? "\u062a\u0623\u06cc\u06cc\u062f \u062f\u0631\u062e\u0648\u0627\u0633\u062a \u0633\u0627\u0644\u0646" : "\u0631\u062f \u062f\u0631\u062e\u0648\u0627\u0633\u062a \u0633\u0627\u0644\u0646"}</h2>
        <p>{decision.action === 'approve' ? "\u0628\u0627 \u062a\u0623\u06cc\u06cc\u062f \u0627\u06cc\u0646 \u062f\u0631\u062e\u0648\u0627\u0633\u062a\u060c \u0633\u0627\u0644\u0646 \u0627\u06cc\u062c\u0627\u062f \u0634\u062f\u0647 \u0648 \u0645\u062a\u0642\u0627\u0636\u06cc \u0628\u0647 \u0645\u062f\u06cc\u0631 \u0633\u0627\u0644\u0646 \u062a\u0628\u062f\u06cc\u0644 \u0645\u06cc\u200c\u0634\u0648\u062f. \u0622\u06cc\u0627 \u0627\u062f\u0627\u0645\u0647 \u0645\u06cc\u200c\u062f\u0647\u06cc\u062f\u061f" : "\u0628\u0631\u0627\u06cc \u0631\u062f \u062f\u0631\u062e\u0648\u0627\u0633\u062a\u060c \u062f\u0644\u06cc\u0644 \u0631\u0627 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f. \u0627\u06cc\u0646 \u062f\u0644\u06cc\u0644 \u0628\u0647 \u0645\u062a\u0642\u0627\u0636\u06cc \u0646\u0645\u0627\u06cc\u0634 \u062f\u0627\u062f\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f."}</p>
        <strong>{items.find(item => item.id === decision.id)?.name}</strong>
        {decision.action === 'reject' && <div className="review-reason"><label htmlFor="review-reject-reason">{"\u062f\u0644\u06cc\u0644 \u0631\u062f \u062f\u0631\u062e\u0648\u0627\u0633\u062a"}</label><textarea id="review-reject-reason" value={reason} maxLength={500} onChange={event => setReason(event.target.value)} placeholder={"\u062f\u0644\u06cc\u0644 \u0631\u062f \u0631\u0627 \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f"} /></div>}
        {error && <p className="review-modal-error" role="alert">{error}</p>}
        <div className="review-modal-actions">
          <button type="button" disabled={!!busyId} onClick={() => { setDecision(null); setReason(''); setError(''); }}>{"\u0627\u0646\u0635\u0631\u0627\u0641"}</button>
          <button type="button" className={decision.action === 'approve' ? 'review-approve' : 'review-reject-confirm'} disabled={!!busyId || (decision.action === 'reject' && reason.trim().length < 3)} onClick={() => void decide(decision.id, decision.action)}>{busyId ? "\u062f\u0631 \u062d\u0627\u0644 \u062b\u0628\u062a..." : decision.action === 'approve' ? "\u062a\u0623\u06cc\u06cc\u062f \u0648 \u0627\u06cc\u062c\u0627\u062f \u0633\u0627\u0644\u0646" : "\u062a\u0623\u06cc\u06cc\u062f \u0631\u062f \u062f\u0631\u062e\u0648\u0627\u0633\u062a"}</button>
        </div>
      </div>
    </div>}
  </main>;
}
