# Users Module

## Purpose

The `Users` module is responsible for user persistence and internal user-related operations used by other application modules.

The current implementation primarily supports the authentication flow rather than exposing a public User Management API.

The module currently provides functionality for:

* Finding users by ID
* Finding users by phone number
* Creating customer users
* Storing and clearing refresh-token hashes

---

## Responsibilities

The current `UsersModule` is responsible for:

1. Retrieving a user by ID.
2. Retrieving a user by phone number.
3. Creating a new customer together with its `Customer` profile.
4. Storing a hashed refresh token for a user.
5. Clearing a stored refresh token hash during logout.

The module does not currently expose a public REST API for user management.

---

## Data Model

The Users module primarily works with the `User` model.

A `User` represents the application's identity and authentication-level information.

Important fields include:

```text
User
├── id
├── phone
├── firstName
├── lastName
├── refreshTokenHash
├── role
├── status
├── createdAt
└── updatedAt
```

A User may also have a related `Customer` or `Barber` profile.

For customer registration, the relationship is created together:

```text
User
   │
   └── Customer
```

The current `createCustomer()` implementation creates both records in a single Prisma operation.

---

## Endpoints

The Users module currently does not expose any REST endpoints.

Although a `UsersController` exists:

```ts
@Controller('users')
export class UsersController {}
```

it currently contains no routes and is not registered as a controller in `UsersModule`.

Therefore, there are currently no public endpoints such as:

```text
GET /api/users
POST /api/users
GET /api/users/:id
```

User operations are currently performed internally through `UsersService`.

---

## Service Operations

### findById

```ts
findById(id: string)
```

Finds a user by their unique ID.

Example:

```text
User ID
   │
   ▼
UsersService.findById()
   │
   ▼
Prisma User.findUnique()
   │
   ▼
User | null
```

The method returns `null` when no user exists with the specified ID.

---

### findByPhone

```ts
findByPhone(phone: string)
```

Finds a user by their unique phone number.

The phone number is unique in the database:

```text
User.phone
    │
    └── @unique
```

This operation is primarily useful during authentication and OTP flows.

Example:

```text
Phone Number
     │
     ▼
UsersService.findByPhone()
     │
     ▼
User
```

If the phone number is not registered, the method returns `null`.

---

### createCustomer

```ts
createCustomer(phone: string)
```

Creates a new customer account.

The operation creates:

1. A `User`
2. A related `Customer` record

The created User receives:

```text
role   = CUSTOMER
status = ACTIVE
```

Conceptually:

```text
createCustomer(phone)
        │
        ▼
      User
        │
        ├── phone
        ├── role = CUSTOMER
        └── status = ACTIVE
        │
        ▼
    Customer
```

The relationship is created through Prisma nested creation.

Example:

```text
Input:
phone = "09121234567"

Result:

User
├── phone: "09121234567"
├── role: CUSTOMER
└── status: ACTIVE

Customer
└── userId → created User
```

This operation is intended for the customer registration/authentication flow.

---

### updateRefreshToken

```ts
updateRefreshToken(
  userId: string,
  refreshTokenHash: string | null
)
```

Stores or clears the hashed refresh token associated with a user.

The actual refresh token should not be stored directly.

Instead, the application stores its hash:

```text
Refresh Token
      │
      ▼
   Hashing
      │
      ▼
refreshTokenHash
      │
      ▼
     User
```

When the refresh token needs to be invalidated, the hash can be cleared by passing:

```ts
null
```

Example:

```text
Login
  │
  ▼
Generate Refresh Token
  │
  ▼
Hash Token
  │
  ▼
UsersService.updateRefreshToken()
  │
  ▼
User.refreshTokenHash
```

During logout:

```text
Logout
  │
  ▼
UsersService.updateRefreshToken(userId, null)
  │
  ▼
refreshTokenHash = null
```

---

## Example

Consider a customer who is authenticating for the first time.

The authentication flow can use the Users module like this:

```text
Customer enters phone
          │
          ▼
      Auth / OTP
          │
          ▼
UsersService.findByPhone()
          │
     ┌────┴────┐
     │         │
   Found    Not Found
     │         │
     │         ▼
     │   createCustomer()
     │         │
     └────┬────┘
          ▼
        User
          │
          ▼
     Authentication
```

After authentication, when a refresh token is issued:

```text
Refresh Token
      │
      ▼
    Hash
      │
      ▼
updateRefreshToken()
      │
      ▼
User.refreshTokenHash
```

---

## How It Works

The current Users module is intentionally service-oriented.

```text
UsersModule
     │
     └── UsersService
             │
             └── PrismaService
                     │
                     ▼
                 PostgreSQL
```

`UsersService` does not implement business authentication logic itself.

Instead, it provides persistence operations that other modules can use.

For example:

```text
AuthModule
     │
     └── UsersService
             │
             ├── findByPhone()
             ├── createCustomer()
             └── updateRefreshToken()
```

This keeps user persistence responsibilities inside `UsersModule` while authentication logic remains inside `AuthModule`.

---

## Business Rules

### 1. Phone number identifies a User

The `phone` field is unique.

Therefore, the same phone number cannot belong to multiple User records.

### 2. New customers are active by default

`createCustomer()` creates users with:

```text
role = CUSTOMER
status = ACTIVE
```

### 3. Customer creation creates both User and Customer

A customer should not exist without its corresponding User identity.

The current Prisma nested create establishes this relationship during customer creation.

### 4. Refresh tokens are stored as hashes

The module stores:

```text
refreshTokenHash
```

rather than the raw refresh token.

This reduces the impact of a database compromise compared with storing plaintext refresh tokens.

### 5. UsersService does not expose authentication endpoints

Authentication-related HTTP endpoints belong to `AuthModule`.

`UsersService` only provides the persistence operations required by the authentication flow.

---

## Related Modules

### AuthModule

`AuthModule` is the primary consumer of `UsersService`.

It can use UsersService for:

* Finding users
* Creating customer accounts
* Updating refresh-token hashes

```text
AuthModule
     │
     ▼
UsersService
     │
     ▼
PrismaService
     │
     ▼
PostgreSQL
```

### OtpModule

The OTP flow works with user phone numbers and may use the Users layer as part of customer authentication/registration.

The OTP mechanism itself remains inside `OtpModule`.

### Customer

The `Customer` model represents the customer-specific profile associated with a User.

```text
User
 │
 └── Customer
```

### Barber

The same User identity model can also be associated with a `Barber` profile.

```text
User
 │
 └── Barber
```

This allows authentication identity and role-specific business profiles to remain separate.

---

## Future Improvements

As the application grows, the Users module may eventually expose administrative user-management endpoints.

Possible future functionality includes:

```text
GET    /api/users
GET    /api/users/:id
PATCH  /api/users/:id
PATCH  /api/users/:id/status
PATCH  /api/users/:id/role
```

These endpoints should only be introduced when actual user-management requirements exist.

If added, they should also respect the application's RBAC and salon-scoping rules.

The current module intentionally does not implement these operations.

---

## Summary

The current Users module is an internal user-persistence layer rather than a complete User Management API.

```text
                 UsersModule
                      │
                      ▼
                UsersService
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
     findById   findByPhone  createCustomer
                                  │
                                  ▼
                              User + Customer

                updateRefreshToken
                      │
                      ▼
              User.refreshTokenHash
```

Its current responsibility is to provide reusable user persistence operations to modules such as `AuthModule`, while keeping authentication business logic outside the Users module.
