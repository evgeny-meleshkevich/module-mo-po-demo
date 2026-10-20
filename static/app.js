function positionDropdown(component) {
  if (!component?.panel || component.panel.hidden) return;
  const margin = 12;
  const gap = 7;
  const triggerRect = component.trigger.getBoundingClientRect();
  if (triggerRect.bottom <= margin || triggerRect.top >= window.innerHeight - margin) {
    component.panel.hidden = true;
    component.trigger.setAttribute("aria-expanded", "false");
    return;
  }
  const preferredWidth = component.container.classList.contains("multiselect") ? 680 : 620;
  const width = Math.min(Math.max(triggerRect.width, preferredWidth), window.innerWidth - margin * 2);
  const left = Math.min(Math.max(margin, triggerRect.left), window.innerWidth - width - margin);
  const below = window.innerHeight - triggerRect.bottom - margin - gap;
  const above = triggerRect.top - margin - gap;
  const openAbove = below < 300 && above > below;
  const available = Math.max(160, Math.min(440, openAbove ? above : below));

  component.panel.style.left = `${left}px`;
  component.panel.style.width = `${width}px`;
  component.panel.style.maxHeight = `${available}px`;
  component.list.style.maxHeight = `${Math.max(145, available - 72)}px`;
  const panelHeight = component.panel.getBoundingClientRect().height;
  const top = openAbove
    ? triggerRect.top - panelHeight - gap
    : triggerRect.bottom + gap;
  component.panel.style.top = `${top}px`;
}

