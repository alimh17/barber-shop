import { useQuery } from '@tanstack/react-query';
import { Bell, BellOff, ShieldCheck, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { getApiErrorMessage } from '../auth/api';
import {
  getPushConfiguration,
  removePushSubscription,
  savePushSubscription,
  urlBase64ToUint8Array,
} from '../features/notifications/api';

const supported = () =>
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export function NotificationSettingsPage() {
  const configuration = useQuery({
    queryKey: ['push-configuration'],
    queryFn: getPushConfiguration,
  });
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported()) return;
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(setSubscription);
  }, []);

  const enable = async () => {
    if (!supported() || !configuration.data?.publicKey || busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('مجوز اعلان از طرف مرورگر داده نشد');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const current =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            configuration.data.publicKey,
          ),
        }));
      await savePushSubscription(current);
      setSubscription(current);
      toast.success('اعلان‌های این دستگاه فعال شد');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'فعال‌سازی اعلان انجام نشد'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!subscription || busy) return;
    setBusy(true);
    try {
      await removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
      setSubscription(null);
      toast.success('اعلان‌های این دستگاه غیرفعال شد');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'غیرفعال‌سازی اعلان انجام نشد'));
    } finally {
      setBusy(false);
    }
  };

  const browserSupported = supported();
  const configured = configuration.data?.configured ?? false;

  return (
    <div className="create-salon-page">
      <div className="page-title salon-form-title">
        <div>
          <h1>اعلان‌های دستگاه</h1>
          <p>تغییر وضعیت نوبت‌ها را حتی وقتی پنل باز نیست دریافت کنید.</p>
        </div>
        <span className="form-title-icon">
          <Bell />
        </span>
      </div>
      <section className="notification-settings-card">
        <div className="notification-device-icon">
          <Smartphone />
        </div>
        <div>
          <h2>Web Push</h2>
          <p>
            مجوز فقط برای همین مرورگر و همین دستگاه ثبت می‌شود. هر زمان بخواهید
            می‌توانید آن را غیرفعال کنید.
          </p>
          {!browserSupported ? (
            <small>مرورگر فعلی از Web Push پشتیبانی نمی‌کند.</small>
          ) : null}
          {browserSupported && !configured && !configuration.isPending ? (
            <small>کلیدهای VAPID هنوز روی سرور تنظیم نشده‌اند.</small>
          ) : null}
          {subscription ? (
            <span className="notification-enabled">
              <ShieldCheck /> اعلان فعال است
            </span>
          ) : null}
        </div>
        {subscription ? (
          <button
            className="mgmt-secondary-link"
            type="button"
            disabled={busy}
            onClick={() => void disable()}
          >
            <BellOff /> غیرفعال‌کردن
          </button>
        ) : (
          <button
            className="mgmt-primary-link"
            type="button"
            disabled={busy || !browserSupported || !configured}
            onClick={() => void enable()}
          >
            <Bell /> فعال‌کردن اعلان
          </button>
        )}
      </section>
      <p className="inline-note">
        برای دریافت اعلان در محیط واقعی، سایت باید با HTTPS باز شود. localhost
        در توسعه مجاز است.
      </p>
    </div>
  );
}
