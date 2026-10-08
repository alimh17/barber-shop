# Health Module

## Purpose

The `Health` module provides an endpoint for checking whether the API application is running and whether the PostgreSQL database is reachable.

It is primarily intended for:

* Application health checks
* PostgreSQL connectivity checks
* Docker/container health checks
* Load balancer health checks
* Monitoring systems
* Infrastructure diagnostics

The Health module does not contain business logic related to authentication, salons, barbers, services, or appointments.

---

## Responsibilities

The Health module is responsible for:

1. Exposing a health-check HTTP endpoint.
2. Verifying that the API can communicate with PostgreSQL.
3. Returning the current health status of the application.
4. Providing a stable endpoint for infrastructure and monitoring systems.

---

## Data Model

The Health module does not have its own database model.

It does not create or modify application records.

However, it uses `PrismaService` to verify database connectivity by executing:

```sql
SELECT 1
```

Therefore, the module has a dependency on the application's Prisma/database layer.

```text
Health Module
     │
     └── PrismaService
             │
             └── PostgreSQL
```

---

## Endpoints

### GET /api/health

Returns the health status of the API and PostgreSQL connection.

The application uses the global prefix:

```ts
app.setGlobalPrefix('api');
```

Therefore, the Health controller route:

```ts
@Controller('health')
```

is exposed as:

```text
GET /api/health
```

### Example Request

```http
GET /api/health
```

### Example Response

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-10-08T20:30:00.000Z"
}
```

The `timestamp` value is generated at request time.

---

## Example

A monitoring service can periodically request:

```http
GET /api/health
```

The request follows this flow:

```text
Monitoring
    │
    │ GET /api/health
    ▼
HealthController
    │
    ▼
HealthService
    │
    │ SELECT 1
    ▼
PostgreSQL
    │
    │ Success
    ▼
HealthService
    │
    ▼
{
  status: "ok",
  database: "connected",
  timestamp: "..."
}
```

If the database query succeeds, the endpoint returns a successful health response.

If PostgreSQL is unavailable or the database query fails, the health check will fail instead of returning a normal healthy response.

---

## How It Works

The Health module contains two main components:

```text
HealthModule
    │
    ├── HealthController
    │
    └── HealthService
```

### HealthController

`HealthController` exposes:

```text
GET /api/health
```

The controller delegates the health check to `HealthService`.

It does not contain database logic itself.

### HealthService

`HealthService` depends on `PrismaService`.

When `check()` is called, it executes:

```ts
await this.prisma.$queryRaw`SELECT 1`;
```

This verifies that the application can successfully communicate with PostgreSQL.

After a successful query, the service returns:

```ts
{
  status: 'ok',
  database: 'connected',
  timestamp: new Date().toISOString(),
}
```

---

## Business Rules

The Health module intentionally has very few rules.

### 1. The endpoint should remain lightweight

The health check should perform only the minimum operations necessary to determine application/database health.

### 2. Database connectivity must be verified

The current implementation considers PostgreSQL connectivity part of the health check.

The query:

```sql
SELECT 1
```

is used because it is a minimal database operation.

### 3. The endpoint should not modify data

The health check must never create, update, or delete application records.

### 4. The endpoint should not contain business logic

Business-specific checks belong in their respective modules.

For example:

* Authentication → `AuthModule`
* Appointment availability → `AvailabilityModule`
* Appointment management → `AppointmentsModule`
* Salon management → `SalonsModule`

---

## Related Modules

### AppModule

`HealthModule` is imported by the root `AppModule`.

```text
AppModule
   │
   └── HealthModule
           │
           ├── HealthController
           └── HealthService
```

### PrismaModule

`HealthService` depends on `PrismaService`.

```text
HealthService
      │
      ▼
PrismaService
      │
      ▼
PostgreSQL
```

This dependency allows the Health module to verify database connectivity.

### Docker / Infrastructure

The endpoint can be used by Docker, reverse proxies, load balancers, and monitoring systems to determine whether the API and its database dependency are available.

---

## Future Improvements

As the application grows, the health system may be extended to check additional dependencies.

For example:

```text
Application Health
        │
        ├── API process
        ├── PostgreSQL
        ├── Redis
        ├── Telegram Bot
        └── Other external dependencies
```

If additional infrastructure dependencies are introduced, they should be added deliberately without turning the Health module into a place for business logic.

---

## Summary

The Health module provides an infrastructure-level endpoint for checking both API availability and PostgreSQL connectivity.

```text
GET /api/health
        │
        ▼
 HealthController
        │
        ▼
 HealthService
        │
        ▼
 PrismaService
        │
        ▼
 PostgreSQL
        │
        ▼
 Health Response
```

Its primary purpose is to answer two questions:

> Is the API responding?

and:

> Can the API communicate with PostgreSQL?
