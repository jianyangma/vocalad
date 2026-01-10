import { AudioRecorder, AudioManager } from 'react-native-audio-api';
import { Audio } from 'expo-av';
import { Buffer } from 'buffer';

export class AudioService {
  private recorder?: AudioRecorder;

  constructor() {
    this.recorder = new AudioRecorder({
      sampleRate: 16000,
      bufferLengthInSamples: 2048,
    });
  }

  async start(onData: (blob: any) => void, onLocalBuffer: (pcm: Float32Array) => void) {
    try {
      if (!this.recorder) {
        throw new Error('Recorder not initialized');
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error("Permission denied");
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      AudioManager.setAudioSessionOptions({
        iosCategory: "playAndRecord",
        iosMode: "voiceChat",
        iosOptions: ["defaultToSpeaker", "allowBluetooth"],
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      this.recorder.onAudioReady((event) => {
        const float32Data = event.buffer.getChannelData(0);

        try {
          onLocalBuffer(float32Data);
        } catch (error) {
          // Error in local buffer processing
        }

        try {
          const pcmBlob = this.createBlob(float32Data);
          onData(pcmBlob);
        } catch (error) {
          // Error sending to Gemini
        }
      });

      this.recorder.start();
    } catch (error) {
      throw error;
    }
  }

  private createBlob(pcmData: Float32Array) {
    const pcm16 = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      const s = Math.max(-1, Math.min(1, pcmData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const base64Data = Buffer.from(pcm16.buffer).toString('base64');

    return {
      data: base64Data,
      mimeType: 'audio/pcm;rate=16000'
    };
  }

  stop() {
    this.recorder?.stop();
  }
}
