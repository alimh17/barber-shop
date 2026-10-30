import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, UserRound } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { getApiErrorMessage } from '../auth/api';
import { useAuth } from '../auth/auth-context';
import { PersianDateInput } from '../components/PersianDateInput';
import { tehranDate } from '../features/management/api';
import {
  getProfile,
  updateProfile,
  type UserProfile,
} from '../features/profile/api';

const profileSchema = z.object({
  firstName: z.string().trim().min(2, 'نام باید حداقل ۲ نویسه باشد').max(100),
  lastName: z
    .string()
    .trim()
    .min(2, 'نام خانوادگی باید حداقل ۲ نویسه باشد')
    .max(100),
  birthDate: z.string().min(1, 'تاریخ تولد را وارد کنید'),
});

type ProfileForm = z.infer<typeof profileSchema>;

const toDefaults = (profile?: UserProfile): ProfileForm => ({
  firstName: profile?.firstName ?? '',
  lastName: profile?.lastName ?? '',
  birthDate: profile?.birthDate?.slice(0, 10) ?? '',
});

export function ProfilePage() {
  const { session, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = session!.user.id;
  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId),
  });
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: toDefaults(),
  });

  useEffect(() => {
    if (profile.data) form.reset(toDefaults(profile.data));
  }, [form, profile.data]);

  const mutation = useMutation({
    mutationFn: (values: ProfileForm) => updateProfile(userId, values),
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile', userId], updated);
      const fullName = [updated.firstName, updated.lastName]
        .filter(Boolean)
        .join(' ');
      updateUser({
        firstName: updated.firstName,
        lastName: updated.lastName,
        birthDate: updated.birthDate,
        fullName,
      });
      toast.success('اطلاعات پروفایل ذخیره شد');
      form.reset(toDefaults(updated));
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'ذخیره اطلاعات انجام نشد')),
  });

  const error = (key: keyof ProfileForm) => form.formState.errors[key]?.message;

  return (
    <div className="create-salon-page">
      <div className="page-title salon-form-title">
        <div>
          <h1>پروفایل من</h1>
          <p>اطلاعات شخصی خود را کامل و به‌روز نگه دارید.</p>
        </div>
        <span className="form-title-icon">
          <UserRound />
        </span>
      </div>

      {profile.isPending ? (
        <div className="data-state">
          <span className="spinner" />
          <p>در حال دریافت اطلاعات پروفایل…</p>
        </div>
      ) : null}
      {profile.isError ? (
        <div className="data-state error-state">
          <p>{getApiErrorMessage(profile.error, 'دریافت پروفایل انجام نشد')}</p>
          <button type="button" onClick={() => void profile.refetch()}>
            تلاش دوباره
          </button>
        </div>
      ) : null}

      {profile.data ? (
        <form
          className="salon-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <section>
            <div className="form-section-heading">
              <span>۱</span>
              <div>
                <h2>اطلاعات شخصی</h2>
                <p>
                  شماره موبایل از حساب ورود شما دریافت شده و قابل ویرایش نیست.
                </p>
              </div>
            </div>
            <div className="form-grid">
              <label
                className="form-field"
                data-invalid={Boolean(error('firstName'))}
              >
                <span>
                  نام <b>*</b>
                </span>
                <input autoFocus {...form.register('firstName')} />
                {error('firstName') ? (
                  <small>{error('firstName')}</small>
                ) : null}
              </label>
              <label
                className="form-field"
                data-invalid={Boolean(error('lastName'))}
              >
                <span>
                  نام خانوادگی <b>*</b>
                </span>
                <input {...form.register('lastName')} />
                {error('lastName') ? <small>{error('lastName')}</small> : null}
              </label>
              <label
                className="form-field"
                data-invalid={Boolean(error('birthDate'))}
              >
                <span>
                  تاریخ تولد <b>*</b>
                </span>
                <Controller
                  name="birthDate"
                  control={form.control}
                  render={({ field }) => (
                    <PersianDateInput
                      aria-label="تاریخ تولد شمسی"
                      value={field.value}
                      max={tehranDate()}
                      onChange={field.onChange}
                    />
                  )}
                />
                {error('birthDate') ? (
                  <small>{error('birthDate')}</small>
                ) : (
                  <small className="field-help">مثال: ۱۳۷۵/۰۲/۱۵</small>
                )}
              </label>
              <label className="form-field">
                <span>شماره موبایل</span>
                <input dir="ltr" value={profile.data.phone} disabled readOnly />
              </label>
            </div>
          </section>
          <footer className="form-actions">
            <button
              className="primary-button"
              disabled={mutation.isPending || !form.formState.isDirty}
            >
              <Save />
              {mutation.isPending ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
            </button>
          </footer>
        </form>
      ) : null}
    </div>
  );
}
