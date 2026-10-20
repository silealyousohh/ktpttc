#!/usr/bin/env node
/**
 * Standalone Telegram Bot Polling Runner for KTPTTC
 * Run locally or on VPS: node bot-polling.js or npm run bot
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const telegram = require('./telegram');

const DB_FILE = path.join(__dirname, 'data', 'db.json');
let cachedDb = null;
let cachedClient = null;

// Read MongoDB or fallback local db.json
async function readDb() {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      if (!cachedClient) {
        cachedClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await cachedClient.connect();
      }
      cachedDb = cachedClient.db('ktpttc');
      const doc = await cachedDb.collection('ktpttc_data').findOne({ _id: 'main_store' });
      if (doc) {
        const { _id, ...clean } = doc;
        return clean;
      }
    } catch (e) {
      // fallback to file
    }
  }

  // Fallback to local file
  const paths = [
    DB_FILE,
    path.join(__dirname, 'db.json'),
    path.join(__dirname, 'data', 'db.json')
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch (_) {}
    }
  }
  return {};
}

async function main() {
  console.log('====================================================');
  console.log('🤖 KTPTTC Telegram Bot Runner');
  console.log('====================================================');

  const config = telegram.getTelegramConfig();
  if (!config.token) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN is not set.');
    console.log('Please add TELEGRAM_BOT_TOKEN to your .env file or configure it in the Admin Settings.');
    console.log('Example: TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz');
    process.exit(1);
  }

  try {
    await telegram.startPolling(readDb, config.token);
  } catch (err) {
    console.error('❌ Fatal error running bot:', err.message);
    process.exit(1);
  }
}

main();
