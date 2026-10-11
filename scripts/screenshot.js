const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
app.commandLine.appendSwitch('no-sandbox');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const sizes = (process.env.SIZES || '1680x1000').split(',');
  for (const s of sizes) {
    const [w, h] = s.split('x').map(Number);
    const win = new BrowserWindow({ width: w, height: h, useContentSize: true, show: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'), { query: { caption: '1' } });
    await new Promise(r => setTimeout(r, 2200));
    fs.writeFileSync(`/tmp/mediavault-${w}.png`, (await win.webContents.capturePage()).toPNG());
    console.log('saved', w);
    win.destroy();
  }
  app.exit(0);
});
