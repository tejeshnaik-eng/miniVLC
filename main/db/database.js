const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');

let db = null;

function getDbDir() {
  const base = process.env.APPDATA || (app && app.getPath ? app.getPath('appData') : '');
  const dir = path.join(base, 'mediavault');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getDbPath() {
  return path.join(getDbDir(), 'mediavault.db');
}

function initDatabase() {
  const dbPath = getDbPath();
  db = new Database(dbPath, { timeout: 5000 });
  db.pragma('journal_mode = WAL');

  // Ensure tables exist while preserving existing data
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      filename TEXT NOT NULL,
      extension TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      folder_name TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      date_modified INTEGER DEFAULT 0,
      date_added INTEGER NOT NULL,
      duration REAL DEFAULT 0,
      width INTEGER DEFAULT 0,
      height INTEGER DEFAULT 0,
      codec TEXT,
      video_bitrate INTEGER DEFAULT 0,
      fps REAL DEFAULT 0,
      audio_codec TEXT,
      audio_channels INTEGER DEFAULT 0,
      audio_bitrate INTEGER DEFAULT 0,
      hdr INTEGER DEFAULT 0,
      thumbnail_path TEXT,
      thumbnail_generated INTEGER DEFAULT 0,
      file_hash TEXT,
      is_broken INTEGER DEFAULT 0,
      last_watched INTEGER DEFAULT 0,
      watch_count INTEGER DEFAULT 0,
      playback_position REAL DEFAULT 0,
      playback_duration REAL DEFAULT 0,
      playback_speed REAL DEFAULT 1.0,
      audio_track_id INTEGER DEFAULT 0,
      subtitle_track_id INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      is_watch_later INTEGER DEFAULT 0,
      is_completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scan_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_path TEXT UNIQUE NOT NULL,
      is_excluded INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      tag TEXT,
      last_scanned INTEGER
    );

    CREATE TABLE IF NOT EXISTS video_tags (
      video_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (video_id, tag)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Default settings
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('min_duration', '0');
  insertSetting.run('thumbnail_width', '360');
  insertSetting.run('view_mode', 'grid');
  insertSetting.run('auto_scan', '1');

  // Background prune check scheduled after startup has finished (idle time)
  setTimeout(() => {
    try { pruneMissingVideos(); } catch (e) {}
  }, 4000);

  return db;
}

function getDb() {
  if (!db) initDatabase();
  return db;
}

function pruneMissingVideos() {
  try {
    if (!db) return 0;
    const rows = db.prepare('SELECT id, file_path FROM videos').all();
    const deadIds = [];
    for (const r of rows) {
      if (!fs.existsSync(r.file_path)) {
        deadIds.push(r.id);
      }
    }
    if (deadIds.length > 0) {
      const delVid = db.prepare('DELETE FROM videos WHERE id = ?');
      const delTags = db.prepare('DELETE FROM video_tags WHERE video_id = ?');
      db.transaction(() => {
        for (const id of deadIds) {
          delVid.run(id);
          delTags.run(id);
        }
      })();
    }
    return deadIds.length;
  } catch (e) {
    return 0;
  }
}

function getSetting(key, defaultValue = null) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

function getAllSettings() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  return settings;
}

function getVideos({ filter = 'all', sort = 'date_added-desc', search = '', folder = '' } = {}) {
  let sql = 'SELECT * FROM videos WHERE 1=1';
  const params = [];

  const minDur = parseFloat(getSetting('min_duration', '0'));
  if (minDur > 0) {
    sql += ' AND (duration >= ? OR duration IS NULL)';
    params.push(minDur);
  }

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    sql += ' AND (filename LIKE ? OR folder_name LIKE ? OR codec LIKE ?)';
    params.push(q, q, q);
  }

  if (folder && folder !== 'all') {
    sql += ' AND (folder_path = ? OR folder_name = ?)';
    params.push(folder, folder);
  }

  if (filter === 'continue-watching') {
    sql += ' AND playback_position > 0 AND is_completed = 0';
  } else if (filter === 'recently-added') {
    // Recently added filter - sorted automatically by date_added
  } else if (filter === 'unwatched') {
    sql += ' AND (playback_position = 0 OR playback_position IS NULL) AND is_completed = 0';
  } else if (filter === 'favorites') {
    sql += ' AND is_favorite = 1';
  } else if (filter === 'watch-later') {
    sql += ' AND is_watch_later = 1';
  } else if (filter === 'completed') {
    sql += ' AND is_completed = 1';
  }

  const sortMap = {
    'date_added-desc': 'date_added DESC, id DESC',
    'date_added-asc': 'date_added ASC, id ASC',
    'name-asc': 'filename ASC',
    'name-desc': 'filename DESC',
    'duration-desc': 'duration DESC',
    'duration-asc': 'duration ASC',
    'size-desc': 'file_size DESC',
    'size-asc': 'file_size ASC',
    'recent-watched': 'last_watched DESC',
    'random': 'RANDOM()'
  };

  const orderClause = sortMap[sort] || sortMap['date_added-desc'];
  sql += ` ORDER BY ${orderClause}`;

  return getDb().prepare(sql).all(...params);
}

function getVideoById(id) {
  return getDb().prepare('SELECT * FROM videos WHERE id = ?').get(id);
}

function updateVideo(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);
  values.push(id);
  getDb().prepare(`UPDATE videos SET ${setClause} WHERE id = ?`).run(...values);
  return getVideoById(id);
}

