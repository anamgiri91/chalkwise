import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { askLecture, generateQuiz } from '@/services/ai';
import { getQuizAttempts, quizHistoryAvailable, recordQuizAttempt } from '@/services/quizzes';
import { recordReview } from '@/services/study';
import { refreshReviewReminders } from '@/services/reminders';
import { confidenceFromQuiz, describeQuizReview } from '@/features/study/quizReview';
import type { GenerateQuizResult, LectureReview, QuizAttempt, QuizQuestion } from '@/types';
import { ThemedText } from './themed-text';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function StudyActions({
  lectureId,
  owner = false,
  onReviewed,
}: {
  lectureId: string;
  /** Owners' quizzes are saved and count as reviews; readers of shared notes just practise. */
  owner?: boolean;
  onReviewed?: (review: LectureReview) => void;
}) {
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
  const [missed, setMissed] = useState<QuizQuestion[]>([]);
  /** A retry of missed questions is practice: it is not saved and not a review. */
  const [retrying, setRetrying] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [history, setHistory] = useState<QuizAttempt[]>([]);
  const tracked = owner && quizHistoryAvailable();

  useEffect(() => {
    if (!tracked) return;
    let active = true;
    getQuizAttempts(lectureId)
      .then((attempts) => {
        if (active) setHistory(attempts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lectureId, tracked]);

  /** Replay the questions already in state; never re-requests from Gemini. */
  function restart() {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setMissed([]);
    setOutcome('');
  }

  /** Practise only the questions answered wrong, from this quiz or a saved attempt. */
  function retry(questions: QuizQuestion[], title: string) {
    if (!questions.length) return;
    setQuiz({ title: `${title} · missed questions`, questions });
    setRetrying(true);
    restart();
  }

  async function finishFullQuiz(total: number, finalScore: number, wrong: QuizQuestion[]) {
    if (!tracked) return;
    try {
      const attempt = await recordQuizAttempt(lectureId, {
        score: finalScore,
        total,
        missed: wrong,
      });
      setHistory((value) => [attempt, ...value]);
      const confidence = confidenceFromQuiz(finalScore, total);
      onReviewed?.(await recordReview(lectureId, confidence));
      setOutcome(describeQuizReview(confidence));
      void refreshReviewReminders().catch(() => {});
    } catch (caught) {
      setOutcome(`Your score was not saved: ${message(caught)}`);
    }
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
      setRetrying(false);
      restart();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  function choose(option: string, item: QuizQuestion) {
    // Answers lock on first tap, so the score can never be inflated.
    if (selected !== null) return;
    setSelected(option);
    if (option === item.correctAnswer) setScore((value) => value + 1);
    else setMissed((value) => [...value, item]);
  }

  function advance() {
    if (!quiz || selected === null) return;
    if (index + 1 >= quiz.questions.length) {
      setFinished(true);
      if (!retrying) void finishFullQuiz(quiz.questions.length, score, missed);
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
        {!quiz && history[0] ? (
          <ThemedText style={[styles.meta, { color: theme.textSecondary }]}>
            Last quiz: {history[0].score} of {history[0].total} correct ·{' '}
            {new Date(history[0].attemptedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </ThemedText>
        ) : null}
        {quiz ? null : (
          <View style={styles.actions}>
            {action(busy === 'quiz' ? 'Generating…' : 'Generate quiz', makeQuiz, {
              primary: !history[0]?.missed.length,
              disabled: busy !== null,
            })}
            {history[0]?.missed.length
              ? action(
                  `Retry ${history[0].missed.length} missed`,
                  () => retry(history[0].missed, 'Last quiz'),
                  { primary: true, disabled: busy !== null },
                )
              : null}
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
                        onPress={() => choose(option, item)}
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
            {outcome ? (
              <ThemedText
                accessibilityLiveRegion="polite"
                style={[styles.text, { color: theme.textSecondary }]}
              >
                {outcome}
              </ThemedText>
            ) : retrying ? (
              <ThemedText style={[styles.text, { color: theme.textSecondary }]}>
                Practice round. It does not change your review schedule.
              </ThemedText>
            ) : null}
            {missed.length ? (
              <View style={styles.missedList}>
                <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                  To go over
                </ThemedText>
                {missed.map((item) => (
                  <View key={item.question} style={[styles.missed, { borderColor: theme.border }]}>
                    <ThemedText style={styles.text}>{item.question}</ThemedText>
                    <ThemedText style={[styles.meta, { color: theme.success }]}>
                      Answer: {item.correctAnswer}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.actions}>
              {missed.length
                ? action(`Retry the ${missed.length} you missed`, () => retry(missed, quiz.title), {
                    primary: true,
                  })
                : null}
              {action('Retake all', () => {
                // Answers are fresh in mind, so a retake is practice, not a review.
                setRetrying(true);
                restart();
              })}
              {action('Close', () => {
                setQuiz(null);
                setRetrying(false);
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
  missedList: { gap: 6 },
  missed: { borderWidth: 1, borderRadius: Radius.medium, padding: 10, gap: 4 },
});
