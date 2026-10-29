const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const storage = new Map();
const context = vm.createContext({ localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) }, document: { addEventListener() {}, body: { dataset: {} } }, window: { print() { this.printed = true; } } });
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
const run = code => vm.runInContext(code, context);
const stock = (name, amount, unit, location = 'Hemma', extra = {}) => ({ id: name + amount + unit, type: 'Gin', category: 'Sprit', name, amount, unit, location, ...extra });
const inventory = [
  stock('Zebra', 1, 'l'), stock('Zebra', 250, 'ml'), stock('Zebra', 5, 'cl', 'Stugan'),
  stock('Apple', 2, 'st'), stock('Apple', 3, 'st', 'Stugan'),
  stock('Apple', 4, 'cl', 'Stugan', { variantId: 'pink' }),
  stock('Apple', 6, 'cl', 'Stugan', { variantId: 'dry' }),
  stock('Apple', 7, 'cl', 'Hemma', { type: 'Vodka' }),
  stock('Apple other', 8, 'cl'), stock('<Zero &>', 0, 'cl'),
  stock('Mixed', 10, 'cl'), stock('Mixed', 3, 'st'), stock('Mixed', 2, 'stänk'),
  stock('Å', 1, 'cl'), stock('Ä', 1, 'cl'), stock('Ö', 1, 'cl')
];
run(`state.data.inventory = ${JSON.stringify(inventory)};
  ingredientVariantsStore = [{id:'pink',type:'Gin',name:'Pink'}, {id:'dry',type:'Gin',name:'Dry'}];
  state.filters = {location:'Hemma',search:'unmatched'};
  globalThis.before = JSON.stringify(state.data);
  els.inventoryOverviewPrint = { innerHTML: '' };
  printInventoryOverview();`);
const rows = JSON.parse(run('JSON.stringify(getInventoryOverviewRows())'));
assert.deepEqual(rows.find(r => r.name === 'Zebra · Gin'), { name: 'Zebra · Gin', Hemma: '125', Stugan: '5' });
assert.deepEqual(rows.find(r => r.name === 'Apple · Gin'), { name: 'Apple · Gin', Hemma: '2 st', Stugan: '3 st' });
assert.equal(rows.filter(r => r.name.startsWith('Apple ·')).length, 4, 'Type and variant identities remain separate');
assert.equal(rows.find(r => r.name.endsWith('/ Pink')).Stugan, '4');
assert.equal(rows.find(r => r.name.endsWith('/ Dry')).Stugan, '6');
assert.equal(rows.find(r => r.name === '<Zero &> · Gin').Hemma, '0');
assert.equal(rows.find(r => r.name === '<Zero &> · Gin').Stugan, '—');
assert.equal(rows.find(r => r.name === 'Mixed · Gin').Hemma, '10 + 3 st + 2 stänk');
const ginRows = rows.filter(r => r.name.endsWith(' · Gin'));
assert.deepEqual(ginRows.slice(-3).map(r => r.name), ['Å · Gin', 'Ä · Gin', 'Ö · Gin']);
assert.equal(rows.at(-1).name, 'Apple · Vodka', 'Type takes priority over product name');
assert.equal(run('JSON.stringify(state.data) === before'), true);
assert.equal(storage.has('cocktails:data:v1'), false, 'Printing must not persist data');
assert.equal(run('window.printed'), true);
assert.equal(run('document.body.dataset.printTarget'), 'inventory-overview');
const html = run('els.inventoryOverviewPrint.innerHTML');
assert.equal((html.match(/<th scope=/g) || []).length, 3);
for (const heading of ['Ingrediens / namn', 'Hemma (cl)', 'Stugan (cl)']) assert.ok(html.includes(heading));
assert.match(html, /Utskriven: \d{4}-\d{2}-\d{2}/);
assert.ok(html.includes('&lt;Zero &amp;&gt;'));
assert.equal((html.match(/<td>/g) || []).length, rows.length * 3);
// Each level deliberately restarts product names to catch flattened name sorting.
const alphabet = ['A', 'Z', 'Å', 'Ä', 'Ö'];
const hierarchy = alphabet.flatMap(category => alphabet.flatMap(type => alphabet.map(name =>
  stock(name, 1, 'cl', 'Hemma', { category, type: `${type} ${category}` }))));
run(`state.data.inventory = ${JSON.stringify(hierarchy.slice().reverse())};
  globalThis.hierarchyBefore = JSON.stringify(state.data.inventory);
  prepareInventoryOverviewPrint();`);
assert.deepEqual(JSON.parse(run('JSON.stringify(getInventoryOverviewRows().map(row => row.name))')),
  hierarchy.map(entry => `${entry.name} · ${entry.type}`),
  'Category, type and product name each use Swedish A Z Å Ä Ö ordering');
assert.equal(run('JSON.stringify(state.data.inventory) === hierarchyBefore'), true);
// Unique names make the category boundary observable, independently of the comparator.
run(`state.data.inventory = ${JSON.stringify([
  stock('A product', 1, 'cl', 'Hemma', { category: 'Övrigt', type: 'A type' }),
  stock('Z product', 1, 'cl', 'Stugan', { category: 'Bitters', type: 'Z type' })
])}; prepareInventoryOverviewPrint();`);
assert.deepEqual(JSON.parse(run('JSON.stringify(getInventoryOverviewRows().map(row => row.name))')),
  ['Z product · Z type', 'A product · A type'], 'Category takes priority over type and product');
const sortedHtml = run('els.inventoryOverviewPrint.innerHTML');
assert.ok(sortedHtml.indexOf('Z product · Z type') < sortedHtml.indexOf('A product · A type'));
run('state.data.inventory = []; prepareInventoryOverviewPrint()');
assert.match(run('els.inventoryOverviewPrint.innerHTML'), /Inga lagerposter/);
const css = fs.readFileSync('styles.css', 'utf8');
assert.match(css, /@page inventory-overview\s*{\s*size: A4 portrait;\s*margin: 8mm/);
assert.match(css, /#inventoryOverviewPrint thead\s*{ display: table-header-group/);
assert.match(css, /#inventoryOverviewPrint tr\s*{ break-inside: avoid/);
assert.match(fs.readFileSync('index.html', 'utf8'), /id="printInventoryOverviewBtn"[^>]*>Skriv ut lageröversikt/);
console.log('PASS: combined inventory overview, exact identities, units, missing/zero stock, Swedish sorting, escaping, native print, unchanged data and print layout rules');
