const STORAGE_KEY = "cocktails:data:v1";
const TYPE_STORAGE_KEY = "ingredientTypes";
const VARIANT_STORAGE_KEY = "cocktails:ingredientVariants:v1";
const PANEL_KEY = "cocktails:panels:v1";
const SHOPPING_LOCATION_KEY = "cocktails:shopping:location";
const LAST_EXPORTED_KEY = "cocktails:backup:lastExportedAt";
const LAST_RESTORED_KEY = "cocktails:backup:lastRestoredAt";
const VERMOUTH_CATEGORY_MIGRATION_KEY = "cocktails:migration:vermouth-category:v1";
const LOCATIONS = ["Hemma", "Stugan"];
const SHOPPING_LOCATIONS = [...LOCATIONS, "Hemma/Stugan"];
const CATEGORY_OPTIONS = ["Sprit", "Likör", "Vermouth & Starkvin", "Mousserande vin", "Mixer", "Juice & Syrup", "Bitters & Smaksättare", "Garnityr", "Övrigt"];
const INVENTORY_CATEGORY_ORDER = ["Sprit", "Likör", "Vermouth & Starkvin", "Mousserande vin", "Bitters & Smaksättare", "Juice & Syrup", "Mixer", "Garnityr", "Övrigt"];
const VERMOUTH_CATEGORY = "Vermouth & Starkvin";
const VERMOUTH_TYPE_KEYS = new Set([
  "Söt vermouth",
  "Torr vermouth",
  "Madeira",
  "Portvin",
  "Martini Rosso",
  "Martini Extra Dry",
  "Martini Bianco"
].map(normalizeKey));
const DEFAULT_INGREDIENT_TYPES = [
  { id: "type-gin", type: "Gin", category: "Sprit" },
  { id: "type-vodka", type: "Vodka", category: "Sprit" },
  { id: "type-ljus-rom", type: "Ljus rom", category: "Sprit" },
  { id: "type-mork-rom", type: "Mörk rom", category: "Sprit" },
  { id: "type-whisky", type: "Whisky", category: "Sprit" },
  { id: "type-bourbon", type: "Bourbon", category: "Sprit" },
  { id: "type-tequila", type: "Tequila", category: "Sprit" },
  { id: "type-cognac", type: "Cognac", category: "Sprit" },
  { id: "type-campari", type: "Campari", category: "Likör" },
  { id: "type-aperol", type: "Aperol", category: "Likör" },
  { id: "type-kaffelikor", type: "Kaffelikör", category: "Likör" },
  { id: "type-limoncello", type: "Limoncello", category: "Likör" },
  { id: "type-galliano", type: "Galliano", category: "Likör" },
  { id: "type-triple-sec", type: "Triple sec", category: "Likör" },
  { id: "type-cointreau", type: "Cointreau", category: "Likör" },
  { id: "type-sot-vermouth", type: "Söt vermouth", category: "Vermouth & Starkvin" },
  { id: "type-torr-vermouth", type: "Torr vermouth", category: "Vermouth & Starkvin" },
  { id: "type-tonic", type: "Tonic", category: "Mixer" },
  { id: "type-sodavatten", type: "Sodavatten", category: "Mixer" },
  { id: "type-ginger-beer", type: "Ginger Beer", category: "Mixer" },
  { id: "type-cola", type: "Cola", category: "Mixer" },
  { id: "type-espresso", type: "Espresso", category: "Mixer" },
  { id: "type-limejuice", type: "Limejuice", category: "Juice & Syrup" },
  { id: "type-citronjuice", type: "Citronjuice", category: "Juice & Syrup" },
  { id: "type-sockerlag", type: "Sockerlag", category: "Juice & Syrup" },
  { id: "type-angostura-bitters", type: "Angostura bitters", category: "Bitters & Smaksättare" },
  { id: "type-apelsinzest", type: "Apelsinzest", category: "Garnityr" },
  { id: "type-cocktailbar", type: "Cocktailbär", category: "Garnityr" },
  { id: "type-oliver", type: "Oliver", category: "Garnityr" }
];
const VOLUME_UNITS = new Map([
  ["ml", 0.1],
  ["cl", 1],
  ["l", 100],
  ["liter", 100]
]);
let ingredientTypesStore = loadIngredientTypes();
let ingredientVariantsStore = readJson(VARIANT_STORAGE_KEY, []);

const demoData = {
  inventory: [
    item("Gin", "Beefeater", 70, "cl", "Hemma"),
    item("Vodka", "Absolut Vodka", 70, "cl", "Stugan"),
    item("Campari", "Campari", 50, "cl", "Hemma"),
    item("Tonic", "Tonic", 4, "st", "Hemma")
  ],
  recipes: [
    recipe("Gin & Tonic", "Highball", [
      ingredient("Gin", 5, "cl"),
      ingredient("Tonic", 1, "st")
    ], "Bygg i glas med is. Toppa gin med tonic och rör kort.", ""),
    recipe("Negroni", "Klassiker", [
      ingredient("Gin", 3, "cl"),
      ingredient("Campari", 3, "cl"),
      ingredient("Söt vermouth", 3, "cl", true)
    ], "Rör med is och sila över stor isbit. Garnera om du har apelsin.", ""),
    recipe("Vodka Soda", "Highball", [
      ingredient("Vodka", 5, "cl"),
      ingredient("Sodavatten", 1, "st", true)
    ], "Bygg i högt glas med is och toppa med soda.", "")
  ]
};

const state = {
  data: loadData(),
  ingredientTypes: ingredientTypesStore,
  shoppingLocation: loadShoppingLocation(),
  filters: {
    location: "all",
    category: "all",
    type: "all",
    search: ""
  }
};

const els = {};
let pendingRestore = null;
let newIngredientTarget = null;

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  restorePanelState();
  populateIngredientTypeSelect(els.inventoryType);
  populateCategorySelect(els.newTypeCategory);
  bindEvents();
  render();
  registerServiceWorker();
});

function item(type, name, amount, unit, location) {
  return { id: createId(), category: getIngredientCategory(type), type, name, amount, unit, location };
}

function recipe(name, category, ingredients, instructions, sourceUrl = "") {
  return { id: createId(), name, category, ingredients, instructions, sourceUrl };
}

function ingredient(type, amount = null, unit = "", optional = false, variantId = "") {
  const parsedAmount = amount === null || amount === "" ? null : Number(amount);
  return { type: normalizeIngredientType(type), amount: parsedAmount, unit: normalizeUnit(unit), optional, ...(variantId ? { variantId: String(variantId) } : {}) };
}

function bindElements() {
  [
    "inventoryCount", "recipeCount", "makeableCount", "inventorySummaryText", "recipeSummaryText",
    "shoppingLocation", "shoppingCount", "shoppingList", "printShoppingBtn", "shoppingPrint",
    "filterLocation", "filterCategory", "filterType", "filterSearch", "typeSummary", "typeSummaryCount", "inventoryList", "recipeList",
    "inventoryForm", "inventoryId", "inventoryType", "inventoryName",
    "inventoryAmount", "inventoryUnit", "inventoryLocation", "inventoryFormMode",
    "resetInventoryForm", "recipeForm", "recipeId", "recipeName",
    "recipeIngredientRows", "addRecipeIngredient", "recipeInstructions", "recipeSourceUrl", "recipeFormMode",
    "resetRecipeForm", "typeForm", "newTypeName", "newTypeCategory", "typeSummaryText", "resetTypeForm",
    "exportBtn", "importInput", "emptyTemplate", "toast", "debugInventoryCount", "debugRecipeCount",
    "debugTypeCount", "restoreLog", "backupSummaryText", "lastExportedAt", "lastRestoredAt", "restoreBtn",
    "restoreDialog", "confirmRestoreBtn", "cancelRestoreBtn", "structureSummaryText", "structureReport",
    "printSummaryText", "togglePrintPreview", "printInventoryBtn", "printPreview",
    "printInventoryOverviewBtn", "inventoryOverviewPrint",
    "inventoryVariant", "newInventoryVariant", "variantForm", "newVariantType", "newVariantName", "variantList",
    "ingredientDialog", "ingredientDefinitionForm", "definitionType", "definitionTypeName",
    "definitionCategory", "definitionVariantName", "definitionNewTypeFields", "cancelIngredientDefinition"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.shoppingLocation.replaceChildren(...SHOPPING_LOCATIONS.map((location) => option(location, location)));
  els.shoppingLocation.value = state.shoppingLocation;
  els.shoppingLocation.addEventListener("change", () => {
    state.shoppingLocation = SHOPPING_LOCATIONS.includes(els.shoppingLocation.value) ? els.shoppingLocation.value : LOCATIONS[0];
    localStorage.setItem(SHOPPING_LOCATION_KEY, JSON.stringify(state.shoppingLocation));
    renderShoppingList();
  });
  els.filterLocation.addEventListener("change", () => {
    state.filters.location = els.filterLocation.value;
    renderInventory();
  });

  els.filterCategory.addEventListener("change", () => {
    state.filters.category = els.filterCategory.value;
    renderInventory();
  });

  els.filterType.addEventListener("change", () => {
    state.filters.type = els.filterType.value;
    renderInventory();
  });

  els.filterSearch.addEventListener("input", () => {
    state.filters.search = els.filterSearch.value.trim().toLowerCase();
    renderInventory();
  });

  document.querySelectorAll(".panel").forEach((panel, index) => {
    panel.dataset.panelId = panel.dataset.panelId || `panel-${index}`;
    panel.addEventListener("toggle", savePanelState);
  });

  els.inventoryForm.addEventListener("submit", saveInventoryFromForm);
  els.recipeForm.addEventListener("submit", saveRecipeFromForm);
  els.typeForm.addEventListener("submit", saveTypeFromForm);
  els.variantForm.addEventListener("submit", saveVariantFromForm);
  els.ingredientDefinitionForm.addEventListener("submit", saveIngredientDefinition);
  els.definitionType.addEventListener("change", updateIngredientDefinitionMode);
  els.cancelIngredientDefinition.addEventListener("click", closeIngredientDefinition);
  els.ingredientDialog.addEventListener("close", () => { newIngredientTarget = null; });
  els.inventoryType.addEventListener("change", () => populateVariantSelect(els.inventoryVariant, els.inventoryType.value));
  els.newInventoryVariant.addEventListener("click", () => openIngredientDefinition(els.inventoryForm));
  populateVariantSelect(els.inventoryVariant, els.inventoryType.value);
  populateIngredientTypeSelect(els.newVariantType);
  renderVariants();
  els.addRecipeIngredient.addEventListener("click", () => addRecipeIngredientRow());
  els.resetInventoryForm.addEventListener("click", resetInventoryForm);
  els.resetRecipeForm.addEventListener("click", resetRecipeForm);
  els.resetTypeForm.addEventListener("click", resetTypeForm);
  els.exportBtn.addEventListener("click", exportData);
  els.restoreBtn.addEventListener("click", () => els.importInput.click());
  els.importInput.addEventListener("change", importData);
  els.confirmRestoreBtn.addEventListener("click", applyPendingRestore);
  els.cancelRestoreBtn.addEventListener("click", clearPendingRestore);
  els.restoreDialog.addEventListener("cancel", clearPendingRestore);
  els.togglePrintPreview.addEventListener("click", togglePrintPreview);
  els.printInventoryBtn.addEventListener("click", printInventory);
  els.printInventoryOverviewBtn.addEventListener("click", printInventoryOverview);
  els.printShoppingBtn.addEventListener("click", printShoppingList);
  window.addEventListener("beforeprint", () => {
    if (document.body.dataset.printTarget === "shopping") prepareShoppingPrint();
    else if (document.body.dataset.printTarget === "inventory-overview") prepareInventoryOverviewPrint();
    else prepareInventoryPrint();
  });
  window.addEventListener("afterprint", () => { delete document.body.dataset.printTarget; });
  addRecipeIngredientRow();
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return cloneData(demoData);

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed.ingredientTypes)) {
      ingredientTypesStore = normalizeIngredientTypes(parsed.ingredientTypes);
      localStorage.setItem(TYPE_STORAGE_KEY, JSON.stringify(ingredientTypesStore));
    }
    if (Array.isArray(parsed.ingredientVariants)) ingredientVariantsStore = parsed.ingredientVariants;
    const migrated = migrateIngredientStructure(parsed, ingredientTypesStore, ingredientVariantsStore);
    const variants = simplifyIngredientVariants(migrated.data, migrated.variants);
    const previousTypes = ingredientTypesStore;
    ingredientTypesStore = migrated.types;
    const data = normalizeData(migrated.data);
    if (migrated.changed || variants !== ingredientVariantsStore) {
      // Preserve snapshot metadata and all fields outside the explicit migration.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...migrated.data,
          ...(migrated.types !== previousTypes ? { ingredientTypes: migrated.types } : {}), ingredientVariants: variants }));
      } catch {
        ingredientTypesStore = previousTypes;
        return normalizeData(parsed); // Failed migration writes must never replace user data with demo data.
      }
      try {
        localStorage.setItem(VARIANT_STORAGE_KEY, JSON.stringify(variants));
        localStorage.setItem(TYPE_STORAGE_KEY, JSON.stringify(migrated.types));
      } catch { /* The complete authoritative snapshot above is already saved. */ }
    }
    ingredientVariantsStore = variants;
    return data;
  } catch {
    return cloneData(demoData);
  }
}

