# نمای سریع سیستم — Barbershop

> سند زنده معماری و مسیرهای اصلی. با تغییر کدهای مرتبط، این فایل نیز در همان تغییر به‌روزرسانی می‌شود (طبق `AGENTS.md`). آخرین بازبینی: 2026-10-29.

## ۰. کل سیستم در یک نگاه

```mermaid
flowchart TD
    ENTRY["ورود کاربر به پنل وب"] --> LOGIN["ورود با موبایل و OTP"]
    LOGIN --> PROFILE["تکمیل یا ویرایش پروفایل شخصی"]
    PROFILE --> ROLE{"نقش کاربر"}
    ROLE -->|SUPER_ADMIN| SUPER["مدیریت کل سالن‌ها و کاربران"]
    ROLE -->|ADMIN| ADMIN["مدیریت سالن‌های مجاز"]
    ROLE -->|BARBER| BARBER["مشاهده نوبت‌ها و برنامه کاری"]
    ROLE -->|CUSTOMER| CUSTOMER["انتخاب سالن و خدمت"]
    SUPER --> SETUP["ایجاد سالن و انتساب مدیر"]
    ADMIN --> SETUP2["تعریف آرایشگر، خدمات و برنامه کاری"]
    ADMIN --> REPORT["مشاهده درآمد سالن و خروجی Excel"]
    SETUP --> SETUP2
    SETUP2 --> AVAIL["محاسبه زمان‌های آزاد"]
    CUSTOMER --> AVAIL
    AVAIL --> REQUEST["درخواست رزرو"]
    REQUEST --> VALIDATE{"نقش، سالن، خدمت، برنامه و تداخل معتبرند؟"}
    VALIDATE -->|خیر| RETRY["خطا یا انتخاب زمان دیگر"]
    RETRY --> AVAIL
    VALIDATE -->|بله| DB["ثبت نوبت در PostgreSQL"]
    DB --> STATUS["مدیریت وضعیت نوبت"]
    ADMIN --> STATUS
    BARBER --> STATUS
    STATUS --> FINAL["تأیید، تکمیل، لغو یا عدم حضور"]
```

این نمودار نمای مفهومی نقش‌ها و مسیرهاست؛ دسترسی دقیق هر عملیات در سمت سرور تعیین می‌شود و همه مسیرهای نشان‌داده‌شده الزاماً در UI برای هر نقش در دسترس نیستند.

## ۱. معماری فنی

```mermaid
flowchart TB
    BROWSER["مرورگر / React + Vite PWA"] --> NGINX["Nginx: فایل‌های وب و /api"]
    BROWSER <--> SW["Service Worker: precache عمومی و Web Push"]
    NGINX --> API["NestJS REST API"]
    CONFIG["اعتبارسنجی startup: env و SMS provider"] --> API
    API --> AUTH["Auth / OTP / RBAC"]
    API --> TENANT["Salons / Users / Profiles / Memberships"]
    API --> CATALOG["Barbers / Services / Schedules"]
    API --> BOOKING["Availability / Appointments"]
    API --> REPORTS["Revenue Reports / Excel Export"]
    API --> NOTIFY["Push subscriptions / appointment notifications"]
    AUTH --> PRISMA["Prisma ORM"]
    TENANT --> PRISMA
    CATALOG --> PRISMA
    BOOKING --> PRISMA
    REPORTS --> PRISMA
    NOTIFY --> PRISMA
    PRISMA --> PG[("PostgreSQL")]
    AUTH --> REDIS[("Redis: rate limits")]
    AUTH --> SMSROUTE{"درخواست دارای salonSlug است؟"}
    SMSROUTE -->|بله| TENANTSMS["تنظیمات رمزگذاری‌شده کاوه‌نگار سالن"]
    SMSROUTE -->|خیر و فقط SUPER_ADMIN| SMSADAPTER["provider مرکزی پلتفرم"]
    TENANTSMS --> SMS["Kavenegar Verify Lookup"]
    SMSADAPTER -.-> SMS
    NOTIFY --> PUSH["Browser Push Service با VAPID"]
    PUSH --> SW
```

