/**
 * TikTok Alert Web - Node.js + Express Server (ES Modules)
 * Compatible with Railway deployment
 */

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', 'views');

// Upload config
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

// Config file
const configFile = path.join(__dirname, 'config.json');

function loadConfig() {
  const defaultConfig = {
    tiktok_username: "",
    alerts: {
      follow: { enabled: true, sound: "", image: "", text: "{username} followed!", duration: 5, color: "#8B5CF6" },
      gift: { enabled: true, sound: "", image: "", text: "{username} sent {gift_name}!", duration: 5, color: "#10B981" },
      like: { enabled: true, sound: "", image: "", text: "{username} liked ({count}x)!", duration: 3, color: "#EC4899", min_likes: 10 },
      share: { enabled: true, sound: "", image: "", text: "{username} shared!", duration: 4, color: "#3B82F6" }
    },
    overlay: { font_family: "Arial", font_size: 24, text_color: "#FFFFFF", bg_color: "rgba(0,0,0,0.7)", border_radius: "20px", position: "top-right" },
    goal: { enabled: true, title: "Gift Goal", current: 0, target: 1000 }
  };

  if (fs.existsSync(configFile)) {
    try {
      const loaded = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      return { ...defaultConfig, ...loaded };
    } catch (e) {
      console.error('Config load error:', e);
    }
  }
  return defaultConfig;
}

function saveConfig(cfg) {
  fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2));
}

// State
let config = loadConfig();
let currentAlerts = [];
let activityFeed = [];
let activeTikTokConnection = null;

// Dynamic import for tiktok-live-connector (ESM module)
let TikTokLiveConnection = null;

async function getTikTokLibrary() {
  if (!TikTokLiveConnection) {
    try {
      const mod = await import('tiktok-live-connector');
      TikTokLiveConnection = mod.WebcastPushConnection || mod.TikTokLiveConnection || mod.default;
    } catch (e) {
      console.error('Failed to load tiktok-live-connector:', e.message);
    }
  }
  return TikTokLiveConnection;
}

// Routes
app.get('/', (req, res) => res.render('dashboard'));
app.get('/overlay', (req, res) => res.render('overlay'));
app.get('/goal', (req, res) => res.render('goal'));

app.get('/uploads/:filename', (req, res) => {
  const file = path.join(uploadDir, req.params.filename);
  if (fs.existsSync(file)) {
    res.sendFile(file);
  } else {
    res.status(404).send('Not Found');
  }
});

app.get('/api/config', (req, res) => res.json(config));

