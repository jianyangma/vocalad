import { useState, useRef, useCallback } from 'react';
import { AudioService } from '../services/AudioService';
import { GeminiService } from '../services/GeminiService';
import { AcousticAnalysisService, AcousticMetrics } from '../services/AcousticAnalysisService';
import { PhonemeRecognitionService } from '../services/PhonemeRecognitionService';

const GEMINI_API_KEY = "<API_KEY>"; // Replace with your actual API key

export function useSpeechCoach() {
  const [isRecording, setIsRecording] = useState(false);
  const audioService = useRef(new AudioService());
  const [audioLevel, setAudioLevel] = useState(0);
  const geminiService = useRef(new GeminiService(GEMINI_API_KEY));

  // NEW: Acoustic analysis and phoneme recognition services
  const acousticAnalyzer = useRef(new AcousticAnalysisService(16000, 2048));
  const phonemeRecognizer = useRef(new PhonemeRecognitionService());

  // Buffers to accumulate audio and metrics for the current turn
  const audioBuffers = useRef<Float32Array[]>([]);
  const metricsBuffer = useRef<AcousticMetrics[]>([]);
  const turnStartTime = useRef<number>(0);

  const startSession = useCallback(async () => {
    // Initialize phoneme recognizer (async, but don't block on it)
    phonemeRecognizer.current.initialize().catch(err => {
      console.warn('Phoneme recognition will use placeholder mode:', err);
    });

    // 1. Connect to Gemini
    await geminiService.current.connect({
      onMessage: (msg) => console.log("AI says:", msg),
      onError: (err) => console.error("Socket Error:", err)
    });

    // Reset buffers for new session
    audioBuffers.current = [];
    metricsBuffer.current = [];
    turnStartTime.current = Date.now();

    // 2. Start the Mic
    await audioService.current.start(
      (pcmBlob) => geminiService.current.sendAudioChunk(pcmBlob),
      (pcmBuffer) => {
        // Store buffer for later analysis
        audioBuffers.current.push(new Float32Array(pcmBuffer));

        // Analyze this buffer in real-time
        const metrics = acousticAnalyzer.current.analyzeBuffer(pcmBuffer);
        metricsBuffer.current.push(metrics);

        // Calculate RMS for UI visualization
        setAudioLevel(metrics.rms);

        // Optional: Log pitch and metrics in real-time for debugging
        if (metrics.isSpeech) {
          if (metrics.pitch) {
            console.log(`🎵 Speech detected - Pitch: ${metrics.pitch.toFixed(1)} Hz, RMS: ${metrics.rms.toFixed(4)}, ZCR: ${metrics.zcr.toFixed(4)}`);
          } else {
            console.log(`🔊 Speech detected - RMS: ${metrics.rms.toFixed(4)}, ZCR: ${metrics.zcr.toFixed(4)} (no pitch)`);
          }
        }
      }
    );

    setIsRecording(true);
  }, []);

  const endTurn = useCallback(async () => {
    const turnEndTime = Date.now();
    const turnDuration = (turnEndTime - turnStartTime.current) / 1000; // seconds

    // Aggregate acoustic metrics from all buffers
    const aggregatedMetrics = acousticAnalyzer.current.aggregateMetrics(metricsBuffer.current);

    // Concatenate all audio buffers for phoneme recognition
    const totalLength = audioBuffers.current.reduce((sum, buf) => sum + buf.length, 0);
    const fullAudioBuffer = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of audioBuffers.current) {
      fullAudioBuffer.set(buf, offset);
      offset += buf.length;
    }

    // Run phoneme recognition and WPM calculation
    const transcription = await phonemeRecognizer.current.recognizePhonemes(
      fullAudioBuffer,
      turnDuration
    );

    // Compile comprehensive metrics
    const comprehensiveMetrics = {
      // Speech metrics
      wpm: transcription.wpm,
      wordCount: transcription.wordCount,
      duration: turnDuration,

      // Acoustic features
      averagePitch: aggregatedMetrics.pitch ? aggregatedMetrics.pitch.toFixed(1) : null,
      pitchConfidence: aggregatedMetrics.pitchConfidence.toFixed(2),
      averageRMS: aggregatedMetrics.rms.toFixed(3),
      loudness: aggregatedMetrics.loudness.toFixed(2),
      zcr: aggregatedMetrics.zcr.toFixed(3),
      spectralCentroid: aggregatedMetrics.spectralCentroid.toFixed(1),
      spectralFlatness: aggregatedMetrics.spectralFlatness.toFixed(3),

      // MFCCs (first 5 coefficients for brevity)
      mfcc: aggregatedMetrics.mfcc.slice(0, 5).map(v => v.toFixed(2)),

      // Phoneme data (if available)
      phonemeCount: transcription.phonemes.length
    };

    console.log('📊 Turn Metrics:', comprehensiveMetrics);

    // Send activityEnd + comprehensive metrics to Gemini
    await geminiService.current.completeTurn(comprehensiveMetrics);

    // Reset buffers for next turn
    audioBuffers.current = [];
    metricsBuffer.current = [];
    turnStartTime.current = Date.now();

    // Note: We keep recording active for the next turn
  }, []);

  const stopAll = useCallback(async () => {
    audioService.current.stop();
    await geminiService.current.stop();
    phonemeRecognizer.current.dispose();
    setIsRecording(false);

    // Clear buffers
    audioBuffers.current = [];
    metricsBuffer.current = [];
  }, []);

  return { startSession, endTurn, stopAll, isRecording, audioLevel };
}
