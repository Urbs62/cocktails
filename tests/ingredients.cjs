const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app(data, extra = {}) {
  const storage = new Map(Object.entries(extra));
  if (data) storage.set('cocktails:data:v1', JSON.stringify(data));
  const context = vm.createContext({
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    document: { addEventListener() {}, createElement: () => ({ dataset: {} }) },
    console, setTimeout, clearTimeout
  });
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
  return { run: code => vm.runInContext(code, context), storage };
}
const legacy = {
  inventory: [
    { id: 'rhubarb', type: 'Vodka', category: 'Sprit', name: 'Rhubarb Vodka', amount: 70, unit: 'cl', location: 'Hemma', note: 'Hemgjord' },
    { id: 'swedish', type: 'Vodka', category: 'Sprit', name: 'Rabarbervodka', amount: 70, unit: 'cl', location: 'Hemma' },
    { id: 'plain', type: 'Vodka', category: 'Sprit', name: 'Absolut Vodka', amount: 70, unit: 'cl', location: 'Stugan' },
    { id: 'gin', type: 'Gin', category: 'Sprit', name: 'Beefeater', amount: 70, unit: 'cl', location: 'Hemma' },
    { id: 'tonic', type: 'Tonic', category: 'Mixer', name: 'Tonic', amount: 4, unit: 'st', location: 'Hemma' }
  ],
  recipes: [{ id: 'gt', name: 'Gin & Tonic', category: 'Highball', ingredients: [{ type: 'Gin', amount: 5, unit: 'cl', optional: false }, { type: 'Tonic', amount: 1, unit: 'st', optional: false }], instructions: 'Bygg med is.', sourceUrl: '' }]
};
const { run, storage } = app(legacy);
assert.equal(run('ingredientVariantsStore.length'), 0);
assert.deepEqual(JSON.parse(run('JSON.stringify(state.data)')), legacy);
assert.equal(storage.get('cocktails:data:v1'), JSON.stringify(legacy));
assert.equal(run('getRecipeStatus(state.data.recipes[0]).canMake'), true);
run(`ingredientVariantsStore = [{id: 'r', type: 'Vodka', name: 'Rhubarb Vodka'}, {id: 'e', type: 'Tonic', name: 'Elderflower Tonic'}];
globalThis.rhubarbRecipe = recipe('Rhubarb & Elderflower Tonic', 'Recept', [ingredient('Vodka', 5, 'cl', false, 'r'), ingredient('Tonic', 12, 'cl', false, 'e'), ingredient('Citronjuice', 2, 'cl')], 'Bygg med is.');
state.data.recipes.push(rhubarbRecipe); persist();`);
assert.equal(run('state.data.recipes.length'), 2);
assert.equal(run('getRecipeStatus(rhubarbRecipe).canMake'), false);
assert.equal(run('hasIngredient(ingredient("Vodka", 5, "cl", false, "r"), "Hemma")'), false);
run(`state.data.inventory.push(item('Tonic', 'Flädertonic', 20, 'cl', 'Hemma'), item('Citronjuice', 'Citronjuice', 10, 'cl', 'Hemma'));
state.data.inventory.find(entry => entry.name === 'Flädertonic').variantId = 'e';
state.data.inventory.find(entry => entry.id === 'rhubarb').variantId = 'r';`);
assert.equal(run('getRecipeStatus(rhubarbRecipe).canMake'), true);
assert.equal(run('hasIngredient(ingredient("Vodka", 5, "cl"), "Hemma")'), true);
assert.equal(run('hasIngredient(ingredient("Vodka", 5, "cl", false, "r"), "Stugan")'), false);
assert.equal(run('hasIngredient(ingredient("Vodka", 701, "ml", false, "r"), "Hemma")'), false);
assert.equal(run('canMakeAt({ingredients:[ingredient("Vodka", 110, "cl"), ingredient("Vodka", 40, "cl", false, "r")]}, "Hemma")'), false);
assert.equal(run('canMakeAt({ingredients:[ingredient("Vodka", 100, "cl"), ingredient("Vodka", 40, "cl", false, "r")]}, "Hemma")'), true);
run('state.data.inventory.find(entry => entry.name === "Flädertonic").location = "Stugan"');
assert.equal(run('getRecipeStatus(rhubarbRecipe).canMake'), false);
run('state.data.inventory.find(entry => entry.name === "Flädertonic").location = "Hemma"');
const backup = JSON.parse(run('JSON.stringify(createBackup())'));
run('globalThis.roundtrip = normalizeBackup(createBackup())');
assert.deepEqual(JSON.parse(run('JSON.stringify(roundtrip.data)')), {inventory: backup.inventory, recipes: backup.recipes});
assert.deepEqual(JSON.parse(run('JSON.stringify(roundtrip.ingredientVariants)')), backup.ingredientVariants);
assert.throws(() => run('normalizeBackup({...createBackup(), ingredientVariants: []})'), /Invalid variant reference/);
assert.throws(() => run('normalizeBackup({...createBackup(), ingredientVariants: [...ingredientVariantsStore, ...ingredientVariantsStore]})'), /Invalid ingredient variants/);
assert.throws(() => run('normalizeBackup({...createBackup(), ingredientVariants: {}})'), /Invalid ingredient variants/);
assert.equal(run('ingredientVariantsStore.length'), 2);
run(`globalThis.old = normalizeBackup(${JSON.stringify(legacy)})`);
assert.equal(run('old.ingredientVariants.length'), 0);
assert.deepEqual(JSON.parse(run('JSON.stringify(old.data)')), legacy);
run('globalThis.custom = normalizeBackup({inventory:[],recipes:[{id:"old-recipe",name:"Special",ingredients:[{type:"Specialjuice",amount:2,unit:"cl"}]}]})');
assert.equal(run('custom.ingredientTypes.some(entry => entry.type === "Specialjuice")'), true);
run('restorePanelState = resetInventoryForm = resetRecipeForm = resetTypeForm = refreshTypeControls = render = showRestoreLog = () => {}; restoreBackup(roundtrip)');
const snapshot = JSON.parse(storage.get('cocktails:data:v1'));
assert.deepEqual(snapshot.ingredientVariants, backup.ingredientVariants);
assert.deepEqual(snapshot.ingredientTypes, backup.ingredientTypes);
const reloaded = app(snapshot, {'cocktails:ingredientVariants:v1': JSON.stringify([{id:'stale',name:'Stale',type:'Gin'}])});
assert.equal(reloaded.run('ingredientVariantsStore[0].id'), 'r');
assert.equal(reloaded.run('getRecipeStatus(state.data.recipes[1]).canMake'), true);
const empty = app({inventory:[],recipes:[],ingredientVariants:[]}, {'cocktails:ingredientVariants:v1': JSON.stringify(backup.ingredientVariants)});
assert.equal(empty.run('ingredientVariantsStore.length'), 0);
const split = app(legacy, {'cocktails:ingredientVariants:v1': JSON.stringify(backup.ingredientVariants)});
assert.equal(split.run('ingredientVariantsStore.length'), 2);
assert.equal(split.run('state.data.inventory[0].variantId'), undefined);
console.log('PASS: explicit linking, Rhubarb & Elderflower Tonic, generic/specific matching, quantities, locations, Gin & Tonic, legacy backups, restore and reload consistency');

