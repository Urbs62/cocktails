const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function app(data, extra={}) {
  const storage=new Map(Object.entries(extra));
  storage.set('cocktails:data:v1',JSON.stringify(data));
  const context=vm.createContext({localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))},document:{addEventListener(){}}});
  vm.runInContext(fs.readFileSync('app.js','utf8'),context);
  return {run:code=>vm.runInContext(code,context),storage};
}
const req=(type,variantId='',optional=false,unit='cl')=>({type,amount:500,unit,optional,...(variantId?{variantId}:{})});
const recipe=(id,name,ingredients)=>({id,name,category:'Recept',instructions:'Keep',sourceUrl:'',ingredients});
const stock=(id,type,location,variantId='',unit='ml',amount=0.1)=>({id,type,location,name:'Unrelated product name',category:'Sprit',amount,unit,...(variantId?{variantId}:{})});
const data={
  inventory:[stock('r','Vodka','Hemma','r'),stock('plain','Vodka','Stugan'),stock('g-home','Gin','Hemma'),stock('g-away','Gin','Stugan')],
  ingredientVariants:[{id:'r',type:'Vodka',name:'Rhubarb'},{id:'p',type:'Vodka',name:'Pear'}],
  recipes:[recipe('z','Zulu',[req('Tequila'),req('Triple sec'),req('Limejuice','',true)]),recipe('a','Alpha',[req('Tequila'),req('Vodka')]),recipe('r','Rhubarb drink',[req('Vodka','r')]),recipe('g','Gin drink',[req('Gin')]),recipe('o','Ö-drink',[req('Tequila')])]
};
const a=app(data);
const list=location=>JSON.parse(a.run(`JSON.stringify(getShoppingList(${JSON.stringify(location)}))`));
const initialData=a.run('JSON.stringify(state.data)');
const initialRegistry=a.run('JSON.stringify([ingredientTypesStore,ingredientVariantsStore])');
assert.deepEqual(list('Hemma').map(e=>e.label),['Tequila','Triple sec']);
assert.deepEqual(list('Hemma')[0].recipes,['Alpha','Zulu','Ö-drink']);
assert.deepEqual(list('Stugan').map(e=>e.label),['Tequila','Triple sec','Vodka / Rhubarb']);
assert.equal(list('Stugan').some(e=>e.label==='Gin'),false,'Stock in both places must match');
assert.equal(list('Hemma').some(e=>e.label==='Vodka'),false,'Vodka variant must fulfill generic Vodka');
assert.equal(list('Stugan').some(e=>e.label==='Vodka'),false,'Plain Vodka must fulfill generic Vodka');
assert.equal(list('Hemma').some(e=>e.label==='Limejuice'),false,'Optional ingredient must be excluded');
assert.equal(a.run('getRecipeStatus(state.data.recipes[3]).canMake'),false,'Quantity-based recipe status must remain unchanged');
assert.equal(a.run('JSON.stringify(state.data)'),initialData);
assert.equal(a.run('JSON.stringify([ingredientTypesStore,ingredientVariantsStore])'),initialRegistry);
assert.equal(a.storage.get('cocktails:data:v1'),JSON.stringify(data),'Calculating list must never write source data');
// A different variant cannot satisfy Rhubarb, even if its product name says Rhubarb.
a.run('state.data.inventory=[{...state.data.inventory[0],variantId:"p",name:"Rhubarb"}]');
assert.equal(list('Hemma').some(e=>e.label==='Vodka / Rhubarb'),true);
a.run(`state.data.inventory=${JSON.stringify(data.inventory)};state.data.inventory[0].amount=0`);
assert.equal(list('Hemma').some(e=>e.label==='Vodka / Rhubarb'),true,'Empty stock must follow existing matching rule');
// Presence ignores both recipe quantity and recipe unit, retaining the shared matcher.
a.run(`state.data.inventory=${JSON.stringify(data.inventory)};state.data.recipes.push(${JSON.stringify(recipe('units','Units',[req('Vodka','',false,'st')]))})`);
assert.equal(list('Hemma').some(e=>e.type==='Vodka' && !e.variantId),false,'Presence must not depend on recipe unit');
a.run(`state.data.inventory.push(${JSON.stringify(stock('t','Tequila','Stugan'))})`);
assert.equal(list('Stugan').some(e=>e.type==='Tequila'),false,'Stock additions must be reflected');
assert.equal(list('Hemma').some(e=>e.type==='Tequila'),true,'Stock at other place must not match');
a.run('state.data.inventory.find(e=>e.id==="t").location="Hemma"');
assert.equal(list('Hemma').some(e=>e.type==='Tequila'),false);
assert.equal(list('Stugan').some(e=>e.type==='Tequila'),true);
a.run('state.data.recipes=state.data.recipes.filter(recipe=>!recipe.ingredients.some(i=>i.type==="Tequila"))');
assert.equal(list('Stugan').some(e=>e.type==='Tequila'),false,'Removed recipe requirements must disappear');
// Generic and specific requirements remain separate unique ingredients.
a.run('state.data.inventory=[];state.data.recipes=[recipe("x","Same",[ingredient("Vodka",1,"cl"),ingredient("Vodka",1,"cl",false,"r"),ingredient("Vodka",1,"cl",false,"p")])]');
assert.deepEqual(list('Hemma').map(e=>e.label),['Vodka','Vodka / Pear','Vodka / Rhubarb']);
a.run('state.data.recipes=[]');
assert.equal(list('Hemma').length,0);
assert.equal(app(data,{'cocktails:shopping:location':JSON.stringify('Stugan')}).run('state.shoppingLocation'),'Stugan');
assert.equal(app(data,{'cocktails:shopping:location':JSON.stringify('invalid')}).run('state.shoppingLocation'),'Hemma');
assert.equal(app(data,{'cocktails:shopping:location':'broken'}).run('state.shoppingLocation'),'Hemma');
console.log('PASS: shopping presence by place/type/variant, deduplication, Swedish sorting, optional ingredients, quantities/units ignored, updates, unchanged source data and location preference');
