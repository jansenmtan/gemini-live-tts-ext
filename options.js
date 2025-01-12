document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiKey', 'voice'], (items) => {
    document.getElementById('apiKey').value = items.apiKey || '';
    document.getElementById('voiceSelect').value = items.voice || 'puck'; // Load saved voice
  });
});

document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const voice = document.getElementById('voiceSelect').value; // Get selected voice

  chrome.storage.sync.set({ apiKey, voice }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Settings saved.';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);

    // Send message to background script to reset WebSocket
    chrome.runtime.sendMessage({ action: "resetWebSocket", voice: voice });
  });
});
