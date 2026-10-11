const { app, BrowserWindow, nativeTheme, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { initDatabase } = require('./main/db/database');
const { registerIpcHandlers } = require('./main/ipc/router');

// Register custom protocol schemes as privileged before ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'mediavault-thumb', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'mediavault-stream', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } }
]);

process.on('uncaughtException', (err) => {
  console.error('[MediaVault] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[MediaVault] Unhandled Rejection:', reason);
});

// Enforce single instance: if another instance runs, focus existing window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Enable multi-audio track switching in Chromium
app.commandLine.appendSwitch('enable-blink-features', 'AudioVideoTracks');

nativeTheme.themeSource = 'dark';

let mainWindow = null;

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  const isMac = process.platform === 'darwin';
  const iconPath = path.join(__dirname, 'assets', 'mediavault.ico');

  mainWindow = new BrowserWindow({
    title: 'mini VLC',
    width: 1520,
    height: 920,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#08080a',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 22, y: 22 } : undefined,
    titleBarOverlay: isMac ? undefined : { color: '#00000000', symbolColor: '#ffffff', height: 44 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  registerIpcHandlers(mainWindow);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Fallback timer to ensure window displays even if ready-to-show is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 400);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  return mainWindow;
}

app.whenReady().then(() => {
  try {
    initDatabase();
  } catch (err) {
    console.error('[MediaVault] DB Init Warning:', err);
  }

  const { getVideoById } = require('./main/db/database');


  // Handle custom protocol for high-performance secure thumbnail loading
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

  // Handle custom protocol for hardware-accelerated in-app video streaming & on-the-fly audio transcoding
  protocol.handle('mediavault-stream', async (request) => {
    try {
      // 1. Audio stream endpoint: mediavault-stream://audio/:id/:trackIndex?start=:seconds
      const audioMatch = request.url.match(/audio\/(\d+)(?:\/(\d+))?/);
      if (audioMatch) {
        const videoId = parseInt(audioMatch[1], 10);
        const trackIndex = audioMatch[2] ? parseInt(audioMatch[2], 10) : 0;
        const video = getVideoById(videoId);
        if (!video || !video.file_path || !fs.existsSync(video.file_path)) {
          return new Response('File not found', { status: 404 });
        }

        const urlObj = new URL(request.url);
        const startTime = parseFloat(urlObj.searchParams.get('start') || '0');
        const { findTool } = require('./main/services/scanner');
        const ffmpegPath = findTool('ffmpeg');

        // Spawn ffmpeg to transcode specified audio track to MP3 on the fly with minimal latency
        const ffmpegArgs = [
          '-ss', String(Math.max(0, startTime)),
          '-i', video.file_path,
          '-map', `0:a:${trackIndex}`,
          '-c:a', 'libmp3lame',
          '-b:a', '192k',
          '-ac', '2',
          '-f', 'mp3',
          'pipe:1'
        ];

        const child = spawn(ffmpegPath, ffmpegArgs, { stdio: ['ignore', 'pipe', 'ignore'] });
        child.on('error', () => {});
        const webStream = new ReadableStream({
          start(controller) {
            child.stdout.on('data', chunk => {
              try { controller.enqueue(chunk); } catch (e) {}
            });
            child.stdout.on('end', () => {
              try { controller.close(); } catch (e) {}
            });
            child.stdout.on('error', err => {
              try { controller.error(err); } catch (e) {}
            });
          },
          cancel() {
            try { child.kill(); } catch (e) {}
          }
        });

        return new Response(webStream, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          }
        });
      }

      // 2. Video stream endpoint: mediavault-stream://video/:id
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
      console.error('Media stream error:', err);
      return new Response(err.message, { status: 500 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
