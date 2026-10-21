const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function app(data) {
  const storage=new Map([['cocktails:data:v1',JSON.stringify(data)]]);
  const context=vm.createContext({localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener(){},createElement:()=>({dataset:{}})}});
  vm.runInContext(fs.readFileSync('app.js','utf8'),context);
  return {run:code=>vm.runInContext(code,context),storage};
}
const clone=value=>JSON.parse(JSON.stringify(value));
const fixture={ingredientTypes:[{id:'fruit',type:'Fruktlikör',category:'Likör'}],ingredientVariants:[],inventory:[
  {id:'898abb82-c31e-4763-961c-7bdf85055e07',type:'Fruktlikör',category:'Likör',name:'Daiquiri',amount:25,unit:'cl',location:'Stugan',note:'Keep'},
  {id:'unrelated',type:'Fruktlikör',category:'Likör',name:'Daiquiri',amount:30,unit:'cl',location:'Hemma'}
],recipes:[],settings:{keep:true}};
const migrated=app(fixture);
const saved=JSON.parse(migrated.storage.get('cocktails:data:v1'));
const variant=saved.ingredientVariants[0];
assert.equal(variant.type,'Fruktlikör');assert.equal(variant.name,'Bacardi Strawberry Daiquiri');assert.ok(variant.id);
assert.deepEqual(saved,{...fixture,ingredientVariants:[variant],inventory:[{...fixture.inventory[0],variantId:variant.id},fixture.inventory[1]]});
assert.equal(app(saved).storage.get('cocktails:data:v1'),JSON.stringify(saved),'Reload must preserve variant ID');
migrated.run(`globalThis.requirement=ingredient('Fruktlikör',5,'cl',false,${JSON.stringify(variant.id)})`);
assert.equal(migrated.run('hasIngredient(requirement,"Stugan")'),true);
assert.equal(migrated.run('hasIngredient(requirement,"Hemma")'),false);
migrated.run('globalThis.backup=JSON.parse(JSON.stringify(createBackup()));globalThis.roundtrip=normalizeBackup(backup)');
assert.equal(migrated.run('JSON.stringify(roundtrip.data.inventory) === JSON.stringify(backup.inventory)'),true);
assert.equal(migrated.run('JSON.stringify(roundtrip.ingredientVariants) === JSON.stringify(backup.ingredientVariants)'),true);
const reuse=clone(fixture);reuse.ingredientVariants=[{...variant,id:'existing-id'}];
assert.equal(app(reuse).run('state.data.inventory[0].variantId'),'existing-id');
const explicit=clone(fixture);explicit.inventory[0].variantId='';
assert.equal(app(explicit).storage.get('cocktails:data:v1'),JSON.stringify(explicit),'Explicit no-variant choice must remain untouched');
const linked=clone(fixture);linked.ingredientVariants=[{id:'other-id',type:'Fruktlikör',name:'Other'}];linked.inventory[0].variantId='other-id';
assert.equal(app(linked).run('state.data.inventory[0].variantId'),'other-id');
const removed=clone(fixture);removed.inventory.shift();
assert.equal(app(removed).run('ingredientVariantsStore.length'),0,'Absent stock must not recreate definitions');
const renamed=clone(fixture);renamed.inventory[0].name='Something else';
assert.equal(app(renamed).run('ingredientVariantsStore.length'),0,'Do not infer changed product identity');
migrated.run(`globalThis.old=${JSON.stringify({...fixture,ingredientVariants:[variant]})};globalThis.converted=normalizeBackup(old)`);
assert.equal(migrated.run('converted.data.inventory[0].variantId'),variant.id,'Legacy import should reuse existing shared variant');
// Sort UI copies, independent of category and stock; never reorder the stored registry.
migrated.run(`ingredientTypesStore=[{id:'o',type:'Ö-test',category:'Sprit'},{id:'a',type:'Ä-test',category:'Sprit'},{id:'aa',type:'Å-test',category:'Sprit'},{id:'z',type:'Z-test',category:'Sprit'},{id:'f',type:'Fruktlikör',category:'Likör'}];
globalThis.typeBefore=JSON.stringify(ingredientTypesStore);globalThis.typeOptions=[];
populateIngredientTypeSelect({replaceChildren(...nodes){typeOptions=nodes}},'Fruktlikör');`);
assert.deepEqual(JSON.parse(migrated.run('JSON.stringify(typeOptions.map(node=>node.textContent))')),['Välj typ','Fruktlikör','Z-test','Å-test','Ä-test','Ö-test']);
assert.equal(migrated.run('JSON.stringify(ingredientTypesStore)===typeBefore'),true);
migrated.run(`ingredientVariantsStore=[{id:'o',type:'Fruktlikör',name:'Ö'},{id:'a',type:'Fruktlikör',name:'Ä'},{id:'aa',type:'Fruktlikör',name:'Å'},{id:'z',type:'Fruktlikör',name:'Z'},{id:'b',type:'Fruktlikör',name:'Bacardi Strawberry Daiquiri'}];
globalThis.variantsBefore=JSON.stringify(ingredientVariantsStore);globalThis.variantOptions=[];
populateVariantSelect({replaceChildren(...nodes){variantOptions=nodes}},'Fruktlikör','b',true);`);
assert.deepEqual(JSON.parse(migrated.run('JSON.stringify(variantOptions.map(node=>node.textContent))')),['Ingen variant – generell typ','Bacardi Strawberry Daiquiri','Z','Å','Ä','Ö']);
assert.equal(migrated.run('JSON.stringify(ingredientVariantsStore)===variantsBefore'),true);
console.log('PASS: confirmed Daiquiri link, unchanged product/other stock, existing IDs, explicit no-variant choice, reload/JSON, strict matching and Swedish type/variant ordering');
