/**
 * @fileoverview Popup script for Read Later extension
 */

// Application state
/** @type {ReadLaterLink[]} */
let allLinks = [];
/** @type {ReadLaterLink[]} */
let allCompletedLinks = [];
/** @type {ReadLaterLink[]} */
let filteredLinks = [];
/** @type {'active'|'completed'} */
let currentView = 'active';

// DOM elements - using safe getters for modern design
const elements = {
  linksList: safeGetElement('linksList'),
  linkCount: safeGetElement('linkCount'),
  totalTime: safeGetElement('totalTime'),
  emptyState: safeGetElement('emptyState'),
  addCurrentPageBtn: safeGetButtonElement('addCurrentPage'),
  priorityFilter: safeGetSelectElement('priorityFilter'),
  sortBy: safeGetSelectElement('sortBy'),
  searchInput: safeGetInputElement('searchInput'),
  activeTab: safeGetButtonElement('activeTab'),
  completedTab: safeGetButtonElement('completedTab'),
  celebrationContainer: safeGetElement('celebrationContainer'),
  filterToggle: safeGetButtonElement('filterToggle'),
  filtersPanel: safeGetElement('filtersPanel')
};

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', initializePopup);

/**
 * Initialize the popup application
 */
async function initializePopup() {
  await loadAllData();
  setupEventListeners();
  applyFilters();
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Add current page button
  if (elements.addCurrentPageBtn) {
    elements.addCurrentPageBtn.addEventListener('click', handleAddCurrentPage);
  }

  // Filter and sort controls
  if (elements.priorityFilter) {
    elements.priorityFilter.addEventListener('change', applyFilters);
  }
  if (elements.sortBy) {
    elements.sortBy.addEventListener('change', applyFilters);
  }

  // Search input with debouncing
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', debounce(applyFilters, 300));
  }

  // View tabs (modern segmented control)
  if (elements.activeTab) {
    elements.activeTab.addEventListener('click', () => switchView('active'));
  }
  if (elements.completedTab) {
    elements.completedTab.addEventListener('click', () => switchView('completed'));
  }

  // Filter toggle for modern design
  if (elements.filterToggle && elements.filtersPanel) {
    elements.filterToggle.addEventListener('click', () => {
      toggleFiltersPanel(elements.filtersPanel, elements.filterToggle);
    });
  }
}

/**
 * Load all data from storage
 */
async function loadAllData() {
  try {
    const [activeResponse, completedResponse] = await Promise.all([
      sendRuntimeMessage({ action: 'getLinks' }),
      sendRuntimeMessage({ action: 'getCompletedLinks' })
    ]);

    allLinks = activeResponse.success ? activeResponse.data || [] : [];
    allCompletedLinks = completedResponse.success ? completedResponse.data || [] : [];
  } catch (error) {
    console.error('Failed to load data:', error);
    allLinks = [];
    allCompletedLinks = [];
  }
}

/**
 * Switch between active and completed views (modern segmented control)
 * @param {'active'|'completed'} view - View to switch to
 */
function switchView(view) {
  currentView = view;
  
  // Update segmented control states
  if (elements.activeTab && elements.completedTab) {
    if (view === 'active') {
      elements.activeTab.classList.add('active');
      elements.completedTab.classList.remove('active');
    } else {
      elements.activeTab.classList.remove('active');
      elements.completedTab.classList.add('active');
    }
  }
  
  applyFilters();
}

/**
 * Apply filters, search, and sorting to links
 */
function applyFilters() {
  const priorityValue = elements.priorityFilter?.value || '';
  const searchValue = elements.searchInput?.value?.toLowerCase().trim() || '';
  const sortValue = elements.sortBy?.value || 'dateAdded';

  // Get current data set based on view
  const currentData = currentView === 'active' ? allLinks : allCompletedLinks;

  // Apply filters
  filteredLinks = currentData.filter(link => {
    // Priority filter
    if (priorityValue && link.priority !== priorityValue) {
      return false;
    }

    // Search filter
    if (searchValue) {
      const searchableText = [
        link.title,
        link.url,
        ...(link.tags || [])
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchValue)) {
        return false;
      }
    }

    return true;
  });

  // Sort links
  filteredLinks.sort((a, b) => {
    switch (sortValue) {
      case 'priority':
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      
      case 'timeToRead':
        return (a.timeToRead || 0) - (b.timeToRead || 0);
      
      case 'title':
        return a.title.localeCompare(b.title);
      
      case 'dateAdded':
      default:
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    }
  });

  renderLinks();
  updateStats();
}

