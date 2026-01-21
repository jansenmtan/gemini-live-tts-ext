# Changelog

## [2.4.0] - 2026-01-21

### Use this fork if you want:
- **30 New Voices**: Access to all Gemini 2.0 voices (Kore, Fenrir, Aoede, etc.)
- **Native Audio vs TTS**: Choose between Live API (WebSocket) for real-time interaction or TTS (REST) for cheap text reading.
- **Model Selection**: Choose specific models (Gemini 2.5 Flash, etc.)
- **Better UI**: Improved onboarding and options page.

### Added
- **API Type Selection**: Toggle between "Native Audio (Live API)" and "Text-to-Speech (TTS)".
  - Native Audio: Supports prompts, translation, images, emotional voices.
  - TTS: Cheaper, strictly reads text.
- **Model Selection**: Dropdown to select different models for both Native Audio and TTS modes.
- **30 Voices Support**: Added all available Gemini voices (Featured, Additional, Experimental).
- **TTS REST API Support**: Added `transcribeWithTTS` to support standard text-to-speech without WebSocket.
- **Onboarding Page**: Updated instructions to reflect new features.

### Changed
- **UI Overhaul**: Removed emojis to prevent display issues, added clear descriptions and badges.
- **Manifest**: Updated version to 2.4.0.
- **Error Handling**: Better error messages for quota limits and API errors.
- **Options Storage**: Now saves `apiType`, `selectedModel`, and `selectedModelTTS`.

### Fixed
- **API Model Deprecation**: Fixes "400 Bad Request" or "Internal Error" caused by deprecated ephemeral models.
- **Quota Issues**: Added fallback and proper error handling for "Quota Exceeded" errors.
- **Popup Error**: Fixed "Extension does not have a popup" console error.