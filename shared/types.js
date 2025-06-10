/**
 * @fileoverview Type definitions and interfaces for Read Later extension
 */

/**
 * @typedef {Object} ReadLaterLink
 * @property {string} id - Unique identifier
 * @property {string} url - Link URL
 * @property {string} title - Link title
 * @property {'high'|'medium'|'low'} priority - Priority level
 * @property {number} timeToRead - Estimated read time in minutes
 * @property {string[]} tags - Associated tags
 * @property {string} dateAdded - ISO date string when link was added
 * @property {string} [completedDate] - ISO date string when link was completed
 */

/**
 * @typedef {Object} ExtensionSettings
 * @property {'high'|'medium'|'low'} defaultPriority - Default priority for new links
 * @property {number} defaultTime - Default time estimate in minutes
 * @property {boolean} showNotifications - Whether to show notifications
 * @property {'system'|'light'|'dark'} themeMode - Theme preference
 */

/**
 * @typedef {Object} MessageResponse
 * @property {boolean} success - Whether the operation was successful
 * @property {*} [data] - Response data
 * @property {string} [error] - Error message if operation failed
 */

/**
 * @typedef {Object} ViewState
 * @property {'active'|'completed'} currentView - Current view mode
 * @property {ReadLaterLink[]} filteredLinks - Currently filtered links
 * @property {string} searchTerm - Current search term
 * @property {string} priorityFilter - Current priority filter
 * @property {string} sortBy - Current sort criteria
 */

// Export for modules that support it
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
} 