function toggleFavorite(id) {
  const v = getVideoById(id);
  if (!v) return 0;
  const newVal = v.is_favorite ? 0 : 1;
  updateVideo(id, { is_favorite: newVal });
  return newVal;
}

function toggleWatchLater(id) {
  const v = getVideoById(id);
  if (!v) return 0;
  const newVal = v.is_watch_later ? 0 : 1;
  updateVideo(id, { is_watch_later: newVal });
  return newVal;
}

function toggleCompleted(id) {
  const v = getVideoById(id);
  if (!v) return 0;
  const newVal = v.is_completed ? 0 : 1;
  updateVideo(id, { is_completed: newVal, playback_position: newVal ? (v.duration || 0) : 0 });
  return newVal;
}

function updatePlaybackPosition(id, position, duration = null) {
  const now = Math.floor(Date.now() / 1000);
  const fields = {
    playback_position: position,
    last_watched: now,
    watch_count: (getVideoById(id)?.watch_count || 0) + 1
  };
  if (duration && duration > 0) {
    fields.playback_duration = duration;
    if (position >= duration * 0.92) {
      fields.is_completed = 1;
    }
  }
  updateVideo(id, fields);
  return getVideoById(id);
}

function getCounts() {
  const d = getDb();
  const allCount = d.prepare('SELECT COUNT(*) as count FROM videos').get().count;
  const continueCount = d.prepare('SELECT COUNT(*) as count FROM videos WHERE playback_position > 0 AND is_completed = 0').get().count;
  const unwatchedCount = d.prepare('SELECT COUNT(*) as count FROM videos WHERE (playback_position = 0 OR playback_position IS NULL) AND is_completed = 0').get().count;
  const favoritesCount = d.prepare('SELECT COUNT(*) as count FROM videos WHERE is_favorite = 1').get().count;
  const watchLaterCount = d.prepare('SELECT COUNT(*) as count FROM videos WHERE is_watch_later = 1').get().count;
  const completedCount = d.prepare('SELECT COUNT(*) as count FROM videos WHERE is_completed = 1').get().count;

  return {
    all: allCount,
    continueWatching: continueCount,
    unwatched: unwatchedCount,
    favorites: favoritesCount,
    watchLater: watchLaterCount,
    completed: completedCount
  };
}

function getScanFolders() {
  const rows = getDb().prepare('SELECT * FROM scan_folders WHERE is_excluded = 0').all();
  const folderCounts = getDb().prepare(`
    SELECT folder_path, COUNT(*) as count 
    FROM videos 
    GROUP BY folder_path
  `).all();
  const countMap = {};
  for (const fc of folderCounts) countMap[fc.folder_path] = fc.count;

  return rows.map(r => ({
    ...r,
    folder_name: path.basename(r.folder_path),
    video_count: countMap[r.folder_path] || 0
  }));
}

function addScanFolder(folderPath) {
  const normalized = path.normalize(folderPath);
  getDb().prepare('INSERT OR IGNORE INTO scan_folders (folder_path) VALUES (?)').run(normalized);
  return getScanFolders();
}

function removeScanFolder(id) {
  getDb().prepare('DELETE FROM scan_folders WHERE id = ?').run(id);
  return getScanFolders();
}

function deleteVideo(id) {
  const v = getVideoById(id);
  if (!v) return null;
  getDb().prepare('DELETE FROM videos WHERE id = ?').run(id);
  getDb().prepare('DELETE FROM video_tags WHERE video_id = ?').run(id);
  return v;
}

function getLibraryStats() {
  const d = getDb();
  const totalVideos = d.prepare('SELECT COUNT(*) as count FROM videos').get().count;
  const totalDuration = d.prepare('SELECT SUM(duration) as total FROM videos').get().total || 0;
  const totalSize = d.prepare('SELECT SUM(file_size) as total FROM videos').get().total || 0;
  const watchedCount = d.prepare('SELECT COUNT(*) as count FROM videos WHERE is_completed = 1').get().count;
  const favoritesCount = d.prepare('SELECT COUNT(*) as count FROM videos WHERE is_favorite = 1').get().count;

  const resolutions = d.prepare(`
    SELECT 
      CASE 
        WHEN height >= 2160 OR width >= 3840 THEN '4K UHD'
        WHEN height >= 1080 OR width >= 1920 THEN '1080p FHD'
        WHEN height >= 720 OR width >= 1280 THEN '720p HD'
        WHEN height > 0 THEN 'SD'
        ELSE 'Unknown'
      END as res_group,
      COUNT(*) as count
    FROM videos
    GROUP BY res_group
    ORDER BY count DESC
  `).all();

  const codecs = d.prepare(`
    SELECT 
      COALESCE(NULLIF(codec, ''), 'Unknown') as codec_name,
      COUNT(*) as count
    FROM videos
    GROUP BY codec_name
    ORDER BY count DESC
    LIMIT 6
  `).all();

  return {
    totalVideos,
    totalDuration,
    totalSize,
    watchedCount,
    favoritesCount,
    resolutions,
    codecs
  };
}

module.exports = {
  initDatabase,
  getDb,
  getDbPath,
  getSetting,
  setSetting,
  getAllSettings,
  getVideos,
  getVideoById,
  updateVideo,
  toggleFavorite,
  toggleWatchLater,
  toggleCompleted,
  updatePlaybackPosition,
  getCounts,
  getScanFolders,
  addScanFolder,
  removeScanFolder,
  deleteVideo,
  pruneMissingVideos,
  getLibraryStats
};
