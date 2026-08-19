# KTPTTC Website - Vercel Deployment Package

កញ្ចប់ឯកសារសម្រង់សម្រាប់ Deploy ទាំង Frontend និង Backend (Express Node.js) ទៅកាន់ Vercel។

## រចនាសម្ព័ន្ធរៀបចំ (Project Structure)
- `Admin_Index.html` : ទំព័រផ្ទាំងគ្រប់គ្រង Admin
- `Public_Index.html` : ទំព័រសាលាសម្រាប់សាធារណជន
- `server.js` : Express Server & API Backend
- `data/db.json` : ទិន្នន័យ Database ដំបូង
- `api/index.js` : Serverless Function Entrypoint សម្រាប់ Vercel
- `vercel.json` : របៀបរៀបចំ Routing & Rewrites លើ Vercel

## របៀបរបៀបរៀបចំ Deploy ទៅ Vercel (Deployment Steps)

### វិធីទី១៖ តាម Vercel CLI (សាមញ្ញបំផុត)
1. បើក Terminal ក្នុង folder `vercel-deploy`:
   ```bash
   cd vercel-deploy
   ```
2. ដំឡើង vercel CLI (ប្រសិនបើមិនទាន់មាន)៖
   ```bash
   npm i -g vercel
   ```
3. វាយបញ្ជា deploy៖
   ```bash
   vercel
   ```
   (ជ្រើសរើស Yes លើគ្រប់សំណួរ)

### វិធីទី២៖ តាម GitHub
1. Push ឬ Upload folder `vercel-deploy` ទៅកាន់ repository របស់អ្នកលើ GitHub។
2. ចូលទៅ Vercel Dashboard (`vercel.com`) -> **Import Project**.
3. ជ្រើសរើស Repository នោះ រួចចុច **Deploy**។

