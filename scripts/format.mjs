import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Incremental adoption: format the new architecture and touched feature files,
// without rewriting historical migrations or unrelated work in the repository.
const paths = [
  'server/src',
  'server/tests',
  'tests',
  'scripts/format.mjs',
  'src/features/study',
  'src/features/courses/matchCourse.ts',
  'src/lib/api.ts',
  'src/lib/captureExtraction.ts',
  'src/lib/grounding.ts',
  'src/lib/cognito.ts',
  'src/lib/http.ts',
  'src/lib/sessionManager.ts',
  'src/services',
  'src/types/study.ts',
  'src/app/_layout.tsx',
  'src/app/account-help.tsx',
  'src/app/login.tsx',
  'src/app/signup.tsx',
  'src/app/index.tsx',
  'src/app/courses.tsx',
  'src/app/catchup.tsx',
  'src/app/profile.tsx',
  'src/app/lecture/[id].tsx',
  'src/components/AppBottomNav.tsx',
  'src/components/StudyActions.tsx',
  'src/components/ui/AppIcon.tsx',
  'src/components/ui/Screen.tsx',
  'src/components/ui/AppCard.tsx',
  'src/components/ui/AppButton.tsx',
  'src/constants/palette.ts',
  'src/constants/theme.ts',
];
const root = fileURLToPath(new URL('../', import.meta.url));
const bin = fileURLToPath(new URL('../node_modules/prettier/bin/prettier.cjs', import.meta.url));
const result = spawnSync(
  process.execPath,
  [bin, process.argv.includes('--write') ? '--write' : '--check', ...paths],
  { cwd: root, stdio: 'inherit' },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
