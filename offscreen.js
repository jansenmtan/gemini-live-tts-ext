let ws = null;
let audioContext = null;
let audioStreamer = null;

let apiKey = '';
let selectedVoice = 'aoede'; // Default voice
let systemPrompt = '';

const modelId = "gemini-2.0-flash-exp";
const audioSampleRate = 24000;

async function initializeAudio() {
  audioContext = new AudioContext({ sampleRate: audioSampleRate });
  const { AudioStreamer } = await import("./audioStreamer.js");
  audioStreamer = new AudioStreamer(audioContext);
  await audioStreamer.resume();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'initializeAudio':
          initializeAudio();
          break;
        case 'transcribeMessages':
          if (request.apiKey) apiKey = request.apiKey;
          if (request.selectedVoice) selectedVoice = request.selectedVoice;
          if (request.systemPrompt) systemPrompt = request.systemPrompt;
          transcribeMessages(...request.messages);
          break;
        case 'cropScreenshotAndTranscribe':
          if (request.apiKey) apiKey = request.apiKey;
          if (request.selectedVoice) selectedVoice = request.selectedVoice;
          if (request.systemPrompt) systemPrompt = request.systemPrompt;
          cropScreenshotAndTranscribe(request.dataUrl, request.area);
          break;
        case 'resetWebSocket':
          await handleWebSocketReset(request);
          break;
        case 'getPlaybackState':
          sendResponse(audioStreamer ? audioStreamer.getPlaybackState() : { playbackState: null });
          break;
        case 'setVolume':
          audioStreamer.setVolume(request.volume);
          break;
        case 'getVolume':
          sendResponse({ volume: audioStreamer ? audioStreamer.getVolume() : 1.0 });
          break;
        case 'resumePlayback':
          audioStreamer.resumePlayback();
          sendResponse(audioStreamer.getPlaybackState());
          break;
        case 'pausePlayback':
          audioStreamer.pausePlayback();
          sendResponse(audioStreamer.getPlaybackState());
          break;
        case 'stopPlayback':
          audioStreamer.stop();
          audioStreamer.complete();
          sendResponse(audioStreamer.getPlaybackState());
          break;
      }
    } catch (error) {
      console.error(`Error handling ${request.action}:`, error);
      sendResponse({ error: error.message });
    }
  })();
  return true; // Keep message channel open for async response
});

async function notifyError(error) {
  console.log(error);
  chrome.runtime.sendMessage({ action: 'notifyError', error: error });
}

class APIKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'APIKeyError';
  }
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

async function transcribeMessages(...messages) {
  try {
    validateAPIKey(apiKey);

    if (!audioStreamer) {
      try {
        initializeAudio();
      } catch (error) {
        notifyError(error);
        throw error;
      }
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

class WebSocketError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WebSocketError';
  }
}

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

async function cropScreenshotAndTranscribe(dataUrl, area) {
  return new Promise((resolve, reject) => {
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
}

