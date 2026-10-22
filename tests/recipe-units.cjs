const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const storage = new Map();
const context = vm.createContext({
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  document: { addEventListener() {}, createElement: () => ({ dataset: {} }) }
});
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
const run = code => vm.runInContext(code, context);
// Exercise the actual editor row builder with lightweight DOM fields.
run(`
  ingredientTypesStore.push({ id: 'orange-bitters', type: 'Angostura Orange Bitters', category: 'Bitter' });
  globalThis.rows = [];
  el = () => {
    const fields = new Map();
    return { innerHTML: '', querySelector(selector) {
      if (!fields.has(selector)) fields.set(selector, { value: '', addEventListener() {} });
      return fields.get(selector);
    }};
  };
  populateIngredientTypeSelect = (select, type) => { select.value = type; };
  populateVariantSelect = () => {};
  els.recipeIngredientRows = { append: row => rows.push(row) };
  addRecipeIngredientRow();
  addRecipeIngredientRow(ingredient('Angostura Orange Bitters', 2, 'stänk'));
`);
assert.equal(run(`rows[0].querySelector('[data-field="unit"]').value`), 'cl');
assert.equal(run(`rows[1].querySelector('[data-field="unit"]').value`), 'stänk');
for (const unit of ['cl', 'ml', 'l', 'st', 'stänk']) {
  assert.ok(run(`rows[0].innerHTML`).includes(`<option value="${unit}">${unit}</option>`));
  run(`globalThis.entry = ingredient('Angostura Orange Bitters', 2, ${JSON.stringify(unit)});
    state.data.recipes = [recipe('Unit test', 'Recept', [entry], 'Rör om.')];
    globalThis.backup = JSON.parse(JSON.stringify(createBackup()));
    globalThis.restored = normalizeBackup(backup);`);
  assert.equal(run('restored.data.recipes[0].ingredients[0].unit'), unit);
  assert.equal(run('JSON.stringify(restored.data.recipes)'), run('JSON.stringify(state.data.recipes)'));
  assert.equal(run('formatIngredient(restored.data.recipes[0].ingredients[0])'), `Angostura Orange Bitters 2 ${unit}`);
  assert.equal(run(`parseIngredientLine('Angostura Orange Bitters 2 ${unit}').unit`), unit);
}
console.log('PASS: recipe unit options, create/edit defaults, card text, JSON round-trip and legacy text import for existing units and stänk');
