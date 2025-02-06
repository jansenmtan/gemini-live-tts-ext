/**
 * Copyright (c) 2025 Jansen Tan
 * MIT License
 */
import { defaultSystemPrompt } from "./defaultPrompt.js";
import { AudioStreamer } from "./audioStreamer.js";

let apiKey = '';
let selectedVoice = 'aoede'; // Default voice
let systemPrompt = '';

class APIKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'APIKeyError';
  }
}

class WebSocketError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WebSocketError';
  }
}

function isAPIKeyValid(key) {
  return key && key.startsWith("AIza") && key.length > 30;
}
// Validate API key format
function validateAPIKey(key) {
  if (!key) {
    throw new APIKeyError('API key is missing');
  }
  if (typeof key !== 'string' || !key.startsWith('AIza') || !(key.length > 30)) {
    throw new APIKeyError('Invalid API key format');
  }
}

async function notifyError(error) {
  let message = '';
  if (error instanceof APIKeyError) {
    message = `API Key Error: ${error.message}. Please check your API key in the extension settings.`;
  } else if (error instanceof WebSocketError) {
    message = `Connection Error: ${error.message}.`;
  } else {
    message = `Error: ${error.message}`;
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon-32.png'),
    title: 'Gemini Live TTS Error',
    message: message
  });
}

// Load API key and other settings when extension starts
chrome.storage.sync.get(['apiKey', 'voice', 'systemPrompt'], (items) => {
  try {
    if (items.apiKey) validateAPIKey(items.apiKey);
    apiKey = items.apiKey || '';
    selectedVoice = items.voice || 'aoede';
    systemPrompt = items.systemPrompt || defaultSystemPrompt;
  } catch (error) {
    console.error('Settings loading error:', error);
    notifyError(error);
  }
});


// Listen for API key and other setting changes
chrome.storage.onChanged.addListener((changes) => {
  try {
    if (changes.apiKey) {
      validateAPIKey(changes.apiKey.newValue);
      apiKey = changes.apiKey.newValue;
    }
    if (changes.voice) selectedVoice = changes.voice.newValue;
    if (changes.systemPrompt) systemPrompt = changes.systemPrompt.newValue;
  } catch (error) {
    console.error('Settings change error:', error);
    notifyError(error);
  }
});

const modelId = "gemini-2.0-flash-exp";
const audioSampleRate = 24000;

let ws = null;
let audioContext = null;
let audioStreamer = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case "captureScreenshot":
          await handleScreenshotCapture(request.area);
          break;
        case "resetWebSocket":
          await handleWebSocketReset(request);
          break;
        case "getPlaybackState":
          sendResponse(getPlaybackState());
          break;
        case "updatePlaybackState":
          updateActionButton(request.playbackState);
          break;
        case "setVolume":
          handleVolumeChange(request);
          break;
        case "getVolume":
          sendResponse(getVolumeState());
          break;
        case "pausePlayback":
        case "resumePlayback":
        case "stopPlayback":
          handlePlaybackControl(request, sendResponse);
          break;
      }
    } catch (error) {
      console.error(`Error handling ${request.action}:`, error);
      notifyError(error);
      sendResponse({ error: error.message });
    }
  })();
  return true; // Keep message channel open for async response
});

