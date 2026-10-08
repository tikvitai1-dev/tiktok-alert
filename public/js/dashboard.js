const socket = io();

// UI Elements
const els = {
    username: document.getElementById('tiktok-username'),
    status: document.getElementById('connection-status'),
    overlayOpacity: document.getElementById('overlay-opacity'),
    opacityValue: document.getElementById('opacity-value'),
    recentAlerts: document.getElementById('recent-alerts')
};

// Track uploaded files
const uploadedFiles = {
    followSound: '',
    followImage: '',
    giftSound: '',
    giftImage: ''
};

// Update opacity label
els.overlayOpacity.addEventListener('input', (e) => {
    els.opacityValue.textContent = e.target.value;
});

// File upload handlers
document.getElementById('follow-sound').addEventListener('change', (e) => uploadFile(e.target.files[0], 'followSound'));
document.getElementById('follow-image').addEventListener('change', (e) => uploadFile(e.target.files[0], 'followImage'));
document.getElementById('gift-sound').addEventListener('change', (e) => uploadFile(e.target.files[0], 'giftSound'));
document.getElementById('gift-image').addEventListener('change', (e) => uploadFile(e.target.files[0], 'giftImage'));

function uploadFile(file, key) {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    fetch('/api/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            uploadedFiles[key] = data.url;
            console.log(`Uploaded ${key}:`, data.url);
        } else {
            alert('Upload failed: ' + data.message);
        }
    })
    .catch(err => {
        alert('Upload error: ' + err);
    });
}

// Load initial config
fetch('/api/config')
    .then(res => res.json())
    .then(config => {
        els.username.value = config.tiktok_username || '';
        
        // Follow settings
        document.getElementById('follow-enabled').checked = config.alerts.follow.enabled;
        document.getElementById('follow-text').value = config.alerts.follow.text;
        document.getElementById('follow-color').value = config.alerts.follow.color;
        document.getElementById('follow-duration').value = config.alerts.follow.duration;
        uploadedFiles.followSound = config.alerts.follow.sound || '';
        uploadedFiles.followImage = config.alerts.follow.image || '';
        
        // Gift settings
        document.getElementById('gift-enabled').checked = config.alerts.gift.enabled;
        document.getElementById('gift-text').value = config.alerts.gift.text;
        document.getElementById('gift-color').value = config.alerts.gift.color;
        document.getElementById('gift-duration').value = config.alerts.gift.duration;
        uploadedFiles.giftSound = config.alerts.gift.sound || '';
        uploadedFiles.giftImage = config.alerts.gift.image || '';
        
        // Overlay settings
        document.getElementById('overlay-font').value = config.overlay.font_family;
        document.getElementById('overlay-fontsize').value = config.overlay.font_size;
        document.getElementById('overlay-textcolor').value = config.overlay.text_color;
        document.getElementById('overlay-position').value = config.overlay.position;
        
        // Parse rgba background
        const match = config.overlay.bg_color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            document.getElementById('overlay-bgcolor').value = rgbToHex(match[1], match[2], match[3]);
            if (match[4]) {
                const alpha = Math.round(parseFloat(match[4]) * 100);
                els.overlayOpacity.value = alpha;
                els.opacityValue.textContent = alpha;
            }
        }
    });

// Socket Events
socket.on('connected', () => {
    console.log('Connected to server');
});

socket.on('new_alert', (alert) => {
    addAlertToList(alert);
});

socket.on('tiktok_error', (data) => {
    els.status.textContent = 'Error: ' + data.message;
    els.status.className = 'status error';
});

// Functions
function connectTikTok() {
    const username = els.username.value.trim();
    if (!username) return;
    
    els.status.textContent = 'Connecting...';
    els.status.className = 'status';
    
    fetch('/api/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            els.status.textContent = `Connected to @${data.username}`;
            els.status.className = 'status connected';
        } else {
            els.status.textContent = data.message;
            els.status.className = 'status error';
        }
    });
}

function saveSettings() {
    const hex = document.getElementById('overlay-bgcolor').value;
    const alpha = parseInt(els.overlayOpacity.value) / 100;
    const rgba = hexToRgba(hex, alpha);

    const config = {
        alerts: {
            follow: {
                enabled: document.getElementById('follow-enabled').checked,
                text: document.getElementById('follow-text').value,
                color: document.getElementById('follow-color').value,
                duration: parseInt(document.getElementById('follow-duration').value),
                sound: uploadedFiles.followSound,
                image: uploadedFiles.followImage
            },
            gift: {
                enabled: document.getElementById('gift-enabled').checked,
                text: document.getElementById('gift-text').value,
                color: document.getElementById('gift-color').value,
                duration: parseInt(document.getElementById('gift-duration').value),
                sound: uploadedFiles.giftSound,
                image: uploadedFiles.giftImage
            }
        },
        overlay: {
            font_family: document.getElementById('overlay-font').value,
            font_size: parseInt(document.getElementById('overlay-fontsize').value),
            text_color: document.getElementById('overlay-textcolor').value,
            bg_color: rgba,
            position: document.getElementById('overlay-position').value
        }
    };

    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    }).then(() => alert('Settings saved successfully!'));
}

function testAlert(type) {
    const data = {
        type: type,
        username: 'TestUser123',
    };
    
    if (type === 'gift') {
        data.gift_name = 'Rose';
        data.gift_count = 5;
    }
    
    fetch('/api/alerts/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

function copyOverlayURL() {
    const url = document.getElementById('overlay-url').textContent;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.querySelector('.btn-copy');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });
}

function addAlertToList(alert) {
    if (els.recentAlerts.querySelector('.text-muted')) {
        els.recentAlerts.innerHTML = '';
    }
    
    const div = document.createElement('div');
    div.className = 'alert-item';
    
    const time = new Date(alert.timestamp).toLocaleTimeString();
    
    if (alert.type === 'follow') {
        div.innerHTML = `
            <div>
                <span class="type follow">Follow</span>
                <span><b>${alert.username}</b> followed</span>
            </div>
            <small>${time}</small>
        `;
    } else if (alert.type === 'gift') {
        div.innerHTML = `
            <div>
                <span class="type gift">Gift</span>
                <span><b>${alert.username}</b> sent ${alert.gift_name} x${alert.gift_count}</span>
            </div>
            <small>${time}</small>
        `;
    }
    
    els.recentAlerts.prepend(div);
    if (els.recentAlerts.children.length > 10) {
        els.recentAlerts.lastChild.remove();
    }
}

// Helpers
function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
