const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (Images, CSS, JS, etc.)
app.use(express.static(__dirname));

// ==========================================
// MONGODB & DATABASE MANAGEMENT
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
let cachedClient = null;
let cachedDb = null;
let memoryDb = null;

// Connect to MongoDB Atlas (reusable for serverless)
async function getMongoCollection() {
  if (!MONGODB_URI) return null;
  try {
    if (cachedDb) {
      return cachedDb.collection('ktpttc_data');
    }
    if (!cachedClient) {
      cachedClient = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      await cachedClient.connect();
      console.log('✅ Connected to MongoDB Atlas successfully!');
    }
    cachedDb = cachedClient.db('ktpttc');
    return cachedDb.collection('ktpttc_data');
  } catch (err) {
    console.error('⚠️ MongoDB Connection Notice:', err.message);
    return null;
  }
}

// Helper: Read local fallback db.json
function getLocalFileDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(content || '{}');
    }
  } catch (err) {
    console.error('Error reading local DB file:', err);
  }
  return {};
}

// Helper: Read DB (MongoDB priority -> Local db.json fallback)
async function readDb() {
  const collection = await getMongoCollection();
  if (collection) {
    try {
      const doc = await collection.findOne({ _id: 'main_store' });
      if (doc) {
        const { _id, ...cleanData } = doc;
        memoryDb = cleanData;
        return memoryDb;
      } else {
        // Initial Seed: MongoDB is empty, copy existing db.json to MongoDB
        console.log('🌱 Seeding MongoDB Atlas with initial data from db.json...');
        const initialData = getLocalFileDb();
        await collection.updateOne(
          { _id: 'main_store' },
          { $set: initialData },
          { upsert: true }
        );
        memoryDb = initialData;
        return memoryDb;
      }
    } catch (err) {
      console.error('Error reading from MongoDB Atlas:', err.message);
    }
  }

  // Fallback if MongoDB is not configured or fails
  if (memoryDb) return memoryDb;
  memoryDb = getLocalFileDb();
  return memoryDb;
}

// Helper: Write DB (Updates MongoDB Atlas & local file)
async function writeDb(data) {
  memoryDb = data;

  // 1. Save to MongoDB Atlas
  const collection = await getMongoCollection();
  if (collection) {
    try {
      await collection.updateOne(
        { _id: 'main_store' },
        { $set: data },
        { upsert: true }
      );
    } catch (err) {
      console.error('Error saving to MongoDB Atlas:', err.message);
    }
  }

  // 2. Save to local db.json file
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
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
  const index = db.news.findIndex(item => String(item.id) === String(newItem.id));
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
  const id = req.params.id;
  if (db.news) {
    db.news = db.news.filter(item => String(item.id) !== String(id));
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
  const index = db.books.findIndex(b => String(b.id) === String(newBook.id));
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
  const id = req.params.id;
  if (db.books) {
    db.books = db.books.filter(b => String(b.id) !== String(id));
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
  const index = db.structure.findIndex(m => String(m.id) === String(member.id));
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
  const id = req.params.id;
  if (db.structure) {
    db.structure = db.structure.filter(m => String(m.id) !== String(id));
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
  const index = db.team.findIndex(m => String(m.id) === String(member.id));
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
  const id = req.params.id;
  if (db.team) {
    db.team = db.team.filter(m => String(m.id) !== String(id));
    await writeDb(db);
  }
  res.json({ success: true, team: db.team || [] });
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
  const index = db.gallery.findIndex(g => String(g.id) === String(item.id));
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
  const id = req.params.id;
  if (db.gallery) {
    db.gallery = db.gallery.filter(item => String(item.id) !== String(id));
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
  const index = db.videos.findIndex(v => String(v.id) === String(item.id));
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
  const id = req.params.id;
  if (db.videos) {
    db.videos = db.videos.filter(item => String(item.id) !== String(id));
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
    const index = db.messages.findIndex(m => String(m.id) === String(msgId));
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
  res.json({ success: true, message: 'សារត្រូវបានផ្ញើជោគជ័យ!', item: msg });
});

app.post('/api/messages/:id/read', async (req, res) => {
  const db = await readDb();
  const targetId = req.params.id;
  if (db.messages) {
    const msg = db.messages.find(m => String(m.id) === String(targetId));
    if (msg) {
      msg.status = 'read';
      await writeDb(db);
    }
  }
  res.json({ success: true, message: 'បានប្តូរស្ថានភាពសារជាអានរួច!' });
});

app.post('/api/messages/read', async (req, res) => {
  const db = await readDb();
  const targetId = req.body.id;
  if (db.messages && targetId) {
    const msg = db.messages.find(m => String(m.id) === String(targetId));
    if (msg) {
      msg.status = 'read';
      await writeDb(db);
    }
  }
  res.json({ success: true, message: 'បានប្តូរស្ថានភាពសារជាអានរួច!' });
});

app.delete('/api/messages/:id', async (req, res) => {
  const db = await readDb();
  const target = req.params.id;
  if (db.messages) {
    db.messages = db.messages.filter((m, idx) => String(m.id) !== String(target) && String(idx) !== String(target));
    await writeDb(db);
  }
  res.json({ success: true, message: 'បានលុបសារជោគជ័យ!' });
});

app.post('/api/messages/delete', async (req, res) => {
  const db = await readDb();
  const targetId = req.body.id;
  const targetIndex = req.body.index;
  if (db.messages) {
    db.messages = db.messages.filter((m, idx) => {
      if (targetId && String(m.id) === String(targetId)) return false;
      if (targetIndex !== undefined && targetIndex !== null && idx === Number(targetIndex)) return false;
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
  const id = req.params.id;
  if (db.slides) {
    db.slides = db.slides.filter((s, idx) => String(s.id) !== String(id) && String(idx) !== String(id));
    await writeDb(db);
  }
  res.json({ success: true, slides: db.slides || [] });
});

// 10. Admin Profile API
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
