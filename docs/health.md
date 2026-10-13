# ماژول سلامت (Health Module)

## معرفی

ماژول سلامت وظیفه پایش وضعیت عملکردی سامانه و راستی‌آزمایی برقراری ارتباط زنده با پایگاه‌داده PostgreSQL را بر عهده دارد.

این ماژول به عنوان اندپوینت تشخیصی زیرساختی (Infrastructure Diagnostic Endpoint) طراحی شده است و نقش کلیدی در ابزارهای نگهداری، ارکستراسیون کانتینرها، لودبالانسرها و سرویس‌های مانیتورینگ ایفا می‌کند:
* بررسی سلامت برنامه توسط **Docker Healthcheck** و **Kubernetes Liveness / Readiness Probes**.
* اطمینان از سلامت سرویس قبل از هدایت ترافیک کاربران توسط **Load Balancerها** و **Reverse Proxyها** (نظیر Nginx یا Traefik).
* دریافت هشدارهای بلادرنگ (Real-time Alerts) توسط سیستم‌های مانیتورینگ آپتایم (مانند Uptime Kuma یا Prometheus).

---

## ساختار و وابستگی‌های ماژول

ماژول در مسیر [`src/health/health.module.ts`](file:///c:/Users/amoha/Documents/barbershop-api/src/health/health.module.ts) تعریف شده است:

```typescript
import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
```

### نمودار جریان پایش سلامت

```mermaid
graph LR
    Monitor["Monitoring / Docker / Load Balancer"] -->|GET /api/health| HealthController["HealthController"]
    HealthController --> HealthService["HealthService"]
    HealthService -->|SELECT 1| PrismaService["PrismaService"]
    PrismaService --> PostgreSQL[("PostgreSQL Database")]
    PostgreSQL -->> HealthService: Query Success
    HealthService -->> Monitor: 200 OK { status: 'ok', database: 'connected', ... }
```

* **وابستگی به پایگاه‌داده**: این ماژول فاقد جدول یا مدل اختصاصی در دیتابیس است؛ اما سرویس [`HealthService`](file:///c:/Users/amoha/Documents/barbershop-api/src/health/health.service.ts) به [`PrismaService`](file:///c:/Users/amoha/Documents/barbershop-api/src/prisma/prisma.service.ts) سراسری وابسته بوده و با اجرای یک کوئری حداقلی، سلامت کانکشن‌پول دیتابیس را ارزیابی می‌کند.

---

## اندپوینت سلامت (Health Check Endpoint)

کنترلر [`HealthController`](file:///c:/Users/amoha/Documents/barbershop-api/src/health/health.controller.ts) در مسیر `src/health/health.controller.ts` قرار دارد:

```typescript
import { Controller, Get } from '@nestjs/common';

import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.check();
  }
}
```

با توجه به پیشوند سراسری برنامه (`app.setGlobalPrefix('api')`)، آدرس دسترسی به این اندپوینت `/api/health` خواهد بود.

### جدول مشخصات اندپوینت:

| مشخصه | مقدار |
| :--- | :--- |
| **متد HTTP** | `GET` |
| **مسیر (URL)** | `/api/health` |
| **احراز هویت** | ندارد (عمومی / Public) |
| **گاردها** | فاقد هرگونه گارد محدودکننده یا احراز هویت |
| **هدف** | تایید آماده‌به‌کار بودن سرور API و اتصال به دیتابیس PostgreSQL |

---

## سرویس سلامت ([`HealthService`](file:///c:/Users/amoha/Documents/barbershop-api/src/health/health.service.ts))

سرویس سلامت در مسیر [`src/health/health.service.ts`](file:///c:/Users/amoha/Documents/barbershop-api/src/health/health.service.ts) پیاده‌سازی شده است:

```typescript
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
```

### منطق اعتبارسنجی:
1. اجرای کوئری خام `SELECT 1` در پایگاه‌داده: این کوئری فوق‌العاده سبک، پایداری سوکت اتصال، تایید هویت کاربر دیتابیس و پردازشگر موتور PostgreSQL را بدون ایجاد بار پردازشی یا تغییر در رکوردهای داده محک می‌زند.
2. در صورت پاسخ موفقیت‌آمیز پایگاه‌داده، شیء وضعیت به همراه برچسب زمان جاری (Timestamp استاندارد ISO 8601) برگردانده می‌شود.
3. در صورتی که دیتابیس قطع یا در دسترس نباشد، فراخوانی `await this.prisma.$queryRaw` با پرتاب استثنا متوقف شده و فیلتر خطای سراسری NestJS پاسخ خطای استاندارد `500 Internal Server Error` برمی‌گرداند.

---

## نمونه درخواست و پاسخ‌ها

### ۱. درخواست بررسی سلامت (Request)

```http
GET /api/health HTTP/1.1
Host: localhost:3000
Accept: application/json
```

### ۲. پاسخ موفق (200 OK)

در حالتی که سامانه و پایگاه‌داده در وضعیت ایده‌آل قرار دارند:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-10-12T18:19:30.412Z"
}
```

#### فیلدهای پاسخ:
* `status`: وضعیت سلامت کلی پردازش سرور (مقدار ثابت `'ok'`).
* `database`: وضعیت کانکشن پایگاه‌داده PostgreSQL (مقدار ثابت `'connected'`).
* `timestamp`: برچسب زمانی دقیق پاسخ بر اساس ساعت جهانی UTC به فرمت ISO-8601.

### ۳. پاسخ در زمان بروز اختلال (500 Internal Server Error)

در صورتی که ارتباط با PostgreSQL به هر دلیلی (مانند قطعی شبکه، کرش دیتابیس، یا اتمام اتصالات مجاز) قطع شده باشد:

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json; charset=utf-8

{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## کاربرد در محیط‌های استقرار و زیرساخت (DevOps)

### استفاده در Docker Compose
برای راستی‌آزمایی آماده بودن کانتینر در فایل `docker-compose.yml`:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 10s
```

### استفاده در لودبالانسرها
لودبالانسرها به کمک این اندپوینت می‌توانند سرورهای ناسالم را از چرخه دریافت ترافیک خارج کرده و پس از بازیابی مجدد، ترافیک کاربران را به سمت آن‌ها روانه سازند.
