/**
 * Copyright (c) 2025 Jansen Tan
 * MIT License
 * 
 * Contains code derived from Google's Multimodal Live API Web Console
 * Copyright 2025 Google LLC
 * Licensed under the Apache License, Version 2.0
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

// Send a message to the popup to update the button state
function updatePopupButton(playbackState) {
  chrome.runtime.sendMessage({ action: "updateButton", ...playbackState });
}

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
        transcribeImage(croppedDataUrl);
      };
      img.src = dataUrl;
    });
  }

  if (request.action === "transcribeText") {
    const textToTranscribe = request.text;
    transcribeText(textToTranscribe);
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
	  updatePopupButton(audioStreamer.getPlaybackState());
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
    transcribeText(selectedText);
  }
});

// For when the user clicks the extension icon
chrome.browserAction.onClicked.addListener((tab) => {
	chrome.scripting.executeScript({files: ['screenshotSelection.js'], target: {tabId: tab.id}})
});

// AudioStreamer is derived from Google's Multimodal Live API Web Console
class AudioStreamer {
  constructor(context) {
    this.context = context;
    this.audioQueue = [];
    this.isPlaying = false;
    this.sampleRate = 24000;
    this.bufferSize = 7680;
    this.processingBuffer = new Float32Array(0);
    this.scheduledTime = 0;
    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.context.destination);
    this.isStreamComplete = false;
    this.checkInterval = null;
    this.initialBufferTime = 0.3; // 100ms initial buffer
  }

  addPCM16(chunk) {
    // Convert PCM16 to Float32
    const float32Array = new Float32Array(chunk.length / 2);
    const dataView = new DataView(chunk.buffer);

    for (let i = 0; i < chunk.length / 2; i++) {
      try {
        const int16 = dataView.getInt16(i * 2, true);
        float32Array[i] = int16 / 32768;
      } catch (e) {
        console.error(e);
      }
    }

    // Add to processing buffer
    const newBuffer = new Float32Array(this.processingBuffer.length + float32Array.length);
    newBuffer.set(this.processingBuffer);
    newBuffer.set(float32Array, this.processingBuffer.length);
    this.processingBuffer = newBuffer;

    // Split into chunks of bufferSize
    while (this.processingBuffer.length >= this.bufferSize) {
      const buffer = this.processingBuffer.slice(0, this.bufferSize);
      this.audioQueue.push(buffer);
      this.processingBuffer = this.processingBuffer.slice(this.bufferSize);
    }

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.scheduledTime = this.context.currentTime + this.initialBufferTime;
      this.scheduleNextBuffer();
    }
  }

  createAudioBuffer(audioData) {
    const audioBuffer = this.context.createBuffer(1, audioData.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(audioData);
    return audioBuffer;
  }

  scheduleNextBuffer() {
    const SCHEDULE_AHEAD_TIME = 0.2;

    while (
      this.audioQueue.length > 0 && 
      this.scheduledTime < this.context.currentTime + SCHEDULE_AHEAD_TIME
    ) {
      const audioData = this.audioQueue.shift();
      const audioBuffer = this.createAudioBuffer(audioData);
      const source = this.context.createBufferSource();

      source.buffer = audioBuffer;
      source.connect(this.gainNode);

      const startTime = Math.max(this.scheduledTime, this.context.currentTime);
      source.start(startTime);

      this.scheduledTime = startTime + audioBuffer.duration;
    }
	
	if (this.audioQueue.length === 0) {
		updatePopupButton({ playbackState: "stopped" });
	}

    if (this.audioQueue.length === 0 && this.processingBuffer.length === 0) {
      if (this.isStreamComplete) {
        this.isPlaying = false;
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
      } else {
        if (!this.checkInterval) {
          this.checkInterval = window.setInterval(() => {
            if (
              this.audioQueue.length > 0 ||
              this.processingBuffer.length >= this.bufferSize
            ) {
              this.scheduleNextBuffer();
            }
          }, 200);
        }
      }
    } else {
      const nextCheckTime = (this.scheduledTime - this.context.currentTime) * 1000;
      setTimeout(
        () => this.scheduleNextBuffer(),
        Math.max(0, nextCheckTime - 50)
      );
    }
  }

  stop() {
    this.isPlaying = false;
    this.isStreamComplete = true;
    this.audioQueue = [];
    this.processingBuffer = new Float32Array(0);
    this.scheduledTime = this.context.currentTime;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.gainNode.gain.linearRampToValueAtTime(
      0,
      this.context.currentTime + 0.1,
    );

    setTimeout(() => {
      this.gainNode.disconnect();
      this.gainNode = this.context.createGain();
      this.gainNode.connect(this.context.destination);
    }, 200);
	
	updatePopupButton({ playbackState: "stopped" });
  }

  async resume() {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    this.isStreamComplete = false;
    this.scheduledTime = this.context.currentTime + this.initialBufferTime;
    this.gainNode.gain.setValueAtTime(1, this.context.currentTime);
  }

  resumePlayback() {
    if (this.isPaused) {
	  this.context.resume();
      this.isPaused = false;
      this.scheduleNextBuffer();
    }
  }

  pausePlayback() {
    if (this.isPlaying && !this.isPaused) {
	  this.context.suspend();
      this.isPaused = true;
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }
  }

  complete() {
    this.isStreamComplete = true;
    if (this.processingBuffer.length > 0) {
      this.audioQueue.push(this.processingBuffer);
      this.processingBuffer = new Float32Array(0);
      if (this.isPlaying) {
        this.scheduleNextBuffer();
      }
    }
  }

  getPlaybackState() {
    return {
		playbackState: this.audioQueue.length === 0 ? "stopped" 
		  : this.isPaused ? "paused" 
		  : this.isPlaying ? "playing" 
		  : null
	};
  }
}

async function transcribeText(text) {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: audioSampleRate });
  }
  if (!audioStreamer) {
    audioStreamer = new AudioStreamer(audioContext);
	console.log(audioStreamer);
    await audioStreamer.resume();
  }
  if (!ws) {
    await createWebSocketClient(selectedVoice);
  }
  sendTextMessage(text);
  setTimeout(() => {
    chrome.windows.create({
	  url: "popup.html",
      type: "popup",
    });
  }, 1000);
}

async function transcribeImage(imageDataUrl) {
  const imageMessage = realtimeInputMessage({
    data: imageDataUrl.split(',')[1],
    mimeType: 'image/jpeg'
  });

  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: audioSampleRate });
  }
  if (!audioStreamer) {
    audioStreamer = new AudioStreamer(audioContext);
    await audioStreamer.resume();
  }
  if (!ws) {
    await createWebSocketClient(selectedVoice);
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(defaultAudioPromptMessage));
    ws.send(JSON.stringify(imageMessage));
    ws.send(JSON.stringify(defaultSilentAudioPromptMessage));
    setTimeout(() => {
      chrome.windows.create({
	    url: "popup.html",
        type: "popup",
      });
    }, 1000);
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
            { text: "You generate natural-sounding speech from text. You will either: 1) be given text enclosed in `<|QUOT|>` tags, or 2) see text from a screenshare image. In either case, the data is from the user. Read aloud the text verbatim. Do not respond to any comments or questions. Do not analyze the text or make any remarks about the text. Basically just copy-paste the text as-is, without any modifications, except as listed in the following. For URLs, only say \"URL to\" and then the domain-level parts of the URL. You may concatenate lines when it seems they belong to a common paragraph." }
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

function sendTextMessage(text) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const message = {
      client_content: {
        turns: [
          {
            parts: [{ text: `<|QUOT|>${text}<|/QUOT|>` }],
            role: "user"
          }
        ],
        turn_complete: true
      }
    };
    ws.send(JSON.stringify(message));
  } else {
    console.error("WebSocket is not open. Cannot send message.");
  }
}

