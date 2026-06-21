const STORAGE_KEY = "cocktails:data:v1";
const TYPE_STORAGE_KEY = "ingredientTypes";
const PANEL_KEY = "cocktails:panels:v1";
const LAST_EXPORTED_KEY = "cocktails:backup:lastExportedAt";
const LAST_RESTORED_KEY = "cocktails:backup:lastRestoredAt";
const LOCATIONS = ["Hemma", "Stugan"];
const CATEGORY_OPTIONS = ["Sprit", "Likör", "Mixer", "Juice & Syrup", "Bitters & Smaksättare", "Garnityr", "Övrigt"];
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
  { id: "type-sot-vermouth", type: "Söt vermouth", category: "Likör" },
  { id: "type-torr-vermouth", type: "Torr vermouth", category: "Likör" },
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
  filters: {
    location: "all",
    category: "all",
    type: "all",
    search: ""
  }
};

const els = {};
let pendingRestore = null;

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

function ingredient(type, amount = null, unit = "", optional = false) {
  const parsedAmount = amount === null || amount === "" ? null : Number(amount);
  return { type: normalizeIngredientType(type), amount: parsedAmount, unit: normalizeUnit(unit), optional };
}

function bindElements() {
  [
    "inventoryCount", "recipeCount", "makeableCount", "inventorySummaryText", "recipeSummaryText",
    "filterLocation", "filterCategory", "filterType", "filterSearch", "typeSummary", "inventoryList", "recipeList",
    "inventoryForm", "inventoryId", "inventoryType", "inventoryName",
    "inventoryAmount", "inventoryUnit", "inventoryLocation", "inventoryFormMode",
    "resetInventoryForm", "recipeForm", "recipeId", "recipeName",
    "recipeIngredientRows", "addRecipeIngredient", "recipeInstructions", "recipeSourceUrl", "recipeFormMode",
    "resetRecipeForm", "typeForm", "newTypeName", "newTypeCategory", "typeSummaryText", "resetTypeForm",
    "exportBtn", "importInput", "emptyTemplate", "toast", "debugInventoryCount", "debugRecipeCount",
    "debugTypeCount", "restoreLog", "backupSummaryText", "lastExportedAt", "lastRestoredAt", "restoreBtn",
    "restoreDialog", "confirmRestoreBtn", "cancelRestoreBtn", "structureSummaryText", "structureReport"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
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
    return normalizeData(parsed);
  } catch {
    return cloneData(demoData);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function loadIngredientTypes() {
  const saved = localStorage.getItem(TYPE_STORAGE_KEY);
  if (saved) {
    try {
      return normalizeIngredientTypes(JSON.parse(saved));
    } catch {
      return seedIngredientTypes();
    }
  }
  return seedIngredientTypes();
}

function seedIngredientTypes() {
  const seeded = normalizeIngredientTypes(DEFAULT_INGREDIENT_TYPES);
  localStorage.setItem(TYPE_STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function persistIngredientTypes() {
  state.ingredientTypes = ingredientTypesStore;
  localStorage.setItem(TYPE_STORAGE_KEY, JSON.stringify(ingredientTypesStore));
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
  syncTypeFilter();
  renderStats();
  renderInventory();
  renderRecipes();
  renderSystemInfo();
  renderBackupStatus();
  renderStructure();
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
  return node;
}

function syncCategoryFilter() {
  const current = els.filterCategory.value;
  els.filterCategory.replaceChildren(option("all", "Alla"), ...CATEGORY_OPTIONS.map((category) => option(category, category)));
  els.filterCategory.value = CATEGORY_OPTIONS.includes(current) ? current : "all";
  state.filters.category = els.filterCategory.value;
}

function syncTypeFilter() {
  const current = els.filterType.value;
  const types = ingredientTypesStore.map((entry) => entry.type);
  els.filterType.replaceChildren(option("all", "Alla"), ...types.map((type) => option(type, formatTypeLabel(type))));
  els.filterType.value = types.includes(current) ? current : "all";
  state.filters.type = els.filterType.value;
}

function renderInventory() {
  const entries = getFilteredInventory();
  const summary = summarizeByType(state.data.inventory);
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
      return [entry.name, entry.type].join(" ").toLowerCase().includes(state.filters.search);
    })
    .sort((a, b) => sortSv(a.type, b.type) || sortSv(a.name, b.name));
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
        <span>${escapeHtml(formatTypeLabel(entry.type))}</span>
      </div>
      <span class="pill"><strong>${formatAmount(entry.amount)}</strong> ${escapeHtml(entry.unit)}</span>
    </div>
    <div class="card-meta">
      <span class="pill category-badge">${escapeHtml(formatCategoryLabel(entry.category))}</span>
      <span class="pill">${escapeHtml(entry.location)}</span>
      ${unknownType ? `<span class="pill warn">Okänd typ</span>` : ""}
    </div>
    <div class="card-actions">
      <button type="button" data-action="move">Flytta</button>
      <button type="button" data-action="edit">Ändra</button>
      <button class="danger" type="button" data-action="delete">Ta bort</button>
    </div>
  `;

  card.querySelector('[data-action="move"]').addEventListener("click", () => {
    updateInventory(entry.id, { location: nextLocation }, `Flyttade till ${nextLocation}.`);
  });
  card.querySelector('[data-action="edit"]').addEventListener("click", () => editInventory(entry.id));
  card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteInventory(entry.id));
  return card;
}

function renderRecipeCard(entry) {
  const status = getRecipeStatus(entry);
  const card = el("article", "card");
  card.innerHTML = `
    <div class="card-head">
      <div class="card-title">
        <strong>${escapeHtml(entry.name)}</strong>
        <span>${escapeHtml(entry.category)}</span>
      </div>
      <span class="pill ${status.canMake ? "ok" : "warn"}">${status.canMake ? "Kan göras" : "Saknar ingredienser"}</span>
    </div>
    <div class="card-meta">
      ${entry.ingredients.map((recipeIngredient) => `<span class="pill ${isKnownIngredientType(recipeIngredient.type) ? "" : "warn"}">${escapeHtml(formatIngredient(recipeIngredient))}</span>`).join("")}
    </div>
    ${status.missing.length ? `<div class="missing">Saknas: ${status.missing.map(escapeHtml).join(", ")}</div>` : ""}
    <div class="instructions">${escapeHtml(entry.instructions)}</div>
    <div class="card-actions ${entry.sourceUrl ? "three-actions" : "two-actions"}">
      ${entry.sourceUrl ? `<a class="action-link source-link" href="${escapeAttr(entry.sourceUrl)}" target="_blank" rel="noreferrer">Receptlänk</a>` : ""}
      <button type="button" data-action="edit">Ändra</button>
      <button class="danger" type="button" data-action="delete">Ta bort</button>
    </div>
  `;

  card.querySelector('[data-action="edit"]').addEventListener("click", () => editRecipe(entry.id));
  card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRecipe(entry.id));
  return card;
}

function getRecipeStatus(recipeEntry) {
  const missing = recipeEntry.ingredients
    .filter((recipeIngredient) => !recipeIngredient.optional)
    .filter((recipeIngredient) => !hasIngredient(recipeIngredient))
    .map(formatIngredient);

  return { canMake: missing.length === 0, missing };
}

function hasIngredient(recipeIngredient) {
  if (!isKnownIngredientType(recipeIngredient.type)) return false;

  const matches = state.data.inventory.filter((entry) => (
    entry.type === recipeIngredient.type && isKnownIngredientType(entry.type) && Number(entry.amount) > 0
  ));

  if (!matches.length) return false;
  if (!recipeIngredient.amount || !recipeIngredient.unit) return true;

  const wantedUnit = normalizeUnit(recipeIngredient.unit);
  if (wantedUnit === "st") {
    return sumByUnit(matches, "st") >= recipeIngredient.amount;
  }

  if (VOLUME_UNITS.has(wantedUnit)) {
    const availableCl = matches
      .filter((entry) => VOLUME_UNITS.has(normalizeUnit(entry.unit)))
      .reduce((sum, entry) => sum + toCl(Number(entry.amount), normalizeUnit(entry.unit)), 0);
    return availableCl >= toCl(recipeIngredient.amount, wantedUnit);
  }

  return matches.some((entry) => normalizeUnit(entry.unit) === wantedUnit);
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
      </select>
    </label>
    <label class="optional-field">
      <input data-field="optional" type="checkbox">
      <span>Valfri</span>
    </label>
    <button class="danger" type="button" data-action="remove" aria-label="Ta bort ingrediens">Ta bort</button>
  `;

  populateIngredientTypeSelect(row.querySelector('[data-field="type"]'), recipeIngredient.type);
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
      row.querySelector('[data-field="optional"]').checked
    ))
    .filter((recipeIngredient) => recipeIngredient.type);
}

