// Content script for Read Later extension

// Inject theme-aware styles
function injectThemeStyles() {
  if (document.getElementById('readLaterThemeStyles')) return;
  
  const style = document.createElement('style');
  style.id = 'readLaterThemeStyles';
  style.textContent = `
    :root {
      --rl-bg-primary: #ffffff;
      --rl-bg-overlay: rgba(0, 0, 0, 0.7);
      --rl-text-primary: #333333;
      --rl-text-secondary: #666666;
      --rl-border-color: #e1e5e9;
      --rl-accent-primary: #007bff;
      --rl-accent-hover: #0056b3;
      --rl-success-color: #28a745;
      --rl-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --rl-bg-primary: #1a1a1a;
        --rl-bg-overlay: rgba(0, 0, 0, 0.8);
        --rl-text-primary: #e0e0e0;
        --rl-text-secondary: #b0b0b0;
        --rl-border-color: #404040;
        --rl-accent-primary: #4a9eff;
        --rl-accent-hover: #66b3ff;
        --rl-success-color: #4caf50;
        --rl-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      }
    }
  `;
  document.head.appendChild(style);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showSaveDialog") {
    injectThemeStyles();
    showSaveDialog(request.url, request.title);
  }
});

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
      <input type="text" id="linkTitle" value="${escapeHtml(title)}" style="width: 100%; padding: 8px 12px; border: 2px solid var(--rl-border-color); border-radius: 6px; font-size: 14px; box-sizing: border-box; background: var(--rl-bg-primary); color: var(--rl-text-primary);">
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 6px; font-weight: 500; color: var(--rl-text-secondary);">URL:</label>
      <input type="text" id="linkUrl" value="${escapeHtml(url)}" style="width: 100%; padding: 8px 12px; border: 2px solid var(--rl-border-color); border-radius: 6px; font-size: 14px; box-sizing: border-box; background: var(--rl-bg-primary); color: var(--rl-text-primary);">
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
  
  // Add event listeners
  document.getElementById('closeDialog').onclick = removeExistingDialog;
  document.getElementById('cancelSave').onclick = removeExistingDialog;
  
  document.getElementById('confirmSave').onclick = () => {
    const linkData = {
      title: document.getElementById('linkTitle').value.trim(),
      url: document.getElementById('linkUrl').value.trim(),
      priority: document.getElementById('linkPriority').value,
      timeToRead: parseInt(document.getElementById('timeToRead').value) || 5,
      tags: document.getElementById('linkTags').value.split(',').map(tag => tag.trim()).filter(tag => tag)
    };
    
    if (!linkData.title || !linkData.url) {
      alert('Please fill in both title and URL');
      return;
    }
    
    // Send to background script to save
    chrome.runtime.sendMessage({
      action: "saveLink",
      data: linkData
    }, (response) => {
      if (response.success) {
        showSuccessMessage();
        setTimeout(removeExistingDialog, 1500);
      } else {
        alert('Failed to save link: ' + response.error);
      }
    });
  };
  
  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      removeExistingDialog();
    }
  };
  
  // Focus title input
  setTimeout(() => {
    document.getElementById('linkTitle').select();
  }, 100);
}

function removeExistingDialog() {
  const existing = document.getElementById('readLaterOverlay');
  if (existing) {
    existing.remove();
  }
}

function showSuccessMessage() {
  const dialog = document.querySelector('#readLaterOverlay > div');
  if (dialog) {
    dialog.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 48px; color: var(--rl-success-color); margin-bottom: 16px;">✓</div>
        <h3 style="margin: 0; color: var(--rl-text-primary); font-size: 18px;">Saved successfully!</h3>
      </div>
    `;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
} 