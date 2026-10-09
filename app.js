const STORAGE_KEY = "driver-shift-platform-v1";
const CURRENT_USER_KEY = "driver-shift-current-user";
const DAY_NAMES = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const SYMBOLS = {
  X: "Turno",
  XL: "X vincolata",
  R: "Riposo",
  RL: "R vincolata",
  F: "Ferie/permessi",
  M: "Malattia/infortunio",
  B: "Buco",
  G: "Lista gialla",
  A: "Abortive",
  N: "Navetta"
};
const SATURATION_SYMBOLS = new Set(["X", "XL", "F", "M", "A", "N"]);
const WORK_SYMBOLS = new Set(["X", "XL", "A", "N"]);
const EDIT_CYCLE = ["", "X", "R", "G", "A", "N", "B"];

let state = loadState();
let dateActionMode = "";
let calendarInteraction = { mode: "", date: "", driverId: "" };
let currentUser = null;
let memorySessionUser = "";
let remoteMode = false;
let remoteSaveTimer = null;
let remoteSyncTimer = null;
let remoteSaveInProgress = false;
let remoteDirty = false;
let remoteSaveOptions = { syncUsers: false };
let lastUserInteractionAt = 0;
let lastLocalMutationAt = 0;

const els = {
  appShell: document.querySelector("#appShell"),
  loginScreen: document.querySelector("#loginScreen"),
  loginForm: document.querySelector("#loginForm"),
  loginUser: document.querySelector("#loginUser"),
  loginPassword: document.querySelector("#loginPassword"),
  loginBtn: document.querySelector("#loginBtn"),
  loginError: document.querySelector("#loginError"),
  currentUserChip: document.querySelector("#currentUserChip"),
  logoutBtn: document.querySelector("#logoutBtn"),
  stationSelect: document.querySelector("#stationSelect"),
  weekStartInput: document.querySelector("#weekStartInput"),
  weeksInput: document.querySelector("#weeksInput"),
  forecastIncreaseInput: document.querySelector("#forecastIncreaseInput"),
  algorithmContractBtn: document.querySelector("#algorithmContractBtn"),
  algorithmSaturationBtn: document.querySelector("#algorithmSaturationBtn"),
  calendarTable: document.querySelector("#calendarTable"),
  forecastViewTable: document.querySelector("#forecastViewTable"),
  absencesViewTable: document.querySelector("#absencesViewTable"),
  forecastViewStation: document.querySelector("#forecastViewStation"),
  forecastViewWeek: document.querySelector("#forecastViewWeek"),
  absencesViewStation: document.querySelector("#absencesViewStation"),
  absencesViewName: document.querySelector("#absencesViewName"),
  absencesViewDetail: document.querySelector("#absencesViewDetail"),
  driverFilterStation: document.querySelector("#driverFilterStation"),
  driverFilterHours: document.querySelector("#driverFilterHours"),
  constraintsTable: document.querySelector("#constraintsTable"),
  actualRoutesTable: document.querySelector("#actualRoutesTable"),
  driversTable: document.querySelector("#driversTable"),
  logTable: document.querySelector("#logTable"),
  dashboardTable: document.querySelector("#dashboardTable"),
  usersTable: document.querySelector("#usersTable"),
  userForm: document.querySelector("#userForm"),
  userFullName: document.querySelector("#userFullName"),
  userStation: document.querySelector("#userStation"),
  userUsername: document.querySelector("#userUsername"),
  userPassword: document.querySelector("#userPassword"),
  userRole: document.querySelector("#userRole"),
  constraintForm: document.querySelector("#constraintForm"),
  constraintDate: document.querySelector("#constraintDate"),
  constraintDriver: document.querySelector("#constraintDriver"),
  constraintType: document.querySelector("#constraintType"),
  confirmDateInput: document.querySelector("#confirmDateInput"),
  confirmDayBtn: document.querySelector("#confirmDayBtn"),
  unlockDayBtn: document.querySelector("#unlockDayBtn"),
  yellowListBtn: document.querySelector("#yellowListBtn"),
  modifyDayBtn: document.querySelector("#modifyDayBtn"),
  finishYellowListBtn: document.querySelector("#finishYellowListBtn"),
  finishModifyBtn: document.querySelector("#finishModifyBtn"),
  dateActionModal: document.querySelector("#dateActionModal"),
  dateActionForm: document.querySelector("#dateActionForm"),
  dateActionTitle: document.querySelector("#dateActionTitle"),
  dateActionHelp: document.querySelector("#dateActionHelp"),
  dateActionDate: document.querySelector("#dateActionDate"),
  dateActionCancelBtn: document.querySelector("#dateActionCancelBtn"),
  modifyDayModal: document.querySelector("#modifyDayModal"),
  modifyDayForm: document.querySelector("#modifyDayForm"),
  modifyDayHelp: document.querySelector("#modifyDayHelp"),
  modifyDriverSelect: document.querySelector("#modifyDriverSelect"),
  modifyStatusSelect: document.querySelector("#modifyStatusSelect"),
  modifyDayCancelBtn: document.querySelector("#modifyDayCancelBtn"),
  actualRoutesForm: document.querySelector("#actualRoutesForm"),
  actualRouteDate: document.querySelector("#actualRouteDate"),
  actualRouteStation: document.querySelector("#actualRouteStation"),
  actualRouteRoutes: document.querySelector("#actualRouteRoutes"),
  seedDataBtn: document.querySelector("#seedDataBtn"),
  exportPlanBtn: document.querySelector("#exportPlanBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  clearLogBtn: document.querySelector("#clearLogBtn"),
  quickPlanBtn: document.querySelector("#quickPlanBtn"),
  quickImportsBtn: document.querySelector("#quickImportsBtn"),
  appStatus: document.querySelector("#appStatus"),
  forecastFile: document.querySelector("#forecastFile"),
  driversFile: document.querySelector("#driversFile"),
  absencesFile: document.querySelector("#absencesFile"),
  legend: document.querySelector("#legend"),
  toast: document.querySelector("#toast"),
  kpiRoutes: document.querySelector("#kpiRoutes"),
  kpiAssigned: document.querySelector("#kpiAssigned"),
  kpiCoverage: document.querySelector("#kpiCoverage"),
  kpiDelta: document.querySelector("#kpiDelta"),
  kpiDrivers: document.querySelector("#kpiDrivers"),
  kpiExtraHours: document.querySelector("#kpiExtraHours")
};

window.driverShiftLogin = login;

init();

async function init() {
  bindEvents();
  trackUserActivity();
  await restoreRemoteSession();
  if (!remoteMode) {
    ensureDefaultUsers();
    restoreSession();
  }
  if (!state.weekStart) {
    state.weekStart = toISO(startOfWeek(new Date()));
  }
  try {
    render();
  } catch (error) {
    console.error(error);
    showToast("App avviata. Alcuni dati locali potrebbero richiedere un reset.");
  }
  renderAuth();
  if (currentUser) markAppReady();
}

function markAppReady() {
  if (!els.appStatus) return;
  els.appStatus.textContent = remoteMode ? "App pronta - dati condivisi - sync rapido" : "App pronta";
  els.appStatus.classList.add("ready");
}

function hasUsableState() {
  const hasStations = ["OSI2", "DSI2", "DLZ3", ...state.drivers.map((driver) => driver.station), ...state.forecast.map((item) => item.station)]
    .filter(Boolean).length > 0;
  return hasStations && (state.drivers.length > 0 || state.forecast.length > 0);
}

function defaultState() {
  return {
    station: "OSI2",
    weekStart: "",
    weeks: 6,
    forecastIncrease: 0,
    drivers: [],
    forecast: [],
    absences: [],
    constraints: [],
    actualRoutes: [],
    plan: {},
    confirmedDates: [],
    log: [],
    users: []
  };
}

function loadState() {
  try {
    return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return defaultState();
  }
}

function saveState(options = {}) {
  if (remoteMode && currentUser) lastLocalMutationAt = Date.now();
  saveLocalState();
  if (remoteMode && currentUser) scheduleRemoteStateSave(options);
}

function saveLocalState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Some file-preview contexts block localStorage. The app must remain usable in memory.
  }
}

function defaultUsers() {
  return [
    { id: "USR-ADMIN", fullName: "Gabriele Fiumara", station: "Tutte", username: "Admin", password: "123456", role: "admin" },
    { id: "USR-CAM", fullName: "Danilo Santacroce", station: "Tutte", username: "CAM", password: "123456", role: "kam" },
    { id: "USR-DSP1", fullName: "Nome Cognome", station: "DSI2", username: "DSP1", password: "654321", role: "dispatcher" }
  ];
}

function ensureDefaultUsers() {
  state.users = Array.isArray(state.users) ? state.users : [];
  defaultUsers().forEach((user) => {
    const existing = state.users.find((item) => item.username.toLowerCase() === user.username.toLowerCase());
    if (existing) Object.assign(existing, user);
    else state.users.push(user);
  });
  saveState();
}

function restoreSession() {
  const username = safeSessionGet(CURRENT_USER_KEY);
  currentUser = username ? state.users.find((user) => user.username === username) || null : null;
}

async function login(event) {
  event?.preventDefault?.();
  const username = clean(els.loginUser.value);
  const password = clean(els.loginPassword.value);
  if (remoteMode) {
    try {
      const data = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      applyRemoteSession(data);
      els.loginError.textContent = "";
      if (els.loginScreen) els.loginScreen.hidden = true;
      if (els.appShell) els.appShell.classList.remove("auth-locked");
      if (isDispatcher()) state.station = currentUser.station;
      startRemoteSync();
      render();
      renderAuth();
      markAppReady();
      return;
    } catch (error) {
      els.loginError.textContent = "User o password non corretti";
      return;
    }
  }
  const user = state.users.find((item) => item.username.toLowerCase() === username.toLowerCase() && item.password === password);
  if (!user) {
    els.loginError.textContent = "User o password non corretti";
    return;
  }
  currentUser = user;
  safeSessionSet(CURRENT_USER_KEY, user.username);
  els.loginError.textContent = "";
  if (els.loginScreen) els.loginScreen.hidden = true;
  if (els.appShell) els.appShell.classList.remove("auth-locked");
  if (isDispatcher()) state.station = currentUser.station;
  saveState();
  try {
    render();
  } catch (error) {
    console.error(error);
    showToast("Accesso effettuato. Alcuni dati locali potrebbero richiedere un reset.");
  }
  renderAuth();
  markAppReady();
}

window.driverShiftLogin = login;

function logout() {
  if (remoteMode) {
    apiRequest("/api/logout", { method: "POST" }).catch(() => {});
  }
  stopRemoteSync();
  safeSessionRemove(CURRENT_USER_KEY);
  currentUser = null;
  calendarInteraction = { mode: "", date: "", driverId: "" };
  renderAuth();
}

async function restoreRemoteSession() {
  if (window.location.protocol === "file:") return false;
  try {
    const data = await apiRequest("/api/session");
    remoteMode = true;
    if (data.authenticated) applyRemoteSession(data);
    return data.authenticated;
  } catch {
    remoteMode = false;
    return false;
  }
}

function applyRemoteSession(data) {
  currentUser = data.user || null;
  state = { ...defaultState(), ...(data.state || {}) };
  if (!Array.isArray(state.users)) state.users = [];
  saveLocalState();
  if (currentUser) startRemoteSync();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.status === 204 ? {} : response.json();
}

function scheduleRemoteStateSave(options = {}) {
  window.clearTimeout(remoteSaveTimer);
  remoteDirty = true;
  remoteSaveOptions = {
    syncUsers: remoteSaveOptions.syncUsers || Boolean(options.syncUsers)
  };
  remoteSaveTimer = window.setTimeout(saveRemoteStateNow, 50);
}

