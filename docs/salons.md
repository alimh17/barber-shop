# ماژول سالن‌ها (Salons Module)

## معرفی

ماژول سالن‌ها (`SalonsModule`) هسته مرکزی مدیریت مراکز و سالن‌های زیبایی در سامانه نوبت‌دهی است. در این سیستم، سالن‌ها به عنوان نهادهای اصلی (Tenants) عمل می‌کنند که کلیه آرایشگران (`Barber`)، خدمات (`Service`)، ساعات کاری (`WorkingHour`)، روزهای تعطیل (`DayOff`) و نوبت‌ها (`Appointment`) به آن‌ها وابسته هستند.

این ماژول همچنین مجهز به یک سیستم عضویت و کنترل دسترسی اختصاصی (`SalonMembership` و `SalonAccessService`) است. از طریق این سازوکار، سوپر ادمین (`SUPER_ADMIN`) می‌تواند مدیران مجاز (`ADMIN`) را به سالن‌های خاص منتسب کرده یا دسترسی آن‌ها را سلب کند، و مدیران سالن نیز تنها اجازه دارند اطلاعات سالن‌های تحت مدیریت و عضویت فعال خود را ویرایش یا مدیریت نمایند.

---

## وابستگی‌ها

ماژول `SalonsModule` شامل مؤلفه‌ها و وابستگی‌های زیر در سطح پروژه است:

- **ماژول‌های وارد شده (`imports`)**:
  - `AuthModule`: جهت تأمین مکانیزم‌های احراز هویت، استخراج کاربر و گاردهای دسترسی (`JwtAuthGuard`, `RolesGuard`).

- **کنترلرها (`controllers`)**:
  - `SalonsController`: مدیریت اندپوینت‌های HTTP و هدایت درخواست‌ها به لایه سرویس.

- **تأمین‌کننده‌ها (`providers`)**:
  - `SalonsService`: سرویس اصلی پیاده‌سازی منطق تجاری مدیریت سالن‌ها و عضویت‌ها.
  - `SalonAccessService`: سرویس بررسی و اعتبارسنجی حق دسترسی کاربران به سالن‌ها.
  - `PrismaService`: تعامل با پایگاه داده PostgreSQL از طریق Prisma ORM.

- **صادرات ماژول (`exports`)**:
  - `SalonsService`: جهت استفاده در سایر بخش‌های سامانه.
  - `SalonAccessService`: برای بررسی دسترسی کاربران به سالن در ماژول‌های وابسته (مانند ماژول خدمات، آرایشگران و نوبت‌دهی).

---

## مدل‌های داده (Data Models)

مدل‌های داده‌ای مرتبط در لایه پایگاه داده (Prisma Schema):

### 1. مدل `Salon`
نماینده سالن زیبایی در سامانه:
- `id` (`String`): شناسه یکتای سالن (UUID - کلید اصلی).
- `name` (`String`): نام سالن.
- `slug` (`String`): نامک/شناسه متنی یکتای سالن برای آدرس‌دهی و تفکیک (Unique).
- `phone` (`String?`): شماره تلفن سالن (اختیاری).
- `address` (`String?`): آدرس فیزیکی سالن (اختیاری).
- `description` (`String?`): توضیحات و مشخصات سالن (اختیاری).
- `timezone` (`String`): منطقه زمانی سالن (مقدار پیش‌فرض: `'Asia/Tehran'`).
- `isActive` (`Boolean`): وضعیت فعال یا غیرفعال بودن سالن (مقدار پیش‌فرض: `true`).
- `createdAt` (`DateTime`): زمان ایجاد رکورد.
- `updatedAt` (`DateTime`): زمان آخرین به‌روزرسانی رکورد.

### 2. مدل `SalonMembership`
جدول واسط برای اتصال کاربران با نقش مدیر (`ADMIN`) به سالن‌ها:
- `id` (`String`): شناسه یکتای عضویت (UUID).
- `userId` (`String`): شناسه کاربر منتسب شده (ارجاع به جدول `User`).
- `salonId` (`String`): شناسه سالن مربوطه (ارجاع به جدول `Salon`).
- `isActive` (`Boolean`): وضعیت فعال بودن عضویت (مقدار پیش‌فرض: `true`).
- `createdAt` (`DateTime`): زمان ثبت عضویت.
- `updatedAt` (`DateTime`): زمان به‌روزرسانی عضویت.
- قید یکتایی: ترکیب `[userId, salonId]` یکتا است.
- رفتار حذف آبشاری (`onDelete: Cascade`): در صورت حذف سالن یا کاربر، رکوردهای عضویت وابسته نیز حذف می‌شوند.

