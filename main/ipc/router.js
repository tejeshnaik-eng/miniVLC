const { ipcMain, shell, app } = require('electron');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const vlc = require('../services/vlc');
const system = require('../services/system');
const scanner = require('../services/scanner');

function registerIpcHandlers(mainWindow) {
  ipcMain.handle('get-videos', async (event, params) => {
    return db.getVideos(params || {});
  });

  ipcMain.handle('get-video-by-id', async (event, id) => {
    return db.getVideoById(id);
  });

  ipcMain.handle('toggle-favorite', async (event, id) => {
    const val = db.toggleFavorite(id);
    return { id, is_favorite: val, counts: db.getCounts() };
  });

  ipcMain.handle('toggle-watch-later', async (event, id) => {
    const val = db.toggleWatchLater(id);
    return { id, is_watch_later: val, counts: db.getCounts() };
  });

  ipcMain.handle('toggle-completed', async (event, id) => {
    const val = db.toggleCompleted(id);
    return { id, is_completed: val, counts: db.getCounts() };
  });

  ipcMain.handle('get-counts', async () => {
    return db.getCounts();
  });

  ipcMain.handle('get-scan-folders', async () => {
    return db.getScanFolders();
  });

  ipcMain.handle('add-scan-folder', async () => {
    const folder = await system.pickFolder(mainWindow);
    if (folder) {
      db.addScanFolder(folder);
      // Run quick scan for new folder in background
      scanner.startScan(mainWindow.webContents);
    }
    return { added: !!folder, folder, folders: db.getScanFolders() };
  });

  ipcMain.handle('remove-scan-folder', async (event, folderId) => {
    db.removeScanFolder(folderId);
    return db.getScanFolders();
  });

  ipcMain.handle('open-in-vlc', async (event, videoId, startTime) => {
    try {
      return await vlc.openInVlc(videoId, startTime);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update-playback-position', async (event, videoId, position, duration) => {
    try {
      const isCompleted = duration > 0 && position >= (duration * 0.9) ? 1 : 0;
      const now = Math.floor(Date.now() / 1000);
      db.updateVideo(videoId, {
        playback_position: Math.round(position),
        last_watched: now,
        ...(isCompleted ? { is_completed: 1 } : {})
      });
      return { success: true, position: Math.round(position), is_completed: isCompleted };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('show-in-folder', async (event, filePath) => {
    return system.revealInFolder(filePath);
  });

  ipcMain.handle('copy-path', async (event, filePath) => {
    return system.copyToClipboard(filePath);
  });

  ipcMain.handle('get-stats', async () => {
    return db.getLibraryStats();
  });

  ipcMain.handle('get-settings', async () => {
    return db.getAllSettings();
  });

  ipcMain.handle('save-setting', async (event, key, val) => {
    db.setSetting(key, val);
    return db.getAllSettings();
  });

  ipcMain.handle('start-scan', async () => {
    return scanner.startScan(mainWindow.webContents);
  });

  ipcMain.handle('cancel-scan', async () => {
    scanner.cancelScan();
    return { canceled: true };
  });

  ipcMain.handle('get-media-tracks', async (event, videoId) => {
    try {
      const video = db.getVideoById(videoId);
      if (!video || !video.file_path) {
        return { audioTracks: [], subtitleTracks: [], sidecars: [] };
      }
      return await scanner.probeMediaTracks(video.file_path);
    } catch (e) {
      return { audioTracks: [], subtitleTracks: [], sidecars: [] };
    }
  });

  ipcMain.handle('load-subtitle-file', async (event, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return { success: true, content, filename: path.basename(filePath) };
      }
      return { success: false, error: 'File not found' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Right-click delete video: moves file to OS Trash / Recycle Bin, cleans DB and thumbnail
  ipcMain.handle('delete-video', async (event, videoId) => {
    try {
      const video = db.getVideoById(videoId);
      if (!video) return { success: false, error: 'Video not found' };

      const filePath = video.file_path;
      if (filePath && fs.existsSync(filePath)) {
        try {
          await shell.trashItem(filePath);
        } catch (trashErr) {
          console.error('Failed to move file to trash:', trashErr);
          return { success: false, error: 'Could not move file to trash: ' + trashErr.message };
        }
      }

      // Delete SQLite record
      db.deleteVideo(videoId);

      // Clean up cached thumbnail file if present
      try {
        const base = process.env.APPDATA || (app && app.getPath ? app.getPath('appData') : '');
        const thumbPath = path.join(base, 'mediavault', 'thumbnails', `${videoId}.jpg`);
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
      } catch (e) {}

      return {
        success: true,
        id: videoId,
        filename: video.filename,
        counts: db.getCounts()
      };
    } catch (err) {
      console.error('delete-video error:', err);
      return { success: false, error: err.message };
    }
  });

  // Periodic autoscan handler: runs scan only if interval has elapsed (or if forced)
  ipcMain.handle('check-autoscan', async (event, force = false) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const lastScan = parseInt(db.getSetting('last_scan_time', '0'), 10);
      // Default interval: 360 minutes = 6 hours. '0' means disabled.
      const intervalMinutes = parseInt(db.getSetting('autoscan_interval', '360'), 10);

      if (!force) {
        if (intervalMinutes <= 0) {
          return { scanned: false, reason: 'autoscan_disabled' };
        }
        if (lastScan === 0) {
          db.setSetting('last_scan_time', String(now));
          return { scanned: false, reason: 'baseline_initialized', lastScan: now };
        }
        const intervalSeconds = intervalMinutes * 60;
        if (lastScan > 0 && (now - lastScan) < intervalSeconds) {
          return {
            scanned: false,
            reason: 'not_due_yet',
            lastScan,
            nextDue: lastScan + intervalSeconds
          };
        }
      }

      // Start scan asynchronously in background
      scanner.startScan(mainWindow.webContents);
      return { scanned: true, startedAt: now };
    } catch (err) {
      return { scanned: false, error: err.message };
    }
  });

  ipcMain.handle('get-last-scan-time', async () => {
    return {
      lastScanTime: parseInt(db.getSetting('last_scan_time', '0'), 10),
      autoscanInterval: parseInt(db.getSetting('autoscan_interval', '360'), 10)
    };
  });
}

module.exports = {
  registerIpcHandlers
};
