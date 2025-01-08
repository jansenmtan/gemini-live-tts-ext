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

function getContentFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target.result.split(',')[1];
      const mimeType = e.target.result.split(',')[0].split(':')[1].split(';')[0];
      resolve({ data, mimeType });
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsDataURL(file);
  });
}

const testAudioPromptElement = document.getElementById('testAudioPrompt');
let audioPromptContent = { data: null, mimeType: null };
testAudioPromptElement.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file) {
    try {
      audioPromptContent = await getContentFromFile(file);
	  audioPromptContent.mimeType = "audio/pcm";
    } catch (error) {
      console.error("Error reading audio file:", error);
    }
  }
});
const testSilentAudioPromptElement = document.getElementById('testSilentAudioPrompt');
let silentAudioPromptContent = { data: null, mimeType: null };
testSilentAudioPromptElement.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file) {
    try {
      silentAudioPromptContent = await getContentFromFile(file);
	  silentAudioPromptContent.mimeType = "audio/pcm";
    } catch (error) {
      console.error("Error reading audio file:", error);
    }
  }
});

const testElement = document.getElementById('test');
testElement.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file) {
    try {
      const videoContent = await getContentFromFile(file);
      chrome.runtime.sendMessage({
        action: "runTest",
        content: videoContent,
        testPrompt: document.getElementById('testPrompt').value,
        audioPrompt: audioPromptContent,
        silentAudioPrompt: silentAudioPromptContent,
      });
    } catch (error) {
      console.error("Error reading video file:", error);
    }
  }
});
