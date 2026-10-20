/**
 * Telegram Bot Service for KTPTTC (Kratie Provincial Teacher Training College)
 * Supports real-time visitor contact notifications, admin alerts,
 * and interactive bot commands (/start, /status, /stats, /messages, /news, /books, /id, /help).
 * Dual-mode: Supports both Serverless Webhook (for Vercel) and Long-Polling (for Local/VPS).
 */

const fs = require('fs');
const path = require('path');

// Helper to sanitize HTML for Telegram message format
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Resolve Telegram configurations from Environment Variables and/or Database Settings
function getTelegramConfig(customSettings = {}) {
  const token = (
    process.env.TELEGRAM_BOT_TOKEN ||
    customSettings.telegramBotToken ||
    ''
  ).trim();

  const chatId = (
    process.env.TELEGRAM_CHAT_ID ||
    customSettings.telegramChatId ||
    ''
  ).trim();

  const notifyOnMessage = customSettings.telegramNotifyOnMessage !== undefined
    ? Boolean(customSettings.telegramNotifyOnMessage)
    : true;

  const notifyOnBackup = customSettings.telegramNotifyOnBackup !== undefined
    ? Boolean(customSettings.telegramNotifyOnBackup)
    : true;

  return { token, chatId, notifyOnMessage, notifyOnBackup };
}

// Low-level Telegram Bot API call
async function callTelegramApi(method, payload = {}, tokenOverride = null) {
  const token = tokenOverride || getTelegramConfig().token;
  if (!token) {
    throw new Error('Telegram Bot Token is not configured. Please set TELEGRAM_BOT_TOKEN in .env or Admin Settings.');
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({ ok: false, description: 'Invalid JSON response from Telegram' }));
  if (!data.ok) {
    const errorMsg = data.description || `Telegram API error (${data.error_code || 'unknown'})`;
    const err = new Error(errorMsg);
    err.errorCode = data.error_code;
    throw err;
  }
  return data.result;
}

// Get Bot Information (calls /getMe)
async function getBotInfo(tokenOverride = null) {
  return await callTelegramApi('getMe', {}, tokenOverride);
}

// Send a Telegram Message
async function sendMessage(chatId, text, options = {}, tokenOverride = null) {
  if (!chatId) throw new Error('Target chatId is required to send Telegram message');
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: options.disable_web_page_preview !== undefined ? options.disable_web_page_preview : true,
    reply_markup: options.reply_markup || undefined
  };
  return await callTelegramApi('sendMessage', payload, tokenOverride);
}

