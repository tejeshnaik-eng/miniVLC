const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { app } = require('electron');
const db = require('../db/database');

const SUPPORTED_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv',
  '.m4v', '.mpg', '.mpeg', '.ts', '.m2ts', '.3gp', '.wmv', '.ogv'
]);

function findTool(toolName) {
  const exe = toolName.endsWith('.exe') ? toolName : `${toolName}.exe`;
  const localAppData = process.env.LOCALAPPDATA || '';
  const wingetDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  
  if (fs.existsSync(wingetDir)) {
    try {
      const entries = fs.readdirSync(wingetDir);
      for (const entry of entries) {
        if (entry.includes('FFmpeg') || entry.includes('ffmpeg')) {
          const candidateDir = path.join(wingetDir, entry);
          const walk = (d) => {
            const files = fs.readdirSync(d, { withFileTypes: true });
            for (const f of files) {
              const full = path.join(d, f.name);
              if (f.isDirectory()) {
                const found = walk(full);
                if (found) return found;
              } else if (f.name.toLowerCase() === exe.toLowerCase()) {
                return full;
              }
            }
            return null;
          };
          const found = walk(candidateDir);
          if (found) return found;
        }
      }
    } catch (e) {}
  }

  return exe;
}

const ffmpegPath = findTool('ffmpeg');
const ffprobePath = findTool('ffprobe');

function getThumbDir() {
  const base = process.env.APPDATA || (app && app.getPath ? app.getPath('appData') : '');
  const dir = path.join(base, 'mediavault', 'thumbnails');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

let isScanning = false;
let shouldCancel = false;

function cancelScan() {
  if (isScanning) {
    shouldCancel = true;
  }
}

async function runFfprobe(filePath) {
  return new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration,codec_name:format=duration',
      '-of', 'json',
      filePath
    ];

    execFile(ffprobePath, args, { timeout: 8000 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve(null);
      }
      try {
        const data = JSON.parse(stdout);
        const stream = data.streams?.[0] || {};
        const format = data.format || {};

        let duration = parseFloat(stream.duration || format.duration || 0);
        const width = parseInt(stream.width || 0, 10);
        const height = parseInt(stream.height || 0, 10);
        const codec = (stream.codec_name || '').toLowerCase();

        resolve({ duration, width, height, codec });
      } catch (e) {
        resolve(null);
      }
    });
  });
}