/**
 * Render links in the popup
 */
function renderLinks() {
  if (!elements.linksList || !elements.emptyState) return;

  if (filteredLinks.length === 0) {
    const currentData = currentView === 'active' ? allLinks : allCompletedLinks;
    if (currentData.length === 0) {
      // Show empty state
      elements.linksList.style.display = 'none';
      elements.emptyState.style.display = 'block';
      updateEmptyState(elements.emptyState, currentView);
    } else {
      // Show no matches message
      elements.linksList.style.display = 'block';
      showLoading(elements.linksList, 'No links match your filters');
      elements.emptyState.style.display = 'none';
    }
    return;
  }

  // Show links
  elements.linksList.style.display = 'block';
  elements.emptyState.style.display = 'none';

  // Generate HTML
  const linksHTML = filteredLinks
    .map(link => createLinkElementHTML(link, currentView))
    .join('');
  
  elements.linksList.innerHTML = linksHTML;

  // Attach event listeners
  attachLinkEventListeners({
    onDelete: handleDeleteLink,
    onComplete: handleCompleteLink,
    onUncomplete: handleUncompleteLink,
    onLinkClick: handleLinkClick
  });
}

/**
 * Update statistics display
 */
function updateStats() {
  if (!elements.linkCount || !elements.totalTime) return;

  updateStatsDisplay(filteredLinks, elements.linkCount, elements.totalTime);
}

/**
 * Handle adding current page to read later
 */
async function handleAddCurrentPage() {
  try {
    if (!chrome?.tabs?.query || !chrome?.tabs?.sendMessage) {
      throw new Error('Chrome tabs API not available');
    }

    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });

    const tab = tabs[0];
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    // Send message to content script to show save dialog
    chrome.tabs.sendMessage(tab.id, {
      action: 'showSaveDialog',
      url: tab.url,
      title: tab.title
    });
    
    // Close popup after sending message
    window.close();
  } catch (error) {
    console.error('Failed to add current page:', error);
    if (elements.linksList) {
      showError(elements.linksList, 'Failed to add current page');
    }
  }
}

/**
 * Handle deleting a link
 * @param {string} linkId - ID of link to delete
 */
async function handleDeleteLink(linkId) {
  if (!confirm('Delete this link?')) {
    return;
  }

  try {
    const response = await sendRuntimeMessage({ 
      action: 'deleteLink', 
      id: linkId 
    });
    
    if (response.success) {
      // Remove from local arrays
      if (currentView === 'active') {
        allLinks = allLinks.filter(link => link.id !== linkId);
      } else {
        allCompletedLinks = allCompletedLinks.filter(link => link.id !== linkId);
      }
      applyFilters();
    } else {
      throw new Error(response.error || 'Failed to delete link');
    }
  } catch (error) {
    console.error('Failed to delete link:', error);
    if (elements.linksList) {
      showError(elements.linksList, 'Failed to delete link');
    }
  }
}

/**
 * Handle completing a link
 * @param {string} linkId - ID of link to complete
 */
async function handleCompleteLink(linkId) {
  try {
    // Find and animate the specific link item before completion
    const linkElement = document.querySelector(`[data-id="${linkId}"]`)?.closest('.link-item');
    if (linkElement) {
      await animateItemCompletion(linkElement);
    }

    const response = await sendRuntimeMessage({ 
      action: 'completeLink', 
      id: linkId 
    });
    
    if (response.success) {
      // Add completed state to the item (grayed out, smaller, non-interactable)
      if (linkElement) {
        linkElement.classList.add('completed-pending');
      }
      
      // Trigger celebration animation
      await triggerCelebration();
      
      // Wait a bit to show the completed state before removing
      await new Promise(resolve => setTimeout(resolve, 800));
      
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
      throw new Error(response.error || 'Failed to complete link');
    }
  } catch (error) {
    console.error('Failed to complete link:', error);
    if (elements.linksList) {
      showError(elements.linksList, 'Failed to complete link');
    }
  }
}

