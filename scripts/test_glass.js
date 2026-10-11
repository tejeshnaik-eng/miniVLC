const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise(r => setTimeout(r, 1000));
  const res = await win.webContents.executeJavaScript(`
    (() => {
      const logs = [];
      const supported = /Chrome\\//.test(navigator.userAgent) && CSS.supports('backdrop-filter', 'url(#x)');
      logs.push('supported: ' + supported);
      const glassEls = document.querySelectorAll('[data-glass]');
      logs.push('glass elements count: ' + glassEls.length);
      for (const el of glassEls) {
        logs.push(el.tagName + '.' + el.className + ' [w=' + el.offsetWidth + ', h=' + el.offsetHeight + ', glass=' + el.dataset.glass + ']');
        logs.push('backdropFilter: ' + el.style.backdropFilter);
      }
      const svgFilters = document.querySelectorAll('filter');
      logs.push('filter count: ' + svgFilters.length);
      return { logs };
    })()
  `);
  console.log('GLASS DEBUG:', JSON.stringify(res, null, 2));
  app.exit(0);
});
