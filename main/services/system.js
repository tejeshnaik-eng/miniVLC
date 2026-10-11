const path = require('path');
const fs = require('fs');
const { shell, clipboard, dialog } = require('electron');

function revealInFolder(filePath) {
  if (!filePath) return false;
  const normalized = path.normalize(filePath);
  if (fs.existsSync(normalized)) {
    shell.showItemInFolder(normalized);
    return true;
  }
  return false;
}

function copyToClipboard(text) {
  if (typeof text === 'string') {
    clipboard.writeText(text);
    return true;
  }
  return false;
}

async function pickFolder(parentWindow) {
  const result = await dialog.showOpenDialog(parentWindow, {
    title: 'Select Video Library Folder',
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
}

module.exports = {
  revealInFolder,
  copyToClipboard,
  pickFolder
};
