import { useMemo, useState } from 'react';

import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WorkspaceButton } from '@/components/ui/WorkspaceControls';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { createCourse } from '@/services/courses';
import type { Course } from '@/types';

/** Suggestions only: picking one fills the form, it never creates a course. */
const suggestions: { code: string; name: string }[] = [
  { code: 'CS 3358', name: 'Data Structures & Algorithms' },
  { code: 'CS 2325', name: 'Computer Organization' },
  { code: 'MATH 3398', name: 'Discrete Mathematics II' },
  { code: 'MATH 3305', name: 'Introduction to Probability and Statistics' },
  { code: 'ENG 1310', name: 'College Writing I' },
  { code: 'ENG 1320', name: 'College Writing II' },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

type Field = 'code' | 'name';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (course: Course) => void;
};

export function AddCourseSheet({
  visible,
  onClose,
  onCreated,
}: Props) {
  const theme = useTheme();
  const dark = theme.background !== Brand.paper;
  // Wide screens get a centered dialog; a full-width bottom sheet suits phones only.
  const dialog = useWindowDimensions().width >= 720;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [professor, setProfessor] = useState('');
  const [focused, setFocused] = useState<Field | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const ready = code.trim().length > 0 && name.trim().length > 0;

  // Suggest only while typing in the field being matched, and stop once the
  // pair already matches a suggestion exactly.
  const matches = useMemo(() => {
    if (!focused) return [];
    const query = normalize(focused === 'code' ? code : name);
    if (!query) return [];
    const exact = suggestions.some(
      (option) =>
        normalize(option.code) === normalize(code) &&
        normalize(option.name) === normalize(name)
    );
    if (exact) return [];
    // Match the field being typed against its own attribute: matching a code
    // against names surfaces nonsense (“CS” hits “statisti-cs”).
    return suggestions
      .filter((option) =>
        normalize(focused === 'code' ? option.code : option.name).includes(query)
      )
      .slice(0, 4);
  }, [focused, code, name]);

  function reset() {
    setCode('');
    setName('');
    setProfessor('');
    setFocused(null);
    setSaving(false);
    setError('');
  }

  function close() {
    if (saving) return;
    reset();
    onClose();
  }

  async function submit() {
    // The saving guard is what prevents a double submission creating twice.
    if (!ready || saving) return;
    setSaving(true);
    setError('');

    try {
      const course = await createCourse({
        code: code.trim(),
        name: name.trim(),
        professor: professor.trim(),
      });

      onCreated(course);
      reset();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'That course could not be saved. Please try again.'
      );
      setSaving(false);
    }
  }

  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.backgroundElement,
      borderColor: theme.borderStrong,
    },
  ];

  function SuggestionList({ field }: { field: Field }) {
    if (focused !== field || matches.length === 0) return null;

    return (
      <View
        style={[
          styles.suggestions,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
        ]}
      >
        {matches.map((option, index) => (
          <Pressable
            key={option.code}
            accessibilityRole="button"
            accessibilityLabel={`Use ${option.code}, ${option.name}`}
            disabled={saving}
            onPress={() => {
              setCode(option.code);
              setName(option.name);
              setFocused(null);
              setError('');
            }}
            style={({ pressed }) => [
              styles.suggestion,
              index > 0 && {
                borderTopWidth: 1,
                borderTopColor: theme.backgroundSelected,
              },
              pressed && {
                backgroundColor: theme.backgroundSelected,
              },
            ]}
          >
            <ThemedText style={styles.suggestionCode}>
              {option.code}
            </ThemedText>

            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
            >
              {option.name}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType={dialog ? 'fade' : 'slide'}
      presentationStyle="overFullScreen"
      onRequestClose={close}
    >
      <Pressable
        style={[styles.backdrop, dialog && styles.dialogBackdrop]}
        onPress={close}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.frame, dialog && styles.dialogFrame]}
        >
          <Pressable
            style={[
              styles.sheet,
              dialog && [styles.dialog, { borderColor: theme.border }],
              { backgroundColor: theme.background },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            {dialog ? null : (
              <View
                style={[
                  styles.handle,
                  { backgroundColor: theme.backgroundSelected },
                ]}
              />
            )}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.content}
            >
              <ThemedText
                accessibilityRole="header"
                style={[styles.title, { color: theme.text }]}
              >
                Add a course
              </ThemedText>

              <ThemedText
                themeColor="textSecondary"
                style={styles.description}
              >
                Everything you capture for this class will live here.
                Start typing and Chalkwise will suggest matching courses.
              </ThemedText>

              <View style={styles.field}>
                <ThemedText
                  themeColor="textSecondary"
                  style={styles.label}
                >
                  Course code
                </ThemedText>

                <TextInput
                  value={code}
                  onChangeText={setCode}
                  onFocus={() => setFocused('code')}
                  editable={!saving}
                  placeholder="e.g. CS 1428"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  accessibilityLabel="Course code, required"
                  style={inputStyle}
                />

                <SuggestionList field="code" />
              </View>

              <View style={styles.field}>
                <ThemedText
                  themeColor="textSecondary"
                  style={styles.label}
                >
                  Course name
                </ThemedText>

                <TextInput
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocused('name')}
                  editable={!saving}
                  placeholder="e.g. Foundations of Computer Science"
                  placeholderTextColor={theme.textSecondary}
                  accessibilityLabel="Course name, required"
                  style={inputStyle}
                />

                <SuggestionList field="name" />
              </View>

              <View style={styles.field}>
                <ThemedText
                  themeColor="textSecondary"
                  style={styles.label}
                >
                  Professor (optional)
                </ThemedText>

                <TextInput
                  value={professor}
                  onChangeText={setProfessor}
                  onFocus={() => setFocused(null)}
                  editable={!saving}
                  placeholder="e.g. Dr. Rivera"
                  placeholderTextColor={theme.textSecondary}
                  accessibilityLabel="Professor, optional"
                  style={inputStyle}
                />
              </View>

              {error ? (
                <ThemedText
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.error,
                    { color: dark ? '#E7A6A6' : '#8C3B3B' },
                  ]}
                >
                  {error}
                </ThemedText>
              ) : null}

              <View style={[styles.actions, dialog && styles.dialogActions]}>
                <WorkspaceButton
                  primary
                  label={saving ? 'Adding…' : 'Add course'}
                  onPress={submit}
                  disabled={!ready || saving}
                />
                <WorkspaceButton label="Cancel" onPress={close} disabled={saving} />
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9,23,17,0.66)',
  },

  dialogBackdrop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  // The height limit belongs on this frame: a percentage on the sheet itself resolves
  // against a wrapper that grows to fit the sheet, which clipped the last button.
  frame: {
    maxHeight: '90%',
  },

  dialogFrame: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '100%',
  },

  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },

  dialog: {
    borderRadius: Radius.large,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderWidth: 1,
    paddingTop: 20,
    paddingBottom: 20,
  },

  content: {
    gap: 16,
    paddingBottom: 12,
  },

  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
  },

  description: {
    fontSize: 14,
    lineHeight: 21,
  },

  field: {
    gap: 7,
  },

  label: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },

  input: {
    minHeight: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
  },

  suggestions: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    overflow: 'hidden',
  },

  suggestion: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },

  suggestionCode: {
    fontSize: 15,
    fontWeight: '700',
  },

  error: {
    fontSize: 14,
    lineHeight: 21,
  },

  actions: {
    gap: 8,
    paddingTop: 4,
  },

  // Dialog buttons sit on one row, trailing, with the primary action last.
  dialogActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
  },
});