function saveInventoryFromForm(event) {
  event.preventDefault();
  const payload = sanitizeInventory({
    id: els.inventoryId.value || createId(),
    type: els.inventoryType.value,
    name: els.inventoryName.value.trim(),
    amount: els.inventoryAmount.value,
    unit: els.inventoryUnit.value,
    location: els.inventoryLocation.value
  });

  if (!payload.type || !payload.name || !payload.unit) return;

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
    id: els.recipeId.value || createId(),
    name: els.recipeName.value.trim(),
    category: getExistingRecipeCategory(els.recipeId.value),
    ingredients,
    instructions: els.recipeInstructions.value.trim(),
    sourceUrl: normalizeSourceUrl(els.recipeSourceUrl.value)
  });

  if (!payload.name || !payload.ingredients.length || !payload.instructions) return;

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

function refreshTypeControls() {
  const inventoryType = els.inventoryType.value;
  populateIngredientTypeSelect(els.inventoryType, inventoryType);
  const recipeIngredients = collectRecipeIngredients();
  setRecipeIngredientRows(recipeIngredients);
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
    ingredientTypes: ingredientTypesStore
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
    "* Typer",
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
  persistIngredientTypes();

  state.data = imported.data;
  persist();

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
  const ingredientTypes = Array.isArray(data.ingredientTypes)
    ? normalizeIngredientTypes(data.ingredientTypes)
    : ingredientTypesStore;
  const previousTypes = ingredientTypesStore;
  ingredientTypesStore = ingredientTypes;
  const normalizedData = normalizeData(data);
  ingredientTypesStore = previousTypes;

  return {
    data: normalizedData,
    ingredientTypes,
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
  return {
    id: String(entry.id || createId()),
    category: getIngredientCategory(type),
    type,
    name: String(entry.name || "Namnlös"),
    amount: Number(entry.amount || 0),
    unit: normalizeUnit(entry.unit || "st"),
    location: LOCATIONS.includes(entry.location) ? entry.location : "Hemma"
  };
}

function sanitizeRecipe(entry) {
  return {
    id: String(entry.id || createId()),
    name: String(entry.name || "Namnlöst recept"),
    category: String(entry.category || "Okategoriserat"),
    ingredients: Array.isArray(entry.ingredients) ? entry.ingredients.map(sanitizeIngredient).filter(isCompleteIngredient) : [],
    instructions: String(entry.instructions || ""),
    sourceUrl: normalizeSourceUrl(entry.sourceUrl || "")
  };
}

function sanitizeIngredient(value) {
  if (typeof value === "string") return parseIngredientLine(value);
  return ingredient(value.type || "", value.amount ?? null, value.unit || "", Boolean(value.optional));
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
  const match = cleaned.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(ml|cl|l|liter|st)$/i);

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
    ...ingredientTypesStore.map((entry) => option(entry.type, entry.type))
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
  return `${formatTypeLabel(recipeIngredient.type)}${amount}${optional}`;
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
