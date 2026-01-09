import 'react-native-get-random-values';
import { GoogleGenAI, Modality } from '@google/genai';
import { NativeAudioPlaybackService } from './NativeAudioPlaybackService';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

export class GeminiService {
  private session: any;
  private client: GoogleGenAI;
  private playbackService: NativeAudioPlaybackService;
  private shouldRestartAfterTurn: boolean = false;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.playbackService = new NativeAudioPlaybackService();
  }

  /**
   * Connects to Gemini Live
   */
  async connect(callbacks: { onMessage: (msg: any) => void; onError: (err: any) => void }) {
    try {
      // Initialize native audio player immediately at session start
      console.log("🎵 Initializing native audio player (24kHz, mono)");
      await this.playbackService.initialize(24000, 1);

      this.session = await this.client.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            console.log('✅ Gemini Live session opened');
            callbacks.onMessage({ type: 'opened' });
          },
          onmessage: (msg: any) => {
            // Check for audio data (matching golden copy's approach)
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData;

            if (audio) {
              // Play the audio chunk (don't await - let it play asynchronously)
              this.playbackService.playAudioChunk(audio.data);
            }

            // Handle interruption (when user speaks while AI is responding)
            const interrupted = msg.serverContent?.interrupted;
            if (interrupted) {
              console.log("⚠️ Interrupted - stopping playback");
              this.playbackService.handleInterruption();
            }

            // Check if turn is complete - this means AI finished responding
            const turnComplete = msg.serverContent?.turnComplete;
            if (turnComplete && this.shouldRestartAfterTurn) {
              console.log("✅ Turn complete - starting next turn");
              this.shouldRestartAfterTurn = false;
              // Start listening for next turn
              if (this.session) {
                this.session.sendRealtimeInput({ activityStart: {} });
                console.log("🎙️ Started listening for next turn");
              }
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
          systemInstruction: "You are a speaking coach that will help and guide foreign language learners to improve their spoken English skills. I will speak to you in my target language and you will wait for me to finish and send you additional metrics data such as words per minute, pitch, etc. You will then provide Word Pronunciation Score, Sentence Pronunciation Score,Phoneme and Syllable level feedback,Fluency Score, Lexical stress, Intonation & fidelity detection,Pausing, pitch, speaking and articulation rate,Vocabulary, Grammar and Coherence scores. After providing feedback, suggest next steps for improvement and exercises to practice."
        },
      });

      console.log('Session initialized successfully');
    } catch (error) {
      console.error('Failed to connect to Gemini:', error);
      callbacks.onError(error);
    }
  }

  private chunkCount = 0;

  startActivity() {
    if (this.session) {
      console.log('🎙️ [GeminiService] Sending activityStart - beginning user turn');
      this.session.sendRealtimeInput({ activityStart: {} });
    } else {
      console.error('❌ [GeminiService] Cannot start activity - no active session');
    }
  }

  sendAudioChunk(pcmBlob: any) {
    if (this.session) {
      this.chunkCount++;
      if (this.chunkCount === 1) {
        console.log(`📤 [GeminiService] Started sending audio to Gemini`);
      }
      this.session.sendRealtimeInput({ media: pcmBlob });
    } else {
      console.error('❌ [GeminiService] Cannot send audio chunk - no active session');
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

    // 3. Set flag to restart after AI responds
    // The onmessage handler will detect turnComplete and restart automatically
    this.shouldRestartAfterTurn = true;
  }

  async stop() {
    await this.playbackService.stop();
    this.session?.close();
  }
}