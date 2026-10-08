# Health Module

## Purpose

The `Health` module provides a simple endpoint for checking whether the API application is running correctly.

It is primarily intended for:

* Application health checks
* Docker/container health checks
* Load balancer health checks
* Monitoring systems
* Verifying that the NestJS application is responding

The Health module does **not** check business functionality such as authentication, appointments, database records, or external services unless those checks are explicitly added later.

---

## Responsibilities

The Health module is responsible for:

1. Exposing a health-check HTTP endpoint.
2. Returning a successful response when the API process is running.
3. Providing a stable endpoint that infrastructure and monitoring systems can use.

It should remain lightweight and should not contain business logic.

---

## Data Model

The Health module does not have its own database model.

It does not create or modify any PostgreSQL/Prisma records.

```text
Health Module
     │
     └── No database model
```

---

## Endpoints

### GET /api/health

Returns the current health status of the API.

Because the application uses:

```ts
app.setGlobalPrefix('api');
```

the controller route is exposed under the `/api` prefix.

### Example Request

```http
GET /api/health
```

### Example Response

```json
{
  "status": "ok"
}
```

The exact response shape should always follow the current implementation of `HealthController`.

---

## Example

A monitoring service can periodically request:

```http
GET /api/health
```

If the API responds successfully:

```http
200 OK
```

the application can be considered reachable.

For example:

```text
Monitoring
    │
    │ GET /api/health
    ▼
NestJS API
    │
    │ 200 OK
    ▼
Monitoring
    │
    └── API is reachable
```

If the API process is unavailable or cannot respond, the health check fails.

---

## How It Works

The Health module is registered in the application's root module:

```text
AppModule
    │
    └── HealthModule
            │
            └── HealthController
                    │
                    └── GET /api/health
```

When a request is sent to:

```text
/api/health
```

NestJS routes the request to the Health controller.

The controller returns a lightweight response without executing any business operation.

This makes the endpoint suitable for frequent automated health checks.

---

## Business Rules

The Health module intentionally has very few rules.

### 1. It must be lightweight

The endpoint should respond quickly and avoid unnecessary operations.

### 2. It should not require authentication

The health endpoint is intended to be accessible by infrastructure and monitoring systems.

Therefore, it should normally remain outside authenticated application flows.

### 3. It should not modify data

A health check must never create, update, or delete application data.

### 4. It should not contain business logic

Business-specific checks belong in their respective modules.

For example:

* Authentication health → `AuthModule`
* Database connectivity → infrastructure/health checks
* Appointment availability → `AvailabilityModule`
* Appointment status → `AppointmentsModule`

If the project later requires a more advanced health check, database or dependency checks should be added deliberately rather than putting business logic into the Health module.

---

## Related Modules

### AppModule

`HealthModule` is imported by the root `AppModule`.

```text
AppModule
   │
   └── HealthModule
```

### PrismaModule

The current basic health endpoint does not require Prisma.

If a future version needs to verify database connectivity, `PrismaModule` may become a dependency of the health-check implementation.

### Docker / Infrastructure

The endpoint can be used by Docker, reverse proxies, load balancers, or monitoring systems to determine whether the API process is responding.

---

## Future Improvements

The current Health module is intentionally simple.

As the system grows, it may be extended to distinguish between:

```text
Application Health
        │
        ├── API process
        ├── PostgreSQL
        ├── Redis
        ├── Telegram Bot
        └── Other external dependencies
```

For example, a future health response could expose separate statuses for application dependencies.

These checks should only be introduced when they are actually required by the deployment and monitoring architecture.

---

## Summary

The Health module provides the simplest infrastructure-level entry point into the application:

```text
GET /api/health
        │
        ▼
 HealthController
        │
        ▼
   Health Response
```

Its primary purpose is to answer one question:

> Is the API application currently reachable and responding?
