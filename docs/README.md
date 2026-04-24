# توثيق مشروع Deken

هذا المجلد يضم خطط المنتج، القرارات المعمارية، والأدلة — **منظماً بمجلدات** حسب [STRUCTURE.md](./STRUCTURE.md).

## للوكيل (Cursor) — بداية سريعة

1. جذر المستودع: [../AGENTS.md](../AGENTS.md)
2. قواعد المشروع: مجلد `../.cursor/rules/` (ملفات `.mdc`)

## الفهرس

| المسار                                                                           | الوصف                                                |
| -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [STRUCTURE.md](./STRUCTURE.md)                                                   | قواعد تنظيم `docs/` والعلاقة مع القواعد والـ AGENTS  |
| [plans/README.md](./plans/README.md)                                             | فهرس **خطط المنتج**                                  |
| [plans/01-master-plan.md](./plans/01-master-plan.md)                             | الخطة الاستراتيجية الرئيسية                          |
| [plans/02-implementation-roadmap.md](./plans/02-implementation-roadmap.md)       | خارطة التنفيذ (bootstrap → UI → i18n → logic)        |
| [plans/02-implementation-checklists.md](./plans/02-implementation-checklists.md) | تتبع المهام لخارطة 02 (checkboxes)                   |
| [plans/future-reminders.md](./plans/future-reminders.md)                         | تذكيرات لاحقة (مثلاً قائمة التطبيق من الإعدادات)     |
| [plans/03-page-content-design.md](./plans/03-page-content-design.md)             | تصميم محتوى الصفحات الست + تتبع إنجاز كل صفحة        |
| `architecture/`                                                                  | قرارات معمارية و ADR (جاهز للمحتوى)                  |
| [guides/dev-setup.md](./guides/dev-setup.md)                                     | تشغيل المشروع محلياً (`npm install` / `npm run dev`) |

## إضافة مستند جديد

1. اختر المجلد الصحيح حسب [STRUCTURE.md](./STRUCTURE.md).
2. حدّث الفهرس المناسب (`README.md` هنا و/أو `plans/README.md`).
