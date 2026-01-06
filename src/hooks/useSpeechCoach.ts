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
    // 1. Connect to Gemini & Send activityStart
    await geminiService.current.connect({
      onMessage: (msg) => console.log("AI says:", msg),
      onError: (err) => console.error("Socket Error:", err)
    });

    // 2. Start the Mic Faucet
    await audioService.current.start(
      (base64) => geminiService.current.sendAudioChunk(base64),
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
    // 3. Close the turn and trigger AI response
    const mockMetrics = { wpm: 120, pitch: "steady" }; // Phase 2 logic goes here
    await geminiService.current.completeTurn(mockMetrics);
    
    // We keep recording active for the next turn
  }, []);

  const stopAll = useCallback(() => {
    audioService.current.stop();
    setIsRecording(false);
  }, []);

  return { startSession, endTurn, stopAll, isRecording };
}