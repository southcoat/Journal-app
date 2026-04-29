import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { RecordingStatus } from '../types';

interface RecordButtonProps {
  status: RecordingStatus;
  onPress: () => void;
  size?: number;
}

export default function RecordButton({ status, onPress, size = 80 }: RecordButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (status === 'recording') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.spring(pulseAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }).start();
    }
  }, [status, pulseAnim]);

  const buttonColor =
    status === 'recording' ? colors.recording :
    status === 'paused' ? colors.paused :
    status === 'processing' ? colors.textMuted :
    colors.primary;

  const iconName =
    status === 'recording' ? 'pause' :
    status === 'paused' ? 'mic' :
    status === 'processing' ? 'hourglass-outline' :
    'mic';

  return (
    <View style={styles.wrapper}>
      {/* Pulse ring */}
      {status === 'recording' && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              width: size + 32,
              height: size + 32,
              borderRadius: (size + 32) / 2,
              borderColor: buttonColor,
              transform: [{ scale: pulseAnim }],
              opacity: pulseAnim.interpolate({ inputRange: [1, 1.25], outputRange: [0.5, 0] }),
            },
          ]}
        />
      )}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        disabled={status === 'processing'}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: buttonColor,
          },
        ]}
      >
        <Ionicons name={iconName as any} size={size * 0.38} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
