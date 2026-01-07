# 🎙️ Gemini Live Speech Coach (React Native)

An intelligent, real-time speech assessment and coaching app. It provides instant feedback on pronunciation (phonemes), fluency (WPM), and prosody (pitch/intonation) by combining on-device signal processing with the **Gemini Live Multimodal API**.

## 🎯 Project Goals

- **Manual Turn Control:** Full control over the AI response trigger using activityStart and activityEnd markers.
- **Real-time Coaching:** Provide a "Live" conversational experience where an AI coach listens and responds with human-like latency.
- **Technical Metrics:** Extract precise acoustic data (Pitch, Loudness, WPM) locally to avoid expensive cloud-processing costs.
- **IELTS/CEFR Scoring:** Map user performance to official international speech standards using Gemini's reasoning capabilities.
- **Privacy-First:** Perform sensitive phoneme alignment on-device using ONNX Runtime.

## 🛠️ Tech Stack

| Category          | Technology                                          |
| ----------------- | --------------------------------------------------- |
| **Framework**     | React Native (New Architecture / Fabric)            |
| **AI Brain**      | Google Gemini 2.5 Flash (Live API via WebSockets)   |
| **Audio Engine**  | `react-native-audio-api` (Web Audio API for Mobile) |
| **Local Metrics** | `Meyda.js` (Acoustics), `Pitchy` (F0 Tracking)      |
| **Phonetics**     | `onnxruntime-react-native` (Wav2Vec2 Phoneme model) |
| **Language**      | TypeScript                                          |

---

## 🧬 Data Flow Explanation

The app uses a **Fan-out Architecture** to process audio streams in parallel without hardware conflicts.

1. **Start:** App sends session.sendRealtimeInput({ activityStart: {} }).
2. **Streaming:** PCM chunks (16-bit, 16kHz) are fanned out to:

- **Gemini:** Audio chunks are base64 encoded and sent to Gemini Live via Via sendRealtimeInput({ audio: ... }).
- **Local Analyst:** The same chunks are sent to a `LocalMetricEngine` class.

3. **Local Analysis:**

- `Meyda` calculates RMS (Loudness) and ZCR (Voice activity).
- `Pitchy` detects the fundamental frequency (Intonation).
- `ONNX Runtime` processes phonemes for accuracy scoring.

4. **Synthesis:** Local stats are sent to Gemini as "hidden context" during the turn. Gemini then uses these stats to give verbal feedback like: _"Your pitch didn't rise enough on the word 'specifically'."_

End: User stops speaking. App sends activityEnd to close the audio buffer.

Inject: App sends a clientContent message with the JSON of local metrics (WPM, Pitch, Phoneme errors).

Response: Gemini synthesizes the audio context + data packet to provide verbal coaching.

---

## 🚀 How to Run

### 1. Prerequisites

- Node.js v18+
- **Gemini API Key:** Get one from [Google AI Studio](https://aistudio.google.com/).
- iOS/Android Development environment (CocoaPods for iOS).

### 2. Setup

```bash
# Install dependencies
npm install

# Install Native Pods (iOS only)
cd ios && pod install && cd ..

```

### 3. Environment Variables

Update the API key in the `SpeeechCoach.ts` file:

```env
const GEMINI_API_KEY = "<API_KEY>"; // Replace with your actual API key

```

### 4. Run the App

```bash
npx expo run:ios  # or run:android

```

---

## 📈 Roadmap

- [✅] **Phase 1:** Native Audio Capture & PCM Streaming.
- [✅] **Phase 2:** Integration with Gemini Live WebSocket.
- [ ] **Phase 3:** Local Pitch & Loudness Visualization.
- [ ] **Phase 4:** On-device Phoneme Recognition with ONNX.
- [ ] **Phase 5:** Final IELTS/CEFR Rubric Scoring Logic.

---
