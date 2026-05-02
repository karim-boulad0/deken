# دليل استخراج نسخة جديدة من التطبيق (Portable Release Guide)

هذا الدليل يشرح الخطوات الدقيقة التي يجب اتباعها لاستخراج نسخة جديدة (مثل V6، V7، إلخ) بعد إجراء أي تعديلات أو تحديثات على الكود.

## الخطوات اليدوية لاستخراج نسخة جديدة (مثال: إنشاء النسخة V6)

لنفترض أنك تريد إنشاء النسخة رقم 6 (`business-suite-portable-v6`). اتبع الخطوات التالية بالترتيب في الـ Terminal:

### 1. بناء التحديثات الجديدة (Build)
يجب أولاً تحويل الكود الحديث (React/TypeScript) إلى ملفات يقرأها النظام:
```bash
npm run build
```

### 2. تجميع التطبيق (Package)
استخدم أداة `electron-packager` لتجميع التطبيق داخل ملفات تشغيلية لنظام ويندوز:
```bash
npx electron-packager . "Business Suite" --platform=win32 --arch=x64 --out=release --overwrite
```
*(هذا الأمر سيقوم بإنشاء مجلد اسمه `Business Suite-win32-x64` داخل مجلد `release`)*.

### 3. إنشاء مجلد النسخة الجديدة
قم بإنشاء مجلد جديد للنسخة داخل مجلد `release`، مثلاً `business-suite-portable-v6`.

### 4. نقل مجلد التطبيق
انقل المجلد الذي تم توليده `Business Suite-win32-x64` إلى داخل مجلد النسخة الجديدة `business-suite-portable-v6`.

### 5. نسخ ملفات التشغيل والتعليمات
انسخ الملفات الثلاثة التالية من النسخة السابقة (مثلاً من V5) إلى مجلد النسخة الجديدة:
- `Launch-Deken.bat`
- `Launch-Deken-Silent.vbs`
- `README-RUN-FIRST.txt`

### 6. تحديث رقم النسخة في الـ README
افتح ملف `README-RUN-FIRST.txt` الموجود في المجلد الجديد، وقم بتعديل السطر الأول ليصبح:
`BUSINESS SUITE PORTABLE V6` (بدلاً من V5).

### 7. ضغط المجلد (Zip)
أخيراً، قم بضغط المجلد `business-suite-portable-v6` بالكامل ليصبح ملف `.zip` جاهزاً للتوزيع للعملاء.

---

## طريقة بديلة وسريعة (باستخدام PowerShell)

بدلاً من القيام بكل الخطوات يدوياً، يمكنك تشغيل هذا السكربت الجاهز في الـ Terminal (PowerShell) الذي سيقوم بكل شيء عنك بضغطة واحدة لإنشاء V6:

```powershell
# 1. Build the app
npm run build

# 2. Package the app
npx electron-packager . "Business Suite" --platform=win32 --arch=x64 --out=release --overwrite

# 3. Create the V6 folder
mkdir -Force "C:\laragon\www\for_me\deken\release\business-suite-portable-v6"

# 4. Move the packaged app into the V6 folder
Move-Item -Force "C:\laragon\www\for_me\deken\release\Business Suite-win32-x64" "C:\laragon\www\for_me\deken\release\business-suite-portable-v6\"

# 5. Copy launcher files from V5
Copy-Item -Force "C:\laragon\www\for_me\deken\release\business-suite-portable-v5\Launch-Deken.bat" "C:\laragon\www\for_me\deken\release\business-suite-portable-v6\Launch-Deken.bat"
Copy-Item -Force "C:\laragon\www\for_me\deken\release\business-suite-portable-v5\Launch-Deken-Silent.vbs" "C:\laragon\www\for_me\deken\release\business-suite-portable-v6\Launch-Deken-Silent.vbs"

# 6. Copy and update the README file
$readme = Get-Content "C:\laragon\www\for_me\deken\release\business-suite-portable-v5\README-RUN-FIRST.txt"
$readme = $readme -replace 'V5', 'V6'
Set-Content -Path "C:\laragon\www\for_me\deken\release\business-suite-portable-v6\README-RUN-FIRST.txt" -Value $readme

# 7. Zip the folder
Write-Host "Zipping the release... This might take a minute."
Compress-Archive -Path "C:\laragon\www\for_me\deken\release\business-suite-portable-v6\*" -DestinationPath "C:\laragon\www\for_me\deken\release\business-suite-portable-v6.zip" -Force

Write-Host "V6 Release generated successfully!"
```

*ملاحظة: يمكنك تغيير `v6` في الكود أعلاه إلى أي رقم نسخة جديدة تريده في المستقبل (مثل `v7`).*
