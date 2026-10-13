# ماژول زمان‌بندی (Schedules Module)

## معرفی (Overview)
ماژول `SchedulesModule` مسئولیت مدیریت زمان‌بندی کاری آرایشگران را در سیستم نوبت‌دهی بر عهده دارد. این ماژول از دو بخش اصلی تشکیل شده است:
1. **ساعات کاری هفتگی (`Working Hours`):** تعریف و به‌روزرسانی ساعات شروع و پایان کار آرایشگر برای روزهای مختلف هفته (از شنبه تا جمعه).
2. **روزهای مرخصی یا تعطیلی (`Days Off`):** ثبت تاریخ‌های مشخصی که آرایشگر در آن‌ها مرخصی است یا به هر دلیلی در آرایشگاه حضور ندارد، به همراه ثبت دلیل مرخصی (اختیاری).

این اطلاعات مبنای اصلی موتور رزرو و زمان‌بندی نوبت‌ها (Appointments Engine) برای محاسبه اسلات‌های زمانی قابل رزرو توسط مشتریان هستند.

### ساختار ماژول (Module Structure)
این ماژول در فایل `src/schedules/schedules.module.ts` تعریف شده است و شامل بخش‌های زیر می‌باشد:
- **Imports:**
  - `AuthModule`: مدیریت احراز هویت توکن‌های JWT و اعمال قوانین کنترل نقش.
  - `SalonsModule`: اعتبارسنجی دسترسی کاربران و مدیران به آرایشگاه مربوطه از طریق `SalonAccessService`.
- **Controllers:**
  - `WorkingHoursController`: کنترلر اندپوینت‌های ساعات کاری هفتگی آرایشگران.
  - `DaysOffController`: کنترلر اندپوینت‌های روزهای مرخصی آرایشگران.
- **Providers:**
  - `WorkingHoursService`: سرویس منطق تجاری ساعات کاری هفتگی.
  - `DaysOffService`: سرویس منطق تجاری روزهای مرخصی.
- **Exports:**
  - `WorkingHoursService` و `DaysOffService` جهت استفاده در سایر ماژول‌ها (به‌ویژه ماژول رزرو نوبت).

---

## مدل‌های داده و ساختار پایگاه داده (Data Models)

### ۱. مدل ساعات کاری (`WorkingHour`)
ساعات کاری هفتگی به صورت رکوردهای مجزا به ازای هر روز هفته برای هر آرایشگر ذخیره می‌شود:

```prisma
model WorkingHour {
  id       String @id @default(uuid())
  salonId  String
  barberId String

  salon  Salon  @relation(fields: [salonId], references: [id], onDelete: Cascade)
  barber Barber @relation(fields: [barberId], references: [id], onDelete: Cascade)

  dayOfWeek DayOfWeek
  startTime String
  endTime   String
  isActive  Boolean   @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([barberId, dayOfWeek])
  @@index([salonId])
  @@index([barberId])
}
```

#### مشخصات فیلدهای `WorkingHour`:
- `id` (نوع: `String`): شناسه یکتای رکورد (`UUID`).
- `salonId` (نوع: `String`): شناسه آرایشگاهی که آرایشگر به آن تعلق دارد.
- `barberId` (نوع: `String`): شناسه یکتای آرایشگر.
- `dayOfWeek` (نوع شمارشی: `DayOfWeek`): روز هفته (قید یکتایی همراه با `barberId`).
- `startTime` (نوع: `String`): ساعت شروع کار به فرمت `HH:mm` (مثال: `"09:00"`).
- `endTime` (نوع: `String`): ساعت پایان کار به فرمت `HH:mm` (مثال: `"18:00"`).
- `isActive` (نوع: `Boolean`): فعال بودن این روز کاری (پیش‌فرض: `true`).
- **قید یکتایی (`@@unique([barberId, dayOfWeek])`):** هر آرایشگر در هر روز هفته حداکثر یک بازه کاری اصلی دارد. عملیات ثبت/ویرایش با سازوکار Upsert انجام می‌شود.