async function saveRemoteStateNow() {
  if (!remoteMode || !currentUser) return;
  const options = { ...remoteSaveOptions };
  remoteSaveOptions = { syncUsers: false };
  remoteSaveInProgress = true;
  if (els.appStatus) els.appStatus.textContent = "App pronta - dati condivisi - salvataggio...";
  try {
    const data = await apiRequest("/api/state", {
      method: "PUT",
      body: JSON.stringify({ state, syncUsers: options.syncUsers })
    });
    remoteDirty = false;
    if (data.state) {
      state = { ...defaultState(), ...data.state };
      saveLocalState();
    }
    if (els.appStatus) els.appStatus.textContent = "App pronta - dati condivisi - salvato";
  } catch (error) {
    if (els.appStatus) els.appStatus.textContent = "App pronta - errore salvataggio server";
    showToast("Salvataggio server non riuscito. Apri /api/health e verifica il collegamento.");
  } finally {
    remoteSaveInProgress = false;
  }
}

function startRemoteSync() {
  if (!remoteMode || !currentUser) return;
  stopRemoteSync();
  remoteSyncTimer = window.setInterval(refreshRemoteState, 750);
}

function stopRemoteSync() {
  window.clearInterval(remoteSyncTimer);
  remoteSyncTimer = null;
}

async function refreshRemoteState() {
  if (!remoteMode || !currentUser || remoteDirty || remoteSaveInProgress) return;
  if (isUiInteractionActive()) return;
  const refreshStartedAt = Date.now();
  try {
    const data = await apiRequest(`/api/state?t=${Date.now()}`);
    if (refreshStartedAt < lastLocalMutationAt || Date.now() - lastLocalMutationAt < 1200) return;
    if (!data.ok) {
      logout();
      return;
    }
    currentUser = data.user || currentUser;
    state = { ...defaultState(), ...(data.state || {}) };
    saveLocalState();
    render();
    renderAuth();
    if (els.appStatus) els.appStatus.textContent = "App pronta - dati condivisi - sync rapido";
  } catch {
    // Keep the current view usable if a temporary network issue occurs.
  }
}

function trackUserActivity() {
  ["pointerdown", "keydown", "input", "change"].forEach((eventName) => {
    document.addEventListener(eventName, () => {
      lastUserInteractionAt = Date.now();
    }, { capture: true, passive: true });
  });
}

function isUiInteractionActive() {
  const active = document.activeElement;
  const activeTag = active?.tagName;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(activeTag)) return true;
  if (document.querySelector(".modal-backdrop.active")) return true;
  if (Date.now() - lastUserInteractionAt < 900) return true;
  return isUserFormActive();
}

function isUserFormActive() {
  if (!els.userForm) return false;
  if (els.userForm.contains(document.activeElement)) return true;
  return [els.userFullName, els.userUsername, els.userPassword].some((input) => clean(input?.value));
}

function safeSessionGet(key) {
  try {
    return sessionStorage.getItem(key) || memorySessionUser;
  } catch {
    return memorySessionUser;
  }
}

function safeSessionSet(key, value) {
  memorySessionUser = value;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // File previews can block sessionStorage. Keep the session in memory.
  }
}

function safeSessionRemove(key) {
  memorySessionUser = "";
  try {
    sessionStorage.removeItem(key);
  } catch {
    // File previews can block sessionStorage. Clearing memory is enough here.
  }
}

function renderAuth() {
  const authenticated = !!currentUser;
  if (els.loginScreen) els.loginScreen.hidden = authenticated;
  if (els.appShell) els.appShell.classList.toggle("auth-locked", !authenticated);
  if (els.currentUserChip) {
    els.currentUserChip.textContent = authenticated ? `${currentUser.fullName} - ${roleLabel(currentUser.role)}` : "";
  }
  document.querySelectorAll("[data-admin-tab]").forEach((tab) => {
    tab.hidden = !canManageUsers();
  });
  if (authenticated && !canManageUsers() && document.querySelector("#usersPanel")?.classList.contains("active")) {
    switchTab("calendar");
  }
  if (els.clearLogBtn) els.clearLogBtn.hidden = !isAdmin();
  if (els.resetBtn) els.resetBtn.hidden = isDispatcher();
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function canManageUsers() {
  return currentUser?.role === "admin" || currentUser?.role === "kam";
}

function hasGlobalAccess() {
  return currentUser?.role === "admin" || currentUser?.role === "kam";
}

function isDispatcher() {
  return currentUser?.role === "dispatcher";
}

function roleLabel(role) {
  if (role === "admin") return "Amministratore";
  if (role === "kam") return "Key Account Manager";
  return "Dispatcher";
}

function allowedStations() {
  if (!currentUser || hasGlobalAccess()) return null;
  return new Set([currentUser.station]);
}

function canAccessStation(station) {
  const stations = allowedStations();
  return !stations || stations.has(station);
}

function bindEvents() {
  els.loginForm?.addEventListener("submit", login);
  els.loginBtn?.addEventListener("click", login);
  els.loginPassword?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") login(event);
  });
  els.logoutBtn?.addEventListener("click", logout);
  document.querySelectorAll(".tabs button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  els.stationSelect.addEventListener("change", () => {
    state.station = els.stationSelect.value;
    saveAndRender();
  });
  els.weekStartInput.addEventListener("change", () => {
    state.weekStart = toISO(startOfWeek(new Date(`${els.weekStartInput.value}T12:00:00`)));
    saveAndRender();
  });
  els.weeksInput.addEventListener("change", () => {
    state.weeks = Number(els.weeksInput.value);
    saveAndRender();
  });
  els.forecastIncreaseInput.addEventListener("change", () => {
    state.forecastIncrease = Number(els.forecastIncreaseInput.value || 0);
    saveAndRender();
  });
  els.forecastViewStation?.addEventListener("change", () => renderForecastView());
  els.forecastViewWeek?.addEventListener("change", () => renderForecastView());
  els.absencesViewStation?.addEventListener("change", () => renderAbsencesView());
  els.absencesViewName?.addEventListener("input", () => renderAbsencesView());
  els.absencesViewDetail?.addEventListener("input", () => renderAbsencesView());
  els.driverFilterStation?.addEventListener("change", () => renderDrivers());
  els.driverFilterHours?.addEventListener("change", () => renderDrivers());
  document.querySelectorAll("[data-export-table]").forEach((button) => {
    button.addEventListener("click", () => exportTableCsv(button.dataset.exportTable, button.dataset.exportName || button.dataset.exportTable));
  });

  els.algorithmContractBtn.addEventListener("click", () => runPlanning("contract"));
  els.algorithmSaturationBtn.addEventListener("click", () => runPlanning("saturation"));
  els.quickPlanBtn?.addEventListener("click", () => {
    switchTab("calendar");
    runPlanning("contract");
  });
  els.quickImportsBtn?.addEventListener("click", () => switchTab("imports"));
  els.exportPlanBtn.addEventListener("click", exportPlanCsv);
  els.resetBtn.addEventListener("click", resetData);
  els.clearLogBtn.addEventListener("click", () => {
    if (!isAdmin()) {
      showToast("Solo l'Amministratore può svuotare tutti i log");
      return;
    }
    state.log = [];
    saveAndRender();
  });

  els.confirmDayBtn.addEventListener("click", confirmDay);
  els.unlockDayBtn.addEventListener("click", unlockDay);
  els.yellowListBtn?.addEventListener("click", openYellowListModal);
  els.modifyDayBtn?.addEventListener("click", openModifyDayModal);
  els.finishYellowListBtn?.addEventListener("click", () => finishCalendarInteraction("yellow"));
  els.finishModifyBtn?.addEventListener("click", () => finishCalendarInteraction("modify"));
  els.dateActionCancelBtn?.addEventListener("click", closeDateActionModal);
  els.modifyDayCancelBtn?.addEventListener("click", closeModifyDayModal);
  els.dateActionForm?.addEventListener("submit", applyDateAction);
  els.modifyDayForm?.addEventListener("submit", applyTargetedDayChange);
  els.actualRoutesForm?.addEventListener("submit", saveActualRoutes);
  els.constraintForm.addEventListener("submit", addConstraint);
  els.userForm?.addEventListener("submit", saveUser);

  els.forecastFile.addEventListener("change", (event) => importDataFile(event, importForecast));
  els.driversFile.addEventListener("change", (event) => importDataFile(event, importDrivers));
  els.absencesFile.addEventListener("change", (event) => importDataFile(event, importAbsences));
}

