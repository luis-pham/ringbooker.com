/** Runs before paint to avoid sidebar/theme flash on admin pages. */
export const adminShellBootstrapScript = String.raw`
(function () {
  try {
    var root = document.documentElement;
    if (localStorage.getItem('admin-sidebar-collapsed') === '1') {
      root.classList.add('sidebar-collapsed');
    }
    if (localStorage.getItem('admin-theme') === 'light') {
      root.classList.add('admin-theme-light');
    }
  } catch (e) {}
})();
`;
