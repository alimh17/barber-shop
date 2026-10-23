# کلاینت مدیریت آرایشگاه قیچی

کلاینت React فارسی و RTL با ورود OTP، نشست قابل بازیابی، تمدید خودکار access token، گارد نقش‌محور و داشبورد پایه.

## اجرای محلی

```bash
pnpm install
pnpm dev
```

در حالت توسعه، Vite درخواست‌های `/api` را به بک‌اند محلی روی `http://localhost:3000` پراکسی می‌کند. بنابراین ابتدا سرویس بک‌اند را اجرا کنید و سپس کلاینت را با `pnpm dev` بالا بیاورید. OTP واقعی ۶ رقمی است؛ اگر بک‌اند با `OTP_EXPOSE_CODE=true` اجرا شود، کد محیط توسعه در فرم نمایش داده می‌شود.

برای تغییر مقصد proxy توسعه یا استفاده از URL مستقل API، متغیرهای زیر قابل تنظیم‌اند:

```env
VITE_BACKEND_TARGET=http://127.0.0.1:3000
# فقط زمانی تنظیم شود که API مستقیماً CORS کلاینت را مجاز کرده باشد:
# VITE_API_URL=https://api.example.com/api
```

قراردادهای استفاده‌شده: `POST /api/auth/request-otp`، `POST /api/auth/verify-otp`، `POST /api/auth/refresh` و `POST /api/auth/logout`. زمان انقضای نشست از claim استاندارد `exp` در access token استخراج می‌شود.

## زیرساخت

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
