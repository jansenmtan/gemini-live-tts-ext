let defaultSystemPrompt = '';
(async () => {
  defaultSystemPrompt = (await import("./defaultPrompt.js")).defaultSystemPrompt;
})();

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiKey', 'voice', 'systemPrompt'], (items) => {
    document.getElementById('apiKey').value = items.apiKey || '';
    document.getElementById('voiceSelect').value = items.voice || 'aoede';
    document.getElementById('systemPrompt').value = items.systemPrompt || defaultSystemPrompt;
  });
});

document.getElementById('toggleApiKeyVisibility').addEventListener('click', function () {
  const apiKeyInput = document.getElementById('apiKey');
  if (apiKeyInput.style.webkitTextSecurity === 'disc' || apiKeyInput.style.webkitTextSecurity === '') {
    apiKeyInput.style.webkitTextSecurity = 'none';
    this.textContent = 'Hide';
  } else {
    apiKeyInput.style.webkitTextSecurity = 'disc';
    this.textContent = 'Show';
  }
});

document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const voice = document.getElementById('voiceSelect').value;
  const systemPrompt = document.getElementById('systemPrompt').value;

  chrome.storage.sync.set({ apiKey, voice, systemPrompt }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Settings saved.';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);

    // Send message to background script to reset WebSocket
    chrome.runtime.sendMessage({ action: "resetWebSocket", voice: voice, systemPrompt: systemPrompt });
  });
});
