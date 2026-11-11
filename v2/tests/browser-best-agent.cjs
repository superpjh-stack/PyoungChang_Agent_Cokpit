const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/workspace',async route=>{const r=await route.fetch();const data=await r.json();data.meta.ai_configured=false;await route.fulfill({json:data})});
 await page.goto(process.env.KKOTSUNI_URL||'http://127.0.0.1:8519');
 await page.getByText('오늘 궁금한거 질문해!!',{exact:true}).waitFor();
 if(await page.locator('.flower-top-questions button').count()!==30)throw Error('Expected 30 recommendations');
 async function ask(text){await page.getByRole('textbox',{name:'에이전트에게 질문'}).fill(text);await page.getByRole('button',{name:'질문 보내기',exact:true}).click()}
 await ask('세척 CCP와 금속검출 기록을 함께 보여줘');await page.locator('.exchange').waitFor();
 if(await page.locator('.comparison-scroll').count()<2)throw Error('Distinct record schemas must be separate tables');
 await ask('재고와 출하를 함께 보여줘');await page.locator('.exchange').nth(1).waitFor();await page.waitForTimeout(100);
 const offset=await page.locator('.chat-scroll').evaluate(n=>n.querySelector('.exchange:last-of-type').getBoundingClientRect().top-n.getBoundingClientRect().top);
 if(Math.abs(offset)>20)throw Error('Answer start not anchored: '+offset);
 await page.screenshot({path:'/tmp/kkotsuni-desktop-final.png'});
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile horizontal overflow');
 await page.getByRole('button',{name:'질문 · 기록',exact:true}).click();await page.getByRole('button',{name:'질문 패널 닫기'}).click();
 await page.screenshot({path:'/tmp/kkotsuni-mobile-final.png'});
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();console.log('Desktop/mobile, tables, answer anchor: PASS');
})().catch(e=>{console.error(e);process.exit(1)});