function switchTab(tab) {
  if (tab === "users" && !canManageUsers()) {
    showToast("Sezione disponibile solo per Amministratore e Key Account Manager");
    return;
  }
  document.querySelectorAll(".tabs button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelector(`#${tab}Panel`).classList.add("active");
}

function render() {
  normalizeDriverContracts();
  renderStationSelect();
  els.weekStartInput.value = state.weekStart;
  els.confirmDateInput.value = state.weekStart;
  els.weeksInput.value = String(state.weeks);
  els.forecastIncreaseInput.value = String(state.forecastIncrease);
  renderLegend();
  renderConstraintDriverOptions();
  renderActualRouteStationOptions();
  renderDataViewStationOptions();
  renderDriverFilterOptions();
  renderCalendar();
  renderCalendarInteractionControls();
  renderForecastView();
  renderAbsencesView();
  renderConstraints();
  renderActualRoutes();
  renderDrivers();
  renderUsers();
  renderLog();
  renderDashboard();
  renderKpis();
  renderAuth();
}

function renderStationSelect() {
  const stations = Array.from(new Set(["OSI2", "DSI2", "DLZ3", ...state.drivers.map((d) => d.station), ...state.forecast.map((f) => f.station)]))
    .filter(Boolean)
    .filter(canAccessStation);
  if (!stations.length) stations.push(isDispatcher() ? currentUser.station : "OSI2", ...(isDispatcher() ? [] : ["DSI2", "DLZ3"]));
  els.stationSelect.innerHTML = stations.map((station) => `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`).join("");
  if (!stations.includes(state.station)) state.station = stations[0] || "";
  els.stationSelect.value = state.station;
}

function renderLegend() {
  els.legend.innerHTML = Object.entries(SYMBOLS)
    .map(([symbol, label]) => `<span><i class="symbol-${symbol}"></i>${symbol}: ${label}</span>`)
    .join("");
}

function renderConstraintDriverOptions() {
  const drivers = filteredDrivers();
  els.constraintDriver.innerHTML = drivers
    .map((driver) => `<option value="${escapeHtml(driver.id)}">${escapeHtml(driver.name)} (${escapeHtml(driver.id)})</option>`)
    .join("");
}

function renderActualRouteStationOptions() {
  if (!els.actualRouteStation) return;
  const stations = Array.from(new Set(["OSI2", "DSI2", "DLZ3", ...state.drivers.map((driver) => driver.station), ...state.forecast.map((item) => item.station)])).filter(Boolean).filter(canAccessStation);
  els.actualRouteStation.innerHTML = stations.map((station) => `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`).join("");
  els.actualRouteStation.value = stations.includes(state.station) ? state.station : stations[0] || "";
  if (els.actualRouteDate && !els.actualRouteDate.value) els.actualRouteDate.value = state.weekStart;
}

function renderDataViewStationOptions() {
  const stations = Array.from(new Set(["Tutte", ...state.drivers.map((driver) => driver.station), ...state.forecast.map((item) => item.station)]))
    .filter(Boolean)
    .filter((station) => station === "Tutte" ? hasGlobalAccess() : canAccessStation(station));
  [els.forecastViewStation, els.absencesViewStation].forEach((select) => {
    if (!select) return;
    const current = select.value || state.station || "Tutte";
    select.innerHTML = stations.map((station) => `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`).join("");
    select.value = stations.includes(current) ? current : "Tutte";
  });
  if (els.forecastViewWeek) {
    const weeks = Array.from(new Set(["Tutte", ...state.forecast.map((item) => clean(item.week)).filter(Boolean)])).sort((a, b) => a === "Tutte" ? -1 : b === "Tutte" ? 1 : Number(a) - Number(b));
    const current = els.forecastViewWeek.value || "Tutte";
    els.forecastViewWeek.innerHTML = weeks.map((week) => `<option value="${escapeHtml(week)}">${escapeHtml(week)}</option>`).join("");
    els.forecastViewWeek.value = weeks.includes(current) ? current : "Tutte";
  }
}

function renderForecastView() {
  if (!els.forecastViewTable) return;
  const station = els.forecastViewStation?.value || "Tutte";
  const week = els.forecastViewWeek?.value || "Tutte";
  const rows = state.forecast
    .filter((item) => station === "Tutte" || item.station === station)
    .filter((item) => week === "Tutte" || clean(item.week) === week)
    .slice()
    .sort((a, b) => `${a.week || ""}${a.date}${a.station}`.localeCompare(`${b.week || ""}${b.date}${b.station}`))
    .map((item) => `<tr><td>${escapeHtml(item.week || "")}</td><td class="date-compact">${formatShortDate(item.date)}</td><td>${escapeHtml(item.station)}</td><td>${item.routes}</td></tr>`)
    .join("");
  els.forecastViewTable.innerHTML = `<thead><tr><th>Week</th><th class="date-compact">Data</th><th>Station</th><th>Rotte forecast</th></tr></thead><tbody>${rows || emptyRow(4)}</tbody>`;
}

function renderAbsencesView() {
  if (!els.absencesViewTable) return;
  const station = els.absencesViewStation?.value || "Tutte";
  const nameFilter = normalizeName(els.absencesViewName?.value || "");
  const detailFilter = normalizeName(els.absencesViewDetail?.value || "");
  const rows = state.absences
    .map((absence) => ({ absence, driver: state.drivers.find((driver) => (normalizeMatricola(absence.matricola) && normalizeMatricola(driver.matricola) === normalizeMatricola(absence.matricola)) || driver.id === absence.driverId) }))
    .filter(({ driver }) => driver && (station === "Tutte" || driver.station === station))
    .filter(({ driver }) => !nameFilter || normalizeName(driver.name).includes(nameFilter))
    .filter(({ absence }) => !detailFilter || normalizeName(absence.label || absence.type || "").includes(detailFilter))
    .sort((a, b) => `${a.absence.date}${a.driver.station}${a.driver.name}`.localeCompare(`${b.absence.date}${b.driver.station}${b.driver.name}`))
    .map(({ absence, driver }) => `<tr>
      <td>${escapeHtml(driver.id || "")}</td>
      <td>${escapeHtml(driver.name)}</td>
      <td class="date-compact">${formatShortDate(absence.startDate || absence.date)}</td>
      <td class="date-compact">${formatShortDate(absence.endDate || absence.date)}</td>
      <td>${escapeHtml(absence.type)}</td>
      <td>${escapeHtml(absence.label || "")}</td>
      <td>${escapeHtml(absence.hours ?? "")}</td>
      <td>${escapeHtml(absence.status || "")}</td>
      <td>${escapeHtml(absence.check || "")}</td>
      <td>${escapeHtml(driver.matricola || absence.matricola || "")}</td>
    </tr>`)
    .join("");
  els.absencesViewTable.innerHTML = `<thead><tr><th>ID driver</th><th>Nome e cognome</th><th class="date-compact">Data iniziale</th><th class="date-compact">Data finale</th><th>Tipo assenza</th><th>Dettaglio assenza</th><th>Ore</th><th>Stato</th><th>Controllo</th><th>Matricola</th></tr></thead><tbody>${rows || emptyRow(10)}</tbody>`;
}

function renderCalendar() {
  const dates = visibleDates();
  const drivers = filteredDrivers();
  const columns = calendarColumns(dates);
  const header = [
    "<tr><th>Dipendente</th>",
    ...columns.map((column) => {
      if (column.type === "date") return `<th>${DAY_NAMES[dayIndex(column.date)]}<br>${formatShortDate(column.date)}<br><small>Fabb. ${routeNeed(column.date)}</small></th>`;
      return `<th class="weekly-index" title="${escapeHtml(column.title)}">${escapeHtml(column.label)}<br><small>S${column.week}</small></th>`;
    }),
    "<th>Sat. totale</th><th>Extra gg</th><th>Fuori ctr.</th></tr>"
  ].join("");

  const body = drivers.map((driver) => {
    const cells = columns.map((column) => {
      if (column.type === "date") {
        const date = column.date;
        const value = getCell(driver.id, date) || "";
        const display = value === "XL" ? "X" : value === "RL" ? "R" : value;
        const className = value ? `symbol-${value}` : "";
        const confirmed = state.confirmedDates.includes(date) ? " confirmed" : "";
        const title = `${driver.name} - ${date}`;
        return `<td class="calendar-cell ${className}${confirmed}" data-driver="${escapeHtml(driver.id)}" data-date="${date}" title="${escapeHtml(title)}">${display}</td>`;
      }
      return renderWeeklyMetricCell(driver, column);
    }).join("");
    const saturation = driverSaturation(driver, dates);
    return `<tr><td><strong>${escapeHtml(driver.name)}</strong><br><small>${escapeHtml(driver.contract)} - ${driver.weeklyHours}h</small></td>${cells}<td>${saturation.percent}%</td><td>${saturation.extraDays}</td><td>${saturation.outOfContract}</td></tr>`;
  }).join("");

  const indicators = renderDailyIndicators(columns, drivers);
  els.calendarTable.innerHTML = `<thead>${header}</thead><tbody>${body}${indicators}</tbody>`;
  els.calendarTable.querySelectorAll(".calendar-cell").forEach((cell) => {
    cell.addEventListener("click", () => cycleCell(cell.dataset.driver, cell.dataset.date));
  });
}

function calendarColumns(dates) {
  const columns = [];
  dates.forEach((date, index) => {
    columns.push({ type: "date", date });
    if (dayIndex(date) === 6) {
      const week = Math.floor(index / 7) + 1;
      const weekDatesList = dates.slice(Math.max(0, index - 6), index + 1);
      [
        ["weeklyX", "X sett.", "X settimana"],
        ["contractDays", "Gg ctr.", "Giorni contratto"],
        ["deltaDays", "Delta", "Delta giorni (X+F+M+A+N)"],
        ["saturation", "Sat. %", "% saturazione contrattuale"],
        ["outsideContract", "X fuori ctr.", "X fuori giorni contratto"]
      ].forEach(([metric, label, title]) => columns.push({ type: "weeklyMetric", metric, label, title, week, dates: weekDatesList }));
    }
  });
  return columns;
}

function renderWeeklyMetricCell(driver, column) {
  const metrics = weeklyDriverMetrics(driver, column.dates);
  const value = metrics[column.metric];
  const className = column.metric === "saturation" ? saturationClass(metrics.saturation) : column.metric === "deltaDays" ? deltaClass(metrics.deltaDays) : "weekly-index-cell";
  return `<td class="${className}">${column.metric === "saturation" ? `${value}%` : value}</td>`;
}

function weeklyDriverMetrics(driver, dates) {
  const weeklyX = dates.filter((date) => WORK_SYMBOLS.has(getCell(driver.id, date))).length;
  const saturationDays = dates.filter((date) => SATURATION_SYMBOLS.has(getCell(driver.id, date))).length;
  const contractDays = dates.filter((date) => driver.contractDays.includes(dayIndex(date))).length;
  const deltaDays = saturationDays - contractDays;
  const saturation = contractDays ? Math.round((saturationDays / contractDays) * 100) : 0;
  const outsideContract = dates.filter((date) => WORK_SYMBOLS.has(getCell(driver.id, date)) && !driver.contractDays.includes(dayIndex(date))).length;
  return { weeklyX, contractDays, deltaDays, saturation, outsideContract };
}

function saturationClass(value) {
  if (value === 100) return "weekly-saturation-ok";
  if (value > 100) return "weekly-saturation-high";
  return "weekly-saturation-low";
}

function deltaClass(value) {
  if (value === 0) return "weekly-delta-ok";
  if (value > 0) return "weekly-delta-high";
  return "weekly-delta-low";
}

function renderDailyIndicators(columns, drivers) {
  const rows = ["X", "F", "M", "G", "A", "N", "B"].map((symbol) => {
    const counts = columns.map((column) => {
      if (column.type === "weeklyMetric") return `<td class="weekly-index-cell"></td>`;
      const date = column.date;
      const count = drivers.reduce((sum, driver) => {
        const cell = getCell(driver.id, date);
        if (symbol === "X") return sum + (cell === "X" || cell === "XL" ? 1 : 0);
        return sum + (cell === symbol ? 1 : 0);
      }, 0);
      return `<td class="${symbol === "X" ? "daily-total-x" : ""}">${count}</td>`;
    }).join("");
    return `<tr><td><strong>Totale ${symbol}</strong></td>${counts}<td></td><td></td><td></td></tr>`;
  }).join("");
  const delta = columns.map((column) => {
    if (column.type === "weeklyMetric") return `<td class="weekly-index-cell"></td>`;
    const date = column.date;
    const planned = drivers.reduce((sum, driver) => {
      const cell = getCell(driver.id, date);
      return sum + (cell === "X" || cell === "XL" ? 1 : 0);
    }, 0);
    const value = planned - routeNeed(date);
    return `<td class="${dailyDeltaClass(value)}">${value}</td>`;
  }).join("");
  return rows.replace("</tr>", `</tr><tr><td><strong>Delta Fabb./X</strong></td>${delta}<td></td><td></td><td></td></tr>`);
}

function dailyDeltaClass(value) {
  if (value === 0) return "daily-delta-ok";
  if (value < 0) return "daily-delta-low";
  return "daily-delta-high";
}

function renderConstraints() {
  const rows = state.constraints
    .filter((constraint) => driverById(constraint.driverId)?.station === state.station)
    .map((constraint) => {
      const driver = driverById(constraint.driverId);
      return `<tr>
        <td>${formatShortDate(constraint.date)}</td>
        <td>${escapeHtml(driver?.name || constraint.driverId)}</td>
        <td>${constraint.type === "X" ? "Turno forzato" : "Riposo forzato"}</td>
        <td class="row-actions"><button class="ghost" data-remove-constraint="${constraint.id}" type="button">Rimuovi</button></td>
      </tr>`;
    }).join("");
  els.constraintsTable.innerHTML = `<thead><tr><th>Data</th><th>Dipendente</th><th>Tipo</th><th>Azioni</th></tr></thead><tbody>${rows || emptyRow(4)}</tbody>`;
  els.constraintsTable.querySelectorAll("[data-remove-constraint]").forEach((button) => {
    button.addEventListener("click", () => {
      state.constraints = state.constraints.filter((constraint) => constraint.id !== button.dataset.removeConstraint);
      addLog("Vincolo rimosso", "", "", "", "");
      saveAndRender();
    });
  });
}

function renderActualRoutes() {
  if (!els.actualRoutesTable) return;
  const rows = (state.actualRoutes || [])
    .filter((item) => canAccessStation(item.station))
    .slice()
    .sort((a, b) => `${a.date}${a.station}`.localeCompare(`${b.date}${b.station}`))
    .map((item) => {
      const forecast = forecastRoutesForStation(item.date, item.station);
      const variance = forecast ? ((Number(item.routes || 0) - forecast) / forecast) * 100 : 0;
      return `<tr>
        <td>${formatShortDate(item.date)}</td>
        <td>${escapeHtml(item.station)}</td>
        <td>${forecast}</td>
        <td>${item.routes}</td>
        <td>${forecast ? `${variance.toFixed(1)}%` : ""}</td>
        <td class="row-actions"><button class="ghost" data-remove-actual="${escapeHtml(item.date)}||${escapeHtml(item.station)}" type="button">Rimuovi</button></td>
      </tr>`;
    })
    .join("");
  els.actualRoutesTable.innerHTML = `<thead><tr><th>Data</th><th>Filiale</th><th>Rotte forecast</th><th>Rotte consuntive</th><th>% scostamento</th><th>Azioni</th></tr></thead><tbody>${rows || emptyRow(6)}</tbody>`;
  els.actualRoutesTable.querySelectorAll("[data-remove-actual]").forEach((button) => {
    button.addEventListener("click", () => {
      const [date, station] = button.dataset.removeActual.split("||");
      state.actualRoutes = (state.actualRoutes || []).filter((item) => !(item.date === date && item.station === station));
      addLog("Consuntivo rotte rimosso", date, "", station, "");
      saveAndRender();
    });
  });
}

function renderDrivers() {
  const station = els.driverFilterStation?.value || state.station || "Tutte";
  const hours = els.driverFilterHours?.value || "Tutte";
  const drivers = sortedDrivers(state.drivers.filter((driver) => {
    if (driver.active === false) return false;
    if (!canAccessStation(driver.station)) return false;
    if (station !== "Tutte" && driver.station !== station) return false;
    if (hours !== "Tutte" && String(driver.weeklyHours) !== hours) return false;
    return true;
  }));
  const rows = drivers.map((driver) => `<tr>
    <td>${escapeHtml(driver.id)}</td>
    <td>${escapeHtml(driver.name)}</td>
    <td>${escapeHtml(driver.station)}</td>
    <td>${escapeHtml(driver.matricola || "")}</td>
    <td>${escapeHtml(driver.contract)}</td>
    <td>${driver.startDate ? formatShortDate(driver.startDate) : ""}</td>
    <td>${driver.endDate ? formatShortDate(driver.endDate) : ""}</td>
    <td>${driver.weeklyHours}</td>
    <td>${driver.contractDays.map((day) => DAY_NAMES[day]).join(", ")}</td>
  </tr>`).join("");
  els.driversTable.innerHTML = `<thead><tr><th>ID</th><th>Nome</th><th>Station</th><th>Matricola</th><th>Contratto</th><th>Data inizio</th><th>Data fine</th><th>Ore</th><th>Giorni</th></tr></thead><tbody>${rows || emptyRow(9)}</tbody>`;
}

function renderDriverFilterOptions() {
  if (!els.driverFilterStation || !els.driverFilterHours) return;
  const stations = Array.from(new Set(["Tutte", ...state.drivers.map((driver) => driver.station).filter(Boolean)]))
    .filter((station) => station === "Tutte" ? hasGlobalAccess() : canAccessStation(station))
    .sort((a, b) => a === "Tutte" ? -1 : b === "Tutte" ? 1 : a.localeCompare(b, "it"));
  const hours = Array.from(new Set(["Tutte", ...state.drivers.filter((driver) => canAccessStation(driver.station)).map((driver) => String(driver.weeklyHours)).filter(Boolean)])).sort((a, b) => a === "Tutte" ? -1 : b === "Tutte" ? 1 : Number(a) - Number(b));
  const currentStation = els.driverFilterStation.value || state.station || "Tutte";
  const currentHours = els.driverFilterHours.value || "Tutte";
  els.driverFilterStation.innerHTML = stations.map((station) => `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`).join("");
  els.driverFilterHours.innerHTML = hours.map((hour) => `<option value="${escapeHtml(hour)}">${escapeHtml(hour)}</option>`).join("");
  els.driverFilterStation.value = stations.includes(currentStation) ? currentStation : "Tutte";
  els.driverFilterHours.value = hours.includes(currentHours) ? currentHours : "Tutte";
}

function renderUsers() {
  if (!els.usersTable) return;
  renderUserStationOptions();
  if (!canManageUsers()) {
    els.usersTable.innerHTML = `<tbody>${emptyRow(6)}</tbody>`;
    return;
  }
  const rows = state.users
    .slice()
    .sort((a, b) => normalizeName(a.fullName).localeCompare(normalizeName(b.fullName), "it"))
    .map((user) => `<tr>
      <td>${escapeHtml(user.fullName)}</td>
      <td>${escapeHtml(user.station || "Tutte")}</td>
      <td>${escapeHtml(user.username)}</td>
      <td>${escapeHtml(roleLabel(user.role))}</td>
      <td>${remoteMode ? "********" : escapeHtml(user.password)}</td>
      <td class="row-actions"><button class="ghost" data-edit-user="${escapeHtml(user.id)}" type="button">Modifica</button><button class="danger" data-remove-user="${escapeHtml(user.id)}" type="button">Rimuovi</button></td>
    </tr>`)
    .join("");
  els.usersTable.innerHTML = `<thead><tr><th>Nome e cognome</th><th>Filiale</th><th>User</th><th>Tipo utente</th><th>Password</th><th>Azioni</th></tr></thead><tbody>${rows || emptyRow(6)}</tbody>`;
  els.usersTable.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => editUser(button.dataset.editUser));
  });
  els.usersTable.querySelectorAll("[data-remove-user]").forEach((button) => {
    button.addEventListener("click", () => removeUser(button.dataset.removeUser));
  });
}

