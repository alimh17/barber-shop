# Authentication

## Purpose

ماژول Authentication مسئول احراز هویت کاربران، صدور و مدیریت Access Token و Refresh Token و مدیریت session authentication در API است.

پیاده‌سازی فعلی بر پایه OTP و JWT انجام شده است.

Authentication از چند بخش اصلی تشکیل شده است:

```text
OTP
 │
 ▼
User
 │
 ▼
Access Token + Refresh Token
 │
 ├── Access Token → API Authorization
 │
 └── Refresh Token → Token Renewal
```

---

## Responsibilities

`AuthModule` مسئول موارد زیر است:

* درخواست OTP
* تأیید OTP
* پیدا کردن یا ایجاد Customer هنگام اولین authentication
* صدور Access Token
* صدور Refresh Token
* اعتبارسنجی Refresh Token
* Refresh کردن Tokenها
* Logout
* ارائه اطلاعات کاربر authenticated از طریق `/me`
* اعتبارسنجی Access Token در درخواست‌های محافظت‌شده
* بررسی فعال بودن User هنگام authentication

Authentication از `UsersModule` و `OtpModule` استفاده می‌کند.

---

## Module Structure

ساختار فعلی:

```text
src/
└── auth/
    ├── auth.controller.ts
    ├── auth.service.ts
    ├── auth.module.ts
    │
    ├── decorators/
    │   └── roles.decorator.ts
    │
    ├── dto/
    │   ├── request-otp.dto.ts
    │   ├── verify-otp.dto.ts
    │   └── refresh-token.dto.ts
    │
    ├── guards/
    │   ├── jwt-auth.guard.ts
    │   └── roles.guard.ts
    │
    ├── strategies/
    │   └── jwt.strategy.ts
    │
    └── types/
        └── type.ts
```

---

# Authentication Flow

Authentication فعلی بر پایه شماره تلفن و OTP است.

Flow اصلی:

```text
User
 │
 │ phone
 ▼
POST /api/auth/request-otp
 │
 ▼
OtpService.generate()
 │
 ▼
OTP
 │
 │ code
 ▼
POST /api/auth/verify-otp
 │
 ▼
OtpService.verify()
 │
 ▼
UsersService.findByPhone()
 │
 ├── User exists
 │
 └── User does not exist
          │
          ▼
    createCustomer()
 │
 ▼
Generate Access Token
 │
 ▼
Generate Refresh Token
 │
 ▼
Hash Refresh Token
 │
 ▼
User.refreshTokenHash
 │
 ▼
Return tokens
```

---

# Request OTP

## Endpoint

```http
POST /api/auth/request-otp
```

این endpoint برای شروع authentication استفاده می‌شود.

### Request

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

در DTO فعلی، شماره تلفن فقط به عنوان string و non-empty validation می‌شود.

---

## Flow

```text
POST /auth/request-otp
        │
        ▼
AuthController.requestOtp()
        │
        ▼
AuthService.requestOtp()
        │
        ▼
OtpService.generate()
        │
        ▼
OtpCode
```

---

## Current Response

در implementation فعلی:

```json
{
  "message": "OTP sent successfully",
  "expiresAt": "2026-10-08T20:32:00.000Z",
  "otp": "123456"
}
```

فیلد `otp` در حال حاضر برای development در response قرار دارد.

این رفتار برای production مناسب نیست و باید بعداً حذف شود.

در production انتظار می‌رود:

```text
AuthService
   ↓
OtpService
   ↓
SMS Provider
   ↓
User Phone
```

و خود OTP در API response برگردانده نشود.

---

# Verify OTP

## Endpoint

```http
POST /api/auth/verify-otp
```

### Request

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

---

## Flow

```text
POST /auth/verify-otp
        │
        ▼
AuthController.verifyOtp()
        │
        ▼
AuthService.verifyOtp()
        │
        ▼
OtpService.verify()
        │
        ▼
OTP Valid?
   │
   ├── No → Error
   │
   └── Yes
          │
          ▼
UsersService.findByPhone()
          │
       ┌──┴──┐
       │     │
     Found  Not Found
       │     │
       │     ▼
       │ createCustomer()
       │     │
       └──┬──┘
          ▼
    Check User Status
          │
          ▼
     Generate Tokens
```

---

# First Authentication

اگر User برای اولین بار وارد سیستم شود، `AuthService` ابتدا با شماره تلفن User را پیدا می‌کند.

```ts
usersService.findByPhone(phone)
```

اگر User وجود نداشته باشد:

```ts
usersService.createCustomer(phone)
```

اجرا می‌شود.

