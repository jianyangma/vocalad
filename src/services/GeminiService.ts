import 'react-native-get-random-values';
import { GoogleGenAI, Modality } from '@google/genai';
import { AudioPlaybackService } from './AudioPlaybackService';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

export class GeminiService {
  private session: any;
  private client: GoogleGenAI;
  private playbackService: AudioPlaybackService;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.playbackService = new AudioPlaybackService();
  }

  /**
   * Connects to Gemini Live
   */
  async connect(callbacks: { onMessage: (msg: any) => void; onError: (err: any) => void }) {
    try {
      this.session = await this.client.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            console.log('✅ Gemini Live session opened - Sending activityStart');
            // Send activityStart immediately after connection
            if (this.session) {
              this.session.sendRealtimeInput({ activityStart: {} });
            }
            callbacks.onMessage({ type: 'opened' });
          },
          onmessage: (msg: any) => {
            // LOG 1: See every raw message key
            console.log("📩 Raw Message Keys:", Object.keys(msg));

            // LOG 2: Deep inspect serverContent structure
            if (msg.serverContent) {
              console.log("🔍 serverContent keys:", Object.keys(msg.serverContent));
              if (msg.serverContent.modelTurn) {
                console.log("🔍 modelTurn keys:", Object.keys(msg.serverContent.modelTurn));
                console.log("🔍 modelTurn.parts:", JSON.stringify(msg.serverContent.modelTurn.parts));
              }
            }

            // Check for audio data (matching golden copy's approach)
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData;

            if (audio) {
              console.log("🔊 AUDIO RECEIVED! Bytes:", audio.data.length);
              // Play the audio chunk (don't await - let it play asynchronously)
              this.playbackService.playAudioChunk(audio.data);
            }

            // Handle interruption (when user speaks while AI is responding)
            const interrupted = msg.serverContent?.interrupted;
            if (interrupted) {
              console.log("⚠️ Interrupted - stopping playback");
              this.playbackService.handleInterruption();
            }

            callbacks.onMessage(msg);
          },
          onerror: (e: ErrorEvent) => {
            console.error('❌ Gemini Live error:', e.message);
            callbacks.onError(e);
          },
          onclose: (e: CloseEvent) => {
            console.log('🔌 Gemini Live session closed:', e.reason);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Orus' } },
          },
          realtimeInputConfig: {
            automaticActivityDetection: { disabled: true }
          },
          systemInstruction: "You are an IELTS speaking coach."
        },
      });

      console.log('Session initialized successfully');
    } catch (error) {
      console.error('Failed to connect to Gemini:', error);
      callbacks.onError(error);
    }
  }

  sendAudioChunk(pcmBlob: any) {
    if (this.session) {
      this.session.sendRealtimeInput({ media: pcmBlob });
    }
  }

  async completeTurn(metrics: any) {
    if (!this.session) return;

    // 1. Signal end of activity
    this.session.sendRealtimeInput({ activityEnd: {} });

    // 2. Inject local metrics as hidden context
    this.session.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text: `SYSTEM_METRICS: ${JSON.stringify(metrics)}` }]
      }],
      turnComplete: true
    });

    console.log("Turn signaled as complete. Waiting for Gemini response...");

    // 3. Start next turn automatically
    // Commented out for now - you can decide when to restart
    // this.session.sendRealtimeInput({ activityStart: {} });
  }

  async stop() {
    await this.playbackService.stop();
    this.session?.close();
  }
}