# ماژول آرایشگرها (Barbers Module)

## معرفی
ماژول **Barbers** وظیفه مدیریت پروفایل آرایشگران (`Barber Profile Management`) را در سامانه نوبت‌دهی آرایشگاه بر عهده دارد. در این معماری، هر آرایشگر دارای یک حساب کاربری پایه در جدول `User` (با نقش `BARBER` و وضعیت `ACTIVE`) و یک رکورد متناظر در جدول `Barber` است که اتصال آرایشگر به سالن مربوطه (`Salon`) و وضعیت فعالیت وی (`isActive`) را نگهداری می‌کند.

این ماژول عملیات جامع CRUD را برای مدیریت آرایشگران تحت کنترل دسترسی چندسطحی (Multi-tenant Salon Access) ارائه می‌دهد؛ به‌طوری‌که مدیران هر سالن (`ADMIN`) تنها به آرایشگران سالن‌های تحت مدیریت خود دسترسی داشته و مدیران ارشد سیستم (`SUPER_ADMIN`) به تمام آرایشگران در سطح پلتفرم دسترسی دارند.

---

## وابستگی‌ها

ماژول `BarbersModule` شامل وابستگی‌های سیستمی و ماژولار زیر است:

### ماژول‌های وارد شده (Imports)
- **`AuthModule`**: جهت احراز هویت توکن‌های JWT و اعمال قوانین نقش‌های کاربری از طریق `JwtAuthGuard` و `RolesGuard`.
- **`SalonsModule`**: جهت دسترسی به سرویس اعتبارسنجی عضویت و دسترسی ادمین به سالن‌ها (`SalonAccessService`).
- **`PrismaModule`**: ماژول گلوبال پایگاه داده جهت دسترسی به `PrismaService` برای انجام عملیات دیتابیس و تراکنش‌ها.

### کنترلرها و ارائه‌دهنده‌ها (Controllers & Providers)
- **Controllers**: `BarbersController`
- **Providers**: `BarbersService`
- **Exports**: `BarbersService` (جهت استفاده در ماژول‌های دیگر نظیر نوبت‌دهی `Appointments`، خدمات آرایشگر `BarberServices` و زمان‌بندی `Schedules`).

```typescript
@Module({
  imports: [
    AuthModule,
    SalonsModule,
  ],
  controllers: [
    BarbersController,
  ],
  providers: [
    BarbersService,
  ],
  exports: [
    BarbersService,
  ],
})
export class BarbersModule {}
```

---

## مدل داده (Data Model)

پروفایل آرایشگر بر اساس مدل Prisma در فایل `schema.prisma` پیاده‌سازی شده است:

```prisma
model Barber {
  id      String @id @default(uuid())
  userId  String @unique
  salonId String

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  salon Salon @relation(fields: [salonId], references: [id], onDelete: Cascade)

  services     BarberService[]
  workingHours WorkingHour[]
  daysOff      DayOff[]
  appointments Appointment[]

  isActive Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([salonId])
  @@index([salonId, isActive])
}
```

### فیلدهای مدل `Barber`
- **`id`** (`String`, UUID): شناسه اختصاصی رکورد آرایشگر.
- **`userId`** (`String`, یکتا): کلید خارجی متصل به جدول `User`. هر حساب کاربری حداکثر می‌تواند یک پروفایل آرایشگر داشته باشد.
- **`salonId`** (`String`): کلید خارجی متصل به جدول `Salon`؛ مشخص‌کننده سالنی که آرایشگر در آن اشتغال دارد.
- **`isActive`** (`Boolean`): وضعیت فعالیت آرایشگر در سالن (پیش‌فرض: `true`).
- **`createdAt`** و **`updatedAt`** (`DateTime`): زمان ایجاد و آخرین به‌روزرسانی رکورد.

### روابط (Relations)
- **`user`**: ارتباط یک‌به‌یک با مدل `User`.
- **`salon`**: ارتباط چندبه‌یک با مدل `Salon`.
- **`services`**: لیست خدمات انتسابی آرایشگر از طریق مدل واسط `BarberService`.
- **`workingHours`**: برنامه ساعات کاری هفتگی آرایشگر از طریق مدل `WorkingHour`.
- **`daysOff`**: روزهای مرخصی و تعطیلی آرایشگر از طریق مدل `DayOff`.
- **`appointments`**: نوبت‌های رزرو شده برای آرایشگر از طریق مدل `Appointment`.

