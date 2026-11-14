# Test log / سجل الاختبارات

All four suites are automated: `npm test` (`node:test` + Supertest on `createApp()`, PostgreSQL from `DATABASE_URL`, fixtures deleted after the run). Security Audit sets `TEST_RATE_LIMIT=1` only inside that file.

## A. Functional Testing

الفحص الوظيفي. الملف: `tests/functional.test.ts`. الأمر: `npm test`.

**النتيجة السابقة (سكربت يدوي، 12 November 2026): 70 / 70.** يعاد التشغيل الآن آلياً.

- كل مسار منتج ينفّذ المطلوب (صحة، مصادقة، ملاحظات شخصية، فرق، أعضاء، ملاحظات فريق).
- النجاح `{ success: true, data }`، والخطأ `{ success: false, message }`، والحذف `204` بجسم فارغ.
- الرموز: `201` إنشاء، `200` قراءة/تعديل، `204` حذف، `400` تحقق، `401` بلا جلسة، `403` غير المالك، `404` غائب أو غير عضو، `409` تكرار.
- التحقق يرفض عنواناً فارغاً، بريداً غير صالح، كلمة مرور قصيرة، اسم فريق من مسافات، جسم تعديل فارغ، دور `OWNER` عند الإضافة، ومعرّفاً غير رقمي.

Rate limit `429` was not part of this run; it is covered under Security Audit.

## B. Negative Testing

اختبار السلب. الملف: `tests/negative.test.ts`. الأمر: `npm test`.

**النتيجة السابقة (سكربت يدوي، 12 November 2026): 35 / 35.** يعاد التشغيل الآن آلياً.

| Case | Result |
| --- | --- |
| بيانات ناقصة أو جسم فارغ | `400` مع `errors` |
| معرّف غير موجود | `404` بالرسالة المناسبة |
| معرّف 0 أو سالب أو `abc` | `400` |
| بلا رمز، أو `Bearer` فقط، أو `Basic`، أو رمز قصير، أو رمز بطول صحيح وغير مخزَّن | `401 Authentication required` |
| تكرار البريد | `409 Email is already registered` |
| تكرار العضوية | `409 User is already a team member` |
| `userId` / `teamId` / `createdBy` في جسم الملاحظة | تُتجاهل؛ المالك من الجلسة |
| JSON معطوب أو مصفوفة | `400` |

## C. Integration Testing

اختبار التكامل. الملف: `tests/integration.test.ts`. الأمر: `npm test`.

**النتيجة السابقة (سكربت يدوي، 12 November 2026): 28 / 28.** يعاد التشغيل الآن آلياً.

السلسلة الفعلية: الطلب → الوسيط → المتحكّم → الخدمة → Prisma → PostgreSQL. لا طبقة Repository منفصلة.

- `SELECT 1` نجح.
- طلب بلا رمز يتوقف عند الوسيط قبل الكتابة.
- `users.password_hash` يبدأ بـ `scrypt$`، و`sessions.token_hash` هو SHA-256 للنص الخام.
- إنشاء الفريق صفقة: صف `teams` وصف `OWNER` في `team_members`.
- حذف الفريق يزيل الأعضاء وملاحظات الفريق (`ON DELETE CASCADE`) وتبقى الملاحظة الشخصية.
- الخروج يحذف صف الجلسة، و`/me` بعدها `401`.

## D. Security Audit

التدقيق الأمني. الملف: `tests/security.test.ts`. الأمر: `npm test`.

**النتيجة السابقة (سكربت يدوي، 12 November 2026): 26 / 26 HTTP checks.** يعاد التشغيل الآن آلياً. CORS مقيّد؛ `nosniff` وCSP مضبوطان؛ HSTS في الإنتاج فقط. File Upload غير موجود في الواجهة.

| Control | الحكم |
| --- | --- |
| Authentication | جلسات غير شفافة؛ رمز يشبه JWT يُرفض |
| Authorization | عزل الملاحظات؛ غير العضو `404` |
| Password Hashing | scrypt N=32768 |
| JWT Security | غير مستخدم |
| Input Validation | أنواع خاطئة `400` |
| SQL Injection | لا `$queryRaw`؛ العنوان المشبوه يُحفظ نصاً |
| Rate Limiting | 5 ثم `429` على الدخول؛ التسجيل مستقل |
| CORS Configuration | أصول صريحة عبر `CORS_ORIGIN`؛ أصل غير مسموح بلا `Access-Control-Allow-Origin` |
| Security Headers | `x-powered-by` معطّل؛ `nosniff`؛ CSP `default-src 'none'`؛ HSTS في الإنتاج |
| Sensitive Data Exposure | الاستجابة بلا تجزئة؛ تعداد البريد عبر `409` |
| Error Information Leakage | العميل `Internal server error`؛ السجل رمز أو اسم فقط |
| File Upload Security | غير موجود |

## Earlier checks during development

| Topic | Result |
| --- | --- |
| `tsc --noEmit` | رمز 0 بعد كل شريحة |
| عزل ملاحظات الفريق | غير العضو `404`؛ القوائم لا تختلط |
| تعديل/حذف ملاحظة الفريق | أي عضو؛ الشخصي عبر مسار الفريق `404` |
| إزالة عضو | `204`؛ المالك لا يُزال؛ الملاحظات تبقى |
| تغيير الدور | `ADMIN`/`MEMBER` فقط؛ المالك `400` |
| حذف فريق | cascade على الأعضاء وملاحظات الفريق |
| ترقية `body-parser` | 2.4.0؛ `npm audit --omit=dev` بلا ثغرات وقتها |
