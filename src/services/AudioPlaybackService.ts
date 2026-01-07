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

      // Use 16kHz to match the recording sample rate
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      this.outputNode = this.audioContext.createGain();
      this.outputNode.connect(this.audioContext.destination);
    } catch (error) {
      console.error('❌ Failed to initialize AudioPlaybackService:', error);
      throw error;
    }
  }

  /**
   * Decodes audio data using the golden copy's exact conversion logic
   */
  private async decodeAudioData(data: Uint8Array, sampleRate: number, numChannels: number): Promise<any> {
    const buffer = this.audioContext.createBuffer(
      numChannels,
      data.length / 2 / numChannels,
      sampleRate,
    );

    const dataInt16 = new Int16Array(data.buffer);
    const l = dataInt16.length;
    const dataFloat32 = new Float32Array(l);

    // Use golden copy's exact conversion: divide by 32768.0 (not asymmetric)
    for (let i = 0; i < l; i++) {
      dataFloat32[i] = dataInt16[i] / 32768.0;
    }

    // Handle mono audio (numChannels === 1)
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
   * Plays an audio chunk with seamless queueing
   */
  async playAudioChunk(base64Data: string) {
    try {
      // Ensure AudioContext is running
      if (this.audioContext.state !== 'running') {
        await this.audioContext.resume();
      }

      // Decode base64 to Uint8Array (matching golden copy)
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode to AudioBuffer using golden copy's logic
      const audioBuffer = await this.decodeAudioData(bytes, 16000, 1);

      // Calculate when to start this chunk
      const currentTime = this.audioContext.currentTime;

      // If this is the first chunk OR we're behind schedule, start immediately
      if (this.nextStartTime === 0 || this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

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

      // Start playback at the queued time
      source.start(this.nextStartTime);

      // Update next start time to be immediately after this chunk
      this.nextStartTime += audioBuffer.duration;

      console.log(`🎵 Playing: ${(audioBuffer.duration * 1000).toFixed(0)}ms, queue: ${((this.nextStartTime - currentTime) * 1000).toFixed(0)}ms`);

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