async function handleScreenshotCapture(area) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 100 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Screenshot capture failed: ${chrome.runtime.lastError.message}`));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load captured image'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          canvas.width = area.width;
          canvas.height = area.height;

          ctx.drawImage(img,
            area.left, area.top,
            area.width, area.height,
            0, 0, area.width, area.height
          );

          const croppedDataUrl = canvas.toDataURL();
          const imageMessage = realtimeInputMessage({
            data: croppedDataUrl.split(',')[1],
            mimeType: 'image/jpeg'
          });
          transcribeMessages(defaultAudioPromptMessage, imageMessage, defaultSilentAudioPromptMessage);
          resolve();
        } catch (error) {
          reject(new Error(`Image processing failed: ${error.message}`));
        }
      };
      img.src = dataUrl;
    });
  });
}


async function handleWebSocketReset(request) {
  try {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (request.voice) {
      selectedVoice = request.voice;
    }
    if (request.systemPrompt) {
      systemPrompt = request.systemPrompt;
    }
    audioContext = null;
    audioStreamer = null;
  } catch (error) {
    throw new WebSocketError(`Failed to reset WebSocket: ${error.message}`);
  }
}

function getPlaybackState() {
  return audioStreamer ? audioStreamer.getPlaybackState() : { playbackState: null };
}

function handleVolumeChange(request) {
  if (audioStreamer) {
    audioStreamer.setVolume(request.volume);
  }
}

function getVolumeState() {
  return {
    volume: audioStreamer ? audioStreamer.getVolume() : 1.0
  };
}

function handlePlaybackControl(request, sendResponse) {
  if (!audioStreamer) {
    sendResponse({ playbackState: null });
    return;
  }

  try {
    switch (request.action) {
      case "resumePlayback":
        audioStreamer.resumePlayback();
        break;
      case "pausePlayback":
        audioStreamer.pausePlayback();
        break;
      case "stopPlayback":
        audioStreamer.stop();
        break;
    }
    sendResponse(audioStreamer.getPlaybackState());
  } catch (error) {
    throw new Error(`Playback control failed: ${error.message}`);
  }
}

chrome.contextMenus.create({
  id: "transcribe-text",
  title: "Transcribe with Gemini",
  contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "transcribe-text") {
    const selectedText = info.selectionText;
    const textMessage = {
      client_content: {
        turns: [
          {
            parts: [{ text: selectedText }],
            role: "user"
          }
        ],
        turn_complete: true
      }
    };
    transcribeMessages(textMessage);
	  chrome.action.openPopup();
  }
});

function updateActionButton(playbackState) {
  if (playbackState === "stopped" || playbackState === null) {
    // Set up for screenshot capture mode
    chrome.action.setPopup({ popup: "" }); // Remove popup
    chrome.action.setTitle({ title: "Take screenshot to send to Gemini" });
    chrome.action.setIcon({ path: "page_action-32.png" });
  } else {
    // Set up for playback control mode
    chrome.action.setPopup({ popup: "popup.html" });
    chrome.action.setTitle({ title: "Gemini TTS Controls" });
    chrome.action.setIcon({ path: "icon-32.png" });
  }
}

// For when the user clicks the action icon
chrome.action.onClicked.addListener(async (tab) => {
  const state = audioStreamer.getPlaybackState().playbackState;
  if (state === "playing" || state === "paused") {
    // open popup
    chrome.action.openPopup();
    return;
  } // otherwise, take screenshot
  let currentTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  let isFile = currentTab.url.startsWith("file://") || currentTab.title.endsWith(".pdf");
  if (!isFile) {
    // can do script injection
    console.log("INJECTING SCRIPT.");
    chrome.scripting.executeScript({files: ['screenshotSelection.js'], target: {tabId: tab.id}});
  } else {
    // cannot do script injection. 
    // just take a screenshot of the whole tab and hope for the best.
    console.log("CAN'T INJECT SCRIPT.");
    let area = {
      left: 0,
      top: 0,
      width: currentTab.width,
      height: currentTab.height
    };
    handleScreenshotCapture(area);
  }
});

async function transcribeMessages(...messages) {
  try {
    validateAPIKey(apiKey);

    if (!audioContext) {
      audioContext = new AudioContext({ sampleRate: audioSampleRate });
    }

    if (!audioStreamer) {
      const { AudioStreamer } = await import("./audioStreamer.js").catch(error => {
        throw new Error(`Failed to load AudioStreamer: ${error.message}`);
      });
      audioStreamer = new AudioStreamer(audioContext);
      await audioStreamer.resume();
    }

    if (!ws) {
      await createWebSocketClient(selectedVoice, systemPrompt);
    }

    if (ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketError('WebSocket connection is not open');
    }

    audioStreamer.refreshVolume(); // before sending messages, ensure volume is set
    for (const message of messages) ws.send(JSON.stringify(message));
  } catch (error) {
    notifyError(error);
    throw error;
  }
}

function getContentFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target.result.split(',')[1];
      //const mimeType = e.target.result.split(',')[0].split(':')[1].split(';')[0];
	  const mimeType = "audio/pcm";
      resolve({ data, mimeType });
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsDataURL(blob);
  });
}

async function getContentFromFile(url) {
  let file = await fetch(chrome.runtime.getURL(url));
  let blob = await file.blob();
  let content = await getContentFromBlob(blob);
  return content;
}

function realtimeInputMessage(content) {
  return {
	realtimeInput: {
	  mediaChunks: [
		content
	  ]
	}
  };
}

let defaultAudioPromptMessage = null;
let defaultSilentAudioPromptMessage = null;
(async () => {
  defaultAudioPromptMessage = realtimeInputMessage(await getContentFromFile("request.raw"));
  defaultSilentAudioPromptMessage = realtimeInputMessage(await getContentFromFile("silence.raw"));
})();

chrome.runtime.onInstalled.addListener(async ({ reason, temporary }) => {
  //if (temporary) return; // skip during development
  switch (reason) {
    case "install":
      {
        const url = chrome.runtime.getURL("onboarding.html");
        await chrome.tabs.create({ url });
      }
      break;
    case "update":
      {
        // nothing for now
      }
      break;
  }
});

function createWebSocketClient(voice = 'aoede') {
  return new Promise((resolve, reject) => {
    try {
      validateAPIKey(apiKey);

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      ws = new WebSocket(url);

      let connectionTimeout = setTimeout(() => {
        ws.close();
        reject(new WebSocketError('Connection timeout'));
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket connected');
        const config = {
          model: `models/${modelId}`,
          generation_config: {
            response_modalities: ["AUDIO"],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: {
                  voice_name: voice
                }
              }
            },
            temperature: 0.0
          },
          system_instruction: {
            parts: [
              { text: systemPrompt }
            ]
          }
        };
        ws.send(JSON.stringify({ setup: config }));
      };

      ws.onmessage = async (event) => {
        try {
          if (event.data instanceof Blob) {
            const response = JSON.parse(await event.data.text());

            if (response.error) {
              throw new WebSocketError(response.error.message || 'Unknown API error');
            }

            if (response.setupComplete) {
              console.log("Setup complete.");
              resolve();
              return;
            }

            if (response.serverContent && response.serverContent.modelTurn) {
              const parts = response.serverContent.modelTurn.parts;
              for (const part of parts) {
                if (part.inlineData && part.inlineData.mimeType === 'audio/pcm;rate=24000') {
                  const pcmDataBase64 = part.inlineData.data;
                  const pcmData = atob(pcmDataBase64);

                  // Convert to Uint8Array
                  const pcmDataBytes = new Uint8Array(pcmData.length);
                  for (let i = 0; i < pcmData.length; i++) {
                    pcmDataBytes[i] = pcmData.charCodeAt(i);
                  }

                  // Add PCM data to audio streamer
                  audioStreamer.addPCM16(pcmDataBytes);
                }
              }
            }
          }
        } catch (error) {
          console.error('WebSocket message processing error:', error);
          notifyError(error);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('WebSocket error:', error);
        notifyError(new WebSocketError(`WebSocket connection error: ${error.message || 'Unknown error'}`));
        reject(error);
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket closed:', event);
        ws = null;

        // Handle specific close codes
        let errorMessage = 'Connection closed';
        if (event.code === 1008) {
          errorMessage = 'Invalid API key or authentication failed';
        } else if (event.code === 1011) {
          errorMessage = 'Server error occurred';
        }

        // Check for specific error patterns in the close reason
        if (event.reason.includes('DEADLINE_EXCEEDED')) {
          errorMessage = 'Request timeout - please try again';
        } else if (event.reason.includes('THROTTLED_CLIENT')) {
          errorMessage = 'Too many requests - please wait and try again';
        }

        notifyError(new WebSocketError(errorMessage));

        if (audioStreamer) {
          audioStreamer.complete();
        }
      };
    } catch (error) {
      reject(error);
    }
  });
}
