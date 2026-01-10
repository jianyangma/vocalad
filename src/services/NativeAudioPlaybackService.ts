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
  private sampleRate: number = 24000;
  private channels: number = 1;

  async initialize(sampleRate: number = 24000, channels: number = 1): Promise<void> {
    if (!AudioStreamPlayer) {
      throw new Error('AudioStreamPlayer native module not available');
    }

    this.sampleRate = sampleRate;
    this.channels = channels;

    AudioStreamPlayer.initialize(sampleRate, channels);
    this.isInitialized = true;
  }

  playAudioChunk(base64Data: string): void {
    if (!this.isInitialized || !AudioStreamPlayer) {
      return;
    }

    try {
      AudioStreamPlayer.writeBuffer(base64Data);
    } catch (error) {
      // Error playing audio chunk
    }
  }

  stop(): void {
    if (AudioStreamPlayer) {
      AudioStreamPlayer.stop();
    }
    this.isInitialized = false;
  }

  handleInterruption(): void {
    if (AudioStreamPlayer) {
      AudioStreamPlayer.stop();
    }
  }
}
