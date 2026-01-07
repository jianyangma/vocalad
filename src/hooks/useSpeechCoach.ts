import { useState, useRef, useCallback } from 'react';
import { AudioService } from '../services/AudioService';
import { GeminiService } from '../services/GeminiService';

const GEMINI_API_KEY = "REPLACE_WITH_YOUR_GEMINI_API_KEY"; // Replace with your actual API key

export function useSpeechCoach() {
  const [isRecording, setIsRecording] = useState(false);
  const audioService = useRef(new AudioService());
  const [audioLevel, setAudioLevel] = useState(0);
  const geminiService = useRef(new GeminiService(GEMINI_API_KEY));

  const startSession = useCallback(async () => {
    // 1. Connect to Gemini
    await geminiService.current.connect({
      onMessage: (msg) => console.log("AI says:", msg),
      onError: (err) => console.error("Socket Error:", err)
    });

    // 2. Start the Mic
    await audioService.current.start(
      (pcmBlob) => geminiService.current.sendAudioChunk(pcmBlob),
      (pcmBuffer) => {
        // Calculate a simple Root Mean Square (RMS) for volume visualization
        let sum = 0;
        for (let i = 0; i < pcmBuffer.length; i++) {
            sum += pcmBuffer[i] * pcmBuffer[i];
        }
        const rms = Math.sqrt(sum / pcmBuffer.length);
        setAudioLevel(rms); // Update the state for the UI meter
      }
    );

    setIsRecording(true);
  }, []);

  const endTurn = useCallback(async () => {
    // Collect local metrics (placeholder for now - will be real metrics later)
    const mockMetrics = { wpm: 120, pitch: "steady" };

    // Send activityEnd + metrics to trigger AI response
    await geminiService.current.completeTurn(mockMetrics);

    // Note: We keep recording active for the next turn
  }, []);

  const stopAll = useCallback(() => {
    audioService.current.stop();
    geminiService.current.stop();
    setIsRecording(false);
  }, []);

  return { startSession, endTurn, stopAll, isRecording, audioLevel };
}