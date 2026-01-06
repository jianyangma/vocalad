import 'react-native-get-random-values'; 
import { GoogleGenAI, Modality } from '@google/genai';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

export class GeminiService {
  private session: any;
  private authClient: any; // Used only to generate the token
  private liveClient: any; // The actual AI client used for the session

  constructor(apiKey: string) {
    // Initial client with your master key to provision tokens
    this.authClient = new GoogleGenAI({ apiKey });
  }

  /**
   * 1. Generates a short-lived ephemeral token
   */
  private async getEphemeralToken() {
    console.log("Generating Ephemeral Token...");
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    const token = await this.authClient.authTokens.create({
      config: {
        uses: 1,
        expireTime: expireTime,
        liveConnectConstraints: {
          model: MODEL_NAME,
          config: {
            sessionResumption: {},
            temperature: 0.7,
            responseModalities: [Modality.AUDIO]
          }
        },
        httpOptions: {
          apiVersion: 'v1alpha'
        }
      }
    });

    return token.name; // This is the "temporary API key"
  }

  /**
   * 2. Connects to Gemini Live using the Ephemeral Token
   */
  async connect(callbacks: { onMessage: (msg: any) => void; onError: (err: any) => void }) {
  try {
    const ephemeralKey = await this.getEphemeralToken();
    
    this.liveClient = new GoogleGenAI({ 
        apiKey: ephemeralKey,
        httpOptions: { apiVersion: 'v1alpha' } 
    });

    // We store the session in a local variable first
    const activeSession = await this.liveClient.live.connect({
      model: MODEL_NAME,
      config: {
        responseModalities: [Modality.AUDIO],
        realtimeInputConfig: {
          automaticActivityDetection: { disabled: true }
        },
        systemInstruction: "You are an IELTS speaking coach."
      },
      callbacks: {
        onmessage: callbacks.onMessage,
        onerror: callbacks.onError,
        onopen: () => {
          console.log("Socket opened. Finalizing handshake...");
          // Use a tiny delay to ensure the 'activeSession' assignment is complete
          setTimeout(() => {
            if (activeSession) {
              console.log("Session Handshake Complete - Sending Start Signal");
              activeSession.sendRealtimeInput({ activityStart: {} });
            }
          }, 10); 
        }
      }
    });

    this.session = activeSession;

  } catch (error) {
    callbacks.onError(error);
  }
}

  sendAudioChunk(base64Data: string) {
if (this.session && typeof this.session.sendRealtimeInput === 'function') {
    this.session.sendRealtimeInput({
        audio: {
          data: base64Data,
          mimeType: "audio/pcm;rate=16000"
        }
      });
    }
  }

  async completeTurn(metrics: any) {
    if (!this.session) return;
    this.session.sendRealtimeInput({ activityEnd: {} });
    this.session.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text: `SYSTEM_METRICS: ${JSON.stringify(metrics)}` }]
      }],
      turnComplete: true
    });
    this.session.sendRealtimeInput({ activityStart: {} });
  }

  stop() {
    this.session?.close();
  }
}