در نتیجه:

```text
Phone
  ↓
OTP Verification
  ↓
User not found
  ↓
Create User
  ↓
Create Customer
  ↓
Generate Tokens
```

User جدید با مقادیر زیر ایجاد می‌شود:

```text
role   = CUSTOMER
status = ACTIVE
```

---

# User Status Validation

بعد از پیدا شدن یا ایجاد User، وضعیت User بررسی می‌شود.

فقط Userهای فعال اجازه authentication دارند.

```text
User
 │
 ├── ACTIVE
 │      ↓
 │   Continue
 │
 ├── INACTIVE
 │      ↓
 │   Unauthorized
 │
 └── BLOCKED
        ↓
     Unauthorized
```

در implementation فعلی:

```text
User is not active
```

برای User غیرفعال برگردانده می‌شود.

---

# Access Token

بعد از authentication موفق، Access Token با JWT تولید می‌شود.

Payload فعلی شامل:

```json
{
  "sub": "user-id",
  "phone": "09121234567",
  "role": "CUSTOMER"
}
```

است.

### Purpose

Access Token برای دسترسی به endpointهای محافظت‌شده استفاده می‌شود.

Client آن را در Header ارسال می‌کند:

```http
Authorization: Bearer <access-token>
```

---

# Refresh Token

همزمان با Access Token، Refresh Token نیز تولید می‌شود.

Refresh Token با secret و expiration مستقل از Access Token sign می‌شود.

تنظیمات آن از environment/config دریافت می‌شوند:

```text
JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN
```

---

# Refresh Token Storage

Refresh Token خام در دیتابیس ذخیره نمی‌شود.

Flow:

```text
Refresh Token
      │
      ▼
bcrypt.hash()
      │
      ▼
User.refreshTokenHash
```

بنابراین در دیتابیس مقدار زیر ذخیره می‌شود:

```text
refreshTokenHash
```

نه خود Refresh Token.

---

# Authentication Response

بعد از verification موفق، response شامل Tokenها و اطلاعات پایه User است.

ساختار فعلی:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": {
    "id": "<user-id>",
    "phone": "09121234567",
    "role": "CUSTOMER"
  }
}
```

---

# Get Current User

## Endpoint

```http
GET /api/auth/me
```

این endpoint با `JwtAuthGuard` محافظت شده است.

```text
GET /auth/me
      │
      ▼
JwtAuthGuard
      │
      ▼
JWT Strategy
      │
      ▼
Validate User
      │
      ▼
request.user
```

Controller مقدار `req.user` را برمی‌گرداند.

---

# JWT Authentication

Guard فعلی:

```ts
JwtAuthGuard extends AuthGuard('jwt')
```

است.

JWT از Header زیر استخراج می‌شود:

```http
Authorization: Bearer <access-token>
```

---

# JWT Strategy

`JwtStrategy` مسئول validation کردن Access Token است.

مسیر:

```text
src/auth/strategies/jwt.strategy.ts
```

Strategy ابتدا JWT را validate می‌کند و سپس User را با `sub` از database پیدا می‌کند.

```text
JWT
 │
 ▼
Extract sub
 │
 ▼
UsersService.findById()
 │
 ├── User not found
 │       ↓
 │   Unauthorized
 │
 └── User found
         ↓
   Check status
         │
      ┌──┴──┐
      │     │
   ACTIVE  Other
      │     │
      ▼     ▼
  Continue Unauthorized
```

User نهایی که در `request.user` قرار می‌گیرد شامل:

```json
{
  "id": "<user-id>",
  "phone": "09121234567",
  "role": "CUSTOMER"
}
```

است.

---

# Refresh Token Endpoint

## Endpoint

```http
POST /api/auth/refresh
```

### Request

```json
{
  "refreshToken": "<refresh-token>"
}
```

DTO:

```text
RefreshTokenDto
```

---

## Refresh Flow

```text
Refresh Token
      │
      ▼
Verify JWT Signature
      │
      ▼
Extract User ID
      │
      ▼
UsersService.findById()
      │
      ▼
Check User
      │
      ├── Not found → Unauthorized
      │
      ├── Inactive → Unauthorized
      │
      └── Active
             │
             ▼
      Check refreshTokenHash
             │
             ▼
      bcrypt.compare()
             │
        ┌────┴────┐
        │         │
      Invalid    Valid
        │         │
        ▼         ▼
   Unauthorized Generate new tokens
