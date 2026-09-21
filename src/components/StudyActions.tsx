import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { askLecture, generateQuiz } from '@/services/ai';
import type { GenerateQuizResult } from '@/types';
import { ThemedText } from './themed-text';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function StudyActions({ lectureId }: { lectureId: string }) {
  const theme = useTheme();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [quiz, setQuiz] = useState<GenerateQuizResult | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState<'ask' | 'quiz' | null>(null);
  const [error, setError] = useState('');

  /** Replay the questions already in state; never re-requests from Gemini. */
  function restart() {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }

  async function ask() {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setBusy('ask');
    setError('');
    setAnswer('');
    try {
      const result = await askLecture(lectureId, trimmed);
      setAnswer(result.answer);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  /** The only call to generateQuiz: all five questions arrive at once. */
  async function makeQuiz() {
    if (busy) return;
    setBusy('quiz');
    setError('');
    try {
      const result = await generateQuiz(lectureId);
      setQuiz(result);
      restart();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  function choose(option: string, correctAnswer: string) {
    // Answers lock on first tap, so the score can never be inflated.
    if (selected !== null) return;
    setSelected(option);
    if (option === correctAnswer) setScore((value) => value + 1);
  }

  function advance() {
    if (!quiz || selected === null) return;
    if (index + 1 >= quiz.questions.length) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
  }

  const action = (
    label: string,
    onPress: () => void,
    { primary = false, disabled = false }: { primary?: boolean; disabled?: boolean } = {},
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.accent }
          : { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement },
        (pressed || hovered) && !disabled ? { opacity: 0.85 } : null,
        disabled && { opacity: 0.5 },
      ]}
    >
      <ThemedText style={[styles.buttonLabel, { color: primary ? theme.accentText : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <View style={styles.stack}>
      <View style={styles.block}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Ask</ThemedText>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          editable={busy !== 'ask'}
          placeholder="Ask anything from this lecture"
          placeholderTextColor={theme.textTertiary}
          accessibilityLabel="Your question about this lecture"
          multiline
          maxLength={2000}
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.backgroundElement,
            },
          ]}
        />
        <View style={styles.actions}>
          {action(busy === 'ask' ? 'Asking…' : 'Ask', ask, {
            primary: true,
            disabled: busy !== null || !question.trim(),
          })}
          {busy === 'ask' ? (
            <ActivityIndicator color={theme.textSecondary} accessibilityLabel="Finding an answer" />
          ) : null}
        </View>
        {answer ? (
          <View style={[styles.answer, { borderColor: theme.border }]}>
            <ThemedText accessibilityLiveRegion="polite" style={styles.text}>
              {answer}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.block}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Quiz</ThemedText>
        {quiz ? null : (
          <View style={styles.actions}>
            {action(busy === 'quiz' ? 'Generating…' : 'Generate quiz', makeQuiz, {
              disabled: busy !== null,
            })}
            {busy === 'quiz' ? (
              <ActivityIndicator
                color={theme.textSecondary}
                accessibilityLabel="Generating your quiz"
              />
            ) : null}
          </View>
        )}

        {quiz && !finished
          ? (() => {
              const total = quiz.questions.length;
              const item = quiz.questions[index];
              const answered = selected !== null;
              const right = answered && selected === item.correctAnswer;
              const last = index + 1 >= total;
              return (
                <View style={[styles.panel, { borderColor: theme.border }]}>
                  <View style={styles.quizHead}>
                    <ThemedText style={styles.text} numberOfLines={1}>
                      {quiz.title}
                    </ThemedText>
                    <ThemedText style={[styles.meta, { color: theme.textSecondary }]}>
                      {index + 1} of {total}
                    </ThemedText>
                  </View>
                  <View
                    style={[styles.track, { backgroundColor: theme.backgroundSelected }]}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: total, now: index + (answered ? 1 : 0) }}
                  >
                    <View
                      style={[
                        styles.fill,
                        {
                          backgroundColor: theme.accent,
                          width: `${((index + (answered ? 1 : 0)) / total) * 100}%`,
                        },
                      ]}
                    />
                  </View>

                  <ThemedText accessibilityLiveRegion="polite" style={styles.prompt}>
                    {item.question}
                  </ThemedText>

                  {item.options.map((option) => {
                    const chosen = selected === option;
                    const correct = option === item.correctAnswer;
                    const mark = answered && correct ? '✓' : answered && chosen ? '✕' : '';
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityLabel={option}
                        accessibilityState={{ selected: chosen, disabled: answered }}
                        disabled={answered}
                        onPress={() => choose(option, item.correctAnswer)}
                        style={({ pressed, hovered }) => [
                          styles.option,
                          { borderColor: theme.border },
                          answered && correct ? { borderColor: theme.success } : null,
                          answered && chosen && !correct ? { borderColor: theme.danger } : null,
                          (pressed || hovered) && !answered
                            ? { backgroundColor: theme.backgroundHover }
                            : null,
                        ]}
                      >
                        <ThemedText style={styles.text}>
                          {mark ? `${mark}  ` : ''}
                          {option}
                        </ThemedText>
                      </Pressable>
                    );
                  })}

                  {answered ? (
                    <>
                      <ThemedText
                        accessibilityLiveRegion="polite"
                        style={[styles.verdict, { color: right ? theme.success : theme.danger }]}
                      >
                        {right ? 'Correct' : 'Not quite'}
                      </ThemedText>
                      <ThemedText style={[styles.text, { color: theme.textSecondary }]}>
                        {item.explanation}
                      </ThemedText>
                    </>
                  ) : null}

                  <View style={styles.actions}>
                    {action(last ? 'See results' : 'Next question', advance, {
                      primary: true,
                      disabled: !answered,
                    })}
                  </View>
                </View>
              );
            })()
          : null}

        {quiz && finished ? (
          <View style={[styles.panel, { borderColor: theme.border }]}>
            <ThemedText accessibilityLiveRegion="polite" style={styles.score}>
              {score} / {quiz.questions.length} correct
            </ThemedText>
            <View style={styles.actions}>
              {action('Retake', restart)}
              {action('Close', () => {
                setQuiz(null);
                restart();
              })}
            </View>
          </View>
        ) : null}
      </View>

      {error ? (
        <ThemedText accessibilityLiveRegion="polite" style={[styles.meta, { color: theme.danger }]}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 20 },
  block: { gap: 8 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  text: { fontSize: 13.5, lineHeight: 20 },
  meta: { fontSize: 12.5, lineHeight: 18 },
  input: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 13.5,
    lineHeight: 20,
    outlineStyle: 'none',
  } as object,
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  button: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  answer: { borderWidth: 1, borderRadius: Radius.medium, padding: 12 },
  panel: { borderWidth: 1, borderRadius: Radius.large, padding: 14, gap: 10 },
  quizHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  track: { height: 3, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 3, borderRadius: Radius.pill },
  prompt: { fontSize: 14, lineHeight: 21, fontWeight: '600', marginTop: 2 },
  option: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  verdict: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  score: { fontSize: 19, lineHeight: 26, fontWeight: '600' },
});
