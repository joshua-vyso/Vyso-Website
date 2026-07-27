const { app, BrowserWindow, shell } = require('electron');

const APP_URL = 'https://vyso.co.za/app';
const ALLOWED_HOST = 'vyso.co.za';

function isAllowedHost(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname === ALLOWED_HOST || url.hostname.endsWith(`.${ALLOWED_HOST}`);
  } catch {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setWindowOpenHandler(({ url }) => {
    if (isAllowedHost(url)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedHost(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadURL(APP_URL);
}

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
