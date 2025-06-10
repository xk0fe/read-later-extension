/**
 * @fileoverview Options page script for Read Later extension
 */

// Chrome extension API available globally

// DOM elements - using safe getters from shared utilities
const optionsElements = {
  defaultPriority: safeGetSelectElement('defaultPriority'),
  defaultTime: safeGetInputElement('defaultTime'),
  showNotifications: safeGetInputElement('showNotifications'),
  themeMode: safeGetSelectElement('themeMode'),
  totalLinks: safeGetElement('totalLinks'),
  totalTimeDisplay: safeGetElement('totalTimeDisplay'),
  exportData: safeGetButtonElement('exportData'),
  importData: safeGetButtonElement('importData'),
  importFile: safeGetInputElement('importFile'),
  clearAllData: safeGetButtonElement('clearAllData'),
  saveStatus: safeGetElement('saveStatus')
};

// Initialize options page when DOM is ready
document.addEventListener('DOMContentLoaded', initializeOptions);

/**
 * Initialize the options page
 */
async function initializeOptions() {
  await Promise.all([
    loadSettings(),
    loadStats(),
    globalThis.loadTheme?.()
  ].filter(Boolean));
  setupEventListeners();
  if (optionsElements.themeMode && globalThis.setupThemeListener) {
    globalThis.setupThemeListener(optionsElements.themeMode);
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  if (optionsElements.exportData) {
    optionsElements.exportData.addEventListener('click', handleExportData);
  }
  if (optionsElements.importData && optionsElements.importFile) {
    optionsElements.importData.addEventListener('click', () => optionsElements.importFile?.click());
  }
  if (optionsElements.importFile) {
    optionsElements.importFile.addEventListener('change', handleImportData);
  }
  if (optionsElements.clearAllData) {
    optionsElements.clearAllData.addEventListener('click', handleClearAllData);
  }
  
  // Setup auto-save for form fields
  setupAutoSave();
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    if (!globalThis.chrome?.storage?.sync?.get) {
      throw new Error('Chrome storage API not available');
    }

    const result = await new Promise((resolve) => {
      globalThis.chrome.storage.sync.get(['readLaterSettings'], resolve);
    });

    /** @type {{readLaterSettings?: ExtensionSettings}} */
    const typedResult = /** @type {any} */ (result);
    const settings = typedResult.readLaterSettings || {};
    
    if (optionsElements.defaultPriority && settings.defaultPriority) {
      optionsElements.defaultPriority.value = settings.defaultPriority;
    }
    if (optionsElements.defaultTime && settings.defaultTime) {
      optionsElements.defaultTime.value = settings.defaultTime.toString();
    }
    if (optionsElements.showNotifications) {
      optionsElements.showNotifications.checked = settings.showNotifications !== false;
    }
    if (optionsElements.themeMode && settings.themeMode) {
      optionsElements.themeMode.value = settings.themeMode;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    showSaveStatus('Failed to load settings', true);
  }
}

/**
 * Load statistics from storage
 */
async function loadStats() {
  try {
    const [activeResponse, completedResponse] = await Promise.all([
      sendRuntimeMessage({ action: 'getLinks' }),
      sendRuntimeMessage({ action: 'getCompletedLinks' })
    ]);

    /** @type {MessageResponse} */
    const typedActiveResponse = /** @type {any} */ (activeResponse);
    /** @type {MessageResponse} */
    const typedCompletedResponse = /** @type {any} */ (completedResponse);

    const activeLinks = typedActiveResponse.success ? (typedActiveResponse.data || []) : [];
    const completedLinks = typedCompletedResponse.success ? (typedCompletedResponse.data || []) : [];
    
    const totalLinksCount = activeLinks.length + completedLinks.length;
    const totalTimeValue = [...activeLinks, ...completedLinks].reduce((sum, link) => {
      return sum + ((link && typeof link === 'object' && typeof link.timeToRead === 'number') ? link.timeToRead : 0);
    }, 0);
    
    if (optionsElements.totalLinks) {
      optionsElements.totalLinks.textContent = `${totalLinksCount} (${activeLinks.length} active, ${completedLinks.length} completed)`;
    }
    if (optionsElements.totalTimeDisplay) {
      optionsElements.totalTimeDisplay.textContent = totalTimeValue.toString();
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
    if (optionsElements.totalLinks) {
      optionsElements.totalLinks.textContent = 'Error loading stats';
    }
  }
}

/**
 * Auto-save settings to storage
 */
async function autoSaveSettings() {
  try {
    if (!globalThis.chrome?.storage?.sync?.set) {
      throw new Error('Chrome storage API not available');
    }

    const settings = {
      defaultPriority: optionsElements.defaultPriority?.value || 'medium',
      defaultTime: parseInt(optionsElements.defaultTime?.value || '5'),
      showNotifications: optionsElements.showNotifications?.checked !== false,
      themeMode: optionsElements.themeMode?.value || 'system'
    };
    
    // Cache theme in localStorage for immediate access
    localStorage.setItem('readLaterTheme', settings.themeMode);
    
    await new Promise((resolve) => {
      globalThis.chrome.storage.sync.set({ readLaterSettings: settings }, resolve);
    });

    showSaveStatus('Settings saved automatically');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showSaveStatus('Failed to save settings', true);
  }
}

/**
 * Handle exporting data to JSON file
 */
async function handleExportData() {
  try {
    const [activeResponse, completedResponse] = await Promise.all([
      sendRuntimeMessage({ action: 'getLinks' }),
      sendRuntimeMessage({ action: 'getCompletedLinks' })
    ]);

    /** @type {MessageResponse} */
    const typedActiveResponse = /** @type {any} */ (activeResponse);
    /** @type {MessageResponse} */
    const typedCompletedResponse = /** @type {any} */ (completedResponse);

    const activeLinks = typedActiveResponse.success ? (typedActiveResponse.data || []) : [];
    const completedLinks = typedCompletedResponse.success ? (typedCompletedResponse.data || []) : [];
    
    const data = {
      activeLinks: activeLinks,
      completedLinks: completedLinks,
      exportDate: new Date().toISOString(),
      version: '2.0.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `read-later-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showSaveStatus(`Data exported successfully! (${activeLinks.length} active, ${completedLinks.length} completed)`);
  } catch (error) {
    console.error('Failed to export data:', error);
    showSaveStatus('Failed to export data', true);
  }
}

/**
 * Handle importing data from JSON file
 * @param {Event} event - File input change event
 */
function handleImportData(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.files) return;

  const file = target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      if (!e.target?.result) {
        throw new Error('Failed to read file');
      }

      const data = JSON.parse(e.target.result.toString());
      let activeLinks = [];
      let completedLinks = [];
      
      // Handle different file formats
      if (data.version === '2.0.0') {
        // New format with separate active and completed lists
        activeLinks = data.activeLinks || [];
        completedLinks = data.completedLinks || [];
      } else {
        // Old format (v1.0.0) - treat all as active links
        activeLinks = data.links || [];
        completedLinks = [];
      }
      
      // Validate and clean imported links
      const validActiveLinks = activeLinks.filter(validateLink).map(cleanLink);
      const validCompletedLinks = completedLinks.filter(validateLink).map(cleanLink);
      
      const totalValidLinks = validActiveLinks.length + validCompletedLinks.length;
      
      if (totalValidLinks === 0) {
        throw new Error('No valid links found in file');
      }
      
      // Confirm import
      const message = `Import ${totalValidLinks} links (${validActiveLinks.length} active, ${validCompletedLinks.length} completed)? This will not replace your existing data.`;
      if (confirm(message)) {
        await importLinks(validActiveLinks, validCompletedLinks);
      }
      
    } catch (error) {
      console.error('Import error:', error);
      showSaveStatus('Failed to import data: ' + error.message, true);
    }
    
    // Reset file input
    target.value = '';
  };
  
  reader.readAsText(file);
}



