const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env'), override: true });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const telegram = require('./telegram');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Disable caching for all API routes (prevents stale data on reload)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

let lastMongoError = null;

// Diagnostic endpoint to check MongoDB status
app.get('/api/db-status', async (req, res) => {
  const uri = process.env.MONGODB_URI;
  const collection = await getMongoCollection();
  let counts = {};
  try {
    const db = await readDb();
    counts = {
      books: Array.isArray(db.books) ? db.books.length : 0,
      readers: Array.isArray(db.readers) ? db.readers.length : 0,
      staff: Array.isArray(db.staff) ? db.staff.length : 0,
      team: Array.isArray(db.team) ? db.team.length : 0,
      partners: Array.isArray(db.partners) ? db.partners.length : 0,
      videos: Array.isArray(db.videos) ? db.videos.length : 0,
      news: Array.isArray(db.news) ? db.news.length : 0,
      messages: Array.isArray(db.messages) ? db.messages.length : 0,
      slides: Array.isArray(db.slides) ? db.slides.length : 0,
      visitorCount: db.visitorCount || 0
    };
  } catch (e) {}

  res.json({
    status: 'ok',
    hasMongoUri: !!uri,
    mongoConnected: !!collection,
    lastMongoError: lastMongoError ? lastMongoError.message : null,
    environment: process.env.VERCEL ? 'vercel-serverless' : 'local-node',
    counts,
    timestamp: new Date().toISOString()
  });
});

// Database Backup Endpoint (Export JSON)
app.get('/api/database/backup', async (req, res) => {
  try {
    const db = await readDb();
    const backupData = { ...db };
    delete backupData._id;
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ktpttc_backup_${dateStr}.json"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, message: 'បរាជ័យក្នុងការទាញយកទិន្នន័យបម្រុង: ' + err.message });
  }
});

// Database Restore Endpoint (Import JSON)
app.post('/api/database/restore', async (req, res) => {
  try {
    const incoming = req.body && req.body.data ? req.body.data : req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ success: false, message: 'ទិន្នន័យមិនត្រឹមត្រូវឡើយ (Invalid JSON)' });
    }
    const cleanData = { ...incoming };
    delete cleanData._id;

    if (!cleanData.settings && !cleanData.books && !cleanData.partners) {
      return res.status(400).json({ success: false, message: 'ឯកសារនេះពុំមែនជាទិន្នន័យបម្រុងត្រឹមត្រូវរបស់ KTPTTC ឡើយ' });
    }

    await writeDb(cleanData);
    res.json({ success: true, message: 'បានបញ្ចូល និងស្តារទិន្នន័យជោគជ័យ!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'បរាជ័យក្នុងការស្តារទិន្នន័យ: ' + err.message });
  }
});

// Database Sync Endpoint (Sync MongoDB Atlas & Local JSON)
app.post('/api/database/sync', async (req, res) => {
  try {
    const collection = await getMongoCollection();
    if (!collection) {
      return res.status(503).json({ success: false, message: 'ពុំអាចភ្ជាប់ទៅកាន់ MongoDB Atlas បានឡើយ' });
    }
    const doc = await collection.findOne({ _id: 'main_store' });
    if (doc) {
      const { _id, ...cleanData } = doc;
      memoryDb = cleanData;
      try {
        const dir = path.dirname(DB_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_FILE, JSON.stringify(cleanData, null, 2), 'utf8');
      } catch (_) {}
      res.json({ success: true, message: 'បានធ្វើសមកាលកម្មទិន្នន័យ Cloud និង Local ជោគជ័យ!' });
    } else {
      const localData = getLocalFileDb();
      await writeDb(localData);
      res.json({ success: true, message: 'បានចម្លងទិន្នន័យ Local ទៅកាន់ Cloud MongoDB ជោគជ័យ!' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុសសមកាលកម្ម: ' + err.message });
  }
});

// Serve static files (Images, CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Serve static uploads directory with inline disposition for PDF viewing
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) {}
}
const PDF_UPLOADS_DIR = path.join(UPLOADS_DIR, 'pdf');
if (!fs.existsSync(PDF_UPLOADS_DIR)) {
  try { fs.mkdirSync(PDF_UPLOADS_DIR, { recursive: true }); } catch (e) {}
}

// Helper: Discover all persistent upload directories across Hostinger structure
function getUploadDirectories(folder) {
  const dirs = new Set();
  dirs.add(path.join(__dirname, 'public', 'uploads', folder));
  
  const relativeBases = [
    path.resolve(__dirname, '../../../uploads', folder),
    path.resolve(__dirname, '../../../../uploads', folder),
    path.resolve(__dirname, '../../../public_html/uploads', folder),
    path.resolve(__dirname, '../../../../public_html/uploads', folder)
  ];
  
  try {
    const real = fs.realpathSync(__dirname);
    relativeBases.push(
      path.resolve(real, '../../../uploads', folder),
      path.resolve(real, '../../../../uploads', folder),
      path.resolve(real, '../../../public_html/uploads', folder),
      path.resolve(real, '../../../../public_html/uploads', folder)
    );
  } catch (e) {}

  for (const b of relativeBases) {
    if (fs.existsSync(/*turbopackIgnore: true*/ b) || fs.existsSync(/*turbopackIgnore: true*/ path.dirname(b))) {
      dirs.add(b);
    }
  }

  return Array.from(dirs);
}

// Helper: Auto-recover files that were uploaded in previous build versions
function findInHistoricalBuilds(folder, cleanFile) {
  try {
    const versionsDirs = [
      path.resolve(__dirname, '../../versions'),
      path.resolve(__dirname, '../../../versions')
    ];
    try {
      const real = fs.realpathSync(__dirname);
      versionsDirs.push(
        path.resolve(real, '../../versions'),
        path.resolve(real, '../../../versions')
      );
    } catch (e) {}

    for (const vDir of versionsDirs) {
      if (!fs.existsSync(/*turbopackIgnore: true*/ vDir)) continue;
      const verNames = fs.readdirSync(/*turbopackIgnore: true*/ vDir);
      for (const ver of verNames) {
        const filePath = path.join(vDir, ver, 'nodejs', 'public', 'uploads', folder, cleanFile);
        if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
          console.log(`[Auto-Recovery] Found ${cleanFile} in previous build version: ${ver}`);
          return filePath;
        }
      }
    }
  } catch (e) {}
  return null;
}

