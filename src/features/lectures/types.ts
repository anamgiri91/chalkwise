/** The note lists a source photo can be recorded for. */
export type NoteListKey = 'keyConcepts' | 'importantPoints' | 'assignments' | 'examMentions';

/**
 * For each note line, the 1-based number of the original photo it came from, or null
 * when no single photo could be identified. Arrays line up with the lists they describe.
 */
export type NoteSources = Partial<Record<NoteListKey, (number | null)[]>>;

export interface Lecture {
  id: string;
  courseId: string;
  title: string;
  summary: string;
  keyConcepts: string[];
  importantPoints: string[];
  assignments: string[];
  examMentions: string[];
  createdAt: string;
  /** Absent for notes saved before sources were recorded. */
  sources?: NoteSources;
  /** Set once the owner has corrected the generated notes. */
  editedAt?: string | null;
}

export interface LectureAnalysis {
  suggestedCourse: string | null;
  title: string;
  topic: string;
  summary: string;
  keyConcepts: string[];
  importantPoints: string[];
  assignments: string[];
  examMentions: string[];
  sources?: NoteSources;
}

export type CreateLectureInput = Omit<Lecture, 'id' | 'createdAt' | 'editedAt'>;

/** The fields an owner can correct after saving. */
export type LectureEdit = Pick<
  Lecture,
  'title' | 'summary' | 'keyConcepts' | 'importantPoints' | 'assignments' | 'examMentions'
> & { sources?: NoteSources };

export interface Quiz {
  lectureId: string;
  questions: {
    prompt: string;
    choices: string[];
    correctAnswerIndex: number;
    explanation: string;
  }[];
}
