// Background script for Read Later extension

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveToReadLater",
    title: "Save to Read Later",
    contexts: ["page", "link"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveToReadLater") {
    const url = info.linkUrl || tab.url;
    const title = info.linkText || tab.title;
    
    // Send message to content script to show the save dialog
    chrome.tabs.sendMessage(tab.id, {
      action: "showSaveDialog",
      url: url,
      title: title
    });
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
  }
});

// Storage functions
async function saveLink(linkData) {
  const result = await chrome.storage.local.get(['readLaterLinks']);
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
  await chrome.storage.local.set({ readLaterLinks: links });
  return newLink;
}

async function getLinks() {
  const result = await chrome.storage.local.get(['readLaterLinks']);
  return result.readLaterLinks || [];
}

async function deleteLink(id) {
  const result = await chrome.storage.local.get(['readLaterLinks']);
  const links = result.readLaterLinks || [];
  const filteredLinks = links.filter(link => link.id !== id);
  await chrome.storage.local.set({ readLaterLinks: filteredLinks });
}

async function updateLink(id, updateData) {
  const result = await chrome.storage.local.get(['readLaterLinks']);
  const links = result.readLaterLinks || [];
  const linkIndex = links.findIndex(link => link.id === id);
  
  if (linkIndex !== -1) {
    links[linkIndex] = { ...links[linkIndex], ...updateData };
    await chrome.storage.local.set({ readLaterLinks: links });
  }
} 