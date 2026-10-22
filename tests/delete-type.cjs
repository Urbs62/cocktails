const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const fixture = {
  ingredientTypes: [
    {id:'unused',type:'Vodka',category:'Sprit'},
    {id:'stock-type',type:'Lagertyp',category:'Likör'},
    {id:'recipe-type',type:'Recepttyp',category:'Likör'},
    {id:'variant-type',type:'Varianttyp',category:'Likör'}
  ],
  inventory: [{id:'stock',type:'Lagertyp',name:'Tom flaska',category:'Likör',amount:0,unit:'cl',location:'Hemma',note:'Behåll'}],
  recipes: [{id:'recipe',name:'Test',category:'Recept',instructions:'Rör.',sourceUrl:'',ingredients:[{type:'Recepttyp',amount:2,unit:'cl',optional:true}]}],
  ingredientVariants: [{id:'variant',type:'Varianttyp',name:'Variant'}]
};
function app(data) {
  const storage = new Map([['cocktails:data:v1', JSON.stringify(data)]]);
  const context = vm.createContext({localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener(){}},
    alert:message=>context.alerts.push(message),confirm:message=>{context.confirmations.push(message);return context.approved;}});
  context.alerts=[]; context.confirmations=[]; context.approved=true;
  vm.runInContext(fs.readFileSync('app.js','utf8'),context);
  vm.runInContext(`refreshTypeControls = (...args) => refreshes.push(args); render = () => {}; globalThis.refreshes=[]; els.definitionType={options:[]};`,context);
  return {run:code=>vm.runInContext(code,context),storage};
}
const a=app(fixture),run=a.run;
const json=code=>JSON.parse(run(`JSON.stringify(${code})`));
const before=json('createBackup()'),stored=a.storage.get('cocktails:data:v1');
for(const [id,reason] of [['stock-type','1 lagerposter'],['recipe-type','1 recept'],['variant-type','1 registrerade varianter']]) {
  run(`deleteIngredientType('${id}')`);
  assert.ok(json('alerts').at(-1).includes(reason),'Blocked deletion must explain the reference');
  assert.deepEqual(json('createBackup()'),before);
  assert.equal(a.storage.get('cocktails:data:v1'),stored);
}
assert.equal(run('confirmations.length'),0,'Used types must be blocked before confirmation');
run(`approved=false; deleteIngredientType('unused')`);
assert.equal(run('confirmations.length'),1);
assert.deepEqual(json('createBackup()'),before,'Cancel must preserve everything');
assert.equal(a.storage.get('cocktails:data:v1'),stored);
run(`approved=true; deleteIngredientType('unused')`);
const expected={...before,ingredientTypes:before.ingredientTypes.filter(entry=>entry.id!=='unused')};
assert.deepEqual(json('createBackup()'),expected,'Only the unused definition may change');
assert.deepEqual(json('refreshes'),[['Vodka','']]);
assert.deepEqual(json('state.ingredientTypes'),expected.ingredientTypes);
const reload=app(JSON.parse(a.storage.get('cocktails:data:v1')));
assert.equal(reload.run(`isKnownIngredientType('Vodka')`),false,'Deleted default type must not return');
assert.deepEqual(JSON.parse(reload.run('JSON.stringify(createBackup())')),expected);
run('globalThis.imported=normalizeBackup(JSON.parse(JSON.stringify(createBackup())))');
assert.deepEqual(json('imported.ingredientTypes'),expected.ingredientTypes);
assert.deepEqual(json('imported.ingredientVariants'),before.ingredientVariants);
assert.deepEqual(json('imported.data'),{inventory:before.inventory,recipes:before.recipes});
// Guards use the same case-insensitive identity as ingredient matching.
run(`state.data.inventory[0].type='LAGERTYP'; deleteIngredientType('stock-type')`);
assert.ok(json('alerts').at(-1).includes('1 lagerposter'));
const empty=app({inventory:[],recipes:[],ingredientVariants:[],ingredientTypes:[{id:'last',type:'Sista',category:'Övrigt'}]});
empty.run(`deleteIngredientType('last')`);
const emptyReload=app(JSON.parse(empty.storage.get('cocktails:data:v1')));
assert.equal(emptyReload.run('ingredientTypesStore.length'),0,'Deleting the last definition must persist');
console.log('PASS: unused/default/last type deletion, stock including zero balance, optional recipe and variant guards, case-insensitive identity, cancel, unchanged other data, controls refresh, persistence/reload and JSON');
