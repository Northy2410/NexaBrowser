const { ipcRenderer } = require('electron');

// Tab management
let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;
let currentSearchEngine = 'nexasearch';
let startupBehavior = 'homepage'; // 'homepage' | 'blank'

// DOM elements
const tabsContainer = document.getElementById('tabs-container');
const newTabBtn = document.getElementById('new-tab-btn');
const addressBar = document.getElementById('address-bar');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const homeBtn = document.getElementById('home-btn');
const goBtn = document.getElementById('go-btn');
const settingsBtn = document.getElementById('settings-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const securityIcon = document.getElementById('security-icon');

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

// Create a new tab
function createTab(url = null) {
  const tabId = tabIdCounter++;
  const tab = {
    id: tabId,
    title: 'New Tab',
    url: url || getHomePageFor(currentSearchEngine),
    favicon: null
  };
  
  tabs.push(tab);
  
  // Create tab element
  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.dataset.tabId = tabId;
  
  tabEl.innerHTML = `
    <div class="tab-favicon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20"/>
      </svg>
    </div>
    <div class="tab-title">New Tab</div>
    <div class="tab-close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </div>
  `;
  
  // Tab click handler
  tabEl.addEventListener('click', (e) => {
    if (!e.target.closest('.tab-close')) {
      switchTab(tabId);
    }
  });
  
  // Close button handler
  tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });
  
  tabsContainer.appendChild(tabEl);
  
  // Tell main process to create BrowserView
  ipcRenderer.send('create-tab', { id: tabId, url: tab.url });
  
  // Switch to new tab
  switchTab(tabId);
  
  return tab;
}

// Switch to a tab
function switchTab(tabId) {
  if (activeTabId === tabId) return;
  
  activeTabId = tabId;
  
  // Update UI
  document.querySelectorAll('.tab').forEach(el => {
    if (parseInt(el.dataset.tabId) === tabId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
  
  // Tell main process to switch view
  ipcRenderer.send('switch-tab', tabId);
  
  // Update address bar
  const tab = tabs.find(t => t.id === tabId);
  if (tab) {
    addressBar.value = tab.url;
    document.title = tab.title || 'NexaBrowser';
  }
}

// Close a tab
function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;
  
  // Remove from array
  tabs.splice(index, 1);
  
  // Remove from DOM
  const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (tabEl) tabEl.remove();
  
  // Tell main process to close view
  ipcRenderer.send('close-tab', tabId);
  
  // If this was the active tab, switch to another
  if (activeTabId === tabId) {
    if (tabs.length > 0) {
      const newTab = tabs[Math.max(0, index - 1)];
      switchTab(newTab.id);
    } else {
      // No tabs left, create a new one
      createTab();
    }
  }
}

// Update tab info
function updateTab(tabId, info) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  
  if (info.title !== undefined) tab.title = info.title;
  if (info.url !== undefined) tab.url = info.url;
  if (info.favicon !== undefined) tab.favicon = info.favicon;
  
  const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
  if (!tabEl) return;
  
  if (info.title !== undefined) {
    const titleEl = tabEl.querySelector('.tab-title');
    titleEl.textContent = info.title || 'New Tab';
  }
  
  // Update address bar if this is the active tab
  if (tabId === activeTabId) {
    if (info.url !== undefined) {
      addressBar.value = info.url;
    }
    if (info.title !== undefined) {
      document.title = info.title || 'NexaBrowser';
    }
  }
}

// Navigation functions
function navigate(url) {
  if (!url) return;
  
  // Check if it's a search query or URL
  if (!url.match(/^https?:\/\//i) && !url.match(/^[\w-]+\./)) {
    // It's a search query - use search engine
    ipcRenderer.send('load-settings');
    ipcRenderer.once('settings-loaded', (event, settings) => {
      const searchEngine = settings.searchEngine || 'nexasearch';
      const searchUrl = getSearchUrl(searchEngine, url);
      ipcRenderer.send('navigate-tab', { id: activeTabId, url: searchUrl });
    });
  } else {
    // It's a URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    ipcRenderer.send('navigate-tab', { id: activeTabId, url });
  }
}

function getSearchUrl(engine, query) {
  const encodedQuery = encodeURIComponent(query);
  const engines = {
    nexasearch: `https://northy2410.github.io/NexaSearch?q=${encodedQuery}`,
    google: `https://www.google.com/search?q=${encodedQuery}`,
    bing: `https://www.bing.com/search?q=${encodedQuery}`,
    yahoo: `https://search.yahoo.com/search?p=${encodedQuery}`,
    duckduckgo: `https://duckduckgo.com/?q=${encodedQuery}`
  };
  return engines[engine] || engines.nexasearch;
}

// Event listeners
newTabBtn.addEventListener('click', () => createTab());

backBtn.addEventListener('click', () => {
  ipcRenderer.send('go-back', activeTabId);
});

forwardBtn.addEventListener('click', () => {
  ipcRenderer.send('go-forward', activeTabId);
});

reloadBtn.addEventListener('click', () => {
  ipcRenderer.send('reload', activeTabId);
});

homeBtn.addEventListener('click', () => {
  ipcRenderer.send('go-home', activeTabId);
});

settingsBtn.addEventListener('click', () => {
  ipcRenderer.send('show-settings');
});

goBtn.addEventListener('click', () => {
  navigate(addressBar.value);
});

addressBar.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigate(addressBar.value);
  }
});

