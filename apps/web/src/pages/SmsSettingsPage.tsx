import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../auth/api';
import {
  disableSalonSmsConfig,
  getSalons,
  getSalonSmsConfig,
  updateSalonSmsConfig,
} from '../features/salons/api';

export function SmsSettingsPage() {
  const queryClient = useQueryClient();
  const salons = useQuery({ queryKey: ['salons'], queryFn: getSalons });
  const [salonId, setSalonId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [template, setTemplate] = useState('');
  const selectedId = salonId || salons.data?.[0]?.id || '';
  const config = useQuery({
    queryKey: ['salon-sms-config', selectedId],
    queryFn: () => getSalonSmsConfig(selectedId),
    enabled: Boolean(selectedId),
  });
  const save = useMutation({
    mutationFn: () =>
      updateSalonSmsConfig(selectedId, {
        apiKey: apiKey.trim(),
        verifyTemplate: template.trim(),
        isActive: true,
      }),
    onSuccess: async () => {
      setApiKey('');
      await queryClient.invalidateQueries({
        queryKey: ['salon-sms-config', selectedId],
      });
      toast.success('تنظیمات پیامک سالن ذخیره شد');
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'ذخیره تنظیمات پیامک انجام نشد')),
  });
  const disable = useMutation({
    mutationFn: () => disableSalonSmsConfig(selectedId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['salon-sms-config', selectedId],
      });
      toast.success('ارسال پیامک این سالن غیرفعال شد');
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'غیرفعال‌سازی انجام نشد')),
  });

  return (
    <div className="create-salon-page">
      <div className="page-title salon-form-title">
        <div>
          <h1>تنظیمات پیامک سالن</h1>
          <p>هزینه و مدیریت حساب کاوه‌نگار این سالن بر عهده مدیر سالن است.</p>
        </div>
        <span className="form-title-icon">
          <KeyRound />
        </span>
      </div>
      <form
        className="salon-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !selectedId ||
            apiKey.trim().length < 8 ||
            !/^[a-zA-Z0-9_-]+$/.test(template.trim())
          ) {
            toast.error('کلید API و نام الگوی معتبر را وارد کنید');
            return;
          }
          save.mutate();
        }}
      >
        <section>
          <div className="form-section-heading">
            <span>۱</span>
            <div>
              <h2>انتخاب سالن</h2>
              <p>تنظیمات فقط روی سالن انتخاب‌شده اعمال می‌شود.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="form-field full-width">
              <span>سالن</span>
              <select
                value={selectedId}
                onChange={(event) => {
                  setSalonId(event.target.value);
                  setApiKey('');
                  setTemplate('');
                }}
              >
                {salons.data?.map((salon) => (
                  <option key={salon.id} value={salon.id}>
                    {salon.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section>
          <div className="form-section-heading">
            <span>۲</span>
            <div>
              <h2>حساب کاوه‌نگار</h2>
              <p>
                کلید API رمزگذاری می‌شود و پس از ذخیره دوباره نمایش داده نخواهد
                شد.
              </p>
            </div>
          </div>
          {config.data?.configured ? (
            <p className="inline-note">
              <ShieldCheck size={16} /> حساب فعلی با انتهای کلید{' '}
              {config.data.apiKeyLast4} —{' '}
              {config.data.isActive ? 'فعال' : 'غیرفعال'}
            </p>
          ) : null}
          <div className="form-grid">
            <label className="form-field">
              <span>API Key جدید</span>
              <input
                dir="ltr"
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>نام Verify Template</span>
              <input
                dir="ltr"
                placeholder={config.data?.verifyTemplate ?? 'verify'}
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
              />
            </label>
          </div>
        </section>
        <footer className="form-actions">
          {config.data?.configured && config.data.isActive ? (
            <button
              type="button"
              className="mgmt-secondary-link"
              disabled={disable.isPending}
              onClick={() => disable.mutate()}
            >
              غیرفعال‌کردن
            </button>
          ) : (
            <span />
          )}
          <button
            className="primary-button"
            disabled={save.isPending || !selectedId}
          >
            <Save />
            {save.isPending ? 'در حال ذخیره…' : 'ذخیره امن'}
          </button>
        </footer>
      </form>
    </div>
  );
}
