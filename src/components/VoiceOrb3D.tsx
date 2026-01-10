import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { Sphere, MeshDistortMaterial } from '@react-three/drei/native';
import * as THREE from 'three';

interface AnimatedOrbProps {
  audioLevel: number;
  isActive: boolean;
  isAISpeaking: boolean;
}

function AnimatedOrb({ audioLevel, isActive, isAISpeaking }: AnimatedOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<any>(null);

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;

    // Rotate the orb continuously
    meshRef.current.rotation.x += 0.002;
    meshRef.current.rotation.y += 0.003;

    if (isActive && !isAISpeaking) {
      // User speaking - scale based on audio level
      const targetScale = 1 + audioLevel * 2;
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
    } else if (isAISpeaking) {
      // AI speaking - pulse effect
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      meshRef.current.scale.lerp(
        new THREE.Vector3(pulse, pulse, pulse),
        0.1
      );
    } else {
      // Idle - return to normal size
      meshRef.current.scale.lerp(
        new THREE.Vector3(1, 1, 1),
        0.1
      );
    }
  });

  const color = isAISpeaking ? '#9D4EDD' : isActive ? '#00D0FF' : '#f3e9e9';
  const emissiveIntensity = isActive ? 0.5 : 0.2;

  return (
    <group>
      {/* Main orb with distortion */}
      <Sphere ref={meshRef} args={[1.5, 64, 64]}>
        <MeshDistortMaterial
          ref={materialRef}
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          distort={isActive ? 0.3 : 0.1}
          speed={isActive ? 2 : 0.5}
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>

      {/* Ambient light */}
      <ambientLight intensity={0.5} />

      {/* Point light that follows the orb color */}
      <pointLight position={[2, 2, 2]} intensity={1} color={color} />
      <pointLight position={[-2, -2, 2]} intensity={0.5} color={color} />
    </group>
  );
}

interface VoiceOrb3DProps {
  audioLevel: number;
  isActive: boolean;
  isAISpeaking: boolean;
}

export const VoiceOrb3D: React.FC<VoiceOrb3DProps> = ({ audioLevel, isActive, isAISpeaking }) => {
  return (
    <View style={styles.container}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <AnimatedOrb audioLevel={audioLevel} isActive={isActive} isAISpeaking={isAISpeaking} />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 300,
    height: 300,
  },
});
