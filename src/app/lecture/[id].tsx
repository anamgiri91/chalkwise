import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/Screen';
import { AppCard } from '@/components/ui/AppCard';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { EmptyState, SectionHeader, StatusBadge, formatDate } from '@/components/ui/Editorial';
import { StudyActions } from '@/components/StudyActions';
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

export default function LectureNotebookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
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
  if (loading)
    return (
      <Screen headerAbove>
        <EmptyState
          loading
          title="Opening your notebook"
          description="Loading the notes and original material."
        />
      </Screen>
    );
  if (error)
    return (
      <Screen headerAbove>
        <EmptyState
          title="This notebook couldn't open"
          description={error}
          action="Try again"
          onPress={() => setAttempt((x) => x + 1)}
        />
      </Screen>
    );
  if (!lecture)
    return (
      <Screen headerAbove>
        <EmptyState
          title="Notebook unavailable"
          description="It may be private or no longer shared with you."
        />
      </Screen>
    );
  const canReview =
    capabilities.reviews && (capabilities.mode === 'mock' || sharing?.canEdit === true);
  return (
    <Screen headerAbove>
      <View style={styles.tags}>
        <StatusBadge label={course?.code ?? 'NOTEBOOK'} />
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(lecture.createdAt)}
        </ThemedText>
      </View>
      <ThemedText type="title" style={{ fontSize: 34, lineHeight: 42, letterSpacing: -0.8 }}>
        {lecture.title}
      </ThemedText>
      {canReview ? (
        <AppCard>
          <View style={styles.row}>
            <AppIcon name="spark" />
            <ThemedText style={styles.sectionTitle}>A moment of active recall</ThemedText>
          </View>
          <ThemedText>
            How would you explain {lecture.keyConcepts[0] ?? 'the main idea'} in your own words?
          </ThemedText>
          <AppButton
            secondary
            title={showNotes ? 'Hide notes and try from memory' : 'Reveal study notes'}
            onPress={() => setShowNotes((value) => !value)}
          />
          <ThemedText type="small" themeColor="textSecondary">
            After checking the source, how did it go?
          </ThemedText>
          <View style={styles.reviewButtons}>
            {(
              [
                { value: 'again', label: 'Again · 4 hours' },
                { value: 'good', label: 'Good · tomorrow' },
                { value: 'easy', label: 'Easy · 3 days' },
              ] as const
            ).map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{
                  disabled: busy,
                  selected: review?.confidence === option.value,
                }}
                disabled={busy}
                onPress={() => saveReview(option.value)}
                style={[
                  styles.reviewButton,
                  {
                    backgroundColor:
                      review?.confidence === option.value
                        ? theme.backgroundSelected
                        : theme.background,
                  },
                ]}
              >
                <ThemedText type="smallBold">{option.label}</ThemedText>
              </Pressable>
            ))}
          </View>
          {review ? (
            <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary" type="small">
              Review saved. Revisit{' '}
              {new Date(review.nextReviewAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
              .{capabilities.mode === 'mock' ? ' Demo progress resets on reload.' : ''}
            </ThemedText>
          ) : null}
        </AppCard>
      ) : null}
      {actionError ? (
        <AppCard>
          <ThemedText accessibilityRole="alert">{actionError}</ThemedText>
          <AppButton secondary title="Refresh notebook" onPress={() => setAttempt((x) => x + 1)} />
        </AppCard>
      ) : null}
      {showNotes ? (
        <>
          <View style={styles.section}>
            <SectionHeader
              title="Original material"
              detail={`${originals.length} photo${originals.length === 1 ? '' : 's'}`}
            />
            <ThemedText themeColor="textSecondary" type="small">
              The source of truth. Keep this in view when checking AI notes.
            </ThemedText>
            {sourceError ? (
              <EmptyState
                title="Originals couldn't load"
                description="Your saved notes are still available."
                action="Retry originals"
                onPress={() => setAttempt((x) => x + 1)}
              />
            ) : originals.length ? (
              originals.map((photo, index) => (
                <AppCard key={photo.id}>
                  <ThemedText type="smallBold">SOURCE {index + 1}</ThemedText>
                  {photo.url ? (
                    <Image
                      source={{ uri: photo.url }}
                      accessibilityLabel={`Original lecture photo ${index + 1}`}
                      resizeMode="contain"
                      style={{
                        width: '100%',
                        aspectRatio: 0.85,
                        borderRadius: 12,
                        backgroundColor: theme.background,
                      }}
                    />
                  ) : (
                    <ThemedText themeColor="textSecondary">
                      This original is temporarily unavailable. Refresh to request a new link.
                    </ThemedText>
                  )}
                </AppCard>
              ))
            ) : (
              <AppCard>
                <ThemedText themeColor="textSecondary">
                  {capabilities.mode === 'mock'
                    ? 'This sample notebook has no uploaded originals.'
                    : 'No original photos are attached to this notebook.'}
                </ThemedText>
              </AppCard>
            )}
          </View>
          <AppCard>
            <View style={styles.row}>
              <AppIcon name="book" />
              <ThemedText style={styles.sectionTitle}>AI-organized study notes</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Generated study aid · verify details against the original.
            </ThemedText>
            <ThemedText>{lecture.summary}</ThemedText>
          </AppCard>
          <NoteSection title="Key concepts" lines={lecture.keyConcepts} />
          <NoteSection title="Important points" lines={lecture.importantPoints} />
          <NoteSection title="Assignments mentioned" lines={lecture.assignments} />
          <NoteSection title="Exam mentions" lines={lecture.examMentions} />
          {capabilities.liveAI ? (
            <StudyActions key={id} lectureId={id} />
          ) : (
            <AppCard>
              <ThemedText style={styles.sectionTitle}>Practice with your own words</ThemedText>
              <ThemedText themeColor="textSecondary">
                Explain a key concept, check the sample notes, and mark your confidence above.
                Source-grounded AI questions and quizzes are available in a connected workspace.
              </ThemedText>
            </AppCard>
          )}
        </>
      ) : (
        <EmptyState
          title="Give your memory a little space"
          description="Explain the main idea out loud or write a few sentences. Reveal the notes when you're ready to check."
        />
      )}
      {sharing?.canEdit ? (
        <AppCard>
          <View style={styles.row}>
            <AppIcon name={sharing.shared ? 'users' : 'lock'} />
            <ThemedText style={styles.sectionTitle}>
              {sharing.shared ? 'Shared with classmates' : 'Private to you'}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Sharing lets accepted friends in this course read this notebook and copy it. You can
            turn it off; existing copies remain theirs.
          </ThemedText>
          <AppButton
            secondary
            disabled={busy}
            title={sharing.shared ? 'Turn off sharing' : 'Share with friends in this course'}
            onPress={toggleSharing}
          />
        </AppCard>
      ) : sharing ? (
        <StatusBadge label="Shared notebook · add a copy from CatchUp to review" />
      ) : null}
    </Screen>
  );
}
function NoteSection({ title, lines }: { title: string; lines: string[] }) {
  return lines.length ? (
    <AppCard>
      <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {lines.map((line, index) => (
        <View key={`${index}:${line}`} style={styles.row}>
          <ThemedText themeColor="textSecondary">{String(index + 1).padStart(2, '0')}</ThemedText>
          <ThemedText style={{ flex: 1 }}>{line}</ThemedText>
        </View>
      ))}
    </AppCard>
  ) : null;
}
const styles = StyleSheet.create({
  tags: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  section: { gap: 14 },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '600', flexShrink: 1 },
  reviewButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  reviewButton: {
    padding: 12,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    flexGrow: 1,
  },
});
