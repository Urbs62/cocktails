const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const fixture = {
  ingredientTypes: [{ id: 'fig-type', type: 'Fikokör', category: 'Likör' }, { id: 'gin', type: 'Gin', category: 'Sprit' }],
  ingredientVariants: [{ id: 'fig-variant', type: 'Fikokör', name: 'Hemgjord' }],
  inventory: [{ id: 'fig-stock', type: 'Fikokör', category: 'Likör', variantId: 'fig-variant', name: 'Flaskan', amount: 20, unit: 'cl', location: 'Hemma', note: 'Behåll' }],
  recipes: [{ id: 'fig-drink', name: 'Fikon', category: 'Recept', instructions: 'Rör om.', sourceUrl: '', ingredients: [
    { type: 'Fikokör', variantId: 'fig-variant', amount: 2, unit: 'cl', optional: false, note: 'Behåll' },
    { type: 'Fikokör', amount: 1, unit: 'cl', optional: false }
  ] }]
};
function app(data) {
  const storage = new Map([['cocktails:data:v1', JSON.stringify(data)]]);
  const context = vm.createContext({ localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }, document: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
  return { storage, run: code => vm.runInContext(code, context) };
}
const a = app(fixture);
const run = a.run;
const json = code => JSON.parse(run(`JSON.stringify(${code})`));
// Keep real persistence and domain logic; isolate UI refreshes for this data test.
run(`globalThis.refreshes = []; refreshTypeControls = (...args) => refreshes.push(args); render = () => {};`);
const before = json('createBackup()');
for (const name of ['', '  ', 'gIN', ' GIN ']) {
  assert.ok(run(`renameIngredientType('fig-type', ${JSON.stringify(name)})`));
  assert.deepEqual(json('createBackup()'), before, 'Rejected rename must not change data');
}
assert.ok(run(`renameIngredientType('missing', 'Nytt')`));
assert.equal(run(`canMakeAt(state.data.recipes[0], 'Hemma')`), true);
assert.equal(run(`canMakeAt(state.data.recipes[0], 'Stugan')`), false);
const shoppingBefore = json(`getShoppingList('Stugan')`);
assert.equal(run(`renameIngredientType('fig-type', '  Fikonlikör  ')`), '');
const expected = JSON.parse(JSON.stringify(before).replaceAll('Fikokör', 'Fikonlikör'));
assert.deepEqual(json('createBackup()'), expected, 'Only the type name should change');
assert.deepEqual(json('refreshes'), [['Fikokör', 'Fikonlikör']]);
assert.equal(run(`canMakeAt(state.data.recipes[0], 'Hemma')`), true);
assert.equal(run(`canMakeAt(state.data.recipes[0], 'Stugan')`), false);
assert.deepEqual(json(`getShoppingList('Hemma')`), []);
assert.deepEqual(json(`getShoppingList('Stugan')`), JSON.parse(JSON.stringify(shoppingBefore).replaceAll('Fikokör', 'Fikonlikör')));
run('globalThis.imported = normalizeBackup(JSON.parse(JSON.stringify(createBackup())))');
assert.deepEqual(json('imported.data.recipes'), expected.recipes);
assert.deepEqual(json('imported.data.inventory'), expected.inventory);
assert.deepEqual(json('imported.ingredientTypes'), expected.ingredientTypes);
assert.deepEqual(json('imported.ingredientVariants'), expected.ingredientVariants);
const reload = app(JSON.parse(a.storage.get('cocktails:data:v1')));
assert.equal(reload.run(`getIngredientDefinition('Fikonlikör').id`), 'fig-type');
assert.equal(reload.run(`getIngredientDefinition('Fikokör')`), null);
assert.equal(reload.run(`canMakeAt(state.data.recipes[0], 'Hemma')`), true);
assert.equal(run(`renameIngredientType('fig-type', 'FIKONLIKÖR')`), '', 'Case-only correction is allowed');
assert.equal(run(`state.data.inventory[0].type`), 'FIKONLIKÖR');
console.log('PASS: rename used type, preserved IDs/metadata, validation, case correction, variants, matching, shopping, persistence/reload and JSON export/import');
