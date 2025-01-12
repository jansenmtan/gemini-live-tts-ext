const playPauseButton = document.getElementById('playPause');
const stopButton = document.getElementById('stop');
const statusDiv = document.getElementById('status');

function updateButton(playbackState) {
  playPauseButton.textContent = playbackState === "playing" ? 'Pause' : 'Play';
  playPauseButton.disabled = playbackState === "stopped" ? true : false;
  switch (playbackState) {
	case "playing":
	  statusDiv.textContent = 'Playing audio';
	  break;
	case "paused":
	  statusDiv.textContent = 'Paused audio';
	  break;
	case "stopped":
	  statusDiv.textContent = 'No audio to play';
	  break;
	default:
	  console.log(`updateButton default case:`, playbackState);
  }
}

playPauseButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: playPauseButton.textContent === 'Play' ? "resumePlayback" : "pausePlayback" }, (response) => {
	updateButton(response.playbackState);
  });
});

stopButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "stopPlayback" }, (response) => {
	updateButton(response.playbackState);
  });
});

// Request initial playback state on popup load
chrome.runtime.sendMessage({ action: "getPlaybackState" }, (response) => {
  updateButton(response.playbackState);
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
