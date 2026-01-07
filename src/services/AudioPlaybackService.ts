import { AudioContext, AudioManager } from 'react-native-audio-api';

export class AudioPlaybackService {
  private audioContext: AudioContext;
  private outputNode: any;
  private audioQueue: Array<{ buffer: any; base64Data: string }> = [];
  private isPlaying: boolean = false;
  private currentSource: any = null;

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
   * Adds audio chunk to queue and starts playback loop if not already playing
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

      // Add to queue
      this.audioQueue.push({ buffer: audioBuffer, base64Data });
      console.log(`📥 Queued: ${(audioBuffer.duration * 1000).toFixed(0)}ms (queue size: ${this.audioQueue.length})`);

      // Start playback loop if not already running
      if (!this.isPlaying) {
        this.playbackLoop();
      }

    } catch (error) {
      console.error('❌ Error queueing audio chunk:', error);
    }
  }

  /**
   * Playback loop - plays chunks sequentially from the queue
   * (Inspired by the Node.js Speaker example, adapted for Web Audio API)
   */
  private async playbackLoop() {
    this.isPlaying = true;

    while (this.audioQueue.length > 0) {
      const item = this.audioQueue.shift();
      if (!item) continue;

      await this.playChunk(item.buffer);
    }

    this.isPlaying = false;
    console.log('✅ Playback loop finished');
  }

  /**
   * Plays a single chunk and waits for it to finish
   */
  private playChunk(audioBuffer: any): Promise<void> {
    return new Promise((resolve) => {
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);

      this.currentSource = source;

      source.onEnded = () => {
        this.currentSource = null;
        console.log(`🎵 Played: ${(audioBuffer.duration * 1000).toFixed(0)}ms`);
        resolve();
      };

      // Start immediately
      source.start(0);
    });
  }

  /**
   * Stops all active playback and clears the queue
   */
  async stop() {
    // Clear the queue
    this.audioQueue.length = 0;

    // Stop current source if playing
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.currentSource = null;
    }

    this.isPlaying = false;
    console.log('🛑 Audio playback stopped and queue cleared');
  }

  /**
   * Handles interruption (when user speaks while AI is responding)
   */
  handleInterruption() {
    console.log('⚠️ Audio interrupted - clearing queue');
    this.stop();
  }
}
