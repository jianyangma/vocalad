import { InferenceSession, Tensor } from 'onnxruntime-react-native';

export interface PhonemeAlignment {
  phoneme: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscriptionResult {
  phonemes: PhonemeAlignment[];
  wordCount: number;
  duration: number; // in seconds
  wpm: number; // words per minute
}

/**
 * PhonemeRecognitionService uses ONNX Runtime with Wav2Vec2 for phoneme recognition
 *
 * Note: This requires a Wav2Vec2 ONNX model to be downloaded and bundled with the app.
 * For now, this is a placeholder implementation that will be completed when the model is available.
 */
export class PhonemeRecognitionService {
  private session: InferenceSession | null = null;
  private modelPath: string;
  private isInitialized: boolean = false;

  // Wav2Vec2 expects 16kHz audio
  private readonly SAMPLE_RATE = 16000;

  // Phoneme vocabulary (IPA - International Phonetic Alphabet)
  // This would come from the model's config in production
  private readonly PHONEME_VOCAB = [
    'SIL', // silence
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW', // vowels
    'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH' // consonants
  ];

  constructor(modelPath: string = 'models/wav2vec2-phoneme.onnx') {
    this.modelPath = modelPath;
  }

  /**
   * Initializes the ONNX Runtime session with the Wav2Vec2 model
   */
  async initialize(): Promise<void> {
    try {
      console.log('⚠️ Wav2Vec2 ONNX model not available - using placeholder WPM estimation');

      // TODO: Download model from HuggingFace and convert to ONNX
      // For now, we'll use placeholder mode
      // Uncomment when model is available:
      // this.session = await InferenceSession.create(this.modelPath);

      this.isInitialized = true;

      console.log('✅ PhonemeRecognitionService initialized (placeholder mode)');
    } catch (error) {
      console.warn('⚠️ Failed to initialize PhonemeRecognitionService:', error);
      // Don't throw - just use placeholder mode
      this.isInitialized = true;
    }
  }

  /**
   * Recognizes phonemes from audio buffer
   * @param audioBuffer Float32Array of audio samples (mono, 16kHz)
   * @param duration Duration of the audio in seconds
   */
  async recognizePhonemes(audioBuffer: Float32Array, duration: number): Promise<TranscriptionResult> {
    // For now, always use placeholder mode since we don't have the ONNX model yet
    // In production, check if session is initialized
    if (!this.session || !this.isInitialized) {
      return this.placeholderRecognition(audioBuffer, duration);
    }

    try {
      // Prepare input tensor
      const inputTensor = new Tensor('float32', audioBuffer, [1, audioBuffer.length]);

      // Run inference
      const outputs = await this.session.run({ input: inputTensor });

      // Process outputs to get phoneme alignments
      const logits = outputs.logits.data as Float32Array;
      const phonemes = this.decodePhonemes(logits, duration);

      // Calculate word count and WPM
      const wordCount = this.estimateWordCount(phonemes);
      const wpm = this.calculateWPM(wordCount, duration);

      return {
        phonemes,
        wordCount,
        duration,
        wpm
      };
    } catch (error) {
      console.error('❌ Phoneme recognition error:', error);
      return this.placeholderRecognition(audioBuffer, duration);
    }
  }

  /**
   * Decodes raw logits into phoneme alignments
   */
  private decodePhonemes(logits: Float32Array, duration: number): PhonemeAlignment[] {
    // TODO: Implement CTC (Connectionist Temporal Classification) decoding
    // For now, return placeholder
    return [];
  }

  /**
   * Estimates word count from phoneme sequence
   * Words are typically separated by silence (SIL) phonemes
   */
  private estimateWordCount(phonemes: PhonemeAlignment[]): number {
    if (phonemes.length === 0) return 0;

    // Count transitions from non-silence to silence as word boundaries
    let wordCount = 0;
    let inWord = false;

    for (const phoneme of phonemes) {
      if (phoneme.phoneme === 'SIL') {
        if (inWord) {
          wordCount++;
          inWord = false;
        }
      } else {
        inWord = true;
      }
    }

    // If still in a word at the end, count it
    if (inWord) wordCount++;

    return wordCount;
  }

  /**
   * Calculates words per minute
   */
  private calculateWPM(wordCount: number, durationSeconds: number): number {
    if (durationSeconds === 0) return 0;
    const durationMinutes = durationSeconds / 60;
    return Math.round(wordCount / durationMinutes);
  }

  /**
   * Placeholder implementation for when model is not available
   * This provides basic WPM estimation without actual phoneme recognition
   */
  private placeholderRecognition(audioBuffer: Float32Array, duration: number): TranscriptionResult {
    // Estimate word count based on audio activity
    // Average syllable duration is ~0.2s, average word has ~1.5 syllables
    // So rough estimate: duration / 0.3 seconds per word

    // First, detect speech segments (simple energy-based VAD)
    const speechDuration = this.estimateSpeechDuration(audioBuffer, this.SAMPLE_RATE);

    // Estimate words (typical speech: 2-3 words per second for normal conversation)
    const estimatedWords = Math.max(1, Math.round(speechDuration * 2.5));

    const wpm = this.calculateWPM(estimatedWords, duration);

    return {
      phonemes: [], // No phoneme data in placeholder mode
      wordCount: estimatedWords,
      duration,
      wpm
    };
  }

  /**
   * Estimates speech duration using simple energy-based voice activity detection
   */
  private estimateSpeechDuration(buffer: Float32Array, sampleRate: number): number {
    const FRAME_SIZE = 512;
    const ENERGY_THRESHOLD = 0.02;

    let speechFrames = 0;

    for (let i = 0; i < buffer.length; i += FRAME_SIZE) {
      const frame = buffer.slice(i, i + FRAME_SIZE);
      const energy = this.calculateRMS(frame);

      if (energy > ENERGY_THRESHOLD) {
        speechFrames++;
      }
    }

    const totalFrames = Math.ceil(buffer.length / FRAME_SIZE);
    const speechRatio = speechFrames / totalFrames;

    return (buffer.length / sampleRate) * speechRatio;
  }

  /**
   * Calculates RMS (root mean square) energy
   */
  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Cleanup resources
   */
  async dispose(): void {
    if (this.session) {
      // await this.session.release();
      this.session = null;
    }
    this.isInitialized = false;
  }
}