---

## گاردها و امنیت (Guards & Authorization)

تمامی اندپوینت‌های این ماژول بر روی کلاس کنترلر به گاردهای زیر مجهز شده‌اند:

```typescript
@Controller('barbers')
@UseGuards(JwtAuthGuard, RolesGuard)
```

1. **`JwtAuthGuard`**:
   - توکن ارسالی در هدر `Authorization: Bearer <token>` را اعتبارسنجی می‌کند.
   - اطلاعات کاربر احراز هویت شده را در شیء درخواست ذخیره می‌کند.
2. **`RolesGuard`**:
   - به همراه دکوراتور `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)`، دسترسی را منحصراً به مدیران سالن و مدیران ارشد سیستم محدود می‌نماید.
3. **دکوراتور `@CurrentUser()`**:
   - اطلاعات کاربر فعلی (شامل `id`, `phone`, `role`) را برای بررسی سطح دسترسی تزریق می‌کند.
4. **کنترل دسترسی چندمستأجری (`SalonAccessService.assertCanAccessSalon`)**:
   - اگر نقش کاربر `SUPER_ADMIN` باشد، اجازه دسترسی به تمامی سالن‌ها داده می‌شود.
   - اگر نقش کاربر `ADMIN` باشد، عضویت فعال کاربر در سالن هدف در جدول `SalonMembership` بررسی می‌شود. در صورت عدم عضویت یا غیرفعال بودن عضویت، خطای `403 Forbidden` پرتاب می‌شود.

---

## اندپوینت‌ها (Endpoints)

### جدول خلاصه اندپوینت‌ها

