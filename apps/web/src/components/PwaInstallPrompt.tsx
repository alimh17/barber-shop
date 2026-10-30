import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!installEvent) return null;
  const install = async () => {
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <aside className="pwa-install-prompt">
      <Download />
      <div>
        <strong>نصب اپ قیچی</strong>
        <span>دسترسی سریع‌تر و اجرای مستقل از مرورگر</span>
      </div>
      <button type="button" onClick={() => void install()}>
        نصب
      </button>
      <button
        className="pwa-install-close"
        type="button"
        aria-label="بستن پیشنهاد نصب"
        onClick={() => setInstallEvent(null)}
      >
        <X />
      </button>
    </aside>
  );
}
