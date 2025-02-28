[![Badge Issues]][Issues]
[![Badge License]][License]
[![Badge Mozilla]][Mozilla]
[![Badge Chrome]][Chrome]

---

# Gemini Live Text-to-Speech Extension

A browser extension that transcribes selected text to audio using Google Gemini Multimodal Live API.

[Install from Chrome Web Store](https://chromewebstore.google.com/detail/gemini-live-text-to-speec/olpjbfdakgoibngpmmihilbnlkabnlhl).
[Install from Firefox Add-Ons](https://addons.mozilla.org/en-US/firefox/addon/gemini-text-to-speech/).

## Features

- **Text transcription** - instantly convert selected text into natural-sounding speech.
- **Image transcription** – listen to a description of any image!
- Customizable voices and settings.
- Seamless integration with your browser.

## Installation

### Chrome/Edge/Brave

#### Chrome Web Store
[Install from Chrome Web Store](https://chromewebstore.google.com/detail/gemini-live-text-to-speec/olpjbfdakgoibngpmmihilbnlkabnlhl).

#### Manual installation
1. Download or clone this repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

### Firefox

#### Firefox Add-Ons
[Install from Firefox Add-Ons](https://addons.mozilla.org/en-US/firefox/addon/gemini-text-to-speech/).

#### Manual installation
1. Download or clone this repository
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..." and select the manifest.json file

## Usage

### Text Selection
1. Select text on any webpage
2. Right-click and choose "Transcribe selected text"
3. The extension will convert the text to speech

### Screenshot Capture
1. Click the extension icon in the toolbar
2. Draw a selection around the text you want to capture
3. The extension will process the image and read the text aloud

### Playback Controls
- Use the popup player to play/pause, stop, or adjust volume
- Close the popup to stop playback

<h3>Usage</h3>

<strong>Text to Speech:</strong>
- Select any text on a webpage, right-click, and choose "Transcribe with Gemini" from the context menu.

<strong>Image to Speech:</strong>
- Click the extension icon in your address bar to activate the image selection tool.
- Click and drag to select an area of the page to describe.

<strong>Playback Controls:</strong>
- Click the extension icon in your toolbar to open the playback control popup.

## Configuration

1. Click the settings icon in the popup or right-click the extension icon and select "Options"
2. Enter your Google Gemini API key
3. Select your preferred voice
4. Customize the system prompt if desired
5. Click "Save"

## API Key

<h3>Set Up Your API Key</h3>

1. Click the "Create API key" button at <a href="https://aistudio.google.com/apikey">Google AI Studio</a>.
2. Copy the key into the extension's settings page.
3. Press "Save".

<strong>Note:</strong> Keep your API key private and don't share it with others.

## Privacy

This extension sends text and screenshots to Google's Gemini API for processing. No data is stored by the extension itself beyond your settings. Please review Google's privacy policy for information on how they handle your data.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)

## Support

If you find this extension useful, consider supporting the developer:
- [Ko-fi](https://ko-fi.com/jansentan)

## Credits

Developed by Jansen Tan
