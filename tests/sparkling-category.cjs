const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function app(data) {
  const storage=new Map([['cocktails:data:v1',JSON.stringify(data)]]);
  const context=vm.createContext({localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener(){}}});
  vm.runInContext(fs.readFileSync('app.js','utf8'),context);
  return {run:code=>vm.runInContext(code,context),storage};
}
const fixture={ingredientTypes:[{id:'gin',type:'Gin',category:'Sprit'}],ingredientVariants:[],
  inventory:[{id:'gin-stock',type:'Gin',category:'Sprit',name:'Gin',amount:20,unit:'cl',location:'Hemma'}],
  recipes:[{id:'gin-recipe',name:'Gin',category:'Recept',ingredients:[{type:'Gin',amount:2,unit:'cl',optional:false}],instructions:'Rör.',sourceUrl:''}]};
const a=app(fixture),run=a.run;
const json=code=>JSON.parse(run(`JSON.stringify(${code})`));
assert.deepEqual(json('state.data'),{inventory:fixture.inventory,recipes:fixture.recipes});
assert.deepEqual(json('ingredientTypesStore'),fixture.ingredientTypes,'Adding a category must not create types');
assert.equal(run(`CATEGORY_OPTIONS.includes('Mousserande vin')`),true);
assert.equal(run(`INVENTORY_CATEGORY_ORDER.indexOf('Mousserande vin')`),run(`INVENTORY_CATEGORY_ORDER.indexOf('Vermouth & Starkvin')+1`));
run(`refreshTypeControls=()=>{}; render=()=>{}; resetTypeForm=()=>{};
  els.newTypeName={value:'Prosecco'}; els.newTypeCategory={value:'Mousserande vin'};
  saveTypeFromForm({preventDefault(){}});
  state.data.inventory.push({...item('Prosecco','Bubbel',75,'cl','Hemma'),id:'bubbles'}); persist();`);
assert.equal(run(`getIngredientCategory('Prosecco')`),'Mousserande vin');
assert.deepEqual(json('state.data.inventory[0]'),fixture.inventory[0]);
assert.deepEqual(json('state.data.recipes'),fixture.recipes);
run(`state.filters.category='Mousserande vin'`);
assert.deepEqual(json('getFilteredInventory().map(entry=>entry.id)'),['bubbles']);
run(`globalThis.backup=JSON.parse(JSON.stringify(createBackup())); globalThis.imported=normalizeBackup(backup)`);
assert.deepEqual(json('imported.ingredientTypes'),json('backup.ingredientTypes'));
assert.deepEqual(json('imported.data.inventory'),json('backup.inventory'));
assert.deepEqual(json('imported.data.recipes'),json('backup.recipes'));
const reload=app(JSON.parse(a.storage.get('cocktails:data:v1')));
assert.equal(reload.run(`getIngredientCategory('Prosecco')`),'Mousserande vin');
assert.equal(reload.run(`state.data.inventory[1].category`),'Mousserande vin');
assert.equal(run(`renameIngredientType('gin','Gin','Mousserande vin')`),'');
assert.equal(run(`state.data.inventory[0].category`),'Mousserande vin','Explicit type category edit must refresh its inventory category');
assert.equal(run(`state.data.inventory[0].id`),'gin-stock');
assert.deepEqual(json('state.data.recipes'),fixture.recipes);
const before=run('JSON.stringify(createBackup())');
assert.ok(run(`renameIngredientType('gin','Gin','Invalid')`));
assert.equal(run('JSON.stringify(createBackup())'),before);
const defaults=app({inventory:[],recipes:[]});
assert.equal(defaults.run(`ingredientTypesStore.some(entry=>entry.type==='Prosecco'||entry.type==='Champagne')`),false);
console.log('PASS: sparkling category registry, no automatic types, type creation/edit, inventory/filter, unchanged existing data, reload and JSON round-trip');
