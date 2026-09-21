import Svg, { Path } from 'react-native-svg';

const paths = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  book: 'M12 5v16M3 3h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z',
  camera:
    'M8 5 9 3h6l1 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm8 8a4 4 0 1 0-8 0 4 4 0 0 0 8 0',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  clock: 'M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0M12 6v6l4 2',
  search: 'M21 21l-5-5M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3M5 10h14v12H5ZM12 15v3',
  plus: 'M12 5v14M5 12h14',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12m13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
} as const;
export type IconName = keyof typeof paths;
export function AppIcon({
  name,
  size = 22,
  color = '#3157D5',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={paths[name]}
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