| متد | مسیر | احراز هویت | نقش‌های مجاز | توضیحات |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/barbers` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | دریافت لیست آرایشگران (با فیلتر شناسه سالن) |
| `GET` | `/barbers/:id` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | دریافت مشخصات یک آرایشگر بر اساس شناسه |
| `POST` | `/barbers` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | ایجاد آرایشگر جدید در یک سالن |
| `PATCH` | `/barbers/:id` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | به‌روزرسانی اطلاعات حساب و وضعیت آرایشگر |
| `DELETE` | `/barbers/:id` | JWT Bearer | `ADMIN`, `SUPER_ADMIN` | غیرفعال‌سازی نرم (Soft Delete) آرایشگر |

---

### ۱. دریافت لیست آرایشگران (`GET /barbers`)

این اندپوینت لیست آرایشگران را بر اساس تاریخ ایجاد به صورت نزولی بازمی‌گرداند.

- **مسیر**: `GET /barbers`
- **احراز هویت**: نیاز به توکن JWT معتبر دارد.
- **نقش‌های مجاز**: `ADMIN`, `SUPER_ADMIN`
- **پارامترهای Query**:
  - `salonId` (`string`, اختیاری برای `SUPER_ADMIN`، **الزامی برای `ADMIN`**): شناسه سالن مورد نظر برای فیلتر آرایشگران.

#### منطق اعتبارسنجی
- اگر نقش کاربر `SUPER_ADMIN` نباشد و پارامتر `salonId` ارسال نشود، خطای `400 Bad Request` برگردانده می‌شود.
- در صورت ارسال `salonId`، دسترسی کاربر ادمین به سالن بررسی می‌شود (`SalonAccessService`).

#### نمونه درخواست (Request)
```http
GET /barbers?salonId=9c84910b-60d9-4828-b808-142f1cf5b263 HTTP/1.1
Host: api.barbershop.local
Authorization: Bearer <JWT_TOKEN>
```

#### نمونه پاسخ موفق (Response 200 OK)
```json
[
  {
    "id": "e3012a64-774d-4e94-811c-d784a96df8d0",
    "userId": "28e08d6c-2f9b-4eef-aef1-344498ec5164",
    "salonId": "9c84910b-60d9-4828-b808-142f1cf5b263",
    "isActive": true,
    "createdAt": "2026-10-12T10:15:30.000Z",
    "updatedAt": "2026-10-12T10:15:30.000Z",
    "user": {
      "id": "28e08d6c-2f9b-4eef-aef1-344498ec5164",
      "phone": "+989121112233",
      "firstName": "رضا",
      "lastName": "حسینی",
      "role": "BARBER",
      "status": "ACTIVE"
    },
    "salon": {
      "id": "9c84910b-60d9-4828-b808-142f1cf5b263",
      "name": "آرایشگاه کلاسیک",
      "slug": "classic-salon",
      "phone": "02188889900",
      "address": "تهران، خیابان شریعتی",
      "description": "ارائه خدمات نوین پیرایش",
      "timezone": "Asia/Tehran",
      "isActive": true,
      "createdAt": "2026-10-10T08:00:00.000Z",
      "updatedAt": "2026-10-10T08:00:00.000Z"
    }
  }
]
```

#### خطاهای محتمل (Error Responses)
- **`400 Bad Request`**: عدم ارسال `salonId` توسط کاربری با نقشی غیر از `SUPER_ADMIN`.
  ```json
  {
    "statusCode": 400,
    "message": "salonId is required",
    "error": "Bad Request"
  }
  ```
- **`401 Unauthorized`**: توکن نامعتبر یا منقضی شده.
- **`403 Forbidden`**: کاربر نقش لازم را ندارد یا به سالن درخواستی دسترسی ندارد (`You do not have access to this salon`).

---

### ۲. دریافت مشخصات یک آرایشگر (`GET /barbers/:id`)

اطلاعات کامل یک آرایشگر به همراه اطلاعات کاربر و سالن مربوطه را بازمی‌گرداند.

- **مسیر**: `GET /barbers/:id`
- **احراز هویت**: نیاز به توکن JWT معتبر دارد.
- **نقش‌های مجاز**: `ADMIN`, `SUPER_ADMIN`
- **پارامترهای مسیر (Path Params)**:
  - `id` (`string`, UUID): شناسه رکورد آرایشگر (`Barber.id`).

#### منطق اعتبارسنجی
- بررسی وجود آرایشگر با شناسه مورد نظر.
- بررسی دسترسی کاربر جاری به سالنی که آرایشگر در آن تعریف شده است.

#### نمونه درخواست (Request)
```http
GET /barbers/e3012a64-774d-4e94-811c-d784a96df8d0 HTTP/1.1
Host: api.barbershop.local
Authorization: Bearer <JWT_TOKEN>
```

#### نمونه پاسخ موفق (Response 200 OK)
```json
{
  "id": "e3012a64-774d-4e94-811c-d784a96df8d0",
  "userId": "28e08d6c-2f9b-4eef-aef1-344498ec5164",
  "salonId": "9c84910b-60d9-4828-b808-142f1cf5b263",
  "isActive": true,
  "createdAt": "2026-10-12T10:15:30.000Z",
  "updatedAt": "2026-10-12T10:15:30.000Z",
  "user": {
    "id": "28e08d6c-2f9b-4eef-aef1-344498ec5164",
    "phone": "+989121112233",
    "firstName": "رضا",
    "lastName": "حسینی",
    "role": "BARBER",
    "status": "ACTIVE"
  },
  "salon": {
    "id": "9c84910b-60d9-4828-b808-142f1cf5b263",
    "name": "آرایشگاه کلاسیک",
    "slug": "classic-salon",
    "phone": "02188889900",
    "address": "تهران، خیابان شریعتی",
    "description": "ارائه خدمات نوین پیرایش",
    "timezone": "Asia/Tehran",
    "isActive": true,
    "createdAt": "2026-10-10T08:00:00.000Z",
    "updatedAt": "2026-10-10T08:00:00.000Z"
  }
}
```

#### خطاهای محتمل (Error Responses)
- **`404 Not Found`**: در صورتی که آرایشگری با این شناسه یافت نشود (`Barber not found`).
- **`403 Forbidden`**: کاربر به سالن این آرایشگر دسترسی ندارد.

---

### ۳. ایجاد آرایشگر جدید (`POST /barbers`)

یک کاربر جدید با نقش `BARBER` ایجاد کرده و پروفایل آرایشگر را در سالن مشخص شده ثبت می‌نماید. عملیات ایجاد در قالب یک تراکنش اتمیک دیتابیس (`$transaction`) انجام می‌شود.

- **مسیر**: `POST /barbers`
- **احراز هویت**: نیاز به توکن JWT معتبر دارد.
- **نقش‌های مجاز**: `ADMIN`, `SUPER_ADMIN`
- **بدنه درخواست (Request Body)**: شیء بر مبنای `CreateBarberDto`.

#### منطق اعتبارسنجی و قوانین بیزنس
1. بررسی دسترسی کاربر به سالن مشخص شده (`salonId`).
2. بررسی وجود سالن در سیستم؛ در غیر این صورت: `404 Not Found`.
3. بررسی فعال بودن سالن (`salon.isActive`)؛ در صورت غیرفعال بودن: خطای `409 Conflict`.
4. بررسی تکراری نبودن شماره تلفن (`phone`) در جدول `User`؛ در صورت وجود کاربر با این شماره: خطای `409 Conflict`.
5. ایجاد کاربر در جدول `User` با `role: BARBER` و `status: ACTIVE`.
6. ایجاد رکورد در جدول `Barber` با ارجاع به کاربر ایجاد شده و شناسه سالن.

#### نمونه درخواست (Request)
```http
POST /barbers HTTP/1.1
Host: api.barbershop.local
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "salonId": "9c84910b-60d9-4828-b808-142f1cf5b263",
  "phone": "+989123334455",
  "firstName": "امیر",
  "lastName": "احمدی"
}
```

#### نمونه پاسخ موفق (Response 201 Created)
```json
{
  "id": "f516a2d1-2135-47e2-89b3-1f1489eac57b",
  "userId": "a7251bc2-0348-4cb1-a083-d5e08b1a4159",
  "salonId": "9c84910b-60d9-4828-b808-142f1cf5b263",
  "isActive": true,
  "createdAt": "2026-10-12T11:00:00.000Z",
  "updatedAt": "2026-10-12T11:00:00.000Z",
  "user": {
    "id": "a7251bc2-0348-4cb1-a083-d5e08b1a4159",
    "phone": "+989123334455",
    "firstName": "امیر",
    "lastName": "احمدی",
    "role": "BARBER",
    "status": "ACTIVE"
  },
  "salon": {
    "id": "9c84910b-60d9-4828-b808-142f1cf5b263",
    "name": "آرایشگاه کلاسیک",
    "slug": "classic-salon",
    "phone": "02188889900",
    "address": "تهران، خیابان شریعتی",
    "description": "ارائه خدمات نوین پیرایش",
    "timezone": "Asia/Tehran",
    "isActive": true,
    "createdAt": "2026-10-10T08:00:00.000Z",
    "updatedAt": "2026-10-10T08:00:00.000Z"
  }
}
```

#### خطاهای محتمل (Error Responses)
- **`400 Bad Request`**: خطای اعتبارسنجی بدنه درخواست (مانند خالی بودن `salonId` یا `phone`).
- **`404 Not Found`**: سالن مورد نظر یافت نشد (`Salon not found`).
- **`409 Conflict`**:
  - سالن غیرفعال است (`Cannot create barber for inactive salon`).
  - کاربری با این شماره تلفن از قبل وجود دارد (`A user with this phone already exists`).
- **`403 Forbidden`**: کاربر ادمین دسترسی مدیریت این سالن را ندارد.

---

### ۴. ویرایش اطلاعات آرایشگر (`PATCH /barbers/:id`)

اطلاعات کاربری آرایشگر (شامل نام، نام خانوادگی، شماره تماس) یا وضعیت فعالیت آرایشگر (`isActive`) را به‌روزرسانی می‌کند.

- **مسیر**: `PATCH /barbers/:id`
- **احراز هویت**: نیاز به توکن JWT معتبر دارد.
- **نقش‌های مجاز**: `ADMIN`, `SUPER_ADMIN`
- **پارامترهای مسیر (Path Params)**:
  - `id` (`string`, UUID): شناسه رکورد آرایشگر.
- **بدنه درخواست (Request Body)**: شیء بر مبنای `UpdateBarberDto`.

#### منطق اعتبارسنجی
1. اعتبارسنجی وجود آرایشگر و کنترل دسترسی به سالن با فراخوانی متد `findById`.
2. در صورتی که فیلد `phone` در بدنه درخواست ارائه شده و با شماره فعلی کاربر متفاوت باشد، یکتا بودن شماره تلفن جدید در جدول `User` بررسی می‌شود؛ در صورت تکراری بودن خطای `409 Conflict` پرتاب می‌شود.
3. در قالب تراکنش اتمیک دیتابیس (`$transaction`):
   - مقادیر `phone`، `firstName` و `lastName` در صورت تعریف شدن در جدول `User` به‌روزرسانی می‌شوند.
   - مقدار `isActive` در جدول `Barber` در صورت ارسال به‌روزرسانی می‌شود.
4. خروجی همراه با اطلاعات بازبینی شده کاربر و سالن بازگردانده می‌شود.

#### نمونه درخواست (Request)
```http
PATCH /barbers/f516a2d1-2135-47e2-89b3-1f1489eac57b HTTP/1.1
Host: api.barbershop.local
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "firstName": "امیرحسین",
  "phone": "+989129998877",
  "isActive": false
}
```

#### نمونه پاسخ موفق (Response 200 OK)
```json
{
  "id": "f516a2d1-2135-47e2-89b3-1f1489eac57b",
  "userId": "a7251bc2-0348-4cb1-a083-d5e08b1a4159",
  "salonId": "9c84910b-60d9-4828-b808-142f1cf5b263",
  "isActive": false,
  "createdAt": "2026-10-12T11:00:00.000Z",
  "updatedAt": "2026-10-12T11:30:00.000Z",
  "user": {
    "id": "a7251bc2-0348-4cb1-a083-d5e08b1a4159",
    "phone": "+989129998877",
    "firstName": "امیرحسین",
    "lastName": "احمدی",
    "role": "BARBER",
    "status": "ACTIVE"
  },
  "salon": {
    "id": "9c84910b-60d9-4828-b808-142f1cf5b263",
    "name": "آرایشگاه کلاسیک",
    "slug": "classic-salon",
    "phone": "02188889900",
    "address": "تهران، خیابان شریعتی",
    "description": "ارائه خدمات نوین پیرایش",
    "timezone": "Asia/Tehran",
    "isActive": true,
    "createdAt": "2026-10-10T08:00:00.000Z",
    "updatedAt": "2026-10-10T08:00:00.000Z"
  }
}
```

#### خطاهای محتمل (Error Responses)
- **`404 Not Found`**: آرایشگر مورد نظر پیدا نشد.
- **`409 Conflict`**: شماره تلفن جدید قبلاً به کاربر دیگری اختصاص یافته است (`A user with this phone already exists`).
- **`403 Forbidden`**: عدم دسترسی به سالن این آرایشگر.

---

### ۵. غیرفعال‌سازی آرایشگر (`DELETE /barbers/:id`)

این اندپوینت آرایشگر را به صورت نرم (Soft Delete) غیرفعال می‌کند (`isActive: false`). اطلاعات آرایشگر و نوبت‌های پیشین وی در پایگاه داده جهت حفظ تاریخچه حفظ می‌شوند.

- **مسیر**: `DELETE /barbers/:id`
- **احراز هویت**: نیاز به توکن JWT معتبر دارد.
- **نقش‌های مجاز**: `ADMIN`, `SUPER_ADMIN`
- **پارامترهای مسیر (Path Params)**:
  - `id` (`string`, UUID): شناسه رکورد آرایشگر.

#### منطق اعتبارسنجی
1. اعتبارسنجی وجود آرایشگر و دسترسی به سالن با `findById`.
2. به‌روزرسانی فیلد `isActive` در مدل `Barber` به مقدار `false`.

#### نمونه درخواست (Request)
```http
DELETE /barbers/f516a2d1-2135-47e2-89b3-1f1489eac57b HTTP/1.1
Host: api.barbershop.local
Authorization: Bearer <JWT_TOKEN>
```

#### نمونه پاسخ موفق (Response 200 OK)
```json
{
  "id": "f516a2d1-2135-47e2-89b3-1f1489eac57b",
  "userId": "a7251bc2-0348-4cb1-a083-d5e08b1a4159",
  "salonId": "9c84910b-60d9-4828-b808-142f1cf5b263",
  "isActive": false,
  "createdAt": "2026-10-12T11:00:00.000Z",
  "updatedAt": "2026-10-12T11:45:00.000Z"
}
```

#### خطاهای محتمل (Error Responses)
- **`404 Not Found`**: آرایشگر مورد نظر یافت نشد.
- **`403 Forbidden`**: کاربر به سالن این آرایشگر دسترسی ندارد.

---

## DTOs (Data Transfer Objects)

ماژول آرایشگران از دو DTO برای انتقال و اعتبارسنجی داده‌ها با کتابخانه `class-validator` بهره می‌برد:

### ۱. `CreateBarberDto`
مسیر فایل: `src/barbers/dto/create-barber.dto.ts`

این DTO جهت ارسال اطلاعات اولیه برای ثبت آرایشگر و ایجاد حساب کاربری متناظر به کار می‌رود.

| نام فیلد | نوع داده | وضعیت | دکوراتورهای اعتبارسنجی | توضیحات |
| :--- | :--- | :--- | :--- | :--- |
| `salonId` | `string` | الزامی | `@IsString()`, `@IsNotEmpty()` | شناسه سالنی که آرایشگر به آن تعلق دارد |
| `phone` | `string` | الزامی | `@IsString()`, `@IsNotEmpty()` | شماره تماس یکتای آرایشگر (جهت ورود به سیستم) |
| `firstName` | `string` | اختیاری | `@IsOptional()`, `@IsString()` | نام آرایشگر |
| `lastName` | `string` | اختیاری | `@IsOptional()`, `@IsString()` | نام خانوادگی آرایشگر |

#### کد پیاده‌سازی DTO:
```typescript
import {
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBarberDto {
  @IsString()
  @IsNotEmpty()
  salonId: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
```

#### نمونه JSON معتبر:
```json
{
  "salonId": "9c84910b-60d9-4828-b808-142f1cf5b263",
  "phone": "+989123456789",
  "firstName": "سامان",
  "lastName": "پناهی"
}
```

---

### ۲. `UpdateBarberDto`
مسیر فایل: `src/barbers/dto/update-barber.dto.ts`

این DTO جهت ویرایش اختیاری مشخصات کاربری و وضعیت آرایشگر به کار می‌رود. تمام فیلدهای آن اختیاری هستند.

| نام فیلد | نوع داده | وضعیت | دکوراتورهای اعتبارسنجی | توضیحات |
| :--- | :--- | :--- | :--- | :--- |
| `firstName` | `string` | اختیاری | `@IsOptional()`, `@IsString()` | نام ویرایش شده آرایشگر |
| `lastName` | `string` | اختیاری | `@IsOptional()`, `@IsString()` | نام خانوادگی ویرایش شده آرایشگر |
| `phone` | `string` | اختیاری | `@IsOptional()`, `@IsString()` | شماره تماس جدید آرایشگر |
| `isActive` | `boolean` | اختیاری | `@IsOptional()`, `@IsBoolean()` | وضعیت فعال/غیرفعال بودن آرایشگر در سالن |

#### کد پیاده‌سازی DTO:
```typescript
import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateBarberDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

#### نمونه JSON معتبر:
```json
{
  "firstName": "سامان",
  "lastName": "پناهی اصل",
  "isActive": true
}
```

---

## سرویس (BarbersService)
مسیر فایل: `src/barbers/barbers.service.ts`

کلاس `BarbersService` لایه منطق بیزنس (Business Logic) ماژول را در بر می‌گیرد و متدهای آن به شرح زیر هستند:

```typescript
@Injectable()
export class BarbersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salonAccessService: SalonAccessService,
  ) {}
  ...
}
```

### ۱. متد `create`
```typescript
async create(dto: CreateBarberDto, userId: string, role: UserRole)
```
- **هدف**: ایجاد هم‌زمان کاربر در جدول `User` و پروفایل در جدول `Barber`.
- **پارامترها**:
  - `dto: CreateBarberDto`: داده‌های ورودی ایجاد آرایشگر.
  - `userId: string`: شناسه کاربری که درخواست ایجاد را ارسال کرده است.
  - `role: UserRole`: نقش کاربر درخواست‌دهنده (`ADMIN` یا `SUPER_ADMIN`).
- **مراحل اجرا**:
  1. فراخوانی `assertCanAccessSalon(userId, role, dto.salonId)` برای اعتبارسنجی دسترسی به سالن.
  2. بررسی وجود سالن با `prisma.salon.findUnique`؛ پرتاب `NotFoundException('Salon not found')` در صورت عدم وجود.
  3. بررسی فعال بودن سالن (`salon.isActive`)؛ پرتاب `ConflictException('Cannot create barber for inactive salon')` در صورت غیرفعال بودن سالن.
  4. استعلام یکتایی شماره تلفن در جدول `User`؛ پرتاب `ConflictException('A user with this phone already exists')` در صورت وجود رکورد تکراری.
  5. اجرای تراکنش دیتابیس `prisma.$transaction`:
     - ثبت کاربر در جدول `User` با مقادیر `role: UserRole.BARBER` و `status: UserStatus.ACTIVE`.
     - ثبت رکورد در جدول `Barber` با اتصال به کاربر و سالن.
     - بازگرداندن آرایشگر به همراه اطلاعات گزینش‌شده کاربر (`id`, `phone`, `firstName`, `lastName`, `role`, `status`) و اطلاعات سالن.

---

### ۲. متد `findAll`
```typescript
async findAll(userId: string, role: UserRole, salonId?: string)
```
- **هدف**: دریافت لیست آرایشگران بر اساس مجوزهای دسترسی.
- **پارامترها**:
  - `userId: string`: شناسه کاربر درخواست‌دهنده.
  - `role: UserRole`: نقش کاربر درخواست‌دهنده.
  - `salonId?: string`: فیلتر اختیاری شناسه سالن.
- **مراحل اجرا**:
  1. اگر نقش کاربر `SUPER_ADMIN` نباشد و `salonId` ارسال نشده باشد، پرتاب `BadRequestException('salonId is required')`.
  2. در صورت وجود `salonId`، بررسی دسترسی با `assertCanAccessSalon(userId, role, salonId)`.
  3. اجرای کوئری `prisma.barber.findMany` با شرط فیلتر سالن، ترتیب نزولی بر اساس `createdAt: 'desc'` و درج اطلاعات کاربر و سالن.

---

### ۳. متد `findById`
```typescript
async findById(id: string, userId: string, role: UserRole)
```
- **هدف**: دریافت جزئیات یک آرایشگر خاص همراه با اعتبارسنجی مالکیت/دسترسی سالن.
- **پارامترها**:
  - `id: string`: شناسه رکورد آرایشگر.
  - `userId: string`: شناسه کاربر درخواست‌دهنده.
  - `role: UserRole`: نقش کاربر درخواست‌دهنده.
- **مراحل اجرا**:
  1. کوئری به جدول `Barber` بر اساس شناسه به همراه `user` و `salon`.
  2. در صورت عدم وجود رکورد، پرتاب `NotFoundException('Barber not found')`.
  3. اعتبارسنجی دسترسی به سالن آرایشگر با فراخوانی `assertCanAccessSalon(userId, role, barber.salonId)`.
  4. بازگرداندن داده‌های آرایشگر.

---

### ۴. متد `update`
```typescript
async update(id: string, dto: UpdateBarberDto, userId: string, role: UserRole)
```
- **هدف**: به‌روزرسانی اطلاعات حساب کاربری و/یا وضعیت فعال بودن پروفایل آرایشگر.
- **پارامترها**:
  - `id: string`: شناسه رکورد آرایشگر.
  - `dto: UpdateBarberDto`: فیلدهای ارسالی جهت ویرایش.
  - `userId: string`: شناسه کاربر درخواست‌دهنده.
  - `role: UserRole`: نقش کاربر درخواست‌دهنده.
- **مراحل اجرا**:
  1. استعلام آرایشگر و بررسی دسترسی با فراخوانی `this.findById(id, userId, role)`.
  2. در صورت ارسال `phone` جدید، بررسی عدم وجود شماره تلفن در جدول `User` در سایر رکوردها؛ پرتاب `ConflictException('A user with this phone already exists')`.
  3. اجرای تراکنش دیتابیس `prisma.$transaction`:
     - به‌روزرسانی فیلدهای `phone`, `firstName`, `lastName` در جدول `User` (تنها در صورتی که در DTO تعریف شده باشند).
     - به‌روزرسانی فیلد `isActive` در جدول `Barber` در صورت ارسال.
  4. بازگرداندن شیء به‌روز شده آرایشگر به همراه اطلاعات کاربر و سالن.

---

### ۵. متد `remove`
```typescript
async remove(id: string, userId: string, role: UserRole)
```
- **هدف**: غیرفعال‌سازی نرم (Soft Delete) رکورد آرایشگر.
- **پارامترها**:
  - `id: string`: شناسه رکورد آرایشگر.
  - `userId: string`: شناسه کاربر درخواست‌دهنده.
  - `role: UserRole`: نقش کاربر درخواست‌دهنده.
- **مراحل اجرا**:
  1. بررسی وجود آرایشگر و مجوز دسترسی به سالن با فراخوانی `this.findById(id, userId, role)`.
  2. به‌روزرسانی وضعیت آرایشگر به `isActive: false` در جدول `Barber` از طریق `prisma.barber.update`.
  3. بازگرداندن رکورد آرایشگر به‌روزرسانی‌شده.