/**
 * Handle uncompleting a link
 * @param {string} linkId - ID of link to uncomplete
 */
async function handleUncompleteLink(linkId) {
  try {
    const response = await sendRuntimeMessage({ 
      action: 'uncompleteLink', 
      id: linkId 
    });
    
    if (response.success) {
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
      throw new Error(response.error || 'Failed to uncomplete link');
    }
  } catch (error) {
    console.error('Failed to uncomplete link:', error);
    if (elements.linksList) {
      showError(elements.linksList, 'Failed to uncomplete link');
    }
  }
}

/**
 * Handle clicking on a link
 * @param {string} url - URL to open
 */
function handleLinkClick(url) {
  if (chrome?.tabs?.create) {
    chrome.tabs.create({ url });
    window.close();
  }
}

/**
 * Animate an individual link item when it's completed
 * @param {HTMLElement} linkElement - The link item element to animate
 */
async function animateItemCompletion(linkElement) {
  return new Promise((resolve) => {
    // Add the completing animation class
    linkElement.classList.add('completing');
    
    // Listen for animation end
    const handleAnimationEnd = () => {
      linkElement.classList.remove('completing');
      linkElement.removeEventListener('animationend', handleAnimationEnd);
      resolve();
    };
    
    linkElement.addEventListener('animationend', handleAnimationEnd);
    
    // Fallback timeout in case animation doesn't fire
    setTimeout(() => {
      if (linkElement.classList.contains('completing')) {
        linkElement.classList.remove('completing');
        linkElement.removeEventListener('animationend', handleAnimationEnd);
        resolve();
      }
    }, 700);
  });
}

/**
 * Trigger celebration animation when a link is completed
 */
async function triggerCelebration() {
  if (!elements.celebrationContainer) return;

  const emojis = ['🎉', '✨', '🌟', '🎈'];
  const animations = ['celebrateFromBottomLeft', 'celebrateFromBottomRight'];
  
  // Create 15 emojis for a more subtle celebration
  for (let i = 0; i < 15; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    const emoji = document.createElement('div');
    emoji.className = 'celebration-emoji';
    emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    
    // Random animation type
    const animationType = animations[Math.floor(Math.random() * animations.length)];
    emoji.style.animationName = animationType;
    
    // Set position based on animation type
    setEmojiPosition(emoji, animationType);
    
    // Timing variations
    const delay = (Math.random() * 0.3).toFixed(3);
    const duration = (1.5 + Math.random() * 0.5).toFixed(3);
    
    emoji.style.animationDelay = delay + 's';
    emoji.style.animationDuration = duration + 's';
    
    elements.celebrationContainer.appendChild(emoji);
    
    // Clean up after animation
    cleanupEmoji(emoji, parseFloat(duration) * 1000 + 500);
    
    // Stagger delay
    await smoothDelay(40 + Math.random() * 30);
  }
}

/**
 * Set emoji position based on animation type
 * @param {HTMLElement} emoji - Emoji element
 * @param {string} animationType - Animation type
 */
function setEmojiPosition(emoji, animationType) {
  const randomSpread = () => (Math.random() - 0.5) * 50;
  const baseOffset = -30;
  
  switch (animationType) {
    case 'celebrateFromBottomLeft':
      emoji.style.left = (baseOffset + randomSpread()) + 'px';
      emoji.style.bottom = (baseOffset + randomSpread()) + 'px';
      break;
    case 'celebrateFromBottomRight':
      emoji.style.right = (baseOffset + randomSpread()) + 'px';
      emoji.style.bottom = (baseOffset + randomSpread()) + 'px';
      break;
  }
  
  // Add random variations
  const randomEndSpread = () => (Math.random() - 0.5) * 100;
  emoji.style.setProperty('--random-x', randomEndSpread() + 'px');
  emoji.style.setProperty('--random-y', randomEndSpread() + 'px');
}

/**
 * Smooth delay using requestAnimationFrame
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>} Promise that resolves after delay
 */
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

/**
 * Clean up emoji with smooth timing
 * @param {HTMLElement} emoji - Emoji element
 * @param {number} delay - Delay before cleanup
 */
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