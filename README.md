# سامانه مدیریت و رزرو آرایشگاه

سامانه مدیریت آرایشگاه با API مبتنی بر **NestJS**، پنل وب **React + Vite**، پایگاه داده **PostgreSQL** و **Redis**. پروژه از pnpm workspace و Docker Compose برای توسعه و استقرار استفاده می‌کند.

## معماری سیستم

برای درک سریع ارتباط اجزا و جریان‌های اصلی، از نمودار معماری شروع کنید:

- [معماری و جریان سیستم](docs/system-flow.md)
- [فهرست مستندات API و ماژول‌ها](docs/README.md)
- [راهنمای استقرار Production](deploy/README.md)

## اجزای اصلی

- `src/`: بک‌اند NestJS REST API.
- `apps/web/`: پنل وب React + Vite.
- `prisma/`: مدل داده و migrationهای PostgreSQL.
- `docs/`: مستندات ماژول‌ها، مدل داده و جریان‌های سیستم.
- `deploy/nginx/`: پیکربندی Nginx.
- `docker-compose.yml` و `Dockerfile`: اجرای سرویس‌ها در Docker.

## نیازمندی‌ها

- Node.js 22 یا نسخه سازگار با پروژه
- pnpm (نسخه مشخص‌شده در تنظیمات workspace)
- Docker و Docker Compose برای اجرای سرویس‌های وابسته

## راه‌اندازی توسعه

ابتدا وابستگی‌ها را نصب کنید:

```bash
pnpm install
```

متغیرهای محیطی را بر اساس `.env.example` تنظیم کنید. برای توسعه محلی، آدرس‌های PostgreSQL و Redis باید به سرویس‌هایی اشاره کنند که از محیط توسعه قابل دسترسی‌اند. هرگز فایل `.env` یا کلیدها و رمزهای واقعی را commit نکنید.

اسکریپت‌های موجود را در `package.json` بررسی کنید. اجرای هم‌زمان API و پنل وب، در صورت پشتیبانی توسط نسخه فعلی workspace:

```bash
pnpm dev:all
```

ساخت هر دو برنامه:

```bash
pnpm build:all
```

## تست و کیفیت کد

اسکریپت‌های موجود را در `package.json` مبنا قرار دهید. فرمان‌های متداول پروژه:

```bash
pnpm lint:all
pnpm test
pnpm test:e2e
```

پیش از ادغام تغییرات، تست‌ها و build را در محیط محلی یا CI اجرا کنید و نتیجه را بررسی کنید.

## استقرار

راهنمای گام‌به‌گام استقرار، متغیرهای Production، Docker Compose، migrationها و تنظیم Nginx در [deploy/README.md](deploy/README.md) قرار دارد.

**امنیت:** برای محیط Production از HTTPS، رمزهای قوی و منحصربه‌فرد، تنظیم واقعی سرویس پیامک و محدودیت دسترسی مناسب استفاده کنید. دسترسی با IP و HTTP فقط برای توسعه یا آزمایش محدود مناسب است.