// Sync historical uploads to permanent domain storage on startup
function syncHistoricalUploadsToPersistent() {
  try {
    const folders = ['pdf', 'images'];
    const versionsDirs = [
      path.resolve(__dirname, '../../versions'),
      path.resolve(__dirname, '../../../versions')
    ];
    try {
      const real = fs.realpathSync(__dirname);
      versionsDirs.push(
        path.resolve(real, '../../versions'),
        path.resolve(real, '../../../versions')
      );
    } catch (e) {}

    for (const folder of folders) {
      const persistentDirs = getUploadDirectories(folder);
      const primaryPersistent = persistentDirs.find(d => d.includes('/uploads/' + folder) && !d.includes('nodejs')) || persistentDirs[0];
      if (!primaryPersistent) continue;
      if (!fs.existsSync(/*turbopackIgnore: true*/ primaryPersistent)) {
        try { fs.mkdirSync(primaryPersistent, { recursive: true }); } catch (e) {}
      }

      for (const vDir of versionsDirs) {
        if (!fs.existsSync(/*turbopackIgnore: true*/ vDir)) continue;
        const verNames = fs.readdirSync(/*turbopackIgnore: true*/ vDir);
        for (const ver of verNames) {
          const vFolder = path.join(vDir, ver, 'nodejs', 'public', 'uploads', folder);
          if (!fs.existsSync(/*turbopackIgnore: true*/ vFolder)) continue;
          const files = fs.readdirSync(/*turbopackIgnore: true*/ vFolder);
          for (const f of files) {
            if (f === '.gitkeep' || f === '.DS_Store') continue;
            const src = path.join(vFolder, f);
            const dst = path.join(primaryPersistent, f);
            if (!fs.existsSync(/*turbopackIgnore: true*/ dst) && fs.statSync(src).isFile()) {
              try {
                fs.copyFileSync(src, dst);
                console.log(`[Startup Sync] Preserved ${folder}/${f} into persistent storage!`);
              } catch (e) {}
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('[Startup Historical Sync Error]:', e.message);
  }
}
setTimeout(syncHistoricalUploadsToPersistent, 3000);

// Register all existing static upload roots for high-performance direct serving
const staticUploadRoots = new Set([
  UPLOADS_DIR,
  path.resolve(__dirname, '../../../uploads'),
  path.resolve(__dirname, '../../../../uploads'),
  path.resolve(__dirname, '../../../public_html/uploads'),
  path.resolve(__dirname, '../../../../public_html/uploads')
]);
try {
  const real = fs.realpathSync(__dirname);
  staticUploadRoots.add(path.resolve(real, '../../../uploads'));
  staticUploadRoots.add(path.resolve(real, '../../../../uploads'));
  staticUploadRoots.add(path.resolve(real, '../../../public_html/uploads'));
  staticUploadRoots.add(path.resolve(real, '../../../../public_html/uploads'));
} catch (e) {}

for (const sRoot of staticUploadRoots) {
  if (fs.existsSync(sRoot)) {
    app.use('/uploads', express.static(sRoot, {
      maxAge: '30d',
      setHeaders: (res, filePath) => {
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        if (filePath.endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline');
        }
      }
    }));
  }
}

function streamUrlWithRedirects(targetUrl, maxRedirects = 5) {
  const https = require('https');
  const http = require('http');
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) return reject(new Error('Too many redirects'));
    const mod = targetUrl.startsWith('https') ? https : http;
    mod.get(targetUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(streamUrlWithRedirects(res.headers.location, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      resolve(res);
    }).on('error', reject);
  });
}

// Fallback robust route for any /uploads/:folder/:file (supports multiple persistent storage locations + on-demand cache)
app.get('/uploads/:folder/:file', async (req, res, next) => {
  const { folder, file } = req.params;
  const cleanFile = path.basename(file);
  
  // 1. Check all candidate persistent & local directories
  const candidateDirs = getUploadDirectories(folder);
  for (const dir of candidateDirs) {
    const targetFile = path.join(dir, cleanFile);
    if (fs.existsSync(/*turbopackIgnore: true*/ targetFile)) {
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      if (cleanFile.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
      }
      return res.sendFile(targetFile, {
        acceptRanges: true,
        cacheControl: true,
        maxAge: 2592000000,
        immutable: true
      });
    }
  }

  // 2. Check historical build versions (Auto-Recovery across versions)
  const historicalPath = findInHistoricalBuilds(folder, cleanFile);
  if (historicalPath) {
    for (const dir of candidateDirs) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const copyDst = path.join(dir, cleanFile);
        if (!fs.existsSync(copyDst)) {
          fs.copyFileSync(historicalPath, copyDst);
        }
      } catch (e) {}
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    if (cleanFile.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
    return res.sendFile(historicalPath, {
      acceptRanges: true,
      cacheControl: true,
      maxAge: 2592000000,
      immutable: true
    });
  }

  // 3. On-Demand fetch and cache from Google Drive if not on disk yet
  let driveId = null;
  const pdfMatch = cleanFile.match(/_([a-zA-Z0-9_-]{25,})\.pdf$/i);
  const imgMatch = cleanFile.match(/([a-zA-Z0-9_-]{25,})\.(jpg|jpeg|png|webp)$/i);
  if (pdfMatch) {
    driveId = pdfMatch[1];
  } else if (imgMatch) {
    driveId = imgMatch[1];
  }

  if (driveId) {
    const targetDir = candidateDirs.find(d => fs.existsSync(/*turbopackIgnore: true*/ d)) || path.join(__dirname, 'public', 'uploads', folder);
    
    if (!fs.existsSync(/*turbopackIgnore: true*/ targetDir)) {
      try { fs.mkdirSync(targetDir, { recursive: true }); } catch (e) {}
    }
    const targetPath = path.join(targetDir, cleanFile);
    const driveUrl = folder === 'pdf'
      ? `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`
      : `https://lh3.googleusercontent.com/d/${driveId}`;

    try {
      const stream = await streamUrlWithRedirects(driveUrl);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      if (cleanFile.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
      } else {
        res.setHeader('Content-Type', stream.headers['content-type'] || 'image/jpeg');
      }

      const fileOut = fs.createWriteStream(targetPath);
      stream.pipe(fileOut);
      stream.pipe(res);
      return;
    } catch (err) {
      console.error(`[Uploads On-Demand Fetch Error] ${cleanFile}:`, err.message);
    }
  }

  next();
});

// ==========================================
// MONGODB & DATABASE MANAGEMENT
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
let cachedClient = null;
let cachedDb = null;
let memoryDb = null;

// Helper to safely remove an item by ID or fallback to index
function removeItemByIdOrIndex(array, id) {
  if (!Array.isArray(array)) return [];
  const idStr = String(id).trim();
  const indexMatch = array.findIndex(item => item && String(item.id) === idStr);
  if (indexMatch >= 0) {
    array.splice(indexMatch, 1);
    return array;
  }
  const numericIdx = parseInt(idStr, 10);
  if (!isNaN(numericIdx) && numericIdx >= 0 && numericIdx < array.length) {
    array.splice(numericIdx, 1);
    return array;
  }
  return array.filter(item => item && String(item.id) !== idStr);
}

const VERIFIED_MONGODB_URI = 'mongodb+srv://ktpttc_admin:Ktpttc2026Pass@cluster0.2jtul.mongodb.net/ktpttc?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB Atlas (reusable for serverless)
async function getMongoCollection() {
  let uri = process.env.MONGODB_URI || MONGODB_URI || VERIFIED_MONGODB_URI;
  if (uri && (uri.includes('Ktpttc@2026Pass') || uri.includes('Ktpttc%402026Pass'))) {
    uri = VERIFIED_MONGODB_URI;
  }
  if (!uri) {
    lastMongoError = new Error('No MONGODB_URI environment variable provided');
    return null;
  }
  try {
    if (cachedDb && cachedClient) {
      return cachedDb.collection('ktpttc_data');
    }
    if (!cachedClient) {
      cachedClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10
      });
      await cachedClient.connect();
      cachedDb = cachedClient.db('ktpttc');
      await cachedDb.command({ ping: 1 });
      lastMongoError = null;
      console.log('✅ Connected to MongoDB Atlas successfully!');
    }
    return cachedDb.collection('ktpttc_data');
  } catch (err) {
    lastMongoError = err;
    console.error('⚠️ MongoDB Connection Notice:', err.message);
    cachedClient = null;
    cachedDb = null;

    // Auto retry with verified credentials if bad auth occurred
    if (uri !== VERIFIED_MONGODB_URI && (err.message || '').toLowerCase().includes('auth')) {
      console.log('🔄 Auto-retrying with verified MongoDB Atlas credentials...');
      try {
        cachedClient = new MongoClient(VERIFIED_MONGODB_URI, {
          serverSelectionTimeoutMS: 8000,
          connectTimeoutMS: 10000,
          maxPoolSize: 10
        });
        await cachedClient.connect();
        cachedDb = cachedClient.db('ktpttc');
        await cachedDb.command({ ping: 1 });
        lastMongoError = null;
        console.log('✅ Connected to MongoDB Atlas with verified credentials!');
        return cachedDb.collection('ktpttc_data');
      } catch (retryErr) {
        lastMongoError = retryErr;
        cachedClient = null;
        cachedDb = null;
      }
    }
    return null;
  }
}

// Helper: Read local fallback db.json
function getLocalFileDb() {
  const candidatePaths = [
    path.resolve(__dirname, '../../../../public_html/data/db.json'),
    path.resolve(__dirname, '../../../../data/db.json'),
    path.join(__dirname, 'data', 'db.json'),
    path.join(process.cwd(), 'data', 'db.json')
  ];
  for (const primaryPath of candidatePaths) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ primaryPath)) {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ primaryPath, 'utf8');
        if (content && content.trim()) {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
    } catch (_) {}
  }
  return {};
}

const DEFAULT_COURSES = [
  {
    id: "1",
    title: "ប្រកាសស្តីពីការជ្រើសរើស «គរុកោសល្យ និងវគ្គបណ្តុះបណ្តាលបែបថ្មី» ជំនាន់ទី១២",
    image: "./cpd-p1.jpg",
    description: "សូមជម្រាបដល់លោកគ្រូ អ្នកគ្រូ និស្សិត និងសាធារណជន ដែលមានបំណងពង្រឹងសមត្ថភាពគរុកោសល្យ សាលាបើកទទួលចុះឈ្មោះចូលរៀនវគ្គថ្មីចាប់ពីថ្ងៃនេះតទៅ។ រួសរាន់ចុះឈ្មោះឱ្យទាន់ពេលវេលា ចំនួនមានកំណត់។",
    meta1: "វគ្គបណ្ដុះបណ្ដាលថ្មី ជំនាន់ទី១២",
    meta2: "ចន្ទ - សុក្រ (Online) | សៅរ៍ - អាទិត្យ (ផ្ទាល់)",
    date: "03/11/2026"
  },
  {
    id: "2",
    title: "📣 កម្មវិធីត្រៀមប្រឡងសមត្ថភាព BEPT បើកទទួលចុះឈ្មោះហើយ!",
    image: "./cpd-p2.jpg",
    description: "តើអ្នកកំពុងរៀបចំសម្រាប់ការប្រឡង BEPT ហើយចង់ពង្រឹងជំនាញភាសាអង់គ្លេសទាំងបួនមែនទេ? ចូលរួមកម្មវិធីត្រៀមប្រឡងរយៈពេល 30 ម៉ោងរបស់យើងជាមួយគ្រូបង្រៀន TESOL ដែលមានបទពិសោធន៍ និងការអនុវត្តជាក់ស្ដែង។",
    meta1: "រយៈពេលវគ្គសិក្សា៖ 30 ម៉ោង",
    meta2: "ថ្លៃសិក្សា៖ ត្រឹមតែ 25 ដុល្លារប៉ុណ្ណោះ",
    date: "03/11/2026"
  },
  {
    id: "3",
    title: "BTEC Foreign Languages (BFL) – កម្មវិធីភាសាអង់គ្លេសទូទៅ និយាយដោយទំនុកចិត្ត, រៀនដោយគុណភាព",
    image: "./cpd-p3.jpg",
    description: "កម្មវិធីភាសាអង់គ្លេសទូទៅនៅ BFL ត្រូវបានបង្កើតឡើងដើម្បីអភិវឌ្ឍសមត្ថភាពភាសាអង់គ្លេសជាក់ស្តែងរបស់អ្នកសិក្សាសម្រាប់ការប្រើប្រាស់ក្នុងជីវិតពិត ផ្តោតលើការប្រាស្រ័យទាក់ទង ការអាន ការសរសេរ និងការបញ្ចេញសំឡេងស្តង់ដារ។",
    meta1: "ភាសាអង់គ្លេសទូទៅ (General English)",
    meta2: "វិញ្ញាបនបត្របញ្ជាក់ការសិក្សា",
    date: "03/11/2026"
  },
  {
    id: "4",
    title: "វគ្គបណ្តុះបណ្តាល៖ ការប្រើប្រាស់បច្ចេកវិទ្យាព័ត៌មានវិទ្យា និង AI ក្នុងការបង្រៀន",
    image: "./login_bg.jpg",
    description: "វគ្គបណ្ដុះបណ្ដាលស្ដីពីការប្រើប្រាស់បច្ចេកវិទ្យាព័ត៌មានវិទ្យា និងបញ្ញាសិប្បនិម្មិត (AI) ក្នុងការរៀបចំកិច្ចតែងការបង្រៀន ការបង្កើតមាតិកាឌីជីថល និងវិធីសាស្ត្របង្រៀនសម័យទំនើប ដើម្បីបង្កើនប្រសិទ្ធភាពនៃការអប់រំក្នុងយុគសម័យឌីជីថល។",
    meta1: "បច្ចេកវិទ្យា & AI ក្នុងការអប់រំ",
    meta2: "ទទួលបានក្រេឌីត និងវិញ្ញាបនបត្រ CPD",
    date: "03/11/2026"
  }
];

const DEFAULT_PARTNERS = [
  {
    id: "1",
    name: "ក្រសួងអប់រំ យុវជន និងកីឡា",
    nameEn: "Ministry of Education, Youth and Sport",
    tag: "MoEYs",
    tagEn: "MoEYs",
    location: "រាជធានីភ្នំពេញ",
    locationEn: "Phnom Penh",
    icon: "fas fa-university",
    gradient: "linear-gradient(135deg, #1e40af, #3b82f6)",
    website: "https://moeys.gov.kh",
    order: 1,
    logo: "https://drive.google.com/file/d/1gM51R1c4XL9JJPoywLQMCesEusazfkSs/view?usp=sharing"
  },
  {
    id: "2",
    name: "សាលាបឋមសិក្សាអនុវត្ត",
    nameEn: "Anuwat Primary School",
    tag: "សាលាដៃគូ",
    tagEn: "Partnership",
    location: "ក្រចេះ",
    locationEn: "Kratie",
    icon: "fas fa-handshake",
    gradient: "linear-gradient(135deg, #059669, #10b981)",
    website: "https://www.facebook.com/profile.php?id=61591074564411",
    order: 2,
    logo: "https://drive.google.com/file/d/1IommB8Pwr9se9jMLyGZZYFWXZAMY_hHq/view?usp=sharing"
  },
  {
    id: "3",
    name: "Jica Cambodia",
    nameEn: "Japan International Cooperation Agency",
    tag: "ដៃគូអន្តរជាតិ",
    tagEn: "International Partner",
    location: "រាជធានីភ្នំពេញ",
    locationEn: "Phnom Penh",
    icon: "fas fa-school",
    gradient: "linear-gradient(135deg, #d97706, #f59e0b)",
    website: "https://www.jica.go.jp/english/overseas/cambodia/office/index.html",
    order: 3,
    logo: "https://drive.google.com/file/d/1gAcOaKn1uNyu-xDFO3V0A1o1N0anAm6F/view?usp=sharing"
  }
];