addressBar.addEventListener('focus', () => {
  addressBar.select();
});

// IPC listeners
ipcRenderer.on('tab-url-change', (event, { id, url }) => {
  updateTab(id, { url });
  
  // Update security icon for active tab
  if (id === activeTabId) {
    if (url.startsWith('https://')) {
      securityIcon.style.color = '#0f9d58';
      securityIcon.title = 'Connection is secure';
    } else if (url.startsWith('http://')) {
      securityIcon.style.color = '#5f6368';
      securityIcon.title = 'Not secure';
    }
  }
});

ipcRenderer.on('tab-title-change', (event, { id, title }) => {
  updateTab(id, { title });
});

ipcRenderer.on('tab-loading-start', (event, id) => {
  if (id === activeTabId) {
    loadingIndicator.classList.add('active');
    reloadBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `;
    reloadBtn.title = 'Stop';
    reloadBtn.onclick = () => ipcRenderer.send('stop-loading', activeTabId);
  }
});

ipcRenderer.on('tab-loading-stop', (event, id) => {
  if (id === activeTabId) {
    loadingIndicator.classList.remove('active');
    reloadBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
      </svg>
    `;
    reloadBtn.title = 'Reload';
    reloadBtn.onclick = () => ipcRenderer.send('reload', activeTabId);
  }
});

// Theme handling
function applyTheme(theme) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function initTheme() {
  ipcRenderer.send('load-settings');
}

// Listen for settings loaded
ipcRenderer.on('settings-loaded', (event, settings) => {
  if (settings.theme) {
    applyTheme(settings.theme);
  }
  if (settings.searchEngine) {
    currentSearchEngine = settings.searchEngine;
  }
});

// Listen for theme changes from settings window
ipcRenderer.on('apply-theme', (event, theme) => {
  applyTheme(theme);
});

// Listen for system theme changes
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    ipcRenderer.send('load-settings');
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  try {
    const settings = await ipcRenderer.invoke('get-settings');
    if (settings && settings.searchEngine) {
      currentSearchEngine = settings.searchEngine;
    }
    if (settings && settings.startup) {
      startupBehavior = settings.startup;
    }
  } catch (e) {
    // ignore, will use default
  }
  // Create initial tab based on startup behavior
  const initialUrl = startupBehavior === 'blank' ? 'about:blank' : getHomePageFor(currentSearchEngine);
  createTab(initialUrl);
  console.log('NexaBrowser initialized © Riley Northcote');
});
