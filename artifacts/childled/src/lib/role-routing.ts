export const roleOverviewPaths = {
  SLP: '/overview',
  Parent: '/family-overview',
  Teacher: '/teacher-overview',
  Administrator: '/admin-overview',
  OT: '/ot-overview',
  PT: '/pt-overview',
  BCBA: '/bcba-overview',
} as const;

export const authReturnPathStorageKey = 'childled-auth-return-path';
export const authLogoutStorageKey = 'childled-auth-logout';

export const roleOverviewPath = (role?: string | null) => {
  if (!role) return undefined;
  return roleOverviewPaths[role as keyof typeof roleOverviewPaths];
};

export const isRoleOverviewPath = (path: string) =>
  Object.values(roleOverviewPaths).includes(path as (typeof roleOverviewPaths)[keyof typeof roleOverviewPaths]);

const clinicalOnlyPaths = new Set([
  '/session',
  '/manual-session',
  '/service-setup',
  '/reports',
  '/clinical-knowledge',
  '/aac-planning',
  '/clinician-learning',
  '/caseload',
]);

const administratorPaths = new Set([
  '/admin-overview',
  '/admin-conversations',
  '/security',
]);

export const isRoleRestrictedPath = ({
  path,
  role,
  isAdmin = false,
  isSuperAdmin = false,
  isRolePreview = false,
  isNativeDevelopmentDemo = false,
}: {
  path: string;
  role?: string | null;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isRolePreview?: boolean;
  isNativeDevelopmentDemo?: boolean;
}) => {
  const roleHome = roleOverviewPath(role);
  const canUseClinicalPortal = role === 'SLP' || isNativeDevelopmentDemo;

  return (
    (isRoleOverviewPath(path) && roleHome !== path) ||
    (clinicalOnlyPaths.has(path) && !canUseClinicalPortal) ||
    (role === 'Teacher' && path === '/language-journey') ||
    (path === '/family-resources' && role !== 'Parent') ||
    (path === '/teacher-resources' && role !== 'Teacher') ||
    (path === '/students' && role !== 'Teacher') ||
    (administratorPaths.has(path) && !isAdmin) ||
    (path === '/ux-testing' && (!isSuperAdmin || isRolePreview))
  );
};

const isInternalPath = (path: string) =>
  path.startsWith('/') &&
  !path.startsWith('//') &&
  !path.startsWith('/sign-in') &&
  !path.startsWith('/sign-up');

export const authReturnPathFor = (location: string) => {
  if (!isInternalPath(location)) return undefined;
  const path = location.split('?')[0] || '/';
  return path === '/' || isRoleOverviewPath(path) ? undefined : location;
};

export const rememberAuthReturnPath = (location: string) => {
  const returnPath = authReturnPathFor(location);
  if (returnPath) {
    window.sessionStorage.setItem(authReturnPathStorageKey, returnPath);
  }
};

export const consumeAuthReturnPath = () => {
  const returnPath = window.sessionStorage.getItem(authReturnPathStorageKey);
  window.sessionStorage.removeItem(authReturnPathStorageKey);
  return returnPath && isInternalPath(returnPath) ? returnPath : undefined;
};

export const clearAuthReturnPath = () => {
  window.sessionStorage.removeItem(authReturnPathStorageKey);
};

export const markAuthLogout = () => {
  clearAuthReturnPath();
  window.sessionStorage.setItem(authLogoutStorageKey, 'true');
};

export const consumeAuthLogout = () => {
  const marked = window.sessionStorage.getItem(authLogoutStorageKey) === 'true';
  if (marked) window.sessionStorage.removeItem(authLogoutStorageKey);
  return marked;
};
