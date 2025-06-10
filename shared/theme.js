/**
 * @fileoverview Theme management utilities for Read Later extension
 */

/**
 * Available theme modes
 * @type {Object<string, string>}
 */
const THEME_MODES = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark'
};

/**
 * Load theme preference from storage and apply it
 */
async function loadTheme() {
  try {
    // First check localStorage for immediate access
    const cachedTheme = localStorage.getItem('readLaterTheme');
    if (cachedTheme) {
      applyTheme(cachedTheme);
    }
    
    if (!globalThis.chrome?.storage?.sync?.get) {
      console.log('Chrome storage API not available, using cached or system theme');
      if (!cachedTheme) applySystemTheme();
      return;
    }

    const result = await new Promise((resolve) => {
      globalThis.chrome.storage.sync.get(['readLaterSettings'], resolve);
    });

    const settings = result.readLaterSettings || {};
    const themeMode = settings.themeMode || THEME_MODES.SYSTEM;
    
    // Update localStorage cache
    localStorage.setItem('readLaterTheme', themeMode);
    
    // Apply theme (may update from cached version)
    applyTheme(themeMode);
  } catch (error) {
    console.error('Failed to load theme:', error);
    const cachedTheme = localStorage.getItem('readLaterTheme');
    if (cachedTheme) {
      applyTheme(cachedTheme);
    } else {
      applySystemTheme();
    }
  }
}

/**
 * Apply theme to the current page
 * @param {string} themeMode - Theme mode: 'system', 'light', or 'dark'
 */
function applyTheme(themeMode) {
  if (!document.documentElement) return;

  switch (themeMode) {
    case THEME_MODES.LIGHT:
      document.documentElement.setAttribute('data-theme', 'light');
      break;
    case THEME_MODES.DARK:
      document.documentElement.setAttribute('data-theme', 'dark');
      break;
    case THEME_MODES.SYSTEM:
    default:
      // Remove data-theme attribute to use CSS prefers-color-scheme
      document.documentElement.removeAttribute('data-theme');
      break;
  }
}

/**
 * Apply system theme (fallback)
 */
function applySystemTheme() {
  if (document.documentElement) {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * Setup theme change listener for theme selector
 * @param {HTMLSelectElement} themeSelector - Theme selector element
 */
function setupThemeListener(themeSelector) {
  if (!themeSelector) return;

  themeSelector.addEventListener('change', (event) => {
    const target = event.target;
    if (target && target.value) {
      applyTheme(target.value);
      // Theme will be saved when settings are saved
    }
  });
}

/**
 * Get current theme mode from storage
 * @returns {Promise<string>} Current theme mode
 */
async function getCurrentTheme() {
  try {
    if (!globalThis.chrome?.storage?.sync?.get) {
      return THEME_MODES.SYSTEM;
    }

    const result = await new Promise((resolve) => {
      globalThis.chrome.storage.sync.get(['readLaterSettings'], resolve);
    });

    const settings = result.readLaterSettings || {};
    return settings.themeMode || THEME_MODES.SYSTEM;
  } catch (error) {
    console.error('Failed to get current theme:', error);
    return THEME_MODES.SYSTEM;
  }
}

// Make functions available globally
if (typeof globalThis !== 'undefined') {
  globalThis.loadTheme = loadTheme;
  globalThis.applyTheme = applyTheme;
  globalThis.setupThemeListener = setupThemeListener;
  globalThis.getCurrentTheme = getCurrentTheme;
  globalThis.THEME_MODES = THEME_MODES;
} 