const deletion = app({
  inventory: [{id:'pink-stock',type:'Tonic',name:'Schweppes',amount:50,unit:'cl',location:'Hemma',variantId:'pink'}],
  recipes: [{id:'pink-recipe',name:'Pink',ingredients:[{type:'Tonic',amount:10,unit:'cl',variantId:'pink'}]}],
  ingredientVariants: [{id:'unused',type:'Cointreau',name:'Cointreau'},{id:'pink',type:'Tonic',name:'Pink Grapefruit Tonic'}]
});
deletion.run(`
ingredientVariantsStore.push({id:'unused',type:'Cointreau',name:'Cointreau'});
globalThis.alerts = []; globalThis.confirmations = [];
alert = message => alerts.push(message);
confirm = message => { confirmations.push(message); return globalThis.approved; };
refreshTypeControls = showToast = () => {};
els.inventoryVariant = {value:'unused'};
els.recipeIngredientRows = {querySelectorAll: () => []};
globalThis.originalData = JSON.stringify(state.data);
globalThis.originalTypes = JSON.stringify(ingredientTypesStore);
approved = true;
deleteIngredientVariant('pink');
`);
assert.equal(deletion.run('alerts.length'), 1);
assert.equal(deletion.run('confirmations.length'), 0);
assert.equal(deletion.run('ingredientVariantsStore.length'), 2);
deletion.run(`state.data.inventory[0].variantId = ''; deleteIngredientVariant('pink');`);
assert.equal(deletion.run('alerts.length'), 2, 'Recipe-only use must block deletion');
deletion.run(`state.data.inventory[0].variantId = 'pink'; state.data.recipes[0].ingredients[0].variantId = ''; deleteIngredientVariant('pink');`);
assert.equal(deletion.run('alerts.length'), 3, 'Inventory-only use must block deletion');
deletion.run(`state.data.recipes[0].ingredients[0].variantId = 'pink'; approved = false; deleteIngredientVariant('unused');`);
assert.equal(deletion.run('ingredientVariantsStore.length'), 2, 'Cancel must keep variant');
deletion.run(`approved = true; deleteIngredientVariant('unused');`);
assert.equal(deletion.run('ingredientVariantsStore.length'), 1);
assert.equal(deletion.run('JSON.stringify(state.data) === originalData'), true);
assert.equal(deletion.run('JSON.stringify(ingredientTypesStore) === originalTypes'), true);
assert.equal(deletion.run('els.inventoryVariant.value'), '');
const deletedSnapshot = JSON.parse(deletion.storage.get('cocktails:data:v1'));
assert.deepEqual(JSON.parse(deletion.storage.get('cocktails:ingredientVariants:v1')), deletedSnapshot.ingredientVariants);
assert.equal(app(deletedSnapshot).run('ingredientVariantsStore.some(v => v.id === "unused")'), false);
deletion.run('globalThis.deletionRoundtrip = normalizeBackup(JSON.parse(JSON.stringify(createBackup())))');
assert.equal(deletion.run('deletionRoundtrip.ingredientVariants.some(v => v.id === "unused")'), false);
console.log('PASS: unused Cointreau deletion, cancel, ID-based inventory/recipe guards, unchanged data, localStorage, reload and JSON roundtrip');

