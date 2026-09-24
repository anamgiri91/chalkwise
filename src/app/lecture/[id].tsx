import type { PropsWithChildren } from 'react';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/Screen';
import { AppIcon } from '@/components/ui/AppIcon';
import { BackButton } from '@/components/ui/BackButton';
import { RowGroup, Section, Toolbar } from '@/components/ui/DataRow';
import { StudyActions } from '@/components/StudyActions';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getLecture } from '@/services/lectures';
import { getCourse } from '@/services/courses';
import { getMaterialUrl, getMaterials } from '@/services/materials';
import {
  getLectureSharing,
  setLectureSharing,
  recordReview,
  getReviews,
  getWorkspaceCapabilities,
} from '@/services/study';
import type { Course, Lecture, LectureReview, LectureSharing, ReviewConfidence } from '@/types';

/**
 * A notebook is two parallel documents: the photos the student captured and the
 * notes Chalkwise generated from them. Wide windows put them side by side so a
 * claim can be checked against its source without scrolling; narrower windows
 * stack source first.
 */
const SplitBreakpoint = 1100;

const reviewOptions = [
  { value: 'again', label: 'Again · 4 hours' },
  { value: 'good', label: 'Good · tomorrow' },
  { value: 'easy', label: 'Easy · 3 days' },
] as const;

function dateOf(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Keeps "which of these did a person write" answerable at a glance. */
function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'generated' }) {
  const theme = useTheme();
  const generated = tone === 'generated';
  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: generated ? theme.warningSurface : theme.backgroundSelected },
      ]}
    >
      <ThemedText
        style={[styles.tagLabel, { color: generated ? theme.warning : theme.textSecondary }]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

function ColumnHead({
  label,
  count,
  tag,
  tone,
  caption,
}: {
  label: string;
  count?: number;
  tag: string;
  tone?: 'neutral' | 'generated';
  caption?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.head}>
      <View style={styles.headRow}>
        <ThemedText accessibilityRole="header" style={styles.headLabel}>
          {label}
        </ThemedText>
        {typeof count === 'number' ? (
          <ThemedText style={[styles.count, { color: theme.textSecondary }]}>{count}</ThemedText>
        ) : null}
        <Tag label={tag} tone={tone} />
      </View>
      {caption ? (
        <ThemedText style={[styles.caption, { color: theme.textTertiary }]}>{caption}</ThemedText>
      ) : null}
    </View>
  );
}

/** A padded block inside a RowGroup, separated from the previous one by a hairline. */
function Block({ children, first = true }: PropsWithChildren<{ first?: boolean }>) {
  const theme = useTheme();
  return (
    <View style={[styles.block, !first && { borderTopWidth: 1, borderTopColor: theme.border }]}>
      {children}
    </View>
  );
}

function Ghost({
  label,
  onPress,
  disabled = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed, hovered }) => [
        styles.ghost,
        { borderColor: theme.border, backgroundColor: theme.background },
        (pressed || hovered) && !disabled ? { backgroundColor: theme.backgroundHover } : null,
        disabled && styles.dim,
      ]}
    >
      <ThemedText style={styles.ghostLabel}>{label}</ThemedText>
    </Pressable>
  );
}