function openManagedDropdown(component) {
  const opening = component.panel.hidden;
  closeAllDropdowns(component.panel);
  component.panel.hidden = !opening;
  component.trigger.setAttribute("aria-expanded", String(opening));
  if (!opening) return;

  const rect = component.trigger.getBoundingClientRect();
  if (rect.bottom > window.innerHeight - 260 || rect.top < 90) {
    component.trigger.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  positionDropdown(component);
  window.setTimeout(() => positionDropdown(component), 240);
  component.search.focus({ preventScroll: true });
}

class SearchSelect {
  constructor(container, placeholder, onSelect) {
    this.container = container;
    this.placeholder = placeholder;
    this.onSelect = onSelect;
    this.options = [];
    this.value = "";
    this.disabled = true;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <button type="button" class="control-trigger" ${this.disabled ? "disabled" : ""} aria-expanded="false">
        <img class="brand-icon control-leading-icon" src="/static/icons/person-search.svg" alt="" aria-hidden="true">
        <span></span>
        <img class="brand-icon dropdown-arrow" src="/static/icons/download.svg" alt="" aria-hidden="true">
      </button>
      <div class="dropdown-panel" hidden>
        <label class="archive-search dropdown-search">
          <img class="brand-icon" src="/static/icons/person-search.svg" alt="" aria-hidden="true">
          <input class="search-input" type="search" placeholder="Поиск по названию">
        </label>
        <div class="option-list"></div>
      </div>`;
    this.trigger = this.container.querySelector(".control-trigger");
    this.triggerText = this.trigger.querySelector("span");
    this.panel = this.container.querySelector(".dropdown-panel");
    this.panel.__component = this;
    this.search = this.container.querySelector(".search-input");
    this.list = this.container.querySelector(".option-list");
    this.triggerText.textContent = this.value || this.placeholder;
    this.trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (this.disabled) return;
      openManagedDropdown(this);
    });
    this.search.addEventListener("input", () => {
      this.renderOptions(this.search.value);
      positionDropdown(this);
    });
    this.panel.addEventListener("click", (event) => event.stopPropagation());
    this.renderOptions("");
  }

  renderOptions(query) {
    const normalized = query.trim().toLocaleLowerCase("ru");
    const options = this.options.filter((item) => item.toLocaleLowerCase("ru").includes(normalized));
    this.list.innerHTML = "";
    if (!options.length) {
      const empty = document.createElement("span");
      empty.className = "muted dropdown-option";
      empty.textContent = "Ничего не найдено";
      this.list.append(empty);
      return;
    }
    options.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dropdown-option";
      button.textContent = item;
      button.addEventListener("click", () => {
        this.value = item;
        this.triggerText.textContent = item;
        this.panel.hidden = true;
        this.trigger.setAttribute("aria-expanded", "false");
        this.onSelect(item);
      });
      this.list.append(button);
    });
  }

  setOptions(options, { disabled = false, clear = true } = {}) {
    this.options = options;
    this.disabled = disabled;
    if (clear) this.value = "";
    this.render();
  }

  setValue(value) {
    this.value = value || "";
    this.triggerText.textContent = this.value || this.placeholder;
    this.triggerText.title = this.value;
  }
}

class MultiSelect {
  constructor(container, placeholder, onChange, showSelectedValues = false) {
    this.container = container;
    this.placeholder = placeholder;
    this.onChange = onChange;
    this.showSelectedValues = showSelectedValues;
    this.container.classList.toggle("show-selected-values", showSelectedValues);
    this.options = [];
    this.selected = [];
    this.disabled = true;
    this.render();
  }

  summary() {
    if (!this.selected.length) return this.placeholder;
    if (this.selected.length === 1) return this.selected[0];
    if (this.showSelectedValues) return this.selected.join("; ");
    return `Выбрано: ${this.selected.length}`;
  }

  render() {
    this.container.innerHTML = `
      <button type="button" class="control-trigger" ${this.disabled ? "disabled" : ""} aria-expanded="false">
        <span></span>
        <img class="brand-icon dropdown-arrow" src="/static/icons/download.svg" alt="" aria-hidden="true">
      </button>
      <div class="dropdown-panel" hidden>
        <label class="archive-search dropdown-search">
          <img class="brand-icon" src="/static/icons/person-search.svg" alt="" aria-hidden="true">
          <input class="search-input" type="search" placeholder="Поиск">
        </label>
        <div class="option-list"></div>
      </div>`;
    this.trigger = this.container.querySelector(".control-trigger");
    this.triggerText = this.trigger.querySelector("span");
    this.panel = this.container.querySelector(".dropdown-panel");
    this.panel.__component = this;
    this.search = this.container.querySelector(".search-input");
    this.list = this.container.querySelector(".option-list");
    this.triggerText.textContent = this.summary();
    this.triggerText.title = this.summary();
    this.trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (this.disabled) return;
      openManagedDropdown(this);
    });
    this.search.addEventListener("input", () => {
      this.renderOptions(this.search.value);
      positionDropdown(this);
    });
    this.panel.addEventListener("click", (event) => event.stopPropagation());
    this.renderOptions("");
  }

  renderOptions(query) {
    const normalized = query.trim().toLocaleLowerCase("ru");
    const options = this.options.filter((item) => item.toLocaleLowerCase("ru").includes(normalized));
    this.list.innerHTML = "";
    options.forEach((item) => {
      const label = document.createElement("label");
      label.className = "dropdown-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.selected.includes(item);
      const text = document.createElement("span");
      text.textContent = item;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selected = [...new Set([...this.selected, item])];
        else this.selected = this.selected.filter((value) => value !== item);
        this.triggerText.textContent = this.summary();
        this.triggerText.title = this.summary();
        this.onChange(this.selected);
      });
      label.append(checkbox, text);
      this.list.append(label);
    });
  }

  setData(options, selected = [], disabled = false) {
    this.options = [...new Set([...options, ...selected])];
    this.selected = [...new Set(selected)];
    this.disabled = disabled;
    this.render();
  }
}

const state = {
  profile: null,
  csrfToken: "",
  parsed: false,
  currentFile: null,
  businessUnit: "",
  businessShortCode: "",
  structuralUnit: "",
  job: "",
  automaticFactorsText: "",
  automaticDocumentDate: "",
  requirementsLoaded: false,
  recommendationPo: false,
  automaticPoActivities: [],
  filenameManuallyEdited: false,
  documentRevision: 0,
  archiveSearchRevision: 0,
  previewObjectUrl: "",
  authMode: "login",
  invitationToken: "",
  unitsByBusiness: new Map(),
};

const PROFILE_ID_KEY = "medflow-profile-id-v2";
const OLD_BROWSER_PROFILE_KEY = "medflow-profile-registered-v1";

const elements = {
  form: document.getElementById("document-form"),
  pdfFile: document.getElementById("pdf-file"),
  dropzone: document.getElementById("dropzone"),
  fileTitle: document.getElementById("file-title"),
  fileSubtitle: document.getElementById("file-subtitle"),
  fileAction: document.getElementById("file-action"),
  parseStatus: document.getElementById("parse-status"),
  parseWarning: document.getElementById("parse-warning"),
  fullName: document.getElementById("full-name"),
  birthDate: document.getElementById("birth-date"),
  gender: document.getElementById("gender"),
  omsField: document.getElementById("oms-field"),
  omsNumber: document.getElementById("oms-number"),
  businessUnit: document.getElementById("business-unit"),
  factorsText: document.getElementById("factors-text"),
  factorsEdited: document.getElementById("factors-edited"),
  poStatus: document.getElementById("po-status"),
  poEdited: document.getElementById("po-edited"),
  poActivitiesField: document.getElementById("po-activities-field"),
  poActivitiesEdited: document.getElementById("po-activities-edited"),
  poDocumentRow: document.getElementById("po-document-row"),
  documentDate: document.getElementById("document-date"),
  dateEdited: document.getElementById("date-edited"),
  filenameSuffix: document.getElementById("filename-suffix"),
  moFilename: document.getElementById("mo-filename"),
  poFilename: document.getElementById("po-filename"),
  readyStatus: document.getElementById("ready-status"),
  moState: document.getElementById("mo-state"),
  poState: document.getElementById("po-state"),
  downloadButtons: Array.from(document.querySelectorAll(".download-choice")),
  archiveList: document.getElementById("archive-list"),
  archiveSearch: document.getElementById("archive-search"),
  profileModal: document.getElementById("profile-modal"),
  profileButton: document.getElementById("profile-button"),
  profileTitle: document.getElementById("profile-title"),
  profileDescription: document.getElementById("profile-description"),
  logoutButton: document.getElementById("logout-button"),
  previewModal: document.getElementById("document-preview-modal"),
  previewTitle: document.getElementById("document-preview-title"),
  previewTabs: document.getElementById("document-preview-tabs"),
  previewFrame: document.getElementById("document-preview-frame"),
  previewLoading: document.getElementById("document-preview-loading"),
  closePreview: document.getElementById("close-document-preview"),
  authModal: document.getElementById("auth-modal"),
  authForm: document.getElementById("auth-form"),
  authTitle: document.getElementById("auth-title"),
  authDescription: document.getElementById("auth-description"),
  authEmail: document.getElementById("auth-email"),
  authEmailField: document.getElementById("auth-email-field"),
  authPassword: document.getElementById("auth-password"),
  authDisplayField: document.getElementById("auth-display-field"),
  authDisplayName: document.getElementById("auth-display-name"),
  authSignerFields: document.getElementById("auth-signer-fields"),
  authSignerName: document.getElementById("auth-signer-name"),
  authSignature: document.getElementById("auth-signature"),
  authError: document.getElementById("auth-error"),
  authSubmit: document.getElementById("auth-submit"),
  adminButton: document.getElementById("admin-button"),
  adminUsers: document.getElementById("admin-users"),
  invitationForm: document.getElementById("invitation-form"),
  invitationEmail: document.getElementById("invitation-email"),
  invitationRole: document.getElementById("invitation-role"),
  invitationResult: document.getElementById("invitation-result"),
  invitationLink: document.getElementById("invitation-link"),
  copyInvitation: document.getElementById("copy-invitation"),
  adminInvitations: document.getElementById("admin-invitations"),
  catalogButton: document.getElementById("catalog-button"),
  downloadCatalog: document.getElementById("download-catalog"),
  catalogUploadForm: document.getElementById("catalog-upload-form"),
  catalogFile: document.getElementById("catalog-file"),
  catalogValidation: document.getElementById("catalog-validation"),
  catalogVersions: document.getElementById("catalog-versions"),
  toast: document.getElementById("toast"),
};

function closeAllDropdowns(except = null) {
  document.querySelectorAll(".dropdown-panel").forEach((panel) => {
    if (panel !== except) panel.hidden = true;
  });
  document.querySelectorAll(".control-trigger").forEach((trigger) => {
    const panel = trigger.nextElementSibling;
    trigger.setAttribute("aria-expanded", String(panel && !panel.hidden));
  });
}

document.addEventListener("click", () => closeAllDropdowns());
window.addEventListener("resize", () => document.querySelectorAll(".dropdown-panel:not([hidden])").forEach((panel) => positionDropdown(panel.__component)), { passive: true });
window.addEventListener("scroll", (event) => {
  if (event.target instanceof Element && event.target.closest(".dropdown-panel")) return;
  document.querySelectorAll(".dropdown-panel:not([hidden])").forEach((panel) => positionDropdown(panel.__component));
}, { passive: true, capture: true });

const unitSelect = new SearchSelect(document.getElementById("unit-combobox"), "Выберите структурное подразделение", async (value) => {
  const revision = state.documentRevision;
  const businessUnit = state.businessUnit;
  state.structuralUnit = value;
  state.job = "";
  state.requirementsLoaded = false;
  resetRequirements();
  const jobs = await api(`/api/catalog/${businessUnit}/jobs?structural_unit=${encodeURIComponent(value)}`);
  if (revision !== state.documentRevision || businessUnit !== state.businessUnit || value !== state.structuralUnit) return;
  jobSelect.setOptions(jobs, { disabled: false });
  updateReadiness();
});

const jobSelect = new SearchSelect(document.getElementById("job-combobox"), "Выберите должность", async (value) => {
  state.job = value;
  await loadRequirements();
});

const poSelect = new MultiSelect(document.getElementById("po-multiselect"), "Выберите виды деятельности", () => {
  updateEditedIndicators();
  updateReadiness();
});

async function authenticatedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const method = (options.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && state.csrfToken) {
    headers.set("X-CSRF-Token", state.csrfToken);
  }
  return fetch(url, { ...options, headers, credentials: "same-origin" });
}

async function responseError(response) {
  let message = "Произошла ошибка";
  try {
    const body = await response.json();
    if (Array.isArray(body.detail)) {
      message = body.detail
        .map((item) => item?.msg || String(item))
        .filter(Boolean)
        .join(". ") || message;
    } else if (typeof body.detail === "string") {
      message = body.detail;
    } else if (body.detail) {
      message = JSON.stringify(body.detail);
    }
  } catch (_) {
    message = response.statusText || message;
  }
  return new Error(message);
}

async function api(url, options = {}) {
  const response = await authenticatedFetch(url, options);
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json();
}

async function downloadFromUrl(url, filename) {
  const response = await authenticatedFetch(url);
  if (!response.ok) throw await responseError(response);
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || "Документы.zip";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function today() {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
}

function showToast(message, duration = 4200) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => { elements.toast.hidden = true; }, duration);
}

function isValidDocumentDate(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatRussianDateInput(event) {
  const input = event.currentTarget;
  const isDeleting = event.inputType?.startsWith("delete");
  const caret = input.selectionStart ?? input.value.length;

  // Deleting or editing inside an existing date must remain a native text-field
  // operation. Reformatting the whole value here would move the caret to the end
  // and shift all remaining digits into different date parts.
  if (isDeleting || caret < input.value.length) return;

  if (/^\d{2}$/.test(input.value) || /^\d{2}\.\d{2}$/.test(input.value)) {
    input.value += ".";
    input.setSelectionRange(input.value.length, input.value.length);
    return;
  }

  // A date pasted as eight digits is formatted in one step. Normal typing with
  // dots and all edits in the middle are deliberately left untouched.
  if (/^\d{3,8}$/.test(input.value)) {
    const digits = input.value.slice(0, 8);
    let formatted = digits.slice(0, 2);
    if (digits.length > 2) formatted += `.${digits.slice(2, 4)}`;
    if (digits.length > 4) formatted += `.${digits.slice(4, 8)}`;
    else if (digits.length === 4) formatted += ".";
    input.value = formatted;
    input.setSelectionRange(formatted.length, formatted.length);
  }
}

function hasRequiredCandidateData() {
  return Boolean(
    elements.fullName.value.trim() &&
    isValidDocumentDate(elements.birthDate.value.trim()) &&
    elements.gender.value
  );
}

async function syncCandidateDataState() {
  const candidateReady = hasRequiredCandidateData();
  const becameReady = candidateReady && !state.parsed;
  state.parsed = candidateReady;
  elements.businessUnit.disabled = !candidateReady;
  updateOmsWarning();

  if (becameReady && state.businessUnit) {
    const revision = state.documentRevision;
    const selectedBusinessUnit = state.businessUnit;
    const selectedStructuralUnit = state.structuralUnit;
    const units = await loadUnitsForBusiness(selectedBusinessUnit);
    if (revision !== state.documentRevision || !state.parsed || selectedBusinessUnit !== state.businessUnit) return;
    unitSelect.setOptions(units, { disabled: false, clear: !selectedStructuralUnit });
    if (selectedStructuralUnit) unitSelect.setValue(selectedStructuralUnit);
  }
  updateReadiness();
}

function setLoading(active) {
  elements.form.classList.toggle("loading", active);
}

function resetRequirements() {
  state.automaticFactorsText = "";
  state.automaticPoActivities = [];
  elements.factorsText.value = "";
  elements.factorsText.disabled = true;
  elements.factorsText.title = "";
  poSelect.setData([], [], true);
  elements.factorsEdited.hidden = true;
  elements.poEdited.hidden = true;
  elements.poActivitiesEdited.hidden = true;
  elements.poStatus.disabled = true;
  elements.poStatus.innerHTML = '<option value="false">ПО не требуется</option><option value="true">ПО требуется</option>';
  elements.poActivitiesField.hidden = true;
  elements.poState.textContent = "Ожидает данных";
  elements.poFilename.hidden = true;
}

async function loadRequirements() {
  const revision = state.documentRevision;
  const businessUnit = state.businessUnit;
  const structuralUnit = state.structuralUnit;
  const job = state.job;
  setLoading(true);
  try {
    const params = new URLSearchParams({ structural_unit: structuralUnit, job });
    const data = await api(`/api/catalog/${businessUnit}/requirements?${params}`);
    if (
      revision !== state.documentRevision ||
      businessUnit !== state.businessUnit ||
      structuralUnit !== state.structuralUnit ||
      job !== state.job
    ) return;
    state.requirementsLoaded = true;
    state.recommendationPo = data.po_required;
    state.automaticPoActivities = [...(data.po_activities || [])];
    state.automaticFactorsText = data.factors_text;
    elements.factorsText.value = data.factors_text;
    elements.factorsText.disabled = false;
    elements.factorsText.title = data.factors_text;
    poSelect.setData(data.all_po_activities, data.po_activities, false);
    elements.poStatus.innerHTML = data.po_required
      ? '<option value="true">ПО требуется</option><option value="false">ПО не требуется</option>'
      : '<option value="false">ПО не требуется</option><option value="true">ПО требуется</option>';
    elements.poStatus.disabled = false;
    updatePoVisibility();
    updateEditedIndicators();
    if (data.duplicate_resolved) showToast("В справочнике найден дубль. Временно применена запись с большим количеством требований.");
  } catch (error) {
    state.requirementsLoaded = false;
    resetRequirements();
    showToast(error.message);
  } finally {
    if (revision === state.documentRevision) {
      setLoading(false);
      updateReadiness();
    }
  }
}

function updatePoVisibility() {
  const required = elements.poStatus.value === "true" && !elements.poStatus.disabled;
  elements.poActivitiesField.hidden = !required;
  elements.poState.textContent = required ? "Ожидает данных" : (elements.poStatus.disabled ? "Ожидает данных" : "Не требуется");
  elements.poFilename.hidden = !required;
  updateReadiness();
}

function updateEditedIndicators() {
  const currentPoActivities = [...poSelect.selected].sort();
  const automaticPoActivities = [...state.automaticPoActivities].sort();
  elements.factorsEdited.hidden = !state.requirementsLoaded || elements.factorsText.value === state.automaticFactorsText;
  elements.poEdited.hidden = !state.requirementsLoaded || elements.poStatus.disabled || (elements.poStatus.value === "true") === state.recommendationPo;
  elements.poActivitiesEdited.hidden = !state.requirementsLoaded || (
    currentPoActivities.length === automaticPoActivities.length &&
    currentPoActivities.every((value, index) => value === automaticPoActivities[index])
  );
  elements.dateEdited.hidden = !state.automaticDocumentDate || elements.documentDate.value === state.automaticDocumentDate;
}

function candidateSurname() {
  return elements.fullName.value.trim().split(/\s+/)[0] || "";
}

function updateFilenamePreviews() {
  const prefix = state.businessShortCode || "—";
  const suffix = elements.filenameSuffix.value.trim();
  elements.moFilename.textContent = `${prefix} Направление на МО${suffix ? ` ${suffix}` : ""}`;
  elements.poFilename.textContent = `${prefix} Направление на ПО${suffix ? ` ${suffix}` : ""}`;
}

function resetFilenameFromCandidate() {
  const surname = elements.fullName.value.trim().split(/\s+/)[0] || "Направления";
  elements.filenameSuffix.value = surname;
  state.filenameManuallyEdited = false;
  updateFilenamePreviews();
}

function isReady() {
  const poRequired = elements.poStatus.value === "true" && !elements.poStatus.disabled;
  return Boolean(
    state.profile?.configured &&
    hasRequiredCandidateData() &&
    state.businessUnit &&
    state.structuralUnit &&
    state.job &&
    state.requirementsLoaded &&
    elements.factorsText.value.trim() &&
    (!poRequired || poSelect.selected.length) &&
    elements.documentDate.value.trim() &&
    elements.filenameSuffix.value.trim()
  );
}

function updateOmsWarning() {
  elements.omsField.classList.toggle("optional-warning", hasRequiredCandidateData() && !elements.omsNumber.value.trim());
}

function updateReadiness() {
  updateFilenamePreviews();
  const ready = isReady();
  elements.downloadButtons.forEach((button) => { button.disabled = !ready; });
  elements.moState.textContent = ready ? "Готово" : "Ожидает данных";
  const poRequired = elements.poStatus.value === "true" && !elements.poStatus.disabled;
  elements.poState.textContent = poRequired ? (ready ? "Готово" : "Ожидает данных") : (elements.poStatus.disabled ? "Ожидает данных" : "Не требуется");
  elements.readyStatus.classList.toggle("pending", !ready);
  elements.readyStatus.querySelector(".ready-icon").textContent = ready ? "✓" : "○";
  elements.readyStatus.querySelector("span:last-child").textContent = ready ? "Готово к скачиванию" : "Заполните данные";
}

let pdfParseController = null;

async function handlePdf(file) {
  if (!file) return;
  pdfParseController?.abort();
  const controller = new AbortController();
  pdfParseController = controller;
  const revision = state.documentRevision;
  const isCurrent = () => revision === state.documentRevision && pdfParseController === controller;
  elements.fileTitle.textContent = file.name;
  elements.fileSubtitle.textContent = "Обрабатываем PDF…";
  elements.fileAction.textContent = "Заменить";
  elements.parseWarning.hidden = true;
  setLoading(true);
  try {
    const { parseCandidatePdf } = await import("/static/candidate-pdf.mjs?v=20261020-1");
    const data = await parseCandidatePdf(file, { signal: controller.signal });
    if (!isCurrent()) return;
    state.parsed = true;
    elements.fullName.value = data.full_name;
    elements.birthDate.value = data.birth_date;
    elements.gender.value = data.gender;
    elements.omsNumber.value = data.oms_number;
    updateOmsWarning();
    elements.fileSubtitle.textContent = "PDF успешно обработан";
    elements.parseStatus.hidden = false;
    if (data.warnings.length) {
      elements.parseWarning.textContent = data.warnings.join(" ");
      elements.parseWarning.hidden = false;
    }
    elements.businessUnit.disabled = false;
    if (state.businessUnit) {
      const units = await loadUnitsForBusiness(state.businessUnit);
      if (!isCurrent()) return;
      unitSelect.setOptions(units, { disabled: false });
    }
    resetFilenameFromCandidate();
  } catch (error) {
    if (!isCurrent() || controller.signal.aborted) return;
    state.parsed = false;
    elements.fileSubtitle.textContent = "Не удалось обработать файл";
    elements.parseStatus.hidden = true;
    elements.parseWarning.textContent = error?.userFacing
      ? error.message
      : "Не удалось обработать PDF-анкету. Проверьте файл или заполните данные вручную.";
    elements.parseWarning.hidden = false;
  } finally {
    if (isCurrent()) {
      elements.pdfFile.value = "";
      state.currentFile = null;
      pdfParseController = null;
      setLoading(false);
      updateReadiness();
    }
  }
}

async function loadBusinessUnits() {
  const units = await api("/api/business-units");
  elements.businessUnit.replaceChildren(new Option("Выберите бизнес-единицу", ""));
  units.forEach((unit) => {
    const option = document.createElement("option");
    option.value = unit.id;
    option.textContent = unit.name;
    option.dataset.shortCode = unit.short_code;
    elements.businessUnit.append(option);
  });
  return units;
}

async function loadUnitsForBusiness(businessUnitId) {
  if (!businessUnitId) return [];
  if (state.unitsByBusiness.has(businessUnitId)) return state.unitsByBusiness.get(businessUnitId);
  const units = await api(`/api/catalog/${businessUnitId}/units`);
  state.unitsByBusiness.set(businessUnitId, units);
  return units;
}

async function selectBusinessUnit(businessUnitId, { persist = false } = {}) {
  const revision = state.documentRevision;
  elements.businessUnit.value = businessUnitId || "";
  state.businessUnit = elements.businessUnit.value;
  state.businessShortCode = elements.businessUnit.selectedOptions[0]?.dataset.shortCode || "";
  state.structuralUnit = "";
  state.job = "";
  state.requirementsLoaded = false;
  updateFilenamePreviews();
  resetRequirements();
  jobSelect.setOptions([], { disabled: true });

  if (!state.businessUnit) {
    unitSelect.setOptions([], { disabled: true });
    updateReadiness();
    return;
  }

  const selectedBusinessUnit = state.businessUnit;
  try {
    const units = await loadUnitsForBusiness(selectedBusinessUnit);
    if (revision !== state.documentRevision || selectedBusinessUnit !== state.businessUnit) return;
    unitSelect.setOptions(units, { disabled: !hasRequiredCandidateData() });
    if (persist && state.profile?.configured) {
      await api("/api/profile/business-unit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_unit_id: selectedBusinessUnit }),
      });
      if (state.profile) state.profile.last_business_unit_id = selectedBusinessUnit;
    }
  } catch (error) {
    showToast(error.message);
  }
  updateReadiness();
}

async function applyProfile(savedProfile) {
  state.profile = savedProfile;
  const roleNames = { admin: "Администратор", editor: "Редактор", user: savedProfile.signer_name || "Профиль и подпись" };
  elements.profileButton.title = roleNames[state.profile.role] || "Профиль и подпись";
  elements.adminButton.hidden = state.profile.role !== "admin";
  elements.catalogButton.hidden = !["admin", "editor"].includes(state.profile.role);
  elements.authModal.hidden = true;
  await resetDocument({ preserveBusinessUnit: false });
  if (state.profile.last_business_unit_id) await selectBusinessUnit(state.profile.last_business_unit_id);
  updateReadiness();
}

function openAuth(mode, invitation = null) {
  state.authMode = mode;
  state.invitationToken = invitation?.token || "";
  elements.authModal.hidden = false;
  elements.authError.hidden = true;
  // Для пользователя отдельное отображаемое имя не требуется:
  // в интерфейсе используется обязательное поле «Фамилия и инициалы».
  elements.authDisplayField.hidden = mode !== "invite" || invitation?.role === "user";
  elements.authSignerFields.hidden = mode !== "invite" || invitation?.role !== "user";
  elements.authEmail.readOnly = mode === "invite";
  elements.authPassword.value = "";
  if (mode === "setup") {
    elements.authTitle.textContent = "Первый администратор";
    elements.authDescription.textContent = "Создайте защищённый аккаунт владельца системы.";
    elements.authSubmit.textContent = "Создать администратора";
    elements.authEmail.value = "";
  } else if (mode === "invite") {
    const roleNames = { user: "пользователя", editor: "редактора", admin: "администратора" };
    elements.authTitle.textContent = "Регистрация";
    elements.authDescription.textContent = `Приглашение для ${roleNames[invitation.role]}. Email изменить нельзя.`;
    elements.authSubmit.textContent = "Зарегистрироваться";
    elements.authEmail.value = invitation.email;
    elements.authDisplayName.value = "";
    elements.authSignerName.value = "";
    elements.authSignature.value = "";
  } else {
    elements.authTitle.textContent = "Вход";
    elements.authDescription.textContent = "Войдите по рабочему email и паролю.";
    elements.authSubmit.textContent = "Войти";
    elements.authEmail.value = "";
  }
}

async function loadProfile() {
  const status = await api("/api/auth/status");
  state.csrfToken = status.csrf_token || "";
  if (!status.authenticated) {
    state.profile = null;
    elements.profileButton.title = "Профиль и подпись";
    const inviteToken = new URLSearchParams(window.location.search).get("invite");
    if (inviteToken) {
      try {
        const invitation = await api(`/api/invitations/${encodeURIComponent(inviteToken)}`);
        openAuth("invite", { ...invitation, token: inviteToken });
      } catch (error) {
        openAuth("login");
        elements.authError.textContent = error.message;
        elements.authError.hidden = false;
      }
    } else {
      openAuth(status.first_admin_required ? "setup" : "login");
    }
    updateReadiness();
    return;
  }
  await loadBusinessUnits();
  await applyProfile(status.profile);
}

function openProfile() {
  elements.profileModal.hidden = false;
  document.getElementById("close-profile").hidden = false;
  elements.profileTitle.textContent = "Настройки профиля";
  const role = roleName(state.profile?.role || "");
  const name = state.profile?.display_name || state.profile?.signer_name || state.profile?.email || "Текущий профиль";
  elements.profileDescription.textContent = `${name}${state.profile?.email ? ` · ${state.profile.email}` : ""} · ${role}`;
  elements.logoutButton.hidden = false;
}

function clearProfileScopedInterface() {
  state.archiveSearchRevision += 1;
  elements.archiveSearch.value = "";
  elements.archiveList.innerHTML = '<p class="muted">Документов пока нет.</p>';
  elements.adminUsers.innerHTML = '<p class="muted">Загрузка…</p>';
  elements.adminInvitations.innerHTML = '<p class="muted">Приглашений пока нет.</p>';
  elements.catalogVersions.innerHTML = '<p class="muted">Версий пока нет.</p>';
  elements.invitationResult.hidden = true;
  elements.invitationLink.value = "";
  closeDocumentPreview();
}

async function leaveProfile() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch (_) { /* Сессия уже недействительна. */ }
  state.csrfToken = "";
  window.localStorage.removeItem(PROFILE_ID_KEY);
  window.localStorage.removeItem(OLD_BROWSER_PROFILE_KEY);
  window.localStorage.removeItem("medflow-saved-accounts-v1");
  state.profile = null;
  elements.adminButton.hidden = true;
  elements.catalogButton.hidden = true;
  elements.profileButton.title = "Профиль и подпись";
  elements.profileModal.hidden = true;
  clearProfileScopedInterface();
  switchView("create");
  await resetDocument({ preserveBusinessUnit: false });
  const status = await api("/api/auth/status");
  openAuth(status.first_admin_required ? "setup" : "login");
  updateReadiness();
}

async function logoutProfile() {
  await leaveProfile();
}

async function submitAuth(event) {
  event.preventDefault();
  elements.authError.hidden = true;
  try {
    let profile;
    if (state.authMode === "invite") {
      const body = new FormData();
      body.append("password", elements.authPassword.value);
      if (elements.authDisplayField.hidden) {
        body.append("display_name", elements.authSignerName.value);
      } else {
        body.append("display_name", elements.authDisplayName.value);
      }
      body.append("signer_name", elements.authSignerName.value);
      if (elements.authSignature.files[0]) body.append("signature", elements.authSignature.files[0]);
      profile = await api(`/api/invitations/${encodeURIComponent(state.invitationToken)}/accept`, { method: "POST", body });
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      profile = await api(state.authMode === "setup" ? "/api/auth/setup-admin" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: elements.authEmail.value.trim(), password: elements.authPassword.value }),
      });
    }
    window.localStorage.removeItem(PROFILE_ID_KEY);
    window.localStorage.removeItem(OLD_BROWSER_PROFILE_KEY);
    const status = await api("/api/auth/status");
    if (!status.authenticated || !status.csrf_token) throw new Error("Не удалось подтвердить вход");
    state.csrfToken = status.csrf_token;
    await loadBusinessUnits();
    await applyProfile(profile);
    showToast(state.authMode === "login" ? "Вход выполнен" : "Регистрация завершена");
  } catch (error) {
    elements.authError.textContent = error.message;
    elements.authError.hidden = false;
  }
}

async function resetDocument({ preserveBusinessUnit = true } = {}) {
  pdfParseController?.abort();
  pdfParseController = null;
  state.documentRevision += 1;
  closeAllDropdowns();
  setLoading(false);
  state.parsed = false;
  state.currentFile = null;
  state.structuralUnit = "";
  state.job = "";
  state.requirementsLoaded = false;
  state.recommendationPo = false;
  state.filenameManuallyEdited = false;

  elements.pdfFile.value = "";
  elements.fileTitle.textContent = "Перетащите сюда PDF-анкету";
  elements.fileSubtitle.textContent = "или нажмите, чтобы выбрать файл";
  elements.fileAction.textContent = "Выбрать";
  elements.parseStatus.hidden = true;
  elements.parseStatus.textContent = "Данные распознаны";
  elements.parseWarning.hidden = true;
  elements.parseWarning.textContent = "";
  elements.fullName.value = "";
  elements.birthDate.value = "";
  elements.gender.value = "";
  elements.omsNumber.value = "";
  updateOmsWarning();
  elements.documentDate.value = today();
  state.automaticDocumentDate = elements.documentDate.value;
  elements.dateEdited.hidden = true;
  elements.filenameSuffix.value = "";
  elements.businessUnit.disabled = true;
  jobSelect.setOptions([], { disabled: true });
  resetRequirements();

  const rememberedBusinessUnit = preserveBusinessUnit
    ? (state.profile?.last_business_unit_id || state.businessUnit)
    : "";
  if (rememberedBusinessUnit) {
    await selectBusinessUnit(rememberedBusinessUnit);
  } else {
    state.businessUnit = "";
    state.businessShortCode = "";
    elements.businessUnit.value = "";
    unitSelect.setOptions([], { disabled: true });
  }
  updateEditedIndicators();
  updateReadiness();
}

async function createDocuments(formats, activeButton) {
  if (!isValidDocumentDate(elements.documentDate.value.trim())) {
    showToast("НЕВЕРНЫЙ ФОРМАТ ДАТЫ", 7000);
    return;
  }
  const payload = {
    full_name: elements.fullName.value.trim(),
    birth_date: elements.birthDate.value.trim(),
    gender: elements.gender.value,
    oms_number: elements.omsNumber.value.replace(/\s/g, ""),
    business_unit_id: state.businessUnit,
    structural_unit: state.structuralUnit,
    job: state.job,
    factors: elements.factorsText.value,
    po_required: elements.poStatus.value === "true",
    po_activities: elements.poStatus.value === "true" ? poSelect.selected : [],
    document_date: elements.documentDate.value.trim(),
    formats,
    bundle_name: elements.filenameSuffix.value.trim(),
  };
  elements.downloadButtons.forEach((button) => { button.disabled = true; });
  activeButton.classList.add("loading");
  try {
    const result = await api("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await downloadFromUrl(result.download_url, result.download_name);
    showToast("Документы созданы и сохранены в архиве");
  } catch (error) {
    showToast(error.message);
  } finally {
    activeButton.classList.remove("loading");
    updateReadiness();
  }
}

function pdfLabel(filename) {
  return filename.includes("_на_ПО_") || filename.includes("Направление_на_ПО")
    ? "Направление на ПО"
    : "Направление на МО";
}

function closeDocumentPreview() {
  elements.previewModal.hidden = true;
  elements.previewFrame.removeAttribute("src");
  if (state.previewObjectUrl) URL.revokeObjectURL(state.previewObjectUrl);
  state.previewObjectUrl = "";
}

async function showPreviewFile(documentId, filename, activeButton) {
  elements.previewTabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button === activeButton);
  });
  elements.previewLoading.hidden = false;
  elements.previewFrame.hidden = true;
  if (state.previewObjectUrl) URL.revokeObjectURL(state.previewObjectUrl);
  state.previewObjectUrl = "";
  const response = await authenticatedFetch(`/api/archive/${documentId}/files/${encodeURIComponent(filename)}`);
  if (!response.ok) throw await responseError(response);
  state.previewObjectUrl = URL.createObjectURL(await response.blob());
  elements.previewFrame.src = state.previewObjectUrl;
  elements.previewFrame.hidden = false;
  elements.previewLoading.hidden = true;
}

async function openDocumentPreview(documentItem) {
  const pdfFiles = documentItem.files
    .filter((filename) => filename.toLocaleLowerCase().endsWith(".pdf"))
    .sort((left, right) => Number(pdfLabel(left).endsWith("ПО")) - Number(pdfLabel(right).endsWith("ПО")));
  if (!pdfFiles.length) {
    showToast("В этом комплекте нет PDF-файлов для просмотра");
    return;
  }
  elements.previewTitle.textContent = documentItem.candidate_name;
  elements.previewTabs.replaceChildren();
  pdfFiles.forEach((filename) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "document-preview-tab";
    tab.textContent = pdfLabel(filename);
    tab.addEventListener("click", () => {
      showPreviewFile(documentItem.id, filename, tab).catch((error) => showToast(error.message));
    });
    elements.previewTabs.append(tab);
  });
  elements.previewTabs.hidden = pdfFiles.length === 1;
  elements.previewModal.hidden = false;
  await showPreviewFile(documentItem.id, pdfFiles[0], elements.previewTabs.firstElementChild);
}

async function editArchivedDocument(documentId) {
  const documentItem = await api(`/api/archive/${documentId}`);
  const saved = documentItem.request;
  switchView("create");
  await resetDocument({ preserveBusinessUnit: false });

  state.parsed = true;
  state.currentFile = null;
  elements.fileTitle.textContent = "Сохранённые данные кандидата";
  elements.fileSubtitle.textContent = "Можно изменить любое поле и создать новые документы";
  elements.fileAction.textContent = "Загрузить другую анкету";
  elements.parseStatus.textContent = "Данные загружены";
  elements.parseStatus.hidden = false;
  elements.fullName.value = saved.full_name || "";
  elements.birthDate.value = saved.birth_date || "";
  elements.gender.value = saved.gender || "";
  elements.omsNumber.value = saved.oms_number || "";
  updateOmsWarning();
  elements.businessUnit.disabled = false;

  await selectBusinessUnit(saved.business_unit_id || "");
  const units = await loadUnitsForBusiness(saved.business_unit_id || "");
  unitSelect.setOptions([...new Set([...units, saved.structural_unit].filter(Boolean))], { disabled: false });
  unitSelect.setValue(saved.structural_unit || "");
  state.structuralUnit = saved.structural_unit || "";

  const jobs = state.structuralUnit
    ? await api(`/api/catalog/${state.businessUnit}/jobs?structural_unit=${encodeURIComponent(state.structuralUnit)}`)
    : [];
  jobSelect.setOptions([...new Set([...jobs, saved.job].filter(Boolean))], { disabled: false });
  jobSelect.setValue(saved.job || "");
  state.job = saved.job || "";
  if (state.businessUnit && state.structuralUnit && state.job) await loadRequirements();

  const savedFactors = Array.isArray(saved.factors) ? saved.factors.join("; ") : (saved.factors || "");
  state.requirementsLoaded = Boolean(savedFactors);
  elements.factorsText.value = savedFactors;
  elements.factorsText.disabled = false;
  elements.factorsText.title = savedFactors;
  elements.poStatus.value = String(Boolean(saved.po_required));
  poSelect.setData(poSelect.options, saved.po_activities || [], false);
  updatePoVisibility();
  elements.documentDate.value = saved.document_date || today();
  state.automaticDocumentDate = elements.documentDate.value;
  elements.filenameSuffix.value = saved.bundle_name || candidateSurname();
  state.filenameManuallyEdited = true;
  updateEditedIndicators();
  updateReadiness();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadArchive() {
  const revision = ++state.archiveSearchRevision;
  const query = elements.archiveSearch.value.trim();
  const documents = await api(`/api/archive${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  if (revision !== state.archiveSearchRevision) return;
  elements.archiveList.innerHTML = "";
  if (!documents.length) {
    elements.archiveList.innerHTML = `<p class="muted">${query ? "По этому запросу документы не найдены." : "Документов пока нет."}</p>`;
    return;
  }
  documents.forEach((documentItem) => {
    const row = document.createElement("div");
    row.className = "archive-item";
    const candidate = document.createElement("div");
    const candidateName = document.createElement("strong");
    candidateName.textContent = documentItem.candidate_name;
    const date = document.createElement("span");
    const businessOption = [...elements.businessUnit.options].find((option) =>
      option.value === documentItem.business_unit_id || option.textContent === documentItem.business_unit
    );
    const businessShortCode = businessOption?.dataset.shortCode || documentItem.business_unit;
    date.textContent = `${documentItem.document_date} · ${businessShortCode} · ${documentItem.po_required ? "МО и ПО" : "МО"}`;
    candidate.append(candidateName, date);
    const job = document.createElement("div");
    const jobName = document.createElement("strong");
    jobName.textContent = documentItem.job;
    const unitName = document.createElement("span");
    unitName.textContent = documentItem.structural_unit;
    job.append(jobName, unitName);
    const actions = document.createElement("div");
    actions.className = "archive-actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "archive-action archive-edit";
    editButton.textContent = "Редактировать";
    editButton.addEventListener("click", () => {
      editArchivedDocument(documentItem.id).catch((error) => showToast(error.message));
    });
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "archive-action archive-preview";
    previewButton.textContent = "Просмотр";
    previewButton.addEventListener("click", () => {
      openDocumentPreview(documentItem).catch((error) => showToast(error.message));
    });
    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "archive-action archive-download";
    downloadButton.textContent = "Скачать";
    downloadButton.addEventListener("click", () => {
      downloadFromUrl(`/api/archive/${documentItem.id}/download`, documentItem.download_name)
        .catch((error) => showToast(error.message));
    });
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "archive-action archive-delete";
    deleteButton.textContent = "Удалить";
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(
        `Удалить сохранённые документы кандидата «${documentItem.candidate_name}»? PDF и Excel будут удалены без возможности восстановления.`,
      );
      if (!confirmed) return;
      deleteButton.disabled = true;
      deleteButton.textContent = "Удаление…";
      try {
        await api(`/api/archive/${documentItem.id}`, { method: "DELETE" });
        await loadArchive();
        showToast("Документы удалены");
      } catch (error) {
        deleteButton.disabled = false;
        deleteButton.textContent = "Удалить";
        showToast(error.message);
      }
    });
    actions.append(editButton, previewButton, downloadButton, deleteButton);
    row.append(candidate, job, actions);
    elements.archiveList.append(row);
  });
}

function roleName(role) {
  return { admin: "Администратор", editor: "Редактор", user: "Пользователь" }[role] || role;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.append(helper);
  helper.select();
  const copied = document.execCommand("copy");
  helper.remove();
  if (!copied) throw new Error("Не удалось скопировать ссылку");
}

async function loadAdmin() {
  if (state.profile?.role !== "admin") return;
  const profileId = state.profile.id || state.profile.profile_id;
  const [users, invitations] = await Promise.all([
    api("/api/admin/users"),
    api("/api/admin/invitations"),
  ]);
  if (state.profile?.role !== "admin" || (state.profile.id || state.profile.profile_id) !== profileId) return;
  elements.adminUsers.replaceChildren();
  users.forEach((user) => {
    const row = document.createElement("div");
    row.className = "admin-list-row";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = user.display_name || user.signer_name || user.email;
    const details = document.createElement("span");
    details.textContent = `${user.email} · ${roleName(user.role)}${user.is_active ? "" : " · отключён"}`;
    copy.append(name, details);
    row.append(copy);
    if (user.role !== "admin" && user.is_active) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "archive-action archive-delete";
      remove.textContent = "Удалить";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Удалить аккаунт ${user.email}? Все документы этого пользователя и связанные PDF, Excel и ZIP-файлы будут удалены без возможности восстановления.`)) return;
        try {
          await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
          showToast("Аккаунт и его документы удалены");
          await loadAdmin();
        } catch (error) { showToast(error.message); }
      });
      row.append(remove);
    }
    elements.adminUsers.append(row);
  });
  elements.adminInvitations.replaceChildren();
  if (!invitations.length) elements.adminInvitations.innerHTML = '<p class="muted">Приглашений пока нет.</p>';
  invitations.forEach((invitation) => {
    const row = document.createElement("div");
    row.className = "admin-list-row invitation-list-row";
    const copy = document.createElement("div");
    const email = document.createElement("strong");
    email.textContent = invitation.email;
    const details = document.createElement("span");
    details.textContent = `${roleName(invitation.role)} · ${invitation.used_at ? "использовано" : "ожидает регистрации"}`;
    copy.append(email, details);
    const actions = document.createElement("div");
    actions.className = "admin-row-actions";
    if (!invitation.used_at) {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "archive-action invitation-copy";
      copyButton.textContent = "Копировать ссылку";
      copyButton.addEventListener("click", async () => {
        copyButton.disabled = true;
        try {
          const result = await api(`/api/admin/invitations/${invitation.id}/link`, { method: "POST" });
          await copyText(result.invite_url);
          showToast("Ссылка приглашения скопирована");
        } catch (error) { showToast(error.message); }
        finally { copyButton.disabled = false; }
      });
      actions.append(copyButton);
    }
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "archive-action archive-delete";
    deleteButton.textContent = "Удалить";
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm(`Удалить приглашение для ${invitation.email}? Ссылка перестанет работать.`)) return;
      deleteButton.disabled = true;
      try {
        await api(`/api/admin/invitations/${invitation.id}`, { method: "DELETE" });
        showToast("Приглашение удалено");
        await loadAdmin();
      } catch (error) {
        deleteButton.disabled = false;
        showToast(error.message);
      }
    });
    actions.append(deleteButton);
    row.append(copy, actions);
    elements.adminInvitations.append(row);
  });
}

async function createInvitation(event) {
  event.preventDefault();
  try {
    const invitation = await api("/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: elements.invitationEmail.value.trim(), role: elements.invitationRole.value }),
    });
    elements.invitationLink.value = invitation.invite_url;
    elements.invitationResult.hidden = false;
    elements.invitationForm.reset();
    await loadAdmin();
    showToast("Приглашение создано");
  } catch (error) { showToast(error.message); }
}

async function loadCatalogVersions() {
  const versions = await api("/api/catalog-management/demo-rt/versions");
  elements.catalogVersions.replaceChildren();
  if (!versions.length) elements.catalogVersions.innerHTML = '<p class="muted">Версий пока нет.</p>';
  versions.forEach((version) => {
    const row = document.createElement("div");
    row.className = "admin-list-row";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = version.filename;
    const details = document.createElement("span");
    details.textContent = version.is_active ? "Действующая версия" : (version.validation.valid ? "Проверена, не применена" : "Есть ошибки");
    copy.append(name, details);
    row.append(copy);
    if (!version.is_active && version.validation.valid) {
      const activate = document.createElement("button");
      activate.type = "button";
      activate.className = "archive-action archive-download";
      activate.textContent = "Применить";
      activate.addEventListener("click", async () => {
        if (!window.confirm("Применить эту версию справочника? Текущая версия будет сохранена для отката.")) return;
        try {
          await api(`/api/catalog-management/demo-rt/activate/${version.id}`, { method: "POST" });
          state.unitsByBusiness.clear();
          showToast("Новый справочник применён");
          await loadCatalogVersions();
        } catch (error) { showToast(error.message); }
      });
      row.append(activate);
    }
    elements.catalogVersions.append(row);
  });
}

async function uploadCatalog(event) {
  event.preventDefault();
  if (!elements.catalogFile.files[0]) return;
  const body = new FormData();
  body.append("file", elements.catalogFile.files[0]);
  try {
    const result = await api("/api/catalog-management/demo-rt/upload", { method: "POST", body });
    const validation = result.validation;
    elements.catalogValidation.hidden = false;
    elements.catalogValidation.classList.toggle("invalid", !validation.valid);
    const messages = validation.valid
      ? ["Файл прошёл обязательную проверку.", ...validation.warnings]
      : ["Файл не применён.", ...validation.errors, ...validation.warnings];
    elements.catalogValidation.replaceChildren();
    messages.forEach((message) => {
      const line = document.createElement("p");
      line.textContent = message;
      elements.catalogValidation.append(line);
    });
    elements.catalogUploadForm.reset();
    await loadCatalogVersions();
  } catch (error) { showToast(error.message); }
}

function switchView(name) {
  elements.invitationResult.hidden = true;
  elements.invitationLink.value = "";
  document.getElementById("create-view").hidden = name !== "create";
  document.getElementById("archive-view").hidden = name !== "archive";
  document.getElementById("admin-view").hidden = name !== "admin";
  document.getElementById("catalog-view").hidden = name !== "catalog";
  document.querySelectorAll("[data-view-button]").forEach((button) => button.classList.toggle("active", button.dataset.viewButton === name));
  if (name === "archive") loadArchive().catch((error) => showToast(error.message));
  if (name === "admin") loadAdmin().catch((error) => showToast(error.message));
  if (name === "catalog") loadCatalogVersions().catch((error) => showToast(error.message));
}

async function bootstrap() {
  window.localStorage.removeItem("medflow-saved-accounts-v1");
  elements.documentDate.value = today();
  state.automaticDocumentDate = elements.documentDate.value;
  updateFilenamePreviews();
  resetRequirements();
  await loadProfile();
}

bootstrap().catch((error) => showToast(error.message));

elements.pdfFile.addEventListener("change", () => handlePdf(elements.pdfFile.files[0]));
["dragenter", "dragover"].forEach((name) => elements.dropzone.addEventListener(name, (event) => { event.preventDefault(); elements.dropzone.classList.add("dragging"); }));
["dragleave", "drop"].forEach((name) => elements.dropzone.addEventListener(name, (event) => { event.preventDefault(); elements.dropzone.classList.remove("dragging"); }));
elements.dropzone.addEventListener("drop", (event) => handlePdf(event.dataTransfer.files[0]));

elements.businessUnit.addEventListener("change", async () => {
  await selectBusinessUnit(elements.businessUnit.value, { persist: true });
});

elements.poStatus.addEventListener("change", () => {
  updatePoVisibility();
  updateEditedIndicators();
});
[elements.birthDate, elements.documentDate].forEach((input) => input.addEventListener("input", formatRussianDateInput));
[elements.fullName, elements.birthDate, elements.gender, elements.omsNumber, elements.factorsText, elements.documentDate].forEach((input) => input.addEventListener("input", () => {
  if (input === elements.fullName && !state.filenameManuallyEdited) resetFilenameFromCandidate();
  if ([elements.fullName, elements.birthDate, elements.gender].includes(input)) {
    syncCandidateDataState().catch((error) => showToast(error.message));
  } else if (input === elements.omsNumber) updateOmsWarning();
  updateEditedIndicators();
  updateReadiness();
}));
elements.filenameSuffix.addEventListener("input", () => {
  state.filenameManuallyEdited = true;
  updateReadiness();
});
elements.downloadButtons.forEach((button) => button.addEventListener("click", () => createDocuments(button.dataset.formats.split(","), button)));
elements.authForm.addEventListener("submit", submitAuth);
elements.invitationForm.addEventListener("submit", createInvitation);
elements.catalogUploadForm.addEventListener("submit", uploadCatalog);
elements.downloadCatalog.addEventListener("click", () => {
  downloadFromUrl("/api/catalog-management/demo-rt/download", "Контингенты_РТ.xlsx")
    .catch((error) => showToast(error.message));
});
elements.copyInvitation.addEventListener("click", async () => {
  const invitationUrl = elements.invitationLink.value;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await copyText(invitationUrl);
    } else {
      elements.invitationLink.focus();
      elements.invitationLink.select();
      elements.invitationLink.setSelectionRange(0, invitationUrl.length);
      if (!document.execCommand("copy")) throw new Error("copy failed");
      elements.invitationLink.setSelectionRange(0, 0);
      elements.copyInvitation.focus();
    }
    showToast("Ссылка скопирована");
  } catch (_) {
    elements.invitationLink.select();
    showToast("Скопируйте выделенную ссылку");
  }
});
document.getElementById("profile-button").addEventListener("click", openProfile);
document.getElementById("close-profile").addEventListener("click", () => { if (state.profile?.configured) elements.profileModal.hidden = true; });
elements.logoutButton.addEventListener("click", logoutProfile);
elements.closePreview.addEventListener("click", closeDocumentPreview);
elements.previewModal.addEventListener("click", (event) => {
  if (event.target === elements.previewModal) closeDocumentPreview();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.previewModal.hidden) closeDocumentPreview();
});
elements.archiveSearch.addEventListener("input", () => {
  window.clearTimeout(loadArchive.searchTimeout);
  loadArchive.searchTimeout = window.setTimeout(() => {
    loadArchive().catch((error) => showToast(error.message));
  }, 180);
});
document.querySelectorAll("[data-view-button]").forEach((button) => button.addEventListener("click", () => {
  switchView(button.dataset.viewButton);
}));
document.querySelectorAll("[data-new-document-button]").forEach((button) => button.addEventListener("click", async () => {
  switchView("create");
  await resetDocument();
}));
updateReadiness();
