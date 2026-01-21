let defaultSystemPrompt = '';
(async () => {
  defaultSystemPrompt = (await import("./defaultPrompt.js")).defaultSystemPrompt;
})();

const DEFAULT_MODEL_NATIVE = 'gemini-2.5-flash-native-audio-preview-12-2025';
const DEFAULT_MODEL_TTS = 'gemini-2.5-flash-preview-tts';
const DEFAULT_VOICE = 'Aoede';
const DEFAULT_API_TYPE = 'native-audio';

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiKey', 'voice', 'systemPrompt', 'model', 'apiType', 'modelTTS'], (items) => {
    document.getElementById('apiKey').value = items.apiKey || '';
    document.getElementById('voiceSelect').value = items.voice || DEFAULT_VOICE;
    document.getElementById('modelSelectNative').value = items.model || DEFAULT_MODEL_NATIVE;
    document.getElementById('modelSelectTTS').value = items.modelTTS || DEFAULT_MODEL_TTS;
    document.getElementById('systemPrompt').value = items.systemPrompt || defaultSystemPrompt;

    // Set API type
    const apiType = items.apiType || DEFAULT_API_TYPE;
    updateApiTypeUI(apiType);
  });
});

// API Type switching
function updateApiTypeUI(apiType) {
  const nativeBtn = document.querySelector('[data-type="native-audio"]');
  const ttsBtn = document.querySelector('[data-type="tts"]');
  const nativeModels = document.getElementById('nativeAudioModels');
  const ttsModels = document.getElementById('ttsModels');

  if (apiType === 'native-audio') {
    nativeBtn.classList.add('active');
    ttsBtn.classList.remove('active');
    nativeModels.classList.remove('hidden');
    ttsModels.classList.add('hidden');
  } else {
    ttsBtn.classList.add('active');
    nativeBtn.classList.remove('active');
    ttsModels.classList.remove('hidden');
    nativeModels.classList.add('hidden');
  }
}

document.querySelectorAll('.api-type-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const apiType = this.dataset.type;
    updateApiTypeUI(apiType);
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

  // Determine active API type
  const apiType = document.querySelector('.api-type-btn.active').dataset.type;

  // Get the appropriate model based on API type
  let model, modelTTS;
  if (apiType === 'native-audio') {
    model = document.getElementById('modelSelectNative').value;
    modelTTS = document.getElementById('modelSelectTTS').value;
  } else {
    modelTTS = document.getElementById('modelSelectTTS').value;
    model = document.getElementById('modelSelectNative').value;
  }

  chrome.storage.sync.set({ apiKey, voice, model, modelTTS, apiType, systemPrompt }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Settings saved.';
    status.style.color = '#34a853';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);

    // Send message to background script to reset WebSocket with new settings
    chrome.runtime.sendMessage({
      action: "resetWebSocket",
      voice: voice,
      model: model,
      modelTTS: modelTTS,
      apiType: apiType,
      systemPrompt: systemPrompt
    });
  });
});
