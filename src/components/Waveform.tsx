import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const NUM_BARS = 36;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const MAX_HEIGHT = 60;
const MIN_HEIGHT = 3;

interface WaveformProps {
  audioLevel: number; // 0–1
  isActive: boolean; // recording or paused with animation
  color?: string;
}

export default function Waveform({ audioLevel, isActive, color = colors.primary }: WaveformProps) {
  const bars = useRef<Animated.Value[]>(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(MIN_HEIGHT))
  ).current;

  const historyRef = useRef<number[]>(Array(NUM_BARS).fill(0));
  const idleAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Idle breathing animation
  useEffect(() => {
    if (!isActive) {
      idleAnimRef.current?.stop();
      idleAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.stagger(
            40,
            bars.map(bar =>
              Animated.timing(bar, {
                toValue: MIN_HEIGHT + 2,
                duration: 800,
                useNativeDriver: false,
              })
            )
          ),
          Animated.stagger(
            40,
            bars.map(bar =>
              Animated.timing(bar, {
                toValue: MIN_HEIGHT,
                duration: 800,
                useNativeDriver: false,
              })
            )
          ),
        ])
      );
      idleAnimRef.current.start();
      return () => idleAnimRef.current?.stop();
    }
    idleAnimRef.current?.stop();
    return () => {};
  }, [isActive, bars]);

  // Audio level driven animation
  useEffect(() => {
    if (!isActive) return;

    // Shift history left, push new level
    historyRef.current = [...historyRef.current.slice(1), audioLevel];

    bars.forEach((bar, i) => {
      const level = historyRef.current[i];
      // Give a slight bell-curve boost to middle bars for visual appeal
      const center = NUM_BARS / 2;
      const distFactor = 1 - (Math.abs(i - center) / center) * 0.3;
      const height = Math.max(
        MIN_HEIGHT,
        MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * level * distFactor
      );
      Animated.spring(bar, {
        toValue: height,
        speed: 40,
        bounciness: 2,
        useNativeDriver: false,
      }).start();
    });
  }, [audioLevel, isActive, bars]);

  return (
    <View style={styles.container}>
      {bars.map((height, i) => {
        const opacity = isActive ? 0.3 + (i / NUM_BARS) * 0.7 : 0.2;
        return (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height,
                backgroundColor: color,
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: MAX_HEIGHT + 20,
    paddingHorizontal: 8,
  },
  bar: {
    width: BAR_WIDTH,
    marginHorizontal: BAR_GAP / 2,
    borderRadius: BAR_WIDTH / 2,
  },
});
