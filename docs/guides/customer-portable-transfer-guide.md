# نقل Deken للزبون مباشرة (Portable سريع)

هذا الدليل يضبط طريقة سريعة لتجهيز نسخة جاهزة للزبون بحيث تعمل فوراً بأقل خطوات.

## ماذا أضفنا في المشروع

- سكربت تجهيز النسخة:
  - `npm run bundle:customer`
- سكربت تشغيل عند الزبون:
  - `run-deken.bat`
- مخرجات النسخة:
  - `release/customer-bundle/`
  - `release/deken-customer-bundle.zip` (اختياري)

## مرة واحدة عندك (جهازك)

من جذر المشروع:

```bash
npm install
npm run bundle:customer
```

السكربت يعمل:
1. Build للتطبيق
2. نسخ الملفات اللازمة للتشغيل
3. تجهيز نسخة خفيفة (بدون `node_modules`) لتسريع النقل

لإنشاء zip مباشرة:

```bash
powershell -ExecutionPolicy Bypass -File scripts/prepare-customer-bundle.ps1 -WithArchive
```

## كل مرة عند زبون جديد

1. خذ مجلد `release/customer-bundle` (أو zip إذا أنشأته) إلى جهاز الزبون.
2. فك الضغط إلى مسار محلي مثل: `C:\Deken`
3. شغل: `run-deken-silent.vbs` (بدون شاشة سوداء)

## ملاحظات مهمة

- لا تشغّل النظام من الفلاشة مباشرة؛ انسخه على القرص المحلي أولاً.
- أول تشغيل يحتاج إنترنت لأن `run-deken.bat` يعمل `npm install` تلقائياً مرة واحدة.
- ملف `run-deken.bat` يبقى موجود فقط للتشخيص وإظهار التفاصيل لو احتجت.
- بيانات كل دكان تبقى محلياً على جهازه (SQLite في userData).

## تحديث النسخة لاحقاً

عند إصدار جديد:

1. على جهازك: `npm run bundle:customer`
2. انقل zip الجديد
3. على جهاز الزبون: استبدل مجلد التطبيق فقط (مع إبقاء قاعدة البيانات المحلية كما هي)

## في حال واجهت مشكلة تشغيل

- افتح CMD داخل مجلد التطبيق وشغّل:

```bash
npm install
npm run build
run-deken.bat
```

- إذا استمرت المشكلة، راجع:
  - `docs/guides/new-shop-deployment-guide.md`
  - `docs/guides/scanner-qr-products-guide.md`
