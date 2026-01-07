import { PitchDetector } from 'pitchy';

export interface AcousticMetrics {
  // Pitch metrics
  pitch: number | null; // Fundamental frequency (F0) in Hz
  pitchConfidence: number;

  // Loudness
  rms: number; // Root mean square (already calculated, but Meyda provides it too)
  loudness: number;

  // Spectral features
  zcr: number; // Zero crossing rate
  spectralCentroid: number;
  spectralFlatness: number;

  // MFCCs (Mel-frequency cepstral coefficients) - useful for speech quality
  mfcc: number[];

  // Speech activity
  isSpeech: boolean; // Simple voice activity detection
}

export class AcousticAnalysisService {
  private pitchDetector: PitchDetector<Float32Array>;
  private sampleRate: number = 16000;

  constructor(sampleRate: number = 16000, bufferSize: number = 2048) {
    this.sampleRate = sampleRate;

    // Initialize Pitchy pitch detector
    this.pitchDetector = PitchDetector.forFloat32Array(bufferSize);
  }

  /**
   * Analyzes a single audio buffer and returns comprehensive acoustic metrics
   * @param audioBuffer Float32Array of audio samples (mono, 16kHz)
   */
  analyzeBuffer(audioBuffer: Float32Array): AcousticMetrics {
    // 1. Pitch detection using Pitchy (autocorrelation method)
    const pitch = this.detectPitch(audioBuffer);

    // 2. Acoustic features using Meyda
    const features = this.extractMeydaFeatures(audioBuffer);

    // 3. Simple voice activity detection
    const isSpeech = this.detectSpeech(features.rms, features.zcr);

    return {
      pitch: pitch.frequency,
      pitchConfidence: pitch.clarity,
      rms: features.rms,
      loudness: features.loudness,
      zcr: features.zcr,
      spectralCentroid: features.spectralCentroid,
      spectralFlatness: features.spectralFlatness,
      mfcc: features.mfcc,
      isSpeech
    };
  }

  /**
   * Detects pitch using Pitchy's pitch detection algorithm
   */
  private detectPitch(buffer: Float32Array): { frequency: number | null; clarity: number } {
    try {
      // PitchDetector requires exact buffer size (2048)
      // If buffer is smaller, pad it with zeros
      // If buffer is larger, skip pitch detection for this chunk
      if (buffer.length !== 2048) {
        if (buffer.length < 2048) {
          // Pad buffer to 2048 samples
          const paddedBuffer = new Float32Array(2048);
          paddedBuffer.set(buffer);
          buffer = paddedBuffer;
        } else {
          // Buffer too large - skip pitch detection
          return { frequency: null, clarity: 0 };
        }
      }

      // Use PitchDetector to find pitch
      const [frequency, clarity] = this.pitchDetector.findPitch(buffer, this.sampleRate);

      // Filter out unreliable detections or non-speech frequencies
      // Human speech fundamental frequency: ~80-400 Hz (male: 80-180, female: 165-255)
      if (clarity < 0.9 || frequency < 60 || frequency > 500) {
        return { frequency: null, clarity: 0 };
      }

      return { frequency, clarity };
    } catch (error) {
      console.error('Pitch detection error:', error);
      return { frequency: null, clarity: 0 };
    }
  }

  /**
   * Extracts acoustic features manually (simplified implementation)
   * Using manual calculations since Meyda has complex Web Audio API dependencies
   */
  private extractMeydaFeatures(buffer: Float32Array): any {
    try {
      // Calculate RMS (Root Mean Square)
      const rms = this.calculateRMS(buffer);

      // Calculate ZCR (Zero Crossing Rate)
      const zcr = this.calculateZCR(buffer);

      // Simplified loudness (scaled RMS)
      const loudness = rms * 100;

      // Spectral features would require FFT - simplified placeholders for now
      // In production, you'd use FFT to calculate these properly
      const spectralCentroid = 0;
      const spectralFlatness = 0;
      const mfcc = new Array(13).fill(0);

      return {
        rms,
        loudness,
        zcr,
        spectralCentroid,
        spectralFlatness,
        mfcc
      };
    } catch (error) {
      console.error('Feature extraction error:', error);
      return {
        rms: 0,
        loudness: 0,
        zcr: 0,
        spectralCentroid: 0,
        spectralFlatness: 0,
        mfcc: new Array(13).fill(0)
      };
    }
  }

  /**
   * Calculate RMS (Root Mean Square) energy
   */
  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Calculate Zero Crossing Rate
   */
  private calculateZCR(buffer: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
      if ((buffer[i] >= 0 && buffer[i - 1] < 0) || (buffer[i] < 0 && buffer[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / buffer.length;
  }

  /**
   * Simple voice activity detection based on RMS and ZCR
   * High ZCR + low RMS = unvoiced speech (like "s", "f", "th")
   * Low ZCR + high RMS = voiced speech (like vowels)
   * Low ZCR + low RMS = silence
   */
  private detectSpeech(rms: number, zcr: number): boolean {
    const RMS_THRESHOLD = 0.02; // Adjust based on your microphone sensitivity
    const ZCR_THRESHOLD = 0.1;

    // Speech is present if either:
    // 1. High RMS (voiced speech)
    // 2. High ZCR with moderate RMS (unvoiced speech)
    return rms > RMS_THRESHOLD || (zcr > ZCR_THRESHOLD && rms > RMS_THRESHOLD * 0.5);
  }

  /**
   * Aggregates metrics over multiple buffers (useful for per-turn analysis)
   */
  aggregateMetrics(metricsArray: AcousticMetrics[]): AcousticMetrics {
    if (metricsArray.length === 0) {
      return this.getEmptyMetrics();
    }

    // Filter only speech frames
    const speechFrames = metricsArray.filter(m => m.isSpeech);

    if (speechFrames.length === 0) {
      return this.getEmptyMetrics();
    }

    // Calculate averages
    const avgPitch = this.average(speechFrames.map(m => m.pitch).filter(p => p !== null) as number[]);
    const avgRms = this.average(speechFrames.map(m => m.rms));
    const avgLoudness = this.average(speechFrames.map(m => m.loudness));
    const avgZcr = this.average(speechFrames.map(m => m.zcr));
    const avgSpectralCentroid = this.average(speechFrames.map(m => m.spectralCentroid));
    const avgSpectralFlatness = this.average(speechFrames.map(m => m.spectralFlatness));

    // Average MFCCs across frames
    const avgMfcc = new Array(13).fill(0);
    speechFrames.forEach(frame => {
      frame.mfcc.forEach((val, i) => {
        avgMfcc[i] += val / speechFrames.length;
      });
    });

    return {
      pitch: avgPitch,
      pitchConfidence: this.average(speechFrames.map(m => m.pitchConfidence)),
      rms: avgRms,
      loudness: avgLoudness,
      zcr: avgZcr,
      spectralCentroid: avgSpectralCentroid,
      spectralFlatness: avgSpectralFlatness,
      mfcc: avgMfcc,
      isSpeech: true
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private getEmptyMetrics(): AcousticMetrics {
    return {
      pitch: null,
      pitchConfidence: 0,
      rms: 0,
      loudness: 0,
      zcr: 0,
      spectralCentroid: 0,
      spectralFlatness: 0,
      mfcc: new Array(13).fill(0),
      isSpeech: false
    };
  }
}