/**
 * Clean and prepare a link for import
 * @param {*} link - Link to clean
 * @returns {ReadLaterLink} Cleaned link
 */
function cleanLink(link) {
  return {
    ...link,
    id: generateId(),
    dateAdded: link.dateAdded || new Date().toISOString(),
    tags: link.tags || []
  };
}

/**
 * Import links to storage
 * @param {ReadLaterLink[]} newActiveLinks - New active links to import
 * @param {ReadLaterLink[]} newCompletedLinks - New completed links to import
 */
async function importLinks(newActiveLinks, newCompletedLinks) {
  try {
    const [activeResponse, completedResponse] = await Promise.all([
      sendRuntimeMessage({ action: 'getLinks' }),
      sendRuntimeMessage({ action: 'getCompletedLinks' })
    ]);

    /** @type {MessageResponse} */
    const typedActiveResponse = /** @type {any} */ (activeResponse);
    /** @type {MessageResponse} */
    const typedCompletedResponse = /** @type {any} */ (completedResponse);

    const existingActiveLinks = typedActiveResponse.success ? (typedActiveResponse.data || []) : [];
    const existingCompletedLinks = typedCompletedResponse.success ? (typedCompletedResponse.data || []) : [];
    
    const allActiveLinks = [...existingActiveLinks, ...newActiveLinks];
    const allCompletedLinks = [...existingCompletedLinks, ...newCompletedLinks];
    
    if (!globalThis.chrome?.storage?.local?.set) {
      throw new Error('Chrome storage API not available');
    }

    await new Promise((resolve) => {
      globalThis.chrome.storage.local.set({ 
        readLaterLinks: allActiveLinks,
        completedLinks: allCompletedLinks
      }, resolve);
    });

    const totalImported = newActiveLinks.length + newCompletedLinks.length;
    showSaveStatus(`Successfully imported ${totalImported} links (${newActiveLinks.length} active, ${newCompletedLinks.length} completed)!`);
    await loadStats();
  } catch (error) {
    console.error('Failed to import links:', error);
    showSaveStatus('Failed to import links', true);
  }
}