const migrationFixture = {
  ...legacy,
  inventory: [
    {id:'plain-tonic',type:'Tonic',name:'Indian Tonic Water',amount:40,unit:'cl',location:'Hemma',category:'Mixer'},
    {id:'pink-tonic',type:'Tonic',variantId:'pink-id',name:'Pink Grapefruit',amount:33,unit:'cl',location:'Hemma',category:'Mixer'}
  ],
  recipes: [{id:'specific',name:'Pink recipe',category:'Recept',ingredients:[{type:'Tonic',amount:10,unit:'cl',optional:false,variantId:'pink-id'}],instructions:'Keep unchanged',sourceUrl:''}],
  ingredientVariants: [
    {id:'pink-id',type:'Tonic',name:'Pink Grapefruit Tonic'},
    {id:'unused-cointreau',type:'Cointreau',name:'Cointreau'}
  ],
  settings: {custom:'preserve'}, schemaVersion:2
};
const migrated = app(migrationFixture);
const migratedRaw = JSON.parse(migrated.storage.get('cocktails:data:v1'));
assert.deepEqual(migratedRaw, {...migrationFixture,ingredientVariants:[{id:'pink-id',type:'Tonic',name:'Pink Grapefruit'}]});
assert.deepEqual(JSON.parse(migrated.run('JSON.stringify(state.data)')), {inventory:migrationFixture.inventory,recipes:migrationFixture.recipes});
assert.equal(migrated.run('getRecipeStatus(state.data.recipes[0]).canMake'), true);
// Test each stock item independently so generic matching cannot hide failures.
migrated.run('globalThis.allStock = state.data.inventory; state.data.inventory = [allStock[0]]');
assert.equal(migrated.run('hasIngredient(ingredient("Tonic",10,"cl"),"Hemma")'), true);
assert.equal(migrated.run('hasIngredient(ingredient("Tonic",10,"cl",false,"pink-id"),"Hemma")'), false);
migrated.run('state.data.inventory = [allStock[1]]');
assert.equal(migrated.run('hasIngredient(ingredient("Tonic",10,"cl"),"Hemma")'), true);
assert.equal(migrated.run('hasIngredient(ingredient("Tonic",10,"cl",false,"pink-id"),"Hemma")'), true);
migrated.run('ingredientVariantsStore.push({id:"other",type:"Tonic",name:"Other"}); state.data.inventory = [{...allStock[1],variantId:"other"}]');
assert.equal(migrated.run('hasIngredient(ingredient("Tonic",10,"cl",false,"pink-id"),"Hemma")'), false);
migrated.run('state.data.inventory = allStock; ingredientVariantsStore.pop()');
const migrationReload = app(migratedRaw, {'cocktails:ingredientVariants:v1':JSON.stringify(migrationFixture.ingredientVariants)});
assert.equal(migrationReload.run('ingredientVariantsStore.length'), 1);
assert.equal(migrationReload.run('ingredientVariantsStore[0].name'), 'Pink Grapefruit');
assert.equal(migrationReload.storage.get('cocktails:data:v1'), JSON.stringify(migratedRaw), 'Reload migration must be idempotent');
migrated.run('globalThis.exported = JSON.parse(JSON.stringify(createBackup())); globalThis.imported = normalizeBackup(exported)');
assert.equal(migrated.run('JSON.stringify(imported.ingredientVariants) === JSON.stringify(exported.ingredientVariants)'), true);
assert.equal(migrated.run('JSON.stringify(imported.data.inventory) === JSON.stringify(exported.inventory)'), true);
assert.equal(migrated.run('JSON.stringify(imported.data.recipes) === JSON.stringify(exported.recipes)'), true);
// Older JSON exports receive the same simplification; source input stays intact.
migrated.run(`globalThis.oldExport = ${JSON.stringify(migrationFixture)}; globalThis.oldImport = normalizeBackup(oldExport)`);
assert.equal(migrated.run('oldImport.ingredientVariants[0].name'), 'Pink Grapefruit');
assert.equal(migrated.run('oldExport.ingredientVariants[0].name'), 'Pink Grapefruit Tonic');
const usedCointreau = JSON.parse(JSON.stringify(migrationFixture));
usedCointreau.recipes.push({id:'c',name:'C',ingredients:[{type:'Cointreau',amount:1,unit:'cl',variantId:'unused-cointreau'}]});
assert.equal(app(usedCointreau).run('ingredientVariantsStore.some(v=>v.id === "unused-cointreau")'), true, 'Used recipe variant must remain');
const stockCointreau = JSON.parse(JSON.stringify(migrationFixture));
stockCointreau.inventory.push({id:'c',type:'Cointreau',name:'C',amount:1,unit:'cl',location:'Hemma',variantId:'unused-cointreau'});
assert.equal(app(stockCointreau).run('ingredientVariantsStore.some(v=>v.id === "unused-cointreau")'), true, 'Used stock variant must remain');
const deletedVariants = {...migrationFixture,inventory:[],recipes:[],ingredientVariants:[]};
assert.equal(app(deletedVariants,{'cocktails:ingredientVariants:v1':JSON.stringify(migrationFixture.ingredientVariants)}).run('ingredientVariantsStore.length'), 0, 'Deleted variants must never be recreated');
const conflict = {...migrationFixture,ingredientVariants:[...migrationFixture.ingredientVariants,{id:'existing-pink',type:'Tonic',name:'Pink Grapefruit'}]};
assert.equal(app(conflict).run('ingredientVariantsStore.find(v=>v.id === "pink-id").name'), 'Pink Grapefruit Tonic', 'Do not merge conflicting IDs');
console.log('PASS: safe variant simplification, preserved IDs/links/products/recipes, generic and specific matching, used Cointreau retained, deleted variants stay deleted, reload and JSON import/export');
