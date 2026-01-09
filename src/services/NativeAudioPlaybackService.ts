import { NativeModules } from 'react-native';

const { AudioStreamPlayer } = NativeModules;

/**
 * Native audio playback service using sequential buffer writing
 * Similar to the Node.js Speaker API - just write buffers and they play in order
 *
 * iOS: Uses AVAudioPlayerNode with AVAudioEngine
 * Android: Uses AudioTrack in MODE_STREAM
 */
export class NativeAudioPlaybackService {
  private isInitialized: boolean = false;
  private sampleRate: number = 24000; // Gemini outputs 24kHz
  private channels: number = 1; // Mono

  constructor() {
    if (!AudioStreamPlayer) {
      console.error('❌ AudioStreamPlayer native module not found!');
      console.error('Make sure you have run "pod install" and rebuilt the app');
    }
  }

  /**
   * Initialize the native audio player
   */
  async initialize(sampleRate: number = 24000, channels: number = 1): Promise<void> {
    if (!AudioStreamPlayer) {
      throw new Error('AudioStreamPlayer native module not available');
    }

    this.sampleRate = sampleRate;
    this.channels = channels;

    AudioStreamPlayer.initialize(sampleRate, channels);
    this.isInitialized = true;

    console.log(`✅ NativeAudioPlaybackService initialized: ${sampleRate}Hz, ${channels} channels`);
  }

  /**
   * Play an audio chunk - just writes it to the queue!
   * No scheduling, no timing calculations - buffers play sequentially
   */
  playAudioChunk(base64Data: string): void {
    if (!this.isInitialized || !AudioStreamPlayer) {
      console.warn('⚠️ Audio player not initialized');
      return;
    }

    try {
      // Simply write the buffer - it will play in sequence
      AudioStreamPlayer.writeBuffer(base64Data);
    } catch (error) {
      console.error('❌ Error playing audio chunk:', error);
    }
  }

  /**
   * Stop playback and clear buffer
   */
  stop(): void {
    if (AudioStreamPlayer) {
      AudioStreamPlayer.stop();
    }
    this.isInitialized = false;
    console.log('🛑 Native audio playback stopped');
  }

  /**
   * Handle interruption (when user speaks while AI is responding)
   */
  handleInterruption(): void {
    console.log('⚠️ Audio interrupted');
    this.stop();
  }
}
