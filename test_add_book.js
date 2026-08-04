const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.goto('http://localhost:8085/Admin_Index.html');
  
  // Login
  await page.type('#adminPassword', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(500);
  
  // Click Add New Book from Dashboard
  await page.click('button.action-btn.green');
  await page.waitForTimeout(500);
  
  // Check if modal is visible
  const isModalVisible = await page.evaluate(() => {
    return document.getElementById('modal-add-book').style.display === 'flex';
  });
  console.log("Modal visible:", isModalVisible);
  
  if (isModalVisible) {
      await page.type('#bookTitleInput', 'Test Book');
      await page.select('#bookCategoryInput', 'សៀវភៅចំណេះដឹងទូទៅ');
      
      // Submit form
      await page.click('#addBookForm button[type="submit"]');
      await page.waitForTimeout(500);
      
      // Check for alert
      const alertMsg = await page.evaluate(() => {
          // We can't capture window.alert easily like this without on('dialog'), but let's check if modal is closed
          return document.getElementById('modal-add-book').style.display;
      });
      console.log("Modal display after submit:", alertMsg);
  }
  
  await browser.close();
})();
