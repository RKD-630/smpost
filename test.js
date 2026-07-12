const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    console.log('PAGE EXCEPTION:', err.message);
    errors.push(err.message);
  });
  
  await page.goto('file:///home/rkd/Downloads/post-designer (2)/post-designer/index.html', { waitUntil: 'networkidle0' });
  
  // Test interaction 1: Open mobile menu
  await page.setViewport({ width: 375, height: 812 });
  await page.click('#btnMobileMenu');
  await new Promise(r => setTimeout(r, 200));

  // Test interaction 2: Click Text tab in dropdown
  await page.click('.sidebar-tab[data-panel="text"]');
  await new Promise(r => setTimeout(r, 200));
  
  // Test interaction 3: Add text
  await page.click('#btnAddText');
  await new Promise(r => setTimeout(r, 200));
  
  // Test interaction 4: Fullscreen
  if (await page.$('#btnFullscreen')) {
    try {
      await page.click('#btnFullscreen');
      await new Promise(r => setTimeout(r, 200));
    } catch(e) {}
  }
  
  // Test interaction 5: Export PNG
  await page.click('#btnExportPNG');
  await new Promise(r => setTimeout(r, 500));
  
  await browser.close();
  
  if (errors.length === 0) console.log('Test complete: NO ERRORS FOUND');
})();