---

## اندپوینت‌ها

مسیر پایه اندپوینت‌های این ماژول `/salons` است.

### جدول خلاصه اندپوینت‌ها

| متد | مسیر | احراز هویت / نقش‌های مجاز | توضیحات |
| :--- | :--- | :--- | :--- |
| `GET` | `/salons` | عمومی (بدون نیاز به توکن) | دریافت لیست سالن‌های فعال |
| `GET` | `/salons/:id` | عمومی (بدون نیاز به توکن) | دریافت اطلاعات کامل یک سالن |
| `POST` | `/salons` | احراز هویت (`JwtAuthGuard`) + نقش `SUPER_ADMIN` | ایجاد سالن جدید |
| `POST` | `/salons/:id/memberships` | احراز هویت (`JwtAuthGuard`) + نقش `SUPER_ADMIN` | انتصاب یک مدیر (`ADMIN`) به سالن |
| `DELETE` | `/salons/:id/memberships/:userId` | احراز هویت (`JwtAuthGuard`) + نقش `SUPER_ADMIN` | سلب/غیرفعال‌سازی عضویت مدیر در سالن |
| `PATCH` | `/salons/:id` | احراز هویت (`JwtAuthGuard`) + نقش‌های `ADMIN`, `SUPER_ADMIN` | ویرایش مشخصات سالن (با کنترل دسترسی عضویت) |
| `DELETE` | `/salons/:id` | احراز هویت (`JwtAuthGuard`) + نقش‌های `ADMIN`, `SUPER_ADMIN` | غیرفعال‌سازی نرم سالن (Soft Delete) |

---

### جزئیات اندپوینت‌ها

#### 1. دریافت لیست سالن‌های فعال
- **مسیر**: `GET /salons`
- **احراز هویت**: ندارد (عمومی)
- **توضیحات**: فهرست تمامی سالن‌هایی را که وضعیت `isActive: true` دارند به ترتیب نزولی تاریخ ایجاد (`createdAt: desc`) بازمی‌گرداند.
- **پاسخ موفق (200 OK)**:
```json
[
  {
    "id": "e4a2c58e-0b1e-4c74-a698-09f19a084c8a",
    "name": "Barbershop Classic",
    "slug": "barbershop-classic",
    "phone": "02188888888",
    "address": "Tehran, Valiasr St.",
    "description": "Professional men grooming salon",
    "timezone": "Asia/Tehran",
    "isActive": true,
    "createdAt": "2026-10-12T10:00:00.000Z",
    "updatedAt": "2026-10-12T10:00:00.000Z"
  }
]
```

---

#### 2. دریافت اطلاعات سالن بر اساس شناسه
- **مسیر**: `GET /salons/:id`
- **احراز هویت**: ندارد (عمومی)
- **پارامترهای مسیر**:
  - `id`: شناسه یکتای سالن (UUID)
- **خطاهای احتمالی**:
  - `404 Not Found`: در صورتی که سالنی با این شناسه یافت نشود (`Salon not found`).
- **پاسخ موفق (200 OK)**:
```json
{
  "id": "e4a2c58e-0b1e-4c74-a698-09f19a084c8a",
  "name": "Barbershop Classic",
  "slug": "barbershop-classic",
  "phone": "02188888888",
  "address": "Tehran, Valiasr St.",
  "description": "Professional men grooming salon",
  "timezone": "Asia/Tehran",
  "isActive": true,
  "createdAt": "2026-10-12T10:00:00.000Z",
  "updatedAt": "2026-10-12T10:00:00.000Z"
}
```

---

#### 3. ایجاد سالن جدید
- **مسیر**: `POST /salons`
- **احراز هویت**: توکن JWT معتبر (`JwtAuthGuard`)
- **نقش‌های مجاز**: `SUPER_ADMIN` (`RolesGuard`)
- **بدنه درخواست (Request Body)**: `CreateSalonDto`
```json
{
  "name": "Royal Barbershop",
  "slug": "royal-barber",
  "phone": "02122222222",
  "address": "Tehran, Zaferanieh",
  "description": "Luxury salon services",
  "timezone": "Asia/Tehran",
  "isActive": true
}
```
- **خطاهای احتمالی**:
  - `400 Bad Request`: خطای اعتبارسنجی فیلدهای ورودی (فیلدهای `name` یا `slug` ارسال نشده باشند یا نامعتبر باشند).
  - `401 Unauthorized`: کاربر احراز هویت نشده باشد.
  - `403 Forbidden`: کاربر نقشی به جز `SUPER_ADMIN` داشته باشد.
  - `409 Conflict`: نامک (`slug`) قبلاً برای سالن دیگری ثبت شده باشد (`Salon slug already exists`).
