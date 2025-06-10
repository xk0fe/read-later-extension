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
  chrome.runtime.sendMessage({ action: 'getLinks' }, (response) => {
    if (response.success) {
      const links = response.data;
      const total = links.reduce((sum, link) => sum + link.timeToRead, 0);
      
      totalLinks.textContent = links.length;
      totalTime.textContent = total;
    }
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
  chrome.runtime.sendMessage({ action: 'getLinks' }, (response) => {
    if (response.success) {
      const data = {
        links: response.data,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
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
      showSaveStatus('Data exported successfully!');
    } else {
      showSaveStatus('Failed to export data', true);
    }
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
      
      if (!data.links || !Array.isArray(data.links)) {
        throw new Error('Invalid file format');
      }
      
      // Validate and clean imported links
      const validLinks = data.links.filter(link => 
        link.url && link.title && link.priority && typeof link.timeToRead === 'number'
      ).map(link => ({
        ...link,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        dateAdded: link.dateAdded || new Date().toISOString()
      }));
      
      if (validLinks.length === 0) {
        throw new Error('No valid links found in file');
      }
      
      // Confirm import
      if (confirm(`Import ${validLinks.length} links? This will not replace your existing data.`)) {
        importLinks(validLinks);
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
function importLinks(newLinks) {
  chrome.runtime.sendMessage({ action: 'getLinks' }, (response) => {
    if (response.success) {
      const existingLinks = response.data;
      const allLinks = [...existingLinks, ...newLinks];
      
      chrome.storage.local.set({ readLaterLinks: allLinks }, () => {
        showSaveStatus(`Successfully imported ${newLinks.length} links!`);
        loadStats();
      });
    } else {
      showSaveStatus('Failed to import links', true);
    }
  });
}

// Clear all data with confirmation
function clearAllDataConfirm() {
  const confirmation = prompt(
    'This will delete ALL your saved links permanently.\n\n' +
    'Type "DELETE" to confirm:'
  );
  
  if (confirmation === 'DELETE') {
    chrome.storage.local.remove(['readLaterLinks'], () => {
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