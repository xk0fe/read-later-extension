/**
 * @fileoverview Shared utility functions for Read Later extension
 */

/**
 * Safely gets an element by ID with null checking
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} Element or null if not found
 */
function safeGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with ID '${id}' not found`);
  }
  return element;
}

/**
 * Safely gets an input element with type checking
 * @param {string} id - Element ID
 * @returns {HTMLInputElement|null} Input element or null
 */
function safeGetInputElement(id) {
  const element = safeGetElement(id);
  return element instanceof HTMLInputElement ? element : null;
}

/**
 * Safely gets a select element with type checking
 * @param {string} id - Element ID
 * @returns {HTMLSelectElement|null} Select element or null
 */
function safeGetSelectElement(id) {
  const element = safeGetElement(id);
  return element instanceof HTMLSelectElement ? element : null;
}

/**
 * Safely gets a button element with type checking
 * @param {string} id - Element ID
 * @returns {HTMLButtonElement|null} Button element or null
 */
function safeGetButtonElement(id) {
  const element = safeGetElement(id);
  return element instanceof HTMLButtonElement ? element : null;
}

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sends a message to the extension runtime with proper error handling
 * @param {Object} message - Message to send
 * @returns {Promise<MessageResponse>} Response promise
 */
function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    if (!chrome?.runtime?.sendMessage) {
      resolve({ success: false, error: 'Chrome runtime not available' });
      return;
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { success: false, error: 'No response received' });
    });
  });
}

/**
 * Debounces a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Formats a number as a readable time string
 * @param {number} minutes - Time in minutes
 * @returns {string} Formatted time string
 */
function formatReadTime(minutes) {
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

/**
 * Formats a count with proper pluralization
 * @param {number} count - Count to format
 * @param {string} singular - Singular form
 * @param {string} plural - Plural form (optional)
 * @returns {string} Formatted count string
 */
function formatCount(count, singular, plural = null) {
  const pluralForm = plural || `${singular}s`;
  return count === 1 ? `1 ${singular}` : `${count} ${pluralForm}`;
}

/**
 * Creates a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

/**
 * Gets domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain or original URL if invalid
 */
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Validates a read later link object
 * @param {*} link - Link to validate
 * @returns {boolean} Whether the link is valid
 */
function validateLink(link) {
  return (
    link &&
    typeof link === 'object' &&
    typeof link.url === 'string' &&
    typeof link.title === 'string' &&
    typeof link.priority === 'string' &&
    ['high', 'medium', 'low'].includes(link.priority) &&
    typeof link.timeToRead === 'number' &&
    link.timeToRead > 0
  );
} 