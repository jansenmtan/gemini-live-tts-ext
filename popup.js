const playPauseButton = document.getElementById('playPause');
const stopButton = document.getElementById('stop');
const volumeControl = document.getElementById('volumeControl');
const volumeValue = document.getElementById('volumeValue');

function updateButton(playbackState) {
  playPauseButton.textContent = playbackState === "playing" ? '⏸' : '▶';
  playPauseButton.disabled = playbackState === "stopped" ? true : false;
}

playPauseButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: playPauseButton.textContent === '▶' ? "resumePlayback" : "pausePlayback" }, (response) => {
	updateButton(response.playbackState);
  });
});

stopButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "stopPlayback" }, (response) => {
	updateButton(response.playbackState);
  });
});

volumeControl.addEventListener('input', () => {
  const volume = volumeControl.value;
  volumeValue.textContent = `${volume}%`;
  chrome.runtime.sendMessage({
    action: "setVolume",
    volume: volume / 100
  });
});

// Request initial playback state on popup load
chrome.runtime.sendMessage({ action: "getPlaybackState" }, (response) => {
  updateButton(response.playbackState);
});

chrome.runtime.sendMessage({ action: "getVolume" }, (response) => {
  if (response && response.volume !== undefined) {
    volumeControl.value = response.volume * 100;
    volumeValue.textContent = `${Math.round(response.volume * 100)}%`;
  }
});

// Listener for relevant messages to update button text
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updatePlaybackState") {
	if (request.playbackState === "stopped") {
	  window.close();
	}
    updateButton(request.playbackState);
  }
});
