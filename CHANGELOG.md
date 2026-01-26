## [2.2.1-firefox] - 2026-01-26

### 🐛 Bug Fixes

- Update model to `gemini-2.5-flash-native-audio-preview-12-2025`

### 📚 Documentation

- Add `CHANGELOG.md`
- Update `CHANGELOG.md`

### ⚙️ Miscellaneous Tasks

- Bump version to `2.2.1`
## [2.2.0-firefox] - 2025-05-22

### 🚀 Features

- Add `README.md`
- Add FAQ page
- Hide api key by default

### 🐛 Bug Fixes

- Preserve volume across browser session close and reopen

### ⚙️ Miscellaneous Tasks

- Bump version to `2.2.0`
## [1.0.0] - 2025-02-01

### 🚀 Features

- Add options page
- Add voice selection
- Add pause/resume/stop playback functionality
- Add proof-of-concept of image input
- Add more convenient image input feature
- Add ability to customize system prompt
- Add volume control
- Add original icons
- Add nice looking stylesheet `styles.css`
- Add onboarding page
- Add header banner to `popup.html`
- Add error handling and error notifications

### 🐛 Bug Fixes

- Dumb workaround for performance issue regarding `checkInterval`
- Restructure system prompt and text input prompt to not use `<|QUOT|>`
- Improve system prompt
- 3 small, random changes
- Properly encode `request.raw` to 16kHz PCM (rather than 32kHz PCM)
- Improve system prompt
- Refresh volume before sending messages
- Update default system prompt
- Maintain consistent extension name

### 🚜 Refactor

- Change 'update playback state' mechanism
- Move AudioStreamer away from `background.js` and to its own file
- Move shared code from `transcribeText`/`Image` to `transcribeMessages`
- Remove image testing temp feature from options

### 📚 Documentation

- Add redistrib notice

### 🎨 Styling

- Make screenshot selection box have `1 px` border and more transparent

### ⚙️ Miscellaneous Tasks

- Bump version to `1.0.0`
