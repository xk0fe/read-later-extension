// Popup script for Read Later extension

let allLinks = [];
let allCompletedLinks = [];
let filteredLinks = [];
let currentView = 'active'; // 'active' or 'completed'

// DOM elements
const linksList = document.getElementById('linksList');
const linkCount = document.getElementById('linkCount');
const totalTime = document.getElementById('totalTime');
const emptyState = document.getElementById('emptyState');
const addCurrentPageBtn = document.getElementById('addCurrentPage');
const priorityFilter = document.getElementById('priorityFilter');
const sortBy = document.getElementById('sortBy');
const searchInput = document.getElementById('searchInput');
const activeTab = document.getElementById('activeTab');
const completedTab = document.getElementById('completedTab');

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  loadLinks();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  addCurrentPageBtn.addEventListener('click', addCurrentPage);
  priorityFilter.addEventListener('change', applyFilters);
  sortBy.addEventListener('change', applyFilters);
  searchInput.addEventListener('input', applyFilters);
  activeTab.addEventListener('click', () => switchView('active'));
  completedTab.addEventListener('click', () => switchView('completed'));
}

// Load all links from storage
function loadLinks() {
  chrome.runtime.sendMessage({ action: 'getLinks' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      allLinks = [];
      loadCompletedLinks();
      return;
    }
    
    if (response && response.success) {
      allLinks = response.data;
    } else {
      console.error('Failed to load links:', response);
      allLinks = [];
    }
    loadCompletedLinks();
  });
}

// Load completed links from storage
function loadCompletedLinks() {
  chrome.runtime.sendMessage({ action: 'getCompletedLinks' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      allCompletedLinks = [];
      applyFilters();
      return;
    }
    
    if (response && response.success) {
      allCompletedLinks = response.data;
    } else {
      console.error('Failed to load completed links:', response);
      allCompletedLinks = [];
    }
    applyFilters();
  });
}

// Switch between active and completed views
function switchView(view) {
  currentView = view;
  
  // Update tab states
  if (view === 'active') {
    activeTab.classList.add('active');
    completedTab.classList.remove('active');
  } else {
    activeTab.classList.remove('active');
    completedTab.classList.add('active');
  }
  
  applyFilters();
}

// Apply filters and search
function applyFilters() {
  const priorityValue = priorityFilter.value;
  const searchValue = searchInput.value.toLowerCase().trim();
  const sortValue = sortBy.value;

  // Get current data set based on view
  const currentData = currentView === 'active' ? allLinks : allCompletedLinks;

  // Filter by priority
  filteredLinks = priorityValue 
    ? currentData.filter(link => link.priority === priorityValue)
    : [...currentData];

  // Filter by search term
  if (searchValue) {
    filteredLinks = filteredLinks.filter(link => 
      link.title.toLowerCase().includes(searchValue) ||
      link.url.toLowerCase().includes(searchValue) ||
      link.tags.some(tag => tag.toLowerCase().includes(searchValue))
    );
  }

  // Sort links
  filteredLinks.sort((a, b) => {
    switch (sortValue) {
      case 'priority':
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      
      case 'timeToRead':
        return a.timeToRead - b.timeToRead;
      
      case 'title':
        return a.title.localeCompare(b.title);
      
      case 'dateAdded':
      default:
        return new Date(b.dateAdded) - new Date(a.dateAdded);
    }
  });

  renderLinks();
  updateStats();
}