app.post('/api/config', (req, res) => {
  config = { ...config, ...req.body };
  saveConfig(config);
  io.emit('config_updated', config);
  res.json({ status: 'success' });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'No file uploaded' });
  }
  res.json({
    status: 'success',
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`
  });
});

app.get('/api/alerts', (req, res) => res.json(currentAlerts.slice(-15)));
app.get('/api/feed', (req, res) => res.json(activityFeed.slice(-30)));

app.post('/api/alerts/trigger', (req, res) => {
  const alertData = {
    ...req.body,
    timestamp: new Date().toISOString(),
    id: currentAlerts.length + 1
  };
  currentAlerts.push(alertData);
  activityFeed.push({
    type: alertData.type || 'alert',
    username: alertData.username,
    details: alertData.text || alertData.gift_name,
    time: new Date().toLocaleTimeString()
  });
  
  io.emit('new_alert', alertData);
  io.emit('new_feed', activityFeed[activityFeed.length - 1]);
  res.json({ status: 'success', alert: alertData });
});

app.post('/api/tiktok/connect', async (req, res) => {
  let { username } = req.body;
  if (!username) {
    return res.status(400).json({ status: 'error', message: 'Username required' });
  }

  // Parse URL if provided
  if (username.includes('tiktok.com')) {
    const match = username.match(/@([^/]+)/);
    username = match ? match[1] : null;
    if (!username) {
      return res.status(400).json({ status: 'error', message: 'Invalid TikTok URL' });
    }
  }

  config.tiktok_username = username;
  saveConfig(config);
  
  try {
    await startTikTokReader(username);
    res.json({ status: 'success', username });
  } catch (e) {
    res.json({ status: 'error', message: e.message });
  }
});

// TikTok Live Reader
async function startTikTokReader(username) {
  if (activeTikTokConnection) {
    try { activeTikTokConnection.disconnect(); } catch(e) {}
  }

  const TikTokLib = await getTikTokLibrary();
  if (!TikTokLib) {
    io.emit('connection_status', { status: 'error', message: 'TikTok library not loaded' });
    throw new Error('TikTok library not available');
  }

  const connection = new TikTokLib({ uniqueId: username });

  activeTikTokConnection = connection;

  connection.on('chat', (data) => {
    const item = {
      type: 'comment',
      username: data.uniqueId,
      details: data.comment,
      time: new Date().toLocaleTimeString()
    };
    activityFeed.push(item);
    io.emit('new_feed', item);
  });

  connection.on('gift', (data) => {
    const giftName = data.giftName || data.gift?.name || 'Gift';
    const count = data.repeatCount || data.giftCount || 1;

    const alertData = {
      type: 'gift',
      username: data.uniqueId,
      gift_name: giftName,
      gift_count: count,
      timestamp: new Date().toISOString()
    };
    currentAlerts.push(alertData);

    if (config.goal?.enabled) {
      config.goal.current = (config.goal.current || 0) + count;
      saveConfig(config);
      io.emit('goal_updated', config.goal);
    }

    activityFeed.push({
      type: 'gift',
      username: data.uniqueId,
      details: `Sent ${giftName} x${count}`,
      time: new Date().toLocaleTimeString()
    });
    io.emit('new_alert', alertData);
    io.emit('new_feed', activityFeed[activityFeed.length - 1]);
  });

  connection.on('follow', (data) => {
    const alertData = {
      type: 'follow',
      username: data.uniqueId,
      timestamp: new Date().toISOString()
    };
    currentAlerts.push(alertData);
    activityFeed.push({
      type: 'follow',
      username: data.uniqueId,
      details: 'Followed stream',
      time: new Date().toLocaleTimeString()
    });
    io.emit('new_alert', alertData);
    io.emit('new_feed', activityFeed[activityFeed.length - 1]);
  });

  connection.on('like', (data) => {
    const count = data.likeCount || 1;
    const minLikes = config.alerts?.like?.min_likes || 10;
    
    if (count >= minLikes) {
      io.emit('new_alert', {
        type: 'like',
        username: data.uniqueId,
        count: count,
        timestamp: new Date().toISOString()
      });
    }
    activityFeed.push({
      type: 'like',
      username: data.uniqueId,
      details: `Liked x${count}`,
      time: new Date().toLocaleTimeString()
    });
    io.emit('new_feed', activityFeed[activityFeed.length - 1]);
  });

  connection.on('share', (data) => {
    const alertData = {
      type: 'share',
      username: data.uniqueId,
      timestamp: new Date().toISOString()
    };
    currentAlerts.push(alertData);
    activityFeed.push({
      type: 'share',
      username: data.uniqueId,
      details: 'Shared live stream',
      time: new Date().toLocaleTimeString()
    });
    io.emit('new_alert', alertData);
    io.emit('new_feed', activityFeed[activityFeed.length - 1]);
  });

  try {
    await connection.connect();
    io.emit('connection_status', { status: 'connected', username });
    console.log(`✅ Connected to @${username}`);
  } catch (err) {
    io.emit('connection_status', { status: 'error', message: err.message });
    console.error('Connection error:', err.message);
    throw err;
  }
}

// Socket.IO
io.on('connection', (socket) => {
  socket.emit('connected', { status: 'connected' });
});

// Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 TikTok Alert Server running on http://localhost:${PORT}`);
});
