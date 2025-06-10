// Content script for Read Later extension

// Load theme utility
async function loadThemeUtility() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = globalThis.chrome?.runtime?.getURL('shared/theme.js');
    script.onload = resolve;
    script.onerror = resolve; // Continue even if theme fails to load
    document.head.appendChild(script);
  });
}

// Inject modern styles from CSS file
function injectModernStyles() {
  if (document.getElementById('readLaterModernStyles')) return;
  
  // Inject the CSS file
  const link = document.createElement('link');
  link.id = 'readLaterModernStyles';
  link.rel = 'stylesheet';
  link.href = globalThis.chrome?.runtime?.getURL('content/content.css');
  document.head.appendChild(link);
}

// Listen for messages from background script
if (globalThis.chrome?.runtime?.onMessage) {
  globalThis.chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "showSaveDialog") {
      try {
        await loadThemeUtility();
        injectModernStyles();
        // Load theme after utilities are available with fallback
        if (globalThis.loadTheme) {
          try {
            await globalThis.loadTheme();
          } catch (themeError) {
            console.log('Theme loading failed, continuing with default styles:', themeError);
          }
        }
        showSaveDialog(request.url, request.title);
      } catch (error) {
        console.error('Content script error:', error);
        // Show dialog anyway, even if theme loading fails
        showSaveDialog(request.url, request.title);
      }
    }
  });
}

// Create and show save dialog
function showSaveDialog(url, title) {
  // Remove existing dialog if any
  removeExistingDialog();
  
  // Create dialog overlay
  const overlay = document.createElement('div');
  overlay.id = 'readLaterOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--rl-bg-overlay);
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Create dialog box
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--rl-bg-primary);
    color: var(--rl-text-primary);
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    box-shadow: var(--rl-shadow);
    position: relative;
  `;
  
  dialog.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
      <h3 style="margin: 0; color: var(--rl-text-primary); font-size: 18px;">Save to Read Later</h3>
      <button id="closeDialog" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--rl-text-secondary); padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">&times;</button>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--rl-text-secondary);">Title:</label>
      <input type="text" id="linkTitle" value="${escapeDialogHtml(title)}" style="width: 100%; padding: 8px 12px; border: 2px solid var(--rl-border-color); border-radius: 6px; font-size: 14px; box-sizing: border-box; background: var(--rl-bg-primary); color: var(--rl-text-primary);">
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--rl-text-secondary);">URL:</label>
      <input type="text" id="linkUrl" value="${escapeDialogHtml(url)}" style="width: 100%; padding: 8px 12px; border: 2px solid var(--rl-border-color); border-radius: 6px; font-size: 14px; box-sizing: border-box; background: var(--rl-bg-primary); color: var(--rl-text-primary);">
    </div>
    
    <div style="display: flex; gap: 16px; margin-bottom: 16px;">
      <div style="flex: 1;">
        <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--rl-text-secondary);">Priority:</label>
        <select id="linkPriority" style="width: 100%; padding: 8px 12px; border: 2px solid var(--rl-border-color); border-radius: 6px; font-size: 14px; background: var(--rl-bg-primary); color: var(--rl-text-primary);">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      
      <div style="flex: 1;">
        <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--rl-text-secondary);">Time (minutes):</label>
        <input type="number" id="timeToRead" value="5" min="1" max="300" style="width: 100%; padding: 8px 12px; border: 2px solid var(--rl-border-color); border-radius: 6px; font-size: 14px; box-sizing: border-box; background: var(--rl-bg-primary); color: var(--rl-text-primary);">
      </div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--rl-text-secondary);">Tags (optional):</label>
      <input type="text" id="linkTags" placeholder="e.g., tech, article, tutorial" style="width: 100%; padding: 8px 12px; border: 2px solid var(--rl-border-color); border-radius: 6px; font-size: 14px; box-sizing: border-box; background: var(--rl-bg-primary); color: var(--rl-text-primary);">
    </div>
    
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button id="cancelSave" style="padding: 10px 20px; border: 2px solid var(--rl-border-color); background: var(--rl-bg-primary); color: var(--rl-text-secondary); border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
      <button id="confirmSave" style="padding: 10px 20px; border: none; background: var(--rl-accent-primary); color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">Save Link</button>
    </div>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  // Prevent page scroll when dialog is open
  document.body.classList.add('read-later-dialog-open');
  
  // Add event listeners with null safety
  const closeButton = document.getElementById('closeDialog');
  const cancelButton = document.getElementById('cancelSave');
  const confirmButton = document.getElementById('confirmSave');
  
  if (closeButton) {
    closeButton.onclick = removeExistingDialog;
  }
  if (cancelButton) {
    cancelButton.onclick = removeExistingDialog;
  }
  
  if (confirmButton) {
    confirmButton.onclick = () => {
      const titleElement = document.getElementById('linkTitle');
      const urlElement = document.getElementById('linkUrl');
      const priorityElement = document.getElementById('linkPriority');
      const timeElement = document.getElementById('timeToRead');
      const tagsElement = document.getElementById('linkTags');
      
      if (!titleElement || !urlElement || !priorityElement || !timeElement || !tagsElement) {
        alert('Dialog elements not found');
        return;
      }
      
      const linkData = {
        title: titleElement.value.trim(),
        url: urlElement.value.trim(),
        priority: priorityElement.value,
        timeToRead: parseInt(timeElement.value) || 5,
        tags: tagsElement.value.split(',').map(tag => tag.trim()).filter(tag => tag)
      };
      
      if (!linkData.title || !linkData.url) {
        alert('Please fill in both title and URL');
        return;
      }
      
      // Send to background script to save
      if (globalThis.chrome?.runtime?.sendMessage) {
        globalThis.chrome.runtime.sendMessage({
          action: "saveLink",
          data: linkData
        }, (response) => {
          if (globalThis.chrome?.runtime?.lastError) {
            console.error('Runtime error:', globalThis.chrome.runtime.lastError);
            alert('Failed to save link: ' + globalThis.chrome.runtime.lastError.message);
            return;
          }
          
          if (response?.success) {
            showSuccessMessage();
            setTimeout(removeExistingDialog, 1500);
          } else {
            alert('Failed to save link: ' + (response?.error || 'Unknown error'));
          }
        });
      } else {
        alert('Chrome extension API not available');
      }
    };
  }
  
  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      removeExistingDialog();
    }
  };
  
  // Focus title input with null safety
  setTimeout(() => {
    const titleInput = document.getElementById('linkTitle');
    if (titleInput) {
      titleInput.select();
    }
  }, 100);
}

function removeExistingDialog() {
  const existing = document.getElementById('readLaterOverlay');
  if (existing) {
    existing.remove();
  }
  
  // Re-enable page scroll
  document.body.classList.remove('read-later-dialog-open');
}

function showSuccessMessage() {
  const overlay = document.getElementById('readLaterOverlay');
  const dialog = overlay?.querySelector('div');
  if (dialog) {
    dialog.innerHTML = `
      <div class="success-state">
        <div class="success-icon">✓</div>
        <h3 class="success-title">Saved successfully!</h3>
      </div>
    `;
  }
}

function escapeDialogHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
} 