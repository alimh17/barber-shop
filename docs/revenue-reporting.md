# گزارش درآمد سالن

پنل گزارش درآمد در مسیر `/reports/revenue` برای نقش‌های `ADMIN` و
`SUPER_ADMIN` در دسترس است. مدیر سالن فقط می‌تواند داده سالن‌هایی را ببیند که
عضویت فعال آن‌ها را دارد.

## تعریف درآمد

- فقط نوبت با وضعیت `COMPLETED` درآمد محسوب می‌شود.
- مبلغ از فیلد `Appointment.price` خوانده می‌شود؛ این مبلغ snapshot قیمت هنگام
  ثبت یا ویرایش نوبت است و تغییر بعدی قیمت خدمت روی تاریخچه اثر ندارد.
- بازه از ابتدای تاریخ `from` تا قبل از ابتدای تاریخ `to` و در منطقه زمانی سالن
  محاسبه می‌شود.
- طول بازه حداکثر ۳۷۰ روز است.

## API

- `GET /api/reports/revenue`: جمع درآمد، تعداد و میانگین نوبت‌ها، تفکیک بر اساس
  آرایشگر و ماه، و ریز درآمد صفحه‌بندی‌شده.
- `GET /api/reports/revenue/export`: فایل واقعی `.xlsx` با شیت‌های `خلاصه` و
  `ریز درآمد`.

هر دو مسیر پارامترهای `salonId`, `from`, `to` را می‌پذیرند. مسیر نمایش همچنین
`page` و `limit` دارد.

## کنترل و تطبیق

جمع درآمد آرایشگرها و جمع ردیف‌های ریز گزارش باید با درآمد کل یکسان باشد.
آرایشگرهای بدون درآمد نیز با مقدار صفر نمایش داده می‌شوند تا مدیر بتواند فهرست
تیم را کامل بررسی کند.

## Barber personal revenue chart

Authenticated BARBER users can open `/my-revenue` in the web app. The `GET /api/reports/my-revenue?period=day|week|month` endpoint resolves the barber from the JWT user ID, never from a client-provided barber ID. Only COMPLETED appointments count, using the appointment price snapshot. Buckets use the salon timezone: 24 hourly buckets for today, seven daily buckets including today for week, and thirty daily buckets including today for month. Zero-value buckets are included. The web page renders these with ApexCharts and displays total revenue and completed appointment count. The existing admin revenue report remains restricted to ADMIN/SUPER_ADMIN.
