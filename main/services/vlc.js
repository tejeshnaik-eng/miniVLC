const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { shell } = require('electron');
const db = require('../db/database');

function findVlc() {
  const standardPaths = [
    'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
    'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'VLC', 'vlc.exe')
  ];

  for (const p of standardPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return 'vlc';
}

async function openInVlc(videoId, customStartTime) {
  const video = db.getVideoById(videoId);
  if (!video || !video.file_path) {
    throw new Error('Video not found in library');
  }

  if (!fs.existsSync(video.file_path)) {
    throw new Error(`File does not exist at path: ${video.file_path}`);
  }

  const vlcPath = findVlc();
  const filePath = path.normalize(video.file_path);
  const position = customStartTime !== undefined ? customStartTime : (video.playback_position || 0);
  const isCompleted = video.is_completed || 0;

  const args = ['--started-from-file', filePath];
  if (position > 2 && (customStartTime !== undefined || !isCompleted)) {
    args.push(`--start-time=${Math.floor(position)}`);
  }

  try {
    const child = spawn(vlcPath, args, {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    const now = Math.floor(Date.now() / 1000);
    db.updateVideo(videoId, {
      last_watched: now,
      watch_count: (video.watch_count || 0) + 1
    });

    return { success: true, method: 'vlc', path: filePath };
  } catch (err) {
    // Fallback to system default player
    const result = await shell.openPath(filePath);
    const now = Math.floor(Date.now() / 1000);
    db.updateVideo(videoId, {
      last_watched: now,
      watch_count: (video.watch_count || 0) + 1
    });
    return { success: !result, method: 'system', error: result || undefined };
  }
}

module.exports = {
  findVlc,
  openInVlc
};
