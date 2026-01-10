/**
 * CRITICAL POLYFILLS
 * These must be at the very top of your entry file to ensure 
 * the Google GenAI SDK works correctly in the Hermes environment.
 */
import 'react-native-get-random-values';
if (typeof window === 'undefined') {
  (global as any).window = global;
}
if (typeof location === 'undefined') {
  (global as any).location = { protocol: 'https:' };
}

import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar } from 'react-native';
// Use the modern, cross-platform Safe Area library
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useSpeechCoach } from './src/hooks/useSpeechCoach';
import { VoiceOrb3D } from './src/components/VoiceOrb3D';

export default function App() {
  const { startSession, endTurn, stopAll, isRecording, audioLevel, isAISpeaking } = useSpeechCoach();
  const [status, setStatus] = useState('Idle');

  const handleToggle = async () => {
    if (!isRecording) {
      setStatus('Connecting...');
      try {
        await startSession();
        setStatus('Listening...');
      } catch (e) {
        console.error(e);
        setStatus('Error connecting');
      }
    } else {
      stopAll();
      setStatus('Idle');
    }
  };

  const displayStatus = isAISpeaking ? 'Gemini Speaking...' : status;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Vocalad</Text>

        <View style={styles.orbContainer}>
          <VoiceOrb3D
            audioLevel={audioLevel}
            isActive={isRecording}
            isAISpeaking={isAISpeaking}
          />
          <Text style={styles.statusText}>{displayStatus}</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, isRecording ? styles.stopBtn : styles.startBtn]}
            onPress={handleToggle}
          >
            <Text style={styles.btnText}>
              {isRecording ? 'Stop Session' : 'Speak to Gemini'}
            </Text>
          </TouchableOpacity>

          {isRecording && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={endTurn}>
              <Text style={styles.btnText}>Finish Sentence</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#121212', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingVertical: 40 
  },
  title: { 
    color: '#FFF', 
    fontSize: 28, 
    fontWeight: 'bold' 
  },
  orbContainer: {
    height: 400,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#888',
    fontSize: 16,
    marginTop: 20
  },
  buttonContainer: { 
    width: '100%', 
    alignItems: 'center',
    paddingBottom: 20
  },
  button: { 
    width: '85%', 
    padding: 22, 
    borderRadius: 20, 
    alignItems: 'center', 
    marginBottom: 15 
  },
  startBtn: { backgroundColor: '#00D0FF' },
  stopBtn: { backgroundColor: '#FF4B4B' },
  secondaryBtn: { 
    width: '85%', 
    padding: 20, 
    borderRadius: 20, 
    alignItems: 'center', 
    borderWidth: 1.5, 
    borderColor: '#444' 
  },
  btnText: { 
    color: '#FFF', 
    fontSize: 18, 
    fontWeight: '700' 
  }
});