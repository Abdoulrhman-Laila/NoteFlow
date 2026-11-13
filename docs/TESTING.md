# Test log / سجل الاختبارات

The runs below hit `createApp()` on an ephemeral port, then deleted the fixture rows in PostgreSQL. There is no `npm test` script. These are documented ad-hoc runs, not a permanent automated suite.

## A. Functional Testing — 12 November 2026

الفحص الوظيفي.

**النتيجة: 70 / 70، رمز الخروج 0**

- كل مسار منتج ينفّذ المطلوب (صحة، مصادقة، ملاحظات شخصية، فرق، أعضاء، ملاحظات فريق).
- النجاح `{ success: true, data }`، والخطأ `{ success: false, message }`، والحذف `204` بجسم فارغ.
- الرموز: `201` إنشاء، `200` قراءة/تعديل، `204` حذف، `400` تحقق، `401` بلا جلسة، `403` غير المالك، `404` غائب أو غير عضو، `409` تكرار.
- التحقق يرفض عنواناً فارغاً، بريداً غير صالح، كلمة مرور قصيرة، اسم فريق من مسافات، جسم تعديل فارغ، دور `OWNER` عند الإضافة، ومعرّفاً غير رقمي.

Rate limit `429` was not part of this run; it is covered under Security Audit.

## B. Negative Testing — 12 November 2026

اختبار السلب.

**النتيجة: 35 / 35، رمز الخروج 0**

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

## C. Integration Testing — 12 November 2026

اختبار التكامل.

**النتيجة: 28 / 28، رمز الخروج 0**

السلسلة الفعلية: الطلب → الوسيط → المتحكّم → الخدمة → Prisma → PostgreSQL. لا طبقة Repository منفصلة.

- `SELECT 1` نجح.
- طلب بلا رمز يتوقف عند الوسيط قبل الكتابة.
- `users.password_hash` يبدأ بـ `scrypt$`، و`sessions.token_hash` هو SHA-256 للنص الخام.
- إنشاء الفريق صفقة: صف `teams` وصف `OWNER` في `team_members`.
- حذف الفريق يزيل الأعضاء وملاحظات الفريق (`ON DELETE CASCADE`) وتبقى الملاحظة الشخصية.
- الخروج يحذف صف الجلسة، و`/me` بعدها `401`.

## D. Security Audit — 12 November 2026

التدقيق الأمني.

**النتيجة: 26 / 26 HTTP checks، رمز الخروج 0**

| Control | الحكم |
| --- | --- |
| Authentication | جلسات غير شفافة؛ رمز يشبه JWT يُرفض |
| Authorization | عزل الملاحظات؛ غير العضو `404` |
| Password Hashing | scrypt N=32768 |
| JWT Security | غير مستخدم |
| Input Validation | أنواع خاطئة `400` |
| SQL Injection | لا `$queryRaw`؛ العنوان المشبوه يُحفظ نصاً |
| Rate Limiting | 5 ثم `429` على الدخول؛ التسجيل مستقل |
| CORS Configuration | `cors()` يسمح بأي أصل — يحتاج تقييداً قبل الإنترنت العام |
| Security Headers | `x-powered-by` معطّل؛ لا CSP / nosniff / HSTS |
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
