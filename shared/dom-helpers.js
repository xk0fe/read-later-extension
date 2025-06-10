/**
 * @fileoverview DOM helper functions for Read Later extension
 */

/**
 * Creates the HTML structure for a single link item
 * @param {ReadLaterLink} link - Link data
 * @param {'active'|'completed'} viewType - Current view type
 * @returns {string} HTML string for the link
 */
function createLinkElementHTML(link, viewType) {
  const domain = getDomain(link.url);
  const dateAdded = new Date(link.dateAdded).toLocaleDateString();
  
  return `
    <div class="link-item">
      <div class="link-header">
        <a href="${escapeHtml(link.url)}" class="link-title" title="${escapeHtml(link.title)}">
          ${escapeHtml(link.title)}
        </a>
        <div class="link-actions">
          ${viewType === 'active' ? `
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
          ${formatReadTime(link.timeToRead)}
        </span>
      </div>
      
      <div class="link-url">${escapeHtml(domain)}</div>
      
      ${link.tags && link.tags.length > 0 ? `
        <div class="link-tags">
          ${link.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Updates the empty state display
 * @param {HTMLElement} emptyState - Empty state container
 * @param {'active'|'completed'} viewType - Current view type
 */
function updateEmptyState(emptyState, viewType) {
  if (!emptyState) return;

  const emptyIcon = emptyState.querySelector('.empty-icon');
  const emptyTitle = emptyState.querySelector('h3');
  const emptyText = emptyState.querySelector('p');
  
  if (!emptyIcon || !emptyTitle || !emptyText) return;

  if (viewType === 'active') {
    emptyIcon.textContent = '📚';
    emptyTitle.textContent = 'No links saved yet';
    emptyText.textContent = 'Right-click on any page or link and select "Save to Read Later"';
  } else {
    emptyIcon.textContent = '✅';
    emptyTitle.textContent = 'No completed items';
    emptyText.textContent = 'Complete some links from your active list to see them here';
  }
}

/**
 * Updates statistics display
 * @param {ReadLaterLink[]} links - Array of links to calculate stats from
 * @param {HTMLElement} countElement - Element to display count
 * @param {HTMLElement} timeElement - Element to display total time
 */
function updateStatsDisplay(links, countElement, timeElement) {
  if (!countElement || !timeElement) return;

  const count = links.length;
  const totalTime = links.reduce((sum, link) => sum + (link.timeToRead || 0), 0);
  
  countElement.textContent = formatCount(count, 'item');
  timeElement.textContent = `${totalTime} min total`;
}

/**
 * Shows an error message in the specified container
 * @param {HTMLElement} container - Container element
 * @param {string} message - Error message to display
 */
function showError(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="loading" style="color: #dc3545;">${escapeHtml(message)}</div>`;
}

/**
 * Shows a loading state in the specified container
 * @param {HTMLElement} container - Container element
 * @param {string} message - Loading message to display
 */
function showLoading(container, message = 'Loading...') {
  if (!container) return;
  container.innerHTML = `<div class="loading">${escapeHtml(message)}</div>`;
}

/**
 * Attaches event listeners to action buttons in the links list
 * @param {Object} handlers - Object containing event handler functions
 * @param {Function} handlers.onDelete - Delete button click handler
 * @param {Function} handlers.onComplete - Complete button click handler  
 * @param {Function} handlers.onUncomplete - Uncomplete button click handler
 * @param {Function} handlers.onLinkClick - Link title click handler
 */
function attachLinkEventListeners(handlers) {
  // Delete buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (btn instanceof HTMLElement && btn.dataset.id) {
        handlers.onDelete?.(btn.dataset.id);
      }
    });
  });

  // Complete buttons
  document.querySelectorAll('.complete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (btn instanceof HTMLElement && btn.dataset.id) {
        handlers.onComplete?.(btn.dataset.id);
      }
    });
  });

  // Uncomplete buttons
  document.querySelectorAll('.uncomplete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (btn instanceof HTMLElement && btn.dataset.id) {
        handlers.onUncomplete?.(btn.dataset.id);
      }
    });
  });

  // Link titles
  document.querySelectorAll('.link-title').forEach(link => {
    link.addEventListener('click', (e) => {
      if (link instanceof HTMLAnchorElement && link.href) {
        handlers.onLinkClick?.(link.href);
      }
    });
  });
} 