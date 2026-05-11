export function loadTheme() {
  const t = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", t);
}

export function setTheme(t) {
  localStorage.setItem("theme", t);
  document.documentElement.setAttribute("data-theme", t);
}