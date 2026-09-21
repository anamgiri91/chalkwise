export function workspaceSection(pathname: string) {
  if (pathname === '/courses' || pathname.startsWith('/course/')) return 'courses';
  if (pathname === '/library' || pathname.startsWith('/lecture/')) return 'library';
  if (pathname === '/catchup') return 'shared';
  if (pathname === '/profile') return 'profile';
  return 'overview';
}

export function workspaceLabel(pathname: string) {
  const section = workspaceSection(pathname);
  return { overview: 'Overview', library: 'Notebooks', courses: 'Courses', shared: 'Shared with me', profile: 'Account' }[section];
}
