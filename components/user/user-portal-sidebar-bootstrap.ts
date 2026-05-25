/** Runs before paint to avoid sidebar width flash on user portal pages. */
export const userPortalSidebarBootstrapScript = String.raw`
(function () {
  try {
    if (localStorage.getItem('user-sidebar-collapsed') === '1') {
      document.documentElement.classList.add('user-sidebar-collapsed');
    }
  } catch (e) {}
})();
`;