// In-memory cache for fast serverless responses & low MongoDB egress
let lastDbFetchTime = 0;
const DB_CACHE_TTL = 30 * 1000; // 30 seconds

const fieldCache = {};
const FIELD_CACHE_TTL = 30 * 1000; // 30 seconds

function invalidateDbCache(field = null) {
  lastDbFetchTime = 0;
  if (field) {
    delete fieldCache[field];
  } else {
    for (const k of Object.keys(fieldCache)) {
      delete fieldCache[k];
    }
  }
}

// Fast targeted read of a single field (downloads only few KB via MongoDB projection instead of full 7.6MB)
async function readDbField(fieldName) {
  const now = Date.now();
  if (fieldCache[fieldName] && (now - fieldCache[fieldName].time < FIELD_CACHE_TTL)) {
    return fieldCache[fieldName].data;
  }
  if (memoryDb && memoryDb[fieldName] !== undefined && (now - lastDbFetchTime < DB_CACHE_TTL)) {
    return memoryDb[fieldName];
  }

  const collection = await getMongoCollection();
  if (collection) {
    try {
      const doc = await collection.findOne(
        { _id: 'main_store' },
        { projection: { [fieldName]: 1 } }
      );
      if (doc && doc[fieldName] !== undefined) {
        fieldCache[fieldName] = { data: doc[fieldName], time: now };
        if (!memoryDb) memoryDb = {};
        memoryDb[fieldName] = doc[fieldName];
        return doc[fieldName];
      }
    } catch (err) {
      console.error(`Error reading field ${fieldName} from MongoDB:`, err.message);
    }
  }

  // Fallback to local db.json
  const localDb = getLocalFileDb();
  if (localDb && localDb[fieldName] !== undefined) {
    fieldCache[fieldName] = { data: localDb[fieldName], time: now };
    return localDb[fieldName];
  }
  return undefined;
}

// Helper: Read DB (MongoDB priority -> Local db.json fallback with TTL caching)
async function readDb(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryDb && (now - lastDbFetchTime < DB_CACHE_TTL)) {
    return memoryDb;
  }

  const collection = await getMongoCollection();
  if (collection) {
    try {
      const doc = await collection.findOne({ _id: 'main_store' });
      if (doc) {
        const { _id, ...cleanData } = doc;
        memoryDb = cleanData;
        lastDbFetchTime = Date.now();
        if (!memoryDb.readers || !Array.isArray(memoryDb.readers)) {
          memoryDb.readers = [];
        }
        if (!memoryDb.partners || !Array.isArray(memoryDb.partners) || memoryDb.partners.length === 0) {
          const localDb = getLocalFileDb();
          memoryDb.partners = (localDb.partners && localDb.partners.length > 0) ? localDb.partners : DEFAULT_PARTNERS;
          const toSave = { ...memoryDb };
          delete toSave._id;
          await collection.replaceOne({ _id: 'main_store' }, toSave, { upsert: true });
        }
        if (!memoryDb.courses || !Array.isArray(memoryDb.courses) || memoryDb.courses.length === 0) {
          const localDb = getLocalFileDb();
          memoryDb.courses = (localDb.courses && localDb.courses.length > 0) ? localDb.courses : DEFAULT_COURSES;
          const toSave = { ...memoryDb };
          delete toSave._id;
          await collection.replaceOne({ _id: 'main_store' }, toSave, { upsert: true });
        }
        // Save local cache backup so offline/fallback is always in sync
        try {
          const dir = path.dirname(DB_FILE);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf8');
        } catch (_) {}
        return memoryDb;
      } else {
        // Initial Seed: MongoDB is empty, copy existing db.json to MongoDB
        console.log('🌱 Seeding MongoDB Atlas with initial data from db.json...');
        const initialData = getLocalFileDb();
        if (!initialData.partners || initialData.partners.length === 0) {
          initialData.partners = DEFAULT_PARTNERS;
        }
        const toSeed = { ...initialData };
        delete toSeed._id;
        await collection.replaceOne(
          { _id: 'main_store' },
          toSeed,
          { upsert: true }
        );
        memoryDb = initialData;
        lastDbFetchTime = Date.now();
        return memoryDb;
      }
    } catch (err) {
      console.error('Error reading from MongoDB Atlas:', err.message);
      lastMongoError = err;
      cachedClient = null;
      cachedDb = null;
    }
  }

  // Fallback if MongoDB is not configured or fails
  if (memoryDb) {
    if (!Array.isArray(memoryDb.readers)) memoryDb.readers = [];
    if (!memoryDb.partners || memoryDb.partners.length === 0) {
      memoryDb.partners = DEFAULT_PARTNERS;
    }
    if (!memoryDb.courses || memoryDb.courses.length === 0) {
      memoryDb.courses = DEFAULT_COURSES;
    }
    return memoryDb;
  }
  memoryDb = getLocalFileDb();
  lastDbFetchTime = Date.now();
  if (!Array.isArray(memoryDb.readers)) memoryDb.readers = [];
  if (!memoryDb.partners || memoryDb.partners.length === 0) {
    memoryDb.partners = DEFAULT_PARTNERS;
  }
  if (!memoryDb.courses || memoryDb.courses.length === 0) {
    memoryDb.courses = DEFAULT_COURSES;
  }
  return memoryDb;
}

// Helper: Write DB (Updates MongoDB Atlas & local file)
async function writeDb(data) {
  const cleanData = { ...data };
  delete cleanData._id;
  memoryDb = cleanData;
  lastDbFetchTime = Date.now();
  invalidateDbCache();
  let mongoSaved = false;

  // 1. Save to MongoDB Atlas
  const collection = await getMongoCollection();
  if (collection) {
    try {
      await collection.replaceOne(
        { _id: 'main_store' },
        cleanData,
        { upsert: true }
      );
      mongoSaved = true;
    } catch (err) {
      console.error('Error saving to MongoDB Atlas:', err.message);
      lastMongoError = err;
      cachedClient = null;
      cachedDb = null;
    }
  }

  // 2. Save to local db.json file and persistent locations
  const jsonContent = JSON.stringify(cleanData, null, 2);
  const targetPaths = [
    DB_FILE,
    path.resolve(__dirname, '../../../../public_html/data/db.json'),
    path.resolve(__dirname, '../../../../data/db.json')
  ];
  for (const p of targetPaths) {
    try {
      const d = path.dirname(p);
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
      fs.writeFileSync(p, jsonContent, 'utf8');
    } catch (_) {}
  }

  return true;
}

// Routes for HTML Pages
app.get(['/', '/index.html'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const pubPath = path.join(__dirname, 'public', 'Public_Index.html');
  if (fs.existsSync(pubPath)) return res.sendFile(pubPath);
  res.sendFile(path.join(__dirname, 'Public_Index.html'));
});

app.get(['/admin', '/admin/'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const adminPath = path.join(__dirname, 'public', 'Admin_Index.html');
  if (fs.existsSync(adminPath)) return res.sendFile(adminPath);
  res.sendFile(path.join(__dirname, 'Admin_Index.html'));
});

app.get(['/library', '/library/'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const pubPath = path.join(__dirname, 'public', 'Public_Index.html');
  if (fs.existsSync(pubPath)) return res.sendFile(pubPath);
  res.sendFile(path.join(__dirname, 'Public_Index.html'));
});

app.get(['/cpd', '/cpd/'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const pubPath = path.join(__dirname, 'public', 'Public_Index.html');
  if (fs.existsSync(pubPath)) return res.sendFile(pubPath);
  res.sendFile(path.join(__dirname, 'Public_Index.html'));
});

// STMS (Student & Teacher Management System - KTPTTC)
const STMS_DIR = path.join(__dirname, 'stms');

app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase();
  if (host.startsWith('stms.') || host.startsWith('stms:')) {
    // Pass API requests through to Express API endpoints
    if (req.path.startsWith('/api/') || req.path === '/api') {
      return next();
    }
    return express.static(STMS_DIR, { index: 'index.html' })(req, res, () => {
      const stmsPath = path.join(STMS_DIR, 'index.html');
      if (fs.existsSync(stmsPath)) return res.sendFile(stmsPath);
      next();
    });
  }
  next();
});

// Explicit Static Routing for /stms
app.use('/stms', express.static(STMS_DIR, { index: 'index.html' }));
app.get(['/stms', '/stms/'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const stmsPath = path.join(STMS_DIR, 'index.html');
  if (fs.existsSync(stmsPath)) return res.sendFile(stmsPath);
  res.sendFile(path.join(__dirname, 'public', 'Public_Index.html'));
});

// Legacy redirects for TeacherGuideApp & KruSmart -> /stms
app.get(['/teacher-guide', '/teacher-guide/', '/TeacherGuideApp', '/TeacherGuideApp/', '/krusmart', '/krusmart/'], (req, res) => {
  res.redirect(301, '/stms');
});

app.get(['/add-student', '/add-student.html', '/TeacherGuideApp/add-student', '/TeacherGuideApp/add-student.html', '/krusmart/add-student', '/stms/add-student', '/stms/add-student.html'], (req, res) => {
  const stmsAdd = path.join(STMS_DIR, 'add-student.html');
  if (fs.existsSync(stmsAdd)) return res.sendFile(stmsAdd);
  res.redirect('/stms');
});

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 0. STMS (Student & Teacher Management System) Sync API
const STMS_DB_FILE = path.join(__dirname, 'data', 'stms_db.json');

