const socket = io();

let currentConfig = {};

fetch('/api/config')
    .then(res => res.json())
    .then(config => {
        currentConfig = config;
        applyConfig(config);
    });

socket.on('config_updated', (config) => {
    currentConfig = config;
    applyConfig(config);
});

socket.on('new_alert', (alert) => {
    showAlert(alert);
});

socket.on('connected', () => {
    console.log('Connected to alert server');
});

function applyConfig(config) {
    const container = document.getElementById('alert-container');
    const alertBox = document.getElementById('alert-box');
    
    container.className = `alert-container ${config.overlay.position || 'top-right'}`;
    
    alertBox.style.fontFamily = config.overlay.font_family || 'Arial';
    alertBox.style.fontSize = `${config.overlay.font_size || 24}px`;
    alertBox.style.color = config.overlay.text_color || '#FFFFFF';
    alertBox.style.backgroundColor = config.overlay.bg_color || 'rgba(0,0,0,0.7)';
    alertBox.style.borderRadius = config.overlay.border_radius || '20px';
    
    const base = config.overlay.font_size || 24;
    document.getElementById('alert-username').style.fontSize = `${base * 1.5}px`;
    document.getElementById('alert-message').style.fontSize = `${base}px`;
    document.getElementById('alert-gift').style.fontSize = `${base * 0.9}px`;
}

function showAlert(alert) {
    const type = alert.type;
    const settings = currentConfig.alerts[type];
    
    if (!settings || !settings.enabled) return;
    
    const container = document.getElementById('alert-container');
    const alertBox = document.getElementById('alert-box');
    const alertImage = document.getElementById('alert-image');
    const alertUsername = document.getElementById('alert-username');
    const alertMessage = document.getElementById('alert-message');
    const alertGift = document.getElementById('alert-gift');
    const alertSound = document.getElementById('alert-sound');
    
    alertBox.style.borderLeft = `6px solid ${settings.color || '#FFFFFF'}`;
    alertBox.style.boxShadow = `0 10px 25px ${settings.color || '#FFFFFF'}40`;
    
    if (settings.image) {
        alertImage.src = settings.image;
        alertImage.classList.add('visible');
        alertImage.onerror = () => alertImage.classList.remove('visible');
    } else {
        alertImage.classList.remove('visible');
    }
    
    alertUsername.textContent = alert.username || 'User';
    let message = settings.text || '{username} alert!';
    message = message.replace('{username}', alert.username || 'User');
    message = message.replace('{count}', alert.count || 1);
    message = message.replace('{gift_name}', alert.gift_name || 'Gift');
    alertMessage.textContent = message;
    
    if (type === 'gift') {
        alertGift.textContent = `x${alert.gift_count || 1}`;
        alertGift.classList.add('visible');
    } else {
        alertGift.classList.remove('visible');
    }
    
    if (settings.sound) {
        alertSound.src = settings.sound;
        alertSound.play().catch(e => console.log('Audio failed:', e));
    }
    
    // Apply animation based on settings
    container.classList.remove('show', 'bounce', 'slide', 'zoom', 'fade');
    void container.offsetWidth;
    container.classList.add('show');
    container.classList.add(settings.animation || 'bounce');
    
    const duration = (settings.duration || 5) * 1000;
    setTimeout(() => {
        container.classList.remove('show');
    }, duration);
}
