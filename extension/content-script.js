// DocAI Extension - Content Script
// This script runs on Canvas pages and injects the sidebar widget

(function() {
  'use strict';

  console.log('🎯 DocAI: Content script loaded on', window.location.href);

  // Configuration
  const BACKEND_URL = 'http://localhost:8000';
  const FRONTEND_URL = 'http://localhost:3000';
  const SIDEBAR_ID = 'docai-sidebar';
  const TOGGLE_BUTTON_ID = 'docai-toggle-btn';
  
  // Check if sidebar already exists (avoid duplicates)
  if (document.getElementById(SIDEBAR_ID)) {
    console.log('DocAI: Sidebar already exists');
    return;
  }

  // Create floating toggle button (always visible, outside sidebar)
  function createToggleButton() {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = TOGGLE_BUTTON_ID;
    toggleBtn.className = 'docai-toggle-btn';
    toggleBtn.innerHTML = '💬';
    toggleBtn.title = 'Open DocAI';
    toggleBtn.setAttribute('aria-label', 'Toggle DocAI sidebar');
    toggleBtn.addEventListener('click', toggleSidebar);
    document.body.appendChild(toggleBtn);
    return toggleBtn;
  }

  // Create sidebar container
  function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = SIDEBAR_ID;
    sidebar.className = 'docai-sidebar docai-collapsed';
    
    // Sidebar header
    const header = document.createElement('div');
    header.className = 'docai-header';
    
    // Close button in header (appears when sidebar is open)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'docai-close-header-btn';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Close DocAI';
    closeBtn.setAttribute('aria-label', 'Close DocAI sidebar');
    closeBtn.addEventListener('click', toggleSidebar);
    header.appendChild(closeBtn);
    
    // Sidebar content area (will hold iframe)
    const content = document.createElement('div');
    content.className = 'docai-content';
    
    const iframe = document.createElement('iframe');
    iframe.id = 'docai-iframe';
    iframe.src = `${FRONTEND_URL}`;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    
    content.appendChild(iframe);
    sidebar.appendChild(header);
    sidebar.appendChild(content);
    
    // Fullscreen overlay (hidden by default)
    const overlay = document.createElement('div');
    overlay.id = 'docai-fullscreen-overlay';
    overlay.className = 'docai-fullscreen-overlay docai-hidden';
    
    const fullscreenContent = document.createElement('div');
    fullscreenContent.className = 'docai-fullscreen-content';
    
    // Create minimize and close buttons (append directly to fullscreenContent)
    const fullscreenMinimizeBtn = document.createElement('button');
    fullscreenMinimizeBtn.className = 'docai-minimize-btn';
    fullscreenMinimizeBtn.innerHTML = '─'; // Minimize icon (horizontal line)
    fullscreenMinimizeBtn.title = 'Minimize to sidebar';
    fullscreenMinimizeBtn.setAttribute('aria-label', 'Minimize to sidebar');
    
    const fullscreenCloseBtn = document.createElement('button');
    fullscreenCloseBtn.className = 'docai-close-btn';
    fullscreenCloseBtn.innerHTML = '✕';
    fullscreenCloseBtn.title = 'Close fullscreen';
    fullscreenCloseBtn.setAttribute('aria-label', 'Close fullscreen');
    
    const fullscreenIframe = document.createElement('iframe');
    fullscreenIframe.src = `${FRONTEND_URL}`;
    fullscreenIframe.setAttribute('frameborder', '0');
    fullscreenIframe.setAttribute('allow', 'clipboard-read; clipboard-write');
    fullscreenIframe.style.width = '100%';
    fullscreenIframe.style.height = '100%';
    fullscreenIframe.style.border = 'none';
    
    // Append buttons directly to fullscreenContent (before iframe) for better visibility
    fullscreenContent.appendChild(fullscreenMinimizeBtn);
    fullscreenContent.appendChild(fullscreenCloseBtn);
    fullscreenContent.appendChild(fullscreenIframe);
    overlay.appendChild(fullscreenContent);
    
    document.body.appendChild(sidebar);
    document.body.appendChild(overlay);
    
    // Event listeners
    fullscreenMinimizeBtn.addEventListener('click', minimizeFullscreen);
    fullscreenCloseBtn.addEventListener('click', closeFullscreen);
    
    // Listen for messages from iframes
    window.addEventListener('message', (event) => {
      // Security: verify origin
      if (event.origin !== FRONTEND_URL) return;
      
      if (event.data && event.data.type === 'docai-open-fullscreen') {
        openFullscreen();
      }
      if (event.data && event.data.type === 'docai-close-fullscreen') {
        closeFullscreen();
      }
      if (event.data && event.data.type === 'docai-minimize-fullscreen') {
        minimizeFullscreen();
      }
      
      // Forward messages from one iframe to another
      if (event.data && event.data.type === 'docai-send-messages') {
        const overlay = document.getElementById('docai-fullscreen-overlay');
        const fullscreenIframe = overlay?.querySelector('iframe');
        const sidebarIframe = document.getElementById('docai-iframe');
        const isFullscreenVisible = overlay && !overlay.classList.contains('docai-hidden');
        const targetIframe = isFullscreenVisible ? fullscreenIframe : sidebarIframe;
        
        if (targetIframe && targetIframe.contentWindow) {
          targetIframe.contentWindow.postMessage(
            {
              type: 'docai-sync-messages',
              messages: event.data.messages
            },
            FRONTEND_URL
          );
        }
      }
    });
    
    return sidebar;
  }

  // Add expand button that appears when sidebar is open (defined outside createSidebar for scope)
  function addExpandToFullscreenButton() {
    if (!document.querySelector('.docai-expand-fullscreen-btn')) {
      const header = document.querySelector('.docai-header');
      if (!header) return;
      
      const expandFullscreenBtn = document.createElement('button');
      expandFullscreenBtn.className = 'docai-expand-fullscreen-btn';
      expandFullscreenBtn.innerHTML = '⛶';
      expandFullscreenBtn.title = 'Expand to fullscreen';
      expandFullscreenBtn.setAttribute('aria-label', 'Expand to fullscreen');
      expandFullscreenBtn.addEventListener('click', openFullscreen);
      header.appendChild(expandFullscreenBtn);
    }
  }

  function toggleSidebar() {
    const sidebar = document.getElementById(SIDEBAR_ID);
    const toggleBtn = document.getElementById(TOGGLE_BUTTON_ID);
    
    if (!sidebar || !toggleBtn) return;
    
    const isExpanded = sidebar.classList.contains('docai-expanded');
    
    if (isExpanded) {
      // Collapse sidebar
      sidebar.classList.add('docai-collapsed');
      sidebar.classList.remove('docai-expanded');
      toggleBtn.style.display = 'flex'; // Show floating button
      const expandFullscreenBtn = document.querySelector('.docai-expand-fullscreen-btn');
      if (expandFullscreenBtn) expandFullscreenBtn.remove();
    } else {
      // Expand sidebar
      sidebar.classList.remove('docai-collapsed');
      sidebar.classList.add('docai-expanded');
      toggleBtn.style.display = 'none'; // Hide floating button (close button in header will show)
      addExpandToFullscreenButton();
    }
  }

  function openFullscreen() {
    const overlay = document.getElementById('docai-fullscreen-overlay');
    const sidebar = document.getElementById(SIDEBAR_ID);
    const toggleBtn = document.getElementById(TOGGLE_BUTTON_ID);
    const sidebarIframe = document.getElementById('docai-iframe');
    const fullscreenIframe = overlay?.querySelector('iframe');
    
    if (overlay) {
      overlay.classList.remove('docai-hidden');
      document.body.style.overflow = 'hidden'; // Prevent scrolling
      
      // Hide sidebar if open
      if (sidebar && sidebar.classList.contains('docai-expanded')) {
        sidebar.classList.add('docai-collapsed');
        sidebar.classList.remove('docai-expanded');
      }
      
      // Hide toggle button when fullscreen is open
      if (toggleBtn) {
        toggleBtn.style.display = 'none';
      }
      
      // Sync messages from sidebar iframe to fullscreen iframe
      // Wait for iframe to load, then sync immediately via localStorage and postMessage
      if (fullscreenIframe) {
        const syncMessages = () => {
          try {
            // Read from localStorage directly (shared between both iframes)
            const storedMessages = localStorage.getItem('docai-chat-messages');
            if (storedMessages && fullscreenIframe.contentWindow) {
              try {
                const messages = JSON.parse(storedMessages);
                if (Array.isArray(messages) && messages.length > 0) {
                  fullscreenIframe.contentWindow.postMessage(
                    {
                      type: 'docai-sync-messages',
                      messages: messages
                    },
                    FRONTEND_URL
                  );
                  console.log(`🔄 Synced ${messages.length} messages to fullscreen iframe`);
                }
              } catch (parseErr) {
                console.error('Error parsing stored messages:', parseErr);
              }
            }
            
            // Also request from sidebar iframe for latest state
            if (sidebarIframe && sidebarIframe.contentWindow) {
              try {
                sidebarIframe.contentWindow.postMessage(
                  { type: 'docai-request-messages' },
                  FRONTEND_URL
                );
              } catch (err) {
                console.error('Error requesting messages from sidebar:', err);
              }
            }
          } catch (err) {
            console.error('Error syncing messages:', err);
          }
        };
        
        // Multiple attempts to sync (iframe might load at different times)
        const attempts = [100, 300, 600, 1000];
        attempts.forEach((delay) => {
          setTimeout(syncMessages, delay);
        });
        
        // Also listen for iframe load event
        fullscreenIframe.addEventListener('load', () => {
          setTimeout(syncMessages, 200);
        }, { once: true });
      }
    }
  }

  function minimizeFullscreen() {
    const overlay = document.getElementById('docai-fullscreen-overlay');
    const sidebar = document.getElementById(SIDEBAR_ID);
    const toggleBtn = document.getElementById(TOGGLE_BUTTON_ID);
    const fullscreenIframe = overlay?.querySelector('iframe');
    const sidebarIframe = document.getElementById('docai-iframe');
    
    if (overlay) {
      overlay.classList.add('docai-hidden');
      document.body.style.overflow = ''; // Restore scrolling
      
      // Expand sidebar
      if (sidebar) {
        sidebar.classList.remove('docai-collapsed');
        sidebar.classList.add('docai-expanded');
        // Re-add expand button to sidebar header
        addExpandToFullscreenButton();
      }
      
      // Sync messages from fullscreen iframe back to sidebar iframe
      if (fullscreenIframe && sidebarIframe) {
        try {
          // Request messages from fullscreen iframe
          fullscreenIframe.contentWindow.postMessage(
            { type: 'docai-request-messages' },
            FRONTEND_URL
          );
          
          // Also sync via localStorage (which both iframes use)
          setTimeout(() => {
            const storedMessages = localStorage.getItem('docai-chat-messages');
            if (storedMessages && sidebarIframe.contentWindow) {
              sidebarIframe.contentWindow.postMessage(
                {
                  type: 'docai-sync-messages',
                  messages: JSON.parse(storedMessages)
                },
                FRONTEND_URL
              );
            }
          }, 100);
        } catch (err) {
          console.error('Error syncing messages on minimize:', err);
        }
      }
      
      // Hide toggle button (sidebar is now open)
      if (toggleBtn) {
        toggleBtn.style.display = 'none';
      }
    }
  }

  function closeFullscreen() {
    const overlay = document.getElementById('docai-fullscreen-overlay');
    const toggleBtn = document.getElementById(TOGGLE_BUTTON_ID);
    const sidebar = document.getElementById(SIDEBAR_ID);
    
    if (overlay) {
      overlay.classList.add('docai-hidden');
      document.body.style.overflow = ''; // Restore scrolling
      
      // Always show toggle button after closing fullscreen
      if (toggleBtn) {
        toggleBtn.style.display = 'flex';
      }
      
      // Ensure sidebar is collapsed (not expanded) after closing fullscreen
      if (sidebar) {
        sidebar.classList.add('docai-collapsed');
        sidebar.classList.remove('docai-expanded');
        const expandFullscreenBtn = document.querySelector('.docai-expand-fullscreen-btn');
        if (expandFullscreenBtn) expandFullscreenBtn.remove();
      }
    }
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to toggle sidebar
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggleSidebar();
    }
    
    // Escape to close fullscreen
    if (e.key === 'Escape') {
      const overlay = document.getElementById('docai-fullscreen-overlay');
      if (overlay && !overlay.classList.contains('docai-hidden')) {
        closeFullscreen();
      }
    }
  });

  // Clear chat history on page refresh
  // Use sessionStorage to detect if this is a new session (page refresh)
  function clearChatOnRefresh() {
    try {
      const STORAGE_KEY = 'docai-chat-messages';
      const SESSION_KEY = 'docai-session-id';
      const currentSessionId = Date.now().toString();
      const lastSessionId = sessionStorage.getItem(SESSION_KEY);
      
      // If session changed (page refresh), clear chat
      if (!lastSessionId || lastSessionId !== currentSessionId) {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.setItem(SESSION_KEY, currentSessionId);
        console.log('🔄 Canvas page refreshed - chat history cleared');
      }
    } catch (err) {
      console.error('Error clearing chat on refresh:', err);
    }
  }

  // Initialize sidebar when DOM is ready
  function initialize() {
    console.log('🎯 DocAI: Initializing sidebar...');
    
    // Clear chat history on page refresh
    clearChatOnRefresh();
    
    try {
      // Create floating toggle button first
      createToggleButton();
      // Then create sidebar
      createSidebar();
      console.log('✅ DocAI: Sidebar created successfully');
    } catch (error) {
      console.error('❌ DocAI: Error creating sidebar:', error);
    }
  }

  if (document.readyState === 'loading') {
    console.log('🎯 DocAI: DOM still loading, waiting...');
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    console.log('🎯 DocAI: DOM ready, creating sidebar...');
    // Use setTimeout to ensure DOM is fully ready
    setTimeout(initialize, 100);
  }

  // Handle dynamic page loads (Canvas uses SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Sidebar should persist, but we can add re-initialization logic here if needed
    }
  }).observe(document, { subtree: true, childList: true });

})();