function renderUserStationOptions() {
  if (!els.userStation) return;
  const stations = Array.from(new Set(["Tutte", "OSI2", "DSI2", "DLZ3", ...state.drivers.map((driver) => driver.station), ...state.forecast.map((item) => item.station)])).filter(Boolean);
  els.userStation.innerHTML = stations.map((station) => `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`).join("");
}

async function saveUser(event) {
  event.preventDefault();
  if (!canManageUsers()) return;
  const username = clean(els.userUsername.value);
  const existingUser = state.users.find((item) => item.username.toLowerCase() === username.toLowerCase());
  const user = {
    id: existingUser?.id || makeId(),
    fullName: clean(els.userFullName.value),
    station: els.userStation.value,
    username,
    password: clean(els.userPassword.value) || existingUser?.password || "",
    role: els.userRole.value
  };
  if (user.role === "dispatcher" && user.station === "Tutte") {
    showToast("Il dispatcher deve avere una filiale specifica");
    return;
  }
  if (remoteMode) {
    try {
      const data = await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({ user })
      });
      state.users = data.users || state.users;
      els.userForm.reset();
      addLog("Utente salvato", "", user.fullName, "", roleLabel(user.role));
      saveAndRender();
      showToast("Utente salvato");
      return;
    } catch {
      showToast("Salvataggio utente non riuscito");
      return;
    }
  }
  const existing = state.users.find((item) => item.id === user.id || item.username.toLowerCase() === username.toLowerCase());
  if (existing) Object.assign(existing, user);
  else state.users.push(user);
  els.userForm.reset();
  addLog("Utente salvato", "", user.fullName, "", roleLabel(user.role));
  saveAndRender({ syncUsers: true });
}

function editUser(id) {
  const user = state.users.find((item) => item.id === id);
  if (!user) return;
  els.userFullName.value = user.fullName;
  els.userStation.value = user.station || "Tutte";
  els.userUsername.value = user.username;
  els.userPassword.value = remoteMode ? "" : user.password;
  els.userRole.value = user.role;
}

async function removeUser(id) {
  if (!canManageUsers()) return;
  const user = state.users.find((item) => item.id === id);
  if (!user || user.username === currentUser?.username) {
    showToast("Non puoi rimuovere l'utente corrente");
    return;
  }
  if (!confirm(`Rimuovere l'utente ${user.fullName}?`)) return;
  if (remoteMode) {
    try {
      const data = await apiRequest("/api/users", {
        method: "DELETE",
        body: JSON.stringify({ id })
      });
      state.users = data.users || state.users.filter((item) => item.id !== id);
      addLog("Utente rimosso", "", user.fullName, roleLabel(user.role), "");
      saveAndRender();
      showToast("Utente rimosso");
      return;
    } catch {
      showToast("Rimozione utente non riuscita");
      return;
    }
  }
  state.users = state.users.filter((item) => item.id !== id);
  addLog("Utente rimosso", "", user.fullName, roleLabel(user.role), "");
  saveAndRender({ syncUsers: true });
}

function renderLog() {
  const rows = state.log
    .filter((item) => !item.station || canAccessStation(item.station))
    .slice()
    .reverse()
    .map((item) => `<tr>
    <td>${escapeHtml(item.timestamp)}</td>
    <td>${escapeHtml(item.user || "")}</td>
    <td>${escapeHtml(item.station)}</td>
    <td>${escapeHtml(item.date)}</td>
    <td>${escapeHtml(item.driver)}</td>
    <td>${escapeHtml(item.action)}</td>
    <td>${escapeHtml(item.from)} -> ${escapeHtml(item.to)}</td>
  </tr>`).join("");
  els.logTable.innerHTML = `<thead><tr><th>Timestamp</th><th>Utente</th><th>Filiale</th><th>Data</th><th>Driver</th><th>Azione</th><th>Modifica</th></tr></thead><tbody>${rows || emptyRow(7)}</tbody>`;
}

function renderDashboard() {
  if (!els.dashboardTable) return;
  const drivers = filteredDrivers();
  const weeks = weekBuckets(visibleDates());
  const weekRows = weeks.map((dates) => dashboardMetricsForDates(dates, drivers));
  const total = dashboardTotalMetrics(weekRows);
  const rows = [...weekRows, total].map((metrics) => renderDashboardRow(metrics)).join("");
  els.dashboardTable.innerHTML = `<thead><tr>
    <th>Week</th>
    <th>Fabbisogno rotte</th>
    <th>Rotte pianificate (X)</th>
    <th>Diff. Fabbisogno - X</th>
    <th>Presenze supplementari</th>
    <th>Ferie (F)</th>
    <th>Malattia (M)</th>
    <th>Lista gialla (G)</th>
    <th>Abortive (A)</th>
    <th>Navette (N)</th>
    <th>KPI1 Saturazione media</th>
    <th>KPI2 Assenze</th>
    <th>KPI3 Malattie</th>
    <th>Insaturazioni (B)</th>
    <th>% Insaturazione</th>
  </tr></thead><tbody>${rows || emptyRow(15)}</tbody>`;
}

function dashboardMetricsForDates(dates, drivers) {
  const counters = { X: 0, F: 0, M: 0, G: 0, A: 0, N: 0, B: 0 };
  let contractDays = 0;
  let saturationDays = 0;
  drivers.forEach((driver) => {
    contractDays += dates.filter((date) => driver.contractDays.includes(dayIndex(date))).length;
    const driverSaturationDays = dates.filter((date) => SATURATION_SYMBOLS.has(getCell(driver.id, date))).length;
    saturationDays += driverSaturationDays;
    dates.forEach((date) => {
      const cell = getCell(driver.id, date);
      if (cell === "X" || cell === "XL") counters.X += 1;
      else if (counters[cell] !== undefined) counters[cell] += 1;
    });
  });
  const need = dates.reduce((sum, date) => sum + routeNeed(date), 0);
  const diff = need - counters.X;
  const extra = drivers.reduce((sum, driver) => {
    const assigned = dates.filter((date) => SATURATION_SYMBOLS.has(getCell(driver.id, date))).length;
    const expected = dates.filter((date) => driver.contractDays.includes(dayIndex(date))).length;
    return sum + Math.max(0, assigned - expected);
  }, 0);
  const saturationPercent = percent(saturationDays, contractDays);
  const absencePercent = percent(counters.F, counters.X);
  const sicknessPercent = percent(counters.M, counters.X);
  const holePercent = percent(counters.B, contractDays);
  const confirmed = dates.every((date) => state.confirmedDates.includes(date));
  return {
    label: `Week${isoWeekNumber(dates[0])}`,
    need,
    planned: counters.X,
    diff,
    extra,
    F: counters.F,
    M: counters.M,
    G: counters.G,
    A: counters.A,
    N: counters.N,
    saturationPercent,
    absencePercent,
    sicknessPercent,
    B: counters.B,
    holePercent,
    contractDays,
    saturationDays,
    confirmed,
    total: false
  };
}

