const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app(data, extra = {}, failingKey = '') {
  const storage = new Map(Object.entries(extra));
  storage.set('cocktails:data:v1', JSON.stringify(data));
  const context = vm.createContext({
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => {
      if (key === failingKey) throw new Error('Storage write failed');
      storage.set(key, String(value));
    }},
    document: {addEventListener() {}}, console
  });
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
  return {run: code => vm.runInContext(code, context), storage};
}
const clone = value => JSON.parse(JSON.stringify(value));
const types = [
  {id:'vodka-type',type:'Vodka',category:'Sprit'}, {id:'gin-type',type:'Gin',category:'Sprit'},
  {id:'flavored-vodka',type:'Smaksatt Vodka',category:'Sprit'},
  {id:'flavored-gin',type:'Smaksatt Gin',category:'Sprit'},
  {id:'flavored-whisky',type:'Smaksatt Whisky',category:'Sprit'}
];
const stock = (id,type,name,location='Hemma') => ({id,type,name,amount:33,unit:'cl',category:'Sprit',location,note:'Keep note',custom:{keep:true}});
const fixture = {
  ingredientTypes: types, ingredientVariants: [], settings:{custom:'keep'},schemaVersion:2,
  inventory:[stock('r','Smaksatt Vodka','Rabarbervodka'),stock('p','Smaksatt Vodka','Absolut Pears','Stugan'),stock('b','Smaksatt Gin','Gibsons Blood Orange Gin'),stock('w','Smaksatt Whisky','Honey')],
  recipes:[{id:'plain-recipe',name:'Keep',category:'Recept',ingredients:[{type:'Vodka',amount:5,unit:'cl',optional:false}],instructions:'Keep',sourceUrl:''}]
};
const migrated = app(fixture);
const snapshot = JSON.parse(migrated.storage.get('cocktails:data:v1'));
const expected = {r:['Vodka','Rhubarb'],p:['Vodka','Pear'],b:['Gin','Blood Orange']};
for (const entry of snapshot.inventory) {
  if (!expected[entry.id]) {assert.deepEqual(entry,fixture.inventory.find(e=>e.id===entry.id));continue;}
  const [type,name] = expected[entry.id];
  assert.equal(entry.type,type);
  const variant = snapshot.ingredientVariants.find(v=>v.id===entry.variantId);
  assert.equal(variant.type,type);assert.equal(variant.name,name);
  const {variantId,...rest} = entry;
  assert.deepEqual(rest,{...fixture.inventory.find(e=>e.id===entry.id),type});
}
assert.deepEqual(snapshot.recipes,fixture.recipes);
assert.deepEqual(snapshot.settings,fixture.settings);
assert.deepEqual([...snapshot.ingredientTypes].sort((a,b)=>a.id.localeCompare(b.id)),types.filter(t=>!['flavored-vodka','flavored-gin'].includes(t.id)).sort((a,b)=>a.id.localeCompare(b.id)));
assert.equal(snapshot.ingredientVariants.length,3);
const reloaded = app(snapshot);
assert.equal(reloaded.storage.get('cocktails:data:v1'),JSON.stringify(snapshot),'Reload must be idempotent');
reloaded.run('globalThis.exported = JSON.parse(JSON.stringify(createBackup())); globalThis.imported = normalizeBackup(exported)');
assert.equal(reloaded.run('JSON.stringify(imported.data) === JSON.stringify({inventory:exported.inventory,recipes:exported.recipes})'),true);
assert.equal(reloaded.run('JSON.stringify(imported.ingredientVariants) === JSON.stringify(exported.ingredientVariants)'),true);

// Every stock flavor must work alone for generic requirements; no cross-flavor matching.
const matching = app({inventory:[],recipes:[],ingredientVariants:snapshot.ingredientVariants});
for (const [id,[type]] of Object.entries(expected)) {
  const entry = snapshot.inventory.find(e=>e.id===id);
  matching.run(`state.data.inventory = [${JSON.stringify(entry)}]`);
  assert.equal(matching.run(`hasIngredient(ingredient(${JSON.stringify(type)},5,'cl'),'${entry.location}')`),true);
  assert.equal(matching.run(`hasIngredient(ingredient(${JSON.stringify(type)},5,'cl',false,${JSON.stringify(entry.variantId)}),'${entry.location}')`),true);
  for (const other of snapshot.ingredientVariants.filter(v=>v.id!==entry.variantId && v.type===type)) {
    assert.equal(matching.run(`hasIngredient(ingredient(${JSON.stringify(type)},5,'cl',false,${JSON.stringify(other.id)}),'${entry.location}')`),false);
  }
}
for (const type of ['Vodka','Gin']) {
  matching.run(`state.data.inventory = [${JSON.stringify(stock('plain',type,'Plain'))}]`);
  assert.equal(matching.run(`hasIngredient(ingredient('${type}',5,'cl'),'Hemma')`),true);
  for (const variant of snapshot.ingredientVariants.filter(v=>v.type===type)) {
    assert.equal(matching.run(`hasIngredient(ingredient('${type}',5,'cl',false,'${variant.id}'),'Hemma')`),false);
  }
}