// Standard Persistent Keyboard for Telegram Chat
function getMainKeyboard() {
  return {
    keyboard: [
      [{ text: '📊 ស្ថានភាពប្រព័ន្ធ' }, { text: '📈 ស្ថិតិទូទៅ' }],
      [{ text: '📩 សារពីគេហទំព័រ' }, { text: '📰 ព័ត៌មានថ្មីៗ' }],
      [{ text: '📚 សៀវភៅបណ្ណាល័យ' }, { text: '🔔 ចុះឈ្មោះទទួលដំណឹង' }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

// Notify Admin when a visitor submits a contact form message
async function notifyNewContactMessage(msg, customSettings = {}) {
  const { token, chatId, notifyOnMessage } = getTelegramConfig(customSettings);
  if (!token || !notifyOnMessage) {
    return { success: false, reason: 'Telegram notifications disabled or token missing' };
  }

  // Collect all recipient chat IDs (both primary chatId and auto-subscribers)
  const recipientSet = new Set();
  if (chatId) recipientSet.add(String(chatId).trim());
  if (Array.isArray(customSettings.telegramSubscribers)) {
    customSettings.telegramSubscribers.forEach(id => {
      if (id) recipientSet.add(String(id).trim());
    });
  }

  if (recipientSet.size === 0) {
    return { success: false, reason: 'No Telegram recipients registered' };
  }

  const senderName = msg.sender || msg.name || 'អ្នកផ្ញើអនាមិក';
  const contact = msg.contact || msg.email || msg.phone || 'មិនមាន';
  const subject = msg.subject || 'មតិយោបល់ / ទំនាក់ទំនងទូទៅ';
  const messageBody = msg.message || '(គ្មានខ្លឹមសារ)';
  const dateStr = msg.date || new Date().toLocaleString('km-KH');
  const idStr = msg.id || 'N/A';

  const text = [
    `🔔 <b>សារទំនាក់ទំនងថ្មីពីគេហទំព័រ KTPTTC</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>ឈ្មោះ៖</b> ${escapeHtml(senderName)}`,
    `📞 <b>ទំនាក់ទំនង៖</b> ${escapeHtml(contact)}`,
    `📌 <b>កម្មវត្ថុ៖</b> ${escapeHtml(subject)}`,
    `💬 <b>ខ្លឹមសារ៖</b>`,
    `<i>"${escapeHtml(messageBody)}"</i>`,
    ``,
    `🕒 <b>កាលបរិច្ឆេទ៖</b> ${escapeHtml(dateStr)}`,
    `🆔 <b>លេខសម្គាល់៖</b> <code>${escapeHtml(idStr)}</code>`
  ].join('\n');

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🌐 គេហទំព័រ KTPTTC', url: 'https://ktpttc-edu-kh-ll8r.vercel.app' },
        { text: '🔐 ផ្ទាំង Admin', url: 'https://ktpttc-edu-kh-ll8r.vercel.app/admin' }
      ]
    ]
  };

  let sentCount = 0;
  for (const targetId of recipientSet) {
    try {
      await sendMessage(targetId, text, { reply_markup: replyMarkup }, token);
      sentCount++;
    } catch (err) {
      console.error(`⚠️ Failed to dispatch Telegram contact notification to ${targetId}:`, err.message);
    }
  }

  return { success: sentCount > 0, recipients: sentCount };
}

// Forward a specific visitor contact message to Telegram
async function forwardContactMessage(msg, customSettings = {}) {
  const { token, chatId } = getTelegramConfig(customSettings);
  if (!token) {
    return { success: false, reason: 'Telegram token missing' };
  }

  const recipientSet = new Set();
  if (chatId) recipientSet.add(String(chatId).trim());
  if (Array.isArray(customSettings.telegramSubscribers)) {
    customSettings.telegramSubscribers.forEach(id => {
      if (id) recipientSet.add(String(id).trim());
    });
  }

  if (recipientSet.size === 0) {
    return { success: false, reason: 'មិនទាន់មានអ្នកទទួលសារ Telegram (សូមចុះឈ្មោះ /subscribe លើ Bot ជាមុន)' };
  }

  const senderName = msg.sender || msg.name || 'អ្នកផ្ញើអនាមិក';
  const contact = msg.contact || msg.email || msg.phone || 'មិនមាន';
  const subject = msg.subject || 'មតិយោបល់ / ទំនាក់ទំនង';
  const messageBody = msg.message || '(គ្មានខ្លឹមសារ)';
  const dateStr = msg.date || new Date().toLocaleString('km-KH');
  const idStr = msg.id || 'N/A';

  const text = [
    `📨 <b>ការបញ្ជូនបន្តសារទំនាក់ទំនង (Forwarded from Admin)</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 <b>អ្នកផ្ញើដើម៖</b> ${escapeHtml(senderName)}`,
    `📞 <b>ទំនាក់ទំនង៖</b> ${escapeHtml(contact)}`,
    `📌 <b>ប្រធានបទ៖</b> ${escapeHtml(subject)}`,
    `💬 <b>ខ្លឹមសារ៖</b>`,
    `<i>"${escapeHtml(messageBody)}"</i>`,
    ``,
    `🕒 <b>កាលបរិច្ឆេទ៖</b> ${escapeHtml(dateStr)}`,
    `🆔 <b>លេខសម្គាល់៖</b> <code>${escapeHtml(idStr)}</code>`
  ].join('\n');

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🌐 គេហទំព័រ KTPTTC', url: 'https://ktpttc-edu-kh-ll8r.vercel.app' },
        { text: '🔐 ផ្ទាំងគ្រប់គ្រង Admin', url: 'https://ktpttc-edu-kh-ll8r.vercel.app/admin' }
      ]
    ]
  };

  let sentCount = 0;
  for (const targetId of recipientSet) {
    try {
      await sendMessage(targetId, text, { reply_markup: replyMarkup }, token);
      sentCount++;
    } catch (err) {
      console.error(`⚠️ Failed to forward message to ${targetId}:`, err.message);
    }
  }

  return { success: sentCount > 0, recipients: sentCount };
}