function dashboardTotalMetrics(rows) {
  const total = rows.reduce((acc, row) => {
    ["need", "planned", "diff", "extra", "F", "M", "G", "A", "N", "B", "contractDays", "saturationDays"].forEach((key) => {
      acc[key] = (acc[key] || 0) + Number(row[key] || 0);
    });
    return acc;
  }, { label: "Totale week", confirmed: false, total: true });
  total.saturationPercent = percent(total.saturationDays, total.contractDays);
  total.absencePercent = percent(total.F, total.planned);
  total.sicknessPercent = percent(total.M, total.planned);
  total.holePercent = percent(total.B, total.contractDays);
  return total;
}

function renderDashboardRow(metrics) {
  const weekClass = metrics.confirmed ? "dashboard-week-confirmed" : metrics.total ? "dashboard-total-label" : "";
  const rowClass = metrics.total ? " class=\"dashboard-total-row\"" : "";
  return `<tr${rowClass}>
    <td class="${weekClass}">${escapeHtml(metrics.label)}</td>
    <td>${metrics.need}</td>
    <td>${metrics.planned}</td>
    <td class="${dashboardDiffClass(metrics.diff)}">${metrics.diff}</td>
    <td>${metrics.extra}</td>
    <td>${metrics.F}</td>
    <td>${metrics.M}</td>
    <td>${metrics.G}</td>
    <td>${metrics.A}</td>
    <td>${metrics.N}</td>
    <td class="${dashboardSaturationClass(metrics.saturationPercent)}">${formatPercent(metrics.saturationPercent)}</td>
    <td class="${absenceClass(metrics.absencePercent)}">${formatPercent(metrics.absencePercent)}</td>
    <td class="${sicknessClass(metrics.sicknessPercent)}">${formatPercent(metrics.sicknessPercent)}</td>
    <td>${metrics.B}</td>
    <td class="${insaturationClass(metrics.holePercent)}">${formatPercent(metrics.holePercent)}</td>
  </tr>`;
}

function dashboardDiffClass(value) {
  if (value === 0) return "daily-delta-ok";
  if (value > 0) return "daily-delta-low";
  return "daily-delta-high";
}

function dashboardSaturationClass(value) {
  if (value === 100) return "dashboard-kpi-ok";
  if (value > 100) return "dashboard-kpi-bad";
  return "dashboard-kpi-warn";
}

function absenceClass(value) {
  if (value <= 12.6) return "dashboard-kpi-ok";
  if (value <= 15) return "dashboard-kpi-warn";
  return "dashboard-kpi-bad";
}

function sicknessClass(value) {
  if (value > 5) return "dashboard-kpi-bad";
  if (value >= 3) return "dashboard-kpi-warn";
  return "dashboard-kpi-ok";
}

function insaturationClass(value) {
  return value === 0 ? "dashboard-kpi-ok" : "dashboard-kpi-bad";
}

function percent(numerator, denominator) {
  return denominator ? (Number(numerator || 0) / Number(denominator || 0)) * 100 : 0;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function renderKpis() {
  const dates = visibleDates();
  const drivers = filteredDrivers();
  const routes = dates.reduce((sum, date) => sum + routeNeed(date), 0);
  const assigned = dates.reduce((sum, date) => sum + drivers.filter((driver) => ["X", "XL"].includes(getCell(driver.id, date))).length, 0);
  const extraDays = drivers.reduce((sum, driver) => sum + driverSaturation(driver, dates).extraDays, 0);
  els.kpiRoutes.textContent = String(routes);
  els.kpiAssigned.textContent = String(assigned);
  els.kpiCoverage.textContent = `${routes ? Math.round((assigned / routes) * 100) : 0}%`;
  if (els.kpiDelta) els.kpiDelta.textContent = String(routes - assigned);
  els.kpiDrivers.textContent = String(drivers.length);
  els.kpiExtraHours.textContent = String(extraDays);
}

function runPlanning(mode) {
  const dates = visibleDates();
  const drivers = filteredDrivers();
  const nextPlan = clonePlan(state.plan);

  drivers.forEach((driver) => {
    dates.forEach((date) => {
      if (!state.confirmedDates.includes(date)) setCellInPlan(nextPlan, driver.id, date, "");
    });
  });

  applyAbsences(nextPlan, drivers, dates);
  applyConstraints(nextPlan, drivers, dates);

  weekBuckets(dates).forEach((week) => {
    planWeek(nextPlan, drivers, week, mode);
    rebalanceWeek(nextPlan, drivers, week);
  });

  drivers.forEach((driver) => {
    dates.forEach((date) => {
      if (!getCellFromPlan(nextPlan, driver.id, date)) setCellInPlan(nextPlan, driver.id, date, "R");
    });
    assignContractHole(nextPlan, driver, dates);
  });

  state.plan = nextPlan;
  addLog(mode === "contract" ? "Eseguito algoritmo 1" : "Eseguito algoritmo 2", "", "", "", "");
  saveAndRender();
  showToast("Pianificazione aggiornata");
}

function clonePlan(plan) {
  return Object.fromEntries(Object.entries(plan || {}).map(([driverId, days]) => [driverId, { ...days }]));
}

function weekBuckets(dates) {
  const buckets = [];
  for (let index = 0; index < dates.length; index += 7) {
    buckets.push(dates.slice(index, index + 7));
  }
  return buckets;
}

function planWeek(plan, drivers, weekDatesList, mode) {
  if (mode === "saturation") {
    planWeekSaturationFirst(plan, drivers, weekDatesList);
    return;
  }
  planWeekContractDayFirst(plan, drivers, weekDatesList);
}

function planWeekContractDayFirst(plan, drivers, weekDatesList) {
  weekDatesList.forEach((date) => fillDateNeed(plan, drivers, date, weekDatesList, "contractUndersaturated", "contract"));
  weekDatesList.forEach((date) => fillDateNeed(plan, drivers, date, weekDatesList, "contract", "contract"));
  weekDatesList.forEach((date) => fillDateNeed(plan, drivers, date, weekDatesList, "outside", "contract"));
}

function planWeekSaturationFirst(plan, drivers, weekDatesList) {
  let changed = true;
  let guard = 0;
  while (changed && guard < 1000) {
    changed = false;
    guard += 1;
    const pair = bestWeeklySaturationPair(plan, drivers, weekDatesList);
    if (pair) {
      setCellInPlan(plan, pair.driver.id, pair.date, "X");
      changed = true;
    }
  }
  weekDatesList.forEach((date) => fillDateNeed(plan, drivers, date, weekDatesList, "contract", "saturation"));
  weekDatesList.forEach((date) => fillDateNeed(plan, drivers, date, weekDatesList, "outside", "saturation"));
}

function fillDateNeed(plan, drivers, date, weekDatesList, pass, mode) {
  if (state.confirmedDates.includes(date)) return;
  let need = routeNeed(date) - assignedCount(plan, drivers, date);
  while (need > 0) {
    const candidate = bestCandidateForDate(plan, drivers, date, weekDatesList, pass, mode);
    if (!candidate) break;
    setCellInPlan(plan, candidate.id, date, "X");
    need -= 1;
  }
}

function bestWeeklySaturationPair(plan, drivers, weekDatesList) {
  const pairs = [];
  weekDatesList.forEach((date) => {
    if (state.confirmedDates.includes(date)) return;
    if (routeNeed(date) - assignedCount(plan, drivers, date) <= 0) return;
    drivers.forEach((driver) => {
      if (!canAssignForPass(plan, driver, date, weekDatesList, "contractUndersaturated")) return;
      pairs.push({ driver, date, score: saturationPairScore(plan, driver, date, weekDatesList) });
    });
  });
  if (!pairs.length) return null;
  return pairs.sort((a, b) => a.score - b.score)[0];
}

function saturationPairScore(plan, driver, date, weekDatesList) {
  const metrics = weeklyMetricsFromPlan(plan, driver, weekDatesList);
  const saturationRatio = metrics.contractDays ? metrics.saturationDays / metrics.contractDays : 1;
  const dailyCoverageRatio = routeNeed(date) ? assignedCount(plan, filteredDrivers(), date) / routeNeed(date) : 1;
  return saturationRatio * 100 + dailyCoverageRatio * 20 + previousConsecutiveDays(plan, driver.id, date) * 5 + metrics.outsideContract * 10;
}

function assignedCount(plan, drivers, date) {
  return drivers.filter((driver) => WORK_SYMBOLS.has(getCellFromPlan(plan, driver.id, date))).length;
}

function bestCandidateForDate(plan, drivers, date, weekDatesList, pass, mode) {
  const candidates = drivers.filter((driver) => canAssignForPass(plan, driver, date, weekDatesList, pass));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => candidateScore(plan, a, date, weekDatesList, pass, mode) - candidateScore(plan, b, date, weekDatesList, pass, mode))[0];
}

function canAssignForPass(plan, driver, date, weekDatesList, pass) {
  if (!canAssign(plan, driver, date, weekDatesList)) return false;
  const inContractDay = driver.contractDays.includes(dayIndex(date));
  const metrics = weeklyMetricsFromPlan(plan, driver, weekDatesList);
  if (pass === "contractUndersaturated") return inContractDay && metrics.saturationDays < metrics.contractDays;
  if (pass === "contract") return inContractDay;
  if (pass === "outside") return !inContractDay;
  return false;
}

function candidateScore(plan, driver, date, weekDatesList, pass, mode) {
  const metrics = weeklyMetricsFromPlan(plan, driver, weekDatesList);
  const consecutive = previousConsecutiveDays(plan, driver.id, date);
  const day = dayIndex(date);
  const contractPosition = driver.contractDays.indexOf(day);
  const saturationRatio = metrics.contractDays ? metrics.saturationDays / metrics.contractDays : 1;
  const balancePriority = mode === "saturation" ? saturationRatio * 120 : saturationRatio * 80;
  const overTargetPenalty = Math.max(0, metrics.saturationDays - metrics.contractDays) * 80;
  const outsidePenalty = pass === "outside" ? 100 + metrics.outsideContract * 20 : 0;
  const sixthSeventhPenalty = metrics.workDays >= 5 ? 80 : 0;
  const bPenalty = getCellFromPlan(plan, driver.id, date) === "B" ? -8 : 0;
  return balancePriority + overTargetPenalty + outsidePenalty + sixthSeventhPenalty + consecutive * 5 + Math.max(0, contractPosition) + bPenalty;
}

function weeklyMetricsFromPlan(plan, driver, dates) {
  const workDays = dates.filter((date) => WORK_SYMBOLS.has(getCellFromPlan(plan, driver.id, date))).length;
  const saturationDays = dates.filter((date) => SATURATION_SYMBOLS.has(getCellFromPlan(plan, driver.id, date))).length;
  const contractDays = dates.filter((date) => driver.contractDays.includes(dayIndex(date))).length;
  const outsideContract = dates.filter((date) => WORK_SYMBOLS.has(getCellFromPlan(plan, driver.id, date)) && !driver.contractDays.includes(dayIndex(date))).length;
  return { workDays, saturationDays, contractDays, outsideContract };
}

