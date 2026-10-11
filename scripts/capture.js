const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { initDatabase, getVideoById } = require('../main/db/database');
const { registerIpcHandlers } = require('../main/ipc/router');

protocol.registerSchemesAsPrivileged([
  { scheme: 'mediavault-thumb', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'mediavault-stream', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } }
]);

app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  app.name = 'mediavault';
  initDatabase();

  protocol.handle('mediavault-thumb', async (request) => {
    try {
      const match = request.url.match(/(\d+)(?:\.jpg)?$/);
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

  protocol.handle('mediavault-stream', async (request) => {
    try {
      const match = request.url.match(/video\/(\d+)/);
      if (!match) return new Response('Video not found', { status: 404 });
      const videoId = parseInt(match[1], 10);
      const video = getVideoById(videoId);
      if (!video || !video.file_path || !fs.existsSync(video.file_path)) {
        return new Response('File not found', { status: 404 });
      }

      const filePath = video.file_path;
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const rangeHeader = request.headers.get('range');

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.mp4': 'video/mp4',
        '.mkv': 'video/webm',
        '.webm': 'video/webm',
        '.mov': 'video/mp4',
        '.m4v': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.wmv': 'video/x-ms-wmv',
        '.ts': 'video/mp2t'
      };
      const contentType = mimeTypes[ext] || 'video/mp4';

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        const nodeStream = fs.createReadStream(filePath, { start, end });
        const webStream = new ReadableStream({
          start(controller) {
            nodeStream.on('data', chunk => controller.enqueue(chunk));
            nodeStream.on('end', () => controller.close());
            nodeStream.on('error', err => controller.error(err));
          },
          cancel() {
            nodeStream.destroy();
          }
        });

        return new Response(webStream, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else {
        const nodeStream = fs.createReadStream(filePath);
        const webStream = new ReadableStream({
          start(controller) {
            nodeStream.on('data', chunk => controller.enqueue(chunk));
            nodeStream.on('end', () => controller.close());
            nodeStream.on('error', err => controller.error(err));
          },
          cancel() {
            nodeStream.destroy();
          }
        });

        return new Response(webStream, {
          status: 200,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Length': String(fileSize),
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
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
  console.log('[capture] Page loaded, waiting for initial library load...');
  await new Promise(r => setTimeout(r, 2500));

  const artifactDir = 'C:\\Users\\tirum\\.gemini\\antigravity-ide\\brain\\e84003b8-615f-4e34-930f-dc460bac2d04';

  // 1. Switch to TV Series to inspect & capture Refractive Glass Episode Rows
  const tvSeriesStats = await win.webContents.executeJavaScript(`
    (async () => {
      const seriesNav = document.querySelector('.sidebar .nav-item[data-filter="cat-series"]');
      if (seriesNav) seriesNav.click();
      await new Promise(r => setTimeout(r, 800));

      const rows = document.querySelectorAll('.series-ep-row');
      const glassRows = document.querySelectorAll('.series-ep-row.glass[data-glass]');
      const filterEls = document.querySelectorAll('filter');

      const firstRow = rows[0];
      return {
        totalRows: rows.length,
        glassRows: glassRows.length,
        totalFilters: filterEls.length,
        firstRowClasses: firstRow ? firstRow.className : null,
        firstRowBackdrop: firstRow ? firstRow.style.backdropFilter : null,
        firstRowW: firstRow ? firstRow.offsetWidth : 0,
        firstRowH: firstRow ? firstRow.offsetHeight : 0
      };
    })()
  `);
  console.log('[capture] 1. TV Series Refraction Check:', JSON.stringify(tvSeriesStats, null, 2));

  const imgSeries = await win.webContents.capturePage();
  fs.writeFileSync(path.join(artifactDir, 'mediavault_tv_refractive_glass.png'), imgSeries.toPNG());
  console.log('[capture] 1. Saved mediavault_tv_refractive_glass.png');

  // 2. Open In-App Theater Player and capture Bottom Refractive HUD with clean title & X close button
  const playerStats = await win.webContents.executeJavaScript(`
    (async () => {
      const playBtn = document.querySelector('.series-ep-actions .btn-icon') || document.querySelector('.series-ep-row');
      if (playBtn) playBtn.click();
      await new Promise(r => setTimeout(r, 1200));

      const modal = document.getElementById('theater-modal');
      const hud = document.getElementById('theater-hud');
      const closeBtn = document.getElementById('theater-close-btn');
      const title = document.getElementById('theater-title');
      const scrubber = document.getElementById('theater-scrubber');
      const fill = document.getElementById('theater-fill');

      return {
        modalIsOpen: modal ? modal.classList.contains('is-open') : false,
        hudBackdropFilter: hud ? hud.style.backdropFilter : null,
        hudWidth: hud ? hud.offsetWidth : 0,
        hudHeight: hud ? hud.offsetHeight : 0,
        closeBtnInHud: hud ? !!hud.querySelector('#theater-close-btn') : false,
        titleInHud: hud ? !!hud.querySelector('#theater-title') : false,
        titleText: title ? title.textContent : null,
        specChipsCount: hud ? hud.querySelectorAll('.spec-chip').length : 0,
        hasTopHeader: !!document.querySelector('.theater-header')
      };
    })()
  `);
  console.log('[capture] 2. Player HUD Check:', JSON.stringify(playerStats, null, 2));

  const imgPlayer = await win.webContents.capturePage();
  fs.writeFileSync(path.join(artifactDir, 'mediavault_player_refractive_bottom_hud.png'), imgPlayer.toPNG());
  console.log('[capture] 2. Saved mediavault_player_refractive_bottom_hud.png');

  // 3. Test Scrubber Dragging Simulation
  const scrubTest = await win.webContents.executeJavaScript(`
    (async () => {
      const scrubber = document.getElementById('theater-scrubber');
      const fill = document.getElementById('theater-fill');
      const currentTimeEl = document.getElementById('theater-current-time');
      const video = document.getElementById('theater-video');

      if (!scrubber) return { error: 'No scrubber' };

      const rect = scrubber.getBoundingClientRect();
      const midX = rect.left + rect.width * 0.5;
      const midY = rect.top + rect.height * 0.5;

      // Simulate pointerdown at 50%
      scrubber.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: midX,
        clientY: midY,
        pointerId: 1,
        bubbles: true
      }));

      // Simulate pointermove dragging to 75%
      const dragX = rect.left + rect.width * 0.75;
      scrubber.dispatchEvent(new PointerEvent('pointermove', {
        clientX: dragX,
        clientY: midY,
        pointerId: 1,
        bubbles: true
      }));

      const progressDuringDrag = fill ? fill.style.width : null;
      const timeDuringDrag = currentTimeEl ? currentTimeEl.textContent : null;

      // Simulate pointerup release
      scrubber.dispatchEvent(new PointerEvent('pointerup', {
        clientX: dragX,
        clientY: midY,
        pointerId: 1,
        bubbles: true
      }));

      return {
        progressDuringDrag,
        timeDuringDrag,
        scrubberValAfterRelease: scrubber.value
      };
    })()
  `);
  console.log('[capture] 3. Scrubber Drag Test:', JSON.stringify(scrubTest, null, 2));

  // 4. Close player cleanly via close button in bottom bar
  await win.webContents.executeJavaScript(`
    const closeBtn = document.getElementById('theater-close-btn');
    if (closeBtn) closeBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));

  console.log('[capture] All tests and screenshots completed successfully!');
  win.destroy();
  app.exit(0);
});
