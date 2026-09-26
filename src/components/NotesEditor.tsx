import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppTextInput, FormError } from '@/components/ui/AppTextInput';
import { WorkspaceButton } from '@/components/ui/WorkspaceControls';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toEdit, type EditorLine as Line } from '@/features/lectures/editNotes';
import type { Lecture, LectureEdit, NoteListKey } from '@/types';

const LISTS: { key: NoteListKey; label: string }[] = [
  { key: 'keyConcepts', label: 'Key concepts' },
  { key: 'importantPoints', label: 'Important points' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'examMentions', label: 'Exam mentions' },
];
/** Matches the API limit on lines per list. */
const MAX_LINES = 100;

/**
 * A multiline field that grows with its text instead of clipping it. Native reports its
 * content height; the web does not reliably, so an estimate from the field width and
 * text length is the floor.
 */
function GrowingInput({
  minHeight = 44,
  style,
  ...props
}: TextInputProps & { minHeight?: number }) {
  const [measured, setMeasured] = useState(0);
  const [width, setWidth] = useState(0);
  const text = typeof props.value === 'string' ? props.value : '';
  const perLine = Math.max(16, Math.floor((width - 22) / 8.5));
  const lines = text
    .split('\n')
    .reduce((total, part) => total + Math.max(1, Math.ceil(part.length / perLine)), 0);
  const estimate = width ? lines * 22 + 22 : minHeight;
  const height = Math.max(minHeight, measured, estimate);
  return (
    <TextInput
      {...props}
      multiline
      scrollEnabled={false}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onContentSizeChange={(event) =>
        setMeasured(Math.ceil(event.nativeEvent.contentSize.height) + 2)
      }
      style={[style, { height, flexShrink: 0 }]}
    />
  );
}

function linesOf(lecture: Lecture, key: NoteListKey): Line[] {
  const refs = lecture.sources?.[key];
  return lecture[key].map((text, index) => ({ text, source: refs?.[index] ?? null }));
}

export function NotesEditor({
  lecture,
  onCancel,
  onSave,
}: {
  lecture: Lecture;
  onCancel: () => void;
  onSave: (edit: LectureEdit) => Promise<void>;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState(lecture.title);
  const [summary, setSummary] = useState(lecture.summary);
  const [lists, setLists] = useState(
    () =>
      Object.fromEntries(LISTS.map(({ key }) => [key, linesOf(lecture, key)])) as Record<
        NoteListKey,
        Line[]
      >,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (key: NoteListKey, index: number, text: string) =>
    setLists((value) => ({
      ...value,
      [key]: value[key].map((line, i) => (i === index ? { ...line, text } : line)),
    }));
  const remove = (key: NoteListKey, index: number) =>
    setLists((value) => ({ ...value, [key]: value[key].filter((_, i) => i !== index) }));
  const add = (key: NoteListKey) =>
    setLists((value) => ({ ...value, [key]: [...value[key], { text: '', source: null }] }));

  async function save() {
    if (!title.trim() || !summary.trim()) {
      setError('A notebook needs a title and a summary.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(toEdit(title, summary, lists));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your changes.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.panel,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
      ]}
    >
      <ThemedText style={[styles.help, { color: theme.textSecondary }]}>
        Fix anything Chalkwise misread. Your originals stay exactly as you captured them.
      </ThemedText>
      <AppTextInput label="Title" value={title} onChangeText={setTitle} maxLength={500} />
      <View style={styles.list}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Summary</ThemedText>
        <GrowingInput
          value={summary}
          onChangeText={setSummary}
          minHeight={96}
          maxLength={20000}
          accessibilityLabel="Summary"
          textAlignVertical="top"
          style={[
            styles.lineInput,
            styles.summaryInput,
            {
              color: theme.text,
              borderColor: theme.borderStrong,
              backgroundColor: theme.background,
            },
          ]}
        />
      </View>
      {LISTS.map(({ key, label }) => (
        <View key={key} style={styles.list}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>{label}</ThemedText>
          {lists[key].map((line, index) => (
            <View key={index} style={styles.lineRow}>
              <GrowingInput
                value={line.text}
                onChangeText={(text) => update(key, index, text)}
                maxLength={4000}
                accessibilityLabel={`${label} line ${index + 1}`}
                placeholder="Write the corrected line"
                placeholderTextColor={theme.textTertiary}
                style={[
                  styles.lineInput,
                  {
                    color: theme.text,
                    borderColor: theme.borderStrong,
                    backgroundColor: theme.background,
                  },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${label.toLowerCase()} line ${index + 1}`}
                onPress={() => remove(key, index)}
                hitSlop={6}
                style={({ pressed, hovered }) => [
                  styles.remove,
                  { borderColor: theme.border },
                  (pressed || hovered) && { backgroundColor: theme.backgroundHover },
                ]}
              >
                <AppIcon name="close" size={14} color={theme.textSecondary} />
              </Pressable>
            </View>
          ))}
          {lists[key].length < MAX_LINES ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add a line to ${label.toLowerCase()}`}
              onPress={() => add(key)}
              style={({ pressed, hovered }) => [
                styles.addLine,
                (pressed || hovered) && { backgroundColor: theme.backgroundHover },
              ]}
            >
              <AppIcon name="plus" size={14} color={theme.accent} />
              <ThemedText style={[styles.addLabel, { color: theme.accent }]}>Add line</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ))}
      <FormError message={error} />
      <View style={styles.actions}>
        <WorkspaceButton label="Cancel" disabled={busy} onPress={onCancel} />
        <WorkspaceButton
          primary
          icon="check"
          label={busy ? 'Saving…' : 'Save changes'}
          busy={busy}
          onPress={() => void save()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 16, padding: 14, borderWidth: 1, borderRadius: Radius.large },
  help: { fontSize: 12.5, lineHeight: 18 },
  list: { gap: 8 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
  },
  // In a column, flex: 1 would squeeze the summary to its label's height.
  summaryInput: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  remove: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  addLine: {
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
