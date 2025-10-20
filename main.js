const { app, BrowserWindow, BrowserView, ipcMain, dialog, Menu } = require('electron');

// Globally remove application menu
Menu.setApplicationMenu(null);
const path = require('path');
const fs = require('fs');
const https = require('https');

let mainWindow;
let settingsWindow;
let browserViews = new Map(); // Map of tabId -> BrowserView
let activeTabId = null;

// Home page URL
const HOME_PAGE = 'https://northy2410.github.io/NexaSearch';

// Settings file path in %appdata%
const SETTINGS_DIR = path.join(app.getPath('appData'), 'NexaBrowser');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

// Ensure settings directory exists
function ensureSettingsDir() {
  if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

// Load settings from %appdata%
function loadSettings() {
  ensureSettingsDir();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return { theme: 'system', searchEngine: 'nexasearch' }; // Default settings
}

// Save settings to %appdata%
function saveSettings(settings) {
  ensureSettingsDir();
  try {
    const currentSettings = loadSettings();
    const newSettings = { ...currentSettings, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf8');
    return newSettings;
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

function getHomePageFor(engine) {
  switch ((engine || 'nexasearch').toLowerCase()) {
    case 'google':
      return 'https://www.google.com/';
    case 'bing':
      return 'https://www.bing.com/';
    case 'yahoo':
      return 'https://search.yahoo.com/';
    case 'duckduckgo':
      return 'https://duckduckgo.com/';
    case 'nexasearch':
    default:
      return 'https://northy2410.github.io/NexaSearch';
  }
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 700,
    minHeight: 500,
    resizable: true,
    parent: mainWindow,
    modal: false,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    title: 'Settings - NexaBrowser'
  });

  // Remove native menu bar for Settings window
  settingsWindow.removeMenu();

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function getBrowserViewBounds() {
  const bounds = mainWindow.getContentBounds();
  return {
    x: 0,
    y: 102, // Space for tab bar (42px) + navigation bar (60px)
    width: bounds.width,
    height: bounds.height - 102
  };
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    },
    frame: true,
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    title: 'NexaBrowser'
  });

  // Remove native menu bar for Main window
  mainWindow.removeMenu();

  // Load the browser UI
  mainWindow.loadFile('index.html');

  // Handle window resize
  mainWindow.on('resize', () => {
    if (activeTabId !== null && browserViews.has(activeTabId)) {
      const view = browserViews.get(activeTabId);
      view.setBounds(getBrowserViewBounds());
    }
  });
}

// Tab management IPC handlers
ipcMain.on('create-tab', (event, { id, url }) => {
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  browserViews.set(id, view);
  
  // Set up event listeners for this view
  view.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('tab-loading-start', id);
  });

  view.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('tab-loading-stop', id);
    mainWindow.webContents.send('tab-url-change', { id, url: view.webContents.getURL() });
    mainWindow.webContents.send('tab-title-change', { id, title: view.webContents.getTitle() });
  });

  view.webContents.on('did-navigate', (event, url) => {
    mainWindow.webContents.send('tab-url-change', { id, url });
  });

  view.webContents.on('did-navigate-in-page', (event, url) => {
    mainWindow.webContents.send('tab-url-change', { id, url });
  });

  view.webContents.on('page-title-updated', (event, title) => {
    mainWindow.webContents.send('tab-title-change', { id, title });
  });

  // Handle new windows
  view.webContents.setWindowOpenHandler(({ url }) => {
    view.webContents.loadURL(url);
    return { action: 'deny' };
  });

  // Load URL
  view.webContents.loadURL(url);
});

ipcMain.on('switch-tab', (event, tabId) => {
  // Remove current view
  if (activeTabId !== null && browserViews.has(activeTabId)) {
    mainWindow.removeBrowserView(browserViews.get(activeTabId));
  }

  // Add new view
  if (browserViews.has(tabId)) {
    const view = browserViews.get(tabId);
    mainWindow.setBrowserView(view);
    view.setBounds(getBrowserViewBounds());
    activeTabId = tabId;
  }
});

ipcMain.on('close-tab', (event, tabId) => {
  if (browserViews.has(tabId)) {
    const view = browserViews.get(tabId);
    
    // Remove from window if active
    if (activeTabId === tabId) {
      mainWindow.removeBrowserView(view);
      activeTabId = null;
    }
    
    // Destroy the view
    view.webContents.destroy();
    browserViews.delete(tabId);
  }
});

ipcMain.on('navigate-tab', (event, { id, url }) => {
  if (browserViews.has(id)) {
    browserViews.get(id).webContents.loadURL(url);
  }
});

ipcMain.on('go-back', (event, tabId) => {
  if (browserViews.has(tabId)) {
    const view = browserViews.get(tabId);
    if (view.webContents.canGoBack()) {
      view.webContents.goBack();
    }
  }
});

ipcMain.on('go-forward', (event, tabId) => {
  if (browserViews.has(tabId)) {
    const view = browserViews.get(tabId);
    if (view.webContents.canGoForward()) {
      view.webContents.goForward();
    }
  }
});

ipcMain.on('reload', (event, tabId) => {
  if (browserViews.has(tabId)) {
    browserViews.get(tabId).webContents.reload();
  }
});

ipcMain.on('go-home', (event, tabId) => {
  if (browserViews.has(tabId)) {
    const settings = loadSettings();
    const homepage = getHomePageFor(settings.searchEngine);
    browserViews.get(tabId).webContents.loadURL(homepage);
  }
});

ipcMain.on('stop-loading', (event, tabId) => {
  if (browserViews.has(tabId)) {
    browserViews.get(tabId).webContents.stop();
  }
});

// Settings IPC handlers
ipcMain.on('show-settings', () => {
  createSettingsWindow();
});

ipcMain.on('load-settings', (event) => {
  const settings = loadSettings();
  event.reply('settings-loaded', settings);
});

ipcMain.on('save-settings', (event, settings) => {
  saveSettings(settings);
});

ipcMain.handle('get-settings', async () => {
  return loadSettings();
});

ipcMain.on('theme-changed', (event, theme) => {
  // Broadcast theme change to all windows
  if (mainWindow) {
    mainWindow.webContents.send('apply-theme', theme);
  }
  if (settingsWindow) {
    settingsWindow.webContents.send('apply-theme', theme);
  }
});

// Update checker
ipcMain.handle('check-updates', async () => {
  const currentVersion = '1.0.0';
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/Northy2410/NexaBrowser/releases/latest',
      headers: {
        'User-Agent': 'NexaBrowser'
      }
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 404) {
            resolve({
              error: 'No releases found. Check your GitHub repository settings.',
              currentVersion
            });
            return;
          }

          const release = JSON.parse(data);
          const latestVersion = release.tag_name.replace('v', '');
          
          resolve({
            currentVersion,
            latestVersion,
            updateAvailable: latestVersion !== currentVersion,
            downloadUrl: release.html_url
          });
        } catch (error) {
          resolve({
            error: error.message,
            currentVersion
          });
        }
      });
    }).on('error', (error) => {
      resolve({
        error: 'Unable to check for updates. Please check your internet connection.',
        currentVersion
      });
    });
  });
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
