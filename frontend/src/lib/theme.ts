export const setThemeClass = (isDark: boolean) => {
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
};
