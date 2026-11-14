# 🚀 ការណែនាំអំពីការដាក់ Host នៅលើ Hostinger (hPanel Node.js)

ឯកសារនេះណែនាំមួយជំហានម្តងៗ (Step-by-Step) ក្នុងការរៀបចំ និងដាក់ដំណើរការគេហទំព័រ **KTPTTC** នៅលើ **Hostinger Web / Cloud Hosting (hPanel)**។

---

## 📦 ១. ឯកសារដែលបានរៀបចំរួចរាល់
ខ្ញុំបានបង្កើតកញ្ចប់ ZIP រួចជាស្រេចដែលមានឈ្មោះថា **`ktpttc_hostinger_deploy.zip`** (ទំហំប្រហែល 3.4 MB) នៅខាងក្នុង Folder គម្រោងនេះ។ កញ្ចប់នេះមានផ្ទុក៖
* `server.js` (Express Server គាំទ្រទាំង Standalone និង Hostinger Reverse Proxy)
* `Public_Index.html` & `Admin_Index.html`
* `package.json` & `package-lock.json`
* `data/db.json`
* `.env` (មាន MONGODB_URI រួចជាស្រេច)
* `.htaccess` (សម្រាប់ LiteSpeed / Apache Reverse Proxy)
* រូបភាព Logo, Poster, Background, និង Favicons ទាំងអស់

---

## 🛠️ ២. ជំហានដំឡើងនៅលើ Hostinger hPanel

### ជំហានទី ១៖ Upload កូដចូលក្នុង File Manager
1. ចូលទៅកាន់ **Hostinger hPanel** (https://hpanel.hostinger.com)
2. ចូលទៅកាន់ **Websites** ➡️ ចុច **Manage** លើ Domain របស់អ្នក
3. ចុចយក **File Manager** (ស្ថិតក្នុងផ្នែក Files)
4. ចូលទៅកាន់ Folder **`public_html`**
5. ចុចប៊ូតុង **Upload** ➡️ ជ្រើសរើសយកឯកសារ **`ktpttc_hostinger_deploy.zip`**
6. នៅពេល Upload ចប់ ចុចកណ្ដុរស្ដាំ (Right-Click) លើ file zip នោះ ➡️ ជ្រើសរើស **Extract** (ពន្លាឯកសារចូលទៅក្នុង `public_html`)
7. *បញ្ជាក់៖* សូមប្រាកដថា file `.env` ត្រូវបានបង្ហាញ (ប្រសិនបើបាត់ សូមចុច Show Hidden Files ឬបង្កើត file `.env` ថ្មីមួយ)។

---

### ជំហានទី ២៖ កំណត់រចនាសម្ព័ន្ធ Node.js ក្នុង hPanel
1. នៅក្នុង hPanel ស្វែងរកពាក្យ **"Node.js"** ក្នុងប្រអប់ Search ខាងលើ (ឬចូលតាម Advanced ➡️ Node.js)
2. បំពេញព័ត៌មានដូចខាងក្រោម៖
   * **Node.js version**: ជ្រើសរើស **20.x** (ឬ 18.x)
   * **Application root**: `public_html` (ឬផ្លូវ Folder ដែលអ្នកបាន extract កូដ)
   * **Application startup file**: `server.js`
   * **Application mode**: `Production`
3. ចុចប៊ូតុង **Create** (ឬ **Save**)

---

### ជំហានទី ៣៖ ដំឡើង Dependencies (npm install)
1. បន្ទាប់ពី Save រួច ក្នុងផ្ទាំង Node.js អ្នកនឹងឃើញប៊ូតុង **`Install Dependencies`** (ឬ `npm install`)
2. ចុចប៊ូតុង **`Install Dependencies`** រួចរង់ចាំប្រហែល ៣០ វិនាទី ឱ្យប្រព័ន្ធទាញយក Express, MongoDB, CORS... ដោយស្វ័យប្រវត្តិ។

---

### ជំហានទី ៤៖ ចាប់ផ្តើមដំណើរការ (Start Application)
1. ចុចប៊ូតុង **`Start App`** ឬ **`Restart`**
2. ពិនិត្យមើល Status នឹងបង្ហាញជា **`Running` (ពណ៌បៃតង)**!

---

## 🌐 ៣. ពិនិត្យមើលលទ្ធផល
* **ទំព័រទូទៅ (Public Website)**: `https://your-domain.com`
* **ផ្ទាំងគ្រប់គ្រង (Admin Panel)**: `https://your-domain.com/admin`
* **ពិនិត្យ API Status**: `https://your-domain.com/api/db-status`

---

## 💡 គន្លឹះបន្ថែម (Tips)
* **SSL Certificate**: សូមចូលទៅកាន់ផ្នែក **Security ➡️ SSL** ក្នុង hPanel ដើម្បីបើក Free Let's Encrypt SSL ឱ្យ Domain របស់អ្នកដើរលើ `https://` ដោយសុវត្ថិភាព។
* **Telegram Bot**: ប្រសិនបើចង់បើក Telegram Bot សូមចូលទៅកាន់ File Manager កែសម្រួល `.env` ដោយដាក់ `TELEGRAM_BOT_TOKEN` និង `TELEGRAM_CHAT_ID`។
