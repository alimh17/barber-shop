import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Building2, Check, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { getApiErrorMessage } from '../auth/api'
import { createSalon } from '../features/salons/api'

const optionalText = z.string().trim().optional().transform((value) => value || undefined)
const schema = z.object({
  name: z.string().trim().min(2, 'نام سالن حداقل باید ۲ نویسه باشد'),
  slug: z.string().trim().min(2, 'شناسه انگلیسی را وارد کنید').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'فقط حروف کوچک انگلیسی، عدد و خط تیره مجاز است'),
  phone: optionalText,
  address: optionalText,
  description: optionalText,
  timezone: z.string().trim().min(1, 'منطقه زمانی را انتخاب کنید'),
  isActive: z.boolean(),
})
type FormValues = z.input<typeof schema>

export function CreateSalonPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const form = useForm<FormValues, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: '', slug: '', phone: '', address: '', description: '', timezone: 'Asia/Tehran', isActive: true } })
  const mutation = useMutation({
    mutationFn: createSalon,
    onSuccess: async (salon) => {
      await queryClient.invalidateQueries({ queryKey: ['salons'] })
      toast.success(`سالن «${salon.name}» ایجاد شد`)
      navigate('/dashboard')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'ایجاد سالن انجام نشد. دوباره تلاش کنید.')),
  })
  const fieldError = (name: keyof FormValues) => form.formState.errors[name]?.message

  return <div className="create-salon-page">
    <div className="page-title salon-form-title"><div><Link to="/dashboard" className="back-link-inline"><ArrowRight/> بازگشت به داشبورد</Link><h1>ایجاد سالن جدید</h1><p>اطلاعات پایه سالن را ثبت کنید؛ جزئیات تیم و خدمات بعداً قابل تکمیل است.</p></div><span className="form-title-icon"><Building2/></span></div>
    <form className="salon-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      <section><div className="form-section-heading"><span>۱</span><div><h2>مشخصات اصلی</h2><p>نام و شناسه‌ای که در سامانه نمایش داده می‌شود.</p></div></div><div className="form-grid">
        <label className="form-field" data-invalid={Boolean(fieldError('name'))}><span>نام سالن <b>*</b></span><input autoFocus aria-invalid={Boolean(fieldError('name'))} placeholder="مثلاً سالن قیچی طلایی" {...form.register('name')}/>{fieldError('name') ? <small>{fieldError('name')}</small> : null}</label>
        <label className="form-field" data-invalid={Boolean(fieldError('slug'))}><span>شناسه انگلیسی <b>*</b></span><input dir="ltr" aria-invalid={Boolean(fieldError('slug'))} placeholder="golden-scissors" {...form.register('slug')}/>{fieldError('slug') ? <small>{fieldError('slug')}</small> : <small className="field-help">در آدرس‌های عمومی و اتصال‌های آینده استفاده می‌شود.</small>}</label>
        <label className="form-field"><span>شماره تماس</span><input dir="ltr" inputMode="tel" placeholder="021 1234 5678" {...form.register('phone')}/></label>
        <label className="form-field"><span>منطقه زمانی</span><select {...form.register('timezone')}><option value="Asia/Tehran">تهران — Asia/Tehran</option></select></label>
      </div></section>
      <section><div className="form-section-heading"><span>۲</span><div><h2>اطلاعات تکمیلی</h2><p>برای معرفی دقیق‌تر سالن به مشتریان.</p></div></div><div className="form-grid">
        <label className="form-field full-width"><span>آدرس</span><input placeholder="استان، شهر، خیابان و پلاک" {...form.register('address')}/></label>
        <label className="form-field full-width"><span>توضیحات</span><textarea rows={4} placeholder="توضیح کوتاهی درباره سالن، تخصص‌ها یا امکانات…" {...form.register('description')}/></label>
      </div></section>
      <section className="activation-row"><div><span className="activation-icon"><Check/></span><div><strong>فعال‌سازی سالن</strong><p>سالن بلافاصله در فهرست سالن‌های قابل انتخاب نمایش داده شود.</p></div></div><label className="switch"><input type="checkbox" {...form.register('isActive')}/><span/></label></section>
      <footer className="form-actions"><Link to="/dashboard">انصراف</Link><button className="primary-button" disabled={mutation.isPending}><Save/>{mutation.isPending ? 'در حال ثبت…' : 'ایجاد سالن'}</button></footer>
    </form>
  </div>
}
