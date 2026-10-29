const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = { id: 'source', type: 'Gin', category: 'Sprit', name: 'Beefeater', amount: 70, unit: 'cl', location: 'Hemma', note: 'Keep this note' };
function app(inventory) {
  const storage = new Map([['cocktails:data:v1', JSON.stringify({ inventory, recipes: [] })]]);
  const context = vm.createContext({ localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) }, document: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
  vm.runInContext('render = () => {}; showToast = () => {}', context);
  const run = code => vm.runInContext(code, context);
  return { run, storage, inventory: () => JSON.parse(run('JSON.stringify(state.data.inventory)')) };
}
for (const location of ['Hemma', 'Stugan']) {
  const destination = location === 'Hemma' ? 'Stugan' : 'Hemma';
  const a = app([{ ...source, location }]);
  assert.equal(a.run("transferInventory('source', 20)"), true);
  const [remaining, moved] = a.inventory();
  assert.equal(remaining.amount, 50);
  assert.notEqual(moved.id, source.id);
  assert.deepEqual(moved, { ...source, id: moved.id, amount: 20, location: destination });
  assert.equal(JSON.parse(a.storage.get('cocktails:data:v1')).inventory[1].amount, 20);
  assert.deepEqual(app(a.inventory()).inventory(), a.inventory(), 'Reload retains transfer');
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(normalizeBackup(createBackup()).data.inventory)')), a.inventory(), 'Backup round-trip retains transfer');
  a.run("state.data.recipes = [recipe('Gin drink', 'Recept', [ingredient('Gin', 30, 'cl')], '')]");
  assert.equal(a.run(`canMakeAt(state.data.recipes[0], '${location}')`), true);
  assert.equal(a.run(`canMakeAt(state.data.recipes[0], '${destination}')`), false);
  assert.equal(a.run("transferInventory('source', 50)"), true);
  assert.equal(a.inventory().length, 1);
  assert.equal(a.inventory()[0].amount, 70);
  assert.equal(a.run(`canMakeAt(state.data.recipes[0], '${location}')`), false);
  assert.equal(a.run(`canMakeAt(state.data.recipes[0], '${destination}')`), true);
}
const full = app([source]);
assert.equal(full.run("transferInventory('source', 70)"), true);
assert.deepEqual(full.inventory(), [{ ...source, location: 'Stugan' }], 'Full move retains original card identity');
const merge = app([source, { ...source, id: 'destination', location: 'Stugan', amount: 5 }]);
merge.run("transferInventory('source', 12.5)");
assert.deepEqual(merge.inventory().map(e => e.amount), [57.5, 17.5]);
for (const difference of [{ type: 'Vodka' }, { name: 'Other gin' }, { variantId: 'pink' }, { unit: 'ml' }]) {
  const a = app([source, { ...source, id: 'other', location: 'Stugan', ...difference }]);
  a.run("transferInventory('source', 10)");
  assert.equal(a.inventory().length, 3, 'Different product/type/variant/unit must not merge');
  assert.equal(a.inventory()[1].amount, 70);
}
for (const amount of ['0', '-1', '71', 'NaN', 'Infinity', "''", 'null', 'undefined', "'20'"]) {
  const a = app([source]);
  const before = a.inventory();
  const saved = a.storage.get('cocktails:data:v1');
  assert.equal(a.run(`transferInventory('source', ${amount})`), false);
  assert.deepEqual(a.inventory(), before);
  assert.equal(a.storage.get('cocktails:data:v1'), saved);
}
assert.equal(app([{ ...source, amount: 0 }]).run("transferInventory('source', 1)"), false);
assert.equal(app([source]).run("transferInventory('missing', 1)"), false);
// Exercise the card's actual submit handler, defaults and validation wiring.
const ui = app([source]);
ui.run(`
  globalThis.fields = {};
  el = () => ({ innerHTML: '', querySelector(selector) {
    return fields[selector] ||= { valueAsNumber: 0, addEventListener(event, fn) { this[event] = fn; },
      setCustomValidity(message) { this.error = message; }, reportValidity() { this.reported = true; } };
  }});
  globalThis.card = renderInventoryCard(state.data.inventory[0]);
`);
assert.match(ui.run('card.innerHTML'), /max="70" value="70"/);
assert.match(ui.run('card.innerHTML'), /Flytta till Stugan/);
ui.run(`fields['.inventory-transfer'].submit({ preventDefault() {} })`);
assert.equal(ui.run(`fields['[data-field="transfer-amount"]'].reported`), true);
ui.run(`fields['[data-field="transfer-amount"]'].input()`);
assert.equal(ui.run(`fields['[data-field="transfer-amount"]'].error`), '');
ui.run(`fields['[data-field="transfer-amount"]'].valueAsNumber = 20; fields['.inventory-transfer'].submit({ preventDefault() {} })`);
assert.deepEqual(ui.inventory().map(e => e.amount), [50, 20]);
console.log('PASS: partial/full transfers both ways, merging, product identity, invalid amounts, persistence/backup, recipe availability and transfer UI');
