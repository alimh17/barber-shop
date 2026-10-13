# ماژول خدمات آرایشگر (Barber Services Module)

## معرفی (Overview)
ماژول `BarberServicesModule` وظیفه مدیریت ارتباط چندبه‌چند (Many-to-Many) میان آرایشگران (`Barber`) و خدماتی (`Service`) که قادر به ارائه آن هستند را بر عهده دارد. در سامانه نوبت‌دهی آرایشگاه، هر آرایشگر ممکن است تنها بخشی از خدمات کلی آرایشگاه (مانند کوتاهی مو، اصلاح صورت، رنگ مو و ...) را ارائه دهد. این ماژول امکان انتساب خدمت به آرایشگر، حذف انتساب خدمت و مشاهده فهرست خدمات منتسب به هر آرایشگر را فراهم می‌سازد.

### ساختار ماژول (Module Structure)
این ماژول در فایل `src/barber-services/barber-services.module.ts` تعریف شده است و شامل وابستگی‌ها و اجزای زیر است:
- **Imports:**
  - `AuthModule`: جهت مدیریت احراز هویت توکن‌های JWT و بررسی نقش‌های کاربری.
  - `SalonsModule`: جهت ارزیابی دسترسی کاربران به آرایشگاه‌ها از طریق `SalonAccessService`.
- **Controllers:**
  - `BarberServicesController`: کنترلر مدیریت اندپوینت‌های مربوط به خدمات آرایشگران تحت مسیر پایه `/barbers`.
- **Providers:**
  - `BarberServicesService`: ارائه‌دهنده سرویس‌های منطق تجاری و ارتباط با پایگاه داده.
- **Exports:**
  - `BarberServicesService`: صادر شده برای استفاده در سایر ماژول‌ها در صورت نیاز به بررسی خدمات آرایشگر.

---

## مدل‌های داده و پایگاه داده (Data Models)

ارتباط میان آرایشگر و خدمات از طریق مدل واسط `BarberService` در Prisma مدیریت می‌شود.

### مدل `BarberService`
```prisma
model BarberService {
  barberId  String
  serviceId String

  barber  Barber  @relation(fields: [barberId], references: [id], onDelete: Cascade)
  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@id([barberId, serviceId])
  @@index([serviceId])
}
```

#### مشخصات فیلدها:
- `barberId` (نوع: `String`): شناسه یکتای آرایشگر (`UUID`). کلید خارجی ارجاعی به جدول `Barber`.
- `serviceId` (نوع: `String`): شناسه یکتای خدمت (`UUID`). کلید خارجی ارجاعی به جدول `Service`.
- `createdAt` (نوع: `DateTime`): زمان ایجاد رکورد اتصال خدمت به آرایشگر (پیش‌فرض: زمان جاری).
- **کلید اصلی ترکیبی:** `@@id([barberId, serviceId])` مانع از انتساب تکراری یک خدمت به یک آرایشگر یکسان در سطح پایگاه داده می‌شود.
- **شاخص‌ها:** شاخص‌گذاری روی فیلد `serviceId` برای افزایش سرعت پرس‌وجوهای معکوس (یافتن آرایشگران یک خدمت).
- **حذف آبشاری (`Cascade`):** با حذف آرایشگر یا حذف یک خدمت، پیوندهای مربوطه در این جدول به‌طور خودکار پاک می‌شوند.

---

## احراز هویت و مجوزها (Authentication & Authorization)

تمامی اندپوینت‌های این ماژول در سطح کلاس کنترلر محافظت شده‌اند:
- **`JwtAuthGuard`:** اعتبارسنجی توکن دسترسی Bearer JWT کاربر در هدر درخواست.
- **`RolesGuard`:** کنترل دسترسی بر اساس نقش‌های کاربری.
- **نقش‌های مجاز (`@Roles`):**
  - `UserRole.ADMIN`
  - `UserRole.SUPER_ADMIN`
- **دسترسی به آرایشگاه (`SalonAccessService.assertCanAccessSalon`):**
  - کاربران دارای نقش `SUPER_ADMIN` بدون محدودیت به تمامی آرایشگاه‌ها دسترسی دارند.
  - کاربران دارای نقش `ADMIN` تنها در صورتی مجاز به مدیریت آرایشگر هستند که عضو فعال آرایشگاه مربوطه (`SalonMembership.isActive == true`) باشند؛ در غیر این صورت خطای `403 Forbidden` برگردانده می‌شود.

---

## جدول اندپوینت‌ها (Endpoints Summary)

تمام اندپوینت‌ها با پیشوند `/barbers` تعریف شده‌اند:

| متد (Method) | مسیر (Path) | احراز هویت (Auth) | نقش‌های مجاز (Roles) | شرح عملیات (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/barbers/:barberId/services` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | دریافت فهرست خدمات متصل به آرایشگر |
| `POST` | `/barbers/:barberId/services/:serviceId` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | اتصال یک خدمت به آرایشگر |
| `DELETE` | `/barbers/:barberId/services/:serviceId` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | حذف اتصال یک خدمت از آرایشگر |

---

## جزئیات اندپوینت‌ها (Endpoint Details)

### ۱. دریافت خدمات آرایشگر (Find Services by Barber)

فهرست تمامی خدماتی که آرایشگر مشخص‌شده صلاحیت انجام آن‌ها را دارد دریافت می‌کند.

- **مسیر:** `GET /barbers/:barberId/services`
- **پارامترهای مسیر (Route Parameters):**
  - `barberId` (نوع: `string`): شناسه آرایشگر مورد نظر.
- **سرآیندها (Headers):**
  - `Authorization: Bearer <jwt_token>`

#### پاسخ موفق (200 OK):
```json
[
  {
    "barberId": "8f1a4e2b-2a91-4d32-9cb0-35ecb264d8a1",
    "serviceId": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
    "createdAt": "2026-10-12T14:30:00.000Z",
    "service": {
      "id": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
      "salonId": "4a737f52-87ad-45c1-9f93-0130db61b20f",
      "name": "اصلاح سر و صورت",
      "description": "اصلاح کامل موی سر و فرم‌دهی ریش",
      "duration": 45,
      "price": "250000.00",
      "isActive": true,
      "createdAt": "2026-10-01T10:00:00.000Z",
      "updatedAt": "2026-10-01T10:00:00.000Z"
    }
  }
]
```

#### خطاهای احتمالی:
- `401 Unauthorized`: کاربر لاگین نکرده یا توکن منقضی است.
- `403 Forbidden`: کاربر به آرایشگاه این آرایشگر دسترسی ندارد.
- `404 Not Found`: آرایشگری با این شناسه یافت نشد (`Barber not found`).

---

### ۲. اتصال خدمت به آرایشگر (Attach Service to Barber)

یک خدمت فعال از آرایشگاه را به آرایشگر متصل می‌کند تا امکان رزرو نوبت برای این خدمت با این آرایشگر فراهم شود.

- **مسیر:** `POST /barbers/:barberId/services/:serviceId`
- **پارامترهای مسیر (Route Parameters):**
  - `barberId` (نوع: `string`): شناسه آرایشگر.
  - `serviceId` (نوع: `string`): شناسه خدمت مورد نظر.
- **سرآیندها (Headers):**
  - `Authorization: Bearer <jwt_token>`
- **بدنه درخواست (Body):** ندارد.

#### پاسخ موفق (201 Created):
```json
{
  "barberId": "8f1a4e2b-2a91-4d32-9cb0-35ecb264d8a1",
  "serviceId": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
  "createdAt": "2026-10-12T14:35:00.000Z",
  "barber": {
    "id": "8f1a4e2b-2a91-4d32-9cb0-35ecb264d8a1",
    "userId": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    "salonId": "4a737f52-87ad-45c1-9f93-0130db61b20f",
    "isActive": true,
    "createdAt": "2026-10-01T09:00:00.000Z",
    "updatedAt": "2026-10-01T09:00:00.000Z",
    "user": {
      "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      "phone": "09123456789",
      "firstName": "رضا",
      "lastName": "محمدی",
      "role": "BARBER",
      "status": "ACTIVE"
    }
  },
  "service": {
    "id": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
    "salonId": "4a737f52-87ad-45c1-9f93-0130db61b20f",
    "name": "اصلاح سر و صورت",
    "description": "اصلاح کامل موی سر و فرم‌دهی ریش",
    "duration": 45,
    "price": "250000.00",
    "isActive": true,
    "createdAt": "2026-10-01T10:00:00.000Z",
    "updatedAt": "2026-10-01T10:00:00.000Z"
  }
}
```

#### خطاهای احتمالی:
- `401 Unauthorized`: کاربر احراز هویت نشده است.
- `403 Forbidden`: کاربر به آرایشگاه دسترسی مدیریتی ندارد.
- `404 Not Found`:
  - `Barber not found`: آرایشگر وجود ندارد.
  - `Service not found`: خدمت وجود ندارد.
- `409 Conflict`:
  - `Cannot attach service to inactive barber`: آرایشگر غیرفعال است (`isActive: false`).
  - `Barber and service must belong to the same salon`: آرایشگر و خدمت متعلق به دو آرایشگاه متفاوت هستند.
  - `Cannot attach inactive service`: خدمت غیرفعال است (`isActive: false`).
  - `Service is already assigned to this barber`: خدمت قبلاً به این آرایشگر متصل شده است.

---

### ۳. حذف اتصال خدمت از آرایشگر (Detach Service from Barber)

پیوند بین یک خدمت و آرایشگر را حذف می‌کند.

- **مسیر:** `DELETE /barbers/:barberId/services/:serviceId`
- **پارامترهای مسیر (Route Parameters):**
  - `barberId` (نوع: `string`): شناسه آرایشگر.
  - `serviceId` (نوع: `string`): شناسه خدمت.
- **سرآیندها (Headers):**
  - `Authorization: Bearer <jwt_token>`
- **بدنه درخواست (Body):** ندارد.

#### پاسخ موفق (200 OK):
```json
{
  "message": "Service detached from barber successfully"
}
```

#### خطاهای احتمالی:
- `401 Unauthorized`: احراز هویت نامعتبر است.
- `403 Forbidden`: عدم دسترسی به آرایشگاه مربوطه.
- `404 Not Found`:
  - `Service is not assigned to this barber`: پیوندی بین این آرایشگر و این خدمت ثبت نشده است.
- `409 Conflict`:
  - `Barber and service must belong to the same salon`: عدم تطابق سالن آرایشگر و خدمت.

---

## سرویس `BarberServicesService`

این سرویس منطق تجاری مربوط به ارتباط بین خدمات و آرایشگران را در بر می‌گیرد و شامل متدهای زیر است:

### ۱. متد `attach`
```typescript
async attach(
  barberId: string,
  serviceId: string,
  userId: string,
  role: UserRole,
): Promise<BarberService>
```
- **ورودی‌ها:**
  - `barberId`: شناسه آرایشگر.
  - `serviceId`: شناسه خدمت.
  - `userId`: شناسه کاربر درخواست‌دهنده.
  - `role`: نقش کاربر درخواست‌دهنده.
- **مراحل اجرا و اعتبارسنجی‌ها:**
  1. بررسی وجود آرایشگر در دیتابیس؛ در صورت عدم وجود، پرتاب `NotFoundException('Barber not found')`.
  2. بررسی دسترسی کاربر به آرایشگاه آرایشگر با `assertCanAccessSalon`.
  3. بررسی وضعیت فعال بودن آرایشگر؛ اگر `barber.isActive === false` باشد، پرتاب `ConflictException('Cannot attach service to inactive barber')`.
  4. بررسی وجود خدمت در دیتابیس؛ در صورت عدم وجود، پرتاب `NotFoundException('Service not found')`.
  5. بررسی یکسان بودن آرایشگاه خدمت و آرایشگاه آرایشگر (`barber.salonId !== service.salonId`)؛ در صورت عدم تطابق، پرتاب `ConflictException('Barber and service must belong to the same salon')`.
  6. بررسی فعال بودن خدمت؛ اگر `service.isActive === false` باشد، پرتاب `ConflictException('Cannot attach inactive service')`.
  7. بررسی عدم وجود انتساب قبلی با کلید ترکیبی `barberId_serviceId`؛ در صورت وجود، پرتاب `ConflictException('Service is already assigned to this barber')`.
  8. ایجاد رکورد در جدول `BarberService` همراه با پیوست اطلاعات `barber.user` و `service`.

### ۲. متد `detach`
```typescript
async detach(
  barberId: string,
  serviceId: string,
  userId: string,
  role: UserRole,
): Promise<{ message: string }>
```
- **مراحل اجرا و اعتبارسنجی‌ها:**
  1. جستجوی انتساب با کلید ترکیبی `barberId_serviceId`؛ اگر یافت نشد، پرتاب `NotFoundException('Service is not assigned to this barber')`.
  2. اعتبارسنجی دسترسی کاربر به آرایشگاه مربوطه با `assertCanAccessSalon`.
  3. بررسی یکسانی سالن آرایشگر و خدمت.
  4. حذف فیزیکی رکورد با `prisma.barberService.delete`.
  5. بازگرداندن پیام تأیید عملیات.

### ۳. متد `findByBarber`
```typescript
async findByBarber(
  barberId: string,
  userId: string,
  role: UserRole,
): Promise<BarberService[]>
```
- **مراحل اجرا:**
  1. بررسی وجود آرایشگر؛ در صورت عدم وجود، پرتاب `NotFoundException('Barber not found')`.
  2. بررسی دسترسی به آرایشگاه آرایشگر با `assertCanAccessSalon`.
  3. دریافت تمام رکوردهای جدول `BarberService` برای `barberId` به همراه اطلاعات کامل شیء `service`.
  4. مرتب‌سازی نتایج بر اساس تاریخ ایجاد نزولی (`createdAt: 'desc'`).

### ۴. متد `findByService`
```typescript
async findByService(
  serviceId: string,
  userId: string,
  role: UserRole,
): Promise<BarberService[]>
```
- **توضیح:** این متد در سرویس پیاده‌سازی و صادر شده است تا در صورت نیاز به بررسی لیست آرایشگرانی که یک خدمت خاص را ارائه می‌دهند (مثلاً در سناریوهای نوبت‌دهی مشتریان یا گزارش‌گیری)، مورد استفاده قرار گیرد.
- **مراحل اجرا:**
  1. بررسی وجود خدمت؛ در صورت عدم وجود، پرتاب `NotFoundException('Service not found')`.
  2. بررسی دسترسی به آرایشگاه خدمت با `assertCanAccessSalon`.
  3. استخراج رکوردهای `BarberService` بر اساس `serviceId` به همراه جزئیات آرایشگر و اطلاعات هویتی کاربر وی (`barber.user`).
  4. مرتب‌سازی بر اساس `createdAt: 'desc'`.