- **پاسخ موفق (201 Created)**:
```json
{
  "id": "7b0a7cb5-9ff4-4db6-9e9f-8ea873db9db1",
  "name": "Royal Barbershop",
  "slug": "royal-barber",
  "phone": "02122222222",
  "address": "Tehran, Zaferanieh",
  "description": "Luxury salon services",
  "timezone": "Asia/Tehran",
  "isActive": true,
  "createdAt": "2026-10-12T14:30:00.000Z",
  "updatedAt": "2026-10-12T14:30:00.000Z"
}
```

---

#### 4. انتصاب عضویت مدیر به سالن
- **مسیر**: `POST /salons/:id/memberships`
- **احراز هویت**: توکن JWT معتبر (`JwtAuthGuard`)
- **نقش‌های مجاز**: `SUPER_ADMIN` (`RolesGuard`)
- **پارامترهای مسیر**:
  - `id`: شناسه سالن (UUID)
- **بدنه درخواست (Request Body)**: `CreateSalonMembershipDto`
```json
{
  "userId": "c56d0e92-3490-4c8d-b0a1-8d264f3d2a71"
}
```
- **خطاهای احتمالی**:
  - `400 Bad Request`:
    - شناسه `userId` یک UUID معتبر نباشد.
    - کاربر ارجاع داده شده دارای نقش `ADMIN` نباشد (`Only users with ADMIN role can be assigned to a salon`).
    - وضعیت کاربر در حالت غیرفعال یا مسدود باشد (`Inactive or blocked users cannot be assigned to a salon`).
  - `404 Not Found`:
    - سالن مورد نظر یافت نشود (`Salon not found`).
    - کاربر مورد نظر در سیستم یافت نشود (`User not found`).
  - `409 Conflict`: کاربر در حال حاضر عضو فعال همین سالن باشد (`This admin is already assigned to the salon`).
- **رفتار خاص**: در صورتی که کاربر قبلاً به سالن منتسب بوده ولی عضویت او غیرفعال (`isActive: false`) شده باشد، رکورد موجود مجدداً فعال می‌شود (`isActive: true`). در غیر این صورت، رکورد جدیدی در جدول عضویت ساخته می‌شود.
- **پاسخ موفق (201 Created)**:
```json
{
  "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  "userId": "c56d0e92-3490-4c8d-b0a1-8d264f3d2a71",
  "salonId": "7b0a7cb5-9ff4-4db6-9e9f-8ea873db9db1",
  "isActive": true,
  "createdAt": "2026-10-12T15:00:00.000Z",
  "updatedAt": "2026-10-12T15:00:00.000Z"
}
```

---

#### 5. سلب یا غیرفعال‌سازی عضویت مدیر در سالن
- **مسیر**: `DELETE /salons/:id/memberships/:userId`
- **احراز هویت**: توکن JWT معتبر (`JwtAuthGuard`)
- **نقش‌های مجاز**: `SUPER_ADMIN` (`RolesGuard`)
- **پارامترهای مسیر**:
  - `id`: شناسه سالن (UUID)
  - `userId`: شناسه کاربر ادمین (UUID)
- **خطاهای احتمالی**:
  - `404 Not Found`:
    - سالن با شناسه داده شده وجود نداشته باشد.
    - عضویت فعالی برای این کاربر در این سالن یافت نشود (`Active salon membership not found`).
- **نتیجه**: فیلد `isActive` عضویت به `false` تغییر می‌کند (عضویت به صورت نرم غیرفعال می‌شود).
- **پاسخ موفق (200 OK)**:
```json
{
  "id": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  "userId": "c56d0e92-3490-4c8d-b0a1-8d264f3d2a71",
  "salonId": "7b0a7cb5-9ff4-4db6-9e9f-8ea873db9db1",
  "isActive": false,
  "createdAt": "2026-10-12T15:00:00.000Z",
  "updatedAt": "2026-10-12T16:15:00.000Z"
}
```

---

