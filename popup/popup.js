// Popup script for Read Later extension

let allLinks = [];
let filteredLinks = [];

// DOM elements
const linksList = document.getElementById('linksList');
const linkCount = document.getElementById('linkCount');
const totalTime = document.getElementById('totalTime');
const emptyState = document.getElementById('emptyState');
const addCurrentPageBtn = document.getElementById('addCurrentPage');
const priorityFilter = document.getElementById('priorityFilter');
const sortBy = document.getElementById('sortBy');
const searchInput = document.getElementById('searchInput');

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
}

// Load all links from storage
function loadLinks() {
  chrome.runtime.sendMessage({ action: 'getLinks' }, (response) => {
    if (response.success) {
      allLinks = response.data;
      applyFilters();
    } else {
      showError('Failed to load links');
    }
  });
}

// Apply filters and search
function applyFilters() {
  const priorityValue = priorityFilter.value;
  const searchValue = searchInput.value.toLowerCase().trim();
  const sortValue = sortBy.value;

  // Filter by priority
  filteredLinks = priorityValue 
    ? allLinks.filter(link => link.priority === priorityValue)
    : [...allLinks];

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
    if (allLinks.length === 0) {
      linksList.style.display = 'none';
      emptyState.style.display = 'block';
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
    if (response.success) {
      // Remove from local arrays
      allLinks = allLinks.filter(link => link.id !== linkId);
      applyFilters();
    } else {
      showError('Failed to delete link');
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