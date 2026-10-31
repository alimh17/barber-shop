import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Building2, Check, Copy, ExternalLink, Link2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../auth/api';
import { getSalons } from '../features/salons/api';
import './salon-booking-link.css';

export function SalonBookingLinkPage() {
  const { data: salons = [], isPending, isError, error, refetch } = useQuery({
    queryKey: ['salons'],
    queryFn: getSalons,
  });
  const [selectedId, setSelectedId] = useState('');
  const [copied, setCopied] = useState(false);
  const salon = salons.find(item => item.id === selectedId) ?? salons[0];
  const url = salon ? new URL('/s/' + encodeURIComponent(salon.slug), window.location.origin).href : '';

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('لینک سالن کپی شد');
    } catch {
      toast.error('کپی لینک انجام نشد');
    }
  }

  async function shareLink() {
    if (!url || !salon) return;
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title: salon.name, text: 'رزرو نوبت در ' + salon.name, url });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error('اشتراک‌گذاری انجام نشد');
    }
  }

  return (
    <section className="booking-link-page" dir="rtl">
      <header className="booking-link-header">
        <div className="booking-link-icon"><Link2 size={25} /></div>
        <div><h1>لینک رزرو سالن</h1><p>لینک اختصاصی سالن را برای مشتریان ارسال کنید تا وارد سالن شوند و نوبت رزرو کنند.</p></div>
      </header>
      {isPending && <div className="booking-link-card" role="status">در حال دریافت اطلاعات سالن...</div>}
      {isError && <div className="booking-link-card" role="alert">
        <p>{getApiErrorMessage(error, 'دریافت اطلاعات سالن ناموفق بود.')}</p>
        <button type="button" onClick={() => void refetch()}>تلاش دوباره</button>
      </div>}
      {!isPending && !isError && !salon && <div className="booking-link-card">هیچ سالن فعالی برای حساب شما یافت نشد.</div>}
      {salon && <div className="booking-link-card">
        <div className="booking-link-salon"><Building2 size={23} /><div><strong>{salon.name}</strong><span>لینک اختصاصی مشتریان</span></div></div>
        {salons.length > 1 && <label className="booking-link-label" htmlFor="booking-link-salon">انتخاب سالن
          <select id="booking-link-salon" value={salon.id} onChange={event => { setSelectedId(event.target.value); setCopied(false); }}>
            {salons.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>}
        <label className="booking-link-label" htmlFor="booking-link-url">آدرس رزرو سالن</label>
        <input id="booking-link-url" className="booking-link-input" dir="ltr" value={url} readOnly onFocus={event => event.target.select()} />
        <div className="booking-link-actions">
          <button className="booking-link-primary" type="button" onClick={() => void copyLink()}>{copied ? <Check size={18}/> : <Copy size={18}/>} {copied ? 'کپی شد' : 'کپی لینک'}</button>
          <button type="button" onClick={() => void shareLink()}><Share2 size={18}/> اشتراک‌گذاری</button>
          <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={18}/> مشاهده لینک</a>
        </div>
        <p className="booking-link-note">این لینک مشتری را به صفحه ورود اختصاصی سالن هدایت می‌کند. برای ارسال به مشتریان خارج از شبکه، ابتدا باید سایت روی دامنه عمومی منتشر شده باشد.</p>
      </div>}
    </section>
  );
}
