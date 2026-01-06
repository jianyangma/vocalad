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

export default function App() {
  const { startSession, endTurn, stopAll, isRecording, audioLevel } = useSpeechCoach();
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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Vocalad Test</Text>
        
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{status}</Text>
          {isRecording && (
            <View 
              style={[
                styles.meter, 
                { height: Math.max(10, audioLevel * 300) } // Increased scale for visibility
              ]} 
            />
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, isRecording ? styles.stopBtn : styles.startBtn]} 
            onPress={handleToggle}
          >
            <Text style={styles.btnText}>
              {isRecording ? 'Stop Session' : 'Start Coaching'}
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
  statusBox: { 
    height: 300, 
    width: '85%', 
    backgroundColor: '#1E1E1E', 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333'
  },
  statusText: { 
    color: '#888', 
    fontSize: 16,
    position: 'absolute',
    top: 20
  },
  meter: { 
    width: 80, 
    backgroundColor: '#00D0FF', 
    borderRadius: 10,
    shadowColor: '#00D0FF',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5
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