#### 6. ویرایش مشخصات سالن
- **مسیر**: `PATCH /salons/:id`
- **احراز هویت**: توکن JWT معتبر (`JwtAuthGuard`)
- **نقش‌های مجاز**: `SUPER_ADMIN`, `ADMIN` (`RolesGuard`)
- **پارامترهای مسیر**:
  - `id`: شناسه سالن (UUID)
- **بدنه درخواست (Request Body)**: `UpdateSalonDto` (کلیه فیلدها اختیاری هستند)
```json
{
  "name": "Royal Barbershop VIP",
  "phone": "02122223333",
  "description": "Updated luxury salon description"
}
```
- **کنترل دسترسی**:
  - کاربر `SUPER_ADMIN`: به تمامی سالن‌ها دسترسی دارد.
  - کاربر `ADMIN`: تنها در صورتی مجاز است که در جدول `SalonMembership` عضویت فعالی (`isActive: true`) برای این سالن داشته باشد.
- **خطاهای احتمالی**:
  - `403 Forbidden`: کاربر ادمین به این سالن دسترسی ندارد (`You do not have access to this salon`).
  - `404 Not Found`: سالن یافت نشود.
  - `409 Conflict`: در صورت تغییر `slug`، نامک جدید قبلاً توسط سالن دیگری ثبت شده باشد (`Salon slug already exists`).
- **پاسخ موفق (200 OK)**:
```json
{
  "id": "7b0a7cb5-9ff4-4db6-9e9f-8ea873db9db1",
  "name": "Royal Barbershop VIP",
  "slug": "royal-barber",
  "phone": "02122223333",
  "address": "Tehran, Zaferanieh",
  "description": "Updated luxury salon description",
  "timezone": "Asia/Tehran",
  "isActive": true,
  "createdAt": "2026-10-12T14:30:00.000Z",
  "updatedAt": "2026-10-12T16:20:00.000Z"
}
```

---

#### 7. غیرفعال‌سازی نرم سالن
- **مسیر**: `DELETE /salons/:id`
- **احراز هویت**: توکن JWT معتبر (`JwtAuthGuard`)
- **نقش‌های مجاز**: `SUPER_ADMIN`, `ADMIN` (`RolesGuard`)
- **پارامترهای مسیر**:
  - `id`: شناسه سالن (UUID)
- **کنترل دسترسی**: مشابه متد `PATCH`، ادمین باید عضو فعال این سالن باشد؛ سوپر ادمین به همه سالن‌ها دسترسی دارد.
- **نتیجه**: فیلد `isActive` سالن به `false` تغییر می‌کند.
- **پاسخ موفق (200 OK)**:
```json
{
  "id": "7b0a7cb5-9ff4-4db6-9e9f-8ea873db9db1",
  "name": "Royal Barbershop VIP",
  "slug": "royal-barber",
  "phone": "02122223333",
  "address": "Tehran, Zaferanieh",
  "description": "Updated luxury salon description",
  "timezone": "Asia/Tehran",
  "isActive": false,
  "createdAt": "2026-10-12T14:30:00.000Z",
  "updatedAt": "2026-10-12T16:30:00.000Z"
}
```

---

## DTOs

کلاس‌های انتقال داده (Data Transfer Objects) با استفاده از `class-validator` اعتبارسنجی ورودی‌ها را انجام می‌دهند:

### 1. `CreateSalonDto`
مورد استفاده هنگام ثبت سالن جدید:

```typescript
export class CreateSalonDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

| نام فیلد | نوع داده | الزامی | قوانین اعتبارسنجی | توضیحات |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | بله | `@IsString()`, `@IsNotEmpty()` | نام سالن |
| `slug` | `string` | بله | `@IsString()`, `@IsNotEmpty()` | نامک یکتا برای شناسایی و URL |
| `phone` | `string` | خیر | `@IsOptional()`, `@IsString()` | شماره تماس سالن |
| `address` | `string` | خیر | `@IsOptional()`, `@IsString()` | آدرس سالن |
| `description` | `string` | خیر | `@IsOptional()`, `@IsString()` | توضیحات سالن |
| `timezone` | `string` | خیر | `@IsOptional()`, `@IsString()` | منطقه زمانی (پیش‌فرض: `'Asia/Tehran'`) |
| `isActive` | `boolean` | خیر | `@IsOptional()`, `@IsBoolean()` | وضعیت اولیه فعال بودن (پیش‌فرض: `true`) |

---

### 2. `UpdateSalonDto`
مورد استفاده برای به‌روزرسانی مشخصات سالن. تمام فیلدها اختیاری هستند:

```typescript
export class UpdateSalonDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

