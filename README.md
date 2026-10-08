# TikTok Alert Web - Node.js Version

Aplikasi web untuk alert TikTok Live dengan fitur:
- Alert Follow, Gift, Like, Share
- Widget Goal Live
- Live Feed Aktivitas Penonton
- Overlay untuk OBS Browser Source
- Real-time via WebSocket

## Tech Stack
- Node.js + Express.js
- Socket.IO (WebSocket)
- TikTok Live Connector
- Compatible with Google Cloud Platform

## Install Lokal

```bash
cd TikTokAlertWebNode
npm install
npm start
```

Akses:
- Dashboard: http://localhost:3000
- Overlay: http://localhost:3000/overlay
- Goal Widget: http://localhost:3000/goal

## Deploy ke Google Cloud Platform

### Opsi 1: Google Cloud Run (Recommended)

1. **Install Google Cloud CLI**
   ```bash
   # Download dari: https://cloud.google.com/sdk/docs/install
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Deploy ke Cloud Run**
   ```bash
   cd TikTokAlertWebNode
   gcloud run deploy --source .
   ```

3. **Enable WebSocket**
   - Cloud Run mendukung WebSocket secara default
   - Pastikan tidak ada timeout singkat di setting

### Opsi 2: Google App Engine

1. **Edit app.yaml** sesuai kebutuhan
2. **Deploy**
   ```bash
   gcloud app deploy
   ```

### Opsi 3: Google Compute Engine (VM)

1. **Create VM Instance**
   ```bash
   gcloud compute instances create tiktok-alert-server \
     --image-family=ubuntu-2204-lts \
     --image-project=ubuntu-os-cloud \
     --machine-type=e2-micro \
     --tags=http-server,https-server
   ```

2. **SSH ke VM dan install**
   ```bash
   gcloud compute ssh tiktok-alert-server
   sudo apt update
   sudo apt install -y nodejs npm
   git clone YOUR_REPO_URL
   cd TikTokAlertWebNode
   npm install
   npm start
   ```

3. **Buka port 3000**
   ```bash
   gcloud compute firewall-rules create allow-3000 \
     --allow tcp:3000 \
     --target-tags=http-server
   ```

## Environment Variables

Buat file `.env`:
```
PORT=3000
NODE_ENV=production
```

## Struktur Folder

```
TikTokAlertWebNode/
├── server.js          # Main Express server
├── package.json       # Node dependencies
├── Dockerfile         # Docker config for Cloud Run
├── app.yaml           # App Engine config
├── .env.example       # Env template
├── public/            # Static files
│   ├── css/
│   └── js/
├── views/             # EJS templates
│   ├── dashboard.ejs
│   ├── overlay.ejs
│   └── goal.ejs
└── uploads/           # User uploaded media
```

## Integrasi OBS

### Overlay Alert
1. OBS → Add Source → Browser
2. URL: `https://your-app-url/overlay`
3. Width: 1920, Height: 1080

### Widget Goal
1. OBS → Add Source → Browser
2. URL: `https://your-app-url/goal`
3. Width: 400, Height: 120

## Troubleshooting

### TikTok connection error
- Pastikan username benar
- User harus sedang live
- TikTok API bisa rate limited

### WebSocket tidak connect
- Pastikan firewall allow WebSocket
- Check console browser untuk error

### Upload file gagal
- Check folder `uploads/` permission
- Max file size: 50MB

## License

MIT
"# tiktok-alert" 
