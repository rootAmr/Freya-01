const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const axios = require('axios');
require('dotenv').config();

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://api-freya-default-rtdb.firebaseio.com'
});

const db = admin.database();

const client = new Client({
  authStrategy: new LocalAuth()
});

let isReady = false;

client.on('qr', async (qr) => {
  try {
    const qrBase64 = await QRCode.toDataURL(qr);

    await db.ref('whatsapp/qr_code').set({
      qr: qrBase64,
      timestamp: new Date().toISOString()
    });

    console.log('📡 QR code berhasil dikirim ke Firebase.');
  } catch (err) {
    console.error('❌ Gagal memproses QR code:', err.message);
  }
});

client.on('ready', () => {
  console.log('✅ Bot siap dan login otomatis.');
  isReady = true;
});

setInterval(() => {
  if (isReady) console.log('PING');
}, 120000);

client.on('message', async msg => {
  if (!isReady) {
    console.log('⏳ Bot belum siap, abaikan pesan masuk.');
    return;
  }

  console.log(`📩 Pesan dari ${msg.from}: ${msg.body}`);

  try {
    if (!msg.body || typeof msg.body !== 'string' || msg.body.trim() === '') {
      console.warn('⚠️ Pesan kosong atau tidak valid.');
      return;
    }

    const response = await axios.post(process.env.API_CHAT_URL, {
      message: msg.body
    });

    const reply = response.data.response;
    if (!reply || typeof reply !== "string" || reply.trim() === '') {
      throw new Error("Response dari API kosong atau tidak valid");
    }

    await client.sendMessage(msg.from, reply);

  } catch (error) {
    console.error('❌ Error saat proses pesan:', error.message);

    try {
      await client.sendMessage(msg.from, 'Maaf, saya sedang mengalami masalah. Silakan coba lagi nanti.');
    } catch (sendError) {
      console.error('❌ Gagal mengirim pesan error:', sendError.message);
    }
  }
});

client.initialize();
