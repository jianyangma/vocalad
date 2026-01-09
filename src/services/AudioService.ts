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
    try {
      console.log('🎤 [AudioService] Starting audio capture...');

      if (!this.recorder) {
        throw new Error('Recorder not initialized');
      }

      // 1. Request Microphone Permissions
      console.log('🎤 [AudioService] Requesting microphone permissions...');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('❌ [AudioService] Microphone permission denied');
        throw new Error("Permission denied");
      }
      console.log('✅ [AudioService] Microphone permission granted');

      // 2. Set the iOS Audio Category manually using expo-av
      console.log('🎤 [AudioService] Setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      console.log('✅ [AudioService] Audio mode set');

      // 3. Configure the native AudioManager (if needed for sample rate)
      console.log('🎤 [AudioService] Configuring AudioManager...');
      AudioManager.setAudioSessionOptions({
        iosCategory: "playAndRecord",
        iosMode: "voiceChat",
        iosOptions: ["defaultToSpeaker", "allowBluetooth"],
      });
      console.log('✅ [AudioService] AudioManager configured');

      // Small delay to let audio session stabilize (helps with iOS simulator issues)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Track number of audio buffers received
      let bufferCount = 0;

      // This is our "T-Junction" callback - set up BEFORE starting
      this.recorder.onAudioReady((event) => {
        bufferCount++;

        // event.buffer is an AudioBuffer
        const float32Data = event.buffer.getChannelData(0);

        if (bufferCount === 1) {
          console.log(`🎤 [AudioService] Audio streaming started (${float32Data.length} samples per buffer)`);
        }

        // TRACK A: Local Analysis (Pass the Float32Array directly)
        try {
          onLocalBuffer(float32Data);
        } catch (error) {
          console.error('❌ [AudioService] Error in onLocalBuffer:', error);
        }

        // TRACK B: Cloud (Gemini)
        // Create a blob
        try {
          const pcmBlob = this.createBlob(float32Data);
          onData(pcmBlob);
        } catch (error) {
          console.error('❌ [AudioService] Error sending to Gemini:', error);
        }
      });

      console.log('🎤 [AudioService] Starting recorder...');
      this.recorder.start();
      console.log('✅ [AudioService] Recorder started - listening for audio buffers...');

      // Wait a moment and check if we're getting buffers
      setTimeout(() => {
        if (bufferCount === 0) {
          console.warn('⚠️ [AudioService] No audio buffers received after 2 seconds!');
          console.warn('⚠️ [AudioService] This may indicate an iOS Simulator audio issue.');
          console.warn('⚠️ [AudioService] Try testing on a real iOS device.');
        }
      }, 2000);
    } catch (error) {
      console.error('❌ [AudioService] Failed to start recording:', error);
      throw error;
    }
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
    console.log('🛑 [AudioService] Stopping audio capture');
    this.recorder?.stop();
  }
}