function persist() {
  // One authoritative snapshot keeps records and their definitions consistent.
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state.data,
    ingredientTypes: ingredientTypesStore, ingredientVariants: ingredientVariantsStore }));
}

function loadIngredientTypes() {
  const saved = localStorage.getItem(TYPE_STORAGE_KEY);
  if (saved) {
    try {
      const normalized = normalizeIngredientTypesBase(JSON.parse(saved));
      return migrateVermouthCategoryOnce(normalized);
    } catch {
      return seedIngredientTypes();
    }
  }
  return seedIngredientTypes();
}

function seedIngredientTypes() {
  const seeded = migrateVermouthCategoryOnce(normalizeIngredientTypesBase(DEFAULT_INGREDIENT_TYPES));
  localStorage.setItem(TYPE_STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function migrateVermouthCategoryOnce(entries) {
  const migrated = applyVermouthCategory(entries);
  if (localStorage.getItem(VERMOUTH_CATEGORY_MIGRATION_KEY)) return migrated;

  const storedData = readJson(STORAGE_KEY, { inventory: [], recipes: [] });
  const before = {
    inventory: Array.isArray(storedData.inventory) ? storedData.inventory.length : 0,
    recipes: Array.isArray(storedData.recipes) ? storedData.recipes.length : 0,
    ingredientTypes: entries.length
  };
  const movedTypes = entries
    .filter((entry) => VERMOUTH_TYPE_KEYS.has(normalizeKey(entry.type)) && entry.category !== VERMOUTH_CATEGORY)
    .map((entry) => entry.type);

  if (migrated.length !== before.ingredientTypes) throw new Error("Ingredient type migration changed type count");

  localStorage.setItem(TYPE_STORAGE_KEY, JSON.stringify(migrated));
  const storedDataAfter = readJson(STORAGE_KEY, { inventory: [], recipes: [] });
  const storedTypesAfter = readJson(TYPE_STORAGE_KEY, []);
  const after = {
    inventory: Array.isArray(storedDataAfter.inventory) ? storedDataAfter.inventory.length : 0,
    recipes: Array.isArray(storedDataAfter.recipes) ? storedDataAfter.recipes.length : 0,
    ingredientTypes: Array.isArray(storedTypesAfter) ? storedTypesAfter.length : 0
  };
  if (after.inventory !== before.inventory || after.recipes !== before.recipes || after.ingredientTypes !== before.ingredientTypes) {
    throw new Error("Vermouth category migration changed data counts");
  }

  localStorage.setItem(VERMOUTH_CATEGORY_MIGRATION_KEY, JSON.stringify({
    completedAt: new Date().toISOString(),
    movedTypes,
    before,
    after
  }));
  return migrated;
}

function applyVermouthCategory(entries) {
  return entries.map((entry) => VERMOUTH_TYPE_KEYS.has(normalizeKey(entry.type))
    ? { ...entry, category: VERMOUTH_CATEGORY }
    : entry);
}

function persistIngredientTypes() {
  state.ingredientTypes = ingredientTypesStore;
  persist();
}

function restorePanelState() {
  const saved = readJson(PANEL_KEY, null);
  if (!saved) return;

  document.querySelectorAll(".panel").forEach((panel, index) => {
    const id = panel.dataset.panelId || `panel-${index}`;
    panel.dataset.panelId = id;
    if (typeof saved[id] === "boolean") panel.open = saved[id];
  });
}

function savePanelState() {
  const panels = {};
  document.querySelectorAll(".panel").forEach((panel) => {
    panels[panel.dataset.panelId] = panel.open;
  });
  localStorage.setItem(PANEL_KEY, JSON.stringify(panels));
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function render() {
  syncCategoryFilter();
  renderStats();
  renderInventory();
  renderRecipes();
  renderShoppingList();
  renderSystemInfo();
  renderBackupStatus();
  renderStructure();
  renderPrintInventory();
}

function renderStats() {
  const recipeStatuses = state.data.recipes.map(getRecipeStatus);
  els.inventoryCount.textContent = state.data.inventory.length;
  els.recipeCount.textContent = state.data.recipes.length;
  els.makeableCount.textContent = recipeStatuses.filter((status) => status.canMake).length;
  els.inventorySummaryText.textContent = `${state.data.inventory.length} ingredienser`;
  els.recipeSummaryText.textContent = `${state.data.recipes.length} recept`;
  els.typeSummaryText.textContent = `${ingredientTypesStore.length} typer`;
}

function renderSystemInfo() {
  const savedData = readJson(STORAGE_KEY, { inventory: [], recipes: [] });
  const savedTypes = readJson(TYPE_STORAGE_KEY, []);
  els.debugInventoryCount.textContent = Array.isArray(savedData.inventory) ? savedData.inventory.length : 0;
  els.debugRecipeCount.textContent = Array.isArray(savedData.recipes) ? savedData.recipes.length : 0;
  els.debugTypeCount.textContent = Array.isArray(savedTypes) ? savedTypes.length : 0;
}

function renderBackupStatus() {
  els.lastExportedAt.textContent = formatStoredDate(localStorage.getItem(LAST_EXPORTED_KEY));
  els.lastRestoredAt.textContent = formatStoredDate(localStorage.getItem(LAST_RESTORED_KEY));
  els.backupSummaryText.textContent = `${state.data.inventory.length} lager, ${state.data.recipes.length} recept`;
}

function renderStructure() {
  const inventoryCounts = countInventoryByType();
  const recipeCounts = countRecipesByType();
  const knownKeys = new Set(ingredientTypesStore.map((entry) => normalizeKey(entry.type)));
  const categories = CATEGORY_OPTIONS.map((category) => ({
    category,
    types: ingredientTypesStore
      .filter((entry) => entry.category === category)
      .map((entry) => createStructureRow(entry.type, inventoryCounts, recipeCounts, true))
  }));
  const unknownTypes = new Map();

  state.data.inventory.forEach((entry) => {
    const key = normalizeKey(entry.type);
    if (key && !knownKeys.has(key)) unknownTypes.set(key, normalizeLabel(entry.type));
  });
  state.data.recipes.forEach((recipeEntry) => {
    recipeEntry.ingredients.forEach((recipeIngredient) => {
      const key = normalizeKey(recipeIngredient.type);
      if (key && !knownKeys.has(key)) unknownTypes.set(key, normalizeLabel(recipeIngredient.type));
    });
  });

  const unknownRows = [...unknownTypes.values()]
    .map((type) => createStructureRow(type, inventoryCounts, recipeCounts, false))
    .sort((a, b) => sortSv(a.type, b.type));
  const unusedCount = categories.flatMap((group) => group.types)
    .filter((row) => row.inventoryCount === 0 && row.recipeCount === 0).length;
  const issueCount = unusedCount + unknownRows.length;

  els.structureSummaryText.textContent = issueCount
    ? `${ingredientTypesStore.length} typer, ${issueCount} att granska`
    : `${ingredientTypesStore.length} typer`;
  els.structureReport.replaceChildren(
    ...categories.map(renderStructureCategory),
    ...(unknownRows.length ? [renderStructureCategory({ category: "Saknas i ingredientTypes", types: unknownRows }, true)] : [])
  );
}

function countInventoryByType() {
  const counts = new Map();
  state.data.inventory.forEach((entry) => {
    const key = normalizeKey(entry.type);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function countRecipesByType() {
  const counts = new Map();
  state.data.recipes.forEach((recipeEntry) => {
    const typesInRecipe = new Set(recipeEntry.ingredients.map((entry) => normalizeKey(entry.type)).filter(Boolean));
    typesInRecipe.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
  });
  return counts;
}

function createStructureRow(type, inventoryCounts, recipeCounts, isKnown) {
  const key = normalizeKey(type);
  return {
    type,
    isKnown,
    inventoryCount: inventoryCounts.get(key) || 0,
    recipeCount: recipeCounts.get(key) || 0
  };
}

function renderStructureCategory(group, isUnknownGroup = false) {
  const section = el("section", `structure-category${isUnknownGroup ? " structure-category-warn" : ""}`);
  const heading = el("h2", "structure-category-title");
  heading.innerHTML = `<span>${escapeHtml(group.category)}</span><small>${group.types.length} ${group.types.length === 1 ? "typ" : "typer"}</small>`;
  const rows = el("div", "structure-types");
  rows.append(...group.types.map(renderStructureRow));
  section.append(heading, rows);
  return section;
}

function renderStructureRow(row) {
  const unused = row.isKnown && row.inventoryCount === 0 && row.recipeCount === 0;
  const statuses = [];
  if (unused) statuses.push("Oanvänd");
  if (!row.isKnown && row.inventoryCount > 0) statuses.push("I lager, saknas i ingredientTypes");
  if (!row.isKnown && row.recipeCount > 0) statuses.push("I recept, saknas i ingredientTypes");

  const node = el("div", `structure-row${statuses.length ? " has-warning" : ""}`);
  node.innerHTML = `
    <div class="structure-type">
      <strong>${escapeHtml(row.type)}</strong>
      ${statuses.map((status) => `<span class="structure-warning">${escapeHtml(status)}</span>`).join("")}
    </div>
    <dl class="structure-counts">
      <div><dt>Lagerposter</dt><dd>${row.inventoryCount}</dd></div>
      <div><dt>Recept</dt><dd>${row.recipeCount}</dd></div>
    </dl>
  `;
  if (row.isKnown) {
    const edit = el("button", "structure-edit");
    edit.type = "button";
    edit.textContent = "Redigera";
    edit.setAttribute("aria-label", `Redigera ${row.type}`);
    edit.addEventListener("click", () => {
      if (node.querySelector("form")) return;
      const form = el("form", "structure-edit-form");
      form.innerHTML = `
        <label><span>Namn på ingredienstyp</span><input required aria-label="Namn på ingredienstyp"></label>
        <label><span>Kategori</span><select required aria-label="Kategori"></select></label>
        <div class="form-actions"><button class="primary" type="submit">Spara</button><button type="button">Avbryt</button></div>
        <small role="alert"></small>`;
      const input = form.querySelector("input");
      input.value = row.type;
      const categorySelect = form.querySelector("select");
      populateCategorySelect(categorySelect, getIngredientDefinition(row.type)?.category);
      form.querySelector('button[type="button"]').addEventListener("click", () => {
        form.remove();
        edit.hidden = false;
        edit.focus();
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const error = renameIngredientType(getIngredientDefinition(row.type)?.id, input.value, categorySelect.value);
        if (error) {
          form.querySelector('[role="alert"]').textContent = error;
          input.focus();
        }
      });
      edit.hidden = true;
      node.append(form);
      input.focus();
      input.select();
    });
    const remove = el("button", "structure-edit");
    remove.type = "button";
    remove.textContent = "Ta bort";
    remove.setAttribute("aria-label", `Ta bort ${row.type}`);
    remove.addEventListener("click", () => deleteIngredientType(getIngredientDefinition(row.type)?.id));
    const actions = el("div", "structure-type-actions");
    actions.append(edit, remove);
    node.querySelector(".structure-type").append(actions);
  }
  return node;
}

function deleteIngredientType(id) {
  const definition = ingredientTypesStore.find((entry) => entry.id === id);
  if (!definition) return;
  const matches = (entry) => normalizeKey(entry.type) === normalizeKey(definition.type);
  const inventoryCount = state.data.inventory.filter(matches).length;
  const recipeCount = state.data.recipes.filter((entry) => entry.ingredients.some(matches)).length;
  const variantCount = ingredientVariantsStore.filter(matches).length;
  if (inventoryCount || recipeCount || variantCount) {
    alert(`Kan inte ta bort ${definition.type}. Typen används i ${inventoryCount} lagerposter, ${recipeCount} recept och ${variantCount} registrerade varianter. Ta bort kopplingarna först.`);
    return;
  }
  if (!confirm(`Ta bort ingredienstypen ${definition.type}?`)) return;
  ingredientTypesStore = ingredientTypesStore.filter((entry) => entry.id !== id);
  persistIngredientTypes();
  // Clear unsaved selections rather than retaining the removed type as unknown.
  refreshTypeControls(definition.type, "");
  [...els.definitionType.options].filter((option) => matches({ type: option.value })).forEach((option) => option.remove());
  render();
  showToast("Ingredienstypen är borttagen.");
}

function renameIngredientType(id, value, category) {
  const definition = ingredientTypesStore.find((entry) => entry.id === id);
  if (!definition) return "Typen finns inte längre.";
  category = category ?? definition.category;
  if (!CATEGORY_OPTIONS.includes(category)) return "Välj en giltig kategori.";
  const name = normalizeLabel(value);
  if (!name) return "Ange ett namn på typen.";
  const oldKey = normalizeKey(definition.type);
  const newKey = normalizeKey(name);
  // Include unregistered references so a rename cannot silently merge identities.
  const references = [...ingredientTypesStore, ...ingredientVariantsStore,
    ...state.data.inventory, ...state.data.recipes.flatMap((entry) => entry.ingredients)];
  if (newKey !== oldKey && references.some((entry) => normalizeKey(entry.type) === newKey)) {
    return "Typen finns redan.";
  }
  const rename = (entry) => normalizeKey(entry.type) === oldKey ? { ...entry, type: name } : entry;
  ingredientTypesStore = ingredientTypesStore.map((entry) => entry.id === id ? { ...entry, type: name, category } : entry);
  ingredientVariantsStore = ingredientVariantsStore.map(rename);
  state.data = { ...state.data,
    inventory: state.data.inventory.map((entry) => normalizeKey(entry.type) === oldKey && category !== definition.category
      ? { ...entry, type: name, category } : rename(entry)),
    recipes: state.data.recipes.map((entry) => ({ ...entry, ingredients: entry.ingredients.map(rename) }))
  };
  if (normalizeKey(state.filters.type) === oldKey) {
    state.filters.type = name;
    els.filterType.append(option(name, name));
    els.filterType.value = name;
  }
  persistIngredientTypes();
  refreshTypeControls(definition.type, name);
  render();
  showToast(category !== definition.category ? "Ingredienstypen uppdaterad." : "Typens namn uppdaterat.");
  return "";
}

function togglePrintPreview() {
  const willShow = els.printPreview.hidden;
  els.printPreview.hidden = !willShow;
  els.togglePrintPreview.textContent = willShow ? "Dölj utskriftslista" : "Visa utskriftslista";
  els.togglePrintPreview.setAttribute("aria-expanded", String(willShow));
  if (willShow) renderPrintInventory();
}

function prepareInventoryPrint() {
  els.printInventoryBtn.closest("details").open = true;
  els.printPreview.hidden = false;
  els.togglePrintPreview.textContent = "Dölj utskriftslista";
  els.togglePrintPreview.setAttribute("aria-expanded", "true");
  renderPrintInventory();
}

function printInventory() {
  document.body.dataset.printTarget = "inventory";
  prepareInventoryPrint();
  window.print();
}

function getInventoryOverviewRows() {
  const rows = new Map();
  state.data.inventory.forEach((entry) => {
    if (!LOCATIONS.includes(entry.location)) return;
    const key = JSON.stringify([entry.type, entry.name, entry.variantId || ""]);
    if (!rows.has(key)) rows.set(key, {
      name: `${entry.name} · ${entry.type}${entry.variantId ? ` / ${variantLabel(entry.variantId)}` : ""}`,
      category: entry.category, type: entry.type, productName: entry.name,
      key, Hemma: new Map(), Stugan: new Map()
    });
    const quantities = rows.get(key)[entry.location];
    const unit = normalizeUnit(entry.unit);
    const volume = VOLUME_UNITS.has(unit);
    const reportUnit = volume ? "cl" : unit;
    const amount = volume ? convertAmount(Number(entry.amount), unit, "cl") : Number(entry.amount);
    quantities.set(reportUnit, (quantities.get(reportUnit) || 0) + amount);
  });
  const format = (quantities) => quantities.size
    ? [...quantities].sort(([a], [b]) => sortSv(a, b)).map(([unit, amount]) =>
      `${formatAmount(amount)}${unit === "cl" ? "" : ` ${unit}`}`).join(" + ")
    : "—";
  const compare = (a, b) => String(a || "").localeCompare(String(b || ""), "sv-SE");
  return [...rows.values()].sort((a, b) => compare(a.category, b.category)
    || compare(a.type, b.type) || compare(a.productName, b.productName)
    || compare(a.name, b.name) || compare(a.key, b.key))
    .map((row) => ({ name: row.name, Hemma: format(row.Hemma), Stugan: format(row.Stugan) }));
}

function prepareInventoryOverviewPrint() {
  const rows = getInventoryOverviewRows();
  els.inventoryOverviewPrint.innerHTML = `
    <header><h1>Lageröversikt · Hemma och Stugan</h1>
      <p>Utskriven: ${escapeHtml(formatPrintDate(new Date()))}</p></header>
    <table><colgroup><col style="width:64%"><col style="width:18%"><col style="width:18%"></colgroup>
      <thead><tr><th scope="col">Ingrediens / namn</th><th scope="col">Hemma (cl)</th><th scope="col">Stugan (cl)</th></tr></thead>
      <tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.Hemma)}</td><td>${escapeHtml(row.Stugan)}</td></tr>`).join("")}</tbody>
    </table>${rows.length ? "" : "<p>Inga lagerposter.</p>"}`;
}

function printInventoryOverview() {
  document.body.dataset.printTarget = "inventory-overview";
  prepareInventoryOverviewPrint();
  window.print();
}

function prepareShoppingPrint() {
  const entries = getShoppingList(state.shoppingLocation);
  const header = el("header");
  header.innerHTML = `
    <h1>Cocktails – Inköpslista</h1>
    <p>Vald plats: ${escapeHtml(state.shoppingLocation)}<br>
    Utskriftsdatum: ${escapeHtml(formatPrintDate(new Date()))}<br>
    Antal saknade ingredienser: ${entries.length}</p>`;
  const list = el("ul", "shopping-print-list");
  entries.forEach((entry) => {
    const row = el("li");
    row.innerHTML = `<span class="shopping-print-checkbox" aria-hidden="true"></span>
      <div><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.recipes.join(", "))}</small></div>`;
    list.append(row);
  });
  els.shoppingPrint.replaceChildren(header, list);
  if (!entries.length) {
    const empty = el("p");
    empty.textContent = "Inga ingredienser saknas för vald plats.";
    els.shoppingPrint.append(empty);
  }
}

function printShoppingList() {
  document.body.dataset.printTarget = "shopping";
  prepareShoppingPrint();
  window.print();
}

function renderPrintInventory() {
  const inventory = state.data.inventory.slice().sort(comparePrintableInventory);
  const locationCounts = new Map(LOCATIONS.map((location) => [location, 0]));
  inventory.forEach((entry) => locationCounts.set(entry.location, (locationCounts.get(entry.location) || 0) + 1));

  els.printSummaryText.textContent = `${inventory.length} lagerposter`;
  els.printPreview.replaceChildren();

  const header = el("header", "print-header");
  header.innerHTML = `
    <h1>Lagerlista</h1>
    <p>Utskriven: ${escapeHtml(formatPrintDate(new Date()))}</p>
    <dl class="print-totals">
      <div><dt>Totalt</dt><dd>${inventory.length}</dd></div>
      <div><dt>Hemma</dt><dd>${locationCounts.get("Hemma") || 0}</dd></div>
      <div><dt>Stugan</dt><dd>${locationCounts.get("Stugan") || 0}</dd></div>
    </dl>
  `;
  els.printPreview.append(header);

  if (!inventory.length) {
    const empty = el("p", "print-empty");
    empty.textContent = "Lagret är tomt.";
    els.printPreview.append(empty);
    return;
  }

  LOCATIONS.forEach((location) => {
    const locationEntries = inventory.filter((entry) => entry.location === location);
    if (!locationEntries.length) return;
    els.printPreview.append(renderPrintLocation(location, locationEntries));
  });
}

function comparePrintableInventory(a, b) {
  return LOCATIONS.indexOf(a.location) - LOCATIONS.indexOf(b.location)
    || categorySortIndex(a.category) - categorySortIndex(b.category)
    || sortSv(a.category, b.category)
    || sortSv(a.type, b.type)
    || sortSv(a.name, b.name);
}

function categorySortIndex(category) {
  const index = CATEGORY_OPTIONS.indexOf(category);
  return index === -1 ? CATEGORY_OPTIONS.length : index;
}

function renderPrintLocation(location, entries) {
  const section = el("section", "print-location");
  const heading = el("h2");
  heading.textContent = location;
  section.append(heading);

  const categories = [...new Set(entries.map((entry) => entry.category))];
  categories.forEach((category) => {
    const categorySection = el("section", "print-category");
    const categoryHeading = el("h3");
    categoryHeading.textContent = formatCategoryLabel(category);
    const list = el("ul", "print-list");
    list.append(...entries.filter((entry) => entry.category === category).map(renderPrintInventoryRow));
    categorySection.append(categoryHeading, list);
    section.append(categorySection);
  });
  return section;
}

function renderPrintInventoryRow(entry) {
  const row = el("li");
  const note = normalizeLabel(entry.note || entry.notes || entry.notering || "");
  row.innerHTML = `
    <span><strong>${escapeHtml(entry.type)}</strong> — ${escapeHtml(entry.name)} — ${escapeHtml(formatAmount(entry.amount))} ${escapeHtml(entry.unit)}</span>
    ${note ? `<small>${escapeHtml(note)}</small>` : ""}
  `;
  return row;
}

function formatPrintDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function syncCategoryFilter() {
  const current = els.filterCategory.value;
  els.filterCategory.replaceChildren(option("all", "Alla"), ...CATEGORY_OPTIONS.map((category) => option(category, category)));
  els.filterCategory.value = CATEGORY_OPTIONS.includes(current) ? current : "all";
  state.filters.category = els.filterCategory.value;
}

function syncTypeFilter() {
  const current = els.filterType.value;
  const types = [...new Set(state.data.inventory
    .filter((entry) => state.filters.category === "all" || entry.category === state.filters.category)
    .map((entry) => normalizeLabel(entry.type)).filter(Boolean))].sort(sortSv);
  els.filterType.replaceChildren(option("all", "Alla typer"), ...types.map((type) => option(type, formatTypeLabel(type))));
  els.filterType.value = types.includes(current) ? current : "all";
  state.filters.type = els.filterType.value;
}

function renderInventory() {
  syncTypeFilter();
  const entries = getFilteredInventory();
  const summary = summarizeByType(state.data.inventory);
  els.typeSummaryCount.textContent = `(${summary.length} ${summary.length === 1 ? "typ" : "typer"})`;
  els.typeSummary.replaceChildren(...summary.map(renderTypeSummary));
  renderList(els.inventoryList, entries, renderInventoryCard);
  renderStats();
}

function renderRecipes() {
  const recipes = state.data.recipes.slice().sort((a, b) => sortSv(a.name, b.name));
  renderList(els.recipeList, recipes, renderRecipeCard);
  renderStats();
}

function getFilteredInventory() {
  return state.data.inventory
    .filter((entry) => state.filters.location === "all" || entry.location === state.filters.location)
    .filter((entry) => state.filters.category === "all" || entry.category === state.filters.category)
    .filter((entry) => state.filters.type === "all" || normalizeLabel(entry.type) === state.filters.type)
    .filter((entry) => {
      if (!state.filters.search) return true;
      return [entry.name, entry.type, entry.variantId ? variantLabel(entry.variantId) : ""].join(" ").toLowerCase().includes(state.filters.search);
    })
    .sort(compareInventoryDisplay);
}

function compareInventoryDisplay(a, b) {
  const rank = (category) => {
    const index = INVENTORY_CATEGORY_ORDER.indexOf(category);
    return index < 0 ? INVENTORY_CATEGORY_ORDER.length : index;
  };
  return rank(a.category) - rank(b.category)
    || sortSv(a.category, b.category)
    || sortSv(a.type, b.type)
    || sortSv(a.name, b.name);
}

function summarizeByType(entries) {
  const rows = new Map();
  entries.forEach((entry) => {
    const type = normalizeLabel(entry.type);
    const row = rows.get(type) || { type, total: [], Hemma: [], Stugan: [] };
    row.total.push(entry);
    if (LOCATIONS.includes(entry.location)) row[entry.location].push(entry);
    rows.set(type, row);
  });
  return [...rows.values()].sort((a, b) => sortSv(a.type, b.type));
}

function renderTypeSummary(row) {
  const node = el("div", "summary-pill");
  node.innerHTML = `
    <strong>${escapeHtml(formatTypeLabel(row.type))}</strong>
    <span>Totalt ${escapeHtml(formatEntryGroup(row.total))}</span>
    <span>Hemma ${escapeHtml(formatEntryGroup(row.Hemma))}</span>
    <span>Stugan ${escapeHtml(formatEntryGroup(row.Stugan))}</span>
  `;
  return node;
}

function formatEntryGroup(entries) {
  if (!entries.length) return "0";
  const unit = chooseSummaryUnit(entries);
  if (!unit) return `${entries.length} poster`;

  const total = entries.reduce((sum, entry) => sum + convertAmount(Number(entry.amount), normalizeUnit(entry.unit), unit), 0);
  return `${formatAmount(total)} ${unit}`;
}

function chooseSummaryUnit(entries) {
  const units = [...new Set(entries.map((entry) => normalizeUnit(entry.unit)))];
  if (units.every((unit) => unit === "st")) return "st";
  if (units.every((unit) => VOLUME_UNITS.has(unit))) return "cl";
  return null;
}

function renderInventoryCard(entry) {
  const card = el("article", "card");
  const nextLocation = entry.location === "Hemma" ? "Stugan" : "Hemma";
  const unknownType = !isKnownIngredientType(entry.type);
  card.innerHTML = `
    <div class="card-head">
      <div class="card-title">
        <strong>${escapeHtml(entry.name)}</strong>
        <span>${escapeHtml(formatTypeLabel(entry.type))}${entry.variantId ? ` · ${escapeHtml(variantLabel(entry.variantId))}` : ""}</span>
      </div>
      <span class="pill"><strong>${formatAmount(entry.amount)}</strong> ${escapeHtml(entry.unit)}</span>
    </div>
    <div class="card-meta">
      <span class="pill category-badge">${escapeHtml(formatCategoryLabel(entry.category))}</span>
      <span class="pill">${escapeHtml(entry.location)}</span>
      ${unknownType ? `<span class="pill warn">Okänd typ</span>` : ""}
    </div>
    <form class="inventory-transfer">
      <label>
        <span>Flytta (${escapeHtml(entry.unit)}) · Tillgängligt: ${formatAmount(entry.amount)} ${escapeHtml(entry.unit)}</span>
        <input data-field="transfer-amount" aria-label="Mängd att flytta" type="number" step="any" min="0" max="${escapeAttr(entry.amount)}" value="${escapeAttr(entry.amount)}" required>
      </label>
      <button type="submit" data-action="move" ${entry.amount > 0 ? "" : "disabled"}>Flytta till ${nextLocation}</button>
    </form>
    <div class="card-actions two-actions">
      <button type="button" data-action="edit">Ändra</button>
      <button class="danger" type="button" data-action="delete">Ta bort</button>
    </div>
  `;

  const transferAmount = card.querySelector('[data-field="transfer-amount"]');
  transferAmount.addEventListener("input", () => transferAmount.setCustomValidity(""));
  card.querySelector('.inventory-transfer').addEventListener("submit", (event) => {
    event.preventDefault();
    if (!transferInventory(entry.id, transferAmount.valueAsNumber)) {
      transferAmount.setCustomValidity("Ange en mängd större än 0 och högst tillgängligt lager.");
      transferAmount.reportValidity();
    }
  });
  card.querySelector('[data-action="edit"]').addEventListener("click", () => editInventory(entry.id));
  card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteInventory(entry.id));
  return card;
}

function loadShoppingLocation() {
  const location = readJson(SHOPPING_LOCATION_KEY, LOCATIONS[0]);
  return SHOPPING_LOCATIONS.includes(location) ? location : LOCATIONS[0];
}

function getShoppingList(location) {
  const missing = new Map();
  // Without a single location, hasIngredient checks Hemma and Stugan for presence.
  const matchLocation = location === "Hemma/Stugan" ? undefined : location;
  state.data.recipes.forEach((recipe) => {
    recipe.ingredients.forEach((requirement) => {
      if (requirement.optional) return;
      // Use the existing presence/variant rules, without quantities or unit constraints.
      if (hasIngredient({ ...requirement, amount: null, unit: "" }, matchLocation)) return;
      const key = JSON.stringify([normalizeKey(requirement.type), requirement.variantId || ""]);
      if (!missing.has(key)) missing.set(key, {
        type: requirement.type,
        variantId: requirement.variantId || "",
        label: `${formatTypeLabel(requirement.type)}${requirement.variantId ? ` / ${variantLabel(requirement.variantId)}` : ""}`,
        recipes: new Set()
      });
      missing.get(key).recipes.add(recipe.name);
    });
  });
  return [...missing.values()].map((entry) => ({ ...entry, recipes: [...entry.recipes].sort(sortSv) }))
    .sort((a, b) => sortSv(a.label, b.label));
}

function renderShoppingList() {
  const entries = getShoppingList(state.shoppingLocation);
  els.shoppingCount.textContent = `(${entries.length} saknas)`;
  els.shoppingList.replaceChildren(...entries.map((entry) => {
    const card = el("div", "card shopping-item");
    const name = el("strong");
    name.textContent = entry.label;
    const recipes = el("span", "muted");
    recipes.textContent = entry.recipes.join(", ");
    card.append(name, recipes);
    return card;
  }));
  if (!entries.length) {
    const message = el("p", "empty-state");
    message.textContent = state.shoppingLocation === "Hemma/Stugan"
      ? "Du har alla ingredienser för dina registrerade recept hemma eller i stugan."
      : "Du har alla ingredienser för dina registrerade recept på denna plats.";
    els.shoppingList.append(message);
  }
}

function renderRecipeCard(entry) {
  const status = getRecipeStatus(entry);
  const card = el("details", "card recipe-card");
  card.innerHTML = `
    <summary class="recipe-toggle">
      <strong>${escapeHtml(entry.name)}</strong>
      <span class="pill ${status.canMake ? "ok" : "warn"}">${status.canMake ? "Kan göras" : "Saknar ingredienser"}</span>
    </summary>
    <div class="recipe-body">
    <div class="card-meta">
      ${entry.ingredients.map((recipeIngredient) => `<span class="pill ${isKnownIngredientType(recipeIngredient.type) ? "" : "warn"}">${escapeHtml(formatIngredient(recipeIngredient))}</span>`).join("")}
    </div>
    ${status.missing.length ? `<div class="missing">Saknas: ${status.missing.map(escapeHtml).join(", ")}</div>` : ""}
    <div class="instructions">${entry.ingredients.map((requirement) => {
      const alternatives = LOCATIONS.filter((place) => hasIngredient(requirement, place)).map((place) =>
        `${place}: ${matchingInventory(requirement, place).map((product) => `${product.name} (${formatAmount(product.amount)} ${product.unit})`).join(", ")}`);
      return alternatives.length ? `${escapeHtml(formatIngredient(requirement))} — ${alternatives.map(escapeHtml).join("; ")}` : "";
    }).filter(Boolean).join("<br>")}</div>
    <div class="instructions">${escapeHtml(entry.instructions)}</div>
    <div class="card-actions ${entry.sourceUrl ? "three-actions" : "two-actions"}">
      ${entry.sourceUrl ? `<a class="action-link source-link" href="${escapeAttr(entry.sourceUrl)}" target="_blank" rel="noreferrer">Receptlänk</a>` : ""}
      <button type="button" data-action="edit">Ändra</button>
      <button class="danger" type="button" data-action="delete">Ta bort</button>
    </div>
    </div>
  `;

  card.querySelector('[data-action="edit"]').addEventListener("click", () => editRecipe(entry.id));
  card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRecipe(entry.id));
  return card;
}

function getRecipeStatus(recipeEntry) {
  const locations = LOCATIONS.filter((location) => canMakeAt(recipeEntry, location));
  const missing = recipeEntry.ingredients
    .filter((recipeIngredient) => !recipeIngredient.optional)
    .filter((recipeIngredient) => !hasIngredient(recipeIngredient))
    .map(formatIngredient);

  if (!missing.length && !locations.length) missing.push("Ingredienserna räcker inte på samma lagerplats");
  return { canMake: locations.length > 0, missing, locations };
}

function canMakeAt(recipeEntry, location) {
  const remaining = new Map(state.data.inventory.map((entry) => [entry.id,
    VOLUME_UNITS.has(normalizeUnit(entry.unit)) ? toCl(Number(entry.amount), normalizeUnit(entry.unit)) : Number(entry.amount)]));
  // Reserve specific variants first so generic requirements cannot consume them twice.
  const requirements = recipeEntry.ingredients.filter((entry) => !entry.optional)
    .slice().sort((a, b) => Number(Boolean(b.variantId)) - Number(Boolean(a.variantId)));
  return requirements.every((requirement) => {
    if (!isKnownIngredientType(requirement.type)) return false;
    let needed = VOLUME_UNITS.has(normalizeUnit(requirement.unit))
      ? toCl(requirement.amount, normalizeUnit(requirement.unit)) : requirement.amount;
    const products = matchingInventory(requirement, location);
    // Stänk only requires positive stock; it does not consume a measured amount.
    if (normalizeUnit(requirement.unit) === "stänk") return products.length > 0;
    if (!needed) return products.some((entry) => remaining.get(entry.id) > 0);
    for (const product of products) {
      const used = Math.min(remaining.get(product.id), needed);
      remaining.set(product.id, remaining.get(product.id) - used);
      needed -= used;
    }
    return needed <= 1e-9;
  });
}

function matchingInventory(recipeIngredient, location) {
  const variant = ingredientVariantsStore.find((entry) => entry.id === recipeIngredient.variantId);
  if (recipeIngredient.variantId && (!variant || normalizeKey(variant.type) !== normalizeKey(recipeIngredient.type))) return [];
  return state.data.inventory.filter((entry) => normalizeKey(entry.type) === normalizeKey(recipeIngredient.type)
    && (!recipeIngredient.variantId || entry.variantId === recipeIngredient.variantId)
    && (!location || entry.location === location) && Number(entry.amount) > 0
    && (normalizeUnit(entry.unit) === normalizeUnit(recipeIngredient.unit)
      || normalizeUnit(recipeIngredient.unit) === "stänk"
      || (VOLUME_UNITS.has(normalizeUnit(entry.unit)) && VOLUME_UNITS.has(normalizeUnit(recipeIngredient.unit)))
      || !recipeIngredient.unit));
}

function hasIngredient(recipeIngredient, location) {
  if (!isKnownIngredientType(recipeIngredient.type)) return false;
  if (!location) return LOCATIONS.some((place) => hasIngredient(recipeIngredient, place));
  const matches = matchingInventory(recipeIngredient, location);

  if (!matches.length) return false;
  if (!recipeIngredient.amount || !recipeIngredient.unit) return true;

  const wantedUnit = normalizeUnit(recipeIngredient.unit);
  if (wantedUnit === "stänk") return true;
  if (wantedUnit === "st") {
    return sumByUnit(matches, "st") >= recipeIngredient.amount;
  }

  if (VOLUME_UNITS.has(wantedUnit)) {
    const availableCl = matches
      .filter((entry) => VOLUME_UNITS.has(normalizeUnit(entry.unit)))
      .reduce((sum, entry) => sum + toCl(Number(entry.amount), normalizeUnit(entry.unit)), 0);
    return availableCl >= toCl(recipeIngredient.amount, wantedUnit);
  }

  return sumByUnit(matches, wantedUnit) >= recipeIngredient.amount;
}

function sumByUnit(entries, unit) {
  return entries
    .filter((entry) => normalizeUnit(entry.unit) === unit)
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
}

function addRecipeIngredientRow(recipeIngredient = ingredient("", 1, "cl")) {
  const row = el("div", "ingredient-row");
  row.innerHTML = `
    <label>
      <span>Typ</span>
      <select data-field="type" required></select>
    </label>
    <label class="variant-field">
      <span>Variant (valfri)</span>
      <select data-field="variant"></select>
    </label>
    <label>
      <span>Mängd</span>
      <input data-field="amount" type="number" min="0" step="0.1" required placeholder="5">
    </label>
    <label>
      <span>Enhet</span>
      <select data-field="unit" required>
        <option value="cl">cl</option>
        <option value="ml">ml</option>
        <option value="l">l</option>
        <option value="st">st</option>
        <option value="stänk">stänk</option>
      </select>
    </label>
    <label class="optional-field">
      <input data-field="optional" type="checkbox">
      <span>Valfri</span>
    </label>
    <button class="danger" type="button" data-action="remove" aria-label="Ta bort ingrediens">Ta bort</button>
    <button type="button" data-action="new-ingredient">Ny ingrediens…</button>
  `;

  populateIngredientTypeSelect(row.querySelector('[data-field="type"]'), recipeIngredient.type);
  const typeSelect = row.querySelector('[data-field="type"]');
  const variantSelect = row.querySelector('[data-field="variant"]');
  populateVariantSelect(variantSelect, typeSelect.value, recipeIngredient.variantId, true);
  typeSelect.addEventListener("change", () => populateVariantSelect(variantSelect, typeSelect.value, "", true));
  row.querySelector('[data-action="new-ingredient"]').addEventListener("click", () => openIngredientDefinition(row));
  row.querySelector('[data-field="amount"]').value = recipeIngredient.amount ?? "";
  row.querySelector('[data-field="unit"]').value = normalizeUnit(recipeIngredient.unit || "cl");
  row.querySelector('[data-field="optional"]').checked = Boolean(recipeIngredient.optional);
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    row.remove();
    if (!els.recipeIngredientRows.children.length) addRecipeIngredientRow();
  });

  els.recipeIngredientRows.append(row);
}

function setRecipeIngredientRows(ingredients) {
  els.recipeIngredientRows.replaceChildren();
  const rows = ingredients.length ? ingredients : [ingredient("", 1, "cl")];
  rows.forEach(addRecipeIngredientRow);
}

function collectRecipeIngredients() {
  return [...els.recipeIngredientRows.querySelectorAll(".ingredient-row")]
    .map((row) => ingredient(
      row.querySelector('[data-field="type"]').value,
      row.querySelector('[data-field="amount"]').value,
      row.querySelector('[data-field="unit"]').value,
      row.querySelector('[data-field="optional"]').checked,
      row.querySelector('[data-field="variant"]').value
    ))
    .filter((recipeIngredient) => recipeIngredient.type);
}

function saveInventoryFromForm(event) {
  event.preventDefault();
  const payload = sanitizeInventory({
    ...state.data.inventory.find((entry) => entry.id === els.inventoryId.value),
    id: els.inventoryId.value || createId(),
    type: els.inventoryType.value,
    variantId: els.inventoryVariant.value,
    name: els.inventoryName.value.trim(),
    amount: els.inventoryAmount.value,
    unit: els.inventoryUnit.value,
    location: els.inventoryLocation.value
  });

  if (!payload.type || !payload.name || !payload.unit) return;
  try { validateVariants({ inventory: [payload] }, ingredientVariantsStore); }
  catch { showToast("Välj en variant som hör till produktens typ."); return; }

  if (els.inventoryId.value) {
    updateInventory(els.inventoryId.value, payload, "Ingrediens sparad.");
  } else {
    state.data.inventory.push(payload);
    persistAndRender("Ingrediens tillagd.");
  }

  resetInventoryForm();
}

function saveRecipeFromForm(event) {
  event.preventDefault();
  const ingredients = collectRecipeIngredients();
  if (!ingredients.length || !ingredients.every(isCompleteIngredient)) {
    showToast("Fyll i typ, mängd och enhet för varje ingrediens.");
    return;
  }

  const payload = sanitizeRecipe({
    ...state.data.recipes.find((entry) => entry.id === els.recipeId.value),
    id: els.recipeId.value || createId(),
    name: els.recipeName.value.trim(),
    category: getExistingRecipeCategory(els.recipeId.value),
    ingredients,
    instructions: els.recipeInstructions.value.trim(),
    sourceUrl: normalizeSourceUrl(els.recipeSourceUrl.value)
  });

  if (!payload.name || !payload.ingredients.length || !payload.instructions) return;
  try { validateVariants({ recipes: [payload] }, ingredientVariantsStore); }
  catch { showToast("Välj en variant som hör till ingrediensens typ."); return; }

  if (els.recipeId.value) {
    updateRecipe(els.recipeId.value, payload, "Recept sparat.");
  } else {
    state.data.recipes.push(payload);
    persistAndRender("Recept tillagt.");
  }

  resetRecipeForm();
}

function saveTypeFromForm(event) {
  event.preventDefault();
  const type = normalizeLabel(els.newTypeName.value);
  const category = els.newTypeCategory.value;

  if (!type || !CATEGORY_OPTIONS.includes(category)) return;
  if (isKnownIngredientType(type)) {
    showToast("Typen finns redan.");
    return;
  }

  ingredientTypesStore = normalizeIngredientTypes([
    ...ingredientTypesStore,
    { id: createTypeId(type), type, category }
  ]);
  persistIngredientTypes();
  refreshTypeControls();
  render();
  resetTypeForm();
  showToast("Typ tillagd.");
}

function updateInventory(id, patch, message = "Ingrediens uppdaterad.") {
  state.data.inventory = state.data.inventory.map((entry) => entry.id === id ? { ...entry, ...patch } : entry);
  persistAndRender(message);
}

function transferInventory(id, amount) {
  const source = state.data.inventory.find((entry) => entry.id === id);
  if (!source || !LOCATIONS.includes(source.location) || !Number.isFinite(amount)
    || amount <= 0 || amount > source.amount) return false;

  const location = source.location === "Hemma" ? "Stugan" : "Hemma";
  // Keep different products, variants and units on separate cards.
  const destination = state.data.inventory.find((entry) => entry.id !== id
    && entry.location === location && entry.type === source.type
    && entry.name === source.name && (entry.variantId || "") === (source.variantId || "")
    && entry.unit === source.unit);
  const fullTransfer = amount === source.amount;
  if (destination) {
    destination.amount += amount;
    if (fullTransfer) state.data.inventory = state.data.inventory.filter((entry) => entry.id !== id);
    else source.amount -= amount;
  } else if (fullTransfer) {
    source.location = location;
  } else {
    source.amount -= amount;
    state.data.inventory.push({ ...source, id: createId(), amount, location });
  }
  persistAndRender(`Flyttade ${formatAmount(amount)} ${source.unit} till ${location}.`);
  return true;
}

function updateRecipe(id, patch, message = "Recept uppdaterat.") {
  state.data.recipes = state.data.recipes.map((entry) => entry.id === id ? { ...entry, ...patch } : entry);
  persistAndRender(message);
}

function getExistingRecipeCategory(id) {
  return state.data.recipes.find((entry) => entry.id === id)?.category || "Recept";
}

function editInventory(id) {
  const entry = state.data.inventory.find((candidate) => candidate.id === id);
  if (!entry) return;
  els.inventoryId.value = entry.id;
  populateIngredientTypeSelect(els.inventoryType, entry.type);
  populateVariantSelect(els.inventoryVariant, entry.type, entry.variantId);
  els.inventoryName.value = entry.name;
  els.inventoryAmount.value = entry.amount;
  els.inventoryUnit.value = entry.unit;
  els.inventoryLocation.value = LOCATIONS.includes(entry.location) ? entry.location : "Hemma";
  els.inventoryFormMode.textContent = "Redigerar";
  els.inventoryForm.closest("details").open = true;
  els.inventoryName.focus();
}

function editRecipe(id) {
  const entry = state.data.recipes.find((candidate) => candidate.id === id);
  if (!entry) return;
  els.recipeId.value = entry.id;
  els.recipeName.value = entry.name;
  setRecipeIngredientRows(entry.ingredients);
  els.recipeInstructions.value = entry.instructions;
  els.recipeSourceUrl.value = entry.sourceUrl || "";
  els.recipeFormMode.textContent = "Redigerar";
  els.recipeForm.closest("details").open = true;
  els.recipeName.focus();
}

function deleteInventory(id) {
  const entry = state.data.inventory.find((candidate) => candidate.id === id);
  if (!entry || !confirm(`Ta bort ${entry.name}?`)) return;
  state.data.inventory = state.data.inventory.filter((candidate) => candidate.id !== id);
  persistAndRender("Ingrediens borttagen.");
}

function deleteRecipe(id) {
  const entry = state.data.recipes.find((candidate) => candidate.id === id);
  if (!entry || !confirm(`Ta bort receptet ${entry.name}?`)) return;
  state.data.recipes = state.data.recipes.filter((candidate) => candidate.id !== id);
  persistAndRender("Recept borttaget.");
}

function resetInventoryForm() {
  els.inventoryForm.reset();
  els.inventoryId.value = "";
  populateIngredientTypeSelect(els.inventoryType);
  populateVariantSelect(els.inventoryVariant, "");
  els.inventoryFormMode.textContent = "Ny ingrediens";
}

function resetRecipeForm() {
  els.recipeForm.reset();
  els.recipeId.value = "";
  setRecipeIngredientRows([]);
  els.recipeFormMode.textContent = "Nytt recept";
}

function resetTypeForm() {
  els.typeForm.reset();
  populateCategorySelect(els.newTypeCategory);
}

function refreshTypeControls(oldType = "", newType = "") {
  const renamed = (value) => oldType && normalizeKey(value) === normalizeKey(oldType) ? newType : value;
  const inventoryType = renamed(els.inventoryType.value);
  populateIngredientTypeSelect(els.inventoryType, inventoryType);
  populateVariantSelect(els.inventoryVariant, inventoryType, els.inventoryVariant.value);
  populateIngredientTypeSelect(els.newVariantType, renamed(els.newVariantType.value));
  if (oldType && normalizeKey(els.definitionType.value) === normalizeKey(oldType)) {
    populateIngredientTypeSelect(els.definitionType, newType);
  }
  renderVariants();
  // Refresh only selects: retain unfinished rows, amounts, units and optional flags.
  els.recipeIngredientRows.querySelectorAll(".ingredient-row").forEach((row) => {
    const typeSelect = row.querySelector('[data-field="type"]');
    const variantSelect = row.querySelector('[data-field="variant"]');
    populateIngredientTypeSelect(typeSelect, renamed(typeSelect.value));
    populateVariantSelect(variantSelect, typeSelect.value, variantSelect.value, true);
  });
}

function persistAndRender(message) {
  persist();
  render();
  if (message) showToast(message);
}

function exportData() {
  const backup = createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cocktails-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  localStorage.setItem(LAST_EXPORTED_KEY, new Date().toISOString());
  renderBackupStatus();
  showBackupMessage("Backup skapad", backup, backup.ingredientTypes);
}

function importData(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = normalizeBackup(JSON.parse(reader.result));
      if (!isReasonableData(imported.data)) throw new Error("Invalid Cocktails data");
      pendingRestore = imported;
      showRestoreDialog();
    } catch {
      alert("Kunde inte läsa backupfilen. Kontrollera att det är en Cocktails JSON-backup.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function createBackup() {
  return {
    inventory: state.data.inventory,
    recipes: state.data.recipes,
    settings: {
      panels: readJson(PANEL_KEY, {})
    },
    ingredientTypes: ingredientTypesStore,
    ingredientVariants: ingredientVariantsStore,
    schemaVersion: 2
  };
}

function showRestoreDialog() {
  if (typeof els.restoreDialog.showModal === "function") {
    els.restoreDialog.showModal();
    return;
  }

  const confirmed = confirm([
    "Denna åtgärd ersätter all lokal data med innehållet i backupfilen.",
    "",
    "Detta kommer att ersätta:",
    "",
    "* Lager",
    "* Recept",
    "* Typer och ingrediensvarianter",
    "* Inställningar"
  ].join("\n"));
  if (confirmed) applyPendingRestore();
  else clearPendingRestore();
}

function applyPendingRestore(event) {
  if (event) event.preventDefault();
  if (!pendingRestore) return;

  const imported = pendingRestore;
  clearPendingRestore();
  if (els.restoreDialog.open) els.restoreDialog.close();
  restoreBackup(imported);
}

function clearPendingRestore() {
  pendingRestore = null;
}

function restoreBackup(imported) {
  ingredientTypesStore = imported.ingredientTypes;
  ingredientVariantsStore = imported.ingredientVariants;
  state.data = imported.data;
  persistIngredientTypes();

  localStorage.setItem(PANEL_KEY, JSON.stringify(imported.settings.panels || {}));
  restorePanelState();

  localStorage.setItem(LAST_RESTORED_KEY, new Date().toISOString());
  resetInventoryForm();
  resetRecipeForm();
  resetTypeForm();
  refreshTypeControls();
  render();
  showRestoreLog(imported.data, imported.ingredientTypes);
}

function normalizeBackup(data) {
  if (!data || !Array.isArray(data.inventory) || !Array.isArray(data.recipes)) throw new Error("Invalid data");
  if (data.ingredientVariants !== undefined && !Array.isArray(data.ingredientVariants)) throw new Error("Invalid ingredient variants");
  let ingredientTypes = Array.isArray(data.ingredientTypes)
    ? normalizeIngredientTypes(data.ingredientTypes)
    : recoverLegacyTypes(data);
  const previousTypes = ingredientTypesStore;
  const previousVariants = ingredientVariantsStore;
  let normalizedData;
  let ingredientVariants;
  try {
    ingredientTypesStore = ingredientTypes;
    ingredientVariantsStore = Array.isArray(data.ingredientVariants) ? data.ingredientVariants.map((entry) => ({ ...entry })) : [];
    let source = JSON.parse(JSON.stringify(data));
    ingredientVariants = ingredientVariantsStore;
    validateVariants(source, ingredientVariants);
    const migrated = migrateIngredientStructure(source, ingredientTypes, ingredientVariants);
    source = migrated.data;
    ingredientTypes = migrated.types;
    ingredientTypesStore = ingredientTypes;
    ingredientVariants = migrated.variants;
    ingredientVariants = simplifyIngredientVariants(source, ingredientVariants);
    ingredientVariantsStore = ingredientVariants;
    validateVariants(source, ingredientVariants);
    normalizedData = normalizeData(source);
  } finally {
    ingredientTypesStore = previousTypes;
    ingredientVariantsStore = previousVariants;
  }

  return {
    data: normalizedData,
    ingredientTypes,
    ingredientVariants,
    settings: data.settings && typeof data.settings === "object" ? data.settings : {}
  };
}

function showRestoreLog(data, ingredientTypes) {
  showBackupMessage("Backup inläst", data, ingredientTypes);
}

function showBackupMessage(title, data, ingredientTypes) {
  const message = [
    title,
    "",
    `Inventory: ${data.inventory.length}`,
    `Recipes: ${data.recipes.length}`,
    `Ingredient Types: ${ingredientTypes.length}`
  ].join("\n");
  els.restoreLog.textContent = message;
  els.restoreLog.hidden = false;
  showToast(message);
}

function formatStoredDate(value) {
  if (!value) return "Aldrig";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Aldrig";
  return date.toLocaleString("sv-SE", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function normalizeData(data) {
  if (!data || !Array.isArray(data.inventory) || !Array.isArray(data.recipes)) {
    throw new Error("Invalid data");
  }

  return {
    inventory: data.inventory.map(sanitizeInventory),
    recipes: data.recipes.map(sanitizeRecipe)
  };
}

function isReasonableData(data) {
  return data.inventory.every((entry) => (
    entry.id && entry.name && entry.type && entry.category && Number.isFinite(entry.amount) && entry.unit && LOCATIONS.includes(entry.location)
  )) && data.recipes.every((entry) => (
    entry.id && entry.name && Array.isArray(entry.ingredients) && entry.ingredients.every(isCompleteIngredient)
  ));
}

function sanitizeInventory(entry) {
  const type = normalizeIngredientType(entry.type || "Okänd");
  const note = normalizeLabel(entry.note || entry.notes || entry.notering || "");
  return {
    ...entry,
    id: String(entry.id || createId()),
    category: getIngredientCategory(type),
    type,
    ...(entry.variantId ? { variantId: String(entry.variantId) } : {}),
    name: String(entry.name || "Namnlös"),
    amount: Number(entry.amount || 0),
    unit: normalizeUnit(entry.unit || "st"),
    location: LOCATIONS.includes(entry.location) ? entry.location : "Hemma",
    ...(note ? { note } : {})
  };
}

function sanitizeRecipe(entry) {
  return {
    ...entry,
    id: String(entry.id || createId()),
    name: String(entry.name || "Namnlöst recept"),
    category: String(entry.category || "Okategoriserat"),
    ingredients: Array.isArray(entry.ingredients) ? entry.ingredients.map(sanitizeIngredient) : [],
    instructions: String(entry.instructions || ""),
    sourceUrl: normalizeSourceUrl(entry.sourceUrl || "")
  };
}

function sanitizeIngredient(value) {
  if (typeof value === "string") return parseIngredientLine(value);
  return { ...value, ...ingredient(value.type || "", value.amount ?? null, value.unit || "", Boolean(value.optional), value.variantId) };
}

function isCompleteIngredient(recipeIngredient) {
  return Boolean(
    recipeIngredient.type &&
    Number.isFinite(recipeIngredient.amount) &&
    recipeIngredient.amount > 0 &&
    recipeIngredient.unit
  );
}

function parseIngredients(value) {
  return value
    .split(/\n|,/)
    .map(parseIngredientLine)
    .filter((item) => item.type);
}

function parseIngredientLine(line) {
  const optional = /\boptional\b|\bvalfri\b|\(valfri\)|\(optional\)/i.test(line);
  const cleaned = String(line)
    .replace(/\(?(optional|valfri)\)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const match = cleaned.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(ml|cl|l|liter|st|stänk)$/i);

  if (!match) return ingredient(cleaned, null, "", optional);
  return ingredient(match[1], Number(match[2].replace(",", ".")), match[3], optional);
}

function renderList(container, entries, renderer) {
  container.replaceChildren();
  if (!entries.length) {
    container.append(els.emptyTemplate.content.firstElementChild.cloneNode(true));
    return;
  }
  container.append(...entries.map(renderer));
}

function option(value, label) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  return node;
}

function populateIngredientTypeSelect(select, selectedType = "") {
  const normalizedSelectedType = normalizeIngredientType(selectedType);
  const options = [
    option("", "Välj typ"),
    ...ingredientTypesStore.slice().sort((a, b) => sortSv(a.type, b.type)).map((entry) => option(entry.type, entry.type))
  ];

  if (normalizedSelectedType && !isKnownIngredientType(normalizedSelectedType)) {
    const unknownOption = option(normalizedSelectedType, formatTypeLabel(normalizedSelectedType));
    unknownOption.dataset.unknown = "true";
    options.push(unknownOption);
  }

  select.replaceChildren(...options);
  select.value = normalizedSelectedType;
}

function populateCategorySelect(select, selectedCategory = CATEGORY_OPTIONS[0]) {
  select.replaceChildren(...CATEGORY_OPTIONS.map((category) => option(category, category)));
  select.value = CATEGORY_OPTIONS.includes(selectedCategory) ? selectedCategory : "Övrigt";
}

function migrateIngredientStructure(data, types, variants) {
  const migrated = migrateFlavoredSpirits(data, types, variants);
  if (!Array.isArray(migrated.variants)) return migrated;
  // User-confirmed identity from the existing inventory. Never infer other products.
  const stockId = "898abb82-c31e-4763-961c-7bdf85055e07";
  const entry = migrated.data.inventory.find((entry) => entry.id === stockId);
  if (!entry || normalizeKey(entry.type) !== normalizeKey("Fruktlikör")
    || !["daiquiri", "bacardi strawberry daiquiri"].includes(normalizeKey(entry.name))
    // An explicit empty value means the user chose no variant; respect that choice.
    || Object.prototype.hasOwnProperty.call(entry, "variantId")) return migrated;
  let variant = migrated.variants.find((variant) => normalizeKey(variant.type) === normalizeKey("Fruktlikör")
    && normalizeKey(variant.name) === "bacardi strawberry daiquiri");
  const nextVariants = migrated.variants.slice();
  if (!variant) {
    variant = { id: createId(), type: entry.type, name: "Bacardi Strawberry Daiquiri" };
    nextVariants.push(variant);
  }
  return { ...migrated, changed: true, variants: nextVariants,
    data: { ...migrated.data, inventory: migrated.data.inventory.map((stock) => stock.id === stockId ? { ...stock, variantId: variant.id } : stock) } };
}

function migrateFlavoredSpirits(data, types, variants) {
  const groups = [
    { oldType: "Smaksatt Vodka", type: "Vodka", flavors: [
      { name: "Rhubarb", product: "Rabarbervodka" }, { name: "Pear", product: "Absolut Pears" }
    ] },
    { oldType: "Smaksatt Gin", type: "Gin", flavors: [
      { name: "Blood Orange", product: "Gibsons Blood Orange Gin" }
    ] }
  ];
  let result = { data, types, variants, changed: false };
  if (!Array.isArray(variants)) return result;
  for (const group of groups) {
    const isOld = (entry) => normalizeKey(typeof entry === "string" ? parseIngredientLine(entry).type : entry.type) === normalizeKey(group.oldType);
    const flavorFor = (name) => group.flavors.find((flavor) =>
      [flavor.name, flavor.product].some((label) => normalizeKey(normalizeLabel(label)) === normalizeKey(normalizeLabel(name))));
    const oldVariants = result.variants.filter(isOld);
    const recipeLinks = result.data.recipes.flatMap((recipe) => recipe.ingredients || []).filter(isOld);
    // A generic flavored-spirit requirement cannot safely be broadened to plain spirit.
    // Conflicting IDs also require an explicit decision; defer the whole legacy type.
    if (recipeLinks.some((entry) => !entry.variantId
      || !flavorFor(oldVariants.find((variant) => variant.id === entry.variantId)?.name))) continue;
    if (oldVariants.some((entry) => {
      const flavor = flavorFor(entry.name);
      return flavor && result.variants.some((other) => other.id !== entry.id
        && ((normalizeKey(other.type) === normalizeKey(group.type) && normalizeKey(other.name) === normalizeKey(flavor.name))
          || (isOld(other) && flavorFor(other.name) === flavor)));
    })) continue;
    let changed = false;
    let nextVariants = result.variants.map((entry) => {
      const flavor = isOld(entry) && flavorFor(entry.name);
      if (!flavor) return entry;
      changed = true;
      return { ...entry, type: group.type, name: flavor.name };
    });
    const inventory = result.data.inventory.map((entry) => {
      if (!isOld(entry)) return entry;
      const existing = entry.variantId && nextVariants.find((variant) => variant.id === entry.variantId);
      if (entry.variantId && (!existing || normalizeKey(existing.type) !== normalizeKey(group.type))) return entry;
      const flavor = existing ? flavorFor(existing.name) : flavorFor(entry.name);
      if (!flavor) return entry; // Unknown products retain their original classification.
      let variant = existing || nextVariants.find((variant) => normalizeKey(variant.type) === normalizeKey(group.type)
        && normalizeKey(variant.name) === normalizeKey(flavor.name));
      if (!variant) {
        variant = { id: createId(), type: group.type, name: flavor.name };
        nextVariants = [...nextVariants, variant];
      }
      changed = true;
      return { ...entry, type: group.type, variantId: variant.id };
    });
    const recipes = result.data.recipes.map((recipe) => {
      if (!(recipe.ingredients || []).some(isOld)) return recipe;
      changed = true;
      return { ...recipe, ingredients: recipe.ingredients.map((entry) => isOld(entry) ? { ...entry, type: group.type } : entry) };
    });
    let nextTypes = result.types;
    if (changed && !nextTypes.some((entry) => normalizeKey(entry.type) === normalizeKey(group.type))) {
      nextTypes = [...nextTypes, { ...DEFAULT_INGREDIENT_TYPES.find((entry) => entry.type === group.type) }];
    }
    const inUse = inventory.some(isOld) || recipes.some((recipe) => (recipe.ingredients || []).some(isOld)) || nextVariants.some(isOld);
    if (!inUse && nextTypes.some(isOld)) { nextTypes = nextTypes.filter((entry) => !isOld(entry)); changed = true; }
    if (changed) result = { data: { ...result.data, inventory, recipes }, types: nextTypes, variants: nextVariants, changed: true };
  }
  return result;
}

function simplifyIngredientVariants(data, variants) {
  if (!Array.isArray(variants)) return variants;
  const referencedIds = new Set([
    ...(data.inventory || []),
    ...(data.recipes || []).flatMap((entry) => entry.ingredients || [])
  ].map((entry) => entry.variantId).filter(Boolean));
  let changed = false;
  const simplified = variants.filter((entry) => {
    const redundant = normalizeKey(entry.type) === "cointreau" && normalizeKey(entry.name) === "cointreau";
    if (redundant && !referencedIds.has(entry.id)) { changed = true; return false; }
    return true;
  }).map((entry) => {
    const oldName = normalizeKey(entry.type) === "tonic" && normalizeKey(entry.name) === "pink grapefruit tonic";
    // A conflicting definition must not be merged or have its ID replaced.
    const conflict = variants.some((other) => other.id !== entry.id
      && normalizeKey(other.type) === "tonic" && normalizeKey(other.name) === "pink grapefruit");
    if (oldName && !conflict) { changed = true; return { ...entry, name: "Pink Grapefruit" }; }
    return entry;
  });
  return changed ? simplified : variants;
}

function variantLabel(id) {
  return ingredientVariantsStore.find((entry) => entry.id === id)?.name || `Okänd variant: ${id}`;
}

function populateVariantSelect(select, type, selected = "", recipeRequirement = false) {
  const variants = ingredientVariantsStore.filter((entry) => normalizeKey(entry.type) === normalizeKey(type))
    .sort((a, b) => sortSv(a.name, b.name));
  select.required = false;
  select.replaceChildren(option("", recipeRequirement ? "Ingen variant – generell typ" : "Ingen variant"),
    ...variants.map((entry) => option(entry.id, entry.name)));
  if (selected && !variants.some((entry) => entry.id === selected)) select.append(option(selected, variantLabel(selected)));
  select.value = selected || "";
}

function renderVariants() {
  els.variantList.replaceChildren(...ingredientVariantsStore.map((entry) => {
    const row = el("div", "variant-list-row");
    const label = el("span");
    label.textContent = `${entry.type} → ${entry.name}`;
    const button = el("button");
    button.type = "button";
    button.textContent = "Ta bort";
    button.setAttribute("aria-label", `Ta bort ${entry.type} → ${entry.name}`);
    button.dataset.variantId = entry.id;
    button.addEventListener("click", () => deleteIngredientVariant(entry.id));
    row.append(label, button);
    return row;
  }));
  if (!ingredientVariantsStore.length) els.variantList.textContent = "Inga ingrediensvarianter.";
}

function deleteIngredientVariant(id) {
  const variant = ingredientVariantsStore.find((entry) => entry.id === id);
  if (!variant) return;
  const inventoryCount = state.data.inventory.filter((entry) => entry.variantId === id).length;
  const recipeCount = state.data.recipes.filter((entry) => entry.ingredients.some((ingredient) => ingredient.variantId === id)).length;
  if (inventoryCount || recipeCount) {
    alert(`Kan inte ta bort ${variant.type} → ${variant.name}. Varianten används i ${inventoryCount} lagerposter och ${recipeCount} recept. Ta bort kopplingarna först.`);
    return;
  }
  if (!confirm(`Ta bort ingrediensvarianten ${variant.type} → ${variant.name}?`)) return;
  ingredientVariantsStore = ingredientVariantsStore.filter((entry) => entry.id !== id);
  persist();
  localStorage.setItem(VARIANT_STORAGE_KEY, JSON.stringify(ingredientVariantsStore));
  // Unsaved forms may have selected the now deleted definition.
  if (els.inventoryVariant.value === id) els.inventoryVariant.value = "";
  els.recipeIngredientRows.querySelectorAll('[data-field="variant"]').forEach((select) => {
    if (select.value === id) select.value = "";
  });
  refreshTypeControls();
  showToast("Ingrediensvarianten är borttagen.");
}

function saveVariantFromForm(event) {
  event.preventDefault();
  const type = els.newVariantType.value;
  const name = normalizeLabel(els.newVariantName.value);
  if (!isKnownIngredientType(type) || !name) return;
  if (ingredientVariantsStore.some((entry) => normalizeKey(entry.type) === normalizeKey(type) && normalizeKey(entry.name) === normalizeKey(name))) {
    showToast("Varianten finns redan för denna typ.");
    return;
  }
  ingredientVariantsStore.push({ id: createId(), type, name });
  persist();
  refreshTypeControls();
  els.newVariantName.value = "";
  showToast("Variant tillagd. Välj den på lagerposten eller i receptet.");
}

function recoverLegacyTypes(data) {
  const types = normalizeIngredientTypes([...ingredientTypesStore, ...DEFAULT_INGREDIENT_TYPES]);
  const ingredients = [...data.inventory, ...data.recipes.flatMap((entry) => entry.ingredients || [])];
  ingredients.forEach((entry) => {
    const type = normalizeLabel(typeof entry === "string" ? parseIngredientLine(entry).type : entry.type);
    if (type && !types.some((definition) => normalizeKey(definition.type) === normalizeKey(type))) {
      types.push({ id: createTypeId(type), type, category: CATEGORY_OPTIONS.includes(entry.category) ? entry.category : "Övrigt" });
    }
  });
  return normalizeIngredientTypes(types);
}

function openIngredientDefinition(row) {
  const inventory = row === els.inventoryForm;
  if (inventory && !isKnownIngredientType(els.inventoryType.value)) {
    showToast("Välj typ innan du skapar en variant.");
    els.inventoryType.focus();
    return;
  }
  newIngredientTarget = row;
  els.ingredientDefinitionForm.reset();
  populateIngredientTypeSelect(els.definitionType, inventory ? els.inventoryType.value : row.querySelector('[data-field="type"]').value);
  els.definitionType.disabled = inventory;
  if (!inventory) els.definitionType.append(option("__new__", "Ny typ…"));
  populateCategorySelect(els.definitionCategory);
  updateIngredientDefinitionMode();
  els.ingredientDialog.showModal();
}

function updateIngredientDefinitionMode() {
  const newType = els.definitionType.value === "__new__";
  els.definitionNewTypeFields.hidden = !newType;
  els.definitionTypeName.disabled = !newType;
  els.definitionCategory.disabled = !newType;
  els.definitionVariantName.required = false;
}

function closeIngredientDefinition() {
  els.ingredientDialog.close();
  newIngredientTarget = null;
}

function saveIngredientDefinition(event) {
  event.preventDefault();
  const row = newIngredientTarget;
  if (!row || !row.isConnected) { closeIngredientDefinition(); return; }
  const newType = els.definitionType.value === "__new__";
  const type = normalizeIngredientType(newType ? els.definitionTypeName.value : els.definitionType.value);
  const name = normalizeLabel(els.definitionVariantName.value);
  const category = els.definitionCategory.value;
  if (!type || (!newType && !isKnownIngredientType(type)) || (newType && !CATEGORY_OPTIONS.includes(category))) return;
  if (!isKnownIngredientType(type)) {
    ingredientTypesStore = normalizeIngredientTypes([...ingredientTypesStore, { id: createTypeId(type), type, category }]);
  }
  let variant = name ? ingredientVariantsStore.find((entry) => normalizeKey(entry.type) === normalizeKey(type)
    && normalizeKey(entry.name) === normalizeKey(name)) : null;
  if (name && !variant) {
    variant = { id: createId(), type, name };
    ingredientVariantsStore.push(variant);
  }
  persistIngredientTypes();
  refreshTypeControls();
  const inventory = row === els.inventoryForm;
  populateIngredientTypeSelect(inventory ? els.inventoryType : row.querySelector('[data-field="type"]'), type);
  populateVariantSelect(inventory ? els.inventoryVariant : row.querySelector('[data-field="variant"]'), type, variant?.id, !inventory);
  render();
  closeIngredientDefinition();
  showToast(inventory ? (variant ? "Varianten är vald för produkten." : "Produkten använder enbart ingredienstypen.") : "Ingrediensen är vald i receptet.");
}

function validateVariants(data, variants) {
  const ids = new Set();
  const names = new Set();
  variants.forEach((entry) => {
    const key = `${normalizeKey(entry.type)}:${normalizeKey(normalizeLabel(entry.name))}`;
    if (!entry.id || !normalizeLabel(entry.name) || !isKnownIngredientType(entry.type) || ids.has(entry.id) || names.has(key)) throw new Error("Invalid ingredient variants");
    ids.add(entry.id);
    names.add(key);
  });
  [...(data.inventory || []), ...(data.recipes || []).flatMap((entry) => entry.ingredients || [])].forEach((entry) => {
    if (!entry.variantId) return;
    const variant = variants.find((candidate) => candidate.id === entry.variantId);
    if (!variant || normalizeKey(variant.type) !== normalizeKey(entry.type)) throw new Error("Invalid variant reference");
  });
}

function isKnownIngredientType(type) {
  return Boolean(getCanonicalIngredientType(type));
}

function formatTypeLabel(type) {
  const normalizedType = normalizeIngredientType(type);
  return isKnownIngredientType(normalizedType) ? normalizedType : `Okänd typ: ${normalizedType || "tom"}`;
}

function getIngredientCategory(type) {
  return getIngredientDefinition(type)?.category || "Okänd kategori";
}

function formatCategoryLabel(category) {
  return CATEGORY_OPTIONS.includes(category) ? category : "Okänd kategori";
}

function normalizeIngredientTypes(entries) {
  return applyVermouthCategory(normalizeIngredientTypesBase(entries));
}

function normalizeIngredientTypesBase(entries) {
  const seen = new Set();
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      id: String(entry.id || createTypeId(entry.type)),
      type: normalizeLabel(entry.type),
      category: CATEGORY_OPTIONS.includes(entry.category) ? entry.category : "Övrigt"
    }))
    .filter((entry) => {
      const key = normalizeKey(entry.type);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => sortSv(a.category, b.category) || sortSv(a.type, b.type));
}

function createTypeId(type) {
  const slug = normalizeKey(type)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `type-${slug}` : createId();
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function cloneData(data) {
  return normalizeData(JSON.parse(JSON.stringify(data)));
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeLabel(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeIngredientType(value) {
  const label = normalizeLabel(value);
  return getCanonicalIngredientType(label) || label;
}

function getCanonicalIngredientType(value) {
  const key = normalizeKey(value);
  return getIngredientDefinition(value)?.type || "";
}

function getIngredientDefinition(value) {
  const key = normalizeKey(value);
  return ingredientTypesStore.find((entry) => normalizeKey(entry.type) === key) || null;
}

function normalizeUnit(value) {
  const unit = normalizeKey(value);
  if (unit === "ltr" || unit === "liter") return "l";
  return unit;
}

function normalizeSourceUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function convertAmount(amount, fromUnit, toUnit) {
  if (fromUnit === toUnit) return amount;
  if (VOLUME_UNITS.has(fromUnit) && VOLUME_UNITS.has(toUnit)) {
    return toCl(amount, fromUnit) / VOLUME_UNITS.get(toUnit);
  }
  return 0;
}

function toCl(amount, unit) {
  return amount * VOLUME_UNITS.get(unit);
}

function sortSv(a, b) {
  return String(a || "").localeCompare(String(b || ""), "sv", { sensitivity: "base" });
}

function formatAmount(value) {
  return Number(value).toLocaleString("sv-SE", { maximumFractionDigits: 1 });
}

function formatIngredient(recipeIngredient) {
  const amount = recipeIngredient.amount ? ` ${formatAmount(recipeIngredient.amount)} ${recipeIngredient.unit}` : "";
  const optional = recipeIngredient.optional ? " (valfri)" : "";
  return `${formatTypeLabel(recipeIngredient.type)}${recipeIngredient.variantId ? ` · ${variantLabel(recipeIngredient.variantId)}` : ""}${amount}${optional}`;
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2600);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => {
        const reloadKey = "cocktails:dev-sw-reload";
        if (navigator.serviceWorker.controller && !sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "true");
          location.reload();
          return;
        }
        sessionStorage.removeItem(reloadKey);
      })
      .catch(() => {});
    return;
  }

  let reloadingForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    location.reload();
  });
  navigator.serviceWorker.register("service-worker.js", { updateViaCache: "none" }).catch(() => {});
}
