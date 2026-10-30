# PWA و Web Push

پنل وب به‌صورت Progressive Web App ساخته می‌شود و پس از Build شامل manifest،
Service Worker و assetهای لازم برای نصب است. Service Worker فقط فایل‌های عمومی
رابط کاربری را precache می‌کند؛ پاسخ‌های `/api` و داده‌های احراز‌شده در cache
آفلاین قرار نمی‌گیرند.

## فعال‌سازی Web Push

یک جفت کلید VAPID پایدار تولید کنید:

```bash
pnpm exec web-push generate-vapid-keys --json
```

سپس `VAPID_SUBJECT`، `VAPID_PUBLIC_KEY` و `VAPID_PRIVATE_KEY` را در محیط سرور
قرار دهید. کلید خصوصی فقط در API استفاده می‌شود. کلید عمومی از مسیر
`GET /api/notifications/configuration` به کاربر واردشده برگردانده می‌شود. کلیدها
را پس از ثبت subscription کاربران عوض نکنید.

## جریان کار

1. کاربر از صفحه «اعلان‌ها» و با کلیک صریح، مجوز مرورگر را درخواست می‌کند.
2. مرورگر با Service Worker و کلید عمومی VAPID یک subscription می‌سازد.
3. API endpoint و کلیدهای رمزنگاری subscription را به حساب همان کاربر متصل
   می‌کند.
4. هنگام ثبت نوبت یا تغییر وضعیت آن، API به مشتری، آرایشگر و مدیران فعال سالن
   اعلان می‌فرستد.
5. endpointهای منقضی‌شده با پاسخ `404` یا `410` از دیتابیس حذف می‌شوند.

Web Push در محیط واقعی به HTTPS نیاز دارد. `localhost` برای توسعه یک secure
context است. Nginx فایل `sw.js` را با `no-cache` ارائه می‌کند تا نسخه جدید PWA
سریع فعال شود.