| جزء                 | وظیفه                                                 |
| ------------------- | ----------------------------------------------------- |
| React + Vite        | رابط کاربری و پنل                                     |
| Nginx               | ارائه وب و reverse proxy مسیر `/api`                  |
| NestJS              | اعتبارسنجی، مجوزها و منطق کسب‌وکار                    |
| Prisma + PostgreSQL | داده‌های پایدار کاربران، سالن‌ها، برنامه‌ها و نوبت‌ها |
| Redis               | داده‌های موقت و محدودسازی درخواست‌ها                  |
| SMS                 | ارسال OTP در صورت پیکربندی ارائه‌دهنده                |

API پیش از پذیرش ترافیک، تنظیمات SMS و کلید اصلی رمزگذاری را اعتبارسنجی
می‌کند. `mock` فقط در `development` و `test` مجاز است. هر سالن حساب کاوه‌نگار
خود را از پنل ادمین تنظیم می‌کند؛ API key با AES-256-GCM رمزگذاری می‌شود و در
پاسخ API برگردانده نمی‌شود. provider مرکزی فقط برای ورود `SUPER_ADMIN` بدون
لینک سالن و ورود اولیه ادمین فعال سالنی که هنوز credential ندارد استفاده
می‌شود؛ fallback ادمین پس از ثبت تنظیمات همان سالن دیگر انتخاب نمی‌شود.

## ۲. مسیر رزرو و کنترل هم‌زمانی

```mermaid
flowchart TD
    A["انتخاب سالن، آرایشگر، خدمت و زمان"] --> B["احراز هویت و اعتبارسنجی درخواست"]
    B --> C{"آرایشگر و خدمت متعلق به سالن و به هم منتسب‌اند؟"}
    C -->|خیر| E["خطای دسترسی / اعتبارسنجی"]
    C -->|بله| D["بررسی ساعات کاری، مرخصی و مدت خدمت"]
    D --> F{"زمان معتبر و بدون تداخل است؟"}
    F -->|خیر| G["انتخاب زمان دیگر"]
    F -->|بله| H["ایجاد نوبت با کنترل هم‌زمانی در دیتابیس"]
    H -->|تداخل هم‌زمان| G
    H -->|موفق| I["بازگرداندن نوبت ثبت‌شده"]
```

زمان نمایش‌داده‌شده تضمین رزرو نیست؛ هنگام ثبت، تداخل مجدداً بررسی می‌شود.

## ۳. ورود با OTP

```mermaid
flowchart TD
    PHONE["شماره موبایل + salonSlug لینک سالن"] --> LIMIT["کنترل نرخ درخواست"]
    LIMIT -->|محدود| ERROR["خطا"]
    LIMIT -->|مجاز| ROUTE{"سالن یا ورود مدیرکل؟"}
    ROUTE -->|سالن| TENANT["بازکردن امن credential همان سالن"]
    ROUTE -->|مدیرکل| PLATFORM["credential مرکزی"]
    TENANT --> CODE["تولید OTP با scope سالن"]
    PLATFORM --> CODE
    CODE --> SEND["ارسال از طریق ارائه‌دهنده تنظیم‌شده"]
    SEND -->|خطا| INVALIDATE["ابطال OTP تحویل‌نشده و پاسخ 503"]
    SEND -->|موفق| VERIFY["دریافت و بررسی کد"]
    VERIFY -->|نامعتبر / منقضی| ERROR
    VERIFY -->|معتبر| USER["یافتن یا ایجاد حساب و بررسی وضعیت"]
    USER -->|غیرمجاز| ERROR
    USER -->|مجاز| TOKEN["صدور نشست و توکن‌ها"]
```

### ۳.۱. تکمیل پروفایل شخصی

```mermaid
flowchart LR
    USER["کاربر واردشده با هر نقش"] --> PAGE["صفحه /profile"]
    PAGE --> READ["GET /api/users/:id برای شناسه خود کاربر"]
    READ --> FORM["نام، نام خانوادگی و تاریخ تولد شمسی"]
    FORM --> CONVERT["تبدیل تاریخ شمسی به YYYY-MM-DD"]
    CONVERT --> UPDATE["PATCH /api/users/:id"]
    UPDATE --> AUTHZ{"مالک پروفایل یا مدیر مجاز؟"}
    AUTHZ -->|خیر| DENY["403"]
    AUTHZ -->|بله| DB[("ذخیره پروفایل در User")]
    DB --> SESSION["به‌روزرسانی نام نمایشی نشست"]
```