| نام فیلد | نوع داده | الزامی | قوانین اعتبارسنجی | توضیحات |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | خیر | `@IsOptional()`, `@IsString()` | نام جدید سالن |
| `slug` | `string` | خیر | `@IsOptional()`, `@IsString()` | نامک جدید (در صورت ارسال، یکتایی چک می‌شود) |
| `phone` | `string` | خیر | `@IsOptional()`, `@IsString()` | شماره تلفن جدید |
| `address` | `string` | خیر | `@IsOptional()`, `@IsString()` | آدرس جدید |
| `description` | `string` | خیر | `@IsOptional()`, `@IsString()` | توضیحات جدید |
| `timezone` | `string` | خیر | `@IsOptional()`, `@IsString()` | منطقه زمانی جدید |
| `isActive` | `boolean` | خیر | `@IsOptional()`, `@IsBoolean()` | تغییر وضعیت فعال/غیرفعال |

---

### 3. `CreateSalonMembershipDto`
مورد استفاده برای تخصیص مدیر به سالن:

```typescript
export class CreateSalonMembershipDto {
  @IsUUID()
  userId: string;
}
```

| نام فیلد | نوع داده | الزامی | قوانین اعتبارسنجی | توضیحات |
| :--- | :--- | :--- | :--- | :--- |
| `userId` | `string` | بله | `@IsUUID()` | شناسه کاربری فرد با نقش `ADMIN` که به سالن منتسب می‌شود |

---

## سرویس‌ها

### SalonsService

سرویس `SalonsService` تمامی عملیات CRUD سالن‌ها و مدیریت اعضای سالن را پیاده‌سازی می‌کند.

#### متدهای مدیریت سالن:

1. **`create(dto: CreateSalonDto)`**:
   - **هدف**: ایجاد سالن جدید در پایگاه داده.
   - **فرآیند**:
     - بررسی می‌کند که سالنی با نامک `slug` وارد شده در پایگاه داده وجود نداشته باشد.
     - در صورت وجود، خطای `ConflictException('Salon slug already exists')` پرتاب می‌شود.
     - سالن با مقادیر ارسالی ذخیره می‌شود. فیلد `timezone` در صورت خالی بودن به صورت پیش‌فرض برابر `'Asia/Tehran'` و `isActive` برابر `true` تنظیم می‌گردد.

2. **`findAll()`**:
   - **هدف**: دریافت لیست سالن‌های فعال.
   - **فرآیند**:
     - رکوردهایی از جدول `Salon` را که فیلد `isActive: true` دارند بازیابی می‌کند.
     - مرتب‌سازی بر اساس تاریخ ایجاد سالن به صورت نزولی (`createdAt: 'desc'`) انجام می‌شود.

3. **`findById(id: string)`**:
   - **هدف**: بازیابی مشخصات یک سالن با شناسه.
   - **فرآیند**:
     - سالن را بر اساس `id` جستجو می‌کند.
     - در صورتی که سالن پیدا نشود، خطای `NotFoundException('Salon not found')` پرتاب می‌کند.

4. **`update(id: string, dto: UpdateSalonDto, userId: string, role: UserRole)`**:
   - **هدف**: ویرایش مشخصات سالن با رعایت قوانین دسترسی.
   - **فرآیند**:
     - ابتدا با فراخوانی `this.findById(id)` از وجود سالن اطمینان حاصل می‌کند.
     - با فراخوانی `this.salonAccessService.assertCanAccessSalon(userId, role, id)` حق دسترسی کاربر به سالن را بررسی می‌نماید.
     - چنانچه `dto.slug` ارسال شده باشد، بررسی می‌کند سالن دیگری (با شناسه متفاوت) از این نامک استفاده نکرده باشد؛ در غیر این صورت `ConflictException('Salon slug already exists')` پرتاب می‌شود.
     - تغییرات را در جدول `Salon` ذخیره کرده و سالن به‌روزرسانی شده را بازمی‌گرداند.

5. **`remove(id: string, userId: string, role: UserRole)`**:
   - **هدف**: غیرفعال‌سازی نرم (Soft Delete) سالن.
   - **فرآیند**:
     - وجود سالن با `findById(id)` بررسی می‌شود.
     - سطح دسترسی کاربر با `assertCanAccessSalon` اعتبارسنجی می‌شود.
     - به جای حذف فیزیکی رکورد از پایگاه داده، فیلد `isActive` به `false` تغییر می‌کند.

---

#### متدهای مدیریت عضویت (`SalonMembership`):