```

---

# Refresh Token Rotation

در implementation فعلی، بعد از refresh موفق، Tokenهای جدید تولید می‌شوند.

Refresh Token جدید hash شده و جایگزین مقدار قبلی در:

```text
User.refreshTokenHash
```

می‌شود.

بنابراین:

```text
Old Refresh Token
       │
       ▼
Validate
       │
       ▼
Generate New Tokens
       │
       ▼
Hash New Refresh Token
       │
       ▼
Replace Stored Hash
```

این رفتار باعث می‌شود Refresh Token قبلی بعد از rotation دیگر قابل استفاده نباشد.

---

# Logout

## Endpoint

```http
POST /api/auth/logout
```

این endpoint به `JwtAuthGuard` نیاز دارد.

Client باید Access Token را ارسال کند:

```http
Authorization: Bearer <access-token>
```

---

## Logout Flow

```text
POST /auth/logout
       │
       ▼
JwtAuthGuard
       │
       ▼
request.user.id
       │
       ▼
AuthService.logout()
       │
       ▼
UsersService.updateRefreshToken(
    userId,
    null
)
       │
       ▼
refreshTokenHash = null
```

بعد از logout، Refresh Token ذخیره‌شده revoke می‌شود.

Response فعلی:

```json
{
  "message": "Logged out successfully"
}
```

---

# Token Revocation

هنگامی که:

```text
User.refreshTokenHash = null
```

باشد، Refresh Token دیگر قابل استفاده نیست.

در نتیجه:

```text
Refresh Request
      │
      ▼
refreshTokenHash exists?
      │
      ├── No → Refresh token revoked
      │
      └── Yes → Continue validation
```

---

# Roles

سیستم Authentication دارای Role infrastructure نیز هست.

Roleهای فعلی:

```text
SUPER_ADMIN
ADMIN
BARBER
CUSTOMER
```

Decorator:

```ts
@Roles(...)
```

برای مشخص کردن Roleهای مجاز طراحی شده است.

Role metadata با:

```text
ROLES_KEY
```

ذخیره می‌شود.

---

# RolesGuard

`RolesGuard` Roleهای مورد نیاز endpoint را از metadata می‌خواند.

Flow:

```text
Request
  │
  ▼
JwtAuthGuard
  │
  ▼
request.user
  │
  ▼
RolesGuard
  │
  ▼
Required Roles
  │
  ▼
user.role
  │
  ├── Match → Allow
  │
  └── No Match → Deny
```

در implementation فعلی `RolesGuard` وجود دارد و توسط `AuthModule` export می‌شود.

با این حال، endpointهای فعلی `AuthController` از Role restriction استفاده نمی‌کنند.

Role-based authorization در سایر feature modules مانند Appointments استفاده می‌شود.

---

# Security Layers

Authentication فعلی چند لایه امنیتی دارد:

```text
                    Request
                       │
                       ▼
                 JwtAuthGuard
                       │
                       ▼
                  JWT Verify
                       │
                       ▼
                 JwtStrategy
                       │
                       ▼
                  Find User
                       │
                       ▼
               Check User Status
                       │
                       ▼
                 RolesGuard
                       │
                       ▼
                  Controller
```

برای OTP نیز:

```text
Phone + OTP
     │
     ▼
OTP Expiration
     │
     ▼
Attempt Limit
     │
     ▼
bcrypt.compare()
     │
     ▼
OTP Consumption
```

---

# Configuration

Authentication به configurationهای زیر وابسته است:

```text
JWT_ACCESS_SECRET
JWT_ACCESS_EXPIRES_IN

JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN
```

Access Token و Refresh Token از secretهای جداگانه استفاده می‌کنند.

این separation باعث می‌شود secret مربوط به یک نوع Token برای نوع دیگر استفاده نشود.

---

# Current Authentication API

| Method | Endpoint                | Auth Required | Purpose              |
| ------ | ----------------------- | ------------: | -------------------- |
| POST   | `/api/auth/request-otp` |            No | درخواست OTP          |
| POST   | `/api/auth/verify-otp`  |            No | تأیید OTP و login    |
| GET    | `/api/auth/me`          |           Yes | دریافت User فعلی     |
| POST   | `/api/auth/refresh`     |            No | تمدید authentication |
| POST   | `/api/auth/logout`      |           Yes | لغو Refresh Token    |

---

# Business Rules

### 1. فقط User فعال می‌تواند authenticate شود

Userهای `INACTIVE` یا `BLOCKED` اجازه ورود ندارند.

### 2. User جدید از طریق OTP ساخته می‌شود

اگر شماره تلفن قبلاً ثبت نشده باشد، در verification موفق یک Customer ایجاد می‌شود.

### 3. Access Token و Refresh Token جدا هستند

هرکدام secret و expiration configuration مخصوص خود را دارند.

### 4. Refresh Token به صورت hash ذخیره می‌شود

Raw Refresh Token در database ذخیره نمی‌شود.

### 5. Refresh Token قابل rotation است

در refresh موفق، Token جدید ایجاد و hash قبلی جایگزین می‌شود.

### 6. Logout Refresh Token را revoke می‌کند

با قرار دادن:

```text
refreshTokenHash = null
```

Token ذخیره‌شده invalidate می‌شود.

### 7. Access Token از Bearer Header خوانده می‌شود

فرمت درخواست:

```http
Authorization: Bearer <access-token>
```

### 8. User در JWT Strategy دوباره از database خوانده می‌شود

بنابراین تغییر وضعیت User به `INACTIVE` یا `BLOCKED` می‌تواند هنگام درخواست‌های جدید شناسایی شود.

---

# Current Limitations

## OTP هنوز از طریق SMS ارسال نمی‌شود

در implementation فعلی OTP در response برگردانده می‌شود.

این behavior باید قبل از production حذف شود.

---

## Phone Validation محدود است

DTO فعلی فقط موارد زیر را بررسی می‌کند:

```text
IsString
IsNotEmpty
```

Phone format و normalization هنوز implementation نشده است.

---

## Rate Limiting

برای endpointهای authentication در حال حاضر rate limiting مشخصی وجود ندارد.

این موضوع خصوصاً برای:

```text
POST /api/auth/request-otp
POST /api/auth/verify-otp
POST /api/auth/refresh
```

مهم است.

---

## RolesGuard Logging

در `RolesGuard` فعلی یک `console.log` وجود دارد:

```ts
console.log('RolesGuard:', {
  user,
  requiredRoles,
});
```

این log باید قبل از production حذف یا با logging استاندارد جایگزین شود.

---

## Role Infrastructure در AuthController استفاده نشده است

`AuthController` در حال حاضر `RolesGuard` و `Roles` را import کرده، اما endpointهای آن Role-specific نیستند.

Role authorization در feature moduleها استفاده می‌شود.

---

# Future Improvements

موارد زیر می‌توانند در مراحل بعدی اضافه شوند:

* SMS provider
* Phone normalization
* Authentication rate limiting
* OTP request throttling
* Login audit logs
* Device/session management
* چند Refresh Token همزمان برای چند device
* Token family / reuse detection
* استانداردسازی authentication errors
* تست‌های unit برای AuthService
* تست‌های integration برای authentication flow
* حذف `console.log` از Guards
* انتقال development OTP behavior به configuration
* عدم نمایش OTP در production response

این موارد قابلیت‌های فعلی محسوب نمی‌شوند و باید در مراحل بعدی implementation شوند.

---

# Complete Authentication Architecture

معماری فعلی Authentication به شکل زیر است:

```text
                    Client
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    Request OTP              Verify OTP
          │                       │
          ▼                       ▼
    AuthController          AuthController
          │                       │
          ▼                       ▼
     AuthService             AuthService
          │                       │
          ▼                       ▼
     OtpService              OtpService
                                  │
                                  ▼
                           UsersService
                                  │
                                  ▼
                            User / Customer
                                  │
                                  ▼
                         Generate JWT Tokens
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
              Access Token               Refresh Token
                    │                           │
                    ▼                           ▼
              API Requests                Refresh API
                    │                           │
                    ▼                           ▼
              JwtAuthGuard              Verify Token
                    │                           │
                    ▼                           ▼
              JwtStrategy                Refresh Hash
                    │                           │
                    ▼                           ▼
                 User DB                   New Tokens
```

---

# Summary

Authentication فعلی پروژه بر پایه OTP + JWT پیاده‌سازی شده است.

مسیر اصلی login:

```text
Phone
  ↓
Request OTP
  ↓
Verify OTP
  ↓
Find/Create User
  ↓
Check Status
  ↓
Access Token + Refresh Token
```

برای درخواست‌های بعدی:

```text
Access Token
  ↓
JwtAuthGuard
  ↓
JwtStrategy
  ↓
User Validation
  ↓
Protected Endpoint
```

برای تمدید:

```text
Refresh Token
  ↓
JWT Validation
  ↓
User Validation
  ↓
Compare Stored Hash
  ↓
Generate New Tokens
  ↓
Replace Refresh Token Hash
```

و برای logout:

```text
Logout
  ↓
Clear refreshTokenHash
  ↓
Refresh Token Revoked
```

این ساختار، لایه Authentication فعلی پروژه را تشکیل می‌دهد.
