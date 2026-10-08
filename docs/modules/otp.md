# OTP Module

## Purpose

ماژول OTP مسئول تولید، ذخیره، اعتبارسنجی و مصرف کد یک‌بارمصرف (OTP) برای احراز هویت کاربران است.

در معماری فعلی، OTP به‌صورت یک ماژول مستقل پیاده‌سازی شده اما endpoint مستقیمی ندارد.

`AuthModule` از `OtpService` استفاده می‌کند و endpointهای مربوط به درخواست و تأیید OTP را در اختیار کلاینت قرار می‌دهد.

---

## Responsibilities

ماژول OTP مسئولیت‌های زیر را بر عهده دارد:

* تولید کد OTP شش‌رقمی
* Hash کردن کد OTP
* ذخیره OTP در PostgreSQL
* تعیین زمان انقضای OTP
* invalidate کردن OTPهای قبلی
* محدود کردن تعداد تلاش‌های ناموفق
* بررسی اعتبار OTP
* مصرف کردن OTP بعد از verification موفق

ماژول OTP مسئول موارد زیر نیست:

* ایجاد User
* صدور JWT
* صدور Refresh Token
* ارسال واقعی SMS
* مدیریت Session

این مسئولیت‌ها در `AuthModule` و `UsersModule` انجام می‌شوند.

---

## Data Model

OTPها در مدل `OtpCode` ذخیره می‌شوند.

مدل فعلی:

```prisma
model OtpCode {
  id        String    @id @default(uuid())
  phone     String
  codeHash  String
  expiresAt DateTime
  attempts  Int       @default(0)
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([phone, createdAt])
  @@index([expiresAt])
}
```

### Fields

| Field       | Description                          |
| ----------- | ------------------------------------ |
| `id`        | شناسه یکتا                           |
| `phone`     | شماره تلفنی که OTP برای آن ایجاد شده |
| `codeHash`  | نسخه Hash شده OTP                    |
| `expiresAt` | زمان انقضای OTP                      |
| `attempts`  | تعداد تلاش‌های ناموفق                |
| `usedAt`    | زمان مصرف OTP                        |
| `createdAt` | زمان ایجاد OTP                       |

خود OTP به‌صورت plaintext در دیتابیس ذخیره نمی‌شود.

---

## Service

### `OtpService`

سرویس اصلی OTP در:

```text
src/otp/otp.service.ts
```

قرار دارد.

این سرویس توسط `AuthService` استفاده می‌شود.

---

## Generate OTP

متد:

```ts
generate(phone: string)
```

برای ایجاد OTP جدید استفاده می‌شود.

### Flow

```text
Phone
  ↓
Generate 6-digit OTP
  ↓
Hash OTP with bcrypt
  ↓
Invalidate previous unused OTPs
  ↓
Create OtpCode
  ↓
Return OTP + expiration
```

کد OTP به‌صورت تصادفی شش‌رقمی تولید می‌شود.

محدوده کد:

```text
100000 - 999999
```

---

## OTP Expiration

مدت اعتبار OTP فعلی:

```text
2 minutes
```

در کد:

```ts
private readonly otpExpiresInMs = 2 * 60 * 1000;
```

بنابراین هنگام ایجاد OTP:

```text
createdAt
   +
2 minutes
   ↓
expiresAt
```

بعد از `expiresAt`، OTP معتبر نیست.

---

## Previous OTP Invalidation

قبل از ایجاد OTP جدید، OTPهای قبلی همان شماره که هنوز مصرف نشده‌اند، invalidate می‌شوند.

یعنی اگر کاربر چند بار درخواست OTP بدهد:

```text
Request #1
    ↓
OTP A

Request #2
    ↓
OTP A → Used/Invalidated
OTP B → Active
```

در نتیجه فقط آخرین OTP درخواست‌شده قابل استفاده خواهد بود.

---

## Verify OTP

متد:

```ts
verify(phone: string, code: string)
```

برای بررسی OTP استفاده می‌شود.

### Verification Flow

