import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';
import { JournalEntry } from '../types';
import { formatDate, formatDuration, formatTime } from '../services/storageService';

interface EntryCardProps {
  entry: JournalEntry;
  onPress: () => void;
}

export default function EntryCard({ entry, onPress }: EntryCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.date}>{formatDate(entry.date)}</Text>
          <Text style={styles.time}>{formatTime(entry.date)}</Text>
        </View>
        <View style={styles.meta}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.duration}>{formatDuration(entry.durationMs)}</Text>
          {entry.driveAudioFileId && (
            <Ionicons
              name="cloud-done-outline"
              size={14}
              color={colors.success}
              style={styles.cloudIcon}
            />
          )}
          {entry.isTranscribing && (
            <Ionicons name="sync-outline" size={14} color={colors.paused} style={styles.cloudIcon} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: {},
  date: {
    ...typography.body,
    fontWeight: '600',
  },
  time: {
    ...typography.caption,
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  duration: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
  cloudIcon: {
    marginLeft: 4,
  },
});
