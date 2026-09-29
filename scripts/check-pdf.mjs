import { chromium } from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1000,height:1250}});
 await page.goto('http://127.0.0.1:3000/documents/sample-legislative-document.pdf',{waitUntil:'commit'});
 await page.waitForTimeout(2000);
 await page.screenshot({path:'tmp/pdfs/pdf-viewer.png'});
 console.log(await page.title());
} finally {await browser.close();}