// Render links in the popup
function renderLinks() {
  if (filteredLinks.length === 0) {
    const currentData = currentView === 'active' ? allLinks : allCompletedLinks;
    if (currentData.length === 0) {
      linksList.style.display = 'none';
      emptyState.style.display = 'block';
      const emptyIcon = emptyState.querySelector('.empty-icon');
      const emptyTitle = emptyState.querySelector('h3');
      const emptyText = emptyState.querySelector('p');
      
      if (currentView === 'active') {
        emptyIcon.textContent = '📚';
        emptyTitle.textContent = 'No links saved yet';
        emptyText.textContent = 'Right-click on any page or link and select "Save to Read Later"';
      } else {
        emptyIcon.textContent = '✅';
        emptyTitle.textContent = 'No completed items';
        emptyText.textContent = 'Complete some links from your active list to see them here';
      }
    } else {
      linksList.innerHTML = '<div class="loading">No links match your filters</div>';
      emptyState.style.display = 'none';
    }
    return;
  }

  linksList.style.display = 'block';
  emptyState.style.display = 'none';

  linksList.innerHTML = filteredLinks.map(link => createLinkElement(link)).join('');

  // Add event listeners to action buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      deleteLink(btn.dataset.id);
    });
  });

  document.querySelectorAll('.complete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      completeLink(btn.dataset.id);
    });
  });

  document.querySelectorAll('.uncomplete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      uncompleteLink(btn.dataset.id);
    });
  });

  document.querySelectorAll('.link-title').forEach(link => {
    link.addEventListener('click', (e) => {
      chrome.tabs.create({ url: link.href });
      window.close();
    });
  });
}

// Create HTML for a single link
function createLinkElement(link) {
  const domain = new URL(link.url).hostname;
  const dateAdded = new Date(link.dateAdded).toLocaleDateString();
  
  return `
    <div class="link-item">
      <div class="link-header">
        <a href="${escapeHtml(link.url)}" class="link-title" title="${escapeHtml(link.title)}">
          ${escapeHtml(link.title)}
        </a>
        <div class="link-actions">
          ${currentView === 'active' ? `
          <button class="action-btn complete-btn" data-id="${link.id}" title="Mark as Complete">
            ✅
          </button>
          ` : `
          <button class="action-btn uncomplete-btn" data-id="${link.id}" title="Mark as Incomplete">
            ↩️
          </button>
          `}
          <button class="action-btn delete-btn" data-id="${link.id}" title="Delete">
            🗑️
          </button>
        </div>
      </div>
      
      <div class="link-meta">
        <span class="priority priority-${link.priority}">
          ${link.priority}
        </span>
        <span class="time-estimate">
          ${link.timeToRead} min
        </span>
      </div>
      
      <div class="link-url">${escapeHtml(domain)}</div>
      
      ${link.tags.length > 0 ? `
        <div class="link-tags">
          ${link.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// Update stats in header
function updateStats() {
  const count = filteredLinks.length;
  const total = filteredLinks.reduce((sum, link) => sum + link.timeToRead, 0);
  
  linkCount.textContent = count === 1 ? '1 item' : `${count} items`;
  totalTime.textContent = total === 1 ? '1 min total' : `${total} min total`;
}

// Add current page to read later
function addCurrentPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    
    // Send message to content script to show save dialog
    chrome.tabs.sendMessage(tab.id, {
      action: 'showSaveDialog',
      url: tab.url,
      title: tab.title
    }, (response) => {
      // Close popup after sending message
      window.close();
    });
  });
}

// Delete a link
function deleteLink(linkId) {
  if (!confirm('Are you sure you want to delete this link?')) {
    return;
  }

  chrome.runtime.sendMessage({ 
    action: 'deleteLink', 
    id: linkId 
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      showError('Failed to delete link');
      return;
    }
    
    if (response && response.success) {
      // Remove from local arrays
      if (currentView === 'active') {
        allLinks = allLinks.filter(link => link.id !== linkId);
      } else {
        allCompletedLinks = allCompletedLinks.filter(link => link.id !== linkId);
      }
      applyFilters();
    } else {
      showError('Failed to delete link');
    }
  });
}

// Complete a link
function completeLink(linkId) {
  chrome.runtime.sendMessage({ 
    action: 'completeLink', 
    id: linkId 
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      showError('Failed to complete link');
      return;
    }
    
    if (response && response.success) {
      // Trigger celebration animation
      triggerCelebration();
      
      // Move link from active to completed
      const linkIndex = allLinks.findIndex(link => link.id === linkId);
      if (linkIndex !== -1) {
        const completedLink = {
          ...allLinks[linkIndex],
          completedDate: new Date().toISOString()
        };
        allCompletedLinks.unshift(completedLink);
        allLinks.splice(linkIndex, 1);
        applyFilters();
      }
    } else {
      showError('Failed to complete link');
    }
  });
}

