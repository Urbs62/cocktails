const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const type = 'Angostura bitters';
const stock = (patch = {}) => ({id:'bottle',type,name:'Angostura',category:'Bitters & Smaksättare',amount:10,unit:'cl',location:'Hemma',...patch});
const requirement = (patch = {}) => ({type,amount:2,unit:'stänk',optional:false,...patch});
function app(inventory, ingredients = [requirement()]) {
  const fixture = {inventory, recipes:[{id:'drink',name:'Test',category:'Recept',ingredients,instructions:'Rör.',sourceUrl:''}],
    ingredientVariants:[{id:'orange',type,name:'Orange'},{id:'aromatic',type,name:'Aromatic'},{id:'gin-variant',type:'Gin',name:'Gin variant'}]};
  const storage = new Map([['cocktails:data:v1',JSON.stringify(fixture)]]);
  const context = vm.createContext({localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener(){}}});
  vm.runInContext(fs.readFileSync('app.js','utf8'),context);
  return {run:code=>vm.runInContext(code,context),storage};
}
function check(inventory, ingredients, available, location = 'Hemma') {
  const a = app(inventory, ingredients), run = a.run;
  const before = run('JSON.stringify(createBackup())');
  const stored = a.storage.get('cocktails:data:v1');
  assert.equal(run(`hasIngredient(state.data.recipes[0].ingredients[0], '${location}')`),available);
  assert.equal(run(`matchingInventory(state.data.recipes[0].ingredients[0], '${location}').length > 0`),available);
  assert.equal(run(`canMakeAt(state.data.recipes[0], '${location}')`),available);
  assert.equal(run(`getShoppingList('${location}').length === 0`),available);
  assert.equal(run('getRecipeStatus(state.data.recipes[0]).canMake'), available || location === 'Stugan');
  assert.equal(run('JSON.stringify(createBackup())'),before,'Matching must not mutate data or backup');
  assert.equal(a.storage.get('cocktails:data:v1'),stored,'Matching must not write storage');
  return a;
}
// Every stock unit satisfies stänk by positive presence, even less than one unit.
for (const unit of ['cl','ml','l','st','stänk','droppe']) {
  check([stock({unit,amount:0.1})],[requirement()],true);
  check([stock({unit,amount:0})],[requirement()],false);
}
check([stock()],[requirement()],true);
check([stock({type:'Gin'})],[requirement()],false);
check([stock({variantId:'orange'})],[requirement({variantId:'orange'})],true);
check([stock({variantId:'aromatic'})],[requirement({variantId:'orange'})],false);
check([stock()],[requirement({variantId:'orange'})],false);
check([stock({variantId:'orange'})],[requirement()],false,'Stugan');
check([stock({variantId:'gin-variant'})],[requirement({variantId:'gin-variant'})],false);
check([stock({variantId:'orange'})],[requirement({variantId:'deleted'})],false);
check([stock({amount:0}),stock({id:'second',amount:1})],[requirement()],true);
const zero = check([stock({amount:0})],[requirement()],false);
assert.equal(zero.run('getFilteredInventory().length'),1,'Zero stock stays in Barskåpet');
zero.run(`render=()=>{}; updateInventory('bottle',{amount:10})`);
assert.equal(zero.run('getRecipeStatus(state.data.recipes[0]).canMake'),true);
assert.equal(zero.run(`getShoppingList('Hemma').length`),0);
const optional = app([stock({amount:0})],[requirement({optional:true})]);
assert.equal(optional.run('getRecipeStatus(state.data.recipes[0]).canMake'),true);
assert.equal(optional.run(`getShoppingList('Hemma').length`),0);
// Presence does not reserve quantities, even when the same bottle has a measured use.
for (const ingredients of [
  [requirement(),requirement({unit:'cl',amount:10})],
  [requirement({unit:'cl',amount:10}),requirement()],
  [requirement(),requirement({amount:100})]
]) assert.equal(app([stock()],ingredients).run(`canMakeAt(state.data.recipes[0],'Hemma')`),true);
// The reverse direction and other quantity checks keep their original semantics.
assert.equal(app([stock({unit:'stänk'})],[requirement({unit:'cl'})]).run(`canMakeAt(state.data.recipes[0],'Hemma')`),false);
assert.equal(app([stock({amount:1})],[requirement({unit:'cl'})]).run(`canMakeAt(state.data.recipes[0],'Hemma')`),false);
assert.equal(app([stock({unit:'ml',amount:20})],[requirement({unit:'cl'})]).run(`canMakeAt(state.data.recipes[0],'Hemma')`),true);
console.log('PASS: stänk presence across stock units, zero/refill, type/variant/place guards, consistent recipe/shopping status, optional ingredients, mixed requirements and unchanged data/other units');