// Broadcast custom announcement or outbound message to Telegram Admin & Subscribers
async function broadcastMessage(data = {}, customSettings = {}) {
  const { token, chatId } = getTelegramConfig(customSettings);
  if (!token) {
    return { success: false, reason: 'Telegram token missing' };
  }

  const recipientSet = new Set();
  if (chatId) recipientSet.add(String(chatId).trim());
  if (Array.isArray(customSettings.telegramSubscribers)) {
    customSettings.telegramSubscribers.forEach(id => {
      if (id) recipientSet.add(String(id).trim());
    });
  }

  if (recipientSet.size === 0) {
    return { success: false, reason: 'មិនទាន់មានអ្នកទទួលសារ Telegram (សូមចុះឈ្មោះ /subscribe លើ Bot ជាមុន)' };
  }

  const subject = data.subject || 'សេចក្តីជូនដំណឹងពីរដ្ឋបាល';
  const recipient = data.recipient || 'សមាជិកទាំងអស់';
  const messageBody = data.message || data.content || '(គ្មានខ្លឹមសារ)';
  const dateStr = data.date || new Date().toLocaleString('km-KH');

  const text = [
    `📢 <b>សារជូនដំណឹងពីរដ្ឋបាលសាលា (KTPTTC Broadcast)</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>ប្រធានបទ៖</b> ${escapeHtml(subject)}`,
    `🎯 <b>អ្នកទទួល៖</b> ${escapeHtml(recipient)}`,
    `💬 <b>ខ្លឹមសារ៖</b>`,
    `<i>"${escapeHtml(messageBody)}"</i>`,
    ``,
    `🕒 <b>កាលបរិច្ឆេទ៖</b> ${escapeHtml(dateStr)}`
  ].join('\n');

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🌐 គេហទំព័រ KTPTTC', url: 'https://ktpttc-edu-kh-ll8r.vercel.app' }
      ]
    ]
  };

  let sentCount = 0;
  for (const targetId of recipientSet) {
    try {
      await sendMessage(targetId, text, { reply_markup: replyMarkup }, token);
      sentCount++;
    } catch (err) {
      console.error(`⚠️ Failed to broadcast to ${targetId}:`, err.message);
    }
  }

  return { success: sentCount > 0, recipients: sentCount };
}

