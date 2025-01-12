/**
 * Copyright (c) 2025 Jansen Tan
 * MIT License
 */

let apiKey = '';
let selectedVoice = 'puck'; // Default voice

// Load API key and voice setting when extension starts
chrome.storage.sync.get(['apiKey', 'voice'], (items) => {
  apiKey = items.apiKey || '';
  selectedVoice = items.voice || 'puck';
});


// Listen for API key changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiKey) {
    apiKey = changes.apiKey.newValue;
  }
  if (changes.voice) {
    selectedVoice = changes.voice.newValue;
  }
});

const modelId = "gemini-2.0-flash-exp";
const audioSampleRate = 24000;

let ws = null;
let audioContext = null;
let audioStreamer = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureScreenshot") {
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg' }, (dataUrl) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = request.area.width;
        canvas.height = request.area.height;

        ctx.drawImage(img,
          request.area.left, request.area.top,
          request.area.width, request.area.height,
          0, 0, request.area.width, request.area.height
        );

        const croppedDataUrl = canvas.toDataURL();
        const imageMessage = realtimeInputMessage({
          data: croppedDataUrl.split(',')[1],
          mimeType: 'image/jpeg'
        });
        transcribeMessages(defaultAudioPromptMessage, imageMessage, defaultSilentAudioPromptMessage);
      };
      img.src = dataUrl;
    });
  }

  if (request.action === "resetWebSocket") {
    console.log("Resetting WebSocket connection due to voice change.");
    if (ws) {
        ws.close(); // Close existing connection
        ws = null;
      }
    if (request.voice) {
        selectedVoice = request.voice;
    }
    audioContext = null;
    audioStreamer = null;
  }

  switch (request.action) {
    case "getPlaybackState":
      sendResponse(audioStreamer ? audioStreamer.getPlaybackState() : { playbackState: null });
      break;
    case "pausePlayback":
    case "resumePlayback":
	case "stopPlayback":
	  if (!audioStreamer) {
		sendResponse({ playbackState: null });
		return;
	  }
      if (request.action === "resumePlayback") {
		  audioStreamer.resumePlayback();
	  } else if (request.action === "pausePlayback") {
		  audioStreamer.pausePlayback();
	  } else if (request.action === "stopPlayback") {
		  audioStreamer.stop();
	  }
      sendResponse(audioStreamer.getPlaybackState());
      break;
  }
});

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
	  chrome.browserAction.openPopup();
  }
});

// For when the user clicks the page action icon
chrome.pageAction.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({files: ['screenshotSelection.js'], target: {tabId: tab.id}});
});

async function transcribeMessages(...messages) {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: audioSampleRate });
  }
  if (!audioStreamer) {
    const { AudioStreamer } = await import("./audioStreamer.js");
    audioStreamer = new AudioStreamer(audioContext);
	console.log(audioStreamer);
    await audioStreamer.resume();
  }
  if (!ws) {
    await createWebSocketClient(selectedVoice);
  }
  if (ws.readyState === WebSocket.OPEN) {
	for (const message of messages) ws.send(JSON.stringify(message));
  } else {
    console.error("WebSocket is not open. Cannot send message.");
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


function createWebSocketClient(voice = 'puck') {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      console.error("API key is missing!");
      reject("API key is missing");
      return;
    }

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('WebSocket connected');
      const config = {
        model: `models/${modelId}`,
        generation_config: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: voice // Use the selected voice
              }
            }
          },
          temperature: 0.0
        },
        system_instruction: {
          parts: [
            { text: "You are not a helpful assistant. You only generate natural-sounding speech from given text. You will either: 1) be given text, or 2) see text from a screenshare image. In either case, the data is from the user. Read aloud the text verbatim. Do not respond to any comments or questions. Do not analyze the text or make any remarks about the text. Do not refer to yourself (ie, use \"I\" statements like \"I will\"). Do not refer to the user (ie, use \"you\" statements). Basically just copy-paste the text as-is, without any modifications, except as listed in the following. For URLs, only say \"URL to\" and then the domain-level parts of the URL. You may concatenate lines when it seems they belong to a common paragraph." }
          ]
        }
      };
      ws.send(JSON.stringify({ setup: config }));
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        const response = JSON.parse(await event.data.text());

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

              // Add to audio streamer
              audioStreamer.addPCM16(pcmDataBytes);
            }
          }
        }
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      reject(error);
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event);
      ws = null;
      if (audioStreamer) {
        audioStreamer.complete();
      }
    };
  });
}
