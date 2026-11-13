<h1 align="center">NoteFlow</h1>

<p align="center">
  REST API للملاحظات الشخصية وملاحظات الفرق.<br>
  المالك يُؤخذ من الجلسة. لا JWT.
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-7-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white">
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-ISC-blue?style=flat-square">
  <img alt="Sessions" src="https://img.shields.io/badge/auth-server%20sessions-0f766e?style=flat-square">
  <img alt="Password hashing" src="https://img.shields.io/badge/passwords-scrypt-7c3aed?style=flat-square">
</p>

## المحتويات

- [نظرة عامة](#نظرة-عامة)
- [التثبيت](#التثبيت)
- [متغيرات البيئة](#متغيرات-البيئة)
- [المعمارية](#المعمارية)
- [مخطط قاعدة البيانات](#مخطط-قاعدة-البيانات)
- [توثيق الواجهة OpenAPI](#توثيق-الواجهة-openapi)
- [تدفق المصادقة](#تدفق-المصادقة)
- [شكل الخطأ](#شكل-الخطأ)
- [الاختبارات](#الاختبارات)

## نظرة عامة

NoteFlow يفصل الملاحظة الشخصية (`teamId = null`) عن ملاحظة الفريق. `createdBy` يأتي من الجلسة فقط. كلمة المرور تُخزَّن بـ scrypt. رمز الجلسة 43 حرفاً يُرسل في `Authorization: Bearer` ويُحفظ في القاعدة كـ SHA-256.

مواصفات الواجهة للفرونت: [`frontend-endpoints.json`](frontend-endpoints.json).

## التثبيت

المتطلبات: Node.js 22، npm، PostgreSQL 17.

```bash
npm install
copy .env.example .env
```

عدّل `DATABASE_URL` في `.env`. أنشئ قاعدة `notes_management_dev` ومستخدمها. `prisma migrate dev` يحتاج صلاحية `CREATEDB` لقاعدة الظل.

عميل Prisma غير مرفوع مع Git (`src/generated/` مستبعد). ولّده ثم طبّق الترحيلات:

```bash
npx prisma generate
npx prisma migrate dev
npm run dev
```

الخادم: `http://localhost:3000`. في الإنتاج: `npx prisma generate` ثم `npx prisma migrate deploy` ثم `npm run build` و`npm start`. خلف وكيل واحد اضبط `TRUST_PROXY=1`.

| الأمر | الوظيفة |
| --- | --- |
| `npm run dev` | تطوير مع إعادة التحميل |
| `npm run typecheck` | فحص الأنواع |
| `npm run build` | ترجمة إلى `dist` |
| `npm start` | تشغيل النسخة المبنية |

## متغيرات البيئة

انسخ `.env.example`. لا ترفع `.env`.

| المتغير | مطلوب | الافتراضي | الوظيفة |
| --- | --- | --- | --- |
| `DATABASE_URL` | نعم | — | اتصال PostgreSQL |
| `PORT` | لا | `3000` | منفذ الاستماع |
| `NODE_ENV` | لا | `development` | بيئة التشغيل |
| `TRUST_PROXY` | لا | غير مفعّل | عدد قفزات الوكيل (`1` على Render). القيمة `true` مرفوضة عند الإقلاع |

مثال:

```
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://notes_app:REPLACE_WITH_YOUR_PASSWORD@localhost:5432/notes_management_dev?schema=public"
```

## المعمارية

```
Request
  → Express (JSON 1mb, CORS, trust proxy)
    → Router
      → requireAuth | rate limit (register/login)
        → Controller (تحقق الجسم)
          → Service
            → Prisma Client + PrismaPg
              → PostgreSQL
```

لا طبقة Repository منفصلة. Prisma هو منفذ القاعدة. أخطاء Express 5 غير الملتقطة تصل إلى المعالج المركزي.

```mermaid
flowchart TD
  client[Client] --> express[Express 5]
  express --> authMw[requireAuth / rateLimit]
  authMw --> controller[Controller]
  controller --> service[Service]
  service --> prisma[Prisma]
  prisma --> pg[PostgreSQL]
```

## مخطط قاعدة البيانات

حذف الفريق يزيل الأعضاء وملاحظات الفريق (`ON DELETE CASCADE`). حذف مستخدم أنشأ فريقاً أو ملاحظة يمنعه `RESTRICT`. حذف المستخدم يزيل جلساته.

```mermaid
erDiagram
  users ||--o{ sessions : has
  users ||--o{ teams : creates
  users ||--o{ team_members : joins
  users ||--o{ notes : writes
  teams ||--o{ team_members : has
  teams ||--o{ notes : contains

  users {
    int id PK
    varchar name
    varchar email UK
    varchar password_hash
    timestamp created_at
  }
  sessions {
    int id PK
    int user_id FK
    varchar token_hash UK
    timestamp expires_at
  }
  teams {
    int id PK
    varchar name
    int created_by FK
    timestamp created_at
  }
  team_members {
    int team_id PK, FK
    int user_id PK, FK
    enum role
    timestamp joined_at
  }
  notes {
    int id PK
    varchar title
    text content
    int created_by FK
    int team_id FK
    boolean is_pinned
    boolean is_archived
  }
```

`TeamRole`: `OWNER` | `ADMIN` | `MEMBER`.

## توثيق الواجهة OpenAPI

المواصفة: [`docs/openapi.yaml`](docs/openapi.yaml).

افتح الملف في [Swagger Editor](https://editor.swagger.io) أو استورده في Postman. المسارات الكاملة أيضاً في الجداول أدناه وفي `frontend-endpoints.json`.

| الطريقة | المسار | الجلسة | الحالة |
| --- | --- | --- | --- |
| `GET` | `/api/health` | لا | `200` |
| `POST` | `/api/v1/auth/register` | لا | `201` |
| `POST` | `/api/v1/auth/login` | لا | `200` |
| `GET` | `/api/v1/auth/me` | نعم | `200` |
| `POST` | `/api/v1/auth/logout` | نعم | `204` |
| `POST` `GET` | `/api/v1/notes` | نعم | `201` / `200` |
| `GET` `PATCH` `DELETE` | `/api/v1/notes/:id` | نعم | `200` / `200` / `204` |
| `POST` `GET` | `/api/v1/teams` | نعم | `201` / `200` |
| `GET` `PATCH` `DELETE` | `/api/v1/teams/:id` | نعم | `200` / `200` / `204` |
| `GET` `POST` | `/api/v1/teams/:id/members` | نعم | `200` / `201` |
| `PATCH` `DELETE` | `/api/v1/teams/:id/members/:userId` | نعم | `200` / `204` |
| `POST` `GET` | `/api/v1/teams/:id/notes` | نعم | `201` / `200` |
| `PATCH` `DELETE` | `/api/v1/teams/:id/notes/:noteId` | نعم | `200` / `204` |

إعادة تسمية الفريق وحذفه وإدارة الأعضاء للمالك فقط. أي عضو ينشئ ويعدّل ويحذف ملاحظات الفريق. لا يوجد `GET` لملاحظة فريق واحدة.

## تدفق المصادقة

```mermaid
sequenceDiagram
  participant C as Client
  participant API as NoteFlow
  participant DB as PostgreSQL
  C->>API: POST /api/v1/auth/register
  API->>DB: user + session.token_hash
  API-->>C: 201 data.token
  C->>API: Authorization Bearer token
  API->>DB: lookup SHA-256 hash
  alt valid session
    API-->>C: 200
  else missing expired or unknown
    API-->>C: 401 Authentication required
  end
  C->>API: POST /api/v1/auth/logout
  API->>DB: delete session row
  API-->>C: 204
```

- التسجيل والدخول: 5 محاولات لكل عنوان خلال 15 دقيقة، عداد مستقل. `429` عند التجاوز. العداد في الذاكرة.
- كلمة المرور 10–128 حرفاً، scrypt `N=32768`. الدخول الخاطئ أو البريد المجهول: `401 Invalid email or password`.
- الجلسة 7 أيام. الخروج يحذف الصف. التكرار بعد الخروج `401`.

## شكل الخطأ

نجاح:

```json
{ "success": true, "data": {} }
```

خطأ:

```json
{ "success": false, "message": "Validation failed", "errors": { "title": "title is required" } }
```

| الحالة | متى |
| --- | --- |
| `400` | تحقق أو JSON غير صالح |
| `401` | بلا جلسة أو جلسة منتهية أو كلمة مرور خاطئة |
| `403` | عضو ليس مالكاً على عملية المالك |
| `404` | مورد غائب، أو غير عضو (`Team not found`) |
| `409` | بريد مكرر أو عضوية مكررة |
| `429` | تجاوز حد التسجيل أو الدخول |
| `500` | `Internal server error` من دون تفاصيل |
| `204` | حذف ناجح، بلا جسم |

`errors` يظهر عند فشل التحقق فقط.

## الاختبارات

السجل الكامل: [`docs/TESTING.md`](docs/TESTING.md).

| الدور | التاريخ | النتيجة |
| --- | --- | --- |
| وظيفي | 12 نوفمبر 2026 | 70 / 70 |
| سلب | 12 نوفمبر 2026 | 35 / 35 |
| تكامل حتى PostgreSQL | 12 نوفمبر 2026 | 28 / 28 |
| تدقيق أمني | 12 نوفمبر 2026 | 26 / 26 |

لا يوجد `npm test`. الفحوص كانت سكربتات مؤقتة ضد التطبيق وقاعدة التطوير.

## ما لا يُرفع

`node_modules/`، `dist/`، `src/generated/`، `.env`، السجلات، والنسخ `*.before-prisma`.
