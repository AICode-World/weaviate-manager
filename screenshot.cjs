const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const desktop = path.join(os.homedir(), 'Desktop');
  
  const pages = [
    { name: '01-dashboard', page: 'dashboard' },
    { name: '02-data-browser', page: 'data' },
    { name: '03-schema', page: 'schema' },
    { name: '04-graphql', page: 'graphql' },
    { name: '05-connections', page: 'connections' },
  ];

  for (const p of pages) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto('http://localhost:5173/screenshots.html', { waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate((p) => window.goto(p), p.page);
    await new Promise(r => setTimeout(r, 600));
    
    const filePath = path.join(desktop, `weaviate-manager-${p.name}.png`);
    await page.screenshot({ path: filePath, type: 'png' });
    console.log(`Saved: ${filePath}`);
    await page.close();
  }

  await browser.close();
  console.log('Done!');
})();
