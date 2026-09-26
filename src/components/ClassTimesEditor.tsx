import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { FormError } from '@/components/ui/AppTextInput';
import { WorkspaceButton } from '@/components/ui/WorkspaceControls';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  WEEKDAYS,
  formatClock,
  minutesOf,
  parseTimeInput,
  type MeetingGroup,
} from '@/features/courses/schedule';
import type { CourseMeeting } from '@/types';

type Draft = { days: number[]; start: string; end: string };
/** Monday first, the way a class timetable reads. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const toDraft = (group: MeetingGroup): Draft => ({
  days: group.days,
  start: formatClock(group.start),
  end: formatClock(group.end),
});

/**
 * Enter when a class meets. Each row is one time slot with the days it runs, so a
 * Tuesday/Thursday lecture is one row and a Friday lab is another.
 */
export function ClassTimesEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: MeetingGroup[];
  onCancel: () => void;
  onSave: (meetings: Omit<CourseMeeting, 'courseId'>[]) => Promise<void>;
}) {
  const theme = useTheme();
  const [rows, setRows] = useState<Draft[]>(
    initial.length ? initial.map(toDraft) : [{ days: [], start: '', end: '' }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const patch = (index: number, change: Partial<Draft>) =>
    setRows((value) => value.map((row, i) => (i === index ? { ...row, ...change } : row)));
  const toggleDay = (index: number, day: number) =>
    patch(index, {
      days: rows[index].days.includes(day)
        ? rows[index].days.filter((d) => d !== day)
        : [...rows[index].days, day],
    });

  async function save() {
    const meetings: Omit<CourseMeeting, 'courseId'>[] = [];
    for (const [index, row] of rows.entries()) {
      const blank = !row.days.length && !row.start.trim() && !row.end.trim();
      if (blank) continue;
      const start = parseTimeInput(row.start);
      const end = parseTimeInput(row.end);
      const label = rows.length > 1 ? `Time ${index + 1}: ` : '';
      if (!row.days.length) return setError(`${label}choose at least one day.`);
      if (!start || !end) return setError(`${label}enter times like 9:30 am and 10:50 am.`);
      if (minutesOf(end) <= minutesOf(start))
        return setError(`${label}the class must end after it starts.`);
      for (const weekday of row.days) meetings.push({ weekday, start, end });
    }
    setBusy(true);
    setError('');
    try {
      await onSave(meetings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save class times.');
    } finally {
      setBusy(false);
    }
  }

  const input = (value: string, onChange: (v: string) => void, label: string) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      onBlur={() => {
        const parsed = parseTimeInput(value);
        if (parsed) onChange(formatClock(parsed));
      }}
      placeholder={label === 'Starts' ? '9:30 am' : '10:50 am'}
      placeholderTextColor={theme.textTertiary}
      accessibilityLabel={label}
      autoCapitalize="none"
      autoCorrect={false}
      style={[
        styles.time,
        { color: theme.text, borderColor: theme.borderStrong, backgroundColor: theme.background },
      ]}
    />
  );

  return (
    <View
      style={[
        styles.panel,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
      ]}
    >
      <ThemedText style={[styles.help, { color: theme.textSecondary }]}>
        Chalkwise uses these to file photos you take in class under this course, and to spot classes
        you missed.
      </ThemedText>
      {rows.map((row, index) => (
        <View
          key={index}
          style={[styles.row, index > 0 && [styles.divided, { borderTopColor: theme.border }]]}
        >
          <View style={styles.days}>
            {DAY_ORDER.map((day) => {
              const on = row.days.includes(day);
              return (
                <Pressable
                  key={day}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={WEEKDAYS[day]}
                  onPress={() => toggleDay(index, day)}
                  style={({ pressed, hovered }) => [
                    styles.day,
                    {
                      borderColor: on ? theme.accent : theme.border,
                      backgroundColor: on ? theme.accentSurface : theme.background,
                    },
                    (pressed || hovered) && !on && { backgroundColor: theme.backgroundHover },
                  ]}
                >
                  <ThemedText
                    style={[styles.dayLabel, { color: on ? theme.accent : theme.textSecondary }]}
                  >
                    {WEEKDAYS[day].slice(0, 2)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.times}>
            {input(row.start, (start) => patch(index, { start }), 'Starts')}
            <ThemedText style={{ color: theme.textTertiary }}>to</ThemedText>
            {input(row.end, (end) => patch(index, { end }), 'Ends')}
            {rows.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove time ${index + 1}`}
                onPress={() => setRows((value) => value.filter((_, i) => i !== index))}
                style={({ pressed, hovered }) => [
                  styles.remove,
                  { borderColor: theme.border },
                  (pressed || hovered) && { backgroundColor: theme.backgroundHover },
                ]}
              >
                <AppIcon name="close" size={14} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
      {rows.length < 7 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add another class time, such as a lab"
          onPress={() => setRows((value) => [...value, { days: [], start: '', end: '' }])}
          style={({ pressed, hovered }) => [
            styles.add,
            (pressed || hovered) && { backgroundColor: theme.backgroundHover },
          ]}
        >
          <AppIcon name="plus" size={14} color={theme.accent} />
          <ThemedText style={[styles.addLabel, { color: theme.accent }]}>
            Add another time (lab, recitation)
          </ThemedText>
        </Pressable>
      ) : null}
      <FormError message={error} />
      <View style={styles.actions}>
        <WorkspaceButton label="Cancel" disabled={busy} onPress={onCancel} />
        <WorkspaceButton
          primary
          icon="check"
          label={busy ? 'Saving…' : 'Save times'}
          busy={busy}
          onPress={() => void save()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 14, padding: 14, borderWidth: 1, borderRadius: Radius.large },
  help: { fontSize: 12.5, lineHeight: 18 },
  row: { gap: 10 },
  divided: { borderTopWidth: 1, paddingTop: 14 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  dayLabel: { fontSize: 12.5, fontWeight: '600' },
  times: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  time: {
    width: 112,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  remove: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 36,
    paddingHorizontal: 8,
    borderRadius: Radius.medium,
  },
  addLabel: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