```text
Phone + OTP
    ↓
Find latest unused OTP
    ↓
OTP exists?
    ├── No → Error
    ↓
Check expiration
    ├── Expired → Error
    ↓
Check attempts
    ├── >= 5 → Error
    ↓
bcrypt.compare()
    ↓
Valid?
├── No → attempts++
│        → Error
│
└── Yes
     ↓
    usedAt = now
     ↓
    Success
```

---

## Maximum Attempts

حداکثر تعداد تلاش برای هر OTP:

```text
5 attempts
```

در کد:

```ts
private readonly maxAttempts = 5;
```

اگر تعداد تلاش‌ها به ۵ برسد، OTP دیگر قابل verification نیست.

برای OTP اشتباه، مقدار `attempts` افزایش پیدا می‌کند.

---

## OTP Consumption

پس از verification موفق:

```ts
usedAt = new Date()
```

ذخیره می‌شود.

بنابراین OTP نمی‌تواند دوباره استفاده شود.

مثال:

```text
OTP created
   ↓
Verify #1 → Success
   ↓
usedAt = current time
   ↓
Verify #2 → OTP not available
```

---

## Security

OTP plaintext در دیتابیس ذخیره نمی‌شود.

هنگام ایجاد:

```text
OTP
 ↓
bcrypt.hash()
 ↓
codeHash
```

هنگام verification:

```text
Input OTP
 ↓
bcrypt.compare()
 ↓
Valid / Invalid
```

این روش باعث می‌شود مقدار واقعی OTP در دیتابیس نگهداری نشود.

---

## API Endpoints

خود `OtpModule` هیچ Controller مستقیمی ندارد.

Endpointهای OTP در `AuthController` قرار دارند.

### Request OTP

```http
POST /api/auth/request-otp
```

Request:

```json
{
  "phone": "09121234567"
}
```

DTO:

```text
RequestOtpDto
```

مسیر:

```text
src/auth/dto/request-otp.dto.ts
```

---

### Response

در implementation فعلی:

```json
{
  "message": "OTP sent successfully",
  "expiresAt": "2026-10-08T20:32:00.000Z",
  "otp": "123456"
}
```

> `otp` در response فعلی فقط برای development وجود دارد و نباید در production به client برگردانده شود.

---

## Verify OTP Endpoint

```http
POST /api/auth/verify-otp
```

Request:

```json
{
  "phone": "09121234567",
  "code": "123456"
}
```

DTO:

```text
VerifyOtpDto
```

مسیر:

```text
src/auth/dto/verify-otp.dto.ts
```

Verification توسط:

```text
AuthController
    ↓
AuthService
    ↓
OtpService.verify()
```

انجام می‌شود.

---

## Authentication Integration

OTP به‌تنهایی کاربر را authenticate نمی‌کند.

پس از verification موفق، `AuthService` کاربر را پیدا می‌کند:

```text
OTP Verification
       ↓
UsersService.findByPhone()
       ↓
User exists?
```

اگر کاربر وجود نداشته باشد:

```text
UsersService.createCustomer()
```

اجرا می‌شود.

در نتیجه اولین login کاربر می‌تواند باعث ایجاد User و Customer شود.

سپس:

```text
User
 ↓
Generate Access Token
 ↓
Generate Refresh Token
 ↓
Store Refresh Token Hash
 ↓
Return Tokens
```

انجام می‌شود.

---

## Complete Authentication Flow

```text
Client
  │
  │ POST /api/auth/request-otp
  ↓
AuthController
  ↓
AuthService
  ↓
OtpService.generate()
  ↓
OtpCode
  │
  └── OTP created
       │
       │
Client enters OTP
       │
       │ POST /api/auth/verify-otp
       ↓
AuthController
       ↓
AuthService
       ↓
OtpService.verify()
       ↓
OTP valid
       ↓
UsersService.findByPhone()
       │
       ├── User exists
       │
       └── User does not exist
               ↓
        createCustomer()
       ↓
Generate JWT
       ↓
Store Refresh Token Hash
       ↓
Return Authentication Tokens
```

---

## Business Rules

### 1. OTP عمر محدود دارد

OTP فقط ۲ دقیقه معتبر است.

### 2. OTP فقط یک بار مصرف است

بعد از verification موفق، مقدار `usedAt` تنظیم می‌شود.

### 3. OTP قبلی invalidate می‌شود

