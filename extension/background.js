// DocAI Extension - Background Service Worker

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('DocAI extension installed');
    // Could show welcome page or onboarding here
  } else if (details.reason === 'update') {
    console.log('DocAI extension updated');
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBackendUrl') {
    sendResponse({ backendUrl: 'http://localhost:8000' });
  }
  return true; // Keep message channel open for async responses
});

// Optional: Track when Canvas pages are visited
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('instructure.com')) {
      console.log('DocAI: Canvas page detected', tab.url);
    }
  }
});

