/**
 * KHAYABEATS Desktop App - Electron Main Process
 * 
 * This file handles the main Electron process for the Windows desktop app.
 * Run with: npm run electron:dev (development) or npm run electron:build (production)
 */

const { app, BrowserWindow, Menu, Tray, shell, ipcMain, globalShortcut, nativeTheme } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// App configuration
const APP_CONFIG = {
  name: 'KHAYABEATS',
  width: 1200,
  height: 800,
  minWidth: 400,
  minHeight: 600,
  icon: path.join(__dirname, '../public/app-icon.png'),
};

// Development or production URL
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const LOAD_URL = isDev 
  ? 'http://localhost:5173'
  : 'https://6abb415d-48b6-4355-8a5d-3186a7daeb44.lovableproject.com';

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: APP_CONFIG.width,
    height: APP_CONFIG.height,
    minWidth: APP_CONFIG.minWidth,
    minHeight: APP_CONFIG.minHeight,
    icon: APP_CONFIG.icon,
    title: APP_CONFIG.name,
    backgroundColor: '#1a1a2e',
    frame: true, // Native window frame
    titleBarStyle: 'hiddenInset', // macOS style
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // Don't show until ready
  });

  // Remove menu bar (optional - comment out if you want menu)
  Menu.setApplicationMenu(null);

  // Load the app
  console.log(`Loading: ${LOAD_URL}`);
  mainWindow.loadURL(LOAD_URL);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Focus window
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });

  // Handle external links - open in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function createTray() {
  // Create system tray icon
  tray = new Tray(APP_CONFIG.icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open KHAYABEATS',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Play/Pause',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.executeJavaScript('window.khayabeats?.togglePlay?.()');
        }
      },
    },
    {
      label: 'Next Track',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.executeJavaScript('window.khayabeats?.next?.()');
        }
      },
    },
    {
      label: 'Previous Track',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.executeJavaScript('window.khayabeats?.previous?.()');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('KHAYABEATS');
  tray.setContextMenu(contextMenu);

  // Double-click tray icon to show window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function registerShortcuts() {
  // Global media key shortcuts
  globalShortcut.register('MediaPlayPause', () => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript('window.khayabeats?.togglePlay?.()');
    }
  });

  globalShortcut.register('MediaNextTrack', () => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript('window.khayabeats?.next?.()');
    }
  });

  globalShortcut.register('MediaPreviousTrack', () => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript('window.khayabeats?.previous?.()');
    }
  });

  globalShortcut.register('MediaStop', () => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript('window.khayabeats?.pause?.()');
    }
  });
}

// App ready
app.whenReady().then(() => {
  // Force dark mode
  nativeTheme.themeSource = 'dark';
  
  createWindow();
  createTray();
  registerShortcuts();

  // macOS: re-create window when dock icon clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Handle all windows closed
app.on('window-all-closed', () => {
  // On macOS, keep app running in background
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle before quit
app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});

// Handle activate (macOS dock click)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('app:minimize', () => mainWindow?.minimize());
ipcMain.handle('app:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('app:close', () => mainWindow?.close());
ipcMain.handle('app:getVersion', () => app.getVersion());
