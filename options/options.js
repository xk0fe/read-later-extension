/**
 * @fileoverview Options page script for Read Later extension
 */

// DOM elements - using safe getters
const elements = {
  defaultPriority: safeGetSelectElement('defaultPriority'),
  defaultTime: safeGetInputElement('defaultTime'),
  showNotifications: safeGetInputElement('showNotifications'),
  totalLinks: safeGetElement('totalLinks'),
  totalTimeDisplay: safeGetElement('totalTimeDisplay'),
  exportData: safeGetButtonElement('exportData'),
  importData: safeGetButtonElement('importData'),
  importFile: safeGetInputElement('importFile'),
  clearAllData: safeGetButtonElement('clearAllData'),
  saveSettings: safeGetButtonElement('saveSettings'),
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
    loadStats()
  ]);
  setupEventListeners();
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  if (elements.saveSettings) {
    elements.saveSettings.addEventListener('click', handleSaveSettings);
  }
  if (elements.exportData) {
    elements.exportData.addEventListener('click', handleExportData);
  }
  if (elements.importData && elements.importFile) {
    elements.importData.addEventListener('click', () => elements.importFile?.click());
  }
  if (elements.importFile) {
    elements.importFile.addEventListener('change', handleImportData);
  }
  if (elements.clearAllData) {
    elements.clearAllData.addEventListener('click', handleClearAllData);
  }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    if (!chrome?.storage?.sync?.get) {
      throw new Error('Chrome storage API not available');
    }

    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['readLaterSettings'], resolve);
    });

    const settings = result.readLaterSettings || {};
    
    if (elements.defaultPriority) {
      elements.defaultPriority.value = settings.defaultPriority || 'medium';
    }
    if (elements.defaultTime) {
      elements.defaultTime.value = (settings.defaultTime || 5).toString();
    }
    if (elements.showNotifications) {
      elements.showNotifications.checked = settings.showNotifications !== false;
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

    const activeLinks = activeResponse.success ? (activeResponse.data || []) : [];
    const completedLinks = completedResponse.success ? (completedResponse.data || []) : [];
    
    const totalLinksCount = activeLinks.length + completedLinks.length;
    const totalTimeValue = [...activeLinks, ...completedLinks].reduce((sum, link) => {
      return sum + ((link && typeof link === 'object' && typeof link.timeToRead === 'number') ? link.timeToRead : 0);
    }, 0);
    
    if (elements.totalLinks) {
      elements.totalLinks.textContent = `${totalLinksCount} (${activeLinks.length} active, ${completedLinks.length} completed)`;
    }
    if (elements.totalTimeDisplay) {
      elements.totalTimeDisplay.textContent = totalTimeValue.toString();
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
    if (elements.totalLinks) {
      elements.totalLinks.textContent = 'Error loading stats';
    }
  }
}

/**
 * Handle saving settings to storage
 */
async function handleSaveSettings() {
  try {
    if (!chrome?.storage?.sync?.set) {
      throw new Error('Chrome storage API not available');
    }

    const settings = {
      defaultPriority: elements.defaultPriority?.value || 'medium',
      defaultTime: parseInt(elements.defaultTime?.value || '5'),
      showNotifications: elements.showNotifications?.checked !== false
    };
    
    await new Promise((resolve) => {
      chrome.storage.sync.set({ readLaterSettings: settings }, resolve);
    });

    showSaveStatus('Settings saved successfully!');
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

    const activeLinks = activeResponse.success ? (activeResponse.data || []) : [];
    const completedLinks = completedResponse.success ? (completedResponse.data || []) : [];
    
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

    const existingActiveLinks = activeResponse.success ? (activeResponse.data || []) : [];
    const existingCompletedLinks = completedResponse.success ? (completedResponse.data || []) : [];
    
    const allActiveLinks = [...existingActiveLinks, ...newActiveLinks];
    const allCompletedLinks = [...existingCompletedLinks, ...newCompletedLinks];
    
    if (!chrome?.storage?.local?.set) {
      throw new Error('Chrome storage API not available');
    }

    await new Promise((resolve) => {
      chrome.storage.local.set({ 
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
      if (!chrome?.storage?.local?.remove) {
        throw new Error('Chrome storage API not available');
      }

      await new Promise((resolve) => {
        chrome.storage.local.remove(['readLaterLinks', 'completedLinks'], resolve);
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
  if (!elements.saveStatus) return;

  elements.saveStatus.textContent = message;
  elements.saveStatus.style.color = isError ? '#dc3545' : '#28a745';
  
  setTimeout(() => {
    if (elements.saveStatus) {
      elements.saveStatus.textContent = '';
    }
  }, 3000);
} 