6. **`createMembership(salonId: string, dto: CreateSalonMembershipDto)`**:
   - **هدف**: تخصیص یک کاربر ادمین به سالن.
   - **فرآیند**:
     - بررسی وجود سالن با فراخوانی `findById(salonId)`.
     - واکشی اطلاعات کاربر با `dto.userId` از جدول `User`. در صورت عدم وجود: `NotFoundException('User not found')`.
     - بررسی نقش کاربر: کاربر حتماً باید دارای نقش `UserRole.ADMIN` باشد. در غیر این صورت: `BadRequestException('Only users with ADMIN role can be assigned to a salon')`.
     - بررسی وضعیت کاربر: کاربر باید دارای وضعیت `UserStatus.ACTIVE` باشد. کاربران غیرفعال یا مسدود مجاز به تخصیص نیستند: `BadRequestException('Inactive or blocked users cannot be assigned to a salon')`.
     - بررسی رکوردهای پیشین عضویت بر اساس شناسه ترکیبی `userId_salonId`:
       - اگر عضویت قبلاً وجود داشته و `isActive: true` باشد: `ConflictException('This admin is already assigned to the salon')`.
       - اگر عضویت قبلاً وجود داشته ولی `isActive: false` باشد: همان رکورد به وضعیت فعال بازگردانی می‌شود (`isActive: true`).
       - اگر رکوردی وجود نداشته باشد: رکورد عضویت جدید در `SalonMembership` درج می‌شود.

7. **`deactivateMembership(salonId: string, userId: string)`**:
   - **هدف**: لغو یا غیرفعال‌سازی عضویت فعال یک ادمین در سالن.
   - **فرآیند**:
     - بررسی وجود سالن با فراخوانی `findById(salonId)`.
     - جستجوی رکورد عضویت بر اساس کلید یکتای ترکیبی `userId_salonId`.
     - در صورتی که عضویت وجود نداشته باشد یا از قبل غیرفعال باشد: `NotFoundException('Active salon membership not found')`.
     - تغییر مقدار `isActive` به `false` و بازگرداندن رکورد به‌روزرسانی شده.

---

### SalonAccessService

سرویس `SalonAccessService` وظیفه متمرکز کنترل و اعتبارسنجی سطوح دسترسی کاربران به سالن‌های خاص را بر عهده دارد. این سرویس در سایر ماژول‌ها نیز به عنوان گیت دسترسی سالن استفاده می‌شود.

```typescript
@Injectable()
export class SalonAccessService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async assertCanAccessSalon(
    userId: string,
    role: UserRole,
    salonId: string,
  ): Promise<void> {
    // Super admins can access every salon.
    if (role === UserRole.SUPER_ADMIN) {
      return;
    }

    const membership =
      await this.prisma.salonMembership.findFirst({
        where: {
          userId,
          salonId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this salon',
      );
    }
  }
}
```

#### سازوکار بررسی دسترسی (`assertCanAccessSalon`):
1. **دسترسی سراسری سوپر ادمین (`SUPER_ADMIN`)**:
   - در صورتی که نقش کاربر `UserRole.SUPER_ADMIN` باشد، متد بلافاصله با موفقیت خاتمه می‌یابد. سوپر ادمین‌ها به تمامی سالن‌ها، تنظیمات و بخش‌های سامانه دسترسی نامحدود دارند و نیازی به داشتن رکورد عضویت در سالن ندارند.

2. **بررسی عضویت فعال برای مدیران (`ADMIN`)**:
   - برای سایر نقش‌ها (به‌ویژه مدیران سالن `ADMIN`)، کوئری به جدول `SalonMembership` ارسال می‌شود:
     - تطابق `userId` با شناسه کاربر درخواست‌دهنده
     - تطابق `salonId` با شناسه سالن مورد نظر
     - فیلتر `isActive: true` برای اطمینان از معلق نبودن عضویت
   - چنانچه رکوردی منطبق بر این شرایط یافت نشود، متد خطای دسترسی `ForbiddenException('You do not have access to this salon')` (کد HTTP 403) را پرتاب می‌کند.

3. **یکپارچگی و استفاده در سایر بخش‌ها**:
   - این سرویس از `SalonsModule` صادر (`export`) شده است تا ماژول‌هایی مانند آرایشگران (`BarbersModule`) یا خدمات (`ServicesModule`) بتوانند پیش از هرگونه تغییرات، دسترسی کاربر به سالن مورد نظر را تضمین نمایند.
