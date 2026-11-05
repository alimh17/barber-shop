import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
  const qrRef = useRef<HTMLDivElement>(null);
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

  function downloadQr() {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg || !salon) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'salon-qr-' + salon.slug + '.svg';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
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
        <div className="booking-link-qr-section">
          <h2>{'\u06a9\u062f QR \u0633\u0627\u0644\u0646'}</h2>
          <p>{'\u0645\u0634\u062a\u0631\u06cc\u0627\u0646 \u0628\u0627 \u0627\u0633\u06a9\u0646 \u0627\u06cc\u0646 \u06a9\u062f \u0645\u0633\u062a\u0642\u06cc\u0645\u0627\u064b \u0648\u0627\u0631\u062f \u0635\u0641\u062d\u0647 \u0633\u0627\u0644\u0646 \u0645\u06cc\u200c\u0634\u0648\u0646\u062f.'}</p>
          <div ref={qrRef} className="booking-link-qr" dir="ltr">
            <QRCodeSVG value={url} size={220} marginSize={2} level="H" bgColor="#ffffff" fgColor="#173f31" title={'QR ' + salon.name} />
          </div>
          <button className="booking-link-download" type="button" onClick={downloadQr}>{'\u062f\u0627\u0646\u0644\u0648\u062f \u06a9\u062f QR'}</button>
        </div>
        <p className="booking-link-note">این لینک مشتری را به صفحه ورود اختصاصی سالن هدایت می‌کند. برای ارسال به مشتریان خارج از شبکه، ابتدا باید سایت روی دامنه عمومی منتشر شده باشد.</p>
      </div>}
    </section>
  );
}