// Uncomplete a link
function uncompleteLink(linkId) {
  chrome.runtime.sendMessage({ 
    action: 'uncompleteLink', 
    id: linkId 
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      showError('Failed to uncomplete link');
      return;
    }
    
    if (response && response.success) {
      // Move link from completed to active
      const linkIndex = allCompletedLinks.findIndex(link => link.id === linkId);
      if (linkIndex !== -1) {
        const restoredLink = { ...allCompletedLinks[linkIndex] };
        delete restoredLink.completedDate;
        allLinks.unshift(restoredLink);
        allCompletedLinks.splice(linkIndex, 1);
        applyFilters();
      }
    } else {
      showError('Failed to uncomplete link');
    }
  });
}

// Show error message
function showError(message) {
  linksList.innerHTML = `<div class="loading" style="color: #dc3545;">${message}</div>`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Trigger celebration animation
async function triggerCelebration() {
  const celebrationContainer = document.getElementById('celebrationContainer');
  const emojis = ['🎉', '✨', '🌟', '🎈'];
  const animations = ['celebrateFromBottomLeft', 'celebrateFromBottomRight'];
  
  // Create 20 emojis with smooth staggered timing
  for (let i = 0; i < 20; i++) {
    // Use requestAnimationFrame for smoother timing
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    const emoji = document.createElement('div');
    emoji.className = 'celebration-emoji';
    emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    
    // Random position based on animation type
    const animationType = animations[Math.floor(Math.random() * animations.length)];
    emoji.style.animationName = animationType;
    
    // Set position based on animation type
    setEmojiPosition(emoji, animationType);
    
    // Smooth random variations
    const delay = (Math.random() * 0.3).toFixed(3);
    const duration = (2.0 + Math.random() * 1.0).toFixed(3);
    
    emoji.style.animationDelay = delay + 's';
    emoji.style.animationDuration = duration + 's';
    
    celebrationContainer.appendChild(emoji);
    
    // Clean up after animation with smooth removal
    cleanupEmoji(emoji, parseFloat(duration) * 1000 + 500);
    
    // Smooth stagger delay using requestAnimationFrame
    await smoothDelay(30 + Math.random() * 40);
  }
}

// Set emoji position based on animation type
function setEmojiPosition(emoji, animationType) {
  // Add random spread to starting positions (±25px variation)
  const randomSpread = () => (Math.random() - 0.5) * 50;
  const baseOffset = -30;
  
  switch (animationType) {
    case 'celebrateFromTopLeft':
      emoji.style.left = (baseOffset + randomSpread()) + 'px';
      emoji.style.top = (baseOffset + randomSpread()) + 'px';
      break;
    case 'celebrateFromTopRight':
      emoji.style.right = (baseOffset + randomSpread()) + 'px';
      emoji.style.top = (baseOffset + randomSpread()) + 'px';
      break;
    case 'celebrateFromBottomLeft':
      emoji.style.left = (baseOffset + randomSpread()) + 'px';
      emoji.style.bottom = (baseOffset + randomSpread()) + 'px';
      break;
    case 'celebrateFromBottomRight':
      emoji.style.right = (baseOffset + randomSpread()) + 'px';
      emoji.style.bottom = (baseOffset + randomSpread()) + 'px';
      break;
  }
  
  // Add random variations to the animation transform for varied paths
  const randomEndSpread = () => (Math.random() - 0.5) * 100;
  emoji.style.setProperty('--random-x', randomEndSpread() + 'px');
  emoji.style.setProperty('--random-y', randomEndSpread() + 'px');
}

// Smooth delay using requestAnimationFrame
function smoothDelay(ms) {
  return new Promise(resolve => {
    const start = performance.now();
    function frame() {
      if (performance.now() - start >= ms) {
        resolve();
      } else {
        requestAnimationFrame(frame);
      }
    }
    requestAnimationFrame(frame);
  });
}

// Clean up emoji with smooth timing
function cleanupEmoji(emoji, delay) {
  setTimeout(() => {
    if (emoji.parentNode) {
      emoji.style.transition = 'opacity 0.3s ease-out';
      emoji.style.opacity = '0';
      setTimeout(() => {
        if (emoji.parentNode) {
          emoji.parentNode.removeChild(emoji);
        }
      }, 300);
    }
  }, delay);
} 