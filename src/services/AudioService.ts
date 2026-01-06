import { AudioRecorder, AudioBuffer } from 'react-native-audio-api';
import { Buffer } from 'buffer';

export class AudioService {
  private recorder?: AudioRecorder;

  constructor() {
    // We initialize with the settings Gemini Live expects
    this.recorder = new AudioRecorder({
      sampleRate: 16000,
      bufferLengthInSamples: 2048, // Smaller buffer = lower latency for real-time
    });
  }

  async start(onData: (base64: string) => void, onLocalBuffer: (pcm: Float32Array) => void) {
    // This is our "T-Junction" callback
    this.recorder?.onAudioReady((event) => {
      // event.buffer is an AudioBuffer
      const float32Data = event.buffer.getChannelData(0);

      // TRACK A: Local Analysis (Pass the Float32Array directly)
      onLocalBuffer(float32Data);

      // TRACK B: Cloud (Gemini)
      // Gemini expects 16-bit PCM (Int16), so we convert it
      const pcm16Base64 = this.float32ToPcm16Base64(float32Data);
      onData(pcm16Base64);
    });

    await this.recorder?.start();
  }

  private float32ToPcm16Base64(float32Array: Float32Array): string {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return Buffer.from(pcm16.buffer).toString('base64');
  }

  stop() {
    this.recorder?.stop();
    console.log("Recorder Stopped");
  }
}