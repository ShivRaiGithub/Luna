// Luna Wallet — Content Script
// Bridges the injected provider with the background service worker

// Inject the Luna provider script into the page
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Listen for messages from the injected provider (page → background)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data?.lunaMessage) return;

  const { id, type, payload } = event.data;

  chrome.runtime.sendMessage({ type, payload }, (response) => {
    // Relay response back to the page
    window.postMessage({
      lunaResponse: true,
      id,
      response,
    }, '*');
  });
});

// Listen for messages from background → page
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'LUNA_PENDING_CONNECTION' || message.type === 'LUNA_PENDING_TX') {
    window.postMessage({ lunaEvent: true, ...message }, '*');
  }
});



console.log('[Luna] Content script initialized on', window.location.origin);