function Notice({
  message,
  action,
  onPress,
}: {
  message: string;
  action: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.notice,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
      ]}
    >
      <ThemedText accessibilityRole="alert" style={[styles.noticeText, { color: theme.danger }]}>
        {message}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action}
        onPress={onPress}
        hitSlop={8}
      >
        {({ pressed }) => (
          <ThemedText
            style={[styles.noticeText, { color: theme.accent, opacity: pressed ? 0.6 : 1 }]}
          >
            {action}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

function Lines({ label, lines }: { label: string; lines: string[] }) {
  const theme = useTheme();
  if (!lines.length) return null;
  return (
    <Section label={label} count={lines.length}>
      <RowGroup>
        {lines.map((line, index) => (
          <View
            key={`${index}:${line}`}
            style={[
              styles.line,
              index ? { borderTopWidth: 1, borderTopColor: theme.border } : null,
            ]}
          >
            <ThemedText style={[styles.index, { color: theme.textTertiary }]}>
              {String(index + 1).padStart(2, '0')}
            </ThemedText>
            <ThemedText style={styles.body}>{line}</ThemedText>
          </View>
        ))}
      </RowGroup>
    </Section>
  );
}

export default function LectureNotebookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const capabilities = getWorkspaceCapabilities();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [originals, setOriginals] = useState<{ id: string; url: string | null }[]>([]);
  const [sourceError, setSourceError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState<LectureSharing | null>(null);
  const [review, setReview] = useState<LectureReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError('');
      setActionError('');
      setSourceError(false);
      setOriginals([]);
      setSharing(null);
      setReview(null);
      setShowNotes(true);
      async function load() {
        const note = await getLecture(id);
        if (!active) return;
        setLecture(note);
        if (!note) return;
        const [courseResult, materialsResult, sharingResult, reviewsResult] =
          await Promise.allSettled([
            getCourse(note.courseId),
            getMaterials(id),
            getLectureSharing(id),
            getReviews(),
          ]);
        if (!active) return;
        setCourse(courseResult.status === 'fulfilled' ? courseResult.value : null);
        setSharing(sharingResult.status === 'fulfilled' ? sharingResult.value : null);
        setReview(
          reviewsResult.status === 'fulfilled'
            ? (reviewsResult.value.find((item) => item.lectureId === id) ?? null)
            : null,
        );
        if (sharingResult.status === 'rejected' || reviewsResult.status === 'rejected')
          setActionError('Some study settings could not load. Refresh to try again.');
        if (materialsResult.status === 'fulfilled') {
          const photos = await Promise.all(
            materialsResult.value.map(async (material) => ({
              id: material.id,
              url: await getMaterialUrl(material),
            })),
          );
          if (active) setOriginals(photos);
        } else setSourceError(true);
      }
      load()
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not open this notebook.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [id, attempt]),
  );
  async function saveReview(confidence: ReviewConfidence) {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      setReview(await recordReview(id, confidence));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save your review.');
    } finally {
      setBusy(false);
    }
  }
  async function toggleSharing() {
    if (busy || !sharing?.canEdit) return;
    setBusy(true);
    setActionError('');
    try {
      setSharing(await setLectureSharing(id, !sharing.shared));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update sharing.');
    } finally {
      setBusy(false);
    }
  }
  const retry = () => setAttempt((x) => x + 1);
  if (loading)
    return (
      <Screen showBottomNav wide>
        <View style={styles.header}>
          <BackButton />
          <Toolbar title="Notebook" />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.textSecondary} accessibilityLabel="Opening notebook" />
        </View>
      </Screen>
    );
  if (error)
    return (
      <Screen showBottomNav wide>
        <View style={styles.header}>
          <BackButton />
          <Toolbar title="Notebook" />
        </View>
        <Notice message={error} action="Try again" onPress={retry} />
      </Screen>
    );
  if (!lecture)
    return (
      <Screen showBottomNav wide>
        <View style={styles.header}>
          <BackButton />
          <Toolbar title="Notebook" />
        </View>
        <Section label="Notebook unavailable">
          <RowGroup>
            <Block>
              <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
                It may be private or no longer shared with you.
              </ThemedText>
            </Block>
          </RowGroup>
        </Section>
      </Screen>
    );
  const canReview =
    capabilities.reviews && (capabilities.mode === 'mock' || sharing?.canEdit === true);
  const split = width >= SplitBreakpoint;
  const photos = sourceError
    ? 'Originals unavailable'
    : `${originals.length} photo${originals.length === 1 ? '' : 's'}`;
  return (
    <Screen showBottomNav wide>
      <View style={styles.header}>
        <BackButton />
        <Toolbar title={lecture.title} />
        <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
          {[course?.code ?? 'No course', dateOf(lecture.createdAt), photos].join('   ·   ')}
        </ThemedText>
      </View>

      {actionError ? <Notice message={actionError} action="Refresh" onPress={retry} /> : null}

      {canReview ? (
        <Section label="Review">
          <RowGroup>
            <Block>
              <View style={styles.promptRow}>
                <ThemedText style={[styles.body, styles.grow]}>
                  Explain {lecture.keyConcepts[0] ?? 'the main idea'} in your own words.
                </ThemedText>
                <Ghost
                  label={showNotes ? 'Hide notes' : 'Show notes'}
                  accessibilityHint={
                    showNotes
                      ? 'Hides the originals and notes so you can answer from memory.'
                      : 'Shows the originals and notes again.'
                  }
                  onPress={() => setShowNotes((value) => !value)}
                />
              </View>
            </Block>
            <Block first={false}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                Confidence
              </ThemedText>
              <View style={styles.choices}>
                {reviewOptions.map((option) => {
                  const selected = review?.confidence === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      accessibilityState={{ disabled: busy, selected }}
                      disabled={busy}
                      onPress={() => saveReview(option.value)}
                      hitSlop={6}
                      style={({ pressed, hovered }) => [
                        styles.choice,
                        {
                          borderColor: selected ? theme.borderStrong : theme.border,
                          backgroundColor: selected ? theme.backgroundSelected : theme.background,
                        },
                        (pressed || hovered) && !busy && !selected
                          ? { backgroundColor: theme.backgroundHover }
                          : null,
                        busy && styles.dim,
                      ]}
                    >
                      <ThemedText style={styles.choiceLabel}>{option.label}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </Block>
            {review ? (
              <Block first={false}>
                <ThemedText
                  accessibilityLiveRegion="polite"
                  style={[styles.caption, { color: theme.textSecondary }]}
                >
                  Review saved. Next review{' '}
                  {new Date(review.nextReviewAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  .{capabilities.mode === 'mock' ? ' Demo progress resets on reload.' : ''}
                </ThemedText>
              </Block>
            ) : null}
          </RowGroup>
        </Section>
      ) : null}

      {showNotes ? (
        <>
          <View style={[styles.columns, split && styles.columnsSplit]}>
            <View style={[styles.column, split && styles.sourceColumn]}>
              <ColumnHead
                label="Originals"
                count={sourceError ? undefined : originals.length}
                tag="Source"
              />
              {sourceError ? (
                <Notice
                  message="Originals could not load. Your notes are still available."
                  action="Retry originals"
                  onPress={retry}
                />
              ) : originals.length ? (
                <RowGroup>
                  {originals.map((photo, index) => (
                    <View
                      key={photo.id}
                      style={[
                        styles.photo,
                        index ? { borderTopWidth: 1, borderTopColor: theme.border } : null,
                      ]}
                    >
                      <ThemedText style={[styles.photoLabel, { color: theme.textSecondary }]}>
                        Source {index + 1}
                      </ThemedText>
                      {photo.url ? (
                        <Image
                          source={{ uri: photo.url }}
                          accessibilityLabel={`Original lecture photo ${index + 1}`}
                          resizeMode="contain"
                          style={[styles.image, { backgroundColor: theme.backgroundHover }]}
                        />
                      ) : (
                        <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
                          Temporarily unavailable. Refresh to request a new link.
                        </ThemedText>
                      )}
                    </View>
                  ))}
                </RowGroup>
              ) : (
                <RowGroup>
                  <Block>
                    <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
                      {capabilities.mode === 'mock'
                        ? 'This sample notebook has no uploaded originals.'
                        : 'No original photos are attached to this notebook.'}
                    </ThemedText>
                  </Block>
                </RowGroup>
              )}
            </View>

            <View style={[styles.column, split && styles.notesColumn]}>
              <ColumnHead
                label="Notes"
                tag="Generated"
                tone="generated"
                caption="Written by Chalkwise from the originals. Check details against them."
              />
              <RowGroup>
                <Block>
                  <ThemedText style={styles.body}>{lecture.summary}</ThemedText>
                </Block>
              </RowGroup>
              <Lines label="Key concepts" lines={lecture.keyConcepts} />
              <Lines label="Important points" lines={lecture.importantPoints} />
              <Lines label="Assignments" lines={lecture.assignments} />
              <Lines label="Exam mentions" lines={lecture.examMentions} />
            </View>
          </View>

          <Section label="Ask and quiz">
            {capabilities.liveAI ? (
              <StudyActions key={id} lectureId={id} />
            ) : (
              <RowGroup>
                <Block>
                  <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
                    Source-grounded questions and quizzes need a connected workspace.
                  </ThemedText>
                </Block>
              </RowGroup>
            )}
          </Section>
        </>
      ) : (
        <Section label="Notes hidden">
          <RowGroup>
            <Block>
              <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
                Answer from memory, then show the notes to check yourself.
              </ThemedText>
            </Block>
          </RowGroup>
        </Section>
      )}

      {sharing?.canEdit ? (
        <Section label="Sharing">
          <RowGroup>
            <View style={styles.control}>
              <AppIcon
                name={sharing.shared ? 'users' : 'lock'}
                size={15}
                color={theme.textSecondary}
              />
              <View style={styles.grow}>
                <ThemedText style={styles.rowTitle}>
                  {sharing.shared ? 'Shared with this course' : 'Private to you'}
                </ThemedText>
                <ThemedText style={[styles.caption, { color: theme.textTertiary }]}>
                  Accepted friends in this course can read and copy this notebook. Copies they
                  already made stay theirs.
                </ThemedText>
              </View>
              <Ghost
                label={sharing.shared ? 'Turn off' : 'Share'}
                disabled={busy}
                onPress={toggleSharing}
              />
            </View>
          </RowGroup>
        </Section>
      ) : sharing ? (
        <Section label="Sharing">
          <RowGroup>
            <View style={styles.control}>
              <AppIcon name="users" size={15} color={theme.textSecondary} />
              <View style={styles.grow}>
                <ThemedText style={styles.rowTitle}>Shared with you</ThemedText>
                <ThemedText style={[styles.caption, { color: theme.textTertiary }]}>
                  Add a copy from CatchUp to review it.
                </ThemedText>
              </View>
            </View>
          </RowGroup>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  metaText: { fontSize: 12.5, lineHeight: 18 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  noticeText: { fontSize: 12.5, lineHeight: 18, fontWeight: '500', flexShrink: 1 },
  columns: { gap: 24 },
  columnsSplit: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  column: { gap: 16 },
  sourceColumn: { flex: 1, minWidth: 0 },
  notesColumn: { flex: 1.25, minWidth: 0 },
  head: { gap: 4 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
  headLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  count: { fontSize: 12.5, lineHeight: 18, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 12.5, lineHeight: 18 },
  tag: { paddingHorizontal: 7, height: 19, justifyContent: 'center', borderRadius: Radius.small },
  tagLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  block: { paddingHorizontal: 14, paddingVertical: 12, gap: 8, minHeight: 44 },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  index: { fontSize: 12, lineHeight: 20, fontVariant: ['tabular-nums'], minWidth: 17 },
  body: { fontSize: 13.5, lineHeight: 20 },
  rowTitle: { fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  grow: { flexShrink: 1, flexGrow: 1, gap: 2 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  choice: {
    flexGrow: 1,
    minWidth: 112,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: Radius.small,
  },
  choiceLabel: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  ghost: {
    height: 30,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  ghostLabel: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  dim: { opacity: 0.6 },
  photo: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  photoLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.medium },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
});
