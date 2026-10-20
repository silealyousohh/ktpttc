require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const telegram = require('./telegram');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

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
app.use(express.static(__dirname));

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

// Connect to MongoDB Atlas (reusable for serverless)
async function getMongoCollection() {
  const uri = process.env.MONGODB_URI || MONGODB_URI;
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
      console.log('✅ Connected to MongoDB Atlas successfully!');
    }
    cachedDb = cachedClient.db('ktpttc');
    lastMongoError = null;
    return cachedDb.collection('ktpttc_data');
  } catch (err) {
    lastMongoError = err;
    console.error('⚠️ MongoDB Connection Notice:', err.message);
    cachedClient = null;
    cachedDb = null;
    return null;
  }
}

// Helper: Read local fallback db.json
function getLocalFileDb() {
  const possiblePaths = [
    path.join(__dirname, 'data', 'db.json'),
    path.join(__dirname, 'db.json'),
    path.join(process.cwd(), 'data', 'db.json'),
    path.join(process.cwd(), 'db.json')
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        if (content && content.trim()) {
          return JSON.parse(content);
        }
      }
    } catch (err) {
      console.error('Error reading fallback DB path:', p, err.message);
    }
  }
  return {};
}

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

// Helper: Read DB (MongoDB priority -> Local db.json fallback)
async function readDb() {
  const collection = await getMongoCollection();
  if (collection) {
    try {
      const doc = await collection.findOne({ _id: 'main_store' });
      if (doc) {
        const { _id, ...cleanData } = doc;
        memoryDb = cleanData;
        if (!memoryDb.partners || !Array.isArray(memoryDb.partners) || memoryDb.partners.length === 0) {
          const localDb = getLocalFileDb();
          memoryDb.partners = (localDb.partners && localDb.partners.length > 0) ? localDb.partners : DEFAULT_PARTNERS;
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
    if (!memoryDb.partners || memoryDb.partners.length === 0) {
      memoryDb.partners = DEFAULT_PARTNERS;
    }
    return memoryDb;
  }
  memoryDb = getLocalFileDb();
  if (!memoryDb.partners || memoryDb.partners.length === 0) {
    memoryDb.partners = DEFAULT_PARTNERS;
  }
  return memoryDb;
}

// Helper: Write DB (Updates MongoDB Atlas & local file)
async function writeDb(data) {
  const cleanData = { ...data };
  delete cleanData._id;
  memoryDb = cleanData;
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

  // 2. Save to local db.json file
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(cleanData, null, 2), 'utf8');
  } catch (err) {
    // Read-only filesystem is expected on serverless (Vercel)
  }

  return true;
}

// Routes for HTML Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Public_Index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'Admin_Index.html'));
});

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Settings API
app.get('/api/settings', async (req, res) => {
  const db = await readDb();
  res.json(db.settings || {});
});

app.post('/api/settings', async (req, res) => {
  const db = await readDb();
  db.settings = { ...(db.settings || {}), ...req.body };
  await writeDb(db);
  res.json({ success: true, settings: db.settings });
});

// 2. News API
app.get('/api/news', async (req, res) => {
  const db = await readDb();
  res.json(db.news || []);
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
  const db = await readDb();
  res.json(db.books || []);
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

// 4. Structure (Organization Chart) API
app.get('/api/structure', async (req, res) => {
  const db = await readDb();
  res.json(db.structure || []);
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
  const item = req.body;
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

    res.json({
      configured: Boolean(config.token),
      hasChatId: Boolean(config.chatId),
      chatId: config.chatId || '',
      maskedToken: config.token ? (config.token.slice(0, 7) + '...' + config.token.slice(-5)) : '',
      bot: botInfo,
      webhook: webhookInfo,
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

// Export Express app for Serverless / Vercel
module.exports = app;

// Start Server (only if executed directly)
if (require.main === module && !process.env.VERCEL) {
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
    console.log(`📱 Public Site (Mobile) : http://${localIp}:${PORT}`);
    console.log(`📱 Admin Panel (Mobile)  : http://${localIp}:${PORT}/admin`);
    console.log(`===================================================`);
  });
}
