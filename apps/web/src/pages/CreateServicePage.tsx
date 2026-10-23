import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Clock3, Save, Scissors } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { getApiErrorMessage } from '../auth/api'
import { getSalons } from '../features/salons/api'
import { createService } from '../features/services/api'

const schema = z.object({ salonId: z.string().min(1, 'یک سالن انتخاب کنید'), name: z.string().trim().min(2, 'نام خدمت حداقل باید ۲ نویسه باشد'), description: z.string().trim().optional().transform(v => v || undefined), duration: z.coerce.number().int('مدت باید عدد صحیح باشد').positive('مدت باید بیشتر از صفر باشد'), price: z.coerce.number().min(0, 'قیمت نمی‌تواند منفی باشد') })
type Values = z.input<typeof schema>

export function CreateServicePage() {
  const navigate = useNavigate(); const queryClient = useQueryClient(); const salons = useQuery({ queryKey: ['salons'], queryFn: getSalons })
  const form = useForm<Values, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { salonId: '', name: '', description: '', duration: 30, price: 0 } })
  const mutation = useMutation({ mutationFn: createService, onSuccess: async (service) => { await queryClient.invalidateQueries({ queryKey: ['services'] }); toast.success(`خدمت «${service.name}» ایجاد شد`); navigate('/dashboard') }, onError: error => toast.error(getApiErrorMessage(error, 'ایجاد خدمت انجام نشد. دسترسی سالن را بررسی کنید.')) })
  const error = (key: keyof Values) => form.formState.errors[key]?.message
  return <div className="create-salon-page"><div className="page-title salon-form-title"><div><Link to="/dashboard" className="back-link-inline"><ArrowRight/> بازگشت به داشبورد</Link><h1>ایجاد خدمت جدید</h1><p>مدت و قیمت خدمت را برای یکی از سالن‌ها تعریف کنید.</p></div><span className="form-title-icon"><Scissors/></span></div><form className="salon-form" onSubmit={form.handleSubmit(values => mutation.mutate(values))}><section><div className="form-section-heading"><span>۱</span><div><h2>اطلاعات خدمت</h2><p>مشخصات قابل نمایش در فرآیند نوبت‌گیری.</p></div></div><div className="form-grid"><label className="form-field full-width" data-invalid={Boolean(error('salonId'))}><span>سالن <b>*</b></span><select aria-invalid={Boolean(error('salonId'))} {...form.register('salonId')}><option value="">انتخاب سالن</option>{salons.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{error('salonId') ? <small>{error('salonId')}</small> : null}</label><label className="form-field full-width" data-invalid={Boolean(error('name'))}><span>نام خدمت <b>*</b></span><input autoFocus placeholder="مثلاً اصلاح مو و ریش" {...form.register('name')}/>{error('name') ? <small>{error('name')}</small> : null}</label><label className="form-field" data-invalid={Boolean(error('duration'))}><span>مدت خدمت (دقیقه) <b>*</b></span><div className="input-with-icon"><Clock3/><input type="number" min="1" {...form.register('duration')}/></div>{error('duration') ? <small>{error('duration')}</small> : null}</label><label className="form-field" data-invalid={Boolean(error('price'))}><span>قیمت (تومان) <b>*</b></span><input type="number" min="0" step="1000" {...form.register('price')}/>{error('price') ? <small>{error('price')}</small> : null}</label><label className="form-field full-width"><span>توضیحات</span><textarea rows={4} placeholder="توضیح کوتاهی درباره جزئیات خدمت…" {...form.register('description')}/></label></div></section>{salons.isError ? <p className="form-api-error">دریافت سالن‌ها انجام نشد. صفحه را دوباره بارگذاری کنید.</p> : null}<footer className="form-actions"><Link to="/dashboard">انصراف</Link><button className="primary-button" disabled={mutation.isPending || salons.isPending}><Save/>{mutation.isPending ? 'در حال ثبت…' : 'ایجاد خدمت'}</button></footer></form></div>
}
