import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Check, Scissors, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuth } from '../auth/auth-context'
import { getApiErrorMessage } from '../auth/api'
const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
function normalizePhone(value: string) {
  let phone = value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[^\d+]/g, '')
  if (phone.startsWith('+98')) phone = `0${phone.slice(3)}`
  else if (phone.startsWith('0098')) phone = `0${phone.slice(4)}`
  else if (phone.startsWith('98')) phone = `0${phone.slice(2)}`
  else if (phone.startsWith('9')) phone = `0${phone}`
  return phone
}
const phoneSchema = z.object({ phone: z.string().transform(normalizePhone).pipe(z.string().regex(/^09\d{9}$/, 'یک شماره موبایل معتبر وارد کنید')) })
const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'کد ورود باید ۶ رقم باشد') })
type PhoneForm = z.infer<typeof phoneSchema>; type OtpForm = z.infer<typeof otpSchema>
export function LoginPage() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone'); const [phone, setPhone] = useState(''); const [seconds, setSeconds] = useState(0); const [developmentOtp, setDevelopmentOtp] = useState<string>(); const { session, sendOtp, signIn } = useAuth(); const navigate = useNavigate(); const location = useLocation()
  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema), defaultValues: { phone: '' } }); const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema), defaultValues: { code: '' } })
  useEffect(() => { if (seconds <= 0) return; const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000); return () => window.clearInterval(timer) }, [seconds])
  if (session) return <Navigate to="/dashboard" replace />
  const submitPhone = phoneForm.handleSubmit(async ({ phone: value }) => { try { const result = await sendOtp(value); setPhone(value); setSeconds(result.expiresIn); setDevelopmentOtp(result.developmentOtp); setStep('otp'); toast.success('کد ورود ارسال شد') } catch (error) { toast.error(getApiErrorMessage(error, 'ارسال کد انجام نشد؛ دوباره تلاش کنید')) } })
  const submitOtp = otpForm.handleSubmit(async ({ code }) => { try { await signIn(phone, code); const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname; navigate(from ?? '/dashboard', { replace: true }) } catch (error) { otpForm.setError('code', { message: getApiErrorMessage(error, 'کد واردشده صحیح نیست') }) } })
  return <main className="login-page"><section className="login-intro"><div className="brand"><span><Scissors size={22} /></span><strong>قیچی</strong></div><div className="intro-copy"><h1>مدیریت حرفه‌ای،<br /><em>تجربه‌ای بی‌نقص.</em></h1><p>نوبت‌ها، تیم و مشتریان آرایشگاهت را از یک جای ساده و سریع مدیریت کن.</p></div><div className="trust-note"><ShieldCheck size={20} /><span>ورود امن و بدون نیاز به رمز عبور</span></div></section><section className="login-panel"><div className="login-card"><div className="stepper"><span className="active"><Check size={13} /></span><i /><span className={step === 'otp' ? 'active' : ''}>۲</span></div>{step === 'phone' ? <form onSubmit={submitPhone}><div className="form-heading"><h2>خوش آمدید</h2><p>برای ورود، شماره موبایل خود را وارد کنید.</p></div><label htmlFor="phone">شماره موبایل</label><div className="phone-field" dir="ltr"><span>ایران</span><input id="phone" inputMode="tel" autoComplete="tel" placeholder="0912 123 4567" {...phoneForm.register('phone')} /></div>{phoneForm.formState.errors.phone ? <small className="error">{phoneForm.formState.errors.phone.message}</small> : null}<button className="primary-button" disabled={phoneForm.formState.isSubmitting}>ادامه <ArrowLeft size={18} /></button></form> : <form onSubmit={submitOtp}><button type="button" className="back-link" onClick={() => setStep('phone')}>ویرایش شماره</button><div className="form-heading"><h2>کد تأیید</h2><p>کد ارسال‌شده به <b dir="ltr">{phone}</b> را وارد کنید.</p></div><label htmlFor="code">کد ۶ رقمی</label><input className="otp-field" id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus placeholder="• • • • • •" {...otpForm.register('code')} />{otpForm.formState.errors.code ? <small className="error">{otpForm.formState.errors.code.message}</small> : null}{developmentOtp ? <p className="demo-hint">کد محیط توسعه: <b dir="ltr">{developmentOtp}</b></p> : null}<button className="primary-button" disabled={otpForm.formState.isSubmitting}>ورود به پنل <ArrowLeft size={18} /></button><button type="button" className="resend" disabled={seconds > 0} onClick={() => { void sendOtp(phone).then(({ expiresIn }) => setSeconds(expiresIn)) }}>{seconds > 0 ? `ارسال مجدد تا ${seconds} ثانیه` : 'ارسال مجدد کد'}</button></form>}<p className="terms">با ورود، <a href="#">قوانین استفاده</a> و <a href="#">حریم خصوصی</a> را می‌پذیرید.</p></div></section></main>
}


