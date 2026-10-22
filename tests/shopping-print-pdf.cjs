// Run manually on Windows: node tests/shopping-print-pdf.cjs
// Uses Edge's DevTools protocol and a disposable profile; no browser libraries.
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
(async()=>{
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'cocktails-print-'));
  const edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',[
    '--headless','--disable-gpu','--allow-file-access-from-files','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'
  ],{windowsHide:true,stdio:'ignore'});
  let socket;
  try{
    let port;
    for(let i=0;i<150;i++){
      try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await pause();}
    }
    assert(port,'Edge DevTools did not start');
    const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    let id=0;const pending=new Map();
    socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const waiter=pending.get(message.id);pending.delete(message.id);if(message.error)waiter.reject(message.error);else waiter.resolve(message.result);}};
    const call=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});
    const evaluate=async expression=>{
      const response=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(response.exceptionDetails)throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result.value;
    };
    const waitFor=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await pause();}throw new Error('Timed out: '+expression);};
    await call('Page.enable');
    await call('Page.navigate',{url:pathToFileURL(path.resolve('tests/shopping-print-browser.html')).href});
    await waitFor(`document.getElementById('result')?.textContent.match(/^(PASS|FAIL)/)?.[0]`);
    const result=await evaluate(`document.getElementById('result').textContent`);
    assert(result.startsWith('PASS'),result);console.log(result);
    const shortFixture=await evaluate('window.shortFixture');
    await call('Page.navigate',{url:pathToFileURL(path.resolve('index.html')).href});
    await waitFor(`typeof prepareShoppingPrint==='function' && !!document.getElementById('printShoppingBtn') && !!els.shoppingPrint`);
    await call('Emulation.setEmulatedMedia',{media:'print'});
    const pdfs=[];
    for(const location of ['Hemma','Stugan','Hemma/Stugan']){
      await evaluate(`restoreBackup(normalizeBackup(${JSON.stringify(shortFixture)}));state.shoppingLocation=${JSON.stringify(location)};document.body.dataset.printTarget='shopping';prepareShoppingPrint()`);
      const {data}=await call('Page.printToPDF',{preferCSSPageSize:true,displayHeaderFooter:false,printBackground:false});
      const buffer=Buffer.from(data,'base64');
      assert(buffer.toString('latin1').startsWith('%PDF-'),'Invalid PDF');
      const pages=(buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
      assert.equal(pages,1,'Short list should fit one A4 page');
      const filename=path.join(os.tmpdir(),`cocktails-shopping-${location.replace('/','-')}.pdf`);
      await fs.writeFile(filename,buffer);pdfs.push(filename);
    }
    const longFixture={inventory:[],ingredientVariants:[],ingredientTypes:[],recipes:[]};
    for(let i=0;i<100;i++){
      const type=`Ingrediens ${String(i).padStart(3,'0')}`;
      longFixture.ingredientTypes.push({id:`t${i}`,type,category:'Övrigt'});
      longFixture.recipes.push({id:`r${i}`,name:`Drink ${i} med ett långt namn som behöver få plats under ingrediensen`,category:'Recept',ingredients:[{type,amount:1,unit:'cl',optional:false}],instructions:'Blanda.',sourceUrl:''});
    }
    await evaluate(`restoreBackup(normalizeBackup(${JSON.stringify(longFixture)}));state.shoppingLocation='Hemma/Stugan';document.body.dataset.printTarget='shopping';prepareShoppingPrint()`);
    assert.equal(await evaluate(`document.querySelectorAll('#shoppingPrint li').length`),100);
    const {data}=await call('Page.printToPDF',{preferCSSPageSize:true,displayHeaderFooter:false,printBackground:false});
    const buffer=Buffer.from(data,'base64'),source=buffer.toString('latin1');
    const pages=(source.match(/\/Type\s*\/Page\b/g)||[]).length;
    assert(pages>=3,'Long list must paginate');
    const boxes=[...source.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
    assert(boxes.length && boxes.every(box=>Math.abs(Number(box[1])-595)<2 && Math.abs(Number(box[2])-842)<2),'PDF must use A4');
    const filename=path.join(os.tmpdir(),'cocktails-shopping-long.pdf');await fs.writeFile(filename,buffer);pdfs.push(filename);
    console.log(`PASS: real PDF output for all three locations; short lists 1 A4 page, 100 ingredients ${pages} A4 pages`);
    pdfs.forEach(filename=>console.log(filename));
  }finally{
    if(socket)socket.close();edge.kill();
    await new Promise(resolve=>{if(edge.exitCode!==null)resolve();else{edge.once('exit',resolve);setTimeout(resolve,3000);}});
    const resolvedProfile=path.resolve(profile),tempRoot=path.resolve(os.tmpdir());
    assert(path.dirname(resolvedProfile)===tempRoot && path.basename(resolvedProfile).startsWith('cocktails-print-'),'Unexpected browser profile path');
    try{await fs.rm(resolvedProfile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch{}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
