import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

interface ReflectionPromptsProps {
  prompts: string[];
  isLoading: boolean;
}

export default function ReflectionPrompts({ prompts, isLoading }: ReflectionPromptsProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prompts.length > 0 || isLoading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [prompts.length, isLoading, fadeAnim]);

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={14} color={colors.primary} />
        <Text style={styles.headerText}>Reflect on this</Text>
      </View>

      {isLoading ? (
        <>
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: '75%' }]} />
        </>
      ) : (
        prompts.map((prompt, i) => (
          <View key={i} style={styles.promptRow}>
            <Text style={styles.bullet}>{i + 1}</Text>
            <Text style={styles.promptText}>{prompt}</Text>
          </View>
        ))
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primaryFaded,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '44',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  headerText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  promptRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  bullet: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    width: 16,
    marginTop: 1,
  },
  promptText: {
    ...typography.caption,
    flex: 1,
    lineHeight: 20,
    color: colors.text,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: colors.primary + '22',
    borderRadius: 6,
    marginBottom: spacing.sm,
    width: '100%',
  },
});