function rebalanceWeek(plan, drivers, weekDatesList) {
  let changed = true;
  let guard = 0;
  while (changed && guard < 500) {
    changed = false;
    guard += 1;
    const overDrivers = drivers
      .filter((driver) => weeklyDeficit(plan, driver, weekDatesList) < 0)
      .sort((a, b) => weeklyDeficit(plan, a, weekDatesList) - weeklyDeficit(plan, b, weekDatesList));
    const underDrivers = drivers
      .filter((driver) => weeklyDeficit(plan, driver, weekDatesList) > 0)
      .sort((a, b) => weeklyDeficit(plan, b, weekDatesList) - weeklyDeficit(plan, a, weekDatesList));

    for (const overDriver of overDrivers) {
      const movableDates = weekDatesList
        .filter((date) => !state.confirmedDates.includes(date) && getCellFromPlan(plan, overDriver.id, date) === "X")
        .sort((a, b) => Number(overDriver.contractDays.includes(dayIndex(a))) - Number(overDriver.contractDays.includes(dayIndex(b))));

      for (const date of movableDates) {
        const replacement = underDrivers.find((driver) => canReceiveBalancedShift(plan, driver, date, weekDatesList));
        if (!replacement) continue;
        setCellInPlan(plan, overDriver.id, date, "");
        setCellInPlan(plan, replacement.id, date, "X");
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
}

function weeklyDeficit(plan, driver, dates) {
  const metrics = weeklyMetricsFromPlan(plan, driver, dates);
  return metrics.contractDays - metrics.saturationDays;
}

function canReceiveBalancedShift(plan, driver, date, weekDatesList) {
  if (weeklyDeficit(plan, driver, weekDatesList) <= 0) return false;
  if (!driver.contractDays.includes(dayIndex(date))) return false;
  return canAssign(plan, driver, date, weekDatesList);
}

function applyAbsences(plan, drivers, dates) {
  state.absences.forEach((absence) => {
    const driver = drivers.find((item) => (absence.matricola && normalizeMatricola(item.matricola) === normalizeMatricola(absence.matricola)) || item.id === absence.driverId);
    if (!driver || !dates.includes(absence.date)) return;
    if (!driver.contractDays.includes(dayIndex(absence.date))) return;
    setCellInPlan(plan, driver.id, absence.date, absence.type);
  });
}

function applyConstraints(plan, drivers, dates) {
  state.constraints.forEach((constraint) => {
    const driver = drivers.find((item) => item.id === constraint.driverId);
    if (!driver || !dates.includes(constraint.date)) return;
    const current = getCellFromPlan(plan, driver.id, constraint.date);
    if (current === "F" || current === "M") return;
    setCellInPlan(plan, driver.id, constraint.date, constraint.type === "X" ? "XL" : "RL");
  });
}

function scoreDriver(plan, driver, date, mode, dates) {
  const week = weekDates(date);
  const assignedThisWeek = week.filter((day) => SATURATION_SYMBOLS.has(getCellFromPlan(plan, driver.id, day))).length;
  const outsideContract = driver.contractDays.includes(dayIndex(date)) ? 0 : 1;
  const consecutive = previousConsecutiveDays(plan, driver.id, date);
  const targetDays = Math.round(driver.weeklyHours / 8);

  if (mode === "saturation") {
    return (assignedThisWeek - targetDays) * 10 + outsideContract * 6 + consecutive * 3;
  }
  return outsideContract * 10 + Math.max(0, assignedThisWeek - targetDays) * 8 + consecutive * 4 + assignedThisWeek;
}

function canAssign(plan, driver, date, weekOverride) {
  const current = getCellFromPlan(plan, driver.id, date);
  if (current && current !== "B") return false;
  if (!isDriverAvailableOnDate(driver, date)) return false;
  const week = weekOverride || weekDates(date);
  const absentAllContractDays = driver.contractDays.every((day) => {
    const weekDay = week[day];
    const value = getCellFromPlan(plan, driver.id, weekDay);
    return value === "F" || value === "M";
  });
  if (absentAllContractDays && !hasForcedX(driver.id, date)) return false;
  if (previousConsecutiveDays(plan, driver.id, date) >= 5 && !driver.contractDays.includes(dayIndex(date))) return false;
  return true;
}

function isDriverAvailableOnDate(driver, date) {
  if (driver.startDate && date < driver.startDate) return false;
  if (driver.endDate && date > driver.endDate) return false;
  return true;
}

function assignContractHole(plan, driver, dates) {
  const weekStarts = Array.from(new Set(dates.map((date) => toISO(startOfWeek(new Date(`${date}T12:00:00`))))));
  weekStarts.forEach((start) => {
    const week = weekDates(start).filter((date) => dates.includes(date));
    const targetDays = week.filter((date) => driver.contractDays.includes(dayIndex(date))).length;
    const saturated = week.filter((date) => SATURATION_SYMBOLS.has(getCellFromPlan(plan, driver.id, date))).length;
    if (saturated >= targetDays) return;
    const candidate = week
      .filter((date) => driver.contractDays.includes(dayIndex(date)))
      .reverse()
      .find((date) => getCellFromPlan(plan, driver.id, date) === "R");
    if (candidate) setCellInPlan(plan, driver.id, candidate, "B");
  });
}

function addConstraint(event) {
  event.preventDefault();
  const driver = driverById(els.constraintDriver.value);
  const date = els.constraintDate.value;
  const type = els.constraintType.value;
  if (!driver || !date) return;
  state.constraints = state.constraints.filter((item) => !(item.driverId === driver.id && item.date === date));
  state.constraints.push({ id: makeId(), driverId: driver.id, date, type });
  addLog("Vincolo aggiunto", date, driver.name, "", type);
  saveAndRender();
}

function cycleCell(driverId, date) {
  if (!calendarInteraction.mode) {
    showToast("Seleziona prima Lista gialla o Modifica giornata e scegli la data.");
    return;
  }
  if (date !== calendarInteraction.date) {
    showToast(`Modalità attiva solo per il ${formatShortDate(calendarInteraction.date)}`);
    return;
  }
  if (calendarInteraction.mode === "yellow") {
    toggleYellowCell(driverId, date);
    return;
  }
  if (calendarInteraction.mode === "modify") {
    openModifyStatusModal(driverId, date);
  }
}

function confirmDay() {
  openDateActionModal("confirm");
}

function confirmSelectedDay(date) {
  if (!date) return;
  if (!state.confirmedDates.includes(date)) state.confirmedDates.push(date);
  calendarInteraction = { mode: "", date: "", driverId: "" };
  addLog("Giornata confermata", date, "", "", "");
  saveAndRender();
}

function unlockDay() {
  openDateActionModal("unlock");
}

function unlockSelectedDay(date) {
  if (!date) return;
  state.confirmedDates = state.confirmedDates.filter((item) => item !== date);
  calendarInteraction = { mode: "", date: "", driverId: "" };
  addLog("Giornata sbloccata", date, "", "", "");
  saveAndRender();
}

function selectedOperationalDate() {
  return els.confirmDateInput.value || state.weekStart;
}

function requireConfirmedDate(date) {
  if (!date) {
    showToast("Seleziona una data");
    return false;
  }
  if (!state.confirmedDates.includes(date)) {
    showToast("Prima conferma la giornata");
    return false;
  }
  return true;
}

function openDateActionModal(mode) {
  dateActionMode = mode;
  const titles = {
    confirm: "Conferma giornata",
    unlock: "Sblocca giornata",
    yellow: "Lista gialla",
    modify: "Modifica giornata"
  };
  const helps = {
    confirm: "Seleziona dal calendario la data da confermare. Le X della giornata risulteranno bloccate e opache.",
    unlock: "Seleziona la data da sbloccare per poter ripianificare nuovamente con gli algoritmi.",
    yellow: "Seleziona la data confermata su cui creare la lista gialla. Dopo OK clicca nel calendario le R da trasformare in G.",
    modify: "Seleziona la data confermata da modificare. Dopo OK clicca nel calendario le celle da variare."
  };
  if (els.dateActionTitle) els.dateActionTitle.textContent = titles[mode] || "Seleziona data";
  if (els.dateActionHelp) els.dateActionHelp.textContent = helps[mode] || "Scegli la data su cui operare.";
  if (els.dateActionDate) els.dateActionDate.value = selectedOperationalDate();
  els.dateActionModal?.classList.add("active");
}

function closeDateActionModal() {
  els.dateActionModal?.classList.remove("active");
}

function applyDateAction(event) {
  event.preventDefault();
  const date = els.dateActionDate?.value;
  if (!date) return;
  els.confirmDateInput.value = date;
  if (dateActionMode === "confirm") confirmSelectedDay(date);
  if (dateActionMode === "unlock") unlockSelectedDay(date);
  if (dateActionMode === "yellow") activateCalendarInteraction("yellow", date);
  if (dateActionMode === "modify") activateCalendarInteraction("modify", date);
  closeDateActionModal();
}

function activateCalendarInteraction(mode, date) {
  if (!requireConfirmedDate(date)) return;
  calendarInteraction = { mode, date, driverId: "" };
  const label = mode === "yellow" ? "Lista gialla" : "Modifica giornata";
  addLog(`${label} abilitata`, date, "", "", "");
  showToast(`${label}: clicca le celle del ${formatShortDate(date)} nel calendario`);
  saveAndRender();
}

function finishCalendarInteraction(mode) {
  if (calendarInteraction.mode !== mode) return;
  const date = calendarInteraction.date;
  const label = mode === "yellow" ? "Lista gialla" : "Modifiche giornata";
  calendarInteraction = { mode: "", date: "", driverId: "" };
  addLog(`${label} terminata`, date, "", "", "");
  showToast(`${label} terminata`);
  saveAndRender();
}

function renderCalendarInteractionControls() {
  if (els.finishYellowListBtn) els.finishYellowListBtn.hidden = calendarInteraction.mode !== "yellow";
  if (els.finishModifyBtn) els.finishModifyBtn.hidden = calendarInteraction.mode !== "modify";
}

function openYellowListModal() {
  openDateActionModal("yellow");
}

function toggleYellowCell(driverId, date) {
  const driver = driverById(driverId);
  if (!driver) return;
  const current = getCell(driver.id, date) || "R";
  if (current === "R") {
    setCell(driver.id, date, "G");
    addLog("Lista gialla", date, driver.name, "R", "G");
    saveAndRender();
    return;
  }
  if (current === "G") {
    setCell(driver.id, date, "R");
    addLog("Lista gialla", date, driver.name, "G", "R");
    saveAndRender();
    return;
  }
  showToast("In lista gialla puoi selezionare solo dipendenti in R");
}

function openModifyDayModal() {
  openDateActionModal("modify");
}

function openModifyStatusModal(driverId, date) {
  const driver = driverById(driverId);
  if (!driver || !requireConfirmedDate(date)) return;
  calendarInteraction = { ...calendarInteraction, driverId };
  const current = getCell(driver.id, date) || "R";
  els.modifyDriverSelect.innerHTML = `<option value="${escapeHtml(driver.id)}">${escapeHtml(driver.name)}</option>`;
  els.modifyDriverSelect.value = driver.id;
  els.modifyStatusSelect.value = ["XL", "RL"].includes(current) ? current.slice(0, 1) : current;
  if (els.modifyDayHelp) els.modifyDayHelp.textContent = `${driver.name} - ${formatShortDate(date)}. Stato attuale: ${current}.`;
  els.modifyDayModal.classList.add("active");
}

function closeModifyDayModal() {
  els.modifyDayModal.classList.remove("active");
}

function applyTargetedDayChange(event) {
  event.preventDefault();
  const date = calendarInteraction.date || selectedOperationalDate();
  if (!requireConfirmedDate(date)) return;
  const driver = driverById(els.modifyDriverSelect.value);
  const next = els.modifyStatusSelect.value;
  if (!driver || !next) return;
  const current = getCell(driver.id, date) || "R";
  if (current === next) {
    closeModifyDayModal();
    return;
  }
  setCell(driver.id, date, next);
  addLog("Modifica mirata giornata", date, driver.name, current, next);
  closeModifyDayModal();
  saveAndRender();
}

function importForecast(rows) {
  const batch = new Map();
  const weeks = new Map();
  const stats = createImportStats();
  rows.forEach((row) => {
    const week = clean(getField(row, ["week", "settimana"]));
    const date = normalizeDate(getField(row, ["ofd_date", "date", "data"]));
    const station = clean(getField(row, ["station", "filiale"]));
    const routes = parseNumber(getField(row, ["routes_output", "routes", "rotte"]));
    if (!date || !station) return;
    const key = `${date}||${station}`;
    batch.set(key, (batch.get(key) || 0) + routes);
    if (week) weeks.set(key, week);
  });
  batch.forEach((routes, key) => {
    const [date, station] = key.split("||");
    const existing = state.forecast.find((item) => item.date === date && item.station === station);
    if (existing) {
      existing.routes = routes;
      existing.week = weeks.get(key) || existing.week || "";
      addImportStat(stats.updated, station);
    } else {
      state.forecast.push({ date, station, routes, week: weeks.get(key) || "" });
      addImportStat(stats.added, station);
    }
  });
  const summary = formatImportSummary("Forecast", stats, "giornate");
  addLog("Import forecast", "", "", "", summary);
  saveAndRender();
  return summary;
}

function importDrivers(rows) {
  const stats = createImportStats();
  rows.forEach((row) => {
    const station = clean(getField(row, ["station", "filiale"]) || state.station);
    const matricola = normalizeMatricola(getField(row, ["matricola_ts", "matricola", "employee_code"]));
    const id = clean(getField(row, ["id_driver", "id", "driver_id"])) || nextInternalId();
    const name = clean(getField(row, ["nome_e_cognome", "name", "nome"]) || id);
    const contract = clean(getField(row, ["contratto", "contract"]) || "da lunedi a venerdi");
    const status = clean(getField(row, ["stato", "active"])).toLowerCase();
    const startDate = normalizeDate(getField(row, ["data_inizio_contratto", "data_inizio", "start_date"]));
    const endDate = normalizeDate(getField(row, ["data_fine_contratto", "data_fine", "end_date"]));
    const weeklyHours = parseNumber(getField(row, ["weekly_hours", "hours", "ore"])) || inferWeeklyHours(contract);
    const driver = {
      id,
      name,
      station,
      contract,
      weeklyHours,
      matricola,
      active: isActiveEmployee(status, endDate),
      startDate,
      endDate,
      contractDays: parseContractDays(row.days || contract)
    };
    const existing = state.drivers.find((item) => (matricola && normalizeMatricola(item.matricola) === matricola) || normalizeName(item.name) === normalizeName(name) || item.id === id);
    if (existing) {
      Object.assign(existing, driver);
      addImportStat(stats.updated, station);
    } else {
      state.drivers.push(driver);
      addImportStat(stats.added, station);
    }
  });
  state.drivers = sortedDrivers(state.drivers);
  const validMatricole = new Set(state.drivers.map((driver) => normalizeMatricola(driver.matricola)).filter(Boolean));
  const validDriverIds = new Set(state.drivers.map((driver) => driver.id));
  state.absences = state.absences.filter((absence) => validMatricole.has(normalizeMatricola(absence.matricola)) || validDriverIds.has(absence.driverId));
  const summary = formatImportSummary("Dipendenti", stats, "dipendenti");
  addLog("Import dipendenti", "", "", "", summary);
  saveAndRender();
  return summary;
}

function importAbsences(rows) {
  let imported = 0;
  let skipped = 0;
  const stats = createImportStats();
  rows.forEach((row) => {
    const startDate = normalizeDate(getField(row, ["data_iniziale", "data_inizio", "date", "data"]));
    const endDate = normalizeDate(getField(row, ["data_finale", "data_fine"])) || startDate;
    const matricola = normalizeMatricola(getField(row, ["matricola", "matricola_ts", "employee_code"]));
    const driverId = clean(getField(row, ["id_driver", "id", "driver_id"]));
    const driverName = clean(getField(row, ["nome_e_cognome", "nome_cognome", "name", "nome"]));
    const rawType = clean(getField(row, ["type", "tipo"]));
    const directType = rawType.toUpperCase();
    const label = clean(getField(row, ["tipo_di_assenza", "tipo_assenza", "assenza"])) || rawType;
    const hours = clean(getField(row, ["ore", "hours"]));
    const status = clean(getField(row, ["stato", "status"]));
    const check = clean(getField(row, ["controllo", "check"]));
    const festivita = parseNumber(getField(row, ["festivita", "festivita_ore", "festività", "festività_ore"]));
    const ferie = parseNumber(getField(row, ["ferie_ore", "ferie"]));
    const permessi = parseNumber(getField(row, ["permessi"]));
    const altreAssenze = parseNumber(getField(row, ["altre_assenze"]));
    const malattia = parseNumber(getField(row, ["malattia"]));
    const infortunio = parseNumber(getField(row, ["infortunio"]));
    const otherMedicalAbsences = parseNumberFields(row, [
      "maternita_paternita",
      "maternita",
      "paternita",
      "cassa_integrazione",
      "congedo_matrimoniale",
      "donazione_sangue",
      "assenze_sindacali",
      "aspettativa",
      "permessi_studio",
      "assenze_disciplinari",
      "sciopero",
      "permessi_legge_104",
      "legge_104"
    ]);
    const type = absenceTypeFromImport(label, directType, festivita, ferie, permessi, altreAssenze, malattia, infortunio, otherMedicalAbsences);
    const detail = absenceDetailFromImport(row, label, directType, type);
    if (!startDate || !endDate || !["F", "M"].includes(type)) {
      skipped += 1;
      return;
    }
    const driver = findDriverForAbsence(matricola, driverId, driverName);
    if (!driver) {
      skipped += 1;
      return;
    }
    datesBetween(startDate, endDate).forEach((date) => {
      if (!isDriverAvailableOnDate(driver, date) || !driver.contractDays.includes(dayIndex(date))) {
        skipped += 1;
        return;
      }
      const normalizedMatricola = normalizeMatricola(driver.matricola);
      const employeeKey = normalizedMatricola || driver.id;
      const absence = {
        date,
        startDate,
        endDate,
        matricola: normalizedMatricola,
        type,
        label: detail,
        hours,
        status,
        check,
        driverId: driver.id
      };
      const existing = state.absences.find((item) => item.date === date && (normalizeMatricola(item.matricola) || item.driverId) === employeeKey);
      if (existing) {
        Object.assign(existing, absence);
        addImportStat(stats.updated, driver.station);
      } else {
        state.absences.push(absence);
        addImportStat(stats.added, driver.station);
      }
      imported += 1;
    });
  });
  stats.skipped = skipped;
  const summary = `${formatImportSummary("Assenze", stats, "assenze")} | scartate: ${skipped}`;
  addLog("Import assenze", "", "", "", summary);
  saveAndRender();
  return summary;
}

function createImportStats() {
  return { added: new Map(), updated: new Map(), skipped: 0 };
}

function addImportStat(bucket, station) {
  const key = clean(station) || "Senza station";
  bucket.set(key, (bucket.get(key) || 0) + 1);
}

function formatImportSummary(title, stats, itemLabel) {
  const stations = Array.from(new Set([...stats.added.keys(), ...stats.updated.keys()])).sort();
  if (!stations.length) return `${title}: nessun ${itemLabel} aggiunto o aggiornato`;
  const details = stations.map((station) => {
    const added = stats.added.get(station) || 0;
    const updated = stats.updated.get(station) || 0;
    return `${station}: ${added} aggiunti, ${updated} aggiornati`;
  }).join(" | ");
  return `${title} - ${itemLabel}: ${details}`;
}

function absenceTypeFromImport(label, directType, festivita, ferie, permessi, altreAssenze, malattia, infortunio, otherMedicalAbsences) {
  const text = clean(label).toLowerCase();
  const normalizedText = normalizeName(label);
  if (["F", "M"].includes(directType)) return directType;
  if (altreAssenze || normalizedText.includes("altre assenze")) return "F";
  if (otherMedicalAbsences || malattia || infortunio || hasAnyAbsenceToken(normalizedText, [
    "malattia",
    "infortunio",
    "maternita",
    "paternita",
    "cassa integrazione",
    "congedo matrimoniale",
    "donazione sangue",
    "assenze sindacali",
    "aspettativa",
    "permessi studio",
    "assenze disciplinari",
    "sciopero",
    "permessi legge 104",
    "legge 104"
  ])) return "M";
  if (festivita || ferie || permessi || text.includes("festiv") || text.includes("ferie") || normalizedText.includes("permessi")) return "F";
  return "";
}

function absenceDetailFromImport(row, label, directType, type) {
  const normalizedLabel = normalizeName(label);
  if (label && !["F", "M"].includes(directType) && normalizedLabel !== "f" && normalizedLabel !== "m") return label;
  const fields = [
    ["Festivita", ["festivita", "festivita_ore", "festività", "festività_ore"]],
    ["Ferie", ["ferie_ore", "ferie"]],
    ["Permessi", ["permessi"]],
    ["Altre assenze", ["altre_assenze"]],
    ["Malattia", ["malattia"]],
    ["Infortunio", ["infortunio"]],
    ["Maternita/paternita", ["maternita_paternita", "maternita", "paternita"]],
    ["Cassa integrazione", ["cassa_integrazione"]],
    ["Congedo matrimoniale", ["congedo_matrimoniale"]],
    ["Donazione sangue", ["donazione_sangue"]],
    ["Assenze sindacali", ["assenze_sindacali"]],
    ["Aspettativa", ["aspettativa"]],
    ["Permessi studio", ["permessi_studio"]],
    ["Assenze disciplinari", ["assenze_disciplinari"]],
    ["Sciopero", ["sciopero"]],
    ["Permessi legge 104", ["permessi_legge_104", "legge_104"]]
  ];
  const match = fields.find(([, names]) => hasImportValue(row, names));
  if (match) return match[0];
  return type === "F" ? "Ferie/permesso" : type === "M" ? "Malattia/infortunio" : "";
}

function parseNumberFields(row, names) {
  return names.reduce((sum, name) => sum + parseNumber(getField(row, [name])), 0);
}

function hasImportValue(row, names) {
  return names.some((name) => {
    const value = getField(row, [name]);
    return parseNumber(value) > 0 || (!!clean(value) && clean(value) !== "0");
  });
}

function hasAnyAbsenceToken(text, tokens) {
  return tokens.some((token) => text.includes(token));
}

function findDriverForAbsence(matricola, driverId, driverName) {
  const normalizedMatricola = normalizeMatricola(matricola);
  const normalizedName = normalizeName(driverName);
  return state.drivers.find((driver) => (
    normalizedMatricola && normalizeMatricola(driver.matricola) === normalizedMatricola
  ) || (
    driverId && clean(driver.id).toLowerCase() === driverId.toLowerCase()
  ) || (
    normalizedName && normalizeName(driver.name) === normalizedName
  ));
}

function datesBetween(startDate, endDate) {
  const dates = [];
  let cursor = startDate <= endDate ? startDate : endDate;
  const last = startDate <= endDate ? endDate : startDate;
  while (cursor <= last) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function saveActualRoutes(event) {
  event.preventDefault();
  const date = els.actualRouteDate.value;
  const station = els.actualRouteStation.value;
  const routes = Math.max(0, Math.round(parseNumber(els.actualRouteRoutes.value)));
  if (!date || !station) return;
  const existing = (state.actualRoutes || []).find((item) => item.date === date && item.station === station);
  if (existing) existing.routes = routes;
  else state.actualRoutes.push({ date, station, routes });
  addLog("Consuntivo rotte salvato", date, "", station, String(routes));
  els.actualRouteRoutes.value = "";
  saveAndRender();
}

function importDataFile(event, handler) {
  const file = event.target.files[0];
  if (!file) return;
  const isSpreadsheet = /\.(xlsx|xls)$/i.test(file.name);
  const reader = isSpreadsheet ? file.arrayBuffer() : file.text();
  reader.then((content) => {
    if (isSpreadsheet) {
      if (!window.XLSX) {
        showToast("Lettore Excel non disponibile. Apri la pagina con connessione internet o usa CSV.");
        event.target.value = "";
        return;
      }
      const summary = handler(parseWorkbook(content));
      showToast(summary || "Import completato");
    } else {
      const summary = handler(parseCsv(content));
      showToast(summary || "Import completato");
    }
    event.target.value = "";
  });
}

function seedExampleData(options = {}) {
  const start = state.weekStart || toISO(startOfWeek(new Date()));
  state.station = "DLZ3";
  state.drivers = [
    driver("DLZ3-001", "Alessandro Bianchi", "DLZ3", "da lunedi a venerdi", 39, "M001"),
    driver("DLZ3-002", "Ignazio Russo", "DLZ3", "da lunedi a sabato_39h", 39, "M002"),
    driver("DLZ3-003", "Marco Ferri", "DLZ3", "PT_24h", 24, "M003", [0, 3, 4]),
    driver("DLZ3-004", "Salvatore Greco", "DLZ3", "PT_32h", 32, "M004", [1, 2, 3, 4]),
    driver("OSI2-001", "Giulia Romano", "OSI2", "da lunedi a venerdi", 39, "M010")
  ];
  state.forecast = weekDates(start).concat(weekDates(addDays(start, 7))).map((date, index) => ({
    date,
    station: "DLZ3",
    routes: index % 6 === 5 ? 2 : 3
  }));
  state.absences = [
    { date: addDays(start, 2), matricola: "M003", type: "F" },
    { date: addDays(start, 4), matricola: "M004", type: "M" }
  ];
  state.constraints = [
    { id: makeId(), driverId: "DLZ3-002", date: addDays(start, 5), type: "R" },
    { id: makeId(), driverId: "DLZ3-003", date: addDays(start, 1), type: "X" }
  ];
  state.actualRoutes = [];
  state.plan = {};
  state.confirmedDates = [];
  addLog("Dati esempio caricati", "", "", "", "");
  saveAndRender();
  if (!options.silent) showToast("Dati esempio caricati");
}

function resetData() {
  if (!confirm("Vuoi cancellare tutti i dati locali della piattaforma?")) return;
  const users = state.users;
  state = defaultState();
  state.users = users;
  state.weekStart = toISO(startOfWeek(new Date()));
  ensureDefaultUsers();
  if (isDispatcher()) state.station = currentUser.station;
  saveAndRender();
}

function exportPlanCsv() {
  const rows = [["station", "date", "driver_id", "driver_name", "symbol", "confirmed"]];
  visibleDates().forEach((date) => {
    filteredDrivers().forEach((driver) => {
      rows.push([state.station, date, driver.id, driver.name, getCell(driver.id, date) || "", state.confirmedDates.includes(date) ? "yes" : "no"]);
    });
  });
  download("piano_turni_driver.csv", rows.map((row) => row.map(csvEscape).join(";")).join("\n"));
}

function exportTableCsv(tableId, baseName) {
  const table = document.querySelector(`#${tableId}`);
  if (!table) {
    showToast("Tabella non trovata");
    return;
  }
  const rows = Array.from(table.querySelectorAll("tr"))
    .map((row) => Array.from(row.querySelectorAll("th,td"))
      .filter((cell) => !cell.classList.contains("row-actions"))
      .map((cell) => clean(cell.innerText).replace(/\s+/g, " ")))
    .filter((row) => row.length);
  if (!rows.length) {
    showToast("Nessun dato da esportare");
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  download(`${baseName}-${date}.csv`, rows.map((row) => row.map(csvEscape).join(";")).join("\n"));
}

function filteredDrivers() {
  return sortedDrivers(state.drivers.filter((driver) => driver.active !== false && driver.station === state.station));
}

function sortedDrivers(drivers) {
  return drivers.slice().sort((a, b) => normalizeName(a.name).localeCompare(normalizeName(b.name), "it"));
}

function driverById(id) {
  return state.drivers.find((driver) => driver.id === id);
}

function driver(id, name, station, contract, weeklyHours, matricola, contractDays) {
  return { id, name, station, contract, weeklyHours, matricola, active: true, startDate: "", endDate: "", contractDays: contractDays || parseContractDays(contract) };
}

function normalizeDriverContracts() {
  state.drivers.forEach((driver) => {
    const parsed = parseContractDays(driver.contract || "");
    const hasContractDayPattern = /lun|mar|mer|gio|ven|sab|dom|sabato|venerdi/i.test(driver.contract || "");
    if (parsed.length && (!Array.isArray(driver.contractDays) || !driver.contractDays.length || hasContractDayPattern)) driver.contractDays = parsed;
  });
}

function getCell(driverId, date) {
  return state.plan[driverId]?.[date] || "";
}

function setCell(driverId, date, value) {
  if (!state.plan[driverId]) state.plan[driverId] = {};
  state.plan[driverId][date] = value;
}

function getCellFromPlan(plan, driverId, date) {
  return plan[driverId]?.[date] || "";
}

function setCellInPlan(plan, driverId, date, value) {
  if (!plan[driverId]) plan[driverId] = {};
  plan[driverId][date] = value;
}

function routeNeed(date) {
  const actual = (state.actualRoutes || []).find((item) => item.station === state.station && item.date === date);
  if (actual) return Math.max(0, Number(actual.routes || 0));
  return forecastRoutesForStation(date, state.station);
}

function forecastRoutesForStation(date, station) {
  const forecast = state.forecast.find((item) => item.station === station && item.date === date);
  return Math.max(0, Math.ceil((forecast?.routes || 0) * (1 + Number(state.forecastIncrease || 0) / 100)));
}

function driverSaturation(driver, dates) {
  const assigned = dates.filter((date) => SATURATION_SYMBOLS.has(getCell(driver.id, date))).length;
  const outOfContract = dates.filter((date) => WORK_SYMBOLS.has(getCell(driver.id, date)) && !driver.contractDays.includes(dayIndex(date))).length;
  const expectedDays = dates.filter((date) => driver.contractDays.includes(dayIndex(date))).length;
  return {
    percent: expectedDays ? Math.round((assigned / expectedDays) * 100) : 0,
    extraDays: Math.max(0, assigned - expectedDays),
    outOfContract
  };
}

function previousConsecutiveDays(plan, driverId, date) {
  let count = 0;
  for (let offset = 1; offset <= 7; offset += 1) {
    const value = getCellFromPlan(plan, driverId, addDays(date, -offset));
    if (!WORK_SYMBOLS.has(value)) break;
    count += 1;
  }
  return count;
}

function hasForcedX(driverId, date) {
  return state.constraints.some((item) => item.driverId === driverId && item.date === date && item.type === "X");
}

function visibleDates() {
  const dates = [];
  const start = state.weekStart || toISO(startOfWeek(new Date()));
  for (let index = 0; index < Number(state.weeks) * 7; index += 1) {
    dates.push(addDays(start, index));
  }
  return dates;
}

function weekDates(date) {
  const start = toISO(startOfWeek(new Date(`${date}T12:00:00`)));
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(`${date}T12:00:00`);
  copy.setDate(copy.getDate() + days);
  return toISO(copy);
}

function dayIndex(date) {
  return (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
}

function isoWeekNumber(date) {
  const current = new Date(`${date}T12:00:00`);
  const day = current.getDay() || 7;
  current.setDate(current.getDate() + 4 - day);
  const yearStart = new Date(current.getFullYear(), 0, 1);
  return Math.ceil((((current - yearStart) / 86400000) + 1) / 7);
}

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

function formatShortDate(date) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}`;
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return toISO(value);
  const text = clean(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function parseContractDays(value) {
  const text = clean(value).toLowerCase();
  const dayTokens = [
    ["lun", 0],
    ["mar", 1],
    ["mer", 2],
    ["gio", 3],
    ["ven", 4],
    ["sab", 5],
    ["dom", 6]
  ];
  const explicitDays = [];
  text.replace(/lun|mar|mer|gio|ven|sab|dom/g, (token) => {
    const day = dayTokens.find(([name]) => name === token)?.[1];
    if (day !== undefined && !explicitDays.includes(day)) explicitDays.push(day);
    return token;
  });
  if (text.includes("24h") && explicitDays.length >= 3) return explicitDays.slice(0, 3);
  if (text.includes("32h") && explicitDays.length >= 4) return explicitDays.slice(0, 4);
  if (text.includes("39h") && explicitDays.length >= 5) return explicitDays;
  if (text.includes("lunedi a sabato") || text.includes("lun-sab")) return [0, 1, 2, 3, 4, 5];
  if (text.includes("lunedi a venerdi") || text.includes("lun-ven")) return [0, 1, 2, 3, 4];
  if (text.includes("sabato")) return [0, 1, 2, 3, 4, 5];
  if (explicitDays.length) return explicitDays;
  if (text.includes("24h")) return [0, 3, 4];
  if (text.includes("32h")) return [0, 1, 3, 4];
  if (text.includes("39h") && text.includes("lun")) return [0, 1, 2, 3, 4, 5];
  return [0, 1, 2, 3, 4];
}

function inferWeeklyHours(contract) {
  const text = clean(contract).toLowerCase();
  const match = text.match(/(\d{2})h/);
  if (match) return Number(match[1]);
  return 39;
}

function nextInternalId() {
  const count = state.drivers.filter((driver) => driver.id.startsWith("INT-")).length + 1;
  return `INT-${String(count).padStart(6, "0")}`;
}

function parseCsv(text) {
  const rows = [];
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  if (!lines.length) return rows;
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = splitCsvLine(lines[0], separator).map((header) => clean(header).toLowerCase());
  lines.slice(1).forEach((line) => {
    const values = splitCsvLine(line, separator);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  });
  return rows;
}

function parseWorkbook(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, cellDates: true, defval: "" });
  const headerIndex = detectHeaderRow(matrix);
  if (headerIndex < 0) return [];
  const headers = matrix[headerIndex].map(normalizeHeader);
  return matrix.slice(headerIndex + 1)
    .filter((row) => row.some((value) => clean(value)))
    .map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        if (header) item[header] = row[index] ?? "";
      });
      return item;
    });
}

function detectHeaderRow(matrix) {
  const requiredHints = ["station", "ofd_date", "routes_output", "id_driver", "nome_e_cognome", "contratto", "matricola", "data"];
  let bestIndex = -1;
  let bestScore = 0;
  matrix.slice(0, 20).forEach((row, index) => {
    const normalized = row.map(normalizeHeader);
    const score = requiredHints.reduce((sum, hint) => sum + (normalized.includes(hint) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore ? bestIndex : 0;
}

function normalizeHeader(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getField(row, names) {
  for (const name of names) {
    const normalized = normalizeHeader(name);
    if (Object.prototype.hasOwnProperty.call(row, normalized)) return row[normalized];
  }
  return "";
}

function splitCsvLine(line, separator) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim().replace(/^"|"$/g, ""));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function clean(value) {
  return String(value ?? "").trim();
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = clean(value).replace(/<[^>]*>/g, "").replace(/\s+/g, "");
  const text = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function normalizeMatricola(value) {
  const text = clean(value);
  if (!text) return "";
  const digits = text.replace(/\D/g, "");
  return digits ? digits.replace(/^0+/, "") || "0" : text;
}

function normalizeName(value) {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function isActiveEmployee(status, endDate) {
  if (status && !status.includes("attivo") && ["false", "no", "cessato", "dimesso"].some((token) => status.includes(token))) return false;
  if (!endDate) return true;
  return endDate >= toISO(new Date());
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyRow(columns) {
  return `<tr><td colspan="${columns}">Nessun dato disponibile</td></tr>`;
}

function addLog(action, date, driver, from, to) {
  state.log.push({
    timestamp: new Date().toLocaleString("it-IT"),
    user: currentUser ? `${currentUser.fullName} (${currentUser.username})` : "",
    station: state.station,
    date,
    driver,
    action,
    from,
    to
  });
}

function saveAndRender(options = {}) {
  saveState(options);
  render();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), Math.min(8000, Math.max(3200, String(message).length * 55)));
}

function download(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
