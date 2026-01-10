import 'react-native-get-random-values';
import { GoogleGenAI, Modality } from '@google/genai';
import { NativeAudioPlaybackService } from './NativeAudioPlaybackService';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

export class GeminiService {
  private session: any;
  private client: GoogleGenAI;
  private playbackService: NativeAudioPlaybackService;
  private audioChunksReceived: number = 0;
  private isInActiveTurn: boolean = false;
  private chunkCount = 0;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.playbackService = new NativeAudioPlaybackService();
  }

  async connect(callbacks: {
    onMessage: (msg: any) => void;
    onError: (err: any) => void;
    onAISpeaking?: (isSpeaking: boolean) => void;
  }) {
    try {
      await this.playbackService.initialize(24000, 1);

      this.session = await this.client.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            callbacks.onMessage({ type: 'opened' });
          },
          onmessage: (msg: any) => {
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData;

            if (audio) {
              if (this.audioChunksReceived === 0 && callbacks.onAISpeaking) {
                callbacks.onAISpeaking(true);
              }
              this.audioChunksReceived++;
              this.playbackService.playAudioChunk(audio.data);
            }

            const interrupted = msg.serverContent?.interrupted;
            if (interrupted) {
              this.playbackService.handleInterruption();
              this.audioChunksReceived = 0;
              if (callbacks.onAISpeaking) {
                callbacks.onAISpeaking(false);
              }
            }

            const turnComplete = msg.serverContent?.turnComplete;
            if (turnComplete) {
              this.audioChunksReceived = 0;
              this.chunkCount = 0;
              if (callbacks.onAISpeaking) {
                callbacks.onAISpeaking(false);
              }
              this.startActivity();
            }

            callbacks.onMessage(msg);
          },
          onerror: (e: ErrorEvent) => {
            callbacks.onError(e);
          },
          onclose: () => {
            // Session closed
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
          systemInstruction: "You are my personal assistant. Help me with tasks and any questions I have"
        },
      });
    } catch (error) {
      callbacks.onError(error);
    }
  }

  startActivity() {
    if (this.session) {
      this.session.sendRealtimeInput({ activityStart: {} });
      this.isInActiveTurn = true;
    }
  }

  sendAudioChunk(pcmBlob: any) {
    if (!this.session || !this.isInActiveTurn) {
      return;
    }

    this.chunkCount++;
    this.session.sendRealtimeInput({ media: pcmBlob });
  }

  async completeTurn(metrics: any) {
    if (!this.session || !this.isInActiveTurn) {
      return;
    }

    this.isInActiveTurn = false;

    this.session.sendRealtimeInput({ activityEnd: {} });

    this.session.sendClientContent({
      turns: [{
        role: 'user',
        parts: [{ text: `SYSTEM_METRICS: ${JSON.stringify(metrics)}` }]
      }],
      turnComplete: true
    });
  }

  async stop() {
    await this.playbackService.stop();
    this.session?.close();
  }
}
