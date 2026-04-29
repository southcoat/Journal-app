import React from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';
import { AudioInput } from '../types';

interface MicSelectorProps {
  visible: boolean;
  onClose: () => void;
  inputs: AudioInput[];
  selectedUid: string | null;
  onSelect: (input: AudioInput) => void;
}

function iconForInputType(type: AudioInput['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'BluetoothHFP': return 'bluetooth';
    case 'HeadsetMic':
    case 'HeadphoneMic': return 'headset';
    default: return 'mic';
  }
}

export default function MicSelector({
  visible, onClose, inputs, selectedUid, onSelect,
}: MicSelectorProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select Microphone</Text>

          {inputs.map(input => {
            const selected = input.uid === selectedUid;
            return (
              <TouchableOpacity
                key={input.uid}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => { onSelect(input); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
                  <Ionicons
                    name={iconForInputType(input.type)}
                    size={22}
                    color={selected ? colors.white : colors.textSecondary}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.inputName, selected && styles.inputNameSelected]}>
                    {input.name}
                  </Text>
                  <Text style={styles.inputType}>{input.type.replace(/([A-Z])/g, ' $1').trim()}</Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}

          {Platform.OS === 'android' && (
            <Text style={styles.androidNote}>
              On Android, Bluetooth audio is routed automatically when a headset is connected.
            </Text>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.surfaceBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceVariant,
  },
  rowSelected: {
    backgroundColor: colors.primaryFaded,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconWrapSelected: {
    backgroundColor: colors.primary,
  },
  rowText: {
    flex: 1,
  },
  inputName: {
    ...typography.body,
    fontWeight: '500',
  },
  inputNameSelected: {
    color: colors.white,
  },
  inputType: {
    ...typography.small,
    marginTop: 2,
  },
  androidNote: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    color: colors.textMuted,
    lineHeight: 18,
  },
  closeBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  closeBtnText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.white,
  },
});
