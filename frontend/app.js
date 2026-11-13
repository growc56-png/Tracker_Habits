/*
 * Habits Tracker frontend.
 * Configure API_BASE to point to your backend.
 * Expected auth response: { accessToken, user: { id, name, email } }
 * Prefer an HttpOnly cookie in production; token storage below is a simple
 * integration fallback for a school project.
 */
const API_BASE = "http://localhost:8000/api";
const TOKEN_KEY = "habitflow_access_token";
const USER_KEY = "habitflow_user";

const $ = (selector) => document.querySelector(selector);
const state = { authMode: "login", habits: [], user: null, toastTimer: null };

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function formatDate(value) {
  if (!value) return "Без даты";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(year, month - 1, day));
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  state.user = user || null;
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  state.user = null;
  state.habits = [];
}
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = { message: raw }; }
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login" && path !== "/auth/register") {
      clearSession();
      showAuth();
    }
    throw new Error(data?.message || data?.error || `Ошибка сервера (${response.status})`);
  }
  return data;
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
function showAuth() {
  $("#auth-screen").classList.remove("hidden");
  $("#app-screen").classList.add("hidden");
}
function showApp() {
  $("#auth-screen").classList.add("hidden");
  $("#app-screen").classList.remove("hidden");
  const name = state.user?.name || state.user?.email?.split("@")[0] || "друг";
  $("#user-name").textContent = name;
  $("#welcome-name").textContent = name;
  $("#user-avatar").textContent = name.charAt(0).toUpperCase();
  renderHabits();
}
function setAuthMode(mode) {
  state.authMode = mode;
  const register = mode === "register";
  document.querySelectorAll("[data-auth-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.authTab === mode));
  $("#auth-title").textContent = register ? "Создай аккаунт" : "С возвращением!";
  $("#auth-subtitle").textContent = register ? "Заполни данные — и начнём формировать привычки." : "Войди в аккаунт, чтобы продолжить свой путь.";
  $("#auth-submit").innerHTML = register ? 'Зарегистрироваться <span>→</span>' : 'Войти <span>→</span>';
  $("#name-field").classList.toggle("hidden", !register);
  $("#auth-password").autocomplete = register ? "new-password" : "current-password";
  $("#auth-error").textContent = "";
}
async function handleAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = { email: form.get("email").trim(), password: form.get("password") };
  if (state.authMode === "register") payload.name = form.get("name").trim();
  const button = $("#auth-submit");
  button.disabled = true;
  button.textContent = "Подождите…";
  $("#auth-error").textContent = "";
  try {
    const result = await api(state.authMode === "register" ? "/auth/register" : "/auth/login", {
      method: "POST", body: JSON.stringify(payload)
    });
    const token = result?.accessToken || result?.access_token || result?.token;
    const user = result?.user || { name: payload.name || payload.email.split("@")[0], email: payload.email };
    if (!token && !result?.user) throw new Error("Backend должен вернуть accessToken и user. Проверь контракт API.");
    setSession(token, user);
    showApp();
    await loadHabits();
    showToast(state.authMode === "register" ? "Аккаунт создан. Добро пожаловать!" : "С возвращением!");
  } catch (error) {
    $("#auth-error").textContent = error.message || "Не удалось выполнить вход.";
  } finally {
    button.disabled = false;
    button.innerHTML = state.authMode === "register" ? 'Зарегистрироваться <span>→</span>' : 'Войти <span>→</span>';
  }
}
function normalizeHabit(habit) {
  return {
    id: habit.id,
    title: habit.title ?? habit.name ?? "Привычка",
    dueDate: String(habit.dueDate ?? habit.due_date ?? "").slice(0, 10),
    completed: Boolean(habit.completed ?? habit.isCompleted ?? habit.is_completed),
    completedAt: habit.completedAt ?? habit.completed_at ?? null
  };
}
async function loadHabits() {
  try {
    const result = await api("/habits");
    state.habits = (Array.isArray(result) ? result : result?.habits || []).map(normalizeHabit);
    renderHabits();
  } catch (error) {
    showToast(error.message || "Не удалось загрузить привычки");
  }
}
function renderCard(habit) {
  const overdue = !habit.completed && habit.dueDate && habit.dueDate < localDate();
  const dueToday = habit.dueDate === localDate();
  const meta = habit.completed
    ? `<span class="completed-time">✓ Выполнено</span>`
    : `<div class="habit-meta"><span class="${overdue ? "late" : dueToday ? "today" : ""}">${overdue ? "Просрочено" : dueToday ? "Сегодня" : "Срок"}</span><span>${escapeHTML(formatDate(habit.dueDate))}</span></div>`;
  return `<article class="habit-card ${overdue ? "is-late" : ""}">
    <input class="habit-check" type="checkbox" data-complete-id="${escapeHTML(habit.id)}" ${habit.completed ? "checked" : ""} aria-label="Отметить «${escapeHTML(habit.title)}» как выполненную">
    <div class="habit-info"><strong>${escapeHTML(habit.title)}</strong>${meta}</div>
    <button class="habit-delete" type="button" data-delete-id="${escapeHTML(habit.id)}" aria-label="Удалить привычку" title="Удалить">×</button>
  </article>`;
}
function renderHabits() {
  const pending = state.habits.filter((habit) => !habit.completed);
  const completed = state.habits.filter((habit) => habit.completed);
  $("#pending-list").innerHTML = pending.map(renderCard).join("");
  $("#completed-list").innerHTML = completed.map(renderCard).join("");
  $("#pending-empty").classList.toggle("hidden", pending.length > 0);
  $("#completed-empty").classList.toggle("hidden", completed.length > 0);
  $("#pending-count").textContent = pending.length;
  $("#completed-count").textContent = completed.length;
  $("#stat-total").textContent = state.habits.length;
  $("#stat-done").textContent = completed.length;
  $("#stat-pending").textContent = pending.length;
  const percent = state.habits.length ? Math.round(completed.length / state.habits.length * 100) : 0;
  $("#stat-progress").textContent = `${percent}%`;
  $("#stat-progress-bar").style.width = `${percent}%`;
  $("#stat-done-note").textContent = state.habits.length ? `Из ${state.habits.length} привычек` : "Добавь первую привычку";
}
function openModal() {
  $("#habit-form").reset();
  $("#habit-date").value = localDate();
  $("#habit-date").min = localDate();
  $("#habit-error").textContent = "";
  $("#habit-modal").classList.remove("hidden");
  $("#habit-title").focus();
}
function closeModal() { $("#habit-modal").classList.add("hidden"); }
async function createHabit(event) {
  event.preventDefault();
  const payload = { title: $("#habit-title").value.trim(), dueDate: $("#habit-date").value };
  if (!payload.title || !payload.dueDate) return;
  const button = $("#save-habit");
  button.disabled = true;
  try {
    const result = await api("/habits", { method: "POST", body: JSON.stringify(payload) });
    const habit = result?.habit || result;
    if (habit?.id) state.habits.unshift(normalizeHabit(habit));
    else await loadHabits();
    closeModal();
    renderHabits();
    showToast("Привычка добавлена!");
  } catch (error) {
    $("#habit-error").textContent = error.message || "Не удалось добавить привычку.";
  } finally { button.disabled = false; }
}
async function toggleHabit(id, completed) {
  const previous = state.habits.find((habit) => String(habit.id) === String(id));
  if (!previous) return;
  const oldValue = previous.completed;
  previous.completed = completed;
  renderHabits();
  try {
    await api(`/habits/${encodeURIComponent(id)}/complete`, {
      method: "PATCH", body: JSON.stringify({ completed })
    });
    showToast(completed ? "Отлично! Привычка выполнена ✓" : "Отметка отменена");
  } catch (error) {
    previous.completed = oldValue;
    renderHabits();
    showToast(error.message || "Не удалось обновить привычку");
  }
}
async function deleteHabit(id) {
  if (!confirm("Удалить эту привычку?")) return;
  try {
    await api(`/habits/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.habits = state.habits.filter((habit) => String(habit.id) !== String(id));
    renderHabits();
    showToast("Привычка удалена");
  } catch (error) { showToast(error.message || "Не удалось удалить привычку"); }
}
async function logout() {
  try { await api("/auth/logout", { method: "POST" }); } catch { /* Local logout still works. */ }
  clearSession();
  showAuth();
  showToast("Ты вышел из аккаунта");
}
function initDates() {
  const now = new Date();
  $("#today-label").textContent = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(now).toUpperCase();
  $("#current-date-chip").textContent = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(now);
  $("#preview-date").textContent = "СЕГОДНЯ";
}
function init() {
  initDates();
  document.querySelectorAll("[data-auth-tab]").forEach((tab) => tab.addEventListener("click", () => setAuthMode(tab.dataset.authTab)));
  $("#auth-form").addEventListener("submit", handleAuth);
  $("#open-add-modal").addEventListener("click", openModal);
  $("#close-modal").addEventListener("click", closeModal);
  $("#cancel-modal").addEventListener("click", closeModal);
  $("#habit-modal").addEventListener("click", (event) => { if (event.target === $("#habit-modal")) closeModal(); });
  $("#habit-form").addEventListener("submit", createHabit);
  $("#logout-button").addEventListener("click", logout);
  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-complete-id]")) toggleHabit(event.target.dataset.completeId, event.target.checked);
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-id]");
    if (button) deleteHabit(button.dataset.deleteId);
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
  try { state.user = JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { state.user = null; }
  if (getToken()) {
    showApp();
    loadHabits();
  } else showAuth();
}
document.addEventListener("DOMContentLoaded", init);