// Notify Admin on Database Events (Backup, Restore, Sync)
async function notifyDatabaseEvent(title, detail, customSettings = {}) {
  const { token, chatId, notifyOnBackup } = getTelegramConfig(customSettings);
  if (!token || !chatId || !notifyOnBackup) return;

  const text = [
    `🗄️ <b>ដំណឹងប្រព័ន្ធទិន្នន័យ (KTPTTC Database Alert)</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `⚡ <b>សកម្មភាព៖</b> ${escapeHtml(title)}`,
    `📝 <b>ព័ត៌មានលម្អិត៖</b> ${escapeHtml(detail)}`,
    `🕒 <b>ពេលវេលា៖</b> ${new Date().toISOString()}`
  ].join('\n');

  try {
    await sendMessage(chatId, text, {}, token);
  } catch (err) {
    console.error('⚠️ Failed to send Telegram database event:', err.message);
  }
}

// Process Incoming Telegram Updates (Webhook or Long-Polling)
async function handleUpdate(update, context = {}) {
  const { readDb, writeDb, token: tokenParam, customSettings } = context;
  const config = getTelegramConfig(customSettings);
  const token = tokenParam || config.token;

  if (!update || (!update.message && !update.callback_query)) {
    return { handled: false, reason: 'Empty or non-message update' };
  }

  // Handle Callback Queries (Inline button clicks)
  if (update.callback_query) {
    const cb = update.callback_query;
    try {
      await callTelegramApi('answerCallbackQuery', { callback_query_id: cb.id, text: 'បានទទួលសំណើ!' }, token);
    } catch (_) {}
    return { handled: true, type: 'callback' };
  }

  const message = update.message;
  if (!message || !message.text) {
    return { handled: false, reason: 'No text in message' };
  }

  const chatId = message.chat.id;
  const rawText = message.text.trim();
  const textLower = rawText.toLowerCase();
  const fromUser = message.from || {};
  const senderName = fromUser.first_name || 'លោកអ្នក';

  // Helper to respond to the same chat
  const reply = async (htmlText, extra = {}) => {
    return await sendMessage(chatId, htmlText, {
      parse_mode: 'HTML',
      reply_markup: extra.reply_markup || getMainKeyboard(),
      disable_web_page_preview: extra.disable_web_page_preview !== false
    }, token);
  };

  // 1. /start command
  if (textLower === '/start' || textLower.startsWith('/start ')) {
    const welcomeText = [
      `👋 <b>សួស្តី ${escapeHtml(senderName)}!</b>`,
      `សូមស្វាគមន៍មកកាន់ប្រព័ន្ធតេឡេក្រាមបូតផ្លូវការរបស់ <b>សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC)</b> 🇰🇭`,
      ``,
      `លោកអ្នកអាចប្រើប្រាស់ប៊ូតុងខាងក្រោម ឬពាក្យបញ្ជា (Commands) ទាំងនេះ៖`,
      `• 📊 <b>/status</b> - ពិនិត្យស្ថានភាពដំណើរការគេហទំព័រ និង MongoDB Atlas`,
      `• 📈 <b>/stats</b> - ពិនិត្យស្ថិតិទិន្នន័យ (សៀវភៅ, បុគ្គលិក, ព័ត៌មាន, សារ)`,
      `• 📩 <b>/messages</b> - មើលសារចុងក្រោយផ្ញើចេញពីទម្រង់ទំនាក់ទំនងគេហទំព័រ`,
      `• 📰 <b>/news</b> - មើលព័ត៌មាន និងសេចក្តីជូនដំណឹងថ្មីៗ`,
      `• 📚 <b>/books</b> <i>[ឈ្មោះ]</i> - ស្វែងរកសៀវភៅក្នុងបណ្ណាល័យឌីជីថល`,
      `• 🆔 <b>/id</b> - មើលលេខសម្គាល់ Telegram Chat ID របស់អ្នក`,
      `• ℹ️ <b>/help</b> - មើលការណែនាំលម្អិត`,
      ``,
      `🌐 គេហទំព័រផ្លូវការ៖ <a href="https://ktpttc-edu-kh-ll8r.vercel.app">ktpttc.com</a>`
    ].join('\n');

    await reply(welcomeText);
    return { handled: true, command: '/start' };
  }

  // Helper to fetch DB data safely
  const getDbData = async () => {
    if (typeof readDb === 'function') {
      try {
        return await readDb();
      } catch (e) {
        console.error('Error in readDb for Telegram:', e.message);
      }
    }
    return {};
  };

  // 2. /status or 📊 ស្ថានភាពប្រព័ន្ធ
  if (textLower === '/status' || rawText.includes('ស្ថានភាព')) {
    const db = await getDbData();
    const hasMongo = Boolean(process.env.MONGODB_URI);
    const visitorCount = db.visitorCount || 0;
    const environment = process.env.VERCEL ? 'Vercel Serverless' : 'Node.js Local Server';

    const statusText = [
      `🟢 <b>ស្ថានភាពប្រព័ន្ធ KTPTTC System Status</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🌐 <b>គេហទំព័រ៖</b> កំពុងដំណើរការធម្មតា (Online)`,
      `💻 <b>បរិស្ថាន (Env)៖</b> <code>${escapeHtml(environment)}</code>`,
      `🗄️ <b>MongoDB Atlas៖</b> ${hasMongo ? '✅ ភ្ជាប់ជោគជ័យ (Connected)' : '⚠️ កំពុងប្រើ Local DB'}`,
      `👁️ <b>ចំនួនអ្នកទស្សនា៖</b> <b>${visitorCount.toLocaleString()}</b> លើក`,
      `⏱️ <b>ពេលវេលា Server៖</b> <code>${new Date().toLocaleString('km-KH')}</code>`,
      ``,
      `<i>ប្រព័ន្ធត្រួតពិនិត្យដំណើរការដោយស្វ័យប្រវត្តិ ២៤/៧</i>`
    ].join('\n');

    await reply(statusText);
    return { handled: true, command: '/status' };
  }

  // 3. /stats or 📈 ស្ថិតិទូទៅ
  if (textLower === '/stats' || rawText.includes('ស្ថិតិ')) {
    const db = await getDbData();
    const books = Array.isArray(db.books) ? db.books.length : 0;
    const staff = Array.isArray(db.staff) ? db.staff.length : 0;
    const team = Array.isArray(db.team) ? db.team.length : 0;
    const news = Array.isArray(db.news) ? db.news.length : 0;
    const videos = Array.isArray(db.videos) ? db.videos.length : 0;
    const partners = Array.isArray(db.partners) ? db.partners.length : 0;
    const messages = Array.isArray(db.messages) ? db.messages : [];
    const unreadMessages = messages.filter(m => m.status === 'unread').length;
    const visitorCount = db.visitorCount || 0;

    const statsText = [
      `📈 <b>ស្ថិតិទូទៅនៃប្រព័ន្ធ KTPTTC Portal</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📚 <b>សៀវភៅបណ្ណាល័យ៖</b> <b>${books}</b> ក្បាល`,
      `👥 <b>បុគ្គលិក និងគ្រូឧទ្ទេស៖</b> <b>${staff}</b> នាក់`,
      `🏛️ <b>ថ្នាក់ដឹកនាំ (Team)៖</b> <b>${team}</b> នាក់`,
      `📰 <b>ព័ត៌មាន និងសកម្មភាព៖</b> <b>${news}</b> អត្ថបទ`,
      `🎥 <b>វីដេអូផ្សព្វផ្សាយ៖</b> <b>${videos}</b> វីដេអូ`,
      `🤝 <b>សាលា និងស្ថាប័នដៃគូ៖</b> <b>${partners}</b> ស្ថាប័ន`,
      `📩 <b>សារទំនាក់ទំនងសរុប៖</b> <b>${messages.length}</b> សារ (មិនទាន់អាន៖ <code>${unreadMessages}</code>)`,
      `👁️ <b>អ្នកទស្សនាគេហទំព័រ៖</b> <b>${visitorCount.toLocaleString()}</b> លើក`
    ].join('\n');

    await reply(statsText);
    return { handled: true, command: '/stats' };
  }

  // 4. /messages or /latest or 📩 សារពីគេហទំព័រ
  if (textLower === '/messages' || textLower === '/latest' || rawText.includes('សារពីគេហទំព័រ')) {
    const db = await getDbData();
    const messages = Array.isArray(db.messages) ? db.messages : [];

    if (messages.length === 0) {
      await reply('📭 <b>ពុំទាន់មានសារទំនាក់ទំនងពីអ្នកចូលទស្សនានៅឡើយទេ។</b>');
      return { handled: true, command: '/messages' };
    }

    const latest = messages.slice(0, 5);
    const lines = [
      `📩 <b>សារទំនាក់ទំនងចុងក្រោយ (${latest.length}/${messages.length})</b>`,
      `━━━━━━━━━━━━━━━━━━━━`
    ];

    latest.forEach((m, idx) => {
      const name = m.sender || m.name || 'អ្នកផ្ញើអនាមិក';
      const contact = m.contact || m.phone || m.email || 'មិនមាន';
      const subject = m.subject || 'ទំនាក់ទំនង';
      const msgSnippet = (m.message || '').slice(0, 70) + (m.message && m.message.length > 70 ? '...' : '');
      const statusIcon = m.status === 'unread' ? '🔴 <b>[មិនទាន់អាន]</b>' : '🟢 <i>[អានរួច]</i>';

      lines.push(
        `<b>#${idx + 1}. ${escapeHtml(name)}</b> ${statusIcon}`,
        `📞 ទំនាក់ទំនង៖ <code>${escapeHtml(contact)}</code>`,
        `📌 កម្មវត្ថុ៖ ${escapeHtml(subject)}`,
        `💬 ខ្លឹមសារ៖ <i>"${escapeHtml(msgSnippet)}"</i>`,
        `🕒 កាលបរិច្ឆេទ៖ ${escapeHtml(m.date || '')}`,
        `────────────────────`
      );
    });

    lines.push(`💡 <i>ចូលទៅកាន់ផ្ទាំង <a href="https://ktpttc-edu-kh-ll8r.vercel.app/admin">Admin Panel</a> ដើម្បីមើលសារពេញលេញ ឬឆ្លើយតប។</i>`);
    await reply(lines.join('\n'));
    return { handled: true, command: '/messages' };
  }

  // 5. /news or 📰 ព័ត៌មានថ្មីៗ
  if (textLower === '/news' || rawText.includes('ព័ត៌មាន')) {
    const db = await getDbData();
    const newsList = Array.isArray(db.news) ? db.news : [];

    if (newsList.length === 0) {
      await reply('📰 <b>ពុំទាន់មានព័ត៌មានត្រូវបានផ្សាយនៅឡើយទេ។</b>');
      return { handled: true, command: '/news' };
    }

    const latestNews = newsList.slice(0, 4);
    const lines = [
      `📰 <b>ព័ត៌មាន និងសកម្មភាពថ្មីៗនៃ KTPTTC</b>`,
      `━━━━━━━━━━━━━━━━━━━━`
    ];

    latestNews.forEach((item, idx) => {
      const title = item.title || item.titleKh || 'ព័ត៌មានគ្មានចំណងជើង';
      const date = item.date || item.createdAt || '';
      lines.push(
        `<b>${idx + 1}. ${escapeHtml(title)}</b>`,
        `📅 កាលបរិច្ឆេទ៖ ${escapeHtml(date)}`,
        `────────────────────`
      );
    });

    lines.push(`🌐 មើលព័ត៌មានទាំងអស់លើ <a href="https://ktpttc-edu-kh-ll8r.vercel.app/#news">គេហទំព័រ</a>`);
    await reply(lines.join('\n'));
    return { handled: true, command: '/news' };
  }

  // 6. /books or 📚 សៀវភៅបណ្ណាល័យ
  if (textLower.startsWith('/books') || textLower.startsWith('/book') || rawText.includes('សៀវភៅ')) {
    const db = await getDbData();
    const books = Array.isArray(db.books) ? db.books : [];

    let query = '';
    if (textLower.startsWith('/books ') || textLower.startsWith('/book ')) {
      query = rawText.split(' ').slice(1).join(' ').trim().toLowerCase();
    }

    let filtered = books;
    if (query) {
      filtered = books.filter(b => {
        const title = (b.title || '').toLowerCase();
        const author = (b.author || '').toLowerCase();
        const category = (b.category || '').toLowerCase();
        return title.includes(query) || author.includes(query) || category.includes(query);
      });
    }

    if (filtered.length === 0) {
      await reply(`📚 <b>ពុំមានសៀវភៅណាត្រូវនឹងពាក្យ "${escapeHtml(query)}" ឡើយ។</b>\nសាកល្បងវាយឈ្មោះ ឬអ្នកនិពន្ធផ្សេងទៀត។`);
      return { handled: true, command: '/books' };
    }

    const displayBooks = filtered.slice(0, 5);
    const lines = [
      query ? `📚 <b>លទ្ធផលស្វែងរកសៀវភៅ "${escapeHtml(query)}" (${filtered.length} ក្បាល)</b>` : `📚 <b>សៀវភៅបណ្ណាល័យឌីជីថលថ្មីៗ (${filtered.length} ក្បាល)</b>`,
      `━━━━━━━━━━━━━━━━━━━━`
    ];

    displayBooks.forEach((b, idx) => {
      const title = b.title || 'គ្មានចំណងជើង';
      const author = b.author || 'មិនបញ្ជាក់';
      const cat = b.category || 'ទូទៅ';
      lines.push(
        `<b>${idx + 1}. ${escapeHtml(title)}</b>`,
        `✍️ អ្នកនិពន្ធ៖ ${escapeHtml(author)} | 📂 ប្រភេទ៖ ${escapeHtml(cat)}`,
        b.pdfUrl ? `🔗 <a href="${escapeHtml(b.pdfUrl)}">អានសៀវភៅ (PDF)</a>` : ``,
        `────────────────────`
      );
    });

    lines.push(`📖 ស្វែងរកសៀវភៅដោយវាយ៖ <code>/books [ឈ្មោះសៀវភៅ]</code>`);
    await reply(lines.filter(Boolean).join('\n'));
    return { handled: true, command: '/books' };
  }

  // 7. /id or /chatid or 🆔 Chat ID
  if (textLower === '/id' || textLower === '/chatid' || rawText.includes('Chat ID') || rawText.includes('chat id')) {
    const isConfigured = String(config.chatId) === String(chatId);
    const idText = [
      `🆔 <b>ព័ត៌មានគណនី Telegram របស់អ្នក</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 <b>ឈ្មោះ៖</b> ${escapeHtml(senderName)}`,
      `🔑 <b>Chat ID របស់អ្នក៖</b> <code>${chatId}</code>`,
      `📌 <b>ប្រភេទ Chat៖</b> <code>${escapeHtml(message.chat.type || 'private')}</code>`,
      ``,
      isConfigured
        ? `✅ <b>Chat ID នេះត្រូវបានភ្ជាប់រួចរាល់ជាមួយប្រព័ន្ធទទួលដំណឹង KTPTTC!</b>`
        : `💡 <b>ការណែនាំ៖</b> ចម្លងលេខកូដ <code>${chatId}</code> នេះ រួចចូលទៅដាក់ក្នុង <b>Telegram Chat ID</b> ក្នុងផ្ទាំង Admin Settings ឬ .env (<code>TELEGRAM_CHAT_ID=${chatId}</code>) ដើម្បីទទួលបានសារជូនដំណឹងភ្លាមៗនៅពេលមានអ្នកផ្ញើសារពីគេហទំព័រ។`
    ].join('\n');

    await reply(idText);
    return { handled: true, command: '/id' };
  }

  // 8. /subscribe or 🔔 ចុះឈ្មោះទទួលដំណឹង (Auto register without manual Chat ID)
  if (textLower === '/subscribe' || rawText.includes('ចុះឈ្មោះទទួលដំណឹង')) {
    const db = await getDbData();
    if (!db.settings) db.settings = {};
    if (!Array.isArray(db.settings.telegramSubscribers)) {
      db.settings.telegramSubscribers = [];
    }
    const strId = String(chatId);
    let isNew = false;
    if (!db.settings.telegramSubscribers.includes(strId)) {
      db.settings.telegramSubscribers.push(strId);
      isNew = true;
    }
    if (!db.settings.telegramChatId) {
      db.settings.telegramChatId = strId;
      isNew = true;
    }
    if (isNew && typeof writeDb === 'function') {
      try {
        await writeDb(db);
      } catch (e) {
        console.error('Error saving subscriber to DB:', e.message);
      }
    }

    const subText = [
      `🔔 <b>បានចុះឈ្មោះទទួលដំណឹងដោយជោគជ័យ!</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 <b>គណនី៖</b> ${escapeHtml(senderName)}`,
      `🔑 <b>Chat ID៖</b> <code>${chatId}</code>`,
      ``,
      `✅ ប្រព័ន្ធបានកត់ត្រាគណនីរបស់អ្នកដោយស្វ័យប្រវត្តិ។`,
      `📲 រាល់ពេលមានអ្នកទស្សនាផ្ញើសារពីគេហទំព័រ KTPTTC សារនោះនឹងត្រូវបញ្ជូនមកកាន់ទីនេះភ្លាមៗ ដោយមិនបាច់កំណត់ ID ក្នុង Admin ឡើយ!`,
      ``,
      `💡 <i>ប្រសិនបើចង់ឈប់ទទួលដំណឹង សូមវាយពាក្យ /unsubscribe</i>`
    ].join('\n');

    await reply(subText);
    return { handled: true, command: '/subscribe' };
  }

  // 9. /unsubscribe
  if (textLower === '/unsubscribe' || rawText.includes('ឈប់ទទួលដំណឹង')) {
    const db = await getDbData();
    if (db.settings && Array.isArray(db.settings.telegramSubscribers)) {
      db.settings.telegramSubscribers = db.settings.telegramSubscribers.filter(id => String(id) !== String(chatId));
      if (typeof writeDb === 'function') {
        try {
          await writeDb(db);
        } catch (_) {}
      }
    }
    await reply(`🔕 <b>បានឈប់ទទួលសារជូនដំណឹងជោគជ័យ!</b>\nអ្នកអាចវាយ <code>/subscribe</code> ឡើងវិញគ្រប់ពេលវេលា។`);
    return { handled: true, command: '/unsubscribe' };
  }

  // 10. /help or ℹ️ ជំនួយ
  if (textLower === '/help' || rawText.includes('ជំនួយ')) {
    const helpText = [
      `ℹ️ <b>ការណែនាំប្រើប្រាស់ KTPTTC Telegram Bot</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `លោកអ្នកអាចប្រើប្រាស់បញ្ជាដូចខាងក្រោម៖`,
      ``,
      `• 📊 <b>/status</b> : ពិនិត្យស្ថានភាពគេហទំព័រ & MongoDB`,
      `• 📈 <b>/stats</b> : ស្ថិតិទិន្នន័យទូទៅ`,
      `• 📩 <b>/messages</b> : មើលសារចុងក្រោយផ្ញើមកពីគេហទំព័រ`,
      `• 📰 <b>/news</b> : ព័ត៌មាន និងសកម្មភាពថ្មីៗ`,
      `• 📚 <b>/books</b> : បញ្ជីសៀវភៅ ឬស្វែងរក (ឧ. <code>/books គណិត</code>)`,
      `• 🆔 <b>/id</b> : មើលលេខសម្គាល់ Telegram Chat ID របស់អ្នក`,
      `• ℹ️ <b>/help</b> : បង្ហាញការណែនាំនេះ`,
      ``,
      `🔔 <b>ប្រព័ន្ធជូនដំណឹងស្វ័យប្រវត្ត៖</b>`,
      `នៅពេលមានអ្នកចូលទស្សនាបំពេញទម្រង់ផ្ញើសារក្នុងគេហទំព័រ បូតនេះនឹងផ្ញើសារជូនដំណឹងភ្លាមៗមកកាន់ Telegram របស់អ្នក។`
    ].join('\n');

    await reply(helpText);
    return { handled: true, command: '/help' };
  }

  // Fallback for unrecognized text
  const fallbackText = [
    `🤔 <b>សុំអភ័យទោស ខ្ញុំពុំទាន់យល់ពាក្យបញ្ជានេះឡើយ។</b>`,
    ``,
    `សូមចុចលើប៊ូតុងខាងក្រោម ឬវាយពាក្យ <b>/help</b> ដើម្បីមើលបញ្ជីពាក្យបញ្ជាដែលអាចប្រើប្រាស់បាន។`
  ].join('\n');

  await reply(fallbackText);
  return { handled: true, command: 'fallback' };
}

// Set Webhook for Telegram Bot
async function setWebhook(webhookUrl, tokenOverride = null) {
  const token = tokenOverride || getTelegramConfig().token;
  if (!webhookUrl) throw new Error('Webhook URL is required');
  return await callTelegramApi('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query']
  }, token);
}

// Delete Webhook
async function deleteWebhook(dropPendingUpdates = false, tokenOverride = null) {
  const token = tokenOverride || getTelegramConfig().token;
  return await callTelegramApi('deleteWebhook', {
    drop_pending_updates: Boolean(dropPendingUpdates)
  }, token);
}

// Get Webhook Info
async function getWebhookInfo(tokenOverride = null) {
  const token = tokenOverride || getTelegramConfig().token;
  return await callTelegramApi('getWebhookInfo', {}, token);
}

// Long-Polling Runner for Local development or VPS deployment
async function startPolling(dbReader = null, tokenOverride = null) {
  const token = tokenOverride || getTelegramConfig().token;
  if (!token) {
    throw new Error('Telegram Bot Token is not configured. Please set TELEGRAM_BOT_TOKEN.');
  }

  console.log('🤖 Verifying Telegram Bot credentials...');
  const me = await getMe(token);
  console.log(`✅ Connected as @${me.username} (${me.first_name})`);

  // Drop any existing webhook so polling works smoothly
  try {
    await deleteWebhook(false, token);
    console.log('📡 Webhook cleared, switched to long-polling mode.');
  } catch (e) {
    console.log('Note on webhook clear:', e.message);
  }

  console.log(`🚀 KTPTTC Telegram Bot is running in long-polling mode!`);
  console.log(`💬 Open Telegram and message @${me.username} or send /start`);

  let offset = 0;
  let running = true;

  const shutdown = () => {
    console.log('\n🛑 Stopping Telegram Bot polling...');
    running = false;
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      const updates = await callTelegramApi('getUpdates', {
        offset: offset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query']
      }, token);

      if (Array.isArray(updates)) {
        for (const update of updates) {
          offset = update.update_id + 1;
          handleUpdate(update, { readDb: dbReader, token }).catch(err => {
            console.error('Error handling Telegram update:', err.message);
          });
        }
      }
    } catch (err) {
      if (!running) break;
      console.error('⚠️ Telegram Polling Warning:', err.message);
      // Wait 3 seconds before reconnecting
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// Alias for getBotInfo
const getMe = getBotInfo;

module.exports = {
  escapeHtml,
  getTelegramConfig,
  callTelegramApi,
  getBotInfo,
  getMe,
  sendMessage,
  getMainKeyboard,
  notifyNewContactMessage,
  forwardContactMessage,
  broadcastMessage,
  notifyDatabaseEvent,
  handleUpdate,
  setWebhook,
  deleteWebhook,
  getWebhookInfo,
  startPolling
};
