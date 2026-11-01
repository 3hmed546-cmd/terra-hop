# دليل نشر متجر TERRA HOP على استضافة cPanel (Node.js)

تم تجهيز هذا المشروع ليعمل بسلاسة وأمان كامل على لوحة تحكم **cPanel** عبر أداة **Setup Node.js App** الرسمية.

---

## 1. المتطلبات على السيرفر
* **Node.js version:** يفضل الإصدار `20.x` أو `22.x` (LTS).
* **Application Mode:** اختر `Production`.

---

## 2. خطوات النشر عبر cPanel خطوة بخطوة

1. **إنشاء تطبيق Node.js:**
   - ادخل على لوحة تحكم cPanel وافتح **Setup Node.js App**.
   - اضغط **Create Application**.
   - اختر إصدار Node.js (`20.x` أو أحدث).
   - في خانة **Application root** اكتب مسار المجلد (مثلاً: `terra-hop`).
   - في خانة **Application startup file** اكتب: `server.js` (الملف مجهز وموجود في المشروع).
   - في خانة **Application URL** اختر الدومين أو المسار المطلوب.
   - اضغط **Create**.

2. **رفع الملفات:**
   - يمكنك سحب المشروع من GitHub مباشرة عبر ميزة **Git™ Version Control** في cPanel، أو ضغط ملفات المشروع (باستثناء `node_modules` و `.next`) ورفعها عبر **File Manager** وفك ضغطها داخل مسار التطبيق.

3. **إعداد المتغيرات البيئية (Environment Variables):**
   - داخل صفحة التطبيق في cPanel، اذهب إلى قسم **Environment Variables** وأضف المتغيرات التالية (المأخوذة من `.env.example`):
     * `ADMIN_PATH` = `k7q2-vault-9xm4`
     * `ADMIN_LOGIN_PATH` = `k7q2-vault-9xm4`
     * `ADMIN_EMAIL` = `admin@terrahop.com`
     * `ADMIN_PASSWORD` = `admin123`
     * `SESSION_SECRET` = `terra-hop-secure-jwt-secret-key-2026-v1`
     * `PROMO_CODES` = `TERRA10:10,VIP20:20,WELCOME50:50,DROP01:15`
     * `NODE_ENV` = `production`

4. **تثبيت الحزم والبناء (Build):**
   - انسخ أمر الـ Virtual Environment المعروض أعلى صفحة cPanel (مثلاً: `source /home/username/nodevenv/terra-hop/20/bin/activate && cd /home/username/terra-hop`).
   - افتح **Terminal** في cPanel ونفذ:
     ```bash
     npm install
     npm run build
     ```

5. **إعادة تشغيل التطبيق:**
   - اضغط على زر **Restart Application** في cPanel.
   - مبروك! المتجر سيعمل بكفاءة وسرعة فائقة مع كامل الحماية الأمنية.
