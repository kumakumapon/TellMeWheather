// Shared utilities used by multiple components.
// Loaded first in index.html so escapeHtml is defined before any component
// that calls it, instead of relying on app.js (loaded last) implicitly.

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeHtml };
}