### ۲. مدل روزهای مرخصی (`DayOff`)
روزهای تعطیلی اختصاصی آرایشگر در این جدول نگهداری می‌شود:

```prisma
model DayOff {
  id       String @id @default(uuid())
  salonId  String
  barberId String

  salon  Salon  @relation(fields: [salonId], references: [id], onDelete: Cascade)
  barber Barber @relation(fields: [barberId], references: [id], onDelete: Cascade)

  date   DateTime
  reason String?

  createdAt DateTime @default(now())

  @@unique([barberId, date])
  @@index([salonId, date])
  @@index([barberId, date])
}
```

#### مشخصات فیلدهای `DayOff`:
- `id` (نوع: `String`): شناسه یکتای رکورد (`UUID`).
- `salonId` (نوع: `String`): شناسه آرایشگاه.
- `barberId` (نوع: `String`): شناسه آرایشگر.
- `date` (نوع: `DateTime`): تاریخ روز مرخصی بر اساس استاندارد UTC با ساعت صفر (`00:00:00Z`).
- `reason` (نوع: `String`، اختیاری): علت مرخصی یا توضیح ثبت‌شده توسط مدیر.
- **قید یکتایی (`@@unique([barberId, date])`):** برای یک آرایشگر نمی‌توان دو رکورد مرخصی برای یک تاریخ یکسان ثبت کرد.

### ۳. نوع شمارشی روزهای هفته (`DayOfWeek`)
```prisma
enum DayOfWeek {
  SATURDAY
  SUNDAY
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
}
```

---

## کلاس‌های انتقال داده (Data Transfer Objects - DTOs)

### ۱. کلاس `UpsertWorkingHourDto`
این DTO در مسیر ثبت یا ویرایش ساعت کاری هفتگی استفاده می‌شود (`src/schedules/dto/upsert-working-hour.dto.ts`):

```typescript
export class UpsertWorkingHourDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;
}
```

- **`startTime`:** رشته ساعت شروع کار به فرمت استاندارد ۲۴ ساعته `HH:mm` (مثال: `"09:30"`).
- **`endTime`:** رشته ساعت پایان کار به فرمت استاندارد ۲۴ ساعته `HH:mm` (مثال: `"18:00"`).

### ۲. کلاس `CreateDayOffDto`
این DTO در مسیر ثبت مرخصی جدید برای آرایشگر استفاده می‌شود (`src/schedules/dto/create-day-off.dto.ts`):

```typescript
export class CreateDayOffDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
```

- **`date`:** تاریخ تقویمی به فرمت `YYYY-MM-DD` (مثال: `"2026-10-25"`).
- **`reason`:** متن اختیاری جهت بیان دلیل مرخصی (مثال: `"مرخصی استعلاجی"`).

---

## احراز هویت، گاردها و اعتبارسنجی‌ها (Guards & Validation)

- **`JwtAuthGuard`:** تمامی اندپوینت‌ها نیازمند ارسال توکن معتبر JWT در هدر `Authorization: Bearer <token>` هستند.
- **`RolesGuard`:** تنها کاربران دارای نقش‌های `ADMIN` یا `SUPER_ADMIN` مجاز به فراخوانی این اندپوینت‌ها هستند.
- **`ParseEnumPipe(DayOfWeek)`:** در کنترلر ساعات کاری، مقدار متغیر مسیر `:dayOfWeek` به صورت خودکار با مقادیر مجاز `DayOfWeek` اعتبارسنجی می‌شود؛ در صورت ارسال مقداری نامعتبر، خطای `400 Bad Request` بازگردانده می‌شود.
- **`assertCanAccessSalon`:** بررسی دسترسی مدیر آرایشگاه: اگر کاربر `SUPER_ADMIN` باشد به تمام آرایشگاه‌ها دسترسی دارد، در غیر این صورت باید عضو فعال آرایشگاهی باشد که آرایشگر در آن مشغول است؛ در غیر این صورت خطای `403 Forbidden` رخ می‌دهد.
- **پارس دقیق تاریخ (`parseDate`):** متد داخلی در `DaysOffService` صحت ساختار تقویمی تاریخ را بررسی کرده و اطمینان حاصل می‌کند که روز و ماه معتبر باشند و بدون خطای اختلاف منطقه زمانی به زمان UTC تبدیل شوند.

