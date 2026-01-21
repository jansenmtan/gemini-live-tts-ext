# Gemini Live TTS Chrome Extension (Enhanced v2.4)

> **Major Update v2.4.0**: Now supports **30 voices**, **TTS vs Native Audio** switching, and **Model Selection**!

This extension enables you to use Google's Gemini Multimodal Live API (and TTS API) to read selected text on any webpage. It supports real-time streaming, image understanding (in Native Audio mode), and a wide range of natural voices.

## ✨ New Features in v2.4

- **🎙️ Two API Modes:**
  - **Native Audio (Live API):** Real-time, supports system prompts (translation, style change), understands images. expensive but powerful.
  - **Text-to-Speech (TTS):** Cheaper, standard text reading. Ideal for long articles.
- **🤖 Model Selection:** Choose between `gemini-2.5-flash`, `gemini-2.5-pro` and other preview models.
- **🗣️ 30+ Voices:** Full support for all Gemini voices including Kore, Fenrir, Aoede, Charon, and more.
- **⚡ Fixed:** Resurrected the extension after Google deprecated old ephemeral models.

## 🚀 Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer Mode** (top right).
4. Click **Load unpacked** and select the extension folder.

## ⚙️ Configuration

1. Get your API Key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click the extension icon and select **Options**.
3. Enter your API Key.
4. Select **API Type** (Native Audio or TTS).
5. Choose your favorite **Voice** and **Model**.
6. (Optional) Set a System Prompt (e.g., "Translate to Spanish and read").

## 📝 Usage

1. **Select text** on any webpage.
2. Right-click and choose **"Transcribe with Gemini"**.
3. (Or click the extension icon to take a **screenshot** and have Gemini describe/read it - Native Audio only).

## 🛠️ Tech Stack

- Chrome Extension Manifest V3
- Gemini Live API (WebSocket)
- Gemini TTS API (REST)
- Native Audio / Web Audio API

## Credits

Original extension by [jansenmtan](https://github.com/jansenmtan).
Fixes and v2.0 updates by [tomfalkenberg](https://github.com/tomfalkenberg).
Major v2.4 overhaul (UI, Voices, TTS support) by **pinkigerl81-commits**.