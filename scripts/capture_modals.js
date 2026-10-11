const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { initDatabase } = require('../main/db/database');
const { registerIpcHandlers } = require('../main/ipc/router');

protocol.registerSchemesAsPrivileged([
  { scheme: 'mediavault-thumb', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  app.name = 'mediavault';
  initDatabase();

  protocol.handle('mediavault-thumb', async (request) => {
    try {
      const match = request.url.match(/(\d+)(?:\.jpg)?\/?$/);
      if (!match) return new Response('', { status: 404 });
      const videoId = match[1];
      const base = process.env.APPDATA || app.getPath('appData');
      const thumbDir = path.join(base, 'mediavault', 'thumbnails');
      const thumbPath = path.join(thumbDir, `${videoId}.jpg`);
      if (fs.existsSync(thumbPath)) {
        return net.fetch(pathToFileURL(thumbPath).toString());
      }
    } catch (err) {}
    return new Response('', { status: 404 });
  });

  const win = new BrowserWindow({
    width: 1520,
    height: 920,
    show: true,
    backgroundColor: '#08080a',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  registerIpcHandlers(win);

  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise(r => setTimeout(r, 1500));

  // Open Statistics modal
  await win.webContents.executeJavaScript(`
    document.getElementById('btn-stats-trigger').click();
  `);
  await new Promise(r => setTimeout(r, 600));

  const statsImg = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, '..', '..', 'scratch', 'mediavault_stats_screenshot.png'), statsImg.toPNG());

  // Close Statistics, open Settings modal
  await win.webContents.executeJavaScript(`
    document.querySelector('#stats-modal .modal-close').click();
    setTimeout(() => document.getElementById('btn-settings-trigger').click(), 300);
  `);
  await new Promise(r => setTimeout(r, 800));

  const settingsImg = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, '..', '..', 'scratch', 'mediavault_settings_screenshot.png'), settingsImg.toPNG());

  win.destroy();
  app.exit(0);
});
