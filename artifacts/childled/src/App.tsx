import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import {
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Link,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
  useUser,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  Activity as ActivityIcon,
  AlertCircle,
  AudioWaveform,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  Circle,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileText,
  Filter,
  GitMerge,
  Heart,
  Home,
  Leaf,
  Library,
  Lightbulb,
  Menu,
  MessageCircle,
  Mail,
  Mic,
  Minus,
  Plus,
  Printer,
  Pause,
  Play,
  RotateCcw,
  Search,
  Settings,
  Tablet,
  Shield,
  Sparkles,
  Square,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  UserRound,
  UserPlus,
  Users,
  Video,
  Volume2,
  X,
  Trash2,
} from "lucide-react";
import {
  getGetAdminSecurityOverviewQueryKey,
  getGetViewerQueryKey,
  getGetDeletionRequestQueryKey,
  getGetDictionaryInsightsQueryKey,
  getListDictionaryDuplicateSuggestionsQueryKey,
  getListLegacyPhraseObservationsQueryKey,
  getGetTeacherCommunicationHelperQueryKey,
  getGetPhraseTrendsQueryKey,
  getGetChildQueryKey,
  getGetDashboardQueryKey,
  getGetClinicianOverviewQueryKey,
  getGetTeacherOverviewQueryKey,
  getGetFrequentScriptsQueryKey,
  getGetRecurringLanguagePatternDetailQueryKey,
  getGetRecurringLanguagePatternsQueryKey,
  getGetSessionSoapNoteQueryKey,
  getGetSessionsDashboardQueryKey,
  getListSessionsQueryKey,
  getListChildrenQueryKey,
  getListDeletionRequestsQueryKey,
  getListGestaltsQueryKey,
  getListAacPlanningQueryKey,
  getListChildInterestsQueryKey,
  getListCareTeamInvitationsQueryKey,
  getGetTeamInboxQueryKey,
  getListClinicalKnowledgeSourcesQueryKey,
  getListClinicalKnowledgeInsightsQueryKey,
  getGetSessionTranscriptionDraftQueryKey,
  getGetSessionTranscriptionDraftQueryOptions,
  getListChildPhraseInboxQueryKey,
  getListCommunicationGoalsQueryKey,
  getGetManualSessionSetupQueryKey,
  useAddGestaltComment,
  useCreateChild,
  useCreateChildInterest,
  useCreateCareTeamInvitation,
  useCreateTeamMessage,
  useMarkTeamMessagesRead,
  useCreateDeletionRequest,
  useCreateGestalt,
  useDeleteGestalt,
  useMergeGestalts,
  useCreateObservation,
  useCreateSession,
  useGetAdminSecurityOverview,
  useGetDictionaryInsights,
  useListDictionaryDuplicateSuggestions,
  useDecideDictionaryDuplicateSuggestion,
  useListLegacyPhraseObservations,
  useRecoverLegacyPhraseObservation,
  useGetPhraseTrends,
  useGetChild,
  useGetDashboard,
  useGetClinicianOverview,
  useGetTeacherOverview,
  useGetFrequentScripts,
  useGetRecurringLanguagePatternDetail,
  useGetRecurringLanguagePatterns,
  useGetSessionTranscriptionDraft,
  useGetSessionsDashboard,
  useListChildren,
  useListDeletionRequests,
  useListGestalts,
  useListAacPlanning,
  useCreateAacPlanning,
  useUpdateAacPlanning,
  useRemoveAacPlanning,
  useListSessions,
  useRecordReportExport,
  useGetDeletionRequest,
  useReviewDeletionRequest,
  useTranscribeSessionAudio,
  useUpdateRetentionSettings,
  useUpdateTranscriptProvisionalPhrases,
  useUpdateTranscriptSpeakers,
  useUpdateTranscriptChildUtterances,
  useListChildPhraseInbox,
  useUpdateChildPhraseInbox,
  useRequestSessionAudioUpload,
  useCompleteSessionCalibration,
  useDeleteSessionCalibration,
  useDeleteSessionTranscriptionDraft,
  useDeleteSessionTranscriptPhrase,
  usePrepareSessionRecording,
  useListClinicalKnowledgeSources,
  useCreateClinicalKnowledgeSource,
  useListClinicalKnowledgeInsights,
  useGenerateClinicalKnowledgeInsights,
  useReviewClinicalKnowledgeInsight,
  useGetViewer,
  useListChildInterests,
  useListCareTeamInvitations,
  useGetTeamInbox,
  useLogPhraseObservation,
  useUpdateChildInterest,
  useDeleteChildInterest,
  useUpdateChildSensory,
  useUpdateChildProfile,
  useListCommunicationGoals,
  useCreateCommunicationGoal,
  useUpdateCommunicationGoal,
  useGetManualSessionSetup,
  useUpsertIepServiceRequirement,
  useUpdateCaseloadServiceSettings,
} from "@workspace/api-client-react";
import type {
  Activity as ActivityType,
  Child,
  ChildInterest,
  CareTeamInvitation,
  ChildSnapshot,
  ClinicalKnowledgeInsight,
  Comment,
  DeletionCategory,
  DeletionRequest,
  Dashboard,
  DictionaryDuplicateSuggestion,
  LegacyPhraseObservation,
  ClinicianOverview,
  FrequentScript,
  Gestalt,
  NlaStage,
  AacPlanningEntry,
  Observation,
  PhraseTrend,
  RecurringLanguagePattern,
  Session,
  SessionTranscript,
  TranscriptPhrase,
  Viewer,
  CommunicationGoal,
  TeamInbox as ApiTeamInbox,
  CaseloadServiceDeliveryType,
  IepServiceRequirement,
} from "@workspace/api-client-react";
import {
  citationsForTimelineEvidence,
  normalizeJourneyPhrase,
} from "@workspace/api-zod/language-journey";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  clearAuthReturnPath,
  consumeAuthLogout,
  consumeAuthReturnPath,
  isRoleOverviewPath,
  markAuthLogout,
  roleOverviewPath,
  rememberAuthReturnPath,
} from "@/lib/role-routing";
import { DocumentationCenter } from "@/pages/documentation-center";
import { FamilyResourcesPage } from "@/pages/family-resources";
import { TeacherResourcesPage } from "@/pages/teacher-resources";
import NotFound from "@/pages/not-found";
import { ClinicianUnclearSpeechPage } from "@/pages/unclear-speech";
import { ClinicianLearningPage } from "@/pages/clinician-learning";
import { ManualSessionTrackingPage } from "@/pages/manual-session";
import { CommunicationPassportPage } from "@/pages/communication-passport";
import {
  ClinicianQuickReferencePanel,
  openClinicianQuickReferences,
} from "@/components/clinician-quick-reference";
import { WorkflowCoaching } from "@/components/workflow-coaching";
import { ParentPortal, TeacherPortal } from "@/components/role-portals";
import { TeacherStudentsDashboard } from "@/components/teacher-students-dashboard";
import { TeacherClassroomDashboard } from "@/components/teacher-classroom-dashboard";
import { SharedChildProfile } from "@/components/shared-child-profile";
import { AacInformationCard } from "@/components/aac-information";
import { TeamInboxPage } from "@/components/team-inbox";
import {
  SpeakerCalibration,
  type CalibrationDiagnostics,
  type CaptureState as SpeakerCalibrationState,
} from "@/components/speaker-calibration";
import { AdminConversationCenter } from "@/components/admin-conversation-center";
import {
  SuperAdminRoleSwitcher,
  UxTestingCenter,
} from "@/components/super-admin-tools";
import {
  RequestBetaAccessPage,
  BetaNoticeScreen,
  SuperAdminBetaControls,
} from "@/components/beta-access";
import {
  CHILD_PROFILE_AUTHORIZATION_STATEMENT,
  LEGAL_REVIEW_NOTICE,
  privacyPolicySections,
  termsOfUseSections,
} from "@/content/legal";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const CHILDLED_TAGLINE =
  "Turning communication into shared understanding across home, school, and therapy.";
const developmentDemoEnabled =
  import.meta.env.VITE_ENABLE_DEVELOPMENT_DEMO === "true";
const developmentDemoStorageKey = "childled-development-demo";
const developmentDemoSessionStorageKey = "childled-development-demo-session";
const overviewSessionStoragePrefix = "childled-overview-session-since:";
const emptyCalibrationDiagnostics = (): CalibrationDiagnostics => ({
  uploadStatus: "not_started",
  voiceProfileStatus: "unavailable",
  verificationStatus: "not_run",
  stage: "capture",
});
function clearOverviewSessionMarkers() {
  Object.keys(window.sessionStorage)
    .filter((key) => key.startsWith(overviewSessionStoragePrefix))
    .forEach((key) => window.sessionStorage.removeItem(key));
}
type IconType = typeof Home;

type NavigationItem = {
  href: string;
  label: string;
  icon: IconType;
  badge?: number;
  emphasized?: boolean;
};

const clinicalNavItems: NavigationItem[] = [
  { href: "/overview", label: "Overview", icon: Home },
  { href: "/caseload", label: "My caseload", icon: Users },
  { href: "/session", label: "Sessions", icon: Mic },
  { href: "/team-communication", label: "Inbox", icon: MessageCircle },
  { href: "/reports", label: "Session Notes", icon: FileText },
  { href: "/clinician-learning", label: "Resources", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

const parentNavItems: NavigationItem[] = [
  { href: "/family-overview", label: "Family overview", icon: Home },
  { href: "/family-resources", label: "Learning Center", icon: Lightbulb },
  { href: "/team-communication", label: "Inbox", icon: MessageCircle },
  { href: "/dictionary", label: "Phrase dictionary", icon: BookOpen },
  { href: "/activity", label: "Shared moments", icon: ActivityIcon },
  { href: "/privacy-requests", label: "Privacy requests", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

const teacherNavItems: NavigationItem[] = [
  { href: "/teacher-overview", label: "Classroom Overview", icon: Home },
  { href: "/students", label: "My Students", icon: Users, emphasized: true },
  { href: "/team-communication", label: "Inbox", icon: MessageCircle },
  { href: "/teacher-resources", label: "Resources", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNavItems: NavigationItem[] = [
  { href: "/admin-overview", label: "Admin overview", icon: Home },
  { href: "/team-communication", label: "Inbox", icon: MessageCircle },
  {
    href: "/admin-conversations",
    label: "Conversation center",
    icon: MessageCircle,
  },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

const initials = (name = "") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "EM";

const formatDate = (date?: string | null) => {
  if (!date) return "Recently";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const timeAgo = (date?: string | null) => {
  if (!date) return "just now";
  const value = new Date(date).getTime();
  if (Number.isNaN(value)) return date;
  const minutes = Math.max(1, Math.round((Date.now() - value) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

function logOverviewRequestFailure(endpoint: string, error: unknown) {
  const failure =
    error && typeof error === "object"
      ? (error as { name?: unknown; status?: unknown })
      : {};
  console.error("[ChildLed] clinician overview request failed", {
    endpoint,
    errorName: typeof failure.name === "string" ? failure.name : "UnknownError",
    status: typeof failure.status === "number" ? failure.status : undefined,
  });
}

function Avatar({
  name,
  className = "",
}: {
  name?: string;
  className?: string;
}) {
  return (
    <div
      data-testid={`avatar-${name ?? "team"}`}
      className={`grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-foreground ring-2 ring-card ${className}`}
    >
      {initials(name)}
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "outline" | "warm";
  "data-testid"?: string;
}) {
  const styles = {
    primary:
      "bg-primary text-primary-foreground shadow-[0_10px_20px_-14px_hsl(var(--brand-forest-950)/.9)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-ring",
    quiet:
      "bg-transparent text-muted-foreground hover:bg-secondary hover:text-primary focus-ring",
    outline:
      "border border-primary/20 bg-card text-primary shadow-sm hover:border-primary/45 hover:bg-secondary/70 focus-ring",
    warm: "gold-action text-accent-foreground hover:-translate-y-0.5 hover:brightness-[1.03] hover:shadow-md focus-ring",
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1
          data-testid={`heading-${title.toLowerCase().replaceAll(" ", "-")}`}
          className="serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
          {action}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: IconType;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="brand-card rounded-2xl border border-dashed border-border bg-card/75 px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
        <Icon size={22} />
      </div>
      <h3 className="serif text-xl font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function LoadingBlocks() {
  return (
    <div
      className="space-y-4"
      aria-label="Loading content"
      data-testid="status-loading"
    >
      <div className="skeleton h-28 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="skeleton h-52 rounded-2xl" />
        <div className="skeleton h-52 rounded-2xl" />
      </div>
    </div>
  );
}

function RoleRestrictedPage({ role }: { role?: string }) {
  const homePath = roleOverviewPath(role) ?? "/";
  return (
    <section
      data-testid="status-role-restricted"
      className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 text-center soft-shadow"
    >
      <Shield className="mx-auto text-primary" size={30} />
      <p className="mono mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
        Private care-team workspace
      </p>
      <h1 className="serif mt-2 text-3xl font-semibold">Restricted area</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {role === "Teacher"
          ? "Your classroom portal includes the communication profile, phrase dictionary, and shared observations for your assigned students."
          : role === "Parent"
            ? "Your family portal includes the language map, shared phrases, and ways to share what you notice at home."
            : "Your SLP workspace does not include administrator or owner-only tools."}
      </p>
      <Link
        href={homePath}
        data-testid="link-return-to-role-portal"
        className="mt-6 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Return to your portal
      </Link>
    </section>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const firstControl =
        dialog?.querySelector<HTMLElement>("[data-autofocus]") ??
        dialog?.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([data-testid="button-close-dialog"]), [href]',
        );
      (firstControl ?? dialog)?.focus({ preventScroll: true });
    });
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      const controls = Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((control) => control.offsetParent !== null);
      if (!controls.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeys);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleDialogKeys);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      data-testid="dialog-overlay"
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto overscroll-contain bg-primary/45 p-2 backdrop-blur-sm sm:p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="brand-card flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-6 sm:py-4 md:px-8">
          <h2 className="serif pr-2 text-xl font-semibold sm:text-2xl">
            {title}
          </h2>
          <Button
            variant="quiet"
            className="size-11 shrink-0 rounded-full p-0 sm:size-9"
            onClick={onClose}
            data-testid="button-close-dialog"
            aria-label="Close dialog"
          >
            <X size={18} />
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 md:p-8">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

type ClinicianChildAction = "record-session" | "add-phrase";

function ClinicianChildActionPicker({
  action,
  children,
  onClose,
  onSelect,
}: {
  action: ClinicianChildAction;
  children: Child[];
  onClose: () => void;
  onSelect: (childId: number) => void;
}) {
  const [search, setSearch] = useState("");
  const actionLabel =
    action === "record-session" ? "record a session" : "add a phrase";
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredChildren = children.filter((child) =>
    [child.name, child.school, child.grade].some((value) =>
      value.toLocaleLowerCase().includes(normalizedSearch),
    ),
  );
  return (
    <Modal title={`Choose a child before you ${actionLabel}`} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Select the child this clinical activity belongs to. ChildLed will open
          the{" "}
          {action === "record-session" ? "session recorder" : "Add Phrase form"}{" "}
          for that child.
        </p>
        <label className="relative block">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search children by name, school, or grade"
            data-testid={`input-search-child-for-${action}`}
            className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        {children.length ? (
          filteredChildren.length ? (
            <div className="grid max-h-[44dvh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {filteredChildren.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onSelect(child.id)}
                  data-testid={`button-select-child-for-${action}-${child.id}`}
                  className="focus-ring flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left transition hover:border-primary/35 hover:bg-secondary/50"
                >
                  <Avatar
                    name={child.name}
                    className="size-11 bg-secondary text-xs"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-primary">
                      {child.name}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {child.school || "School not added"}
                    </span>
                  </span>
                  <ArrowRight
                    size={16}
                    className="ml-auto shrink-0 text-primary"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
              No children match “{search.trim()}”.
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
            No children are assigned to your caseload yet.
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ChildContextNav({
  child,
  childrenList,
  selectedId,
  onChange,
  workspaceStats,
}: {
  child?: Child;
  childrenList: Child[];
  selectedId?: number;
  onChange: (id: number) => void;
  workspaceStats?: {
    dictionaryCount?: number;
    frequentScriptsCount?: number;
    aacCandidatesCount?: number;
    lastSessionDate?: string | null;
  };
}) {
  const [location] = useLocation();
  const childQuery = selectedId ? `?childId=${selectedId}` : "";
  const childProfileHref = (section?: string) =>
    `/children${childQuery}${section ? `&section=${section}` : ""}`;

  if (!child) return null;

  const childNavItems = [
    {
      label: "Overview",
      href: childProfileHref(),
      icon: Home,
      description:
        "A shared snapshot of communication strengths, patterns, and recent change.",
    },
    {
      label: "Dictionary",
      href: `/dictionary${childQuery}`,
      icon: BookOpen,
      description:
        "Clinician-reviewed phrases, meanings, and communication evidence across settings.",
      badge: workspaceStats?.dictionaryCount,
    },
    {
      label: "AAC Planning",
      href: `/aac-planning${childQuery}`,
      icon: MessageCircle,
      description:
        "Vocabulary candidates being considered for communication systems.",
      badge: workspaceStats?.aacCandidatesCount,
    },
    {
      label: "Passport",
      href: `/communication-passport${childQuery}`,
      icon: FileText,
      description:
        "An SLP-reviewed, printable guide for approved communication partners.",
    },
    {
      label: "Timeline",
      href: `/language-journey${childQuery}`,
      icon: Clock3,
      description: "Language observations and reviewed changes across time.",
    },
    {
      label: "Unclear Speech",
      href: `/unclear-speech${childQuery}`,
      icon: AudioWaveform,
      description:
        "Preserved unclear vocalizations for careful clinician review.",
    },
    {
      label: "Team",
      href: `/team-communication${childQuery}`,
      icon: Users,
      description: "Child-scoped communication with the care team.",
    },
    {
      label: "Session Notes",
      href: `/reports${childQuery}`,
      icon: ClipboardList,
      description: "Evidence-grounded summaries and clinical documentation.",
    },
  ];
  const activePath = location.split("?")[0];
  const activeSection = new URLSearchParams(location.split("?")[1] ?? "").get(
    "section",
  );
  const activeItem =
    childNavItems.find((item) => {
      const itemPath = item.href.split("?")[0];
      const itemSection = new URLSearchParams(
        item.href.split("?")[1] ?? "",
      ).get("section");
      return (
        activePath === itemPath &&
        (itemPath !== "/children" ||
          (activeSection ?? "") === (itemSection ?? ""))
      );
    }) ?? childNavItems[0];

  return (
    <div className="sticky top-14 z-10 -mx-3 mb-5 border-b border-primary/10 bg-background/95 px-3 py-2 shadow-[0_12px_30px_-26px_hsl(var(--brand-forest-950)/.8)] backdrop-blur-xl sm:-mx-5 sm:mb-8 sm:px-5 sm:py-3 md:-mx-10 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={child.name}
              className="size-9 shrink-0 bg-secondary text-xs ring-2 ring-secondary/60 sm:size-11 sm:text-sm sm:ring-4"
            />
            <div className="min-w-0">
              <p className="mono text-[9px] font-bold uppercase tracking-[0.18em] text-primary/65">
                Child workspace
              </p>
              <h1 className="serif truncate text-xl font-semibold leading-tight text-foreground sm:text-2xl md:text-3xl">
                {child.name}
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Communication Profile &amp; Shared Language Map
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="button-child-context-selector"
                aria-label={`Switch child from ${child.name}`}
                className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-primary/15 bg-card px-3 py-2 text-xs font-semibold text-primary transition hover:border-primary/30 hover:bg-secondary/50 focus-ring sm:min-h-0"
              >
                <span className="hidden sm:inline">Switch child</span>
                <ChevronDown
                  size={14}
                  className="text-muted-foreground transition group-hover:text-foreground"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[240px] p-2">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Switch Child
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {childrenList.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onSelect={() => onChange(c.id)}
                  className="flex items-center gap-2 rounded-xl py-2"
                  data-testid={`menu-item-child-${c.id}`}
                >
                  <Avatar name={c.name} className="size-6" />
                  <span className="font-semibold">{c.name}</span>
                  {c.id === selectedId && (
                    <Check size={14} className="ml-auto text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {child.aacSnapshot && (
          <div className="hidden sm:block">
            <AacSnapshot snapshot={child.aacSnapshot} />
          </div>
        )}
        <div className="mt-3 hidden flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-muted-foreground sm:flex">
          <span>
            <strong className="text-foreground">
              {workspaceStats?.dictionaryCount ?? 0}
            </strong>{" "}
            dictionary phrases
          </span>
          <span>
            <strong className="text-foreground">
              {workspaceStats?.frequentScriptsCount ?? 0}
            </strong>{" "}
            frequent scripts
          </span>
          <span>
            <strong className="text-foreground">
              {workspaceStats?.aacCandidatesCount ?? 0}
            </strong>{" "}
            AAC candidates
          </span>
          {workspaceStats?.lastSessionDate && (
            <span>
              Last session{" "}
              <strong className="text-foreground">
                {formatDate(workspaceStats.lastSessionDate)}
              </strong>
            </span>
          )}
        </div>
        <nav
          className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none sm:mt-4"
          aria-label="Child context navigation"
        >
          {childNavItems.map((item) => {
            const itemPath = item.href.split("?")[0];
            const itemSection = new URLSearchParams(
              item.href.split("?")[1] ?? "",
            ).get("section");
            const isActive =
              activePath === itemPath &&
              (itemPath !== "/children" ||
                (activeSection ?? "") === (itemSection ?? ""));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-child-context-${item.label.toLowerCase().replaceAll(" ", "-")}`}
                title={item.description}
                className={`group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all focus-ring sm:min-h-0 sm:px-4 sm:text-sm ${
                  isActive
                    ? "bg-accent text-accent-foreground shadow-[0_8px_18px_-12px_hsl(var(--accent)/.95)]"
                    : "bg-secondary/55 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon size={15} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-primary/15 text-primary" : "bg-background/80 text-muted-foreground"}`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <p className="mt-2 hidden text-xs leading-5 text-muted-foreground md:block">
          {activeItem.description}
        </p>
      </div>
    </div>
  );
}

function AacSnapshot({
  snapshot,
  compact = false,
}: {
  snapshot?: NonNullable<Child["aacSnapshot"]>;
  compact?: boolean;
}) {
  if (!snapshot) return null;
  const confirmedDate = snapshot.lastConfirmedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(snapshot.lastConfirmedAt))
    : "Not confirmed";
  const vocabularySystem =
    snapshot.vocabularySystem || "Vocabulary not recorded";
  const device = snapshot.device || "Device not recorded";
  const accessMethod = snapshot.accessMethod || "Access method not recorded";
  const status = snapshot.isUser ? "AAC User" : "Not an AAC user";
  const accessibilitySummary = `AAC technology snapshot: ${status}; vocabulary system ${vocabularySystem}; device ${device}; access method ${accessMethod}; last confirmed ${confirmedDate}`;
  if (compact) {
    return (
      <div
        className="flex min-w-0 max-w-[52vw] items-center gap-2 rounded-xl border border-[#E8D58A] bg-[#FFF5CC] px-2 py-1.5 text-[10px] dark:border-[#8A7330] dark:bg-[#3F3518] sm:max-w-[min(52vw,32rem)] sm:px-2.5"
        data-testid="aac-snapshot-compact"
        aria-label={accessibilitySummary}
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#E8D58A]/45 text-primary dark:bg-[#8A7330]/45"
          aria-hidden="true"
        >
          <Tablet size={15} />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block font-bold text-primary">{status}</span>
          <span className="block truncate text-muted-foreground">
            {vocabularySystem} · {device} · {accessMethod} · {confirmedDate}
          </span>
        </span>
      </div>
    );
  }
  return (
    <section
      className="mt-3 rounded-2xl border border-[#E8D58A] bg-[#FFF5CC] px-3 py-2.5 dark:border-[#8A7330] dark:bg-[#3F3518]"
      data-testid="aac-snapshot"
      aria-label={accessibilitySummary}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="grid size-8 place-items-center rounded-xl bg-[#E8D58A]/45 text-primary dark:bg-[#8A7330]/45"
            aria-hidden="true"
          >
            <Tablet size={17} />
          </span>
          <div>
            <p className="mono text-[9px] font-bold uppercase tracking-[.16em] text-primary">
              AAC Snapshot
            </p>
            <p className="text-xs font-bold text-foreground">{status}</p>
          </div>
        </div>
        {snapshot.isUser ? (
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1 border-t border-[#E8D58A] pt-2 text-xs dark:border-[#8A7330] sm:flex sm:flex-wrap sm:items-center sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <div>
              <dt className="sr-only">Vocabulary system</dt>
              <dd className="font-semibold text-foreground">
                {vocabularySystem}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Device</dt>
              <dd className="font-semibold text-foreground">{device}</dd>
            </div>
            <div>
              <dt className="sr-only">Access method</dt>
              <dd className="font-semibold text-foreground">{accessMethod}</dd>
            </div>
            <div>
              <dt className="sr-only">Last confirmed</dt>
              <dd className="text-muted-foreground">
                Confirmed {confirmedDate}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="min-w-0 flex-1 border-t border-[#E8D58A] pt-2 text-xs text-muted-foreground dark:border-[#8A7330] sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            No AAC system is currently recorded for this child. Last confirmed{" "}
            {confirmedDate}.
          </div>
        )}
      </div>
    </section>
  );
}

function Shell({
  child,
  childrenList,
  selectedId,
  onChangeChild,
  showChildWorkspace,
  workspaceStats,
  children,
  navigation,
  navigationControls,
  isClinician,
}: {
  child?: Child;
  childrenList?: Child[];
  selectedId?: number;
  onChangeChild?: (id: number) => void;
  showChildWorkspace?: boolean;
  workspaceStats?: {
    dictionaryCount?: number;
    frequentScriptsCount?: number;
    aacCandidatesCount?: number;
    lastSessionDate?: string | null;
  };
  children: ReactNode;
  navigation: NavigationItem[];
  navigationControls?: ReactNode;
  isClinician?: boolean;
}) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const inboxNavigationItem = navigation.find(
    (item) => item.href.split("?")[0] === "/team-communication",
  );
  const inboxUnreadCount = inboxNavigationItem?.badge ?? 0;

  return (
    <div className="paper-grain min-h-[100dvh] bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 max-w-[88vw] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-3 text-sidebar-foreground transition-transform duration-300 md:w-64 md:px-4 md:py-6 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <button
          aria-label="Close menu"
          data-testid="button-close-mobile-nav-drawer"
          className="sticky top-0 z-40 ml-auto mb-1 shrink-0 rounded-lg bg-sidebar p-3 text-sidebar-foreground/70 shadow-sm hover:bg-sidebar-accent focus-ring md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
        <div className="mb-5 flex items-center gap-3 px-3 md:mb-10">
          <div className="gold-action grid size-10 place-items-center rounded-2xl text-accent-foreground">
            <Leaf size={21} strokeWidth={2.5} />
          </div>
          <div>
            <p className="serif text-2xl font-semibold leading-none text-sidebar-foreground">
              ChildLed
            </p>
            <p className="mono mt-1 text-[9px] uppercase tracking-[0.18em] text-accent">
              shared language
            </p>
          </div>
        </div>
        <div className="mb-4 px-3">
          <p className="mono text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/50">
            Your workspace
          </p>
        </div>
        <nav className="space-y-1" aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon, badge, emphasized }) => {
            const active = location.split("?")[0] === href;
            return (
              <Link
                key={href}
                href={href}
                data-testid={`link-nav-${label.toLowerCase().replaceAll(" ", "-")}`}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${active ? "bg-accent text-accent-foreground shadow-[0_10px_20px_-16px_hsl(var(--accent)/.85)]" : emphasized ? "bg-sidebar-accent/45 font-semibold text-sidebar-foreground/90 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"}`}
              >
                <Icon size={18} />
                <span>{label}</span>
                {badge ? (
                  <span
                    data-testid="badge-nav-inbox-unread"
                    className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-sidebar text-sidebar-foreground" : "bg-accent text-accent-foreground"}`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : (
                  active && (
                    <span className="ml-auto size-1.5 rounded-full bg-sidebar" />
                  )
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-4 md:block">
          <div className="mb-3 flex items-center gap-2 text-accent">
            <Sparkles size={15} />
            <span className="mono text-[9px] font-bold uppercase tracking-widest">
              A gentle nudge
            </span>
          </div>
          <p className="text-xs leading-5 text-sidebar-foreground/75">
            Every phrase is a bridge. Add what you hear, then let the team fill
            in the map together.
          </p>
        </div>
        <AccountFooter />
      </aside>
      {mobileOpen && (
        <button
          aria-label="Close menu"
          data-testid="button-close-mobile-nav"
          className="fixed inset-0 z-20 bg-primary/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-primary/10 bg-background/95 px-2 shadow-[0_8px_24px_-24px_hsl(var(--brand-forest-950)/.7)] backdrop-blur-xl sm:px-5 md:px-8">
          <div className="flex items-center gap-3">
            <button
              data-testid="button-open-mobile-nav"
              aria-label="Open main navigation"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted focus-ring md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <span>Workspace</span>
              {child && !isClinician && (
                <>
                  <span>/</span>
                  <span className="font-semibold text-foreground">
                    {child.name}
                  </span>
                </>
              )}
            </div>
            <span
              className={`${navigationControls ? "hidden" : "text-sm font-semibold"} sm:hidden`}
            >
              {child?.name && !isClinician ? child.name : "Getting started"}
            </span>
            {child && (!showChildWorkspace || !isClinician) && (
              <AacSnapshot snapshot={child.aacSnapshot} compact />
            )}
          </div>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            {navigationControls}
            {isClinician && (
              <button
                onClick={() => openClinicianQuickReferences()}
                data-testid="button-open-quick-references"
                aria-label="Open Quick References"
                className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted focus-ring sm:block"
                title="Quick References Library"
              >
                <Library size={18} />
              </button>
            )}
            <button
              data-testid="button-help"
              className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted focus-ring lg:block"
            >
              <CircleHelp size={18} />
            </button>
            <Link
              href={inboxNavigationItem?.href ?? "/team-communication"}
              data-testid="button-notifications"
              aria-label={`Open Inbox${inboxUnreadCount ? `, ${inboxUnreadCount} unread` : ""}`}
              title="Open Inbox"
              className="relative grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-ring sm:size-9"
            >
              <Bell size={18} />
              {inboxUnreadCount > 0 && (
                <span
                  data-testid="badge-header-inbox-unread"
                  className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1 py-0.5 text-[9px] font-bold leading-none text-accent-foreground ring-2 ring-background"
                >
                  {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6 md:px-10 md:py-8">
          {isClinician && <WorkflowCoaching />}
          {isClinician &&
            showChildWorkspace &&
            child &&
            childrenList &&
            selectedId &&
            onChangeChild && (
              <ChildContextNav
                child={child}
                childrenList={childrenList}
                selectedId={selectedId}
                onChange={onChangeChild}
                workspaceStats={workspaceStats}
              />
            )}
          {children}
        </div>
      </main>
      {isClinician && <ClinicianQuickReferencePanel />}
    </div>
  );
}

function AccountFooter() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const clearAndSignOut = () => {
    queryClient.clear();
    clearOverviewSessionMarkers();
    markAuthLogout();
    const wasDevelopmentDemo =
      window.localStorage.getItem(developmentDemoStorageKey) === "active";
    window.localStorage.removeItem(developmentDemoStorageKey);
    window.localStorage.removeItem(developmentDemoSessionStorageKey);
    if (wasDevelopmentDemo) {
      window.location.assign(basePath || "/");
      return;
    }
    void signOut({ redirectUrl: basePath || "/" });
  };
  const name =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Care team member";
  return (
    <div className="mt-5 flex items-center gap-3 border-t border-sidebar-border px-3 pt-5">
      <Avatar
        name={name}
        className="gold-action text-accent-foreground ring-sidebar"
      />
      <div className="min-w-0">
        <p
          data-testid="user-name-display"
          className="truncate text-sm font-semibold"
        >
          {name}
        </p>
        <p className="text-xs text-sidebar-foreground/55">
          Verified care-team account
        </p>
      </div>
      <button
        onClick={clearAndSignOut}
        data-testid="button-sign-out"
        className="ml-auto rounded-lg p-2 text-xs font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
function ChildSwitcher({
  children,
  selectedId,
  onChange,
  onAdd,
}: {
  children: Child[];
  selectedId?: number;
  onChange: (id: number) => void;
  onAdd: () => void;
}) {
  const selected = children.find((child) => child.id === selectedId);
  return (
    <div className="brand-card relative flex items-center gap-3 rounded-2xl border border-primary/15 bg-card px-3 py-2 soft-shadow">
      <Avatar name={selected?.name} className="size-8 bg-secondary ring-card" />
      <select
        data-testid="select-child"
        value={selectedId ?? ""}
        onChange={(event) => onChange(Number(event.target.value))}
        className="max-w-[150px] appearance-none bg-transparent pr-5 text-sm font-semibold outline-none transition-shadow focus-ring"
      >
        {children.map((child) => (
          <option key={child.id} value={child.id}>
            {child.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 text-muted-foreground"
      />
      <button
        data-testid="button-add-child"
        onClick={onAdd}
        className="ml-1 grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-ring"
        aria-label="Add child"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

function TrendIndicator({
  trend,
  label,
}: {
  trend: "up" | "down" | "stable";
  label: string;
}) {
  const Icon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const tone =
    trend === "up"
      ? "text-accent"
      : trend === "down"
        ? "text-muted-foreground"
        : "text-primary";
  return (
    <span
      className={`inline-flex items-center gap-1 ${tone}`}
      aria-label={`${label}: ${trend}`}
    >
      <Icon aria-hidden size={15} />
      <span className="sr-only">{trend}</span>
    </span>
  );
}

function ClinicalChangeSection({ snapshot }: { snapshot?: ChildSnapshot }) {
  if (!snapshot?.hasEnoughData) return null;
  const change = snapshot.sessionChange;
  const latestDate = change.latestSessionDate
    ? formatDate(change.latestSessionDate)
    : "Latest reviewed session";
  const comparisonLabel = change.previousSessionDate
    ? `Compared with ${formatDate(change.previousSessionDate)}`
    : "First reviewed session";

  return (
    <section
      data-testid="clinical-change-section"
      className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground soft-shadow animate-rise delay-1 md:p-8"
    >
      <div className="absolute -right-10 -top-20 size-64 rounded-full border-[28px] border-accent/15" />
      <div className="absolute -bottom-28 right-32 size-64 rounded-full border-[20px] border-secondary/10" />
      <div className="relative">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-5 border-b border-primary-foreground/15 pb-6">
          <div>
            <div className="mb-3 flex items-center gap-2 text-accent">
              <span className="grid size-7 place-items-center rounded-full bg-accent/15">
                <Sparkles size={14} />
              </span>
              <span className="mono text-[10px] font-bold uppercase tracking-[0.2em]">
                Clinical change detection
              </span>
            </div>
            <h2 className="serif text-3xl leading-tight md:text-4xl">
              What’s new since the last session?
            </h2>
            <p className="mt-2 text-sm text-primary-foreground/65">
              {comparisonLabel} · Latest session {latestDate}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/session"
              data-testid="button-review-session"
              className="gold-action inline-flex focus-ring items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary"
            >
              <Mic size={16} /> Review a session
            </Link>
            <Link
              href="/dictionary"
              data-testid="link-change-dictionary"
              className="inline-flex focus-ring items-center gap-2 rounded-xl border border-primary-foreground/20 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-foreground/10"
            >
              Dictionary <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-5">
            <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              New gestalts
            </p>
            {change.newGestalts.length ? (
              <div className="mt-4 space-y-4">
                {change.newGestalts.map((gestalt) => (
                  <div
                    key={`${gestalt.phrase}-${gestalt.firstObservedDate}`}
                    className="border-b border-primary-foreground/10 pb-4 last:border-0 last:pb-0"
                  >
                    <p className="serif text-lg font-semibold">
                      “{gestalt.phrase}”
                    </p>
                    <p className="mt-1 text-xs leading-5 text-primary-foreground/60">
                      First observed {formatDate(gestalt.firstObservedDate)} ·
                      Session {formatDate(gestalt.sessionDate)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-primary-foreground/65">
                No newly confirmed gestalts were added in the latest reviewed
                session.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-5">
            <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              New functions
            </p>
            {change.newFunctions.length ? (
              <div className="mt-4 space-y-4">
                {change.newFunctions.map((entry) => (
                  <div
                    key={entry.label}
                    className="border-b border-primary-foreground/10 pb-4 last:border-0 last:pb-0"
                  >
                    <p className="text-sm font-bold">{entry.label}</p>
                    {entry.examples.map((example) => (
                      <div
                        key={`${example.phrase}-${example.context}`}
                        className="mt-2 rounded-lg bg-primary-foreground/8 p-3"
                      >
                        <p className="serif text-base">“{example.phrase}”</p>
                        <p className="mt-1 text-xs leading-5 text-primary-foreground/60">
                          {example.meaning} · {example.context}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-primary-foreground/65">
                No newly observed communication functions were documented in
                this session.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-accent/35 bg-accent/10 p-5">
            <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              Possible mitigations
            </p>
            <p className="mt-3 text-xs leading-5 text-primary-foreground/65">
              Review prompts from confirmed Child phrases—not conclusions about
              stage or treatment.
            </p>
            {change.possibleMitigations.length ? (
              <div className="mt-4 space-y-4">
                {change.possibleMitigations.map((mitigation) => (
                  <div
                    key={`${mitigation.originalPhrase}-${mitigation.observedVariation}`}
                    className="border-b border-primary-foreground/10 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/55">
                        Original
                      </p>
                      <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">
                        {mitigation.confidence} confidence
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">
                      “{mitigation.originalPhrase}”
                    </p>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-primary-foreground/55">
                      Observed variation
                    </p>
                    <p className="mt-1 serif text-base">
                      “{mitigation.observedVariation}”
                    </p>
                    <p className="mt-2 text-xs text-primary-foreground/60">
                      {mitigation.context}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-primary-foreground/65">
                No variation patterns are ready for clinician review from this
                session.
              </p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

function FrequentScriptsPanel({ childId }: { childId?: number }) {
  const [window, setWindow] = useState<"all" | "30d" | "7d">("all");
  const [search, setSearch] = useState("");
  const [selectedPhrase, setSelectedPhrase] = useState<FrequentScript | null>(
    null,
  );
  const query = useGetFrequentScripts(
    { childId: childId ?? 0, window },
    {
      query: {
        enabled: Boolean(childId),
        queryKey: getGetFrequentScriptsQueryKey({
          childId: childId ?? 0,
          window,
        }),
      },
    },
  );
  const periods: Array<{ value: typeof window; label: string }> = [
    { value: "all", label: "All time" },
    { value: "30d", label: "Last 30 days" },
    { value: "7d", label: "Last 7 days" },
  ];
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visiblePhrases = (query.data?.phrases ?? [])
    .slice(0, 5)
    .filter(
      (phrase) =>
        !normalizedSearch ||
        [phrase.phrase, phrase.meaning, ...phrase.communicationFunctions]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedSearch),
    );
  return (
    <div>
      <div data-testid="section-frequent-scripts">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Frequent Scripts
          </p>
          <div
            className="flex rounded-lg bg-muted p-1"
            role="group"
            aria-label="Frequent Scripts time window"
          >
            {periods.map((period) => (
              <button
                key={period.value}
                type="button"
                aria-pressed={window === period.value}
                onClick={() => setWindow(period.value)}
                className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition focus-ring ${window === period.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`button-frequent-scripts-${period.value}`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        <label className="relative mb-4 block">
          <span className="sr-only">Search frequent scripts</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid="input-search-frequent-scripts"
            className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-ring"
            placeholder="Search phrases, meanings, or communication functions"
          />
        </label>
        {query.isLoading ? (
          <div
            className="grid gap-3 sm:grid-cols-2"
            aria-label="Loading frequent scripts"
          >
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-xl border border-border bg-muted/45"
              />
            ))}
          </div>
        ) : query.isError ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-destructive">
              Frequent Scripts could not be loaded.
            </p>
            <Button
              variant="quiet"
              className="mt-3 px-3 py-2 text-xs"
              onClick={() => void query.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : !query.data?.phrases.length ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            {query.data?.reviewedDictionaryPhraseCount
              ? `${query.data.reviewedDictionaryPhraseCount} reviewed dictionary phrase${query.data.reviewedDictionaryPhraseCount === 1 ? " exists" : "s exist"}, but no session or verified observation history was recorded in this time window.`
              : "No reviewed Child language evidence was recorded in this time window."}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {query.data.totalObservations}
                </span>{" "}
                documented observation
                {query.data.totalObservations === 1 ? "" : "s"} in this window
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ranked by frequency
              </p>
            </div>
            {visiblePhrases.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {visiblePhrases.map((phrase) => (
                  <button
                    key={phrase.id}
                    type="button"
                    onClick={() => setSelectedPhrase(phrase)}
                    aria-label={`Rank ${phrase.frequencyRank}: ${phrase.phrase}, ${phrase.observations} observations`}
                    className="group flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-accent/40 hover:bg-accent/5 focus-ring"
                    data-testid={`card-frequent-script-${phrase.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                        Frequency #{phrase.frequencyRank}
                      </span>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground">
                        {phrase.observations} observation
                        {phrase.observations === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="serif mt-4 text-xl font-semibold text-foreground transition-colors group-hover:text-primary">
                      “{phrase.phrase}”
                    </p>
                    <p className="mt-1 line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground">
                      {phrase.meaning}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border/60 py-3">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          First observed
                        </p>
                        <p className="mt-1 text-xs font-semibold text-foreground">
                          {formatDate(phrase.firstObservedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          Most recent
                        </p>
                        <p className="mt-1 text-xs font-semibold text-foreground">
                          {formatDate(phrase.lastObservedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Communication functions
                      </p>
                      <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">
                        {phrase.communicationFunctions.length ? (
                          phrase.communicationFunctions.map((item) => (
                            <span
                              key={item}
                              className="rounded-full bg-accent/15 px-2 py-1 text-[10px] font-semibold text-primary"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not yet reviewed
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                No confirmed scripts match “{search.trim()}”. Try a phrase,
                meaning, or communication function.
              </div>
            )}
          </>
        )}
        {selectedPhrase && (
          <Modal
            title="Frequent Script details"
            onClose={() => setSelectedPhrase(null)}
          >
            <div className="space-y-5">
              <div className="border-b border-border/50 pb-4 text-center">
                <span className="inline-flex rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  Frequency #{selectedPhrase.frequencyRank}
                </span>
                <h3 className="serif mb-2 mt-3 text-2xl font-semibold text-primary">
                  “{selectedPhrase.phrase}”
                </h3>
                <p className="text-base font-medium text-foreground">
                  {selectedPhrase.meaning}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary/50 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {selectedPhrase.observations}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Observations
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {formatDate(selectedPhrase.firstObservedAt)} –{" "}
                    {formatDate(selectedPhrase.lastObservedAt)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Observed range
                  </p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Contexts
                  </p>
                  <p className="mt-1 leading-6">
                    {selectedPhrase.contexts.join(" · ") ||
                      "No context documented"}
                  </p>
                </div>
                <div>
                  <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Communication functions
                  </p>
                  <p className="mt-1 leading-6">
                    {selectedPhrase.communicationFunctions.join(" · ") ||
                      "Not yet reviewed"}
                  </p>
                </div>
                <div>
                  <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Contributors
                  </p>
                  <p className="mt-1 leading-6">
                    {selectedPhrase.contributors.join(" · ") ||
                      "No contributor recorded"}
                  </p>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
      <RecurringLanguagePatternsPanel childId={childId} />
    </div>
  );
}

function RecurringLanguagePatternsPanel({ childId }: { childId?: number }) {
  const [window, setWindow] = useState<"all" | "30d" | "7d">("all");
  const [selectedPattern, setSelectedPattern] =
    useState<RecurringLanguagePattern | null>(null);
  const query = useGetRecurringLanguagePatterns(
    { childId: childId ?? 0, window },
    {
      query: {
        enabled: Boolean(childId),
        queryKey: getGetRecurringLanguagePatternsQueryKey({
          childId: childId ?? 0,
          window,
        }),
      },
    },
  );
  const detailQuery = useGetRecurringLanguagePatternDetail(
    {
      childId: childId ?? 0,
      patternId: selectedPattern?.id ?? "",
      window,
    },
    {
      query: {
        enabled: Boolean(childId && selectedPattern),
        queryKey: getGetRecurringLanguagePatternDetailQueryKey({
          childId: childId ?? 0,
          patternId: selectedPattern?.id ?? "",
          window,
        }),
      },
    },
  );
  const periods: Array<{ value: typeof window; label: string }> = [
    { value: "all", label: "All time" },
    { value: "30d", label: "Last 30 days" },
    { value: "7d", label: "Last 7 days" },
  ];

  useEffect(() => {
    setSelectedPattern(null);
  }, [childId, window]);

  return (
    <div
      className="mt-7 border-t border-border/60 pt-6"
      data-testid="section-recurring-language-patterns"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Repeated Words &amp; Language Patterns
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Words or phrase fragments observed across multiple reviewed Child
            phrases. These are descriptive observations, not conclusions about
            stage, diagnosis, treatment, or AAC.
          </p>
        </div>
        <div
          className="flex rounded-lg bg-muted p-1"
          role="group"
          aria-label="Recurring Language Patterns time window"
        >
          {periods.map((period) => (
            <button
              key={period.value}
              type="button"
              aria-pressed={window === period.value}
              onClick={() => setWindow(period.value)}
              className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition focus-ring ${window === period.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`button-recurring-patterns-${period.value}`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div
          className="mt-4 grid gap-3 sm:grid-cols-2"
          aria-label="Loading recurring language patterns"
        >
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-xl border border-border bg-muted/45"
            />
          ))}
        </div>
      ) : query.isError ? (
        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-destructive">
            Repeated Words &amp; Language Patterns could not be loaded.
          </p>
          <Button
            variant="quiet"
            className="mt-3 px-3 py-2 text-xs"
            onClick={() => void query.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : !query.data?.patterns.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
          No word or phrase fragment appears across multiple reviewed Child
          phrases in this time window.
        </div>
      ) : (
        <>
          <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {query.data.totalPatterns}
              </span>{" "}
              observational pattern{query.data.totalPatterns === 1 ? "" : "s"}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ranked by reviewed evidence
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {query.data.patterns.slice(0, 6).map((pattern) => (
              <button
                key={pattern.id}
                type="button"
                onClick={() => setSelectedPattern(pattern)}
                className="rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-accent/40 hover:bg-accent/5 focus-ring"
                data-testid={`card-recurring-pattern-${pattern.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                    Observed fragment
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {pattern.totalOccurrences} evidence occurrence
                    {pattern.totalOccurrences === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="serif mt-3 text-xl font-semibold text-primary">
                  “{pattern.fragment}”
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Appears across {pattern.phraseCount} confirmed phrases
                </p>
                <div className="mt-3 space-y-1.5">
                  {pattern.examplePhrases.map((phrase) => (
                    <p key={phrase} className="text-xs text-foreground">
                      “{phrase}”
                    </p>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pattern.indicators.map((indicator) => (
                    <span
                      key={indicator}
                      className="rounded-full bg-secondary px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-primary"
                    >
                      {indicator}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Observed range
                    </p>
                    <p className="mt-1 font-semibold">
                      {formatDate(pattern.firstObservedAt)} –{" "}
                      {formatDate(pattern.lastObservedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Variability
                    </p>
                    <p className="mt-1 font-semibold">
                      {pattern.reviewedSessionCount} session
                      {pattern.reviewedSessionCount === 1 ? "" : "s"} ·{" "}
                      {pattern.environmentCount} setting
                      {pattern.environmentCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedPattern && (
        <Modal
          title="Repeated Word & Language Pattern evidence"
          onClose={() => setSelectedPattern(null)}
        >
          <div className="space-y-5">
            <div className="border-b border-border/50 pb-4 text-center">
              <span className="inline-flex rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                Observed across confirmed phrases
              </span>
              <h3 className="serif mt-3 text-2xl font-semibold text-primary">
                “{selectedPattern.fragment}”
              </h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Evidence detail only; no automatic clinical interpretation is
                applied.
              </p>
            </div>
            {detailQuery.isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted/45" />
            ) : detailQuery.isError || !detailQuery.data ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-destructive">
                  Pattern evidence could not be loaded.
                </p>
                <Button
                  variant="quiet"
                  className="mt-3 px-3 py-2 text-xs"
                  onClick={() => void detailQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-secondary/50 p-3 text-center">
                    <p className="text-xl font-bold text-primary">
                      {detailQuery.data.phraseCount}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Phrases
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-3 text-center">
                    <p className="text-xl font-bold text-primary">
                      {detailQuery.data.reviewedSessionCount}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Sessions
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-3 text-center">
                    <p className="text-xl font-bold text-primary">
                      {detailQuery.data.environmentCount}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Settings
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-3 text-center">
                    <p className="text-xl font-bold text-primary">
                      {detailQuery.data.communicationFunctionCount}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Functions
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detailQuery.data.indicators.map((indicator) => (
                    <span
                      key={indicator}
                      className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold text-primary"
                    >
                      {indicator}
                    </span>
                  ))}
                </div>
                {detailQuery.data.communicationFunctions.length > 0 && (
                  <div>
                    <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Communication functions
                    </p>
                    <p className="mt-1 text-sm leading-6">
                      {detailQuery.data.communicationFunctions.join(" · ")}
                    </p>
                  </div>
                )}
                <div>
                  <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Associated confirmed phrases
                  </p>
                  <div className="mt-2 space-y-2">
                    {detailQuery.data.phrases.map((phrase) => (
                      <div
                        key={phrase.id}
                        className="rounded-xl border border-border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">“{phrase.phrase}”</p>
                          <span className="text-xs text-muted-foreground">
                            {phrase.observations} occurrence
                            {phrase.observations === 1 ? "" : "s"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(phrase.firstObservedAt)} –{" "}
                          {formatDate(phrase.lastObservedAt)} ·{" "}
                          {phrase.settings.join(" · ") ||
                            "No setting documented"}
                        </p>
                        {phrase.communicationFunctions.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Functions:{" "}
                            {phrase.communicationFunctions.join(" · ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Reviewed evidence references
                  </p>
                  <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {detailQuery.data.observations.map((observation, index) => (
                      <div
                        key={`${observation.phraseId}-${observation.observedAt}-${index}`}
                        className="rounded-lg bg-muted/45 p-3 text-xs"
                      >
                        <p className="font-semibold text-foreground">
                          “{observation.phrase}”
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {formatDate(observation.observedAt)} ·{" "}
                          {observation.settings.join(" · ") ||
                            "No setting documented"}
                          {observation.sessionId
                            ? ` · Reviewed session ${observation.sessionId}`
                            : observation.evidenceType === "dictionary"
                              ? " · Reviewed dictionary phrase"
                              : " · Verified observation"}
                          {observation.communicationFunction
                            ? ` · ${observation.communicationFunction}`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function ChildSnapshotSection({
  snapshot,
  childId,
}: {
  snapshot?: ChildSnapshot;
  childId?: number;
}) {
  if (!snapshot) return null;

  if (!snapshot.hasEnoughData) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 soft-shadow animate-rise delay-2 mb-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Clinical workspace
            </p>
            <h2 className="serif mt-1 text-2xl font-semibold">
              Build the language map
            </h2>
          </div>
        </div>
        <EmptyState
          icon={ActivityIcon}
          title="Getting started"
          body="Record sessions to begin building this child’s language profile."
        />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 soft-shadow animate-rise delay-2 mb-5">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Longer-term view
          </p>
          <h2 className="serif mt-1 text-2xl font-semibold">
            Current language map
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            A supporting view of collected patterns and emerging communication.
          </p>
        </div>
        <Link
          href="/language-journey"
          data-testid="link-language-journey"
          className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80 focus-ring"
        >
          View Language Journey <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Left column: Stats & Functions */}
        <div className="space-y-6 md:col-span-4 md:border-r md:border-border/50 md:pr-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-4xl font-bold text-primary">
                {snapshot.totalGestaltsCollected}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                Total gestalts collected
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-2xl font-bold text-foreground">
                {snapshot.newGestaltsThisWeek}
                <TrendIndicator
                  trend={snapshot.newGestaltsTrend}
                  label="New gestalts this week"
                />
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                New this week
              </p>
            </div>
          </div>

          {snapshot.functionDistribution &&
            snapshot.functionDistribution.length > 0 && (
              <div>
                <p className="mono mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Primary Functions
                </p>
                <div className="space-y-3">
                  {snapshot.functionDistribution.map((f, i) => (
                    <div key={`${f.label}-${i}`}>
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="font-medium text-foreground">
                          {f.label}
                        </span>
                        <span className="text-muted-foreground">
                          {f.percentage}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-1000"
                          style={{ width: `${f.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Right column: Phrases & Mitigations */}
        <div className="md:col-span-8 space-y-6">
          <FrequentScriptsPanel childId={childId} />

          {snapshot.emergingMitigations &&
            snapshot.emergingMitigations.length > 0 && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                <div className="flex gap-2.5">
                  <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      Possible emerging mitigations
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                      These are clinician review prompts based on documented
                      patterns, not a conclusion about language stage or a
                      treatment recommendation.
                    </p>
                    <div className="space-y-3">
                      {snapshot.emergingMitigations.map((mitigation, i) => (
                        <div
                          key={`${mitigation.phrase}-${i}`}
                          className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between border-b border-accent/10 pb-2 last:border-0 last:pb-0"
                        >
                          <p className="font-medium text-sm text-foreground">
                            “{mitigation.phrase}”
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Derived from:{" "}
                            <span className="italic text-foreground/80">
                              “{mitigation.label}”
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </section>
  );
}

function ParentLanguageJourneyPage({
  child,
  gestalts,
}: {
  child?: Child;
  gestalts: Gestalt[];
}) {
  const journeyPhrases = [...gestalts]
    .sort(
      (left, right) =>
        new Date(right.dateAdded).getTime() -
        new Date(left.dateAdded).getTime(),
    )
    .slice(0, 8);
  return (
    <div className="space-y-8 animate-rise">
      <SectionHeading
        eyebrow="Communication Growth"
        title={`${child?.name ?? "Your child"}’s language journey`}
        description="A parent-friendly view of favorite phrases and the new situations where they are being shared."
        action={
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-card px-4 py-2.5 text-sm font-semibold text-primary"
          >
            <Home size={16} /> Home
          </Link>
        }
      />
      <section
        className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground soft-shadow md:p-8"
        data-testid="parent-language-journey"
      >
        <div className="absolute -right-12 -top-20 size-64 rounded-full border-[28px] border-accent/15" />
        <div className="relative max-w-2xl">
          <p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-accent">
            Growing together
          </p>
          <h2 className="serif mt-3 text-3xl font-semibold">
            Communication grows one shared moment at a time.
          </h2>
          <p className="mt-3 text-sm leading-6 text-primary-foreground/80">
            {journeyPhrases.length
              ? `${child?.name ?? "Your child"} is beginning to use favorite phrases in new situations. The map below simply remembers what the family and care team have noticed.`
              : "As phrases and everyday moments are shared, this gentle timeline will help your family celebrate the journey."}
          </p>
        </div>
      </section>
      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8">
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
            Simple timeline
          </p>
          <h2 className="serif mt-2 text-2xl font-semibold">
            The journey so far
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            These are shared phrases and contexts—not clinical stages or scores.
          </p>
        </div>
        {journeyPhrases.length ? (
          <div className="relative mt-7 space-y-5 before:absolute before:inset-y-2 before:left-3 before:w-px before:bg-border">
            {journeyPhrases.map((gestalt) => (
              <article key={gestalt.id} className="relative pl-10">
                <span className="absolute left-0 top-1.5 grid size-7 place-items-center rounded-full bg-secondary text-primary ring-4 ring-card">
                  <Leaf size={13} />
                </span>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
                    {new Date(gestalt.dateAdded).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <h3 className="serif mt-1 text-xl font-semibold">
                    “{gestalt.phrase}”
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {gestalt.contexts?.length
                      ? `Shared in: ${gestalt.contexts.join(", ")}`
                      : "A shared moment added to the communication map."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            Start with a small observation from home whenever you notice a
            phrase or moment worth sharing.
          </p>
        )}
      </section>
    </div>
  );
}

function LanguageJourneyPage({
  child,
  childrenList,
  selectedId,
  onChangeChild,
  onAddChild,
  dashboard,
  dashboardLoading,
}: {
  child?: Child;
  childrenList: Child[];
  selectedId?: number;
  onChangeChild: (id: number) => void;
  onAddChild: () => void;
  dashboard?: Dashboard;
  dashboardLoading: boolean;
}) {
  const journeyTrendParams = { childId: selectedId ?? 0, from: "2000-01-01" };
  const trendsQuery = useGetPhraseTrends(journeyTrendParams, {
    query: {
      enabled: !!selectedId,
      queryKey: getGetPhraseTrendsQueryKey(journeyTrendParams),
    },
  });
  const knowledgeQuery = useListClinicalKnowledgeInsights(
    { childId: selectedId ?? 0 },
    {
      query: {
        enabled: Boolean(selectedId),
        queryKey: getListClinicalKnowledgeInsightsQueryKey({
          childId: selectedId ?? 0,
        }),
      },
    },
  );
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const trends = trendsQuery.data?.trends ?? [];
  const snapshot = dashboard?.snapshot;
  const insights = knowledgeQuery.data?.insights ?? [];
  const firstObservedDate = useMemo(
    () =>
      trends
        .flatMap((trend) => trend.points.map((point) => point.date))
        .sort()[0],
    [trends],
  );
  const mostFrequentTrend = trends[0];
  const flexibilityTrends = useMemo(
    () =>
      trends
        .filter((trend) => trend.contexts.length > 1 || trend.points.length > 1)
        .slice(0, 4),
    [trends],
  );
  const functionMonthlySeries = useMemo(() => {
    const byFunction = new Map<string, Map<string, number>>();
    (trendsQuery.data?.functionTimeline ?? []).forEach((point) => {
      const month = point.date.slice(0, 7);
      const current =
        byFunction.get(point.function) ?? new Map<string, number>();
      current.set(month, (current.get(month) ?? 0) + point.occurrences);
      byFunction.set(point.function, current);
    });
    return [...byFunction.entries()]
      .map(([label, points]) => ({
        label,
        points: [...points.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([date, occurrences]) => ({ date, occurrences })),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [trendsQuery.data?.functionTimeline]);
  type JourneyEvent = {
    id: string;
    date: string;
    tone: "growth" | "milestone" | "observation";
    eyebrow: string;
    title: string;
    phrase?: string;
    summary: string;
    examples: string[];
    contexts: string[];
    confidence: string;
  };
  const journeyEvents = useMemo(() => {
    const events: JourneyEvent[] = trends.flatMap((trend) => {
      const firstPoint = [...trend.points].sort((left, right) =>
        left.date.localeCompare(right.date),
      )[0];
      if (!firstPoint) return [];
      const firstMeaning = trend.meanings[0];
      return [
        {
          id: `first-${normalizeJourneyPhrase(trend.phrase)}-${firstPoint.date}`,
          date: firstPoint.date,
          tone: "observation" as const,
          eyebrow: "First observed gestalt",
          title: `“${trend.phrase}”`,
          phrase: trend.phrase,
          summary: `First documented in reviewed Child evidence${firstMeaning?.meaning && firstMeaning.meaning !== "Meaning not documented" ? ` with the working meaning “${firstMeaning.meaning}.”` : "."}`,
          examples: [
            `${firstPoint.occurrences} documented occurrence${firstPoint.occurrences === 1 ? "" : "s"} on this date`,
            ...trend.points
              .slice(1, 3)
              .map(
                (point) =>
                  `${point.occurrences} occurrence${point.occurrences === 1 ? "" : "s"} on ${formatDate(point.date)}`,
              ),
          ],
          contexts: trend.contexts,
          confidence: "Reviewed Child evidence",
        },
      ];
    });
    const firstPhraseDates = events
      .filter((event) => event.eyebrow === "First observed gestalt")
      .sort((left, right) => left.date.localeCompare(right.date));
    if (firstPhraseDates.length >= 50) {
      const milestone = firstPhraseDates[49];
      events.push({
        id: `milestone-50-${milestone.date}`,
        date: milestone.date,
        tone: "milestone",
        eyebrow: "Session milestone",
        title: "50 gestalts collected",
        summary:
          "At least 50 unique gestalts had been documented in reviewed Child evidence by this point in the journey.",
        examples: [`The 50th unique observed phrase was ${milestone.title}.`],
        contexts: [],
        confidence: "Reviewed Child evidence",
      });
    }
    const latestDate = snapshot?.sessionChange.latestSessionDate;
    if (latestDate) {
      snapshot.sessionChange.newFunctions.forEach((item) =>
        events.push({
          id: `function-${item.label}-${latestDate}`,
          date: latestDate,
          tone: "growth",
          eyebrow: "Communication milestone",
          title: `${item.label} newly observed`,
          summary:
            "This communication function was not documented in the immediately preceding reviewed Child session.",
          examples: item.examples.map(
            (example) =>
              `“${example.phrase}” · ${example.context} · ${example.meaning}`,
          ),
          contexts: item.examples.map((example) => example.context),
          confidence: "Reviewed Child evidence",
        }),
      );
      snapshot.sessionChange.possibleMitigations.forEach((item) =>
        events.push({
          id: `mitigation-${normalizeJourneyPhrase(item.originalPhrase)}-${normalizeJourneyPhrase(item.observedVariation)}-${latestDate}`,
          date: item.sessionDate,
          tone: "growth",
          eyebrow: "Possible mitigation pathway",
          title: `“${item.originalPhrase}” → “${item.observedVariation}”`,
          phrase: item.observedVariation,
          summary:
            "A phrase variation with strong multiword overlap was observed across consecutive reviewed sessions. This is a review prompt, not a stage conclusion.",
          examples: [
            `Earlier phrase: “${item.originalPhrase}”`,
            `Observed variation: “${item.observedVariation}”`,
            `Context: ${item.context}`,
          ],
          contexts: [item.context],
          confidence: `${item.confidence} confidence · Clinician review recommended`,
        }),
      );
    }
    flexibilityTrends.forEach((trend) => {
      const latestPoint = [...trend.points].sort((left, right) =>
        right.date.localeCompare(left.date),
      )[0];
      if (!latestPoint) return;
      events.push({
        id: `flexibility-${normalizeJourneyPhrase(trend.phrase)}-${latestPoint.date}`,
        date: latestPoint.date,
        tone: "growth",
        eyebrow: "Possible language flexibility indicator",
        title: `“${trend.phrase}” across ${trend.contexts.length} context${trend.contexts.length === 1 ? "" : "s"}`,
        phrase: trend.phrase,
        summary:
          trend.contexts.length > 1
            ? "This reviewed phrase appears in more than one documented context. Consider its flexibility alongside the individual evidence."
            : "This reviewed phrase was documented across more than one reviewed date. Consider the pattern alongside the individual evidence.",
        examples: trend.points
          .slice(-3)
          .map(
            (point) =>
              `${point.occurrences} occurrence${point.occurrences === 1 ? "" : "s"} on ${formatDate(point.date)}`,
          ),
        contexts: trend.contexts,
        confidence: "Low confidence · Clinician review recommended",
      });
    });
    return events
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 16);
  }, [trends, snapshot, flexibilityTrends]);

  return (
    <div className="space-y-8 animate-rise">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <SectionHeading
          eyebrow="Longitudinal View"
          title="Language Journey"
          description={`Observe how ${child?.name ?? "this child"}’s communication patterns unfold over time.`}
          action={
            <Link
              href="/dictionary"
              data-testid="link-back-dictionary"
              className="inline-flex focus-ring items-center gap-2 rounded-xl border border-primary/20 bg-card px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary/70"
            >
              <BookOpen size={16} /> Dictionary
            </Link>
          }
        />
      </div>

      {trendsQuery.isLoading || dashboardLoading ? (
        <LoadingBlocks />
      ) : trendsQuery.isError ? (
        <EmptyState
          icon={ActivityIcon}
          title="Unable to load trends"
          body="There was a problem loading the language journey data. Please try again."
        />
      ) : !trends.length || !snapshot?.hasEnoughData ? (
        <EmptyState
          icon={ActivityIcon}
          title="Not enough data yet"
          body="Record sessions to begin building this child’s language profile."
          action={
            <Link
              href="/session"
              className="inline-flex focus-ring items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Mic size={16} /> Record a session
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          <section
            data-testid="language-journey-snapshot"
            className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground soft-shadow md:p-8"
          >
            <div className="absolute -right-16 -top-14 size-64 rounded-full border-[28px] border-accent/15" />
            <div className="relative">
              <p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-accent">
                Language Journey Snapshot
              </p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="serif text-3xl md:text-4xl">
                    {child?.name ?? "This child"}’s evolving story
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/70">
                    A longitudinal view of reviewed Child evidence. It surfaces
                    patterns to explore, not stages to assign.
                  </p>
                </div>
                <span className="rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1.5 text-xs font-semibold">
                  Clinician review recommended
                </span>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  [
                    "First gestalt recorded",
                    firstObservedDate
                      ? formatDate(firstObservedDate)
                      : "Not yet",
                  ],
                  ["Total gestalts collected", trends.length],
                  [
                    "Most frequent gestalt",
                    mostFrequentTrend
                      ? `“${mostFrequentTrend.phrase}”`
                      : "Not yet",
                  ],
                  [
                    "Possible mitigation observations",
                    snapshot.sessionChange.possibleMitigations.length,
                  ],
                  [
                    "Sessions analyzed",
                    trendsQuery.data?.reviewedSessionCount ?? 0,
                  ],
                  [
                    "Communication functions observed",
                    snapshot.functionDistribution.length,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4"
                  >
                    <p className="mono text-[9px] font-bold uppercase tracking-[.15em] text-primary-foreground/55">
                      {label}
                    </p>
                    <p className="serif mt-2 text-xl font-semibold text-primary-foreground">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section
            data-testid="language-journey-timeline"
            className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                  Chronological evidence
                </p>
                <h2 className="serif mt-2 text-3xl font-semibold">
                  The journey so far
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Select a milestone to see the reviewed Child evidence,
                  documented contexts, and any relevant private-source
                  citations.
                </p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary">
                Newest first
              </span>
            </div>
            <div className="mt-7 space-y-3">
              {journeyEvents.map((event) => {
                const expanded = expandedEventId === event.id;
                const citations = citationsForTimelineEvidence(
                  event.phrase,
                  insights,
                );
                const color =
                  event.tone === "growth"
                    ? "bg-secondary text-primary ring-primary/15"
                    : event.tone === "milestone"
                      ? "bg-accent text-primary ring-accent/30"
                      : "bg-muted text-muted-foreground ring-border";
                return (
                  <article key={event.id} className="relative pl-9 sm:pl-12">
                    <span className="absolute left-3 top-0 h-full w-px bg-border sm:left-5" />
                    <span
                      className={`absolute left-0 top-5 grid size-7 place-items-center rounded-full ring-4 sm:left-2 ${color}`}
                    >
                      <ActivityIcon size={14} />
                    </span>
                    <button
                      type="button"
                      data-testid={`button-journey-event-${event.id}`}
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedEventId(expanded ? null : event.id)
                      }
                      className="w-full rounded-2xl border border-border bg-background p-4 text-left transition hover:border-primary/35 focus-ring sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
                            {event.eyebrow} · {formatDate(event.date)}
                          </p>
                          <h3 className="serif mt-1 text-xl font-semibold text-primary">
                            {event.title}
                          </h3>
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                            {event.summary}
                          </p>
                        </div>
                        <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary">
                          {expanded ? "Hide evidence" : "Why this appears"}
                        </span>
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-2 rounded-2xl border border-primary/15 bg-secondary/30 p-4 text-sm sm:p-5">
                        <div className="grid gap-5 lg:grid-cols-2">
                          <div>
                            <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                              Why this appears here
                            </p>
                            <p className="mt-2 leading-6">
                              <strong>Triggering evidence:</strong>{" "}
                              {event.phrase
                                ? `“${event.phrase}”`
                                : "Reviewed Child evidence across the journey"}
                            </p>
                            <p className="mt-2 leading-6">
                              <strong>Confidence:</strong> {event.confidence}
                            </p>
                            {event.contexts.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {event.contexts.map((context) => (
                                  <span
                                    key={context}
                                    className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary"
                                  >
                                    {context}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                              Supporting examples
                            </p>
                            <ul className="mt-2 space-y-2 text-sm leading-5 text-muted-foreground">
                              {event.examples.map((example) => (
                                <li
                                  key={example}
                                  className="border-l-2 border-accent pl-3"
                                >
                                  {example}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="mt-5 border-t border-primary/10 pt-4">
                          <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                            Relevant knowledge-base evidence
                          </p>
                          {citations.length ? (
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              {citations
                                .map(
                                  (citation) =>
                                    `${citation.sourceTitle}${citation.page ? ` p. ${citation.page}` : ""}${citation.section ? ` · ${citation.section}` : ""}`,
                                )
                                .join(" · ")}
                            </p>
                          ) : (
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              No relevant private knowledge citation is
                              currently attached to this observation. The
                              reviewed language evidence remains visible for
                              clinician interpretation.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-3xl border border-border bg-card p-6 soft-shadow">
              <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                Most frequent gestalts
              </p>
              <h2 className="serif mt-2 text-2xl font-semibold">
                Phrase evolution
              </h2>
              <div className="mt-5 space-y-4">
                {trends.slice(0, 4).map((trend) => {
                  const first = trend.points[0]?.occurrences ?? 0;
                  const latest =
                    trend.points[trend.points.length - 1]?.occurrences ?? 0;
                  const trendLabel =
                    latest > first
                      ? "Trending up"
                      : latest < first
                        ? "Trending down"
                        : "Steady evidence";
                  return (
                    <div
                      key={trend.phrase}
                      className="rounded-2xl border border-border/70 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="serif text-lg font-semibold">
                            “{trend.phrase}”
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {trend.totalOccurrences} reviewed occurrence
                            {trend.totalOccurrences === 1 ? "" : "s"} ·{" "}
                            {trendLabel}
                          </p>
                        </div>
                        <PhraseTrendChart points={trend.points} />
                      </div>
                      {trend.contexts.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {trend.contexts.map((context) => (
                            <span
                              key={context}
                              className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-primary"
                            >
                              {context}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="rounded-3xl border border-accent/35 bg-secondary/35 p-6">
              <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                Possible mitigation pathways
              </p>
              <h2 className="serif mt-2 text-2xl font-semibold">
                Patterns to review, not conclusions
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Phrase variations are only surfaced when there is strong
                multiword overlap across consecutive reviewed sessions.
              </p>
              <div className="mt-5 space-y-3">
                {snapshot.sessionChange.possibleMitigations.length ? (
                  snapshot.sessionChange.possibleMitigations.map((item) => (
                    <div
                      key={`${item.originalPhrase}-${item.observedVariation}`}
                      className="rounded-2xl border border-accent/35 bg-card p-4"
                    >
                      <p className="text-sm font-semibold">
                        “{item.originalPhrase}”{" "}
                        <span className="mx-1 text-accent">→</span> “
                        {item.observedVariation}”
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {formatDate(item.sessionDate)} · {item.context}
                      </p>
                      <span className="mt-3 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-primary">
                        {item.confidence} confidence · Clinician review
                        recommended
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-primary/20 bg-card/60 p-4 text-sm leading-6 text-muted-foreground">
                    No possible mitigation pathways meet ChildLed’s conservative
                    evidence threshold yet.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
            <section className="rounded-3xl border border-border bg-card p-6 soft-shadow">
              <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                Possible language flexibility indicators
              </p>
              <h2 className="serif mt-2 text-2xl font-semibold">
                Emerging flexibility indicators
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                These are observable patterns in reviewed evidence, not
                definitive stage assignments.
              </p>
              <div className="mt-5 space-y-3">
                {flexibilityTrends.length ? (
                  flexibilityTrends.map((trend) => (
                    <div
                      key={trend.phrase}
                      className="rounded-2xl bg-muted/55 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">“{trend.phrase}”</h3>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">
                            {trend.contexts.length > 1
                              ? `Documented in ${trend.contexts.length} contexts`
                              : `Observed across ${trend.points.length} reviewed dates`}
                          </p>
                        </div>
                        <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold text-primary">
                          Low confidence
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {trend.contexts.map((context) => (
                          <span
                            key={context}
                            className="rounded-full bg-card px-2.5 py-1 text-[10px] text-primary"
                          >
                            {context}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">
                    More reviewed sessions in different contexts will make it
                    possible to notice cautious flexibility indicators.
                  </p>
                )}
              </div>
            </section>
            <section className="rounded-3xl border border-border bg-card p-6 soft-shadow">
              <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                Communication growth layer
              </p>
              <h2 className="serif mt-2 text-2xl font-semibold">
                Functions observed over time
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Each line groups reviewed Child evidence by month, so the team
                can see when a documented function first appears and how often
                it recurs.
              </p>
              <div className="mt-6 space-y-4">
                {functionMonthlySeries.length ? (
                  functionMonthlySeries.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl bg-muted/55 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            First observed{" "}
                            {formatDate(`${item.points[0]?.date}-01`)} ·{" "}
                            {item.points.length} documented month
                            {item.points.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <PhraseTrendChart points={item.points} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.points.map((point) => (
                          <span
                            key={point.date}
                            className="rounded-full bg-card px-2.5 py-1 text-[10px] text-primary"
                          >
                            {point.date} · {point.occurrences}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No documented communication functions yet.
                  </p>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                  Meaning evolution tracking
                </p>
                <h2 className="serif mt-2 text-2xl font-semibold">
                  Possible meaning expansion
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Working meanings remain clinician-entered and may evolve as
                  the same phrase appears in new situations.
                </p>
              </div>
              <Link
                href="/dictionary"
                className="text-sm font-semibold text-primary underline underline-offset-4"
              >
                Open phrase dictionary
              </Link>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {trends.map((trend) => {
                const documentedMeanings = [
                  ...new Set(
                    trend.meanings
                      .map((item) => item.meaning)
                      .filter(
                        (meaning) => meaning !== "Meaning not documented",
                      ),
                  ),
                ];
                const expanded = documentedMeanings.length > 1;
                return (
                  <article
                    key={trend.phrase}
                    className="rounded-2xl border border-border bg-background p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="serif text-xl font-semibold">
                        “{trend.phrase}”
                      </h3>
                      {expanded && (
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-primary">
                          Possible Meaning Expansion Detected
                        </span>
                      )}
                    </div>
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      {trend.meanings.map((item, index) => (
                        <div
                          key={`${item.date}-${item.context}-${index}`}
                          className="border-l-2 border-accent pl-3 text-xs leading-5 text-muted-foreground"
                        >
                          <strong className="text-primary">
                            {formatDate(item.date)}
                          </strong>{" "}
                          · {item.context} · {item.meaning}
                          <span className="ml-1">
                            ({item.occurrences} occurrence
                            {item.occurrences === 1 ? "" : "s"})
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-primary/20 bg-primary p-6 text-primary-foreground soft-shadow md:p-8">
            <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-accent">
              Growth summary
            </p>
            <h2 className="serif mt-2 text-3xl">
              A clinician-friendly narrative
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-primary-foreground/85">
              {snapshot.sessionChange.clinicalSummary}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-primary-foreground/65">
              This summary is based on confirmed Child-attributed evidence. It
              supports reflection and team conversation; it does not provide a
              diagnosis, definitive NLA stage, or treatment recommendation.
            </p>
          </section>
          <ClinicalDisclaimer />
        </div>
      )}
    </div>
  );
}

const focusAreaLabels: Partial<
  Record<ClinicalKnowledgeInsight["category"], string>
> = {
  mitigation_observation: "Model opportunities for mitigation",
  communication_function: "Increase commenting opportunities",
  longitudinal_growth: "Encourage flexible language combinations",
  parent_coaching: "Expand shared attention opportunities",
};

function SuggestedFocusAreas({
  insights,
  loading,
  canGenerate,
  generating,
  error,
  onGenerate,
}: {
  insights?: ClinicalKnowledgeInsight[];
  loading: boolean;
  canGenerate: boolean;
  generating: boolean;
  error?: string;
  onGenerate?: () => void;
}) {
  const focusAreas = [
    ...new Map(
      (insights ?? [])
        .filter(
          (insight) =>
            insight.status !== "reverted" && focusAreaLabels[insight.category],
        )
        .map((insight) => [insight.category, insight]),
    ).values(),
  ];

  return (
    <section
      data-testid="suggested-focus-areas"
      className="rounded-2xl border border-accent/30 bg-accent/10 p-6 soft-shadow animate-rise delay-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-accent/20 pb-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
            <Lightbulb size={18} />
          </span>
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Clinician support
            </p>
            <h2 className="serif mt-1 text-2xl font-semibold">
              Suggested Focus Areas
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Knowledge-base grounded prompts to consider with this child—not
              treatment recommendations or conclusions.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="warm"
            onClick={onGenerate}
            disabled={!canGenerate || generating}
            data-testid="button-generate-focus-areas"
          >
            {generating
              ? "Refreshing…"
              : focusAreas.length
                ? "Refresh suggestions"
                : "Check for suggestions"}
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {loading ? (
        <div className="mt-5">
          <LoadingBlocks />
        </div>
      ) : focusAreas.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {focusAreas.map((insight) => (
            <article
              key={insight.id}
              className="rounded-xl border border-border/70 bg-card/75 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="serif text-xl font-semibold">
                  {focusAreaLabels[insight.category]}
                </h3>
                <span className="mono shrink-0 rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {insight.status === "applied"
                    ? "Applied automatically"
                    : insight.status === "reviewed"
                      ? "Reviewed"
                      : insight.status === "exception"
                        ? "Review needed"
                        : insight.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6">
                {insight.clinicianEdit || insight.suggestion}
              </p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {insight.rationale}
              </p>
              {insight.citations.length > 0 && (
                <p className="mt-3 border-t border-border/60 pt-3 text-xs font-medium text-primary">
                  Grounded in:{" "}
                  {insight.citations
                    .map((citation) => citation.sourceTitle)
                    .join(" · ")}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-primary/20 bg-card/50 p-5">
          <p className="text-sm font-semibold">
            Generate clinician-support suggestions from the private clinical
            knowledge base.
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {canGenerate
              ? "Suggestions will use confirmed Child evidence and include their source citations for review."
              : "Add reviewed Child phrase evidence first, then generate suggestions from Clinical Knowledge."}
          </p>
        </div>
      )}
    </section>
  );
}

type CaseloadServiceStatus =
  "on_track" | "needs_attention" | "behind" | "complete" | "not_configured";

const caseloadServiceStatus = (
  requirements:
    ClinicianOverview["children"][number]["serviceRequirements"] | undefined,
): CaseloadServiceStatus => {
  if (!requirements?.length) return "not_configured";
  if (requirements.every((requirement) => requirement.status === "complete"))
    return "complete";
  if (requirements.some((requirement) => requirement.status === "behind"))
    return "behind";
  if (
    requirements.some((requirement) => requirement.status === "needs_attention")
  )
    return "needs_attention";
  return "on_track";
};

const caseloadStatusPresentation = {
  on_track: {
    label: "On Track",
    className: "bg-emerald-100 text-emerald-800",
    icon: TrendingUp,
  },
  behind: {
    label: "Behind",
    className: "bg-red-100 text-red-800",
    icon: AlertCircle,
  },
  needs_attention: {
    label: "Needs Attention",
    className: "bg-amber-100 text-amber-900",
    icon: Clock3,
  },
  complete: {
    label: "Completed",
    className: "bg-primary/10 text-primary",
    icon: Check,
  },
  not_configured: {
    label: "Setup Needed",
    className: "bg-muted text-muted-foreground",
    icon: Settings,
  },
} as const;

const overviewChangePresentation = {
  new_phrase: {
    label: "Phrase",
    icon: BookOpen,
    className: "bg-accent/20 text-primary",
  },
  new_function: {
    label: "Communication",
    icon: Sparkles,
    className: "bg-secondary text-primary",
  },
  possible_mitigation: {
    label: "Review",
    icon: AlertCircle,
    className: "bg-amber-100 text-amber-900",
  },
  team_contribution: {
    label: "Care team",
    icon: Users,
    className: "bg-secondary text-primary",
  },
  new_message: {
    label: "Inbox",
    icon: MessageCircle,
    className: "bg-primary/10 text-primary",
  },
  ai_insight: {
    label: "Insight",
    icon: Lightbulb,
    className: "bg-accent/20 text-primary",
  },
} as const;

function ClinicianQuickActions({
  onRecordSession,
  onManualSession,
  onAddStudent,
  onAddPhrase,
  onOpenInbox,
  unreadMessageCount = 0,
}: {
  onRecordSession: () => void;
  onManualSession: () => void;
  onAddStudent: () => void;
  onAddPhrase: () => void;
  onOpenInbox: () => void;
  unreadMessageCount?: number;
}) {
  const actions = [
    {
      label: "Record Session",
      detail: "Capture and review audio",
      icon: Mic,
      onClick: onRecordSession,
      testId: "button-overview-record-session",
    },
    {
      label: "Track Manually",
      detail: "Log goals without audio",
      icon: ClipboardList,
      onClick: onManualSession,
      testId: "button-overview-manual-session",
    },
    {
      label: "Add Student",
      detail: "Create a student profile",
      icon: UserPlus,
      onClick: onAddStudent,
      testId: "button-overview-quick-add-student",
    },
    {
      label: "Add Phrase",
      detail: "Add language to a profile",
      icon: Plus,
      onClick: onAddPhrase,
      testId: "button-overview-add-phrase",
    },
    {
      label: "Inbox",
      detail: "Open care-team updates",
      icon: MessageCircle,
      onClick: onOpenInbox,
      testId: "button-overview-messages",
      unreadCount: unreadMessageCount,
    },
  ];

  return (
    <section
      aria-labelledby="quick-actions-heading"
      data-testid="clinician-overview-quick-actions"
      className="border-y border-border py-5"
    >
      <div>
        <p className="text-xs font-semibold text-muted-foreground">
          Common tasks
        </p>
        <h2
          id="quick-actions-heading"
          className="serif mt-1 text-2xl font-semibold"
        >
          Quick Actions
        </h2>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              data-testid={action.testId}
              onClick={action.onClick}
              className="focus-ring min-h-28 min-w-0 rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary/35 hover:bg-secondary/25"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                  <Icon size={18} />
                </span>
                {action.unreadCount ? (
                  <span
                    data-testid="badge-overview-unread-messages"
                    className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground"
                    aria-label={`${action.unreadCount} unread notifications`}
                  >
                    {action.unreadCount > 99 ? "99+" : action.unreadCount}
                  </span>
                ) : null}
              </span>
              <span className="mt-3 block text-sm font-bold text-foreground">
                {action.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {action.detail}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ClinicianRecentUpdates({
  overview,
  teamInbox,
  loading,
  error,
  onOpenInbox,
  onRetry,
}: {
  overview?: ClinicianOverview;
  teamInbox?: ApiTeamInbox;
  loading: boolean;
  error?: string;
  onOpenInbox: () => void;
  onRetry: () => void;
}) {
  const inboxMessagesById = new Map(
    (teamInbox?.messages ?? []).map((message) => [
      `message-${message.id}`,
      message,
    ]),
  );
  const overviewItems = (overview?.changesByChild ?? []).flatMap((group) =>
    group.changes.map((change) => {
      const inboxMessage = inboxMessagesById.get(change.id);
      const notificationLines = inboxMessage?.body
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      return {
        ...change,
        label:
          inboxMessage?.messageType === "notification" &&
          notificationLines?.length
            ? notificationLines[0]
            : inboxMessage
              ? `${inboxMessage.senderName} shared a ${inboxMessage.messageType}`
              : change.label,
        detail:
          inboxMessage?.messageType === "notification" &&
          notificationLines?.length
            ? notificationLines.slice(1).join(" ") || change.detail
            : inboxMessage?.body || change.detail,
        unread: inboxMessage ? !inboxMessage.read : false,
      };
    }),
  );
  const includedIds = new Set(overviewItems.map((item) => item.id));
  const unreadInboxItems = (teamInbox?.messages ?? [])
    .filter(
      (message) => !message.read && !includedIds.has(`message-${message.id}`),
    )
    .map((message) => {
      const notificationLines = message.body
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      return {
        id: `message-${message.id}`,
        childId: message.childId,
        childName: message.childName,
        category: "new_message" as const,
        label:
          message.messageType === "notification" && notificationLines.length
            ? notificationLines[0]
            : `${message.senderName} shared a ${message.messageType}`,
        detail:
          message.messageType === "notification" && notificationLines.length
            ? notificationLines.slice(1).join(" ")
            : message.body,
        time: message.createdAt,
        href: `/team-communication?childId=${message.childId}`,
        unread: true,
      };
    });
  const recentItems = [...overviewItems, ...unreadInboxItems]
    .sort(
      (left, right) =>
        new Date(right.time).getTime() - new Date(left.time).getTime(),
    )
    .slice(0, 8);

  return (
    <section
      aria-labelledby="recent-updates-heading"
      data-testid="clinician-overview-whats-new"
      className="rounded-lg border border-border bg-card p-4 soft-shadow sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            Recent activity
          </p>
          <h2
            id="recent-updates-heading"
            className="serif mt-1 text-2xl font-semibold"
          >
            While You've Been Gone
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            New activity across your assigned students and care teams.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onOpenInbox}
          className="w-full shrink-0 sm:w-auto"
        >
          <MessageCircle size={16} /> Open Inbox
          {teamInbox?.totalUnread ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              {teamInbox.totalUnread > 99 ? "99+" : teamInbox.totalUnread}
            </span>
          ) : null}
        </Button>
      </div>

      {error ? (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <Button type="button" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}

      {recentItems.length ? (
        <div className="mt-4 divide-y divide-border border-y border-border">
          {recentItems.map((item) => {
            const presentation = overviewChangePresentation[item.category];
            const Icon = presentation.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                data-testid={`clinician-change-${item.id}`}
                className={`focus-ring flex min-w-0 items-start gap-3 px-1 py-4 transition hover:bg-secondary/25 sm:px-2 ${item.unread ? "bg-primary/[0.04]" : ""}`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${presentation.className}`}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-foreground">
                      {item.label}
                    </span>
                    {item.unread ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                        <span className="size-1.5 rounded-full bg-primary" />
                        Unread
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-primary">
                    {item.childName} · {presentation.label}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
                <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                  {timeAgo(item.time)}
                </span>
              </Link>
            );
          })}
        </div>
      ) : loading ? (
        <div
          className="mt-4 divide-y divide-border border-y border-border"
          aria-label="Loading recent activity"
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="flex animate-pulse items-center gap-3 py-4"
            >
              <span className="size-9 shrink-0 rounded-lg bg-muted" />
              <span className="min-w-0 flex-1 space-y-2">
                <span className="block h-3 w-2/5 rounded bg-muted" />
                <span className="block h-3 w-4/5 rounded bg-muted" />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
          You're caught up. New parent logs, teacher updates, messages, and
          reviewed clinical activity will appear here.
        </p>
      )}
    </section>
  );
}

const serviceDeliveryOptions: Array<{
  value: CaseloadServiceDeliveryType;
  label: string;
}> = [
  { value: "individual", label: "Individual" },
  { value: "group", label: "Group" },
  { value: "co_treat", label: "Co-Treat" },
  { value: "integrated_group", label: "Integrated Group" },
  { value: "consult", label: "Consult" },
];

const dateInputValue = (date = new Date()) => {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
};

const currentMonthBounds = () => {
  const now = new Date();
  return {
    start: dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: dateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const formatServiceDate = (date?: string | null) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not available";

function CaseloadRequirementDialog({
  childId,
  childName,
  requirement,
  onClose,
  onSaved,
}: {
  childId: number;
  childName: string;
  requirement?: IepServiceRequirement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const month = currentMonthBounds();
  const [serviceName, setServiceName] = useState(
    requirement?.serviceName ?? "Speech Therapy",
  );
  const [requiredSessions, setRequiredSessions] = useState(
    String(requirement?.requiredSessions ?? 8),
  );
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(
    String(requirement?.sessionDurationMinutes ?? 30),
  );
  const [period, setPeriod] = useState<
    "weekly" | "monthly" | "reporting_period"
  >(requirement?.period ?? "reporting_period");
  const [effectiveFrom, setEffectiveFrom] = useState(
    requirement?.effectiveFrom ?? month.start,
  );
  const [effectiveTo, setEffectiveTo] = useState(
    requirement?.effectiveTo ?? month.end,
  );
  const [error, setError] = useState("");
  const saveRequirement = useUpsertIepServiceRequirement();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const sessions = Number(requiredSessions);
    const duration = Number(sessionDurationMinutes);
    if (
      !serviceName.trim() ||
      !Number.isInteger(sessions) ||
      sessions < 1 ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      !effectiveFrom ||
      (period === "reporting_period" && !effectiveTo) ||
      (effectiveTo && effectiveTo < effectiveFrom)
    ) {
      setError(
        "Enter valid service details, whole-number sessions, and a valid date range.",
      );
      return;
    }
    try {
      await saveRequirement.mutateAsync({
        params: { childId },
        data: {
          requirementId: requirement?.id ?? null,
          serviceName: serviceName.trim(),
          requiredSessions: sessions,
          requiredMinutes: sessions * duration,
          sessionDurationMinutes: duration,
          period,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
        },
      });
      onSaved();
    } catch (requestError: any) {
      setError(
        requestError?.data?.error ??
          requestError?.message ??
          "The service requirement could not be saved.",
      );
    }
  };

  return (
    <Modal
      title={`${requirement ? "Edit" : "Set up"} service requirement for ${childName}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h2 className="serif text-2xl font-semibold">Service requirement</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Session totals are calculated from saved session records inside this
            period. Prior periods and session history are retained.
          </p>
        </div>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Service</span>
          <input
            data-autofocus
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-sm font-semibold">
              Required sessions
            </span>
            <input
              type="number"
              min="1"
              max="100"
              value={requiredSessions}
              onChange={(event) => setRequiredSessions(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-semibold">
              Typical session length
            </span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="480"
                value={sessionDurationMinutes}
                onChange={(event) =>
                  setSessionDurationMinutes(event.target.value)
                }
                className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              />
              <span className="text-sm text-muted-foreground">min</span>
            </span>
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-semibold">
              Tracking frequency
            </span>
            <select
              value={period}
              onChange={(event) =>
                setPeriod(
                  event.target.value as
                    "weekly" | "monthly" | "reporting_period",
                )
              }
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="reporting_period">Reporting / IEP period</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <div className="rounded-md bg-muted/45 p-3">
            <p className="text-xs text-muted-foreground">Planned minutes</p>
            <p className="mt-1 font-semibold">
              {(Number(requiredSessions) || 0) *
                (Number(sessionDurationMinutes) || 0)}{" "}
              minutes
            </p>
          </div>
          <label>
            <span className="mb-1.5 block text-sm font-semibold">
              Period start
            </span>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-semibold">
              Period end{period === "reporting_period" ? "" : " (optional)"}
            </span>
            <input
              type="date"
              value={effectiveTo}
              onChange={(event) => setEffectiveTo(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveRequirement.isPending}>
            {saveRequirement.isPending ? "Saving..." : "Save requirement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CaseloadOverviewPage({
  overview,
  teamInbox,
  loading,
  preparing,
  overviewError,
  caseloadChildren,
  onOpenChild,
  onAddStudent,
  onStartRecordedSession,
  onStartManualSession,
  onViewGoals,
  onViewHistory,
  onRecordSession,
  onManualSession,
  onAddPhrase,
  onOpenInbox,
  onRetryOverview,
}: {
  overview?: ClinicianOverview;
  teamInbox?: ApiTeamInbox;
  loading: boolean;
  preparing: boolean;
  overviewError?: string;
  caseloadChildren: Child[];
  onOpenChild: (childId: number) => void;
  onAddStudent: () => void;
  onStartRecordedSession: (childId: number) => void;
  onStartManualSession: (childId: number) => void;
  onViewGoals: (childId: number) => void;
  onViewHistory: (childId: number) => void;
  onRecordSession: () => void;
  onManualSession: () => void;
  onAddPhrase: () => void;
  onOpenInbox: () => void;
  onRetryOverview: () => void;
}) {
  const queryClient = useQueryClient();
  const updateServiceSettings = useUpdateCaseloadServiceSettings();
  const [editingStudent, setEditingStudent] = useState<
    | (ClinicianOverview["children"][number] & {
        primaryRequirement?: IepServiceRequirement;
      })
    | null
  >(null);
  const [deliveryDrafts, setDeliveryDrafts] = useState<
    Record<number, CaseloadServiceDeliveryType>
  >({});
  const [settingsError, setSettingsError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const students = (
    overview?.children ??
    caseloadChildren.map((child) => ({
      childId: child.id,
      childName: child.name,
      school: child.school,
      grade: child.grade,
      gestaltCount: child.gestaltCount,
      newActivityCount: 0,
      requiresReview: false,
      latestActivityAt: null,
      latestActivityLabel: "Service summary is preparing",
      teacherNames: [],
      primaryServiceDeliveryType: "individual" as const,
      lastSessionDate: null,
      nextSessionDate: null,
      serviceRequirements: [],
    }))
  )
    .map((student) => {
      const serviceRequirements = Array.isArray(student.serviceRequirements)
        ? student.serviceRequirements
        : [];
      const teacherNames = Array.isArray(student.teacherNames)
        ? student.teacherNames
        : [];
      return {
        ...student,
        teacherNames,
        primaryServiceDeliveryType:
          student.primaryServiceDeliveryType ?? "individual",
        lastSessionDate: student.lastSessionDate ?? null,
        nextSessionDate: student.nextSessionDate ?? null,
        serviceRequirements,
        primaryRequirement: serviceRequirements[0],
        serviceStatus: caseloadServiceStatus(serviceRequirements),
      };
    })
    .sort((left, right) => {
      const priority: Record<CaseloadServiceStatus, number> = {
        behind: 0,
        needs_attention: 1,
        on_track: 2,
        not_configured: 3,
        complete: 4,
      };
      return (
        priority[left.serviceStatus] - priority[right.serviceStatus] ||
        left.childName.localeCompare(right.childName)
      );
    });
  const normalizedStudentSearch = studentSearch.trim().toLocaleLowerCase();
  const filteredStudents = normalizedStudentSearch
    ? students.filter((student) => {
        const deliveryLabel = serviceDeliveryOptions.find(
          (option) => option.value === student.primaryServiceDeliveryType,
        )?.label;
        return [
          student.childName,
          student.school,
          student.grade,
          ...student.teacherNames,
          student.primaryRequirement?.serviceName,
          deliveryLabel,
        ].some((value) =>
          value?.toLocaleLowerCase().includes(normalizedStudentSearch),
        );
      })
    : students;
  const requirementsMet = students.filter(
    (student) => student.serviceStatus === "complete",
  ).length;
  const stillNeedServices = students.filter(
    (student) =>
      student.serviceStatus === "behind" ||
      student.serviceStatus === "needs_attention" ||
      student.serviceStatus === "on_track",
  ).length;
  const needSetup = students.filter(
    (student) => student.serviceStatus === "not_configured",
  ).length;
  const summary = [
    { label: "Caseload", value: students.length, detail: "active students" },
    {
      label: "Requirements met",
      value: requirementsMet,
      detail: "for the current period",
    },
    {
      label: "Still need services",
      value: stillNeedServices,
      detail: "sessions or minutes remain",
    },
    {
      label: "Need setup",
      value: needSetup,
      detail: "without an active requirement",
    },
  ];

  const saveDeliveryType = async (
    childId: number,
    previous: CaseloadServiceDeliveryType,
    next: CaseloadServiceDeliveryType,
  ) => {
    setSettingsError("");
    setDeliveryDrafts((current) => ({ ...current, [childId]: next }));
    try {
      await updateServiceSettings.mutateAsync({
        params: { childId },
        data: { primaryServiceDeliveryType: next },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetClinicianOverviewQueryKey(),
      });
    } catch (requestError: any) {
      setDeliveryDrafts((current) => ({ ...current, [childId]: previous }));
      setSettingsError(
        requestError?.data?.error ??
          requestError?.message ??
          "The service delivery type could not be saved.",
      );
    }
  };

  const statusBadge = (serviceStatus: CaseloadServiceStatus) => {
    const status = caseloadStatusPresentation[serviceStatus];
    const StatusIcon = status.icon;
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}
      >
        <StatusIcon size={13} /> {status.label}
      </span>
    );
  };

  const requirementProgress = (requirement?: IepServiceRequirement) =>
    requirement
      ? Math.round(
          Math.min(
            1,
            requirement.sessionsCompleted / requirement.requiredSessions,
          ) * 100,
        )
      : 0;

  const deliverySelect = (
    student: (typeof students)[number],
    compact = false,
  ) => (
    <select
      aria-label={`Service delivery type for ${student.childName}`}
      value={
        deliveryDrafts[student.childId] ?? student.primaryServiceDeliveryType
      }
      onChange={(event) =>
        void saveDeliveryType(
          student.childId,
          student.primaryServiceDeliveryType,
          event.target.value as CaseloadServiceDeliveryType,
        )
      }
      className={`${compact ? "h-10" : "h-9"} w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-xs font-semibold`}
    >
      {serviceDeliveryOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6 animate-rise">
      <SectionHeading
        eyebrow="SLP overview"
        title="SLP Overview"
        description="Track assigned students, active service periods, and sessions recorded in ChildLed."
        action={
          <Button
            onClick={onAddStudent}
            data-testid="button-overview-add-student"
            className="w-full sm:w-auto"
          >
            <UserPlus size={17} /> Add Student
          </Button>
        }
      />

      <ClinicianQuickActions
        onRecordSession={onRecordSession}
        onManualSession={onManualSession}
        onAddStudent={onAddStudent}
        onAddPhrase={onAddPhrase}
        onOpenInbox={onOpenInbox}
        unreadMessageCount={teamInbox?.totalUnread}
      />

      {overviewError && (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Service totals could not be refreshed. The assigned student list is
            still available.
          </p>
          <Button variant="outline" onClick={onRetryOverview}>
            Retry
          </Button>
        </div>
      )}

      {settingsError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {settingsError}
        </p>
      ) : null}

      {(loading || preparing) && !students.length ? (
        <LoadingBlocks />
      ) : students.length ? (
        <section
          aria-labelledby="caseload-compliance-heading"
          data-testid="clinician-overview-caseload"
          className="overflow-hidden rounded-lg border border-border bg-card soft-shadow"
        >
          <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Active caseload
              </p>
              <h2
                id="caseload-compliance-heading"
                className="serif mt-1 text-2xl font-semibold"
              >
                Caseload / Session Compliance
              </h2>
            </div>
            <p className="max-w-lg text-xs leading-5 text-muted-foreground">
              Organizational pacing based on sessions saved in ChildLed; not an
              official or legal compliance determination.
            </p>
          </div>

          <div className="border-b border-border px-4 py-3 sm:px-5">
            <label className="relative block w-full sm:max-w-md">
              <span className="sr-only">Search students</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Search students"
                data-testid="input-search-caseload-students"
                className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-10 text-sm outline-none focus-ring sm:h-10"
              />
              {studentSearch ? (
                <button
                  type="button"
                  onClick={() => setStudentSearch("")}
                  aria-label="Clear student search"
                  title="Clear search"
                  className="focus-ring absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary sm:size-8"
                >
                  <X size={15} />
                </button>
              ) : null}
            </label>
          </div>

          <div className="hidden xl:block">
            <table className="w-full table-fixed border-collapse text-left text-xs">
              <colgroup>
                <col className="w-[15%]" />
                <col className="w-[17%]" />
                <col className="w-[15%]" />
                <col className="w-[17%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead className="bg-muted/45 text-[11px] font-bold uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-2 py-3">Classroom / teacher</th>
                  <th className="px-2 py-3">Delivery</th>
                  <th className="px-2 py-3">Frequency / required</th>
                  <th className="px-2 py-3 text-center">Completed</th>
                  <th className="px-2 py-3 text-center">Remaining</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-border">
                {filteredStudents.map((student) => {
                  const requirement = student.primaryRequirement;
                  const progress = requirementProgress(requirement);
                  return (
                    <tr
                      key={student.childId}
                      data-testid={`overview-student-${student.childId}`}
                      className="align-middle transition even:bg-secondary/45 hover:bg-secondary/60"
                    >
                      <td className="min-w-0 px-3 py-4">
                        <button
                          type="button"
                          onClick={() => onOpenChild(student.childId)}
                          className="block max-w-full truncate rounded-sm text-left font-bold text-primary focus-ring"
                        >
                          {student.childName}
                        </button>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {student.school || "School not added"}
                        </span>
                      </td>
                      <td className="min-w-0 px-2 py-4">
                        <span className="block truncate font-semibold">
                          {student.teacherNames.length
                            ? student.teacherNames.join(", ")
                            : "Not assigned"}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {student.grade || "Classroom not added"}
                        </span>
                      </td>
                      <td className="min-w-0 px-2 py-4">
                        {deliverySelect(student)}
                      </td>
                      <td className="min-w-0 px-2 py-4">
                        {requirement ? (
                          <button
                            type="button"
                            onClick={() => setEditingStudent(student)}
                            className="block w-full rounded-sm text-left focus-ring"
                            title="Edit service requirement"
                          >
                            <span className="block font-bold text-primary">
                              {requirement.requiredSessions} sessions
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              {requirement.periodLabel}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingStudent(student)}
                            className="font-bold text-primary underline-offset-4 hover:underline"
                          >
                            Set requirement
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-4 text-center">
                        <span className="font-bold">
                          {requirement?.sessionsCompleted ?? "-"}
                        </span>
                        {requirement ? (
                          <div className="mx-auto mt-1.5 h-1.5 w-full max-w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-4 text-center font-bold text-primary">
                        {requirement?.sessionsRemaining ?? "-"}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            className="h-8 min-h-8 px-2 text-[11px]"
                            onClick={() =>
                              onStartManualSession(student.childId)
                            }
                            title={`Log a session for ${student.childName}`}
                          >
                            <ClipboardList size={13} /> Log
                          </Button>
                          <Button
                            variant="outline"
                            className="h-8 min-h-8 shrink-0 px-2 text-[11px]"
                            onClick={() => onOpenChild(student.childId)}
                            aria-label={`View ${student.childName}`}
                            title={`View ${student.childName}`}
                          >
                            <UserRound size={13} /> View
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="size-8 min-h-8 shrink-0 p-0"
                                aria-label={`More actions for ${student.childName}`}
                                title={`More actions for ${student.childName}`}
                              >
                                <ChevronDown size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onSelect={() => onOpenChild(student.childId)}
                              >
                                <UserRound /> View Student
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => onViewHistory(student.childId)}
                              >
                                <Clock3 /> Session History
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  onStartRecordedSession(student.childId)
                                }
                              >
                                <Mic /> Record Session
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => onViewGoals(student.childId)}
                              >
                                <Target /> View IEP Goals
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredStudents.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      No students match “{studentSearch.trim()}”.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="xl:hidden">
            {filteredStudents.map((student) => {
              const requirement = student.primaryRequirement;
              const progress = requirementProgress(requirement);
              return (
                <article
                  key={student.childId}
                  data-testid={`overview-student-mobile-${student.childId}`}
                  className="border-b-[10px] border-muted/80 bg-card p-4 last:border-b-0 even:bg-secondary/45"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenChild(student.childId)}
                      className="min-w-0 rounded-sm text-left focus-ring"
                    >
                      <span className="block truncate font-bold text-primary">
                        {student.childName}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {student.teacherNames.length
                          ? student.teacherNames.join(", ")
                          : student.grade ||
                            student.school ||
                            "Student profile"}
                      </span>
                    </button>
                    {statusBadge(student.serviceStatus)}
                  </div>
                  <div className="mt-4">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase text-muted-foreground">
                      Service delivery
                    </span>
                    {deliverySelect(student, true)}
                  </div>
                  {requirement ? (
                    <div className="mt-4">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingStudent(student)}
                          className="rounded-sm text-left focus-ring"
                        >
                          <span className="text-sm font-bold">
                            {requirement.serviceName}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {requirement.periodLabel}
                          </span>
                        </button>
                        <span className="shrink-0 text-sm font-bold text-primary">
                          {requirement.sessionsCompleted} /{" "}
                          {requirement.requiredSessions}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <dt className="text-muted-foreground">Remaining</dt>
                          <dd className="mt-1 font-bold text-primary">
                            {requirement.sessionsRemaining}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            Last session
                          </dt>
                          <dd className="mt-1 font-semibold">
                            {student.lastSessionDate
                              ? formatServiceDate(student.lastSessionDate)
                              : "None"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Upcoming</dt>
                          <dd className="mt-1 font-semibold">
                            {student.nextSessionDate
                              ? formatServiceDate(student.nextSessionDate)
                              : "Not set"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingStudent(student)}
                      className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md border border-dashed border-primary/30 text-sm font-bold text-primary"
                    >
                      <Settings size={16} /> Set service requirement
                    </button>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => onStartManualSession(student.childId)}
                    >
                      <ClipboardList size={15} /> Log Session
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          More <ChevronDown size={15} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          onSelect={() => onOpenChild(student.childId)}
                        >
                          <UserRound /> View Student
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onViewHistory(student.childId)}
                        >
                          <Clock3 /> Session History
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            onStartRecordedSession(student.childId)
                          }
                        >
                          <Mic /> Record Session
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => onViewGoals(student.childId)}
                        >
                          <Target /> View IEP Goals
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </article>
              );
            })}
            {!filteredStudents.length ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No students match “{studentSearch.trim()}”.
              </p>
            ) : null}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Users}
          title="Your caseload is ready for its first student"
          body="Add a student to create their profile and begin tracking IEP service requirements."
          action={
            <Button onClick={onAddStudent}>
              <UserPlus size={16} /> Add Student
            </Button>
          }
        />
      )}

      <section
        aria-label="Caseload summary"
        data-testid="clinician-overview-metrics"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {summary.map((item) => (
          <article
            key={item.label}
            className="min-w-0 rounded-lg border border-border bg-card p-4 soft-shadow sm:p-5"
          >
            <p className="text-xs font-semibold text-muted-foreground">
              {item.label}
            </p>
            <p className="serif mt-2 text-3xl font-semibold text-primary">
              {item.value}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {item.detail}
            </p>
          </article>
        ))}
      </section>

      <ClinicianRecentUpdates
        overview={overview}
        teamInbox={teamInbox}
        loading={loading || preparing}
        error={overviewError}
        onOpenInbox={onOpenInbox}
        onRetry={onRetryOverview}
      />
      {editingStudent ? (
        <CaseloadRequirementDialog
          childId={editingStudent.childId}
          childName={editingStudent.childName}
          requirement={editingStudent.primaryRequirement}
          onClose={() => setEditingStudent(null)}
          onSaved={() => {
            setEditingStudent(null);
            void queryClient.invalidateQueries({
              queryKey: getGetClinicianOverviewQueryKey(),
            });
            void queryClient.invalidateQueries({
              queryKey: getGetManualSessionSetupQueryKey({
                childId: editingStudent.childId,
              }),
            });
          }}
        />
      ) : null}
    </div>
  );
}

const childProfileIncomplete = (child: Child) => {
  const placeholderName =
    /^(child|student|unknown|unnamed|tbd|placeholder)(\s|$)/i.test(
      child.name.trim(),
    );
  return placeholderName || !child.school.trim() || !child.grade.trim();
};

function ProfileIncompleteNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      data-testid="profile-incomplete-indicator"
      className={`rounded-2xl border border-accent/45 bg-accent/10 ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 shrink-0 text-primary"
          size={compact ? 16 : 18}
        />
        <div>
          <p className="text-sm font-bold text-primary">Profile Incomplete</p>
          <p
            className={`${compact ? "mt-1 text-[11px] leading-4" : "mt-1 text-xs leading-5"} text-muted-foreground`}
          >
            Complete child details to improve reports and care-team
            communication.
          </p>
        </div>
      </div>
    </div>
  );
}

function ClinicianCaseloadPage({
  children,
  invitations,
  overview,
  loading,
  onAddStudent,
  onOpenStudent,
  onInvite,
  onEditChild,
}: {
  children: Child[];
  invitations: CareTeamInvitation[];
  overview?: ClinicianOverview;
  loading: boolean;
  onAddStudent: () => void;
  onOpenStudent: (child: Child) => void;
  onInvite: (child: Child) => void;
  onEditChild: (child: Child) => void;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = children.filter((child) =>
    [child.name, child.school, child.grade].some((value) =>
      value.toLowerCase().includes(normalizedSearch),
    ),
  );
  const pendingByChild = new Map<number, number>();
  const summaryByChild = new Map(
    (overview?.children ?? []).map((child) => [child.childId, child]),
  );
  invitations
    .filter((invitation) => invitation.status === "pending")
    .forEach((invitation) =>
      pendingByChild.set(
        invitation.childId,
        (pendingByChild.get(invitation.childId) ?? 0) + 1,
      ),
    );
  return (
    <div className="space-y-8 animate-rise">
      <SectionHeading
        eyebrow="Clinician workspace"
        title="My caseload"
        description="Search your assigned students, see what is new, and open a child profile when you’re ready for detailed clinical work."
        action={
          <Button
            onClick={onAddStudent}
            data-testid="button-caseload-add-student"
          >
            <Plus size={16} /> Add student
          </Button>
        }
      />
      <section className="rounded-3xl border border-border bg-card p-5 soft-shadow md:p-6">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <input
            data-testid="input-search-caseload"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by student, school, or grade…"
            className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
      </section>
      {loading ? (
        <LoadingBlocks />
      ) : filtered.length ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((child) => {
            const summary = summaryByChild.get(child.id);
            const status = summary?.requiresReview
              ? "Review needed"
              : summary?.newActivityCount
                ? `${summary.newActivityCount} new activity`
                : "Up to date";
            return (
              <article
                key={child.id}
                data-testid={`caseload-student-${child.id}`}
                className={`brand-card flex flex-col rounded-3xl border bg-card p-6 soft-shadow ${summary?.requiresReview ? "border-accent/50" : "border-border"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Avatar
                    name={child.name}
                    className="size-12 bg-secondary text-sm"
                  />
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${summary?.requiresReview ? "bg-accent/20 text-primary" : "bg-secondary text-primary"}`}
                  >
                    {status}
                  </span>
                </div>
                <h2 className="serif mt-5 text-2xl font-semibold">
                  {child.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {child.school || "School not added"} ·{" "}
                  {child.grade || "Grade not added"}
                </p>
                {childProfileIncomplete(child) && (
                  <div className="mt-4">
                    <ProfileIncompleteNotice compact />
                  </div>
                )}
                <p className="mt-4 min-h-5 text-xs leading-5 text-muted-foreground">
                  {summary?.latestActivityLabel ??
                    (pendingByChild.get(child.id)
                      ? `${pendingByChild.get(child.id)} care-team invite pending`
                      : "No new activity")}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1.5 text-xs text-primary">
                    {child.gestaltCount} phrase
                    {child.gestaltCount === 1 ? "" : "s"} logged
                  </span>
                  {pendingByChild.get(child.id) ? (
                    <span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs text-primary">
                      {pendingByChild.get(child.id)} invite pending
                    </span>
                  ) : null}
                </div>
                <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
                  <Button
                    className="flex-1"
                    onClick={() => onOpenStudent(child)}
                    data-testid={`button-open-student-${child.id}`}
                  >
                    Open profile <ArrowRight size={15} />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onEditChild(child)}
                    data-testid={`button-quick-edit-child-${child.id}`}
                  >
                    Quick Edit Child Information
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => onInvite(child)}
                    data-testid={`button-invite-student-${child.id}`}
                  >
                    <UserPlus size={15} /> Invite
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          icon={Users}
          title="No students match that search"
          body={
            search
              ? "Try a different name, school, or grade."
              : "Add your first student profile to begin building your caseload."
          }
          action={
            !search ? (
              <Button onClick={onAddStudent}>
                <Plus size={16} /> Add student
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

type CommunicationGoalForm = {
  title: string;
  goalArea: string;
  description: string;
  status: "active" | "archived";
  startDate: string;
  targetDate: string;
};

function CommunicationGoalsPanel({ childId }: { childId: number }) {
  const queryClient = useQueryClient();
  const params = { childId, includeArchived: true };
  const goalsQuery = useListCommunicationGoals(params, {
    query: { queryKey: getListCommunicationGoalsQueryKey(params) },
  });
  const createGoal = useCreateCommunicationGoal();
  const updateGoal = useUpdateCommunicationGoal();
  const emptyForm = (): CommunicationGoalForm => ({
    title: "",
    goalArea: "",
    description: "",
    status: "active",
    startDate: new Date().toISOString().slice(0, 10),
    targetDate: "",
  });
  const [editing, setEditing] = useState<CommunicationGoal | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const isSaving = createGoal.isPending || updateGoal.isPending;
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: getListCommunicationGoalsQueryKey(params),
    });
  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setIsFormOpen(true);
  };
  const openEdit = (goal: CommunicationGoal) => {
    setEditing(goal);
    setIsFormOpen(true);
    setForm({
      title: goal.title,
      goalArea: goal.goalArea,
      description: goal.description,
      status: goal.status,
      startDate: goal.startDate.slice(0, 10),
      targetDate: goal.targetDate?.slice(0, 10) ?? "",
    });
    setError("");
  };
  const save = async () => {
    if (
      !form.title.trim() ||
      !form.goalArea.trim() ||
      !form.description.trim() ||
      !form.startDate
    ) {
      setError("Title, goal area, description, and start date are required.");
      return;
    }
    setError("");
    try {
      if (editing) {
        await updateGoal.mutateAsync({
          goalId: editing.id,
          data: {
            childId,
            version: editing.version,
            title: form.title.trim(),
            goalArea: form.goalArea.trim(),
            description: form.description.trim(),
            status: form.status,
            startDate: form.startDate,
            targetDate: form.targetDate || null,
          },
        });
      } else {
        const created = await createGoal.mutateAsync({
          data: {
            childId,
            title: form.title.trim(),
            goalArea: form.goalArea.trim(),
            description: form.description.trim(),
            startDate: form.startDate,
            targetDate: form.targetDate || undefined,
          },
        });
        if (form.status === "archived")
          await updateGoal.mutateAsync({
            goalId: created.id,
            data: { childId, version: created.version, status: "archived" },
          });
      }
      setEditing(null);
      setForm(emptyForm());
      setIsFormOpen(false);
      await refresh();
    } catch (cause: any) {
      setError(
        cause?.data?.error ??
          cause?.message ??
          "Could not save this communication goal. Please review the goal and try again.",
      );
    }
  };
  const setStatus = async (
    goal: CommunicationGoal,
    status: "active" | "archived",
  ) => {
    setError("");
    try {
      await updateGoal.mutateAsync({
        goalId: goal.id,
        data: { childId, version: goal.version, status },
      });
      await refresh();
    } catch (cause: any) {
      setError(
        cause?.data?.error ??
          cause?.message ??
          "Could not update this goal’s status. Please try again.",
      );
    }
  };
  const activeGoals = (goalsQuery.data ?? []).filter(
    (goal) => goal.status === "active",
  );
  const archivedGoals = (goalsQuery.data ?? []).filter(
    (goal) => goal.status === "archived",
  );
  const goalCard = (goal: CommunicationGoal) => (
    <article
      key={goal.id}
      data-testid={`card-communication-goal-${goal.id}`}
      className="rounded-2xl border border-border bg-background/55 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-primary">{goal.title}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {goal.goalArea}
          </p>
        </div>
        <span
          data-testid={`status-communication-goal-${goal.id}`}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${goal.status === "active" ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}
        >
          {goal.status}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/80">
        {goal.description}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Start {formatDate(goal.startDate)}
        {goal.targetDate
          ? ` · Target ${formatDate(goal.targetDate)}`
          : " · No target date"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="px-3 py-2 text-xs"
          onClick={() => openEdit(goal)}
          data-testid={`button-edit-communication-goal-${goal.id}`}
        >
          <Settings size={14} /> Edit
        </Button>
        <Button
          variant="quiet"
          className="px-3 py-2 text-xs"
          disabled={isSaving}
          onClick={() =>
            void setStatus(
              goal,
              goal.status === "active" ? "archived" : "active",
            )
          }
          data-testid={`button-${goal.status === "active" ? "archive" : "reactivate"}-communication-goal-${goal.id}`}
        >
          {goal.status === "active" ? "Archive" : "Reactivate"}
        </Button>
      </div>
    </article>
  );
  return (
    <section
      id="child-communication-goals"
      data-testid="section-communication-goals"
      className="scroll-mt-40 rounded-3xl border border-border bg-card p-6 soft-shadow md:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
            Clinician-owned planning
          </p>
          <h2 className="serif mt-1 text-2xl font-semibold">
            Communication Goals
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Goals are clinician-owned planning records. ChildLed does not
            automatically calculate or update progress from communication
            evidence.
          </p>
        </div>
        <Button
          variant="warm"
          onClick={openNew}
          data-testid="button-create-communication-goal"
        >
          <Plus size={16} /> Add goal
        </Button>
      </div>
      {isFormOpen && (
        <div
          data-testid="form-communication-goal"
          className="mt-6 rounded-2xl border border-primary/20 bg-secondary/25 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="serif text-xl font-semibold">
              {editing ? "Edit communication goal" : "New communication goal"}
            </h3>
            <button
              type="button"
              className="text-xs font-bold text-muted-foreground underline focus-ring"
              onClick={() => {
                setIsFormOpen(false);
                setError("");
              }}
              data-testid="button-cancel-communication-goal"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p
              role="alert"
              data-testid="error-communication-goal"
              className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-sm font-bold">Title</span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                data-testid="input-communication-goal-title"
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-ring"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold">Goal area</span>
              <input
                value={form.goalArea}
                onChange={(event) =>
                  setForm({ ...form, goalArea: event.target.value })
                }
                data-testid="input-communication-goal-area"
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-ring"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold">Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as "active" | "archived",
                  })
                }
                data-testid="select-communication-goal-status"
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-ring"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-bold">Start date</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm({ ...form, startDate: event.target.value })
                }
                data-testid="input-communication-goal-start-date"
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-ring"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold">
                Target date{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </span>
              <input
                type="date"
                value={form.targetDate}
                onChange={(event) =>
                  setForm({ ...form, targetDate: event.target.value })
                }
                data-testid="input-communication-goal-target-date"
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-ring"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-bold">Description</span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                rows={4}
                data-testid="textarea-communication-goal-description"
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-6 focus-ring"
              />
            </label>
          </div>
          <Button
            className="mt-5"
            onClick={() => void save()}
            disabled={isSaving}
            data-testid="button-save-communication-goal"
          >
            {isSaving ? "Saving…" : editing ? "Save goal" : "Create goal"}
          </Button>
        </div>
      )}
      {goalsQuery.isLoading ? (
        <div className="mt-6">
          <LoadingBlocks />
        </div>
      ) : goalsQuery.error ? (
        <p
          role="alert"
          data-testid="error-communication-goals-load"
          className="mt-6 text-sm text-destructive"
        >
          Communication goals could not be loaded. Please refresh and try again.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold">
              Active goals ({activeGoals.length})
            </h3>
            <div className="mt-3 space-y-3">
              {activeGoals.length ? (
                activeGoals.map(goalCard)
              ) : (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No active communication goals. Add a clinician-owned goal when
                  ready.
                </p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-muted-foreground">
              Archived goals ({archivedGoals.length})
            </h3>
            <div className="mt-3 space-y-3">
              {archivedGoals.length ? (
                archivedGoals.map(goalCard)
              ) : (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No archived communication goals.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ClinicianChildProfilePage({
  child,
  dashboard,
  loading,
  onAddChild,
  onAddPhrase,
  onEditChild,
}: {
  child?: Child;
  dashboard?: Dashboard;
  loading: boolean;
  onAddChild: () => void;
  onAddPhrase: () => void;
  onEditChild: (child: Child) => void;
}) {
  const [location] = useLocation();
  const section = new URLSearchParams(window.location.search).get("section");
  useEffect(() => {
    if (!section) return;
    const target = document.getElementById(`child-${section}`);
    if (!target) return;
    const frame = window.requestAnimationFrame(() =>
      target.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [child?.id, location, section]);
  if (loading) return <LoadingBlocks />;
  if (!child)
    return (
      <EmptyState
        icon={UserRound}
        title="No child profile yet"
        body="Create a profile to give your team a shared starting point."
        action={
          <Button onClick={onAddChild}>
            <Plus size={16} /> Add child
          </Button>
        }
      />
    );

  const newPhrases = dashboard?.recentlyAdded ?? [];
  const recentActivity = dashboard?.activity ?? [];
  const recentObservations = dashboard?.observations ?? [];
  const sessionChange = dashboard?.snapshot?.sessionChange;
  const newFunctions = sessionChange?.newFunctions ?? [];
  const possibleMitigations = sessionChange?.possibleMitigations ?? [];
  const childHref = (href: string) => `${href}?childId=${child.id}`;
  return (
    <div
      id="child-overview"
      data-testid="section-profile-overview"
      className="space-y-8 animate-rise"
    >
      <ChildPage
        child={child}
        latestSessionDate={
          dashboard?.snapshot?.sessionChange?.latestSessionDate
        }
        loading={false}
        onAddChild={onAddChild}
      />

      {childProfileIncomplete(child) && <ProfileIncompleteNotice />}
      <div
        data-testid="profile-primary-actions"
        className="flex flex-wrap gap-3"
      >
        <Link
          href={childHref("/session")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_-14px_hsl(var(--brand-forest-950)/.9)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-ring"
          data-testid="quick-action-record"
        >
          <Mic size={16} /> Record Session
        </Link>
        <Button
          variant="warm"
          onClick={onAddPhrase}
          data-testid="quick-action-add-phrase"
        >
          <Plus size={16} /> Add Phrase
        </Button>
        <Button
          variant="outline"
          onClick={() => onEditChild(child)}
          data-testid="button-edit-child-profile"
        >
          <Settings size={16} /> Edit Profile
        </Button>
        <Link href={childHref("/communication-passport")}>
          <Button variant="outline">
            <BookOpen size={16} /> Communication Passport
          </Button>
        </Link>
      </div>

      <section
        id="child-whats-new"
        data-testid="section-profile-whats-new"
        className="relative scroll-mt-40 overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground soft-shadow md:p-8"
      >
        <div className="absolute -right-16 -top-20 size-64 rounded-full border-[28px] border-accent/15" />
        <div className="relative">
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-accent">
            What’s New Since Last Review
          </p>
          <h2 className="serif mt-2 text-3xl font-semibold">
            Recent changes for {child.name}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/70">
            Confirmed language evidence, new functions, observations, and
            care-team contributions gathered since the last review.
          </p>
          {newPhrases.length ||
          recentActivity.length ||
          recentObservations.length ||
          newFunctions.length ||
          possibleMitigations.length ||
          sessionChange?.clinicalSummary ? (
            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              {newPhrases.slice(0, 2).map((phrase) => (
                <article
                  key={`new-phrase-${phrase.id}`}
                  className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4"
                >
                  <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">
                    New phrase
                  </span>
                  <p className="serif mt-4 text-xl">“{phrase.phrase}”</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-primary-foreground/65">
                    {phrase.meaning || "Meaning awaits clinician review."}
                  </p>
                </article>
              ))}
              {newFunctions.slice(0, 1).map((item) => (
                <article
                  key={`new-function-${item.label}`}
                  className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4"
                >
                  <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">
                    New function
                  </span>
                  <p className="serif mt-4 text-xl">{item.label}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-primary-foreground/65">
                    {item.examples[0]
                      ? `“${item.examples[0].phrase}” · ${item.examples[0].meaning}`
                      : "A new communication function appears in reviewed session evidence."}
                  </p>
                </article>
              ))}
              {possibleMitigations.slice(0, 1).map((item) => (
                <article
                  key={`possible-mitigation-${item.originalPhrase}-${item.sessionDate}`}
                  className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4"
                >
                  <span className="rounded-full bg-primary-foreground/10 px-2 py-1 text-[10px] font-bold">
                    Variation to review
                  </span>
                  <p className="serif mt-4 text-xl">
                    “{item.observedVariation}”
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-primary-foreground/65">
                    Alongside “{item.originalPhrase}” in {item.context}.
                    Conservative review guidance ·{" "}
                    {item.confidence.toLowerCase()} confidence.
                  </p>
                </article>
              ))}
              {recentActivity[0] && (
                <article className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
                  <span className="rounded-full bg-primary-foreground/10 px-2 py-1 text-[10px] font-bold">
                    Team contribution
                  </span>
                  <p className="mt-4 line-clamp-3 text-sm leading-6">
                    {recentActivity[0].action}{" "}
                    <strong>{recentActivity[0].target}</strong>
                  </p>
                  <p className="mt-3 text-xs text-primary-foreground/60">
                    {recentActivity[0].author} ·{" "}
                    {timeAgo(recentActivity[0].time)}
                  </p>
                </article>
              )}
              {recentObservations[0] && (
                <article className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
                  <span className="rounded-full bg-primary-foreground/10 px-2 py-1 text-[10px] font-bold">
                    Observation
                  </span>
                  <p className="mt-4 line-clamp-3 text-sm leading-6">
                    {recentObservations[0].body}
                  </p>
                  <p className="mt-3 text-xs text-primary-foreground/60">
                    {recentObservations[0].author} ·{" "}
                    {timeAgo(recentObservations[0].createdAt)}
                  </p>
                </article>
              )}
              {sessionChange?.clinicalSummary && (
                <article className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
                  <span className="rounded-full bg-primary-foreground/10 px-2 py-1 text-[10px] font-bold">
                    Session change
                  </span>
                  <p className="mt-4 line-clamp-4 text-sm leading-6">
                    {sessionChange.clinicalSummary}
                  </p>
                  {sessionChange.latestSessionDate && (
                    <p className="mt-3 text-xs text-primary-foreground/60">
                      Latest session ·{" "}
                      {formatDate(sessionChange.latestSessionDate)}
                    </p>
                  )}
                </article>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-primary-foreground/20 px-4 py-5 text-sm text-primary-foreground/70">
              No new changes have been recorded since the last review.
            </div>
          )}
        </div>
      </section>
      <CommunicationGoalsPanel childId={child.id} />
      <section
        id="child-frequent-scripts"
        data-testid="section-profile-frequent-scripts"
        className="scroll-mt-40 rounded-3xl border border-border bg-card p-6 soft-shadow md:p-7"
      >
        <FrequentScriptsPanel childId={child.id} />
      </section>
    </div>
  );
}

function DashboardPage({
  dashboard,
  loading,
  child,
  childrenList,
  selectedId,
  onChangeChild,
  onAddChild,
  onObserve,
  focusInsights,
  focusInsightsLoading,
  canGenerateFocusAreas,
  generatingFocusAreas,
  focusAreaError,
  onGenerateFocusAreas,
}: {
  dashboard?: Dashboard;
  loading: boolean;
  child?: Child;
  childrenList: Child[];
  selectedId?: number;
  onChangeChild: (id: number) => void;
  onAddChild: () => void;
  onObserve: () => void;
  focusInsights?: ClinicalKnowledgeInsight[];
  focusInsightsLoading: boolean;
  canGenerateFocusAreas: boolean;
  generatingFocusAreas: boolean;
  focusAreaError?: string;
  onGenerateFocusAreas?: () => void;
}) {
  if (loading) return <LoadingBlocks />;
  const data = dashboard;
  const activeChild = data?.child ?? child;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "review" | "steady">("all");
  const [readIds, setReadIds] = useState<number[]>([]);
  const phrases = data?.recentlyAdded ?? [];
  const activity = data?.activity ?? [];
  const observations = data?.observations ?? [];
  const alerts = (focusInsights ?? []).filter(
    (insight) =>
      insight.status === "exception" || insight.disposition === "exception",
  );
  const newCount = phrases.length + activity.length + observations.length;
  const filteredChildren = childrenList.filter((item) => {
    const matchesSearch = [
      item.name,
      item.school,
      item.grade,
      item.communicationStyle,
    ].some((value) =>
      value?.toLowerCase().includes(search.trim().toLowerCase()),
    );
    const needsReview =
      item.id === activeChild?.id && Boolean(phrases.length || alerts.length);
    return (
      matchesSearch &&
      (filter === "all" || (filter === "review" ? needsReview : !needsReview))
    );
  });
  const markRead = () =>
    setReadIds([
      ...phrases.map((item) => item.id),
      ...observations.map((item) => item.id),
    ]);
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5 animate-rise">
        <div className="max-w-3xl">
          <p className="mono mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Clinician command center ·{" "}
            {new Date().toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <h1
            data-testid="clinical-summary"
            className="serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl"
          >
            Good morning. Start with what changed.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            A focused view of confirmed Child communication evidence for{" "}
            {activeChild?.name ?? "your caseload"}.
          </p>
        </div>
      </header>

      <section
        data-testid="section-whats-new"
        className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/15 md:p-8"
      >
        <div className="absolute -right-20 -top-24 size-72 rounded-full border-[30px] border-accent/15" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-accent">
                <Sparkles size={16} />
                <p className="mono text-[10px] font-bold uppercase tracking-[0.2em]">
                  Most important first
                </p>
              </div>
              <h2 className="serif mt-3 text-3xl font-semibold md:text-4xl">
                What’s New Since Last Sign-In
              </h2>
              <p className="mt-2 text-sm text-primary-foreground/70">
                {newCount
                  ? `${newCount} new signal${newCount === 1 ? "" : "s"} ready for review.`
                  : "Nothing new is waiting in this child view."}
              </p>
            </div>
            {newCount > 0 && (
              <button
                data-testid="button-mark-new-read"
                onClick={markRead}
                className="focus-ring rounded-xl border border-primary-foreground/20 px-3 py-2 text-xs font-bold hover:bg-primary-foreground/10"
              >
                Mark all read
              </button>
            )}
          </div>
          {newCount ? (
            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              {phrases.slice(0, 2).map((item) => (
                <article
                  key={item.id}
                  className={`rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4 ${readIds.includes(item.id) ? "opacity-55" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-bold text-accent-foreground">
                      New phrase
                    </span>
                    <span className="text-[10px] text-primary-foreground/55">
                      {formatDate(item.dateAdded)}
                    </span>
                  </div>
                  <p className="serif mt-4 text-xl">“{item.phrase}”</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-primary-foreground/65">
                    {item.meaning || "Meaning awaits clinician review."}
                  </p>
                  <Link
                    href="/dictionary"
                    data-testid={`link-review-new-phrase-${item.id}`}
                    className="mt-4 inline-flex text-xs font-bold text-accent"
                  >
                    Review phrase <ArrowRight size={13} />
                  </Link>
                </article>
              ))}
              {activity[0] && (
                <article className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
                  <span className="rounded-full bg-primary-foreground/10 px-2 py-1 text-[10px] font-bold">
                    Team activity
                  </span>
                  <p className="mt-4 line-clamp-3 text-sm leading-6">
                    {activity[0].action} <strong>{activity[0].target}</strong>
                  </p>
                  <p className="mt-3 text-xs text-primary-foreground/60">
                    {activity[0].author} · {timeAgo(activity[0].time)}
                  </p>
                  <Link
                    href="/activity"
                    data-testid="link-new-team-activity"
                    className="mt-4 inline-flex text-xs font-bold text-accent"
                  >
                    Open activity <ArrowRight size={13} />
                  </Link>
                </article>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-primary-foreground/20 px-4 py-5 text-sm text-primary-foreground/70">
              New reviewed phrases, team notes, and observations will appear
              here after your next sign-in.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section
          data-testid="section-priority-alerts"
          className="rounded-2xl border border-accent/35 bg-accent/10 p-6"
        >
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent-foreground">
                Priority alerts
              </p>
              <h2 className="serif mt-1 text-2xl font-semibold text-primary">
                Needs a closer look
              </h2>
            </div>
            <AlertCircle className="text-accent-foreground" size={20} />
          </div>
          {focusInsightsLoading ? (
            <LoadingBlocks />
          ) : alerts.length ? (
            <div className="space-y-3">
              {alerts.slice(0, 3).map((insight) => (
                <article
                  key={insight.id}
                  className="rounded-xl border border-accent/20 bg-card/80 p-4"
                >
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {focusAreaLabels[insight.category]}
                    </p>
                    <span className="mono rounded-full bg-accent/20 px-2 py-1 text-[9px] font-bold uppercase text-primary">
                      Review
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5">
                    {insight.clinicianEdit || insight.suggestion}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {insight.rationale}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-accent/30 bg-card/45 p-4 text-sm leading-6 text-muted-foreground">
              No priority alerts are waiting. Insights stay conservative and
              grounded in reviewed Child evidence.
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-card p-6 soft-shadow">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Quick actions
              </p>
              <h2 className="serif mt-1 text-2xl font-semibold">
                {activeChild?.name ?? "Selected child"}
              </h2>
            </div>
            <Clock3 className="text-muted-foreground" size={20} />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Continue with the selected child without leaving the clinician
            workspace.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/session"
              data-testid="button-focus-session"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground"
            >
              <Mic size={15} /> Start session
            </Link>
            <Button
              variant="outline"
              className="px-3 py-2 text-xs"
              onClick={onObserve}
              data-testid="button-focus-observation"
            >
              <Plus size={14} /> Add observation
            </Button>
            <Link
              href="/children"
              data-testid="button-focus-profile"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/20 px-3 py-2.5 text-xs font-bold text-primary"
            >
              <UserRound size={14} /> Profile
            </Link>
          </div>
        </section>
      </div>

      <section
        data-testid="section-children-review"
        className="rounded-2xl border border-border bg-card p-6 soft-shadow md:p-7"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Caseload triage
            </p>
            <h2 className="serif mt-1 text-2xl font-semibold">
              Children Requiring Review Today
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only the selected child has current dashboard evidence loaded for
              this screen.
            </p>
          </div>
          <Link
            href="/caseload"
            data-testid="link-open-caseload"
            className="text-xs font-bold text-primary hover:underline"
          >
            Open full caseload <ArrowRight className="ml-1 inline" size={14} />
          </Link>
        </div>
        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-muted/45 p-3 sm:flex-row">
          <label className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <input
              data-testid="input-caseload-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search child, school, grade, or style..."
              className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus-ring"
            />
          </label>
          <div className="flex rounded-xl border border-border bg-card p-1">
            {(["all", "review", "steady"] as const).map((value) => (
              <button
                key={value}
                data-testid={`button-caseload-filter-${value}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {value === "all"
                  ? "All"
                  : value === "review"
                    ? "Needs review"
                    : "No new signal"}
              </button>
            ))}
          </div>
        </div>
        {filteredChildren.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {filteredChildren.map((item) => {
              const needsReview =
                item.id === activeChild?.id &&
                Boolean(phrases.length || alerts.length);
              return (
                <article
                  key={item.id}
                  data-testid={`card-child-review-${item.id}`}
                  className={`rounded-xl border p-4 ${needsReview ? "border-accent/45 bg-accent/5" : "border-border bg-background/45"}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={item.name}
                      className="size-10 bg-secondary text-xs ring-card"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{item.name}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.school || "School not added"} ·{" "}
                            {item.grade || "Grade not added"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${needsReview ? "bg-accent/20 text-primary" : "bg-secondary text-primary"}`}
                        >
                          {needsReview ? "Review today" : "No new signal"}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                        <Link
                          href="/session"
                          onClick={() => onChangeChild(item.id)}
                          data-testid={`button-quick-session-${item.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-2 text-[11px] font-bold text-primary-foreground"
                        >
                          <Mic size={13} /> Session
                        </Link>
                        <button
                          onClick={() => {
                            onChangeChild(item.id);
                            onObserve();
                          }}
                          data-testid={`button-quick-observation-${item.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-2.5 py-2 text-[11px] font-bold text-primary"
                        >
                          <Plus size={13} /> Note
                        </button>
                        <Link
                          href="/children"
                          onClick={() => onChangeChild(item.id)}
                          data-testid={`button-quick-profile-${item.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-bold text-muted-foreground hover:bg-secondary"
                        >
                          <UserRound size={13} /> Profile
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="No children match this view"
            body="Try a different search or return to the full caseload."
          />
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section
          data-testid="section-team-activity-feed"
          className="rounded-2xl border border-border bg-card p-6 soft-shadow"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Team activity feed
              </p>
              <h2 className="serif mt-1 text-2xl font-semibold">
                Shared moments
              </h2>
            </div>
            <Link
              href="/activity"
              data-testid="link-view-activity"
              className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground focus-ring"
            >
              <ArrowRight size={16} />
            </Link>
          </div>
          {activity.length ? (
            <div className="space-y-4">
              {activity.slice(0, 4).map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Your team’s notes and updates will appear here as they share what
              they notice.
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-card p-6 soft-shadow">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Observations
              </p>
              <h2 className="serif mt-1 text-2xl font-semibold">
                Small moments
              </h2>
            </div>
            <Button
              variant="outline"
              className="px-3 py-2 text-xs"
              onClick={onObserve}
              data-testid="button-add-observation"
            >
              <Plus size={14} /> Note
            </Button>
          </div>
          {observations.length ? (
            <div className="space-y-4">
              {observations.slice(0, 2).map((item) => (
                <ObservationCard key={item.id} observation={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Lightbulb}
              title="Notice something?"
              body="Capture context so the next person can recognize it too."
              action={
                <Button
                  variant="outline"
                  onClick={onObserve}
                  data-testid="button-empty-observe"
                >
                  Add an observation
                </Button>
              }
            />
          )}
        </section>
      </div>

      <section
        data-testid="section-communication-trends"
        className="rounded-2xl border border-border bg-card p-6 soft-shadow md:p-7"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Communication trends across caseload
            </p>
            <h2 className="serif mt-1 text-2xl font-semibold">
              What is becoming familiar
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Frequency rankings reflect confirmed Child evidence for the
              selected child.
            </p>
          </div>
          <Link
            href="/dictionary"
            data-testid="link-view-all-gestalts"
            className="text-xs font-bold text-primary hover:underline"
          >
            Open shared dictionary{" "}
            <ArrowRight className="ml-1 inline" size={14} />
          </Link>
        </div>
        <FrequentScriptsPanel childId={activeChild?.id} />
      </section>
      <SuggestedFocusAreas
        insights={focusInsights}
        loading={focusInsightsLoading}
        canGenerate={canGenerateFocusAreas}
        generating={generatingFocusAreas}
        error={focusAreaError}
        onGenerate={onGenerateFocusAreas}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-card/80 p-4">
      <p className="mono text-2xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

type AacPlanningStatus =
  "candidate" | "review_later" | "added_to_device" | "not_appropriate";
const aacPlanningStatusLabels: Record<AacPlanningStatus, string> = {
  candidate: "AAC Candidate",
  review_later: "Review Later",
  added_to_device: "Added to Device",
  not_appropriate: "Not Appropriate for AAC",
};
function AacPlanningBadge({ status }: { status: AacPlanningStatus }) {
  const color =
    status === "added_to_device"
      ? "bg-primary text-primary-foreground"
      : status === "review_later"
        ? "bg-accent/20 text-primary"
        : status === "not_appropriate"
          ? "bg-muted text-muted-foreground"
          : "bg-secondary text-primary";
  return (
    <span
      data-testid={`badge-aac-${status}`}
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${color}`}
    >
      {aacPlanningStatusLabels[status]}
    </span>
  );
}
function PhraseRow({
  gestalt,
  onClick,
}: {
  gestalt: Gestalt;
  onClick?: () => void;
}) {
  return (
    <button
      data-testid={`card-phrase-${gestalt.id}`}
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-xl p-3 text-left transition hover:bg-muted focus-ring focus-ring"
    >
      <div className="mt-1 grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary transition group-hover:bg-accent">
        <Volume2 size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="serif text-lg font-semibold">“{gestalt.phrase}”</p>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(gestalt.dateAdded)}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
          {gestalt.meaning}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {gestalt.aacPlanningStatus && (
            <AacPlanningBadge status={gestalt.aacPlanningStatus} />
          )}
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
            {gestalt.function}
          </span>
          {gestalt.contexts?.slice(0, 2).map((context) => (
            <span
              key={context}
              className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground"
            >
              {context}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function ActivityRow({ item }: { item: ActivityType }) {
  return (
    <div className="flex gap-3">
      <Avatar name={item.author} className="size-8 bg-muted text-[10px]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5">
          <strong>{item.author}</strong>{" "}
          <span className="text-muted-foreground">{item.action}</span>{" "}
          <strong>{item.target}</strong>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.role} · {timeAgo(item.time)}
        </p>
      </div>
    </div>
  );
}
function ObservationCard({ observation }: { observation: Observation }) {
  return (
    <div className="border-l-2 border-accent pl-4">
      <p className="text-sm leading-6">{observation.body}</p>
      {observation.video && (
        <a
          href={`${basePath}${observation.video.url}`}
          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary underline underline-offset-4"
          data-testid={`link-observation-video-${observation.id}`}
        >
          <Video size={14} /> Watch private video ·{" "}
          {Math.max(1, Math.round(observation.video.sizeBytes / 1024 / 1024))}{" "}
          MB
        </a>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {observation.context} · {observation.author} ·{" "}
        {timeAgo(observation.createdAt)}
      </p>
    </div>
  );
}

function PhraseTrendChart({
  points,
}: {
  points: { date: string; occurrences: number }[];
}) {
  if (!points || points.length < 2)
    return (
      <div className="h-8 w-16 opacity-30 bg-muted rounded-md flex items-center justify-center text-[9px] text-muted-foreground">
        No trend
      </div>
    );
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Line
            type="monotone"
            dataKey="occurrences"
            stroke="hsl(var(--brand-gold-500))"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DictionaryPage({
  childId,
  gestalts,
  loading,
  onComment,
  onAddPhrase,
  canAddPhrase,
  canReviewSession,
}: {
  childId?: number;
  gestalts?: Gestalt[];
  loading: boolean;
  onComment: (gestalt: Gestalt) => void;
  onAddPhrase: () => void;
  canAddPhrase: boolean;
  canReviewSession: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All functions");
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [showDuplicateQueue, setShowDuplicateQueue] = useState(false);
  const [showRecoveryQueue, setShowRecoveryQueue] = useState(false);
  const [phraseToDelete, setPhraseToDelete] = useState<Gestalt | null>(null);
  const [recoveryItem, setRecoveryItem] =
    useState<LegacyPhraseObservation | null>(null);
  const [recoveryDraft, setRecoveryDraft] = useState({
    targetGestaltId: "",
    phrase: "",
    meaning: "",
    function: "",
    context: "",
    emotionalState: "Not documented",
    observedAt: "",
    confirmation: false,
  });
  const [mergeReview, setMergeReview] = useState<{
    suggestion: DictionaryDuplicateSuggestion;
    canonicalId: number;
  } | null>(null);
  const queryClient = useQueryClient();
  const duplicateParams = { childId: childId ?? 0 };
  const refreshDuplicateSuggestions = () =>
    queryClient.invalidateQueries({
      queryKey: getListDictionaryDuplicateSuggestionsQueryKey(duplicateParams),
    });
  const refreshAacPlanning = () => {
    queryClient.invalidateQueries({
      queryKey: getListGestaltsQueryKey({ childId: childId ?? 0 }),
    });
    queryClient.invalidateQueries({
      queryKey: getListAacPlanningQueryKey({ childId: childId ?? 0 }),
    });
  };
  const createAacPlanning = useCreateAacPlanning({
    mutation: { onSuccess: refreshAacPlanning },
  });
  const deleteGestalt = useDeleteGestalt({
    mutation: {
      onSuccess: () => {
        setPhraseToDelete(null);
        queryClient.invalidateQueries({
          queryKey: getListGestaltsQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDictionaryInsightsQueryKey({
            childId: childId ?? 0,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetPhraseTrendsQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDashboardQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getListAacPlanningQueryKey({ childId: childId ?? 0 }),
        });
      },
    },
  });
  const mergeGestalts = useMergeGestalts({
    mutation: {
      onSuccess: () => {
        setMergeSourceId("");
        setMergeTargetId("");
        queryClient.invalidateQueries({
          queryKey: getListGestaltsQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDictionaryInsightsQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetPhraseTrendsQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDashboardQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetFrequentScriptsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetRecurringLanguagePatternsQueryKey(),
        });
        refreshDuplicateSuggestions();
      },
    },
  });
  const duplicateSuggestionsQuery = useListDictionaryDuplicateSuggestions(
    duplicateParams,
    {
      query: {
        enabled: Boolean(childId && canReviewSession),
        queryKey:
          getListDictionaryDuplicateSuggestionsQueryKey(duplicateParams),
      },
    },
  );
  const recoveryQueueQuery = useListLegacyPhraseObservations(duplicateParams, {
    query: {
      enabled: Boolean(childId && canReviewSession),
      queryKey: getListLegacyPhraseObservationsQueryKey(duplicateParams),
    },
  });
  const recoverLegacyObservation = useRecoverLegacyPhraseObservation({
    mutation: {
      onSuccess: () => {
        setRecoveryItem(null);
        queryClient.invalidateQueries({
          queryKey: getListLegacyPhraseObservationsQueryKey(duplicateParams),
        });
        queryClient.invalidateQueries({
          queryKey: getListGestaltsQueryKey(duplicateParams),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDictionaryInsightsQueryKey(duplicateParams),
        });
        queryClient.invalidateQueries({
          queryKey: getGetPhraseTrendsQueryKey(duplicateParams),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDashboardQueryKey(duplicateParams),
        });
        queryClient.invalidateQueries({
          queryKey: getGetFrequentScriptsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetRecurringLanguagePatternsQueryKey(),
        });
      },
    },
  });
  const decideDuplicateSuggestion = useDecideDictionaryDuplicateSuggestion({
    mutation: {
      onSuccess: () => {
        setMergeReview(null);
        refreshDuplicateSuggestions();
        queryClient.invalidateQueries({
          queryKey: getListGestaltsQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDictionaryInsightsQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetPhraseTrendsQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDashboardQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getListAacPlanningQueryKey({ childId: childId ?? 0 }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetFrequentScriptsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetRecurringLanguagePatternsQueryKey(),
        });
      },
    },
  });

  const insightsQuery = useGetDictionaryInsights(
    { childId: childId ?? 0 },
    {
      query: {
        enabled: Boolean(childId),
        queryKey: getGetDictionaryInsightsQueryKey({ childId: childId ?? 0 }),
      },
    },
  );
  const trendsQuery = useGetPhraseTrends(
    { childId: childId ?? 0 },
    {
      query: {
        enabled: Boolean(childId),
        queryKey: getGetPhraseTrendsQueryKey({ childId: childId ?? 0 }),
      },
    },
  );

  const insights = insightsQuery.data?.entries ?? [];
  const trends = trendsQuery.data?.trends ?? [];

  const entries = insights.length
    ? insights
    : (gestalts ?? []).map((g) => ({
        gestalt: g,
        occurrences: 1,
        lastSeen: null,
        recentContexts: g.contexts || [],
        evidenceCount: 0,
      }));

  const filtered = useMemo(
    () =>
      entries.filter(
        (item) =>
          `${item.gestalt.phrase} ${item.gestalt.meaning} ${item.recentContexts.join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === "All functions" || item.gestalt.function === filter),
      ),
    [entries, search, filter],
  );

  const functions = Array.from(
    new Set(entries.map((item) => item.gestalt.function).filter(Boolean)),
  );
  const duplicateSuggestions =
    duplicateSuggestionsQuery.data?.suggestions ?? [];
  const recoveryItems = recoveryQueueQuery.data?.items ?? [];
  const beginRecovery = (item: LegacyPhraseObservation) => {
    setRecoveryItem(item);
    setRecoveryDraft({
      targetGestaltId: item.suggestedTargetGestaltId
        ? String(item.suggestedTargetGestaltId)
        : "",
      phrase: item.phrase,
      meaning: "",
      function: "",
      context: item.inferredContext,
      emotionalState: "Not documented",
      observedAt: new Date(item.suggestedObservedAt).toISOString().slice(0, 16),
      confirmation: false,
    });
  };
  const confirmRecovery = () => {
    if (!childId || !recoveryItem) return;
    recoverLegacyObservation.mutate({
      params: { childId, noteId: recoveryItem.noteId },
      data: {
        ...(recoveryDraft.targetGestaltId
          ? { targetGestaltId: Number(recoveryDraft.targetGestaltId) }
          : {}),
        phrase: recoveryDraft.phrase.trim(),
        meaning: recoveryDraft.meaning.trim(),
        function: recoveryDraft.function.trim(),
        context: recoveryDraft.context.trim(),
        emotionalState: recoveryDraft.emotionalState.trim(),
        observedAt: new Date(recoveryDraft.observedAt).toISOString(),
        confirmation: recoveryDraft.confirmation,
      },
    });
  };
  const decide = (
    suggestion: DictionaryDuplicateSuggestion,
    decision: "keep_separate" | "dismiss",
  ) => {
    if (!childId) return;
    decideDuplicateSuggestion.mutate({
      params: { childId },
      data: {
        firstGestaltId: suggestion.first.id,
        secondGestaltId: suggestion.second.id,
        decision,
      },
    });
  };
  const confirmSuggestionMerge = () => {
    if (!childId || !mergeReview) return;
    decideDuplicateSuggestion.mutate({
      params: { childId },
      data: {
        firstGestaltId: mergeReview.suggestion.first.id,
        secondGestaltId: mergeReview.suggestion.second.id,
        canonicalGestaltId: mergeReview.canonicalId,
        decision: "merge",
      },
    });
  };

  return (
    <>
      <div className="space-y-7 animate-rise">
        <SectionHeading
          eyebrow="Shared dictionary"
          title="Phrase Dictionary"
          description="A shared record of phrases, meanings, and everyday context. SLP-reviewed session evidence and family or classroom observations can grow the map together."
          action={
            <div className="flex flex-wrap gap-2">
              {canReviewSession && (
                <Button
                  variant="outline"
                  onClick={() => setShowRecoveryQueue((current) => !current)}
                  data-testid="button-open-observation-recovery"
                  aria-expanded={showRecoveryQueue}
                >
                  <RotateCcw size={17} />
                  <span>
                    {recoveryItems.length} Older Observation
                    {recoveryItems.length === 1 ? "" : "s"}
                  </span>
                </Button>
              )}
              {canReviewSession && (
                <Button
                  variant="outline"
                  onClick={() => setShowDuplicateQueue((current) => !current)}
                  data-testid="button-open-duplicate-suggestions"
                  aria-expanded={showDuplicateQueue}
                >
                  <GitMerge size={17} />
                  <span>
                    {duplicateSuggestions.length} Merge Suggestion
                    {duplicateSuggestions.length === 1 ? "" : "s"}
                  </span>
                </Button>
              )}
              {canAddPhrase && (
                <Button
                  variant="warm"
                  onClick={onAddPhrase}
                  data-testid="button-dictionary-add-phrase"
                >
                  <Plus size={17} /> Add a phrase
                </Button>
              )}
              {canReviewSession && (
                <Link
                  href="/session"
                  data-testid="button-dictionary-add"
                  className="inline-flex focus-ring items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-primary"
                >
                  <Mic size={17} /> Review session phrases
                </Link>
              )}
            </div>
          }
        />
        {canReviewSession && showRecoveryQueue && (
          <section
            className="rounded-3xl border border-primary/20 bg-secondary/25 p-5 soft-shadow md:p-6"
            data-testid="dictionary-observation-recovery-queue"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary/65">
                  Historical review
                </p>
                <h2 className="serif mt-1 text-2xl font-semibold">
                  Recover Older Shared Observations
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  These preserved care-team notes are not clinical evidence yet.
                  Review the original note and explicitly confirm a meaning,
                  communication function, context, and date before adding one
                  observation to the dictionary record.
                </p>
              </div>
              <Button
                variant="quiet"
                className="size-9 rounded-full p-0"
                onClick={() => {
                  setShowRecoveryQueue(false);
                  setRecoveryItem(null);
                }}
                aria-label="Close older observation review"
              >
                <X size={17} />
              </Button>
            </div>
            {recoveryQueueQuery.isLoading ? (
              <div className="mt-5">
                <LoadingBlocks />
              </div>
            ) : recoveryQueueQuery.isError ? (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
              >
                Older observations are temporarily unavailable. No evidence or
                dictionary records were changed.
              </p>
            ) : recoveryItems.length ? (
              <div className="mt-5 space-y-4">
                {recoveryItems.map((item) => (
                  <article
                    key={item.noteId}
                    className="rounded-2xl border border-border bg-card p-4 md:p-5"
                    data-testid={`legacy-observation-${item.noteId}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="serif text-xl font-semibold">
                          “{item.phrase}”
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Shared by {item.authorName} · {item.authorRole} ·{" "}
                          {new Date(item.sharedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => beginRecovery(item)}
                        data-testid={`button-review-legacy-observation-${item.noteId}`}
                      >
                        Review observation
                      </Button>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/45 p-3 text-sm leading-6 text-foreground/85">
                      {item.noteBody}
                    </p>
                    {recoveryItem?.noteId === item.noteId && (
                      <div
                        className="mt-4 space-y-4 border-t border-border pt-4"
                        role="group"
                        aria-label={`Review older observation for ${item.phrase}`}
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="text-sm font-semibold">
                            Reviewed phrase
                            <input
                              value={recoveryDraft.phrase}
                              onChange={(event) =>
                                setRecoveryDraft((draft) => ({
                                  ...draft,
                                  phrase: event.target.value,
                                }))
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 font-normal"
                            />
                          </label>
                          <label className="text-sm font-semibold">
                            Use an existing reviewed phrase
                            <select
                              value={recoveryDraft.targetGestaltId}
                              onChange={(event) =>
                                setRecoveryDraft((draft) => ({
                                  ...draft,
                                  targetGestaltId: event.target.value,
                                }))
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 font-normal"
                            >
                              <option value="">
                                Create a reviewed dictionary entry
                              </option>
                              {(gestalts ?? [])
                                .filter(
                                  (gestalt) =>
                                    !gestalt.source
                                      .toLowerCase()
                                      .includes("review pending") &&
                                    gestalt.meaning.toLowerCase() !==
                                      "meaning awaits clinician review.",
                                )
                                .map((gestalt) => (
                                  <option key={gestalt.id} value={gestalt.id}>
                                    {gestalt.phrase}
                                  </option>
                                ))}
                            </select>
                          </label>
                        </div>
                        <label className="block text-sm font-semibold">
                          Clinician-confirmed working meaning
                          <textarea
                            value={recoveryDraft.meaning}
                            onChange={(event) =>
                              setRecoveryDraft((draft) => ({
                                ...draft,
                                meaning: event.target.value,
                              }))
                            }
                            rows={2}
                            className="mt-1 w-full rounded-xl border border-input bg-background p-3 font-normal"
                          />
                        </label>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="text-sm font-semibold">
                            Communication function
                            <input
                              value={recoveryDraft.function}
                              onChange={(event) =>
                                setRecoveryDraft((draft) => ({
                                  ...draft,
                                  function: event.target.value,
                                }))
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 font-normal"
                            />
                          </label>
                          <label className="text-sm font-semibold">
                            Context
                            <input
                              value={recoveryDraft.context}
                              onChange={(event) =>
                                setRecoveryDraft((draft) => ({
                                  ...draft,
                                  context: event.target.value,
                                }))
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 font-normal"
                            />
                          </label>
                          <label className="text-sm font-semibold">
                            Emotional state
                            <input
                              value={recoveryDraft.emotionalState}
                              onChange={(event) =>
                                setRecoveryDraft((draft) => ({
                                  ...draft,
                                  emotionalState: event.target.value,
                                }))
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 font-normal"
                            />
                          </label>
                          <label className="text-sm font-semibold">
                            Observed at
                            <input
                              type="datetime-local"
                              value={recoveryDraft.observedAt}
                              onChange={(event) =>
                                setRecoveryDraft((draft) => ({
                                  ...draft,
                                  observedAt: event.target.value,
                                }))
                              }
                              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 font-normal"
                            />
                          </label>
                        </div>
                        <label className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm leading-6">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={recoveryDraft.confirmation}
                            onChange={(event) =>
                              setRecoveryDraft((draft) => ({
                                ...draft,
                                confirmation: event.target.checked,
                              }))
                            }
                          />
                          <span>
                            I reviewed the preserved note and confirm this
                            interpretation as clinician-owned evidence. ChildLed
                            did not infer the meaning or function.
                          </span>
                        </label>
                        {recoverLegacyObservation.isError && (
                          <p role="alert" className="text-sm text-destructive">
                            This observation could not be recovered. It may
                            already be accounted for or the selected phrase may
                            not safely match.
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={confirmRecovery}
                            disabled={
                              recoverLegacyObservation.isPending ||
                              !recoveryDraft.phrase.trim() ||
                              !recoveryDraft.meaning.trim() ||
                              !recoveryDraft.function.trim() ||
                              !recoveryDraft.context.trim() ||
                              !recoveryDraft.observedAt ||
                              !recoveryDraft.confirmation
                            }
                            data-testid={`button-confirm-legacy-observation-${item.noteId}`}
                          >
                            {recoverLegacyObservation.isPending
                              ? "Recovering…"
                              : "Confirm and recover"}
                          </Button>
                          <Button
                            variant="quiet"
                            onClick={() => setRecoveryItem(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/60 px-5 py-8 text-center">
                <Check className="mx-auto text-primary" size={24} />
                <p className="mt-2 font-semibold">
                  No older observations need recovery
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every preserved shared phrase note is either already typed
                  evidence or has a recorded clinician decision.
                </p>
              </div>
            )}
          </section>
        )}
        {canReviewSession && showDuplicateQueue && (
          <section
            className="rounded-3xl border border-accent/35 bg-accent/5 p-5 soft-shadow md:p-6"
            data-testid="dictionary-duplicate-review-queue"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary/65">
                  Dictionary review
                </p>
                <h2 className="serif mt-1 text-2xl font-semibold">
                  Potential Duplicate Phrases
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Review suggestions generated from clinician-confirmed
                  dictionary entries. ChildLed never merges entries without your
                  explicit confirmation.
                </p>
              </div>
              <Button
                variant="quiet"
                className="size-9 rounded-full p-0"
                onClick={() => {
                  setShowDuplicateQueue(false);
                  setMergeReview(null);
                }}
                aria-label="Close duplicate suggestions"
              >
                <X size={17} />
              </Button>
            </div>
            {duplicateSuggestionsQuery.isLoading ? (
              <div className="mt-5">
                <LoadingBlocks />
              </div>
            ) : duplicateSuggestionsQuery.isError ? (
              <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                Merge suggestions are temporarily unavailable. No dictionary
                entries were changed.
              </p>
            ) : duplicateSuggestions.length ? (
              <div className="mt-5 space-y-4">
                {duplicateSuggestions.map((suggestion) => {
                  const isMergeReview =
                    mergeReview?.suggestion.suggestionId ===
                    suggestion.suggestionId;
                  return (
                    <article
                      key={suggestion.suggestionId}
                      className="rounded-2xl border border-border bg-card p-4 md:p-5"
                      data-testid={`duplicate-suggestion-${suggestion.suggestionId}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                          {suggestion.reasonLabel}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(suggestion.similarityScore * 100)}% text
                          similarity
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {[suggestion.first, suggestion.second].map((phrase) => (
                          <div
                            key={phrase.id}
                            className="rounded-xl border border-border bg-background p-4"
                          >
                            <p className="serif text-lg font-semibold">
                              “{phrase.phrase}”
                            </p>
                            <p className="mt-2 text-sm text-foreground">
                              {phrase.meaning}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {phrase.function} · {phrase.occurrences}{" "}
                              occurrence
                              {phrase.occurrences === 1 ? "" : "s"}
                            </p>
                            {phrase.contexts.length > 0 && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Contexts: {phrase.contexts.join(", ")}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      {isMergeReview ? (
                        <div
                          className="mt-4 rounded-xl border border-primary/20 bg-secondary/45 p-4"
                          role="group"
                          aria-label="Choose the canonical phrase"
                        >
                          <p className="text-sm font-semibold">
                            Which phrase should remain in the dictionary?
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {[suggestion.first, suggestion.second].map(
                              (phrase) => (
                                <label
                                  key={phrase.id}
                                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm"
                                >
                                  <input
                                    type="radio"
                                    name={`canonical-${suggestion.suggestionId}`}
                                    checked={
                                      mergeReview.canonicalId === phrase.id
                                    }
                                    onChange={() =>
                                      setMergeReview({
                                        suggestion,
                                        canonicalId: phrase.id,
                                      })
                                    }
                                  />
                                  <span>Keep “{phrase.phrase}”</span>
                                </label>
                              ),
                            )}
                          </div>
                          <p className="mt-3 text-xs leading-5 text-muted-foreground">
                            All linked occurrences, session references, working
                            meanings, AAC planning links, reports, and audit
                            history will remain connected to the phrase you
                            keep.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              onClick={confirmSuggestionMerge}
                              disabled={decideDuplicateSuggestion.isPending}
                              data-testid={`button-confirm-duplicate-merge-${suggestion.suggestionId}`}
                            >
                              {decideDuplicateSuggestion.isPending
                                ? "Merging…"
                                : "Confirm merge"}
                            </Button>
                            <Button
                              variant="quiet"
                              onClick={() => setMergeReview(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            onClick={() =>
                              setMergeReview({
                                suggestion,
                                canonicalId: suggestion.first.id,
                              })
                            }
                            disabled={decideDuplicateSuggestion.isPending}
                            data-testid={`button-approve-duplicate-${suggestion.suggestionId}`}
                          >
                            <GitMerge size={15} /> Approve Merge
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => decide(suggestion, "keep_separate")}
                            disabled={decideDuplicateSuggestion.isPending}
                            data-testid={`button-keep-separate-${suggestion.suggestionId}`}
                          >
                            Keep Separate
                          </Button>
                          <Button
                            variant="quiet"
                            onClick={() => decide(suggestion, "dismiss")}
                            disabled={decideDuplicateSuggestion.isPending}
                            data-testid={`button-dismiss-duplicate-${suggestion.suggestionId}`}
                          >
                            Dismiss Suggestion
                          </Button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/60 px-5 py-8 text-center">
                <Check className="mx-auto text-primary" size={24} />
                <p className="mt-2 font-semibold">
                  No merge suggestions to review
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The current clinician-confirmed phrases remain separate.
                </p>
              </div>
            )}
            {decideDuplicateSuggestion.isError && (
              <p className="mt-4 text-sm text-destructive">
                That decision could not be saved. The dictionary was not
                changed; refresh the suggestions and try again.
              </p>
            )}
          </section>
        )}

        {canReviewSession && (
          <div
            className="rounded-2xl border border-accent/30 bg-accent/5 p-4"
            data-testid="dictionary-merge-tool"
          >
            <p className="text-sm font-semibold text-foreground">
              Merge duplicate dictionary entries
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Keep one clinician-reviewed phrase as canonical. Linked sessions,
              transcripts, notes, and counts will be retained.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select
                value={mergeSourceId}
                onChange={(event) => setMergeSourceId(event.target.value)}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                data-testid="select-duplicate-phrase"
              >
                <option value="">Duplicate to archive…</option>
                {(gestalts ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.phrase}
                  </option>
                ))}
              </select>
              <select
                value={mergeTargetId}
                onChange={(event) => setMergeTargetId(event.target.value)}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                data-testid="select-canonical-phrase"
              >
                <option value="">Canonical phrase to keep…</option>
                {(gestalts ?? [])
                  .filter((g) => String(g.id) !== mergeSourceId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.phrase}
                    </option>
                  ))}
              </select>
              <Button
                variant="outline"
                disabled={
                  !childId ||
                  !mergeSourceId ||
                  !mergeTargetId ||
                  mergeGestalts.isPending
                }
                onClick={() =>
                  mergeGestalts.mutate({
                    params: { childId: childId! },
                    data: {
                      sourceGestaltId: Number(mergeSourceId),
                      targetGestaltId: Number(mergeTargetId),
                    },
                  })
                }
                data-testid="button-merge-dictionary-entries"
              >
                {mergeGestalts.isPending ? "Merging…" : "Merge entries"}
              </Button>
            </div>
            {mergeGestalts.isError && (
              <p className="mt-2 text-xs text-destructive">
                The entries could not be merged. Confirm they are close matches
                and try again.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 soft-shadow sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={17}
            />
            <input
              data-testid="input-search-dictionary"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search a phrase, meaning, or context..."
              className="h-11 w-full rounded-xl bg-muted/60 pl-10 pr-4 text-sm outline-none transition-shadow ring-0 placeholder:text-muted-foreground focus-ring focus:bg-secondary/60"
            />
          </div>
          <div className="relative">
            <Filter
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={15}
            />
            <select
              data-testid="select-function-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl bg-muted/60 pl-9 pr-10 text-sm font-medium outline-none transition-shadow sm:w-48"
            >
              <option>All functions</option>
              {functions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        {loading || insightsQuery.isLoading ? (
          <LoadingBlocks />
        ) : filtered.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((item) => {
              const trend = trends.find((t) => t.gestaltId === item.gestalt.id);
              return (
                <div
                  key={item.gestalt.id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 soft-shadow transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <PhraseRow gestalt={item.gestalt} />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/50">
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium bg-secondary/50 px-2.5 py-1.5 rounded-lg border border-border/50">
                        <ActivityIcon size={12} className="text-primary" />
                        {item.occurrences} occurrence
                        {item.occurrences !== 1 ? "s" : ""}
                      </div>
                      {item.lastSeen && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium bg-secondary/50 px-2.5 py-1.5 rounded-lg border border-border/50">
                          <Clock3 size={12} className="text-primary" />
                          Seen {timeAgo(item.lastSeen)}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium bg-secondary/50 px-2.5 py-1.5 rounded-lg border border-border/50">
                        <Check size={12} className="text-primary" />
                        {item.evidenceCount} session
                        {item.evidenceCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                    {trend && <PhraseTrendChart points={trend.points} />}
                  </div>

                  {item.gestalt.audioUrl && (
                    <div className="mt-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Session recording
                      </p>
                      <audio
                        controls
                        preload="metadata"
                        className="h-9 w-full rounded-md"
                        src={item.gestalt.audioUrl}
                      />
                    </div>
                  )}

                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                    <span>Added by {item.gestalt.createdBy}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {canReviewSession &&
                        (item.gestalt.aacPlanningStatus ? (
                          <Link
                            href={`/aac-planning?childId=${childId}`}
                            data-testid={`link-aac-planning-${item.gestalt.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/15 px-2.5 py-1.5 font-semibold text-primary"
                          >
                            <ClipboardList size={13} /> Open AAC Planning
                          </Link>
                        ) : (
                          <button
                            data-testid={`button-add-aac-planning-${item.gestalt.id}`}
                            disabled={createAacPlanning.isPending}
                            onClick={() =>
                              childId &&
                              createAacPlanning.mutate({
                                data: { childId, gestaltId: item.gestalt.id },
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/15 px-2.5 py-1.5 font-semibold text-primary disabled:opacity-50"
                          >
                            <Plus size={13} /> Add to AAC Planning
                          </button>
                        ))}
                      <button
                        data-testid={`button-comment-phrase-${item.gestalt.id}`}
                        onClick={() => onComment(item.gestalt)}
                        className="inline-flex focus-ring items-center gap-1.5 font-semibold text-primary transition-colors hover:text-accent"
                      >
                        <MessageCircle size={14} />{" "}
                        {item.gestalt.comments?.length ?? 0} notes
                      </button>
                      {canReviewSession && (
                        <button
                          type="button"
                          data-testid={`button-delete-phrase-${item.gestalt.id}`}
                          onClick={() => setPhraseToDelete(item.gestalt)}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-ring"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title={
              search ? "No echoes found" : "Your shared dictionary is open"
            }
            body={
              search
                ? "Try another phrase, meaning, or context."
                : "Add a phrase from home or school, or begin a reviewed session so your team can build the map together."
            }
            action={
              !search && (
                <div className="flex flex-wrap justify-center gap-2">
                  {canAddPhrase && (
                    <Button
                      variant="warm"
                      onClick={onAddPhrase}
                      data-testid="button-dictionary-empty-add-phrase"
                    >
                      <Plus size={16} /> Add a phrase
                    </Button>
                  )}
                  {canReviewSession && (
                    <Link
                      href="/session"
                      data-testid="button-dictionary-empty-add"
                      className="inline-flex focus-ring items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-primary"
                    >
                      <Mic size={16} /> Review session phrases
                    </Link>
                  )}
                </div>
              )
            }
          />
        )}
      </div>
      {phraseToDelete && (
        <Modal
          title="Delete this phrase?"
          onClose={() => {
            if (!deleteGestalt.isPending) setPhraseToDelete(null);
          }}
        >
          <p className="text-sm leading-6 text-muted-foreground">
            “{phraseToDelete.phrase}” will be removed from the active phrase
            dictionary. Past session notes and historical evidence will remain
            unchanged.
          </p>
          {deleteGestalt.isError && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
            >
              The phrase could not be deleted. Nothing was changed; please try
              again.
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              disabled={deleteGestalt.isPending}
              onClick={() => setPhraseToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              data-autofocus
              variant="quiet"
              className="min-h-11 text-destructive hover:bg-destructive/10"
              disabled={deleteGestalt.isPending}
              onClick={() =>
                deleteGestalt.mutate({ gestaltId: phraseToDelete.id })
              }
              data-testid="button-confirm-delete-phrase"
            >
              <Trash2 size={16} />
              {deleteGestalt.isPending ? "Deleting…" : "Delete phrase"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function AacPlanningPage({
  childId,
  child,
}: {
  childId: number;
  child?: Child;
}) {
  const queryClient = useQueryClient();
  const params = { childId };
  const planning = useListAacPlanning(params, {
    query: {
      queryKey: getListAacPlanningQueryKey(params),
      enabled: Boolean(childId),
    },
  });
  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: getListAacPlanningQueryKey(params),
    });
    queryClient.invalidateQueries({
      queryKey: getListGestaltsQueryKey(params),
    });
  };
  const update = useUpdateAacPlanning({ mutation: { onSuccess: refresh } });
  const remove = useRemoveAacPlanning({ mutation: { onSuccess: refresh } });
  const entries = planning.data?.entries ?? [];
  const statusCounts = entries.reduce(
    (counts, entry) => ({
      ...counts,
      [entry.status]: (counts[entry.status] ?? 0) + 1,
    }),
    {} as Partial<Record<AacPlanningStatus, number>>,
  );
  const statuses: AacPlanningStatus[] = [
    "candidate",
    "review_later",
    "added_to_device",
    "not_appropriate",
  ];
  return (
    <div className="space-y-7 animate-rise">
      <SectionHeading
        eyebrow="Child-scoped planning"
        title="AAC Planning"
        description={`Connect ${child?.name ?? "this child"}’s reviewed communication dictionary to future AAC vocabulary decisions. ChildLed records planning decisions only—it never programs a device or adds phrases automatically.`}
        action={
          <Link href={`/dictionary?childId=${childId}`}>
            <Button variant="outline">
              <BookOpen size={16} /> Open dictionary
            </Button>
          </Link>
        }
      />
      {child?.aacSnapshot && <AacSnapshot snapshot={child.aacSnapshot} />}
      <section className="rounded-3xl border border-primary/15 bg-primary p-6 text-primary-foreground soft-shadow md:p-8">
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-accent">
              Planning, not automation
            </p>
            <h2 className="serif mt-3 text-3xl font-semibold">
              Keep every decision connected to the original phrase.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/70">
              Changing an AAC status never changes phrase frequency, evidence,
              meaning, communication function, or clinical interpretation. “Not
              Appropriate for AAC” documents an intentional exclusion without
              removing the phrase from the dictionary.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {statuses.map((status) => (
              <div
                key={status}
                className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 px-3 py-2"
              >
                <p className="text-[10px] text-primary-foreground/60">
                  {aacPlanningStatusLabels[status]}
                </p>
                <p className="serif text-2xl">{statusCounts[status] ?? 0}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {planning.isLoading ? (
        <LoadingBlocks />
      ) : entries.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {entries.map((entry: AacPlanningEntry) => (
            <article
              key={entry.id}
              data-testid={`card-aac-planning-${entry.id}`}
              className="rounded-2xl border border-border bg-card p-5 soft-shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <AacPlanningBadge status={entry.status} />
                  <h2 className="serif mt-3 text-2xl font-semibold">
                    “{entry.phrase}”
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {entry.meaning}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold text-primary">
                  {entry.communicationFunction}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 border-y border-border py-4 text-xs">
                <div>
                  <p className="font-bold text-foreground">
                    {entry.occurrenceCount}
                  </p>
                  <p className="mt-1 text-muted-foreground">Occurrences</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    {entry.firstObservedAt
                      ? formatDate(entry.firstObservedAt)
                      : "—"}
                  </p>
                  <p className="mt-1 text-muted-foreground">First observed</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    {entry.lastObservedAt
                      ? formatDate(entry.lastObservedAt)
                      : "—"}
                  </p>
                  <p className="mt-1 text-muted-foreground">Most recent</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {entry.contexts.map((context) => (
                  <span
                    key={context}
                    className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground"
                  >
                    {context}
                  </span>
                ))}
              </div>
              <div className="mt-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Decision
                </p>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      data-testid={`button-aac-status-${entry.id}-${status}`}
                      disabled={update.isPending || entry.status === status}
                      onClick={() =>
                        update.mutate({
                          planningId: entry.id,
                          data: { status },
                        })
                      }
                      className={`rounded-lg border px-2.5 py-2 text-[11px] font-bold ${entry.status === status ? "border-primary bg-primary text-primary-foreground" : "border-border text-primary hover:bg-secondary"} disabled:opacity-70`}
                    >
                      {aacPlanningStatusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <p className="text-[11px] text-muted-foreground">
                  Dictionary entry added {formatDate(entry.dateAdded)}
                </p>
                <button
                  data-testid={`button-remove-aac-planning-${entry.id}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ planningId: entry.id })}
                  className="text-xs font-semibold text-destructive hover:underline"
                >
                  Remove from planning
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No phrases are in AAC Planning yet"
          body="Open the communication dictionary and add a phrase when the care team is ready to consider it for future AAC vocabulary."
          action={
            <Link href={`/dictionary?childId=${childId}`}>
              <Button>
                <Plus size={16} /> Choose a dictionary phrase
              </Button>
            </Link>
          }
        />
      )}
    </div>
  );
}

const deletionOptions: { value: DeletionCategory; label: string }[] = [
  { value: "profile", label: "Child profile" },
  { value: "observations", label: "Observations, session notes & videos" },
  { value: "transcripts", label: "Transcripts" },
  { value: "recordings", label: "Recordings" },
  { value: "consent_records", label: "Consent records (retained)" },
];
const deletionStatus = (status: DeletionRequest["status"]) =>
  status === "pending"
    ? "Awaiting staff review"
    : status === "processing"
      ? "Approved · processing"
      : status === "approved"
        ? "Approved & processed"
        : "Rejected";

function RequestAuditTimeline({ requestId }: { requestId: number }) {
  const [open, setOpen] = useState(false);
  const detail = useGetDeletionRequest(requestId, {
    query: {
      enabled: open,
      queryKey: getGetDeletionRequestQueryKey(requestId),
    },
  });
  return (
    <div className="mt-4 border-t border-border pt-4">
      <Button
        variant="quiet"
        className="px-0 text-xs"
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide immutable audit history" : "View immutable audit history"}
      </Button>
      {open && (
        <div className="mt-3 space-y-3 rounded-xl bg-secondary/45 p-4">
          {detail.isLoading ? (
            <p className="text-xs text-muted-foreground">
              Loading retained audit history…
            </p>
          ) : (
            detail.data?.audit.map((event) => (
              <div
                key={event.id}
                className="border-l-2 border-accent pl-3 text-xs"
              >
                <p className="font-semibold">
                  {event.action.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {event.actorName} ·{" "}
                  {new Date(event.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-muted-foreground">{event.note}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
function DeletionRequestCard({
  request,
  staff,
  onReview,
}: {
  request: DeletionRequest;
  staff: boolean;
  onReview?: (request: DeletionRequest, decision: "approve" | "reject") => void;
}) {
  return (
    <article
      data-testid={`card-deletion-request-${request.id}`}
      className="rounded-xl border border-border bg-muted/35 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {deletionStatus(request.status)} · Child profile #{request.childId}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Requested by {request.requesterName} ·{" "}
            {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold text-primary">
          {request.status}
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Requested categories:{" "}
        {request.categories
          .map(
            (category) =>
              deletionOptions.find((item) => item.value === category)?.label ??
              category,
          )
          .join(", ")}
        .
      </p>
      {request.reason && (
        <p className="mt-2 text-sm text-muted-foreground">{request.reason}</p>
      )}
      {request.status === "pending" && staff && onReview && (
        <div className="mt-4 flex gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            className="px-3 py-2 text-xs"
            onClick={() => onReview(request, "reject")}
            data-testid={`button-reject-deletion-${request.id}`}
          >
            Reject
          </Button>
          <Button
            className="px-3 py-2 text-xs"
            onClick={() => onReview(request, "approve")}
            data-testid={`button-approve-deletion-${request.id}`}
          >
            Approve & process
          </Button>
        </div>
      )}
      {request.status !== "pending" && (
        <div className="mt-4 text-xs leading-5 text-muted-foreground">
          <p>
            {request.reviewNote || "No additional review note was provided."}
          </p>
          {request.processedCategories.length > 0 && (
            <p>
              Processed:{" "}
              {request.processedCategories.join(", ").replaceAll("_", " ")}.
            </p>
          )}
          {request.retainedCategories.length > 0 && (
            <p>
              Retained under policy:{" "}
              {request.retainedCategories.join(", ").replaceAll("_", " ")}.
            </p>
          )}
          <p>{request.retentionNote}</p>
        </div>
      )}
      <RequestAuditTimeline requestId={request.id} />
    </article>
  );
}
function ChildDataDeletionPanel({
  childId,
  childName,
}: {
  childId: number;
  childName: string;
}) {
  const client = useQueryClient();
  const requests = useListDeletionRequests({ childId });
  const create = useCreateDeletionRequest();
  const review = useReviewDeletionRequest();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<DeletionCategory[]>([]);
  const [reason, setReason] = useState("");
  const [viewer, setViewer] = useState<{
    role?: string;
    isAdmin?: boolean;
    isDevelopmentDemo?: boolean;
  }>();
  const [message, setMessage] = useState("");
  useEffect(() => {
    fetch("/api/auth/viewer", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((nextViewer) => setViewer(nextViewer ?? undefined));
  }, []);
  const refresh = () =>
    client.invalidateQueries({
      queryKey: getListDeletionRequestsQueryKey({ childId }),
    });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        params: { childId },
        data: { categories, reason: reason || undefined },
      },
      {
        onSuccess: () => {
          setMessage("Your request was recorded and is awaiting staff review.");
          setOpen(false);
          setCategories([]);
          setReason("");
          refresh();
        },
        onError: () =>
          setMessage("We couldn’t submit this request. Please try again."),
      },
    );
  };
  const decide = (request: DeletionRequest, decision: "approve" | "reject") => {
    if (
      !window.confirm(
        `Are you sure you want to ${decision} this request for ${childName}?`,
      )
    )
      return;
    review.mutate(
      {
        requestId: request.id,
        data: {
          decision,
          note:
            decision === "approve"
              ? "Approved by staff and processed under the organization retention policy."
              : "Rejected by staff after review.",
        },
      },
      {
        onSuccess: () => {
          setMessage("The staff decision and its audit record were saved.");
          refresh();
        },
        onError: () =>
          setMessage(
            "We couldn’t record the staff decision. Please try again.",
          ),
      },
    );
  };
  return (
    <section
      data-testid="section-data-deletion"
      className="rounded-2xl border border-border bg-card p-6 md:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
            Privacy controls
          </p>
          <h2 className="serif mt-2 text-2xl font-semibold">
            Request child data deletion
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose records connected to {childName}. Consent confirmations and
            deletion-request audit events remain as immutable accountability
            records.
          </p>
          <Link
            href="/privacy-requests"
            className="mt-3 inline-block text-sm font-semibold text-primary underline"
          >
            View retained privacy request history
          </Link>
        </div>
        <Button
          variant="outline"
          onClick={() => setOpen(!open)}
          data-testid="button-open-deletion-request"
        >
          {open ? "Close request form" : "Request deletion"}
        </Button>
      </div>
      {open && (
        <form
          onSubmit={submit}
          className="mt-6 rounded-2xl border border-primary/15 bg-secondary/35 p-5"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {deletionOptions.map((option) => (
              <label
                key={option.value}
                className="flex gap-3 rounded-xl border border-border bg-card p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={categories.includes(option.value)}
                  onChange={() =>
                    setCategories((current) =>
                      current.includes(option.value)
                        ? current.filter((item) => item !== option.value)
                        : [...current, option.value],
                    )
                  }
                  data-testid={`checkbox-delete-${option.value.replaceAll("_", "-")}`}
                />
                {option.label}
              </label>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            data-testid="textarea-deletion-request-reason"
            className="mt-4 min-h-24 w-full rounded-xl border border-input bg-card p-3 text-sm"
            placeholder="Context for staff (optional)"
          />
          <div className="mt-4 flex justify-end">
            <Button
              disabled={!categories.length || create.isPending}
              data-testid="button-submit-deletion-request"
            >
              {create.isPending ? "Submitting…" : "Submit request for review"}
            </Button>
          </div>
        </form>
      )}
      {message && (
        <p className="mt-5 rounded-xl bg-secondary p-3 text-sm text-primary">
          {message}
        </p>
      )}
      <div className="mt-6 space-y-3 border-t border-border pt-5">
        {requests.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading requests…</p>
        ) : (
          (requests.data ?? []).map((request) => (
            <DeletionRequestCard
              key={request.id}
              request={request}
              staff={
                viewer?.role === "SLP" ||
                Boolean(viewer?.isAdmin && viewer?.isDevelopmentDemo)
              }
              onReview={decide}
            />
          ))
        )}
      </div>
    </section>
  );
}
function PrivacyRequestHistoryPage() {
  const requests = useListDeletionRequests();
  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Privacy controls"
        title="Retained privacy request history"
        description="Review child-scoped deletion requests and the immutable accountability record for each decision."
        action={
          <Link href="/children">
            <Button variant="outline">Child profile</Button>
          </Link>
        }
      />
      <section className="rounded-2xl border border-border bg-card p-6">
        {requests.isLoading ? (
          <LoadingBlocks />
        ) : (
          <div className="space-y-4">
            {(requests.data ?? []).map((request) => (
              <DeletionRequestCard
                key={request.id}
                request={request}
                staff={false}
              />
            ))}
            {!(requests.data ?? []).length && (
              <p className="text-sm text-muted-foreground">
                No deletion requests are available for your signed-in account.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ChildPage({
  child,
  latestSessionDate,
  loading,
  onAddChild,
}: {
  child?: Child;
  latestSessionDate?: string | null;
  loading: boolean;
  onAddChild: () => void;
}) {
  if (loading) return <LoadingBlocks />;
  if (!child)
    return (
      <EmptyState
        icon={UserRound}
        title="No child profile yet"
        body="Create a profile to give your team a shared starting point."
        action={
          <Button onClick={onAddChild} data-testid="button-profile-add-child">
            <Plus size={16} /> Add child
          </Button>
        }
      />
    );
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Communication Snapshot"
        title={`${child.name}'s map`}
        description="A quick view of what helps communication feel safe, meaningful, and possible."
      />
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-3xl bg-primary p-7 text-primary-foreground md:p-9">
          <div className="flex items-start justify-between">
            <Avatar
              name={child.name}
              className="size-16 bg-accent text-lg text-primary ring-primary"
            />
            <span className="rounded-full border border-primary-foreground/20 px-3 py-1 text-xs text-primary-foreground/70">
              {child.communicationStyle}
            </span>
          </div>
          <h2 className="serif mt-8 text-4xl">{child.name}</h2>
          <p className="mt-2 text-sm text-primary-foreground/65">
            {child.school || "School not added"} ·{" "}
            {child.grade || "Grade not added"}
            {child.dateOfBirth ? ` · DOB ${formatDate(child.dateOfBirth)}` : ""}
            {child.pronouns ? ` · ${child.pronouns}` : ""}
            {latestSessionDate
              ? ` · Latest session: ${formatDate(latestSessionDate)}`
              : ""}
          </p>
          <div className="mt-8 border-t border-primary-foreground/15 pt-6">
            <p className="mono text-[10px] uppercase tracking-[.18em] text-accent">
              GLP notes
            </p>
            <p className="mt-3 text-sm leading-6 text-primary-foreground/85">
              {child.glpNotes || "No notes added yet."}
            </p>
          </div>
        </section>
        <section className="rounded-3xl border border-border bg-card p-7 md:p-9">
          <div className="mb-7 flex items-center justify-between">
            <div>
              <p className="mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">
                The people around {child.name}
              </p>
              <h2 className="serif mt-1 text-2xl font-semibold">
                Team constellation
              </h2>
            </div>
            <Users className="text-muted-foreground" size={21} />
          </div>
          {child.team?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {child.team.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-xl bg-muted/60 p-3"
                >
                  <Avatar name={member.name} className="bg-card ring-muted" />
                  <div>
                    <p className="text-sm font-semibold">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Invite the people who make up {child.name}’s everyday world.
            </p>
          )}
          <div className="mt-8 grid gap-3 border-t border-border pt-6 sm:grid-cols-3">
            <Stat label="Phrases mapped" value={child.gestaltCount} />
            <Stat label="Team members" value={child.team?.length ?? 0} />
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="mono text-2xl font-bold text-primary">
                {child.age || "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Years old</p>
            </div>
          </div>
        </section>
      </div>
      <AacInformationCard childId={child.id} />
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
              Shareable support guide
            </p>
            <h2 className="serif mt-1 text-2xl font-semibold">
              Communication Passport
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Open the concise guide approved communication partners can use to
              understand how to communicate with{" "}
              {child.preferredName || child.name}.
            </p>
          </div>
          <Link href={`/communication-passport?childId=${child.id}`}>
            <Button variant="outline" className="min-h-11 w-full sm:w-auto">
              <BookOpen size={16} /> Open passport
            </Button>
          </Link>
        </div>
      </section>
      <SharedChildProfile childId={child.id} />
    </div>
  );
}

function ActivityPage({
  dashboard,
  loading,
  onObserve,
}: {
  dashboard?: Dashboard;
  loading: boolean;
  onObserve: () => void;
}) {
  if (loading) return <LoadingBlocks />;
  const activities = dashboard?.activity ?? [];
  const observations = dashboard?.observations ?? [];
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Across the circle"
        title="Team activity"
        description="A shared timeline of the moments, phrases, and context that keep everyone in step."
        action={
          <Button
            variant="warm"
            onClick={onObserve}
            data-testid="button-activity-observe"
          >
            <Plus size={16} /> Add observation
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
              <ActivityIcon size={19} />
            </div>
            <div>
              <h2 className="serif text-2xl font-semibold">The latest</h2>
              <p className="text-xs text-muted-foreground">
                Recent changes from your team
              </p>
            </div>
          </div>
          {activities.length ? (
            <div className="space-y-6">
              {activities.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ActivityIcon}
              title="The timeline starts here"
              body="Add a phrase or observation and your team’s shared rhythm will appear."
            />
          )}
        </section>
        <section className="rounded-2xl border border-border bg-secondary/50 p-6 md:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-card text-primary">
              <Lightbulb size={19} />
            </div>
            <div>
              <h2 className="serif text-2xl font-semibold">Field notes</h2>
              <p className="text-xs text-muted-foreground">
                Context makes meaning portable
              </p>
            </div>
          </div>
          {observations.length ? (
            <div className="space-y-6">
              {observations.map((item) => (
                <ObservationCard key={item.id} observation={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="No observations yet"
              body="A tiny detail from home, school, or therapy can make a big difference."
              action={
                <Button
                  variant="outline"
                  onClick={onObserve}
                  data-testid="button-activity-empty-observe"
                >
                  Write a note
                </Button>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}

function ClinicalDisclaimer() {
  return (
    <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground print:block print:border-none print:bg-transparent print:p-0">
      ChildLed provides communication tracking and organizational support.
      Clinical interpretation and decision-making remain the responsibility of
      the licensed professional.
    </div>
  );
}

function AIDisclaimer() {
  return (
    <div className="rounded-xl border border-primary/20 bg-secondary/50 p-4 text-sm leading-6 text-foreground">
      <strong className="block mb-1 text-primary">AI feature safeguard</strong>
      AI-generated suggestions are provided for informational purposes only and
      must be reviewed by a qualified professional.
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-8">
      <section
        data-testid="settings-about-mission"
        className="rounded-3xl border border-primary/15 bg-secondary/45 p-6 md:p-7"
      >
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary">
            <Leaf size={21} />
          </div>
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">
              About ChildLed
            </p>
            <h2 className="serif mt-2 text-2xl font-semibold text-primary">
              A shared language across the care team
            </h2>
            <p
              data-testid="settings-about-tagline"
              className="mt-3 max-w-3xl text-lg font-semibold leading-7 text-primary"
            >
              {CHILDLED_TAGLINE}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              ChildLed connects families, educators, and clinicians around the
              communication each child is building, so helpful context can
              travel with care from home to school to therapy.
            </p>
          </div>
        </div>
      </section>
      <SettingsPageContent />
    </div>
  );
}

function SettingsPageContent() {
  const [saved, setSaved] = useState(false);
  const [insights, setInsights] = useState(false);
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Your workspace"
        title="Settings"
        description="Keep the people, preferences, and future ideas behind your shared map in one place."
        action={
          saved ? (
            <span className="inline-flex focus-ring  items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-primary">
              <Check size={16} /> Saved
            </span>
          ) : (
            <Button
              onClick={() => setSaved(true)}
              data-testid="button-save-settings"
            >
              Save changes
            </Button>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-2xl border border-border bg-primary p-7 text-primary-foreground">
          <Avatar
            name="Maya Chen"
            className="size-16 bg-accent text-lg text-primary ring-primary"
          />
          <h2 className="serif mt-6 text-3xl">Maya Chen</h2>
          <p className="mt-1 text-sm text-primary-foreground/60">
            Care team lead
          </p>
          <div className="mt-8 border-t border-primary-foreground/15 pt-6">
            <p className="mono text-[10px] uppercase tracking-[.18em] text-accent">
              Your role
            </p>
            <select
              data-testid="select-profile-role"
              className="mt-3 w-full rounded-xl border border-primary-foreground/15 bg-primary/40 px-3 py-3 text-sm text-primary-foreground outline-none transition-shadow focus-ring"
            >
              <option>Care team lead</option>
              <option>Parent / caregiver</option>
              <option>Teacher</option>
              <option>Speech-language pathologist</option>
            </select>
          </div>
        </section>
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="serif text-xl font-semibold">
                  Team notifications
                </h3>
                <p className="text-xs text-muted-foreground">
                  Know when a new clue is added
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <label className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <span className="text-sm">New phrase or comment</span>
                <input
                  data-testid="checkbox-notifications-phrases"
                  type="checkbox"
                  defaultChecked
                  className="size-4 accent-primary"
                />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-sm">Weekly map reflection</span>
                <input
                  data-testid="checkbox-notifications-weekly"
                  type="checkbox"
                  defaultChecked
                  className="size-4 accent-primary"
                />
              </label>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="serif text-xl font-semibold">
                    Future insights
                  </h3>
                  <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                    When your map has enough context, ChildLed can gently
                    surface patterns across settings. You’re always in control.
                  </p>
                </div>
              </div>
              <button
                data-testid="button-toggle-insights"
                aria-pressed={insights}
                onClick={() => setInsights(!insights)}
                className={`relative h-6 w-11 rounded-full transition ${insights ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-card transition-transform ${insights ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          </div>
        </section>
      </div>
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
            <Users size={18} />
          </div>
          <div>
            <h3 className="serif text-2xl font-semibold">Team access</h3>
            <p className="text-xs text-muted-foreground">
              The people helping make meaning portable
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto hidden sm:inline-flex"
            onClick={() => setSaved(true)}
            data-testid="button-invite-team"
          >
            <Plus size={15} /> Invite
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold">
            Maya Chen · Care team lead
          </span>
          <span className="rounded-full bg-muted px-4 py-2 text-xs">
            Invite a teacher or therapist
          </span>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="serif text-2xl font-semibold">
              Privacy and data use
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review the data-use placeholders, consent expectations, and rights
              information for your organization.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/privacy"
                data-testid="link-settings-privacy-policy"
                className="text-sm font-semibold text-primary underline underline-offset-4"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                data-testid="link-settings-terms-of-use"
                className="text-sm font-semibold text-primary underline underline-offset-4"
              >
                Terms of Use
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function LegalPage({
  title,
  eyebrow,
  sections,
}: {
  title: string;
  eyebrow: string;
  sections: { title: string; body: string }[];
}) {
  return (
    <main className="paper-grain min-h-[100dvh] bg-background px-5 py-8 md:px-10 md:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex focus-ring  items-center gap-2 text-sm font-semibold text-primary"
          >
            <Leaf size={18} /> ChildLed
          </Link>
          <div className="flex gap-4 text-sm">
            <Link
              href="/privacy"
              className="font-semibold text-primary underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="font-semibold text-primary underline underline-offset-4"
            >
              Terms of Use
            </Link>
          </div>
        </div>
        <header className="mt-12 rounded-3xl bg-primary p-7 text-primary-foreground md:p-10">
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-accent">
            {eyebrow}
          </p>
          <h1 className="serif mt-3 text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-primary-foreground/75">
            These placeholders make the intended protections visible while your
            organization completes its legal and operational review.
          </p>
        </header>
        <aside
          role="note"
          className="mt-6 rounded-2xl border border-accent/40 bg-secondary/55 p-5 text-sm leading-6 text-foreground"
        >
          {LEGAL_REVIEW_NOTICE}
        </aside>
        <div className="mt-8 space-y-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <h2 className="serif text-2xl font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
        </div>
        <div className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link
            href="/"
            className="font-semibold text-primary underline underline-offset-4"
          >
            Return to ChildLed
          </Link>
        </div>
      </div>
    </main>
  );
}

function AdminSecurityPage() {
  const { data, isLoading, error } = useGetAdminSecurityOverview();
  const updateRetention = useUpdateRetentionSettings();
  const queryClient = useQueryClient();
  const { data: viewer } = useGetViewer({
    query: { queryKey: getGetViewerQueryKey(), staleTime: Infinity },
  });

  const [retentionState, setRetentionState] = useState({
    audioRetentionDays: 0,
    observationVideoRetentionDays: 0,
    sessionNoteRetentionDays: 0,
    archivedClientStorageDays: 0,
  });

  useEffect(() => {
    if (data?.retentionSettings) {
      setRetentionState({
        audioRetentionDays: data.retentionSettings.audioRetentionDays,
        observationVideoRetentionDays:
          data.retentionSettings.observationVideoRetentionDays,
        sessionNoteRetentionDays:
          data.retentionSettings.sessionNoteRetentionDays,
        archivedClientStorageDays:
          data.retentionSettings.archivedClientStorageDays,
      });
    }
  }, [data?.retentionSettings]);

  if (isLoading) return <LoadingBlocks />;

  if (error || !data) {
    return (
      <EmptyState
        icon={Shield}
        title="Restricted access"
        body="This space is reserved for workspace administrators to review security and governance settings."
      />
    );
  }

  const handleSaveRetention = () => {
    updateRetention.mutate(
      { data: retentionState },
      {
        onSuccess: (newData) => {
          queryClient.setQueryData(
            getGetAdminSecurityOverviewQueryKey(),
            (old: any) => (old ? { ...old, retentionSettings: newData } : old),
          );
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Workspace Governance"
        title="Security & Compliance"
        description="Monitor access, review audit events, and manage data retention policies for your organization."
      />

      <AIDisclaimer />

      <div className="grid gap-5 md:grid-cols-3">
        <Stat label="Active team members" value={data.activeUsers} />
        <Stat label="Consent records" value={data.consentRecordCount} />
        <Stat label="Failed login attempts" value={data.failedLoginAttempts} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-secondary/45 p-6">
          <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
            Encryption boundary
          </p>
          <h2 className="serif mt-2 text-xl font-semibold">
            {data.encryption.algorithm}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            At-rest protection uses {data.encryption.keySource}.{" "}
            {data.encryption.productionReady
              ? "Production key requirements are met."
              : "A dedicated production encryption key is required before deployment."}
          </p>
        </section>
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
            Recent logins
          </p>
          <div className="mt-4 space-y-3">
            {data.recentLogins.length ? (
              data.recentLogins.slice(0, 3).map((event) => (
                <div key={event.id}>
                  <p className="text-sm font-semibold">{event.actorName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No login events recorded yet.
              </p>
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
            Recent consent records
          </p>
          <div className="mt-4 space-y-3">
            {data.recentConsentRecords.length ? (
              data.recentConsentRecords.slice(0, 3).map((record) => (
                <div key={`${record.childId}-${record.confirmedAt}`}>
                  <p className="text-sm font-semibold">{record.confirmedBy}</p>
                  <p className="text-xs text-muted-foreground">
                    Child profile #{record.childId} ·{" "}
                    {new Date(record.confirmedAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No consent records available.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 md:p-8 soft-shadow">
        <h2 className="serif text-2xl font-semibold mb-6">
          Data retention policies
        </h2>
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Unclear clips (days)
            </span>
            <input
              type="number"
              min="1"
              max="36500"
              value={retentionState.audioRetentionDays || ""}
              onChange={(e) =>
                setRetentionState((s) => ({
                  ...s,
                  audioRetentionDays: Number(e.target.value),
                }))
              }
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring"
            />
            <span className="block text-xs font-normal leading-5 text-muted-foreground">
              Full recordings are deleted after finalization. This controls only
              short clips retained for unclear-speech review.
            </span>
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Observation videos (days)
            </span>
            <input
              type="number"
              min="1"
              max="36500"
              value={retentionState.observationVideoRetentionDays || ""}
              onChange={(e) =>
                setRetentionState((s) => ({
                  ...s,
                  observationVideoRetentionDays: Number(e.target.value),
                }))
              }
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Session notes (days)
            </span>
            <input
              type="number"
              min="1"
              max="36500"
              value={retentionState.sessionNoteRetentionDays || ""}
              onChange={(e) =>
                setRetentionState((s) => ({
                  ...s,
                  sessionNoteRetentionDays: Number(e.target.value),
                }))
              }
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Archived storage (days)
            </span>
            <input
              type="number"
              min="1"
              max="36500"
              value={retentionState.archivedClientStorageDays || ""}
              onChange={(e) =>
                setRetentionState((s) => ({
                  ...s,
                  archivedClientStorageDays: Number(e.target.value),
                }))
              }
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring"
            />
          </label>
        </div>
        <Button
          onClick={handleSaveRetention}
          disabled={updateRetention.isPending}
          data-testid="button-save-retention"
        >
          {updateRetention.isPending ? "Saving..." : "Save retention settings"}
        </Button>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 md:p-8 soft-shadow">
          <h2 className="serif text-xl font-semibold mb-5">
            Recent audit events
          </h2>
          {data.auditEvents.length ? (
            <div className="space-y-5">
              {data.auditEvents.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="border-b border-border pb-5 last:border-0 last:pb-0"
                >
                  <p className="text-sm">
                    <strong>{event.actorName}</strong>{" "}
                    <span className="text-muted-foreground">
                      {event.action}
                    </span>{" "}
                    <strong>{event.targetType}</strong>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {event.outcome} ·{" "}
                    {new Date(event.occurredAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No recent audit events.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-8 soft-shadow">
          <h2 className="serif text-xl font-semibold mb-5">
            Data classifications
          </h2>
          {data.classifications.length ? (
            <div className="space-y-5">
              {data.classifications.map((c) => (
                <div
                  key={c.dataType}
                  className="border-b border-border pb-5 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">{c.dataType}</p>
                    <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {c.sensitivity}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {c.description}
                  </p>
                  <p className="text-[11px] font-mono mt-3 text-primary uppercase tracking-wider">
                    {c.accessPolicy}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No classifications available.
            </p>
          )}
        </section>
      </div>
      {viewer?.isSuperAdmin && <SuperAdminBetaControls />}
    </div>
  );
}

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};
type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

type CapturedGestalt = {
  id: number;
  phrase: string;
  meaning: string;
  situation: string;
  function: string;
  context: string;
  emotionalState: string;
  source: "manual" | "speech";
  confirmed: boolean;
};

function LegacySessionRecorderPage({
  childId,
  child,
  onSaved,
}: {
  childId: number;
  child?: Child;
  onSaved: () => void;
}) {
  const createGestalt = useCreateGestalt();
  const addGestaltComment = useAddGestaltComment();
  const createObservation = useCreateObservation();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const recordingStartedAt = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  const shouldRecognize = useRef(false);
  const recordingRef = useRef(false);
  const speechId = useRef(0);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>();
  const [audioError, setAudioError] = useState("");
  const [captured, setCaptured] = useState<CapturedGestalt[]>([]);
  const [phrase, setPhrase] = useState("");
  const [context, setContext] = useState("Therapy");
  const [func, setFunc] = useState("Unknown");
  const [emotion, setEmotion] = useState("Unknown");
  const [phase, setPhase] = useState<"capture" | "review" | "summary">(
    "capture",
  );
  const [reflection, setReflection] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [speechStatus, setSpeechStatus] = useState<
    "ready" | "listening" | "unavailable"
  >("ready");
  const [speechDraft, setSpeechDraft] = useState("");
  const [speechError, setSpeechError] = useState("");

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      shouldRecognize.current = false;
      speechRecognition.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSpeechSupported(
      Boolean(
        speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition,
      ),
    );
  }, []);

  const formattedTime = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const addSpeechCandidate = (transcript: string) => {
    const phraseToAdd = transcript.replace(/\s+/g, " ").trim();
    if (!phraseToAdd) return;
    setCaptured((items) => {
      const normalized = phraseToAdd.toLocaleLowerCase();
      if (items.some((item) => item.phrase.toLocaleLowerCase() === normalized))
        return items;
      speechId.current += 1;
      return [
        ...items,
        {
          id: Date.now() + speechId.current,
          phrase: phraseToAdd,
          meaning: "",
          situation: "",
          function: "",
          context: "",
          emotionalState: "",
          source: "speech",
          confirmed: false,
        },
      ];
    });
  };
  const stopSpeechRecognition = () => {
    shouldRecognize.current = false;
    setSpeechDraft("");
    if (speechRecognition.current) {
      try {
        speechRecognition.current.stop();
      } catch {
        /* recognition has already ended */
      }
    }
    setSpeechStatus("ready");
  };
  const startSpeechRecognition = () => {
    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechSupported(false);
      setSpeechStatus("unavailable");
      setSpeechError(
        "Live speech recognition is not available in this browser. You can still log phrases manually.",
      );
      return;
    }
    setSpeechError("");
    const recognition = speechRecognition.current ?? new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) addSpeechCandidate(transcript);
        else interim += transcript;
      }
      setSpeechDraft(interim.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      shouldRecognize.current = false;
      setSpeechStatus("unavailable");
      setSpeechDraft("");
      setSpeechError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Speech recognition permission was not granted. You can continue with the manual phrase log."
          : "Live speech recognition paused. You can continue with the manual phrase log.",
      );
    };
    recognition.onend = () => {
      if (!shouldRecognize.current || !recordingRef.current) {
        setSpeechStatus("ready");
        return;
      }
      window.setTimeout(() => {
        if (!shouldRecognize.current || !recordingRef.current) return;
        try {
          recognition.start();
          setSpeechStatus("listening");
        } catch {
          setSpeechStatus("unavailable");
          setSpeechError(
            "Live speech recognition paused. You can continue with the manual phrase log.",
          );
        }
      }, 200);
    };
    speechRecognition.current = recognition;
    shouldRecognize.current = true;
    try {
      recognition.start();
      setSpeechStatus("listening");
    } catch {
      setSpeechStatus("unavailable");
      setSpeechError(
        "Live speech recognition could not start. You can continue with the manual phrase log.",
      );
    }
  };
  const toggleSpeechRecognition = () => {
    const nextEnabled = !speechEnabled;
    setSpeechEnabled(nextEnabled);
    setSpeechError("");
    if (!nextEnabled) {
      stopSpeechRecognition();
      return;
    }
    if (recordingRef.current && !paused) startSpeechRecognition();
  };
  const startRecording = async () => {
    setAudioError("");
    setSaveError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setAudioError(
        "This browser does not support microphone recording. You can still write down phrases manually.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        setPhase("review");
      };
      mediaStream.current = stream;
      mediaRecorder.current = recorder;
      recorder.start();
      recordingStartedAt.current = Date.now();
      recordingRef.current = true;
      setElapsed(0);
      setRecording(true);
      setPaused(false);
      setPhase("capture");
      if (speechEnabled) startSpeechRecognition();
      timerRef.current = window.setInterval(() => {
        if (recordingStartedAt.current)
          setElapsed(
            Math.floor((Date.now() - recordingStartedAt.current) / 1000),
          );
      }, 1000);
    } catch {
      setAudioError(
        "Microphone access was not granted. Check your browser permissions and try again.",
      );
    }
  };
  const stopRecording = () => {
    if (mediaRecorder.current?.state !== "inactive")
      mediaRecorder.current?.stop();
    mediaRecorder.current = null;
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    recordingRef.current = false;
    stopSpeechRecognition();
    if (timerRef.current) window.clearInterval(timerRef.current);
    recordingStartedAt.current = null;
    setRecording(false);
    setPaused(false);
  };
  const togglePause = () => {
    const recorder = mediaRecorder.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      stopSpeechRecognition();
      setPaused(true);
      if (timerRef.current) window.clearInterval(timerRef.current);
    } else if (recorder.state === "paused") {
      recorder.resume();
      if (speechEnabled) startSpeechRecognition();
      recordingStartedAt.current = Date.now() - elapsed * 1000;
      setPaused(false);
      timerRef.current = window.setInterval(() => {
        if (recordingStartedAt.current)
          setElapsed(
            Math.floor((Date.now() - recordingStartedAt.current) / 1000),
          );
      }, 1000);
    }
  };
  const addCaptured = (event: FormEvent) => {
    event.preventDefault();
    if (!phrase.trim()) return;
    setCaptured((items) => [
      ...items,
      {
        id: Date.now(),
        phrase: phrase.trim(),
        meaning: "",
        situation: "",
        function: func,
        context,
        emotionalState: emotion,
        source: "manual",
        confirmed: true,
      },
    ]);
    setPhrase("");
  };
  const updateCaptured = (
    id: number,
    field: keyof Omit<CapturedGestalt, "id" | "source" | "confirmed">,
    value: string,
  ) => {
    setCaptured((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
              confirmed: item.source === "speech" ? false : item.confirmed,
            }
          : item,
      ),
    );
  };
  const removeCaptured = (id: number) =>
    setCaptured((items) => items.filter((item) => item.id !== id));
  const confirmCaptured = (id: number) =>
    setCaptured((items) =>
      items.map((item) =>
        item.id === id ? { ...item, confirmed: true } : item,
      ),
    );
  const reviewReady =
    captured.length > 0 &&
    captured.every(
      (item) =>
        item.phrase.trim() &&
        item.meaning.trim() &&
        item.situation.trim() &&
        (item.source === "manual" ||
          (item.confirmed &&
            item.function.trim() &&
            item.context.trim() &&
            item.emotionalState.trim())),
    );
  const recognizedCount = captured.filter(
    (item) => item.source === "speech",
  ).length;
  const buildSessionNote = () =>
    [
      `Therapy session note — ${child?.name ?? "selected child"}`,
      `Duration: ${formattedTime} · Setting: Therapy`,
      "",
      "Communication observed:",
      ...captured.map(
        (item, index) =>
          `${index + 1}. “${item.phrase}” — Meaning: ${item.meaning.trim() || "To be explored"}. Situation: ${item.situation.trim() || "Not yet documented"}.`,
      ),
      "",
      `Clinical observations: ${reflection.trim() || "Add the SLP’s observations from the session."}`,
      `Next steps: ${nextSteps.trim() || "Add suggested supports, follow-up, or practice for the team."}`,
    ].join("\n");
  const createSummary = () => {
    setSessionNote(buildSessionNote());
    setCopied(false);
    setPhase("summary");
  };
  const copySessionNote = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(sessionNote);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const saveSession = async () => {
    if (!reviewReady || !sessionNote.trim()) return;
    setSaveError("");
    try {
      for (const item of captured) {
        const created = await createGestalt.mutateAsync({
          params: { childId },
          data: {
            phrase: item.phrase,
            meaning: item.meaning.trim(),
            function: item.function,
            contexts: [item.context],
            emotionalState: item.emotionalState,
            source: "Therapy session",
            audioUrl: null,
          },
        });
        await addGestaltComment.mutateAsync({
          params: { gestaltId: created.id },
          data: { body: `Situation when said: ${item.situation.trim()}` },
        });
      }
      await createObservation.mutateAsync({
        params: { childId },
        data: { body: sessionNote.trim(), context: "Therapy" },
      });
      setSaved(true);
      onSaved();
    } catch {
      setSaveError(
        "We couldn’t save the session note. Your review is still here—please try again.",
      );
    }
  };
  const resetSession = () => {
    if (recording) stopRecording();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(undefined);
    setElapsed(0);
    setCaptured([]);
    setSaved(false);
    setAudioError("");
    setSaveError("");
    setPhase("capture");
    setReflection("");
    setNextSteps("");
    setSessionNote("");
    setCopied(false);
    setSpeechDraft("");
    setSpeechError("");
    setSpeechStatus("ready");
    shouldRecognize.current = false;
    recordingRef.current = false;
  };

  if (saved) {
    return (
      <div className="mx-auto max-w-4xl space-y-7">
        <SectionHeading
          eyebrow="Session complete"
          title="Your session note is ready."
          description={`${captured.length} gestalt${captured.length === 1 ? "" : "s"} and the SLP’s review were added to ${child?.name ?? "the team map"}.`}
          action={
            <Button variant="outline" onClick={resetSession}>
              <RotateCcw size={16} /> New session
            </Button>
          }
        />
        <section className="rounded-3xl bg-primary p-7 text-primary-foreground md:p-10">
          <div className="flex items-center gap-3 text-accent">
            <span className="grid size-10 place-items-center rounded-full bg-accent/15">
              <Check size={19} />
            </span>
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[.18em]">
                Saved to team activity
              </p>
              <p className="text-sm text-primary-foreground/65">
                {formattedTime} recorded · Therapy
              </p>
            </div>
          </div>
          <pre className="mt-8 whitespace-pre-wrap font-sans text-sm leading-7 text-primary-foreground/85">
            {sessionNote}
          </pre>
        </section>
        {audioUrl && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <Volume2 size={18} className="text-primary" />
              <div>
                <p className="text-sm font-semibold">Session playback</p>
                <p className="text-xs text-muted-foreground">
                  Available only while this page is open. The team note is
                  saved; audio upload is not enabled yet.
                </p>
              </div>
            </div>
            <audio className="mt-3 w-full" controls src={audioUrl} />
          </section>
        )}
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="mx-auto max-w-5xl space-y-7">
        <SectionHeading
          eyebrow="Step 2 · clinician review"
          title="Which phrases belong in this note?"
          description={`${recognizedCount ? `${recognizedCount} speech-recognition candidate${recognizedCount === 1 ? "" : "s"} ${recognizedCount === 1 ? "is" : "are"} ready for your review. ` : ""}Edit, remove, or add phrases. For speech candidates, choose the context, function, and emotional state, then explicitly confirm each one.`}
          action={
            <Button variant="outline" onClick={() => setPhase("capture")}>
              <ArrowRight size={16} className="rotate-180" /> Add another phrase
            </Button>
          }
        />
        {audioUrl && (
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                <Volume2 size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Listen back while you review
                </p>
                <p className="text-xs text-muted-foreground">
                  Speech recognition suggests draft phrases only. Your reviewed
                  notes become the session summary.
                </p>
              </div>
            </div>
            <audio className="w-full sm:max-w-sm" controls src={audioUrl} />
          </section>
        )}
        {captured.length ? (
          <div className="space-y-4">
            {captured.map((item, index) => (
              <section
                key={item.id}
                className="rounded-2xl border border-border bg-card p-5 soft-shadow md:p-6"
              >
                <div className="flex items-start gap-4">
                  <span className="mono mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-[10px] font-bold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="serif text-2xl font-semibold">
                        “{item.phrase}”
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.source === "speech" ? "bg-accent/25 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {item.source === "speech"
                          ? item.confirmed
                            ? "Speech confirmed"
                            : "Speech candidate"
                          : "Manual entry"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {item.source === "speech"
                        ? item.confirmed
                          ? "Confirmed by the clinician. Editing any detail will require confirmation again."
                          : "Complete the details below and confirm this candidate before it can join the clinician note."
                        : "Added by the clinician during the session."}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {item.source === "speech" && (
                      <Button
                        variant={item.confirmed ? "quiet" : "warm"}
                        className="px-3 py-2 text-xs"
                        onClick={() => confirmCaptured(item.id)}
                        data-testid={`button-confirm-session-phrase-${item.id}`}
                      >
                        {item.confirmed ? (
                          <Check size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                        {item.confirmed ? "Confirmed" : "Confirm"}
                      </Button>
                    )}
                    <Button
                      variant="quiet"
                      className="px-3 py-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => removeCaptured(item.id)}
                      data-testid={`button-remove-session-phrase-${item.id}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field
                    label="Exact phrase"
                    value={item.phrase}
                    onChange={(value) =>
                      updateCaptured(item.id, "phrase", value)
                    }
                    placeholder="What did the child say?"
                    testId={`input-session-review-phrase-${item.id}`}
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SelectField
                      label="Function"
                      value={item.function}
                      onChange={(value) =>
                        updateCaptured(item.id, "function", value)
                      }
                      options={[
                        "Request",
                        "Protest",
                        "Shared Joy",
                        "Comment",
                        "Transition",
                        "Regulation",
                        "Self-Advocacy",
                        "Unknown",
                      ]}
                      placeholder={
                        item.source === "speech" ? "Choose…" : undefined
                      }
                      testId={`select-session-review-function-${item.id}`}
                    />
                    <SelectField
                      label="Emotion"
                      value={item.emotionalState}
                      onChange={(value) =>
                        updateCaptured(item.id, "emotionalState", value)
                      }
                      options={[
                        "Regulated",
                        "Excited",
                        "Frustrated",
                        "Dysregulated",
                        "Tired",
                        "Unknown",
                      ]}
                      placeholder={
                        item.source === "speech" ? "Choose…" : undefined
                      }
                      testId={`select-session-review-emotion-${item.id}`}
                    />
                    <SelectField
                      label="Context"
                      value={item.context}
                      onChange={(value) =>
                        updateCaptured(item.id, "context", value)
                      }
                      options={["Therapy", "Home", "School", "Community"]}
                      placeholder={
                        item.source === "speech" ? "Choose…" : undefined
                      }
                      testId={`select-session-review-context-${item.id}`}
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      What did it mean?
                    </span>
                    <textarea
                      data-testid={`textarea-session-review-meaning-${item.id}`}
                      value={item.meaning}
                      onChange={(event) =>
                        updateCaptured(item.id, "meaning", event.target.value)
                      }
                      placeholder="What was the child communicating or inviting?"
                      className="min-h-24 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      What was happening when they said it?
                    </span>
                    <textarea
                      data-testid={`textarea-session-review-situation-${item.id}`}
                      value={item.situation}
                      onChange={(event) =>
                        updateCaptured(item.id, "situation", event.target.value)
                      }
                      placeholder="Describe the activity, people, transition, or need in that moment."
                      className="min-h-24 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
                    />
                  </label>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Mic}
            title="No phrases ready to review"
            body="Go back to the session capture screen to log a phrase manually, or use live recognition in a supported browser."
          />
        )}
        <section className="rounded-2xl border border-border bg-secondary/50 p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-card text-primary">
              <ClipboardList size={18} />
            </div>
            <div>
              <h2 className="serif text-xl font-semibold">
                Finish the clinical reflection
              </h2>
              <p className="text-xs text-muted-foreground">
                These notes will be included in the session note shared with the
                team.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                SLP observations
              </span>
              <textarea
                data-testid="textarea-session-reflection"
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
                placeholder="What patterns, supports, or changes did you notice?"
                className="min-h-28 w-full resize-y rounded-xl border border-input bg-card p-3 text-sm outline-none transition-shadow focus-ring"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Next steps for the team
              </span>
              <textarea
                data-testid="textarea-session-next-steps"
                value={nextSteps}
                onChange={(event) => setNextSteps(event.target.value)}
                placeholder="What should the team try, watch for, or practice next?"
                className="min-h-28 w-full resize-y rounded-xl border border-input bg-card p-3 text-sm outline-none transition-shadow focus-ring"
              />
            </label>
          </div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {reviewReady
              ? "Every phrase is ready for the clinician note."
              : "Add a meaning and situation to every phrase. Speech candidates also need deliberate details and clinician confirmation."}
          </p>
          <Button
            variant="primary"
            onClick={createSummary}
            disabled={!reviewReady}
            data-testid="button-create-session-summary"
          >
            Create session note <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "summary") {
    return (
      <div className="mx-auto max-w-5xl space-y-7">
        <SectionHeading
          eyebrow="Step 3 · Session note"
          title="A note you can use at the end of session."
          description="ChildLed assembled this from your reviewed phrases and reflections. Edit anything before saving it to the team map."
          action={
            <Button variant="outline" onClick={() => setPhase("review")}>
              <ArrowRight size={16} className="rotate-180" /> Back to review
            </Button>
          }
        />
        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-3xl border border-border bg-card p-6 soft-shadow md:p-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                  Editable session note
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use this as your therapy note or copy it into your
                  documentation system.
                </p>
              </div>
              <Button
                variant="outline"
                className="px-3 py-2 text-xs"
                onClick={copySessionNote}
                disabled={!navigator.clipboard}
              >
                {copied ? <Check size={14} /> : <ClipboardList size={14} />}
                {copied ? "Copied" : "Copy note"}
              </Button>
            </div>
            <textarea
              data-testid="textarea-session-note"
              value={sessionNote}
              onChange={(event) => setSessionNote(event.target.value)}
              className="min-h-[420px] w-full resize-y rounded-2xl border border-input bg-background p-4 text-sm leading-7 outline-none transition-shadow focus-ring"
            />
          </section>
          <aside className="h-fit space-y-4">
            <section className="rounded-2xl bg-primary p-6 text-primary-foreground">
              <div className="flex items-center gap-3 text-accent">
                <Check size={18} />
                <p className="mono text-[10px] font-bold uppercase tracking-[.18em]">
                  Review complete
                </p>
              </div>
              <p className="serif mt-4 text-2xl">
                {captured.length} phrase{captured.length === 1 ? "" : "s"} ready
                to share
              </p>
              <p className="mt-3 text-sm leading-6 text-primary-foreground/70">
                Each phrase will be added to the dictionary with the SLP’s
                situation comment attached.
              </p>
            </section>
            {audioUrl && (
              <section className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-semibold">Session playback</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Audio is not transcribed and is available only while this page
                  is open. Saving audio for the team is not enabled yet.
                </p>
                <audio className="mt-3 w-full" controls src={audioUrl} />
              </section>
            )}
          </aside>
        </div>
        {saveError && (
          <p
            data-testid="status-save-session-error"
            className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
          >
            {saveError}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={saveSession}
            disabled={
              createGestalt.isPending ||
              addGestaltComment.isPending ||
              createObservation.isPending ||
              !sessionNote.trim()
            }
            data-testid="button-save-session"
          >
            {createGestalt.isPending ||
            addGestaltComment.isPending ||
            createObservation.isPending
              ? "Saving session note…"
              : "Save session note to team"}{" "}
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <SectionHeading
        eyebrow="Step 1 · For SLPs"
        title="Capture the session as it happens."
        description={`Record audio for ${child?.name ?? "this child"}. In supported browsers, ChildLed can suggest phrase candidates as you record; you always review the words, context, and meaning before they become part of the note.`}
      />
      <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <section
          className={`rounded-3xl p-7 text-primary-foreground soft-shadow md:p-10 ${recording ? "bg-primary" : "bg-primary/95"}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-accent">
                Therapy session
              </p>
              <h2 className="serif mt-2 text-3xl">
                {child?.name ?? "Selected child"}
              </h2>
            </div>
            <div
              className={`grid size-12 place-items-center rounded-2xl ${recording ? "bg-accent text-primary" : "bg-primary-foreground/10"}`}
            >
              <Timer size={23} />
            </div>
          </div>
          <div className="my-10 text-center">
            <div className="flex items-center justify-center gap-3">
              <span
                className={`size-3 rounded-full ${recording ? "animate-pulse bg-accent" : "bg-primary-foreground/25"}`}
              />
              <p
                className={`mono text-6xl font-bold tracking-tight ${recording ? "text-accent" : ""}`}
              >
                {formattedTime}
              </p>
            </div>
            <p className="mt-3 text-sm text-primary-foreground/60">
              {recording
                ? paused
                  ? "Recording paused"
                  : "Recording audio…"
                : audioUrl
                  ? "Recording finished · ready for review"
                  : "Ready when you are"}
            </p>
          </div>
          <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
            {speechSupported ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">
                    {speechEnabled
                      ? "Draft speech recognition"
                      : "Manual phrase log"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-primary-foreground/65">
                    {speechEnabled
                      ? "Suggests possible phrases while you record. It never assigns meaning and every candidate needs your review."
                      : "Speech recognition is off. You can still record audio and log every phrase manually."}
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={speechEnabled}
                  onClick={toggleSpeechRecognition}
                  data-testid="button-toggle-speech-recognition"
                  className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${speechEnabled ? "bg-accent" : "bg-primary-foreground/20"}`}
                >
                  <span
                    className={`absolute top-1 size-4 rounded-full bg-card transition-transform ${speechEnabled ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold">Manual phrase log</p>
                <p className="mt-1 text-xs leading-5 text-primary-foreground/65">
                  Live speech recognition is not available in this browser. You
                  can still record audio and log every phrase manually.
                </p>
              </div>
            )}
            {speechSupported && speechEnabled && (
              <div className="mt-3 flex items-center gap-2 text-xs text-primary-foreground/70">
                <span
                  className={`size-2 rounded-full ${speechStatus === "listening" ? "animate-pulse bg-accent" : "bg-primary-foreground/35"}`}
                />
                {speechStatus === "listening"
                  ? "Listening for draft phrases"
                  : speechStatus === "unavailable"
                    ? "Recognition unavailable — manual logging stays available"
                    : "Ready to listen when recording starts"}
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!recording ? (
              <>
                <Button
                  variant="warm"
                  onClick={startRecording}
                  data-testid="button-start-recording"
                >
                  <Mic size={17} />{" "}
                  {audioUrl ? "Record again" : "Start recording"}
                </Button>
                {audioUrl && captured.length > 0 && (
                  <Button
                    variant="outline"
                    className="border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                    onClick={() => setPhase("review")}
                    data-testid="button-review-session"
                  >
                    Review phrases <ArrowRight size={16} />
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={togglePause}
                  data-testid="button-pause-recording"
                >
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                  {paused ? "Resume" : "Pause"}
                </Button>
                <Button
                  variant="warm"
                  onClick={stopRecording}
                  data-testid="button-stop-recording"
                >
                  <Square size={15} fill="currentColor" /> Stop recording
                </Button>
              </>
            )}
          </div>
          {audioError && (
            <p className="mt-5 rounded-xl bg-destructive/20 p-3 text-center text-xs leading-5 text-primary-foreground">
              {audioError}
            </p>
          )}
          {speechError && (
            <p
              data-testid="status-speech-recognition-error"
              className="mt-3 rounded-xl bg-primary-foreground/10 p-3 text-center text-xs leading-5 text-primary-foreground/85"
            >
              {speechError}
            </p>
          )}
        </section>
        <section className="rounded-3xl border border-border bg-card p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                Live phrase log
              </p>
              <h2 className="serif mt-2 text-2xl font-semibold">
                Capture, then confirm.
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Recognition candidates and manual phrases are drafts. You will
                add context and meaning after the recording stops.
              </p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary">
              {captured.length} draft{captured.length === 1 ? "" : "s"}
            </span>
          </div>
          {speechDraft && (
            <div
              data-testid="status-speech-draft"
              className="mb-5 rounded-2xl border border-accent/40 bg-secondary/55 p-4"
            >
              <div className="flex items-center gap-2 text-primary">
                <span className="size-2 animate-pulse rounded-full bg-accent" />
                <span className="mono text-[10px] font-bold uppercase tracking-[.16em]">
                  Listening now
                </span>
              </div>
              <p className="mt-2 text-sm leading-6">“{speechDraft}”</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This draft will only be added when the browser returns a final
                result.
              </p>
            </div>
          )}
          <form onSubmit={addCaptured} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Add a phrase manually
              </span>
              <input
                data-testid="input-session-phrase"
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder="e.g. “Blast off!”"
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Function"
                value={func}
                onChange={setFunc}
                options={[
                  "Request",
                  "Protest",
                  "Shared Joy",
                  "Comment",
                  "Transition",
                  "Regulation",
                  "Self-Advocacy",
                  "Unknown",
                ]}
                testId="select-session-function"
              />
              <SelectField
                label="Emotional state"
                value={emotion}
                onChange={setEmotion}
                options={[
                  "Regulated",
                  "Excited",
                  "Frustrated",
                  "Dysregulated",
                  "Tired",
                  "Unknown",
                ]}
                testId="select-session-emotion"
              />
              <SelectField
                label="Context"
                value={context}
                onChange={setContext}
                options={["Therapy", "Home", "School", "Community"]}
                testId="select-session-context"
              />
            </div>
            <Button
              type="submit"
              variant="warm"
              disabled={!phrase.trim()}
              data-testid="button-capture-gestalt"
            >
              <Plus size={16} /> Log phrase
            </Button>
          </form>
          {captured.length > 0 && (
            <div className="mt-7 space-y-2 border-t border-border pt-6">
              {captured.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl bg-muted/60 p-3"
                >
                  <span className="mono mt-1 text-[10px] font-bold text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="serif text-lg font-semibold">
                        “{item.phrase}”
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${item.source === "speech" ? "bg-accent/30 text-primary" : "bg-card text-muted-foreground"}`}
                      >
                        {item.source === "speech"
                          ? "Speech candidate"
                          : "Manual"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.context} · {item.function}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {captured.length > 0 && !recording && (
        <div className="flex items-center justify-end gap-3">
          <p className="text-xs text-muted-foreground">
            {audioUrl
              ? "Stop recording to confirm contexts and meanings."
              : "Audio is optional—review your written phrase log whenever you are ready."}
          </p>
          <Button
            variant="primary"
            onClick={() => setPhase("review")}
            data-testid="button-continue-to-review"
          >
            Review draft phrases <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}

type ReviewGestalt = {
  id: number;
  phrase: string;
  meaning: string;
  function: string;
  context: string;
  emotionalState: string;
  note: string;
  transcriptPhraseId?: number;
  phraseInboxItemId?: number;
  frequency?: number;
  origin?: "manual" | "transcript";
  reviewState?: "routine" | "exception" | "reviewed";
  preserveDictionary?: boolean;
  clinicianEdited?: boolean;
};

const normalizeGestaltPhrase = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
const gestaltMatchKey = (value: string) =>
  normalizeGestaltPhrase(value).replace(/\s+/g, "");
const requiresFocusedSpeakerReview = (confidence: "high" | "medium" | "low") =>
  confidence !== "high";
const reviewThresholdLabel = (confidence: "high" | "medium" | "low") =>
  requiresFocusedSpeakerReview(confidence)
    ? "Focused review"
    : "Ready for role confirmation";
const confidenceTone = (confidence: "high" | "medium" | "low") =>
  confidence === "high"
    ? "bg-emerald-100 text-emerald-800"
    : confidence === "medium"
      ? "bg-amber-100 text-amber-800"
      : "bg-rose-100 text-rose-800";
const speakerRoleLabel = (role: string) =>
  ({
    child: "Child",
    slp: "SLP",
    parent: "Parent",
    teacher: "Teacher",
    caregiver: "Caregiver",
    unknown: "Unknown",
    unassigned: "Confirm role…",
  })[role] ?? "Unknown";
const nlaStageLabels: Record<NlaStage, string> = {
  stage_0: "Stage 0",
  stage_1: "Stage 1",
  stage_2: "Stage 2",
  stage_3: "Stage 3",
  stage_4_plus: "Stage 4+",
};
const nlaStageLabel = (stage: NlaStage | null | undefined) =>
  stage ? nlaStageLabels[stage] : "Not Yet Assigned";
const transcriptGuidanceFor = (
  phrase: string,
  frequency: number,
  hasDictionaryMatch: boolean,
) => {
  const normalized = normalizeGestaltPhrase(phrase);
  const functionPrompt = /\b(help|more|want|please|can i)\b/u.test(normalized)
    ? "Possible request or self-advocacy — confirm from the surrounding interaction."
    : /\b(no|stop|dont|don’t)\b/u.test(normalized)
      ? "Possible protest or boundary-setting — confirm from the surrounding interaction."
      : /\b(look|wow|yay|fun)\b/u.test(normalized)
        ? "Possible shared-joy or connection bid — confirm from the surrounding interaction."
        : "Choose a communication function from the interaction, not from wording alone.";
  return {
    pattern: hasDictionaryMatch
      ? "Matches an existing entry in this child’s dictionary."
      : frequency > 1
        ? `Heard ${frequency} times in confirmed Child speech.`
        : "One reviewable Child language sample.",
    functionPrompt,
    mitigationPrompt:
      "Review changes in wording, pace, or intensity before deciding whether this is a mitigation.",
    coachingPrompt:
      frequency > 1
        ? "Consider whether repeating this wording supported connection, regulation, or a shared routine."
        : "Capture what happened immediately before and after this utterance to guide the team.",
  };
};

function SessionRecorderPage({
  childId,
  child,
  resumeTranscriptId,
  startRequestToken = 0,
  onSessionActivityChange,
  onExit,
  onSaved,
}: {
  childId: number;
  child?: Child;
  resumeTranscriptId?: number;
  startRequestToken?: number;
  onSessionActivityChange?: (active: boolean) => void;
  onExit?: () => void;
  onSaved: (session: Session) => void;
}) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const createSession = useCreateSession();
  const requestAudioUpload = useRequestSessionAudioUpload();
  const uploadAudio = requestAudioUpload;
  const completeSessionCalibration = useCompleteSessionCalibration();
  const deleteSessionCalibration = useDeleteSessionCalibration();
  const deleteSessionDraft = useDeleteSessionTranscriptionDraft();
  const deleteTranscriptPhrase = useDeleteSessionTranscriptPhrase();
  const prepareSessionRecording = usePrepareSessionRecording();
  const transcribeAudio = useTranscribeSessionAudio();
  const updateTranscriptSpeakers = useUpdateTranscriptSpeakers();
  const updateTranscriptProvisionalPhrases =
    useUpdateTranscriptProvisionalPhrases();
  const updateTranscriptChildUtterances = useUpdateTranscriptChildUtterances();
  const updateChildPhraseInbox = useUpdateChildPhraseInbox();
  const draftTranscriptionQuery = useGetSessionTranscriptionDraft(
    { childId, transcriptId: resumeTranscriptId ?? 0 },
    {
      query: {
        queryKey: getGetSessionTranscriptionDraftQueryKey({
          childId,
          transcriptId: resumeTranscriptId ?? 0,
        }),
        enabled: Boolean(childId && resumeTranscriptId),
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  );
  const knownGestaltsQuery = useListGestalts(
    { childId },
    {
      query: {
        queryKey: getListGestaltsQueryKey({ childId }),
        enabled: Boolean(childId),
      },
    },
  );
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const reviewAudio = useRef<HTMLAudioElement | null>(null);
  const phraseReplayTimer = useRef<number | undefined>(undefined);
  const nlaGuideDialogRef = useRef<HTMLElement | null>(null);
  const nlaGuideTriggerRef = useRef<HTMLButtonElement | null>(null);
  const nlaGuideCloseRef = useRef<HTMLButtonElement | null>(null);
  const calibrationRecorders = useRef<
    Partial<Record<"clinician" | "caregiver", MediaRecorder>>
  >({});
  const calibrationStreams = useRef<
    Partial<Record<"clinician" | "caregiver", MediaStream>>
  >({});
  const calibrationStartedAt = useRef<
    Partial<Record<"clinician" | "caregiver", number>>
  >({});
  const calibrationTimers = useRef<
    Partial<Record<"clinician" | "caregiver", number>>
  >({});
  const calibrationClockTimers = useRef<
    Partial<Record<"clinician" | "caregiver", number>>
  >({});
  const discardCalibrationCapture = useRef<
    Partial<Record<"clinician" | "caregiver", boolean>>
  >({});
  const recordingStartedAt = useRef<number | null>(null);
  const workflowHeaderRef = useRef<HTMLElement | null>(null);
  const captureFailed = useRef(false);
  const timerRef = useRef<number | null>(null);
  const transcriptionRun = useRef(0);
  const sessionSaveInFlight = useRef(false);
  const automaticallyResumedDraftId = useRef<number | undefined>(undefined);
  const handledStartRequestToken = useRef(0);
  const consentConfirmedAtRef = useRef<string | undefined>(undefined);
  const [stage, setStage] = useState<
    "capture" | "review" | "finalize" | "saved"
  >("capture");
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob>();
  const [audioUrl, setAudioUrl] = useState<string>();
  const [audioError, setAudioError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [audioPreparationPending, setAudioPreparationPending] = useState(false);
  const [finalizePreparing, setFinalizePreparing] = useState(false);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [captured, setCaptured] = useState<ReviewGestalt[]>([]);
  const [phrase, setPhrase] = useState("");
  const [meaning, setMeaning] = useState("");
  const [context, setContext] = useState("Therapy");
  const [func, setFunc] = useState("Unknown");
  const [emotion, setEmotion] = useState("Unknown");
  const [observations, setObservations] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [sessionNoteEdited, setSessionNoteEdited] = useState(false);
  const [savedSession, setSavedSession] = useState<Session>();
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentConfirmedAt, setConsentConfirmedAt] = useState<string>();
  const [consentPurpose, setConsentPurpose] = useState<
    "record" | "calibration" | "process" | "save"
  >("record");
  const [pendingCalibrationRole, setPendingCalibrationRole] = useState<
    "clinician" | "caregiver"
  >();
  const [calibrationState, setCalibrationState] = useState<
    Record<"clinician" | "caregiver", SpeakerCalibrationState>
  >({
    clinician: "idle",
    caregiver: "idle",
  });
  const [calibrationErrors, setCalibrationErrors] = useState<
    Partial<Record<"clinician" | "caregiver", string>>
  >({});
  const [calibrationAudioIds, setCalibrationAudioIds] = useState<
    Partial<Record<"clinician" | "caregiver", string>>
  >({});
  const [calibrationDiagnostics, setCalibrationDiagnostics] = useState<
    Record<"clinician" | "caregiver", CalibrationDiagnostics>
  >({
    clinician: emptyCalibrationDiagnostics(),
    caregiver: emptyCalibrationDiagnostics(),
  });
  const [caregiverPresent, setCaregiverPresent] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [recordingPreparationId, setRecordingPreparationId] =
    useState<string>();
  const [calibrationElapsedMilliseconds, setCalibrationElapsedMilliseconds] =
    useState<Partial<Record<"clinician" | "caregiver", number>>>({});
  const [calibrationQuality, setCalibrationQuality] = useState<
    Partial<
      Record<"clinician" | "caregiver", "excellent" | "good" | "fair" | "poor">
    >
  >({});
  const [pendingAudioFile, setPendingAudioFile] = useState<File>();
  const [uploadedAudioId, setUploadedAudioId] = useState<string>();
  const [transcription, setTranscription] = useState<SessionTranscript>();
  const phraseInboxQuery = useListChildPhraseInbox(
    { childId, transcriptId: transcription?.id },
    {
      query: {
        queryKey: getListChildPhraseInboxQueryKey({
          childId,
          transcriptId: transcription?.id,
        }),
        enabled: Boolean(childId && transcription?.id),
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  );
  const [transcriptionStatus, setTranscriptionStatus] = useState<
    "idle" | "uploading" | "transcribing" | "complete" | "error"
  >("idle");
  const [transcriptionError, setTranscriptionError] = useState("");
  const [replayError, setReplayError] = useState("");
  const [reviewExceptionsOnly, setReviewExceptionsOnly] = useState(true);
  const [ignoredTranscriptPhraseIds, setIgnoredTranscriptPhraseIds] = useState<
    number[]
  >([]);
  const [selectedChildUtteranceIds, setSelectedChildUtteranceIds] = useState<
    number[]
  >([]);
  const [utteranceNotes, setUtteranceNotes] = useState<
    Record<
      number,
      {
        context?: string;
        meaning?: string;
        interpretation?: string;
        note?: string;
      }
    >
  >({});
  const [provisionalNotes, setProvisionalNotes] = useState<
    Record<number, { phrase?: string; workingMeaning?: string }>
  >({});
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [reviewProgressSaved, setReviewProgressSaved] = useState(false);
  const [inboxMeaningDrafts, setInboxMeaningDrafts] = useState<
    Record<number, string>
  >({});
  const [nlaGuideOpen, setNlaGuideOpen] = useState(false);
  useEffect(() => {
    if (!nlaGuideOpen) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    nlaGuideCloseRef.current?.focus();
    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setNlaGuideOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        nlaGuideDialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!nlaGuideDialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeyboard);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyboard);
      (nlaGuideTriggerRef.current ?? previouslyFocused)?.focus();
    };
  }, [nlaGuideOpen]);

  const formattedTime = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const clinicianName =
    user?.fullName?.trim() || user?.firstName?.trim() || "Clinician";
  const caregiverName =
    child?.team?.find((member) => /parent|caregiver/i.test(member.role))
      ?.name || "Caregiver";
  const calibrationDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const matchingGestalt = (capturedPhrase: string) => {
    const phraseKey = gestaltMatchKey(capturedPhrase);
    if (!phraseKey) return undefined;
    return knownGestaltsQuery.data?.find(
      (gestalt) => gestaltMatchKey(gestalt.phrase) === phraseKey,
    );
  };
  const resumeDraftReview = () => {
    const draft = draftTranscriptionQuery.data;
    if (!draft) return;
    const consentAt = draft.recordingConsentConfirmedAt ?? undefined;
    consentConfirmedAtRef.current = consentAt;
    setConsentConfirmedAt(consentAt);
    setUploadedAudioId(draft.audioId);
    setTranscription(draft);
    setTranscriptionStatus("complete");
    setAudioUrl(
      draft.audioId.startsWith("development-speaker-review-")
        ? undefined
        : `${basePath}/api/sessions/transcription/${draft.id}/audio`,
    );
    setElapsed(
      Math.ceil(
        Math.max(
          0,
          ...draft.childUtterances.map(
            (utterance) =>
              (utterance.timestampSeconds ?? 0) +
              (utterance.durationSeconds ?? 0),
          ),
        ),
      ),
    );
    setStage("review");
    addTranscriptDrafts(draft);
  };
  useEffect(() => {
    const draft = draftTranscriptionQuery.data;
    if (
      !resumeTranscriptId ||
      !draft ||
      stage !== "capture" ||
      recording ||
      automaticallyResumedDraftId.current === draft.id
    )
      return;
    automaticallyResumedDraftId.current = draft.id;
    resumeDraftReview();
  }, [draftTranscriptionQuery.data?.id, recording, stage]);
  const matchingExactDictionaryGestalt = (capturedPhrase: string) => {
    const phraseKey = normalizeGestaltPhrase(capturedPhrase);
    if (!phraseKey) return undefined;
    return knownGestaltsQuery.data?.find(
      (gestalt) => normalizeGestaltPhrase(gestalt.phrase) === phraseKey,
    );
  };
  const knownRoutineValues = (phraseValue: string) => {
    const existing = matchingExactDictionaryGestalt(phraseValue);
    if (
      !existing ||
      !existing.meaning.trim() ||
      !existing.function.trim() ||
      existing.function === "Unknown"
    )
      return undefined;
    return {
      meaning: existing.meaning,
      function: existing.function,
      emotionalState: existing.emotionalState || "Unknown",
    };
  };
  const reviewStateFor = (
    item: Pick<
      ReviewGestalt,
      "meaning" | "function" | "origin" | "preserveDictionary"
    >,
  ) =>
    item.origin === "transcript" &&
    item.preserveDictionary &&
    item.function !== "Unknown" &&
    Boolean(item.meaning.trim())
      ? ("routine" as const)
      : ("exception" as const);
  const openConsentModal = (
    purpose: "record" | "calibration" | "process" | "save" = "record",
  ) => {
    setConsentChecked(false);
    setConsentPurpose(purpose);
    setConsentModalOpen(true);
  };
  useEffect(() => {
    if (
      !startRequestToken ||
      startRequestToken === handledStartRequestToken.current ||
      stage !== "capture" ||
      recording
    )
      return;
    handledStartRequestToken.current = startRequestToken;
    openConsentModal("record");
  }, [startRequestToken]);
  const hasUnsavedSession =
    recording ||
    (stage === "capture" && Boolean(audioBlob)) ||
    stage === "review" ||
    stage === "finalize";
  useEffect(() => {
    onSessionActivityChange?.(
      hasUnsavedSession || Boolean(audioError) || stage === "saved",
    );
  }, [audioError, hasUnsavedSession, onSessionActivityChange, stage]);
  useEffect(() => {
    if (!hasUnsavedSession) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedSession]);
  useEffect(() => {
    if (!hasUnsavedSession) return;
    const guardInternalNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const destination = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search &&
        destination.hash === current.hash
      )
        return;
      const leave = window.confirm(
        recording
          ? "A recording is in progress. Leave this page and lose the current capture?"
          : "This session has not been saved. Leave this page? Unsaved review edits may be lost.",
      );
      if (leave) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("click", guardInternalNavigation, true);
    return () =>
      document.removeEventListener("click", guardInternalNavigation, true);
  }, [hasUnsavedSession, recording]);
  useEffect(
    () => () => onSessionActivityChange?.(false),
    [onSessionActivityChange],
  );
  const closeConsentModal = () => {
    setConsentModalOpen(false);
    if (consentPurpose === "process") setPendingAudioFile(undefined);
    if (consentPurpose === "calibration") setPendingCalibrationRole(undefined);
  };
  const summaryFor = (items = captured) =>
    [
      `${formattedTime} therapy session for ${child?.name ?? "the child"}.`,
      "",
      "Reviewed child communication:",
      items.length
        ? items
            .map((item, index) =>
              [
                `${index + 1}. “${item.phrase}”${item.frequency && item.frequency > 1 ? ` (heard ${item.frequency} times)` : ""}`,
                `   Working meaning: ${item.meaning || "To be explored with the team."}`,
                `   Function: ${item.function || "Unknown"} · Setting: ${item.context || "Not recorded"} · Emotional state: ${item.emotionalState || "Unknown"}`,
                item.note ? `   Clinical context: ${item.note}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
            )
            .join("\n\n")
        : "No reviewed child utterances were selected.",
      "",
      "Clinical observations:",
      observations || "To be added.",
      "",
      "Next steps:",
      nextSteps || "To be added.",
    ].join("\n");
  const clearTranscription = () => {
    transcriptionRun.current += 1;
    setUploadedAudioId(undefined);
    setTranscription(undefined);
    setTranscriptionStatus("idle");
    setTranscriptionError("");
    setReviewExceptionsOnly(true);
    setIgnoredTranscriptPhraseIds([]);
    setSelectedChildUtteranceIds([]);
    setUtteranceNotes({});
    setProvisionalNotes({});
    setShowFullTranscript(false);
    setCaptured((items) =>
      items
        .filter((item) => item.origin !== "transcript")
        .map((item) => ({
          ...item,
          transcriptPhraseId: undefined,
          frequency: undefined,
        })),
    );
  };
  const clearAudio = () => {
    if (phraseReplayTimer.current !== undefined) {
      window.clearTimeout(phraseReplayTimer.current);
      phraseReplayTimer.current = undefined;
    }
    reviewAudio.current?.pause();
    setReplayError("");
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(undefined);
    setAudioUrl(undefined);
    clearTranscription();
  };
  const errorMessageFor = (error: any) =>
    error?.data?.error ??
    error?.message ??
    "We could not complete this recording step. Your manual review is still available.";
  const uploadAudioBlob = async (
    blob: Blob,
    confirmedAt = consentConfirmedAtRef.current,
  ) => {
    setAudioPreparationPending(true);
    try {
      if (!confirmedAt)
        throw new Error(
          "Confirm recording consent before processing therapy audio.",
        );
      const preparationId =
        recordingPreparationId ??
        (await prepareSessionRecording.mutateAsync({ data: { childId } })).id;
      if (!recordingPreparationId) setRecordingPreparationId(preparationId);
      const reservation = await requestAudioUpload.mutateAsync({
        data: {
          contentType: blob.type || "audio/webm",
          fileName: `therapy-session-${Date.now()}.webm`,
          sizeBytes: blob.size,
          childId,
          consentConfirmed: true,
          consentConfirmedAt: confirmedAt,
          preparationId,
        },
      });
      const response = await fetch(reservation.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": reservation.contentType },
        body: blob,
      });
      if (!response.ok)
        throw new Error(
          "The recording could not be uploaded to private storage. Please try again.",
        );
      setUploadedAudioId(reservation.audioId);
      return reservation.audioId;
    } finally {
      setAudioPreparationPending(false);
    }
  };
  const setCalibrationCaptureState = (
    role: "clinician" | "caregiver",
    state: SpeakerCalibrationState,
    error?: string,
  ) => {
    setCalibrationState((current) => ({ ...current, [role]: state }));
    setCalibrationErrors((current) => ({
      ...current,
      [role]: error,
    }));
  };
  const clearCalibrationCapture = (role: "clinician" | "caregiver") => {
    const existingAudioId = calibrationAudioIds[role];
    if (existingAudioId) {
      void deleteSessionCalibration
        .mutateAsync({ params: { audioId: existingAudioId, childId } })
        .catch(() => undefined);
    }
    const recorder = calibrationRecorders.current[role];
    discardCalibrationCapture.current[role] = true;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    calibrationRecorders.current[role] = undefined;
    calibrationStreams.current[role]
      ?.getTracks()
      .forEach((track) => track.stop());
    calibrationStreams.current[role] = undefined;
    if (calibrationTimers.current[role])
      window.clearTimeout(calibrationTimers.current[role]);
    calibrationTimers.current[role] = undefined;
    if (calibrationClockTimers.current[role])
      window.clearInterval(calibrationClockTimers.current[role]);
    calibrationClockTimers.current[role] = undefined;
    calibrationStartedAt.current[role] = undefined;
    setCalibrationElapsedMilliseconds((current) => ({ ...current, [role]: 0 }));
    setCalibrationQuality((current) => ({ ...current, [role]: undefined }));
    setCalibrationAudioIds((current) => ({ ...current, [role]: undefined }));
    setCalibrationDiagnostics((current) => ({
      ...current,
      [role]: emptyCalibrationDiagnostics(),
    }));
    setCalibrationCaptureState(role, "idle");
  };
  const skipCalibrationCapture = (role: "clinician" | "caregiver") => {
    clearCalibrationCapture(role);
    setCalibrationDiagnostics((current) => ({
      ...current,
      [role]: {
        ...emptyCalibrationDiagnostics(),
        voiceProfileStatus: "unavailable",
      },
    }));
    setCalibrationCaptureState(role, "skipped");
  };
  const stopCalibrationCapture = (role: "clinician" | "caregiver") => {
    const recorder = calibrationRecorders.current[role];
    if (!recorder || recorder.state === "inactive") return;
    if (calibrationTimers.current[role])
      window.clearTimeout(calibrationTimers.current[role]);
    calibrationTimers.current[role] = undefined;
    if (calibrationClockTimers.current[role])
      window.clearInterval(calibrationClockTimers.current[role]);
    calibrationClockTimers.current[role] = undefined;
    setCalibrationCaptureState(role, "loading");
    recorder.stop();
  };
  const completeUploadedCalibration = async (
    role: "clinician" | "caregiver",
    audioId: string,
    durationMilliseconds: number,
    sizeBytes?: number,
  ) => {
    setCalibrationCaptureState(role, "loading");
    try {
      const calibration = await completeSessionCalibration.mutateAsync({
        data: { audioId, childId, durationMilliseconds },
      });
      setCalibrationAudioIds((current) => ({
        ...current,
        [role]: calibration.audioId,
      }));
      setCalibrationDiagnostics((current) => ({
        ...current,
        [role]: calibration.diagnostics,
      }));
      if (typeof sizeBytes === "number") {
        const estimatedQuality =
          sizeBytes >= 45_000
            ? "excellent"
            : sizeBytes >= 20_000
              ? "good"
              : sizeBytes >= 8_000
                ? "fair"
                : "poor";
        setCalibrationQuality((current) => ({
          ...current,
          [role]: estimatedQuality,
        }));
      }
      setCalibrationCaptureState(role, "captured");
    } catch (error: any) {
      const serverDiagnostics = error?.data?.diagnostics as
        CalibrationDiagnostics | undefined;
      setCalibrationDiagnostics((current) => ({
        ...current,
        [role]: serverDiagnostics ?? {
          ...current[role],
          stage:
            current[role].uploadStatus === "reserved"
              ? "private_upload"
              : current[role].stage,
          uploadStatus: "failed",
          verificationStatus: "failed",
          errorCode: "CALIBRATION_CLIENT_REQUEST_FAILED",
          errorMessage: errorMessageFor(error),
        },
      }));
      setCalibrationCaptureState(role, "error", errorMessageFor(error));
    }
  };
  const retryUploadedCalibrationVerification = (
    role: "clinician" | "caregiver",
  ) => {
    const audioId = calibrationAudioIds[role];
    const durationMilliseconds = calibrationElapsedMilliseconds[role];
    if (!audioId || !durationMilliseconds) {
      void startCalibrationCapture(role);
      return;
    }
    void completeUploadedCalibration(
      role,
      audioId,
      durationMilliseconds,
      calibrationDiagnostics[role].fileSizeBytes,
    );
  };
  const startCalibrationCapture = async (
    role: "clinician" | "caregiver",
    confirmedConsent = false,
  ) => {
    if (!confirmedConsent && !consentConfirmedAtRef.current) {
      setPendingCalibrationRole(role);
      openConsentModal("calibration");
      return;
    }
    const confirmedAt = consentConfirmedAtRef.current;
    if (!confirmedAt) return;
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder
    ) {
      setCalibrationCaptureState(
        role,
        "error",
        "Voice calibration needs a secure, current browser with microphone support.",
      );
      return;
    }
    setCalibrationCaptureState(role, "loading");
    discardCalibrationCapture.current[role] = false;
    try {
      const preparationId =
        recordingPreparationId ??
        (await prepareSessionRecording.mutateAsync({ data: { childId } })).id;
      setRecordingPreparationId(preparationId);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const preferredType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(
        stream,
        preferredType ? { mimeType: preferredType } : undefined,
      );
      calibrationStreams.current[role] = stream;
      calibrationRecorders.current[role] = recorder;
      calibrationStartedAt.current[role] = Date.now();
      calibrationClockTimers.current[role] = window.setInterval(() => {
        const startedAt = calibrationStartedAt.current[role];
        if (startedAt)
          setCalibrationElapsedMilliseconds((current) => ({
            ...current,
            [role]: Date.now() - startedAt,
          }));
      }, 50);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        discardCalibrationCapture.current[role] = true;
        stream.getTracks().forEach((track) => track.stop());
        setCalibrationCaptureState(
          role,
          "error",
          "The microphone stopped unexpectedly. Please try the short calibration again.",
        );
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        calibrationStreams.current[role] = undefined;
        calibrationRecorders.current[role] = undefined;
        if (discardCalibrationCapture.current[role]) {
          discardCalibrationCapture.current[role] = false;
          return;
        }
        const startedAt = calibrationStartedAt.current[role];
        calibrationStartedAt.current[role] = undefined;
        const durationMilliseconds = startedAt ? Date.now() - startedAt : 0;
        setCalibrationElapsedMilliseconds((current) => ({
          ...current,
          [role]: durationMilliseconds,
        }));
        const blob = new Blob(chunks, {
          type: recorder.mimeType || preferredType || "audio/webm",
        });
        setCalibrationDiagnostics((current) => ({
          ...current,
          [role]: {
            ...emptyCalibrationDiagnostics(),
            recordedDurationMilliseconds: durationMilliseconds,
            fileSizeBytes: blob.size,
            contentType: blob.type || "audio/webm",
            voiceProfileStatus: "not_started",
          },
        }));
        if (
          durationMilliseconds < 5_000 ||
          durationMilliseconds > 10_000 ||
          !blob.size
        ) {
          setCalibrationDiagnostics((current) => ({
            ...current,
            [role]: {
              ...current[role],
              uploadStatus: "failed",
              verificationStatus: "failed",
              errorCode:
                durationMilliseconds < 5_000 || durationMilliseconds > 10_000
                  ? "CLIENT_DURATION_OUT_OF_RANGE"
                  : "EMPTY_RECORDING",
              errorMessage:
                durationMilliseconds < 5_000 || durationMilliseconds > 10_000
                  ? "The browser-measured recording duration was outside the required 5–10 second range."
                  : "The browser produced an empty audio file.",
            },
          }));
          setCalibrationCaptureState(
            role,
            "error",
            durationMilliseconds < 5_000
              ? "Please record for at least 5 seconds before stopping."
              : "That clip was longer than 10 seconds. Please record a new 5–10 second clip.",
          );
          return;
        }
        void (async () => {
          try {
            setCalibrationDiagnostics((current) => ({
              ...current,
              [role]: {
                ...current[role],
                stage: "upload_reservation",
                uploadStatus: "reserved",
              },
            }));
            const reservation = await requestAudioUpload.mutateAsync({
              data: {
                contentType: blob.type || "audio/webm",
                fileName: `speaker-calibration-${role}-${Date.now()}.webm`,
                sizeBytes: blob.size,
                childId,
                consentConfirmed: true,
                consentConfirmedAt: confirmedAt,
                purpose: "speaker_calibration",
                calibrationRole: role,
                durationMilliseconds,
                preparationId,
              },
            });
            const response = await fetch(reservation.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": reservation.contentType },
              body: blob,
            });
            if (!response.ok)
              throw new Error(
                "The voice reference could not be uploaded to private storage.",
              );
            setCalibrationAudioIds((current) => ({
              ...current,
              [role]: reservation.audioId,
            }));
            setCalibrationDiagnostics((current) => ({
              ...current,
              [role]: {
                ...current[role],
                stage: "private_upload",
                uploadStatus: "uploaded",
              },
            }));
            await completeUploadedCalibration(
              role,
              reservation.audioId,
              durationMilliseconds,
              blob.size,
            );
          } catch (error: any) {
            setCalibrationDiagnostics((current) => ({
              ...current,
              [role]: {
                ...current[role],
                stage:
                  current[role].uploadStatus === "reserved"
                    ? "private_upload"
                    : current[role].stage,
                uploadStatus: "failed",
                verificationStatus: "failed",
                errorCode: "CALIBRATION_CLIENT_REQUEST_FAILED",
                errorMessage: errorMessageFor(error),
              },
            }));
            setCalibrationCaptureState(role, "error", errorMessageFor(error));
          }
        })();
      };
      recorder.start(250);
      setCalibrationCaptureState(role, "recording");
      // Stop just under the upper bound to keep a browser scheduling delay from
      // accidentally producing an invalid 10+ second calibration.
      calibrationTimers.current[role] = window.setTimeout(
        () => stopCalibrationCapture(role),
        9_700,
      );
    } catch (error: any) {
      const name = error?.name;
      setCalibrationCaptureState(
        role,
        "error",
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone permission was denied. Allow it in browser settings, then try again."
          : name === "NotFoundError"
            ? "No microphone was found. Connect one, then try again."
            : "We could not start the microphone. Please check your browser permission and try again.",
      );
    }
  };
  const loadSpeakerReviewFixture = async () => {
    setTranscriptionError("");
    setAudioError("");
    try {
      const response = await fetch(
        `${basePath}/api/development/speaker-review-fixture?childId=${childId}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const result = (await response.json()) as SessionTranscript & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          result.error || "The speaker-review fixture could not be loaded.",
        );
      clearAudio();
      const fixtureBlob = new Blob(
        ["ChildLed development speaker-review fixture"],
        { type: "audio/wav" },
      );
      const confirmedAt = new Date().toISOString();
      consentConfirmedAtRef.current = confirmedAt;
      setConsentConfirmedAt(confirmedAt);
      setAudioBlob(fixtureBlob);
      setTranscription(result);
      setTranscriptionStatus("complete");
      setStage("review");
      addTranscriptDrafts(result);
    } catch (error: any) {
      setTranscriptionStatus("error");
      setTranscriptionError(
        error?.message ?? "The speaker-review fixture could not be loaded.",
      );
    }
  };
  const addTranscriptDrafts = (result: SessionTranscript) => {
    setCaptured((items) => {
      const next: ReviewGestalt[] = items
        .filter((item) => item.origin !== "transcript")
        .map((item) => ({
          ...item,
          transcriptPhraseId: undefined,
          frequency: undefined,
        }));
      for (const detected of result.phrases) {
        if (
          !detected.childAttributed ||
          ignoredTranscriptPhraseIds.includes(detected.id)
        )
          continue;
        const matchingIndex = next.findIndex(
          (item) =>
            gestaltMatchKey(item.phrase) === gestaltMatchKey(detected.phrase),
        );
        if (matchingIndex >= 0) {
          const matching = next[matchingIndex];
          if (matching) {
            const routine = knownRoutineValues(detected.phrase);
            next[matchingIndex] = matching.clinicianEdited
              ? {
                  ...matching,
                  transcriptPhraseId: detected.id,
                  frequency: detected.frequency,
                }
              : {
                  ...matching,
                  meaning: routine?.meaning ?? matching.meaning,
                  function: routine?.function ?? matching.function,
                  emotionalState:
                    routine?.emotionalState ?? matching.emotionalState,
                  transcriptPhraseId: detected.id,
                  frequency: detected.frequency,
                  origin: "transcript",
                  preserveDictionary: Boolean(routine),
                  reviewState: routine ? "routine" : "exception",
                };
          }
          continue;
        }
        const routine = knownRoutineValues(detected.phrase);
        next.push({
          id: -detected.id,
          phrase: detected.phrase,
          meaning:
            routine?.meaning ??
            detected.existingGestalt?.meaning ??
            "Meaning to explore with the team",
          function: routine?.function ?? "Unknown",
          context: "Therapy",
          emotionalState: routine?.emotionalState ?? "Unknown",
          note: "",
          transcriptPhraseId: detected.id,
          frequency: detected.frequency,
          origin: "transcript",
          preserveDictionary: Boolean(routine),
          reviewState: routine ? "routine" : "exception",
        });
      }
      return next;
    });
  };
  const assignSpeakerRole = async (
    label: string,
    role: string,
    rememberProfile = false,
  ) => {
    if (!transcription) return;
    const speakers = transcription.speakers.map((speaker) => ({
      label: speaker.label,
      role: (speaker.label === label ? role : speaker.role) as any,
      ...(speaker.label === label && rememberProfile
        ? { rememberProfile: true }
        : {}),
    }));
    try {
      const result = await updateTranscriptSpeakers.mutateAsync({
        params: { childId },
        data: { transcriptId: transcription.id, speakers },
      });
      setTranscription(result);
      addTranscriptDrafts(result);
    } catch (error: any) {
      setTranscriptionError(
        error?.message ??
          "We could not save the speaker roles. Please try again.",
      );
    }
  };
  const forgetSpeakerProfile = async (profileId: number) => {
    if (!transcription) return;
    try {
      const result = await updateTranscriptSpeakers.mutateAsync({
        params: { childId },
        data: { transcriptId: transcription.id, forgetProfileIds: [profileId] },
      });
      setTranscription(result);
      setTranscriptionError("");
    } catch (error: any) {
      setTranscriptionError(
        error?.message ??
          "We could not remove that remembered speaker profile. Please try again.",
      );
    }
  };
  const correctSpeakerTurn = async (
    segmentId: number,
    speakerLabel: string,
  ) => {
    if (!transcription) return;
    const segment = transcription.segments.find(
      (entry) => entry.id === segmentId,
    );
    if (!segment) return;
    try {
      const result = await updateTranscriptSpeakers.mutateAsync({
        params: { childId },
        data: {
          transcriptId: transcription.id,
          segmentGroups: [{ segmentId, speakerLabel }],
        },
      });
      setTranscription(result);
      setTranscriptionError("");
      addTranscriptDrafts(result);
    } catch (error: any) {
      setTranscriptionError(
        error?.message ??
          "We could not update that speaker assignment. Please try again.",
      );
    }
  };
  const retrySpeakerSeparation = async () => {
    if (!transcription) return;
    try {
      const result = await transcribeAudio.mutateAsync({
        params: { childId },
        data: { audioId: transcription.audioId, retrySpeakerSeparation: true },
      });
      setTranscription(result);
      setTranscriptionError("");
    } catch (error: any) {
      setTranscriptionError(
        error?.message ??
          "We could not retry speaker separation. The raw transcript is still available.",
      );
    }
  };
  const reviewChildUtterances = async (
    segmentIds: number[],
    disposition:
      | "pending"
      | "child"
      | "not_child"
      | "unsure"
      | "unintelligible"
      | "confirmed_gestalt"
      | "not_gestalt"
      | "context"
      | "unlabeled",
    extraParams?: {
      intelligibilityReviewStatus?: "pending" | "confirmed" | "unlabeled";
      nlaStage?: NlaStage | null;
    },
  ) => {
    if (!transcription || !segmentIds.length) return;
    try {
      const result = await updateTranscriptChildUtterances.mutateAsync({
        params: { childId },
        data: {
          transcriptId: transcription.id,
          expectedUpdatedAt: transcription.updatedAt,
          reviews: segmentIds.map((segmentId) => {
            const utterance = transcription.childUtterances.find(
              (u) => u.segmentId === segmentId,
            );
            const currentStatus =
              utterance?.intelligibilityReviewStatus ?? "pending";
            const stageProvided = Boolean(
              extraParams &&
              Object.prototype.hasOwnProperty.call(extraParams, "nlaStage"),
            );
            const childDisposition =
              disposition === "child" || disposition === "confirmed_gestalt";
            return {
              segmentId,
              disposition,
              intelligibilityReviewStatus:
                extraParams?.intelligibilityReviewStatus ?? currentStatus,
              context: utteranceNotes[segmentId]?.context ?? utterance?.context,
              meaning: utteranceNotes[segmentId]?.meaning ?? utterance?.meaning,
              interpretation:
                utteranceNotes[segmentId]?.interpretation ??
                utterance?.interpretation,
              note: utteranceNotes[segmentId]?.note ?? utterance?.note,
              nlaStage: childDisposition
                ? stageProvided
                  ? extraParams?.nlaStage
                  : utterance?.nlaStage
                : null,
            };
          }),
        },
      });
      setTranscription(result);
      await queryClient.invalidateQueries({
        queryKey: getListChildPhraseInboxQueryKey({
          childId,
          transcriptId: result.id,
        }),
      });
      setReviewProgressSaved(true);
      setSelectedChildUtteranceIds((current) =>
        current.filter((id) => !segmentIds.includes(id)),
      );
      setTranscriptionError("");
      addTranscriptDrafts(result);
    } catch (error: any) {
      setTranscriptionError(
        error?.message ??
          "We could not save the Child utterance review. Please try again.",
      );
    }
  };
  const updatePhraseInboxItem = async (
    itemId: number,
    status: "pending" | "deferred",
    phraseValue: string,
  ) => {
    try {
      const hasMeaningDraft = Object.prototype.hasOwnProperty.call(
        inboxMeaningDrafts,
        itemId,
      );
      const result = await updateChildPhraseInbox.mutateAsync({
        itemId,
        data: {
          status,
          ...(hasMeaningDraft
            ? { workingMeaning: inboxMeaningDrafts[itemId]?.trim() || null }
            : {}),
        },
      });
      const updatedItem = result.item;
      setTranscription(result.transcript);
      queryClient.setQueryData(
        getListChildPhraseInboxQueryKey({
          childId,
          transcriptId: updatedItem.transcriptId,
        }),
        (current: typeof phraseInboxQuery.data) =>
          current?.map((item) =>
            item.id === updatedItem.id ? updatedItem : item,
          ),
      );
      if (status === "deferred") {
        setCaptured((items) =>
          items.filter((item) => item.phraseInboxItemId !== updatedItem.id),
        );
      } else if (updatedItem.workingMeaning) {
        setUtteranceNotes((current) => ({
          ...current,
          [updatedItem.segmentId]: {
            ...current[updatedItem.segmentId],
            meaning: updatedItem.workingMeaning ?? "",
          },
        }));
        const detected = result.transcript.phrases.find(
          (candidate) => candidate.id === updatedItem.transcriptPhraseId,
        );
        setCaptured((items) => {
          const withoutAutomaticCopy = items.filter(
            (candidate) =>
              candidate.phraseInboxItemId ||
              candidate.transcriptPhraseId !== detected?.id,
          );
          const existing = withoutAutomaticCopy.find(
            (candidate) => candidate.phraseInboxItemId === updatedItem.id,
          );
          const reviewedItem: ReviewGestalt = {
            id: existing?.id ?? Date.now(),
            phrase: updatedItem.phrase,
            meaning: updatedItem.workingMeaning ?? "",
            function: existing?.function ?? "Unknown",
            context: existing?.context ?? "",
            emotionalState: existing?.emotionalState ?? "Unknown",
            note: existing?.note ?? "",
            transcriptPhraseId: detected?.id,
            phraseInboxItemId: updatedItem.id,
            frequency: detected?.frequency,
            origin: "transcript",
            reviewState: "exception",
            preserveDictionary: false,
            clinicianEdited: true,
          };
          return existing
            ? withoutAutomaticCopy.map((candidate) =>
                candidate.phraseInboxItemId === updatedItem.id
                  ? reviewedItem
                  : candidate,
              )
            : [...withoutAutomaticCopy, reviewedItem];
        });
      }
      setTranscriptionError("");
    } catch (error: any) {
      setTranscriptionError(
        error?.data?.error ??
          error?.message ??
          "We could not update the Child Phrase Inbox.",
      );
    }
  };
  const saveReviewProgress = async () => {
    if (!transcription || !transcription.childUtterances.length) return;
    try {
      const result = await updateTranscriptChildUtterances.mutateAsync({
        params: { childId },
        data: {
          transcriptId: transcription.id,
          expectedUpdatedAt: transcription.updatedAt,
          reviews: transcription.childUtterances.map((utterance) => ({
            segmentId: utterance.segmentId,
            disposition: utterance.disposition,
            intelligibilityReviewStatus: utterance.intelligibilityReviewStatus,
            context:
              utteranceNotes[utterance.segmentId]?.context ?? utterance.context,
            meaning:
              utteranceNotes[utterance.segmentId]?.meaning ?? utterance.meaning,
            interpretation:
              utteranceNotes[utterance.segmentId]?.interpretation ??
              utterance.interpretation,
            note: utteranceNotes[utterance.segmentId]?.note ?? utterance.note,
            nlaStage: utterance.nlaStage,
          })),
        },
      });
      setTranscription(result);
      setReviewProgressSaved(true);
      setTranscriptionError("");
      addTranscriptDrafts(result);
    } catch (error: any) {
      setTranscriptionError(
        error?.message ??
          "We could not save review progress. Please try again.",
      );
    }
  };
  const playUtterance = async (
    timestampSeconds: number | null,
    durationSeconds: number | null,
  ) => {
    const audio = reviewAudio.current;
    if (!audio) {
      setReplayError("The recording is not available for replay.");
      return;
    }
    if (
      timestampSeconds === null ||
      !(durationSeconds && durationSeconds > 0)
    ) {
      setReplayError(
        "Phrase replay is unavailable for this older transcript. Record a new session to capture phrase timing.",
      );
      return;
    }
    if (phraseReplayTimer.current !== undefined) {
      window.clearTimeout(phraseReplayTimer.current);
      phraseReplayTimer.current = undefined;
    }
    try {
      audio.pause();
      audio.currentTime = Math.max(0, timestampSeconds);
      await audio.play();
      setReplayError("");
      phraseReplayTimer.current = window.setTimeout(
        () => {
          audio.pause();
          phraseReplayTimer.current = undefined;
        },
        Math.max(50, Math.round(durationSeconds * 1_000)),
      );
    } catch {
      setReplayError(
        "The recording could not be played. Use the recording player below or try again.",
      );
    }
  };
  const setUtteranceNote = (
    segmentId: number,
    field: "context" | "meaning" | "interpretation" | "note",
    value: string,
  ) =>
    setUtteranceNotes((current) => {
      const u = transcription?.childUtterances.find(
        (item) => item.segmentId === segmentId,
      );
      return {
        ...current,
        [segmentId]: {
          context: current[segmentId]?.context ?? u?.context ?? "",
          meaning: current[segmentId]?.meaning ?? u?.meaning ?? "",
          interpretation:
            current[segmentId]?.interpretation ?? u?.interpretation ?? "",
          note: current[segmentId]?.note ?? u?.note ?? "",
          [field]: value,
        },
      };
    });

  const reviewProvisionalPhrase = async (
    id: number,
    disposition:
      "pending" | "approved" | "flagged" | "dismissed" | "saved_for_later",
  ) => {
    if (!transcription) return;
    try {
      const phrase =
        provisionalNotes[id]?.phrase ??
        transcription.provisionalPhrases.find((p) => p.id === id)?.phrase;
      const workingMeaning =
        provisionalNotes[id]?.workingMeaning ??
        transcription.provisionalPhrases.find((p) => p.id === id)
          ?.workingMeaning;
      const result = await updateTranscriptProvisionalPhrases.mutateAsync({
        params: { childId },
        data: {
          transcriptId: transcription.id,
          reviews: [
            {
              id,
              disposition,
              phrase,
              workingMeaning: workingMeaning || null,
            },
          ],
        },
      });
      setTranscription(result);
      setTranscriptionError("");
    } catch (error: any) {
      setTranscriptionError(
        error?.message ??
          "We could not save the provisional review. Please try again.",
      );
    }
  };

  const setProvisionalNote = (
    id: number,
    field: "phrase" | "workingMeaning",
    value: string,
  ) =>
    setProvisionalNotes((current) => {
      const p = transcription?.provisionalPhrases.find(
        (item) => item.id === id,
      );
      return {
        ...current,
        [id]: {
          phrase: current[id]?.phrase ?? p?.phrase ?? "",
          workingMeaning:
            current[id]?.workingMeaning ?? p?.workingMeaning ?? "",
          [field]: value,
        },
      };
    });
  const uploadAndTranscribe = async (
    blob: Blob,
    existingAudioId?: string,
    confirmedAt = consentConfirmedAtRef.current,
  ) => {
    const runId = ++transcriptionRun.current;
    setTranscriptionError("");
    try {
      if (!confirmedAt)
        throw new Error(
          "Confirm recording consent before processing therapy audio.",
        );
      let audioId = existingAudioId;
      if (!audioId) {
        setTranscriptionStatus("uploading");
        audioId = await uploadAudioBlob(blob, confirmedAt);
        if (transcriptionRun.current !== runId) return;
      }
      setTranscriptionStatus("transcribing");
      const result = await transcribeAudio.mutateAsync({
        params: { childId },
        data: { audioId },
      });
      if (transcriptionRun.current !== runId) return;
      setTranscription(result);
      setTranscriptionStatus("complete");
      addTranscriptDrafts(result);
    } catch (error: any) {
      if (transcriptionRun.current !== runId) return;
      const message = errorMessageFor(error);
      setTranscriptionStatus("error");
      setTranscriptionError(message);
    }
  };
  const prepareAudioForReview = (
    blob: Blob,
    confirmedAt = consentConfirmedAtRef.current,
  ) => {
    clearAudio();
    setAudioBlob(blob);
    setAudioUrl(URL.createObjectURL(blob));
    if (blob.size) {
      setTranscriptionStatus("uploading");
      setTranscriptionError("");
    }
    setStage("review");
    setSessionNote((current) => current || summaryFor());
    if (!blob.size) {
      const message =
        "No audio data was captured. Check that the microphone is selected and allowed in your browser, then record again.";
      setTranscriptionStatus("error");
      setTranscriptionError(message);
      return;
    }
    void uploadAndTranscribe(blob, undefined, confirmedAt);
  };
  const reportCaptureFailure = (message: string) => {
    transcriptionRun.current += 1;
    if (timerRef.current) window.clearInterval(timerRef.current);
    recordingStartedAt.current = null;
    mediaRecorder.current = null;
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    mediaStream.current = null;
    setRecording(false);
    setPaused(false);
    setAudioError(message);
    setTranscriptionStatus("error");
    setTranscriptionError(message);
    setStage("capture");
  };
  useEffect(
    () => () => {
      captureFailed.current = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorder.current && mediaRecorder.current.state !== "inactive")
        mediaRecorder.current.stop();
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      (["clinician", "caregiver"] as const).forEach((role) => {
        discardCalibrationCapture.current[role] = true;
        if (calibrationTimers.current[role])
          window.clearTimeout(calibrationTimers.current[role]);
        calibrationRecorders.current[role]?.state !== "inactive" &&
          calibrationRecorders.current[role]?.stop();
        calibrationStreams.current[role]
          ?.getTracks()
          .forEach((track) => track.stop());
      });
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  const startRecording = async (confirmedConsent: unknown = false) => {
    if (confirmedConsent !== true) {
      openConsentModal("record");
      return;
    }
    setAudioError("");
    setSaveError("");
    setFinalizePreparing(false);
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder
    ) {
      reportCaptureFailure(
        "Recording needs a secure, current browser with microphone support. You can still capture phrases and save a note without audio.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const preferredType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(
        stream,
        preferredType ? { mimeType: preferredType } : undefined,
      );
      captureFailed.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || preferredType || "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        if (captureFailed.current) return;
        prepareAudioForReview(blob);
      };
      recorder.onerror = () => {
        captureFailed.current = true;
        reportCaptureFailure(
          "The browser stopped the microphone recording unexpectedly. No recording was uploaded. Check the microphone and try again, or use an audio file.",
        );
      };
      mediaStream.current = stream;
      mediaRecorder.current = recorder;
      recorder.start(1000);
      recordingStartedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
      setPaused(false);
      setStage("capture");
      timerRef.current = window.setInterval(() => {
        if (recordingStartedAt.current)
          setElapsed(
            Math.floor((Date.now() - recordingStartedAt.current) / 1000),
          );
      }, 1000);
    } catch (error: any) {
      const name = error?.name;
      reportCaptureFailure(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone permission was denied. Use the browser’s site settings to allow microphone access, then try again or use an audio file."
          : name === "NotFoundError"
            ? "No microphone was found. Connect one, then try again or use an audio file."
            : "We could not start the microphone. Check the browser permission and try again or use an audio file.",
      );
    }
  };
  const confirmConsent = () => {
    if (!consentChecked) return;
    const confirmedAt = new Date().toISOString();
    consentConfirmedAtRef.current = confirmedAt;
    setConsentConfirmedAt(confirmedAt);
    setConsentModalOpen(false);
    if (consentPurpose === "record") void startRecording(true);
    if (consentPurpose === "calibration" && pendingCalibrationRole) {
      const role = pendingCalibrationRole;
      setPendingCalibrationRole(undefined);
      void startCalibrationCapture(role, true);
    }
    if (consentPurpose === "process" && pendingAudioFile) {
      const file = pendingAudioFile;
      setPendingAudioFile(undefined);
      prepareAudioForReview(file, confirmedAt);
    }
  };
  const consentModal = consentModalOpen ? (
    <Modal
      title="Recording Authorization & Consent"
      onClose={closeConsentModal}
    >
      <div data-testid="dialog-audio-recording-consent" className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          This recording may contain identifiable information. Confirm that you
          are authorized to record this child and that appropriate
          parental/legal guardian consent has been obtained before audio capture
          begins.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-muted/50 p-4 text-sm leading-6">
          <input
            data-testid="checkbox-audio-recording-consent"
            type="checkbox"
            checked={consentChecked}
            onChange={(event) => setConsentChecked(event.target.checked)}
            className="mt-1 size-4 accent-primary"
          />
          <span>
            I confirm I am authorized to record this child and consent has been
            obtained.
          </span>
        </label>
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="quiet"
            onClick={closeConsentModal}
            data-testid="button-cancel-audio-consent"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!consentChecked}
            onClick={confirmConsent}
            data-testid="button-confirm-audio-consent"
          >
            {consentPurpose === "record"
              ? "Start recording"
              : consentPurpose === "process"
                ? "Confirm & process audio"
                : "Confirm consent"}
          </Button>
        </div>
      </div>
    </Modal>
  ) : null;
  const finishRecording = () => {
    const recorder = mediaRecorder.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    mediaRecorder.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    recordingStartedAt.current = null;
    setRecording(false);
    setPaused(false);
  };
  const togglePause = () => {
    const recorder = mediaRecorder.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      if (timerRef.current) window.clearInterval(timerRef.current);
      setPaused(true);
    } else if (recorder.state === "paused") {
      recorder.resume();
      recordingStartedAt.current = Date.now() - elapsed * 1000;
      timerRef.current = window.setInterval(() => {
        if (recordingStartedAt.current)
          setElapsed(
            Math.floor((Date.now() - recordingStartedAt.current) / 1000),
          );
      }, 1000);
      setPaused(false);
    }
  };
  const addCaptured = (event: FormEvent) => {
    event.preventDefault();
    if (!phrase.trim()) return;
    const routine = knownRoutineValues(phrase);
    const entry: ReviewGestalt = {
      id: Date.now(),
      phrase: phrase.trim(),
      meaning:
        meaning.trim() ||
        routine?.meaning ||
        "Meaning to explore with the team",
      function: func === "Unknown" ? (routine?.function ?? func) : func,
      context,
      emotionalState:
        emotion === "Unknown" ? (routine?.emotionalState ?? emotion) : emotion,
      note: "",
      origin: "manual",
      reviewState: "exception",
      preserveDictionary: false,
      clinicianEdited: true,
    };
    setCaptured((items) => [...items, entry]);
    setPhrase("");
    setMeaning("");
  };
  const updateCaptured = (
    id: number,
    field:
      "phrase" | "meaning" | "function" | "context" | "emotionalState" | "note",
    value: string,
  ) =>
    setCaptured((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const next = {
          ...item,
          [field]: value,
          clinicianEdited: true,
          preserveDictionary: false,
        };
        return { ...next, reviewState: reviewStateFor(next) };
      }),
    );
  const toggleTranscriptPhrase = (detected: TranscriptPhrase) => {
    setIgnoredTranscriptPhraseIds((current) =>
      current.filter((id) => id !== detected.id),
    );
    setCaptured((items) => {
      const included = items.find(
        (item) => item.transcriptPhraseId === detected.id,
      );
      if (included) {
        return included.origin === "transcript"
          ? items.filter((item) => item.id !== included.id)
          : items.map((item) =>
              item.id === included.id
                ? {
                    ...item,
                    transcriptPhraseId: undefined,
                    frequency: undefined,
                  }
                : item,
            );
      }
      return [
        ...items,
        {
          id: -detected.id,
          phrase: detected.phrase,
          meaning:
            knownRoutineValues(detected.phrase)?.meaning ??
            "Meaning to explore with the team",
          function: knownRoutineValues(detected.phrase)?.function ?? "Unknown",
          context: "Therapy",
          emotionalState:
            knownRoutineValues(detected.phrase)?.emotionalState ?? "Unknown",
          note: "",
          transcriptPhraseId: detected.id,
          frequency: detected.frequency,
          origin: "transcript",
          preserveDictionary: Boolean(knownRoutineValues(detected.phrase)),
          reviewState: knownRoutineValues(detected.phrase)
            ? "routine"
            : "exception",
        },
      ];
    });
  };
  const ignoreTranscriptPhrase = async (detected: TranscriptPhrase) => {
    setSaveError("");
    try {
      const updated = await deleteTranscriptPhrase.mutateAsync({
        phraseId: detected.id,
      });
      setIgnoredTranscriptPhraseIds((current) =>
        current.includes(detected.id) ? current : [...current, detected.id],
      );
      setCaptured((items) =>
        items.filter((item) => item.transcriptPhraseId !== detected.id),
      );
      setTranscription(updated);
    } catch (error: any) {
      setSaveError(
        error?.data?.error ??
          error?.message ??
          "The phrase could not be deleted. Your review was preserved; please try again.",
      );
    }
  };
  const reopenRoutinePhrase = (id: number) =>
    setCaptured((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              reviewState: "exception",
              preserveDictionary: false,
              clinicianEdited: true,
            }
          : item,
      ),
    );
  const resolveExceptionPhrase = (id: number) => {
    const item = captured.find((entry) => entry.id === id);
    if (!item) return;
    if (
      !item.meaning.trim() ||
      item.meaning === "Meaning to explore with the team" ||
      item.function === "Unknown"
    ) {
      setSaveError(
        "Add a working meaning and communication function before marking this phrase ready to save.",
      );
      return;
    }
    setCaptured((items) =>
      items.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              reviewState: "reviewed",
              clinicianEdited: true,
              preserveDictionary: false,
            }
          : entry,
      ),
    );
    setSaveError("");
  };
  const reopenReviewedPhrase = (id: number) =>
    setCaptured((items) =>
      items.map((item) =>
        item.id === id ? { ...item, reviewState: "exception" } : item,
      ),
    );
  const removeCaptured = async (id: number) => {
    const capturedPhrase = captured.find((item) => item.id === id);
    const transcriptPhrase = capturedPhrase?.transcriptPhraseId
      ? transcription?.phrases.find(
          (item) => item.id === capturedPhrase.transcriptPhraseId,
        )
      : undefined;
    if (transcriptPhrase) {
      await ignoreTranscriptPhrase(transcriptPhrase);
      return;
    }
    setCaptured((items) => items.filter((item) => item.id !== id));
  };
  const replaceAudio = (file?: File) => {
    if (!file) return;
    if (!consentConfirmedAtRef.current) {
      setPendingAudioFile(file);
      openConsentModal("process");
      return;
    }
    prepareAudioForReview(file);
  };
  const saveSession = async () => {
    if (sessionSaveInFlight.current) return;
    setSaveError("");
    if (
      !captured.length &&
      !hasPreservedUnclearSpeech &&
      !hasCompletedTranscriptReview
    ) {
      setSaveError(
        "Complete the transcript review or add a clinician-captured phrase before saving this session.",
      );
      return;
    }
    if (!consentConfirmedAt) {
      setSaveError("Confirm recording consent before saving this session.");
      openConsentModal("save");
      return;
    }
    sessionSaveInFlight.current = true;
    try {
      let audioId: string | null = uploadedAudioId ?? null;
      if (audioBlob && !audioId) {
        audioId = await uploadAudioBlob(audioBlob, consentConfirmedAt);
      }
      const session = await createSession.mutateAsync({
        params: { childId },
        data: {
          durationSeconds: elapsed,
          gestalts: captured.map(
            ({
              phrase,
              meaning,
              function: communicationFunction,
              context: gestaltContext,
              emotionalState,
              note,
              transcriptPhraseId,
              phraseInboxItemId,
              preserveDictionary,
              reviewState,
            }) => ({
              phrase,
              meaning,
              function: communicationFunction,
              context: gestaltContext,
              emotionalState,
              note,
              transcriptPhraseId,
              phraseInboxItemId,
              preserveDictionary,
              clinicianReviewed: reviewState === "reviewed",
            }),
          ),
          clinicalObservations: observations,
          nextSteps,
          note: sessionNoteEdited ? sessionNote : summaryFor(),
          audioId,
          transcriptionId:
            transcription?.status === "complete" ? transcription.id : null,
          calibrationAudioIds: Object.values(calibrationAudioIds).filter(
            (id): id is string => Boolean(id),
          ),
          consentConfirmed: true,
          consentConfirmedAt,
        },
      });
      setSavedSession(session);
      setStage("saved");
      onSaved(session);
    } catch (error: any) {
      setSaveError(
        error?.data?.error ??
          error?.message ??
          "We could not save this session. Your review is still here; please try again.",
      );
    } finally {
      sessionSaveInFlight.current = false;
    }
  };
  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText(sessionNote || summaryFor());
    } catch {
      setSaveError(
        "Copy is not available in this browser. Select the note text to copy it.",
      );
    }
  };
  const regenerateSessionNote = () => {
    setSessionNote(summaryFor());
    setSessionNoteEdited(false);
  };
  const resetSession = () => {
    captureFailed.current = true;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recordingStartedAt.current = null;
    if (mediaRecorder.current?.state !== "inactive")
      mediaRecorder.current?.stop();
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    mediaRecorder.current = null;
    mediaStream.current = null;
    clearCalibrationCapture("clinician");
    clearCalibrationCapture("caregiver");
    clearAudio();
    consentConfirmedAtRef.current = undefined;
    sessionSaveInFlight.current = false;
    setElapsed(0);
    setCaptured([]);
    setPhrase("");
    setMeaning("");
    setObservations("");
    setNextSteps("");
    setSessionNote("");
    setSessionNoteEdited(false);
    setSavedSession(undefined);
    setAudioError("");
    setSaveError("");
    setDeleteError("");
    setFinalizePreparing(false);
    setDiscardModalOpen(false);
    setConsentModalOpen(false);
    setConsentChecked(false);
    setConsentConfirmedAt(undefined);
    setPendingAudioFile(undefined);
    setUploadedAudioId(undefined);
    setTranscription(undefined);
    setTranscriptionStatus("idle");
    setTranscriptionError("");
    setCaregiverPresent(false);
    setStartingSession(false);
    setRecordingPreparationId(undefined);
    setRecording(false);
    setPaused(false);
    setStage("capture");
  };
  const leaveSessionForLater = () => {
    resetSession();
    void queryClient.invalidateQueries({
      queryKey: getGetSessionsDashboardQueryKey(),
    });
    onExit?.();
  };
  const permanentlyDeleteCurrentSession = async (startOver: boolean) => {
    if (audioPreparationPending || deleteSessionDraft.isPending) return;
    setDeleteError("");
    const transcriptId = transcription?.id ?? resumeTranscriptId;
    const audioId = uploadedAudioId ?? transcription?.audioId;
    try {
      if (transcriptId || audioId) {
        await deleteSessionDraft.mutateAsync({
          params: {
            childId,
            ...(transcriptId ? { transcriptId } : {}),
            ...(audioId ? { audioId } : {}),
          },
        });
      }
      resetSession();
      await queryClient.invalidateQueries({
        queryKey: getGetSessionsDashboardQueryKey(),
      });
      if (!startOver) onExit?.();
    } catch (error: any) {
      setDeleteError(
        error?.data?.error ??
          error?.message ??
          "The unfinished session could not be deleted. It was preserved so you can try again.",
      );
    }
  };
  const reviewPreparationPending =
    transcriptionStatus === "complete" &&
    Boolean(transcription) &&
    Boolean(
      transcription?.phrases.some(
        (detected) =>
          detected.childAttributed &&
          !ignoredTranscriptPhraseIds.includes(detected.id) &&
          !captured.some((item) => item.transcriptPhraseId === detected.id),
      ),
    );
  const transcriptionPending =
    transcriptionStatus === "uploading" ||
    transcriptionStatus === "transcribing" ||
    (transcriptionStatus === "complete" && !transcription) ||
    reviewPreparationPending;
  const transcriptionProgressTitle =
    transcriptionStatus === "uploading"
      ? "Uploading the private recording…"
      : transcriptionStatus === "transcribing"
        ? "Transcribing the recording…"
        : "Preparing the review…";
  const transcriptionProgressBody =
    transcriptionStatus === "uploading"
      ? "ChildLed is securely uploading the recording. Transcription will begin automatically when the upload finishes."
      : transcriptionStatus === "transcribing"
        ? "ChildLed is creating the transcript. Review will remain hidden until all processing finishes."
        : "ChildLed is organizing the completed transcript into review items. This should only take a moment.";
  const completedWithNoSpeech =
    transcriptionStatus === "complete" &&
    transcription?.rawTranscript.trim().length === 0;
  useEffect(() => {
    if (!captured.length) return;
    setSessionNote((current) =>
      current.includes("No reviewed child utterances were selected.")
        ? summaryFor(captured)
        : current,
    );
  }, [captured]);
  const speakerSeparationUnavailable =
    transcription?.speakerSeparationStatus === "failed" ||
    transcription?.speakerSeparationStatus === "unavailable";
  const reviewedSpeakers = transcription?.speakers ?? [];
  const speakerTargets = reviewedSpeakers.map((speaker) => speaker.label);
  const manualTranscriptReviewStarted = Boolean(
    transcription?.reviewProgress.reviewed,
  );
  const lowConfidenceTurnCount =
    transcription?.segments.filter(
      (segment) =>
        requiresFocusedSpeakerReview(segment.speakerConfidence) &&
        !segment.speakerReviewed,
    ).length ?? 0;
  const childUtterances = transcription?.childUtterances ?? [];
  const rapidReviewUtterance = [...childUtterances]
    .sort((left, right) => left.reviewRank - right.reviewRank)
    .find((utterance) => utterance.disposition === "pending");
  const activeInboxItem = phraseInboxQuery.data?.find(
    (item) => item.status === "pending" && !item.workingMeaning?.trim(),
  );
  useEffect(() => {
    const inboxItems = phraseInboxQuery.data ?? [];
    if (!inboxItems.length) return;
    const managedPhraseKeys = new Set(
      inboxItems.map((item) => normalizeGestaltPhrase(item.phrase)),
    );
    const deferredIds = new Set(
      inboxItems
        .filter((item) => item.status === "deferred")
        .map((item) => item.id),
    );
    setCaptured((items) =>
      items.filter((item) => {
        if (item.phraseInboxItemId)
          return !deferredIds.has(item.phraseInboxItemId);
        return (
          !item.transcriptPhraseId ||
          !managedPhraseKeys.has(normalizeGestaltPhrase(item.phrase))
        );
      }),
    );
  }, [phraseInboxQuery.data]);
  useEffect(() => {
    const resumableItems = (phraseInboxQuery.data ?? []).filter(
      (item) =>
        item.status === "pending" &&
        Boolean(item.workingMeaning) &&
        typeof item.transcriptPhraseId === "number",
    );
    if (!resumableItems.length || !transcription) return;
    setCaptured((items) => {
      const next = [...items];
      for (const item of resumableItems) {
        if (next.some((candidate) => candidate.phraseInboxItemId === item.id))
          continue;
        const detected = transcription.phrases.find(
          (candidate) => candidate.id === item.transcriptPhraseId,
        );
        if (!detected) continue;
        next.push({
          id: Date.now() + item.id,
          phrase: item.phrase,
          meaning: item.workingMeaning ?? "",
          function: "Unknown",
          context: "",
          emotionalState: "Unknown",
          note: "",
          transcriptPhraseId: item.transcriptPhraseId ?? undefined,
          phraseInboxItemId: item.id,
          frequency: detected.frequency,
          origin: "transcript",
          reviewState: "exception",
          preserveDictionary: false,
          clinicianEdited: true,
        });
      }
      return next;
    });
  }, [phraseInboxQuery.data, transcription]);
  useEffect(() => {
    if (
      stage !== "review" ||
      updateTranscriptChildUtterances.isPending ||
      updateChildPhraseInbox.isPending
    )
      return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      )
        return;
      if (event.key === "Enter" && activeInboxItem) {
        event.preventDefault();
        document.getElementById(`inbox-meaning-${activeInboxItem.id}`)?.focus();
        return;
      }
      if (!rapidReviewUtterance) return;
      const decisions = {
        "1": "child",
        "2": "not_child",
        "3": "unsure",
        "4": "unintelligible",
      } as const;
      const disposition = decisions[event.key as keyof typeof decisions];
      if (!disposition) return;
      if (
        disposition === "child" &&
        (rapidReviewUtterance.intelligibility === "unintelligible" ||
          (rapidReviewUtterance.intelligibility === "partially_intelligible" &&
            rapidReviewUtterance.intelligibilityReviewStatus !== "confirmed"))
      )
        return;
      event.preventDefault();
      void reviewChildUtterances(
        [rapidReviewUtterance.segmentId],
        disposition,
        disposition === "unintelligible"
          ? { intelligibilityReviewStatus: "unlabeled" }
          : undefined,
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeInboxItem?.id,
    activeInboxItem?.phrase,
    rapidReviewUtterance?.segmentId,
    rapidReviewUtterance?.intelligibility,
    rapidReviewUtterance?.intelligibilityReviewStatus,
    stage,
    updateChildPhraseInbox.isPending,
    updateTranscriptChildUtterances.isPending,
  ]);
  const hasRawTranscript = Boolean(transcription?.rawTranscript.trim());
  useEffect(() => {
    if (
      transcriptionStatus === "complete" &&
      hasRawTranscript &&
      childUtterances.length === 0
    ) {
      setShowFullTranscript(true);
    }
  }, [
    childUtterances.length,
    hasRawTranscript,
    transcription?.id,
    transcriptionStatus,
  ]);
  const routineCaptured = captured.filter(
    (item) => item.reviewState === "routine",
  );
  const clinicianReviewedCaptured = captured.filter(
    (item) => item.reviewState === "reviewed",
  );
  const exceptionCaptured = captured.filter(
    (item) => item.reviewState === "exception" || !item.reviewState,
  );
  const unresolvedSpeakerReview = false;
  const unresolvedChildUtteranceReview = childUtterances.some(
    (utterance) => utterance.disposition === "pending",
  );
  const hasCompletedTranscriptReview =
    transcriptionStatus === "complete" &&
    Boolean(transcription) &&
    !unresolvedChildUtteranceReview &&
    (Boolean(transcription?.reviewProgress.total) || !hasRawTranscript);
  const closeoutState =
    stage === "saved"
      ? "saved"
      : createSession.isPending || sessionSaveInFlight.current
        ? "saving"
        : transcriptionPending
          ? "processing"
          : unresolvedSpeakerReview ||
              unresolvedChildUtteranceReview ||
              exceptionCaptured.length > 0
            ? "needs_review"
            : routineCaptured.length + clinicianReviewedCaptured.length > 0 ||
                hasCompletedTranscriptReview
              ? "ready"
              : "waiting";
  const closeoutCopy = {
    processing: {
      title: "Transcription is loading",
      body: transcriptionProgressBody,
    },
    needs_review: {
      title: "A few items need your judgment",
      body: unresolvedSpeakerReview
        ? "Speaker review remains optional guidance and does not block Child-language classification."
        : unresolvedChildUtteranceReview
          ? "Review each confirmed Child utterance before it can contribute to phrase candidates or session closeout."
          : `${exceptionCaptured.length} phrase${exceptionCaptured.length === 1 ? "" : "s"} needs clinical context before it can become evidence.`,
    },
    ready: {
      title: captured.length
        ? "Reviewed evidence is ready"
        : "Review is complete",
      body: captured.length
        ? clinicianReviewedCaptured.length
          ? "Your reviewed exceptions and routine evidence are ready for final confirmation."
          : "Exact reviewed dictionary matches are prepared without replacing their prior clinician-owned details."
        : "No Child phrases were confirmed in this recording. You can still finalize and save the session review.",
    },
    saving: {
      title: "Updating the child workspace",
      body: "Saving the reviewed session, refreshing the language map and function trends, and creating an editable SOAP draft.",
    },
    saved: {
      title: "Session saved",
      body: "The care-team workspace is up to date.",
    },
    waiting: {
      title: "Waiting for reviewed Child language",
      body: "Review the transcript or add a clinician-captured phrase to continue.",
    },
  }[closeoutState];
  const singleSpeakerFastPath =
    reviewedSpeakers.length === 1 && !speakerSeparationUnavailable;
  const speakerReviewPanel =
    transcriptionStatus === "complete" && transcription ? (
      <section
        data-testid="section-speaker-review"
        className="rounded-2xl border border-border bg-muted/25 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Optional speaker guidance
            </p>
            <p className="mt-1 text-sm font-semibold">
              {speakerSeparationUnavailable
                ? "Speaker grouping is unavailable"
                : singleSpeakerFastPath
                  ? "One speaker detected"
                  : reviewedSpeakers.length
                    ? "Automatic speaker groups are ready"
                    : "Preparing automatic speaker groups"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {speakerSeparationUnavailable
                ? "ChildLed kept the raw transcript intact and did not guess speaker groups. You can continue identifying Child language now, or retry separation later."
                : singleSpeakerFastPath
                  ? "You may confirm the role as optional review guidance. Utterance classification is already available."
                  : lowConfidenceTurnCount
                    ? "Speaker guidance is optional and never blocks Child-language review."
                    : "Confirm roles when useful, or continue with explicit utterance decisions."}
            </p>
          </div>
          <span className="rounded-full bg-card px-3 py-1.5 text-xs font-bold text-primary">
            {speakerSeparationUnavailable
              ? manualTranscriptReviewStarted
                ? "Manual review started"
                : "Optional retry"
              : lowConfidenceTurnCount
                ? `${lowConfidenceTurnCount} exception${lowConfidenceTurnCount === 1 ? "" : "s"} to review`
                : transcription.speakers.length
                  ? `${transcription.speakers.length} voice${transcription.speakers.length === 1 ? "" : "s"} detected`
                  : "Separating voices"}
          </span>
        </div>

        {transcription.processingStages.length > 0 && (
          <div className="mt-5 rounded-xl border border-primary/20 bg-card/80 p-4">
            <p className="text-sm font-semibold">Processing stages</p>
            <div className="mt-3 space-y-2">
              {transcription.processingStages.map((stage, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  {stage.status === "completed" ? (
                    <Check className="text-primary" size={14} />
                  ) : stage.status === "failed" ? (
                    <AlertCircle className="text-destructive" size={14} />
                  ) : stage.status === "processing" ? (
                    <Sparkles
                      className="animate-pulse text-primary"
                      size={14}
                    />
                  ) : (
                    <Circle className="text-muted-foreground" size={14} />
                  )}
                  <span
                    className={
                      stage.status === "completed"
                        ? "font-medium text-foreground"
                        : stage.status === "failed"
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    {stage.label}
                  </span>
                  {stage.reason && (
                    <span className="text-muted-foreground">
                      ({stage.reason})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {speakerSeparationUnavailable ? (
          <div
            data-testid="status-speaker-separation-unavailable"
            className="mt-5 rounded-xl border border-dashed border-border bg-card/70 p-4"
          >
            <p className="text-sm font-semibold">
              {transcription.speakerSeparationFailureMessage ||
                "The recording is still available"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {manualTranscriptReviewStarted
                ? "Manual Child-language decisions are preserved. Speaker grouping retry is disabled because replacing these transcript turns would discard clinician review."
                : "No temporary speaker groups were created. Continue manual Child-language review, or retry this optional stage before review begins."}
            </p>
            <Button
              variant="outline"
              className="mt-4 px-3 py-2 text-xs"
              disabled={
                transcribeAudio.isPending || manualTranscriptReviewStarted
              }
              onClick={() => void retrySpeakerSeparation()}
              data-testid="button-retry-speaker-separation"
            >
              <RotateCcw size={15} />{" "}
              {transcribeAudio.isPending
                ? "Retrying…"
                : manualTranscriptReviewStarted
                  ? "Manual review in progress"
                  : "Retry speaker grouping"}
            </Button>
          </div>
        ) : reviewedSpeakers.length ? (
          <>
            <div
              data-testid="status-automatic-speaker-diarization"
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-card/75 p-4 text-xs leading-5 text-muted-foreground"
            >
              <p>
                <span className="font-semibold text-foreground">
                  Review guidance:
                </span>{" "}
                Confidence measures temporary cluster consistency only. It never
                identifies a person or assigns a clinical role.
              </p>
              {lowConfidenceTurnCount > 0 && (
                <Button
                  variant={reviewExceptionsOnly ? "primary" : "outline"}
                  className="px-3 py-2 text-xs"
                  onClick={() => setReviewExceptionsOnly((current) => !current)}
                  data-testid="button-toggle-review-exceptions"
                >
                  {reviewExceptionsOnly
                    ? "Review exceptions only"
                    : "Show all review turns"}
                </Button>
              )}
            </div>
            <div className="mt-5 space-y-3">
              {reviewedSpeakers.map((speaker) => {
                const displayedRole =
                  speaker.role === "unassigned" && speaker.suggestedRole
                    ? speaker.suggestedRole
                    : speaker.role;
                const hasUnconfirmedSuggestion =
                  speaker.role === "unassigned" &&
                  Boolean(speaker.suggestedRole);
                const roleInference = speaker.roleInference;
                const hasRoleInference =
                  speaker.role === "unassigned" &&
                  roleInference.state !== "unavailable" &&
                  Boolean(roleInference.predictedRole);
                const inferenceRole = roleInference.predictedRole ?? "unknown";
                const isProvisionalInference =
                  roleInference.state === "provisional";
                return (
                  <div key={speaker.label} className="rounded-xl bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">
                            {speaker.label}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${confidenceTone(speaker.speakerConfidence)}`}
                          >
                            {reviewThresholdLabel(speaker.speakerConfidence)}
                          </span>
                          {speaker.speakerConfidenceScore !== null && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              {speaker.speakerConfidenceScore}% cluster
                              confidence
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {
                            transcription.segments.filter(
                              (segment) =>
                                segment.speakerLabel === speaker.label,
                            ).length
                          }{" "}
                          transcript turn
                          {transcription.segments.filter(
                            (segment) => segment.speakerLabel === speaker.label,
                          ).length === 1
                            ? ""
                            : "s"}
                          {speaker.lowConfidenceTurnCount > 0
                            ? ` · ${speaker.lowConfidenceTurnCount} low-confidence`
                            : ""}
                          {speaker.reviewedTurnCount > 0
                            ? ` · ${speaker.reviewedTurnCount} clinician-corrected`
                            : ""}
                        </p>
                      </div>
                      <select
                        value={displayedRole}
                        disabled={updateTranscriptSpeakers.isPending}
                        onChange={(event) =>
                          void assignSpeakerRole(
                            speaker.label,
                            event.target.value,
                          )
                        }
                        data-testid={`select-speaker-role-${speaker.label.replaceAll(" ", "-").toLowerCase()}`}
                        className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-semibold outline-none transition-shadow focus-ring"
                      >
                        <option value="unassigned">Confirm role…</option>
                        <option value="child">Child</option>
                        <option value="parent">Parent</option>
                        <option value="slp">SLP</option>
                        <option value="teacher">Teacher</option>
                        <option value="caregiver">Caregiver</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>
                    {hasUnconfirmedSuggestion && (
                      <div
                        data-testid={`status-speaker-role-suggestion-${speaker.label.replaceAll(" ", "-").toLowerCase()}`}
                        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs leading-5 text-muted-foreground"
                      >
                        <p>
                          <span className="font-semibold text-foreground">
                            {speakerRoleLabel(
                              speaker.suggestedRole ?? "unknown",
                            )}{" "}
                            suggested
                            {speaker.suggestedRoleConfidenceScore !== null
                              ? ` · ${speaker.suggestedRoleConfidenceScore}% profile match`
                              : ""}
                            .
                          </span>{" "}
                          This is a remembered-profile suggestion, not a role
                          assignment. Confirm it before ChildLed uses any Child
                          language.
                        </p>
                        <Button
                          variant="outline"
                          className="px-3 py-2 text-xs"
                          disabled={updateTranscriptSpeakers.isPending}
                          onClick={() =>
                            void assignSpeakerRole(
                              speaker.label,
                              speaker.suggestedRole ?? "unknown",
                            )
                          }
                          data-testid={`button-confirm-speaker-suggestion-${speaker.label.replaceAll(" ", "-").toLowerCase()}`}
                        >
                          Confirm{" "}
                          {speakerRoleLabel(speaker.suggestedRole ?? "unknown")}
                        </Button>
                      </div>
                    )}
                    {hasRoleInference && (
                      <div
                        data-testid={`status-speaker-role-inference-${speaker.label.replaceAll(" ", "-").toLowerCase()}`}
                        className="mt-4 rounded-xl border border-primary/20 bg-secondary/45 p-3 text-xs leading-5 text-muted-foreground"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <p>
                            <span className="font-semibold text-foreground">
                              {isProvisionalInference
                                ? "AI-assigned provisionally"
                                : "Role review guidance"}
                              : {speakerRoleLabel(inferenceRole)}
                              {roleInference.confidenceScore !== null
                                ? ` · ${roleInference.confidenceScore}%`
                                : ""}
                              .
                            </span>{" "}
                            {isProvisionalInference
                              ? "Confirm before this role can unlock any Child-language review."
                              : "Use this explanation to make a clinician decision; ChildLed will not apply it automatically."}
                          </p>
                          <Button
                            variant="outline"
                            className="shrink-0 px-3 py-2 text-xs"
                            disabled={updateTranscriptSpeakers.isPending}
                            onClick={() =>
                              void assignSpeakerRole(
                                speaker.label,
                                inferenceRole,
                              )
                            }
                            data-testid={`button-confirm-role-inference-${speaker.label.replaceAll(" ", "-").toLowerCase()}`}
                          >
                            Confirm {speakerRoleLabel(inferenceRole)}
                          </Button>
                        </div>
                        <p className="mt-2">
                          Signals:{" "}
                          {roleInference.signalSummary
                            .filter(
                              (signal) =>
                                signal.available && signal.contribution > 0,
                            )
                            .map((signal) => signal.signal.replaceAll("_", " "))
                            .join(" · ") || "No sufficient signals"}
                          {roleInference.competingRole
                            ? ` · competing ${speakerRoleLabel(roleInference.competingRole)}${roleInference.competingScore !== null ? ` ${roleInference.competingScore}%` : ""}`
                            : ""}
                        </p>
                        <p className="mt-1 text-[11px]">
                          This uses temporary cluster consistency, protected
                          child-scoped matches, current conversation cues, and
                          only clinician-confirmed language patterns. It never
                          identifies a person.
                        </p>
                      </div>
                    )}
                    {speaker.role === "unassigned" &&
                      roleInference.state === "unavailable" && (
                        <p
                          data-testid={`status-speaker-role-inference-unavailable-${speaker.label.replaceAll(" ", "-").toLowerCase()}`}
                          className="mt-4 rounded-xl bg-muted/45 p-3 text-xs leading-5 text-muted-foreground"
                        >
                          Role guidance is unavailable because ChildLed did not
                          have enough safe, role-relevant signals. Choose a role
                          manually.
                        </p>
                      )}
                    {singleSpeakerFastPath &&
                      speaker.role === "unassigned" &&
                      !hasUnconfirmedSuggestion && (
                        <p className="mt-4 rounded-xl bg-secondary/55 p-3 text-xs leading-5 text-muted-foreground">
                          Choose a role once to use this single-speaker
                          transcript. ChildLed will then analyze only the
                          utterances you explicitly map to Child.
                        </p>
                      )}
                    {speaker.role !== "unassigned" &&
                      speaker.role !== "unknown" && (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-secondary/35 p-3 text-xs leading-5 text-muted-foreground">
                          <p>
                            {speaker.suggestedProfileId
                              ? "A remembered profile helped with this role suggestion. It remains child-scoped and stores no raw audio or name."
                              : speaker.canRememberProfile
                                ? "You can remember this clinician-confirmed role for future sessions with this child. ChildLed stores only a protected provider characteristic, never raw audio or a name."
                                : "This transcription provider did not return a reusable speaker characteristic, so this role stays session-scoped."}
                          </p>
                          {speaker.suggestedProfileId ? (
                            <Button
                              variant="quiet"
                              className="px-3 py-2 text-xs"
                              disabled={updateTranscriptSpeakers.isPending}
                              onClick={() =>
                                void forgetSpeakerProfile(
                                  speaker.suggestedProfileId!,
                                )
                              }
                              data-testid={`button-forget-speaker-profile-${speaker.label.replaceAll(" ", "-").toLowerCase()}`}
                            >
                              Forget profile
                            </Button>
                          ) : speaker.canRememberProfile ? (
                            <Button
                              variant="outline"
                              className="px-3 py-2 text-xs"
                              disabled={updateTranscriptSpeakers.isPending}
                              onClick={() =>
                                void assignSpeakerRole(
                                  speaker.label,
                                  speaker.role,
                                  true,
                                )
                              }
                              data-testid={`button-remember-speaker-profile-${speaker.label.replaceAll(" ", "-").toLowerCase()}`}
                            >
                              Remember profile
                            </Button>
                          ) : null}
                        </div>
                      )}
                    <div className="mt-4 rounded-xl bg-muted/45 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Example utterances
                      </p>
                      {transcription.segments
                        .filter(
                          (segment) => segment.speakerLabel === speaker.label,
                        )
                        .slice(0, 2)
                        .map((segment) => (
                          <p
                            key={segment.id}
                            className="mt-2 border-l-2 border-primary/25 pl-3 text-sm leading-6 text-foreground"
                          >
                            “{segment.text}”
                          </p>
                        ))}
                    </div>
                    {!singleSpeakerFastPath &&
                      transcription.segments
                        .filter(
                          (segment) =>
                            segment.speakerLabel === speaker.label &&
                            requiresFocusedSpeakerReview(
                              segment.speakerConfidence,
                            ) &&
                            (!reviewExceptionsOnly || !segment.speakerReviewed),
                        )
                        .map((segment) => (
                          <div
                            key={segment.id}
                            className="mt-3 border-l-2 border-border pl-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                {speakerRoleLabel(segment.role)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${confidenceTone(segment.speakerConfidence)}`}
                              >
                                {reviewThresholdLabel(
                                  segment.speakerConfidence,
                                )}
                              </span>
                              {segment.speakerReviewed && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                                  Clinician corrected
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {segment.text}
                            </p>
                            {requiresFocusedSpeakerReview(
                              segment.speakerConfidence,
                            ) &&
                              !segment.speakerReviewed && (
                                <div className="mt-3 flex max-w-md flex-wrap items-end gap-2">
                                  <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-semibold text-foreground">
                                    Review this turn
                                    <select
                                      value={segment.speakerLabel}
                                      disabled={
                                        updateTranscriptSpeakers.isPending
                                      }
                                      onChange={(event) =>
                                        void correctSpeakerTurn(
                                          segment.id,
                                          event.target.value,
                                        )
                                      }
                                      data-testid={`select-low-confidence-turn-${segment.id}`}
                                      className="h-9 rounded-lg border border-input bg-background px-2 text-sm font-medium outline-none transition-shadow focus-ring"
                                    >
                                      {speakerTargets.map((label) => (
                                        <option key={label} value={label}>
                                          Move to {label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <Button
                                    variant="outline"
                                    className="h-9 px-3 text-xs"
                                    disabled={
                                      updateTranscriptSpeakers.isPending
                                    }
                                    onClick={() =>
                                      void correctSpeakerTurn(
                                        segment.id,
                                        segment.speakerLabel,
                                      )
                                    }
                                    data-testid={`button-confirm-low-confidence-turn-${segment.id}`}
                                  >
                                    Confirm cluster
                                  </Button>
                                </div>
                              )}
                          </div>
                        ))}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="mt-5 rounded-xl bg-card p-4 text-sm leading-6 text-muted-foreground">
            Your full transcript is already available while ChildLed prepares
            temporary speaker groups.
          </p>
        )}
      </section>
    ) : null;
  const identifyChildLanguagePanel =
    transcriptionStatus === "complete" &&
    transcription &&
    (Boolean(rapidReviewUtterance) ||
      Boolean(activeInboxItem) ||
      showFullTranscript) ? (
      <section
        data-testid="section-identify-child-language"
        className="flex flex-col rounded-3xl border border-accent/35 bg-accent/10 p-5 md:p-7"
      >
        <div className="order-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
              Session review ready
            </p>
            <h2 className="serif mt-1 text-2xl font-semibold">
              {rapidReviewUtterance
                ? "Identify Child Language"
                : "Review Child Phrases"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {rapidReviewUtterance
                ? "Decide whether each transcript phrase is Child language, Not Child, Unsure, or Unintelligible."
                : "Add a working meaning to keep each Child phrase, or delete anything that should not be part of this session."}
            </p>
          </div>
          {childUtterances.length > 1 && (
            <Button
              variant="outline"
              onClick={() => setShowFullTranscript((current) => !current)}
              data-testid="button-toggle-full-transcript"
            >
              {showFullTranscript
                ? "Close all decisions"
                : "Review chronologically"}
            </Button>
          )}
        </div>
        {transcriptionError && (
          <div
            role="alert"
            className="order-2 mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4"
            data-testid="status-utterance-review-error"
          >
            <p className="text-sm font-semibold text-destructive">
              That review decision was not saved
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {transcriptionError} Your transcript is preserved. Choose the
              decision again to retry.
            </p>
          </div>
        )}
        <div
          data-testid="card-review-progress"
          className="order-4 mt-5 rounded-2xl border border-primary/15 bg-card p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Review Progress
              </p>
              <p className="mt-1 text-base font-semibold">
                {child?.name ?? "Selected child"}
              </p>
              <p
                data-testid="text-review-progress-summary"
                className="mt-1 text-xs text-muted-foreground"
              >
                {transcription.reviewProgress.reviewed} of{" "}
                {transcription.reviewProgress.total} reviewed (
                {transcription.reviewProgress.total
                  ? Math.round(
                      (transcription.reviewProgress.reviewed /
                        transcription.reviewProgress.total) *
                        100,
                    )
                  : 0}
                %)
              </p>
            </div>
            <Button
              variant="primary"
              className="px-3 py-2 text-xs"
              disabled={
                updateTranscriptChildUtterances.isPending ||
                !childUtterances.length
              }
              onClick={() => void saveReviewProgress()}
              data-testid="button-save-review-progress"
            >
              {updateTranscriptChildUtterances.isPending
                ? "Saving…"
                : "Save Review Progress"}
            </Button>
          </div>
          <div
            role="progressbar"
            aria-label="Reviewed utterances"
            aria-valuemin={0}
            aria-valuemax={transcription.reviewProgress.total}
            aria-valuenow={transcription.reviewProgress.reviewed}
            className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
            data-testid="progress-review-utterances"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${transcription.reviewProgress.total ? Math.round((transcription.reviewProgress.reviewed / transcription.reviewProgress.total) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[1fr_auto] bg-muted/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Decision</span>
              <span>Count</span>
            </div>
            {[
              ["Child", transcription.reviewProgress.child],
              ["Not Child", transcription.reviewProgress.notChild],
              ["Unsure", transcription.reviewProgress.unsure],
              ["Unintelligible", transcription.reviewProgress.unintelligible],
              ["Remaining", transcription.reviewProgress.unresolved],
            ].map(([label, count]) => (
              <div
                key={label}
                className="grid grid-cols-[1fr_auto] border-t border-border px-3 py-2 text-sm"
              >
                <span
                  className={
                    label === "Remaining"
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  {label}
                </span>
                <strong className="text-primary">{count}</strong>
              </div>
            ))}
          </div>
          <p
            data-testid="text-review-next-step"
            className="mt-4 rounded-xl bg-secondary/60 px-3 py-2.5 text-sm font-semibold text-primary"
          >
            <span className="mr-1 text-xs uppercase tracking-wider text-muted-foreground">
              Next Step:
            </span>{" "}
            {transcription.reviewProgress.nextStep}
          </p>
          {reviewProgressSaved && (
            <p
              role="status"
              className="mt-3 text-xs font-semibold text-primary"
            >
              Progress saved. You can safely return on another device.
            </p>
          )}
        </div>
        <div
          data-testid="panel-completed-transcript"
          className="order-5 mt-5 rounded-2xl border border-primary/20 bg-card p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Transcript complete
              </p>
              <p className="mt-1 text-sm font-semibold">Full transcript</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The original transcript is available for reference and is never
                added to Child language evidence or documentation without your
                review.
              </p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary">
              Transcription complete
            </span>
          </div>
          <p
            data-testid="text-session-transcript"
            className="mt-4 whitespace-pre-wrap text-sm leading-7"
          >
            {completedWithNoSpeech
              ? "No clear speech was detected in this recording."
              : transcription.rawTranscript}
          </p>
        </div>
        <section
          data-testid="section-child-phrase-inbox"
          className={`${rapidReviewUtterance ? "order-6" : "order-3"} mt-5 rounded-2xl border border-primary/20 bg-card p-5`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                Child Phrase Inbox
              </p>
              <h3 className="serif mt-1 text-xl font-semibold">
                Confirmed Child language, held for review
              </h3>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
                Add a working meaning to keep this phrase in the session. You
                can edit its wording and details in the next review area before
                finalizing.
              </p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary">
              {phraseInboxQuery.data?.filter(
                (item) => item.status === "pending",
              ).length ?? 0}{" "}
              pending
            </span>
          </div>
          {phraseInboxQuery.isLoading && (
            <p className="mt-4 rounded-xl bg-muted/55 p-4 text-sm text-muted-foreground">
              Loading the saved phrase inbox…
            </p>
          )}
          {!phraseInboxQuery.isLoading && activeInboxItem && (
            <article
              data-testid={`card-phrase-inbox-${activeInboxItem.id}`}
              className="mt-4 rounded-2xl border border-accent/35 bg-accent/10 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Next phrase to review
                  </p>
                  <p className="serif mt-2 text-2xl font-semibold">
                    “{activeInboxItem.phrase}”
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {activeInboxItem.sourceLabel} · not clinical evidence yet
                  </p>
                </div>
                <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Pending
                </span>
              </div>
              <label className="mt-5 block space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Working meaning{" "}
                  <span className="font-normal normal-case tracking-normal">
                    (optional in inbox)
                  </span>
                </span>
                <textarea
                  id={`inbox-meaning-${activeInboxItem.id}`}
                  data-testid={`textarea-phrase-inbox-meaning-${activeInboxItem.id}`}
                  value={
                    inboxMeaningDrafts[activeInboxItem.id] ??
                    activeInboxItem.workingMeaning ??
                    ""
                  }
                  onChange={(event) =>
                    setInboxMeaningDrafts((current) => ({
                      ...current,
                      [activeInboxItem.id]: event.target.value,
                    }))
                  }
                  placeholder="Add a tentative meaning now, or leave this open for later review."
                  rows={3}
                  className="w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  disabled={
                    updateChildPhraseInbox.isPending ||
                    !(inboxMeaningDrafts[activeInboxItem.id] ?? "").trim()
                  }
                  onClick={() =>
                    void updatePhraseInboxItem(
                      activeInboxItem.id,
                      "pending",
                      activeInboxItem.phrase,
                    )
                  }
                  data-testid={`button-save-phrase-inbox-${activeInboxItem.id}`}
                >
                  <Check size={15} /> Keep phrase & continue
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={
                    updateChildPhraseInbox.isPending ||
                    updateTranscriptChildUtterances.isPending
                  }
                  onClick={() =>
                    void reviewChildUtterances(
                      [activeInboxItem.segmentId],
                      "not_child",
                    )
                  }
                  data-testid={`button-delete-phrase-inbox-${activeInboxItem.id}`}
                >
                  <Trash2 size={15} /> Delete phrase
                </Button>
              </div>
            </article>
          )}
          {!phraseInboxQuery.isLoading && !activeInboxItem && (
            <p className="mt-4 rounded-xl border border-dashed border-border bg-muted/35 p-4 text-sm leading-6 text-muted-foreground">
              {phraseInboxQuery.data?.some((item) => item.status === "deferred")
                ? "No pending phrases. Deferred items remain saved below for later review."
                : "Confirmed Child phrases will appear here after you classify transcript turns."}
            </p>
          )}
          {phraseInboxQuery.data?.some(
            (item) => item.status === "deferred",
          ) && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Deferred for later
              </p>
              <div className="mt-3 space-y-2">
                {phraseInboxQuery.data
                  .filter((item) => item.status === "deferred")
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">“{item.phrase}”</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.workingMeaning || "No working meaning added."}
                        </p>
                      </div>
                      <Button
                        variant="quiet"
                        className="px-3 py-2 text-xs"
                        disabled={updateChildPhraseInbox.isPending}
                        onClick={() =>
                          void updatePhraseInboxItem(
                            item.id,
                            "pending",
                            item.phrase,
                          )
                        }
                        data-testid={`button-return-phrase-inbox-${item.id}`}
                      >
                        Return to pending
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
        {audioUrl && (
          <audio
            ref={reviewAudio}
            src={audioUrl}
            preload="metadata"
            className="sr-only"
          />
        )}
        {replayError && (
          <p
            role="alert"
            className="order-3 mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            data-testid="status-phrase-replay-error"
          >
            {replayError}
          </p>
        )}
        <div
          className={`${rapidReviewUtterance || showFullTranscript ? "flex" : "hidden"} order-3 mt-5 flex-wrap items-center justify-between gap-3`}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {showFullTranscript
              ? "Complete transcript · chronological order"
              : "Prioritized review queue"}
          </p>
          {!showFullTranscript && (
            <p className="text-xs text-muted-foreground">
              One turn at a time · desktop shortcuts 1–4 · ranked by clinical
              review priority.
            </p>
          )}
        </div>
        <div
          className={`${rapidReviewUtterance || showFullTranscript ? "block" : "hidden"} order-3 mt-3 space-y-3`}
        >
          {!childUtterances.length &&
            !completedWithNoSpeech &&
            hasRawTranscript && (
              <p className="rounded-xl border border-dashed border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
                Transcript complete. Child language identification can continue
                manually.
              </p>
            )}
          {!childUtterances.length && completedWithNoSpeech && (
            <p className="rounded-xl border border-dashed border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
              Transcription completed successfully, but no clear speech was
              detected for Child Language Review.
            </p>
          )}
          {[...childUtterances]
            .sort((left, right) =>
              showFullTranscript
                ? left.position - right.position
                : left.reviewRank - right.reviewRank,
            )
            .filter(
              (utterance) =>
                showFullTranscript ||
                utterance.segmentId === rapidReviewUtterance?.segmentId,
            )
            .map((utterance) => {
              const notes = utteranceNotes[utterance.segmentId];
              const contextValue = notes?.context ?? utterance.context ?? "";
              const meaningValue = notes?.meaning ?? utterance.meaning ?? "";
              const interpretationValue =
                notes?.interpretation ?? utterance.interpretation ?? "";
              const noteValue = notes?.note ?? utterance.note ?? "";
              const isPartial =
                utterance.intelligibility === "partially_intelligible";
              const providerUnintelligible =
                utterance.intelligibility === "unintelligible";
              const transcriptionConfirmed =
                utterance.intelligibilityReviewStatus === "confirmed";
              const timestamp =
                utterance.timestampSeconds === null
                  ? ""
                  : `${Math.floor(utterance.timestampSeconds / 60)}:${Math.floor(
                      utterance.timestampSeconds % 60,
                    )
                      .toString()
                      .padStart(2, "0")}`;
              const status =
                utterance.disposition === "child" ||
                utterance.disposition === "confirmed_gestalt"
                  ? "Child"
                  : utterance.disposition === "not_child" ||
                      utterance.disposition === "not_gestalt"
                    ? "Not Child"
                    : utterance.disposition === "unsure" ||
                        utterance.disposition === "context"
                      ? "Unsure"
                      : utterance.disposition === "unintelligible" ||
                          utterance.disposition === "unlabeled"
                        ? "Unintelligible"
                        : "Needs review";
              return (
                <article
                  key={utterance.segmentId}
                  data-testid={`card-utterance-${utterance.segmentId}`}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {!showFullTranscript && (
                          <span>Priority {utterance.reviewRank}</span>
                        )}
                        {timestamp && <span>{timestamp}</span>}
                        {utterance.transcriptionConfidenceScore !== null && (
                          <span>
                            {utterance.transcriptionConfidenceScore}% confidence
                          </span>
                        )}
                      </div>
                      <p
                        className={`mt-2 text-sm leading-6 ${providerUnintelligible ? "italic text-muted-foreground" : "text-foreground"}`}
                      >
                        {providerUnintelligible
                          ? "[Unintelligible]"
                          : `“${utterance.text}”`}
                      </p>
                      {isPartial && utterance.suggestedTranscription && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Approximate phonetic rendering: “
                          {utterance.suggestedTranscription}”
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {utterance.priorityReasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-primary"
                      >
                        {reason.replace("_", " ")}
                      </span>
                    ))}
                    {utterance.repeatedInSession > 1 && (
                      <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-primary">
                        heard {utterance.repeatedInSession}×
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="px-3 py-2 text-xs"
                      disabled={
                        !audioUrl ||
                        utterance.timestampSeconds === null ||
                        !(
                          utterance.durationSeconds &&
                          utterance.durationSeconds > 0
                        )
                      }
                      onClick={() =>
                        void playUtterance(
                          utterance.timestampSeconds,
                          utterance.durationSeconds,
                        )
                      }
                      data-testid={`button-play-utterance-${utterance.segmentId}`}
                      title={
                        utterance.timestampSeconds === null
                          ? "Phrase timing is unavailable for this older transcript."
                          : "Play only this transcribed phrase"
                      }
                    >
                      <Play size={14} />
                      {utterance.timestampSeconds === null
                        ? "Replay unavailable"
                        : "Replay phrase"}
                    </Button>
                    {isPartial && !transcriptionConfirmed && (
                      <Button
                        variant="outline"
                        className="px-3 py-2 text-xs"
                        disabled={updateTranscriptChildUtterances.isPending}
                        onClick={() =>
                          void reviewChildUtterances(
                            [utterance.segmentId],
                            utterance.disposition,
                            { intelligibilityReviewStatus: "confirmed" },
                          )
                        }
                      >
                        Confirm wording
                      </Button>
                    )}
                    <Button
                      aria-keyshortcuts="1"
                      variant={status === "Child" ? "primary" : "outline"}
                      className="min-h-11 px-3 py-2 text-xs"
                      disabled={
                        updateTranscriptChildUtterances.isPending ||
                        providerUnintelligible ||
                        (isPartial && !transcriptionConfirmed)
                      }
                      onClick={() =>
                        void reviewChildUtterances(
                          [utterance.segmentId],
                          "child",
                        )
                      }
                      data-testid={`button-utterance-child-${utterance.segmentId}`}
                    >
                      <span className="hidden md:inline">1 · </span>Child
                    </Button>
                    <Button
                      aria-keyshortcuts="2"
                      variant={status === "Not Child" ? "primary" : "outline"}
                      className="min-h-11 px-3 py-2 text-xs"
                      disabled={updateTranscriptChildUtterances.isPending}
                      onClick={() =>
                        void reviewChildUtterances(
                          [utterance.segmentId],
                          "not_child",
                        )
                      }
                      data-testid={`button-utterance-not-child-${utterance.segmentId}`}
                    >
                      <span className="hidden md:inline">2 · </span>Not Child
                    </Button>
                    <Button
                      aria-keyshortcuts="3"
                      variant={status === "Unsure" ? "primary" : "outline"}
                      className="min-h-11 px-3 py-2 text-xs"
                      disabled={updateTranscriptChildUtterances.isPending}
                      onClick={() =>
                        void reviewChildUtterances(
                          [utterance.segmentId],
                          "unsure",
                        )
                      }
                      data-testid={`button-utterance-unsure-${utterance.segmentId}`}
                    >
                      <span className="hidden md:inline">3 · </span>Unsure
                    </Button>
                    <Button
                      aria-keyshortcuts="4"
                      variant={
                        status === "Unintelligible" ? "primary" : "outline"
                      }
                      className="min-h-11 px-3 py-2 text-xs"
                      disabled={updateTranscriptChildUtterances.isPending}
                      onClick={() =>
                        void reviewChildUtterances(
                          [utterance.segmentId],
                          "unintelligible",
                          { intelligibilityReviewStatus: "unlabeled" },
                        )
                      }
                      data-testid={`button-utterance-unintelligible-${utterance.segmentId}`}
                    >
                      <span className="hidden md:inline">4 · </span>
                      Unintelligible
                    </Button>
                  </div>
                  {status === "Child" && !providerUnintelligible && (
                    <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-primary/15 bg-secondary/25 p-3">
                      <label className="flex min-w-52 flex-1 flex-col gap-1.5 text-xs font-semibold text-foreground">
                        <span>
                          NLA Stage{" "}
                          <span className="font-normal text-muted-foreground">
                            (optional)
                          </span>
                        </span>
                        <select
                          value={utterance.nlaStage ?? ""}
                          aria-label={`NLA Stage for utterance ${utterance.segmentId}; current value ${nlaStageLabel(utterance.nlaStage)}`}
                          disabled={updateTranscriptChildUtterances.isPending}
                          onChange={(event) => {
                            setReviewProgressSaved(false);
                            void reviewChildUtterances(
                              [utterance.segmentId],
                              utterance.disposition,
                              {
                                nlaStage: (event.target.value ||
                                  null) as NlaStage | null,
                              },
                            );
                          }}
                          data-testid={`select-nla-stage-${utterance.segmentId}`}
                          className="h-10 rounded-lg border border-input bg-background px-2 text-sm font-medium outline-none transition-shadow focus-ring"
                        >
                          <option value="">Not Yet Assigned</option>
                          <option value="stage_0">Stage 0</option>
                          <option value="stage_1">Stage 1</option>
                          <option value="stage_2">Stage 2</option>
                          <option value="stage_3">Stage 3</option>
                          <option value="stage_4_plus">Stage 4+</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        aria-label="Open NLA Stage reference guide"
                        className="mb-1 rounded-full p-2 text-primary hover:bg-secondary focus-ring"
                        onClick={(event) => {
                          nlaGuideTriggerRef.current = event.currentTarget;
                          setNlaGuideOpen(true);
                        }}
                        data-testid={`button-nla-stage-help-${utterance.segmentId}`}
                      >
                        <CircleHelp size={18} />
                      </button>
                    </div>
                  )}
                  {(status === "Child" ||
                    status === "Unsure" ||
                    providerUnintelligible) && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {!providerUnintelligible && (
                        <textarea
                          value={contextValue}
                          onChange={(event) => {
                            setReviewProgressSaved(false);
                            setUtteranceNote(
                              utterance.segmentId,
                              "context",
                              event.target.value,
                            );
                          }}
                          placeholder="Optional context"
                          rows={2}
                          className="resize-y rounded-lg border border-input bg-background p-2 text-xs outline-none focus-ring"
                        />
                      )}
                      {!providerUnintelligible && (
                        <textarea
                          value={meaningValue}
                          onChange={(event) => {
                            setReviewProgressSaved(false);
                            setUtteranceNote(
                              utterance.segmentId,
                              "meaning",
                              event.target.value,
                            );
                          }}
                          placeholder="Working meaning (optional in inbox; required for dictionary)"
                          rows={2}
                          className="resize-y rounded-lg border border-input bg-background p-2 text-xs outline-none focus-ring"
                        />
                      )}
                      {providerUnintelligible && (
                        <textarea
                          value={interpretationValue}
                          onChange={(event) => {
                            setReviewProgressSaved(false);
                            setUtteranceNote(
                              utterance.segmentId,
                              "interpretation",
                              event.target.value,
                            );
                          }}
                          placeholder="Optional clinician interpretation; never treated as transcript text"
                          rows={2}
                          className="resize-y rounded-lg border border-input bg-background p-2 text-xs outline-none focus-ring"
                        />
                      )}
                      {providerUnintelligible && (
                        <textarea
                          value={noteValue}
                          onChange={(event) => {
                            setReviewProgressSaved(false);
                            setUtteranceNote(
                              utterance.segmentId,
                              "note",
                              event.target.value,
                            );
                          }}
                          placeholder="Observation note"
                          rows={2}
                          className="resize-y rounded-lg border border-input bg-background p-2 text-xs outline-none focus-ring"
                        />
                      )}
                    </div>
                  )}
                </article>
              );
            })}
        </div>
        <p className="order-7 mt-4 text-xs leading-5 text-muted-foreground">
          Safety rule: a Child decision creates a reviewable inbox item, not
          evidence. Only a meaning-backed phrase completed through dictionary
          review can affect documentation, reports, insights, Communication
          Passports, AAC planning, or analytics. Not Child, Unsure,
          Unintelligible, and deferred items remain excluded.
        </p>
        {nlaGuideOpen && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-primary/50 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setNlaGuideOpen(false);
            }}
          >
            <section
              ref={nlaGuideDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="nla-stage-guide-title"
              className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl md:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                    Reference guide
                  </p>
                  <h2
                    id="nla-stage-guide-title"
                    className="serif mt-1 text-2xl font-semibold"
                  >
                    NLA Stage, for clinician reference
                  </h2>
                </div>
                <button
                  ref={nlaGuideCloseRef}
                  type="button"
                  aria-label="Close NLA Stage reference guide"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted focus-ring"
                  onClick={() => setNlaGuideOpen(false)}
                  data-testid="button-close-nla-stage-help"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm leading-6 text-foreground">
                <strong>
                  This is reference material, not an automated assessment.
                </strong>{" "}
                Assign a stage only when your clinical observation supports it.
                ChildLed does not infer, recommend, or apply an NLA Stage.
              </p>
              <div className="mt-6 space-y-5 text-sm leading-6 text-muted-foreground">
                <div>
                  <h3 className="font-semibold text-foreground">
                    What the stages describe
                  </h3>
                  <p className="mt-1">
                    Natural Language Acquisition stages describe broad patterns
                    in how a child may use language. They are not a measure of
                    ability, a diagnosis, or a fixed sequence that every child
                    follows.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    Clinical characteristics and examples
                  </h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {[
                      [
                        "Stage 0",
                        "Early gestalts or scripts may be difficult to interpret. Look for meaningful context, intonation, and repeated routines.",
                        "“mm-hmm,” a familiar melody, or a repeated sound during a routine.",
                      ],
                      [
                        "Stage 1",
                        "Gestalts are used as meaningful units, often tied to a situation, person, or emotional state.",
                        "“Let’s get out of here!” used when a transition is ending.",
                      ],
                      [
                        "Stage 2",
                        "Mitigated or shortened gestalts begin to show flexible combinations while still carrying familiar chunks.",
                        "“Get out,” “let’s go out,” or another meaningful variation of a known script.",
                      ],
                      [
                        "Stage 3",
                        "Single words and self-generated combinations are used more flexibly across contexts.",
                        "“More bubbles,” “red car,” or a new combination used to communicate.",
                      ],
                      [
                        "Stage 4+",
                        "More advanced grammar and novel language may emerge, with increasing flexibility and complexity.",
                        "A novel sentence with flexible grammar used for a specific idea.",
                      ],
                    ].map(([title, characteristic, example]) => (
                      <div key={title} className="rounded-xl bg-muted/45 p-4">
                        <p className="font-semibold text-foreground">{title}</p>
                        <p className="mt-1">{characteristic}</p>
                        <p className="mt-2 border-l-2 border-primary/25 pl-3 text-foreground">
                          Example: {example}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    How to differentiate nearby stages
                  </h3>
                  <p className="mt-1">
                    Compare the utterance with the child’s established language
                    across the interaction. Ask whether it is a whole familiar
                    script, a meaningful variation of a script, or a newly
                    generated combination. Consider context and communicative
                    purpose, and leave the field Not Yet Assigned when the
                    evidence is not sufficient.
                  </p>
                </div>
              </div>
              <div className="mt-7 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => setNlaGuideOpen(false)}
                  data-testid="button-done-nla-stage-help"
                >
                  Done
                </Button>
              </div>
            </section>
          </div>
        )}
      </section>
    ) : null;
  const provisionalCandidateQueue =
    transcriptionStatus === "complete" &&
    transcription &&
    transcription.provisionalPhrases.length > 0 &&
    transcription.phrases.length === 0 ? (
      <div
        data-testid="section-provisional-phrases"
        className="mt-8 rounded-2xl border border-accent/40 bg-accent/5 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
              Actionable Provisional Candidates
            </p>
            <p className="mt-1 text-sm font-semibold">
              Phrases awaiting Child review
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              ChildLed found reviewable language patterns in the completed
              transcript. These stay provisional until you identify Child
              language and complete clinical review.
            </p>
          </div>
          <span className="rounded-full bg-card px-3 py-1.5 text-xs font-bold text-accent-foreground">
            {
              transcription.provisionalPhrases.filter(
                (p) => p.disposition === "pending",
              ).length
            }{" "}
            pending
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {transcription.provisionalPhrases.map((phrase) => {
            const notes = provisionalNotes[phrase.id];
            const phraseValue = notes?.phrase ?? phrase.phrase;
            const meaningValue =
              notes?.workingMeaning ?? phrase.workingMeaning ?? "";
            const status =
              phrase.disposition === "pending"
                ? "Needs review"
                : phrase.disposition === "approved"
                  ? "Approved"
                  : phrase.disposition === "flagged"
                    ? "Flagged"
                    : phrase.disposition === "saved_for_later"
                      ? "Saved for later"
                      : "Dismissed";

            return (
              <div
                key={phrase.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      “{phraseValue}”
                    </p>
                    {phrase.frequency > 1 && (
                      <span className="text-[10px] font-bold text-muted-foreground">
                        Heard {phrase.frequency}x
                      </span>
                    )}
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {status}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                    {phrase.evidenceLabel}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <textarea
                    value={phraseValue}
                    onChange={(e) =>
                      setProvisionalNote(phrase.id, "phrase", e.target.value)
                    }
                    placeholder="Edit phrase text..."
                    rows={2}
                    disabled={updateTranscriptProvisionalPhrases.isPending}
                    data-testid={`textarea-provisional-phrase-${phrase.id}`}
                    className="resize-y rounded-lg border border-input bg-background p-2 text-xs outline-none focus-ring"
                  />
                  <textarea
                    value={meaningValue}
                    onChange={(e) =>
                      setProvisionalNote(
                        phrase.id,
                        "workingMeaning",
                        e.target.value,
                      )
                    }
                    placeholder="Clinician working meaning..."
                    rows={2}
                    disabled={updateTranscriptProvisionalPhrases.isPending}
                    data-testid={`textarea-provisional-meaning-${phrase.id}`}
                    className="resize-y rounded-lg border border-input bg-background p-2 text-xs outline-none focus-ring"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="px-3 py-2 text-xs"
                    disabled={
                      updateTranscriptProvisionalPhrases.isPending ||
                      !phraseValue.trim()
                    }
                    onClick={() =>
                      void reviewProvisionalPhrase(phrase.id, "approved")
                    }
                    data-testid={`button-provisional-approve-${phrase.id}`}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="quiet"
                    className="px-3 py-2 text-xs"
                    disabled={
                      updateTranscriptProvisionalPhrases.isPending ||
                      !phraseValue.trim()
                    }
                    onClick={() =>
                      void reviewProvisionalPhrase(phrase.id, "flagged")
                    }
                    data-testid={`button-provisional-flag-${phrase.id}`}
                  >
                    Flag
                  </Button>
                  <Button
                    variant="quiet"
                    className="px-3 py-2 text-xs"
                    disabled={updateTranscriptProvisionalPhrases.isPending}
                    onClick={() =>
                      void reviewProvisionalPhrase(phrase.id, "saved_for_later")
                    }
                    data-testid={`button-provisional-save-later-${phrase.id}`}
                  >
                    Save for later
                  </Button>
                  <Button
                    variant="quiet"
                    className="px-3 py-2 text-xs"
                    disabled={updateTranscriptProvisionalPhrases.isPending}
                    onClick={() =>
                      void reviewProvisionalPhrase(phrase.id, "dismissed")
                    }
                    data-testid={`button-provisional-dismiss-${phrase.id}`}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  const transcriptionPanel =
    audioBlob || transcription ? (
      <section
        data-testid="section-session-transcript"
        className="rounded-3xl border border-border bg-card p-6 md:p-8"
      >
        {identifyChildLanguagePanel}
        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
              {transcriptionPending
                ? "Processing recording"
                : "Automatic transcript"}
            </p>
            <h2 className="serif mt-2 text-2xl font-semibold">
              {transcriptionPending
                ? "Preparing your transcript"
                : "Draft phrases from the recording"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {transcriptionPending
                ? "Keep this page open while ChildLed processes the recording. Nothing needs your attention yet."
                : "These are reviewable suggestions—not confirmed meanings or clinical interpretations."}
            </p>
          </div>
          {transcriptionStatus === "complete" && (
            <div className="flex flex-wrap items-center gap-2">
              {childUtterances.length > 0 &&
                !rapidReviewUtterance &&
                !showFullTranscript && (
                  <Button
                    variant="outline"
                    className="min-h-11 px-3 text-xs"
                    onClick={() => setShowFullTranscript(true)}
                    data-testid="button-review-transcript-decisions"
                  >
                    <ClipboardList size={15} /> Review transcript decisions
                  </Button>
                )}
              <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary">
                {transcription?.phrases.length ?? 0} likely phrase
                {transcription?.phrases.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
        {transcriptionPending && (
          <div
            data-testid="status-transcription-processing"
            className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary/55 p-5"
          >
            <Sparkles className="animate-pulse text-primary" size={20} />
            <div>
              <p className="text-sm font-semibold">
                {transcriptionProgressTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This screen will update automatically when the transcript is
                ready.
              </p>
            </div>
          </div>
        )}
        {transcriptionStatus === "error" && (
          <div
            data-testid="status-transcription-error"
            className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-5"
          >
            <p className="text-sm font-semibold text-destructive">
              {audioBlob
                ? "Transcription was not completed"
                : "Recording was not captured"}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {transcriptionError ||
                "The recording and manual review are still available."}
            </p>
            {audioBlob && (
              <Button
                className="mt-4"
                variant="outline"
                onClick={() =>
                  void uploadAndTranscribe(audioBlob, uploadedAudioId)
                }
                disabled={transcriptionPending}
                data-testid="button-retry-transcription"
              >
                <RotateCcw size={15} /> Retry transcription
              </Button>
            )}
          </div>
        )}
        {transcriptionStatus === "complete" && transcription && (
          <div className="mt-6 space-y-5">
            {transcription.phrases.length > 0 && (
              <div className="grid gap-4">
                {transcription.phrases.map((detected) => {
                  const capturedPhrase = captured.find(
                    (item) => item.transcriptPhraseId === detected.id,
                  );
                  const included = Boolean(capturedPhrase);
                  const ignored = ignoredTranscriptPhraseIds.includes(
                    detected.id,
                  );
                  const routine = capturedPhrase?.reviewState === "routine";
                  const guidance = transcriptGuidanceFor(
                    detected.phrase,
                    detected.frequency,
                    Boolean(
                      matchingGestalt(detected.phrase) ??
                      detected.existingGestalt,
                    ),
                  );
                  return (
                    <article
                      key={detected.id}
                      data-testid={`card-transcript-phrase-${detected.id}`}
                      className={`rounded-2xl border p-5 ${detected.existingGestalt ? "border-accent/45 bg-secondary/35" : "border-border bg-background"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="serif text-xl font-semibold">
                            “{detected.phrase}”
                          </p>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">
                            This session: {detected.frequency} · lifetime
                            occurrences: {detected.occurrenceCount}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            First observed:{" "}
                            {detected.firstObservedAt
                              ? new Date(
                                  detected.firstObservedAt,
                                ).toLocaleDateString()
                              : "This review"}{" "}
                            · Most recent:{" "}
                            {detected.mostRecentAt
                              ? new Date(
                                  detected.mostRecentAt,
                                ).toLocaleDateString()
                              : "This review"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {routine ? (
                            <span
                              data-testid={`status-routine-transcript-phrase-${detected.id}`}
                              className="inline-flex items-center gap-1 rounded-xl bg-accent/25 px-3 py-2 text-xs font-bold text-primary"
                            >
                              <Check size={14} /> Included automatically
                            </span>
                          ) : ignored ? (
                            <Button
                              variant="outline"
                              onClick={() => toggleTranscriptPhrase(detected)}
                              data-testid={`button-toggle-transcript-phrase-${detected.id}`}
                            >
                              <Plus size={14} /> Bring back
                            </Button>
                          ) : (
                            <span className="inline-flex items-center rounded-xl bg-muted px-3 py-2 text-xs font-bold text-muted-foreground">
                              {included
                                ? "Needs clinical review"
                                : "Waiting for review"}
                            </span>
                          )}
                          {routine && capturedPhrase ? (
                            <>
                              <Button
                                variant="quiet"
                                className="px-3 text-xs"
                                onClick={() =>
                                  reopenRoutinePhrase(capturedPhrase.id)
                                }
                                data-testid={`button-review-routine-phrase-${detected.id}`}
                              >
                                Add context
                              </Button>
                              <Button
                                disabled={deleteTranscriptPhrase.isPending}
                                variant="quiet"
                                className="px-3 text-xs text-muted-foreground"
                                onClick={() =>
                                  void ignoreTranscriptPhrase(detected)
                                }
                                data-testid={`button-ignore-transcript-phrase-${detected.id}`}
                              >
                                <Trash2 size={14} /> Delete phrase
                              </Button>
                            </>
                          ) : (
                            <>
                              {capturedPhrase && !ignored && (
                                <Button
                                  variant="outline"
                                  className="px-3 text-xs"
                                  onClick={() =>
                                    document
                                      .getElementById(
                                        `review-phrase-${capturedPhrase.id}`,
                                      )
                                      ?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start",
                                      })
                                  }
                                  data-testid={`button-edit-transcript-phrase-${detected.id}`}
                                >
                                  <ClipboardList size={14} /> Review phrase
                                </Button>
                              )}
                              <Button
                                disabled={
                                  !detected.childAttributed ||
                                  ignored ||
                                  deleteTranscriptPhrase.isPending
                                }
                                variant="quiet"
                                className="px-3 text-xs text-muted-foreground"
                                onClick={() =>
                                  void ignoreTranscriptPhrase(detected)
                                }
                                data-testid={`button-ignore-transcript-phrase-${detected.id}`}
                              >
                                <Trash2 size={14} /> Delete phrase
                              </Button>
                            </>
                          )}
                        </div>
                        {detected.exampleUtterances.length > 0 && (
                          <div className="mt-4 rounded-xl bg-muted/50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Example utterances
                            </p>
                            {detected.exampleUtterances.map(
                              (example, index) => (
                                <p
                                  key={`${detected.id}-${index}`}
                                  className="mt-1 text-xs leading-5 text-muted-foreground"
                                >
                                  “{example}”
                                </p>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                      <details className="mt-4 rounded-xl bg-muted/65 p-4">
                        <summary className="cursor-pointer text-xs font-bold uppercase text-muted-foreground">
                          Clinical review prompts
                        </summary>
                        <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                          <p>
                            <span className="font-semibold text-foreground">
                              Language sample:
                            </span>{" "}
                            {guidance.pattern}
                          </p>
                          <p>
                            <span className="font-semibold text-foreground">
                              Communication function:
                            </span>{" "}
                            {guidance.functionPrompt}
                          </p>
                          <p>
                            <span className="font-semibold text-foreground">
                              Mitigation review:
                            </span>{" "}
                            {guidance.mitigationPrompt}
                          </p>
                          <p>
                            <span className="font-semibold text-foreground">
                              Coaching insight:
                            </span>{" "}
                            {guidance.coachingPrompt}
                          </p>
                        </div>
                      </details>
                      {detected.existingGestalt ? (
                        <div className="mt-4 rounded-xl bg-card p-4">
                          <p className="mono text-[10px] font-bold uppercase tracking-[.15em] text-primary">
                            Existing Gestalt Found
                          </p>
                          <p className="mt-2 text-sm font-semibold">Meaning</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {detected.existingGestalt.meaning}
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                            <div>
                              <p className="font-bold uppercase tracking-wider text-muted-foreground">
                                Occurrences
                              </p>
                              <p className="mt-1 text-sm font-semibold text-foreground">
                                {detected.existingGestalt.occurrences}
                              </p>
                            </div>
                            <div>
                              <p className="font-bold uppercase tracking-wider text-muted-foreground">
                                Last seen
                              </p>
                              <p className="mt-1 text-sm font-semibold text-foreground">
                                {detected.existingGestalt.lastSeen
                                  ? timeAgo(detected.existingGestalt.lastSeen)
                                  : "Not recorded"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl bg-secondary/40 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            New phrase candidate
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            This is held in the exception queue until the
                            clinician confirms meaning, function, context, and
                            documentation use.
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    ) : null;

  const hasPreservedUnclearSpeech = Boolean(
    transcription?.childUtterances.some(
      (utterance) =>
        utterance.intelligibility === "unintelligible" ||
        utterance.intelligibility === "partially_intelligible",
    ),
  );
  const canFinalize =
    !transcriptionPending &&
    !unresolvedChildUtteranceReview &&
    exceptionCaptured.length === 0 &&
    (captured.length > 0 ||
      hasPreservedUnclearSpeech ||
      hasCompletedTranscriptReview);
  const beginFinalize = () => {
    if (!canFinalize) return;
    setSaveError("");
    setStage("finalize");
    setFinalizePreparing(true);
    window.setTimeout(() => {
      if (!sessionNoteEdited) setSessionNote(summaryFor());
      setFinalizePreparing(false);
    }, 250);
  };
  useEffect(() => {
    if (stage !== "finalize" || sessionNoteEdited || finalizePreparing) return;
    setSessionNote(summaryFor());
  }, [
    captured,
    elapsed,
    finalizePreparing,
    nextSteps,
    observations,
    sessionNoteEdited,
    stage,
  ]);
  useEffect(() => {
    if (stage === "capture" && !recording) return;
    const positionWorkflow = () => {
      const header = workflowHeaderRef.current;
      if (!header) return;
      const shellHeader = header
        .closest("main")
        ?.querySelector<HTMLElement>(":scope > div.sticky");
      const shellOffset = Math.ceil(
        shellHeader?.getBoundingClientRect().height ?? 0,
      );
      header.style.top = `${shellOffset + 8}px`;
      header.style.scrollMarginTop = `${shellOffset + 8}px`;
    };
    positionWorkflow();
    window.addEventListener("resize", positionWorkflow);
    const timeout = window.setTimeout(() => {
      positionWorkflow();
      const header = workflowHeaderRef.current;
      const container = header?.parentElement;
      if (!header || !container) return;
      const targetTop =
        window.scrollY +
        container.getBoundingClientRect().top -
        Number.parseFloat(header.style.top || "0");
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", positionWorkflow);
    };
  }, [recording, stage]);
  const workflowLabels = ["Start", "Record", "Review", "Finalize", "Complete"];
  const currentWorkflowStep =
    stage === "capture"
      ? 1
      : stage === "review"
        ? 2
        : stage === "finalize"
          ? 3
          : 4;
  const currentWorkflowLabel =
    stage === "review" && transcriptionPending
      ? "Transcribing"
      : workflowLabels[currentWorkflowStep];
  const workflowProgress = (
    <nav
      ref={workflowHeaderRef}
      aria-label="Recording workflow progress"
      className="sticky top-2 z-30 rounded-xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur sm:rounded-2xl sm:p-4"
      data-testid="recording-workflow-progress"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mono text-[10px] font-bold uppercase text-muted-foreground">
            Step {currentWorkflowStep + 1} of {workflowLabels.length}
          </p>
          <p className="mt-0.5 text-sm font-semibold">{currentWorkflowLabel}</p>
        </div>
        {stage !== "saved" && (
          <Button
            variant="quiet"
            className="min-h-11 px-3 text-destructive hover:text-destructive"
            onClick={() => setDiscardModalOpen(true)}
            disabled={createSession.isPending}
            data-testid="button-end-recording-session"
          >
            <X size={16} /> End session
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2" aria-hidden="true">
        {workflowLabels.map((label, index) => (
          <span
            key={label}
            className={`h-2 rounded-full ${index <= currentWorkflowStep ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      <div className="mt-2 hidden grid-cols-5 gap-2 text-center text-[10px] font-semibold text-muted-foreground sm:grid">
        {workflowLabels.map((label, index) => (
          <span
            key={label}
            className={index === currentWorkflowStep ? "text-primary" : ""}
          >
            {label}
          </span>
        ))}
      </div>
    </nav>
  );
  const hasPersistedDraft = Boolean(
    transcription?.id || resumeTranscriptId || uploadedAudioId,
  );
  const discardModal = discardModalOpen ? (
    <Modal title="End this session?" onClose={() => setDiscardModalOpen(false)}>
      <div className="space-y-5" data-testid="dialog-end-recording-session">
        <p className="text-sm leading-6 text-muted-foreground">
          {hasPersistedDraft
            ? "This unfinished recording can be kept for later or permanently deleted with its transcript and review work."
            : "This session has not created a saved recording draft. You can start over or leave without creating a session."}
        </p>
        {audioPreparationPending && (
          <p className="rounded-xl bg-secondary p-3 text-sm text-primary">
            Please wait for the secure upload to finish before leaving or
            deleting this session.
          </p>
        )}
        {deleteError && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {deleteError}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="quiet"
            className="min-h-12"
            onClick={() => setDiscardModalOpen(false)}
            disabled={deleteSessionDraft.isPending}
          >
            Keep working
          </Button>
          {hasPersistedDraft && (
            <Button
              variant="outline"
              className="min-h-12"
              onClick={leaveSessionForLater}
              disabled={audioPreparationPending || deleteSessionDraft.isPending}
              data-testid="button-save-session-for-later"
            >
              <Clock3 size={16} /> Save for later & leave
            </Button>
          )}
          <Button
            variant="outline"
            className="min-h-12 border-destructive/30 text-destructive hover:border-destructive/60 hover:text-destructive"
            onClick={() => void permanentlyDeleteCurrentSession(true)}
            disabled={audioPreparationPending || deleteSessionDraft.isPending}
            data-testid="button-discard-and-restart-session"
          >
            <RotateCcw size={16} /> Delete & start over
          </Button>
          <Button
            className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => void permanentlyDeleteCurrentSession(false)}
            disabled={audioPreparationPending || deleteSessionDraft.isPending}
            data-testid="button-discard-and-exit-session"
          >
            <Trash2 size={16} />
            {deleteSessionDraft.isPending ? "Deleting…" : "Delete & leave"}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Permanent deletion cannot be undone. Required security audit records
          do not contain the recording or transcript.
        </p>
      </div>
    </Modal>
  ) : null;
  const reviewActionLabel = transcriptionPending
    ? transcriptionStatus === "uploading"
      ? "Uploading recording…"
      : "Transcribing recording…"
    : unresolvedChildUtteranceReview
      ? "Review uncertain speech to continue"
      : exceptionCaptured.length
        ? `Resolve ${exceptionCaptured.length} phrase${exceptionCaptured.length === 1 ? "" : "s"} to continue`
        : "Continue to finalize";
  const workflowActionBar =
    (stage === "capture" && recording) ||
    (stage === "review" && !transcriptionPending) ||
    stage === "finalize"
      ? createPortal(
          <div className="pointer-events-none fixed inset-x-2 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 sm:inset-x-3 md:bottom-4 lg:left-[16.75rem]">
            <div className="pointer-events-auto mx-auto max-w-4xl rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
              {stage === "finalize" && saveError && (
                <p
                  role="alert"
                  className="mb-2 px-1 text-xs font-semibold text-destructive"
                >
                  {saveError}
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="hidden min-w-0 sm:block">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Next action
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {stage === "capture"
                      ? "Recording controls"
                      : stage === "review"
                        ? closeoutCopy.title
                        : "Confirm and save this session"}
                  </p>
                </div>
                {stage === "capture" ? (
                  <div className="flex w-full gap-3">
                    <Button
                      variant="outline"
                      className="min-h-12 flex-1"
                      onClick={togglePause}
                      data-testid="button-pause-recording"
                    >
                      {paused ? <Play size={16} /> : <Pause size={16} />}
                      {paused ? "Resume" : "Pause"}
                    </Button>
                    <Button
                      variant="warm"
                      className="min-h-12 flex-1"
                      onClick={finishRecording}
                      data-testid="button-stop-recording"
                    >
                      <Square size={15} fill="currentColor" /> Stop & review
                    </Button>
                  </div>
                ) : stage === "review" ? (
                  <Button
                    className="min-h-12 w-full sm:w-auto"
                    onClick={beginFinalize}
                    disabled={!canFinalize}
                    data-testid="button-continue-to-finalize"
                  >
                    {reviewActionLabel} <ArrowRight size={16} />
                  </Button>
                ) : (
                  <Button
                    className="min-h-12 w-full sm:w-auto"
                    onClick={() => void saveSession()}
                    disabled={
                      finalizePreparing ||
                      createSession.isPending ||
                      uploadAudio.isPending ||
                      !consentConfirmedAt ||
                      !canFinalize
                    }
                    data-testid="button-save-session"
                  >
                    {finalizePreparing
                      ? "Preparing summary…"
                      : createSession.isPending || uploadAudio.isPending
                        ? "Saving and generating note…"
                        : saveError
                          ? "Retry finalization"
                          : "Save session & generate note"}{" "}
                    <ArrowRight size={16} />
                  </Button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  if (consentModalOpen && stage === "capture") return consentModal;

  if (
    stage === "capture" &&
    !recording &&
    !audioBlob &&
    !audioError &&
    handledStartRequestToken.current === startRequestToken
  )
    return null;

  if (stage === "saved")
    return (
      <div className="mx-auto max-w-4xl space-y-7">
        {workflowProgress}
        <SectionHeading
          eyebrow="Session complete"
          title="Session saved successfully."
          description={`${captured.length} reviewed phrase${captured.length === 1 ? "" : "s"} and the session note are now available to ${child?.name ?? "the care team"}.`}
          action={
            <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <Link
                href={`/reports?childId=${childId}${savedSession?.id ? `&sessionId=${savedSession.id}` : ""}`}
                data-testid="button-draft-ai-session-note"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-primary focus-ring"
              >
                <FileText size={16} /> Open session report
              </Link>
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                onClick={resetSession}
              >
                <RotateCcw size={16} /> New session
              </Button>
            </div>
          }
        />
        <section className="rounded-3xl bg-primary p-5 text-primary-foreground sm:p-7 md:p-10">
          <div className="flex items-center gap-3 text-accent">
            <span className="grid size-10 place-items-center rounded-full bg-accent/15">
              <Check size={19} />
            </span>
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[.18em]">
                Saved for the care team
              </p>
              <p className="text-sm text-primary-foreground/65">
                {formattedTime} session ·{" "}
                {savedSession?.createdBy ?? "SLP review"}
              </p>
            </div>
          </div>
          <pre className="mt-7 whitespace-pre-wrap rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-5 font-sans text-sm leading-6 text-primary-foreground/85">
            {savedSession?.note}
          </pre>
          <p className="mt-4 text-xs leading-5 text-primary-foreground/65">
            The full recording was deleted after the session note was saved.
            Only short clips of reviewed unclear moments are retained for the
            Unclear Speech review.
          </p>
        </section>
        {savedSession?.audioUrl && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Private session recording</p>
            <audio
              className="mt-3 w-full"
              controls
              src={savedSession.audioUrl}
            />
          </section>
        )}
      </div>
    );

  if (stage === "review" && transcriptionPending)
    return (
      <div className="mx-auto max-w-4xl space-y-5 pb-8">
        {workflowProgress}
        <section
          role="status"
          aria-live="polite"
          data-testid="status-transcription-processing"
          className="rounded-3xl border border-border bg-card p-5 soft-shadow sm:p-6 md:p-10"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
            <Sparkles className="animate-pulse" size={22} />
          </span>
          <p className="mono mt-6 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
            Preparing review
          </p>
          <h1 className="serif mt-2 text-3xl font-semibold md:text-4xl">
            Transcription is loading.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {transcriptionProgressBody}
          </p>
          <div className="mt-7 flex items-center gap-3 rounded-2xl bg-secondary/55 p-4 md:p-5">
            <span className="relative flex size-3 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/45" />
              <span className="relative inline-flex size-3 rounded-full bg-primary" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                {transcriptionProgressTitle}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Keep this page open. Nothing needs your attention yet.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-6 min-h-12 w-full sm:w-auto"
            onClick={() => setStage("capture")}
            data-testid="button-recording-step-back"
          >
            <ArrowLeft size={16} /> Back to recording
          </Button>
        </section>
        {discardModal}
      </div>
    );

  if (stage === "review" || stage === "finalize")
    return (
      <div className="mx-auto max-w-4xl space-y-5 pb-32">
        {workflowProgress}
        <SectionHeading
          eyebrow={
            stage === "review"
              ? transcriptionPending
                ? "Preparing review"
                : "Review phrases"
              : "Finalize session"
          }
          title={
            stage === "review"
              ? transcriptionPending
                ? "Transcription is loading."
                : "Keep the phrases that belong in this session."
              : "Confirm the session note before saving."
          }
          description={
            stage === "review"
              ? transcriptionPending
                ? transcriptionStatus === "uploading"
                  ? "The recording is uploading securely. This screen will update automatically when transcription begins."
                  : "ChildLed is finding likely phrases now. Your review will appear automatically when it is ready."
                : "Review the transcript, correct uncertain Child speech, and remove anything you do not want to save."
              : "Add any useful observations or next steps, then save the session and generate its documentation."
          }
          action={
            (stage === "finalize" || audioBlob) && (
              <Button
                variant="outline"
                onClick={() =>
                  setStage(stage === "review" ? "capture" : "review")
                }
                data-testid="button-recording-step-back"
              >
                <ArrowLeft size={16} />
                {stage === "review" ? "Back to recording" : "Back to review"}
              </Button>
            )
          }
        />
        {workflowActionBar}
        {stage === "review" && (
          <>
            {!transcriptionPending && (
              <section
                data-testid="status-session-closeout"
                className={`rounded-2xl border p-4 sm:p-5 ${closeoutState === "needs_review" ? "border-accent/40 bg-accent/10" : closeoutState === "processing" || closeoutState === "saving" ? "border-primary/20 bg-secondary/45" : "border-primary/15 bg-card"}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${closeoutState === "needs_review" ? "bg-accent text-primary" : "bg-secondary text-primary"}`}
                  >
                    {closeoutState === "needs_review" ? (
                      <CircleHelp size={18} />
                    ) : closeoutState === "saved" ? (
                      <Check size={18} />
                    ) : (
                      <Sparkles size={18} />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-bold">{closeoutCopy.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {closeoutCopy.body}
                    </p>
                  </div>
                </div>
              </section>
            )}
            {!transcriptionPending && (
              <details className="rounded-2xl border border-border bg-card p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Listen to or replace recording · {formattedTime}
                </summary>
                <div className="mt-4 space-y-4">
                  {audioUrl ? (
                    <audio className="w-full" controls src={audioUrl} />
                  ) : (
                    <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                      No recording will be attached. You can still save the
                      reviewed phrases and clinical note.
                    </p>
                  )}
                  <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:border-primary focus-ring sm:w-auto">
                    <Volume2 size={16} /> Replace recording
                    <input
                      className="sr-only"
                      type="file"
                      accept="audio/webm,audio/mp4,audio/ogg,audio/mpeg,audio/wav,audio/x-m4a"
                      onChange={(event) =>
                        replaceAudio(event.target.files?.[0])
                      }
                    />
                  </label>
                </div>
              </details>
            )}
            {!consentConfirmedAt && (
              <section
                data-testid="status-recording-consent"
                className="flex flex-col items-stretch gap-4 rounded-2xl border border-accent/40 bg-accent/10 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">
                    Confirm consent before finalizing
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Consent is required even when no recording is attached.
                  </p>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  variant="outline"
                  onClick={() => openConsentModal("save")}
                  data-testid="button-open-audio-consent"
                >
                  Confirm consent
                </Button>
              </section>
            )}
            {transcriptionPanel}
            {!transcriptionPending && (
              <>
                <details className="rounded-2xl border border-border bg-card p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Add a phrase manually
                  </summary>
                  <form onSubmit={addCaptured} className="mt-5 space-y-4">
                    <Field
                      label="Exact phrase"
                      value={phrase}
                      onChange={setPhrase}
                      placeholder="What was said?"
                      testId="input-session-phrase"
                    />
                    <label className="block space-y-2">
                      <span className="text-xs font-bold uppercase text-muted-foreground">
                        Working meaning
                      </span>
                      <textarea
                        data-testid="textarea-session-meaning"
                        value={meaning}
                        onChange={(event) => setMeaning(event.target.value)}
                        placeholder="Optional working meaning…"
                        className="min-h-20 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none focus-ring"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField
                        label="Function"
                        value={func}
                        onChange={setFunc}
                        options={[
                          "Request",
                          "Protest",
                          "Shared Joy",
                          "Comment",
                          "Transition",
                          "Regulation",
                          "Self-Advocacy",
                          "Unknown",
                        ]}
                        testId="select-session-function"
                      />
                      <SelectField
                        label="Emotional state"
                        value={emotion}
                        onChange={setEmotion}
                        options={[
                          "Regulated",
                          "Excited",
                          "Frustrated",
                          "Dysregulated",
                          "Tired",
                          "Unknown",
                        ]}
                        testId="select-session-emotion"
                      />
                      <SelectField
                        label="Context"
                        value={context}
                        onChange={setContext}
                        options={["Therapy", "Home", "School", "Community"]}
                        testId="select-session-context"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="min-h-12 w-full sm:w-auto"
                      disabled={!phrase.trim()}
                      data-testid="button-capture-gestalt"
                    >
                      <Plus size={16} /> Add phrase
                    </Button>
                  </form>
                </details>
                <section className="space-y-4">
                  <div>
                    <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                      Evidence closeout
                    </p>
                    <h2 className="serif mt-1 text-2xl font-semibold">
                      {exceptionCaptured.length
                        ? "Only the exceptions need review"
                        : "Routine evidence is ready"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {routineCaptured.length} routine match
                      {routineCaptured.length === 1 ? "" : "es"} ·{" "}
                      {clinicianReviewedCaptured.length} clinician-reviewed
                      exception
                      {clinicianReviewedCaptured.length === 1 ? "" : "s"} ·{" "}
                      {exceptionCaptured.length} still to review
                    </p>
                  </div>
                  {captured.map((item, index) => {
                    const previous = matchingGestalt(item.phrase);
                    if (item.reviewState !== "exception")
                      return (
                        <div
                          key={item.id}
                          data-testid={`card-closeout-phrase-${item.id}`}
                          className="flex flex-col items-stretch gap-4 rounded-2xl border border-primary/15 bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="serif text-lg font-semibold">
                                “{item.phrase}”
                              </p>
                              <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold text-primary">
                                {item.reviewState === "routine"
                                  ? "Routine dictionary match"
                                  : "Clinician reviewed"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {item.frequency && item.frequency > 1
                                ? `Heard ${item.frequency} times · `
                                : ""}
                              {item.function} · {item.context}
                            </p>
                          </div>
                          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                            {item.reviewState === "routine" ? (
                              <Button
                                variant="quiet"
                                className="px-3 py-2 text-xs"
                                onClick={() => reopenRoutinePhrase(item.id)}
                                data-testid={`button-add-context-${item.id}`}
                              >
                                Add context
                              </Button>
                            ) : (
                              <Button
                                variant="quiet"
                                className="px-3 py-2 text-xs"
                                onClick={() => reopenReviewedPhrase(item.id)}
                                data-testid={`button-reopen-exception-${item.id}`}
                              >
                                Edit review
                              </Button>
                            )}
                            <Button
                              variant="quiet"
                              className="px-3 py-2 text-xs text-muted-foreground"
                              disabled={deleteTranscriptPhrase.isPending}
                              onClick={() => void removeCaptured(item.id)}
                              data-testid={`button-remove-review-phrase-${item.id}`}
                            >
                              <Trash2 size={14} /> Delete phrase
                            </Button>
                          </div>
                        </div>
                      );
                    return (
                      <div
                        key={item.id}
                        id={`review-phrase-${item.id}`}
                        className="rounded-2xl border border-border bg-card p-4 sm:p-5"
                      >
                        <div className="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="mono text-[10px] font-bold tracking-wider text-muted-foreground">
                            GESTALT {String(index + 1).padStart(2, "0")}
                            {item.frequency && item.frequency > 1
                              ? ` · HEARD ${item.frequency} TIMES`
                              : ""}
                          </p>
                          <Button
                            className="w-full sm:w-auto"
                            variant="quiet"
                            disabled={deleteTranscriptPhrase.isPending}
                            onClick={() => void removeCaptured(item.id)}
                            data-testid={`button-remove-review-phrase-${item.id}`}
                          >
                            <Trash2 size={14} /> Delete phrase
                          </Button>
                        </div>
                        {previous && (
                          <aside
                            data-testid={`card-previous-gestalt-${item.id}`}
                            className="mb-5 rounded-2xl border border-accent/40 bg-secondary/45 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-primary">
                                  Previously logged
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                  “{previous.phrase}” is already in{" "}
                                  {child?.name ?? "this child"}’s map.
                                </p>
                              </div>
                              <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold text-primary">
                                Reference only
                              </span>
                            </div>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Earlier meaning
                                </p>
                                <p className="mt-1 text-sm leading-6">
                                  {previous.meaning}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Original source
                                </p>
                                <p className="mt-1 text-sm leading-6">
                                  {previous.source}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 border-t border-primary/10 pt-4">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Team notes
                              </p>
                              {previous.comments?.length ? (
                                <div className="mt-2 space-y-2">
                                  {previous.comments.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className="rounded-xl bg-card/70 p-3"
                                    >
                                      <p className="text-sm leading-5">
                                        {comment.body}
                                      </p>
                                      <p className="mt-1 text-[11px] text-muted-foreground">
                                        {comment.author} · {comment.role}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  No earlier team notes were recorded for this
                                  phrase.
                                </p>
                              )}
                            </div>
                            <p className="mt-4 text-xs leading-5 text-muted-foreground">
                              This prior entry is shown for context. Confirm the
                              current meaning and situation for today’s session
                              independently.
                            </p>
                          </aside>
                        )}
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field
                            label="Exact phrase"
                            value={item.phrase}
                            onChange={(value) =>
                              updateCaptured(item.id, "phrase", value)
                            }
                            placeholder="What was said?"
                            testId={`input-review-phrase-${item.id}`}
                          />
                          <Field
                            label="Working meaning"
                            value={item.meaning}
                            onChange={(value) =>
                              updateCaptured(item.id, "meaning", value)
                            }
                            placeholder="What might it mean?"
                            testId={`input-review-meaning-${item.id}`}
                          />
                          <SelectField
                            label="Function"
                            value={item.function}
                            onChange={(value) =>
                              updateCaptured(item.id, "function", value)
                            }
                            options={[
                              "Request",
                              "Protest",
                              "Shared Joy",
                              "Comment",
                              "Transition",
                              "Regulation",
                              "Self-Advocacy",
                              "Unknown",
                            ]}
                            testId={`select-review-function-${item.id}`}
                          />
                          <SelectField
                            label="Emotional state"
                            value={item.emotionalState}
                            onChange={(value) =>
                              updateCaptured(item.id, "emotionalState", value)
                            }
                            options={[
                              "Regulated",
                              "Excited",
                              "Frustrated",
                              "Dysregulated",
                              "Tired",
                              "Unknown",
                            ]}
                            testId={`select-review-emotion-${item.id}`}
                          />
                          <SelectField
                            label="Setting"
                            value={item.context}
                            onChange={(value) =>
                              updateCaptured(item.id, "context", value)
                            }
                            options={["Therapy", "Home", "School", "Community"]}
                            testId={`select-review-context-${item.id}`}
                          />
                        </div>
                        <label className="mt-4 block space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            What was happening when it was said?
                          </span>
                          <textarea
                            data-testid={`textarea-review-note-${item.id}`}
                            value={item.note}
                            onChange={(event) =>
                              updateCaptured(
                                item.id,
                                "note",
                                event.target.value,
                              )
                            }
                            placeholder="e.g. During a preferred play routine, after I paused and waited..."
                            className="min-h-24 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
                          />
                        </label>
                        <div className="mt-4 flex justify-end">
                          <Button
                            className="w-full sm:w-auto"
                            variant="primary"
                            onClick={() => resolveExceptionPhrase(item.id)}
                            data-testid={`button-resolve-review-phrase-${item.id}`}
                          >
                            <Check size={15} /> Mark ready to save
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </section>
              </>
            )}
            {saveError && (
              <p
                role="alert"
                data-testid="status-review-session-error"
                className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
              >
                {saveError}
              </p>
            )}
          </>
        )}
        {stage === "finalize" && (
          <section className="rounded-3xl border border-border bg-card p-5 md:p-8">
            {finalizePreparing ? (
              <div
                className="flex min-h-72 flex-col items-center justify-center text-center"
                data-testid="status-preparing-session-summary"
              >
                <span className="grid size-12 place-items-center rounded-full bg-secondary text-primary">
                  <Sparkles className="animate-pulse" size={22} />
                </span>
                <h2 className="serif mt-4 text-2xl font-semibold">
                  Preparing session summary…
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  ChildLed is organizing the phrases you confirmed. Your review
                  is preserved while this finishes.
                </p>
              </div>
            ) : (
              <>
                <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
                  Optional team context
                </p>
                <h2 className="serif mt-2 text-2xl font-semibold">
                  Add a handoff only if it helps
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  ChildLed builds the session summary and editable SOAP draft
                  from saved reviewed evidence. Add extra observations or next
                  steps when they are useful for this child’s team.
                </p>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Clinical observations
                    </span>
                    <textarea
                      data-testid="textarea-session-observations"
                      value={observations}
                      onChange={(event) => setObservations(event.target.value)}
                      placeholder="Optional context for the team…"
                      className="min-h-28 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Next steps
                    </span>
                    <textarea
                      data-testid="textarea-session-next-steps"
                      value={nextSteps}
                      onChange={(event) => setNextSteps(event.target.value)}
                      placeholder="Optional follow-up…"
                      className="min-h-28 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
                    />
                  </label>
                </div>
                <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Editable session summary
                  </span>
                  <Button
                    className="w-full sm:w-auto"
                    variant="outline"
                    onClick={regenerateSessionNote}
                    data-testid="button-refresh-session-summary"
                  >
                    <RotateCcw size={15} /> Refresh summary
                  </Button>
                </div>
                <textarea
                  data-testid="textarea-session-note"
                  value={sessionNote}
                  onChange={(event) => {
                    setSessionNote(event.target.value);
                    setSessionNoteEdited(true);
                  }}
                  className="mt-2 min-h-64 w-full resize-y rounded-xl border border-input bg-background p-4 text-sm leading-6 outline-none transition-shadow focus-ring"
                />
                <div className="mt-5 flex flex-wrap justify-between gap-3">
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={copyNote}
                      data-testid="button-copy-session-note"
                    >
                      <ClipboardList size={16} /> Copy summary
                    </Button>
                    <Button variant="outline" onClick={() => window.print()}>
                      <Printer size={16} /> Print review
                    </Button>
                  </div>
                </div>
                {saveError && (
                  <p
                    data-testid="status-save-session-error"
                    className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {saveError}
                  </p>
                )}
              </>
            )}
          </section>
        )}
        {consentModal}
        {discardModal}
      </div>
    );

  return (
    <div className={`mx-auto max-w-2xl space-y-5 ${recording ? "pb-28" : ""}`}>
      {workflowProgress}
      {workflowActionBar}
      <SectionHeading
        eyebrow="Record session"
        title={`Record ${child?.name ?? "this child"}’s session.`}
        description="Start when everyone is ready. You can pause at any time, and stopping moves the recording to review."
      />
      <div className="space-y-5">
        <section
          className={`rounded-3xl p-5 text-primary-foreground soft-shadow sm:p-6 md:p-10 ${recording ? "bg-primary" : "bg-primary/95"}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-accent">
                Therapy session
              </p>
              <h2 className="serif mt-2 text-3xl">
                {child?.name ?? "Selected child"}
              </h2>
            </div>
            <div
              className={`grid size-12 place-items-center rounded-2xl ${recording ? "bg-accent text-primary" : "bg-primary-foreground/10"}`}
            >
              <Timer size={23} />
            </div>
          </div>
          <div className="my-10 text-center md:my-12">
            <p
              className={`mono text-[2.75rem] font-bold sm:text-6xl ${recording ? "text-accent" : ""}`}
            >
              {formattedTime}
            </p>
            <p className="mt-3 text-sm text-primary-foreground/60">
              {recording ? (
                <span className="inline-flex focus-ring  items-center gap-2">
                  {!paused && (
                    <span className="size-2 animate-pulse rounded-full bg-destructive" />
                  )}{" "}
                  {paused ? "Recording paused" : "Recording live"}
                </span>
              ) : (
                "Ready when you are"
              )}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {!recording ? (
              <>
                <Button
                  className="min-h-12 w-full sm:w-auto"
                  variant="warm"
                  onClick={startRecording}
                  data-testid="button-start-recording"
                >
                  <Mic size={17} />
                  {audioBlob ? "Record again" : "Start recording"}
                </Button>
                <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary-foreground/20 bg-transparent px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10 focus-ring sm:w-auto">
                  <Volume2 size={16} /> Use audio file
                  <input
                    data-testid="input-session-audio-file"
                    className="sr-only"
                    type="file"
                    accept="audio/webm,audio/mp4,audio/ogg,audio/mpeg,audio/wav,audio/x-m4a"
                    onChange={(event) => replaceAudio(event.target.files?.[0])}
                  />
                </label>
              </>
            ) : null}
          </div>
          {!recording && audioUrl && (
            <div className="mt-6 rounded-2xl bg-primary-foreground/10 p-4">
              <p className="mb-3 text-sm font-semibold">Current recording</p>
              <audio className="w-full" controls src={audioUrl} />
              <Button
                className="mt-4 min-h-12 w-full"
                variant="warm"
                onClick={() => setStage("review")}
                data-testid="button-return-to-review"
              >
                Continue to review <ArrowRight size={16} />
              </Button>
            </div>
          )}
          {!recording && !audioBlob && captured.length > 0 && (
            <Button
              className="mx-auto mt-4 min-h-12 w-full sm:w-auto"
              variant="outline"
              onClick={() => setStage("review")}
              data-testid="button-review-without-audio"
            >
              Review written phrases <ArrowRight size={16} />
            </Button>
          )}
          {audioError && (
            <p className="mt-5 rounded-xl bg-destructive/20 p-3 text-center text-xs leading-5 text-primary-foreground">
              {audioError}
            </p>
          )}
        </section>
      </div>
      {discardModal}
    </div>
  );
}

function EditChildProfileForm({
  child,
  onClose,
  onSaved,
}: {
  child: Child;
  onClose: () => void;
  onSaved: (child: Child) => void;
}) {
  const mutation = useUpdateChildProfile();
  const client = useQueryClient();
  const [firstName, setFirstName] = useState(child.firstName);
  const [lastName, setLastName] = useState(child.lastName);
  const [preferredName, setPreferredName] = useState(child.preferredName);
  const [school, setSchool] = useState(child.school);
  const [grade, setGrade] = useState(child.grade);
  const [dateOfBirth, setDateOfBirth] = useState(child.dateOfBirth ?? "");
  const [pronouns, setPronouns] = useState(child.pronouns ?? "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      {
        params: { childId: child.id },
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          preferredName: preferredName.trim(),
          school: school.trim(),
          grade: grade.trim(),
          dateOfBirth: dateOfBirth || null,
          pronouns: pronouns.trim() || null,
        },
      },
      {
        onSuccess: (updated) => {
          client.setQueryData(
            getGetChildQueryKey({ childId: child.id }),
            updated,
          );
          client.invalidateQueries({ queryKey: getListChildrenQueryKey() });
          client.invalidateQueries({
            queryKey: getGetDashboardQueryKey({ childId: child.id }),
          });
          client.invalidateQueries({
            queryKey: getGetClinicianOverviewQueryKey(),
          });
          client.invalidateQueries({ queryKey: getGetTeamInboxQueryKey() });
          onSaved(updated);
        },
      },
    );
  };
  return (
    <Modal title={`Edit ${child.name}'s profile`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          These details update the child’s current profile everywhere ChildLed
          shows their name or school information. Clinical records and
          historical authorship stay unchanged.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First Name"
            value={firstName}
            onChange={setFirstName}
            placeholder="e.g. Rowan"
            required
            testId="input-edit-child-first-name"
          />
          <Field
            label="Last Name"
            value={lastName}
            onChange={setLastName}
            placeholder="e.g. Bennett"
            testId="input-edit-child-last-name"
          />
          <Field
            label="Preferred Name"
            value={preferredName}
            onChange={setPreferredName}
            placeholder="Optional"
            testId="input-edit-child-preferred-name"
          />
          <Field
            label="Pronouns"
            value={pronouns}
            onChange={setPronouns}
            placeholder="Optional, e.g. they/them"
            testId="input-edit-child-pronouns"
          />
          <Field
            label="School or setting"
            value={school}
            onChange={setSchool}
            placeholder="e.g. Cedar Grove School"
            testId="input-edit-child-school"
          />
          <Field
            label="Grade"
            value={grade}
            onChange={setGrade}
            placeholder="e.g. Kindergarten"
            testId="input-edit-child-grade"
          />
          <label className="space-y-2 sm:col-span-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Date of Birth
            </span>
            <input
              data-testid="input-edit-child-date-of-birth"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring"
            />
          </label>
        </div>
        {mutation.isError && (
          <p
            data-testid="status-edit-child-error"
            className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
          >
            We couldn’t save these profile details. Check the form and try
            again.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="quiet"
            onClick={onClose}
            data-testid="button-cancel-edit-child"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !firstName.trim()}
            data-testid="button-save-edit-child"
          >
            {mutation.isPending ? "Saving…" : "Save Profile"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ChildForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (child: Child) => void;
}) {
  const mutation = useCreateChild();
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [style, setStyle] = useState("Gestalt language processor");
  const [notes, setNotes] = useState("");
  const [legalAuthorityConfirmed, setLegalAuthorityConfirmed] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      {
        data: {
          name,
          school,
          grade,
          communicationStyle: style,
          glpNotes: notes,
          strengths: [],
          sensoryPreferences: [],
          specialInterests: [],
          regulationNotes: "",
          legalAuthorityConfirmed,
        },
      },
      { onSuccess: onCreated },
    );
  };
  return (
    <Modal title="Add a child to your map" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Start with the details your team reaches for most. You can grow the
          profile together.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Rowan"
            required
            testId="input-child-name"
          />
          <Field
            label="School or setting"
            value={school}
            onChange={setSchool}
            placeholder="e.g. Cedar Grove School"
            required
            testId="input-child-school"
          />
          <Field
            label="Grade"
            value={grade}
            onChange={setGrade}
            placeholder="e.g. Kindergarten"
            required
            testId="input-child-grade"
          />
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Communication style
            </span>
            <select
              data-testid="select-child-style"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring"
            >
              <option>Gestalt language processor</option>
              <option>Multimodal communicator</option>
              <option>Emerging communicator</option>
            </select>
          </label>
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            A note for the team
          </span>
          <textarea
            data-testid="textarea-child-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What should a new person know first?"
            className="min-h-24 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        <fieldset className="rounded-2xl border border-primary/20 bg-secondary/35 p-5">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-primary">
            Consent statement
          </legend>
          <label className="mt-2 flex cursor-pointer items-start gap-3">
            <input
              data-testid="checkbox-child-legal-authority"
              type="checkbox"
              checked={legalAuthorityConfirmed}
              onChange={(event) =>
                setLegalAuthorityConfirmed(event.target.checked)
              }
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="text-sm leading-6 text-foreground">
              {CHILD_PROFILE_AUTHORIZATION_STATEMENT}
            </span>
          </label>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            This consent record is saved with the care-team user and timestamp.
            Recording consent is collected separately before audio is processed.
            Read the{" "}
            <Link
              href="/privacy"
              className="font-semibold text-primary underline underline-offset-2"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              className="font-semibold text-primary underline underline-offset-2"
            >
              Terms of Use
            </Link>
            .
          </p>
        </fieldset>
        {mutation.isError && (
          <p
            data-testid="status-create-child-error"
            className="text-sm text-destructive"
          >
            We couldn’t save this profile. Please try again.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="quiet"
            onClick={onClose}
            data-testid="button-cancel-child"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              mutation.isPending ||
              !name ||
              !school ||
              !grade ||
              !legalAuthorityConfirmed
            }
            data-testid="button-submit-child"
          >
            {mutation.isPending ? "Saving…" : "Create profile"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  testId: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        data-testid={testId}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring"
      />
    </label>
  );
}

function GestaltForm({
  childId,
  role,
  onClose,
}: {
  childId: number;
  role?: string;
  onClose: () => void;
}) {
  const mutation = useCreateGestalt();
  const mergeObservation = useLogPhraseObservation();
  const dictionary = useListGestalts({ childId });
  const client = useQueryClient();
  const [phrase, setPhrase] = useState("");
  const [meaning, setMeaning] = useState("");
  const [func, setFunc] = useState("Connection");
  const [contexts, setContexts] = useState("");
  const [emotion, setEmotion] = useState("Curious");
  const [source, setSource] = useState("Home");
  const [candidate, setCandidate] = useState<Gestalt>();
  const phraseKey = (value: string) =>
    value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const editDistance = (left: string, right: string) => {
    const row = Array.from({ length: left.length + 1 }, (_, index) => index);
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      let diagonal = row[0]!;
      row[0] = rightIndex;
      for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const previous = row[leftIndex]!;
        row[leftIndex] = Math.min(
          row[leftIndex]! + 1,
          row[leftIndex - 1]! + 1,
          diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
        );
        diagonal = previous;
      }
    }
    return row[left.length]!;
  };
  const similarPhrase = () => {
    const key = phraseKey(phrase);
    if (!key) return undefined;
    return dictionary.data?.find((item) => {
      const existing = phraseKey(item.phrase);
      if (key === existing) return true;
      const edits =
        key.length <= 6 ? 1 : Math.min(2, Math.floor(key.length * 0.16));
      return (
        Math.abs(key.length - existing.length) <= edits &&
        editDistance(key, existing) <= edits
      );
    });
  };
  const refresh = () => {
    client.invalidateQueries({
      queryKey: getListGestaltsQueryKey({ childId }),
    });
    client.invalidateQueries({
      queryKey: getGetDictionaryInsightsQueryKey({ childId }),
    });
    client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    client.invalidateQueries({ queryKey: getGetFrequentScriptsQueryKey() });
    client.invalidateQueries({
      queryKey: getGetRecurringLanguagePatternsQueryKey(),
    });
    client.invalidateQueries({
      queryKey: getGetPhraseTrendsQueryKey({ childId }),
    });
    client.invalidateQueries({
      queryKey: getGetTeacherCommunicationHelperQueryKey(),
    });
  };
  const create = (allowSimilar = false) =>
    mutation.mutate(
      {
        params: { childId },
        data: {
          phrase,
          allowSimilar,
          meaning: meaning.trim() || undefined,
          function: func,
          contexts: contexts
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          emotionalState: emotion,
          source,
          audioUrl: null,
        },
      },
      {
        onSuccess: () => {
          refresh();
          onClose();
        },
      },
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const match = similarPhrase();
    if (match) setCandidate(match);
    else create();
  };
  const merge = () => {
    if (!candidate) return;
    mergeObservation.mutate(
      {
        params: { childId },
        data: {
          phrase,
          existingGestaltId: candidate.id,
          context:
            contexts
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)[0] || source,
          details: `Merged from phrase entry. Working meaning submitted: ${meaning}`,
          possibleMeaning: meaning,
          communicationFunction: "Other",
          observedAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          refresh();
          onClose();
        },
      },
    );
  };
  const isCommunityContributor = role === "Parent" || role === "Teacher";
  return (
    <Modal
      title={
        isCommunityContributor
          ? "Add a phrase to the shared dictionary"
          : "Add an echo"
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-2xl bg-secondary/60 p-4 text-sm leading-6 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Start with the exact phrase.
          </span>{" "}
          {isCommunityContributor
            ? "Share what you hear at home or school and the context around it."
            : "Add what you hear first, then your best current understanding. Meaning can change as the map grows."}{" "}
          <span className="font-medium text-foreground">
            An SLP can add clinical interpretation during a reviewed session.
          </span>
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Exact phrase
          </span>
          <div className="relative">
            <Mic
              className="absolute left-3 top-3 text-muted-foreground"
              size={17}
            />
            <input
              data-testid="input-gestalt-phrase"
              required
              value={phrase}
              onChange={(event) => {
                setPhrase(event.target.value);
                setCandidate(undefined);
              }}
              placeholder="What did they say?"
              className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none transition-shadow focus-ring"
            />
          </div>
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            What might it mean?{" "}
            <span className="font-normal normal-case tracking-normal text-muted-foreground">
              (optional)
            </span>
          </span>
          <textarea
            data-testid="textarea-gestalt-meaning"
            value={meaning}
            onChange={(event) => setMeaning(event.target.value)}
            placeholder="Their likely message, need, or invitation..."
            className="min-h-24 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Function"
            value={func}
            onChange={setFunc}
            options={[
              "Connection",
              "Request",
              "Protest",
              "Comment",
              "Self-regulation",
              "Transition",
            ]}
            testId="select-gestalt-function"
          />
          <SelectField
            label="Emotional state"
            value={emotion}
            onChange={setEmotion}
            options={[
              "Curious",
              "Joyful",
              "Overwhelmed",
              "Playful",
              "Calm",
              "Unclear",
            ]}
            testId="select-gestalt-emotion"
          />
          <SelectField
            label="First heard in"
            value={source}
            onChange={setSource}
            options={["Home", "School", "Therapy", "Community"]}
            testId="select-gestalt-source"
          />
          <Field
            label="Contexts"
            value={contexts}
            onChange={setContexts}
            placeholder="bedtime, outside (comma separated)"
            testId="input-gestalt-contexts"
          />
        </div>
        {candidate && (
          <section
            className="rounded-2xl border border-accent/40 bg-accent/10 p-4"
            data-testid="possible-existing-phrase"
          >
            <p className="font-semibold text-foreground">
              Possible Existing Phrase Found
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Similar phrase already exists:
            </p>
            <p className="mt-1 font-semibold text-foreground">
              “{candidate.phrase}”
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="warm"
                onClick={merge}
                disabled={mergeObservation.isPending}
                data-testid="button-merge-existing-phrase"
              >
                {mergeObservation.isPending
                  ? "Merging…"
                  : "Merge with existing phrase"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => create(true)}
                disabled={mutation.isPending}
                data-testid="button-add-new-similar-phrase"
              >
                Add as a new phrase
              </Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => setCandidate(undefined)}
                data-testid="button-cancel-similar-phrase"
              >
                Cancel
              </Button>
            </div>
          </section>
        )}
        {(mutation.isError || mergeObservation.isError) && (
          <p
            data-testid="status-create-gestalt-error"
            className="text-sm text-destructive"
          >
            We couldn’t add this phrase. Review the existing phrase or try
            again.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="quiet"
            onClick={onClose}
            data-testid="button-cancel-gestalt"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="warm"
            disabled={mutation.isPending || !phrase.trim()}
            data-testid="button-submit-gestalt"
          >
            {mutation.isPending ? "Adding…" : "Add to dictionary"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PhraseObservationForm({
  childId,
  initialPhrase,
  onClose,
}: {
  childId: number;
  initialPhrase?: string;
  onClose: () => void;
}) {
  const mutation = useLogPhraseObservation();
  const client = useQueryClient();
  const [phrase, setPhrase] = useState(initialPhrase ?? "");
  const [context, setContext] = useState("Classroom");
  const [details, setDetails] = useState("");
  const [possibleMeaning, setPossibleMeaning] = useState("");
  const [communicationFunction, setCommunicationFunction] = useState("Other");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      {
        params: { childId },
        data: {
          phrase,
          context,
          details: details || undefined,
          possibleMeaning: possibleMeaning || undefined,
          communicationFunction: communicationFunction as
            | "Requesting"
            | "Commenting"
            | "Social Interaction"
            | "Self-Regulation"
            | "Shared Joy"
            | "Other",
          observedAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          client.invalidateQueries({
            queryKey: getListGestaltsQueryKey({ childId }),
          });
          client.invalidateQueries({
            queryKey: getGetDictionaryInsightsQueryKey({ childId }),
          });
          client.invalidateQueries({
            queryKey: getGetTeacherCommunicationHelperQueryKey(),
          });
          client.invalidateQueries({
            queryKey: getGetDashboardQueryKey({ childId }),
          });
          client.invalidateQueries({
            queryKey: getGetFrequentScriptsQueryKey(),
          });
          client.invalidateQueries({
            queryKey: getGetRecurringLanguagePatternsQueryKey(),
          });
          onClose();
        },
      },
    );
  };
  return (
    <Modal title="Log a classroom phrase" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4 text-sm leading-6 text-muted-foreground">
          <span className="font-semibold text-foreground">
            Your classroom context is valuable.
          </span>{" "}
          This adds an observation to the shared dictionary without changing any
          clinician-approved interpretation. New phrases are marked for
          clinician review.
        </div>
        <Field
          label="Exact phrase"
          value={phrase}
          onChange={setPhrase}
          placeholder="What did the student say?"
          required
          testId="input-teacher-phrase"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Context"
            value={context}
            onChange={setContext}
            options={[
              "Classroom",
              "Morning arrival",
              "Lunch",
              "Play",
              "Transition",
              "Specials",
              "Other",
            ]}
            testId="select-teacher-phrase-context"
          />
          <SelectField
            label="Communication function (optional)"
            value={communicationFunction}
            onChange={setCommunicationFunction}
            options={[
              "Other",
              "Requesting",
              "Commenting",
              "Social Interaction",
              "Self-Regulation",
              "Shared Joy",
            ]}
            testId="select-teacher-phrase-function"
          />
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            What was happening?
          </span>
          <textarea
            data-testid="textarea-teacher-phrase-situation"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Describe the activity, people nearby, and what happened before or after."
            className="min-h-28 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Possible meaning (optional)
          </span>
          <textarea
            data-testid="textarea-teacher-phrase-meaning"
            value={possibleMeaning}
            onChange={(event) => setPossibleMeaning(event.target.value)}
            placeholder="What did this seem to communicate in the moment?"
            className="min-h-20 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Date and time are added automatically when you save.
        </p>
        {mutation.isError && (
          <p className="text-sm text-destructive">
            We couldn’t save this phrase observation. Please try again.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="warm"
            disabled={mutation.isPending || !phrase.trim()}
            data-testid="button-submit-teacher-phrase"
          >
            {mutation.isPending ? "Saving…" : "Save phrase observation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ClinicianPhraseForm({
  childId,
  childName,
  onClose,
}: {
  childId: number;
  childName?: string;
  onClose: () => void;
}) {
  const mutation = useLogPhraseObservation();
  const client = useQueryClient();
  const [phrase, setPhrase] = useState("");
  const [context, setContext] = useState("");
  const [communicationFunction, setCommunicationFunction] = useState("");
  const [notes, setNotes] = useState("");
  const refresh = () => {
    client.invalidateQueries({
      queryKey: getListGestaltsQueryKey({ childId }),
    });
    client.invalidateQueries({
      queryKey: getGetDictionaryInsightsQueryKey({ childId }),
    });
    client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    client.invalidateQueries({
      queryKey: getGetDashboardQueryKey({ childId }),
    });
    client.invalidateQueries({ queryKey: getGetFrequentScriptsQueryKey() });
    client.invalidateQueries({
      queryKey: getGetRecurringLanguagePatternsQueryKey(),
    });
    client.invalidateQueries({
      queryKey: getGetPhraseTrendsQueryKey({ childId }),
    });
    client.invalidateQueries({ queryKey: getGetClinicianOverviewQueryKey() });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      {
        params: { childId },
        data: {
          phrase: phrase.trim(),
          context: context.trim() || "Clinical observation",
          details: notes.trim() || undefined,
          communicationFunction: communicationFunction
            ? (communicationFunction as
                | "Requesting"
                | "Commenting"
                | "Social Interaction"
                | "Self-Regulation"
                | "Shared Joy"
                | "Other")
            : undefined,
          observedAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          refresh();
          onClose();
        },
      },
    );
  };
  return (
    <Modal title="Add Phrase" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Add a phrase for{" "}
          <span className="font-semibold text-foreground">
            {childName || "this child"}
          </span>
          . Saving adds it to the Communication Dictionary and records this
          clinician observation for Frequent Scripts and reporting.
        </p>
        <Field
          label="Phrase"
          value={phrase}
          onChange={setPhrase}
          placeholder="Enter the exact phrase"
          required
          testId="input-clinician-phrase"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Context (optional)"
            value={context}
            onChange={setContext}
            placeholder="Where or when it was heard"
            testId="input-clinician-phrase-context"
          />
          <SelectField
            label="Communication function (optional)"
            value={communicationFunction}
            onChange={setCommunicationFunction}
            options={[
              "",
              "Requesting",
              "Commenting",
              "Social Interaction",
              "Self-Regulation",
              "Shared Joy",
              "Other",
            ]}
            testId="select-clinician-phrase-function"
          />
        </div>
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Source
          </span>
          <input
            value="Clinician"
            readOnly
            aria-readonly="true"
            data-testid="input-clinician-phrase-source"
            className="h-11 w-full rounded-xl border border-input bg-muted/40 px-3 text-sm text-muted-foreground outline-none"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Notes (optional)
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add any useful clinical context."
            data-testid="textarea-clinician-phrase-notes"
            className="min-h-28 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        {mutation.isError && (
          <p className="text-sm text-destructive">
            We couldn’t save this phrase. Please try again.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="warm"
            disabled={mutation.isPending || !phrase.trim()}
            data-testid="button-submit-clinician-phrase"
          >
            {mutation.isPending ? "Saving…" : "Save phrase"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function InterestForm({
  childId,
  interest,
  audience = "teacher",
  onClose,
}: {
  childId: number;
  interest?: ChildInterest;
  audience?: "teacher" | "parent";
  onClose: () => void;
}) {
  const create = useCreateChildInterest();
  const update = useUpdateChildInterest();
  const client = useQueryClient();
  const [value, setValue] = useState(interest?.interest ?? "");
  const pending = create.isPending || update.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const onSuccess = () => {
      client.invalidateQueries({
        queryKey: getListChildInterestsQueryKey({ childId }),
      });
      onClose();
    };
    if (interest)
      update.mutate(
        { interestId: interest.id, data: { interest: value } },
        { onSuccess },
      );
    else
      create.mutate(
        { params: { childId }, data: { interest: value } },
        { onSuccess },
      );
  };
  const atHome = audience === "parent";
  return (
    <Modal
      title={interest ? "Edit interest suggestion" : "Share an interest"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          {interest
            ? "Update this suggestion before it is reviewed."
            : `Share something that helps your child connect${atHome ? " at home or in the community" : " at school"}. Your suggestion will be visible to the clinician for review.`}
        </p>
        <Field
          label="Interest"
          value={value}
          onChange={setValue}
          placeholder="e.g. trains, ocean animals, drawing maps"
          required
          testId={atHome ? "input-parent-interest" : "input-teacher-interest"}
        />
        {(create.isError || update.isError) && (
          <p className="text-sm text-destructive">
            We couldn’t save this interest. It may already be listed.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending || !value.trim()}
            data-testid={
              atHome
                ? "button-submit-parent-interest"
                : "button-submit-teacher-interest"
            }
          >
            {pending
              ? "Saving…"
              : interest
                ? "Save changes"
                : "Suggest for review"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  testId,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  testId: string;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ParentObservationForm({
  childId,
  childName,
  onClose,
}: {
  childId: number;
  childName: string;
  onClose: () => void;
}) {
  const createObservation = useCreateObservation();
  const logPhrase = useLogPhraseObservation();
  const client = useQueryClient();
  const [phrase, setPhrase] = useState("");
  const [context, setContext] = useState("Home");
  const [notes, setNotes] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [phraseWarning, setPhraseWarning] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = [
      phrase.trim() ? `Phrase noticed: “${phrase.trim()}”` : "",
      notes.trim(),
      question.trim() ? `Question for clinician: ${question.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    setError("");
    setPhraseWarning("");
    try {
      await createObservation.mutateAsync({
        params: { childId },
        data: { body, context },
      });
    } catch {
      setError("We couldn’t save that observation. Please try again.");
      return;
    }
    if (phrase.trim()) {
      try {
        await logPhrase.mutateAsync({
          params: { childId },
          data: {
            phrase: phrase.trim(),
            context,
            details: notes.trim() || undefined,
            communicationFunction: "Other",
            observedAt: new Date().toISOString(),
          },
        });
      } catch {
        setPhraseWarning(
          "The update was saved, but the phrase could not be added to the dictionary.",
        );
      }
    }
    await Promise.allSettled([
      client.invalidateQueries({
        queryKey: getGetDashboardQueryKey({ childId }),
      }),
      client.invalidateQueries({
        queryKey: getListGestaltsQueryKey({ childId }),
      }),
      client.invalidateQueries({
        queryKey: getGetDictionaryInsightsQueryKey({ childId }),
      }),
      client.invalidateQueries({ queryKey: getGetFrequentScriptsQueryKey() }),
      client.invalidateQueries({
        queryKey: getGetRecurringLanguagePatternsQueryKey(),
      }),
    ]);
    setSaved(true);
  };
  const pending = createObservation.isPending || logPhrase.isPending;
  if (saved) {
    return (
      <Modal title="Update saved" onClose={onClose}>
        <div
          className="space-y-5 text-center"
          data-testid="status-parent-observation-saved"
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check size={24} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Your update was saved
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {childName}’s clinician can now review what you shared.
            </p>
            {phraseWarning && (
              <p className="mt-3 text-sm text-destructive">{phraseWarning}</p>
            )}
          </div>
          <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Log an observation" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4 text-sm leading-6 text-muted-foreground">
          Share an ordinary moment from home. If you add a phrase, it is shared
          as context for the dictionary and new phrases wait for clinician
          review.
        </div>
        <Field
          label="New phrase (optional)"
          value={phrase}
          onChange={setPhrase}
          placeholder="e.g. Let’s blast off!"
          testId="input-parent-observation-phrase"
        />
        <SelectField
          label="Context"
          value={context}
          onChange={setContext}
          options={[
            "Home",
            "Play",
            "Before school",
            "Mealtime",
            "Transition",
            "Community",
            "Other",
          ]}
          testId="select-parent-observation-context"
        />
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Notes
          </span>
          <textarea
            data-testid="textarea-parent-observation-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What was happening? What did you notice?"
            className="min-h-24 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Question for the clinician (optional)
          </span>
          <textarea
            data-testid="textarea-parent-observation-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What would you like help thinking about?"
            className="min-h-20 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        {error && (
          <p
            className="text-sm text-destructive"
            data-testid="status-parent-observation-error"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              pending || (!phrase.trim() && !notes.trim() && !question.trim())
            }
            data-testid="button-submit-parent-observation"
          >
            {pending ? "Saving…" : "Save observation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ParentPhraseNoteForm({
  gestalt,
  kind,
  onClose,
}: {
  gestalt: Gestalt;
  kind: "meaning" | "context";
  onClose: () => void;
}) {
  const mutation = useAddGestaltComment();
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const label = kind === "meaning" ? "meaning" : "context";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      {
        params: { gestaltId: gestalt.id },
        data: { body: `Parent-shared ${label}: ${body.trim()}` },
      },
      {
        onSuccess: () => {
          client.invalidateQueries({
            queryKey: getListGestaltsQueryKey({ childId: gestalt.childId }),
          });
          onClose();
        },
      },
    );
  };
  return (
    <Modal title={`Add ${label} for “${gestalt.phrase}”`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-2xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">
          This is a note for the care team. It adds your family's context
          without changing the shared dictionary meaning.
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            What would you like the team to know?
          </span>
          <textarea
            data-testid={`textarea-parent-${kind}-note`}
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              kind === "meaning"
                ? "He often says this when he is nervous."
                : "Usually before school."
            }
            className="min-h-28 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        {mutation.isError && (
          <p className="text-sm text-destructive">
            We couldn’t add that note. Please try again.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !body.trim()}
            data-testid={`button-submit-parent-${kind}-note`}
          >
            {mutation.isPending ? "Saving…" : "Share with the team"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SensoryProfileForm({
  child,
  onClose,
}: {
  child: Child;
  onClose: () => void;
}) {
  const mutation = useUpdateChildSensory();
  const client = useQueryClient();
  const [supports, setSupports] = useState(
    (child.sensorySupports?.length
      ? child.sensorySupports
      : (child.sensoryPreferences ?? [])
    ).join(", "),
  );
  const [challenges, setChallenges] = useState(
    (child.sensoryChallenges ?? []).join(", "),
  );
  const split = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      {
        params: { childId: child.id },
        data: { supports: split(supports), challenges: split(challenges) },
      },
      {
        onSuccess: () => {
          client.invalidateQueries({
            queryKey: getGetChildQueryKey({ childId: child.id }),
          });
          client.invalidateQueries({ queryKey: getListChildrenQueryKey() });
          onClose();
        },
      },
    );
  };
  return (
    <Modal title="Update sensory profile" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Use short, everyday phrases. This home context helps the care team
          understand what supports connection.
        </p>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Things that help
          </span>
          <textarea
            data-testid="textarea-parent-sensory-supports"
            value={supports}
            onChange={(event) => setSupports(event.target.value)}
            placeholder="Swinging, deep pressure, water play"
            className="min-h-24 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Things that are difficult
          </span>
          <textarea
            data-testid="textarea-parent-sensory-challenges"
            value={challenges}
            onChange={(event) => setChallenges(event.target.value)}
            placeholder="Loud environments, unexpected transitions"
            className="min-h-24 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Separate each item with a comma.
        </p>
        {mutation.isError && (
          <p className="text-sm text-destructive">
            We couldn’t update this profile. Please try again.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
            data-testid="button-submit-parent-sensory"
          >
            {mutation.isPending ? "Saving…" : "Save updates"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ObservationForm({
  childId,
  mode = "observation",
  initialBody,
  onClose,
}: {
  childId: number;
  mode?: "observation" | "question" | "classroom-note";
  initialBody?: string;
  onClose: () => void;
}) {
  const mutation = useCreateObservation();
  const client = useQueryClient();
  const [body, setBody] = useState(initialBody ?? "");
  const isQuestion = mode === "question";
  const isClassroomNote = mode === "classroom-note";
  const [context, setContext] = useState(
    isQuestion
      ? "Question for clinician"
      : isClassroomNote
        ? "Classroom note"
        : "Home",
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      { params: { childId }, data: { body, context } },
      {
        onSuccess: () => {
          client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          client.invalidateQueries({
            queryKey: getGetTeacherCommunicationHelperQueryKey(),
          });
          onClose();
        },
      },
    );
  };
  return (
    <Modal
      title={
        isQuestion
          ? "Ask the care team"
          : isClassroomNote
            ? "Save to classroom notes"
            : "Capture a small moment"
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          {isQuestion
            ? "Share a question or a little context for the clinician. It will appear as a private care-team observation."
            : isClassroomNote
              ? "Save a short classroom note so the care team can understand what was happening around this phrase."
              : "What happened around the communication? The ordinary details often carry the most useful meaning."}
        </p>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {isQuestion
              ? "Your question"
              : isClassroomNote
                ? "Classroom note"
                : "Observation"}
          </span>
          <textarea
            data-testid="textarea-observation-body"
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              isQuestion
                ? "What would you like the team to know or help with?"
                : isClassroomNote
                  ? "What was happening around this phrase?"
                  : "I noticed..."
            }
            className="min-h-32 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        {!isQuestion && !isClassroomNote && (
          <SelectField
            label="Where did it happen?"
            value={context}
            onChange={setContext}
            options={[
              "Home",
              "School",
              "Therapy",
              "Community",
              "Transport",
              "Other",
            ]}
            testId="select-observation-context"
          />
        )}
        {mutation.isError && (
          <p className="text-sm text-destructive">
            We couldn’t save that note. Please try again.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="quiet"
            onClick={onClose}
            data-testid="button-cancel-observation"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !body}
            data-testid="button-submit-observation"
          >
            {mutation.isPending
              ? "Saving…"
              : isQuestion
                ? "Send question"
                : isClassroomNote
                  ? "Save classroom note"
                  : "Save observation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TeamQuestionForm({
  childId,
  phrase,
  notifyClinician = false,
  onClose,
}: {
  childId: number;
  phrase?: string;
  notifyClinician?: boolean;
  onClose: () => void;
}) {
  const mutation = useCreateTeamMessage();
  const client = useQueryClient();
  const [body, setBody] = useState(
    phrase
      ? `${notifyClinician ? "Clinician attention requested" : "Question"} about “${phrase}”:\n`
      : "",
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      {
        data: {
          childId,
          body: body.trim(),
          messageType: notifyClinician ? "notification" : "question",
        },
      },
      {
        onSuccess: () => {
          client.invalidateQueries({
            queryKey: getGetTeamInboxQueryKey({ childId }),
          });
          client.invalidateQueries({
            queryKey: getGetTeacherCommunicationHelperQueryKey(),
          });
          onClose();
        },
      },
    );
  };
  return (
    <Modal
      title={notifyClinician ? "Notify assigned clinician" : "Ask the team"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="rounded-2xl border border-primary/15 bg-secondary/35 p-4 text-sm leading-6 text-muted-foreground">
          {notifyClinician
            ? "This creates a team-visible notification for the assigned clinician. The entire assigned team can see it; ChildLed does not send direct messages."
            : "Your note is shared with the whole assigned team, including the clinician. ChildLed does not send direct messages or make a clinical conclusion from this question."}
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {notifyClinician
              ? "What needs clinician attention?"
              : "Your question"}
          </span>
          <textarea
            data-testid="textarea-team-question"
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              notifyClinician
                ? "What would you like the clinician to review?"
                : "What would you like the team to help with?"
            }
            className="min-h-32 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
        {mutation.isError && (
          <p className="text-sm text-destructive">
            We couldn’t send that question. Please try again.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !body.trim()}
            data-testid="button-submit-team-question"
          >
            {mutation.isPending
              ? "Sending…"
              : notifyClinician
                ? "Notify clinician"
                : "Ask the team"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CommentForm({
  gestalt,
  onClose,
}: {
  gestalt: Gestalt;
  onClose: () => void;
}) {
  const mutation = useAddGestaltComment();
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      { params: { gestaltId: gestalt.id }, data: { body } },
      {
        onSuccess: () => {
          client.invalidateQueries({
            queryKey: getListGestaltsQueryKey({ childId: gestalt.childId }),
          });
          onClose();
        },
      },
    );
  };
  return (
    <Modal title={`Notes on “${gestalt.phrase}”`} onClose={onClose}>
      <div className="rounded-2xl bg-secondary/55 p-5">
        <p className="serif text-2xl">“{gestalt.phrase}”</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {gestalt.meaning}
        </p>
      </div>
      <div className="mt-6 space-y-4">
        {gestalt.comments?.length ? (
          gestalt.comments.map((comment: Comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar
                name={comment.author}
                className="size-8 bg-muted text-[10px]"
              />
              <div>
                <p className="text-sm leading-6">{comment.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {comment.author} · {comment.role} ·{" "}
                  {timeAgo(comment.createdAt)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No notes yet. Add the context only your team knows.
          </p>
        )}
      </div>
      <form
        onSubmit={submit}
        className="mt-6 flex gap-2 border-t border-border pt-5"
      >
        <input
          data-testid="input-gestalt-comment"
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a note for the team..."
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none transition-shadow focus-ring"
        />
        <Button
          type="submit"
          disabled={mutation.isPending || !body}
          data-testid="button-submit-comment"
        >
          {mutation.isPending ? "…" : "Add note"}
        </Button>
      </form>
    </Modal>
  );
}

function ClinicalKnowledgePage({
  childId,
  child,
}: {
  childId?: number;
  child?: Child;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");
  const sources = useListClinicalKnowledgeSources();
  const insights = useListClinicalKnowledgeInsights(
    { childId: childId ?? 0 },
    {
      query: {
        queryKey: getListClinicalKnowledgeInsightsQueryKey({
          childId: childId ?? 0,
        }),
        enabled: Boolean(childId),
      },
    },
  );
  const createSource = useCreateClinicalKnowledgeSource({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListClinicalKnowledgeSourcesQueryKey(),
        });
        setFile(null);
        setTitle("");
        setNotice(
          "Source processed and added to this private organization library.",
        );
      },
    },
  });
  const generate = useGenerateClinicalKnowledgeInsights({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListClinicalKnowledgeInsightsQueryKey({
            childId: childId ?? 0,
          }),
        });
        setNotice("Citation-backed drafts are ready for clinician review.");
      },
    },
  });
  const review = useReviewClinicalKnowledgeInsight({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getListClinicalKnowledgeInsightsQueryKey({
            childId: childId ?? 0,
          }),
        }),
    },
  });
  const upload = async () => {
    if (!file) {
      setNotice("Choose a PDF, DOCX, text, Markdown, or HTML source first.");
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    createSource.mutate({
      data: {
        title: title.trim() || file.name,
        sourceType: "Clinician-curated reference",
        contentType: file.type || "text/plain",
        data,
      },
    });
  };
  const confidenceScore = (confidence: "high" | "medium" | "low") =>
    confidence === "high" ? 90 : confidence === "medium" ? 65 : 35;
  const displayCategory = (category: string) =>
    category === "nla_stage_indicator"
      ? "Possible stage indicator"
      : category.replaceAll("_", " ");
  return (
    <div className="space-y-7 animate-rise">
      <SectionHeading
        eyebrow="Clinician workspace"
        title="Clinical Knowledge"
        description={`Private, organization-scoped references create citation-backed review prompts for ${child?.name ?? "the selected child"}.`}
      />
      <ClinicalDisclaimer />
      <AIDisclaimer />
      {notice && (
        <p className="rounded-xl border border-primary/20 bg-secondary/40 px-4 py-3 text-sm font-semibold text-primary">
          {notice}
        </p>
      )}
      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="serif text-2xl font-semibold">
              Private source library
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Source files and extracted excerpts remain private. Suggestions
              always name their source.
            </p>
          </div>
          <label className="text-sm font-semibold">
            Title{" "}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional source title"
              className="ml-2 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            aria-label="Knowledge source file"
            type="file"
            accept=".pdf,.docx,.txt,.md,.html,text/plain,text/markdown,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="warm"
            onClick={upload}
            disabled={!file || createSource.isPending}
          >
            {createSource.isPending ? "Processing…" : "Add private source"}
          </Button>
        </div>
        <div className="mt-5 space-y-2">
          {sources.isLoading ? (
            <LoadingBlocks />
          ) : sources.data?.sources.length ? (
            sources.data.sources.map((source) => (
              <div
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-semibold">{source.title}</span>
                  {source.citation && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {source.citation}
                    </p>
                  )}
                </div>
                <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {source.status} · {source.sourceType}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No organization sources yet. Add a clinician-curated reference to
              enable grounded suggestions.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-3xl border border-border bg-card p-6 soft-shadow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="serif text-2xl font-semibold">
              Cited clinical insights
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only reviewed Child phrase evidence is eligible. Routine
              high-confidence findings apply automatically; exceptions stay with
              the clinician.
            </p>
          </div>
          <Button
            variant="warm"
            onClick={() => childId && generate.mutate({ data: { childId } })}
            disabled={!childId || generate.isPending}
          >
            {generate.isPending ? "Refreshing…" : "Refresh cited insights"}
          </Button>
        </div>
        <div className="mt-5 space-y-4">
          {insights.isLoading ? (
            <LoadingBlocks />
          ) : insights.data?.insights.length ? (
            insights.data.insights.map((insight) => (
              <article
                key={insight.id}
                className="rounded-2xl border border-border/70 p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <h3 className="font-semibold">
                    {displayCategory(insight.category)}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="mono rounded-full bg-secondary px-2 py-1 text-[10px] uppercase tracking-wider text-primary">
                      {confidenceScore(insight.confidence)}/100 ·{" "}
                      {insight.confidence}
                    </span>
                    {insight.disposition === "exception" && (
                      <span className="rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
                        Clinician review required
                      </span>
                    )}
                    <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {insight.status}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6">
                  {insight.clinicianEdit || insight.suggestion}
                </p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {insight.rationale}
                </p>
                <p className="mt-3 text-xs font-medium text-primary">
                  Sources:{" "}
                  {insight.citations
                    .map(
                      (citation) =>
                        `${citation.sourceTitle}${citation.page ? ` p. ${citation.page}` : ""}${citation.section ? ` · ${citation.section}` : ""}`,
                    )
                    .join(" · ")}
                </p>
                {insight.disposition === "exception" &&
                insight.status !== "reviewed" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        review.mutate({
                          insightId: insight.id,
                          data: { status: "reviewed" },
                        })
                      }
                    >
                      Mark reviewed
                    </Button>
                  </div>
                ) : insight.disposition === "applied" &&
                  insight.status !== "reverted" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="quiet"
                      onClick={() =>
                        review.mutate({
                          insightId: insight.id,
                          data: { status: "reverted" },
                        })
                      }
                    >
                      Reverse automatic update
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyState
              icon={Lightbulb}
              title="No insights yet"
              body="Private clinical references will inform automatic findings once reviewed Child evidence is available."
            />
          )}
        </div>
      </section>
    </div>
  );
}

function AdminPortal({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <div className="space-y-7 animate-rise">
      <SectionHeading
        eyebrow="Administrative workspace"
        title="Care-team governance"
        description="Review the safeguards, privacy controls, and organization-level settings that keep each care-team workspace accountable."
      />
      <section className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground soft-shadow md:p-8">
        <div className="absolute -right-12 -top-20 size-64 rounded-full border-[28px] border-accent/15" />
        <div className="relative max-w-2xl">
          <p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-accent">
            Admin overview
          </p>
          <h2 className="serif mt-3 text-3xl font-semibold">
            Keep the shared workspace safe and clear.
          </h2>
          <p className="mt-3 text-sm leading-6 text-primary-foreground/75">
            Security, retention, and privacy requests stay separate from the
            child’s clinical workspace. Administrative access does not turn into
            clinical access.
          </p>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        <Link
          href="/security"
          data-testid="link-admin-security"
          className="brand-card group rounded-3xl border border-border bg-card p-6 soft-shadow transition hover:-translate-y-0.5 hover:border-primary/25"
        >
          <Shield className="text-primary" size={22} />
          <h3 className="serif mt-5 text-xl font-semibold">
            Security & privacy
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Review access safeguards, retention controls, and privacy request
            history.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Open security controls <ArrowRight size={16} />
          </span>
        </Link>
        {isSuperAdmin ? (
          <Link
            href="/ux-testing"
            data-testid="link-admin-ux-testing"
            className="brand-card group rounded-3xl border border-accent/35 bg-secondary/45 p-6 soft-shadow transition hover:-translate-y-0.5 hover:border-accent/60"
          >
            <Sparkles className="text-primary" size={22} />
            <h3 className="serif mt-5 text-xl font-semibold">
              User Experience Testing
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Safely review the SLP, parent, teacher, and Admin experiences
              without signing in as another person.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Open Testing Center <ArrowRight size={16} />
            </span>
          </Link>
        ) : (
          <section className="brand-card rounded-3xl border border-border bg-card p-6 soft-shadow">
            <Users className="text-primary" size={22} />
            <h3 className="serif mt-5 text-xl font-semibold">
              Organization access
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Invite care-team members with the right role and child assignments
              through your secure organization process.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function CaseloadPage({
  children,
  invitations,
  loading,
  onAddStudent,
  onOpenStudent,
  onInvite,
}: {
  children: Child[];
  invitations: CareTeamInvitation[];
  loading: boolean;
  onAddStudent: () => void;
  onOpenStudent: (child: Child) => void;
  onInvite: (child: Child) => void;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = children.filter((child) =>
    [child.name, child.school, child.grade].some((value) =>
      value.toLowerCase().includes(normalizedSearch),
    ),
  );
  const pendingByChild = new Map<number, number>();
  invitations
    .filter((invitation) => invitation.status === "pending")
    .forEach((invitation) =>
      pendingByChild.set(
        invitation.childId,
        (pendingByChild.get(invitation.childId) ?? 0) + 1,
      ),
    );
  return (
    <div className="space-y-8 animate-rise">
      <SectionHeading
        eyebrow="Clinician accounts"
        title="My caseload"
        description="Create and manage all of the student profiles assigned to you, then invite the adults who support each child."
        action={
          <Button
            onClick={onAddStudent}
            data-testid="button-caseload-add-student"
          >
            <Plus size={16} /> Add student
          </Button>
        }
      />
      <section className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground soft-shadow md:p-8">
        <div className="absolute -right-14 -top-16 size-64 rounded-full border-[28px] border-accent/15" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-accent">
              Your students
            </p>
            <h2 className="serif mt-3 text-3xl font-semibold">
              One clear home for every child you support.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/75">
              Student profiles are not capped. Search your assigned caseload,
              open a profile, or start a new one whenever your practice grows.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
              <p className="mono text-[9px] font-bold uppercase tracking-[.16em] text-primary-foreground/55">
                Students
              </p>
              <p className="serif mt-1 text-3xl">{children.length}</p>
            </div>
            <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-4">
              <p className="mono text-[9px] font-bold uppercase tracking-[.16em] text-primary-foreground/55">
                Pending invites
              </p>
              <p className="serif mt-1 text-3xl">
                {
                  invitations.filter(
                    (invitation) => invitation.status === "pending",
                  ).length
                }
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-3xl border border-border bg-card p-5 soft-shadow md:p-6">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <input
            data-testid="input-search-caseload"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by student, school, or grade…"
            className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-sm outline-none transition-shadow focus-ring"
          />
        </label>
      </section>
      {loading ? (
        <LoadingBlocks />
      ) : filtered.length ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((child) => (
            <article
              key={child.id}
              data-testid={`caseload-student-${child.id}`}
              className="brand-card flex flex-col rounded-3xl border border-border bg-card p-6 soft-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-12 place-items-center rounded-2xl bg-secondary text-lg font-semibold text-primary">
                  {initials(child.name)}
                </div>
                {pendingByChild.get(child.id) ? (
                  <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold text-primary">
                    {pendingByChild.get(child.id)} invite
                    {pendingByChild.get(child.id) === 1 ? "" : "s"} pending
                  </span>
                ) : (
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-primary">
                    Assigned
                  </span>
                )}
              </div>
              <h2 className="serif mt-5 text-2xl font-semibold">
                {child.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {child.school || "School not added"} ·{" "}
                {child.grade || "Grade not added"}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-secondary px-3 py-1.5 text-xs text-primary">
                  {child.gestaltCount} phrase
                  {child.gestaltCount === 1 ? "" : "s"} logged
                </span>
                <span className="rounded-full bg-secondary px-3 py-1.5 text-xs text-primary">
                  {child.communicationStyle || "Communication profile"}
                </span>
              </div>
              <div className="mt-6 flex gap-2 border-t border-border pt-5">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenStudent(child)}
                  data-testid={`button-open-student-${child.id}`}
                >
                  Open profile
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => onInvite(child)}
                  data-testid={`button-invite-student-${child.id}`}
                >
                  <UserPlus size={15} /> Invite
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={Users}
          title="No students match that search"
          body={
            search
              ? "Try a different name, school, or grade."
              : "Add your first student profile to begin building your caseload."
          }
          action={
            !search ? (
              <Button onClick={onAddStudent}>
                <Plus size={16} /> Add student
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function CareTeamInvitationForm({
  child,
  onClose,
}: {
  child: Child;
  onClose: () => void;
}) {
  const mutation = useCreateCareTeamInvitation();
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Parent" | "Teacher">("Parent");
  const invitationPath = mutation.data?.invitationPath;
  const copyInvitation = async () => {
    if (!invitationPath) return;
    await navigator.clipboard.writeText(
      new URL(invitationPath, window.location.origin).toString(),
    );
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      { data: { childId: child.id, email, role } },
      {
        onSuccess: () => {
          client.invalidateQueries({
            queryKey: getListCareTeamInvitationsQueryKey(),
          });
        },
      },
    );
  };
  return (
    <Modal
      title={`Invite a care-team member for ${child.name}`}
      onClose={onClose}
    >
      {invitationPath ? (
        <section className="space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-secondary/45 p-5">
            <p className="font-semibold text-primary">Invitation ready</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Copy this one-time invitation now and share it with{" "}
              <strong className="text-foreground">{email}</strong> through your
              organization’s approved secure channel. For safety, ChildLed
              cannot show the token again after you close this window.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={copyInvitation}
              data-testid="button-copy-invitation"
            >
              Copy invitation link
            </Button>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </section>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-2xl border border-primary/15 bg-secondary/35 p-4 text-sm leading-6 text-muted-foreground">
            Create a secure pending invitation for a parent or teacher assigned
            to <strong className="text-foreground">{child.name}</strong>.
            ChildLed records the invitation for your organization; delivery
            stays within your organization’s approved invite process.
          </div>
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Email address
            </span>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <input
                data-testid="input-invite-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="caregiver@example.com"
                className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none transition-shadow focus-ring"
              />
            </div>
          </label>
          <SelectField
            label="Role"
            value={role}
            onChange={(value) => setRole(value as "Parent" | "Teacher")}
            options={["Parent", "Teacher"]}
            testId="select-invite-role"
          />
          {mutation.isError && (
            <p className="text-sm text-destructive">
              We couldn’t create that invitation. Check the email address and
              try again.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !email.trim()}
              data-testid="button-submit-invite"
            >
              {mutation.isPending ? "Creating…" : "Create invitation"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function SessionsLandingPage({
  children,
  initialChildId,
  onSaved,
}: {
  children: Child[];
  initialChildId?: number;
  onSaved: (session: Session) => void;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const deleteQueuedSessionDraft = useDeleteSessionTranscriptionDraft();
  const childSelectRef = useRef<HTMLSelectElement | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<number | undefined>(
    initialChildId,
  );
  const [resumeTranscriptId, setResumeTranscriptId] = useState<
    number | undefined
  >();
  const [openedRecording, setOpenedRecording] = useState<{
    childId: number;
    sessionId: number;
  }>();
  const [sessionActive, setSessionActive] = useState(false);
  const [startRequestToken, setStartRequestToken] = useState(0);
  const [pendingChildSelection, setPendingChildSelection] = useState<{
    childId?: number;
  } | null>(null);
  const [draftDeletionTarget, setDraftDeletionTarget] = useState<{
    transcriptId: number;
    childId: number;
    childName: string;
  }>();
  const [draftDeletionError, setDraftDeletionError] = useState("");
  const sessionsDashboardQuery = useGetSessionsDashboard({
    query: {
      queryKey: getGetSessionsDashboardQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    },
  });
  const manualSessionSetupQuery = useGetManualSessionSetup(
    { childId: selectedChildId ?? 0 },
    {
      query: {
        queryKey: getGetManualSessionSetupQueryKey({
          childId: selectedChildId ?? 0,
        }),
        enabled: Boolean(selectedChildId),
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  );
  const openedRecordingQuery = useListSessions(
    { childId: openedRecording?.childId ?? 0 },
    {
      query: {
        queryKey: getListSessionsQueryKey({
          childId: openedRecording?.childId ?? 0,
        }),
        enabled: Boolean(openedRecording),
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  );
  const selectedChild = children.find((child) => child.id === selectedChildId);
  const openedSession = openedRecordingQuery.data?.find(
    (session) => session.id === openedRecording?.sessionId,
  );
  useEffect(() => {
    setSelectedChildId(initialChildId);
    setResumeTranscriptId(undefined);
    setOpenedRecording(undefined);
    setSessionActive(false);
    setStartRequestToken(0);
    setPendingChildSelection(null);
  }, [initialChildId]);
  const reviewStatusLabel = (
    status: NonNullable<
      typeof sessionsDashboardQuery.data
    >["requiresReview"][number]["workflowStatus"],
  ) =>
    ({
      child_language_review_not_started: "Child Language Review not started",
      child_language_review_in_progress: "Child Language Review in progress",
      child_phrase_inbox: "Child Phrase Inbox incomplete",
      session_summary: "Session Summary draft incomplete",
    })[status];
  const requiringReview = sessionsDashboardQuery.data?.requiresReview ?? [];
  const completedSessions =
    sessionsDashboardQuery.data?.completedSessions ?? [];
  const selectedChildRecordings = selectedChildId
    ? completedSessions.filter((session) => session.childId === selectedChildId)
    : [];
  const selectedChildDrafts = selectedChildId
    ? (sessionsDashboardQuery.data?.draftDocumentation ?? []).filter(
        (draft) => draft.childId === selectedChildId,
      )
    : [];
  const selectedChildReviews = selectedChildId
    ? requiringReview.filter((item) => item.childId === selectedChildId)
    : [];
  const selectedChildLastSession = selectedChildRecordings[0];
  const activeReviewItem = resumeTranscriptId
    ? requiringReview.find((item) => item.transcriptId === resumeTranscriptId)
    : undefined;
  const currentWorkflowIndex = activeReviewItem
    ? activeReviewItem.workflowStatus === "session_summary"
      ? 3
      : 2
    : 0;
  const workflowSteps = [
    { label: "Start", icon: Play },
    { label: "Record", icon: Mic },
    { label: "Review", icon: ClipboardList },
    { label: "Finalize", icon: FileText },
    { label: "Complete", icon: Check },
  ];
  const weeklySnapshot = sessionsDashboardQuery.data?.weeklySnapshot;
  const applyChildSelection = (childId?: number) => {
    setSelectedChildId(childId);
    setResumeTranscriptId(undefined);
    setOpenedRecording(undefined);
    setSessionActive(false);
    setStartRequestToken(0);
    setPendingChildSelection(null);
  };
  const requestChildSelection = (childId?: number) => {
    if (childId === selectedChildId) return;
    if (sessionActive) {
      setPendingChildSelection({ childId });
      return;
    }
    applyChildSelection(childId);
  };
  const requestNewRecording = () => {
    if (!selectedChildId) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      childSelectRef.current?.focus();
      return;
    }
    setResumeTranscriptId(undefined);
    setOpenedRecording(undefined);
    setStartRequestToken((current) => current + 1);
  };
  const requestManualSession = () => {
    if (!selectedChildId) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      childSelectRef.current?.focus();
      return;
    }
    setLocation(`/manual-session?childId=${selectedChildId}`);
  };
  const permanentlyDeleteQueuedDraft = async () => {
    if (!draftDeletionTarget || deleteQueuedSessionDraft.isPending) return;
    setDraftDeletionError("");
    try {
      await deleteQueuedSessionDraft.mutateAsync({
        params: {
          childId: draftDeletionTarget.childId,
          transcriptId: draftDeletionTarget.transcriptId,
        },
      });
      if (resumeTranscriptId === draftDeletionTarget.transcriptId) {
        setResumeTranscriptId(undefined);
        setSessionActive(false);
      }
      setDraftDeletionTarget(undefined);
      await queryClient.invalidateQueries({
        queryKey: getGetSessionsDashboardQueryKey(),
      });
    } catch (error: any) {
      setDraftDeletionError(
        error?.data?.error ??
          error?.message ??
          "The unfinished session could not be deleted. Please try again.",
      );
    }
  };
  const switchingToChild = children.find(
    (child) => child.id === pendingChildSelection?.childId,
  );
  const isAacActive = Boolean(
    selectedChild &&
    /aac|augmentative|device/i.test(selectedChild.communicationStyle),
  );
  const heroSticks = Boolean(
    selectedChild && !sessionActive && !resumeTranscriptId,
  );

  return (
    <div className="min-w-0 max-w-full space-y-7 overflow-x-clip animate-rise">
      {draftDeletionTarget && (
        <Modal
          title="Delete this unfinished session?"
          onClose={() => {
            if (deleteQueuedSessionDraft.isPending) return;
            setDraftDeletionTarget(undefined);
            setDraftDeletionError("");
          }}
        >
          <div className="space-y-5" data-testid="dialog-delete-session-draft">
            <p className="text-sm leading-6 text-muted-foreground">
              This permanently deletes {draftDeletionTarget.childName}’s
              unfinished recording, transcript, and review work. It cannot be
              undone.
            </p>
            {draftDeletionError && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {draftDeletionError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="quiet"
                className="min-h-12"
                onClick={() => {
                  setDraftDeletionTarget(undefined);
                  setDraftDeletionError("");
                }}
                disabled={deleteQueuedSessionDraft.isPending}
              >
                Cancel
              </Button>
              <Button
                className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void permanentlyDeleteQueuedDraft()}
                disabled={deleteQueuedSessionDraft.isPending}
                data-testid="button-confirm-delete-session-draft"
              >
                <Trash2 size={16} />
                {deleteQueuedSessionDraft.isPending
                  ? "Deleting…"
                  : "Delete permanently"}
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Required security audit records do not contain the recording or
              transcript.
            </p>
          </div>
        </Modal>
      )}
      <section
        className={`${sessionActive ? "hidden" : ""} ${heroSticks ? "lg:sticky lg:top-2 lg:z-20" : ""} overflow-hidden rounded-[2rem] border border-primary/15 bg-card soft-shadow`}
        data-testid="recording-hero"
      >
        <div className="relative p-5 md:p-7 lg:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-secondary/70 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 left-1/3 size-48 rounded-full bg-accent/10 blur-3xl"
          />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-stretch">
            {/* Left Column: Context & Workflow */}
            <div className="flex flex-1 flex-col justify-between gap-6">
              <div>
                <p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-primary">
                  Clinician Workspace · New Session
                </p>
                {selectedChild ? (
                  <div className="mt-5">
                    <div className="flex items-start gap-4">
                      {selectedChild.photoUrl ? (
                        <img
                          src={selectedChild.photoUrl}
                          alt=""
                          className="size-16 shrink-0 rounded-2xl object-cover ring-4 ring-secondary md:size-20"
                        />
                      ) : (
                        <Avatar
                          name={selectedChild.name}
                          className="size-16 rounded-2xl bg-secondary text-lg ring-4 ring-card md:size-20"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
                          <div className="min-w-0">
                            <h1
                              className="serif break-words text-2xl font-semibold sm:text-3xl md:text-4xl"
                              data-testid="recording-hero-title"
                            >
                              Session for {selectedChild.name}
                            </h1>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                                {selectedChild.age
                                  ? `Age ${selectedChild.age}`
                                  : selectedChild.grade || "Grade not added"}
                              </span>
                              {selectedChild.grade && (
                                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                                  {selectedChild.grade}
                                </span>
                              )}
                              {isAacActive && (
                                <span className="rounded-full bg-accent/20 px-2.5 py-1 text-primary">
                                  <MessageCircle
                                    className="mr-1 inline"
                                    size={12}
                                  />{" "}
                                  AAC active
                                </span>
                              )}
                            </div>
                          </div>
                          <label className="w-full text-left sm:w-auto sm:shrink-0 sm:text-right">
                            <span className="sr-only">Switch child</span>
                            <select
                              ref={childSelectRef}
                              value={selectedChildId ?? ""}
                              onChange={(event) =>
                                requestChildSelection(
                                  Number(event.target.value) || undefined,
                                )
                              }
                              className="h-10 w-full cursor-pointer rounded-xl border border-input bg-card px-2 text-xs font-bold text-muted-foreground outline-none transition-colors hover:bg-secondary/50 focus-ring sm:w-auto"
                              data-testid="select-session-child"
                            >
                              {children.map((child) => (
                                <option key={child.id} value={child.id}>
                                  {child.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-xl bg-background text-primary shadow-sm">
                          <Clock3 size={14} />
                        </span>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Last session
                          </p>
                          <p className="text-sm font-semibold">
                            {selectedChildLastSession
                              ? new Date(
                                  selectedChildLastSession.sessionDate,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "No session yet"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-xl bg-background text-accent shadow-sm">
                          <ClipboardList size={14} />
                        </span>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Pending review
                          </p>
                          <p className="text-sm font-semibold">
                            {selectedChildReviews.length}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-xl bg-background text-primary/60 shadow-sm">
                          <FileText size={14} />
                        </span>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Draft count
                          </p>
                          <p className="text-sm font-semibold">
                            {selectedChildDrafts.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5">
                    <h1 className="serif text-3xl font-semibold tracking-tight md:text-5xl">
                      Start a Therapy Session
                    </h1>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                      Choose an authorized child, then record the session or
                      track IEP goal progress manually.
                    </p>
                    <label className="mt-6 block max-w-sm">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">
                        Student
                      </span>
                      <select
                        ref={childSelectRef}
                        value={selectedChildId ?? ""}
                        onChange={(event) =>
                          requestChildSelection(
                            Number(event.target.value) || undefined,
                          )
                        }
                        className="h-12 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none focus-ring"
                        data-testid="select-session-child"
                      >
                        <option value="">Select a child</option>
                        {children.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>

              {/* Workflow Trail */}
              <div className="mt-2" aria-label="Session workflow">
                <p className="sr-only">
                  Current workflow step:{" "}
                  {workflowSteps[currentWorkflowIndex].label}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {workflowSteps.map((step, index) => {
                    const complete = index < currentWorkflowIndex;
                    const current = index === currentWorkflowIndex;
                    return (
                      <div
                        key={step.label}
                        aria-current={current ? "step" : undefined}
                        className="min-w-0 text-center"
                      >
                        <span
                          className={`block h-2 rounded-full ${current || complete ? "bg-primary" : "bg-muted"}`}
                        />
                        <span
                          className={`mt-2 block truncate text-[9px] font-bold sm:text-[10px] ${current ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Dominant Action & Readiness */}
            <div className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
              <div className="flex flex-col justify-center rounded-3xl border border-primary/15 bg-secondary/30 p-5 pt-6 text-center">
                <div className="grid gap-3">
                  <Button
                    variant="primary"
                    className="min-h-14 w-full text-base shadow-lg"
                    onClick={requestNewRecording}
                    disabled={
                      !selectedChild ||
                      sessionActive ||
                      Boolean(resumeTranscriptId)
                    }
                    data-testid="button-start-recording"
                  >
                    <Mic size={18} />
                    {sessionActive
                      ? "Session in progress"
                      : resumeTranscriptId
                        ? "Previous work is open"
                        : "Record Session"}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-14 w-full text-base"
                    onClick={requestManualSession}
                    disabled={
                      !selectedChild ||
                      sessionActive ||
                      Boolean(resumeTranscriptId)
                    }
                    data-testid="button-start-manual-session"
                  >
                    <ClipboardList size={18} /> Track Manually
                  </Button>
                </div>
                <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
                  Audio consent is required only when recording. Manual tracking
                  stores session and goal data without audio.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/35 p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-xl ${selectedChild ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground"} shadow-sm`}
                  >
                    <Shield size={16} />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-foreground">
                      Session Ready
                    </h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {selectedChild
                        ? "Choose recording or manual IEP goal tracking for this therapy session."
                        : "Select a child to prepare the session options."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {selectedChild && (
        <SessionRecorderPage
          key={`${selectedChild.id}-${resumeTranscriptId ?? "new"}`}
          childId={selectedChild.id}
          child={selectedChild}
          resumeTranscriptId={resumeTranscriptId}
          startRequestToken={startRequestToken}
          onSessionActivityChange={setSessionActive}
          onExit={() => {
            setResumeTranscriptId(undefined);
            setOpenedRecording(undefined);
            setSessionActive(false);
            setStartRequestToken(0);
            setLocation("/");
          }}
          onSaved={onSaved}
        />
      )}
      <section
        className="rounded-3xl border border-border bg-card p-5 soft-shadow md:p-7"
        data-testid="sessions-weekly-snapshot"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">
              Progress snapshot
            </p>
            <h2 className="serif mt-2 text-2xl font-semibold">This Week</h2>
          </div>
          {weeklySnapshot && (
            <p className="text-xs text-muted-foreground">
              Since{" "}
              {new Date(
                `${weeklySnapshot.weekStart}T00:00:00`,
              ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          )}
        </div>
        {sessionsDashboardQuery.isLoading ? (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        ) : sessionsDashboardQuery.isError || !weeklySnapshot ? (
          <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            This week’s operational snapshot is temporarily unavailable. Session
            tools remain ready.
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Sessions Completed",
                value: weeklySnapshot.sessionsRecorded,
                icon: AudioWaveform,
              },
              {
                label: "Awaiting Review",
                value: weeklySnapshot.awaitingReview,
                icon: ClipboardList,
              },
              {
                label: "Draft Notes",
                value: weeklySnapshot.draftNotes,
                icon: FileText,
              },
              {
                label: "Completed Notes",
                value: weeklySnapshot.completedNotes,
                icon: Check,
              },
            ].map((metric) => (
              <article
                key={metric.label}
                className="rounded-2xl border border-primary/10 bg-secondary/30 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <metric.icon className="text-primary" size={18} />
                  <span className="mono text-2xl font-bold text-primary">
                    {metric.value}
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-muted-foreground">
                  {metric.label}
                </p>
              </article>
            ))}
          </div>
        )}
        {selectedChildId &&
          manualSessionSetupQuery.data?.serviceRequirements.map(
            (requirement) => (
              <div
                key={requirement.id}
                className="mt-5 border-t border-border pt-5"
                data-testid={`service-status-${requirement.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {requirement.serviceName} · {requirement.periodLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      IEP service delivery status
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      requirement.status === "complete"
                        ? "bg-primary/10 text-primary"
                        : requirement.status === "behind"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {requirement.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ["Required sessions", requirement.requiredSessions],
                    ["Completed sessions", requirement.sessionsCompleted],
                    ["Sessions remaining", requirement.sessionsRemaining],
                    ["Required minutes", requirement.requiredMinutes],
                    ["Completed minutes", requirement.minutesCompleted],
                    ["Minutes remaining", requirement.minutesRemaining],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-muted/40 p-3">
                      <p className="text-lg font-bold">{value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
      </section>
      {openedRecording && (
        <section
          className="rounded-3xl border border-primary/20 bg-card p-5 soft-shadow md:p-7"
          data-testid="opened-historical-recording"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">
                Opened explicitly
              </p>
              <h2 className="serif mt-2 text-2xl font-semibold">
                {openedSession?.sessionMode === "manual"
                  ? "Manual Session"
                  : "Previous Recording"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This completed session is separate from the new-session
                workspace above.
              </p>
            </div>
            <Button
              variant="quiet"
              onClick={() => setOpenedRecording(undefined)}
            >
              Close
            </Button>
          </div>
          {openedRecordingQuery.isLoading ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Opening the selected recording…
            </p>
          ) : openedRecordingQuery.isError || !openedSession ? (
            <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              The selected recording could not be opened. The New Recording
              workspace remains unchanged.
            </p>
          ) : (
            <div className="mt-5 rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {children.find(
                      (child) => child.id === openedSession.childId,
                    )?.name ?? "Assigned child"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(openedSession.createdAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}{" "}
                    ·{" "}
                    {Math.max(1, Math.ceil(openedSession.durationSeconds / 60))}{" "}
                    min
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                  Completed session
                </span>
              </div>
              {openedSession.goalProgress?.length ? (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground">
                    IEP goals addressed
                  </p>
                  {openedSession.goalProgress.map((progress) => (
                    <div
                      key={progress.id}
                      className="rounded-xl bg-muted/40 p-3"
                    >
                      <p className="text-sm font-semibold">
                        {progress.goalTitle}
                      </p>
                      <p className="mt-1 text-xs text-primary">
                        {progress.goalArea}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {[
                          progress.accuracyPercent === null
                            ? null
                            : `${progress.accuracyPercent}% accuracy`,
                          progress.totalAttempts === null
                            ? null
                            : `${progress.successfulAttempts ?? 0}/${progress.totalAttempts} attempts`,
                          progress.promptingLevel
                            ? `${progress.promptingLevel} support`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {progress.progressNote && (
                        <p className="mt-2 text-sm leading-6">
                          {progress.progressNote}
                        </p>
                      )}
                    </div>
                  ))}
                  {openedSession.note && (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {openedSession.note}
                    </p>
                  )}
                </div>
              ) : null}
              {openedSession.audioUrl ? (
                <audio
                  controls
                  preload="metadata"
                  className="mt-4 h-10 w-full"
                  src={`${basePath}${openedSession.audioUrl}`}
                  data-testid="audio-opened-historical-recording"
                />
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                  {openedSession.sessionMode === "manual"
                    ? "This session was tracked manually without audio."
                    : "This completed session has no retained recording audio."}
                </p>
              )}
            </div>
          )}
        </section>
      )}
      <section
        className="rounded-3xl border border-border bg-card p-5 soft-shadow md:p-7"
        data-testid="sessions-review-queue"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">
              Historical work
            </p>
            <h2 className="serif mt-2 text-2xl font-semibold">
              Continue Previous Work
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Unfinished work stays separate from New Recording and opens only
              when you choose Continue.
            </p>
          </div>
          <span
            className="inline-flex rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold text-primary"
            data-testid="sessions-attention-count"
          >
            {requiringReview.length} Sessions Need Attention
          </span>
        </div>
        {sessionsDashboardQuery.isLoading ? (
          <p className="mt-5 text-sm text-muted-foreground">
            Loading session review queue…
          </p>
        ) : sessionsDashboardQuery.isError ? (
          <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            The review queue is temporarily unavailable. Recording controls
            remain ready.
          </p>
        ) : requiringReview.length ? (
          <div className="mt-5">
            <h3 className="text-sm font-bold text-foreground">
              Recordings Requiring Review
            </h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {requiringReview.map((item) => {
                const visual =
                  item.workflowStatus === "child_language_review_not_started"
                    ? {
                        shell: "border-accent/35 bg-accent/8",
                        icon: AudioWaveform,
                        detail: `${item.reviewProgress.unresolved} utterance${item.reviewProgress.unresolved === 1 ? "" : "s"} remaining`,
                      }
                    : item.workflowStatus ===
                        "child_language_review_in_progress"
                      ? {
                          shell: "border-primary/25 bg-secondary/45",
                          icon: ClipboardList,
                          detail: `${item.reviewProgress.unresolved} utterance${item.reviewProgress.unresolved === 1 ? "" : "s"} remaining`,
                        }
                      : item.workflowStatus === "child_phrase_inbox"
                        ? {
                            shell: "border-accent/30 bg-accent/8",
                            icon: MessageCircle,
                            detail: `${item.activePhraseInboxCount} Phrase Inbox item${item.activePhraseInboxCount === 1 ? "" : "s"} pending`,
                          }
                        : {
                            shell: "border-primary/20 bg-secondary/35",
                            icon: FileText,
                            detail: "Ready for Session Summary",
                          };
                const StatusIcon = visual.icon;
                return (
                  <article
                    key={item.transcriptId}
                    className={`rounded-2xl border p-4 ${visual.shell}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-sm">
                        <StatusIcon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">
                          {item.childName}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-primary">
                          {visual.detail}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {reviewStatusLabel(item.workflowStatus)} ·{" "}
                          {new Date(item.sessionDate).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="outline"
                        className="min-h-11 min-w-0 flex-1"
                        onClick={() => {
                          if (sessionActive) {
                            setPendingChildSelection({ childId: item.childId });
                            return;
                          }
                          setSelectedChildId(item.childId);
                          setResumeTranscriptId(item.transcriptId);
                          setOpenedRecording(undefined);
                          setStartRequestToken(0);
                        }}
                        data-testid={`button-resume-session-${item.transcriptId}`}
                      >
                        Continue work <ArrowRight size={15} />
                      </Button>
                      <Button
                        variant="quiet"
                        className="size-11 shrink-0 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDraftDeletionError("");
                          setDraftDeletionTarget({
                            transcriptId: item.transcriptId,
                            childId: item.childId,
                            childName: item.childName,
                          });
                        }}
                        aria-label={`Delete ${item.childName}'s unfinished session`}
                        title="Delete unfinished session"
                        data-testid={`button-delete-session-${item.transcriptId}`}
                      >
                        <Trash2 size={17} />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="All Caught Up"
            body="You're all caught up. No recordings currently require review."
            action={
              <Button variant="primary" onClick={requestNewRecording}>
                <Mic size={16} /> Start New Recording
              </Button>
            }
          />
        )}
        <div
          className="mt-6 border-t border-border pt-5"
          data-testid="draft-documentation-section"
        >
          <h3 className="text-sm font-bold text-foreground">
            Draft Documentation
          </h3>
          {!selectedChildId ? (
            <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Select a child to see draft documentation without opening it.
            </p>
          ) : sessionsDashboardQuery.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Checking for draft documentation…
            </p>
          ) : selectedChildDrafts.length ? (
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {selectedChildDrafts.map((draft) => (
                <div
                  key={`${draft.noteType}-${draft.id}`}
                  className="flex flex-wrap items-center gap-4 bg-background px-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {draft.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last edited{" "}
                      {new Date(draft.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setLocation(`/reports?childId=${draft.childId}`)
                    }
                  >
                    Open Draft <ArrowRight size={15} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              No draft documentation for this child.
            </p>
          )}
        </div>
      </section>
      <section
        className="rounded-3xl border border-border bg-card p-5 soft-shadow md:p-7"
        data-testid="recent-recordings"
      >
        <div>
          <p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">
            Session history
          </p>
          <h2 className="serif mt-2 text-2xl font-semibold">Recent Sessions</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Recorded and manually tracked sessions are kept in one history.
          </p>
        </div>
        {!selectedChildId ? (
          <p className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Select a child to see recent sessions.
          </p>
        ) : sessionsDashboardQuery.isLoading ? (
          <p className="mt-5 text-sm text-muted-foreground">
            Loading completed sessions…
          </p>
        ) : selectedChildRecordings.length ? (
          <div className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {selectedChildRecordings.map((session) => (
              <div
                key={session.sessionId}
                className="flex flex-wrap items-center justify-between gap-4 bg-background px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{session.childName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(session.sessionDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" · "}
                    {session.sessionMode === "manual" ? "Manual" : "Recorded"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResumeTranscriptId(undefined);
                    setStartRequestToken(0);
                    setOpenedRecording({
                      childId: session.childId,
                      sessionId: session.sessionId,
                    });
                  }}
                  data-testid={`button-open-session-${session.sessionId}`}
                >
                  Open Session <ArrowRight size={15} />
                </Button>
              </div>
            ))}
          </div>
        ) : !sessionsDashboardQuery.isError ? (
          <p className="mt-5 text-sm text-muted-foreground">
            No recent sessions for this child.
          </p>
        ) : null}
      </section>
      {pendingChildSelection && (
        <Modal
          title="Recording in progress"
          onClose={() => setPendingChildSelection(null)}
        >
          <div data-testid="dialog-confirm-child-switch">
            <p className="text-sm leading-6 text-muted-foreground">
              Discard this recording and switch to{" "}
              {switchingToChild?.name ?? "another child"}? The current audio and
              unsaved review work will not be kept.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button
                variant="quiet"
                onClick={() => setPendingChildSelection(null)}
                data-testid="button-cancel-child-switch"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  applyChildSelection(pendingChildSelection.childId)
                }
                data-testid="button-confirm-child-switch"
              >
                Switch Child
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Workspace() {
  const [location, setLocation] = useLocation();
  const { sessionId } = useAuth();
  const routePath = location.split("?")[0] || "/";
  const childrenQuery = useListChildren();
  const viewerQuery = useGetViewer({
    query: {
      queryKey: getGetViewerQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    },
  });
  const [viewer, setViewer] = useState<Viewer>();
  const [clinicianOverviewSince, setClinicianOverviewSince] = useState<
    string | undefined | null
  >(null);
  const [selectedId, setSelectedId] = useState<number | undefined>(() => {
    const fromUrl = Number(
      new URLSearchParams(window.location.search).get("childId"),
    );
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : undefined;
  });
  const [modal, setModal] = useState<
    | "child"
    | "edit-child"
    | "gestalt"
    | "clinician-phrase"
    | "phrase-observation"
    | "parent-observation"
    | "parent-note"
    | "interest"
    | "sensory"
    | "observation"
    | "classroom-note"
    | "question"
    | "team-question"
    | "comment"
    | "invite"
    | null
  >(null);
  const [commentGestalt, setCommentGestalt] = useState<Gestalt>();
  const [parentNoteGestalt, setParentNoteGestalt] = useState<Gestalt>();
  const [parentNoteKind, setParentNoteKind] = useState<"meaning" | "context">(
    "meaning",
  );
  const [editingInterest, setEditingInterest] = useState<ChildInterest>();
  const [inviteChild, setInviteChild] = useState<Child>();
  const [editingChild, setEditingChild] = useState<Child>();
  const [teacherActionPhrase, setTeacherActionPhrase] = useState<string>();
  const [teacherQuestionAudience, setTeacherQuestionAudience] = useState<
    "team" | "clinician"
  >("team");
  const [heardTodayPhrase, setHeardTodayPhrase] = useState<string>();
  const [childAction, setChildAction] = useState<ClinicianChildAction | null>(
    null,
  );
  const children = childrenQuery.data ?? [];
  const isNativeDevelopmentDemo = Boolean(
    viewer?.isDevelopmentDemo && !viewer?.isRolePreview,
  );
  const currentRoleOverviewPath = roleOverviewPath(viewer?.role);
  const canUseClinicalPortal =
    viewer?.role === "SLP" || isNativeDevelopmentDemo;
  const clinicianChildRoutes = new Set([
    "/children",
    "/communication-profile",
    "/dictionary",
    "/aac-planning",
    "/language-journey",
    "/clinical-knowledge",
    "/unclear-speech",
    "/activity",
    "/manual-session",
    "/communication-passport",
  ]);
  const teacherChildRoutes = new Set([
    "/children",
    "/communication-profile",
    "/dictionary",
    "/activity",
    "/teacher-resources",
    "/communication-passport",
  ]);
  const needsActiveChild = canUseClinicalPortal
    ? clinicianChildRoutes.has(routePath)
    : viewer?.role === "Teacher"
      ? teacherChildRoutes.has(routePath)
      : viewer?.role === "Parent";
  const requestedChildId = Number(
    new URLSearchParams(window.location.search).get("childId"),
  );
  const validRequestedChildId =
    Number.isInteger(requestedChildId) && requestedChildId > 0
      ? requestedChildId
      : undefined;
  const activeId = needsActiveChild
    ? (validRequestedChildId ??
      selectedId ??
      (canUseClinicalPortal || viewer?.role === "Teacher"
        ? 0
        : (children[0]?.id ?? 0)))
    : (selectedId ?? 0);
  const childParams = { childId: activeId ?? 0 };
  const workspaceAacQuery = useListAacPlanning(childParams, {
    query: {
      queryKey: getListAacPlanningQueryKey(childParams),
      enabled: Boolean(activeId && canUseClinicalPortal),
    },
  });
  const inboxUrlParams = new URLSearchParams(location.split("?")[1] ?? "");
  const requestedInboxChildId = Number(inboxUrlParams.get("childId"));
  const inboxChildId =
    routePath === "/team-communication" &&
    Number.isInteger(requestedInboxChildId) &&
    requestedInboxChildId > 0
      ? requestedInboxChildId
      : undefined;
  const inboxSearch =
    routePath === "/team-communication" ? (inboxUrlParams.get("q") ?? "") : "";
  const teamInboxParams = useMemo(
    () => ({
      ...(inboxChildId ? { childId: inboxChildId } : {}),
      ...(inboxSearch ? { search: inboxSearch } : {}),
    }),
    [inboxChildId, inboxSearch],
  );
  const canLoadClinicianOverview = canUseClinicalPortal;
  const overviewSessionIdentity =
    sessionId ??
    (viewer?.isDevelopmentDemo
      ? window.localStorage.getItem(developmentDemoSessionStorageKey)
      : null);
  const clinicianOverviewParams = useMemo(
    () =>
      clinicianOverviewSince ? { since: clinicianOverviewSince } : undefined,
    [clinicianOverviewSince],
  );
  const clinicianOverviewQuery = useGetClinicianOverview(
    clinicianOverviewParams,
    {
      query: {
        queryKey: getGetClinicianOverviewQueryKey(clinicianOverviewParams),
        enabled: canLoadClinicianOverview && clinicianOverviewSince !== null,
      },
    },
  );
  const teacherOverviewQuery = useGetTeacherOverview(clinicianOverviewParams, {
    query: {
      queryKey: getGetTeacherOverviewQueryKey(clinicianOverviewParams),
      enabled: viewer?.role === "Teacher" && clinicianOverviewSince !== null,
    },
  });
  const dashboardQuery = useGetDashboard(childParams, {
    query: {
      queryKey: getGetDashboardQueryKey(childParams),
      enabled: Boolean(activeId),
    },
  });
  const childQuery = useGetChild(childParams, {
    query: {
      queryKey: getGetChildQueryKey(childParams),
      enabled: Boolean(activeId),
    },
  });
  const gestaltsQuery = useListGestalts(childParams, {
    query: {
      queryKey: getListGestaltsQueryKey(childParams),
      enabled: Boolean(activeId),
    },
  });
  const teacherDictionaryQuery = useGetDictionaryInsights(childParams, {
    query: {
      queryKey: getGetDictionaryInsightsQueryKey(childParams),
      enabled: Boolean(activeId && viewer?.role === "Teacher"),
    },
  });
  const teacherInterestsQuery = useListChildInterests(childParams, {
    query: {
      queryKey: getListChildInterestsQueryKey(childParams),
      enabled: Boolean(activeId && viewer?.role === "Teacher"),
    },
  });
  const parentInterestsQuery = useListChildInterests(childParams, {
    query: {
      queryKey: getListChildInterestsQueryKey(childParams),
      enabled: Boolean(activeId && viewer?.role === "Parent"),
    },
  });
  const globalTeamInboxQuery = useGetTeamInbox(undefined, {
    query: {
      queryKey: getGetTeamInboxQueryKey(),
      enabled: Boolean(viewer?.userId),
      refetchInterval: 30_000,
    },
  });
  const teamInboxQuery = useGetTeamInbox(teamInboxParams, {
    query: {
      queryKey: getGetTeamInboxQueryKey(teamInboxParams),
      enabled: routePath === "/team-communication" && Boolean(viewer?.userId),
    },
  });
  useEffect(() => {
    if (canLoadClinicianOverview && clinicianOverviewSince === null) {
      console.info(
        "[ChildLed] clinician overview is waiting for session readiness",
        {
          endpoint: "/api/clinician-overview",
        },
      );
    }
  }, [canLoadClinicianOverview, clinicianOverviewSince]);
  useEffect(() => {
    if (clinicianOverviewQuery.isError) {
      logOverviewRequestFailure(
        "/api/clinician-overview",
        clinicianOverviewQuery.error,
      );
    }
  }, [clinicianOverviewQuery.error, clinicianOverviewQuery.isError]);
  const invitationsQuery = useListCareTeamInvitations({
    query: {
      queryKey: getListCareTeamInvitationsQueryKey(),
      enabled: Boolean(
        viewer?.role === "SLP" ||
        (viewer?.isDevelopmentDemo && !viewer?.isRolePreview),
      ),
    },
  });
  const deleteInterest = useDeleteChildInterest();
  const createTeamMessage = useCreateTeamMessage({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getGetTeamInboxQueryKey() }),
    },
  });
  const markTeamMessagesRead = useMarkTeamMessagesRead({
    mutation: {
      onMutate: async (variables) => {
        const inboxQueryKey = getGetTeamInboxQueryKey();
        await queryClient.cancelQueries({ queryKey: inboxQueryKey });
        const snapshots = queryClient.getQueriesData<ApiTeamInbox>({
          queryKey: inboxQueryKey,
        });
        const requestedIds = new Set(variables.data.messageIds);
        for (const [queryKey, cached] of snapshots) {
          if (!cached) continue;
          const newlyRead = cached.messages.filter(
            (message) => requestedIds.has(message.id) && !message.read,
          );
          if (!newlyRead.length) continue;
          const readByChild = new Map<number, number>();
          for (const message of newlyRead) {
            readByChild.set(
              message.childId,
              (readByChild.get(message.childId) ?? 0) + 1,
            );
          }
          queryClient.setQueryData<ApiTeamInbox>(queryKey, {
            ...cached,
            totalUnread: Math.max(0, cached.totalUnread - newlyRead.length),
            children: cached.children.map((child) => ({
              ...child,
              unreadCount: Math.max(
                0,
                child.unreadCount - (readByChild.get(child.childId) ?? 0),
              ),
            })),
            messages: cached.messages.map((message) =>
              requestedIds.has(message.id)
                ? { ...message, read: true }
                : message,
            ),
          });
        }
        return { snapshots };
      },
      onError: (_error, _variables, context) => {
        for (const [queryKey, cached] of context?.snapshots ?? []) {
          queryClient.setQueryData(queryKey, cached);
        }
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: getGetTeamInboxQueryKey() }),
    },
  });
  const markPhraseHeard = useLogPhraseObservation({
    mutation: {
      onSuccess: (_result, variables) => {
        setHeardTodayPhrase(variables.data.phrase);
        queryClient.invalidateQueries({
          queryKey: getListGestaltsQueryKey({
            childId: variables.params.childId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDictionaryInsightsQueryKey({
            childId: variables.params.childId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetTeacherCommunicationHelperQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDashboardQueryKey({
            childId: variables.params.childId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetFrequentScriptsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetRecurringLanguagePatternsQueryKey(),
        });
      },
    },
  });
  const focusInsightsQuery = useListClinicalKnowledgeInsights(childParams, {
    query: {
      queryKey: getListClinicalKnowledgeInsightsQueryKey(childParams),
      enabled: Boolean(
        activeId &&
        currentRoleOverviewPath === routePath &&
        (viewer?.role === "SLP" ||
          (viewer?.isDevelopmentDemo && !viewer?.isRolePreview)),
      ),
    },
  });
  const generateFocusAreas = useGenerateClinicalKnowledgeInsights({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getListClinicalKnowledgeInsightsQueryKey(childParams),
        }),
    },
  });
  const dashboard = dashboardQuery.data;
  const activeChild =
    childQuery.data ?? children.find((item) => item.id === activeId);
  const loadingDashboard =
    childrenQuery.isLoading || (Boolean(activeId) && dashboardQuery.isLoading);
  const baseNavigation =
    viewer?.role === "Parent"
      ? parentNavItems
      : viewer?.role === "Teacher"
        ? teacherNavItems
        : viewer?.role === "Administrator"
          ? adminNavItems
          : clinicalNavItems;
  const navigation =
    viewer?.isSuperAdmin && !viewer?.isRolePreview
      ? [
          ...baseNavigation,
          { href: "/ux-testing", label: "UX Testing", icon: Sparkles },
        ]
      : baseNavigation;
  const navigationWithUnread = navigation.map((item) => {
    const href =
      item.href === "/session" && selectedId
        ? `/session?childId=${selectedId}`
        : item.href;
    return item.href === "/team-communication"
      ? { ...item, href, badge: globalTeamInboxQuery.data?.totalUnread ?? 0 }
      : { ...item, href };
  });
  const roleRestrictedRoute =
    (isRoleOverviewPath(routePath) && currentRoleOverviewPath !== routePath) ||
    (!canUseClinicalPortal &&
      [
        "/session",
        "/manual-session",
        "/reports",
        "/clinical-knowledge",
        "/aac-planning",
        "/clinician-learning",
      ].includes(routePath)) ||
    (viewer?.role === "Teacher" && routePath === "/language-journey") ||
    (routePath === "/family-resources" && viewer?.role !== "Parent") ||
    (routePath === "/teacher-resources" && viewer?.role !== "Teacher") ||
    (routePath === "/caseload" && !canUseClinicalPortal) ||
    (routePath === "/students" && viewer?.role !== "Teacher") ||
    (["/admin-overview", "/admin-conversations", "/security"].includes(
      routePath,
    ) &&
      !viewer?.isAdmin) ||
    (routePath === "/ux-testing" &&
      (!viewer?.isSuperAdmin || viewer.isRolePreview));
  const portalTimeline = (gestaltsQuery.data ?? [])
    .slice(0, 5)
    .map((gestalt) => ({
      date: gestalt.dateAdded,
      label: `Phrase added: “${gestalt.phrase}”`,
      detail: gestalt.meaning,
    }));
  const teacherGestalts = (teacherDictionaryQuery.data?.entries ?? []).map(
    (entry) => ({
      ...entry.gestalt,
      occurrences: entry.occurrences,
      lastObservedAt: entry.lastSeen,
    }),
  );
  useEffect(() => {
    if (viewerQuery.data) setViewer(viewerQuery.data);
  }, [viewerQuery.data]);
  useEffect(() => {
    const target = roleOverviewPath(viewer?.role);
    if (
      !target ||
      (routePath !== "/" && !isRoleOverviewPath(routePath)) ||
      target === routePath
    )
      return;
    setLocation(`${target}${routePath === "/" ? window.location.search : ""}`, {
      replace: true,
    });
  }, [routePath, setLocation, viewer?.role]);
  useEffect(() => {
    if (!viewer?.userId || !overviewSessionIdentity) {
      setClinicianOverviewSince(null);
      return;
    }
    const priorSignInKey = `childled-overview-last-sign-in:${viewer.userId}`;
    const activeSessionKey = `${overviewSessionStoragePrefix}${viewer.userId}:${overviewSessionIdentity}`;
    const sessionSince = window.sessionStorage.getItem(activeSessionKey);
    if (sessionSince !== null) {
      setClinicianOverviewSince(sessionSince || undefined);
      return;
    }
    const previousSignIn = window.localStorage.getItem(priorSignInKey);
    window.sessionStorage.setItem(activeSessionKey, previousSignIn ?? "");
    window.localStorage.setItem(priorSignInKey, new Date().toISOString());
    setClinicianOverviewSince(previousSignIn ?? undefined);
  }, [viewer?.userId, overviewSessionIdentity]);
  useEffect(() => {
    const fromUrl = Number(
      new URLSearchParams(window.location.search).get("childId"),
    );
    if (Number.isInteger(fromUrl) && fromUrl > 0) setSelectedId(fromUrl);
  }, [location]);
  const refreshChildren = () => {
    queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
    queryClient.invalidateQueries({
      queryKey: getGetClinicianOverviewQueryKey(),
    });
  };
  const openChildWorkspace = (childId: number) => {
    setSelectedId(childId);
    setLocation(`/children?childId=${childId}`);
  };
  const selectChild = (childId: number) => {
    setSelectedId(childId);
    const params = new URLSearchParams(window.location.search);
    params.set("childId", String(childId));
    setLocation(`${routePath}?${params.toString()}`);
  };
  const handleViewerChange = (nextViewer: Viewer) => {
    setViewer(nextViewer);
    const nextOverviewPath = roleOverviewPath(nextViewer.role);
    if (
      nextOverviewPath &&
      isRoleOverviewPath(routePath) &&
      nextOverviewPath !== routePath
    ) {
      setLocation(nextOverviewPath, { replace: true });
    }
  };
  const teacherStudentPortal = activeChild ? (
    <TeacherPortal
      child={activeChild}
      gestalts={teacherGestalts}
      observations={dashboard?.observations ?? []}
      interests={teacherInterestsQuery.data ?? []}
      teamMessages={(globalTeamInboxQuery.data?.messages ?? []).filter(
        (message) => message.childId === activeChild.id,
      )}
      onMessageTeam={() => {
        setTeacherActionPhrase(undefined);
        setTeacherQuestionAudience("team");
        setModal("team-question");
      }}
      onViewPassport={() =>
        setLocation(`/communication-passport?childId=${activeChild.id}`)
      }
      onAddObservation={() => setModal("observation")}
      onAddPhrase={() => setModal("phrase-observation")}
      onAddInterest={() => {
        setEditingInterest(undefined);
        setModal("interest");
      }}
      onEditInterest={(interest) => {
        setEditingInterest(interest);
        setModal("interest");
      }}
      onAskClinician={() => setModal("question")}
      onHelperLogObservation={(phrase) => {
        setTeacherActionPhrase(phrase);
        setModal("observation");
      }}
      onHelperAddPhrase={(phrase) => {
        setTeacherActionPhrase(phrase);
        setModal("phrase-observation");
      }}
      onHelperAskTeam={(phrase) => {
        setTeacherActionPhrase(phrase);
        setTeacherQuestionAudience("team");
        setModal("team-question");
      }}
      onHelperNotifyClinician={(phrase) => {
        setTeacherActionPhrase(phrase);
        setTeacherQuestionAudience("clinician");
        setModal("team-question");
      }}
      onSaveClassroomNote={(phrase) => {
        setTeacherActionPhrase(phrase);
        setModal("classroom-note");
      }}
      onMarkHeard={(phrase) => {
        if (activeId)
          markPhraseHeard.mutate({
            params: { childId: activeId },
            data: {
              phrase,
              context: "Classroom",
              details: "Marked as heard today from the classroom helper.",
              communicationFunction: "Other",
              observedAt: new Date().toISOString(),
            },
          });
      }}
      markingPhraseHeard={markPhraseHeard.isPending}
      heardTodayPhrase={heardTodayPhrase}
    />
  ) : (
    <EmptyState
      icon={Users}
      title="Choose a student"
      body="Open My Students to choose whose profile you want to view."
      action={
        <Link href="/students">
          <Button>
            Open My Students <ArrowRight size={16} />
          </Button>
        </Link>
      }
    />
  );
  const portalHome = !viewer ? (
    <LoadingBlocks />
  ) : viewer.role === "Parent" && activeChild ? (
    <div className="space-y-5">
      <ParentPortal
        child={activeChild}
        gestalts={gestaltsQuery.data ?? []}
        observations={dashboard?.observations ?? []}
        timeline={portalTimeline}
        interests={parentInterestsQuery.data ?? []}
        onAddObservation={() => setModal("parent-observation")}
        onAddPhrase={() => setModal("gestalt")}
        onAskClinician={() => setModal("question")}
        onAskTeam={(phrase) => {
          setTeacherActionPhrase(phrase);
          setTeacherQuestionAudience("team");
          setModal("team-question");
        }}
        onPhraseNote={(gestalt, kind) => {
          setParentNoteGestalt(gestalt as Gestalt);
          setParentNoteKind(kind);
          setModal("parent-note");
        }}
        onAddInterest={() => {
          setEditingInterest(undefined);
          setModal("interest");
        }}
        onEditInterest={(interest) => {
          setEditingInterest(interest);
          setModal("interest");
        }}
        onRemoveInterest={(interest) => {
          if (
            window.confirm(
              `Remove “${interest.interest}” from your suggested interests?`,
            )
          )
            deleteInterest.mutate(
              { interestId: interest.id },
              {
                onSuccess: () =>
                  queryClient.invalidateQueries({
                    queryKey: getListChildInterestsQueryKey(childParams),
                  }),
              },
            );
        }}
        onUpdateSensory={() => setModal("sensory")}
        onViewPassport={() =>
          setLocation(`/communication-passport?childId=${activeChild.id}`)
        }
      />
    </div>
  ) : viewer.role === "Teacher" ? (
    <TeacherClassroomDashboard
      overview={teacherOverviewQuery.data}
      loading={
        clinicianOverviewSince === null || teacherOverviewQuery.isLoading
      }
      error={teacherOverviewQuery.isError}
      onOpenStudent={openChildWorkspace}
      onAddPhrase={(childId) => {
        setSelectedId(childId);
        setTeacherActionPhrase(undefined);
        setModal("phrase-observation");
      }}
      onRetry={() => {
        void teacherOverviewQuery.refetch();
      }}
    />
  ) : viewer.role === "Administrator" ? (
    <AdminPortal isSuperAdmin={viewer.isSuperAdmin && !viewer.isRolePreview} />
  ) : (
    <CaseloadOverviewPage
      overview={clinicianOverviewQuery.data}
      teamInbox={globalTeamInboxQuery.data}
      loading={clinicianOverviewQuery.isLoading}
      preparing={
        clinicianOverviewSince === null || clinicianOverviewQuery.isLoading
      }
      overviewError={
        clinicianOverviewQuery.isError
          ? "Recent clinical changes are temporarily unavailable."
          : undefined
      }
      caseloadChildren={children}
      onOpenChild={openChildWorkspace}
      onAddStudent={() => setModal("child")}
      onStartRecordedSession={(childId) => {
        setSelectedId(childId);
        setLocation(`/session?childId=${childId}`);
      }}
      onStartManualSession={(childId) => {
        setSelectedId(childId);
        setLocation(`/manual-session?childId=${childId}`);
      }}
      onViewGoals={(childId) => {
        setSelectedId(childId);
        setLocation(`/children?childId=${childId}#child-communication-goals`);
      }}
      onViewHistory={(childId) => {
        setSelectedId(childId);
        setLocation(`/session?childId=${childId}`);
      }}
      onRecordSession={() => setChildAction("record-session")}
      onManualSession={() => setLocation("/manual-session")}
      onAddPhrase={() => setChildAction("add-phrase")}
      onOpenInbox={() => setLocation("/team-communication")}
      onRetryOverview={() => {
        void clinicianOverviewQuery.refetch();
        void globalTeamInboxQuery.refetch();
      }}
    />
  );
  const needsChildSelection = needsActiveChild && !activeId;
  const childSelectionPath =
    viewer?.role === "Teacher" ? "/students" : "/caseload";
  const childSelectionLabel =
    viewer?.role === "Teacher" ? "Open My Students" : "Open my caseload";
  const content = roleRestrictedRoute ? (
    <RoleRestrictedPage role={viewer?.role} />
  ) : needsChildSelection ? (
    <EmptyState
      icon={Users}
      title="Choose a child workspace"
      body="Select a child before opening student-specific tools."
      action={
        <Link href={childSelectionPath}>
          <Button>
            {childSelectionLabel} <ArrowRight size={16} />
          </Button>
        </Link>
      }
    />
  ) : routePath === "/" || routePath === currentRoleOverviewPath ? (
    portalHome
  ) : routePath === "/family-resources" ? (
    <FamilyResourcesPage childId={activeId} />
  ) : routePath === "/teacher-resources" ? (
    <TeacherResourcesPage childId={activeId} />
  ) : routePath === "/team-communication" ? (
    <TeamInboxPage
      selectedChildId={inboxChildId}
      searchTerm={inboxSearch}
      inbox={teamInboxQuery.data}
      loading={teamInboxQuery.isLoading}
      sending={createTeamMessage.isPending}
      markingRead={markTeamMessagesRead.isPending}
      sendError={
        createTeamMessage.isError
          ? "Your message could not be sent. Please try again."
          : undefined
      }
      onSelectChild={(childId) => {
        const params = new URLSearchParams();
        if (childId) params.set("childId", String(childId));
        if (inboxSearch) params.set("q", inboxSearch);
        setLocation(
          `/team-communication${params.size ? `?${params.toString()}` : ""}`,
        );
      }}
      onSearch={(search) => {
        const params = new URLSearchParams();
        if (inboxChildId) params.set("childId", String(inboxChildId));
        if (search) params.set("q", search);
        setLocation(
          `/team-communication${params.size ? `?${params.toString()}` : ""}`,
        );
      }}
      onMarkRead={(messageIds) => {
        if (messageIds.length)
          markTeamMessagesRead.mutate({ data: { messageIds } });
      }}
      onSend={(input) => createTeamMessage.mutate({ data: input })}
      onOpenProfile={openChildWorkspace}
    />
  ) : routePath === "/students" ? (
    <TeacherStudentsDashboard
      children={children}
      loading={childrenQuery.isLoading}
      onOpenStudent={openChildWorkspace}
    />
  ) : routePath === "/language-journey" ? (
    viewer?.role === "Parent" ? (
      <ParentLanguageJourneyPage
        child={activeChild}
        gestalts={gestaltsQuery.data ?? []}
      />
    ) : (
      <LanguageJourneyPage
        child={activeChild}
        childrenList={children}
        selectedId={activeId}
        onChangeChild={selectChild}
        onAddChild={() => setModal("child")}
        dashboard={dashboard}
        dashboardLoading={dashboardQuery.isLoading}
      />
    )
  ) : routePath === "/caseload" ? (
    <ClinicianCaseloadPage
      children={children}
      invitations={invitationsQuery.data ?? []}
      overview={clinicianOverviewQuery.data}
      loading={
        childrenQuery.isLoading ||
        invitationsQuery.isLoading ||
        clinicianOverviewQuery.isLoading
      }
      onAddStudent={() => setModal("child")}
      onOpenStudent={(child) => openChildWorkspace(child.id)}
      onEditChild={(child) => {
        setEditingChild(child);
        setModal("edit-child");
      }}
      onInvite={(child) => {
        setInviteChild(child);
        setModal("invite");
      }}
    />
  ) : routePath === "/dictionary" ? (
    <DictionaryPage
      childId={activeId}
      gestalts={gestaltsQuery.data}
      loading={gestaltsQuery.isLoading}
      canAddPhrase={viewer?.role === "SLP" || isNativeDevelopmentDemo}
      canReviewSession={viewer?.role === "SLP" || isNativeDevelopmentDemo}
      onAddPhrase={() => setModal("gestalt")}
      onComment={(gestalt) => {
        setCommentGestalt(gestalt);
        setModal("comment");
      }}
    />
  ) : routePath === "/aac-planning" ? (
    <AacPlanningPage childId={activeId} child={activeChild} />
  ) : routePath === "/manual-session" ? (
    <ManualSessionTrackingPage
      children={children}
      initialChildId={validRequestedChildId ?? selectedId}
    />
  ) : routePath === "/communication-passport" ? (
    <CommunicationPassportPage childId={activeId} />
  ) : routePath === "/session" ? (
    <SessionsLandingPage
      children={children}
      initialChildId={validRequestedChildId ?? selectedId}
      onSaved={(session) => {
        const savedChildId = session.childId;
        queryClient.invalidateQueries({
          queryKey: getListGestaltsQueryKey({ childId: savedChildId }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDictionaryInsightsQueryKey({ childId: savedChildId }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetPhraseTrendsQueryKey({ childId: savedChildId }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDashboardQueryKey({ childId: savedChildId }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetFrequentScriptsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetRecurringLanguagePatternsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetChildQueryKey({ childId: savedChildId }),
        });
        queryClient.invalidateQueries({
          queryKey: getListSessionsQueryKey({ childId: savedChildId }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetSessionsDashboardQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetSessionSoapNoteQueryKey({
            childId: savedChildId,
            sessionId: session.id,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: getListClinicalKnowledgeInsightsQueryKey({
            childId: savedChildId,
          }),
        });
        window.setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: getGetDashboardQueryKey({ childId: savedChildId }),
          });
          queryClient.invalidateQueries({
            queryKey: getGetFrequentScriptsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetRecurringLanguagePatternsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getListClinicalKnowledgeInsightsQueryKey({
              childId: savedChildId,
            }),
          });
          queryClient.invalidateQueries({
            queryKey: getGetSessionSoapNoteQueryKey({
              childId: savedChildId,
              sessionId: session.id,
            }),
          });
        }, 1_800);
      }}
    />
  ) : routePath === "/children" ? (
    viewer?.role === "Teacher" ? (
      teacherStudentPortal
    ) : (
      <div className="space-y-8">
        {canUseClinicalPortal ? (
          <ClinicianChildProfilePage
            child={activeChild}
            dashboard={dashboard}
            loading={loadingDashboard}
            onAddChild={() => setModal("child")}
            onAddPhrase={() => setModal("gestalt")}
            onEditChild={(child) => {
              setEditingChild(child);
              setModal("edit-child");
            }}
          />
        ) : (
          <>
            <ChildPage
              child={activeChild}
              latestSessionDate={
                dashboard?.snapshot?.sessionChange?.latestSessionDate
              }
              loading={childQuery.isLoading && !dashboard?.child}
              onAddChild={() => setModal("child")}
            />
            {activeChild && (
              <ChildDataDeletionPanel
                childId={activeChild.id}
                childName={activeChild.name}
              />
            )}
          </>
        )}
      </div>
    )
  ) : routePath === "/communication-profile" ? (
    <div className="space-y-8">
      <ChildPage
        child={activeChild}
        latestSessionDate={
          dashboard?.snapshot?.sessionChange?.latestSessionDate
        }
        loading={childQuery.isLoading && !dashboard?.child}
        onAddChild={() => setModal("child")}
      />
      {activeChild && (
        <ChildDataDeletionPanel
          childId={activeChild.id}
          childName={activeChild.name}
        />
      )}
    </div>
  ) : routePath === "/activity" ? (
    <ActivityPage
      dashboard={dashboard}
      loading={dashboardQuery.isLoading}
      onObserve={() => setModal("observation")}
    />
  ) : routePath === "/reports" ? (
    <DocumentationCenter childId={validRequestedChildId} />
  ) : routePath === "/clinician-learning" ? (
    <ClinicianLearningPage />
  ) : routePath === "/clinical-knowledge" ? (
    <ClinicalKnowledgePage childId={activeId} child={activeChild} />
  ) : routePath === "/unclear-speech" ? (
    <ClinicianUnclearSpeechPage childId={activeId} child={activeChild} />
  ) : routePath === "/admin-conversations" ? (
    <AdminConversationCenter />
  ) : routePath === "/security" ? (
    <AdminSecurityPage />
  ) : routePath === "/ux-testing" && viewer ? (
    <UxTestingCenter viewer={viewer} onViewerChange={handleViewerChange} />
  ) : routePath === "/settings" ? (
    <SettingsPage />
  ) : routePath === "/privacy-requests" ? (
    <PrivacyRequestHistoryPage />
  ) : (
    <NotFound />
  );
  const shellChild = activeChild;

  return (
    <Shell
      child={shellChild}
      childrenList={children}
      selectedId={activeId || undefined}
      onChangeChild={selectChild}
      showChildWorkspace={clinicianChildRoutes.has(routePath)}
      navigationControls={
        viewer ? (
          <SuperAdminRoleSwitcher
            viewer={viewer}
            onViewerChange={handleViewerChange}
          />
        ) : null
      }
      workspaceStats={{
        dictionaryCount: activeChild?.gestaltCount ?? 0,
        frequentScriptsCount: dashboard?.frequent.length ?? 0,
        aacCandidatesCount:
          workspaceAacQuery.data?.entries.filter(
            (entry) => entry.status === "candidate",
          ).length ?? 0,
        lastSessionDate: dashboard?.snapshot?.sessionChange.latestSessionDate,
      }}
      isClinician={viewer?.role === "SLP"}
      navigation={navigationWithUnread}
    >
      {childAction && (
        <ClinicianChildActionPicker
          action={childAction}
          children={children}
          onClose={() => setChildAction(null)}
          onSelect={(childId) => {
            setSelectedId(childId);
            setChildAction(null);
            if (childAction === "record-session") {
              setLocation(`/session?childId=${childId}`);
            } else {
              setModal("clinician-phrase");
            }
          }}
        />
      )}
      {modal === "clinician-phrase" && (
        <ClinicianPhraseForm
          childId={activeId}
          childName={activeChild?.name}
          onClose={() => setModal(null)}
        />
      )}
      {content}
      {modal === "child" && (
        <ChildForm
          onClose={() => setModal(null)}
          onCreated={(child) => {
            setSelectedId(child.id);
            refreshChildren();
            setModal(null);
          }}
        />
      )}
      {modal === "edit-child" && editingChild && (
        <EditChildProfileForm
          child={editingChild}
          onClose={() => {
            setEditingChild(undefined);
            setModal(null);
          }}
          onSaved={() => {
            setEditingChild(undefined);
            setModal(null);
          }}
        />
      )}
      {modal === "gestalt" && (
        <GestaltForm
          childId={activeId}
          role={viewer?.role}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "phrase-observation" && (
        <PhraseObservationForm
          childId={activeId}
          initialPhrase={teacherActionPhrase}
          onClose={() => {
            setTeacherActionPhrase(undefined);
            setModal(null);
          }}
        />
      )}
      {modal === "parent-observation" && (
        <ParentObservationForm
          childId={activeId}
          childName={activeChild?.name ?? "Your child"}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "parent-note" && parentNoteGestalt && (
        <ParentPhraseNoteForm
          gestalt={parentNoteGestalt}
          kind={parentNoteKind}
          onClose={() => {
            setParentNoteGestalt(undefined);
            setModal(null);
          }}
        />
      )}
      {modal === "interest" && (
        <InterestForm
          childId={activeId}
          interest={editingInterest}
          audience={viewer?.role === "Parent" ? "parent" : "teacher"}
          onClose={() => {
            setEditingInterest(undefined);
            setModal(null);
          }}
        />
      )}
      {modal === "sensory" && activeChild && (
        <SensoryProfileForm
          child={activeChild}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "invite" && inviteChild && (
        <CareTeamInvitationForm
          child={inviteChild}
          onClose={() => {
            setInviteChild(undefined);
            setModal(null);
          }}
        />
      )}
      {modal === "observation" && (
        <ObservationForm
          childId={activeId}
          initialBody={
            teacherActionPhrase
              ? `Phrase heard: “${teacherActionPhrase}”\n\n`
              : undefined
          }
          onClose={() => {
            setTeacherActionPhrase(undefined);
            setModal(null);
          }}
        />
      )}
      {modal === "classroom-note" && (
        <ObservationForm
          childId={activeId}
          mode="classroom-note"
          initialBody={
            teacherActionPhrase
              ? `Phrase heard: “${teacherActionPhrase}”\n\n`
              : undefined
          }
          onClose={() => {
            setTeacherActionPhrase(undefined);
            setTeacherQuestionAudience("team");
            setModal(null);
          }}
        />
      )}
      {modal === "question" && (
        <ObservationForm
          childId={activeId}
          mode="question"
          onClose={() => setModal(null)}
        />
      )}
      {modal === "team-question" && (
        <TeamQuestionForm
          childId={activeId}
          phrase={teacherActionPhrase}
          notifyClinician={teacherQuestionAudience === "clinician"}
          onClose={() => {
            setTeacherActionPhrase(undefined);
            setTeacherQuestionAudience("team");
            setModal(null);
          }}
        />
      )}
      {modal === "comment" && commentGestalt && (
        <CommentForm gestalt={commentGestalt} onClose={() => setModal(null)} />
      )}
    </Shell>
  );
}

function AuthLoading() {
  return (
    <div className="paper-grain grid min-h-[100dvh] place-items-center bg-background p-3 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-center soft-shadow sm:rounded-3xl sm:p-8">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-primary">
          <Leaf size={22} />
        </div>
        <h1 className="serif mt-5 text-3xl font-semibold">
          Checking your secure session
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          ChildLed is verifying your account and care-team access.
        </p>
      </div>
    </div>
  );
}
function Router() {
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Switch>
        <Route path="/privacy">
          <LegalPage
            eyebrow="Your privacy"
            title="Privacy Policy"
            sections={privacyPolicySections}
          />
        </Route>
        <Route path="/terms">
          <LegalPage
            eyebrow="Using ChildLed"
            title="Terms of Use"
            sections={termsOfUseSections}
          />
        </Route>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/request-beta-access" component={RequestBetaAccessPage} />
        {developmentDemoEnabled && (
          <Route path="/development-login" component={DevelopmentLoginPage} />
        )}
        {[
          "/",
          "/overview",
          "/family-overview",
          "/family-resources",
          "/teacher-overview",
          "/teacher-resources",
          "/admin-overview",
          "/ot-overview",
          "/pt-overview",
          "/bcba-overview",
          "/caseload",
          "/students",
          "/team-communication",
          "/admin-conversations",
          "/language-journey",
          "/dictionary",
          "/aac-planning",
          "/session",
          "/manual-session",
          "/communication-passport",
          "/children",
          "/communication-profile",
          "/activity",
          "/reports",
          "/clinician-learning",
          "/clinical-knowledge",
          "/unclear-speech",
          "/security",
          "/ux-testing",
          "/settings",
          "/privacy-requests",
        ].map((route) => (
          <Route key={route} path={route} component={CareTeamGate} />
        ))}
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const stripBase = (destination: string) =>
    basePath && destination.startsWith(basePath)
      ? destination.slice(basePath.length) || "/"
      : destination;
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to ChildLed",
            subtitle: "Sign in to your verified care-team account",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SessionInactivityGuard />
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
export default App;

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

function CareTeamGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const [location, setLocation] = useLocation();
  const developmentSession =
    developmentDemoEnabled &&
    window.localStorage.getItem(developmentDemoStorageKey) === "active";
  const [status, setStatus] = useState<
    "loading" | "ready" | "blocked" | "beta-notice"
  >("loading");
  const [message, setMessage] = useState("");
  const [resolvedViewer, setResolvedViewer] = useState<Viewer>();
  const [betaNotice, setBetaNotice] = useState<{
    text: string;
    version: string;
  } | null>(null);

  useEffect(() => {
    if (!isLoaded || isSignedIn || developmentSession) return;
    if (consumeAuthLogout()) {
      clearAuthReturnPath();
      return;
    }
    rememberAuthReturnPath(
      `${location.split("?")[0]}${window.location.search}`,
    );
  }, [developmentSession, isLoaded, isSignedIn, location]);

  useEffect(() => {
    if (!isLoaded && !developmentSession) return;
    if (!isSignedIn && !developmentSession) {
      setResolvedViewer(undefined);
      setStatus("blocked");
      return;
    }

    let active = true;

    const initialize = async () => {
      setStatus("loading");

      const inviteToken = new URLSearchParams(window.location.search).get(
        "token",
      );
      if (inviteToken && !developmentSession) {
        try {
          const acceptRes = await fetch("/api/invitations/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: inviteToken }),
            credentials: "include",
          });
          if (acceptRes.ok) {
            window.history.replaceState({}, "", window.location.pathname);
          } else {
            const body = await acceptRes.json().catch(() => ({}));
            if (active) {
              setResolvedViewer(undefined);
              setMessage(
                body.error ||
                  "Failed to accept invitation. The invitation may have expired or been revoked.",
              );
              setStatus("blocked");
            }
            return;
          }
        } catch (err) {
          if (active) {
            setResolvedViewer(undefined);
            setMessage(
              "Network error while accepting invitation. Please check your connection.",
            );
            setStatus("blocked");
          }
          return;
        }
      }

      if (!active) return;

      try {
        const response = await fetch("/api/auth/viewer", {
          credentials: "include",
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as
          (Partial<Viewer> & { error?: unknown }) | null;
        if (!active) return;

        if (response.ok && typeof body?.role === "string") {
          const viewerData = body as Viewer;
          if (!developmentSession) {
            const noticeRes = await fetch("/api/beta-notice", {
              credentials: "include",
              cache: "no-store",
            });
            if (noticeRes.ok) {
              const noticeData = await noticeRes.json().catch(() => null);
              if (noticeData && !noticeData.acknowledged && noticeData.text) {
                setResolvedViewer(viewerData);
                setBetaNotice(noticeData);
                setStatus("beta-notice");
                return;
              }
            }
          }
          setResolvedViewer(viewerData);
          setStatus("ready");
        } else {
          if (
            response.status === 403 &&
            typeof body?.error === "string" &&
            body.error.toLowerCase().includes("participation notice")
          ) {
            const noticeRes = await fetch("/api/beta-notice", {
              credentials: "include",
              cache: "no-store",
            });
            const noticeData = noticeRes.ok
              ? await noticeRes.json().catch(() => null)
              : null;
            if (noticeData?.text && noticeData?.version) {
              setBetaNotice(noticeData);
              setStatus("beta-notice");
              return;
            }
          }
          queryClient.clear();
          setResolvedViewer(undefined);
          setMessage(
            typeof body?.error === "string"
              ? body.error
              : "Your account cannot access this care-team workspace.",
          );
          setStatus("blocked");
        }
      } catch (err) {
        if (!active) return;
        setResolvedViewer(undefined);
        setMessage(
          "We could not verify your session. Please try signing in again.",
        );
        setStatus("blocked");
      }
    };

    initialize();

    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, developmentSession]);

  useEffect(() => {
    if (status !== "ready" || !resolvedViewer) return;
    const target = roleOverviewPath(resolvedViewer.role);
    if (!target) return;
    const currentLocation = `${location.split("?")[0]}${window.location.search}`;
    const currentPath = currentLocation.split("?")[0] || "/";
    if (currentPath !== "/" && !isRoleOverviewPath(currentPath)) {
      clearAuthReturnPath();
      return;
    }
    const returnPath = consumeAuthReturnPath();
    const currentQuery = window.location.search;
    const destination = returnPath ?? `${target}${currentQuery}`;
    if (destination !== currentLocation) {
      setLocation(destination, { replace: true });
    }
  }, [location, resolvedViewer, setLocation, status]);
  if (!isLoaded && !developmentSession) return <AuthLoading />;
  if (!isSignedIn && !developmentSession) return <LandingPage />;
  if (status === "loading") return <AuthLoading />;
  if (status === "beta-notice" && betaNotice)
    return (
      <BetaNoticeScreen
        notice={betaNotice}
        onAcknowledge={() => setStatus("ready")}
      />
    );
  if (status === "ready") return <Workspace />;
  return (
    <main className="paper-grain grid min-h-[100dvh] place-items-center bg-background p-3 sm:p-6">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 text-center soft-shadow sm:rounded-3xl sm:p-8">
        <Shield className="mx-auto text-primary" size={32} />
        <h1 className="serif mt-5 text-3xl font-semibold">
          Care-team access needed
        </h1>
        <p
          data-testid="auth-access-message"
          className="mt-3 text-sm leading-6 text-muted-foreground"
        >
          {message ||
            "Please verify your email and ask a care-team administrator to invite your account."}
        </p>
        <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Use another account
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
          >
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}

function SignInPage() {
  const token = new URLSearchParams(window.location.search).get("token");
  const invitationTarget = token
    ? `${basePath || "/"}?token=${encodeURIComponent(token)}`
    : undefined;
  return (
    <main className="paper-grain flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-5 sm:gap-5">
      <div className="flex w-full max-w-[440px] flex-col items-center text-center">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-accent text-primary">
            <Leaf size={23} />
          </div>
          <span className="serif text-3xl font-semibold tracking-tight text-primary">
            ChildLed
          </span>
        </div>
        <p
          data-testid="login-tagline"
          className="mt-3 max-w-sm text-sm leading-5 text-muted-foreground"
        >
          {CHILDLED_TAGLINE}
        </p>
      </div>
      <div className="w-full max-w-[440px]">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={invitationTarget}
          forceRedirectUrl={invitationTarget}
        />
      </div>
    </main>
  );
}

function LandingPage() {
  return (
    <main className="paper-grain grid min-h-[100dvh] place-items-center bg-background px-3 py-5 sm:px-5 sm:py-10">
      <section className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 text-center soft-shadow sm:rounded-[2rem] sm:p-8 md:p-12">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-primary">
          <Leaf size={28} />
        </div>
        <p className="mono mt-5 text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">
          Shared language, safely held
        </p>
        <h1 className="serif mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Welcome to ChildLed
        </h1>
        <p
          data-testid="landing-tagline"
          className="serif mx-auto mt-4 max-w-xl text-lg font-semibold leading-7 text-primary md:text-xl"
        >
          {CHILDLED_TAGLINE}
        </p>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          An invite-only workspace connecting families, educators, and SLPs
          around an assigned child’s communication. A verified account and an
          active ChildLed invitation are required.
        </p>
        <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
          <Link
            href="/sign-in"
            data-testid="link-sign-in"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/request-beta-access"
            data-testid="link-request-beta"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
          >
            SLP pilot access
          </Link>
        </div>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          Password setup, verification, and recovery are securely provided by
          our identity provider. ChildLed never receives or stores your
          password.
        </p>
        <div className="mt-6 flex justify-center gap-5 text-xs font-semibold text-primary">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
        </div>
      </section>
    </main>
  );
}

function DevelopmentLoginPage() {
  const [accessKey, setAccessKey] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const startDemo = async () => {
    if (!accessKey.trim()) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      const response = await fetch("/api/development/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to start the demo workspace.");
      window.localStorage.setItem(developmentDemoStorageKey, "active");
      window.localStorage.setItem(
        developmentDemoSessionStorageKey,
        crypto.randomUUID(),
      );
      queryClient.clear();
      window.location.assign(basePath || "/");
    } catch {
      setState("error");
    }
  };
  return (
    <main className="paper-grain grid min-h-[100dvh] place-items-center bg-background p-3 sm:p-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-5 soft-shadow sm:rounded-3xl sm:p-8">
        <Shield className="text-primary" size={30} />
        <h1 className="serif mt-5 text-3xl font-semibold">
          Owner development access
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This local testing workspace is separate from SLP and care-team
          accounts.
        </p>
        <label
          className="mt-6 block text-sm font-semibold"
          htmlFor="development-access-key"
        >
          Development access code
        </label>
        <input
          id="development-access-key"
          type="password"
          autoComplete="off"
          value={accessKey}
          onChange={(event) => {
            setAccessKey(event.target.value);
            if (state === "error") setState("idle");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void startDemo();
          }}
          className="mt-2 h-12 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-ring"
        />
        <Button
          type="button"
          className="mt-4 w-full"
          onClick={startDemo}
          disabled={state === "loading"}
          data-testid="button-development-login"
        >
          {state === "loading"
            ? "Preparing demo…"
            : "Open development workspace"}
        </Button>
        {state === "error" && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            The development access code was not accepted.
          </p>
        )}
        <Link
          href="/"
          className="mt-5 block text-center text-sm font-semibold text-primary"
        >
          Back to ChildLed
        </Link>
      </section>
    </main>
  );
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(160 34% 21%)",
    colorForeground: "hsl(160 40% 12%)",
    colorMutedForeground: "hsl(160 20% 45%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(40 33% 98%)",
    colorInput: "hsl(40 33% 98%)",
    colorInputForeground: "hsl(160 40% 12%)",
    colorNeutral: "hsl(160 15% 85%)",
    fontFamily: "DM Sans, sans-serif",
    borderRadius: "1rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "w-[440px] max-w-full overflow-hidden rounded-3xl border border-border bg-card soft-shadow",
    card: "!border-0 !bg-transparent !shadow-none",
    footer: "!border-0 !bg-transparent !shadow-none",
    headerTitle: "serif text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground",
    formFieldLabel: "text-foreground",
    footerActionLink: "text-primary",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-primary",
    alertText: "text-foreground",
    logoBox: "mb-2",
    logoImage: "size-12 rounded-2xl",
    socialButtonsBlockButton: "border-border bg-background",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
    formFieldInput: "border-input bg-background text-foreground",
    footerAction: "border-border",
    dividerLine: "bg-border",
    alert: "border-border bg-secondary/40",
    otpCodeFieldInput: "border-input bg-background text-foreground",
    formFieldRow: "gap-2",
    main: "gap-5",
  },
};

function SignUpPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = searchParams.get("token");
  const [tokenStatus, setTokenStatus] = useState<
    "checking" | "valid" | "invalid"
  >("checking");

  useEffect(() => {
    const tokenToUse = tokenFromUrl;
    if (!tokenToUse) {
      setTokenStatus("invalid");
      return;
    }
    let active = true;
    fetch(`/api/invitations/validate?token=${encodeURIComponent(tokenToUse)}`)
      .then(async (res) => {
        if (!active) return;
        const validation = res.ok ? await res.json().catch(() => null) : null;
        if (validation?.valid === true) {
          setTokenStatus("valid");
        } else {
          setTokenStatus("invalid");
        }
      })
      .catch(() => active && setTokenStatus("invalid"));
    return () => {
      active = false;
    };
  }, [tokenFromUrl]);

  if (tokenStatus === "checking") {
    return (
      <div className="paper-grain grid min-h-[100dvh] place-items-center bg-background">
        <p className="text-muted-foreground animate-pulse">
          Validating invitation...
        </p>
      </div>
    );
  }

  if (tokenStatus === "invalid") {
    return (
      <div className="paper-grain grid min-h-[100dvh] place-items-center bg-background p-5">
        <section className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-5 text-center soft-shadow sm:rounded-[2rem] sm:p-8">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle size={24} />
          </div>
          <h1 className="serif mt-5 text-2xl font-semibold text-foreground">
            Invalid Invitation
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This invitation link is missing, expired, revoked, or has already
            been used.
          </p>
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto"
            >
              Return to Home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const invitationTarget = `${basePath || "/"}?token=${encodeURIComponent(tokenFromUrl!)}`;
  return (
    <div className="paper-grain grid min-h-[100dvh] place-items-center bg-background p-5">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in?token=${encodeURIComponent(tokenFromUrl!)}`}
        forceRedirectUrl={invitationTarget}
      />
    </div>
  );
}

const rawClerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkProxyUrl = rawClerkProxyUrl
  ? // Ensure the proxy URL uses the same protocol as the current page (http/https)
    rawClerkProxyUrl.replace(/^https?:/, window.location.protocol)
  : undefined;

function SessionInactivityGuard() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [warning, setWarning] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<number | undefined>(undefined);
  const reset = () => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(timeoutRef.current);
    if (!isSignedIn) return;
    timerRef.current = window.setTimeout(
      () => setWarning(true),
      13 * 60 * 1000,
    );
    timeoutRef.current = window.setTimeout(
      () => {
        queryClient.clear();
        clearOverviewSessionMarkers();
        markAuthLogout();
        void signOut({ redirectUrl: basePath || "/" });
      },
      15 * 60 * 1000,
    );
  };
  useEffect(() => {
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    reset();
    events.forEach((event) =>
      window.addEventListener(event, reset, { passive: true }),
    );
    return () => {
      window.clearTimeout(timerRef.current);
      window.clearTimeout(timeoutRef.current);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [isSignedIn]);
  useEffect(() => {
    if (!isSignedIn) return;
    const validateSession = () => {
      void fetch("/api/auth/viewer", {
        credentials: "include",
        cache: "no-store",
      })
        .then((response) => {
          if (response.status !== 401) return;
          queryClient.clear();
          clearOverviewSessionMarkers();
          markAuthLogout();
          void signOut({ redirectUrl: basePath || "/" });
        })
        .catch(() => undefined);
    };
    const interval = window.setInterval(validateSession, 60_000);
    return () => window.clearInterval(interval);
  }, [isSignedIn, signOut]);
  if (!warning || !isSignedIn) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-primary/50 p-2 backdrop-blur-sm sm:p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        className="max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-5 text-center shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <Clock3 className="mx-auto text-primary" size={30} />
        <h2 className="serif mt-4 text-2xl font-semibold">Still working?</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          To protect private care-team data, you’ll be signed out after 15
          minutes of inactivity.
        </p>
        <div className="mt-6 grid gap-3 sm:flex sm:justify-center">
          <Button
            onClick={() => {
              setWarning(false);
              reset();
            }}
            data-testid="button-continue-session"
          >
            Continue session
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              queryClient.clear();
              clearOverviewSessionMarkers();
              void signOut({ redirectUrl: basePath || "/" });
            }}
            data-testid="button-sign-out-now"
          >
            Sign out now
          </Button>
        </div>
      </section>
    </div>
  );
}