async function generateThumbnail(videoId, filePath, duration = 0) {
  const thumbDir = getThumbDir();
  const outPath = path.join(thumbDir, `${videoId}.jpg`);

  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    return outPath;
  }

  return new Promise((resolve) => {
    const seekTime = duration > 0 ? Math.max(1.0, duration * 0.1) : 5.0;
    const args = [
      '-ss', String(seekTime),
      '-i', filePath,
      '-vframes', '1',
      '-vf', 'scale=480:-1',
      '-q:v', '2',
      '-y', outPath
    ];

    const child = spawn(ffmpegPath, args, { stdio: 'ignore' });
    const timer = setTimeout(() => {
      try { child.kill(); } catch (e) {}
      resolve(null);
    }, 12000);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
        resolve(outPath);
      } else {
        resolve(null);
      }
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

async function startScan(webContents = null) {
  if (isScanning) {
    return { error: 'Scan already in progress' };
  }

  isScanning = true;
  shouldCancel = false;

  const emit = (event, data) => {
    if (webContents && !webContents.isDestroyed()) {
      webContents.send(event, data);
    }
  };

  try {
    db.pruneMissingVideos();
    const folders = db.getScanFolders();
    const allFiles = [];

    emit('scan-progress', { phase: 'crawling', current: 0, total: 0, file: 'Discovering media folders...' });

    // Recursive directory crawl
    for (const f of folders) {
      if (!fs.existsSync(f.folder_path)) continue;

      const crawl = (dir) => {
        if (shouldCancel) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const ent of entries) {
            if (shouldCancel) return;
            if (ent.name.startsWith('.') || ent.name.startsWith('._')) continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
              if (ent.name !== 'node_modules' && ent.name !== '$RECYCLE.BIN') {
                crawl(full);
              }
            } else if (ent.isFile()) {
              const ext = path.extname(ent.name).toLowerCase();
              if (SUPPORTED_EXTENSIONS.has(ext)) {
                allFiles.push({
                  filePath: full,
                  filename: ent.name,
                  extension: ext,
                  folderPath: dir,
                  folderName: path.basename(dir)
                });
              }
            }
          }
        } catch (e) {}
      };

      crawl(f.folder_path);
    }

    const totalFiles = allFiles.length;
    emit('scan-progress', { phase: 'inserting', current: 0, total: totalFiles, file: `Discovered ${totalFiles} video files` });

    const now = Math.floor(Date.now() / 1000);
    const d = db.getDb();

    // Prune videos in monitored folders that no longer exist on disk
    const scannedPaths = new Set(allFiles.map(x => x.filePath));
    for (const f of folders) {
      const dbVids = d.prepare('SELECT id, file_path FROM videos WHERE folder_path = ?').all(f.folder_path);
      for (const dv of dbVids) {
        if (!scannedPaths.has(dv.file_path) || !fs.existsSync(dv.file_path)) {
          d.prepare('DELETE FROM videos WHERE id = ?').run(dv.id);
          d.prepare('DELETE FROM video_tags WHERE video_id = ?').run(dv.id);
        }
      }
    }
    const insertStmt = d.prepare(`
      INSERT INTO videos (
        file_path, filename, extension, folder_path, folder_name,
        file_size, date_modified, date_added
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET
        file_size = excluded.file_size,
        date_modified = excluded.date_modified
    `);

    d.transaction(() => {
      for (const item of allFiles) {
        try {
          const stat = fs.statSync(item.filePath);
          insertStmt.run(
            item.filePath,
            item.filename,
            item.extension,
            item.folderPath,
            item.folderName,
            stat.size,
            Math.floor(stat.mtimeMs / 1000),
            now
          );
        } catch (e) {}
      }
    })();

    // Extract metadata & thumbnails for videos that need them
    const pendingVideos = d.prepare(`
      SELECT id, file_path, duration, width, height, codec, thumbnail_path, thumbnail_generated 
      FROM videos 
      WHERE duration = 0 OR duration IS NULL OR thumbnail_generated = 0 OR thumbnail_generated IS NULL
    `).all();

    const pendingTotal = pendingVideos.length;
    for (let i = 0; i < pendingTotal; i++) {
      if (shouldCancel) break;
      const v = pendingVideos[i];

      emit('scan-progress', {
        phase: 'processing',
        current: i + 1,
        total: pendingTotal,
        file: path.basename(v.file_path)
      });

      let duration = v.duration || 0;
      let width = v.width || 0;
      let height = v.height || 0;
      let codec = v.codec || '';

      if ((duration === 0 || !v.duration) && fs.existsSync(v.file_path)) {
        const meta = await runFfprobe(v.file_path);
        if (meta) {
          duration = meta.duration;
          width = meta.width;
          height = meta.height;
          codec = meta.codec;
          db.updateVideo(v.id, { duration, width, height, codec });
        }
      }

      // Generate thumbnail
      if ((!v.thumbnail_path || v.thumbnail_generated === 0) && fs.existsSync(v.file_path)) {
        const thumb = await generateThumbnail(v.id, v.file_path, duration);
        if (thumb) {
          db.updateVideo(v.id, { thumbnail_path: thumb, thumbnail_generated: 1 });
        } else {
          db.updateVideo(v.id, { thumbnail_generated: -1 });
        }
      }
    }

    const scanTimestamp = Math.floor(Date.now() / 1000);
    db.setSetting('last_scan_time', String(scanTimestamp));
    emit('scan-completed', { totalScanned: totalFiles, pendingProcessed: pendingTotal, lastScanTime: scanTimestamp });
    return { success: true, totalFiles, pendingProcessed: pendingTotal, lastScanTime: scanTimestamp };
  } catch (err) {
    emit('scan-error', { message: err.message });
    return { error: err.message };
  } finally {
    isScanning = false;
    shouldCancel = false;
  }
}

async function probeMediaTracks(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve({ audioTracks: [], subtitleTracks: [], sidecars: [] });
    }

    const dir = path.dirname(filePath);

    // Discover sidecar subtitle files (.srt, .vtt, .ass, .sub)
    const sidecars = [];
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (['.srt', '.vtt', '.ass', '.sub'].includes(ext)) {
          const fullPath = path.join(dir, f);
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            sidecars.push({
              filename: f,
              filePath: fullPath,
              ext,
              content
            });
          } catch (readErr) {}
        }
      }
    } catch (e) {}

    // Check embedded streams with ffprobe
    const args = [
      '-v', 'error',
      '-show_entries', 'stream=index,codec_type,codec_name,channels,channel_layout:stream_tags=language,title',
      '-of', 'json',
      filePath
    ];

    execFile(ffprobePath, args, { timeout: 8000 }, (err, stdout) => {
      let audioTracks = [];
      let subtitleTracks = [];
      if (!err && stdout) {
        try {
          const data = JSON.parse(stdout);
          const streams = data.streams || [];
          let aIdx = 0;
          let sIdx = 0;
          for (const s of streams) {
            if (s.codec_type === 'audio') {
              aIdx++;
              audioTracks.push({
                index: s.index,
                audioIndex: aIdx - 1,
                codec: s.codec_name,
                channels: s.channels,
                channelLayout: s.channel_layout,
                language: s.tags?.language || '',
                title: s.tags?.title || `Track ${aIdx} (${(s.tags?.language || s.codec_name || 'Audio').toUpperCase()})`
              });
            } else if (s.codec_type === 'subtitle') {
              sIdx++;
              subtitleTracks.push({
                index: s.index,
                subIndex: sIdx - 1,
                codec: s.codec_name,
                language: s.tags?.language || '',
                title: s.tags?.title || `Subtitle ${sIdx} (${(s.tags?.language || s.codec_name || 'Sub').toUpperCase()})`
              });
            }
          }
        } catch (e) {}
      }
      resolve({ audioTracks, subtitleTracks, sidecars });
    });
  });
}

module.exports = {
  findTool,
  startScan,
  cancelScan,
  generateThumbnail,
  getThumbDir,
  probeMediaTracks
};

