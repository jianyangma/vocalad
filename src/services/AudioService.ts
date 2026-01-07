import { AudioRecorder, AudioManager } from 'react-native-audio-api';
import { Audio } from 'expo-av';
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

  async start(onData: (blob: any) => void, onLocalBuffer: (pcm: Float32Array) => void) {
      // 1. Request Microphone Permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') throw new Error("Permission denied");

      // 2. Set the iOS Audio Category manually using expo-av
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      // 3. Configure the native AudioManager (if needed for sample rate)
      // Note: setAudioSessionCategory is the method in this library
      AudioManager.setAudioSessionOptions({
        iosCategory: "playAndRecord",
        iosMode: "voiceChat",
        iosOptions: ["defaultToSpeaker", "allowBluetooth"],
      });

    // This is our "T-Junction" callback
    this.recorder?.onAudioReady((event) => {
      // event.buffer is an AudioBuffer
      const float32Data = event.buffer.getChannelData(0);

      // TRACK A: Local Analysis (Pass the Float32Array directly)
      onLocalBuffer(float32Data);

      // TRACK B: Cloud (Gemini)
      // Create a blob
      const pcmBlob = this.createBlob(float32Data);
      onData(pcmBlob);
    });

    await this.recorder?.start();
  }

  // Creates a blob from Float32Array PCM data
  private createBlob(pcmData: Float32Array) {
    // Convert Float32 to Int16 PCM
    const pcm16 = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      const s = Math.max(-1, Math.min(1, pcmData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Convert to base64 and create blob-like object
    const base64Data = Buffer.from(pcm16.buffer).toString('base64');

    return {
      data: base64Data,
      mimeType: 'audio/pcm;rate=16000'
    };
  }

  stop() {
    this.recorder?.stop();
    console.log("Recorder Stopped");
  }
}