const reused = clone(fixture);
reused.ingredientVariants=[{id:'existing-rhubarb',type:'Vodka',name:'Rhubarb'}];
assert.equal(app(reused).run('state.data.inventory[0].variantId'),'existing-rhubarb');
// Explicit old variant references are migrated together, preserving the variant ID.
const linked = clone(fixture);
linked.ingredientVariants=[{id:'legacy-rhubarb',type:'Smaksatt Vodka',name:'Rabarbervodka'}];
linked.inventory[0].variantId='legacy-rhubarb';
linked.recipes[0].ingredients=[{type:'Smaksatt Vodka',variantId:'legacy-rhubarb',amount:5,unit:'cl',optional:false}];
const linkedApp=app(linked);
assert.equal(linkedApp.run('state.data.inventory[0].variantId'),'legacy-rhubarb');
assert.equal(linkedApp.run('state.data.recipes[0].ingredients[0].type'),'Vodka');
assert.equal(linkedApp.run('state.data.recipes[0].ingredients[0].variantId'),'legacy-rhubarb');
assert.equal(linkedApp.run('getRecipeStatus(state.data.recipes[0]).canMake'),true);
// Unknown products remain old; the type must remain while referenced.
const unknown=clone(fixture);
unknown.inventory.push(stock('unknown','Smaksatt Vodka','Unknown flavor'));
const unknownApp=app(unknown);
assert.equal(unknownApp.run('state.data.inventory.find(e=>e.id === "unknown").type'),'Smaksatt Vodka');
assert.equal(unknownApp.run('ingredientTypesStore.some(t=>t.type === "Smaksatt Vodka")'),true);
// Generic old recipes and conflicting variant IDs require a decision. Defer that type.
for (const variantId of ['', 'unrecognized']) {
  const ambiguous=clone(fixture);
  ambiguous.recipes[0].ingredients=[{type:'Smaksatt Vodka',amount:5,unit:'cl',...(variantId?{variantId}:{})}];
  if(variantId) ambiguous.ingredientVariants=[{id:variantId,type:'Smaksatt Vodka',name:'Unknown flavor'}];
  const kept=app(ambiguous);
  assert.equal(kept.run('state.data.inventory[0].type'),'Smaksatt Vodka');
  assert.equal(kept.run('ingredientTypesStore.some(t=>t.type === "Smaksatt Vodka")'),true);
}
const conflict=clone(linked);
conflict.ingredientVariants.push({id:'other-rhubarb',type:'Vodka',name:'Rhubarb'});
assert.equal(app(conflict).run('state.data.inventory[0].type'),'Smaksatt Vodka');
const aliasConflict=clone(linked);
aliasConflict.ingredientVariants.push({id:'other-rhubarb',type:'Smaksatt Vodka',name:'Rhubarb'});
assert.equal(app(aliasConflict).run('state.data.inventory[0].type'),'Smaksatt Vodka');
const baseOnly={inventory:[stock('plain','Vodka','Absolut Vodka')],recipes:[],ingredientTypes:types.filter(t=>['Vodka','Gin'].includes(t.type)),ingredientVariants:[]};
const base=app(baseOnly);
assert.equal(base.storage.get('cocktails:data:v1'),JSON.stringify(baseOnly),'No test bottles or unnecessary definitions');
const failedSave=app(fixture,{},'cocktails:data:v1');
assert.equal(failedSave.storage.get('cocktails:data:v1'),JSON.stringify(fixture),'Failed save must preserve source snapshot');
assert.equal(failedSave.run('state.data.inventory[0].type'),'Smaksatt Vodka');
assert.equal(failedSave.run('state.data.inventory.length'),fixture.inventory.length,'Failed save must not load demo data');
const failedMirror=app(fixture,{},'cocktails:ingredientVariants:v1');
assert.equal(failedMirror.run('state.data.inventory[0].type'),'Vodka');
assert.equal(app(JSON.parse(failedMirror.storage.get('cocktails:data:v1'))).run('state.data.inventory[0].variantId'),failedMirror.run('state.data.inventory[0].variantId'));
// Import older JSON with or without an explicit type registry; input is never mutated.
const importApp=app(baseOnly);
for (const includeRegistry of [true,false]) {
  const old=clone(fixture); if(!includeRegistry) delete old.ingredientTypes;
  importApp.run(`globalThis.old = ${JSON.stringify(old)}; globalThis.oldText = JSON.stringify(old); globalThis.converted = normalizeBackup(old)`);
  assert.equal(importApp.run('converted.data.inventory[0].type'),'Vodka');
  assert.equal(importApp.run('converted.ingredientVariants.length'),3);
  assert.equal(importApp.run('JSON.stringify(old) === oldText'),true);
  assert.equal(importApp.run('JSON.stringify(state.data.inventory)'),JSON.stringify(baseOnly.inventory));
}
console.log('PASS: flavored Vodka/Gin migration, matching, existing IDs, metadata, legacy imports, reload/export/import, unknown/ambiguous guards and unchanged ordinary data');
