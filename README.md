<h1 align="center">NoteFlow</h1>

<p align="center">
  واجهة REST للملاحظات الشخصية وملاحظات الفرق.<br>
  المالك يُؤخذ من الجلسة، والملاحظتان لا تختلطان.
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

## ✨ نظرة عامة

NoteFlow يفصل الملاحظة الشخصية عن ملاحظة الفريق. `teamId` للملاحظة الشخصية يبقى `null`. هوية الكاتب تأتي من الجلسة، ولا تُقبل من جسم الطلب.

لا يُستخدم JWT. رمز الجلسة يُرسل في ترويسة `Authorization`، ويُحفظ في قاعدة البيانات بصمة فقط.

## 🧰 التقنيات

| | التقنية | الدور |
| --- | --- | --- |
| <img alt="" height="20" src="https://cdn.simpleicons.org/nodedotjs/339933"> | Node.js 22 | بيئة التشغيل |
| <img alt="" height="20" src="https://cdn.simpleicons.org/express/000000"> | Express 5 | خادم HTTP |
| <img alt="" height="20" src="https://cdn.simpleicons.org/typescript/3178C6"> | TypeScript | لغة المصدر |
| <img alt="" height="20" src="https://cdn.simpleicons.org/prisma/2D3748"> | Prisma 7 | الوصول إلى البيانات |
| <img alt="" height="20" src="https://cdn.simpleicons.org/postgresql/4169E1"> | PostgreSQL 17 | قاعدة البيانات |

## 📋 المتطلبات

- Node.js 22 أو أحدث
- npm
- PostgreSQL 17

## 🚀 التشغيل

```bash
npm install
copy .env.example .env
```

ضع كلمة مرور قاعدة البيانات داخل `DATABASE_URL` في `.env`. هذا الملف لا يُرفع.

```bash
npx prisma migrate dev
npm run dev
```

الخادم يستمع على `http://localhost:3000` ما لم تغيّر `PORT`.

| الأمر | الوظيفة |
| --- | --- |
| `npm run dev` | تشغيل التطوير مع إعادة التحميل |
| `npm run typecheck` | فحص الأنواع من غير إنتاج ملفات |
| `npm run build` | ترجمة TypeScript إلى `dist` |
| `npm start` | تشغيل النسخة المبنية |

`prisma migrate dev` ينشئ قاعدة ظل، لذلك مستخدم PostgreSQL يحتاج صلاحية `CREATEDB`. في الإنتاج استخدم `npx prisma migrate deploy`.

## 📦 شكل الاستجابة

النجاح:

```json
{ "success": true, "data": {} }
```

الخطأ:

```json
{ "success": false, "message": "Validation failed", "errors": {} }
```

`errors` يظهر عند أخطاء التحقق فقط. الحذف الناجح يرجع `204` من دون جسم.

## 🔐 المصادقة

```http
Authorization: Bearer <token>
```

التسجيل والدخول محدودان بخمس محاولات لكل عنوان خلال 15 دقيقة، ولكل مسار عداد مستقل. تجاوز الحد يرجع `429` والرسالة `Too many attempts. Try again later.`. العداد في الذاكرة ويُصفَّر عند إعادة تشغيل العملية. `GET /me` و`POST /logout` غير محدودين.

| الطريقة | المسار | الحالة | الوصف |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | `201` | إنشاء حساب وجلسة |
| `POST` | `/api/v1/auth/login` | `200` | تسجيل الدخول |
| `GET` | `/api/v1/auth/me` | `200` | المستخدم الحالي |
| `POST` | `/api/v1/auth/logout` | `204` | إبطال الجلسة الحالية |

```json
{ "name": "Lina", "email": "lina@example.com", "password": "correct-horse" }
```

- الاسم حتى 100 حرفاً.
- البريد يُقص ويُحوَّل إلى أحرف صغيرة. التكرار يرجع `409`.
- كلمة المرور من 10 إلى 128 حرفاً، وتُخزَّن بخوارزمية scrypt.
- بيانات الدخول الخاطئة ترجع `401` والرسالة `Invalid email or password`.
- الجلسة تعيش 7 أيام. الخروج يحذفها، وتكرار الخروج أو استخدام جلسة منتهية يرجع `401`.

## 💚 فحص الصحة

```http
GET /api/health
```

```json
{ "success": true, "data": { "status": "ok" } }
```

## 📝 الملاحظات الشخصية

كل المسارات تتطلب جلسة. ملاحظات الفرق لا تظهر هنا.

| الطريقة | المسار | الحالة |
| --- | --- | --- |
| `POST` | `/api/v1/notes` | `201` |
| `GET` | `/api/v1/notes` | `200` |
| `GET` | `/api/v1/notes/:id` | `200` |
| `PATCH` | `/api/v1/notes/:id` | `200` |
| `DELETE` | `/api/v1/notes/:id` | `204` |

```json
{ "title": "Idea", "content": "First line" }
```

التعديل يقبل حقلًا واحداً على الأقل من `title` و`content` و`isPinned` و`isArchived`. العنوان حتى 200 حرف، والمحتوى حتى 20000 حرف. الملاحظة الغائبة أو المملوكة لمستخدم آخر ترجع `404` والرسالة `Note not found`.

## 👥 الفرق

| الطريقة | المسار | الحالة | الصلاحية |
| --- | --- | --- | --- |
| `POST` | `/api/v1/teams` | `201` | أي مستخدم مسجّل، ويصبح `OWNER` |
| `GET` | `/api/v1/teams` | `200` | فرق المستخدم الحالي فقط |
| `POST` | `/api/v1/teams/:id/members` | `201` | `OWNER` فقط |

```json
{ "name": "Writers" }
```

اسم الفريق حتى 150 حرفاً بعد إزالة المسافات الطرفية.

```json
{ "email": "member@example.com", "role": "MEMBER" }
```

`role` يقبل `ADMIN` أو `MEMBER` فقط. إرسال `OWNER` يرجع `400`. البريد غير الموجود يرجع `404`، والعضوية المكررة ترجع `409`. من ليس عضواً يحصل على `404` والرسالة `Team not found`. العضو الذي ليس مالكاً يحصل على `403`.

## 📂 ملاحظات الفريق

أي عضو يستطيع الإنشاء والقراءة والتعديل والحذف. `teamId` يُؤخذ من الرابط، و`createdBy` من الجلسة.

| الطريقة | المسار | الحالة |
| --- | --- | --- |
| `POST` | `/api/v1/teams/:id/notes` | `201` |
| `GET` | `/api/v1/teams/:id/notes` | `200` |
| `PATCH` | `/api/v1/teams/:id/notes/:noteId` | `200` |
| `DELETE` | `/api/v1/teams/:id/notes/:noteId` | `204` |

جسم الإنشاء والتعديل هو نفسه جسم الملاحظة الشخصية. ملاحظة لا تنتمي إلى هذا الفريق ترجع `404`. غير العضو يحصل على `404` والرسالة `Team not found`.

## ⚠️ المهام المؤقتة

`/api/tasks` وحدة في الذاكرة من دون مصادقة ومن دون قاعدة بيانات. بياناتها تختفي عند إيقاف العملية، وهي منفصلة عن NoteFlow. الحالات المقبولة هي `todo` و`in_progress` و`done`.

## 🔒 ما لا يُرفع

`.gitignore` يستبعد:

- `node_modules/`
- `dist/`
- `src/generated/`
- `.env` وأي ملف بيئة آخر غير `.env.example`
- ملفات السجل والنسخ الاحتياطية المحلية

انسخ `.env.example` محلياً وضع كلمة المرور هناك فقط.
