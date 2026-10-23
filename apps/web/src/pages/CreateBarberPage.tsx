import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Save, UserRoundPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { getApiErrorMessage } from '../auth/api'
import { createBarber, getSalons } from '../features/salons/api'

const normalizePhone = (value: string) => value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\s/g, '')
const schema = z.object({ salonId: z.string().min(1, 'یک سالن انتخاب کنید'), phone: z.string().transform(normalizePhone).pipe(z.string().regex(/^09\d{9}$/, 'شماره موبایل معتبر وارد کنید')), firstName: z.string().trim().optional().transform(v => v || undefined), lastName: z.string().trim().optional().transform(v => v || undefined) })
type Values = z.input<typeof schema>

export function CreateBarberPage() {
  const navigate = useNavigate(); const queryClient = useQueryClient(); const salons = useQuery({ queryKey: ['salons'], queryFn: getSalons })
  const form = useForm<Values, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { salonId: '', phone: '', firstName: '', lastName: '' } })
  const mutation = useMutation({ mutationFn: createBarber, onSuccess: async barber => { await queryClient.invalidateQueries({ queryKey: ['barbers'] }); const name = [barber.user.firstName, barber.user.lastName].filter(Boolean).join(' ') || barber.user.phone; toast.success(`آرایشگر «${name}» ایجاد شد`); navigate('/dashboard') }, onError: error => toast.error(getApiErrorMessage(error, 'ایجاد آرایشگر انجام نشد. شماره موبایل یا دسترسی سالن را بررسی کنید.')) })
  const error = (key: keyof Values) => form.formState.errors[key]?.message
  return <div className="create-salon-page"><div className="page-title salon-form-title"><div><Link to="/dashboard" className="back-link-inline"><ArrowRight/> بازگشت به داشبورد</Link><h1>ایجاد آرایشگر جدید</h1><p>حساب آرایشگر را بسازید و به یک سالن متصل کنید.</p></div><span className="form-title-icon"><UserRoundPlus/></span></div><form className="salon-form" onSubmit={form.handleSubmit(values => mutation.mutate(values))}><section><div className="form-section-heading"><span>۱</span><div><h2>اطلاعات آرایشگر</h2><p>شماره موبایل باید قبلاً در سامانه استفاده نشده باشد.</p></div></div><div className="form-grid"><label className="form-field full-width" data-invalid={Boolean(error('salonId'))}><span>سالن <b>*</b></span><select {...form.register('salonId')}><option value="">انتخاب سالن</option>{salons.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{error('salonId') ? <small>{error('salonId')}</small> : null}</label><label className="form-field"><span>نام</span><input autoFocus placeholder="نام آرایشگر" {...form.register('firstName')}/></label><label className="form-field"><span>نام خانوادگی</span><input placeholder="نام خانوادگی" {...form.register('lastName')}/></label><label className="form-field full-width" data-invalid={Boolean(error('phone'))}><span>شماره موبایل <b>*</b></span><input dir="ltr" inputMode="tel" placeholder="0912 123 4567" {...form.register('phone')}/>{error('phone') ? <small>{error('phone')}</small> : <small className="field-help">این شماره به حساب کاربری آرایشگر تبدیل می‌شود.</small>}</label></div></section>{salons.isError ? <p className="form-api-error">دریافت سالن‌ها انجام نشد. صفحه را دوباره بارگذاری کنید.</p> : null}<footer className="form-actions"><Link to="/dashboard">انصراف</Link><button className="primary-button" disabled={mutation.isPending || salons.isPending}><Save/>{mutation.isPending ? 'در حال ثبت…' : 'ایجاد آرایشگر'}</button></footer></form></div>
}
