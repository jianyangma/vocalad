import { AudioContext, AudioManager } from 'react-native-audio-api';

export class AudioPlaybackService {
  private audioContext: AudioContext;
  private outputNode: any;
  private nextStartTime: number = 0;
  private activeSources: Set<any> = new Set();

  constructor() {
    try {
      // Ensure iOS audio session is configured for playback
      AudioManager.setAudioSessionOptions({
        iosCategory: "playAndRecord",
        iosMode: "voiceChat",
        iosOptions: ["defaultToSpeaker", "allowBluetooth"],
      });

      // Use 24kHz for output (matching Gemini's output sample rate)
      this.audioContext = new AudioContext({ sampleRate: 24000 });

      this.outputNode = this.audioContext.createGain();
      this.outputNode.connect(this.audioContext.destination);
    } catch (error) {
      console.error('❌ Failed to initialize AudioPlaybackService:', error);
      throw error;
    }
  }

  /**
   * Decodes audio data (base64 PCM → AudioBuffer)
   */
  private decodeAudioData(data: Uint8Array, sampleRate: number, numChannels: number): any {
    const buffer = this.audioContext.createBuffer(
      numChannels,
      data.length / 2 / numChannels,
      sampleRate,
    );

    const dataInt16 = new Int16Array(data.buffer);
    const l = dataInt16.length;
    const dataFloat32 = new Float32Array(l);

    // Convert Int16 PCM to Float32 (range: -1.0 to 1.0)
    for (let i = 0; i < l; i++) {
      dataFloat32[i] = dataInt16[i] / 32768.0;
    }

    // Copy to mono channel
    if (numChannels === 1) {
      buffer.copyToChannel(dataFloat32, 0);
    } else {
      // Extract interleaved channels for stereo
      for (let i = 0; i < numChannels; i++) {
        const channel = dataFloat32.filter(
          (_, index) => index % numChannels === i,
        );
        buffer.copyToChannel(channel, i);
      }
    }

    return buffer;
  }

  /**
   * Plays audio chunk with seamless time-based scheduling
   * This eliminates gaps between chunks by scheduling them precisely
   */
  playAudioChunk(base64Data: string) {
    try {
      // Ensure AudioContext is running
      if (this.audioContext.state !== 'running') {
        this.audioContext.resume();
      }

      // Decode base64 to Uint8Array
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode to AudioBuffer (24kHz to match AudioContext sample rate)
      const audioBuffer = this.decodeAudioData(bytes, 24000, 1);

      // Calculate when to start this chunk
      const currentTime = this.audioContext.currentTime;

      // Initialize timing on first chunk or if we've fallen behind
      if (this.nextStartTime === 0 || this.nextStartTime < currentTime) {
        // Start with minimal delay (50ms buffer for stability)
        this.nextStartTime = currentTime + 0.05;
      }

      // Note: We don't cap the queue depth. Chunks arrive in bursts faster than real-time,
      // and capping creates out-of-order playback. Let the queue build naturally.

      // Create buffer source and schedule playback
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);

      // Track active source
      this.activeSources.add(source);

      // Clean up when done
      source.onEnded = () => {
        this.activeSources.delete(source);
      };

      // Start playback at the scheduled time (seamless queueing)
      source.start(this.nextStartTime);

      // Schedule next chunk to start exactly when this one ends (no gaps!)
      this.nextStartTime += audioBuffer.duration;

      const queueDepth = this.nextStartTime - currentTime;
      console.log(`🎵 Scheduled: ${(audioBuffer.duration * 1000).toFixed(0)}ms @ ${this.nextStartTime.toFixed(3)}s (queue: ${(queueDepth * 1000).toFixed(0)}ms)`);

    } catch (error) {
      console.error('❌ Error playing audio chunk:', error);
    }
  }

  /**
   * Stops all active playback and clears the queue
   */
  async stop() {
    // Stop all active sources
    for (const source of this.activeSources.values()) {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
    }
    this.activeSources.clear();

    // Reset timing
    this.nextStartTime = 0;
    console.log('🛑 Audio playback stopped');
  }

  /**
   * Handles interruption (when user speaks while AI is responding)
   */
  handleInterruption() {
    console.log('⚠️ Audio interrupted');
    this.stop();
  }
}
