# Click Tracker EMP

Click Tracker EMP is a powerful Chromium-based extension designed for comprehensive interaction tracking. It monitors page visits, element clicks, and detailed Gmail activity, providing real-time logging to a centralized monitoring API.

## 🚀 Features

### 1. Smart Authentication System

- **Secure Login**: Dedicated login portal for user credentials.
- **Token Management**: Utilizes `chrome.storage.local` for secure session persistence.
- **Auto-Refresh**: Automatically refreshes the `accessToken` every 5 hours to ensure uninterrupted tracking.
- **Proactive Prompts**: Surfaces a red "**!**" badge and attempts to open the login popup if the user becomes unauthenticated.

### 2. Interaction Tracking

- **Page Visits**: Automatically logs URLs and page titles when tabs are loaded or switched.
- **Click Tracking**: Captures the exact element interacted with (labels, button text, ARIA-labels).
- **History Management**: Stores a local feed of events from the last 24 hours (up to 1,000 items).

### 3. Advanced Gmail Monitoring

- **Sent Emails**: Captures outgoing email details including To, CC, BCC, Subject, Body, and File Attachments (up to 10MB).
- **Received Emails**: Automatically extracts sender info, subject, and body when an email is opened.
- **Detailed Recipient Parsing**: Deep-scans Gmail's "Show Details" table to accurately separate To, CC, and BCC recipients of received mail.

### 4. Technical Architecture

- **Manifest V3**: Built using the latest Chrome Extension standards.
- **Webpack Bundling**: Optimized build process with environment variable support.
- **Clean API Integration**: Sends all data as structured `FormData` to the backend.

---

## 🛠️ Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/)

### Step 1: Clone and Install

```bash
git clone <repository-url>
cd click-tracker-emp
npm install
```

### Step 2: Configuration

Create a `.env` file in the root directory and specify your API domain:

```env
API_DOMAIN=https://track.dev.empmonitor.com
```

### Step 3: Build the Extension

```bash
npm run build
```

This will generate a `dist/` folder containing the compiled extension.

### Step 4: Load into Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle at the top right).
3. Click **Load unpacked**.
4. Select the `dist/` folder in your project directory.

---

## 📁 Project Structure

```text
├── src/
│   ├── manifest.json    # Extension manifest
│   ├── background.js    # Service worker (Auth, API logic, Tab monitoring)
│   ├── content.js       # DOM interactions (Click & Gmail tracking)
│   ├── popup.html/js/css # Extension UI history feed
│   └── login.html/js    # Authentication portal
├── dist/                # Production build output
├── webpack.config.js    # Build configuration
└── .env                 # Environment variables
```

---

## 🛡️ Security & Privacy

- **Context Awareness**: Content scripts include safety checks (`chrome.runtime.id`) to prevent errors when the extension reloads.
- **Graceful Failure**: If the API returns a `401 Unauthorized`, the extension automatically clears local auth data and prompts for re-login.
- **Attachment Limits**: Large files (>10MB) are flagged but not stored locally to prevent browser storage quota issues.

## 📜 Development Commands

- `npm run build`: One-time production build.
- `npm run dev`: Watches for changes and rebuilds automatically.

---

© 2026 EMP Monitor. All rights reserved.
