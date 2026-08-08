const API_BASE = "/api";
const authPage = document.body.dataset.authPage;
let csrfToken = "";

const $ = selector => document.querySelector(selector);

async function api(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken && !["GET", "HEAD"].includes(method) ? { "X-Admin-CSRF": csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.message || `Request failed (${response.status})`);
    error.code = payload?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return payload?.data ?? payload;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("sehatline-admin-theme", theme);
  if ($("#authThemeToggle")) $("#authThemeToggle").textContent = theme === "dark" ? "☀" : "☾";
}

function setError(selector, message = "") {
  const node = $(selector);
  if (!node) return;
  node.textContent = message;
  node.hidden = !message;
  if (message) window.SehatMotion?.shake(node);
}

function setLoading(button, loading, label) {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.classList.add("is-loading");
    button.textContent = label;
  } else {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.innerHTML = button.dataset.label || button.innerHTML;
  }
}

function loginMessage(error) {
  if (error.code === "ACCOUNT_DISABLED") return "This account has been disabled. Contact the Owner.";
  if (error.code === "TOO_MANY_ATTEMPTS") return "Too many attempts. Wait 15 minutes and try again.";
  if (error.code === "INVALID_CREDENTIALS") return "Invalid Admin ID/email or password.";
  return error.message || "Login could not be completed.";
}

function passwordChecks(value) {
  return {
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /\d/.test(value),
    special: /[^A-Za-z0-9]/.test(value)
  };
}

function updatePasswordStrength(value) {
  const checks = passwordChecks(value);
  const score = Object.values(checks).filter(Boolean).length;
  Object.entries(checks).forEach(([rule, valid]) => {
    document.querySelector(`[data-rule="${rule}"]`)?.classList.toggle("valid", valid);
  });
  if ($("#passwordStrengthBar")) {
    $("#passwordStrengthBar").style.width = `${score * 20}%`;
    $("#passwordStrengthBar").style.background = score < 3 ? "var(--coral)" : score < 5 ? "#f59e0b" : "var(--emerald)";
  }
  return score === 5;
}

function bindLogin() {
  const notice = new URLSearchParams(location.search).get("notice");
  if (notice === "password-updated") {
    $("#sessionMessage").textContent = "Password updated successfully. Log in with your new password.";
    $("#sessionMessage").hidden = false;
  }
  $("#toggleAdminPassword").addEventListener("click", () => {
    const input = $("#adminPassword");
    input.type = input.type === "password" ? "text" : "password";
    $("#toggleAdminPassword").textContent = input.type === "password" ? "Show" : "Hide";
  });
  $("#adminLoginForm").addEventListener("submit", async event => {
    event.preventDefault();
    setError("#adminLoginError");
    const formData = new FormData(event.currentTarget);
    const button = $("#adminLoginButton");
    setLoading(button, true, "Verifying access…");
    try {
      const result = await api("/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: formData.get("identifier"),
          password: formData.get("password"),
          remember: formData.get("remember") === "on"
        })
      });
      location.assign(result.mustChangePassword ? "/admin/change-password" : "/admin/dashboard#overview");
    } catch (error) {
      setError("#adminLoginError", loginMessage(error));
      setLoading(button, false);
    }
  });
  $("#adminIdentifier").focus();
}

async function bindPasswordChange() {
  try {
    const session = await api("/admin/auth/me");
    if (!session.admin.mustChangePassword) {
      location.replace("/admin/dashboard#overview");
      return;
    }
    csrfToken = session.csrfToken;
    $("#passwordChangeButton").disabled = false;
  } catch {
    location.replace("/admin/login");
    return;
  }

  $("#newAdminPassword").addEventListener("input", event => updatePasswordStrength(event.target.value));
  $("#adminPasswordChangeForm").addEventListener("submit", async event => {
    event.preventDefault();
    setError("#passwordChangeError");
    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") || "");
    if (!updatePasswordStrength(newPassword)) {
      setError("#passwordChangeError", "Use uppercase, lowercase, number, special character and at least eight characters.");
      return;
    }
    if (newPassword !== formData.get("confirmPassword")) {
      setError("#passwordChangeError", "New passwords do not match.");
      return;
    }
    const button = $("#passwordChangeButton");
    setLoading(button, true, "Securing account…");
    try {
      await api("/admin/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: formData.get("currentPassword"), newPassword })
      });
      location.replace("/admin/login?notice=password-updated");
    } catch (error) {
      setError("#passwordChangeError", error.message);
      setLoading(button, false);
    }
  });
}

async function initialize() {
  applyTheme(localStorage.getItem("sehatline-admin-theme") || "light");
  $("#authThemeToggle")?.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
  if (authPage === "login") bindLogin();
  if (authPage === "change-password") await bindPasswordChange();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/admin/sw.js").catch(() => {});
}

initialize().catch(() => {
  setError(authPage === "login" ? "#adminLoginError" : "#passwordChangeError", "This page could not initialize. Please refresh.");
});
