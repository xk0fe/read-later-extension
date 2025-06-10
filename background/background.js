// Background script for Read Later extension

// Create context menu when extension is installed
if (globalThis.chrome?.runtime?.onInstalled) {
  globalThis.chrome.runtime.onInstalled.addListener(() => {
    if (globalThis.chrome?.contextMenus?.create) {
      globalThis.chrome.contextMenus.create({
        id: "saveToReadLater",
        title: "Save to Read Later",
        contexts: ["page", "link"]
      });
    }
    
    // Auto-cleanup completed links on install/update
    cleanupCompletedLinks();
  });
}

// Handle context menu clicks
if (globalThis.chrome?.contextMenus?.onClicked) {
  globalThis.chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "saveToReadLater" && tab?.id) {
      const url = info.linkUrl || tab.url;
      const title = info.linkText || tab.title;
      
      // Send message to content script to show the save dialog
      if (globalThis.chrome?.tabs?.sendMessage) {
        globalThis.chrome.tabs.sendMessage(tab.id, {
          action: "showSaveDialog",
          url: url,
          title: title
        });
      }
    }
  });
}

// Handle messages from content script and popup
if (globalThis.chrome?.runtime?.onMessage) {
  globalThis.chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case "saveLink":
        saveLink(request.data).then(result => {
          sendResponse({ success: true, data: result });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true; // Keep message channel open for async response
        
      case "getLinks":
        getLinks().then(links => {
          sendResponse({ success: true, data: links });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
        
      case "getCompletedLinks":
        getCompletedLinks().then(links => {
          sendResponse({ success: true, data: links });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
        
      case "completeLink":
        console.log('Background: Received completeLink request for ID:', request.id);
        completeLink(request.id).then(() => {
          console.log('Background: completeLink successful');
          sendResponse({ success: true });
        }).catch(error => {
          console.error('Background: completeLink error:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true;
        
      case "uncompleteLink":
        uncompleteLink(request.id).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
        
      case "deleteLink":
        deleteLink(request.id).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
        
      case "updateLink":
        updateLink(request.id, request.data).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
        
      case "cleanupCompleted":
        cleanupCompletedLinks().then(count => {
          sendResponse({ success: true, deletedCount: count });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
    }
  });
}

// Storage functions
async function saveLink(linkData) {
  if (!globalThis.chrome?.storage?.local?.get) {
    throw new Error('Chrome storage API not available');
  }

  const result = await globalThis.chrome.storage.local.get(['readLaterLinks']);
  const links = result.readLaterLinks || [];
  
  const newLink = {
    id: Date.now().toString(),
    url: linkData.url,
    title: linkData.title,
    priority: linkData.priority || 'medium',
    timeToRead: linkData.timeToRead || 5,
    dateAdded: new Date().toISOString(),
    tags: linkData.tags || []
  };
  
  links.unshift(newLink);
  
  if (!globalThis.chrome?.storage?.local?.set) {
    throw new Error('Chrome storage API not available');
  }
  
  await globalThis.chrome.storage.local.set({ readLaterLinks: links });
  return newLink;
}

async function getLinks() {
  if (!globalThis.chrome?.storage?.local?.get) {
    throw new Error('Chrome storage API not available');
  }

  const result = await globalThis.chrome.storage.local.get(['readLaterLinks']);
  return result.readLaterLinks || [];
}

async function deleteLink(id) {
  if (!globalThis.chrome?.storage?.local?.get) {
    throw new Error('Chrome storage API not available');
  }

  const result = await globalThis.chrome.storage.local.get(['readLaterLinks', 'completedLinks']);
  const links = result.readLaterLinks || [];
  const completedLinks = result.completedLinks || [];
  
  // Remove from both active and completed lists
  const filteredLinks = links.filter(link => link.id !== id);
  const filteredCompletedLinks = completedLinks.filter(link => link.id !== id);
  
  if (!globalThis.chrome?.storage?.local?.set) {
    throw new Error('Chrome storage API not available');
  }

  await globalThis.chrome.storage.local.set({ 
    readLaterLinks: filteredLinks,
    completedLinks: filteredCompletedLinks
  });
}

async function updateLink(id, updateData) {
  if (!globalThis.chrome?.storage?.local?.get) {
    throw new Error('Chrome storage API not available');
  }

  const result = await globalThis.chrome.storage.local.get(['readLaterLinks']);
  const links = result.readLaterLinks || [];
  const linkIndex = links.findIndex(link => link.id === id);
  
  if (linkIndex !== -1) {
    links[linkIndex] = { ...links[linkIndex], ...updateData };
    
    if (!globalThis.chrome?.storage?.local?.set) {
      throw new Error('Chrome storage API not available');
    }
    
    await globalThis.chrome.storage.local.set({ readLaterLinks: links });
  }
}

async function getCompletedLinks() {
  if (!globalThis.chrome?.storage?.local?.get) {
    throw new Error('Chrome storage API not available');
  }

  const result = await globalThis.chrome.storage.local.get(['completedLinks']);
  return result.completedLinks || [];
}

async function completeLink(id) {
  try {
    console.log('Background: completeLink function called with ID:', id);
    
    if (!globalThis.chrome?.storage?.local?.get) {
      throw new Error('Chrome storage API not available');
    }

    const result = await globalThis.chrome.storage.local.get(['readLaterLinks', 'completedLinks']);
    const links = result.readLaterLinks || [];
    const completedLinks = result.completedLinks || [];
    
    console.log('Background: Found', links.length, 'active links and', completedLinks.length, 'completed links');
    
    const linkIndex = links.findIndex(link => link.id === id);
    console.log('Background: Link index found:', linkIndex);
    
    if (linkIndex !== -1) {
      const completedLink = {
        ...links[linkIndex],
        completedDate: new Date().toISOString()
      };
      
      console.log('Background: Moving link to completed:', completedLink.title);
      
      // Move to completed list
      completedLinks.unshift(completedLink);
      // Remove from active list
      links.splice(linkIndex, 1);
      
      if (!globalThis.chrome?.storage?.local?.set) {
        throw new Error('Chrome storage API not available');
      }

      await globalThis.chrome.storage.local.set({ 
        readLaterLinks: links,
        completedLinks: completedLinks 
      });
      
      console.log('Background: Storage updated successfully');
    } else {
      console.log('Background: Link not found with ID:', id);
    }
  } catch (error) {
    console.error('Background: Error in completeLink:', error);
    throw error;
  }
}

async function uncompleteLink(id) {
  if (!globalThis.chrome?.storage?.local?.get) {
    throw new Error('Chrome storage API not available');
  }

  const result = await globalThis.chrome.storage.local.get(['readLaterLinks', 'completedLinks']);
  const links = result.readLaterLinks || [];
  const completedLinks = result.completedLinks || [];
  
  const linkIndex = completedLinks.findIndex(link => link.id === id);
  if (linkIndex !== -1) {
    const restoredLink = { ...completedLinks[linkIndex] };
    delete restoredLink.completedDate;
    
    // Move back to active list
    links.unshift(restoredLink);
    // Remove from completed list
    completedLinks.splice(linkIndex, 1);
    
    if (!globalThis.chrome?.storage?.local?.set) {
      throw new Error('Chrome storage API not available');
    }

    await globalThis.chrome.storage.local.set({ 
      readLaterLinks: links,
      completedLinks: completedLinks 
    });
  }
}

async function cleanupCompletedLinks() {
  try {
    if (!globalThis.chrome?.storage?.sync?.get) {
      return 0; // Gracefully handle unavailable API
    }

    const settings = await globalThis.chrome.storage.sync.get(['readLaterSettings']);
    const cleanupDays = settings.readLaterSettings?.cleanupDays || 90;
    const autoCleanup = settings.readLaterSettings?.autoCleanup !== false;
    
    if (!autoCleanup) return 0;
    
    if (!globalThis.chrome?.storage?.local?.get) {
      return 0; // Gracefully handle unavailable API
    }

    const result = await globalThis.chrome.storage.local.get(['completedLinks']);
    const completedLinks = result.completedLinks || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);
    
    const filteredLinks = completedLinks.filter(link => {
      const completedDate = new Date(link.completedDate);
      return completedDate > cutoffDate;
    });
    
    const deletedCount = completedLinks.length - filteredLinks.length;
    
    if (deletedCount > 0) {
      if (!globalThis.chrome?.storage?.local?.set) {
        return 0; // Gracefully handle unavailable API
      }

      await globalThis.chrome.storage.local.set({ completedLinks: filteredLinks });
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error in cleanupCompletedLinks:', error);
    return 0;
  }
}

// Auto-cleanup on startup
if (globalThis.chrome?.runtime?.onStartup) {
  globalThis.chrome.runtime.onStartup.addListener(() => {
    cleanupCompletedLinks();
  });
}

 