// Options page script for Read Later extension

// DOM elements
const defaultPriority = document.getElementById('defaultPriority');
const defaultTime = document.getElementById('defaultTime');
const showNotifications = document.getElementById('showNotifications');
const totalLinks = document.getElementById('totalLinks');
const totalTime = document.getElementById('totalTime');
const exportData = document.getElementById('exportData');
const importData = document.getElementById('importData');
const importFile = document.getElementById('importFile');
const clearAllData = document.getElementById('clearAllData');
const saveSettings = document.getElementById('saveSettings');
const saveStatus = document.getElementById('saveStatus');

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadStats();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  saveSettings.addEventListener('click', saveSettingsToStorage);
  exportData.addEventListener('click', exportDataToFile);
  importData.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', importDataFromFile);
  clearAllData.addEventListener('click', clearAllDataConfirm);
}

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(['readLaterSettings'], (result) => {
    const settings = result.readLaterSettings || {};
    
    defaultPriority.value = settings.defaultPriority || 'medium';
    defaultTime.value = settings.defaultTime || 5;
    showNotifications.checked = settings.showNotifications !== false;
  });
}

// Load statistics
function loadStats() {
  Promise.all([
    new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getLinks' }, resolve);
    }),
    new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getCompletedLinks' }, resolve);
    })
  ]).then(([activeResponse, completedResponse]) => {
    const activeLinks = activeResponse.success ? activeResponse.data : [];
    const completedLinks = completedResponse.success ? completedResponse.data : [];
    
    const totalLinksCount = activeLinks.length + completedLinks.length;
    const totalTimeValue = [...activeLinks, ...completedLinks].reduce((sum, link) => sum + link.timeToRead, 0);
    
    totalLinks.textContent = `${totalLinksCount} (${activeLinks.length} active, ${completedLinks.length} completed)`;
    totalTime.textContent = totalTimeValue;
  });
}

// Save settings to storage
function saveSettingsToStorage() {
  const settings = {
    defaultPriority: defaultPriority.value,
    defaultTime: parseInt(defaultTime.value),
    showNotifications: showNotifications.checked
  };
  
  chrome.storage.sync.set({ readLaterSettings: settings }, () => {
    showSaveStatus('Settings saved successfully!');
  });
}

// Export data to JSON file
function exportDataToFile() {
  Promise.all([
    new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getLinks' }, resolve);
    }),
    new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getCompletedLinks' }, resolve);
    })
  ]).then(([activeResponse, completedResponse]) => {
    const activeLinks = activeResponse.success ? activeResponse.data : [];
    const completedLinks = completedResponse.success ? completedResponse.data : [];
    
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
  }).catch(error => {
    showSaveStatus('Failed to export data', true);
  });
}

// Import data from JSON file
function importDataFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
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
      const validateLink = (link) => 
        link.url && link.title && link.priority && typeof link.timeToRead === 'number';
      
      const cleanLink = (link) => ({
        ...link,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        dateAdded: link.dateAdded || new Date().toISOString()
      });
      
      const validActiveLinks = activeLinks.filter(validateLink).map(cleanLink);
      const validCompletedLinks = completedLinks.filter(validateLink).map(cleanLink);
      
      const totalValidLinks = validActiveLinks.length + validCompletedLinks.length;
      
      if (totalValidLinks === 0) {
        throw new Error('No valid links found in file');
      }
      
      // Confirm import
      const message = `Import ${totalValidLinks} links (${validActiveLinks.length} active, ${validCompletedLinks.length} completed)? This will not replace your existing data.`;
      if (confirm(message)) {
        importLinks(validActiveLinks, validCompletedLinks);
      }
      
    } catch (error) {
      showSaveStatus('Failed to import data: ' + error.message, true);
    }
    
    // Reset file input
    event.target.value = '';
  };
  
  reader.readAsText(file);
}

// Import links to storage
function importLinks(newActiveLinks, newCompletedLinks) {
  Promise.all([
    new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getLinks' }, resolve);
    }),
    new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getCompletedLinks' }, resolve);
    })
  ]).then(([activeResponse, completedResponse]) => {
    const existingActiveLinks = activeResponse.success ? activeResponse.data : [];
    const existingCompletedLinks = completedResponse.success ? completedResponse.data : [];
    
    const allActiveLinks = [...existingActiveLinks, ...newActiveLinks];
    const allCompletedLinks = [...existingCompletedLinks, ...newCompletedLinks];
    
    chrome.storage.local.set({ 
      readLaterLinks: allActiveLinks,
      completedLinks: allCompletedLinks
    }, () => {
      const totalImported = newActiveLinks.length + newCompletedLinks.length;
      showSaveStatus(`Successfully imported ${totalImported} links (${newActiveLinks.length} active, ${newCompletedLinks.length} completed)!`);
      loadStats();
    });
  }).catch(error => {
    showSaveStatus('Failed to import links', true);
  });
}

// Clear all data with confirmation
function clearAllDataConfirm() {
  const confirmation = prompt(
    'This will delete ALL your saved links (both active and completed) permanently.\n\n' +
    'Type "DELETE" to confirm:'
  );
  
  if (confirmation === 'DELETE') {
    chrome.storage.local.remove(['readLaterLinks', 'completedLinks'], () => {
      showSaveStatus('All data cleared successfully!');
      loadStats();
    });
  }
}

// Show save status message
function showSaveStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.style.color = isError ? '#dc3545' : '#28a745';
  
  setTimeout(() => {
    saveStatus.textContent = '';
  }, 3000);
} 