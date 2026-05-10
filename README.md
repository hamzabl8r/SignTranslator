# 🖥️ Sign Language Video Call — Frontend

A real-time video call application with **live sign language detection and translation**, built with React. Users can video call each other and have their hand gestures automatically detected, translated, and sent as chat messages to the other participant.

---

## ✨ Features

- 📹 **WebRTC video calls** — peer-to-peer using `simple-peer`
- 🤟 **Live sign language detection** — powered by MediaPipe Hands
- 🔁 **Real-time translation sharing** — predictions sent to the other user via Socket.io
- 💬 **In-call chat** — text and sign translations side by side
- 🔀 **Resilient AI server fallback** — auto-switches between Render and ngrok if one fails
- 🟢 **Early hand detection** — MediaPipe initializes before the call connects for zero-lag detection

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 |
| State management | Redux Toolkit |
| Real-time | Socket.io client |
| Video/Audio | WebRTC via `simple-peer` |
| Hand detection | `@mediapipe/hands` (CDN WASM) |
| HTTP client | Axios |
| Notifications | react-hot-toast |
| Build config | craco |

---

## 📁 Project Structure

```
├── public/
└── src/
    ├── component/           # All React components (VideoCall, Chat, etc.)
    ├── hooks/               # Custom React hooks
    ├── redux/               # Redux store, slices, actions
    ├── services/            # socketService and other API singletons
    ├── App.js
    ├── App.css
    ├── index.js
    └── index.css
├── .gitignore
├── config-overrides.js      # Webpack overrides (used with craco)
├── craco.config.js
├── package.json
└── README.md
```

---

## ⚙️ Environment Variables

Create a `.env` file at the project root:

```env
REACT_APP_BACKEND_URL=https://backpfe-production-789f.up.railway.app
REACT_APP_AI_SERVER_URL_1=https://zen-footing-depravity.ngrok-free.dev
REACT_APP_AI_SERVER_URL_2=https://modelsigntranslator.onrender.com
```

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/hamzabl8r/SignTranslator.git
cd SignTranslator

# Install dependencies
npm install

# Start the development server
npm start
```

The app will run on `http://localhost:3000`.

---

## 🔌 Socket Events

| Event (emit) | Payload | Description |
|---|---|---|
| `call_user` | `{ fromUserId, toUserId, signal, callerInfo }` | Initiate a call |
| `accept_call` | `{ toUserId, fromUserId, signal }` | Accept an incoming call |
| `end_call` | `{ toUserId, fromUserId }` | End/hang up a call |
| `send_translation` | `{ text, toUserId, fromUserId, isSign }` | Send a translation or chat message |

| Event (listen) | Description |
|---|---|
| `call_accepted` | Remote peer accepted the call |
| `call_ended` | Remote peer hung up |
| `call_rejected` | Remote peer rejected the call |
| `receive_translation` | Incoming translation or chat message |

---

## 🤟 How Sign Detection Works

1. As soon as the user's camera is available, **MediaPipe Hands** initializes and loads the WASM model
2. Every **500ms**, a video frame is drawn onto a canvas and sent to MediaPipe
3. If a hand is detected, 21 landmark coordinates (42 values: x, y per point) are extracted
4. Once the call is **connected**, those landmarks are POSTed to the AI server (`/predict`)
5. The predicted sign word is displayed as an overlay on the local video and sent to the remote user via Socket.io

---

## 🔁 AI Server Fallback

On mount, all AI server URLs are pinged **concurrently**. The first to respond becomes the active server. During calls, if a `/predict` request fails, the next URL in the list is tried automatically — no manual intervention needed.

```js
const AI_SERVER_URLS = [
  'https://zen-footing-depravity.ngrok-free.dev',  // ngrok (local dev)
  'https://modelsigntranslator.onrender.com',       // Render (production)
];
```

---

## 📦 Key Dependencies

```json
{
    "@mediapipe/camera_utils": "^0.3.1675466862",
    "@mediapipe/hands": "^0.4.1675469240",
    "@reduxjs/toolkit": "^2.11.2",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^13.5.0",
    "assert": "^2.1.0",
    "axios": "^1.15.1",
    "buffer": "^6.0.3",
    "customize-cra": "^1.0.0",
    "lucide-react": "^1.8.0",
    "process": "^0.11.10",
    "react": "^18.3.1",
    "react-app-rewired": "^2.2.1",
    "react-dom": "^18.3.1",
    "react-helmet-async": "^3.0.0",
    "react-hot-toast": "^2.6.0",
    "react-redux": "^9.2.0",
    "react-router-dom": "^6.30.3",
    "react-scripts": "5.0.1",
    "react-webcam": "^7.2.0",
    "simple-peer": "^9.11.1",
    "socket.io-client": "^4.8.3",
    "stream-browserify": "^3.0.0",
    "util": "^0.12.5",
    "web-vitals": "^2.1.4"
  }
```

---

## 🐛 Known Limitations

- MediaPipe WASM loads from CDN — requires internet access even in local dev
- Render.com free tier has a ~40s cold start; the app shows a status indicator while waiting
- WebRTC requires HTTPS in production (or `localhost` in dev)
