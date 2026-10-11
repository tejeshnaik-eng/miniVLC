const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mediavault', {
  platform: process.platform,

  getVideos: (params) => ipcRenderer.invoke('get-videos', params),
  getVideoById: (id) => ipcRenderer.invoke('get-video-by-id', id),
  toggleFavorite: (id) => ipcRenderer.invoke('toggle-favorite', id),
  toggleWatchLater: (id) => ipcRenderer.invoke('toggle-watch-later', id),
  toggleCompleted: (id) => ipcRenderer.invoke('toggle-completed', id),
  getCounts: () => ipcRenderer.invoke('get-counts'),
  getScanFolders: () => ipcRenderer.invoke('get-scan-folders'),
  addScanFolder: () => ipcRenderer.invoke('add-scan-folder'),
  removeScanFolder: (id) => ipcRenderer.invoke('remove-scan-folder', id),
  openInVlc: (id, startTime) => ipcRenderer.invoke('open-in-vlc', id, startTime),
  updatePlaybackPosition: (id, pos, dur) => ipcRenderer.invoke('update-playback-position', id, pos, dur),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  copyPath: (filePath) => ipcRenderer.invoke('copy-path', filePath),
  getStats: () => ipcRenderer.invoke('get-stats'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSetting: (key, val) => ipcRenderer.invoke('save-setting', key, val),
  startScan: () => ipcRenderer.invoke('start-scan'),
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  getMediaTracks: (id) => ipcRenderer.invoke('get-media-tracks', id),
  loadSubtitleFile: (filePath) => ipcRenderer.invoke('load-subtitle-file', filePath),
  deleteVideo: (id) => ipcRenderer.invoke('delete-video', id),
  checkAutoscan: (force) => ipcRenderer.invoke('check-autoscan', force),
  getLastScanTime: () => ipcRenderer.invoke('get-last-scan-time'),

  onScanProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('scan-progress', handler);
    return () => ipcRenderer.removeListener('scan-progress', handler);
  },
  onScanCompleted: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('scan-completed', handler);
    return () => ipcRenderer.removeListener('scan-completed', handler);
  },
  onScanError: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('scan-error', handler);
    return () => ipcRenderer.removeListener('scan-error', handler);
  }
});