---

## جدول اندپوینت‌ها (Endpoints Summary)

کلیه اندپوینت‌ها تحت مسیر پایه `/barbers` تعریف شده‌اند:

### اندپوینت‌های ساعات کاری (`WorkingHoursController`)

| متد (Method) | مسیر (Path) | احراز هویت (Auth) | نقش‌ها (Roles) | شرح عملیات (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/barbers/:barberId/working-hours` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | دریافت جدول کامل ساعات کاری هفتگی آرایشگر |
| `PUT` | `/barbers/:barberId/working-hours/:dayOfWeek` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | ایجاد یا به‌روزرسانی ساعات کاری آرایشگر برای روز مشخصی از هفته |
| `DELETE` | `/barbers/:barberId/working-hours/:dayOfWeek` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | حذف ساعات کاری آرایشگر در یک روز مشخص از هفته |

### اندپوینت‌های روزهای مرخصی (`DaysOffController`)

| متد (Method) | مسیر (Path) | احراز هویت (Auth) | نقش‌ها (Roles) | شرح عملیات (Description) |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/barbers/:barberId/days-off` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | ثبت مرخصی جدید برای آرایشگر در یک تاریخ مشخص |
| `GET` | `/barbers/:barberId/days-off` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | دریافت لیست تمام روزهای مرخصی ثبت‌شده برای آرایشگر |
| `DELETE` | `/barbers/:barberId/days-off/:date` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | لغو و حذف مرخصی آرایشگر در یک تاریخ مشخص |

---

## جزئیات اندپوینت‌های ساعات کاری (Working Hours Endpoints)

### ۱. دریافت ساعات کاری هفتگی (Get Working Hours)

- **مسیر:** `GET /barbers/:barberId/working-hours`
- **پارامترهای مسیر:**
  - `barberId` (نوع: `string`): شناسه آرایشگر.
- **سرآیندها:**
  - `Authorization: Bearer <jwt_token>`

#### پاسخ موفق (200 OK):
```json
[
  {
    "id": "c3e981d2-0941-4776-88c9-95a298bf302d",
    "salonId": "4a737f52-87ad-45c1-9f93-0130db61b20f",
    "barberId": "8f1a4e2b-2a91-4d32-9cb0-35ecb264d8a1",
    "dayOfWeek": "SATURDAY",
    "startTime": "09:00",
    "endTime": "18:00",
    "isActive": true,
    "createdAt": "2026-10-10T08:00:00.000Z",
    "updatedAt": "2026-10-10T08:00:00.000Z"
  },
  {
    "id": "e4a172f3-1852-4887-99d0-06b309cf413e",
    "salonId": "4a737f52-87ad-45c1-9f93-0130db61b20f",
    "barberId": "8f1a4e2b-2a91-4d32-9cb0-35ecb264d8a1",
    "dayOfWeek": "SUNDAY",
    "startTime": "10:00",
    "endTime": "19:00",
    "isActive": true,
    "createdAt": "2026-10-10T08:00:00.000Z",
    "updatedAt": "2026-10-10T08:00:00.000Z"
  }
]
```

#### خطاهای احتمالی:
- `401 Unauthorized`: کاربر لاگین نکرده است.
- `403 Forbidden`: کاربر به آرایشگاه دسترسی ندارد.
- `404 Not Found`: آرایشگری با این شناسه پیدا نشد.

---

### ۲. ثبت یا به‌روزرسانی ساعات کاری (Upsert Working Hour)

اگر برای آن روز از هفته قبلاً ساعت کاری ثبت شده باشد آن را به‌روزرسانی می‌کند؛ در غیر این صورت رکورد جدید می‌سازد.

- **مسیر:** `PUT /barbers/:barberId/working-hours/:dayOfWeek`
- **پارامترهای مسیر:**
  - `barberId` (نوع: `string`): شناسه آرایشگر.
  - `dayOfWeek` (نوع شمارشی: `DayOfWeek`): یکی از مقادیر `SATURDAY`, `SUNDAY`, `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`.
- **سرآیندها:**
  - `Authorization: Bearer <jwt_token>`
  - `Content-Type: application/json`

#### نمونه بدنه درخواست (Request Body):
```json
{
  "startTime": "09:30",
  "endTime": "18:00"
}
```

#### پاسخ موفق (200 OK):
```json
{
  "id": "c3e981d2-0941-4776-88c9-95a298bf302d",
  "salonId": "4a737f52-87ad-45c1-9f93-0130db61b20f",
  "barberId": "8f1a4e2b-2a91-4d32-9cb0-35ecb264d8a1",
  "dayOfWeek": "SATURDAY",
  "startTime": "09:30",
  "endTime": "18:00",
  "isActive": true,
  "createdAt": "2026-10-10T08:00:00.000Z",
  "updatedAt": "2026-10-12T15:20:00.000Z"
}
```

#### خطاهای احتمالی:
- `400 Bad Request`:
  - روز هفته ارسال‌شده در مسیر نامعتبر باشد (`ParseEnumPipe`).
  - فرمت ساعت اشتباه باشد (عدم تطابق با الگوی `HH:mm`).
  - ساعت شروع مساوی یا بعد از ساعت پایان باشد (`startTime must be before endTime`).
- `401 Unauthorized`: عدم احراز هویت.
- `403 Forbidden`: عدم داشتن دسترسی به آرایشگاه.
- `404 Not Found`: آرایشگر یافت نشد.
- `409 Conflict`: آرایشگر غیرفعال باشد (`Cannot set working hours for inactive barber`).

---

### ۳. حذف ساعات کاری یک روز (Remove Working Hour)

ساعت کاری تعریف‌شده برای یک روز هفته را حذف می‌کند تا آرایشگر در آن روز در دسترس نباشد.

- **مسیر:** `DELETE /barbers/:barberId/working-hours/:dayOfWeek`
- **پارامترهای مسیر:**
  - `barberId` (نوع: `string`): شناسه آرایشگر.
  - `dayOfWeek` (نوع: `DayOfWeek`): نام روز هفته.
- **سرآیندها:**
  - `Authorization: Bearer <jwt_token>`

#### پاسخ موفق (200 OK):
```json
{
  "message": "Working hour removed successfully"
}
```

#### خطاهای احتمالی:
- `400 Bad Request`: مقدار نامعتبر برای روز هفته.
- `401 Unauthorized`: کاربر لاگین نکرده است.
- `403 Forbidden`: عدم دسترسی به سالن آرایشگر.
- `404 Not Found`: آرایشگر یافت نشد یا در روز مشخص‌شده ساعت کاری وجود ندارد (`Working hour not found`).

---

## جزئیات اندپوینت‌های روزهای مرخصی (Days Off Endpoints)

### ۱. ثبت مرخصی جدید (Create Day Off)

- **مسیر:** `POST /barbers/:barberId/days-off`
- **پارامترهای مسیر:**
  - `barberId` (نوع: `string`): شناسه آرایشگر.
- **سرآیندها:**
  - `Authorization: Bearer <jwt_token>`
  - `Content-Type: application/json`

#### نمونه بدنه درخواست (Request Body):
```json
{
  "date": "2026-10-25",
  "reason": "تعطیلات سالانه و سفر خانوادگی"
}
```

#### پاسخ موفق (201 Created):
```json
{
  "id": "7f8b9c1d-6543-4210-b987-123456789abc",
  "salonId": "4a737f52-87ad-45c1-9f93-0130db61b20f",
  "barberId": "8f1a4e2b-2a91-4d32-9cb0-35ecb264d8a1",
  "date": "2026-10-25T00:00:00.000Z",
  "reason": "تعطیلات سالانه و سفر خانوادگی",
  "createdAt": "2026-10-12T15:30:00.000Z"
}
```

#### خطاهای احتمالی:
- `400 Bad Request`: تاریخ با الگوی `YYYY-MM-DD` همخوانی نداشته باشد یا مقدار غیراسترینگ باشد.
- `401 Unauthorized`: عدم احراز هویت.
- `403 Forbidden`: عدم دسترسی به آرایشگاه.
- `404 Not Found`: آرایشگر یافت نشد.
- `409 Conflict`:
  - `Cannot set day off for inactive barber`: آرایشگر غیرفعال است.
  - `date must be in YYYY-MM-DD format`: فرمت تاریخ اشتباه است.
  - `Invalid date`: تاریخ تقویمی نامعتبر است (مانند روز ۳۱ در ماه‌های ۳۰ روزه).
  - `Day off already exists for this date`: قبلاً برای این تاریخ مرخصی ثبت شده است.

---

### ۲. دریافت فهرست مرخصی‌های آرایشگر (Find Days Off by Barber)

- **مسیر:** `GET /barbers/:barberId/days-off`
- **پارامترهای مسیر:**
  - `barberId` (نوع: `string`): شناسه آرایشگر.
- **سرآیندها:**
  - `Authorization: Bearer <jwt_token>`

#### پاسخ موفق (200 OK):
```json
[
  {
    "id": "7f8b9c1d-6543-4210-b987-123456789abc",
    "salonId": "4a737f52-87ad-45c1-9f93-0130db61b20f",
    "barberId": "8f1a4e2b-2a91-4d32-9cb0-35ecb264d8a1",
    "date": "2026-10-25T00:00:00.000Z",
    "reason": "تعطیلات سالانه و سفر خانوادگی",
    "createdAt": "2026-10-12T15:30:00.000Z"
  }
]
```

#### خطاهای احتمالی:
- `401 Unauthorized`: کاربر احراز هویت نشده است.
- `403 Forbidden`: کاربر به سالن این آرایشگر دسترسی ندارد.
- `404 Not Found`: آرایشگر یافت نشد.

---

### ۳. حذف مرخصی در تاریخ مشخص (Remove Day Off)

- **مسیر:** `DELETE /barbers/:barberId/days-off/:date`
- **پارامترهای مسیر:**
  - `barberId` (نوع: `string`): شناسه آرایشگر.
  - `date` (نوع: `string`): تاریخ مورد نظر به فرمت `YYYY-MM-DD` (مثال: `"2026-10-25"`).
- **سرآیندها:**
  - `Authorization: Bearer <jwt_token>`

#### پاسخ موفق (200 OK):
```json
{
  "message": "Day off removed successfully"
}
```

#### خطاهای احتمالی:
- `401 Unauthorized`: کاربر احراز هویت نشده است.
- `403 Forbidden`: عدم دسترسی به آرایشگاه.
- `404 Not Found`:
  - آرایشگر وجود ندارد.
  - مرخصی در این تاریخ برای این آرایشگر ثبت نشده است (`Day off not found`).
- `409 Conflict`:
  - تاریخ دارای فرمت نامعتبر است (`date must be in YYYY-MM-DD format` یا `Invalid date`).

---

## سرویس‌ها (Services Architecture)

### ۱. سرویس ساعات کاری (`WorkingHoursService`)

این سرویس در فایل `src/schedules/working-hours.service.ts` قرار داشته و شامل متدهای زیر است:

- **`getAuthorizedBarber(barberId: string, userId: string, role: UserRole)` (متد خصوصی):**
  - آرایشگر را بر اساس شناسه از دیتابیس استخراج می‌کند.
  - در صورت نبود، خطای `NotFoundException('Barber not found')` صادر می‌کند.
  - متد `salonAccessService.assertCanAccessSalon` را فراخوانی می‌کند تا مجوز دسترسی کاربر به آرایشگاه را تایید کند.
  - شیء آرایشگر تاییدشده را برمی‌گرداند.

- **`upsert(barberId, dayOfWeek, dto, userId, role)`:**
  - بررسی فعال بودن آرایشگر؛ در صورت غیرفعال بودن: `ConflictException('Cannot set working hours for inactive barber')`.
  - بررسی شرط توالی زمانی ساعت‌ها: اگر `dto.startTime >= dto.endTime` باشد، خطای `BadRequestException('startTime must be before endTime')` پرتاب می‌شود.
  - با استفاده از متد `prisma.workingHour.upsert` و کلید ترکیبی `barberId_dayOfWeek`:
    - در صورت نبود، رکورد جدید با وضعیت `isActive: true` و انتساب به `salonId` آرایشگر ایجاد می‌کند.
    - در صورت وجود، ساعت شروع و پایان را به‌روزرسانی کرده و وضعیت را به `isActive: true` تغییر می‌دهد.

- **`findByBarber(barberId, userId, role)`:**
  - پس از اعتبارسنجی آرایشگر و دسترسی سالن، تمام رکوردهای ساعات کاری آرایشگر را به صورت صعودی بر اساس روز هفته (`orderBy: { dayOfWeek: 'asc' }`) بازمی‌گرداند.

- **`remove(barberId, dayOfWeek, userId, role)`:**
  - پس از اعتبارسنجی آرایشگر، رکورد مربوط به آن روز هفته را جستجو می‌کند.
  - در صورت عدم وجود، خطای `NotFoundException('Working hour not found')` صادر می‌کند.
  - با استفاده از `prisma.workingHour.delete` رکورد را حذف کرده و شیء `{ message: 'Working hour removed successfully' }` را بازمی‌گرداند.

---

### ۲. سرویس روزهای مرخصی (`DaysOffService`)

این سرویس در فایل `src/schedules/days-off.service.ts` قرار داشته و شامل متدهای زیر است:

- **`parseDate(date: string): Date` (متد خصوصی):**
  - فرمت رشته تاریخ را با الگوی رجکس `/^(\d{4})-(\d{2})-(\d{2})$/` بررسی می‌کند.
  - ارقام سال، ماه و روز را استخراج کرده و یک شیء تاریخ بر پایه UTC (`Date.UTC(year, month - 1, day)`) می‌سازد.
  - مطابقت مقادیر تاریخ ساخته‌شده را با سال، ماه و روز اولیه می‌سنجد تا از ثبت روزهای نامعتبر تقویمی (مثلاً ۳۱ فوریه) جلوگیری کند؛ در غیر این صورت خطای `ConflictException('Invalid date')` پرتاب می‌کند.

- **`getAuthorizedBarber(barberId, userId, role)` (متد خصوصی):**
  - آرایشگر را بارگذاری کرده و دسترسی کاربر به آرایشگاه مربوطه را از طریق `assertCanAccessSalon` ارزیابی می‌کند.

- **`create(barberId, dto, userId, role)`:**
  - فعال بودن آرایشگر را بررسی می‌کند؛ در صورت غیرفعال بودن: `ConflictException('Cannot set day off for inactive barber')`.
  - تاریخ ورودی را از طریق `parseDate` تبدیل می‌کند.
  - بررسی می‌کند که آیا قبلاً مرخصی برای این آرایشگر در این تاریخ ثبت شده است یا خیر (`prisma.dayOff.findUnique` با کلید ترکیبی `barberId_date`)؛ در صورت تکراری بودن خطای `ConflictException('Day off already exists for this date')` صادر می‌شود.
  - رکورد مرخصی جدید را در دیتابیس با فیلدهای `barberId`، `salonId`، `date` و `reason` ذخیره می‌کند.

- **`findByBarber(barberId, userId, role)`:**
  - پس از احراز دسترسی، کلیه مرخصی‌های ثبت‌شده آرایشگر را با مرتب‌سازی صعودی بر اساس تاریخ (`orderBy: { date: 'asc' }`) بازمی‌گرداند.

- **`remove(barberId, dateString, userId, role)`:**
  - پس از احراز دسترسی، تاریخ رشته‌ای را پارس می‌کند.
  - رکورد مرخصی مربوط به آن تاریخ را پیدا می‌کند؛ در صورت عدم وجود خطای `NotFoundException('Day off not found')` پرتاب می‌کند.
  - رکورد را حذف کرده و پیام `{ message: 'Day off removed successfully' }` را برمی‌گرداند.
