import { useState, useCallback, useMemo } from 'react';
import { AudioService } from '../services/AudioService';
import { GeminiService } from '../services/GeminiService';

const GEMINI_API_KEY = "<API_KEY>"; // Replace with your actual API key

export function useSpeechCoach() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Use useMemo to ensure services are only created once
  const audioService = useMemo(() => new AudioService(), []);
  const geminiService = useMemo(() => new GeminiService(GEMINI_API_KEY), []);

  const startSession = useCallback(async () => {
    // 1. Connect to Gemini
    await geminiService.connect({
      onMessage: () => {},
      onError: (err: any) => console.error("Socket Error:", err)
    });

    // 2. Start the Mic
    await audioService.start(
      (pcmBlob: any) => geminiService.sendAudioChunk(pcmBlob),
      (pcmBuffer: Float32Array) => {
        // Calculate a simple Root Mean Square (RMS) for volume visualization
        let sum = 0;
        for (let i = 0; i < pcmBuffer.length; i++) {
            sum += pcmBuffer[i] * pcmBuffer[i];
        }
        const rms = Math.sqrt(sum / pcmBuffer.length);
        setAudioLevel(rms); // Update the state for the UI meter
      }
    );

    // 3. Signal to Gemini that user activity has started
    geminiService.startActivity();

    setIsRecording(true);
  }, [audioService, geminiService]);

  const endTurn = useCallback(async () => {
    // Collect local metrics (placeholder for now - will be real metrics later)
    const mockMetrics = { wpm: 120, pitch: "steady" };

    // Send activityEnd + metrics to trigger AI response
    await geminiService.completeTurn(mockMetrics);

    // Note: We keep recording active for the next turn
  }, [geminiService]);

  const stopAll = useCallback(async () => {
    audioService.stop();
    await geminiService.stop();
    setIsRecording(false);
  }, [audioService, geminiService]);

  return { startSession, endTurn, stopAll, isRecording, audioLevel };
}