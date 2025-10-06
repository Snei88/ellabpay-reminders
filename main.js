const { app, BrowserWindow, Tray, Menu, Notification, powerMonitor, ipcMain } = require('electron');
const path = require('path');

let store;
let Store;

// Cargar electron-store de forma asíncrona
async function initStore() {
  Store = (await import('electron-store')).default;
  store = new Store({ name: 'ellabpay' });
}

// Para toasts en Windows
app.setAppUserModelId('com.tulab.ellabpay');

let mainWindow = null;
let tray = null;

function createWindow(show = true) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show,
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  mainWindow.loadFile(path.join(__dirname, 'pages', 'index.html'));

  // Cerrar → ocultar a bandeja (no matar proceso)
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const { nativeImage } = require('electron');
  
  // Usar logo.png y redimensionarlo para el tray
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  let trayIcon;
  
  try {
    const image = nativeImage.createFromPath(logoPath);
    // Redimensionar a 16x16 para tray (tamaño estándar)
    trayIcon = image.resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
  } catch (e) {
    console.log('No se pudo cargar logo, usando ícono vacío');
    tray = new Tray(nativeImage.createEmpty());
  }
  
  const menu = Menu.buildFromTemplate([
    { 
      label: 'Abrir ElLabPay', 
      click: () => { 
        if (mainWindow) {
          mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      } 
    },
    { type: 'separator' },
    { 
      label: 'Salir', 
      click: () => { 
        app.isQuiting = true;
        app.quit();
      } 
    },
  ]);
  
  tray.setToolTip('ElLabPay - Recordatorios de Pagos');
  tray.setContextMenu(menu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function showToast({ title, body, id }) {
  const n = new Notification({ 
    title, 
    body, 
    silent: false,
    urgency: 'normal'
  });
  
  n.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('notification:clicked', { id });
    }
  });
  
  try {
    n.show();
  } catch (err) {
    console.error('Error mostrando notificación:', err);
    if (mainWindow) {
      mainWindow.webContents.send('notification:fallback', { id, title, body });
    }
  }
}

// Scheduler: lee recordatorios y dispara los que tocan
function runSchedulerTick() {
  const reminders = store.get('reminders', {});
  const now = Date.now();

  // Catch-up: notificar los "perdidos" si la máquina estuvo dormida
  const lastRun = store.get('lastRunTs', 0);
  const windowMs = 5 * 60 * 1000; // margen de 5 min
  const from = Math.max(now - windowMs, lastRun || (now - windowMs));

  let changed = false;

  Object.values(reminders).forEach(r => {
    if (!r || !r.reminderTime) return;
    
    const t = Date.parse(r.reminderTime);
    if (!t || isNaN(t)) return;

    // Notificar si cae entre "from" y "ahora" y no ha sido disparado
    if (t > from && t <= now && !r.fired) {
      showToast({ 
        title: r.title || 'Recordatorio', 
        body: r.description || '',
        id: r.id
      });
      r.fired = true;
      changed = true;
    }
  });

  store.set('lastRunTs', now);
  if (changed) {
    store.set('reminders', reminders);
  }
}

// Migración de datos antiguos (fs → electron-store)
function migrateOldData() {
  const fs = require('fs');
  const oldPath = path.join(app.getPath('userData'), 'ellabpay_data.json');
  
  try {
    if (fs.existsSync(oldPath)) {
      const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
      if (oldData.reminders && Object.keys(oldData.reminders).length > 0) {
        const existing = store.get('reminders', {});
        if (Object.keys(existing).length === 0) {
          console.log('Migrando datos antiguos a electron-store...');
          store.set('reminders', oldData.reminders);
        }
      }
      // Renombrar archivo antiguo para no volver a migrar
      fs.renameSync(oldPath, oldPath + '.migrated');
    }
  } catch (e) {
    console.log('No hay datos antiguos para migrar o error:', e.message);
  }
}

// IPC Handlers (compatibilidad con UI existente)
ipcMain.handle('reminders:getAll', () => {
  return store.get('reminders', {});
});

ipcMain.handle('reminders:save', (e, reminder) => {
  if (!reminder || !reminder.id || !reminder.reminderTime) return false;
  
  const reminders = store.get('reminders', {});
  reminders[reminder.id] = {
    ...reminder,
    fired: false // resetear flag al guardar
  };
  store.set('reminders', reminders);
  
  return true;
});

ipcMain.handle('reminders:delete', (e, id) => {
  if (!id) return false;
  
  const reminders = store.get('reminders', {});
  if (reminders[id]) {
    delete reminders[id];
    store.set('reminders', reminders);
  }
  
  return true;
});

// Arranque como "agente" (sin ventana) si viene --background
const startHidden = process.argv.includes('--background');

app.whenReady().then(async () => {
  // Inicializar store primero
  await initStore();
  
  // Migrar datos antiguos si existen
  migrateOldData();
  
  createWindow(!startHidden);
  createTray();

  // Arranque automático al inicio de sesión (usuario actual)
  app.setLoginItemSettings({ 
    openAtLogin: true, 
    args: ['--background'] 
  });

  // Scheduler "siempre vivo" en main
  runSchedulerTick();
  setInterval(runSchedulerTick, 60 * 1000); // cada minuto
  
  // Ejecutar al despertar del sistema
  powerMonitor.on('resume', () => {
    console.log('Sistema despertó, ejecutando scheduler...');
    runSchedulerTick();
  });
});

app.on('window-all-closed', () => {
  // No cerrar en macOS al cerrar ventana
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
});