با ایجاد OTP جدید، OTPهای قبلی استفاده‌نشده برای همان شماره invalidate می‌شوند.

### 4. تعداد تلاش محدود است

هر OTP حداکثر ۵ تلاش verification دارد.

### 5. OTP به شماره تلفن وابسته است

OTP بر اساس `phone` پیدا می‌شود و برای شماره دیگری قابل استفاده نیست.

### 6. OTP در دیتابیس Hash می‌شود

مقدار plaintext OTP در `OtpCode.codeHash` ذخیره نمی‌شود.

---

## Error Cases

در implementation فعلی، شرایط زیر باعث خطا می‌شوند:

### OTP Not Found

```text
OTP not found
```

### Expired OTP

```text
OTP has expired
```

### Too Many Attempts

```text
Too many attempts
```

### Invalid OTP

```text
Invalid OTP
```

---

## Module Structure

ساختار فعلی:

```text
src/
└── otp/
    ├── otp.module.ts
    └── otp.service.ts
```

DTOهای مرتبط با API در AuthModule قرار دارند:

```text
src/
└── auth/
    └── dto/
        ├── request-otp.dto.ts
        ├── verify-otp.dto.ts
        └── refresh-token.dto.ts
```

---

## Related Modules

### AuthModule

مصرف‌کننده اصلی `OtpService` است.

مسئول:

* OTP request
* OTP verification
* User authentication
* JWT generation

### UsersModule

بعد از verification موفق برای پیدا کردن یا ایجاد User استفاده می‌شود.

### PrismaModule

برای دسترسی به جدول `OtpCode` در PostgreSQL استفاده می‌شود.

---

## Current Limitations

پیاده‌سازی فعلی برای development مناسب است، اما چند مورد قبل از production باید تکمیل شود.

### SMS Provider

در حال حاضر OTP واقعاً از طریق SMS ارسال نمی‌شود.

باید یک SMS provider به سیستم اضافه شود.

مثلاً:

```text
AuthService
   ↓
OtpService
   ↓
SMS Provider
   ↓
User Phone
```

### Remove OTP From Response

در production نباید این مقدار:

```json
{
  "otp": "123456"
}
```

در response قرار داشته باشد.

### Rate Limiting

در حال حاضر محدودیت مشخصی برای تعداد درخواست‌های OTP وجود ندارد.

بهتر است مواردی مانند:

```text
per phone
per IP
per time window
```

محدود شوند.

### Phone Normalization

شماره تلفن باید قبل از ذخیره و جستجو normalize شود تا فرمت‌های مختلف یک شماره باعث ایجاد Userهای متفاوت نشوند.

مثلاً باید تصمیم مشخصی درباره فرمت‌هایی مانند:

```text
09121234567
+989121234567
989121234567
```

گرفته شود.

---

## Future Improvements

موارد زیر در نسخه‌های بعدی قابل اضافه شدن هستند:

* اتصال به SMS Provider
* Rate limiting
* Phone normalization
* جلوگیری از OTP enumeration
* Logging مناسب
* Monitoring
* Cleanup کردن OTPهای expired
* محدودیت تعداد درخواست OTP
* مدیریت retry ارسال SMS
* configurable بودن expiration و max attempts
* استفاده از cryptographically secure random برای تولید OTP
* تست‌های unit و integration برای OTP flow

این موارد در حال حاضر بخشی از implementation موجود نیستند و نباید به‌عنوان قابلیت فعلی سیستم در نظر گرفته شوند.

---

## Summary

`OtpModule` در معماری فعلی یک سرویس داخلی برای مدیریت OTP است.

مسیر اصلی آن:

```text
AuthController
      ↓
AuthService
      ↓
OtpService
      ↓
PrismaService
      ↓
PostgreSQL
```

OTP:

* شش‌رقمی است
* ۲ دقیقه اعتبار دارد
* با bcrypt hash می‌شود
* حداکثر ۵ تلاش دارد
* یک‌بار مصرف است
* با OTP جدید قبلی invalidate می‌شود

احراز هویت کامل بعد از verification در `AuthService` ادامه پیدا می‌کند و در نهایت JWT و Refresh Token تولید می‌شوند.
