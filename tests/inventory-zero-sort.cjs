const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function app(data) {
  const storage = new Map([['cocktails:data:v1', JSON.stringify(data)]]);
  const context = vm.createContext({ localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) }, document: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
  return { run: code => vm.runInContext(code, context), storage };
}
const stock = (id, unit, amount = 0, variantId = '', location = 'Hemma') => ({ id, type: 'Gin', category: 'Sprit', name: id, amount, unit, location, ...(variantId ? {variantId} : {}) });
const requirement = (unit, variantId = '', optional = false) => ({ type: 'Gin', amount: 1, unit, optional, ...(variantId ? {variantId} : {}) });
const recipe = ingredients => ({ id: 'drink', name: 'Drink', category: 'Recept', instructions: 'Rör.', sourceUrl: '', ingredients });
for (const unit of ['cl', 'ml', 'l', 'st', 'stänk']) {
  const data = { inventory: [stock('zero', unit)], recipes: [recipe([requirement(unit)])], ingredientVariants: [{id:'pink',type:'Gin',name:'Pink'}, {id:'other',type:'Gin',name:'Other'}] };
  const a = app(data), run = a.run;
  const json = code => JSON.parse(run(`JSON.stringify(${code})`));
  assert.equal(run('getFilteredInventory().length'), 1, 'Zero stock must remain visible');
  assert.equal(run('getRecipeStatus(state.data.recipes[0]).canMake'), false, `0 ${unit} must not be available`);
  assert.equal(run('getRecipeStatus(state.data.recipes[0]).missing.length'), 1);
  assert.equal(run(`getShoppingList('Hemma').length`), 1);
  run(`state.data.inventory.push(${JSON.stringify(stock('positive', unit, 2, 'pink'))})`);
  assert.equal(run('getRecipeStatus(state.data.recipes[0]).canMake'), true, 'Variant stock must fulfill generic requirement');
  assert.equal(run(`getShoppingList('Hemma').length`), 0);
  run(`state.data.recipes[0].ingredients[0].variantId = 'other'`);
  assert.equal(run('getRecipeStatus(state.data.recipes[0]).canMake'), false, 'Wrong positive variant must not match');
  assert.equal(run(`getShoppingList('Hemma').length`), 1);
  run(`state.data.inventory[0].variantId = 'other'`);
  assert.equal(run('getRecipeStatus(state.data.recipes[0]).canMake'), false, 'Specific zero variant must not match');
  run(`render = () => {}; updateInventory('zero', {amount: 2})`);
  assert.equal(run('getRecipeStatus(state.data.recipes[0]).canMake'), true, 'Refill must restore availability');
  assert.equal(run(`getShoppingList('Hemma').length`), 0);
  assert.equal(run(`getShoppingList('Stugan').length`), 1, 'Stock is location-specific');
  run(`updateInventory('zero', {amount: 0}); state.data.recipes[0].ingredients[0].optional = true`);
  assert.equal(run('getRecipeStatus(state.data.recipes[0]).canMake'), true);
  assert.equal(run(`getShoppingList('Hemma').length`), 0, 'Optional zero ingredient must not be listed');
  run('persist(); globalThis.backup = JSON.parse(JSON.stringify(createBackup())); globalThis.imported = normalizeBackup(backup)');
  assert.deepEqual(json('imported.data.inventory'), json('state.data.inventory'));
  assert.equal(run('imported.data.inventory[0].amount'), 0);
  const reload = app(JSON.parse(a.storage.get('cocktails:data:v1')));
  assert.equal(reload.run('state.data.inventory.length'), 2);
  assert.equal(reload.run('state.data.inventory[0].amount'), 0);
}
const a = app({inventory:[], recipes:[]}), run = a.run;
const order = ['Sprit','Likör','Vermouth & Starkvin','Bitters & Smaksättare','Juice & Syrup','Mixer','Garnityr','Övrigt','Annat','Åkategori','Äkategori','Ökategori'];
const inventory = order.map((category, i) => ({...stock(String(i), 'cl'),category})).reverse();
// Use raw display data here: existing import normalization is outside sorting's scope.
run(`state.data.inventory = ${JSON.stringify(inventory)}; globalThis.before = JSON.stringify(state.data.inventory)`);
assert.deepEqual(JSON.parse(run('JSON.stringify(getFilteredInventory().map(e => e.category))')), order);
assert.equal(run('JSON.stringify(state.data.inventory) === before'), true, 'Display must not reorder source data');
const names = ['Z','Å','Ä','Ö'];
const swedish = names.flatMap(type => names.map(name => ({...stock(type + name, 'st'),type,name}))).reverse();
run(`state.data.inventory = ${JSON.stringify(swedish)}`);
assert.deepEqual(JSON.parse(run('JSON.stringify(getFilteredInventory().map(e => e.id))')), names.flatMap(type => names.map(name => type + name)));
run(`state.filters = {location:'Hemma',category:'Sprit',type:'Å',search:'ä'}`);
assert.deepEqual(JSON.parse(run('JSON.stringify(getFilteredInventory().map(e => e.id))')), ['ÅÄ']);
console.log('PASS: zero balances in all recipe units, mixed stock, variants, refill, location/optional rules, reload/JSON, category and Swedish sorting, filters and unchanged source order');