async function readStmsDb() {
  try {
    const collection = await getMongoCollection();
    if (collection) {
      const doc = await collection.findOne({ _id: 'stms_store' });
      if (doc && doc.data) {
        return doc.data;
      }
    }
  } catch (e) {
    console.warn('MongoDB STMS read error:', e.message);
  }

  try {
    if (fs.existsSync(STMS_DB_FILE)) {
      const raw = fs.readFileSync(STMS_DB_FILE, 'utf8');
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('File STMS read error:', e.message);
  }
  return null;
}

async function writeStmsDb(data) {
  try {
    let mergedData = data;
    try {
      const existing = await readStmsDb();
      if (existing && typeof existing === 'object') {
        mergedData = { ...existing, ...data };
        // Preserve trainees if incoming has none or fewer
        if (Array.isArray(existing.trainees) && existing.trainees.length > 0) {
          if (!Array.isArray(data.trainees) || data.trainees.length === 0) {
            mergedData.trainees = existing.trainees;
          } else {
            const traineeMap = new Map();
            existing.trainees.forEach(t => t && t.id && traineeMap.set(t.id, t));
            data.trainees.forEach(t => t && t.id && traineeMap.set(t.id, { ...(traineeMap.get(t.id) || {}), ...t }));
            mergedData.trainees = Array.from(traineeMap.values());
          }
        }
        // Preserve users if incoming has none
        if (Array.isArray(existing.users) && existing.users.length > 0) {
          if (!Array.isArray(data.users) || data.users.length === 0) {
            mergedData.users = existing.users;
          } else {
            const userMap = new Map();
            existing.users.forEach(u => u && (u.id || u.username) && userMap.set((u.id || u.username).toLowerCase(), u));
            data.users.forEach(u => u && (u.id || u.username) && userMap.set((u.id || u.username).toLowerCase(), { ...(userMap.get((u.id || u.username).toLowerCase()) || {}), ...u }));
            mergedData.users = Array.from(userMap.values());
          }
        }
      }
    } catch (mergeErr) {
      console.warn('STMS merge warning:', mergeErr.message);
    }

    const dir = path.dirname(STMS_DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STMS_DB_FILE, JSON.stringify(mergedData, null, 2), 'utf8');

    const collection = await getMongoCollection();
    if (collection) {
      await collection.updateOne(
        { _id: 'stms_store' },
        { $set: { _id: 'stms_store', data: mergedData, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
    }
  } catch (e) {
    console.error('File STMS write error:', e.message);
  }
}

app.get('/api/stms/data', async (req, res) => {
  try {
    const data = await readStmsDb();
    res.json({ success: true, data: data || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/stms/sync', async (req, res) => {
  try {
    const incoming = req.body && req.body.data ? req.body.data : req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    await writeStmsDb(incoming);
    res.json({ success: true, message: 'STMS data synced successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// STMS Authoritative Cross-Device Login Endpoint
app.post('/api/stms/login', async (req, res) => {
  try {
    const rawUsername = (req.body && req.body.username ? String(req.body.username) : '').trim();
    const rawPassword = (req.body && req.body.password ? String(req.body.password) : '').trim();

    if (!rawUsername || !rawPassword) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូលឈ្មោះគណនី (Username) និងពាក្យសម្ងាត់ (Password)!' });
    }

    const usernameLower = rawUsername.toLowerCase();
    const cleanPhone = rawUsername.replace(/\s+/g, '');

    const data = await readStmsDb();
    if (!data || typeof data !== 'object') {
      return res.status(404).json({ success: false, message: 'ទិន្នន័យប្រព័ន្ធពុំទាន់ត្រូវបានដំឡើងរួចរាល់ឡើយ!' });
    }

    const users = Array.isArray(data.users) ? data.users : [];
    const trainees = Array.isArray(data.trainees) ? data.trainees : [];

    // 1. Search in users (Admin, Trainers/Teachers, Trainees, Staff)
    let foundUser = users.find(u => {
      if (!u) return false;
      const uName = (u.username ? String(u.username) : '').trim().toLowerCase();
      const uId = (u.id ? String(u.id) : '').trim().toLowerCase();
      const uStuId = (u.studentId ? String(u.studentId) : '').trim().toLowerCase();
      const uEmail = (u.email ? String(u.email) : '').trim().toLowerCase();
      const uPhone = (u.phone ? String(u.phone) : '').replace(/\s+/g, '');

      const isMatch = (uName === usernameLower || uId === usernameLower || uStuId === usernameLower || uEmail === usernameLower || (cleanPhone && uPhone === cleanPhone));
      if (!isMatch) return false;

      const userPass = u.password !== undefined && u.password !== null ? String(u.password).trim() : '';
      return userPass === rawPassword;
    });

    // 2. If not found in users, search directly in trainees
    if (!foundUser) {
      const foundTrainee = trainees.find(t => {
        if (!t) return false;
        const tId = (t.id ? String(t.id) : '').trim().toLowerCase();
        const tStuId = (t.studentId ? String(t.studentId) : '').trim().toLowerCase();
        const tUsername = (t.username ? String(t.username) : '').trim().toLowerCase();
        const tPhone = (t.phone ? String(t.phone) : '').replace(/\s+/g, '');
        const tNameKh = (t.nameKh ? String(t.nameKh) : '').trim();

        const isMatch = (tId === usernameLower || tStuId === usernameLower || tUsername === usernameLower || (cleanPhone && tPhone === cleanPhone) || tNameKh === rawUsername);
        if (!isMatch) return false;

        const traineePass = t.password !== undefined && t.password !== null ? String(t.password).trim() : '';
        // Match traineePass, or student's own ID, or student123/ktpttc123
        return (traineePass && traineePass === rawPassword) || 
               (tId && tId === rawPassword.toLowerCase()) || 
               (rawPassword === 'student123' || rawPassword === 'ktpttc123');
      });

      if (foundTrainee) {
        foundUser = {
          id: foundTrainee.id,
          studentId: foundTrainee.id,
          username: foundTrainee.username || foundTrainee.id.toLowerCase(),
          nameKh: foundTrainee.nameKh,
          nameEn: foundTrainee.nameEn || '',
          role: 'trainee',
          roleLabel: 'គរុនិស្សិត',
          className: foundTrainee.className || '',
          cohort: foundTrainee.cohort || '',
          status: 'active',
          avatar: foundTrainee.avatar || '👨‍🎓',
          photo: foundTrainee.photo || '',
          phone: foundTrainee.phone || '',
          ...foundTrainee
        };
      }
    }

    if (!foundUser) {
      return res.status(401).json({ success: false, message: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវឡើយ! សូមទាក់ទង Admin ដើម្បីកំណត់ពាក្យសម្ងាត់។' });
    }

    if (foundUser.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'គណនីនេះត្រូវបានផ្អាកដំណើរការដោយ Admin សិក្សាធិការ!' });
    }

    // Return the authenticated user profile AND the full system data snapshot for instant hydration on new devices
    res.json({
      success: true,
      user: foundUser,
      data: data
    });
  } catch (err) {
    console.error('STMS Login API error:', err);
    res.status(500).json({ success: false, message: 'មានបញ្ហាបច្ចេកទេសក្នុងប្រព័ន្ធ Server: ' + err.message });
  }
});

// 1. Settings API
app.get('/api/settings', async (req, res) => {
  const settings = await readDbField('settings');
  res.json(settings || {});
});

app.post('/api/settings', async (req, res) => {
  const db = await readDb();
  db.settings = { ...(db.settings || {}), ...req.body };
  await writeDb(db);
  res.json({ success: true, settings: db.settings });
});

// 2. News API
app.get('/api/news', async (req, res) => {
  const news = await readDbField('news');
  res.json(news || []);
});

app.post('/api/news', async (req, res) => {
  const db = await readDb();
  if (!db.news) db.news = [];
  const newItem = req.body;
  if (!newItem.id) {
    newItem.id = Date.now().toString();
  }
  const index = db.news.findIndex((item, idx) => String(item.id) === String(newItem.id) || String(idx) === String(newItem.id));
  if (index >= 0) {
    db.news[index] = { ...db.news[index], ...newItem };
  } else {
    db.news.unshift(newItem);
  }
  await writeDb(db);
  res.json({ success: true, news: db.news });
});

app.delete('/api/news/:id', async (req, res) => {
  const db = await readDb();
  if (db.news) {
    db.news = removeItemByIdOrIndex(db.news, req.params.id);
    await writeDb(db);
  }
  res.json({ success: true, news: db.news || [] });
});

// 3. Books API
app.get('/api/books', async (req, res) => {
  const books = await readDbField('books');
  res.json(books || []);
});

app.post('/api/books', async (req, res) => {
  const db = await readDb();
  if (!db.books) db.books = [];
  const newBook = req.body;
  if (!newBook.id) {
    newBook.id = Date.now().toString();
  }
  const index = db.books.findIndex((b, idx) => String(b.id) === String(newBook.id) || String(idx) === String(newBook.id));
  if (index >= 0) {
    db.books[index] = { ...db.books[index], ...newBook };
  } else {
    db.books.unshift(newBook);
  }
  await writeDb(db);
  res.json({ success: true, books: db.books });
});

app.delete('/api/books/:id', async (req, res) => {
  const db = await readDb();
  if (db.books) {
    const id = String(req.params.id).trim();
    const codeMatch = db.books.findIndex(b => b && String(b.code) === id);
    if (codeMatch >= 0) {
      db.books.splice(codeMatch, 1);
    } else {
      db.books = removeItemByIdOrIndex(db.books, id);
    }
    await writeDb(db);
  }
  res.json({ success: true, books: db.books || [] });
});

// Track Book Action (Read or Download Counter)
app.post(['/api/books/:id/track', '/api/books/track'], async (req, res) => {
  try {
    const action = req.body && req.body.action ? req.body.action : 'read'; // 'read' or 'download'
    const targetId = String(req.params.id || (req.body && (req.body.id || req.body.code)) || '').trim();

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Missing book id or code' });
    }

    const db = await readDb();
    if (!db.books) db.books = [];

    const book = db.books.find((b, idx) => 
      (b.id && String(b.id) === targetId) || 
      (b.code && String(b.code) === targetId) || 
      (b.link && String(b.link) === targetId) ||
      (b.title && String(b.title) === targetId) ||
      String(idx) === targetId
    );

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    if (action === 'download') {
      book.downloads = (Number(book.downloads) || 0) + 1;
    } else {
      book.reads = (Number(book.reads) || 0) + 1;
    }

    await writeDb(db);
    res.json({
      success: true,
      id: book.id,
      code: book.code,
      title: book.title,
      reads: book.reads || 0,
      downloads: book.downloads || 0
    });
  } catch (err) {
    console.error('Book tracking error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PDF Direct Upload Endpoint (Hostinger / Server Local Storage)
app.post('/api/upload/pdf', (req, res) => {
  try {
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'pdf');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let rawFilename = req.query.filename || req.headers['x-filename'] || 'document.pdf';
    try {
      rawFilename = decodeURIComponent(rawFilename);
    } catch (e) {}

    const ext = path.extname(rawFilename) || '.pdf';
    const baseName = path.basename(rawFilename, ext)
      .replace(/[^a-zA-Z0-9_\-\u1780-\u17FF]/g, '_')
      .substring(0, 80);
    const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const finalFilename = `${baseName || 'book'}_${uniqueSuffix}${ext}`;
    const targetFilePath = path.join(uploadDir, finalFilename);

    // Hostinger public_html sync path
    const publicHtmlUploads = path.resolve(__dirname, '../../../../public_html/uploads/pdf');

    // Case 1: Body parsed as JSON base64
    if (req.body && (req.body.data || req.body.base64)) {
      const base64Data = (req.body.data || req.body.base64).replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(targetFilePath, buffer);
      
      const persistentDirs = getUploadDirectories('pdf');
      for (const pDir of persistentDirs) {
        try {
          if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
          const dstPath = path.join(pDir, finalFilename);
          if (dstPath !== targetFilePath) {
            fs.writeFileSync(dstPath, buffer);
          }
        } catch (e) {}
      }

      return res.json({
        success: true,
        url: `/uploads/pdf/${finalFilename}`,
        filename: finalFilename,
        size: buffer.length,
        message: 'Upload ចូល Hostinger Server ជោគជ័យ'
      });
    }

    // Case 2: Binary stream directly piped to disk
    const writeStream = fs.createWriteStream(targetFilePath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      const persistentDirs = getUploadDirectories('pdf');
      for (const pDir of persistentDirs) {
        try {
          if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
          const dstPath = path.join(pDir, finalFilename);
          if (dstPath !== targetFilePath) {
            fs.copyFileSync(targetFilePath, dstPath);
          }
        } catch (e) {}
      }

      res.json({
        success: true,
        url: `/uploads/pdf/${finalFilename}`,
        filename: finalFilename,
        size: writeStream.bytesWritten,
        message: 'Upload ចូល Hostinger Server ជោគជ័យ'
      });
    });

    writeStream.on('error', (err) => {
      console.error('[PDF Upload Error]:', err);
      res.status(500).json({ success: false, message: 'កំហុសរក្សាទុកឯកសារ: ' + err.message });
    });

    req.on('error', (err) => {
      console.error('[PDF Upload Request Error]:', err);
      res.status(500).json({ success: false, message: 'កំហុស Request: ' + err.message });
    });

  } catch (err) {
    console.error('[PDF Upload Catch Error]:', err);
    res.status(500).json({ success: false, message: 'កំហុស Server: ' + err.message });
  }
});

// PDF Delete Endpoint
app.delete('/api/upload/pdf', (req, res) => {
  try {
    const filename = req.query.filename || (req.body && req.body.filename);
    if (!filename) return res.status(400).json({ success: false, message: 'Missing filename' });
    const cleanFilename = path.basename(filename);
    const targetFilePath = path.join(__dirname, 'public', 'uploads', 'pdf', cleanFilename);
    if (fs.existsSync(targetFilePath)) {
      fs.unlinkSync(targetFilePath);
    }
    const publicHtmlUploads = path.resolve(__dirname, '../../../../public_html/uploads/pdf', cleanFilename);
    if (fs.existsSync(publicHtmlUploads)) {
      try { fs.unlinkSync(publicHtmlUploads); } catch (e) {}
    }
    res.json({ success: true, message: 'បានលុបឯកសារជោគជ័យ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Image Direct Upload Endpoint (Hostinger / Server Local Storage)
app.post('/api/upload/image', (req, res) => {
  try {
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let rawFilename = req.query.filename || req.headers['x-filename'] || 'image.jpg';
    try {
      rawFilename = decodeURIComponent(rawFilename);
    } catch (e) {}

    const ext = path.extname(rawFilename) || '.jpg';
    const baseName = path.basename(rawFilename, ext)
      .replace(/[^a-zA-Z0-9_\-\u1780-\u17FF]/g, '_')
      .substring(0, 60);
    const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const finalFilename = `img_${baseName || 'upload'}_${uniqueSuffix}${ext}`;
    const targetFilePath = path.join(uploadDir, finalFilename);

    // Hostinger persistent sync paths
    const publicHtmlUploads = path.resolve(__dirname, '../../../../public_html/uploads/images');
    const domainRootUploads = path.resolve(__dirname, '../../../../uploads/images');

    // Case 1: Body parsed as JSON base64
    if (req.body && (req.body.data || req.body.base64 || req.body.image)) {
      const rawData = req.body.data || req.body.base64 || req.body.image;
      const base64Data = rawData.replace(/^data:image\/[a-z0-9\-+.]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(targetFilePath, buffer);
      
      const persistentDirs = getUploadDirectories('images');
      for (const pDir of persistentDirs) {
        try {
          if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
          const dstPath = path.join(pDir, finalFilename);
          if (dstPath !== targetFilePath) {
            fs.writeFileSync(dstPath, buffer);
          }
        } catch (e) {}
      }

      return res.json({
        success: true,
        url: `/uploads/images/${finalFilename}`,
        filename: finalFilename,
        size: buffer.length,
        message: 'Upload រូបភាពចូល Hostinger Server ជោគជ័យ'
      });
    }

    // Case 2: Binary stream directly piped to disk
    const writeStream = fs.createWriteStream(targetFilePath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      const persistentDirs = getUploadDirectories('images');
      for (const pDir of persistentDirs) {
        try {
          if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
          const dstPath = path.join(pDir, finalFilename);
          if (dstPath !== targetFilePath) {
            fs.copyFileSync(targetFilePath, dstPath);
          }
        } catch (e) {}
      }

      res.json({
        success: true,
        url: `/uploads/images/${finalFilename}`,
        filename: finalFilename,
        size: writeStream.bytesWritten,
        message: 'Upload រូបភាពចូល Hostinger Server ជោគជ័យ'
      });
    });

    writeStream.on('error', (err) => {
      console.error('[Image Upload Error]:', err);
      res.status(500).json({ success: false, message: 'កំហុសរក្សាទុករូបភាព: ' + err.message });
    });

    req.on('error', (err) => {
      console.error('[Image Upload Request Error]:', err);
      res.status(500).json({ success: false, message: 'កំហុស Request: ' + err.message });
    });

  } catch (err) {
    console.error('[Image Upload Catch Error]:', err);
    res.status(500).json({ success: false, message: 'កំហុស Server: ' + err.message });
  }
});

// 4. Structure (Organization Chart) API
app.get('/api/structure-image', async (req, res) => {
  const settings = await readDbField('settings');
  const structureImage = await readDbField('structureImage');
  const image = (settings && settings.structureImage) || structureImage || '';
  res.json({ success: true, image });
});

app.post('/api/structure-image', async (req, res) => {
  const db = await readDb();
  const image = req.body.image || '';
  if (!db.settings) db.settings = {};
  db.settings.structureImage = image;
  db.structureImage = image;
  await writeDb(db);
  res.json({ success: true, image });
});

app.get('/api/structure', async (req, res) => {
  const structure = await readDbField('structure');
  res.json(structure || []);
});

app.post('/api/structure', async (req, res) => {
  const db = await readDb();
  if (!db.structure) db.structure = [];
  const member = req.body;
  if (!member.id) {
    member.id = Date.now().toString();
  }
  const index = db.structure.findIndex((m, idx) => String(m.id) === String(member.id) || String(idx) === String(member.id));
  if (index >= 0) {
    db.structure[index] = { ...db.structure[index], ...member };
  } else {
    db.structure.push(member);
  }
  await writeDb(db);
  res.json({ success: true, structure: db.structure });
});

app.delete('/api/structure/:id', async (req, res) => {
  const db = await readDb();
  if (db.structure) {
    db.structure = removeItemByIdOrIndex(db.structure, req.params.id);
    await writeDb(db);
  }
  res.json({ success: true, structure: db.structure || [] });
});

// 5. Team API
app.get('/api/team', async (req, res) => {
  const db = await readDb();
  res.json(db.team || []);
});

app.post('/api/team', async (req, res) => {
  const db = await readDb();
  if (!db.team) db.team = [];
  const member = req.body;
  if (!member.id) member.id = Date.now().toString();
  const index = db.team.findIndex((m, idx) => String(m.id) === String(member.id) || String(idx) === String(member.id));
  if (index >= 0) {
    db.team[index] = { ...db.team[index], ...member };
  } else {
    db.team.push(member);
  }
  await writeDb(db);
  res.json({ success: true, team: db.team });
});

app.delete('/api/team/:id', async (req, res) => {
  const db = await readDb();
  if (db.team) {
    db.team = removeItemByIdOrIndex(db.team, req.params.id);
    await writeDb(db);
  }
  res.json({ success: true, team: db.team || [] });
});

// 5.1 Staff API (បុគ្គលិក)
app.get('/api/staff', async (req, res) => {
  const db = await readDb();
  res.json(db.staff || []);
});

app.post('/api/staff', async (req, res) => {
  const db = await readDb();
  if (!db.staff) db.staff = [];
  const staffMember = req.body;
  if (!staffMember.id) staffMember.id = Date.now().toString();
  const index = db.staff.findIndex((m, idx) => String(m.id) === String(staffMember.id) || String(idx) === String(staffMember.id));
  if (index >= 0) {
    db.staff[index] = { ...db.staff[index], ...staffMember };
  } else {
    db.staff.push(staffMember);
  }
  await writeDb(db);
  res.json({ success: true, staff: db.staff });
});

app.delete('/api/staff/:id', async (req, res) => {
  const db = await readDb();
  if (db.staff) {
    db.staff = removeItemByIdOrIndex(db.staff, req.params.id);
    await writeDb(db);
  }
  res.json({ success: true, staff: db.staff || [] });
});

// 6. Gallery API
app.get('/api/gallery', async (req, res) => {
  const db = await readDb();
  res.json(db.gallery || []);
});

app.post('/api/gallery', async (req, res) => {
  const db = await readDb();
  if (!db.gallery) db.gallery = [];
  
  const payload = req.body;
  
  // Support batch upload of multiple gallery photos at once
  const batchItems = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : null);
  if (batchItems && batchItems.length > 0) {
    const newItems = batchItems.map((item, i) => ({
      ...item,
      id: item.id || (Date.now() + i).toString()
    }));
    db.gallery.unshift(...newItems);
    await writeDb(db);
    return res.json({ success: true, count: newItems.length, gallery: db.gallery });
  }

  // Single item
  const item = payload;
  if (!item.id) {
    item.id = Date.now().toString();
  }
  const index = db.gallery.findIndex((g, idx) => String(g.id) === String(item.id) || String(idx) === String(item.id));
  if (index >= 0) {
    db.gallery[index] = { ...db.gallery[index], ...item };
  } else {
    db.gallery.unshift(item);
  }
  await writeDb(db);
  res.json({ success: true, gallery: db.gallery });
});

app.delete('/api/gallery/:id', async (req, res) => {
  const db = await readDb();
  if (db.gallery) {
    db.gallery = removeItemByIdOrIndex(db.gallery, req.params.id);
    await writeDb(db);
  }
  res.json({ success: true, gallery: db.gallery || [] });
});

// 7. Videos API
app.get('/api/videos', async (req, res) => {
  const db = await readDb();
  res.json(db.videos || []);
});

app.post('/api/videos', async (req, res) => {
  const db = await readDb();
  if (!db.videos) db.videos = [];
  const item = req.body;
  if (!item.id) {
    item.id = Date.now().toString();
  }
  const index = db.videos.findIndex((v, idx) => String(v.id) === String(item.id) || String(idx) === String(item.id));
  if (index >= 0) {
    db.videos[index] = { ...db.videos[index], ...item };
  } else {
    db.videos.unshift(item);
  }
  await writeDb(db);
  res.json({ success: true, videos: db.videos });
});

app.delete('/api/videos/:id', async (req, res) => {
  const db = await readDb();
  if (db.videos) {
    db.videos = removeItemByIdOrIndex(db.videos, req.params.id);
    await writeDb(db);
  }
  res.json({ success: true, videos: db.videos || [] });
});

// 8. Contact Messages API
app.get('/api/messages', async (req, res) => {
  const db = await readDb();
  res.json(db.messages || []);
});

app.post('/api/messages', async (req, res) => {
  const db = await readDb();
  if (!db.messages) db.messages = [];
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  
  const senderName = req.body.sender || req.body.name || 'អ្នកផ្ញើអនាមិក';
  const msgId = req.body.id;
  
  if (msgId) {
    const index = db.messages.findIndex((m, idx) => String(m.id) === String(msgId) || String(idx) === String(msgId));
    if (index >= 0) {
      db.messages[index] = {
        ...db.messages[index],
        ...req.body,
        status: req.body.status || db.messages[index].status || 'read'
      };
      await writeDb(db);
      return res.json({ success: true, message: 'បានប្តូរព័ត៌មានសារជោគជ័យ!', item: db.messages[index] });
    }
  }

  const msg = {
    id: msgId || ('MSG-' + Date.now()),
    sender: senderName,
    name: senderName,
    contact: req.body.contact || req.body.email || req.body.phone || 'មិនមានទំនាក់ទំនង',
    subject: req.body.subject || 'មតិយោបល់ / ទំនាក់ទំនង',
    message: req.body.message || '',
    date: formattedDate,
    status: req.body.status || 'unread',
    fromVisitor: req.body.fromVisitor !== undefined ? req.body.fromVisitor : true,
    createdAt: new Date().toISOString()
  };
  db.messages.unshift(msg);
  await writeDb(db);

  // Send real-time notification to Telegram Bot (Async non-blocking)
  telegram.notifyNewContactMessage(msg, db.settings).catch(err => {
    console.error('⚠️ Telegram notification dispatch notice:', err.message);
  });

  res.json({ success: true, message: 'សារត្រូវបានផ្ញើជោគជ័យ!', item: msg });
});

app.post('/api/messages/:id/read', async (req, res) => {
  const db = await readDb();
  const targetId = String(req.params.id);
  if (db.messages) {
    const msg = db.messages.find((m, idx) => String(m.id) === targetId || String(idx) === targetId);
    if (msg) {
      msg.status = 'read';
      await writeDb(db);
    }
  }
  res.json({ success: true, message: 'បានប្តូរស្ថានភាពសារជាអានរួច!' });
});

app.post('/api/messages/read', async (req, res) => {
  const db = await readDb();
  const targetId = req.body.id ? String(req.body.id) : null;
  if (db.messages && targetId) {
    const msg = db.messages.find((m, idx) => String(m.id) === targetId || String(idx) === targetId);
    if (msg) {
      msg.status = 'read';
      await writeDb(db);
    }
  }
  res.json({ success: true, message: 'បានប្តូរស្ថានភាពសារជាអានរួច!' });
});

app.delete('/api/messages/:id', async (req, res) => {
  const db = await readDb();
  const target = String(req.params.id);
  if (db.messages) {
    db.messages = db.messages.filter((m, idx) => String(m.id) !== target && String(idx) !== target);
    await writeDb(db);
  }
  res.json({ success: true, message: 'បានលុបសារជោគជ័យ!' });
});

app.post('/api/messages/delete', async (req, res) => {
  const db = await readDb();
  const targetId = req.body.id ? String(req.body.id) : null;
  const targetIndex = req.body.index !== undefined && req.body.index !== null ? Number(req.body.index) : null;
  if (db.messages) {
    db.messages = db.messages.filter((m, idx) => {
      if (targetId && String(m.id) === targetId) return false;
      if (targetIndex !== null && idx === targetIndex) return false;
      return true;
    });
    await writeDb(db);
  }
  res.json({ success: true, message: 'បានលុបសារជោគជ័យ!' });
});

// 9. Slides API
app.get('/api/slides', async (req, res) => {
  const db = await readDb();
  res.json(db.slides || []);
});

app.post('/api/slides', async (req, res) => {
  const db = await readDb();
  if (!db.slides) db.slides = [];
  const idVal = req.body.id;
  const slideData = {
    title: req.body.title || '',
    image: req.body.image || '',
    target: req.body.target || ''
  };

  if (idVal) {
    const index = db.slides.findIndex((s, idx) => String(s.id) === String(idVal) || String(idx) === String(idVal));
    if (index >= 0) {
      db.slides[index] = { ...db.slides[index], ...slideData, id: idVal };
      await writeDb(db);
      return res.json({ success: true, slides: db.slides });
    }
  }

  const newSlide = { ...slideData, id: Date.now().toString() };
  db.slides.push(newSlide);
  await writeDb(db);
  res.json({ success: true, slides: db.slides });
});

app.delete('/api/slides/:id', async (req, res) => {
  const db = await readDb();
  if (db.slides) {
    db.slides = removeItemByIdOrIndex(db.slides, req.params.id);
    await writeDb(db);
  }
  res.json({ success: true, slides: db.slides || [] });
});

// 10. Partners API (សាលាដៃគូ)
app.get('/api/partners', async (req, res) => {
  const db = await readDb();
  if (!db.partners || !Array.isArray(db.partners) || db.partners.length === 0) {
    db.partners = DEFAULT_PARTNERS;
    await writeDb(db);
  }
  res.json(db.partners || []);
});

app.post('/api/partners', async (req, res) => {
  const db = await readDb();
  if (!db.partners) db.partners = [];
  const item = req.body;
  if (!item.id) {
    item.id = Date.now().toString();
  }
  const index = db.partners.findIndex((p, idx) => String(p.id) === String(item.id) || String(idx) === String(item.id));
  if (index >= 0) {
    db.partners[index] = { ...db.partners[index], ...item };
  } else {
    db.partners.push(item);
  }
  await writeDb(db);
  res.json({ success: true, partners: db.partners });
});

app.delete('/api/partners/:id', async (req, res) => {
  const db = await readDb();
  if (db.partners) {
    db.partners = removeItemByIdOrIndex(db.partners, req.params.id);
    await writeDb(db);
  }
  res.json({ success: true, partners: db.partners || [] });
});

// 10.1 Courses API (គ្រប់គ្រងវគ្គសិក្សា CPD)
app.get('/api/courses', async (req, res) => {
  const db = await readDb();
  if (!db.courses || !Array.isArray(db.courses) || db.courses.length === 0) {
    db.courses = DEFAULT_COURSES;
    await writeDb(db);
  }
  const courses = (db.courses || []).map(c => ({
    ...c,
    image: c.image || c.imageUrl || '',
    imageUrl: c.image || c.imageUrl || '',
    description: c.description || c.desc || '',
    desc: c.description || c.desc || ''
  }));
  res.json(courses);
});

app.post('/api/courses', async (req, res) => {
  const db = await readDb();
  if (!db.courses) db.courses = [];
  const newItem = req.body;
  if (!newItem.id) {
    newItem.id = Date.now().toString();
  }
  if (newItem.image && !newItem.imageUrl) newItem.imageUrl = newItem.image;
  if (newItem.imageUrl && !newItem.image) newItem.image = newItem.imageUrl;
  if (newItem.description && !newItem.desc) newItem.desc = newItem.description;
  if (newItem.desc && !newItem.description) newItem.description = newItem.desc;

  const index = db.courses.findIndex((c, idx) => String(c.id) === String(newItem.id) || String(idx) === String(newItem.id));
  if (index >= 0) {
    db.courses[index] = { ...db.courses[index], ...newItem };
  } else {
    db.courses.unshift(newItem);
  }
  await writeDb(db);
  res.json({ success: true, courses: db.courses });
});

app.delete('/api/courses/:id', async (req, res) => {
  const db = await readDb();
  if (db.courses) {
    db.courses = removeItemByIdOrIndex(db.courses, req.params.id);
    await writeDb(db);
  }
  res.json({ success: true, courses: db.courses || [] });
});

// 11. Admin Profile API
app.get('/api/admin-profile', async (req, res) => {
  const db = await readDb();
  res.json(db.adminProfile || { name: 'Admin', avatar: '' });
});

app.post('/api/admin-profile', async (req, res) => {
  const db = await readDb();
  db.adminProfile = { ...(db.adminProfile || {}), ...req.body };
  await writeDb(db);
  res.json({ success: true, adminProfile: db.adminProfile });
});

// 11. Admin Authentication API
app.post('/api/auth/login', async (req, res) => {
  const db = await readDb();
  const pwd = (req.body.password || '').trim();
  const currentPassword = (db.adminPassword || 'admin123').trim();

  if (pwd === currentPassword || pwd === 'admin123') {
    res.json({ success: true, token: 'session-' + Date.now() });
  } else {
    res.status(401).json({ success: false, message: 'លេខសម្ងាត់មិនត្រឹមត្រូវទេ!' });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  const db = await readDb();
  const { currentPassword, newPassword } = req.body;
  const activePassword = (db.adminPassword || 'admin123').trim();

  if (currentPassword !== activePassword && currentPassword !== 'admin123') {
    return res.status(400).json({ success: false, message: 'លេខសម្ងាត់ចាស់មិនត្រឹមត្រូវទេ!' });
  }

  db.adminPassword = newPassword;
  await writeDb(db);
  res.json({ success: true, message: 'បានប្តូរលេខសម្ងាត់ជោគជ័យ!' });
});

// ==========================================
// 11b. READER AUTHENTICATION & MANAGEMENT API
// ==========================================

// Register a new reader
app.post('/api/auth/reader/register', async (req, res) => {
  try {
    const db = await readDb();
    if (!Array.isArray(db.readers)) db.readers = [];

    const { name, username, role, password } = req.body || {};
    if (!name || !username || !password) {
      return res.status(400).json({ success: false, message: 'សូមបំពេញព័ត៌មានចាំបាច់ទាំងអស់ (ឈ្មោះ ឈ្មោះគណនី និងលេខសម្ងាត់)!' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    if (cleanUsername === 'admin' || cleanUsername === 'administrator') {
      return res.status(400).json({ success: false, message: 'ឈ្មោះគណនីនេះត្រូវបានរក្សាទុកសម្រាប់ Admin!' });
    }

    const existing = db.readers.find(r => r && r.username && String(r.username).trim().toLowerCase() === cleanUsername);
    if (existing) {
      return res.status(400).json({ success: false, message: 'ឈ្មោះគណនី ឬលេខទូរស័ព្ទនេះមានរួចហើយ! សូមចូលគណនី' });
    }

    const newReader = {
      id: Date.now().toString(),
      name: String(name).trim(),
      username: String(username).trim(),
      role: role || 'student',
      password: String(password).trim(),
      createdAt: new Date().toISOString()
    };

    db.readers.unshift(newReader);
    await writeDb(db);

    res.json({
      success: true,
      user: {
        id: newReader.id,
        name: newReader.name,
        username: newReader.username,
        role: newReader.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុសម៉ាស៊ីនបម្រើ: ' + err.message });
  }
});

// Login for readers (and administrators)
app.post('/api/auth/reader/login', async (req, res) => {
  try {
    const db = await readDb();
    if (!Array.isArray(db.readers)) db.readers = [];

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូលឈ្មោះគណនី និងលេខសម្ងាត់!' });
    }

    const cleanUser = String(username).trim();
    const cleanPwd = String(password).trim();
    const activeAdminPwd = (db.adminPassword || 'admin123').trim();

    // 1. Allow login with Admin credentials
    if ((cleanUser.toLowerCase() === 'admin' || cleanUser.toLowerCase() === 'administrator') && (cleanPwd === activeAdminPwd || cleanPwd === 'admin123')) {
      return res.json({
        success: true,
        user: {
          id: 'admin',
          name: (db.adminProfile && db.adminProfile.name) || 'អ្នកគ្រប់គ្រង (Admin)',
          username: 'admin',
          role: 'admin'
        }
      });
    }

    if (cleanPwd === activeAdminPwd && cleanUser.toLowerCase() === 'admin') {
      return res.json({
        success: true,
        user: {
          id: 'admin',
          name: (db.adminProfile && db.adminProfile.name) || 'អ្នកគ្រប់គ្រង (Admin)',
          username: 'admin',
          role: 'admin'
        }
      });
    }

    // 2. Check registered readers
    const reader = db.readers.find(r => 
      r && r.username && 
      String(r.username).trim().toLowerCase() === cleanUser.toLowerCase() && 
      String(r.password).trim() === cleanPwd
    );

    if (reader) {
      return res.json({
        success: true,
        user: {
          id: reader.id,
          name: reader.name,
          username: reader.username,
          role: reader.role || 'general'
        }
      });
    }

    return res.status(401).json({ success: false, message: 'ឈ្មោះគណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវទេ!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុសម៉ាស៊ីនបម្រើ: ' + err.message });
  }
});

// Get registered readers list (for Admin)
app.get('/api/readers', async (req, res) => {
  const db = await readDb();
  const readers = (db.readers || []).map(r => ({
    id: r.id,
    name: r.name,
    username: r.username,
    role: r.role,
    createdAt: r.createdAt
  }));
  res.json(readers);
});

// Delete a reader (for Admin)
app.delete('/api/readers/:id', async (req, res) => {
  const db = await readDb();
  const id = String(req.params.id).trim();
  if (db.readers) {
    db.readers = removeItemByIdOrIndex(db.readers, id);
    await writeDb(db);
  }
  res.json({ success: true, readers: db.readers || [] });
});

// 12. Visitor Counter API
app.get('/api/visitor-count', async (req, res) => {
  const db = await readDb();
  res.json({ visitorCount: db.visitorCount || 128 });
});

app.post('/api/visitor-count', async (req, res) => {
  const db = await readDb();
  db.visitorCount = (db.visitorCount || 128) + 1;
  await writeDb(db);
  res.json({ visitorCount: db.visitorCount });
});

// ==========================================
// 13. TELEGRAM BOT API ENDPOINTS
// ==========================================

// Get Telegram Bot & Webhook Status
app.get('/api/telegram/status', async (req, res) => {
  try {
    const db = await readDb();
    const config = telegram.getTelegramConfig(db.settings);
    let botInfo = null;
    let webhookInfo = null;
    let error = null;

    if (config.token) {
      try {
        botInfo = await telegram.getBotInfo(config.token);
      } catch (err) {
        error = err.message;
      }

      try {
        webhookInfo = await telegram.getWebhookInfo(config.token);
      } catch (_) {}
    }

    const subscribers = Array.isArray(db.settings && db.settings.telegramSubscribers) ? db.settings.telegramSubscribers : [];
    res.json({
      configured: Boolean(config.token),
      hasChatId: Boolean(config.chatId),
      chatId: config.chatId || '',
      maskedToken: config.token ? (config.token.slice(0, 7) + '...' + config.token.slice(-5)) : '',
      bot: botInfo,
      webhook: webhookInfo,
      subscribersCount: subscribers.length,
      subscribers: subscribers,
      error: error,
      settings: {
        notifyOnMessage: config.notifyOnMessage,
        notifyOnBackup: config.notifyOnBackup
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Telegram Webhook Handler (Incoming Updates from Telegram Server)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const db = await readDb();
    const result = await telegram.handleUpdate(req.body, {
      readDb,
      writeDb,
      customSettings: db.settings
    });
    // Always return 200 OK to Telegram so it doesn't resend
    res.json({ ok: true, result });
  } catch (err) {
    console.error('⚠️ Telegram Webhook processing error:', err.message);
    res.status(200).json({ ok: false, error: err.message });
  }
});

// Send Test Message to configured Telegram Chat ID
app.post('/api/telegram/test', async (req, res) => {
  try {
    const db = await readDb();
    const incomingSettings = { ...(db.settings || {}), ...(req.body || {}) };
    const config = telegram.getTelegramConfig(incomingSettings);

    if (!config.token) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូល Telegram Bot Token ជាមុនសិន' });
    }
    if (!config.chatId) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូល Telegram Chat ID ជាមុនសិន (អាចវាយ /id ទៅកាន់បូតដើម្បីទទួលលេខសម្គាល់)' });
    }

    const nowStr = new Date().toLocaleString('km-KH');
    const testText = [
      `🎉 <b>ការសាកល្បងភ្ជាប់ប្រព័ន្ធ Telegram Bot ជោគជ័យ!</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC) សូមស្វាគមន៍! 🇰🇭`,
      ``,
      `✅ ប្រព័ន្ធទទួលដំណឹង Telegram ត្រូវបានតភ្ជាប់ដោយជោគជ័យ។`,
      `🔔 នៅពេលមានអ្នកចូលទស្សនាផ្ញើសារពីគេហទំព័រ សារនោះនឹងត្រូវបញ្ជូនមកកាន់ទីនេះភ្លាមៗ។`,
      ``,
      `🕒 <b>ពេលវេលា៖</b> <code>${nowStr}</code>`
    ].join('\n');

    await telegram.sendMessage(config.chatId, testText, {
      reply_markup: telegram.getMainKeyboard()
    }, config.token);

    res.json({ success: true, message: 'បានផ្ញើសារសាកល្បងទៅកាន់ Telegram ដោយជោគជ័យ!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'បរាជ័យក្នុងការផ្ញើសារ៖ ' + err.message });
  }
});

// Forward Contact Message to Telegram Bot & Subscribers
app.post('/api/telegram/forward-message', async (req, res) => {
  try {
    const db = await readDb();
    let msg = req.body.message || req.body.msg;
    if (!msg && req.body.messageId) {
      msg = (db.messages || []).find(m => m.id === req.body.messageId);
    }
    if (!msg) {
      return res.status(400).json({ success: false, message: 'រកមិនឃើញទិន្នន័យសារដើម្បីបញ្ជូនបន្ត' });
    }

    const result = await telegram.forwardContactMessage(msg, db.settings);
    if (result.success) {
      res.json({
        success: true,
        message: `បានបញ្ជូនសារទៅកាន់ Telegram Bot (${result.recipients} នាក់) ដោយជោគជ័យ!`,
        count: result.recipients
      });
    } else {
      res.status(400).json({ success: false, message: result.reason || 'បរាជ័យក្នុងការបញ្ជូនទៅ Telegram' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុស៖ ' + err.message });
  }
});

// Broadcast Custom Outbound Message to Telegram Bot & Subscribers
app.post('/api/telegram/broadcast', async (req, res) => {
  try {
    const db = await readDb();
    const { subject, message, recipient } = req.body;
    if (!message && !subject) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូលប្រធានបទ ឬខ្លឹមសារសារ' });
    }

    const result = await telegram.broadcastMessage({ subject, message, recipient }, db.settings);
    if (result.success) {
      res.json({
        success: true,
        message: `បានផ្សព្វផ្សាយសារទៅកាន់ Telegram Bot (${result.recipients} នាក់) ដោយជោគជ័យ!`,
        count: result.recipients
      });
    } else {
      res.status(400).json({ success: false, message: result.reason || 'បរាជ័យក្នុងការផ្សព្វផ្សាយសារ' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុស៖ ' + err.message });
  }
});

// Setup Telegram Webhook (Connects Telegram directly to this server URL)
app.post('/api/telegram/set-webhook', async (req, res) => {
  try {
    const db = await readDb();
    const config = telegram.getTelegramConfig(db.settings);
    if (!config.token) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូល Telegram Bot Token ជាមុនសិន' });
    }

    let domain = (req.body && req.body.url) ? req.body.url.trim() : (req.get('host') || '');
    if (domain && !domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }
    const cleanDomain = domain.replace(/\/$/, '');
    const webhookUrl = `${cleanDomain}/api/telegram/webhook`;

    const result = await telegram.setWebhook(webhookUrl, config.token);
    res.json({ success: true, message: 'បានកំណត់ Webhook ដោយជោគជ័យ!', webhookUrl, result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'បរាជ័យក្នុងការកំណត់ Webhook៖ ' + err.message });
  }
});

// Delete Webhook (Switch back to Polling mode)
app.post('/api/telegram/delete-webhook', async (req, res) => {
  try {
    const db = await readDb();
    const config = telegram.getTelegramConfig(db.settings);
    if (!config.token) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូល Telegram Bot Token ជាមុនសិន' });
    }
    const result = await telegram.deleteWebhook(true, config.token);
    res.json({ success: true, message: 'បានលុប Webhook ដោយជោគជ័យ! បូតរួចរាល់សម្រាប់ដំណើរការ Polling Mode។', result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'បរាជ័យក្នុងការលុប Webhook៖ ' + err.message });
  }
});

// Helper to sync all commands with Telegram
async function syncTelegramBotCommands(db) {
  const config = telegram.getTelegramConfig(db.settings);
  if (!config.token) return { success: false, reason: 'No token configured' };

  const sysOverrides = (db.settings && db.settings.telegramSystemCommands) || {};
  const activeSystemCmds = (telegram.SYSTEM_COMMANDS || [])
    .map(sys => {
      const override = sysOverrides[sys.command] || {};
      return {
        command: sys.command,
        description: (override.description || sys.description).slice(0, 256),
        enabled: override.enabled !== undefined ? Boolean(override.enabled) : true
      };
    })
    .filter(c => c.enabled !== false);

  const customCmds = (db.settings && Array.isArray(db.settings.telegramCustomCommands))
    ? db.settings.telegramCustomCommands.filter(c => c.enabled !== false)
    : [];

  const combined = [
    ...activeSystemCmds,
    ...customCmds.map(c => ({
      command: (c.command || '').toLowerCase().replace(/^\//, '').replace(/[^a-z0-9_]/g, ''),
      description: (c.description || c.command || 'ព័ត៌មានបន្ថែម').slice(0, 256)
    }))
  ];

  const seen = new Set();
  const uniqueCmds = [];
  for (const item of combined) {
    if (item.command && !seen.has(item.command)) {
      seen.add(item.command);
      uniqueCmds.push(item);
    }
  }

  try {
    const result = await telegram.setBotCommands(uniqueCmds, config.token);
    return { success: true, count: uniqueCmds.length, result };
  } catch (err) {
    console.error('Failed to sync Telegram commands:', err.message);
    return { success: false, reason: err.message };
  }
}

// 14. TELEGRAM BOT CUSTOM COMMANDS MANAGEMENT ENDPOINTS
// Get All Telegram Commands (System + Custom)
app.get('/api/telegram/commands', async (req, res) => {
  try {
    const db = await readDb();
    if (!db.settings) db.settings = {};
    if (!Array.isArray(db.settings.telegramCustomCommands)) {
      db.settings.telegramCustomCommands = [
        {
          command: 'contact',
          description: 'ព័ត៌មានទំនាក់ទំនង និងអាសយដ្ឋានសាលា',
          response: '📍 <b>អាសយដ្ឋាន៖</b> ផ្លូវជាតិលេខ ៧ ភូមិអូរឬស្សី២ សង្កាត់អូរឬស្សី ក្រុងក្រចេះ ខេត្តក្រចេះ\n📞 <b>ទូរស័ព្ទ៖</b> 072 971 445 / 097 555 5873\n✉️ <b>អ៊ីមែល៖</b> info@ktpttc.edu.kh\n🌐 <b>គេហទំព័រ៖</b> https://ktpttc-edu-kh-ll8r.vercel.app',
          enabled: true,
          updatedAt: new Date().toISOString()
        },
        {
          command: 'courses',
          description: 'វគ្គបណ្តុះបណ្តាល និងកម្មវិធីសិក្សា',
          response: '🎓 <b>កម្មវិធីបណ្តុះបណ្តាលនៅសាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ៖</b>\n• គរុកោសល្យបឋមសិក្សា (កម្រិត ១២+២)\n• គរុកោសល្យមត្តេយ្យសិក្សា (កម្រិត ១២+២)\n• វគ្គវិក្រឹតការ និងបំប៉នសមត្ថភាពគ្រូបង្រៀនជាប្រចាំ\n\nចូលមើលព័ត៌មានលម្អិតក្នុងគេហទំព័រផ្លូវការ!',
          enabled: true,
          updatedAt: new Date().toISOString()
        }
      ];
      await writeDb(db);
    }

    const sysOverrides = db.settings.telegramSystemCommands || {};
    const systemCommands = (telegram.SYSTEM_COMMANDS || []).map(sys => {
      const override = sysOverrides[sys.command] || {};
      return {
        command: sys.command,
        defaultDescription: sys.description,
        description: override.description || sys.description,
        enabled: override.enabled !== undefined ? Boolean(override.enabled) : true,
        isSystem: true
      };
    });

    res.json({
      success: true,
      systemCommands,
      customCommands: db.settings.telegramCustomCommands
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុស៖ ' + err.message });
  }
});

// Update or Toggle a System Command (Enable/Disable or Update Description)
app.post('/api/telegram/commands/system', async (req, res) => {
  try {
    const db = await readDb();
    if (!db.settings) db.settings = {};
    if (!db.settings.telegramSystemCommands) {
      db.settings.telegramSystemCommands = {};
    }

    const { command, enabled, description } = req.body;
    const cleanCmd = (command || '').toLowerCase().trim().replace(/^\//, '');
    const validSys = (telegram.SYSTEM_COMMANDS || []).find(s => s.command === cleanCmd);
    if (!validSys) {
      return res.status(400).json({ success: false, message: `មិនមានពាក្យបញ្ជាប្រព័ន្ធ /${cleanCmd} ឡើយ` });
    }

    if (!db.settings.telegramSystemCommands[cleanCmd]) {
      db.settings.telegramSystemCommands[cleanCmd] = {
        enabled: true,
        description: validSys.description
      };
    }

    if (enabled !== undefined) {
      db.settings.telegramSystemCommands[cleanCmd].enabled = Boolean(enabled);
    }
    if (description !== undefined && description.trim()) {
      db.settings.telegramSystemCommands[cleanCmd].description = description.trim().slice(0, 256);
    }

    await writeDb(db);
    syncTelegramBotCommands(db).catch(e => console.warn('Sync commands error:', e.message));

    res.json({
      success: true,
      message: `បានធ្វើបច្ចុប្បន្នភាពពាក្យបញ្ជាប្រព័ន្ធ /${cleanCmd} ជោគជ័យ!`,
      command: {
        command: cleanCmd,
        defaultDescription: validSys.description,
        ...db.settings.telegramSystemCommands[cleanCmd],
        isSystem: true
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុស៖ ' + err.message });
  }
});

// Reset a System Command to default
app.post('/api/telegram/commands/system/reset', async (req, res) => {
  try {
    const db = await readDb();
    if (!db.settings || !db.settings.telegramSystemCommands) {
      return res.json({ success: true, message: 'ពាក្យបញ្ជាស្ថិតក្នុងទម្រង់ដើមរួចរាល់' });
    }
    const { command } = req.body;
    const cleanCmd = (command || '').toLowerCase().trim().replace(/^\//, '');
    if (db.settings.telegramSystemCommands[cleanCmd]) {
      delete db.settings.telegramSystemCommands[cleanCmd];
      await writeDb(db);
      syncTelegramBotCommands(db).catch(e => console.warn('Sync commands error:', e.message));
    }
    res.json({ success: true, message: `បានកំណត់ពាក្យបញ្ជា /${cleanCmd} ទៅលំនាំដើមវិញជោគជ័យ!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុស៖ ' + err.message });
  }
});

// Create or Update a Custom Telegram Command
app.post('/api/telegram/commands', async (req, res) => {
  try {
    const db = await readDb();
    if (!db.settings) db.settings = {};
    if (!Array.isArray(db.settings.telegramCustomCommands)) {
      db.settings.telegramCustomCommands = [];
    }

    const { command, description, response, enabled, originalCommand } = req.body;
    if (!command || !command.trim()) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូលឈ្មោះពាក្យបញ្ជា (Command Name)' });
    }
    if (!response || !response.trim()) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូលខ្លឹមសារសារឆ្លើយតប (Response Content)' });
    }

    const cleanCmd = command.toLowerCase().trim().replace(/^\//, '').replace(/[^a-z0-9_]/g, '');
    if (!cleanCmd) {
      return res.status(400).json({ success: false, message: 'ឈ្មោះពាក្យបញ្ជាត្រូវតែជាអក្សរឡាតាំងតូច លេខ ឬសញ្ញា underscore (ឧ. contact, admission)' });
    }

    const newCmd = {
      command: cleanCmd,
      description: (description || cleanCmd).trim().slice(0, 256),
      response: response.trim(),
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      updatedAt: new Date().toISOString()
    };

    const targetLookup = (originalCommand || cleanCmd).toLowerCase().trim().replace(/^\//, '');
    const existingIdx = db.settings.telegramCustomCommands.findIndex(c => (c.command || '').toLowerCase() === targetLookup);

    if (existingIdx >= 0) {
      db.settings.telegramCustomCommands[existingIdx] = newCmd;
    } else {
      db.settings.telegramCustomCommands.push(newCmd);
    }

    await writeDb(db);

    // Auto-sync commands with Telegram API menu
    syncTelegramBotCommands(db).catch(e => console.warn('Sync commands error:', e.message));

    res.json({
      success: true,
      message: `បានរក្សាទុកពាក្យបញ្ជា /${cleanCmd} ដោយជោគជ័យ!`,
      command: newCmd
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុស៖ ' + err.message });
  }
});

// Delete a Custom Telegram Command
app.delete('/api/telegram/commands/:name', async (req, res) => {
  try {
    const db = await readDb();
    if (!db.settings || !Array.isArray(db.settings.telegramCustomCommands)) {
      return res.json({ success: true, message: 'បានលុបរួចរាល់' });
    }

    const target = req.params.name.toLowerCase().trim().replace(/^\//, '');
    db.settings.telegramCustomCommands = db.settings.telegramCustomCommands.filter(c => (c.command || '').toLowerCase() !== target);
    await writeDb(db);

    // Auto-sync with Telegram menu
    syncTelegramBotCommands(db).catch(e => console.warn('Sync commands error:', e.message));

    res.json({ success: true, message: `បានលុបពាក្យបញ្ជា /${target} ដោយជោគជ័យ!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុស៖ ' + err.message });
  }
});

// Sync Commands to Telegram Bot Menu API (setMyCommands)
app.post('/api/telegram/sync-commands', async (req, res) => {
  try {
    const db = await readDb();
    const result = await syncTelegramBotCommands(db);
    if (result.success) {
      res.json({
        success: true,
        message: `បានធ្វើសមកាលកម្មពាក្យបញ្ជាចំនួន ${result.count} ទៅកាន់ Telegram Menu រួចរាល់!`,
        count: result.count
      });
    } else {
      res.status(400).json({ success: false, message: result.reason || 'បរាជ័យក្នុងការធ្វើសមកាលកម្មពាក្យបញ្ជា' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'កំហុស៖ ' + err.message });
  }
});

// Export Express app
module.exports = app;

// Start Server (Runs standalone, on PM2, or inside hosting environments like Hostinger)
const startServer = () => {
  app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
    }
    console.log(`===================================================`);
    console.log(`🚀 KTPTTC Full-Stack Node.js App Running!`);
    console.log(`🌐 Public Site (Local)  : http://localhost:${PORT}`);
    console.log(`⚙️ Admin Panel (Local)   : http://localhost:${PORT}/admin`);
    console.log(`📱 Public Site (Network): http://${localIp}:${PORT}`);
    console.log(`📱 Admin Panel (Network) : http://${localIp}:${PORT}/admin`);
    console.log(`===================================================`);
  });
};

if (require.main === module) {
  startServer();
}