تاریخ تولد در دیتابیس به‌صورت `DATE` ذخیره می‌شود و زمان یا منطقه زمانی ندارد.
فرانت‌اند آن را به تقویم شمسی نمایش می‌دهد، اما API مقدار استاندارد
`YYYY-MM-DD` دریافت می‌کند. کاربر عادی فقط پروفایل خودش را می‌خواند و ویرایش
می‌کند؛ قواعد دسترسی مدیران همان محدوده فعال سالن را اعمال می‌کند.

## ۴. وضعیت‌های نوبت

```mermaid
stateDiagram-v2
    [*] --> PENDING: ایجاد
    PENDING --> CONFIRMED: تایید
    PENDING --> CANCELLED: لغو
    CONFIRMED --> CANCELLED: لغو
    CONFIRMED --> COMPLETED: انجام خدمت
    CONFIRMED --> NO_SHOW: عدم حضور
```

این نمودار چرخه مفهومی است؛ انتقال‌های واقعی و نقش‌های مجاز باید با `src/appointments` تطبیق داده شوند.

## ۵. گزارش درآمد مدیر

```mermaid
flowchart LR
    ADMIN["ADMIN / SUPER_ADMIN"] --> SELECT["انتخاب سالن و بازه ماهانه یا سالانه"]
    SELECT --> ACCESS{"دسترسی فعال به سالن؟"}
    ACCESS -->|خیر| DENY["403"]
    ACCESS -->|بله| COMPLETED["نوبت‌های COMPLETED در منطقه زمانی سالن"]
    COMPLETED --> TOTAL["درآمد کل، میانگین و سهم هر آرایشگر"]
    COMPLETED --> DETAIL["ریز نوبت‌های درآمدزا"]
    TOTAL --> PANEL["نمایش در پنل"]
    DETAIL --> XLSX["خروجی XLSX: خلاصه و ریز درآمد"]
```

مبنای درآمد، مبلغ snapshot ذخیره‌شده روی نوبت تکمیل‌شده است؛ تغییر بعدی قیمت
خدمت، گزارش تاریخی را تغییر نمی‌دهد. نوبت‌های در انتظار، تأییدشده، لغوشده و
عدم مراجعه درآمد محسوب نمی‌شوند. مدیر عادی فقط گزارش سالن دارای عضویت فعال خود
را می‌بیند و مدیرکل می‌تواند سالن موردنظر را انتخاب کند.

## ۶. PWA و اعلان نوبت

```mermaid
sequenceDiagram
    participant U as کاربر
    participant PWA as پنل و Service Worker
    participant API as Notifications API
    participant DB as PostgreSQL
    participant PUSH as Push Service مرورگر
    U->>PWA: کلیک روی فعال‌کردن اعلان
    PWA->>PWA: درخواست مجوز و ساخت subscription
    PWA->>API: ثبت endpoint و کلیدهای عمومی subscription
    API->>DB: اتصال subscription به userId
    API->>PUSH: رویداد ثبت یا تغییر وضعیت نوبت با VAPID
    PUSH-->>PWA: push حتی در زمان بسته‌بودن پنل
    PWA-->>U: نمایش اعلان و بازکردن مسیر امن پنل
```

مجوز اعلان فقط با اقدام صریح کاربر درخواست می‌شود. کلید خصوصی VAPID در سرور
می‌ماند و endpoint منقضی‌شده حذف می‌شود. Service Worker پاسخ‌های `/api` را
precache نمی‌کند.

## ۷. نقشه کد و نگهداری سند

- `apps/web`: پنل وب
- `src/auth`, `src/otp`: ورود، نشست و SMS provider (راهنما: `docs/sms.md`)
- `src/salons`, `src/users`: مدیریت سالن و اعضا
- `src/barbers`, `src/services`, `src/barber-services`: آرایشگران و خدمات
- `src/schedules`, `src/availability`: برنامه کاری و زمان آزاد
- `src/appointments`: رزرو و وضعیت نوبت
- `src/reports`: گزارش درآمد سالن و ساخت فایل Excel
- `src/notifications`: subscriptionها و ارسال Web Push
- `prisma/schema.prisma`: مدل داده
- `docker-compose.yml`, `deploy/nginx`: زیرساخت استقرار

**قاعده نگهداری:** هر تغییر در نقش‌ها، API، فرایند رزرو، OTP، ساختار داده یا استقرار باید هم‌زمان در نمودار مرتبط و توضیحات این فایل بازتاب یابد. این کار با دستورالعمل `AGENTS.md` به فرایند توسعه اضافه شده و به‌صورت خودکار در پس‌زمینه اجرا نمی‌شود.