/**
 * Handle clearing all data with confirmation
 */
async function handleClearAllData() {
  try {
    const confirmation = prompt(
      'This will delete ALL your saved links (both active and completed) permanently.\n\n' +
      'Type "DELETE" to confirm:'
    );
    
    if (confirmation === 'DELETE') {
      if (!globalThis.chrome?.storage?.local?.remove) {
        throw new Error('Chrome storage API not available');
      }

      await new Promise((resolve) => {
        globalThis.chrome.storage.local.remove(['readLaterLinks', 'completedLinks'], resolve);
      });

      showSaveStatus('All data cleared successfully!');
      await loadStats();
    }
  } catch (error) {
    console.error('Failed to clear data:', error);
    showSaveStatus('Failed to clear data', true);
  }
}

/**
 * Show save status message
 * @param {string} message - Message to display
 * @param {boolean} isError - Whether this is an error message
 */
function showSaveStatus(message, isError = false) {
  if (!optionsElements.saveStatus) return;

  optionsElements.saveStatus.textContent = message;
  optionsElements.saveStatus.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
  optionsElements.saveStatus.style.opacity = '1';
  
  // For auto-save messages, fade out faster
  const timeout = message.includes('automatically') ? 2000 : 3000;
  
  setTimeout(() => {
    if (optionsElements.saveStatus) {
      optionsElements.saveStatus.style.opacity = '0';
      setTimeout(() => {
        if (optionsElements.saveStatus) {
          optionsElements.saveStatus.textContent = '';
        }
      }, 300);
    }
  }, timeout);
}

/**
 * Setup auto-save for form fields
 */
function setupAutoSave() {
  // Add change listeners to all form fields
  const formFields = [
    optionsElements.defaultPriority,
    optionsElements.defaultTime,
    optionsElements.showNotifications,
    optionsElements.themeMode
  ];

  // Debounced auto-save function to avoid excessive saves
  const debouncedAutoSave = debounce(autoSaveSettings, 500);

  formFields.forEach(field => {
    if (field) {
      // For immediate changes (select, checkbox)
      field.addEventListener('change', autoSaveSettings);
      // For text/number inputs, use debounced save while typing
      if (field.type === 'text' || field.type === 'number') {
        field.addEventListener('input', debouncedAutoSave);
      }
    }
  });
} 