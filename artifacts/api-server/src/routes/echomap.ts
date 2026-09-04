import { Router, type IRouter, type Request } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  gestaltOccurrencesTable,
  sessionTranscriptsTable,
  transcriptSpeakerSegmentsTable,
  transcriptChildUtteranceReviewsTable,
  childPhraseInboxItemsTable,
  childSpeakerRolesTable,
  childSpeakerProfilesTable,
  transcriptSpeakerRolesTable,
  transcriptSpeakerRoleInferencesTable,
  childSpeakerRoleLearningAggregatesTable,
  childProfileConsentRecordsTable,
  transcriptPhrasesTable,
  transcriptProvisionalPhrasesTable,
  retentionSettingsTable,
  securityAuditLogsTable,
  sensitiveDataClassificationsTable,
  deletionRequestsTable,
  deletionRequestAuditEventsTable,
  childCareTeamMembershipsTable,
  organizationMembershipsTable,
  careTeamInvitationsTable,
  teamMessagesTable,
  teamMessageReadsTable,
  aacVocabularyPlanningTable,
  aacVocabularyPlanningMergeHistoryTable,
  aacProfilesTable,
  aacProfileHistoryTable,
  aacCommunicationModalityValues,
  type AacCommunicationModality,
  type AacProfileHistoryValue,
  type AacUserStatus,
  childProfilesTable,
  clinicalGestaltsTable,
  clinicalObservationsTable,
  observationVideoUploadsTable,
  sessionAudioObjectsTable,
  sessionRecordingPreparationsTable,
  therapySessionGestaltsTable,
  therapySessionsTable,
  gestaltCollaborationNotesTable,
  phraseObservationsTable,
  legacyPhraseObservationRecoveriesTable,
  clinicalSoapNotesTable,
  clinicalDocumentationTable,
  communicationGoalsTable,
  communicationGoalHistoryTable,
  clinicalKnowledgeChunksTable,
  clinicalKnowledgeAppliedFactsTable,
  clinicalKnowledgeIngestionJobsTable,
  clinicalKnowledgeInsightsTable,
  clinicalKnowledgeInsightRunsTable,
  clinicalKnowledgeSourcesTable,
  clinicalKnowledgeSourceVersionsTable,
  sharedChildProfileEntriesTable,
  sharedChildProfileHistoryTable,
  sharedChildProfileSectionValues,
  parentLearningProgressTable,
  parentLearningReflectionsTable,
  teacherResourceItemsTable,
  teacherResourceProgressTable,
  clinicianLearningProgressTable,
  clinicianLearningPreferencesTable,
  dictionaryDuplicateSuggestionsTable,
  usersTable,
  organizationsTable,
  betaAccessRequestsTable,
  betaControlsTable,
  betaNoticesTable,
  betaNoticeAcknowledgementsTable,
} from "@workspace/db";
import {
  evidenceSafeTranscriptText,
  MANUAL_TRANSCRIPT_REVIEW_LABEL,
  manualTranscriptReviewSegments,
  matchPhraseKey,
  normalizePhrase,
  provisionalPhraseCandidates,
  segmentTranscript,
  sessionReviewProgressFor,
  speakerRolesForTranscript,
  separateTranscriptSpeakers,
  scheduleOptionalSpeakerSeparation,
  transcribeRecording,
  type SpeakerSegment,
} from "../lib/session-transcription";
import {
  isClinicallyReviewedGestalt,
  repairCanonicalGestaltsForChild,
} from "../lib/canonical-gestalt-repair";
import {
  inferSpeakerRoles,
  SPEAKER_ROLE_FEATURE_VERSION,
  SPEAKER_ROLE_MODEL_VERSION,
  type SpeakerRoleInference,
} from "../lib/speaker-role-inference";
import {
  buildChildProfileConsentRecord,
  hasLegalAuthorityConsent,
} from "../lib/child-profile-consent";
import { deleteTranscriptDataForChild } from "../lib/transcript-deletion";
import {
  canCreatePhraseEvidenceFrom,
  hasMeaningBackedConfirmedUtterance,
  hasUnresolvedChildUtteranceReviews,
} from "../lib/child-utterance-review";
import {
  decryptAtRest,
  encryptAtRest,
  encryptionBoundary,
} from "../lib/encryption";
import {
  createAudioObjectStore,
  objectStoreForStorageDriver,
} from "../lib/audio-object-store-factory";
import { persistedAudioObjectMetadata } from "../lib/audio-object-store";
import { RecordingObjectStorage } from "../lib/recording-object-storage";
import {
  calibrationDatabaseSaveFailure,
  calibrationFinalizationFailure,
  classifyCalibrationProbeFailure,
  needsWebmDurationConversion,
  type CalibrationFailureDetail,
} from "../lib/calibration-diagnostics";
import { ensurePackagedClinicalKnowledge } from "../lib/clinical-knowledge-bootstrap";
import { storeClinicalKnowledgeObject } from "../lib/clinical-knowledge-object-storage";
import { createClinicalKnowledgeObjectStore } from "../lib/clinical-knowledge-object-store";
import {
  ensureParentLearningCenter,
  PARENT_LEARNING_DISCLAIMER,
} from "../lib/parent-learning-center";
import {
  ensureTeacherResourceCenter,
  TEACHER_RESOURCE_DISCLAIMER,
  TEACHER_RESOURCE_KEY,
} from "../lib/teacher-resource-center";
import {
  CLINICIAN_LEARNING_DISCLAIMER,
  CLINICIAN_LEARNING_RESOURCE_KEY,
  clinicianLearningHandbookText,
  ensureClinicianLearningCenter,
  resolveClinicianLearningSectionProgress,
} from "../lib/clinician-learning-center";
import {
  decodeUploadedRecording,
  normalizeRecordingUploadContentType,
  normalizeRecordingContentType,
  safeTranscriptionFailure,
  TRANSCRIPTION_MODEL,
  TRANSCRIPTION_PROVIDER,
} from "../lib/recording-pipeline";
import {
  buildKnowledgeInsightDrafts,
  CLINICAL_INSIGHTS_ENGINE_VERSION,
  CLINICAL_KNOWLEDGE_MODEL,
  CLINICAL_KNOWLEDGE_PROVIDER,
  confidenceScoreFor,
  insightRunRecoveryState,
  retrieveRelevantKnowledge,
  reviewedPhraseSelection,
  routeInsightDrafts,
  shouldArchiveEngineOwnedGestalt,
  type ClinicalEvidence,
} from "../lib/clinical-knowledge-engine";
import {
  chunkKnowledgeSource,
  decodeKnowledgeSourceUpload,
  extractKnowledgeSourceText,
  KNOWLEDGE_SOURCE_ADAPTER_VERSION,
  safeKnowledgeProcessingFailure,
} from "../lib/clinical-knowledge-processing";
import {
  buildChildSnapshot,
  childAttributedOnly,
  countReviewedChildSessions,
} from "../lib/child-snapshot";
import {
  buildDocumentationDraftContent,
  canExportClinicalDocumentation,
  hasShareSafeFamilyHighlights,
  hasRequiredDocumentationLabels,
  type DocumentationDraftContent,
} from "../lib/documentation-draft";
import {
  buildRecurringLanguagePatterns,
  filterRecurringPatternEvidence,
  type RecurringPatternEvidence,
} from "../lib/recurring-language-patterns";
import {
  AI_SESSION_NOTE_SOURCE,
  canonicalSessionCommunicationFunction,
  generateAiSessionNote,
  addLongitudinalSessionSummary,
  selectAiSessionEvidence,
  type AiSessionEvidence,
} from "../lib/ai-session-note";
import type { ResolvedCareTeamActor } from "../lib/auth-context";
import {
  canAccessAssignedChild,
  canContributeSharedChildContext,
  canManageClinicalData,
  canSubmitDictionaryPhrase,
  hasVerifiedCareTeamSession,
} from "../lib/auth-authorization";
import {
  effectiveViewerFromRequest,
  realViewerFromRequest,
  ROLE_PREVIEW_COOKIE,
} from "../lib/role-preview";
import {
  ensureSensitiveDataClassifications,
  safeAuditMetadata,
  writeSecurityAudit,
} from "../lib/security-governance";
import {
  duplicatePhraseMatch,
  isConservativeDuplicate,
} from "../lib/dictionary-duplicate-matcher";
import { logger } from "../lib/logger";
import {
  createInvitationToken,
  hashInvitationToken,
} from "../lib/invitation-security";
import {
  DEVELOPMENT_DEMO_COOKIE,
  DEVELOPMENT_DEMO_EMAIL,
  seedDevelopmentSpeakerReviewFixture,
  seedDevelopmentDemo,
} from "../lib/development-demo";
import {
  isManagedObjectStorageDriver,
  runtimeConfig,
} from "../lib/runtime-config";
import {
  aacProfileCatalog,
  aacProfileCatalogError,
  customLabelFor,
} from "../lib/aac-profile-catalog";
import { goalSourceIsRelevant } from "../lib/goal-connection-matcher";
import {
  AddGestaltCommentBody,
  AddGestaltCommentQueryParams,
  CreateChildBody,
  CreateChildInterestBody,
  CreateChildInterestQueryParams,
  CreateCareTeamInvitationBody,
  CreateCareTeamInvitationResponse,
  CreateTeamMessageBody,
  CreateTeamMessageResponse,
  DeleteChildInterestParams,
  CreateGestaltBody,
  CreateGestaltQueryParams,
  MergeGestaltsBody,
  MergeGestaltsQueryParams,
  ListDictionaryDuplicateSuggestionsQueryParams,
  ListDictionaryDuplicateSuggestionsResponse,
  DecideDictionaryDuplicateSuggestionQueryParams,
  DecideDictionaryDuplicateSuggestionBody,
  DecideDictionaryDuplicateSuggestionResponse,
  CreateObservationBody,
  CreateObservationQueryParams,
  RequestObservationVideoUploadBody,
  RequestObservationVideoUploadResponse,
  GetObservationVideoParams,
  GetChildQueryParams,
  GetDashboardQueryParams,
  GetClinicianOverviewQueryParams,
  GetClinicianOverviewResponse,
  GetTeacherOverviewQueryParams,
  GetTeacherOverviewResponse,
  GetTeacherPhraseLookupQueryParams,
  GetTeacherPhraseLookupResponse,
  GetFrequentScriptsQueryParams,
  GetFrequentScriptsResponse,
  GetRecurringLanguagePatternsQueryParams,
  GetRecurringLanguagePatternsResponse,
  GetRecurringLanguagePatternDetailQueryParams,
  GetRecurringLanguagePatternDetailResponse,
  GetParentLearningCenterQueryParams,
  GetParentLearningCenterResponse,
  GetParentLearningModuleQueryParams,
  GetParentLearningModuleResponse,
  UpdateParentLearningProgressBody,
  UpdateParentLearningProgressResponse,
  UpdateParentLearningReflectionBody,
  UpdateParentLearningReflectionResponse,
  DownloadParentLearningHandbookQueryParams,
  GetTeacherResourceCenterQueryParams,
  GetTeacherResourceCenterResponse,
  UpdateTeacherResourceProgressBody,
  UpdateTeacherResourceProgressResponse,
  DownloadTeacherResourceHandbookQueryParams,
  GetClinicianLearningCenterResponse,
  UpdateClinicianLearningProgressBody,
  UpdateClinicianLearningProgressResponse,
  GetClinicianLearningPreferencesResponse,
  UpdateClinicianLearningPreferencesBody,
  UpdateClinicianLearningPreferencesResponse,
  GetDictionaryInsightsQueryParams,
  ListAacPlanningQueryParams,
  CreateAacPlanningBody,
  CreateAacPlanningResponse,
  UpdateAacPlanningParams,
  UpdateAacPlanningBody,
  UpdateAacPlanningResponse,
  RemoveAacPlanningParams,
  GetTeacherCommunicationHelperQueryParams,
  GetTeacherCommunicationHelperResponse,
  GetPhraseTrendsQueryParams,
  GetSessionSoapNoteQueryParams,
  GetTeamInboxQueryParams,
  GetTeamInboxResponse,
  MarkTeamMessagesReadBody,
  MarkTeamMessagesReadResponse,
  GetAdminChildPermissionsQueryParams,
  GetAdminChildPermissionsResponse,
  UpdateSessionSoapNoteQueryParams,
  UpdateSessionSoapNoteBody,
  ListGestaltsQueryParams,
  ListSessionsQueryParams,
  GetSessionsDashboardResponse,
  ListUnclearVocalizationsQueryParams,
  ListChildInterestsQueryParams,
  ListChildInterestsResponse,
  ListCareTeamInvitationsResponse,
  LogPhraseObservationBody,
  LogPhraseObservationQueryParams,
  LogPhraseObservationResponse,
  ListLegacyPhraseObservationsQueryParams,
  ListLegacyPhraseObservationsResponse,
  RecoverLegacyPhraseObservationQueryParams,
  RecoverLegacyPhraseObservationBody,
  RecoverLegacyPhraseObservationResponse,
  UpdateChildSensoryBody,
  UpdateChildSensoryQueryParams,
  UpdateChildSensoryResponse,
  GetAacProfileQueryParams,
  GetAacProfileResponse,
  UpdateAacProfileQueryParams,
  UpdateAacProfileBody,
  UpdateAacProfileResponse,
  RemoveAacProfileQueryParams,
  RemoveAacProfileResponse,
  GetChildSharedProfileQueryParams,
  GetChildSharedProfileResponse,
  CreateChildSharedProfileEntryQueryParams,
  CreateChildSharedProfileEntryBody,
  CreateChildSharedProfileEntryResponse,
  UpdateChildSharedProfileEntryParams,
  UpdateChildSharedProfileEntryBody,
  UpdateChildSharedProfileEntryResponse,
  DeleteChildSharedProfileEntryParams,
  CreateSessionBody,
  CreateSessionQueryParams,
  CompleteSessionCalibrationBody,
  DeleteSessionCalibrationQueryParams,
  PrepareSessionRecordingBody,
  RequestSessionAudioUploadBody,
  GetSessionAudioParams,
  GetSessionTranscriptionDraftQueryParams,
  GetSessionTranscriptionAudioParams,
  TranscribeSessionAudioBody,
  TranscribeSessionAudioQueryParams,
  UpdateTranscriptSpeakersBody,
  UpdateTranscriptSpeakersQueryParams,
  UpdateTranscriptChildUtterancesBody,
  UpdateTranscriptChildUtterancesQueryParams,
  ListChildPhraseInboxQueryParams,
  ListChildPhraseInboxResponse,
  UpdateChildPhraseInboxParams,
  UpdateChildPhraseInboxBody,
  UpdateChildPhraseInboxResponse,
  UpdateTranscriptProvisionalPhrasesBody,
  UpdateTranscriptProvisionalPhrasesQueryParams,
  UpdateUnclearVocalizationLabelBody,
  UpdateUnclearVocalizationLabelQueryParams,
  UpdateRetentionSettingsBody,
  RecordReportExportBody,
  ListClinicalDocumentationQueryParams,
  CreateClinicalDocumentationBody,
  UpdateClinicalDocumentationBody,
  ApproveClinicalDocumentationBody,
  DeleteClinicalDocumentationBody,
  RestoreClinicalDocumentationBody,
  ArchiveClinicalDocumentationBody,
  RestoreArchivedClinicalDocumentationBody,
  CreateAiSessionNoteBody,
  ListClinicalDocumentationResponse,
  CreateClinicalDocumentationResponse,
  UpdateClinicalDocumentationResponse,
  ApproveClinicalDocumentationResponse,
  DeleteClinicalDocumentationResponse,
  RestoreClinicalDocumentationResponse,
  ArchiveClinicalDocumentationResponse,
  RestoreArchivedClinicalDocumentationResponse,
  CreateAiSessionNoteResponse,
  CreateDeletionRequestBody,
  CreateDeletionRequestQueryParams,
  CreateDeletionRequestResponse,
  GetDeletionRequestParams,
  GetDeletionRequestResponse,
  ListDeletionRequestsQueryParams,
  ListDeletionRequestsResponse,
  ReviewDeletionRequestBody,
  ReviewDeletionRequestParams,
  ReviewDeletionRequestResponse,
  ArchiveClinicalKnowledgeSourceParams,
  ArchiveClinicalKnowledgeSourceResponse,
  CreateClinicalKnowledgeSourceBody,
  CreateClinicalKnowledgeSourceResponse,
  GenerateClinicalKnowledgeInsightsBody,
  GenerateClinicalKnowledgeInsightsResponse,
  GetAdminUxTestingResponse,
  GetViewerResponse,
  ListClinicalKnowledgeInsightsQueryParams,
  ListClinicalKnowledgeInsightsResponse,
  ListClinicalKnowledgeSourcesResponse,
  ListAdminTeamConversationsQueryParams,
  ListAdminTeamConversationsResponse,
  ReviewClinicalKnowledgeInsightBody,
  ReviewClinicalKnowledgeInsightParams,
  ReviewClinicalKnowledgeInsightResponse,
  SetRolePreviewBody,
  SetRolePreviewResponse,
  ClearRolePreviewResponse,
  UpdateChildInterestBody,
  UpdateChildInterestParams,
  UpdateChildInterestResponse,
  UpdateChildProfileBody,
  UpdateChildProfileQueryParams,
  UpdateAdminChildPermissionBody,
  UpdateAdminChildPermissionParams,
  UpdateAdminChildPermissionResponse,
  ListCommunicationGoalsQueryParams,
  ListCommunicationGoalsResponse,
  CreateCommunicationGoalBody,
  CreateCommunicationGoalResponse,
  UpdateCommunicationGoalParams,
  UpdateCommunicationGoalBody,
  UpdateCommunicationGoalResponse,
} from "@workspace/api-zod";
import {
  legacyNoteHasTypedObservation,
  parseLegacyPhraseObservationNote,
} from "../lib/legacy-phrase-observation";
const execFileAsync = promisify(execFile);

type TeamMember = { id: number; name: string; role: string; initials: string };
type Comment = {
  id: number;
  author: string;
  role: string;
  body: string;
  createdAt: string;
};
type ObservationVideo = {
  objectPath: string;
  contentType: string;
  sizeBytes: number;
  consentConfirmedAt: string;
  createdByUserId: string;
};
type Observation = {
  id: number;
  childId: number;
  author: string;
  role: string;
  body: string;
  context: string;
  createdAt: string;
  video?: ObservationVideo;
};
type Gestalt = {
  id: number;
  childId: number;
  phrase: string;
  audioUrl: string | null;
  source: string;
  meaning: string;
  function: string;
  contexts: string[];
  emotionalState: string;
  dateAdded: string;
  createdBy: string;
  comments: Comment[];
  aacPlanningStatus:
    "candidate" | "review_later" | "added_to_device" | "not_appropriate" | null;
};
const teamRoleLabel = (role: string) =>
  ({
    clinician: "SLP",
    administrator: "Administrator",
    admin: "Administrator",
    parent: "Parent",
    teacher: "Teacher",
    ot: "OT",
  })[role.toLowerCase()] ?? role;
const teamRoleStorageValue = (role: string) =>
  ({
    slp: "clinician",
    clinician: "clinician",
    administrator: "admin",
    admin: "admin",
    parent: "parent",
    teacher: "teacher",
    ot: "ot",
  })[role.toLowerCase()] ?? role.toLowerCase();
const teamMemberInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CT";
type SessionGestalt = {
  phrase: string;
  meaning: string;
  function: string;
  context: string;
  emotionalState: string;
  note: string;
  transcriptPhraseId?: number;
  preserveDictionary?: boolean;
};
type RecordingConsent = {
  confirmed: boolean;
  confirmedAt: string;
  confirmedBy: string;
  childId: number;
};
type SavedSession = {
  id: number;
  childId: number;
  durationSeconds: number;
  gestalts: SessionGestalt[];
  gestaltIds: number[];
  clinicalObservations: string;
  nextSteps: string;
  note: string;
  audioId: string | null;
  audioUrl: string | null;
  transcriptionId?: number | null;
  createdAt: string;
  createdBy: string;
  role: string;
  consent?: RecordingConsent;
};
type AudioRecord = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  owner: string;
  childId?: number;
  consentConfirmedAt?: string;
  consentConfirmedBy?: string;
  sessionId: number | null;
  createdAt: string;
};
type SessionStore = {
  sessions: SavedSession[];
  audio: AudioRecord[];
  nextSessionId: number;
  nextGestaltId: number;
};
type Child = {
  id: number;
  name: string;
  dateOfBirth: string | null;
  age: number;
  photoUrl: string | null;
  firstName: string;
  lastName: string;
  preferredName: string;
  pronouns: string | null;
  school: string;
  grade: string;
  communicationStyle: string;
  glpNotes: string;
  aacSnapshot?: AacSnapshot;
  strengths: string[];
  sensoryPreferences: string[];
  specialInterests: string[];
  regulationNotes: string;
  sensorySupports?: string[];
  sensoryChallenges?: string[];
  gestaltCount: number;
  team: TeamMember[];
};
type AacSnapshot = {
  isUser: boolean;
  device: string | null;
  vocabularySystem: string | null;
  accessMethod: string | null;
  lastConfirmedAt: string | null;
};

const now = () => new Date().toISOString();
const team: TeamMember[] = [
  { id: 1, name: "Maya Chen", role: "Parent", initials: "MC" },
  { id: 2, name: "Dr. Lena Ortiz", role: "SLP", initials: "LO" },
  { id: 3, name: "Jordan Blake", role: "Teacher", initials: "JB" },
];
const children: Child[] = [
  {
    id: 1,
    name: "Oliver",
    firstName: "Oliver",
    lastName: "Bennett",
    preferredName: "Oliver",
    pronouns: null,
    dateOfBirth: "2019-03-14",
    age: 7,
    photoUrl: null,
    school: "Maple Grove Elementary",
    grade: "1st grade",
    communicationStyle: "Gestalt Language Processor",
    aacSnapshot: {
      isUser: true,
      device: "TD I-110",
      vocabularySystem: "TD Snap Motor Plan 60",
      accessMethod: "Direct Touch",
      lastConfirmedAt: "2025-09-01",
    },
    glpNotes:
      "Oliver is moving through GLP Stage 2. He is beginning to mix shorter chunks and uses intonation to communicate excitement and uncertainty.",
    strengths: [
      "Strong memory for songs",
      "Notices tiny details",
      "Warm sense of humor",
    ],
    sensoryPreferences: ["Deep pressure", "Movement breaks", "Quiet corners"],
    specialInterests: ["Space", "Trains", "Bluey"],
    regulationNotes:
      "Transitions are smoother when Oliver gets a two-minute warning and a visual cue.",
    gestaltCount: 12,
    team,
  },
];
const legacyNameParts = (displayName: string) => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? displayName.trim(),
    lastName: parts.slice(1).join(" "),
  };
};
const canonicalChildNames = (
  profile: typeof childProfilesTable.$inferSelect,
) => {
  const legacy = legacyNameParts(profile.displayName);
  const firstName = profile.firstName.trim() || legacy.firstName;
  const lastName = profile.lastName.trim() || legacy.lastName;
  const preferredName = profile.preferredName.trim();
  return {
    firstName,
    lastName,
    preferredName,
    name:
      preferredName ||
      [firstName, lastName].filter(Boolean).join(" ") ||
      profile.displayName,
  };
};
const ageFromDateOfBirth = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return 0;
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birth.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && today.getUTCDate() < birth.getUTCDate())
  )
    age -= 1;
  return Math.max(age, 0);
};
const childFromProfile = (
  profile: typeof childProfilesTable.$inferSelect,
  gestaltCount = 0,
  structuredAac?: typeof aacProfilesTable.$inferSelect,
): Child => {
  const details = profile.profileDetails as Record<string, unknown>;
  const arrayDetail = (name: string) =>
    Array.isArray(details[name])
      ? details[name].filter(
          (value): value is string => typeof value === "string",
        )
      : [];
  const aacSnapshot = (() => {
    if (structuredAac) {
      if (
        structuredAac.removedAt ||
        !structuredAac.confirmedAt ||
        structuredAac.aacUserStatus === "unknown"
      ) {
        return undefined;
      }
      const catalogLabel = (
        values: readonly { id: string; label: string }[],
        id: string | null,
        custom: string | null,
      ) => custom || values.find((item) => item.id === id)?.label || null;
      const vendor = catalogLabel(
        aacProfileCatalog.vendors,
        structuredAac.deviceVendorId,
        structuredAac.deviceVendorCustomLabel,
      );
      const model = catalogLabel(
        aacProfileCatalog.deviceModels,
        structuredAac.deviceModelId,
        structuredAac.deviceModelCustomLabel,
      );
      return {
        isUser: structuredAac.aacUserStatus === "yes",
        device: [vendor, model].filter(Boolean).join(" · ") || null,
        vocabularySystem: catalogLabel(
          aacProfileCatalog.vocabularySystems,
          structuredAac.vocabularySystemId,
          structuredAac.vocabularySystemCustomLabel,
        ),
        accessMethod: catalogLabel(
          aacProfileCatalog.accessMethods,
          structuredAac.accessMethodId,
          structuredAac.accessMethodCustomLabel,
        ),
        lastConfirmedAt: structuredAac.confirmedAt.toISOString(),
      } satisfies AacSnapshot;
    }
    const value = details.aacSnapshot;
    if (!value || typeof value !== "object" || Array.isArray(value))
      return undefined;
    const snapshot = value as Record<string, unknown>;
    if (typeof snapshot.isUser !== "boolean") return undefined;
    const stringOrNull = (key: string) =>
      typeof snapshot[key] === "string" && snapshot[key].trim()
        ? snapshot[key].trim()
        : null;
    return {
      isUser: snapshot.isUser,
      device: stringOrNull("device"),
      vocabularySystem: stringOrNull("vocabularySystem"),
      accessMethod: stringOrNull("accessMethod"),
      lastConfirmedAt: stringOrNull("lastConfirmedAt"),
    } satisfies AacSnapshot;
  })();
  const names = canonicalChildNames(profile);
  return {
    id: profile.id,
    name: names.name,
    firstName: names.firstName,
    lastName: names.lastName,
    preferredName: names.preferredName,
    pronouns: profile.pronouns,
    dateOfBirth: profile.dateOfBirth,
    age: profile.dateOfBirth
      ? ageFromDateOfBirth(profile.dateOfBirth)
      : typeof details.age === "number"
        ? details.age
        : 0,
    photoUrl: typeof details.photoUrl === "string" ? details.photoUrl : null,
    school: profile.school,
    grade: profile.grade,
    communicationStyle: profile.communicationStyle,
    ...(aacSnapshot ? { aacSnapshot } : {}),
    glpNotes: typeof details.glpNotes === "string" ? details.glpNotes : "",
    strengths: arrayDetail("strengths"),
    sensoryPreferences: arrayDetail("sensoryPreferences"),
    specialInterests: arrayDetail("specialInterests"),
    regulationNotes:
      typeof details.regulationNotes === "string"
        ? details.regulationNotes
        : "",
    sensorySupports: arrayDetail("sensorySupports"),
    sensoryChallenges: arrayDetail("sensoryChallenges"),
    gestaltCount,
    team: [],
  };
};
const gestaltFromRecord = (
  record: typeof clinicalGestaltsTable.$inferSelect,
): Gestalt => ({
  id: record.id,
  childId: record.childId,
  phrase: record.phrase,
  audioUrl: null,
  source: record.source,
  meaning: record.meaning,
  function: record.communicationFunction,
  contexts: record.contexts,
  emotionalState: record.emotionalState,
  dateAdded: record.createdAt.toISOString(),
  createdBy: record.createdByUserId,
  comments: [],
  aacPlanningStatus: null,
});
const roleSafeGestalt = (
  record: typeof clinicalGestaltsTable.$inferSelect,
): Gestalt => ({
  ...gestaltFromRecord(record),
  audioUrl: null,
  source: record.source.toLocaleLowerCase().includes("review pending")
    ? "Care-team observation · clinician review pending"
    : "Shared dictionary",
  function: "Shared communication",
  emotionalState: "Not documented",
  createdBy: "Care team member",
  comments: [],
});
const gestaltsWithCollaboration = async (
  records: Array<typeof clinicalGestaltsTable.$inferSelect>,
): Promise<Gestalt[]> => {
  if (!records.length) return [];
  const recordIds = records.map((record) => record.id);
  const notes = await db
    .select()
    .from(gestaltCollaborationNotesTable)
    .where(inArray(gestaltCollaborationNotesTable.gestaltId, recordIds))
    .orderBy(desc(gestaltCollaborationNotesTable.createdAt));
  const notesByGestalt = new Map<number, Comment[]>();
  for (const note of notes) {
    notesByGestalt.set(note.gestaltId, [
      ...(notesByGestalt.get(note.gestaltId) ?? []),
      {
        id: note.id,
        author: note.authorName,
        role: note.authorRole,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
      },
    ]);
  }
  return records.map((record) => ({
    ...gestaltFromRecord(record),
    comments: notesByGestalt.get(record.id) ?? [],
  }));
};
const gestalts: Gestalt[] = [
  {
    id: 1,
    childId: 1,
    phrase: "Blast off!",
    audioUrl: null,
    source: "Space Camp video",
    meaning: "Excited about starting an activity",
    function: "Shared Joy",
    contexts: ["Home", "School"],
    emotionalState: "Excited",
    dateAdded: "2026-08-18T14:00:00.000Z",
    createdBy: "Maya Chen",
    comments: [
      {
        id: 1,
        author: "Jordan Blake",
        role: "Teacher",
        body: "He says this right before recess or a favorite activity.",
        createdAt: "2026-08-18T15:30:00.000Z",
      },
    ],
    aacPlanningStatus: null,
  },
  {
    id: 2,
    childId: 1,
    phrase: "To infinity and beyond",
    audioUrl: null,
    source: "Toy Story",
    meaning: "Wants connection and shared play",
    function: "Request",
    contexts: ["Home", "Therapy"],
    emotionalState: "Regulated",
    dateAdded: "2026-08-17T10:00:00.000Z",
    createdBy: "Dr. Lena Ortiz",
    comments: [
      {
        id: 2,
        author: "Maya Chen",
        role: "Parent",
        body: "Usually means he wants us to join him, not that he wants to leave.",
        createdAt: "2026-08-17T12:00:00.000Z",
      },
    ],
    aacPlanningStatus: null,
  },
  {
    id: 3,
    childId: 1,
    phrase: "That's enough, thank you",
    audioUrl: null,
    source: "Bluey",
    meaning: "Feeling overwhelmed and asking for a pause",
    function: "Self-Advocacy",
    contexts: ["Home", "School", "Community"],
    emotionalState: "Dysregulated",
    dateAdded: "2026-08-16T09:00:00.000Z",
    createdBy: "Maya Chen",
    comments: [],
    aacPlanningStatus: null,
  },
  {
    id: 4,
    childId: 1,
    phrase: "A little help here",
    audioUrl: null,
    source: "Paw Patrol",
    meaning: "Needs support getting started or finishing a task",
    function: "Request",
    contexts: ["School", "Therapy"],
    emotionalState: "Frustrated",
    dateAdded: "2026-08-15T11:00:00.000Z",
    createdBy: "Jordan Blake",
    comments: [],
    aacPlanningStatus: null,
  },
];
const observations: Observation[] = [
  {
    id: 1,
    childId: 1,
    author: "Dr. Lena Ortiz",
    role: "SLP",
    body: "Oliver independently combined two gestalts during play and looked toward me to share the moment.",
    context: "Therapy",
    createdAt: "2026-08-18T16:00:00.000Z",
  },
  {
    id: 2,
    childId: 1,
    author: "Jordan Blake",
    role: "Teacher",
    body: "The visual transition card helped him move from lunch to reading without protest.",
    context: "School",
    createdAt: "2026-08-18T13:00:00.000Z",
  },
];
let nextGestaltId = 5;
let nextCommentId = 3;
let nextObservationId = 3;
const storeDirectory = path.resolve(process.cwd(), ".data", "echomap-sessions");
const storePath = path.join(storeDirectory, "sessions.json");
const audioObjectStore = createAudioObjectStore();
const recordingObjectStorage = new RecordingObjectStorage();
const persistedAudioObjectStore = (
  audio: typeof sessionAudioObjectsTable.$inferSelect,
) => objectStoreForStorageDriver(audio.storageDriver);
let sessionStore: SessionStore = {
  sessions: [],
  audio: [],
  nextSessionId: 1,
  nextGestaltId: 1000,
};
let sessionStoreLoaded = false;

const encryptStoredText = (value: string) =>
  `enc:${encryptAtRest(Buffer.from(value, "utf8")).toString("base64")}`;
const decryptStoredText = (value: string) =>
  value.startsWith("enc:")
    ? decryptAtRest(Buffer.from(value.slice(4), "base64")).toString("utf8")
    : value;
const protectSessionForStorage = (session: SavedSession): SavedSession => ({
  ...session,
  clinicalObservations: encryptStoredText(session.clinicalObservations),
  nextSteps: encryptStoredText(session.nextSteps),
  note: encryptStoredText(session.note),
  gestalts: session.gestalts.map((gestalt) => ({
    ...gestalt,
    phrase: encryptStoredText(gestalt.phrase),
    meaning: encryptStoredText(gestalt.meaning),
    function: encryptStoredText(gestalt.function),
    context: encryptStoredText(gestalt.context),
    emotionalState: encryptStoredText(gestalt.emotionalState),
    note: encryptStoredText(gestalt.note),
  })),
});
const revealSessionFromStorage = (session: SavedSession): SavedSession => ({
  ...session,
  clinicalObservations: decryptStoredText(session.clinicalObservations),
  nextSteps: decryptStoredText(session.nextSteps),
  note: decryptStoredText(session.note),
  gestalts: session.gestalts.map((gestalt) => ({
    ...gestalt,
    phrase: decryptStoredText(gestalt.phrase),
    meaning: decryptStoredText(gestalt.meaning),
    function: decryptStoredText(gestalt.function),
    context: decryptStoredText(gestalt.context),
    emotionalState: decryptStoredText(gestalt.emotionalState),
    note: decryptStoredText(gestalt.note),
  })),
});

const ensureSessionStore = async () => {
  if (sessionStoreLoaded) return;
  await mkdir(storeDirectory, { recursive: true });
  try {
    const stored = JSON.parse(
      await readFile(storePath, "utf8"),
    ) as SessionStore;
    sessionStore = {
      ...stored,
      sessions: stored.sessions.map(revealSessionFromStorage),
    };
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
  sessionStoreLoaded = true;
};
const saveSessionStore = async () => {
  await mkdir(storeDirectory, { recursive: true });
  await writeFile(
    storePath,
    JSON.stringify(
      {
        ...sessionStore,
        sessions: sessionStore.sessions.map(protectSessionForStorage),
      },
      null,
      2,
    ),
    "utf8",
  );
};
const sessionResponse = (session: SavedSession) => {
  const {
    gestaltIds: _gestaltIds,
    audioId: _audioId,
    transcriptionId: _transcriptionId,
    ...response
  } = session;
  return { ...response, consent: session.consent ?? null };
};

type CareTeamActor = ResolvedCareTeamActor;
const viewerFrom = (req: Request): CareTeamActor | null =>
  req.echomapAuthFailure ? null : effectiveViewerFromRequest(req);
const realViewerFrom = (req: Request): CareTeamActor | null =>
  req.echomapAuthFailure ? null : realViewerFromRequest(req);
const isNativeDevelopmentDemo = (actor: CareTeamActor | null) =>
  Boolean(actor?.isDevelopmentDemo && !actor.previewRole);
const viewerResponse = (
  actor: CareTeamActor,
  actualRole: CareTeamActor["role"] = actor.role,
) => ({
  userId: actor.userId,
  name: actor.author,
  role: actor.role,
  actualRole,
  childIds: actor.childIds,
  isAdmin: actor.isAdmin,
  isSuperAdmin: Boolean(actor.isSuperAdmin),
  isRolePreview: Boolean(actor.previewRole),
  isDevelopmentDemo: Boolean(actor.isDevelopmentDemo),
  previewRole: actor.previewRole ?? null,
});
const authenticationError = (req: Request) =>
  req.echomapAuthFailure === "email_unverified"
    ? "Verify your email address before accessing private care-team data."
    : req.echomapAuthFailure === "not_invited"
      ? "Your verified account has not been invited to this care team."
      : req.echomapAuthFailure === "beta_notice_unacknowledged"
        ? "Acknowledge the current beta participation notice to continue."
        : req.echomapAuthFailure === "access_disabled"
          ? "This account or organization is not currently enabled for private beta access."
          : "Please sign in to access private care-team data.";
const authorFrom = (req: Request) => {
  const actor = viewerFrom(req);
  return actor ? { author: actor.author, role: actor.role } : null;
};
const canAccessChild = (req: Request, childId: number) => {
  return canAccessAssignedChild(viewerFrom(req) ?? undefined, childId);
};
const requireChildAccess = (req: Request, res: any, childId: number) => {
  if (!viewerFrom(req)) {
    res
      .status(req.echomapAuthFailure ? 403 : 401)
      .json({ error: authenticationError(req) });
    return false;
  }
  if (!canAccessChild(req, childId)) {
    res
      .status(403)
      .json({
        error: "This care-team role does not have access to this child.",
      });
    return false;
  }
  return true;
};
const requireAdmin = (req: Request, res: any) => {
  const actor = viewerFrom(req);
  if (!actor) {
    res
      .status(401)
      .json({ error: "Please sign in to view security administration." });
    return null;
  }
  if (!actor.isAdmin) {
    res
      .status(403)
      .json({
        error:
          "Administrator access is required to view security administration.",
      });
    return null;
  }
  return actor;
};
const requireSuperAdmin = (req: Request, res: any) => {
  const actor = realViewerFrom(req);
  if (!actor) {
    res
      .status(401)
      .json({ error: "Please sign in to use owner testing tools." });
    return null;
  }
  if (!actor.isSuperAdmin) {
    void writeSecurityAudit({
      actor,
      action: "ROLE_PREVIEW_ACCESS_DENIED",
      targetType: "owner_testing",
      outcome: "failure",
    }).catch((error) =>
      req.log.warn({ err: error }, "Could not audit denied owner-tools access"),
    );
    res
      .status(403)
      .json({
        error: "Super Admin access is required to use owner testing tools.",
      });
    return null;
  }
  return actor;
};
const requireClinician = (req: Request, res: any) => {
  const actor = viewerFrom(req);
  if (!actor) {
    res
      .status(401)
      .json({ error: "Please sign in to manage clinical session data." });
    return null;
  }
  if (!canManageClinicalData(actor.role) && !isNativeDevelopmentDemo(actor)) {
    res
      .status(403)
      .json({ error: "Only an SLP can manage clinical session data." });
    return null;
  }
  return actor;
};
const canUseClinicalTools = (actor: CareTeamActor | null) =>
  Boolean(
    actor &&
    (canManageClinicalData(actor.role) || isNativeDevelopmentDemo(actor)),
  );

const requireFamilyLearningAccess = (
  req: Request,
  res: any,
  childId: number,
): CareTeamActor | null => {
  const actor = viewerFrom(req);
  if (!actor) {
    res
      .status(req.echomapAuthFailure ? 403 : 401)
      .json({ error: authenticationError(req) });
    return null;
  }
  if (actor.role !== "Parent") {
    res
      .status(403)
      .json({
        error: "Parent, caregiver, or authorized family access is required.",
      });
    return null;
  }
  if (!actor.organizationId || !canAccessAssignedChild(actor, childId)) {
    res
      .status(403)
      .json({
        error: "This family account does not have access to this child.",
      });
    return null;
  }
  return actor;
};

const requireTeacherResourceAccess = (
  req: Request,
  res: any,
  childId: number,
): CareTeamActor | null => {
  const actor = viewerFrom(req);
  if (!actor) {
    res
      .status(req.echomapAuthFailure ? 403 : 401)
      .json({ error: authenticationError(req) });
    return null;
  }
  if (
    actor.role !== "Teacher" ||
    !actor.organizationId ||
    !canAccessAssignedChild(actor, childId)
  ) {
    res
      .status(403)
      .json({
        error:
          "Authorized teacher access is required for this resource center.",
      });
    return null;
  }
  return actor;
};

const requireClinicianLearningAccess = (req: Request, res: any) => {
  const actor = requireClinician(req, res);
  if (!actor) return null;
  if (!actor.organizationId) {
    res
      .status(403)
      .json({ error: "An organization-scoped clinician account is required." });
    return null;
  }
  return actor as CareTeamActor & { organizationId: number };
};

const clinicianLearningCenterFor = async (
  actor: CareTeamActor & { organizationId: number },
) => {
  const { resource, modules } = await ensureClinicianLearningCenter(
    actor.organizationId,
  );
  const [progressRows, preference] = await Promise.all([
    db
      .select()
      .from(clinicianLearningProgressTable)
      .where(
        and(
          eq(
            clinicianLearningProgressTable.organizationId,
            actor.organizationId,
          ),
          eq(clinicianLearningProgressTable.userId, actor.userId),
          eq(clinicianLearningProgressTable.resourceId, resource.id),
        ),
      ),
    db
      .select()
      .from(clinicianLearningPreferencesTable)
      .where(
        and(
          eq(
            clinicianLearningPreferencesTable.organizationId,
            actor.organizationId,
          ),
          eq(clinicianLearningPreferencesTable.userId, actor.userId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
  ]);
  const byModule = new Map(progressRows.map((row) => [row.moduleId, row]));
  const responseModules = modules.map((module) => {
    const progress = byModule.get(module.id);
    return {
      moduleKey: module.moduleKey,
      category: module.category,
      kind: module.kind,
      position: module.position,
      title: module.title,
      summary: module.summary,
      readingMinutes: module.readingMinutes,
      tags: module.tags,
      workflowContexts: module.workflowContexts,
      sections: module.sections,
      bookmarked: progress?.bookmarked ?? false,
      completed: progress?.completed ?? false,
      progressPercent: progress?.progressPercent ?? 0,
      lastSectionKey: progress?.lastSectionKey ?? null,
      lastViewedAt: progress?.lastViewedAt?.toISOString() ?? null,
      completedAt: progress?.completedAt?.toISOString() ?? null,
    };
  });
  const completed = responseModules.filter((module) => module.completed).length;
  const lastViewedModuleKey =
    responseModules
      .filter((module) => module.lastViewedAt)
      .sort(
        (left, right) =>
          new Date(right.lastViewedAt!).getTime() -
          new Date(left.lastViewedAt!).getTime(),
      )[0]?.moduleKey ?? null;
  return {
    title: resource.title,
    description: resource.description,
    contentVersion: resource.contentVersion,
    disclaimer: CLINICIAN_LEARNING_DISCLAIMER,
    modules: responseModules,
    categories: [...new Set(responseModules.map((module) => module.category))],
    completionPercentage: responseModules.length
      ? Math.round((completed / responseModules.length) * 100)
      : 0,
    lastViewedModuleKey,
    workflowCoachingEnabled: preference?.workflowCoachingEnabled ?? false,
    downloadAvailable: true,
  };
};

const teacherResourceCenterFor = async (
  actor: CareTeamActor & { organizationId: number },
  childId: number,
) => {
  const { resource, items } = await ensureTeacherResourceCenter(
    actor.organizationId,
  );
  const progress = await db
    .select()
    .from(teacherResourceProgressTable)
    .where(
      and(
        eq(teacherResourceProgressTable.organizationId, actor.organizationId),
        eq(teacherResourceProgressTable.childId, childId),
        eq(teacherResourceProgressTable.userId, actor.userId),
        eq(teacherResourceProgressTable.resourceId, resource.id),
      ),
    );
  const byItem = new Map(progress.map((row) => [row.itemId, row]));
  const responseItems = items.map((item) => {
    const row = byItem.get(item.id);
    return {
      resourceKey: item.resourceKey,
      category: item.category,
      position: item.position,
      title: item.title,
      summary: item.summary,
      readingMinutes: item.readingMinutes,
      sections: item.sections,
      format: item.format,
      bookmarked: row?.bookmarked ?? false,
      completed: row?.completed ?? false,
      lastViewedAt: row?.lastViewedAt?.toISOString() ?? null,
      completedAt: row?.completedAt?.toISOString() ?? null,
    };
  });
  const completed = responseItems.filter((item) => item.completed).length;
  return {
    title: resource.title,
    description: resource.description,
    contentVersion: resource.contentVersion,
    disclaimer: TEACHER_RESOURCE_DISCLAIMER,
    pdfAvailable: Boolean(resource.pdfObjectPath),
    pdfDownloadUrl: resource.pdfObjectPath
      ? `/api/teacher-resource-center/download?childId=${childId}`
      : null,
    items: responseItems,
    categories: [...new Set(responseItems.map((item) => item.category))],
    completionPercentage: responseItems.length
      ? Math.round((completed / responseItems.length) * 100)
      : 0,
  };
};

const parentLearningResourceResponse = (
  resource: Awaited<ReturnType<typeof ensureParentLearningCenter>>["resource"],
  childId: number,
) => ({
  resourceKey: resource.resourceKey,
  title: resource.title,
  subtitle: resource.subtitle,
  contentVersion: resource.contentVersion,
  disclaimer: PARENT_LEARNING_DISCLAIMER,
  pdfAvailable: Boolean(resource.pdfObjectPath),
  pdfDownloadUrl: resource.pdfObjectPath
    ? `/api/parent-learning-center/download?childId=${childId}`
    : null,
});

const parentLearningCenterFor = async (
  actor: CareTeamActor & { organizationId: number },
  childId: number,
) => {
  const { resource, modules } = await ensureParentLearningCenter(
    actor.organizationId,
  );
  const moduleIds = modules.map((module) => module.id);
  const [progressRows, reflectionRows] = moduleIds.length
    ? await Promise.all([
        db
          .select()
          .from(parentLearningProgressTable)
          .where(
            and(
              eq(
                parentLearningProgressTable.organizationId,
                actor.organizationId,
              ),
              eq(parentLearningProgressTable.childId, childId),
              eq(parentLearningProgressTable.userId, actor.userId),
              inArray(parentLearningProgressTable.moduleId, moduleIds),
            ),
          ),
        db
          .select()
          .from(parentLearningReflectionsTable)
          .where(
            and(
              eq(
                parentLearningReflectionsTable.organizationId,
                actor.organizationId,
              ),
              eq(parentLearningReflectionsTable.childId, childId),
              eq(parentLearningReflectionsTable.userId, actor.userId),
              inArray(parentLearningReflectionsTable.moduleId, moduleIds),
            ),
          ),
      ])
    : [[], []];
  const progressByModule = new Map(
    progressRows.map((row) => [row.moduleId, row]),
  );
  const reflectionByModule = new Map(
    reflectionRows.map((row) => [row.moduleId, row]),
  );
  const responseModules = modules.map((module) => {
    const progress = progressByModule.get(module.id);
    const reflection = reflectionByModule.get(module.id);
    return {
      moduleKey: module.moduleKey,
      position: module.position,
      title: module.title,
      summary: module.summary,
      readingMinutes: module.readingMinutes,
      sections: module.sections,
      tryThisAtHome: module.tryThisAtHome,
      bookmarked: progress?.bookmarked ?? false,
      completed: progress?.completed ?? false,
      lastViewedAt: progress?.lastViewedAt?.toISOString() ?? null,
      completedAt: progress?.completedAt?.toISOString() ?? null,
      reflection: reflection?.body ?? null,
    };
  });
  const completedModules = responseModules.filter(
    (module) => module.completed,
  ).length;
  const lastViewedModuleKey =
    modules
      .map((module) => ({ module, progress: progressByModule.get(module.id) }))
      .filter((entry) => entry.progress?.lastViewedAt)
      .sort(
        (left, right) =>
          right.progress!.lastViewedAt!.getTime() -
          left.progress!.lastViewedAt!.getTime(),
      )[0]?.module.moduleKey ?? null;
  return {
    resource: parentLearningResourceResponse(resource, childId),
    modules: responseModules,
    completedModules,
    totalModules: responseModules.length,
    completionPercentage: responseModules.length
      ? Math.round((completedModules / responseModules.length) * 100)
      : 0,
    lastViewedModuleKey,
  };
};

const aacPlanningEntriesFor = async (
  organizationId: number,
  childId: number,
) => {
  const [
    planningRows,
    gestaltRows,
    occurrenceRows,
    observationRows,
    sessionRows,
  ] = await Promise.all([
    db
      .select()
      .from(aacVocabularyPlanningTable)
      .where(
        and(
          eq(aacVocabularyPlanningTable.organizationId, organizationId),
          eq(aacVocabularyPlanningTable.childId, childId),
        ),
      ),
    db
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.organizationId, organizationId),
          eq(clinicalGestaltsTable.childId, childId),
          isNull(clinicalGestaltsTable.archivedAt),
        ),
      ),
    db
      .select()
      .from(gestaltOccurrencesTable)
      .where(eq(gestaltOccurrencesTable.childId, childId)),
    db
      .select()
      .from(phraseObservationsTable)
      .where(
        and(
          eq(phraseObservationsTable.organizationId, organizationId),
          eq(phraseObservationsTable.childId, childId),
        ),
      ),
    db
      .select()
      .from(therapySessionsTable)
      .where(
        and(
          eq(therapySessionsTable.organizationId, organizationId),
          eq(therapySessionsTable.childId, childId),
          isNull(therapySessionsTable.archivedAt),
        ),
      ),
  ]);
  const sessionIds = sessionRows.map((session) => session.id);
  const sessionGestalts = sessionIds.length
    ? await db
        .select()
        .from(therapySessionGestaltsTable)
        .where(inArray(therapySessionGestaltsTable.sessionId, sessionIds))
    : [];
  const sessionById = new Map(
    sessionRows.map((session) => [session.id, session]),
  );
  const gestaltById = new Map(
    gestaltRows.map((gestalt) => [gestalt.id, gestalt]),
  );
  const occurrenceByGestaltId = new Map(
    occurrenceRows.map((row) => [row.gestaltId, row]),
  );
  const evidenceByGestaltId = new Map<
    number,
    Array<{ observedAt: Date; context?: string | null }>
  >();
  for (const observation of observationRows) {
    evidenceByGestaltId.set(observation.gestaltId, [
      ...(evidenceByGestaltId.get(observation.gestaltId) ?? []),
      { observedAt: observation.observedAt, context: observation.context },
    ]);
  }
  for (const sessionGestalt of sessionGestalts) {
    if (!sessionGestalt.childAttributed || !sessionGestalt.gestaltId) continue;
    const session = sessionById.get(sessionGestalt.sessionId);
    if (!session) continue;
    evidenceByGestaltId.set(sessionGestalt.gestaltId, [
      ...(evidenceByGestaltId.get(sessionGestalt.gestaltId) ?? []),
      { observedAt: session.createdAt, context: sessionGestalt.context },
    ]);
  }
  return planningRows
    .flatMap((planning) => {
      const gestalt = gestaltById.get(planning.gestaltId);
      if (!gestalt) return [];
      const occurrence = occurrenceByGestaltId.get(gestalt.id);
      const evidence = evidenceByGestaltId.get(gestalt.id) ?? [];
      const observedDates = evidence.map((item) => item.observedAt);
      if (occurrence?.lastSeenAt) observedDates.push(occurrence.lastSeenAt);
      observedDates.sort((left, right) => left.getTime() - right.getTime());
      return [
        {
          id: planning.id,
          childId: planning.childId,
          gestaltId: gestalt.id,
          phrase: gestalt.phrase,
          meaning: gestalt.meaning,
          status: planning.status,
          occurrenceCount: occurrence?.occurrenceCount ?? evidence.length,
          firstObservedAt: observedDates[0]?.toISOString() ?? null,
          lastObservedAt: observedDates.at(-1)?.toISOString() ?? null,
          communicationFunction: gestalt.communicationFunction,
          contexts: [
            ...new Set([
              ...gestalt.contexts,
              ...evidence
                .map((item) => item.context?.trim())
                .filter((value): value is string => Boolean(value)),
            ]),
          ],
          dateAdded: gestalt.createdAt.toISOString(),
          updatedAt: planning.updatedAt.toISOString(),
        },
      ];
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
};

type StoredChildInterest = {
  id: string;
  interest: string;
  status: "approved" | "suggested";
  addedAt: string;
  addedBy: string;
  addedByRole: string;
  addedByUserId?: string;
};
const interestKey = (value: string) => value.trim().toLocaleLowerCase();
const childInterestEntries = (
  profile: typeof childProfilesTable.$inferSelect,
): StoredChildInterest[] => {
  const details = profile.profileDetails as Record<string, unknown>;
  const stored = Array.isArray(details.interestEntries)
    ? details.interestEntries.flatMap((value): StoredChildInterest[] => {
        if (!value || typeof value !== "object") return [];
        const entry = value as Record<string, unknown>;
        if (
          typeof entry.id !== "string" ||
          typeof entry.interest !== "string" ||
          !entry.interest.trim() ||
          (entry.status !== "approved" && entry.status !== "suggested") ||
          typeof entry.addedAt !== "string" ||
          typeof entry.addedBy !== "string" ||
          typeof entry.addedByRole !== "string"
        )
          return [];
        return [
          {
            id: entry.id,
            interest: entry.interest.trim(),
            status: entry.status,
            addedAt: entry.addedAt,
            addedBy: entry.addedBy,
            addedByRole: entry.addedByRole,
            ...(typeof entry.addedByUserId === "string"
              ? { addedByUserId: entry.addedByUserId }
              : {}),
          },
        ];
      })
    : [];
  const existingKeys = new Set(
    stored.map((entry) => interestKey(entry.interest)),
  );
  const legacy = Array.isArray(details.specialInterests)
    ? details.specialInterests.flatMap(
        (value, index): StoredChildInterest[] => {
          if (
            typeof value !== "string" ||
            !value.trim() ||
            existingKeys.has(interestKey(value))
          )
            return [];
          return [
            {
              id: `legacy-${index}-${interestKey(value).replaceAll(/\W+/g, "-")}`,
              interest: value.trim(),
              status: "approved",
              addedAt: profile.createdAt.toISOString(),
              addedBy: "Care team",
              addedByRole: "SLP",
            },
          ];
        },
      )
    : [];
  return [...stored, ...legacy].sort((left, right) =>
    left.status === right.status
      ? Date.parse(right.addedAt) - Date.parse(left.addedAt)
      : left.status === "approved"
        ? -1
        : 1,
  );
};
const childInterestResponse = (
  entry: StoredChildInterest,
  childId: number,
  actor: CareTeamActor,
) => ({
  id: entry.id,
  childId,
  interest: entry.interest,
  status: entry.status,
  addedAt: entry.addedAt,
  addedBy: entry.addedBy,
  addedByRole: entry.addedByRole,
  canEdit:
    actor.role === "SLP" ||
    (entry.status === "suggested" && entry.addedByUserId === actor.userId),
});
const childResponseForActor = (
  profile: typeof childProfilesTable.$inferSelect,
  actor: CareTeamActor,
  gestaltCount = 0,
  structuredAac?: typeof aacProfilesTable.$inferSelect,
) => {
  const child = childFromProfile(profile, gestaltCount, structuredAac);
  if (canUseClinicalTools(actor)) return child;
  const { glpNotes: _glpNotes, ...roleSafeChild } = child;
  return roleSafeChild;
};
const normalizeAacModalities = (value: unknown): AacCommunicationModality[] => {
  if (!Array.isArray(value)) return [];
  const selected = new Set(
    value.filter(
      (item): item is AacCommunicationModality =>
        typeof item === "string" &&
        (aacCommunicationModalityValues as readonly string[]).includes(item),
    ),
  );
  return aacCommunicationModalityValues.filter((item) => selected.has(item));
};
const aacProfileCanEdit = (actor: ResolvedCareTeamActor) =>
  canManageClinicalData(actor.role) || isNativeDevelopmentDemo(actor);
const emptyAacProfileValue = (): AacProfileHistoryValue => ({
  communicationModalities: [],
  otherModalityLabel: null,
  aacUserStatus: "unknown",
  deviceVendorId: null,
  deviceVendorCustomLabel: null,
  deviceModelId: null,
  deviceModelCustomLabel: null,
  vocabularySystemId: null,
  vocabularySystemCustomLabel: null,
  accessMethodId: null,
  accessMethodCustomLabel: null,
  ownershipId: null,
  ownershipCustomLabel: null,
  notes: null,
});
const aacProfileValueFromRow = (
  profile?: typeof aacProfilesTable.$inferSelect,
): AacProfileHistoryValue => ({
  communicationModalities: normalizeAacModalities(
    profile?.communicationModalities,
  ),
  otherModalityLabel: profile?.otherModalityLabel ?? null,
  aacUserStatus: (profile?.aacUserStatus ?? "unknown") as AacUserStatus,
  deviceVendorId: profile?.deviceVendorId ?? null,
  deviceVendorCustomLabel: profile?.deviceVendorCustomLabel ?? null,
  deviceModelId: profile?.deviceModelId ?? null,
  deviceModelCustomLabel: profile?.deviceModelCustomLabel ?? null,
  vocabularySystemId: profile?.vocabularySystemId ?? null,
  vocabularySystemCustomLabel: profile?.vocabularySystemCustomLabel ?? null,
  accessMethodId: profile?.accessMethodId ?? null,
  accessMethodCustomLabel: profile?.accessMethodCustomLabel ?? null,
  ownershipId: profile?.ownershipId ?? null,
  ownershipCustomLabel: profile?.ownershipCustomLabel ?? null,
  notes: profile?.notes ?? null,
});
const aacProfileChangedFields = (
  previous: AacProfileHistoryValue | null,
  next: AacProfileHistoryValue | null,
) =>
  Object.keys(previous ?? next ?? {}).filter(
    (field) =>
      JSON.stringify(
        previous?.[field as keyof AacProfileHistoryValue] ?? null,
      ) !==
      JSON.stringify(next?.[field as keyof AacProfileHistoryValue] ?? null),
  );
const aacProfileResponse = async (
  organizationId: number,
  childId: number,
  actor: ResolvedCareTeamActor,
) => {
  const [[profile], history] = await Promise.all([
    db
      .select()
      .from(aacProfilesTable)
      .where(
        and(
          eq(aacProfilesTable.organizationId, organizationId),
          eq(aacProfilesTable.childId, childId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(aacProfileHistoryTable)
      .where(
        and(
          eq(aacProfileHistoryTable.organizationId, organizationId),
          eq(aacProfileHistoryTable.childId, childId),
        ),
      )
      .orderBy(desc(aacProfileHistoryTable.occurredAt)),
  ]);
  const active = profile && !profile.removedAt ? profile : undefined;
  return {
    childId,
    exists: Boolean(active),
    ...aacProfileValueFromRow(active),
    canView: true,
    canEdit: aacProfileCanEdit(actor),
    version: profile?.version ?? 0,
    lastUpdatedAt: active?.updatedAt ?? null,
    lastUpdatedBy: active?.updatedByName ?? null,
    lastUpdatedRole: active?.updatedByRole ?? null,
    lastConfirmedAt: active?.confirmedAt ?? null,
    lastConfirmedBy: active?.confirmedByName ?? null,
    lastConfirmedRole: active?.confirmedByRole ?? null,
    catalog: aacProfileCatalog,
    history: history.map((event) => ({
      id: event.id,
      childId: event.childId,
      action: event.action as "created" | "updated" | "removed",
      changedFields: event.changedFields.length
        ? event.changedFields
        : ["communicationModalities", "otherModalityLabel"],
      previousValue:
        event.previousValue ??
        (event.previousModalities === null
          ? null
          : {
              ...emptyAacProfileValue(),
              communicationModalities: normalizeAacModalities(
                event.previousModalities,
              ),
              otherModalityLabel: event.previousOtherModalityLabel,
            }),
      nextValue:
        event.nextValue ??
        (event.nextModalities === null
          ? null
          : {
              ...emptyAacProfileValue(),
              communicationModalities: normalizeAacModalities(
                event.nextModalities,
              ),
              otherModalityLabel: event.nextOtherModalityLabel,
            }),
      actorName: event.actorName,
      actorRole: event.actorRole,
      occurredAt: event.occurredAt,
    })),
  };
};
const profileDetailsWithInterestEntries = (
  profile: typeof childProfilesTable.$inferSelect,
  entries: StoredChildInterest[],
) => ({
  ...(profile.profileDetails as Record<string, unknown>),
  interestEntries: entries,
});
type SharedProfileSection = (typeof sharedChildProfileSectionValues)[number];
const sharedProfileValueKey = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const sharedProfileCategory = (
  section: SharedProfileSection,
  category?: string,
) => {
  if (section !== "sensory_supports") return "";
  return category === "challenge" ? "challenge" : "support";
};
const sharedProfileEntryResponse = (
  entry: typeof sharedChildProfileEntriesTable.$inferSelect,
  actor: CareTeamActor,
) => ({
  id: entry.id,
  childId: entry.childId,
  section: entry.section as SharedProfileSection,
  category: entry.category,
  value: entry.value,
  authorName: entry.authorName,
  authorRole: entry.authorRole,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  version: entry.version,
  canEdit: actor.role === "SLP" || entry.authorUserId === actor.userId,
});
const legacySharedProfileValues = (
  profile: typeof childProfilesTable.$inferSelect,
) => {
  const details = profile.profileDetails as Record<string, unknown>;
  const strings = (value: unknown) =>
    Array.isArray(value)
      ? value.filter(
          (item): item is string =>
            typeof item === "string" && Boolean(item.trim()),
        )
      : [];
  const values: Array<{
    section: SharedProfileSection;
    category: string;
    value: string;
    authorName: string;
    authorRole: string;
  }> = [];
  const add = (
    section: SharedProfileSection,
    category: string,
    value: string,
    authorName = "Care team",
    authorRole = "SLP",
  ) => {
    if (value.trim())
      values.push({
        section,
        category,
        value: value.trim(),
        authorName,
        authorRole,
      });
  };
  strings(details.strengths).forEach((value) => add("strengths", "", value));
  strings(details.specialInterests).forEach((value) =>
    add("interests", "", value),
  );
  if (Array.isArray(details.interestEntries)) {
    details.interestEntries.forEach((candidate) => {
      if (!candidate || typeof candidate !== "object") return;
      const interest = candidate as Record<string, unknown>;
      if (typeof interest.interest !== "string") return;
      add(
        "interests",
        "",
        interest.interest,
        typeof interest.addedBy === "string" ? interest.addedBy : "Care team",
        typeof interest.addedByRole === "string" ? interest.addedByRole : "SLP",
      );
    });
  }
  const supports = strings(details.sensorySupports);
  (supports.length ? supports : strings(details.sensoryPreferences)).forEach(
    (value) => add("sensory_supports", "support", value),
  );
  strings(details.sensoryChallenges).forEach((value) =>
    add("sensory_supports", "challenge", value),
  );
  if (typeof details.regulationNotes === "string")
    add("regulation_notes", "", details.regulationNotes);
  return values;
};
const ensureLegacySharedProfileEntries = async (
  profile: typeof childProfilesTable.$inferSelect,
) => {
  const legacy = legacySharedProfileValues(profile);
  if (!legacy.length) return;
  await db.transaction(async (tx) => {
    for (const value of legacy) {
      const [created] = await tx
        .insert(sharedChildProfileEntriesTable)
        .values({
          organizationId: profile.organizationId,
          childId: profile.id,
          section: value.section,
          category: value.category,
          value: value.value,
          normalizedValue: sharedProfileValueKey(value.value),
          authorUserId: null,
          authorName: value.authorName,
          authorRole: value.authorRole,
        })
        .onConflictDoNothing()
        .returning();
      if (!created) continue;
      await tx.insert(sharedChildProfileHistoryTable).values({
        organizationId: profile.organizationId,
        childId: profile.id,
        entryId: created.id,
        section: value.section,
        action: "created",
        previousValue: null,
        nextValue: value.value,
        actorUserId: null,
        actorName: value.authorName,
        actorRole: value.authorRole,
        metadata: { source: "legacy_profile" },
      });
    }
  });
};
const sharedProfileResponse = async (
  organizationId: number,
  childId: number,
  actor: CareTeamActor,
) => {
  const [entries, history] = await Promise.all([
    db
      .select()
      .from(sharedChildProfileEntriesTable)
      .where(
        and(
          eq(sharedChildProfileEntriesTable.organizationId, organizationId),
          eq(sharedChildProfileEntriesTable.childId, childId),
          isNull(sharedChildProfileEntriesTable.deletedAt),
        ),
      )
      .orderBy(desc(sharedChildProfileEntriesTable.updatedAt)),
    db
      .select()
      .from(sharedChildProfileHistoryTable)
      .where(
        and(
          eq(sharedChildProfileHistoryTable.organizationId, organizationId),
          eq(sharedChildProfileHistoryTable.childId, childId),
        ),
      )
      .orderBy(desc(sharedChildProfileHistoryTable.occurredAt)),
  ]);
  return {
    childId,
    canContribute:
      canContributeSharedChildContext(actor.role) ||
      isNativeDevelopmentDemo(actor),
    sections: sharedChildProfileSectionValues.map((section) => {
      const sectionHistory = history.find((event) => event.section === section);
      return {
        section,
        entries: entries
          .filter((entry) => entry.section === section)
          .map((entry) => sharedProfileEntryResponse(entry, actor)),
        lastUpdatedAt: sectionHistory?.occurredAt ?? null,
        lastUpdatedBy: sectionHistory
          ? `${sectionHistory.actorName} · ${sectionHistory.actorRole}`
          : null,
      };
    }),
    history: history.map((event) => ({
      id: event.id,
      entryId: event.entryId,
      childId: event.childId,
      section: event.section as SharedProfileSection,
      action: event.action as "created" | "updated" | "deleted",
      previousValue: event.previousValue,
      nextValue: event.nextValue,
      actorName: event.actorName,
      actorRole: event.actorRole,
      occurredAt: event.occurredAt,
    })),
  };
};
const collaborationNoteForPhraseObservation = ({
  actor,
  details,
  possibleMeaning,
  communicationFunction,
  context,
  observedAt,
}: {
  actor: CareTeamActor;
  details?: string;
  possibleMeaning?: string;
  communicationFunction?: string;
  context: string;
  observedAt: Date;
}) =>
  [
    `${actor.role} phrase observation · ${context} · ${observedAt.toLocaleDateString("en-US")}`,
    details?.trim(),
    possibleMeaning?.trim()
      ? `Possible meaning (care-team observation): ${possibleMeaning.trim()}`
      : null,
    communicationFunction
      ? `Observed communication function: ${communicationFunction}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
const textCipher = (value: string) =>
  encryptAtRest(Buffer.from(value, "utf8")).toString("base64");
const textPlain = (value: string | null) =>
  value ? decryptAtRest(Buffer.from(value, "base64")).toString("utf8") : null;
const clinicalKnowledgeSourceResponse = (
  source: typeof clinicalKnowledgeSourcesTable.$inferSelect,
  version?: typeof clinicalKnowledgeSourceVersionsTable.$inferSelect,
) => ({
  id: source.id,
  title: source.title,
  sourceType: source.sourceType,
  authorship: source.authorship,
  citation: source.citation,
  tags: source.tags,
  status: source.status,
  activeVersion: source.activeVersionId,
  contentType: version?.contentType ?? null,
  sizeBytes: version?.sizeBytes ?? null,
  createdAt: source.createdAt,
  updatedAt: source.updatedAt,
});
const clinicalKnowledgeInsightResponse = (
  insight: typeof clinicalKnowledgeInsightsTable.$inferSelect,
) => ({
  id: insight.id,
  childId: insight.childId,
  sessionId: insight.sessionId,
  category: insight.category,
  confidence: insight.confidence,
  disposition: insight.disposition,
  reviewReason: insight.reviewReason,
  alternatives: insight.alternatives,
  suggestion: textPlain(insight.encryptedSuggestion) ?? "",
  rationale: textPlain(insight.encryptedRationale) ?? "",
  citations: insight.citations,
  evidence: insight.evidenceSnapshot,
  provider: insight.provider,
  model: insight.model,
  status: insight.status,
  clinicianEdit: textPlain(insight.encryptedClinicianEdit),
  reviewNote: textPlain(insight.encryptedReviewNote),
  reviewedAt: insight.reviewedAt,
  createdAt: insight.createdAt,
  updatedAt: insight.updatedAt,
});
let developmentDemoRetention = {
  audioRetentionDays: 90,
  observationVideoRetentionDays: 90,
  sessionNoteRetentionDays: 2555,
  archivedClientStorageDays: 30,
  updatedAt: new Date(),
};
const developmentDemoSecurityOverview = () => ({
  activeUsers: 2,
  failedLoginAttempts: 0,
  consentRecordCount: 1,
  recentLogins: [],
  recentConsentRecords: [
    {
      childId: 1,
      confirmedBy: "EchoMap Demo Administrator",
      confirmedAt: new Date().toISOString(),
      statementVersion: "development-demo",
    },
  ],
  auditEvents: [],
  retentionSettings: {
    ...developmentDemoRetention,
    updatedAt: developmentDemoRetention.updatedAt.toISOString(),
  },
  classifications: [
    {
      dataType: "Child communication records",
      category: "clinical",
      sensitivity: "high",
      accessPolicy: "Assigned care team only",
      description: "Development-only demo classification.",
    },
  ],
  encryption: encryptionBoundary,
});
const persistedGestalts = (): Gestalt[] =>
  sessionStore.sessions.flatMap((session) =>
    session.gestalts.map((entry, index) => ({
      id: session.gestaltIds[index] ?? session.id * 1000 + index,
      childId: session.childId,
      phrase: entry.phrase,
      meaning: entry.meaning,
      function: entry.function,
      contexts: [entry.context],
      emotionalState: entry.emotionalState,
      source: "Reviewed therapy session",
      audioUrl: session.audioUrl,
      dateAdded: session.createdAt,
      createdBy: session.createdBy,
      comments: entry.note.trim()
        ? [
            {
              id: session.id * 100 + index,
              author: session.createdBy,
              role: session.role,
              body: entry.note,
              createdAt: session.createdAt,
            },
          ]
        : [],
      aacPlanningStatus: null,
    })),
  );
const allGestalts = () => [...persistedGestalts(), ...gestalts];
const currentChild = () => ({
  ...children[0],
  gestaltCount: allGestalts().filter((item) => item.childId === 1).length,
});
const fail = (res: any, message: string) =>
  res.status(400).json({ error: message });
const MAX_OBSERVATION_VIDEO_BYTES = 50 * 1024 * 1024;
const OBSERVATION_VIDEO_UPLOAD_TTL_MS = 15 * 60 * 1000;
const OBSERVATION_VIDEO_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const canViewObservationVideo = (
  actor: CareTeamActor,
  createdByUserId?: string,
) => canUseClinicalTools(actor) || createdByUserId === actor.userId;
const observationVideoResponse = (
  observation: {
    id: number;
    childId: number;
    body: string;
    context: string;
    createdAt: Date | string;
    videoObjectPath?: string | null;
    videoContentType?: string | null;
    videoSizeBytes?: number | null;
    videoConsentConfirmedAt?: Date | string | null;
  },
  actor: CareTeamActor,
  createdByUserId?: string,
) => {
  const videoVisible =
    canViewObservationVideo(actor, createdByUserId) &&
    Boolean(
      observation.videoObjectPath &&
      observation.videoContentType &&
      observation.videoSizeBytes &&
      observation.videoConsentConfirmedAt,
    );
  return {
    id: observation.id,
    childId: observation.childId,
    author: "Care team member",
    role: canUseClinicalTools(actor) ? "SLP" : actor.role,
    body: observation.body,
    context: observation.context,
    ...(videoVisible
      ? {
          video: {
            url: `/api/observations/${observation.id}/video`,
            contentType: observation.videoContentType,
            sizeBytes: observation.videoSizeBytes,
            consentConfirmedAt: new Date(
              observation.videoConsentConfirmedAt!,
            ).toISOString(),
          },
        }
      : {}),
    createdAt: new Date(observation.createdAt).toISOString(),
  };
};
const validObservationVideoConsent = (value: string | Date) => {
  const confirmedAt = new Date(value);
  return !Number.isNaN(confirmedAt.getTime()) &&
    confirmedAt.getTime() <= Date.now() + 5 * 60 * 1000
    ? confirmedAt
    : null;
};
const purgeObservationVideoObjects = async () => {
  const now = new Date();
  const expiredUploads = await db
    .select()
    .from(observationVideoUploadsTable)
    .where(
      and(
        or(
          eq(observationVideoUploadsTable.status, "reserved"),
          eq(observationVideoUploadsTable.status, "finalizing"),
          eq(observationVideoUploadsTable.status, "failed"),
        ),
        or(
          eq(observationVideoUploadsTable.status, "failed"),
          lt(observationVideoUploadsTable.expiresAt, now),
        ),
      ),
    );
  for (const upload of expiredUploads) {
    await recordingObjectStorage.delete(upload.stagingObjectPath);
    if (upload.finalObjectPath)
      await recordingObjectStorage.delete(upload.finalObjectPath);
    await db
      .update(observationVideoUploadsTable)
      .set({ status: "expired", deletedAt: now, updatedAt: now })
      .where(eq(observationVideoUploadsTable.id, upload.id));
  }

  const retentionSettings = await db
    .select()
    .from(retentionSettingsTable)
    .where(eq(retentionSettingsTable.scope, "organization"));
  const retainedUploads = await db
    .select()
    .from(observationVideoUploadsTable)
    .where(eq(observationVideoUploadsTable.status, "attached"));
  for (const upload of retainedUploads) {
    const retentionDays =
      retentionSettings.find(
        (settings) => settings.organizationId === upload.organizationId,
      )?.observationVideoRetentionDays ?? 365;
    const cutoff = new Date(
      now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
    );
    if (!upload.attachedAt || upload.attachedAt >= cutoff) continue;
    if (upload.finalObjectPath)
      await recordingObjectStorage.delete(upload.finalObjectPath);
    await db.transaction(async (tx) => {
      if (upload.observationId) {
        await tx
          .update(clinicalObservationsTable)
          .set({
            videoObjectPath: null,
            videoContentType: null,
            videoSizeBytes: null,
            videoConsentConfirmedAt: null,
            videoConsentConfirmedByUserId: null,
          })
          .where(eq(clinicalObservationsTable.id, upload.observationId));
      }
      await tx
        .update(observationVideoUploadsTable)
        .set({
          status: "deleted",
          finalObjectPath: null,
          deletedAt: now,
          updatedAt: now,
        })
        .where(eq(observationVideoUploadsTable.id, upload.id));
    });
  }
};
setInterval(() => {
  void purgeObservationVideoObjects().catch((error) => {
    logger.error(
      { err: error },
      "Could not complete observation video retention cleanup",
    );
  });
}, OBSERVATION_VIDEO_CLEANUP_INTERVAL_MS).unref();
void purgeObservationVideoObjects().catch((error) => {
  logger.error(
    { err: error },
    "Could not start observation video retention cleanup",
  );
});
const SESSION_AUDIO_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const purgeSessionAudioObjects = async () => {
  const now = new Date();
  const staleCalibrationCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleCalibrations = await db
    .select()
    .from(sessionAudioObjectsTable)
    .where(
      and(
        eq(sessionAudioObjectsTable.purpose, "speaker_calibration"),
        isNull(sessionAudioObjectsTable.sessionId),
        isNull(sessionAudioObjectsTable.deletedAt),
        or(
          eq(sessionAudioObjectsTable.status, "staged"),
          eq(sessionAudioObjectsTable.status, "ready"),
        ),
        lt(sessionAudioObjectsTable.createdAt, staleCalibrationCutoff),
      ),
    );
  for (const calibration of staleCalibrations) {
    await persistedAudioObjectStore(calibration).delete(calibration.objectKey);
    await db
      .update(sessionAudioObjectsTable)
      .set({ status: "deleted", deletedAt: now })
      .where(eq(sessionAudioObjectsTable.id, calibration.id));
  }

  const retentionSettings = await db
    .select()
    .from(retentionSettingsTable)
    .where(eq(retentionSettingsTable.scope, "organization"));
  const attachedAudio = await db
    .select()
    .from(sessionAudioObjectsTable)
    .where(
      and(
        eq(sessionAudioObjectsTable.status, "attached"),
        isNull(sessionAudioObjectsTable.deletedAt),
      ),
    );
  for (const audio of attachedAudio) {
    const retentionDays =
      retentionSettings.find(
        (settings) => settings.organizationId === audio.organizationId,
      )?.audioRetentionDays ?? 365;
    const cutoff = new Date(
      now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
    );
    if (audio.createdAt >= cutoff) continue;
    await persistedAudioObjectStore(audio).delete(audio.objectKey);
    await db
      .update(sessionAudioObjectsTable)
      .set({ status: "deleted", deletedAt: now })
      .where(eq(sessionAudioObjectsTable.id, audio.id));
  }
};
setInterval(() => {
  void purgeSessionAudioObjects().catch((error) => {
    logger.error(
      { err: error },
      "Could not complete session audio retention cleanup",
    );
  });
}, SESSION_AUDIO_CLEANUP_INTERVAL_MS).unref();
void purgeSessionAudioObjects().catch((error) => {
  logger.error(
    { err: error },
    "Could not start session audio retention cleanup",
  );
});
const DOCUMENTATION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const purgeExpiredDocumentationDrafts = async () => {
  const cutoff = new Date();
  await db.transaction(async (transaction) => {
    const documents = await transaction
      .select({
        id: clinicalDocumentationTable.id,
        childId: clinicalDocumentationTable.childId,
        sourceSessionId: clinicalDocumentationTable.sourceSessionId,
      })
      .from(clinicalDocumentationTable)
      .where(
        and(
          eq(clinicalDocumentationTable.status, "recently_deleted"),
          lt(clinicalDocumentationTable.purgeAfter, cutoff),
        ),
      )
      .for("update");
    const soapNotes = await transaction
      .select({
        id: clinicalSoapNotesTable.id,
        childId: clinicalSoapNotesTable.childId,
        sessionId: clinicalSoapNotesTable.sessionId,
      })
      .from(clinicalSoapNotesTable)
      .where(
        and(
          eq(clinicalSoapNotesTable.status, "recently_deleted"),
          lt(clinicalSoapNotesTable.purgeAfter, cutoff),
        ),
      )
      .for("update");
    if (documents.length || soapNotes.length) {
      await transaction.insert(securityAuditLogsTable).values([
        ...documents.map((document) => ({
          userId: "system",
          actorName: "EchoMap retention",
          actorRole: "System",
          action: "CLINICAL_DOCUMENTATION_PERMANENTLY_PURGED",
          targetType: "clinical_documentation",
          targetId: String(document.id),
          childId: document.childId,
          outcome: "success",
          metadata: safeAuditMetadata({
            noteType: "document",
            sourceSessionId: document.sourceSessionId,
            retentionDays: 30,
          }),
          occurredAt: cutoff,
        })),
        ...soapNotes.map((note) => ({
          userId: "system",
          actorName: "EchoMap retention",
          actorRole: "System",
          action: "CLINICAL_DOCUMENTATION_PERMANENTLY_PURGED",
          targetType: "clinical_soap_note",
          targetId: String(note.id),
          childId: note.childId,
          outcome: "success",
          metadata: safeAuditMetadata({
            noteType: "soap_note",
            sourceSessionId: note.sessionId,
            retentionDays: 30,
          }),
          occurredAt: cutoff,
        })),
      ]);
    }
    if (documents.length) {
      await transaction.delete(clinicalDocumentationTable).where(
        inArray(
          clinicalDocumentationTable.id,
          documents.map((document) => document.id),
        ),
      );
    }
    if (soapNotes.length) {
      await transaction.delete(clinicalSoapNotesTable).where(
        inArray(
          clinicalSoapNotesTable.id,
          soapNotes.map((note) => note.id),
        ),
      );
    }
  });
};
setInterval(() => {
  void purgeExpiredDocumentationDrafts().catch((error) => {
    logger.error(
      { err: error },
      "Could not complete deleted documentation cleanup",
    );
  });
}, DOCUMENTATION_CLEANUP_INTERVAL_MS).unref();
void purgeExpiredDocumentationDrafts().catch((error) => {
  logger.error({ err: error }, "Could not start deleted documentation cleanup");
});
type DeletionCategory =
  "profile" | "observations" | "transcripts" | "consent_records" | "recordings";
const deletionCategories = new Set<DeletionCategory>([
  "profile",
  "observations",
  "transcripts",
  "consent_records",
  "recordings",
]);
const deletionRequestResponse = (
  request: typeof deletionRequestsTable.$inferSelect,
) => ({
  id: request.id,
  childId: request.childId,
  requesterUserId: request.requesterUserId,
  requesterName: request.requesterName,
  requesterRole: request.requesterRole,
  categories: request.categories as DeletionCategory[],
  reason: request.reason,
  status: request.status,
  reviewedAt: request.reviewedAt?.toISOString() ?? null,
  reviewedByName: request.reviewedByName,
  reviewNote: request.reviewNote,
  processedAt: request.processedAt?.toISOString() ?? null,
  processedCategories: request.processedCategories as DeletionCategory[],
  retainedCategories: request.retainedCategories as DeletionCategory[],
  retentionNote: request.retentionNote,
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString(),
});
const deletionRequestDetail = async (
  request: typeof deletionRequestsTable.$inferSelect,
) => ({
  ...deletionRequestResponse(request),
  audit: (
    await db
      .select()
      .from(deletionRequestAuditEventsTable)
      .where(eq(deletionRequestAuditEventsTable.requestId, request.id))
      .orderBy(deletionRequestAuditEventsTable.createdAt)
  ).map((event) => ({
    id: event.id,
    action: event.action,
    actorUserId: event.actorUserId,
    actorName: event.actorName,
    actorRole: event.actorRole,
    note: event.note,
    createdAt: event.createdAt.toISOString(),
  })),
});
const canViewDeletionRequest = (
  req: Request,
  request: typeof deletionRequestsTable.$inferSelect,
) => {
  const actor = viewerFrom(req);
  return actor &&
    actor.childIds.includes(request.childId) &&
    (actor.role === "SLP" || actor.userId === request.requesterUserId)
    ? actor
    : null;
};
const processDeletion = async (
  request: typeof deletionRequestsTable.$inferSelect,
) => {
  const selected = new Set(
    request.categories.filter((value): value is DeletionCategory =>
      deletionCategories.has(value as DeletionCategory),
    ),
  );
  await ensureSessionStore();
  if (selected.has("transcripts"))
    await db.transaction(async (tx) => {
      await deleteTranscriptDataForChild(tx, request.childId);
    });
  if (selected.has("observations")) {
    const persistedObservationVideos = await db
      .select({
        objectPath: clinicalObservationsTable.videoObjectPath,
      })
      .from(clinicalObservationsTable)
      .where(eq(clinicalObservationsTable.childId, request.childId));
    const reservedObservationVideos = await db
      .select({
        stagingObjectPath: observationVideoUploadsTable.stagingObjectPath,
        finalObjectPath: observationVideoUploadsTable.finalObjectPath,
      })
      .from(observationVideoUploadsTable)
      .where(eq(observationVideoUploadsTable.childId, request.childId));
    const observationVideoPaths = new Set([
      ...persistedObservationVideos
        .map((item) => item.objectPath)
        .filter((objectPath): objectPath is string => Boolean(objectPath)),
      ...reservedObservationVideos
        .flatMap((item) => [item.stagingObjectPath, item.finalObjectPath])
        .filter((objectPath): objectPath is string => Boolean(objectPath)),
    ]);
    const deletedVideos = await Promise.allSettled(
      [...observationVideoPaths].map((objectPath) =>
        recordingObjectStorage.delete(objectPath),
      ),
    );
    if (deletedVideos.some((result) => result.status === "rejected")) {
      throw new Error(
        "One or more private observation videos could not be deleted.",
      );
    }
    const developmentVideos = observations
      .filter((item) => item.childId === request.childId)
      .map((item) => item.video?.objectPath)
      .filter((objectPath): objectPath is string => Boolean(objectPath));
    const deletedDevelopmentVideos = await Promise.allSettled(
      developmentVideos.map((objectPath) =>
        recordingObjectStorage.delete(objectPath),
      ),
    );
    if (
      deletedDevelopmentVideos.some((result) => result.status === "rejected")
    ) {
      throw new Error(
        "One or more private observation videos could not be deleted.",
      );
    }
    await db
      .delete(observationVideoUploadsTable)
      .where(eq(observationVideoUploadsTable.childId, request.childId));
    await db
      .delete(clinicalObservationsTable)
      .where(eq(clinicalObservationsTable.childId, request.childId));
    await db
      .delete(legacyPhraseObservationRecoveriesTable)
      .where(
        eq(legacyPhraseObservationRecoveriesTable.childId, request.childId),
      );
    await db
      .delete(phraseObservationsTable)
      .where(eq(phraseObservationsTable.childId, request.childId));
    await db
      .delete(gestaltOccurrencesTable)
      .where(eq(gestaltOccurrencesTable.childId, request.childId));
    gestalts.splice(
      0,
      gestalts.length,
      ...gestalts.filter((item) => item.childId !== request.childId),
    );
    observations.splice(
      0,
      observations.length,
      ...observations.filter((item) => item.childId !== request.childId),
    );
    sessionStore.sessions = sessionStore.sessions.filter(
      (item) => item.childId !== request.childId,
    );
  }
  if (selected.has("recordings")) {
    const persistedAudio = await db
      .select()
      .from(sessionAudioObjectsTable)
      .where(
        and(
          eq(sessionAudioObjectsTable.childId, request.childId),
          isNull(sessionAudioObjectsTable.deletedAt),
        ),
      );
    const deleted = await Promise.allSettled(
      persistedAudio.map((item) =>
        persistedAudioObjectStore(item).delete(item.objectKey),
      ),
    );
    if (deleted.some((result) => result.status === "rejected")) {
      throw new Error(
        "One or more private recording objects could not be deleted.",
      );
    }
    if (persistedAudio.length) {
      await db
        .update(sessionAudioObjectsTable)
        .set({ deletedAt: new Date() })
        .where(
          inArray(
            sessionAudioObjectsTable.id,
            persistedAudio.map((item) => item.id),
          ),
        );
    }
    const audio = sessionStore.audio.filter(
      (item) => item.childId === request.childId,
    );
    await Promise.all(
      audio.map((item) => audioObjectStore.delete(item.fileName)),
    );
    const ids = new Set(audio.map((item) => item.id));
    sessionStore.audio = sessionStore.audio.filter(
      (item) => item.childId !== request.childId,
    );
    sessionStore.sessions = sessionStore.sessions.map((item) =>
      item.childId === request.childId && item.audioId && ids.has(item.audioId)
        ? { ...item, audioId: null, audioUrl: null }
        : item,
    );
  }
  if (selected.has("profile"))
    children.splice(
      0,
      children.length,
      ...children.filter((item) => item.id !== request.childId),
    );
  if (selected.has("observations") || selected.has("recordings"))
    await saveSessionStore();
  const processedCategories = [...selected].filter(
    (item) => item !== "consent_records",
  );
  const retainedCategories = selected.has("consent_records")
    ? ["consent_records"]
    : [];
  return {
    processedCategories,
    retainedCategories,
    retentionNote: retainedCategories.length
      ? "Consent confirmations and deletion-request audit events are immutable accountability records and remain retained."
      : "Deletion-request audit events are immutable accountability records and remain retained.",
  };
};

const ensureOccurrenceIndex = async (
  childId: number,
  gestaltsForChild: Gestalt[],
) => {
  const currentRows = await db
    .select()
    .from(gestaltOccurrencesTable)
    .where(eq(gestaltOccurrencesTable.childId, childId));
  const rowsByCanonicalKey = new Map<
    string,
    (typeof gestaltOccurrencesTable.$inferSelect)[]
  >();
  for (const row of currentRows) {
    const key = matchPhraseKey(row.normalizedPhrase);
    rowsByCanonicalKey.set(key, [...(rowsByCanonicalKey.get(key) ?? []), row]);
  }
  for (const [canonicalKey, rows] of rowsByCanonicalKey) {
    if (rows.length === 1 && rows[0]?.normalizedPhrase === canonicalKey) {
      continue;
    }
    const canonical =
      rows.find((row) => row.normalizedPhrase === canonicalKey) ??
      [...rows].sort(
        (left, right) => right.occurrenceCount - left.occurrenceCount,
      )[0];
    if (!canonical) continue;
    const duplicateIds = rows
      .filter((row) => row.id !== canonical.id)
      .map((row) => row.id);
    const mergedCount = Math.max(...rows.map((row) => row.occurrenceCount));
    const mergedLastSeen =
      rows
        .map((row) => row.lastSeenAt)
        .filter((value): value is Date => value instanceof Date)
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
    await db.transaction(async (transaction) => {
      if (duplicateIds.length) {
        await transaction
          .delete(gestaltOccurrencesTable)
          .where(inArray(gestaltOccurrencesTable.id, duplicateIds));
      }
      await transaction
        .update(gestaltOccurrencesTable)
        .set({
          normalizedPhrase: canonicalKey,
          occurrenceCount: mergedCount,
          lastSeenAt: mergedLastSeen,
          updatedAt: new Date(),
        })
        .where(eq(gestaltOccurrencesTable.id, canonical.id));
    });
  }

  const grouped = new Map<string, Gestalt[]>();
  for (const gestalt of gestaltsForChild) {
    const canonicalKey = matchPhraseKey(gestalt.phrase);
    if (!canonicalKey) continue;
    grouped.set(canonicalKey, [...(grouped.get(canonicalKey) ?? []), gestalt]);
  }

  for (const [canonicalKey, matching] of grouped) {
    const latest = [...matching].sort(
      (left, right) => Date.parse(right.dateAdded) - Date.parse(left.dateAdded),
    )[0];
    if (!latest) continue;
    const latestDate = new Date(latest.dateAdded);
    await db
      .insert(gestaltOccurrencesTable)
      .values({
        childId,
        gestaltId: latest.id,
        phrase: latest.phrase,
        normalizedPhrase: canonicalKey,
        occurrenceCount: matching.length,
        lastSeenAt: Number.isNaN(latestDate.getTime()) ? null : latestDate,
      })
      .onConflictDoUpdate({
        target: [
          gestaltOccurrencesTable.childId,
          gestaltOccurrencesTable.normalizedPhrase,
        ],
        set: {
          gestaltId: latest.id,
          phrase: latest.phrase,
          occurrenceCount: sql`greatest(${gestaltOccurrencesTable.occurrenceCount}, ${matching.length})`,
          lastSeenAt: sql`greatest(${gestaltOccurrencesTable.lastSeenAt}, ${Number.isNaN(latestDate.getTime()) ? null : latestDate})`,
          updatedAt: new Date(),
        },
      });
  }

  return db
    .select()
    .from(gestaltOccurrencesTable)
    .where(eq(gestaltOccurrencesTable.childId, childId));
};

type FrequentScriptWindow = "all" | "30d" | "7d";
type FrequentScriptEvidence = {
  phraseId: number;
  phraseKey: string;
  count: number;
  observedAt: Date;
  sessionId: number | null;
  context?: string | null;
  communicationFunction?: string | null;
  contributor?: string | null;
};

const frequentScriptsFor = async (
  organizationId: number,
  childId: number,
  window: FrequentScriptWindow,
) => {
  const [[profile], activeGestalts, sessionRows, phraseObservationRows] =
    await Promise.all([
      db
        .select()
        .from(childProfilesTable)
        .where(
          and(
            eq(childProfilesTable.id, childId),
            eq(childProfilesTable.organizationId, organizationId),
            isNull(childProfilesTable.archivedAt),
          ),
        )
        .limit(1),
      db
        .select()
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.organizationId, organizationId),
            eq(clinicalGestaltsTable.childId, childId),
            isNull(clinicalGestaltsTable.archivedAt),
          ),
        ),
      db
        .select()
        .from(therapySessionsTable)
        .where(
          and(
            eq(therapySessionsTable.organizationId, organizationId),
            eq(therapySessionsTable.childId, childId),
            isNull(therapySessionsTable.archivedAt),
          ),
        ),
      db
        .select()
        .from(phraseObservationsTable)
        .where(
          and(
            eq(phraseObservationsTable.organizationId, organizationId),
            eq(phraseObservationsTable.childId, childId),
          ),
        ),
    ]);
  if (!profile) return null;

  // Frequent Scripts is clinical evidence. An observation logged by the care
  // team stays out until its canonical phrase has a clinician-reviewed meaning
  // and function.
  const reviewedGestalts = activeGestalts.filter(isClinicallyReviewedGestalt);
  const activeById = new Map(
    reviewedGestalts.map((gestalt) => [gestalt.id, gestalt]),
  );
  const activeByKey = new Map<
    string,
    typeof clinicalGestaltsTable.$inferSelect
  >();
  for (const gestalt of reviewedGestalts) {
    const key = matchPhraseKey(gestalt.normalizedPhrase);
    const current = activeByKey.get(key);
    if (
      !current ||
      gestalt.createdAt < current.createdAt ||
      (gestalt.createdAt.getTime() === current.createdAt.getTime() &&
        gestalt.id < current.id)
    ) {
      activeByKey.set(key, gestalt);
    }
  }
  const sessionIds = sessionRows.map((session) => session.id);
  const reviewedPhrases = sessionIds.length
    ? await db
        .select()
        .from(therapySessionGestaltsTable)
        .where(inArray(therapySessionGestaltsTable.sessionId, sessionIds))
    : [];
  const transcriptPhraseIds = reviewedPhrases
    .map((phrase) => phrase.transcriptPhraseId)
    .filter((id): id is number => typeof id === "number");
  const transcriptPhrases = transcriptPhraseIds.length
    ? await db
        .select()
        .from(transcriptPhrasesTable)
        .where(inArray(transcriptPhrasesTable.id, transcriptPhraseIds))
    : [];
  const userIds = [
    ...new Set(sessionRows.map((session) => session.createdByUserId)),
  ];
  const sessionAuthors = userIds.length
    ? await db
        .select({ id: usersTable.id, displayName: usersTable.displayName })
        .from(usersTable)
        .where(inArray(usersTable.id, userIds))
    : [];
  const sessionById = new Map(
    sessionRows.map((session) => [session.id, session]),
  );
  const frequencyByTranscriptPhrase = new Map(
    transcriptPhrases.map((phrase) => [phrase.id, phrase.frequency]),
  );
  const authorById = new Map(
    sessionAuthors.map((author) => [author.id, author.displayName]),
  );
  const evidence: FrequentScriptEvidence[] = [];

  for (const phrase of childAttributedOnly(reviewedPhrases)) {
    const canonical =
      (phrase.gestaltId ? activeById.get(phrase.gestaltId) : undefined) ??
      activeByKey.get(matchPhraseKey(phrase.phrase));
    if (!canonical) continue;
    const session = sessionById.get(phrase.sessionId);
    if (!session) continue;
    evidence.push({
      phraseId: canonical.id,
      phraseKey: matchPhraseKey(canonical.normalizedPhrase),
      count:
        frequencyByTranscriptPhrase.get(phrase.transcriptPhraseId ?? -1) ?? 1,
      observedAt: session.createdAt,
      sessionId: session.id,
      context: phrase.context,
      communicationFunction: phrase.communicationFunction,
      contributor:
        authorById.get(session.createdByUserId) ?? "Care team clinician",
    });
  }

  for (const observation of phraseObservationRows) {
    const canonical = activeById.get(observation.gestaltId);
    if (!canonical) continue;
    evidence.push({
      phraseId: canonical.id,
      phraseKey: matchPhraseKey(canonical.normalizedPhrase),
      count: 1,
      observedAt: observation.observedAt,
      sessionId: null,
      context: observation.context,
      communicationFunction: observation.communicationFunction,
      contributor: observation.authorName,
    });
  }

  const nowDate = new Date();
  const cutoff =
    window === "all"
      ? null
      : new Date(
          nowDate.getTime() - (window === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000,
        );
  const grouped = new Map<string, FrequentScriptEvidence[]>();
  for (const item of evidence) {
    if (cutoff && item.observedAt < cutoff) continue;
    grouped.set(item.phraseKey, [...(grouped.get(item.phraseKey) ?? []), item]);
  }
  const phrases = [...grouped.entries()]
    .flatMap(([phraseKey, items]) => {
      const canonical = activeByKey.get(phraseKey);
      if (!canonical || !items.length) return [];
      const orderedDates = items
        .map((item) => item.observedAt)
        .sort((a, b) => a.getTime() - b.getTime());
      return [
        {
          id: canonical.id,
          phrase: canonical.phrase,
          meaning: canonical.meaning,
          observations: items.reduce((total, item) => total + item.count, 0),
          firstObservedAt: orderedDates[0]!.toISOString(),
          lastObservedAt: orderedDates.at(-1)!.toISOString(),
          communicationFunctions: [
            ...new Set(
              [
                canonical.communicationFunction,
                ...items.map((item) => item.communicationFunction),
              ]
                .map((value) => value?.trim())
                .filter((value): value is string =>
                  Boolean(value && value !== "Not yet reviewed"),
                ),
            ),
          ].slice(0, 6),
          contexts: [
            ...new Set(
              [...canonical.contexts, ...items.map((item) => item.context)]
                .map((value) => value?.trim())
                .filter((value): value is string => Boolean(value)),
            ),
          ].slice(0, 8),
          contributors: [
            ...new Set(
              items
                .map((item) => item.contributor?.trim())
                .filter((value): value is string => Boolean(value)),
            ),
          ].slice(0, 8),
        },
      ];
    })
    .sort(
      (left, right) =>
        right.observations - left.observations ||
        Date.parse(right.lastObservedAt) - Date.parse(left.lastObservedAt) ||
        left.phrase.localeCompare(right.phrase),
    )
    .map((phrase, index) => ({
      ...phrase,
      frequencyRank: index + 1,
    }));

  return {
    childId,
    window,
    reviewedDictionaryPhraseCount: reviewedGestalts.length,
    totalObservations: phrases.reduce(
      (total, phrase) => total + phrase.observations,
      0,
    ),
    phrases,
    generatedAt: nowDate.toISOString(),
  };
};

const recurringLanguagePatternsFor = async (
  organizationId: number,
  childId: number,
  window: FrequentScriptWindow,
) => {
  const [[profile], activeGestalts, sessionRows, phraseObservationRows] =
    await Promise.all([
      db
        .select()
        .from(childProfilesTable)
        .where(
          and(
            eq(childProfilesTable.id, childId),
            eq(childProfilesTable.organizationId, organizationId),
            isNull(childProfilesTable.archivedAt),
          ),
        )
        .limit(1),
      db
        .select()
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.organizationId, organizationId),
            eq(clinicalGestaltsTable.childId, childId),
            isNull(clinicalGestaltsTable.archivedAt),
          ),
        ),
      db
        .select()
        .from(therapySessionsTable)
        .where(
          and(
            eq(therapySessionsTable.organizationId, organizationId),
            eq(therapySessionsTable.childId, childId),
            isNull(therapySessionsTable.archivedAt),
          ),
        ),
      db
        .select()
        .from(phraseObservationsTable)
        .where(
          and(
            eq(phraseObservationsTable.organizationId, organizationId),
            eq(phraseObservationsTable.childId, childId),
          ),
        ),
    ]);
  if (!profile) return null;

  const reviewedGestalts = activeGestalts.filter(isClinicallyReviewedGestalt);
  const activeById = new Map(
    reviewedGestalts.map((gestalt) => [gestalt.id, gestalt]),
  );
  const activeByKey = new Map<
    string,
    typeof clinicalGestaltsTable.$inferSelect
  >();
  for (const gestalt of reviewedGestalts) {
    const key = matchPhraseKey(gestalt.normalizedPhrase);
    const current = activeByKey.get(key);
    if (
      !current ||
      gestalt.createdAt < current.createdAt ||
      (gestalt.createdAt.getTime() === current.createdAt.getTime() &&
        gestalt.id < current.id)
    ) {
      activeByKey.set(key, gestalt);
    }
  }

  const sessionIds = sessionRows.map((session) => session.id);
  const reviewedPhrases = sessionIds.length
    ? await db
        .select()
        .from(therapySessionGestaltsTable)
        .where(inArray(therapySessionGestaltsTable.sessionId, sessionIds))
    : [];
  const transcriptPhraseIds = reviewedPhrases
    .map((phrase) => phrase.transcriptPhraseId)
    .filter((id): id is number => typeof id === "number");
  const transcriptPhrases = transcriptPhraseIds.length
    ? await db
        .select()
        .from(transcriptPhrasesTable)
        .where(inArray(transcriptPhrasesTable.id, transcriptPhraseIds))
    : [];
  const frequencyByTranscriptPhrase = new Map(
    transcriptPhrases.map((phrase) => [phrase.id, phrase.frequency]),
  );
  const sessionById = new Map(
    sessionRows.map((session) => [session.id, session]),
  );
  const evidence: RecurringPatternEvidence[] = [];

  for (const phrase of childAttributedOnly(reviewedPhrases)) {
    const canonical =
      (phrase.gestaltId ? activeById.get(phrase.gestaltId) : undefined) ??
      activeByKey.get(matchPhraseKey(phrase.phrase));
    const session = sessionById.get(phrase.sessionId);
    if (!canonical || !session) continue;
    evidence.push({
      phraseId: canonical.id,
      phrase: canonical.phrase,
      phraseKey: matchPhraseKey(canonical.normalizedPhrase),
      count:
        frequencyByTranscriptPhrase.get(phrase.transcriptPhraseId ?? -1) ?? 1,
      observedAt: session.createdAt,
      settings: phrase.context.trim() ? [phrase.context] : [],
      sessionId: session.id,
      communicationFunction: phrase.communicationFunction,
      evidenceType: "session",
    });
  }

  for (const observation of phraseObservationRows) {
    const canonical = activeById.get(observation.gestaltId);
    if (!canonical) continue;
    evidence.push({
      phraseId: canonical.id,
      phrase: canonical.phrase,
      phraseKey: matchPhraseKey(canonical.normalizedPhrase),
      count: 1,
      observedAt: observation.observedAt,
      settings: observation.context.trim() ? [observation.context] : [],
      sessionId: null,
      communicationFunction: observation.communicationFunction,
      evidenceType: "observation",
    });
  }

  const nowDate = new Date();
  const filteredEvidence = filterRecurringPatternEvidence(
    evidence,
    window,
    nowDate,
  );
  const observedPhraseKeys = new Set(
    filteredEvidence.map((item) => item.phraseKey),
  );
  const dictionaryFallbackEvidence = filterRecurringPatternEvidence(
    [...activeByKey.entries()].map(
      ([phraseKey, gestalt]): RecurringPatternEvidence => ({
        phraseId: gestalt.id,
        phrase: gestalt.phrase,
        phraseKey,
        count: 1,
        observedAt: gestalt.createdAt,
        settings: gestalt.contexts,
        sessionId: null,
        communicationFunction: gestalt.communicationFunction,
        evidenceType: "dictionary",
      }),
    ),
    window,
    nowDate,
  ).filter((item) => !observedPhraseKeys.has(item.phraseKey));
  const { summaries, details } = buildRecurringLanguagePatterns([
    ...filteredEvidence,
    ...dictionaryFallbackEvidence,
  ]);
  return {
    childId,
    window,
    totalPatterns: summaries.length,
    patterns: summaries,
    details,
    generatedAt: nowDate.toISOString(),
  };
};

const dictionaryInsightsFor = async (
  organizationId: number,
  childId: number,
  actor: CareTeamActor,
) => {
  const [[profile], gestaltRecords, occurrenceRows, sessionRows] =
    await Promise.all([
      db
        .select()
        .from(childProfilesTable)
        .where(
          and(
            eq(childProfilesTable.id, childId),
            eq(childProfilesTable.organizationId, organizationId),
            isNull(childProfilesTable.archivedAt),
          ),
        )
        .limit(1),
      db
        .select()
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.organizationId, organizationId),
            eq(clinicalGestaltsTable.childId, childId),
            isNull(clinicalGestaltsTable.archivedAt),
          ),
        )
        .orderBy(desc(clinicalGestaltsTable.updatedAt)),
      db
        .select()
        .from(gestaltOccurrencesTable)
        .where(eq(gestaltOccurrencesTable.childId, childId)),
      db
        .select()
        .from(therapySessionsTable)
        .where(
          and(
            eq(therapySessionsTable.organizationId, organizationId),
            eq(therapySessionsTable.childId, childId),
            isNull(therapySessionsTable.archivedAt),
          ),
        )
        .orderBy(desc(therapySessionsTable.createdAt)),
    ]);
  if (!profile) return null;
  const canViewClinicalWorkspace = canUseClinicalTools(actor);
  const entries = canViewClinicalWorkspace
    ? await gestaltsWithCollaboration(gestaltRecords)
    : gestaltRecords.map(roleSafeGestalt);
  const sessionIds = canViewClinicalWorkspace
    ? sessionRows.map((session) => session.id)
    : [];
  const sessionPhrases = sessionIds.length
    ? await db
        .select()
        .from(therapySessionGestaltsTable)
        .where(inArray(therapySessionGestaltsTable.sessionId, sessionIds))
    : [];
  const occurrenceByKey = new Map(
    occurrenceRows.map((row) => [matchPhraseKey(row.normalizedPhrase), row]),
  );
  const evidenceByKey = new Map<string, typeof sessionPhrases>();
  for (const phrase of sessionPhrases) {
    const key = matchPhraseKey(phrase.phrase);
    evidenceByKey.set(key, [...(evidenceByKey.get(key) ?? []), phrase]);
  }
  return {
    child: childResponseForActor(profile, actor, entries.length),
    childId,
    entries: entries
      .map((gestalt) => {
        const key = matchPhraseKey(gestalt.phrase);
        const occurrence = occurrenceByKey.get(key);
        const evidence = evidenceByKey.get(key) ?? [];
        return {
          gestalt,
          occurrences: occurrence?.occurrenceCount ?? 0,
          lastSeen: occurrence?.lastSeenAt?.toISOString() ?? null,
          recentContexts: canViewClinicalWorkspace
            ? [
                ...new Set(
                  evidence.map((item) => item.context).filter(Boolean),
                ),
              ].slice(0, 3)
            : gestalt.contexts.slice(0, 3),
          evidenceCount: canViewClinicalWorkspace ? evidence.length : 0,
        };
      })
      .sort(
        (left, right) =>
          right.occurrences - left.occurrences ||
          right.evidenceCount - left.evidenceCount,
      ),
    reviewedSessionCount: canViewClinicalWorkspace ? sessionRows.length : 0,
    generatedAt: now(),
  };
};

const classroomResponseSuggestions = (communicationFunction?: string) => {
  const normalized = communicationFunction?.toLocaleLowerCase() ?? "";
  if (normalized.includes("request") || normalized.includes("help")) {
    return [
      "Acknowledge the message, then offer one simple choice.",
      "Model a short response without asking for repetition.",
      "Pause and give the student time to respond.",
    ];
  }
  if (
    normalized.includes("regulat") ||
    normalized.includes("protest") ||
    normalized.includes("self")
  ) {
    return [
      "Acknowledge the message and lower the demand for a moment.",
      "Offer a quiet pause, a familiar support, or a simple choice.",
      "Stay nearby and give the student time before adding more language.",
    ];
  }
  if (
    normalized.includes("joy") ||
    normalized.includes("social") ||
    normalized.includes("comment")
  ) {
    return [
      "Join the moment by repeating or warmly acknowledging the phrase.",
      "Pause to see whether the student wants more connection or a turn.",
      "Build on the interest with one short, natural comment.",
    ];
  }
  return [
    "Acknowledge the phrase and the moment: “I hear you.”",
    "Pause and watch what the student does next.",
    "Offer a simple choice or a familiar support if it seems helpful.",
  ];
};

const classroomSafeDictionaryEntry = (
  record: typeof clinicalGestaltsTable.$inferSelect,
) => {
  const isExplicitlyReviewedForClassroom =
    record.source === "Clinician-reviewed classroom dictionary";
  const restrictedClinicalLanguage =
    /\b(ai|confidence|nla|stage|assessment|transcript|recording|audio|session note|clinical observation)\b/i;
  const safeText = (value: string) =>
    value.trim().length > 0 &&
    value.trim().length <= 500 &&
    !restrictedClinicalLanguage.test(value);
  if (
    !isExplicitlyReviewedForClassroom ||
    !safeText(record.meaning) ||
    record.contexts.some((context) => !safeText(context))
  ) {
    return null;
  }
  return {
    phrase: record.phrase,
    meaning: record.meaning.trim(),
    contexts: record.contexts.map((context) => context.trim()).filter(Boolean),
    communicationFunction: record.communicationFunction,
  };
};

const teacherCommunicationHelperFor = async (
  organizationId: number,
  childId: number,
  phrase: string,
) => {
  const [[profile], gestaltRecords, occurrenceRows, teamMessageRows] =
    await Promise.all([
      db
        .select()
        .from(childProfilesTable)
        .where(
          and(
            eq(childProfilesTable.id, childId),
            eq(childProfilesTable.organizationId, organizationId),
            isNull(childProfilesTable.archivedAt),
          ),
        )
        .limit(1),
      db
        .select()
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.organizationId, organizationId),
            eq(clinicalGestaltsTable.childId, childId),
            isNull(clinicalGestaltsTable.archivedAt),
          ),
        )
        .orderBy(desc(clinicalGestaltsTable.updatedAt)),
      db
        .select()
        .from(gestaltOccurrencesTable)
        .where(eq(gestaltOccurrencesTable.childId, childId)),
      db
        .select({
          senderRole: teamMessagesTable.senderRole,
          messageType: teamMessagesTable.messageType,
          body: teamMessagesTable.body,
          createdAt: teamMessagesTable.createdAt,
        })
        .from(teamMessagesTable)
        .where(
          and(
            eq(teamMessagesTable.organizationId, organizationId),
            eq(teamMessagesTable.childId, childId),
          ),
        )
        .orderBy(desc(teamMessagesTable.createdAt)),
    ]);
  if (!profile) return null;

  const phraseKey = matchPhraseKey(phrase);
  const matchesPhrase = (value: string) => {
    const candidateKey = matchPhraseKey(value);
    return Boolean(
      candidateKey &&
      (candidateKey === phraseKey ||
        candidateKey.includes(phraseKey) ||
        phraseKey.includes(candidateKey)),
    );
  };
  const matchingGestalts = gestaltRecords.flatMap((record) => {
    const safe = classroomSafeDictionaryEntry(record);
    return safe && matchesPhrase(safe.phrase) ? [{ record, safe }] : [];
  });
  const pendingMeaning = (value: string) =>
    value.toLocaleLowerCase().includes("awaiting clinician review");
  const exactReviewedDictionaryMatch = matchingGestalts.some(
    ({ safe }) =>
      matchPhraseKey(safe.phrase) === phraseKey &&
      !pendingMeaning(safe.meaning),
  );

  const meanings: Array<{
    text: string;
    source: "communication_dictionary" | "session_history";
  }> = [];
  const meaningKeys = new Set<string>();
  const addMeaning = (
    text: string,
    source: "communication_dictionary" | "session_history",
  ) => {
    const key = text.trim().toLocaleLowerCase();
    if (
      !key ||
      pendingMeaning(text) ||
      meaningKeys.has(key) ||
      meanings.length === 3
    )
      return;
    meaningKeys.add(key);
    meanings.push({ text: text.trim(), source });
  };
  matchingGestalts.forEach(({ safe }) =>
    addMeaning(safe.meaning, "communication_dictionary"),
  );

  const occurrenceByPhrase = new Map(
    occurrenceRows.map((record) => [
      matchPhraseKey(record.normalizedPhrase),
      record.occurrenceCount,
    ]),
  );
  const observedIn = [
    ...new Set(
      [...matchingGestalts.flatMap(({ safe }) => safe.contexts)]
        .map((context) => context.trim())
        .filter(Boolean),
    ),
  ].slice(0, 6);
  const sources = [
    ...(matchingGestalts.length ? ["communication_dictionary" as const] : []),
  ];
  const evidenceCount = matchingGestalts.reduce(
    (total, { safe }) =>
      total + (occurrenceByPhrase.get(matchPhraseKey(safe.phrase)) ?? 0),
    0,
  );
  const confidence =
    exactReviewedDictionaryMatch && evidenceCount >= 2
      ? "high"
      : meanings.length
        ? "moderate"
        : "low";
  const confidenceNote =
    confidence === "high"
      ? "This is supported by the shared dictionary and more than one recorded context."
      : confidence === "moderate"
        ? "This is a helpful starting point based on the shared communication map. Check today’s situation, too."
        : "There is not enough shared context yet to rely on one meaning. Treat this as a question for the team, not a conclusion.";
  const primaryFunction = matchingGestalts[0]?.safe.communicationFunction;
  const teamInsights = teamMessageRows
    .filter((message) => matchesPhrase(message.body))
    .slice(0, 5)
    .map((message) => ({
      authorRole: teamRoleLabel(message.senderRole),
      body:
        message.messageType === "question"
          ? "A team question is available in Team Communication."
          : message.messageType === "notification"
            ? "A clinician notification is available in Team Communication."
            : "A shared team note is available in Team Communication.",
      createdAt: message.createdAt,
    }));

  return {
    childId,
    phrase,
    found: Boolean(meanings.length),
    meanings,
    suggestedResponses: classroomResponseSuggestions(primaryFunction),
    observedIn,
    relatedInterests: childInterestEntries(profile)
      .filter((interest) => interest.status === "approved")
      .map((interest) => interest.interest)
      .slice(0, 6),
    teamInsights,
    confidence,
    confidenceNote,
    sources: teamInsights.length
      ? [...sources, "team_notes" as const]
      : sources,
  };
};

type SoapNoteContent = {
  subjective: string;
  objective: string;
  assessment: string;
  nlaObservations: string;
  gestaltTracking: string;
  plan: string;
  caregiverSummary: string;
};

const organizationKnowledgeCorpus = async (organizationId: number) => {
  const sources = await db
    .select()
    .from(clinicalKnowledgeSourcesTable)
    .where(
      and(
        eq(clinicalKnowledgeSourcesTable.organizationId, organizationId),
        eq(clinicalKnowledgeSourcesTable.status, "ready"),
        isNull(clinicalKnowledgeSourcesTable.archivedAt),
      ),
    );
  const versionIds = sources
    .map((source) => source.activeVersionId)
    .filter((id): id is number => id !== null);
  if (!versionIds.length) return [];
  const chunks = await db
    .select()
    .from(clinicalKnowledgeChunksTable)
    .where(inArray(clinicalKnowledgeChunksTable.sourceVersionId, versionIds));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return chunks.map((chunk) => ({
    ...chunk,
    sourceTitle: sourceById.get(chunk.sourceId)?.title ?? "Private source",
    text: textPlain(chunk.encryptedText) ?? "",
  }));
};

const retrieveOrganizationKnowledge = async (
  organizationId: number,
  query: string,
) =>
  retrieveRelevantKnowledge(
    query,
    await organizationKnowledgeCorpus(organizationId),
  );

const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const knownCommunicationFunction = (value: string) =>
  Boolean(value.trim()) &&
  !/^(unknown|not documented|n\/a)$/i.test(value.trim());
const INSIGHT_LEASE_MS = 60_000;
const MAX_INSIGHT_ATTEMPTS = 3;
const protectLegacySoapDrafts = () =>
  db.execute(sql`
  UPDATE ${clinicalSoapNotesTable}
  SET ${clinicalSoapNotesTable.clinicianEdited} = true
  WHERE ${clinicalSoapNotesTable.evidenceVersion} = 2
    AND ${clinicalSoapNotesTable.status} = 'draft'
    AND ${clinicalSoapNotesTable.engineVersion} IS NULL
    AND ${clinicalSoapNotesTable.clinicianEdited} = false
`);

type ClinicalInsightRunTrigger = {
  organizationId: number;
  childId: number;
  triggerSessionId: number;
  sourceRefreshVersionId?: number;
};

const clinicalInsightRunIdentity = ({
  organizationId,
  childId,
  triggerSessionId,
  sourceRefreshVersionId,
}: ClinicalInsightRunTrigger) => {
  // This stable trigger identity is available at the write boundary, before
  // source bootstrapping or evidence retrieval can fail. It makes a saved
  // reviewed session recoverable even if the worker is interrupted immediately.
  return {
    evidenceFingerprint: fingerprint({
      kind: "reviewed-session-trigger",
      childId,
      triggerSessionId,
      engineVersion: CLINICAL_INSIGHTS_ENGINE_VERSION,
    }),
    knowledgeFingerprint:
      sourceRefreshVersionId === undefined
        ? "ready-sources-at-session-save"
        : `ready-source-version:${sourceRefreshVersionId}`,
  };
};

const enqueueClinicalInsights = async ({
  actor,
  ...trigger
}: ClinicalInsightRunTrigger & { actor: CareTeamActor }) => {
  const { evidenceFingerprint, knowledgeFingerprint } =
    clinicalInsightRunIdentity(trigger);
  await db
    .insert(clinicalKnowledgeInsightRunsTable)
    .values({
      organizationId: trigger.organizationId,
      childId: trigger.childId,
      triggerSessionId: trigger.triggerSessionId,
      triggeredByUserId: actor.userId,
      evidenceFingerprint,
      knowledgeFingerprint,
      engineVersion: CLINICAL_INSIGHTS_ENGINE_VERSION,
    })
    .onConflictDoNothing();
  const [run] = await db
    .select()
    .from(clinicalKnowledgeInsightRunsTable)
    .where(
      and(
        eq(
          clinicalKnowledgeInsightRunsTable.organizationId,
          trigger.organizationId,
        ),
        eq(clinicalKnowledgeInsightRunsTable.childId, trigger.childId),
        eq(
          clinicalKnowledgeInsightRunsTable.evidenceFingerprint,
          evidenceFingerprint,
        ),
        eq(
          clinicalKnowledgeInsightRunsTable.knowledgeFingerprint,
          knowledgeFingerprint,
        ),
        eq(
          clinicalKnowledgeInsightRunsTable.engineVersion,
          CLINICAL_INSIGHTS_ENGINE_VERSION,
        ),
      ),
    )
    .limit(1);
  if (!run) throw new Error("Clinical insight run could not be queued.");
  return run.id;
};

/**
 * A durable, idempotent worker for reviewed Child evidence. It deliberately
 * receives only server-reviewed child phrases and private ready-source chunks;
 * no transcript text, audio, unassigned speakers, or provider diagnostics can
 * enter the engine.
 */
const runClinicalInsights = async ({
  actor,
  organizationId,
  childId,
  triggerSessionId,
  runId,
}: {
  actor: CareTeamActor;
  organizationId: number;
  childId: number;
  triggerSessionId: number;
  runId?: number;
}) => {
  const durableRunId =
    runId ??
    (await enqueueClinicalInsights({
      actor,
      organizationId,
      childId,
      triggerSessionId,
    }));
  const [run] = await db
    .select()
    .from(clinicalKnowledgeInsightRunsTable)
    .where(
      and(
        eq(clinicalKnowledgeInsightRunsTable.id, durableRunId),
        eq(clinicalKnowledgeInsightRunsTable.organizationId, organizationId),
        eq(clinicalKnowledgeInsightRunsTable.childId, childId),
      ),
    )
    .limit(1);
  if (!run) return;
  const [claimed] = await db
    .update(clinicalKnowledgeInsightRunsTable)
    .set({
      status: "running",
      attempt: sql`${clinicalKnowledgeInsightRunsTable.attempt} + 1`,
      failureCode: null,
      startedAt: new Date(),
      leaseExpiresAt: new Date(Date.now() + INSIGHT_LEASE_MS),
    })
    .where(
      and(
        eq(clinicalKnowledgeInsightRunsTable.id, run.id),
        lt(clinicalKnowledgeInsightRunsTable.attempt, MAX_INSIGHT_ATTEMPTS),
        or(
          inArray(clinicalKnowledgeInsightRunsTable.status, [
            "queued",
            "failed",
          ]),
          and(
            eq(clinicalKnowledgeInsightRunsTable.status, "running"),
            lt(clinicalKnowledgeInsightRunsTable.leaseExpiresAt, new Date()),
          ),
        ),
      ),
    )
    .returning();
  if (!claimed) return;
  const sessions = await db
    .select()
    .from(therapySessionsTable)
    .where(
      and(
        eq(therapySessionsTable.organizationId, organizationId),
        eq(therapySessionsTable.childId, childId),
        isNull(therapySessionsTable.archivedAt),
      ),
    );
  const sessionIds = sessions.map((session) => session.id);
  const phrases = sessionIds.length
    ? await db
        .select()
        .from(therapySessionGestaltsTable)
        .where(inArray(therapySessionGestaltsTable.sessionId, sessionIds))
    : [];
  const reviewed = childAttributedOnly(phrases);

  try {
    if (!reviewed.length) {
      await db
        .update(clinicalKnowledgeInsightRunsTable)
        .set({
          status: "complete",
          failureCode: "no_eligible_reviewed_evidence",
          completedAt: new Date(),
          leaseExpiresAt: null,
        })
        .where(eq(clinicalKnowledgeInsightRunsTable.id, claimed.id));
      return;
    }
    await ensurePackagedClinicalKnowledge(organizationId, actor.userId);
    const corpus = await organizationKnowledgeCorpus(organizationId);
    const evidenceFingerprint = fingerprint(
      reviewed.map((phrase) => ({
        id: phrase.id,
        sessionId: phrase.sessionId,
        phrase: phrase.phrase,
        function: phrase.communicationFunction,
        context: phrase.context,
      })),
    );
    const observations = await db
      .select()
      .from(clinicalObservationsTable)
      .where(
        and(
          eq(clinicalObservationsTable.organizationId, organizationId),
          eq(clinicalObservationsTable.childId, childId),
        ),
      );
    const evidence: ClinicalEvidence = {
      phrase: null,
      functions: [
        ...new Set(
          reviewed
            .map((phrase) => phrase.communicationFunction)
            .filter(knownCommunicationFunction),
        ),
      ],
      contexts: [
        ...new Set(reviewed.map((phrase) => phrase.context).filter(Boolean)),
      ],
      reviewedPhraseCount: reviewed.length,
      reviewedObservationCount: observations.length,
      sessionId: triggerSessionId,
    };
    const routed = routeInsightDrafts(
      buildKnowledgeInsightDrafts(evidence, corpus),
      evidence,
    );
    if (routed.length) {
      await db
        .insert(clinicalKnowledgeInsightsTable)
        .values(
          routed.map((draft) => ({
            organizationId,
            childId,
            sessionId: triggerSessionId,
            runId: claimed.id,
            category: draft.category,
            confidence: draft.confidence,
            disposition: draft.disposition,
            reviewReason: draft.reviewReason,
            alternatives: draft.alternatives,
            evidenceFingerprint,
            engineVersion: CLINICAL_INSIGHTS_ENGINE_VERSION,
            encryptedSuggestion: textCipher(draft.suggestion),
            encryptedRationale: textCipher(draft.rationale),
            citations: draft.citations,
            evidenceSnapshot: draft.evidenceSnapshot,
            provider: CLINICAL_KNOWLEDGE_PROVIDER,
            model: CLINICAL_KNOWLEDGE_MODEL,
            status:
              draft.disposition === "applied"
                ? "applied"
                : draft.disposition === "monitoring"
                  ? "monitoring"
                  : draft.disposition === "exception"
                    ? "exception"
                    : "draft",
            createdByUserId: actor.userId,
          })),
        )
        .onConflictDoNothing();
    }

    const routineCategories = routed.filter(
      (draft) => draft.disposition === "applied",
    );
    for (const aggregateDraft of routineCategories) {
      for (const phrase of reviewed.filter((item) =>
        knownCommunicationFunction(item.communicationFunction),
      )) {
        const normalizedPhrase = matchPhraseKey(phrase.phrase);
        if (!normalizedPhrase) continue;
        const phraseEvidence: ClinicalEvidence = {
          phrase: phrase.phrase,
          functions: [phrase.communicationFunction],
          contexts: phrase.context ? [phrase.context] : [],
          reviewedPhraseCount: reviewed.length,
          reviewedObservationCount: observations.length,
          sessionId: phrase.sessionId,
        };
        const phraseDraft = routeInsightDrafts(
          buildKnowledgeInsightDrafts(phraseEvidence, corpus),
          phraseEvidence,
        ).find(
          (draft) =>
            draft.category === aggregateDraft.category &&
            draft.disposition === "applied",
        );
        // An applied fact must carry citations that were retrieved from this
        // exact reviewed phrase/function, never from a child-wide aggregate.
        if (!phraseDraft) continue;
        // Preserve clinician-owned entries. The reviewed phrase remains the
        // canonical evidence record; this only creates a missing inventory row.
        const [existingGestalt] = await db
          .select()
          .from(clinicalGestaltsTable)
          .where(
            and(
              eq(clinicalGestaltsTable.organizationId, organizationId),
              eq(clinicalGestaltsTable.childId, childId),
              eq(clinicalGestaltsTable.normalizedPhrase, normalizedPhrase),
              isNull(clinicalGestaltsTable.archivedAt),
            ),
          )
          .limit(1);
        const [createdGestalt] = existingGestalt
          ? [undefined]
          : await db
              .insert(clinicalGestaltsTable)
              .values({
                organizationId,
                childId,
                phrase: phrase.phrase,
                normalizedPhrase,
                meaning: phrase.meaning,
                communicationFunction: phrase.communicationFunction,
                contexts: phrase.context ? [phrase.context] : [],
                emotionalState: phrase.emotionalState,
                source: "Clinical Insights Engine",
                createdByUserId: actor.userId,
              })
              .onConflictDoNothing()
              .returning();
        const gestalt = existingGestalt ?? createdGestalt;
        await db
          .insert(clinicalKnowledgeAppliedFactsTable)
          .values({
            organizationId,
            childId,
            sessionId: phrase.sessionId,
            runId: claimed.id,
            category: phraseDraft.category,
            gestaltId: gestalt?.id ?? null,
            engineCreatedGestalt: Boolean(createdGestalt),
            normalizedPhrase,
            phrase: phrase.phrase,
            meaning: phrase.meaning,
            communicationFunction: phrase.communicationFunction,
            contexts: phrase.context ? [phrase.context] : [],
            occurrenceCount: 1,
            confidence: phraseDraft.confidence,
            citations: phraseDraft.citations,
            evidenceSnapshot: phraseDraft.evidenceSnapshot,
            engineVersion: CLINICAL_INSIGHTS_ENGINE_VERSION,
            createdByUserId: actor.userId,
          })
          .onConflictDoNothing();
      }
    }

    await protectLegacySoapDrafts();
    const generatedSoapDraft = await reviewedSoapNoteFor(
      organizationId,
      childId,
      triggerSessionId,
      actor.userId,
      true,
    );
    if (generatedSoapDraft) {
      const [saved] = await db
        .select()
        .from(clinicalSoapNotesTable)
        .where(eq(clinicalSoapNotesTable.sessionId, triggerSessionId))
        .limit(1);
      if (!saved) {
        await db
          .insert(clinicalSoapNotesTable)
          .values({
            organizationId,
            childId,
            sessionId: triggerSessionId,
            content: generatedSoapDraft.content,
            evidenceVersion: 3,
            clinicianEdited: false,
            evidenceFingerprint,
            engineVersion: CLINICAL_INSIGHTS_ENGINE_VERSION,
            citations: generatedSoapDraft.citations,
            updatedByUserId: actor.userId,
          })
          .onConflictDoNothing();
      } else if (saved.status === "draft" && !saved.clinicianEdited) {
        await db
          .update(clinicalSoapNotesTable)
          .set({
            content: generatedSoapDraft.content,
            evidenceVersion: 3,
            clinicianEdited: false,
            evidenceFingerprint,
            engineVersion: CLINICAL_INSIGHTS_ENGINE_VERSION,
            citations: generatedSoapDraft.citations,
            updatedByUserId: actor.userId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(clinicalSoapNotesTable.id, saved.id),
              eq(clinicalSoapNotesTable.status, "draft"),
              eq(clinicalSoapNotesTable.clinicianEdited, false),
            ),
          );
      }
    }
    await db
      .update(clinicalKnowledgeInsightRunsTable)
      .set({
        status: "complete",
        completedAt: new Date(),
        leaseExpiresAt: null,
      })
      .where(eq(clinicalKnowledgeInsightRunsTable.id, claimed.id));
    await writeSecurityAudit({
      actor,
      action: "CLINICAL_INSIGHTS_RUN_COMPLETED",
      targetType: "clinical_insight_run",
      targetId: claimed.id,
      childId,
      metadata: {
        appliedCount: routineCategories.length,
        exceptionCount: routed.filter(
          (draft) => draft.disposition === "exception",
        ).length,
        sourceCount: new Set(corpus.map((chunk) => chunk.sourceId)).size,
      },
    });
  } catch (error) {
    await db
      .update(clinicalKnowledgeInsightRunsTable)
      .set({
        status: "failed",
        failureCode: "processing_failed",
        completedAt: new Date(),
        leaseExpiresAt: null,
      })
      .where(eq(clinicalKnowledgeInsightRunsTable.id, claimed.id));
    logger.warn(
      { childId, runId: claimed.id },
      "Clinical insights run needs retry",
    );
  }
};

const recoverClinicalInsightRuns = async () => {
  const expired = await db
    .select()
    .from(clinicalKnowledgeInsightRunsTable)
    .where(
      and(
        eq(clinicalKnowledgeInsightRunsTable.status, "running"),
        lt(clinicalKnowledgeInsightRunsTable.leaseExpiresAt, new Date()),
      ),
    )
    .limit(20);
  for (const run of expired) {
    const recovery = insightRunRecoveryState({
      status: run.status,
      attempt: run.attempt,
      leaseExpired: true,
      maxAttempts: MAX_INSIGHT_ATTEMPTS,
    });
    await db
      .update(clinicalKnowledgeInsightRunsTable)
      .set({
        status: "failed",
        failureCode: recovery,
        leaseExpiresAt: null,
        completedAt: recovery === "attempts_exhausted" ? new Date() : null,
      })
      .where(
        and(
          eq(clinicalKnowledgeInsightRunsTable.id, run.id),
          eq(clinicalKnowledgeInsightRunsTable.status, "running"),
          lt(clinicalKnowledgeInsightRunsTable.leaseExpiresAt, new Date()),
        ),
      );
  }
  const overdue = await db
    .select()
    .from(clinicalKnowledgeInsightRunsTable)
    .where(
      and(
        lt(clinicalKnowledgeInsightRunsTable.attempt, MAX_INSIGHT_ATTEMPTS),
        inArray(clinicalKnowledgeInsightRunsTable.status, ["queued", "failed"]),
      ),
    )
    .limit(20);
  for (const run of overdue) {
    const engineActor: CareTeamActor = {
      userId: run.triggeredByUserId,
      author: "Clinical Insights Engine",
      role: "Administrator",
      childIds: [run.childId],
      isAdmin: true,
      expiresAt: Date.now() + INSIGHT_LEASE_MS,
      organizationId: run.organizationId,
    };
    await runClinicalInsights({
      actor: engineActor,
      organizationId: run.organizationId,
      childId: run.childId,
      triggerSessionId: run.triggerSessionId ?? 0,
      runId: run.id,
    });
  }
};
// The lease protects against a request ending mid-run. `unref` keeps CLI/test
// processes finite while the API process continuously recovers durable work.
setInterval(() => {
  void recoverClinicalInsightRuns();
}, INSIGHT_LEASE_MS).unref();

const reviewedSoapNoteFor = async (
  organizationId: number,
  childId: number,
  sessionId: number,
  knowledgeSourceUserId: string,
  forceGeneratedDraft = false,
) => {
  const [session] = await db
    .select()
    .from(therapySessionsTable)
    .where(
      and(
        eq(therapySessionsTable.id, sessionId),
        eq(therapySessionsTable.organizationId, organizationId),
        eq(therapySessionsTable.childId, childId),
        isNull(therapySessionsTable.archivedAt),
      ),
    )
    .limit(1);
  if (!session) return null;

  const [sessionPhrases, allSessions, occurrenceRows, savedNoteRows] =
    await Promise.all([
      db
        .select()
        .from(therapySessionGestaltsTable)
        .where(eq(therapySessionGestaltsTable.sessionId, sessionId)),
      db
        .select()
        .from(therapySessionsTable)
        .where(
          and(
            eq(therapySessionsTable.organizationId, organizationId),
            eq(therapySessionsTable.childId, childId),
            isNull(therapySessionsTable.archivedAt),
          ),
        )
        .orderBy(desc(therapySessionsTable.createdAt)),
      db
        .select()
        .from(gestaltOccurrencesTable)
        .where(eq(gestaltOccurrencesTable.childId, childId)),
      db
        .select()
        .from(clinicalSoapNotesTable)
        .where(eq(clinicalSoapNotesTable.sessionId, sessionId))
        .limit(1),
    ]);

  const savedNote = savedNoteRows[0];
  if (savedNote && savedNote.status !== "draft") return null;
  const transcriptPhraseIds = sessionPhrases
    .map((phrase) => phrase.transcriptPhraseId)
    .filter((id): id is number => typeof id === "number");
  const transcriptPhrases = transcriptPhraseIds.length
    ? await db
        .select()
        .from(transcriptPhrasesTable)
        .where(inArray(transcriptPhrasesTable.id, transcriptPhraseIds))
    : [];
  const transcriptFrequencyById = new Map(
    transcriptPhrases
      .filter((phrase) => phrase.accepted)
      .map((phrase) => [phrase.id, phrase.frequency]),
  );
  const currentPhrases = sessionPhrases.filter(
    (phrase) =>
      phrase.childAttributed &&
      (phrase.transcriptPhraseId === null ||
        transcriptFrequencyById.has(phrase.transcriptPhraseId)),
  );
  const currentKeys = new Set(
    currentPhrases.map((phrase) => matchPhraseKey(phrase.phrase)),
  );
  const priorSessionIds = allSessions
    .filter(
      (item) => item.id !== sessionId && item.createdAt < session.createdAt,
    )
    .map((item) => item.id);
  const priorPhrases = priorSessionIds.length
    ? await db
        .select()
        .from(therapySessionGestaltsTable)
        .where(inArray(therapySessionGestaltsTable.sessionId, priorSessionIds))
    : [];
  const priorKeys = new Set(
    priorPhrases
      .filter((phrase) => phrase.childAttributed)
      .map((phrase) => matchPhraseKey(phrase.phrase)),
  );
  const frequencyFor = (phrase: (typeof currentPhrases)[number]) =>
    phrase.transcriptPhraseId
      ? (transcriptFrequencyById.get(phrase.transcriptPhraseId) ?? 1)
      : 1;
  const phraseGroups = new Map<
    string,
    { phrase: (typeof currentPhrases)[number]; frequency: number }
  >();
  for (const phrase of currentPhrases) {
    const key = matchPhraseKey(phrase.phrase);
    const existing = phraseGroups.get(key);
    phraseGroups.set(key, {
      phrase,
      frequency: (existing?.frequency ?? 0) + frequencyFor(phrase),
    });
  }
  const grouped = [...phraseGroups.values()].sort(
    (left, right) => right.frequency - left.frequency,
  );
  const occurrenceByKey = new Map(
    occurrenceRows.map((row) => [matchPhraseKey(row.normalizedPhrase), row]),
  );
  const newGestalts = grouped
    .filter(({ phrase }) => !priorKeys.has(matchPhraseKey(phrase.phrase)))
    .map(({ phrase }) => phrase.phrase);
  const recurrentGestalts = grouped
    .filter(({ phrase }) => priorKeys.has(matchPhraseKey(phrase.phrase)))
    .map(({ phrase }) => phrase.phrase);
  const functions = [
    ...new Set(
      grouped.map(({ phrase }) => phrase.communicationFunction).filter(Boolean),
    ),
  ];
  await ensurePackagedClinicalKnowledge(organizationId, knowledgeSourceUserId);
  const knowledge = await retrieveOrganizationKnowledge(
    organizationId,
    [
      "SOAP clinical documentation possible NLA stage parent coaching",
      ...grouped.map(({ phrase }) => phrase.phrase),
      ...functions,
    ].join(" "),
  );
  const knowledgeCitation = knowledge.length
    ? knowledge
        .map(
          (chunk) =>
            `${chunk.sourceTitle}${chunk.page ? ` p. ${chunk.page}` : ""}${chunk.section ? ` · ${chunk.section}` : ""}`,
        )
        .join("; ")
    : null;
  const citations = knowledge.map((chunk) => ({
    sourceId: chunk.sourceId,
    sourceVersionId: chunk.sourceVersionId,
    chunkId: chunk.id,
    sourceTitle: chunk.sourceTitle,
    page: chunk.page,
    section: chunk.section,
  }));
  const knowledgeConfidence =
    knowledge.length >= 2 ? "medium" : knowledge.length ? "low" : "low";
  const childUtterances = grouped.reduce(
    (total, item) => total + item.frequency,
    0,
  );
  const repeatedGestalts = grouped.filter((item) => item.frequency > 1).length;
  const longitudinalChange = priorSessionIds.length
    ? `${newGestalts.length} newly confirmed and ${recurrentGestalts.length} previously documented gestalt${recurrentGestalts.length === 1 ? "" : "s"} in this reviewed session.`
    : "This is the first saved reviewed session available for comparison.";
  const tracker = grouped
    .map(({ phrase, frequency }) => {
      const lifetime = occurrenceByKey.get(matchPhraseKey(phrase.phrase));
      return [
        `“${phrase.phrase}”`,
        `Session: ${frequency}`,
        `Lifetime: ${lifetime?.occurrenceCount ?? frequency}`,
        `Meaning: ${phrase.meaning}`,
        `Contexts: ${phrase.context || "Not documented"}`,
        `Function: ${phrase.communicationFunction || "Not documented"}`,
        `Last observed: ${lifetime?.lastSeenAt?.toISOString().slice(0, 10) ?? "This session"}`,
      ].join("\n");
    })
    .join("\n\n");
  const generated: SoapNoteContent = {
    subjective: session.clinicalObservations.trim()
      ? `Clinician-entered session report:\n${session.clinicalObservations.trim()}`
      : "No caregiver, teacher, or clinician report was documented for this session.",
    objective: [
      `Session duration: ${Math.floor(session.durationSeconds / 60)} minutes ${session.durationSeconds % 60} seconds.`,
      `Confirmed Child utterances represented: ${childUtterances}.`,
      `Unique confirmed gestalts: ${grouped.length}. Repeated gestalts: ${repeatedGestalts}.`,
      grouped.length
        ? `Most frequent reviewed gestalts: ${grouped
            .slice(0, 3)
            .map((item) => `“${item.phrase.phrase}” (${item.frequency})`)
            .join(", ")}.`
        : "No confirmed Child gestalts were saved.",
      newGestalts.length
        ? `Newly confirmed this session: ${newGestalts.map((phrase) => `“${phrase}”`).join(", ")}.`
        : "No newly confirmed gestalts identified.",
      functions.length
        ? `Possible communication functions documented by clinician: ${functions.join(", ")}.`
        : "No communication functions documented.",
    ].join("\n"),
    assessment: [
      "DRAFT CLINICAL INSIGHTS - REVIEW REQUIRED",
      "This draft is a factual summary of clinician-confirmed Child utterances and confirmed gestalt data. It is not a diagnosis, clinical decision, or treatment recommendation.",
      longitudinalChange,
      repeatedGestalts
        ? `${repeatedGestalts} repeated gestalt pattern${repeatedGestalts === 1 ? " was" : "s were"} recorded in this session.`
        : "No repeated gestalt patterns were recorded in this session.",
      "Review the observed contexts and meanings with the care team before using this draft in a clinical record.",
    ].join("\n"),
    nlaObservations: [
      "Observed indicators may be consistent with:",
      "• Stage 1 patterns: Not assessed from this draft alone",
      "• Emerging Stage 2 mitigations: Not assessed from this draft alone",
      "• Emerging Stage 3 recombinations: Not assessed from this draft alone",
      "• Mixed profile: Not assessed from this draft alone",
      knowledgeCitation
        ? `Possible-stage evidence context: ${knowledgeCitation}. Confidence: ${knowledgeConfidence} (${confidenceScoreFor(knowledgeConfidence)}/100).`
        : "No relevant clinical source passage matched this reviewed evidence. Confidence: low (35/100); clinician review is required.",
      "EchoMap does not assign an NLA stage; clinicians review observed language in context.",
    ].join("\n"),
    gestaltTracking:
      tracker || "No confirmed Child gestalts were saved for this session.",
    plan: session.nextSteps.trim()
      ? `Clinician-entered follow-up prompts:\n${session.nextSteps.trim()}\n\n${knowledgeCitation ? `Retrieved clinical context to review: ${knowledgeCitation}.` : "No relevant source citation was found; keep this plan clinician-authored."}\n\nReview the note, confirm meanings with the care team as appropriate, and decide what to document next.`
      : `${knowledgeCitation ? `Retrieved clinical context to review: ${knowledgeCitation}.\n\n` : ""}Clinician review prompt: confirm any uncertain meanings, update the shared dictionary when appropriate, and identify what the care team should notice next.`,
    caregiverSummary: grouped.length
      ? `Today’s reviewed session included ${grouped.length} confirmed phrase pattern${grouped.length === 1 ? "" : "s"}. The care team can continue noticing when these phrases appear and what seems to help communication feel easier.${knowledgeCitation ? " A cited clinical reference is available for clinician review; it does not replace the family’s own understanding." : ""}`
      : "No confirmed Child phrase patterns were saved for a caregiver summary.",
  };
  const content =
    savedNote?.clinicianEdited && !forceGeneratedDraft
      ? savedNote.content
      : generated;
  return {
    sessionId,
    childId,
    sessionDate: session.createdAt.toISOString(),
    content,
    evidence: {
      childUtterances,
      uniqueGestalts: grouped.length,
      repeatedGestalts,
      newGestalts,
      recurrentGestalts,
      functions,
      longitudinalChange,
    },
    citations,
    generatedAt:
      savedNote?.clinicianEdited && !forceGeneratedDraft
        ? savedNote.generatedAt.toISOString()
        : now(),
    updatedAt: savedNote?.updatedAt.toISOString() ?? now(),
  };
};

const documentationTitleFor = (format: string, childName?: string) => {
  const labels: Record<string, string> = {
    session_note: "Session Note",
    soap_note: "SOAP Note",
    progress_note: "Progress Note",
    parent_summary: "Parent Summary",
    teacher_summary: "Teacher Summary",
  };
  return `${labels[format] ?? "Clinical Note"}${childName ? ` · ${childName}` : ""}`;
};

const communicationGoalResponse = (
  goal: typeof communicationGoalsTable.$inferSelect,
) => ({
  id: goal.id,
  childId: goal.childId,
  title: goal.title,
  goalArea: goal.goalArea,
  description: goal.description,
  status: goal.status,
  startDate: goal.startDate,
  targetDate: goal.targetDate,
  version: goal.version,
  createdAt: goal.createdAt.toISOString(),
  updatedAt: goal.updatedAt.toISOString(),
});
const communicationGoalSnapshot = (
  goal: typeof communicationGoalsTable.$inferSelect,
) => ({
  title: goal.title,
  goalArea: goal.goalArea,
  description: goal.description,
  status: goal.status,
  startDate: goal.startDate,
  targetDate: goal.targetDate,
  version: goal.version,
  archivedAt: goal.archivedAt?.toISOString() ?? null,
  archivedByUserId: goal.archivedByUserId,
});

/**
 * Server-owned, deterministic provenance. These connections are references for
 * clinician review, never a measure of achievement, progress, or mastery.
 */
type GoalConnectionExecutor = Pick<typeof db, "select">;
const goalConnectionsFor = async (
  executor: GoalConnectionExecutor,
  organizationId: number,
  childId: number,
  sourceSessionId?: number | null,
) => {
  const goals = await executor
    .select()
    .from(communicationGoalsTable)
    .where(
      and(
        eq(communicationGoalsTable.organizationId, organizationId),
        eq(communicationGoalsTable.childId, childId),
        eq(communicationGoalsTable.status, "active"),
      ),
    );
  if (!goals.length) return [];
  const candidates: DocumentationDraftContent["goalConnections"] = [];
  if (sourceSessionId) {
    const [transcript] = await executor
      .select({ id: sessionTranscriptsTable.id })
      .from(sessionTranscriptsTable)
      .where(
        and(
          eq(sessionTranscriptsTable.sessionId, sourceSessionId),
          eq(sessionTranscriptsTable.childId, childId),
        ),
      )
      .limit(1);
    if (transcript) {
      const rows = await executor
        .select({
          id: transcriptSpeakerSegmentsTable.id,
          segmentId: transcriptSpeakerSegmentsTable.id,
          text: transcriptSpeakerSegmentsTable.text,
          intelligibility: transcriptSpeakerSegmentsTable.intelligibility,
          disposition: transcriptChildUtteranceReviewsTable.disposition,
          meaning: transcriptChildUtteranceReviewsTable.meaning,
          context: transcriptChildUtteranceReviewsTable.context,
          intelligibilityReviewStatus:
            transcriptChildUtteranceReviewsTable.intelligibilityReviewStatus,
        })
        .from(transcriptSpeakerSegmentsTable)
        .innerJoin(
          transcriptChildUtteranceReviewsTable,
          and(
            eq(
              transcriptChildUtteranceReviewsTable.segmentId,
              transcriptSpeakerSegmentsTable.id,
            ),
            eq(
              transcriptChildUtteranceReviewsTable.transcriptId,
              transcript.id,
            ),
          ),
        )
        .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id));
      for (const row of rows.filter((row) =>
        canCreatePhraseEvidenceFrom(row, row),
      ))
        candidates.push({
          goalId: 0,
          goalTitle: "",
          goalArea: "",
          goalVersion: 0,
          sourceKind: "reviewed_utterance",
          sourceId: row.id,
          sourceLabel: "Reviewed Child utterance",
          sourceDetail: `“${row.text}” · meaning: ${row.meaning!.trim()} · context: ${row.context?.trim() || "Not documented"}`,
          evidenceClass: "reviewed_clinical_evidence",
          included: false,
        });
    }
  }
  const [dictionary, aac, observations] = await Promise.all([
    executor
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.organizationId, organizationId),
          eq(clinicalGestaltsTable.childId, childId),
          isNull(clinicalGestaltsTable.archivedAt),
        ),
      ),
    executor
      .select({ id: aacProfilesTable.id, notes: aacProfilesTable.notes })
      .from(aacProfilesTable)
      .where(
        and(
          eq(aacProfilesTable.organizationId, organizationId),
          eq(aacProfilesTable.childId, childId),
          isNull(aacProfilesTable.removedAt),
        ),
      ),
    executor
      .select({
        id: clinicalObservationsTable.id,
        body: clinicalObservationsTable.body,
        context: clinicalObservationsTable.context,
        authorRole: organizationMembershipsTable.role,
      })
      .from(clinicalObservationsTable)
      .innerJoin(
        organizationMembershipsTable,
        and(
          eq(
            organizationMembershipsTable.organizationId,
            clinicalObservationsTable.organizationId,
          ),
          eq(
            organizationMembershipsTable.userId,
            clinicalObservationsTable.createdByUserId,
          ),
        ),
      )
      .where(
        and(
          eq(clinicalObservationsTable.organizationId, organizationId),
          eq(clinicalObservationsTable.childId, childId),
        ),
      )
      .limit(30),
  ]);
  for (const row of dictionary.filter(isClinicallyReviewedGestalt))
    candidates.push({
      goalId: 0,
      goalTitle: "",
      goalArea: "",
      goalVersion: 0,
      sourceKind: "dictionary_phrase",
      sourceId: row.id,
      sourceLabel: "Reviewed dictionary phrase",
      sourceDetail: `“${row.phrase}” · ${row.meaning}`,
      evidenceClass: "reviewed_clinical_evidence",
      included: false,
    });
  for (const row of aac)
    candidates.push({
      goalId: 0,
      goalTitle: "",
      goalArea: "",
      goalVersion: 0,
      sourceKind: "aac_profile",
      sourceId: row.id,
      sourceLabel: "AAC profile",
      sourceDetail: row.notes || "AAC profile context",
      evidenceClass: "care_team_context",
      included: false,
    });
  for (const row of observations.filter((row) => row.authorRole === "teacher"))
    candidates.push({
      goalId: 0,
      goalTitle: "",
      goalArea: "",
      goalVersion: 0,
      sourceKind: "teacher_observation",
      sourceId: row.id,
      sourceLabel: "Teacher observation",
      sourceDetail: `${row.body} · context: ${row.context || "Not documented"}`,
      evidenceClass: "care_team_context",
      included: false,
    });
  for (const row of observations.filter((row) => row.authorRole === "parent"))
    candidates.push({
      goalId: 0,
      goalTitle: "",
      goalArea: "",
      goalVersion: 0,
      sourceKind: "shared_moment",
      sourceId: row.id,
      sourceLabel: "Family-shared moment",
      sourceDetail: `${row.body} · context: ${row.context || "Not documented"}`,
      evidenceClass: "care_team_context",
      included: false,
    });
  return goals.flatMap((goal) =>
    candidates
      .filter((candidate) =>
        goalSourceIsRelevant(goal, {
          label: candidate.sourceLabel,
          detail: candidate.sourceDetail,
        }),
      )
      .map((candidate) => ({
        ...candidate,
        goalId: goal.id,
        goalTitle: goal.title,
        goalArea: goal.goalArea,
        goalVersion: goal.version,
      })),
  );
};

const documentationResponse = (
  record: typeof clinicalDocumentationTable.$inferSelect,
  approvedBy: string | null = null,
  archivedBy: string | null = null,
  deletedBy: string | null = null,
) => {
  const stored = record.content as Partial<DocumentationDraftContent>;
  const content: DocumentationDraftContent = {
    sessionSummary: stored.sessionSummary ?? "",
    observedGestalts: stored.observedGestalts ?? "",
    communicationFunctions: stored.communicationFunctions ?? "",
    nlaObservations: stored.nlaObservations ?? "",
    potentialGestalts:
      stored.potentialGestalts ??
      [
        "Suggested Insight",
        "No potential gestalts were included in this earlier draft.",
        "",
        "Clinician Review Required",
        "Treat this as a prompt for review, not as confirmed phrase evidence.",
      ].join("\n"),
    suggestedClinicalImpressions: stored.suggestedClinicalImpressions ?? "",
    clinicianNotes: stored.clinicianNotes ?? "",
    observedLanguage: stored.observedLanguage ?? stored.observedGestalts ?? "",
    communicationFunctionsObserved:
      stored.communicationFunctionsObserved ??
      stored.communicationFunctions ??
      "",
    notableLanguageChanges:
      stored.notableLanguageChanges ??
      "No longitudinal comparison was stored for this earlier draft.",
    nlaGestaltInsights:
      stored.nlaGestaltInsights ??
      stored.nlaObservations ??
      [
        "Suggested Insight",
        "No NLA or gestalt insight was stored for this earlier draft.",
        "",
        "Clinician Review Required",
        "Do not treat this section as a stage assignment or clinical conclusion.",
      ].join("\n"),
    sessionParticipation:
      stored.sessionParticipation ??
      "Participation was not inferred from this earlier draft.",
    aacPlanningOpportunities:
      stored.aacPlanningOpportunities ??
      "Clinician Review Required\nNo AAC planning change was made by this draft.",
    suggestedDictionaryCandidates:
      stored.suggestedDictionaryCandidates ??
      "Clinician Review Required\nNo dictionary change was made by this draft.",
    suggestedFollowUpTargets:
      stored.suggestedFollowUpTargets ??
      "Clinician Review Required\nNo treatment target was generated by this draft.",
    communicationGrowthSnapshot:
      stored.communicationGrowthSnapshot ??
      "No growth snapshot was stored for this earlier draft.",
    familyTeamHighlights:
      stored.familyTeamHighlights ??
      "Clinician Review Required\nReview-only highlights were not stored for this earlier draft.",
    evidenceReferences: stored.evidenceReferences ?? [],
    goalConnections: (stored.goalConnections ?? [])
      .filter(
        (connection) => record.status !== "finalized" || connection.included,
      )
      .map((connection) => ({
        ...connection,
        goalTitle: connection.goalTitle ?? `Goal #${connection.goalId}`,
        goalArea: connection.goalArea ?? "Unspecified goal area",
        goalVersion: connection.goalVersion ?? 0,
      })),
  };
  return {
    id: record.id,
    childId: record.childId,
    sourceSessionId: record.sourceSessionId,
    format: record.format,
    status: record.status,
    title: record.title,
    inputObservations: record.inputObservations,
    inputSummary: record.inputSummary,
    inputQuickNote: record.inputQuickNote,
    content,
    generated: record.generated,
    evidenceVersion: record.evidenceVersion,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    approvedBy,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    archivedBy,
    deletedAt: record.deletedAt?.toISOString() ?? null,
    deletedBy,
    purgeAfter: record.purgeAfter?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
};

const documentationFingerprint = (input: {
  sourceSessionId?: number;
  inputObservations: string;
  inputSummary: string;
  inputQuickNote: string;
}) => createHash("sha256").update(JSON.stringify(input)).digest("hex");

const documentationDraftFor = async ({
  organizationId,
  childId,
  sourceSessionId,
  inputObservations,
  inputSummary,
  inputQuickNote,
  knowledgeSourceUserId,
}: {
  organizationId: number;
  childId: number;
  sourceSessionId?: number;
  inputObservations: string;
  inputSummary: string;
  inputQuickNote: string;
  knowledgeSourceUserId: string;
}) => {
  const soap = sourceSessionId
    ? await reviewedSoapNoteFor(
        organizationId,
        childId,
        sourceSessionId,
        knowledgeSourceUserId,
      )
    : null;
  if (sourceSessionId && !soap) return null;

  return buildDocumentationDraftContent({
    inputObservations,
    inputSummary,
    inputQuickNote,
    evidence: soap
      ? {
          subjective: soap.content.subjective,
          gestaltTracking: soap.content.gestaltTracking,
          nlaObservations: soap.content.nlaObservations,
          assessment: soap.content.assessment,
          functions: soap.evidence.functions,
        }
      : undefined,
  });
};

const speakerRoleValues = new Set([
  "unassigned",
  "child",
  "slp",
  "parent",
  "teacher",
  "caregiver",
  "unknown",
]);
type SpeakerRole =
  | "unassigned"
  | "child"
  | "slp"
  | "parent"
  | "teacher"
  | "caregiver"
  | "unknown";
type SpeakerConfidence = "high" | "medium" | "low";
const speakerConfidenceRank: Record<SpeakerConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};
const speakerConfidenceFrom = (value: string): SpeakerConfidence =>
  value === "high" || value === "medium" ? value : "low";
const normalizedSpeakerRole = (value: string): SpeakerRole =>
  value === "parent_caregiver"
    ? "caregiver"
    : value === "other" || value === "observer"
      ? "unknown"
      : speakerRoleValues.has(value)
        ? (value as SpeakerRole)
        : "unknown";
const profileSignatureHashFor = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const speakerConfidenceScoreFrom = (value: number | null) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 100
    ? value
    : null;

const speakerInferenceResponse = (
  inference:
    typeof transcriptSpeakerRoleInferencesTable.$inferSelect | undefined,
) =>
  inference
    ? {
        state: inference.state,
        predictedRole: inference.predictedRole,
        confidenceScore: inference.confidenceScore,
        competingRole: inference.competingRole,
        competingScore: inference.competingScore,
        margin: inference.margin,
        signalCount: inference.signalCount,
        signalSummary: inference.signalSummary as Array<{
          signal: string;
          available: boolean;
          contribution: number;
          detail: string;
        }>,
      }
    : {
        state: "unavailable",
        predictedRole: null,
        confidenceScore: null,
        competingRole: null,
        competingScore: null,
        margin: null,
        signalCount: 0,
        signalSummary: [],
      };

const persistSpeakerRoleInferences = async (
  transcript: typeof sessionTranscriptsTable.$inferSelect,
  organizationId: number,
) => {
  const [segments, profiles, confirmedChildLanguage, learning, existing] =
    await Promise.all([
      db
        .select()
        .from(transcriptSpeakerSegmentsTable)
        .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id))
        .orderBy(transcriptSpeakerSegmentsTable.position),
      db
        .select()
        .from(childSpeakerProfilesTable)
        .where(
          and(
            eq(childSpeakerProfilesTable.childId, transcript.childId),
            eq(childSpeakerProfilesTable.organizationId, organizationId),
            isNull(childSpeakerProfilesTable.archivedAt),
          ),
        ),
      db
        .select({ phrase: clinicalGestaltsTable.phrase })
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.childId, transcript.childId),
            eq(clinicalGestaltsTable.organizationId, organizationId),
            isNull(clinicalGestaltsTable.archivedAt),
          ),
        ),
      db
        .select()
        .from(childSpeakerRoleLearningAggregatesTable)
        .where(
          and(
            eq(
              childSpeakerRoleLearningAggregatesTable.childId,
              transcript.childId,
            ),
            eq(
              childSpeakerRoleLearningAggregatesTable.organizationId,
              organizationId,
            ),
            eq(
              childSpeakerRoleLearningAggregatesTable.modelVersion,
              SPEAKER_ROLE_MODEL_VERSION,
            ),
          ),
        ),
      db
        .select()
        .from(transcriptSpeakerRoleInferencesTable)
        .where(
          eq(transcriptSpeakerRoleInferencesTable.transcriptId, transcript.id),
        ),
    ]);
  const inferenceSegments = segments.filter(
    (segment) => segment.speakerLabel !== MANUAL_TRANSCRIPT_REVIEW_LABEL,
  );
  if (!inferenceSegments.length) {
    return new Map<
      string,
      typeof transcriptSpeakerRoleInferencesTable.$inferSelect
    >();
  }
  const existingByLabel = new Map(
    existing.map((item) => [item.speakerLabel, item]),
  );
  const inferred = inferSpeakerRoles({
    segments: inferenceSegments.map((segment) => ({
      speakerLabel: segment.speakerLabel,
      text: segment.text,
      position: segment.position,
      confidenceScore: speakerConfidenceScoreFrom(
        segment.speakerConfidenceScore,
      ),
      profileSignatureHash: segment.profileSignatureHash,
    })),
    profiles: profiles.map((profile) => ({
      profileSignatureHash: profile.profileSignatureHash,
      role: profile.role,
    })),
    confirmedChildPatterns: confirmedChildLanguage.map((item) => item.phrase),
    learning: learning.map((item) => ({
      role: item.role,
      featureKey: item.featureKey,
      confirmedCount: item.confirmedCount,
    })),
  });
  for (const inference of inferred) {
    const previous = existingByLabel.get(inference.speakerLabel);
    if (
      previous &&
      previous.inputFingerprint === inference.inputFingerprint &&
      previous.modelVersion === SPEAKER_ROLE_MODEL_VERSION &&
      previous.featureVersion === SPEAKER_ROLE_FEATURE_VERSION
    )
      continue;
    const values = {
      organizationId,
      childId: transcript.childId,
      transcriptId: transcript.id,
      speakerLabel: inference.speakerLabel,
      state: previous?.confirmedRole ? "confirmed" : inference.state,
      predictedRole: inference.predictedRole,
      confidenceScore: inference.confidenceScore,
      competingRole: inference.competingRole,
      competingScore: inference.competingScore,
      margin: inference.margin,
      signalCount: inference.signalCount,
      signalSummary: inference.signalSummary,
      inputFingerprint: inference.inputFingerprint,
      modelVersion: SPEAKER_ROLE_MODEL_VERSION,
      featureVersion: SPEAKER_ROLE_FEATURE_VERSION,
      confirmedRole: previous?.confirmedRole ?? null,
      confirmedByUserId: previous?.confirmedByUserId ?? null,
      confirmedAt: previous?.confirmedAt ?? null,
      updatedAt: new Date(),
    };
    await db
      .insert(transcriptSpeakerRoleInferencesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [
          transcriptSpeakerRoleInferencesTable.transcriptId,
          transcriptSpeakerRoleInferencesTable.speakerLabel,
        ],
        set: values,
      });
  }
  const refreshed = await db
    .select()
    .from(transcriptSpeakerRoleInferencesTable)
    .where(
      eq(transcriptSpeakerRoleInferencesTable.transcriptId, transcript.id),
    );
  return new Map(refreshed.map((item) => [item.speakerLabel, item]));
};

const loadSpeakerContext = async (
  transcript: typeof sessionTranscriptsTable.$inferSelect,
  organizationId: number,
) => {
  const [segments, assignments, profiles, inferences] = await Promise.all([
    db
      .select()
      .from(transcriptSpeakerSegmentsTable)
      .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id))
      .orderBy(transcriptSpeakerSegmentsTable.position),
    db
      .select()
      .from(transcriptSpeakerRolesTable)
      .where(eq(transcriptSpeakerRolesTable.transcriptId, transcript.id)),
    db
      .select()
      .from(childSpeakerProfilesTable)
      .where(
        and(
          eq(childSpeakerProfilesTable.childId, transcript.childId),
          eq(childSpeakerProfilesTable.organizationId, organizationId),
          isNull(childSpeakerProfilesTable.archivedAt),
        ),
      ),
    persistSpeakerRoleInferences(transcript, organizationId),
  ]);
  // Older transcripts used child-wide placeholder labels. Preserve their
  // reviewed history when reading legacy records, but never apply those labels
  // to a speech-first transcript created with the current pipeline.
  const legacyAssignments = transcript.provider.includes(TRANSCRIPTION_MODEL)
    ? []
    : await db
        .select()
        .from(childSpeakerRolesTable)
        .where(eq(childSpeakerRolesTable.childId, transcript.childId));
  const roleByLabel = new Map<string, SpeakerRole | string>(
    legacyAssignments.map((entry) => [
      entry.speakerLabel,
      normalizedSpeakerRole(entry.role),
    ]),
  );
  for (const [label, role] of speakerRolesForTranscript(
    assignments,
    transcript.id,
  )) {
    roleByLabel.set(label, normalizedSpeakerRole(role));
  }
  const profileBySignature = new Map(
    profiles.map((profile) => [profile.profileSignatureHash, profile]),
  );
  // Neutral transcript-review turns remain available for explicit utterance
  // classification but are never exposed as detected speakers or used for
  // speaker-role inference.
  const safeSegments = segments;
  const labels = [
    ...new Set(
      safeSegments
        .map((segment) => segment.speakerLabel)
        .filter((label) => label !== MANUAL_TRANSCRIPT_REVIEW_LABEL),
    ),
  ];
  return {
    segments: safeSegments.map(
      ({ profileSignatureHash: _profileSignatureHash, ...segment }) => ({
        ...segment,
        speakerConfidence: speakerConfidenceFrom(segment.speakerConfidence),
        speakerConfidenceScore: speakerConfidenceScoreFrom(
          segment.speakerConfidenceScore,
        ),
        role: normalizedSpeakerRole(
          roleByLabel.get(segment.speakerLabel) ?? "unassigned",
        ),
      }),
    ),
    speakers: labels.map((label) => {
      const speakerSegments = safeSegments.filter(
        (segment) => segment.speakerLabel === label,
      );
      const confidence =
        speakerSegments
          .map((segment) => speakerConfidenceFrom(segment.speakerConfidence))
          .sort(
            (left, right) =>
              speakerConfidenceRank[left] - speakerConfidenceRank[right],
          )[0] ?? "low";
      const confidenceScores = speakerSegments
        .map((segment) =>
          speakerConfidenceScoreFrom(segment.speakerConfidenceScore),
        )
        .filter((score): score is number => score !== null);
      const profileSignatureHashes = [
        ...new Set(
          speakerSegments
            .map((segment) => segment.profileSignatureHash)
            .filter((hash): hash is string => Boolean(hash)),
        ),
      ];
      const profile =
        profileSignatureHashes.length === 1
          ? profileBySignature.get(profileSignatureHashes[0] ?? "")
          : undefined;
      const suggestedRoleConfidenceScore = profile
        ? Math.min(
            95,
            profile.confidenceScore ?? 95,
            confidenceScores.length ? Math.min(...confidenceScores) : 95,
          )
        : null;
      const inference = speakerInferenceResponse(inferences.get(label));
      return {
        label,
        role: normalizedSpeakerRole(roleByLabel.get(label) ?? "unassigned"),
        speakerConfidence: confidence,
        speakerConfidenceScore: confidenceScores.length
          ? Math.min(...confidenceScores)
          : null,
        lowConfidenceTurnCount: speakerSegments.filter(
          (segment) =>
            speakerConfidenceFrom(segment.speakerConfidence) === "low",
        ).length,
        reviewedTurnCount: speakerSegments.filter(
          (segment) => segment.speakerReviewed,
        ).length,
        suggestedRole:
          profile && (suggestedRoleConfidenceScore ?? 0) > 90
            ? normalizedSpeakerRole(profile.role)
            : null,
        suggestedRoleConfidenceScore,
        suggestedProfileId: profile?.id ?? null,
        canRememberProfile: profileSignatureHashes.length === 1,
        roleInference: inference,
      };
    }),
  };
};

const rebuildProvisionalTranscriptPhrases = async (
  transaction: any,
  transcriptId: number,
  rawTranscript: string,
) => {
  const phrases = provisionalPhraseCandidates(rawTranscript);
  await transaction
    .delete(transcriptProvisionalPhrasesTable)
    .where(eq(transcriptProvisionalPhrasesTable.transcriptId, transcriptId));
  if (!phrases.length) return;
  await transaction.insert(transcriptProvisionalPhrasesTable).values(
    phrases.map((phrase) => ({
      transcriptId,
      phrase: phrase.phrase,
      normalizedPhrase: phrase.normalizedPhrase,
      frequency: phrase.frequency,
      candidateKind: phrase.candidateKind,
    })),
  );
};

const rebuildChildTranscriptPhrases = async (
  transaction: any,
  transcript: typeof sessionTranscriptsTable.$inferSelect,
  childChunks: string[],
) => {
  const phrases = segmentTranscript(childChunks);
  const clinicalGestalts: Array<{ id: number; phrase: string }> =
    await transaction
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.childId, transcript.childId),
          isNull(clinicalGestaltsTable.archivedAt),
        ),
      );
  const gestaltByKey = new Map(
    clinicalGestalts.map((gestalt) => [
      matchPhraseKey(gestalt.phrase),
      gestalt,
    ]),
  );
  await transaction
    .delete(transcriptPhrasesTable)
    .where(eq(transcriptPhrasesTable.transcriptId, transcript.id));
  if (phrases.length) {
    await transaction.insert(transcriptPhrasesTable).values(
      phrases.map((phrase) => ({
        transcriptId: transcript.id,
        phrase: phrase.phrase,
        normalizedPhrase: phrase.normalizedPhrase,
        frequency: phrase.frequency,
        matchedGestaltId:
          gestaltByKey.get(matchPhraseKey(phrase.normalizedPhrase))?.id ?? null,
        attributedRole: "child",
      })),
    );
  }
};

const rebuildConfirmedChildTranscriptPhrases = async (
  transaction: any,
  transcript: typeof sessionTranscriptsTable.$inferSelect,
) => {
  const [segments, reviews]: [
    Array<typeof transcriptSpeakerSegmentsTable.$inferSelect>,
    Array<typeof transcriptChildUtteranceReviewsTable.$inferSelect>,
  ] = await Promise.all([
    transaction
      .select()
      .from(transcriptSpeakerSegmentsTable)
      .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id))
      .orderBy(transcriptSpeakerSegmentsTable.position),
    transaction
      .select()
      .from(transcriptChildUtteranceReviewsTable)
      .where(
        eq(transcriptChildUtteranceReviewsTable.transcriptId, transcript.id),
      ),
  ]);
  const confirmedSegmentIds = new Set(
    reviews
      .filter((review) => {
        const segment = segments.find(
          (candidate) => candidate.id === review.segmentId,
        );
        return Boolean(segment && canCreatePhraseEvidenceFrom(segment, review));
      })
      .map((review) => review.segmentId),
  );
  await rebuildChildTranscriptPhrases(
    transaction,
    transcript,
    segments
      .filter((segment) => confirmedSegmentIds.has(segment.id))
      .map((segment) => evidenceSafeTranscriptText(segment.text))
      .filter(Boolean),
  );
};

const refreshChildPhraseInboxPointers = async (
  transaction: any,
  transcriptId: number,
) => {
  const [phrases, inboxItems]: [
    Array<typeof transcriptPhrasesTable.$inferSelect>,
    Array<typeof childPhraseInboxItemsTable.$inferSelect>,
  ] = await Promise.all([
    transaction
      .select()
      .from(transcriptPhrasesTable)
      .where(eq(transcriptPhrasesTable.transcriptId, transcriptId)),
    transaction
      .select()
      .from(childPhraseInboxItemsTable)
      .where(
        and(
          eq(childPhraseInboxItemsTable.transcriptId, transcriptId),
          inArray(childPhraseInboxItemsTable.status, ["pending", "deferred"]),
        ),
      ),
  ]);
  const phraseByNormalized = new Map(
    phrases.map((phrase) => [phrase.normalizedPhrase, phrase]),
  );
  for (const item of inboxItems) {
    const transcriptPhraseId =
      item.status === "pending" && item.workingMeaning
        ? (phraseByNormalized.get(item.normalizedPhrase)?.id ?? null)
        : null;
    await transaction
      .update(childPhraseInboxItemsTable)
      .set({ transcriptPhraseId, updatedAt: new Date() })
      .where(eq(childPhraseInboxItemsTable.id, item.id));
  }
};

const syncChildPhraseInboxForReviews = async (
  transaction: any,
  transcript: typeof sessionTranscriptsTable.$inferSelect,
  organizationId: number,
  reviewedByUserId: string,
  segments: Array<typeof transcriptSpeakerSegmentsTable.$inferSelect>,
  reviews: Array<{
    segmentId: number;
    disposition: string;
    meaning?: string | null;
  }>,
) => {
  const summary = {
    createdCount: 0,
    updatedCount: 0,
    excludedCount: 0,
  };
  const existingRows: Array<typeof childPhraseInboxItemsTable.$inferSelect> =
    await transaction
      .select()
      .from(childPhraseInboxItemsTable)
      .where(eq(childPhraseInboxItemsTable.transcriptId, transcript.id));
  const transcriptPhrases: Array<typeof transcriptPhrasesTable.$inferSelect> =
    await transaction
      .select()
      .from(transcriptPhrasesTable)
      .where(eq(transcriptPhrasesTable.transcriptId, transcript.id));
  const transcriptPhraseByNormalized = new Map(
    transcriptPhrases.map((phrase) => [phrase.normalizedPhrase, phrase]),
  );
  const existingBySegmentId = new Map(
    existingRows.map((item) => [item.segmentId, item]),
  );
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  for (const review of reviews) {
    const segment = segmentById.get(review.segmentId);
    if (!segment) continue;
    const existing = existingBySegmentId.get(review.segmentId);
    const isChild =
      review.disposition === "child" ||
      review.disposition === "confirmed_gestalt";
    if (!isChild) {
      if (existing && existing.status !== "dictionary_added") {
        await transaction
          .update(childPhraseInboxItemsTable)
          .set({
            reviewDisposition: review.disposition,
            status: "excluded",
            transcriptPhraseId: null,
            reviewedByUserId,
            updatedAt: new Date(),
          })
          .where(eq(childPhraseInboxItemsTable.id, existing.id));
        summary.excludedCount += 1;
      }
      continue;
    }
    const phrase = evidenceSafeTranscriptText(segment.text).trim();
    if (!phrase) continue;
    const nextStatus =
      existing?.status === "dictionary_added" || existing?.status === "deferred"
        ? existing.status
        : "pending";
    const transcriptPhraseId =
      transcriptPhraseByNormalized.get(normalizePhrase(phrase))?.id ?? null;
    await transaction
      .insert(childPhraseInboxItemsTable)
      .values({
        organizationId,
        childId: transcript.childId,
        transcriptId: transcript.id,
        segmentId: segment.id,
        transcriptPhraseId,
        phrase,
        normalizedPhrase: normalizePhrase(phrase),
        reviewDisposition: review.disposition,
        status: nextStatus,
        workingMeaning:
          review.meaning?.trim() || existing?.workingMeaning || null,
        reviewedByUserId,
      })
      .onConflictDoUpdate({
        target: [
          childPhraseInboxItemsTable.transcriptId,
          childPhraseInboxItemsTable.segmentId,
        ],
        set: {
          phrase,
          normalizedPhrase: normalizePhrase(phrase),
          reviewDisposition: review.disposition,
          transcriptPhraseId,
          status: nextStatus,
          workingMeaning:
            review.meaning?.trim() || existing?.workingMeaning || null,
          reviewedByUserId,
          updatedAt: new Date(),
        },
      });
    if (existing) summary.updatedCount += 1;
    else summary.createdCount += 1;
  }
  return summary;
};

const childPhraseInboxResponse = (
  item: typeof childPhraseInboxItemsTable.$inferSelect,
) => ({
  id: item.id,
  childId: item.childId,
  transcriptId: item.transcriptId,
  transcriptPhraseId: item.transcriptPhraseId,
  segmentId: item.segmentId,
  phrase: item.phrase,
  workingMeaning: item.workingMeaning,
  reviewDisposition: item.reviewDisposition,
  status: item.status,
  sourceLabel: "Confirmed Child transcript" as const,
  updatedAt: item.updatedAt,
});

const ensureManualTranscriptReviewSegments = async (
  transcript: typeof sessionTranscriptsTable.$inferSelect,
) => {
  if (
    transcript.status !== "complete" ||
    !transcript.rawTranscript.trim() ||
    !["manual", "unavailable", "failed"].includes(
      transcript.speakerSeparationStatus,
    )
  )
    return;
  const fallbackSegments = manualTranscriptReviewSegments(
    transcript.rawTranscript,
  );
  if (!fallbackSegments.length) return;
  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(71992, ${transcript.id})`,
    );
    const [existingSegment] = await transaction
      .select({ id: transcriptSpeakerSegmentsTable.id })
      .from(transcriptSpeakerSegmentsTable)
      .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id))
      .limit(1);
    if (existingSegment) return;
    await transaction.insert(transcriptSpeakerSegmentsTable).values(
      fallbackSegments.map((segment) => ({
        transcriptId: transcript.id,
        speakerLabel: segment.speakerLabel,
        text: segment.text,
        position: segment.position,
        speakerConfidence: segment.confidence,
        speakerConfidenceScore: null,
        intelligibility: segment.intelligibility,
        transcriptionConfidenceScore: null,
        startTimeMilliseconds: null,
        durationMilliseconds: null,
        profileSignatureHash: null,
      })),
    );
  });
};

const hasStartedManualTranscriptReview = async (transcriptId: number) => {
  const [review] = await db
    .select({ id: transcriptChildUtteranceReviewsTable.id })
    .from(transcriptChildUtteranceReviewsTable)
    .innerJoin(
      transcriptSpeakerSegmentsTable,
      eq(
        transcriptSpeakerSegmentsTable.id,
        transcriptChildUtteranceReviewsTable.segmentId,
      ),
    )
    .where(
      and(
        eq(transcriptChildUtteranceReviewsTable.transcriptId, transcriptId),
        eq(
          transcriptSpeakerSegmentsTable.speakerLabel,
          MANUAL_TRANSCRIPT_REVIEW_LABEL,
        ),
      ),
    )
    .limit(1);
  return Boolean(review);
};

const childLanguagePromptSummaryFor = (
  segments: Array<{
    text: string;
    role: SpeakerRole;
    intelligibility: string;
  }>,
) => {
  const childTexts = segments
    .filter(
      (segment) =>
        segment.role === "child" && segment.intelligibility === "intelligible",
    )
    .map((segment) => segment.text);
  const candidatePhrases = segmentTranscript(childTexts);
  const possibleFunctions = new Set<string>();
  for (const text of childTexts) {
    const normalized = normalizePhrase(text);
    if (/\b(help|more|want|please|can i)\b/u.test(normalized))
      possibleFunctions.add("request");
    if (/\b(no|stop|dont|don’t|enough)\b/u.test(normalized))
      possibleFunctions.add("boundary");
    if (/\b(look|wow|yay|fun|again)\b/u.test(normalized))
      possibleFunctions.add("connection");
  }
  return {
    utteranceCount: childTexts.length,
    possibleGestaltCount: candidatePhrases.length,
    possibleMitigationCount: candidatePhrases.filter(
      (phrase) => phrase.frequency > 1,
    ).length,
    possibleCommunicationFunctionCount: possibleFunctions.size,
  };
};

const transcriptResponse = async (
  transcript: typeof sessionTranscriptsTable.$inferSelect,
  organizationId: number,
) => {
  await ensureManualTranscriptReviewSegments(transcript);
  const speakerContext = await loadSpeakerContext(transcript, organizationId);
  const [
    phraseRows,
    provisionalPhraseRows,
    utteranceReviewRows,
    childPhraseInboxRows,
    audioRecord,
    insightRun,
  ] = await Promise.all([
    db
      .select()
      .from(transcriptPhrasesTable)
      .where(eq(transcriptPhrasesTable.transcriptId, transcript.id)),
    db
      .select()
      .from(transcriptProvisionalPhrasesTable)
      .where(eq(transcriptProvisionalPhrasesTable.transcriptId, transcript.id))
      .orderBy(
        desc(transcriptProvisionalPhrasesTable.frequency),
        transcriptProvisionalPhrasesTable.id,
      ),
    db
      .select()
      .from(transcriptChildUtteranceReviewsTable)
      .where(
        eq(transcriptChildUtteranceReviewsTable.transcriptId, transcript.id),
      ),
    db
      .select({ id: childPhraseInboxItemsTable.id })
      .from(childPhraseInboxItemsTable)
      .where(
        and(
          eq(childPhraseInboxItemsTable.transcriptId, transcript.id),
          inArray(childPhraseInboxItemsTable.status, [
            "pending",
            "deferred",
            "dictionary_added",
          ]),
        ),
      ),
    db
      .select()
      .from(sessionAudioObjectsTable)
      .where(
        and(
          eq(sessionAudioObjectsTable.id, transcript.audioId),
          eq(sessionAudioObjectsTable.organizationId, organizationId),
          eq(sessionAudioObjectsTable.childId, transcript.childId),
          isNull(sessionAudioObjectsTable.deletedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
    transcript.sessionId
      ? db
          .select()
          .from(clinicalKnowledgeInsightRunsTable)
          .where(
            eq(
              clinicalKnowledgeInsightRunsTable.triggerSessionId,
              transcript.sessionId,
            ),
          )
          .orderBy(desc(clinicalKnowledgeInsightRunsTable.createdAt))
          .limit(1)
          .then((rows) => rows[0])
      : Promise.resolve(undefined),
  ]);
  const reviewBySegmentId = new Map(
    utteranceReviewRows.map((review) => [review.segmentId, review]),
  );
  const clinicalGestalts = await db
    .select()
    .from(clinicalGestaltsTable)
    .where(
      and(
        eq(clinicalGestaltsTable.childId, transcript.childId),
        isNull(clinicalGestaltsTable.archivedAt),
      ),
    );
  const matchedGestalts = clinicalGestalts.map(gestaltFromRecord);
  const occurrences = await ensureOccurrenceIndex(
    transcript.childId,
    matchedGestalts,
  );
  const occurrenceByPhrase = new Map(
    occurrences.map((entry) => [matchPhraseKey(entry.normalizedPhrase), entry]),
  );
  const gestaltByPhrase = new Map(
    matchedGestalts.map((entry) => [matchPhraseKey(entry.phrase), entry]),
  );
  const reviewableSegments = speakerContext.segments;
  const exactCounts = new Map<string, number>();
  for (const segment of reviewableSegments) {
    const key = normalizePhrase(evidenceSafeTranscriptText(segment.text));
    if (key) exactCounts.set(key, (exactCounts.get(key) ?? 0) + 1);
  }
  const rankedUtterances = reviewableSegments
    .map((segment) => {
      const key = normalizePhrase(evidenceSafeTranscriptText(segment.text));
      const repeatedInSession = Math.max(1, exactCounts.get(key) ?? 1);
      const wordCount = key ? key.split(/\s+/u).filter(Boolean).length : 0;
      const previouslyObserved = gestaltByPhrase.has(matchPhraseKey(key));
      const priorityReasons: Array<
        "repeated" | "distinct" | "longer" | "new" | "high_confidence"
      > = [];
      if (repeatedInSession > 1) priorityReasons.push("repeated");
      if (repeatedInSession === 1 && wordCount > 0)
        priorityReasons.push("distinct");
      if (wordCount >= 5) priorityReasons.push("longer");
      if (key && !previouslyObserved) priorityReasons.push("new");
      if ((segment.transcriptionConfidenceScore ?? 0) >= 80)
        priorityReasons.push("high_confidence");
      const priorityScore =
        (repeatedInSession > 1 ? 500 + repeatedInSession * 20 : 0) +
        (repeatedInSession === 1 && wordCount > 0 ? 80 : 0) +
        Math.min(wordCount, 20) * 8 +
        (key && !previouslyObserved ? 100 : 0) +
        (segment.transcriptionConfidenceScore ?? 0);
      return {
        segment,
        repeatedInSession,
        wordCount,
        previouslyObserved,
        priorityReasons,
        priorityScore,
      };
    })
    .sort(
      (left, right) =>
        right.priorityScore - left.priorityScore ||
        left.segment.position - right.segment.position ||
        left.segment.id - right.segment.id,
    );
  const normalizedDisposition = (
    value: string | undefined,
    unintelligible: boolean,
  ) => value ?? (unintelligible ? "pending" : "pending");
  const progressDispositions = utteranceReviewRows.map(
    (review) => review.disposition,
  );
  const reviewProgress = sessionReviewProgressFor(
    reviewableSegments.length,
    progressDispositions,
    childPhraseInboxRows.length,
  );
  const calibrationRows = audioRecord?.preparationId
    ? await db
        .select({
          status: sessionAudioObjectsTable.status,
        })
        .from(sessionAudioObjectsTable)
        .where(
          and(
            eq(sessionAudioObjectsTable.organizationId, organizationId),
            eq(sessionAudioObjectsTable.childId, transcript.childId),
            eq(
              sessionAudioObjectsTable.preparationId,
              audioRecord.preparationId,
            ),
            eq(sessionAudioObjectsTable.purpose, "speaker_calibration"),
            isNull(sessionAudioObjectsTable.deletedAt),
          ),
        )
    : [];
  const calibrationStatus = calibrationRows.some(
    (item) => item.status === "ready",
  )
    ? "stored_only"
    : calibrationRows.length
      ? "unavailable"
      : "not_provided";
  const calibrationStatusMessage =
    calibrationStatus === "stored_only"
      ? "Calibration was stored with this prepared recording but was not used by the current speaker-identification provider."
      : calibrationStatus === "unavailable"
        ? "A calibration reference was attempted but was not available for speaker identification."
        : "No calibration reference was provided for this recording.";
  const speakerSeparationStatus =
    transcript.speakerSeparationStatus === "complete"
      ? "completed"
      : transcript.speakerSeparationStatus === "manual"
        ? "unavailable"
        : transcript.speakerSeparationStatus === "processing"
          ? "processing"
          : transcript.speakerSeparationStatus === "failed"
            ? "failed"
            : transcript.speakerSeparationStatus === "unavailable"
              ? "unavailable"
              : "pending";
  const assignedSpeakers = speakerContext.speakers.filter(
    (speaker) => speaker.role !== "unassigned" && speaker.role !== "unknown",
  );
  const reviewedProvisionalCount = provisionalPhraseRows.filter(
    (phrase) => phrase.disposition !== "pending",
  ).length;
  const insightStatus =
    insightRun?.status === "completed"
      ? "completed"
      : insightRun?.status === "running" || insightRun?.status === "queued"
        ? "processing"
        : insightRun?.status === "failed"
          ? "failed"
          : transcript.sessionId
            ? "pending"
            : "blocked";

  return {
    id: transcript.id,
    childId: transcript.childId,
    audioId: transcript.audioId,
    recordingConsentConfirmedAt:
      audioRecord?.consentConfirmedAt?.toISOString() ?? null,
    status: transcript.status,
    rawTranscript: transcript.rawTranscript,
    speakerSeparationStatus,
    speakerSeparationAttempt: transcript.speakerSeparationAttempt,
    speakerSeparationFailureCode: transcript.speakerSeparationFailureCode,
    speakerSeparationFailureMessage: transcript.speakerSeparationFailureMessage,
    calibrationStatus,
    calibrationStatusMessage,
    processingStages: [
      {
        stage: "recording",
        label: "Recording",
        status: "completed",
        reason: null,
      },
      {
        stage: "upload",
        label: "Private upload",
        status: audioRecord ? "completed" : "unavailable",
        reason: audioRecord
          ? null
          : "The original upload record is unavailable, but the completed transcript remains preserved.",
      },
      {
        stage: "transcription",
        label: "Transcription",
        status:
          transcript.status === "complete"
            ? "completed"
            : transcript.status === "failed"
              ? "failed"
              : "processing",
        reason: transcript.status === "failed" ? transcript.errorMessage : null,
      },
      {
        stage: "speaker_grouping",
        label: "Speaker grouping",
        status: speakerSeparationStatus,
        reason: transcript.speakerSeparationFailureMessage,
      },
      {
        stage: "clinician_identification",
        label: "Clinician identification",
        status: assignedSpeakers.length
          ? "completed"
          : speakerContext.speakers.length
            ? "pending"
            : speakerSeparationStatus === "failed" ||
                speakerSeparationStatus === "unavailable"
              ? "unavailable"
              : "pending",
        reason: assignedSpeakers.length
          ? null
          : speakerContext.speakers.length
            ? "Confirm a clinical role for each temporary speaker group."
            : "No temporary speaker groups are available yet.",
      },
      {
        stage: "phrase_extraction",
        label: "Phrase review",
        status:
          phraseRows.length || provisionalPhraseRows.length
            ? "completed"
            : "pending",
        reason: phraseRows.length
          ? null
          : provisionalPhraseRows.length
            ? "Mixed-speaker provisional candidates are ready for review."
            : "EchoMap is preparing phrase candidates from the completed transcript.",
      },
      {
        stage: "gestalt_review",
        label: "Gestalt review",
        status: phraseRows.length
          ? "completed"
          : reviewedProvisionalCount
            ? "processing"
            : provisionalPhraseRows.length
              ? "pending"
              : "blocked",
        reason: phraseRows.length
          ? null
          : "Provisional decisions remain outside clinical evidence until Child attribution and meaning-backed review are complete.",
      },
      {
        stage: "insight_generation",
        label: "Insight generation",
        status: insightStatus,
        reason: transcript.sessionId
          ? (insightRun?.failureCode ?? null)
          : "Insights begin only after a reviewed session is saved.",
      },
    ],
    provider: transcript.provider,
    model: transcript.provider.includes(TRANSCRIPTION_MODEL)
      ? TRANSCRIPTION_MODEL
      : "not recorded",
    transcriptionAttempted: transcript.status !== "processing",
    transcriptionSucceeded: transcript.status === "complete",
    speakers: speakerContext.speakers,
    segments: speakerContext.segments.map(
      ({
        id,
        speakerLabel,
        text,
        position,
        speakerConfidence,
        speakerConfidenceScore,
        intelligibility,
        transcriptionConfidenceScore,
        startTimeMilliseconds,
        durationMilliseconds,
        speakerReviewed,
        role,
      }) => ({
        id,
        speakerLabel,
        text,
        position,
        speakerConfidence,
        speakerConfidenceScore,
        intelligibility,
        transcriptionConfidenceScore,
        startTimeMilliseconds,
        durationMilliseconds,
        speakerReviewed,
        role,
      }),
    ),
    childUtterances: rankedUtterances.map((ranked, index) => {
      const segment = ranked.segment;
      const review = reviewBySegmentId.get(segment.id);
      const unintelligible = segment.intelligibility === "unintelligible";
      const partial = segment.intelligibility === "partially_intelligible";
      return {
        id: review?.id ?? 0,
        segmentId: segment.id,
        text: unintelligible ? "Unintelligible vocalization" : segment.text,
        suggestedTranscription: partial ? segment.text || null : null,
        speakerLabel: segment.speakerLabel,
        position: segment.position,
        timestampSeconds:
          segment.startTimeMilliseconds === null
            ? null
            : Number((segment.startTimeMilliseconds / 1000).toFixed(2)),
        durationSeconds:
          segment.durationMilliseconds === null
            ? null
            : Number((segment.durationMilliseconds / 1000).toFixed(2)),
        intelligibility: segment.intelligibility ?? "intelligible",
        transcriptionConfidenceScore: segment.transcriptionConfidenceScore,
        intelligibilityReviewStatus:
          review?.intelligibilityReviewStatus ??
          (segment.intelligibility === "intelligible"
            ? "confirmed"
            : "pending"),
        disposition: normalizedDisposition(review?.disposition, unintelligible),
        reviewRank: index + 1,
        priorityScore: ranked.priorityScore,
        priorityReasons: ranked.priorityReasons,
        repeatedInSession: ranked.repeatedInSession,
        previouslyObserved: ranked.previouslyObserved,
        wordCount: ranked.wordCount,
        context: review?.context ?? null,
        meaning: review?.meaning ?? null,
        interpretation: review?.interpretation ?? null,
        note: review?.note ?? null,
        crossSessionLabel: review?.crossSessionLabel ?? null,
        nlaStage: review?.nlaStage ?? null,
        updatedAt: (review?.updatedAt ?? transcript.updatedAt).toISOString(),
      };
    }),
    reviewProgress: {
      ...reviewProgress,
      phraseCandidates: phraseRows.length,
    },
    childLanguagePrompts: childLanguagePromptSummaryFor(
      speakerContext.segments,
    ),
    provisionalPhrases: provisionalPhraseRows.map((phrase) => ({
      id: phrase.id,
      phrase: phrase.phrase,
      frequency: phrase.frequency,
      candidateKind: phrase.candidateKind,
      disposition: phrase.disposition,
      workingMeaning: phrase.workingMeaning,
      attributionLabel: "Speaker attribution pending",
      sourceLabel: "Mixed-speaker transcript",
      evidenceLabel: "Not clinical evidence",
      updatedAt: phrase.updatedAt.toISOString(),
    })),
    phrases: phraseRows.map((phrase) => {
      const phraseKey = matchPhraseKey(phrase.normalizedPhrase);
      const occurrence = occurrenceByPhrase.get(phraseKey);
      const existing = gestaltByPhrase.get(phraseKey);
      const exampleUtterances = rankedUtterances
        .filter(({ segment }) => {
          const review = reviewBySegmentId.get(segment.id);
          const isChild =
            review?.disposition === "child" ||
            review?.disposition === "confirmed_gestalt";
          return (
            isChild &&
            matchPhraseKey(evidenceSafeTranscriptText(segment.text)).includes(
              phraseKey,
            )
          );
        })
        .map(({ segment }) => evidenceSafeTranscriptText(segment.text))
        .filter(Boolean)
        .slice(0, 3);
      return {
        id: phrase.id,
        phrase: phrase.phrase,
        frequency: phrase.frequency,
        childAttributed: phrase.attributedRole === "child",
        occurrenceCount: occurrence?.occurrenceCount ?? phrase.frequency,
        firstObservedAt: occurrence?.createdAt?.toISOString() ?? null,
        mostRecentAt: occurrence?.lastSeenAt?.toISOString() ?? null,
        exampleUtterances,
        existingGestalt:
          occurrence && existing
            ? {
                id: existing.id,
                phrase: existing.phrase,
                meaning: existing.meaning,
                source: existing.source,
                occurrences: occurrence.occurrenceCount,
                lastSeen: occurrence.lastSeenAt?.toISOString() ?? null,
              }
            : null,
      };
    }),
    error: transcript.errorMessage,
    createdAt: transcript.createdAt.toISOString(),
    updatedAt: transcript.updatedAt.toISOString(),
  };
};

type UnclearVocalizationOccurrenceResponse = {
  segmentId: number;
  transcriptId: number;
  sessionId: number;
  sessionDate: string;
  position: number;
  timestampSeconds: number | null;
  durationSeconds: number | null;
  intelligibility: "partially_intelligible" | "unintelligible";
  providerText: string;
  clinicianInterpretation: string | null;
  note: string | null;
  crossSessionLabel: string | null;
  revision: string | null;
};

const unclearTimingPattern = (durationMilliseconds: number | null) => {
  if (durationMilliseconds === null) return null;
  if (durationMilliseconds < 900) return "short";
  if (durationMilliseconds < 2_100) return "medium";
  return "long";
};

const unclearVocalizationReviewFor = async (
  childId: number,
  organizationId: number,
) => {
  const sessions = await db
    .select({
      id: therapySessionsTable.id,
      createdAt: therapySessionsTable.createdAt,
    })
    .from(therapySessionsTable)
    .where(
      and(
        eq(therapySessionsTable.organizationId, organizationId),
        eq(therapySessionsTable.childId, childId),
        isNull(therapySessionsTable.archivedAt),
      ),
    );
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const sessionIds = sessions.map((session) => session.id);
  if (!sessionIds.length) {
    return {
      childId,
      groups: [],
      occurrenceCount: 0,
      labeledCount: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  const transcripts = await db
    .select()
    .from(sessionTranscriptsTable)
    .where(
      and(
        eq(sessionTranscriptsTable.childId, childId),
        inArray(sessionTranscriptsTable.sessionId, sessionIds),
        eq(sessionTranscriptsTable.status, "complete"),
      ),
    );
  const transcriptById = new Map(
    transcripts.map((transcript) => [transcript.id, transcript]),
  );
  const transcriptIds = transcripts.map((transcript) => transcript.id);
  if (!transcriptIds.length) {
    return {
      childId,
      groups: [],
      occurrenceCount: 0,
      labeledCount: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  const [segments, roles, reviews] = await Promise.all([
    db
      .select()
      .from(transcriptSpeakerSegmentsTable)
      .where(
        and(
          inArray(transcriptSpeakerSegmentsTable.transcriptId, transcriptIds),
          or(
            eq(
              transcriptSpeakerSegmentsTable.intelligibility,
              "partially_intelligible",
            ),
            eq(
              transcriptSpeakerSegmentsTable.intelligibility,
              "unintelligible",
            ),
          ),
        ),
      ),
    db
      .select()
      .from(transcriptSpeakerRolesTable)
      .where(inArray(transcriptSpeakerRolesTable.transcriptId, transcriptIds)),
    db
      .select()
      .from(transcriptChildUtteranceReviewsTable)
      .where(
        inArray(
          transcriptChildUtteranceReviewsTable.transcriptId,
          transcriptIds,
        ),
      ),
  ]);
  const childRoleKeys = new Set(
    roles
      .filter((role) => normalizedSpeakerRole(role.role) === "child")
      .map((role) => `${role.transcriptId}:${role.speakerLabel}`),
  );
  const reviewBySegmentId = new Map(
    reviews.map((review) => [review.segmentId, review]),
  );
  const occurrences: UnclearVocalizationOccurrenceResponse[] = segments
    .filter((segment) =>
      childRoleKeys.has(`${segment.transcriptId}:${segment.speakerLabel}`),
    )
    .flatMap((segment) => {
      const transcript = transcriptById.get(segment.transcriptId);
      const session = transcript?.sessionId
        ? sessionById.get(transcript.sessionId)
        : undefined;
      if (
        !transcript ||
        !session ||
        (segment.intelligibility !== "partially_intelligible" &&
          segment.intelligibility !== "unintelligible")
      )
        return [];
      const review = reviewBySegmentId.get(segment.id);
      return [
        {
          segmentId: segment.id,
          transcriptId: transcript.id,
          sessionId: session.id,
          sessionDate: session.createdAt.toISOString(),
          position: segment.position,
          timestampSeconds:
            segment.startTimeMilliseconds === null
              ? null
              : Number((segment.startTimeMilliseconds / 1_000).toFixed(2)),
          durationSeconds:
            segment.durationMilliseconds === null
              ? null
              : Number((segment.durationMilliseconds / 1_000).toFixed(2)),
          intelligibility: segment.intelligibility as
            "partially_intelligible" | "unintelligible",
          providerText: segment.text,
          clinicianInterpretation: review?.interpretation ?? null,
          note: review?.note ?? null,
          crossSessionLabel: review?.crossSessionLabel ?? null,
          revision: review?.updatedAt.toISOString() ?? null,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.sessionDate.localeCompare(left.sessionDate) ||
        left.position - right.position,
    );

  const grouped = new Map<
    string,
    {
      source:
        | "clinician_label"
        | "provider_text"
        | "timing_pattern"
        | "single_occurrence";
      label: string | null;
      patternLabel: string | null;
      occurrences: UnclearVocalizationOccurrenceResponse[];
    }
  >();
  for (const occurrence of occurrences) {
    const clinicianLabel = occurrence.crossSessionLabel?.trim() || null;
    const providerPattern =
      occurrence.intelligibility === "partially_intelligible"
        ? normalizePhrase(evidenceSafeTranscriptText(occurrence.providerText))
        : "";
    const transcriptSegment = segments.find(
      (segment) => segment.id === occurrence.segmentId,
    );
    const timingPattern = unclearTimingPattern(
      transcriptSegment?.durationMilliseconds ?? null,
    );
    const grouping = clinicianLabel
      ? {
          key: `label:${clinicianLabel.toLocaleLowerCase()}`,
          source: "clinician_label" as const,
          label: clinicianLabel,
          patternLabel: null,
        }
      : providerPattern
        ? {
            key: `provider:${providerPattern}`,
            source: "provider_text" as const,
            label: null,
            patternLabel: providerPattern,
          }
        : timingPattern
          ? {
              key: `timing:${timingPattern}`,
              source: "timing_pattern" as const,
              label: null,
              patternLabel: timingPattern,
            }
          : {
              key: `single:${occurrence.segmentId}`,
              source: "single_occurrence" as const,
              label: null,
              patternLabel: null,
            };
    const current = grouped.get(grouping.key);
    if (current) current.occurrences.push(occurrence);
    else
      grouped.set(grouping.key, {
        source: grouping.source,
        label: grouping.label,
        patternLabel: grouping.patternLabel,
        occurrences: [occurrence],
      });
  }

  const groups = [...grouped.entries()]
    .map(([key, group]) => {
      const source =
        group.occurrences.length === 1 && group.source !== "clinician_label"
          ? ("single_occurrence" as const)
          : group.source;
      const sessionCount = new Set(
        group.occurrences.map((occurrence) => occurrence.sessionId),
      ).size;
      const reviewPrompt =
        source === "clinician_label"
          ? `Review ${group.occurrences.length} occurrence${group.occurrences.length === 1 ? "" : "s"} carrying the clinician label “${group.label}”.`
          : source === "provider_text"
            ? `Possible recurrence: the provider returned the same partial text in ${sessionCount} session${sessionCount === 1 ? "" : "s"}. Confirm whether these belong together.`
            : source === "timing_pattern"
              ? `Possible recurrence: ${group.occurrences.length} unclear vocalizations had a similar ${group.patternLabel} recorded duration. Confirm whether they belong together.`
              : "Review this preserved unclear vocalization and label it only if a cross-session pattern is clinically useful.";
      return {
        id: createHash("sha256").update(key).digest("hex").slice(0, 16),
        reviewPrompt,
        source,
        label: group.label,
        occurrenceCount: group.occurrences.length,
        sessionCount,
        occurrences: group.occurrences,
      };
    })
    .sort(
      (left, right) =>
        Number(Boolean(right.label)) - Number(Boolean(left.label)) ||
        right.sessionCount - left.sessionCount ||
        right.occurrenceCount - left.occurrenceCount,
    );

  return {
    childId,
    groups,
    occurrenceCount: occurrences.length,
    labeledCount: occurrences.filter((occurrence) =>
      Boolean(occurrence.crossSessionLabel),
    ).length,
    generatedAt: new Date().toISOString(),
  };
};

const activeSpeakerSeparations = new Map<number, number>();

const safeSpeakerSeparationFailure = (error?: unknown) => {
  if (!error) {
    return {
      status: "unavailable" as const,
      code: "EMPTY_GROUPING_RESULT",
      message:
        "Speaker grouping did not return usable temporary turns. The transcript and provisional phrase review remain available.",
    };
  }
  const text = error instanceof Error ? error.message.toLowerCase() : "";
  if (/timed? ?out|timeout|abort/u.test(text)) {
    return {
      status: "failed" as const,
      code: "SPEAKER_GROUPING_TIMEOUT",
      message:
        "Speaker grouping took too long to complete. The transcript and provisional phrase review remain available.",
    };
  }
  if (/429|rate.?limit|too many requests/u.test(text)) {
    return {
      status: "failed" as const,
      code: "SPEAKER_PROVIDER_BUSY",
      message:
        "The speaker-grouping service was temporarily busy. The transcript and provisional phrase review remain available.",
    };
  }
  return {
    status: "failed" as const,
    code: "SPEAKER_PROVIDER_FAILED",
    message:
      "Speaker grouping could not complete. The transcript and provisional phrase review remain available.",
  };
};

const persistSpeakerSegments = async (
  transcript: typeof sessionTranscriptsTable.$inferSelect,
  segments: SpeakerSegment[],
  speakerSeparationStatus: "complete" | "unavailable" | "failed",
  failure?: { code: string; message: string },
) => {
  return db.transaction(async (transaction) => {
    const [claimedAttempt] = await transaction
      .update(sessionTranscriptsTable)
      .set({
        speakerSeparationStatus,
        speakerSeparationCompletedAt: new Date(),
        speakerSeparationFailureCode: failure?.code ?? null,
        speakerSeparationFailureMessage: failure?.message ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sessionTranscriptsTable.id, transcript.id),
          eq(sessionTranscriptsTable.speakerSeparationStatus, "processing"),
          eq(
            sessionTranscriptsTable.speakerSeparationAttempt,
            transcript.speakerSeparationAttempt,
          ),
        ),
      )
      .returning({ id: sessionTranscriptsTable.id });
    if (!claimedAttempt) return false;
    await transaction
      .delete(transcriptSpeakerSegmentsTable)
      .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id));
    if (segments.length) {
      await transaction.insert(transcriptSpeakerSegmentsTable).values(
        segments.map((segment) => ({
          transcriptId: transcript.id,
          speakerLabel: segment.speakerLabel,
          text: segment.text,
          position: segment.position,
          speakerConfidence: segment.confidence,
          speakerConfidenceScore: segment.confidenceScore ?? null,
          intelligibility: segment.intelligibility,
          transcriptionConfidenceScore:
            segment.transcriptionConfidenceScore ?? null,
          startTimeMilliseconds: segment.startTimeMilliseconds ?? null,
          durationMilliseconds: segment.durationMilliseconds ?? null,
          profileSignatureHash: segment.profileSignature
            ? profileSignatureHashFor(segment.profileSignature)
            : null,
        })),
      );
    }
    return true;
  });
};

const queueSpeakerSeparation = async (
  transcript: typeof sessionTranscriptsTable.$inferSelect,
  audioData: Buffer,
  req: Request,
) => {
  if (transcript.speakerSeparationStatus !== "pending") return;
  let claimed: typeof sessionTranscriptsTable.$inferSelect | undefined;
  try {
    [claimed] = await db
      .update(sessionTranscriptsTable)
      .set({
        speakerSeparationStatus: "processing",
        speakerSeparationAttempt: sql`${sessionTranscriptsTable.speakerSeparationAttempt} + 1`,
        speakerSeparationStartedAt: new Date(),
        speakerSeparationCompletedAt: null,
        speakerSeparationFailureCode: null,
        speakerSeparationFailureMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sessionTranscriptsTable.id, transcript.id),
          eq(sessionTranscriptsTable.speakerSeparationStatus, "pending"),
        ),
      )
      .returning();
  } catch (error) {
    throw error;
  }
  if (!claimed) return;
  activeSpeakerSeparations.set(transcript.id, claimed.speakerSeparationAttempt);
  scheduleOptionalSpeakerSeparation(
    () => separateTranscriptSpeakers(audioData),
    async (separatedSegments) => {
      try {
        const persisted = await persistSpeakerSegments(
          claimed,
          separatedSegments,
          "complete",
        );
        if (persisted)
          req.log.info(
            {
              transcriptId: transcript.id,
              childId: transcript.childId,
              speakersDetected: new Set(
                separatedSegments.map((segment) => segment.speakerLabel),
              ).size,
            },
            "Optional speaker separation completed",
          );
      } finally {
        if (
          activeSpeakerSeparations.get(transcript.id) ===
          claimed.speakerSeparationAttempt
        ) {
          activeSpeakerSeparations.delete(transcript.id);
        }
      }
    },
    async (error) => {
      try {
        const failure = safeSpeakerSeparationFailure(error);
        const persisted = await persistSpeakerSegments(
          claimed,
          manualTranscriptReviewSegments(claimed.rawTranscript),
          failure.status,
          failure,
        );
        if (persisted)
          req.log.info(
            {
              transcriptId: transcript.id,
              childId: transcript.childId,
              code: failure.code,
              status: failure.status,
            },
            "Speaker separation unavailable; preserving raw transcript without inferred groups",
          );
      } finally {
        if (
          activeSpeakerSeparations.get(transcript.id) ===
          claimed.speakerSeparationAttempt
        ) {
          activeSpeakerSeparations.delete(transcript.id);
        }
      }
    },
  );
};

const markSpeakerSeparationUnavailable = (
  transcript: typeof sessionTranscriptsTable.$inferSelect,
  req: Request,
) => {
  if (transcript.speakerSeparationStatus !== "pending") return;
  const failure = {
    code: "SPEAKER_AUDIO_UNAVAILABLE",
    message:
      "The recording could not be reopened for speaker grouping. The transcript and provisional phrase review remain available.",
  };
  void db
    .update(sessionTranscriptsTable)
    .set({
      speakerSeparationStatus: "failed",
      speakerSeparationAttempt: sql`${sessionTranscriptsTable.speakerSeparationAttempt} + 1`,
      speakerSeparationStartedAt: new Date(),
      speakerSeparationCompletedAt: new Date(),
      speakerSeparationFailureCode: failure.code,
      speakerSeparationFailureMessage: failure.message,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sessionTranscriptsTable.id, transcript.id),
        eq(sessionTranscriptsTable.speakerSeparationStatus, "pending"),
      ),
    )
    .returning({ id: sessionTranscriptsTable.id })
    .then(async (rows) => {
      if (!rows.length) return;
      await ensureManualTranscriptReviewSegments({
        ...transcript,
        speakerSeparationStatus: "failed",
      });
      req.log.info(
        {
          transcriptId: transcript.id,
          childId: transcript.childId,
        },
        "Speaker separation unavailable; preserving raw transcript without inferred groups",
      );
    });
};

const applyTranscriptOccurrences = async (
  transcriptId: number,
  childId: number,
  sessionId: number,
  reviewedGestalts: SessionGestalt[],
  gestaltIds: number[],
) => {
  const transcript = (
    await db
      .select({ provider: sessionTranscriptsTable.provider })
      .from(sessionTranscriptsTable)
      .where(eq(sessionTranscriptsTable.id, transcriptId))
      .limit(1)
  )[0];
  if (!transcript) return;
  const childSegments = transcript.provider.includes(TRANSCRIPTION_MODEL)
    ? await db
        .select({ id: transcriptSpeakerSegmentsTable.id })
        .from(transcriptSpeakerSegmentsTable)
        .innerJoin(
          transcriptSpeakerRolesTable,
          and(
            eq(transcriptSpeakerRolesTable.transcriptId, transcriptId),
            eq(
              transcriptSpeakerRolesTable.speakerLabel,
              transcriptSpeakerSegmentsTable.speakerLabel,
            ),
          ),
        )
        .where(
          and(
            eq(transcriptSpeakerSegmentsTable.transcriptId, transcriptId),
            eq(transcriptSpeakerRolesTable.role, "child"),
          ),
        )
        .limit(1)
    : await db
        .select({ id: transcriptSpeakerSegmentsTable.id })
        .from(transcriptSpeakerSegmentsTable)
        .innerJoin(
          childSpeakerRolesTable,
          and(
            eq(childSpeakerRolesTable.childId, childId),
            eq(
              childSpeakerRolesTable.speakerLabel,
              transcriptSpeakerSegmentsTable.speakerLabel,
            ),
          ),
        )
        .where(
          and(
            eq(transcriptSpeakerSegmentsTable.transcriptId, transcriptId),
            eq(childSpeakerRolesTable.role, "child"),
          ),
        )
        .limit(1);
  // Unassigned speakers cannot update a child's history.
  if (!childSegments.length) return;
  const phraseIds = [
    ...new Set(
      reviewedGestalts
        .map((gestalt) => gestalt.transcriptPhraseId)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];

  await db.transaction(async (transaction) => {
    const claimed = await transaction
      .update(sessionTranscriptsTable)
      .set({
        sessionId,
        occurrenceAppliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sessionTranscriptsTable.id, transcriptId),
          eq(sessionTranscriptsTable.childId, childId),
          isNull(sessionTranscriptsTable.occurrenceAppliedAt),
        ),
      )
      .returning({ id: sessionTranscriptsTable.id });
    if (!claimed.length || !phraseIds.length) return;

    const phraseRows = await transaction
      .select()
      .from(transcriptPhrasesTable)
      .where(
        and(
          eq(transcriptPhrasesTable.transcriptId, transcriptId),
          inArray(transcriptPhrasesTable.id, phraseIds),
        ),
      );
    const phraseById = new Map(phraseRows.map((entry) => [entry.id, entry]));
    const occurrences = await transaction
      .select()
      .from(gestaltOccurrencesTable)
      .where(eq(gestaltOccurrencesTable.childId, childId));
    const occurrenceByPhrase = new Map(
      occurrences.map((entry) => [
        matchPhraseKey(entry.normalizedPhrase),
        entry,
      ]),
    );
    const seenPhraseIds = new Set<number>();
    const seenAt = new Date();

    for (const [reviewedIndex, reviewed] of reviewedGestalts.entries()) {
      const phraseId = reviewed.transcriptPhraseId;
      if (typeof phraseId !== "number" || seenPhraseIds.has(phraseId)) continue;
      seenPhraseIds.add(phraseId);
      const detected = phraseById.get(phraseId);
      if (!detected) continue;
      const reviewedNormalized = normalizePhrase(reviewed.phrase);
      const canonicalKey = matchPhraseKey(reviewedNormalized);
      const occurrence = occurrenceByPhrase.get(canonicalKey);
      const increment =
        matchPhraseKey(reviewedNormalized) ===
        matchPhraseKey(detected.normalizedPhrase)
          ? detected.frequency
          : 1;
      if (!occurrence) {
        const inserted = (
          await transaction
            .insert(gestaltOccurrencesTable)
            .values({
              childId,
              gestaltId: gestaltIds[reviewedIndex] ?? null,
              phrase: reviewed.phrase,
              normalizedPhrase: canonicalKey,
              occurrenceCount: increment,
              lastSeenAt: seenAt,
            })
            .onConflictDoUpdate({
              target: [
                gestaltOccurrencesTable.childId,
                gestaltOccurrencesTable.normalizedPhrase,
              ],
              set: {
                occurrenceCount: sql`${gestaltOccurrencesTable.occurrenceCount} + ${increment}`,
                lastSeenAt: seenAt,
                updatedAt: seenAt,
              },
            })
            .returning()
        )[0];
        if (inserted) occurrenceByPhrase.set(canonicalKey, inserted);
        continue;
      }
      await transaction
        .update(gestaltOccurrencesTable)
        .set({
          occurrenceCount: sql`${gestaltOccurrencesTable.occurrenceCount} + ${increment}`,
          lastSeenAt: seenAt,
          updatedAt: seenAt,
        })
        .where(eq(gestaltOccurrencesTable.id, occurrence.id));
    }
  });
};

const router: IRouter = Router();

router.post("/development/login", async (req, res): Promise<void> => {
  if (!runtimeConfig.demoLogin.enabled) {
    res.sendStatus(404);
    return;
  }
  try {
    await seedDevelopmentDemo();
    res.cookie(DEVELOPMENT_DEMO_COOKIE, "active", {
      httpOnly: true,
      sameSite: "lax",
      secure: runtimeConfig.isProduction,
      maxAge: 12 * 60 * 60 * 1000,
      path: "/",
    });
    req.log.info(
      { demoAccount: DEVELOPMENT_DEMO_EMAIL },
      "Development demo session started",
    );
    res.status(200).json({
      email: DEVELOPMENT_DEMO_EMAIL,
      role: "Administrator",
      organization: "EchoMap Demo",
    });
  } catch (error) {
    req.log.error(
      { err: error },
      "Could not start the development demo session",
    );
    res
      .status(500)
      .json({
        error: "The demo workspace could not be prepared. Please try again.",
      });
  }
});

router.post(
  "/development/speaker-review-fixture",
  async (req, res): Promise<void> => {
    if (!runtimeConfig.demoLogin.enabled) {
      res.sendStatus(404);
      return;
    }
    const actor = viewerFrom(req);
    if (!isNativeDevelopmentDemo(actor) || !actor?.organizationId) {
      res
        .status(401)
        .json({
          error:
            "Start the development demo before loading a speaker-review fixture.",
        });
      return;
    }
    const childId = Number(req.query.childId);
    if (
      !Number.isSafeInteger(childId) ||
      childId <= 0 ||
      !canAccessAssignedChild(actor, childId)
    ) {
      res
        .status(403)
        .json({
          error:
            "Choose an assigned child before loading a speaker-review fixture.",
        });
      return;
    }
    try {
      const transcript = await seedDevelopmentSpeakerReviewFixture({
        organizationId: actor.organizationId,
        childId,
        createdByUserId: actor.userId,
        createdBy: actor.author,
      });
      res
        .status(201)
        .json(await transcriptResponse(transcript, actor.organizationId));
    } catch (error) {
      req.log.error(
        { err: error },
        "Could not seed the development speaker-review fixture",
      );
      res
        .status(500)
        .json({ error: "The speaker-review fixture could not be prepared." });
    }
  },
);

router.get("/auth/viewer", (req, res) => {
  const actor = viewerFrom(req);
  const realActor = realViewerFrom(req);
  if (!actor || !realActor) {
    res
      .status(req.echomapAuthFailure ? 403 : 401)
      .json({ error: authenticationError(req) });
    return;
  }
  res.json(GetViewerResponse.parse(viewerResponse(actor, realActor.role)));
});

router.post("/admin/role-preview", async (req, res): Promise<void> => {
  const owner = requireSuperAdmin(req, res);
  if (!owner) return;
  const body = SetRolePreviewBody.safeParse(req.body);
  if (!body.success) {
    res
      .status(400)
      .json({ error: "Choose an SLP, Parent, Teacher, or Admin preview." });
    return;
  }
  res.cookie(ROLE_PREVIEW_COOKIE, body.data.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: runtimeConfig.isProduction,
    signed: true,
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
  await writeSecurityAudit({
    actor: owner,
    action: "ROLE_PREVIEW_UPDATED",
    targetType: "owner_testing",
    outcome: "success",
    metadata: { previewRole: body.data.role },
  });
  const effectiveActor: CareTeamActor = {
    ...owner,
    role: body.data.role,
    isAdmin: body.data.role === "Administrator",
    previewRole: body.data.role,
  };
  res.json(
    SetRolePreviewResponse.parse(viewerResponse(effectiveActor, owner.role)),
  );
});

router.delete("/admin/role-preview", async (req, res): Promise<void> => {
  const owner = requireSuperAdmin(req, res);
  if (!owner) return;
  res.clearCookie(ROLE_PREVIEW_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: runtimeConfig.isProduction,
    signed: true,
    path: "/",
  });
  await writeSecurityAudit({
    actor: owner,
    action: "ROLE_PREVIEW_CLEARED",
    targetType: "owner_testing",
    outcome: "success",
  });
  res.json(ClearRolePreviewResponse.parse(viewerResponse(owner, owner.role)));
});

router.get("/admin/ux-testing", async (req, res): Promise<void> => {
  const owner = requireSuperAdmin(req, res);
  if (!owner) return;
  if (viewerFrom(req)?.previewRole) {
    void writeSecurityAudit({
      actor: owner,
      action: "ROLE_PREVIEW_ACCESS_DENIED",
      targetType: "owner_testing",
      outcome: "failure",
    }).catch((error) =>
      req.log.warn(
        { err: error },
        "Could not audit preview-restricted owner-tools access",
      ),
    );
    res
      .status(403)
      .json({
        error: "Return to Super Admin view before using owner testing tools.",
      });
    return;
  }
  const payload = {
    sampleUser: {
      displayName: "Jordan Example",
      email: "sample-user@preview.invalid",
      role: "Parent" as const,
      childName: "Riley Example",
      description:
        "A fictional preview scenario. It never represents or signs in as a real care-team member.",
    },
    permissions: [
      {
        role: "SLP" as const,
        label: "SLP",
        capabilities: [
          "Role overview",
          "Shared dictionary",
          "Communication profile",
          "Shared observations",
          "Clinical sessions",
          "Clinical Knowledge",
          "Reports",
        ],
      },
      {
        role: "Parent" as const,
        label: "Parent",
        capabilities: [
          "Role overview",
          "Shared dictionary",
          "Communication profile",
          "Shared observations",
        ],
      },
      {
        role: "Teacher" as const,
        label: "Teacher",
        capabilities: [
          "Role overview",
          "Shared dictionary",
          "Communication profile",
          "Shared observations",
        ],
      },
      {
        role: "Administrator" as const,
        label: "Admin",
        capabilities: [
          "Role overview",
          "Security controls",
          "Retention controls",
          "Privacy request review",
        ],
      },
    ],
    workflows: [
      {
        label: "Open family portal",
        path: "/",
        description:
          "Review the parent landing experience and shared-context actions.",
        roles: ["Parent" as const],
      },
      {
        label: "Open classroom portal",
        path: "/",
        description:
          "Review the teacher landing experience and classroom supports.",
        roles: ["Teacher" as const],
      },
      {
        label: "Review SLP session workflow",
        path: "/session",
        description: "Confirm the clinical-only session and recording journey.",
        roles: ["SLP" as const],
      },
      {
        label: "Review admin controls",
        path: "/security",
        description: "Confirm administrator governance and privacy controls.",
        roles: ["Administrator" as const],
      },
    ],
  };
  res.json(GetAdminUxTestingResponse.parse(payload));
});

router.get("/admin/security-overview", async (req, res) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;
  if (actor.isDevelopmentDemo && runtimeConfig.demoLogin.enabled) {
    return res.json(developmentDemoSecurityOverview());
  }
  return res.status(503).json({
    error:
      "Security administration is temporarily unavailable while organization-scoped audit migration is completed.",
  });
  /*
  await ensureSensitiveDataClassifications();
  const [auditEvents, consentRecords, classifications, savedRetention, activeUserRows, failedLoginRows] = await Promise.all([
    db.select().from(securityAuditLogsTable).orderBy(desc(securityAuditLogsTable.occurredAt)).limit(50),
    db.select().from(childProfileConsentRecordsTable).orderBy(desc(childProfileConsentRecordsTable.confirmedAt)).limit(10),
    db.select().from(sensitiveDataClassificationsTable).orderBy(sensitiveDataClassificationsTable.dataType),
    db.select().from(retentionSettingsTable).where(eq(retentionSettingsTable.scope, "organization")).limit(1),
    db.select({ userId: securityAuditLogsTable.userId }).from(securityAuditLogsTable).where(sql`${securityAuditLogsTable.occurredAt} >= NOW() - INTERVAL '15 minutes'`),
    db.select({ total: sql<number>`count(*)::int` }).from(securityAuditLogsTable).where(eq(securityAuditLogsTable.action, "LOGIN_FAILURE")),
  ]);
  const retention = savedRetention[0] ?? (
    await db
      .insert(retentionSettingsTable)
      .values({ scope: "organization", updatedBy: actor.userId })
      .onConflictDoNothing()
      .returning()
  )[0] ?? (
    await db.select().from(retentionSettingsTable).where(eq(retentionSettingsTable.scope, "organization")).limit(1)
  )[0];
  if (!retention) return res.status(500).json({ error: "Security retention settings are unavailable." });
  await writeSecurityAudit({
    actor,
    action: "SECURITY_DASHBOARD_VIEWED",
    targetType: "security_dashboard",
  });
  const toAuditEvent = (event: typeof securityAuditLogsTable.$inferSelect) => ({
    ...event,
    occurredAt: event.occurredAt.toISOString(),
  });
  return res.json({
    activeUsers: new Set(activeUserRows.map((row) => row.userId)).size,
    failedLoginAttempts: Number(failedLoginRows[0]?.total ?? 0),
    consentRecordCount: consentRecords.length,
    recentLogins: auditEvents.filter((event) => event.action.startsWith("LOGIN_")).slice(0, 10).map(toAuditEvent),
    recentConsentRecords: consentRecords.map((record) => ({
      childId: record.childId,
      confirmedBy: record.confirmedBy,
      confirmedAt: record.confirmedAt.toISOString(),
      statementVersion: record.statementVersion,
    })),
    auditEvents: auditEvents.map(toAuditEvent),
    retentionSettings: {
      audioRetentionDays: retention.audioRetentionDays,
      observationVideoRetentionDays: retention.observationVideoRetentionDays,
      sessionNoteRetentionDays: retention.sessionNoteRetentionDays,
      archivedClientStorageDays: retention.archivedClientStorageDays,
      updatedAt: retention.updatedAt.toISOString(),
    },
    classifications: classifications.map((classification) => ({
      dataType: classification.dataType,
      category: classification.category,
      sensitivity: classification.sensitivity,
      accessPolicy: classification.accessPolicy,
      description: classification.description,
    })),
    encryption: encryptionBoundary,
  });
  */
});

router.put("/admin/retention", async (req, res) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;
  if (actor.isDevelopmentDemo && runtimeConfig.demoLogin.enabled) {
    const body = UpdateRetentionSettingsBody.safeParse(req.body);
    if (!body.success) {
      return fail(
        res,
        "Retention periods must be whole values between 1 day and 100 years.",
      );
    }
    developmentDemoRetention = { ...body.data, updatedAt: new Date() };
    return res.json({
      ...developmentDemoRetention,
      updatedAt: developmentDemoRetention.updatedAt.toISOString(),
    });
  }
  if (!actor.organizationId) {
    return res
      .status(503)
      .json({
        error:
          "An organization workspace is required to update retention settings.",
      });
  }
  const body = UpdateRetentionSettingsBody.safeParse(req.body);
  if (!body.success) {
    return fail(
      res,
      "Retention periods must be whole values between 1 day and 100 years.",
    );
  }
  const settings = (
    await db
      .insert(retentionSettingsTable)
      .values({
        organizationId: actor.organizationId,
        scope: "organization",
        updatedBy: actor.userId,
        ...body.data,
      })
      .onConflictDoUpdate({
        target: [
          retentionSettingsTable.organizationId,
          retentionSettingsTable.scope,
        ],
        set: { ...body.data, updatedBy: actor.userId, updatedAt: new Date() },
      })
      .returning()
  )[0];
  if (!settings)
    return res
      .status(500)
      .json({ error: "Retention settings could not be saved." });
  await writeSecurityAudit({
    actor,
    action: "RETENTION_SETTINGS_UPDATED",
    targetType: "retention_settings",
    targetId: settings.id,
    metadata: {
      audioRetentionDays: settings.audioRetentionDays,
      observationVideoRetentionDays: settings.observationVideoRetentionDays,
      sessionNoteRetentionDays: settings.sessionNoteRetentionDays,
      archivedClientStorageDays: settings.archivedClientStorageDays,
    },
  });
  return res.json({
    audioRetentionDays: settings.audioRetentionDays,
    observationVideoRetentionDays: settings.observationVideoRetentionDays,
    sessionNoteRetentionDays: settings.sessionNoteRetentionDays,
    archivedClientStorageDays: settings.archivedClientStorageDays,
    updatedAt: settings.updatedAt.toISOString(),
  });
});
router.get("/admin/team-conversations", async (req, res) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;
  if (!actor.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const query = ListAdminTeamConversationsQueryParams.safeParse(req.query);
  if (!query.success)
    return fail(res, "Use valid conversation search filters.");
  const filter = (value?: string) => value?.trim() || undefined;
  const student = filter(query.data.student);
  const phrase = filter(query.data.phrase);
  const sender = filter(query.data.sender);
  const keyword = filter(query.data.keyword);
  const conditions = [
    eq(teamMessagesTable.organizationId, actor.organizationId),
    eq(childProfilesTable.organizationId, actor.organizationId),
    isNull(childProfilesTable.archivedAt),
  ];
  if (student)
    conditions.push(ilike(childProfilesTable.displayName, `%${student}%`));
  if (phrase) conditions.push(ilike(teamMessagesTable.body, `%${phrase}%`));
  if (sender) conditions.push(ilike(usersTable.displayName, `%${sender}%`));
  if (keyword) conditions.push(ilike(teamMessagesTable.body, `%${keyword}%`));
  if (query.data.date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(query.data.date);
    if (!match) return fail(res, "Use a calendar date in YYYY-MM-DD format.");
    const [, year, month, day] = match;
    const start = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    );
    if (
      start.getUTCFullYear() !== Number(year) ||
      start.getUTCMonth() !== Number(month) - 1 ||
      start.getUTCDate() !== Number(day)
    ) {
      return fail(res, "Use a valid calendar date.");
    }
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    conditions.push(
      gte(teamMessagesTable.createdAt, start),
      lt(teamMessagesTable.createdAt, end),
    );
  }
  const messages = await db
    .select({
      id: teamMessagesTable.id,
      childId: teamMessagesTable.childId,
      childName: childProfilesTable.displayName,
      senderName: usersTable.displayName,
      senderRole: teamMessagesTable.senderRole,
      messageType: teamMessagesTable.messageType,
      audience: teamMessagesTable.audience,
      body: teamMessagesTable.body,
      createdAt: teamMessagesTable.createdAt,
    })
    .from(teamMessagesTable)
    .innerJoin(
      childProfilesTable,
      eq(childProfilesTable.id, teamMessagesTable.childId),
    )
    .innerJoin(usersTable, eq(usersTable.id, teamMessagesTable.senderUserId))
    .where(and(...conditions))
    .orderBy(desc(teamMessagesTable.createdAt))
    .limit(query.data.limit);
  return res.json(
    ListAdminTeamConversationsResponse.parse({
      messages: messages.map((message) => ({
        ...message,
        senderRole: teamRoleLabel(message.senderRole),
      })),
      total: messages.length,
    }),
  );
});
router.get("/admin/child-permissions", async (req, res) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;
  if (!actor.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const query = GetAdminChildPermissionsQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "A child is required.");
  const [child] = await db
    .select({ id: childProfilesTable.id, name: childProfilesTable.displayName })
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, query.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .limit(1);
  if (!child)
    return res
      .status(404)
      .json({ error: "Child not found in this organization." });
  const members = await db
    .select({
      userId: usersTable.id,
      name: usersTable.displayName,
      email: usersTable.email,
      organizationRole: organizationMembershipsTable.role,
      childRole: childCareTeamMembershipsTable.role,
      active: childCareTeamMembershipsTable.active,
    })
    .from(organizationMembershipsTable)
    .innerJoin(
      usersTable,
      eq(usersTable.id, organizationMembershipsTable.userId),
    )
    .leftJoin(
      childCareTeamMembershipsTable,
      and(
        eq(childCareTeamMembershipsTable.childId, child.id),
        eq(
          childCareTeamMembershipsTable.userId,
          organizationMembershipsTable.userId,
        ),
      ),
    )
    .where(
      and(
        eq(organizationMembershipsTable.organizationId, actor.organizationId),
        eq(organizationMembershipsTable.active, true),
        isNull(usersTable.archivedAt),
      ),
    )
    .orderBy(usersTable.displayName);
  return res.json(
    GetAdminChildPermissionsResponse.parse({
      childId: child.id,
      childName: child.name,
      members: members.map((member) => ({
        userId: member.userId,
        name: member.name,
        email: member.email,
        role: teamRoleLabel(member.childRole ?? member.organizationRole),
        assigned: Boolean(member.active),
      })),
    }),
  );
});
router.patch("/admin/child-permissions/:userId", async (req, res) => {
  const actor = requireAdmin(req, res);
  if (!actor) return;
  if (!actor.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const params = UpdateAdminChildPermissionParams.safeParse(req.params);
  const body = UpdateAdminChildPermissionBody.safeParse(req.body);
  if (!params.success || !body.success)
    return fail(
      res,
      "Choose an organization member, child, and access setting.",
    );
  const [[child], [organizationMember]] = await Promise.all([
    db
      .select({ id: childProfilesTable.id })
      .from(childProfilesTable)
      .where(
        and(
          eq(childProfilesTable.id, body.data.childId),
          eq(childProfilesTable.organizationId, actor.organizationId),
          isNull(childProfilesTable.archivedAt),
        ),
      )
      .limit(1),
    db
      .select({
        userId: usersTable.id,
        name: usersTable.displayName,
        email: usersTable.email,
        role: organizationMembershipsTable.role,
      })
      .from(organizationMembershipsTable)
      .innerJoin(
        usersTable,
        eq(usersTable.id, organizationMembershipsTable.userId),
      )
      .where(
        and(
          eq(organizationMembershipsTable.organizationId, actor.organizationId),
          eq(organizationMembershipsTable.userId, params.data.userId),
          eq(organizationMembershipsTable.active, true),
          isNull(usersTable.archivedAt),
        ),
      )
      .limit(1),
  ]);
  if (!child || !organizationMember) {
    return res
      .status(404)
      .json({ error: "The child or organization member could not be found." });
  }
  if (body.data.assigned) {
    await db
      .insert(childCareTeamMembershipsTable)
      .values({
        childId: child.id,
        userId: organizationMember.userId,
        role: organizationMember.role,
        active: true,
      })
      .onConflictDoUpdate({
        target: [
          childCareTeamMembershipsTable.childId,
          childCareTeamMembershipsTable.userId,
        ],
        set: {
          role: organizationMember.role,
          active: true,
          updatedAt: new Date(),
        },
      });
  } else {
    await db
      .update(childCareTeamMembershipsTable)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(childCareTeamMembershipsTable.childId, child.id),
          eq(childCareTeamMembershipsTable.userId, organizationMember.userId),
        ),
      );
  }
  await writeSecurityAudit({
    actor,
    action: "CHILD_TEAM_PERMISSION_UPDATED",
    targetType: "child_care_team_membership",
    targetId: organizationMember.userId,
    childId: child.id,
    metadata: {
      assigned: body.data.assigned,
      role: teamRoleLabel(organizationMember.role),
    },
  });
  return res.json(
    UpdateAdminChildPermissionResponse.parse({
      userId: organizationMember.userId,
      name: organizationMember.name,
      email: organizationMember.email,
      role: teamRoleLabel(organizationMember.role),
      assigned: body.data.assigned,
    }),
  );
});

router.post("/reports/export", async (req, res) => {
  const body = RecordReportExportBody.safeParse(req.body);
  if (!body.success)
    return fail(res, "A child is required before exporting a report.");
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor)
    return res
      .status(401)
      .json({ error: "Please sign in to export a private report." });
  let auditedFormat = body.data.format;
  if (body.data.documentId !== undefined) {
    const clinician = requireClinician(req, res);
    if (!clinician?.organizationId) return;
    const [document] = await db
      .select()
      .from(clinicalDocumentationTable)
      .where(
        and(
          eq(clinicalDocumentationTable.id, body.data.documentId),
          eq(
            clinicalDocumentationTable.organizationId,
            clinician.organizationId,
          ),
          eq(clinicalDocumentationTable.childId, body.data.childId),
        ),
      )
      .limit(1);
    if (!document)
      return res
        .status(404)
        .json({ error: "The documentation record was not found." });
    if (!canExportClinicalDocumentation(document.status)) {
      return res
        .status(409)
        .json({
          error: "Finalize this documentation record before exporting it.",
        });
    }
    auditedFormat = document.format as typeof body.data.format;
  }
  await writeSecurityAudit({
    actor,
    action: "REPORT_EXPORTED",
    targetType:
      body.data.documentId !== undefined
        ? "clinical_documentation"
        : "child_report",
    targetId: body.data.documentId ?? body.data.childId,
    childId: body.data.childId,
    metadata: auditedFormat ? { format: auditedFormat } : undefined,
  });
  return res.status(201).json({ recordedAt: now() });
});

router.get("/clinical-documentation", async (req, res) => {
  const query = ListClinicalDocumentationQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "Choose a valid child filter.");
  if (query.data.childId && !requireChildAccess(req, res, query.data.childId))
    return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const requestedChildIds = query.data.childId
    ? [query.data.childId]
    : actor.childIds;
  const children = requestedChildIds.length
    ? await db
        .select({
          id: childProfilesTable.id,
          name: childProfilesTable.displayName,
        })
        .from(childProfilesTable)
        .where(
          and(
            eq(childProfilesTable.organizationId, actor.organizationId),
            inArray(childProfilesTable.id, requestedChildIds),
          ),
        )
    : [];
  const authorizedChildIds = children.map((child) => child.id);
  let records = authorizedChildIds.length
    ? await db
        .select()
        .from(clinicalDocumentationTable)
        .where(
          and(
            eq(clinicalDocumentationTable.organizationId, actor.organizationId),
            inArray(clinicalDocumentationTable.childId, authorizedChildIds),
          ),
        )
        .orderBy(desc(clinicalDocumentationTable.updatedAt))
    : [];
  let soapNotes = authorizedChildIds.length
    ? await db
        .select()
        .from(clinicalSoapNotesTable)
        .where(
          and(
            eq(clinicalSoapNotesTable.organizationId, actor.organizationId),
            inArray(clinicalSoapNotesTable.childId, authorizedChildIds),
          ),
        )
        .orderBy(desc(clinicalSoapNotesTable.updatedAt))
    : [];
  if (query.data.status && query.data.status !== "all") {
    records = records.filter((record) => record.status === query.data.status);
    soapNotes = soapNotes.filter((note) => note.status === query.data.status);
  } else if (!query.data.status) {
    records = records.filter(
      (record) => record.status === "draft" || record.status === "finalized",
    );
    soapNotes = soapNotes.filter(
      (note) => note.status === "draft" || note.status === "finalized",
    );
  }
  const search = query.data.search?.trim().toLocaleLowerCase();
  if (search) {
    const childNamesForSearch = new Map(
      children.map((child) => [child.id, child.name.toLocaleLowerCase()]),
    );
    records = records.filter((record) =>
      `${record.title} ${childNamesForSearch.get(record.childId) ?? ""}`
        .toLocaleLowerCase()
        .includes(search),
    );
    soapNotes = soapNotes.filter((note) =>
      `soap note ${childNamesForSearch.get(note.childId) ?? ""}`.includes(
        search,
      ),
    );
  }
  const approvedIds = [
    ...records.flatMap((record) => [
      record.approvedByUserId,
      record.archivedByUserId,
      record.deletedByUserId,
    ]),
    ...soapNotes.flatMap((record) => [
      record.archivedByUserId,
      record.deletedByUserId,
    ]),
  ].filter((id): id is string => Boolean(id));
  const approvedUsers = approvedIds.length
    ? await db
        .select({ id: usersTable.id, displayName: usersTable.displayName })
        .from(usersTable)
        .where(inArray(usersTable.id, approvedIds))
    : [];
  const names = new Map(
    approvedUsers.map((user) => [user.id, user.displayName]),
  );
  const childNames = new Map(children.map((child) => [child.id, child.name]));
  await writeSecurityAudit({
    actor,
    action: "CLINICAL_DOCUMENTATION_LISTED",
    targetType: query.data.childId ? "child" : "organization",
    targetId: query.data.childId ?? actor.organizationId,
    childId: query.data.childId,
    metadata: { scope: query.data.childId ? "child" : "authorized_caseload" },
  });
  return res.json(
    ListClinicalDocumentationResponse.parse({
      documents: records.map((record) =>
        documentationResponse(
          record,
          record.approvedByUserId
            ? (names.get(record.approvedByUserId) ?? "Clinician")
            : null,
          record.archivedByUserId
            ? (names.get(record.archivedByUserId) ?? "Clinician")
            : null,
          record.deletedByUserId
            ? (names.get(record.deletedByUserId) ?? "Clinician")
            : null,
        ),
      ),
      children,
      soapNotes: soapNotes.map((note) => ({
        sessionId: note.sessionId,
        childId: note.childId,
        title: `SOAP Note · ${childNames.get(note.childId) ?? "Child"}`,
        status: note.status,
        clinicianEdited: note.clinicianEdited,
        archivedAt: note.archivedAt?.toISOString() ?? null,
        archivedBy: note.archivedByUserId
          ? (names.get(note.archivedByUserId) ?? "Clinician")
          : null,
        deletedAt: note.deletedAt?.toISOString() ?? null,
        deletedBy: note.deletedByUserId
          ? (names.get(note.deletedByUserId) ?? "Clinician")
          : null,
        purgeAfter: note.purgeAfter?.toISOString() ?? null,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      })),
    }),
  );
});

type DocumentationLifecycleInput = {
  childId: number;
  noteType: "document" | "soap_note";
  documentId?: number;
  sessionId?: number;
};
type DocumentationLifecycleAction =
  "delete" | "restore_deleted" | "archive" | "restore_archived";
const documentationLifecycleTransition = async (
  actor: ResolvedCareTeamActor & { organizationId: number },
  input: DocumentationLifecycleInput,
  action: DocumentationLifecycleAction,
) => {
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expectedStatus =
    action === "delete"
      ? "draft"
      : action === "restore_deleted"
        ? "recently_deleted"
        : action === "archive"
          ? "finalized"
          : "archived";
  const nextStatus =
    action === "delete"
      ? "recently_deleted"
      : action === "restore_deleted"
        ? "draft"
        : action === "archive"
          ? "archived"
          : "finalized";
  return db.transaction(async (transaction) => {
    if (input.noteType === "document") {
      if (!input.documentId) return { error: "invalid_target" as const };
      const [current] = await transaction
        .select()
        .from(clinicalDocumentationTable)
        .where(
          and(
            eq(clinicalDocumentationTable.id, input.documentId),
            eq(clinicalDocumentationTable.organizationId, actor.organizationId),
            eq(clinicalDocumentationTable.childId, input.childId),
          ),
        )
        .limit(1)
        .for("update");
      if (!current) return { error: "not_found" as const };
      if (current.status !== expectedStatus) {
        return {
          error: "invalid_state" as const,
          sourceSessionId: current.sourceSessionId,
        };
      }
      if (
        action === "restore_deleted" &&
        (!current.purgeAfter || current.purgeAfter <= now)
      ) {
        return {
          error: "expired" as const,
          sourceSessionId: current.sourceSessionId,
        };
      }
      const [updated] = await transaction
        .update(clinicalDocumentationTable)
        .set({
          status: nextStatus,
          archivedAt:
            action === "archive"
              ? now
              : action === "restore_archived"
                ? null
                : current.archivedAt,
          archivedByUserId:
            action === "archive"
              ? actor.userId
              : action === "restore_archived"
                ? null
                : current.archivedByUserId,
          deletedAt:
            action === "delete"
              ? now
              : action === "restore_deleted"
                ? null
                : current.deletedAt,
          deletedByUserId:
            action === "delete"
              ? actor.userId
              : action === "restore_deleted"
                ? null
                : current.deletedByUserId,
          purgeAfter:
            action === "delete"
              ? purgeAfter
              : action === "restore_deleted"
                ? null
                : current.purgeAfter,
          updatedByUserId: actor.userId,
          updatedAt: now,
        })
        .where(
          and(
            eq(clinicalDocumentationTable.id, current.id),
            eq(clinicalDocumentationTable.status, expectedStatus),
          ),
        )
        .returning();
      if (!updated)
        return {
          error: "conflict" as const,
          sourceSessionId: current.sourceSessionId,
        };
      await insertTransactionalAudit(transaction, actor, {
        action: `CLINICAL_DOCUMENTATION_${action.toLocaleUpperCase()}`,
        targetType: "clinical_documentation",
        targetId: current.id,
        childId: input.childId,
        metadata: {
          noteType: input.noteType,
          sourceSessionId: current.sourceSessionId,
          priorStatus: current.status,
          nextStatus,
        },
      });
      return {
        noteType: input.noteType,
        noteId: current.id,
        childId: input.childId,
        sourceSessionId: current.sourceSessionId,
        status: nextStatus,
        updatedAt: now.toISOString(),
      };
    }
    if (!input.sessionId) return { error: "invalid_target" as const };
    const [current] = await transaction
      .select()
      .from(clinicalSoapNotesTable)
      .where(
        and(
          eq(clinicalSoapNotesTable.sessionId, input.sessionId),
          eq(clinicalSoapNotesTable.organizationId, actor.organizationId),
          eq(clinicalSoapNotesTable.childId, input.childId),
        ),
      )
      .limit(1)
      .for("update");
    if (!current) return { error: "not_found" as const };
    if (current.status !== expectedStatus) {
      return {
        error: "invalid_state" as const,
        sourceSessionId: current.sessionId,
      };
    }
    if (
      action === "restore_deleted" &&
      (!current.purgeAfter || current.purgeAfter <= now)
    ) {
      return { error: "expired" as const, sourceSessionId: current.sessionId };
    }
    const [updated] = await transaction
      .update(clinicalSoapNotesTable)
      .set({
        status: nextStatus,
        archivedAt:
          action === "archive"
            ? now
            : action === "restore_archived"
              ? null
              : current.archivedAt,
        archivedByUserId:
          action === "archive"
            ? actor.userId
            : action === "restore_archived"
              ? null
              : current.archivedByUserId,
        deletedAt:
          action === "delete"
            ? now
            : action === "restore_deleted"
              ? null
              : current.deletedAt,
        deletedByUserId:
          action === "delete"
            ? actor.userId
            : action === "restore_deleted"
              ? null
              : current.deletedByUserId,
        purgeAfter:
          action === "delete"
            ? purgeAfter
            : action === "restore_deleted"
              ? null
              : current.purgeAfter,
        updatedByUserId: actor.userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(clinicalSoapNotesTable.id, current.id),
          eq(clinicalSoapNotesTable.status, expectedStatus),
        ),
      )
      .returning();
    if (!updated)
      return { error: "conflict" as const, sourceSessionId: current.sessionId };
    await insertTransactionalAudit(transaction, actor, {
      action: `CLINICAL_DOCUMENTATION_${action.toLocaleUpperCase()}`,
      targetType: "clinical_soap_note",
      targetId: current.id,
      childId: input.childId,
      metadata: {
        noteType: input.noteType,
        sourceSessionId: current.sessionId,
        priorStatus: current.status,
        nextStatus,
      },
    });
    return {
      noteType: input.noteType,
      noteId: current.sessionId,
      childId: input.childId,
      sourceSessionId: current.sessionId,
      status: nextStatus,
      updatedAt: now.toISOString(),
    };
  });
};

const handleDocumentationLifecycle = async (
  req: Request,
  res: any,
  schema: typeof DeleteClinicalDocumentationBody,
  responseSchema: typeof DeleteClinicalDocumentationResponse,
  action: DocumentationLifecycleAction,
) => {
  const body = schema.safeParse(req.body);
  if (!body.success) return fail(res, "Choose a valid documentation record.");
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const result = await documentationLifecycleTransition(
    actor as ResolvedCareTeamActor & { organizationId: number },
    body.data,
    action,
  );
  if ("error" in result) {
    await writeSecurityAudit({
      actor,
      action: `CLINICAL_DOCUMENTATION_${action.toLocaleUpperCase()}`,
      targetType:
        body.data.noteType === "document"
          ? "clinical_documentation"
          : "clinical_soap_note",
      targetId: body.data.documentId ?? body.data.sessionId,
      childId: body.data.childId,
      outcome: "failure",
      metadata: {
        noteType: body.data.noteType,
        sourceSessionId: result.sourceSessionId ?? body.data.sessionId ?? null,
        reason: result.error,
      },
    });
    if (result.error === "not_found")
      return res
        .status(404)
        .json({ error: "The documentation record was not found." });
    if (result.error === "expired")
      return res
        .status(410)
        .json({ error: "This draft is outside its 30-day recovery window." });
    return res
      .status(409)
      .json({
        error:
          "This documentation record cannot make that lifecycle transition.",
      });
  }
  return res.json(responseSchema.parse(result));
};

router.delete("/clinical-documentation", (req, res) =>
  handleDocumentationLifecycle(
    req,
    res,
    DeleteClinicalDocumentationBody,
    DeleteClinicalDocumentationResponse,
    "delete",
  ),
);
router.post("/clinical-documentation/restore", (req, res) =>
  handleDocumentationLifecycle(
    req,
    res,
    RestoreClinicalDocumentationBody,
    RestoreClinicalDocumentationResponse,
    "restore_deleted",
  ),
);
router.post("/clinical-documentation/archive", (req, res) =>
  handleDocumentationLifecycle(
    req,
    res,
    ArchiveClinicalDocumentationBody,
    ArchiveClinicalDocumentationResponse,
    "archive",
  ),
);
router.post("/clinical-documentation/archive/restore", (req, res) =>
  handleDocumentationLifecycle(
    req,
    res,
    RestoreArchivedClinicalDocumentationBody,
    RestoreArchivedClinicalDocumentationResponse,
    "restore_archived",
  ),
);

router.post("/clinical-documentation/ai-session-note", async (req, res) => {
  const body = CreateAiSessionNoteBody.safeParse(req.body);
  if (!body.success)
    return fail(res, "A child and reviewed session are required.");
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const organizationId = actor.organizationId;

  const [session] = await db
    .select()
    .from(therapySessionsTable)
    .where(
      and(
        eq(therapySessionsTable.id, body.data.sessionId),
        eq(therapySessionsTable.organizationId, actor.organizationId),
        eq(therapySessionsTable.childId, body.data.childId),
        isNull(therapySessionsTable.archivedAt),
      ),
    )
    .limit(1);
  if (!session)
    return res
      .status(404)
      .json({ error: "The reviewed session was not found." });

  const [existingDraft] = await db
    .select()
    .from(clinicalDocumentationTable)
    .where(
      and(
        eq(clinicalDocumentationTable.organizationId, actor.organizationId),
        eq(clinicalDocumentationTable.childId, body.data.childId),
        eq(clinicalDocumentationTable.sourceSessionId, body.data.sessionId),
        eq(clinicalDocumentationTable.format, "session_note"),
        eq(clinicalDocumentationTable.status, "draft"),
        eq(clinicalDocumentationTable.generationSource, AI_SESSION_NOTE_SOURCE),
      ),
    )
    .orderBy(desc(clinicalDocumentationTable.updatedAt))
    .limit(1);
  if (existingDraft) {
    await writeSecurityAudit({
      actor,
      action: "AI_SESSION_NOTE_DRAFT_REOPENED",
      targetType: "clinical_documentation",
      targetId: existingDraft.id,
      childId: body.data.childId,
    });
    return res.json(
      CreateAiSessionNoteResponse.parse(documentationResponse(existingDraft)),
    );
  }

  const [transcript] = await db
    .select()
    .from(sessionTranscriptsTable)
    .where(
      and(
        eq(sessionTranscriptsTable.sessionId, session.id),
        eq(sessionTranscriptsTable.childId, body.data.childId),
        eq(sessionTranscriptsTable.status, "complete"),
      ),
    )
    .orderBy(desc(sessionTranscriptsTable.updatedAt))
    .limit(1);
  if (!transcript) {
    return res.status(422).json({
      error: "No completed Child Language Review is attached to this session.",
    });
  }

  const [segments, reviews] = await Promise.all([
    db
      .select()
      .from(transcriptSpeakerSegmentsTable)
      .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id))
      .orderBy(transcriptSpeakerSegmentsTable.position),
    db
      .select()
      .from(transcriptChildUtteranceReviewsTable)
      .where(
        eq(transcriptChildUtteranceReviewsTable.transcriptId, transcript.id),
      ),
  ]);
  if (hasUnresolvedChildUtteranceReviews(segments, reviews)) {
    return res.status(409).json({
      error:
        "Complete Child Language Review before requesting an AI session note.",
    });
  }

  const [currentSessionGestalts, priorSessions, dictionaryRecords] =
    await Promise.all([
      db
        .select()
        .from(therapySessionGestaltsTable)
        .where(
          and(
            eq(therapySessionGestaltsTable.sessionId, session.id),
            eq(therapySessionGestaltsTable.childAttributed, true),
          ),
        ),
      db
        .select()
        .from(therapySessionsTable)
        .where(
          and(
            eq(therapySessionsTable.organizationId, actor.organizationId),
            eq(therapySessionsTable.childId, body.data.childId),
            lt(therapySessionsTable.createdAt, session.createdAt),
            isNull(therapySessionsTable.archivedAt),
          ),
        ),
      db
        .select()
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.organizationId, actor.organizationId),
            eq(clinicalGestaltsTable.childId, body.data.childId),
            isNull(clinicalGestaltsTable.archivedAt),
          ),
        ),
    ]);
  const currentGestaltByPhrase = new Map(
    currentSessionGestalts.map((item) => [matchPhraseKey(item.phrase), item]),
  );
  const eligibleEvidence: AiSessionEvidence[] = selectAiSessionEvidence(
    segments,
    reviews,
  ).map((item) => {
    const savedPhrase = currentGestaltByPhrase.get(
      matchPhraseKey(item.utterance),
    );
    return {
      ...item,
      phrase: savedPhrase?.phrase,
      communicationFunction: canonicalSessionCommunicationFunction(
        savedPhrase?.communicationFunction,
      ),
    };
  });
  if (!eligibleEvidence.length) {
    return res.status(422).json({
      error:
        "No meaning-backed confirmed Child utterances are eligible for this draft.",
    });
  }

  let content: DocumentationDraftContent;
  try {
    content = await generateAiSessionNote(eligibleEvidence);
  } catch {
    logger.warn(
      {
        childId: body.data.childId,
        sessionId: session.id,
        transcriptId: transcript.id,
        failureCategory: "provider_generation_failed",
      },
      "AI session note generation failed",
    );
    return res.status(502).json({
      error:
        "The AI draft could not be generated right now. Your reviewed evidence was not changed.",
    });
  }
  const priorSessionIds = priorSessions.map((item) => item.id);
  const priorGestalts = priorSessionIds.length
    ? await db
        .select()
        .from(therapySessionGestaltsTable)
        .where(
          and(
            inArray(therapySessionGestaltsTable.sessionId, priorSessionIds),
            eq(therapySessionGestaltsTable.childAttributed, true),
          ),
        )
    : [];
  const priorEvidence: AiSessionEvidence[] = priorGestalts.map(
    (item, index) => ({
      segmentId: -(index + 1),
      position: index,
      utterance: item.phrase,
      phrase: item.phrase,
      meaning: item.meaning,
      context: item.context,
      communicationFunction: canonicalSessionCommunicationFunction(
        item.communicationFunction,
      ),
    }),
  );
  content = addLongitudinalSessionSummary(content, eligibleEvidence, {
    priorEvidence,
    priorSessionCount: new Set(priorGestalts.map((item) => item.sessionId))
      .size,
    priorFunctions: priorGestalts
      .map((item) => item.communicationFunction)
      .filter(Boolean),
    dictionaryPhrases: dictionaryRecords
      .filter(isClinicallyReviewedGestalt)
      .map((item) => item.phrase),
  });
  const excludedUtterances = Math.max(
    0,
    segments.length - eligibleEvidence.length,
  );
  content.sessionSummary = [
    `Evidence used: ${eligibleEvidence.length} meaning-backed, clinician-confirmed Child utterance${eligibleEvidence.length === 1 ? "" : "s"}.`,
    `Excluded from generation: ${excludedUtterances} Not Child, Unsure, Unintelligible, incomplete, or otherwise ineligible turn${excludedUtterances === 1 ? "" : "s"}.`,
    "",
    content.sessionSummary,
  ].join("\n");
  content.goalConnections = await goalConnectionsFor(
    db,
    actor.organizationId,
    body.data.childId,
    session.id,
  );

  const [child] = await db
    .select({ displayName: childProfilesTable.displayName })
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, body.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
      ),
    )
    .limit(1);
  if (!child)
    return res
      .status(404)
      .json({ error: "The child was not found in your organization." });

  const evidenceFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        transcriptId: transcript.id,
        evidence: eligibleEvidence.map((item) => ({
          segmentId: item.segmentId,
          meaning: item.meaning,
          context: item.context,
        })),
      }),
    )
    .digest("hex");
  const [created] = await db
    .insert(clinicalDocumentationTable)
    .values({
      organizationId: actor.organizationId,
      childId: body.data.childId,
      sourceSessionId: session.id,
      format: "session_note",
      status: "draft",
      title: `Evidence-Grounded Session Summary · ${child.displayName}`,
      content,
      generated: true,
      generationSource: AI_SESSION_NOTE_SOURCE,
      evidenceVersion: 2,
      evidenceFingerprint,
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
    })
    .onConflictDoNothing()
    .returning();
  if (!created) {
    const [concurrentDraft] = await db
      .select()
      .from(clinicalDocumentationTable)
      .where(
        and(
          eq(clinicalDocumentationTable.organizationId, organizationId),
          eq(clinicalDocumentationTable.childId, body.data.childId),
          eq(clinicalDocumentationTable.sourceSessionId, session.id),
          eq(clinicalDocumentationTable.status, "draft"),
          eq(
            clinicalDocumentationTable.generationSource,
            AI_SESSION_NOTE_SOURCE,
          ),
        ),
      )
      .orderBy(desc(clinicalDocumentationTable.updatedAt))
      .limit(1);
    if (!concurrentDraft) {
      return res.status(409).json({
        error:
          "Another summary request changed this session. Reload documentation before trying again.",
      });
    }
    await writeSecurityAudit({
      actor,
      action: "AI_SESSION_NOTE_DRAFT_REOPENED",
      targetType: "clinical_documentation",
      targetId: concurrentDraft.id,
      childId: body.data.childId,
    });
    return res.json(
      CreateAiSessionNoteResponse.parse(documentationResponse(concurrentDraft)),
    );
  }
  await writeSecurityAudit({
    actor,
    action: "AI_SESSION_NOTE_DRAFT_CREATED",
    targetType: "clinical_documentation",
    targetId: created.id,
    childId: body.data.childId,
    metadata: {
      eligibleUtterances: eligibleEvidence.length,
      excludedUtterances,
      sourceSessionId: session.id,
    },
  });
  return res
    .status(201)
    .json(CreateAiSessionNoteResponse.parse(documentationResponse(created)));
});

router.get("/communication-goals", async (req, res) => {
  const query = ListCommunicationGoalsQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "A valid child is required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const rows = await db
    .select()
    .from(communicationGoalsTable)
    .where(
      and(
        eq(communicationGoalsTable.organizationId, actor.organizationId),
        eq(communicationGoalsTable.childId, query.data.childId),
        query.data.includeArchived
          ? undefined
          : eq(communicationGoalsTable.status, "active"),
      ),
    )
    .orderBy(desc(communicationGoalsTable.updatedAt));
  return res.json(
    ListCommunicationGoalsResponse.parse(rows.map(communicationGoalResponse)),
  );
});

router.post("/communication-goals", async (req, res) => {
  const body = CreateCommunicationGoalBody.safeParse(req.body);
  if (!body.success)
    return fail(
      res,
      "A title, goal area, description, and valid start date are required.",
    );
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const organizationId = actor.organizationId;
  const dateValue = (value: Date) => value.toISOString().slice(0, 10);
  const createdAt = new Date();
  const [created] = await db.transaction(async (transaction) => {
    const [goal] = await transaction
      .insert(communicationGoalsTable)
      .values({
        organizationId,
        childId: body.data.childId,
        title: body.data.title.trim(),
        goalArea: body.data.goalArea.trim(),
        description: body.data.description.trim(),
        startDate: dateValue(body.data.startDate),
        targetDate: body.data.targetDate
          ? dateValue(body.data.targetDate)
          : null,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    await transaction.insert(communicationGoalHistoryTable).values({
      organizationId,
      childId: goal!.childId,
      goalId: goal!.id,
      action: "created",
      version: goal!.version,
      actorUserId: actor.userId,
      snapshot: communicationGoalSnapshot(goal!),
    });
    return [goal];
  });
  await writeSecurityAudit({
    actor,
    action: "COMMUNICATION_GOAL_CREATED",
    targetType: "communication_goal",
    targetId: created!.id,
    childId: created!.childId,
  });
  return res
    .status(201)
    .json(
      CreateCommunicationGoalResponse.parse(
        communicationGoalResponse(created!),
      ),
    );
});

router.patch("/communication-goals/:goalId", async (req, res) => {
  const params = UpdateCommunicationGoalParams.safeParse(req.params);
  const body = UpdateCommunicationGoalBody.safeParse(req.body);
  if (!params.success || !body.success)
    return fail(res, "A valid goal update and current version are required.");
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const organizationId = actor.organizationId;
  const dateValue = (value: Date) => value.toISOString().slice(0, 10);
  const result = await db.transaction(async (transaction) => {
    const [current] = await transaction
      .select()
      .from(communicationGoalsTable)
      .where(
        and(
          eq(communicationGoalsTable.id, params.data.goalId),
          eq(communicationGoalsTable.organizationId, organizationId),
          eq(communicationGoalsTable.childId, body.data.childId),
        ),
      )
      .limit(1)
      .for("update");
    if (!current) return { missing: true as const };
    if (current.version !== body.data.version)
      return { conflict: true as const };
    const status = body.data.status ?? current.status;
    const changedAt = new Date();
    const [updated] = await transaction
      .update(communicationGoalsTable)
      .set({
        title: body.data.title?.trim() ?? current.title,
        goalArea: body.data.goalArea?.trim() ?? current.goalArea,
        description: body.data.description?.trim() ?? current.description,
        startDate: body.data.startDate
          ? dateValue(body.data.startDate)
          : current.startDate,
        targetDate:
          body.data.targetDate === undefined
            ? current.targetDate
            : body.data.targetDate
              ? dateValue(body.data.targetDate)
              : null,
        status,
        version: current.version + 1,
        updatedByUserId: actor.userId,
        updatedAt: changedAt,
        archivedAt: status === "archived" ? changedAt : null,
        archivedByUserId: status === "archived" ? actor.userId : null,
      })
      .where(
        and(
          eq(communicationGoalsTable.id, current.id),
          eq(communicationGoalsTable.version, current.version),
        ),
      )
      .returning();
    if (!updated) return { conflict: true as const };
    await transaction.insert(communicationGoalHistoryTable).values({
      organizationId,
      childId: updated!.childId,
      goalId: updated!.id,
      action:
        status !== current.status
          ? status === "archived"
            ? "archived"
            : "reactivated"
          : "updated",
      version: updated!.version,
      actorUserId: actor.userId,
      snapshot: communicationGoalSnapshot(updated!),
    });
    return { updated };
  });
  if ("missing" in result)
    return res
      .status(404)
      .json({ error: "The communication goal was not found." });
  if ("conflict" in result)
    return res
      .status(409)
      .json({
        error:
          "This goal was changed by another clinician. Reload before saving.",
      });
  await writeSecurityAudit({
    actor,
    action: "COMMUNICATION_GOAL_UPDATED",
    targetType: "communication_goal",
    targetId: result.updated.id,
    childId: result.updated.childId,
  });
  return res.json(
    UpdateCommunicationGoalResponse.parse(
      communicationGoalResponse(result.updated),
    ),
  );
});

router.post("/clinical-documentation", async (req, res) => {
  const body = CreateClinicalDocumentationBody.safeParse(req.body);
  if (!body.success)
    return fail(res, "Choose a note type and provide valid clinician input.");
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const inputObservations = body.data.inputObservations?.trim() ?? "";
  const inputSummary = body.data.inputSummary?.trim() ?? "";
  const inputQuickNote = body.data.inputQuickNote?.trim() ?? "";
  const content = await documentationDraftFor({
    organizationId: actor.organizationId,
    childId: body.data.childId,
    sourceSessionId: body.data.sourceSessionId,
    inputObservations,
    inputSummary,
    inputQuickNote,
    knowledgeSourceUserId: actor.userId,
  });
  if (!content)
    return res
      .status(404)
      .json({ error: "The selected reviewed session was not found." });
  content.goalConnections = await goalConnectionsFor(
    db,
    actor.organizationId,
    body.data.childId,
    body.data.sourceSessionId,
  );
  const [child] = await db
    .select({ displayName: childProfilesTable.displayName })
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, body.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
      ),
    )
    .limit(1);
  if (!child)
    return res
      .status(404)
      .json({ error: "The child was not found in your organization." });
  const [created] = await db
    .insert(clinicalDocumentationTable)
    .values({
      organizationId: actor.organizationId,
      childId: body.data.childId,
      sourceSessionId: body.data.sourceSessionId ?? null,
      format: body.data.format,
      status: "draft",
      title: documentationTitleFor(body.data.format, child.displayName),
      inputObservations,
      inputSummary,
      inputQuickNote,
      content,
      generated: true,
      evidenceVersion: 1,
      evidenceFingerprint: documentationFingerprint({
        sourceSessionId: body.data.sourceSessionId,
        inputObservations,
        inputSummary,
        inputQuickNote,
      }),
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
    })
    .returning();
  await writeSecurityAudit({
    actor,
    action: "CLINICAL_DOCUMENTATION_DRAFT_CREATED",
    targetType: "clinical_documentation",
    targetId: created.id,
    childId: body.data.childId,
    metadata: { format: body.data.format },
  });
  return res
    .status(201)
    .json(
      CreateClinicalDocumentationResponse.parse(documentationResponse(created)),
    );
});

router.put("/clinical-documentation", async (req, res) => {
  const body = UpdateClinicalDocumentationBody.safeParse(req.body);
  if (!body.success)
    return fail(res, "A title and all documentation sections are required.");
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const [current] = await db
    .select()
    .from(clinicalDocumentationTable)
    .where(
      and(
        eq(clinicalDocumentationTable.id, body.data.documentId),
        eq(clinicalDocumentationTable.organizationId, actor.organizationId),
        eq(clinicalDocumentationTable.childId, body.data.childId),
      ),
    )
    .limit(1);
  if (!current)
    return res
      .status(404)
      .json({ error: "The documentation record was not found." });
  if (current.status !== "draft")
    return res
      .status(409)
      .json({
        error:
          "Finalized documentation cannot be edited. Create a new draft to make changes.",
      });
  const nextContent: DocumentationDraftContent = {
    ...body.data.content,
    // Provenance is server-owned. A stale or direct client may return it, but
    // cannot add, remove, or rewrite evidence references.
    evidenceReferences:
      documentationResponse(current).content.evidenceReferences,
    goalConnections: documentationResponse(current).content.goalConnections,
  };
  if (body.data.goalConnectionSelections) {
    const serverCandidates = await goalConnectionsFor(
      db,
      actor.organizationId,
      body.data.childId,
      current.sourceSessionId,
    );
    const byKey = new Map(
      serverCandidates.map((item) => [
        `${item.goalId}:${item.sourceKind}:${item.sourceId}`,
        item,
      ]),
    );
    const selections = body.data.goalConnectionSelections;
    const selectionKeys = selections.map(
      (item) => `${item.goalId}:${item.sourceKind}:${item.sourceId}`,
    );
    if (new Set(selectionKeys).size !== selectionKeys.length) {
      return res
        .status(422)
        .json({ error: "Each goal connection may be selected only once." });
    }
    if (
      selections.some(
        (item) =>
          !byKey.has(`${item.goalId}:${item.sourceKind}:${item.sourceId}`),
      )
    ) {
      return res
        .status(422)
        .json({
          error:
            "A goal connection does not belong to this child or is no longer an eligible reviewed source.",
        });
    }
    const selected = new Map(
      selections.map((item) => [
        `${item.goalId}:${item.sourceKind}:${item.sourceId}`,
        item.included,
      ]),
    );
    nextContent.goalConnections = serverCandidates.map((candidate) => ({
      ...candidate,
      included:
        selected.get(
          `${candidate.goalId}:${candidate.sourceKind}:${candidate.sourceId}`,
        ) ??
        (current.content as DocumentationDraftContent).goalConnections?.find(
          (saved) =>
            saved.goalId === candidate.goalId &&
            saved.sourceKind === candidate.sourceKind &&
            saved.sourceId === candidate.sourceId,
        )?.included ??
        false,
    }));
  }
  if (!hasRequiredDocumentationLabels(nextContent)) {
    return res.status(422).json({
      error:
        "Suggested Insight and Clinician Review Required labels must remain in every interpretation section.",
    });
  }
  if (!hasShareSafeFamilyHighlights(nextContent)) {
    return res.status(422).json({
      error:
        "Family & Team Highlights must remain plain-language and cannot include NLA stages, diagnoses, treatment recommendations, or therapy goals.",
    });
  }
  const [updated] = await db
    .update(clinicalDocumentationTable)
    .set({
      title: body.data.title.trim(),
      content: nextContent,
      generated: false,
      updatedByUserId: actor.userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clinicalDocumentationTable.id, current.id),
        eq(clinicalDocumentationTable.status, "draft"),
      ),
    )
    .returning();
  if (!updated) {
    return res.status(409).json({
      error:
        "This draft was finalized while you were editing it. Reload the finalized document before exporting.",
    });
  }
  await writeSecurityAudit({
    actor,
    action: "CLINICAL_DOCUMENTATION_DRAFT_SAVED",
    targetType: "clinical_documentation",
    targetId: current.id,
    childId: body.data.childId,
  });
  return res.json(
    UpdateClinicalDocumentationResponse.parse(documentationResponse(updated)),
  );
});

router.post("/clinical-documentation/approve", async (req, res) => {
  const body = ApproveClinicalDocumentationBody.safeParse(req.body);
  if (!body.success)
    return fail(res, "A documentation record is required before approval.");
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const organizationId = actor.organizationId;
  const approvedByName = async (userId: string | null) => {
    if (!userId) return null;
    const [user] = await db
      .select({ displayName: usersTable.displayName })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    return user?.displayName ?? "Clinician";
  };
  const result = await db.transaction(async (transaction) => {
    const [current] = await transaction
      .select()
      .from(clinicalDocumentationTable)
      .where(
        and(
          eq(clinicalDocumentationTable.id, body.data.documentId),
          eq(clinicalDocumentationTable.organizationId, organizationId),
          eq(clinicalDocumentationTable.childId, body.data.childId),
        ),
      )
      .limit(1)
      .for("update");
    if (!current) return { error: "not_found" as const };
    if (current.status === "finalized")
      return { record: current, transitioned: false };

    const currentContent = documentationResponse(current).content;
    if (!hasRequiredDocumentationLabels(currentContent)) {
      return { error: "required_labels" as const };
    }
    if (!hasShareSafeFamilyHighlights(currentContent)) {
      return { error: "unsafe_highlights" as const };
    }
    // Lock in a fixed order (document, goals, then source rows) before
    // resolving candidates, so archive/update races cannot finalize stale
    // provenance and concurrent finalizations do not deadlock.
    const selectedConnections = (currentContent.goalConnections ?? []).filter(
      (connection) => connection.included,
    );
    const selectedGoalIds = [
      ...new Set(selectedConnections.map((connection) => connection.goalId)),
    ];
    if (selectedGoalIds.length) {
      const lockedGoals = await transaction
        .select({ id: communicationGoalsTable.id })
        .from(communicationGoalsTable)
        .where(
          and(
            eq(communicationGoalsTable.organizationId, organizationId),
            eq(communicationGoalsTable.childId, body.data.childId),
            eq(communicationGoalsTable.status, "active"),
            inArray(communicationGoalsTable.id, selectedGoalIds),
          ),
        )
        .orderBy(communicationGoalsTable.id)
        .for("update");
      if (lockedGoals.length !== selectedGoalIds.length)
        return { error: "ineligible_goal_connection" as const };
      const dictionaryIds = selectedConnections
        .filter((connection) => connection.sourceKind === "dictionary_phrase")
        .map((connection) => connection.sourceId);
      if (dictionaryIds.length) {
        const lockedSources = await transaction
          .select({ id: clinicalGestaltsTable.id })
          .from(clinicalGestaltsTable)
          .where(
            and(
              eq(clinicalGestaltsTable.organizationId, organizationId),
              eq(clinicalGestaltsTable.childId, body.data.childId),
              isNull(clinicalGestaltsTable.archivedAt),
              inArray(clinicalGestaltsTable.id, dictionaryIds),
            ),
          )
          .orderBy(clinicalGestaltsTable.id)
          .for("update");
        if (lockedSources.length !== new Set(dictionaryIds).size)
          return { error: "ineligible_goal_connection" as const };
      }
      const aacProfileIds = selectedConnections
        .filter((connection) => connection.sourceKind === "aac_profile")
        .map((connection) => connection.sourceId);
      if (aacProfileIds.length) {
        const lockedSources = await transaction
          .select({ id: aacProfilesTable.id })
          .from(aacProfilesTable)
          .where(
            and(
              eq(aacProfilesTable.organizationId, organizationId),
              eq(aacProfilesTable.childId, body.data.childId),
              isNull(aacProfilesTable.removedAt),
              inArray(aacProfilesTable.id, aacProfileIds),
            ),
          )
          .orderBy(aacProfilesTable.id)
          .for("update");
        if (lockedSources.length !== new Set(aacProfileIds).size)
          return { error: "ineligible_goal_connection" as const };
      }
      const observationIds = selectedConnections
        .filter(
          (connection) =>
            connection.sourceKind === "teacher_observation" ||
            connection.sourceKind === "shared_moment",
        )
        .map((connection) => connection.sourceId);
      if (observationIds.length) {
        const lockedSources = await transaction
          .select({ id: clinicalObservationsTable.id })
          .from(clinicalObservationsTable)
          .where(
            and(
              eq(clinicalObservationsTable.organizationId, organizationId),
              eq(clinicalObservationsTable.childId, body.data.childId),
              inArray(clinicalObservationsTable.id, observationIds),
            ),
          )
          .orderBy(clinicalObservationsTable.id)
          .for("update");
        if (lockedSources.length !== new Set(observationIds).size)
          return { error: "ineligible_goal_connection" as const };
      }
      const utteranceIds = selectedConnections
        .filter((connection) => connection.sourceKind === "reviewed_utterance")
        .map((connection) => connection.sourceId);
      if (utteranceIds.length) {
        const lockedReviews = await transaction
          .select({ segmentId: transcriptChildUtteranceReviewsTable.segmentId })
          .from(transcriptChildUtteranceReviewsTable)
          .where(
            inArray(
              transcriptChildUtteranceReviewsTable.segmentId,
              utteranceIds,
            ),
          )
          .orderBy(transcriptChildUtteranceReviewsTable.segmentId)
          .for("update");
        if (lockedReviews.length !== new Set(utteranceIds).size)
          return { error: "ineligible_goal_connection" as const };
      }
    }
    // Re-resolve after the locks. Provenance is copied, never client supplied.
    const eligibleConnections = await goalConnectionsFor(
      transaction,
      organizationId,
      body.data.childId,
      current.sourceSessionId,
    );
    const eligibleByKey = new Map(
      eligibleConnections.map((item) => [
        `${item.goalId}:${item.sourceKind}:${item.sourceId}`,
        item,
      ]),
    );
    if (
      (currentContent.goalConnections ?? []).some(
        (connection) =>
          connection.included &&
          !eligibleByKey.has(
            `${connection.goalId}:${connection.sourceKind}:${connection.sourceId}`,
          ),
      )
    ) {
      return { error: "ineligible_goal_connection" as const };
    }

    const approvedAt = new Date();
    const [transitioned] = await transaction
      .update(clinicalDocumentationTable)
      .set({
        status: "finalized",
        content: {
          ...currentContent,
          goalConnections: selectedConnections.map((connection) => ({
            ...eligibleByKey.get(
              `${connection.goalId}:${connection.sourceKind}:${connection.sourceId}`,
            )!,
            included: true,
          })),
        },
        approvedAt,
        approvedByUserId: actor.userId,
        updatedByUserId: actor.userId,
        updatedAt: approvedAt,
      })
      .where(
        and(
          eq(clinicalDocumentationTable.id, current.id),
          eq(clinicalDocumentationTable.status, "draft"),
        ),
      )
      .returning();
    if (!transitioned) return { error: "conflict" as const };
    await insertTransactionalAudit(transaction, actor, {
      action: "CLINICAL_DOCUMENTATION_FINALIZED",
      targetType: "clinical_documentation",
      targetId: current.id,
      childId: body.data.childId,
    });
    return { record: transitioned, transitioned: true };
  });
  if ("error" in result) {
    if (result.error === "not_found")
      return res
        .status(404)
        .json({ error: "The documentation record was not found." });
    if (result.error === "required_labels") {
      return res.status(422).json({
        error:
          "This draft cannot be finalized until its Suggested Insight and Clinician Review Required labels are restored.",
      });
    }
    if (result.error === "unsafe_highlights") {
      return res.status(422).json({
        error:
          "This draft cannot be finalized until Family & Team Highlights remove NLA stages, diagnoses, treatment recommendations, and therapy goals.",
      });
    }
    if (result.error === "ineligible_goal_connection") {
      return res
        .status(422)
        .json({
          error:
            "A selected goal connection is no longer an eligible source for this child. Review the draft before finalizing.",
        });
    }
    return res
      .status(409)
      .json({
        error:
          "This documentation changed while it was being finalized. Reload before trying again.",
      });
  }
  const approvedBy = result.transitioned
    ? actor.author
    : await approvedByName(result.record.approvedByUserId);
  return res.json(
    ApproveClinicalDocumentationResponse.parse(
      documentationResponse(result.record, approvedBy),
    ),
  );
});

router.get("/session-soap-note", async (req, res) => {
  const query = GetSessionSoapNoteQueryParams.safeParse(req.query);
  if (!query.success)
    return fail(res, "A valid child and reviewed session are required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const [stored] = await db
    .select({ status: clinicalSoapNotesTable.status })
    .from(clinicalSoapNotesTable)
    .where(
      and(
        eq(clinicalSoapNotesTable.organizationId, actor.organizationId),
        eq(clinicalSoapNotesTable.childId, query.data.childId),
        eq(clinicalSoapNotesTable.sessionId, query.data.sessionId),
      ),
    )
    .limit(1);
  if (stored && stored.status !== "draft") {
    return res
      .status(409)
      .json({ error: "Restore this SOAP draft before viewing or editing it." });
  }
  const note = await reviewedSoapNoteFor(
    actor.organizationId,
    query.data.childId,
    query.data.sessionId,
    actor.userId,
  );
  if (!note)
    return res
      .status(404)
      .json({ error: "The reviewed session was not found." });
  await writeSecurityAudit({
    actor,
    action: "SOAP_NOTE_VIEWED",
    targetType: "therapy_session",
    targetId: query.data.sessionId,
    childId: query.data.childId,
  });
  return res.json(note);
});

router.put("/session-soap-note", async (req, res) => {
  const query = UpdateSessionSoapNoteQueryParams.safeParse(req.query);
  const body = UpdateSessionSoapNoteBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(res, "All SOAP note sections are required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const [stored] = await db
    .select()
    .from(clinicalSoapNotesTable)
    .where(
      and(
        eq(clinicalSoapNotesTable.organizationId, actor.organizationId),
        eq(clinicalSoapNotesTable.childId, query.data.childId),
        eq(clinicalSoapNotesTable.sessionId, query.data.sessionId),
      ),
    )
    .limit(1);
  if (stored && stored.status !== "draft") {
    return res
      .status(409)
      .json({ error: "Restore this SOAP draft before editing it." });
  }
  const base = await reviewedSoapNoteFor(
    actor.organizationId,
    query.data.childId,
    query.data.sessionId,
    actor.userId,
  );
  if (!base)
    return res
      .status(404)
      .json({ error: "The reviewed session was not found." });
  const savedRows = stored
    ? await db
        .update(clinicalSoapNotesTable)
        .set({
          content: body.data,
          evidenceVersion: 2,
          clinicianEdited: true,
          updatedByUserId: actor.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clinicalSoapNotesTable.id, stored.id),
            eq(clinicalSoapNotesTable.status, "draft"),
          ),
        )
        .returning({ id: clinicalSoapNotesTable.id })
    : await db
        .insert(clinicalSoapNotesTable)
        .values({
          organizationId: actor.organizationId,
          childId: query.data.childId,
          sessionId: query.data.sessionId,
          content: body.data,
          evidenceVersion: 2,
          clinicianEdited: true,
          status: "draft",
          updatedByUserId: actor.userId,
        })
        .onConflictDoNothing()
        .returning({ id: clinicalSoapNotesTable.id });
  if (!savedRows.length) {
    return res
      .status(409)
      .json({
        error:
          "This SOAP draft changed while you were editing it. Reload before trying again.",
      });
  }
  await writeSecurityAudit({
    actor,
    action: "SOAP_NOTE_SAVED",
    targetType: "therapy_session",
    targetId: query.data.sessionId,
    childId: query.data.childId,
  });
  return res.json({ ...base, content: body.data, updatedAt: now() });
});

router.get("/clinical-knowledge/sources", async (req, res) => {
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  await ensurePackagedClinicalKnowledge(actor.organizationId, actor.userId);
  const sources = await db
    .select()
    .from(clinicalKnowledgeSourcesTable)
    .where(
      and(
        eq(clinicalKnowledgeSourcesTable.organizationId, actor.organizationId),
        isNull(clinicalKnowledgeSourcesTable.archivedAt),
      ),
    )
    .orderBy(desc(clinicalKnowledgeSourcesTable.updatedAt));
  const versionIds = sources
    .map((source) => source.activeVersionId)
    .filter((id): id is number => id !== null);
  const versions = versionIds.length
    ? await db
        .select()
        .from(clinicalKnowledgeSourceVersionsTable)
        .where(inArray(clinicalKnowledgeSourceVersionsTable.id, versionIds))
    : [];
  const byId = new Map(versions.map((version) => [version.id, version]));
  return res.json(
    ListClinicalKnowledgeSourcesResponse.parse({
      sources: sources.map((source) =>
        clinicalKnowledgeSourceResponse(
          source,
          source.activeVersionId ? byId.get(source.activeVersionId) : undefined,
        ),
      ),
    }),
  );
});

router.post("/clinical-knowledge/sources", async (req, res) => {
  const body = CreateClinicalKnowledgeSourceBody.safeParse(req.body);
  const actor = requireClinician(req, res);
  if (!body.success)
    return fail(
      res,
      "Provide a title and a supported private source document.",
    );
  if (!actor?.organizationId) return;
  let data: Buffer;
  try {
    data = decodeKnowledgeSourceUpload(body.data.data, body.data.contentType);
  } catch (error) {
    return res
      .status(400)
      .json({ error: safeKnowledgeProcessingFailure(error).message });
  }
  const stored = await storeClinicalKnowledgeObject({
    organizationId: actor.organizationId,
    contentType: body.data.contentType,
    data,
  });
  const [source] = await db
    .insert(clinicalKnowledgeSourcesTable)
    .values({
      organizationId: actor.organizationId,
      title: body.data.title.trim(),
      sourceType: body.data.sourceType.trim(),
      authorship: body.data.authorship?.trim() || null,
      citation: body.data.citation?.trim() || null,
      tags: (body.data.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      createdByUserId: actor.userId,
    })
    .returning();
  const [version] = await db
    .insert(clinicalKnowledgeSourceVersionsTable)
    .values({
      sourceId: source.id,
      version: 1,
      storageDriver: runtimeConfig.audioStorage.driver,
      storageKey: stored.key,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      checksum: "pending",
      extractorId: KNOWLEDGE_SOURCE_ADAPTER_VERSION,
      createdByUserId: actor.userId,
    })
    .returning();
  const [job] = await db
    .insert(clinicalKnowledgeIngestionJobsTable)
    .values({
      sourceVersionId: version.id,
      adapterId: KNOWLEDGE_SOURCE_ADAPTER_VERSION,
    })
    .returning();
  try {
    const extracted = await extractKnowledgeSourceText(
      data,
      body.data.contentType,
    );
    const chunks = chunkKnowledgeSource(extracted.text);
    if (!chunks.length) throw new Error("No chunks available");
    await db.transaction(async (transaction) => {
      await transaction.insert(clinicalKnowledgeChunksTable).values(
        chunks.map((chunk) => ({
          sourceId: source.id,
          sourceVersionId: version.id,
          ordinal: chunk.ordinal,
          page: chunk.page,
          section: chunk.section,
          encryptedText: textCipher(chunk.text),
        })),
      );
      await transaction
        .update(clinicalKnowledgeSourceVersionsTable)
        .set({ checksum: extracted.checksum, extractionStatus: "ready" })
        .where(eq(clinicalKnowledgeSourceVersionsTable.id, version.id));
      await transaction
        .update(clinicalKnowledgeSourcesTable)
        .set({ status: "ready", activeVersionId: version.id })
        .where(eq(clinicalKnowledgeSourcesTable.id, source.id));
      await transaction
        .update(clinicalKnowledgeIngestionJobsTable)
        .set({ status: "complete", completedAt: new Date() })
        .where(eq(clinicalKnowledgeIngestionJobsTable.id, job.id));
    });
  } catch (error) {
    const safe = safeKnowledgeProcessingFailure(error);
    await db.transaction(async (transaction) => {
      await transaction
        .update(clinicalKnowledgeSourceVersionsTable)
        .set({ extractionStatus: "failed", processingErrorCode: safe.code })
        .where(eq(clinicalKnowledgeSourceVersionsTable.id, version.id));
      await transaction
        .update(clinicalKnowledgeSourcesTable)
        .set({ status: "failed" })
        .where(eq(clinicalKnowledgeSourcesTable.id, source.id));
      await transaction
        .update(clinicalKnowledgeIngestionJobsTable)
        .set({
          status: "failed",
          failureCode: safe.code,
          completedAt: new Date(),
        })
        .where(eq(clinicalKnowledgeIngestionJobsTable.id, job.id));
    });
    req.log.warn(
      { sourceId: source.id, code: safe.code },
      "Clinical knowledge source processing failed",
    );
    return res.status(400).json({ error: safe.message });
  }
  const [ready] = await db
    .select()
    .from(clinicalKnowledgeSourcesTable)
    .where(eq(clinicalKnowledgeSourcesTable.id, source.id));
  await writeSecurityAudit({
    actor,
    action: "CLINICAL_KNOWLEDGE_SOURCE_INGESTED",
    targetType: "knowledge_source",
    targetId: source.id,
    metadata: { sourceType: source.sourceType, sizeBytes: stored.sizeBytes },
  });
  // A newly ready source can make previously saved, reviewed Child evidence
  // eligible for a first or refreshed cited run. Each run is fingerprinted, so
  // this inexpensive backfill cannot duplicate an already completed result.
  const profiles = await db
    .select({ id: childProfilesTable.id })
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    );
  for (const profile of profiles) {
    const [latestSession] = await db
      .select({ id: therapySessionsTable.id })
      .from(therapySessionsTable)
      .where(
        and(
          eq(therapySessionsTable.organizationId, actor.organizationId),
          eq(therapySessionsTable.childId, profile.id),
          isNull(therapySessionsTable.archivedAt),
        ),
      )
      .orderBy(desc(therapySessionsTable.createdAt))
      .limit(1);
    if (latestSession) {
      const runId = await enqueueClinicalInsights({
        actor,
        organizationId: actor.organizationId,
        childId: profile.id,
        triggerSessionId: latestSession.id,
        sourceRefreshVersionId: version.id,
      });
      void runClinicalInsights({
        actor,
        organizationId: actor.organizationId,
        childId: profile.id,
        triggerSessionId: latestSession.id,
        runId,
      });
    }
  }
  return res
    .status(201)
    .json(
      CreateClinicalKnowledgeSourceResponse.parse(
        clinicalKnowledgeSourceResponse(ready, {
          ...version,
          checksum: "",
          extractionStatus: "ready",
        }),
      ),
    );
});

router.post(
  "/clinical-knowledge/sources/:sourceId/archive",
  async (req, res) => {
    const params = ArchiveClinicalKnowledgeSourceParams.safeParse(req.params);
    const actor = requireClinician(req, res);
    if (!params.success)
      return fail(res, "A valid knowledge source is required.");
    if (!actor?.organizationId) return;
    const [source] = await db
      .update(clinicalKnowledgeSourcesTable)
      .set({ status: "archived", archivedAt: new Date() })
      .where(
        and(
          eq(clinicalKnowledgeSourcesTable.id, params.data.sourceId),
          eq(
            clinicalKnowledgeSourcesTable.organizationId,
            actor.organizationId,
          ),
        ),
      )
      .returning();
    if (!source)
      return res.status(404).json({ error: "Knowledge source not found." });
    await writeSecurityAudit({
      actor,
      action: "CLINICAL_KNOWLEDGE_SOURCE_ARCHIVED",
      targetType: "knowledge_source",
      targetId: source.id,
    });
    return res.json(
      ArchiveClinicalKnowledgeSourceResponse.parse(
        clinicalKnowledgeSourceResponse(source),
      ),
    );
  },
);

router.get("/clinical-knowledge/insights", async (req, res) => {
  const query = ListClinicalKnowledgeInsightsQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "A valid child is required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const insights = await db
    .select()
    .from(clinicalKnowledgeInsightsTable)
    .where(
      and(
        eq(clinicalKnowledgeInsightsTable.organizationId, actor.organizationId),
        eq(clinicalKnowledgeInsightsTable.childId, query.data.childId),
      ),
    )
    .orderBy(desc(clinicalKnowledgeInsightsTable.createdAt));
  return res.json(
    ListClinicalKnowledgeInsightsResponse.parse({
      insights: insights.map(clinicalKnowledgeInsightResponse),
    }),
  );
});

router.post("/clinical-knowledge/insights", async (req, res) => {
  const body = GenerateClinicalKnowledgeInsightsBody.safeParse(req.body);
  if (!body.success) return fail(res, "A valid child is required.");
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;

  const sessions = await db
    .select()
    .from(therapySessionsTable)
    .where(
      and(
        eq(therapySessionsTable.organizationId, actor.organizationId),
        eq(therapySessionsTable.childId, body.data.childId),
        isNull(therapySessionsTable.archivedAt),
      ),
    );
  const allowedSessions = body.data.sessionId
    ? sessions.filter((session) => session.id === body.data.sessionId)
    : sessions;
  if (body.data.sessionId && !allowedSessions.length) {
    return res.status(404).json({ error: "Reviewed session not found." });
  }
  const triggerSessionId = allowedSessions.sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )[0]?.id;
  if (!triggerSessionId) {
    return res
      .status(400)
      .json({
        error:
          "Create reviewed Child phrase evidence before refreshing clinical insights.",
      });
  }

  await runClinicalInsights({
    actor,
    organizationId: actor.organizationId,
    childId: body.data.childId,
    triggerSessionId,
  });
  const exceptions = await db
    .select()
    .from(clinicalKnowledgeInsightsTable)
    .where(
      and(
        eq(clinicalKnowledgeInsightsTable.organizationId, actor.organizationId),
        eq(clinicalKnowledgeInsightsTable.childId, body.data.childId),
        eq(clinicalKnowledgeInsightsTable.disposition, "exception"),
      ),
    )
    .orderBy(desc(clinicalKnowledgeInsightsTable.createdAt));
  return res.status(201).json(
    GenerateClinicalKnowledgeInsightsResponse.parse({
      insights: exceptions.map(clinicalKnowledgeInsightResponse),
    }),
  );
});

router.patch("/clinical-knowledge/insights/:insightId", async (req, res) => {
  const params = ReviewClinicalKnowledgeInsightParams.safeParse(req.params);
  const body = ReviewClinicalKnowledgeInsightBody.safeParse(req.body);
  const actor = requireClinician(req, res);
  if (!params.success || !body.success)
    return fail(res, "A valid insight review is required.");
  if (!actor?.organizationId) return;
  const [existing] = await db
    .select()
    .from(clinicalKnowledgeInsightsTable)
    .where(
      and(
        eq(clinicalKnowledgeInsightsTable.id, params.data.insightId),
        eq(clinicalKnowledgeInsightsTable.organizationId, actor.organizationId),
      ),
    )
    .limit(1);
  if (!existing) return res.status(404).json({ error: "Insight not found." });
  if (!requireChildAccess(req, res, existing.childId)) return;
  if (body.data.status === "reverted" && existing.disposition !== "applied") {
    return res
      .status(400)
      .json({ error: "Only automatically applied findings can be reverted." });
  }
  if (body.data.status === "reviewed" && existing.disposition !== "exception") {
    return res
      .status(400)
      .json({
        error: "Only clinician-review exceptions can be marked reviewed.",
      });
  }
  const [updated] = await db
    .update(clinicalKnowledgeInsightsTable)
    .set({
      status: body.data.status,
      encryptedClinicianEdit:
        body.data.clinicianEdit === undefined
          ? existing.encryptedClinicianEdit
          : textCipher(body.data.clinicianEdit),
      encryptedReviewNote:
        body.data.reviewNote === undefined
          ? existing.encryptedReviewNote
          : textCipher(body.data.reviewNote),
      reviewedByUserId: actor.userId,
      reviewedAt: new Date(),
    })
    .where(eq(clinicalKnowledgeInsightsTable.id, existing.id))
    .returning();
  if (body.data.status === "reverted" && existing.runId) {
    const facts = await db
      .select()
      .from(clinicalKnowledgeAppliedFactsTable)
      .where(
        and(
          eq(clinicalKnowledgeAppliedFactsTable.runId, existing.runId),
          eq(clinicalKnowledgeAppliedFactsTable.category, existing.category),
          eq(clinicalKnowledgeAppliedFactsTable.status, "active"),
        ),
      );
    await db
      .update(clinicalKnowledgeAppliedFactsTable)
      .set({
        status: "reverted",
        revertedByUserId: actor.userId,
        revertedAt: new Date(),
      })
      .where(
        and(
          eq(clinicalKnowledgeAppliedFactsTable.runId, existing.runId),
          eq(clinicalKnowledgeAppliedFactsTable.category, existing.category),
          eq(clinicalKnowledgeAppliedFactsTable.status, "active"),
        ),
      );
    for (const fact of facts) {
      if (!fact.gestaltId) continue;
      const [gestalt] = await db
        .select()
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.id, fact.gestaltId),
            eq(clinicalGestaltsTable.organizationId, actor.organizationId),
            eq(clinicalGestaltsTable.childId, existing.childId),
          ),
        )
        .limit(1);
      const references = await db
        .select({ id: clinicalKnowledgeAppliedFactsTable.id })
        .from(clinicalKnowledgeAppliedFactsTable)
        .where(
          and(
            eq(clinicalKnowledgeAppliedFactsTable.gestaltId, fact.gestaltId),
            eq(clinicalKnowledgeAppliedFactsTable.status, "active"),
          ),
        );
      if (
        shouldArchiveEngineOwnedGestalt({
          engineCreatedGestalt: fact.engineCreatedGestalt,
          gestaltSource: gestalt?.source ?? null,
          activeReferences: references.length,
        })
      ) {
        await db
          .update(clinicalGestaltsTable)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(clinicalGestaltsTable.id, fact.gestaltId),
              isNull(clinicalGestaltsTable.archivedAt),
            ),
          );
      }
    }
  }
  await writeSecurityAudit({
    actor,
    action: "CLINICAL_KNOWLEDGE_INSIGHT_REVIEWED",
    targetType: "clinical_knowledge_insight",
    targetId: updated.id,
    childId: updated.childId,
    metadata: { status: updated.status },
  });
  return res.json(
    ReviewClinicalKnowledgeInsightResponse.parse(
      clinicalKnowledgeInsightResponse(updated),
    ),
  );
});

router.get("/deletion-requests", async (req, res) => {
  const query = ListDeletionRequestsQueryParams.safeParse(req.query);
  const actor = viewerFrom(req);
  if (!query.success)
    return fail(res, "A child identifier must be valid when provided.");
  if (!actor)
    return res
      .status(401)
      .json({ error: "Please sign in to view deletion requests." });
  if (
    query.data.childId !== undefined &&
    !actor.childIds.includes(query.data.childId)
  )
    return res
      .status(403)
      .json({
        error:
          "This care-team role does not have access to this child's requests.",
      });
  const records = await db
    .select()
    .from(deletionRequestsTable)
    .where(
      query.data.childId === undefined
        ? inArray(deletionRequestsTable.childId, actor.childIds)
        : eq(deletionRequestsTable.childId, query.data.childId),
    )
    .orderBy(desc(deletionRequestsTable.createdAt));
  return res.json(
    ListDeletionRequestsResponse.parse(
      (actor.role === "SLP"
        ? records
        : records.filter((item) => item.requesterUserId === actor.userId)
      ).map(deletionRequestResponse),
    ),
  );
});
router.post("/deletion-requests", async (req, res) => {
  const query = CreateDeletionRequestQueryParams.safeParse(req.query);
  const body = CreateDeletionRequestBody.safeParse(req.body);
  const actor = viewerFrom(req);
  if (!query.success || !body.success)
    return fail(
      res,
      "Choose at least one category of child data for this deletion request.",
    );
  if (!actor)
    return res
      .status(401)
      .json({ error: "Please sign in to submit a deletion request." });
  if (!actor.childIds.includes(query.data.childId))
    return res
      .status(403)
      .json({
        error: "This care-team role does not have access to this child.",
      });
  const [request] = await db.transaction(async (tx) => {
    const created = (
      await tx
        .insert(deletionRequestsTable)
        .values({
          childId: query.data.childId,
          requesterUserId: actor.userId,
          requesterName: actor.author,
          requesterRole: actor.role,
          categories: [...new Set(body.data.categories)],
          reason: body.data.reason?.trim() ?? "",
        })
        .returning()
    )[0];
    if (!created) throw new Error("Deletion request could not be created.");
    await tx
      .insert(deletionRequestAuditEventsTable)
      .values({
        requestId: created.id,
        action: "request_submitted",
        actorUserId: actor.userId,
        actorName: actor.author,
        actorRole: actor.role,
        note: "Deletion request submitted for staff review.",
      });
    return [created];
  });
  return res
    .status(201)
    .json(
      CreateDeletionRequestResponse.parse(deletionRequestResponse(request)),
    );
});
router.get("/deletion-requests/:requestId", async (req, res) => {
  const params = GetDeletionRequestParams.safeParse(req.params);
  if (!params.success)
    return fail(res, "A valid deletion request is required.");
  const request = (
    await db
      .select()
      .from(deletionRequestsTable)
      .where(eq(deletionRequestsTable.id, params.data.requestId))
      .limit(1)
  )[0];
  if (!request)
    return res.status(404).json({ error: "Deletion request not found." });
  if (!canViewDeletionRequest(req, request))
    return res
      .status(403)
      .json({ error: "You do not have access to this deletion request." });
  return res.json(
    GetDeletionRequestResponse.parse(await deletionRequestDetail(request)),
  );
});
router.post("/deletion-requests/:requestId", async (req, res) => {
  const params = ReviewDeletionRequestParams.safeParse(req.params);
  const body = ReviewDeletionRequestBody.safeParse(req.body);
  if (!params.success || !body.success)
    return fail(
      res,
      "Choose whether to approve or reject this deletion request.",
    );
  const request = (
    await db
      .select()
      .from(deletionRequestsTable)
      .where(eq(deletionRequestsTable.id, params.data.requestId))
      .limit(1)
  )[0];
  if (!request)
    return res.status(404).json({ error: "Deletion request not found." });
  const actor = canViewDeletionRequest(req, request);
  if (!actor || actor.role !== "SLP")
    return res
      .status(403)
      .json({ error: "Only authorized staff can review deletion requests." });
  const reviewedAt = new Date();
  const note = body.data.note?.trim() ?? "";
  if (body.data.decision === "reject") {
    const [rejected] = await db.transaction(async (tx) => {
      const updated = (
        await tx
          .update(deletionRequestsTable)
          .set({
            status: "rejected",
            reviewedAt,
            reviewedByUserId: actor.userId,
            reviewedByName: actor.author,
            reviewedByRole: actor.role,
            reviewNote: note,
            updatedAt: reviewedAt,
          })
          .where(
            and(
              eq(deletionRequestsTable.id, request.id),
              eq(deletionRequestsTable.status, "pending"),
            ),
          )
          .returning()
      )[0];
      if (!updated) return [];
      await tx
        .insert(deletionRequestAuditEventsTable)
        .values({
          requestId: request.id,
          action: "request_rejected",
          actorUserId: actor.userId,
          actorName: actor.author,
          actorRole: actor.role,
          note: note || "Request rejected during staff review.",
        });
      return [updated];
    });
    if (!rejected)
      return res
        .status(409)
        .json({ error: "This deletion request has already been reviewed." });
    return res.json(
      ReviewDeletionRequestResponse.parse(
        await deletionRequestDetail(rejected),
      ),
    );
  }
  const [claimed] = await db.transaction(async (tx) => {
    const updated = (
      await tx
        .update(deletionRequestsTable)
        .set({
          status: "processing",
          reviewedAt,
          reviewedByUserId: actor.userId,
          reviewedByName: actor.author,
          reviewedByRole: actor.role,
          reviewNote: note,
          updatedAt: reviewedAt,
        })
        .where(
          and(
            eq(deletionRequestsTable.id, request.id),
            eq(deletionRequestsTable.status, "pending"),
          ),
        )
        .returning()
    )[0];
    if (!updated) return [];
    await tx
      .insert(deletionRequestAuditEventsTable)
      .values({
        requestId: request.id,
        action: "request_approved",
        actorUserId: actor.userId,
        actorName: actor.author,
        actorRole: actor.role,
        note: note || "Request approved and queued for processing.",
      });
    return [updated];
  });
  if (!claimed)
    return res
      .status(409)
      .json({ error: "This deletion request has already been reviewed." });
  try {
    const outcome = await processDeletion(claimed);
    const [approved] = await db.transaction(async (tx) => {
      const updated = (
        await tx
          .update(deletionRequestsTable)
          .set({
            status: "approved",
            processedAt: new Date(),
            processedCategories: outcome.processedCategories,
            retainedCategories: outcome.retainedCategories,
            retentionNote: outcome.retentionNote,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(deletionRequestsTable.id, request.id),
              eq(deletionRequestsTable.status, "processing"),
            ),
          )
          .returning()
      )[0];
      if (!updated) throw new Error("Deletion request could not be approved.");
      await tx
        .insert(deletionRequestAuditEventsTable)
        .values({
          requestId: request.id,
          action: "records_processed",
          actorUserId: actor.userId,
          actorName: actor.author,
          actorRole: actor.role,
          note: `${outcome.processedCategories.join(", ") || "No mutable categories"} processed. ${outcome.retentionNote}`,
        });
      return [updated];
    });
    return res.json(
      ReviewDeletionRequestResponse.parse(
        await deletionRequestDetail(approved),
      ),
    );
  } catch (error) {
    req.log.error(
      { err: error, deletionRequestId: request.id },
      "Could not process approved deletion request",
    );
    await db
      .update(deletionRequestsTable)
      .set({
        retentionNote:
          "Processing requires manual reconciliation before completion can be confirmed.",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deletionRequestsTable.id, request.id),
          eq(deletionRequestsTable.status, "processing"),
        ),
      );
    return res
      .status(500)
      .json({
        error:
          "The deletion request needs staff reconciliation before processing can be confirmed.",
      });
  }
});

router.get("/dashboard", async (req, res) => {
  const parsed = GetDashboardQueryParams.safeParse(req.query);
  if (!parsed.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const organizationId = actor.organizationId;
  const childId = parsed.data.childId;
  const canViewClinicalWorkspace = canUseClinicalTools(actor);
  const [[profile], gestaltRows, observationRows, sessionRows] =
    await Promise.all([
      db
        .select()
        .from(childProfilesTable)
        .where(
          and(
            eq(childProfilesTable.id, childId),
            eq(childProfilesTable.organizationId, actor.organizationId),
            isNull(childProfilesTable.archivedAt),
          ),
        )
        .limit(1),
      db
        .select()
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.childId, childId),
            eq(clinicalGestaltsTable.organizationId, actor.organizationId),
            isNull(clinicalGestaltsTable.archivedAt),
          ),
        )
        .orderBy(desc(clinicalGestaltsTable.createdAt)),
      db
        .select()
        .from(clinicalObservationsTable)
        .where(
          and(
            eq(clinicalObservationsTable.childId, childId),
            eq(clinicalObservationsTable.organizationId, actor.organizationId),
          ),
        )
        .orderBy(desc(clinicalObservationsTable.createdAt)),
      canViewClinicalWorkspace
        ? db
            .select()
            .from(therapySessionsTable)
            .where(
              and(
                eq(therapySessionsTable.childId, childId),
                eq(therapySessionsTable.organizationId, actor.organizationId),
                isNull(therapySessionsTable.archivedAt),
              ),
            )
            .orderBy(desc(therapySessionsTable.createdAt))
        : Promise.resolve([]),
    ]);
  if (!profile) return res.status(404).json({ error: "Child not found" });
  const entries = gestaltRows.map(
    canViewClinicalWorkspace ? gestaltFromRecord : roleSafeGestalt,
  );
  let snapshot = canViewClinicalWorkspace
    ? await (async () => {
        const sessionIds = sessionRows.map((session) => session.id);
        const reviewedPhrases = sessionIds.length
          ? await db
              .select()
              .from(therapySessionGestaltsTable)
              .where(inArray(therapySessionGestaltsTable.sessionId, sessionIds))
          : [];
        const childPhrases = childAttributedOnly(reviewedPhrases);
        const transcriptPhraseIds = childPhrases
          .map((phrase) => phrase.transcriptPhraseId)
          .filter((id): id is number => typeof id === "number");
        const transcriptPhrases = transcriptPhraseIds.length
          ? await db
              .select()
              .from(transcriptPhrasesTable)
              .where(inArray(transcriptPhrasesTable.id, transcriptPhraseIds))
          : [];
        const frequencyByTranscriptPhrase = new Map(
          transcriptPhrases.map((phrase) => [phrase.id, phrase.frequency]),
        );
        const sessionById = new Map(
          sessionRows.map((session) => [session.id, session]),
        );
        const gestaltById = new Map(
          gestaltRows.map((gestalt) => [gestalt.id, gestalt]),
        );
        return buildChildSnapshot(
          gestaltRows.map((gestalt) => ({
            id: gestalt.id,
            phrase: gestalt.phrase,
            meaning: gestalt.meaning,
            communicationFunction: gestalt.communicationFunction,
            contexts: gestalt.contexts,
            createdAt: gestalt.createdAt,
          })),
          childPhrases.map((phrase) => ({
            sessionId: phrase.sessionId,
            phrase: phrase.phrase,
            meaning: phrase.meaning,
            communicationFunction: phrase.communicationFunction,
            context: phrase.context,
            gestaltId: phrase.gestaltId ?? null,
            originalPhrase: phrase.gestaltId
              ? (gestaltById.get(phrase.gestaltId)?.phrase ?? null)
              : null,
            sessionDate:
              sessionById.get(phrase.sessionId)?.createdAt ?? new Date(0),
            frequency:
              frequencyByTranscriptPhrase.get(
                phrase.transcriptPhraseId ?? -1,
              ) ?? 1,
          })),
          new Date(),
          profile.displayName,
        );
      })()
    : null;
  const frequentScripts = canViewClinicalWorkspace
    ? await frequentScriptsFor(organizationId, childId, "all")
    : null;
  if (snapshot && frequentScripts) {
    snapshot = {
      ...snapshot,
      frequentPhrases: frequentScripts.phrases.slice(0, 8).map((phrase) => ({
        phrase: phrase.phrase,
        gestaltId: phrase.id,
        occurrences: phrase.observations,
        contexts: phrase.contexts,
        function: phrase.communicationFunctions[0] ?? "Not yet reviewed",
        meaning: phrase.meaning,
        trend: "stable" as const,
        examples: [],
      })),
    };
  }
  const visibleObservations = canViewClinicalWorkspace
    ? observationRows
    : observationRows.filter(
        (observation) => observation.createdByUserId === actor.userId,
      );
  return res.json({
    child: childResponseForActor(profile, actor, entries.length),
    recentlyAdded: entries.slice(0, 4),
    frequent: frequentScripts
      ? frequentScripts.phrases
          .map((phrase) => entries.find((entry) => entry.id === phrase.id))
          .filter((entry): entry is Gestalt => Boolean(entry))
      : entries.slice(0, 3),
    activity: [
      ...(canViewClinicalWorkspace
        ? sessionRows.slice(0, 3).map((session) => ({
            id: 10_000 + session.id,
            author: "Care team member",
            role: "SLP",
            action: "saved a session note for",
            target: profile.displayName,
            time: session.createdAt.toISOString(),
          }))
        : []),
      ...visibleObservations.slice(0, 3).map((observation) => ({
        id: 20_000 + observation.id,
        author: "Care team member",
        role: canViewClinicalWorkspace ? "SLP" : actor.role,
        action: "added an observation",
        target: observation.context || "care session",
        time: observation.createdAt.toISOString(),
      })),
    ],
    observations: visibleObservations.map((observation) => ({
      ...observationVideoResponse(
        observation,
        actor,
        observation.createdByUserId,
      ),
    })),
    ...(canViewClinicalWorkspace ? { snapshot } : {}),
  });
});

router.get("/clinician-overview", async (req, res) => {
  const parsed = GetClinicianOverviewQueryParams.safeParse(req.query);
  if (!parsed.success) return fail(res, "The overview date is invalid.");
  const actor = requireClinician(req, res);
  if (!actor?.organizationId) return;
  const sinceValue = parsed.data.since ? Date.parse(parsed.data.since) : 0;
  const since = Number.isNaN(sinceValue) ? new Date(0) : new Date(sinceValue);
  const now = new Date();
  const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const profileConditions = [
    eq(childProfilesTable.organizationId, actor.organizationId),
    isNull(childProfilesTable.archivedAt),
  ];
  if (!actor.isAdmin) {
    profileConditions.push(
      inArray(
        childProfilesTable.id,
        actor.childIds.length ? actor.childIds : [-1],
      ),
    );
  }
  const profiles = await db
    .select()
    .from(childProfilesTable)
    .where(and(...profileConditions));
  const childIds = profiles.map((profile) => profile.id);
  const scopedChildIds = childIds.length ? childIds : [-1];
  const [
    gestalts,
    messages,
    observations,
    phraseObservations,
    insights,
    sessionRows,
  ] = await Promise.all([
    db
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.organizationId, actor.organizationId),
          isNull(clinicalGestaltsTable.archivedAt),
          inArray(clinicalGestaltsTable.childId, scopedChildIds),
        ),
      )
      .orderBy(desc(clinicalGestaltsTable.createdAt)),
    db
      .select({
        id: teamMessagesTable.id,
        childId: teamMessagesTable.childId,
        messageType: teamMessagesTable.messageType,
        createdAt: teamMessagesTable.createdAt,
      })
      .from(teamMessagesTable)
      .where(
        and(
          eq(teamMessagesTable.organizationId, actor.organizationId),
          inArray(teamMessagesTable.childId, scopedChildIds),
          gte(teamMessagesTable.createdAt, since),
        ),
      )
      .orderBy(desc(teamMessagesTable.createdAt)),
    db
      .select({
        id: clinicalObservationsTable.id,
        childId: clinicalObservationsTable.childId,
        createdAt: clinicalObservationsTable.createdAt,
      })
      .from(clinicalObservationsTable)
      .where(
        and(
          eq(clinicalObservationsTable.organizationId, actor.organizationId),
          inArray(clinicalObservationsTable.childId, scopedChildIds),
          gte(clinicalObservationsTable.createdAt, since),
        ),
      )
      .orderBy(desc(clinicalObservationsTable.createdAt)),
    db
      .select({
        id: phraseObservationsTable.id,
        childId: phraseObservationsTable.childId,
        observedAt: phraseObservationsTable.observedAt,
      })
      .from(phraseObservationsTable)
      .where(
        and(
          eq(phraseObservationsTable.organizationId, actor.organizationId),
          inArray(phraseObservationsTable.childId, scopedChildIds),
          gte(phraseObservationsTable.observedAt, since),
        ),
      )
      .orderBy(desc(phraseObservationsTable.observedAt)),
    db
      .select({
        id: clinicalKnowledgeInsightsTable.id,
        childId: clinicalKnowledgeInsightsTable.childId,
        category: clinicalKnowledgeInsightsTable.category,
        disposition: clinicalKnowledgeInsightsTable.disposition,
        status: clinicalKnowledgeInsightsTable.status,
        createdAt: clinicalKnowledgeInsightsTable.createdAt,
      })
      .from(clinicalKnowledgeInsightsTable)
      .where(
        and(
          eq(
            clinicalKnowledgeInsightsTable.organizationId,
            actor.organizationId,
          ),
          inArray(clinicalKnowledgeInsightsTable.childId, scopedChildIds),
        ),
      )
      .orderBy(desc(clinicalKnowledgeInsightsTable.createdAt)),
    db
      .select({
        id: therapySessionsTable.id,
        childId: therapySessionsTable.childId,
        createdAt: therapySessionsTable.createdAt,
      })
      .from(therapySessionsTable)
      .where(
        and(
          eq(therapySessionsTable.organizationId, actor.organizationId),
          inArray(therapySessionsTable.childId, scopedChildIds),
          isNull(therapySessionsTable.archivedAt),
        ),
      )
      .orderBy(desc(therapySessionsTable.createdAt)),
  ]);
  const reviewedGestalts = gestalts.filter(
    (item) =>
      !item.source.toLocaleLowerCase().includes("review pending") &&
      !item.meaning.toLocaleLowerCase().includes("awaiting clinician review") &&
      item.communicationFunction !== "Not yet reviewed",
  );
  const reviewedEvidenceAt = (item: (typeof reviewedGestalts)[number]) =>
    item.source.toLocaleLowerCase().includes("reviewed session")
      ? item.updatedAt
      : item.createdAt;
  const newPhrases = reviewedGestalts.filter(
    (item) => reviewedEvidenceAt(item) >= since,
  );
  const newPhrasesThisWeek = reviewedGestalts.filter(
    (item) => reviewedEvidenceAt(item) >= thisWeek,
  );
  const sessionIds = sessionRows.map((session) => session.id);
  const sessionPhrases = sessionIds.length
    ? await db
        .select()
        .from(therapySessionGestaltsTable)
        .where(inArray(therapySessionGestaltsTable.sessionId, sessionIds))
    : [];
  const sessionById = new Map(
    sessionRows.map((session) => [session.id, session]),
  );
  const gestaltById = new Map(gestalts.map((gestalt) => [gestalt.id, gestalt]));
  const countByChild = new Map<number, number>();
  reviewedGestalts.forEach((gestalt) =>
    countByChild.set(
      gestalt.childId,
      (countByChild.get(gestalt.childId) ?? 0) + 1,
    ),
  );
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const changesByChild = new Map<
    number,
    Array<{
      id: string;
      childId: number;
      childName: string;
      category:
        | "new_phrase"
        | "new_function"
        | "possible_mitigation"
        | "team_contribution"
        | "new_message"
        | "ai_insight";
      label: string;
      detail: string;
      time: string;
      href: string;
    }>
  >();
  const addChange = (change: {
    id: string;
    childId: number;
    category:
      | "new_phrase"
      | "new_function"
      | "possible_mitigation"
      | "team_contribution"
      | "new_message"
      | "ai_insight";
    label: string;
    detail: string;
    time: Date;
    href: string;
  }) => {
    const profile = profileById.get(change.childId);
    if (!profile) return;
    const entries = changesByChild.get(change.childId) ?? [];
    entries.push({
      ...change,
      childName: profile.displayName,
      time: change.time.toISOString(),
    });
    changesByChild.set(change.childId, entries);
  };
  newPhrases.forEach((item) =>
    addChange({
      id: `phrase-${item.id}`,
      childId: item.childId,
      category: "new_phrase",
      label: "New phrase",
      detail: `“${item.phrase}” · ${item.communicationFunction || "Communication function pending"}`,
      time: reviewedEvidenceAt(item),
      href: `/dictionary?childId=${item.childId}`,
    }),
  );
  observations.forEach((item) =>
    addChange({
      id: `contribution-${item.id}`,
      childId: item.childId,
      category: "team_contribution",
      label: "Team contribution",
      detail: "A care-team observation was added.",
      time: item.createdAt,
      href: `/team-communication?childId=${item.childId}`,
    }),
  );
  messages.forEach((item) =>
    addChange({
      id: `message-${item.id}`,
      childId: item.childId,
      category: "new_message",
      label: "New team message",
      detail:
        item.messageType === "question"
          ? "A care-team question needs attention."
          : "A new message was shared with the child’s care team.",
      time: item.createdAt,
      href: `/team-communication?childId=${item.childId}`,
    }),
  );
  const awaitingInsights = insights.filter(
    (item) => item.disposition === "exception" && item.status !== "reviewed",
  );
  awaitingInsights
    .filter((item) => item.createdAt >= since)
    .forEach((item) =>
      addChange({
        id: `insight-${item.id}`,
        childId: item.childId,
        category: "ai_insight",
        label: "AI insight to review",
        detail: `${item.category.replaceAll("_", " ")} · grounded in reviewed Child evidence.`,
        time: item.createdAt,
        href: `/clinical-knowledge?childId=${item.childId}`,
      }),
    );
  const childPhrases = childAttributedOnly(sessionPhrases);
  const reviewChildIds = new Set<number>([
    ...newPhrases.map((item) => item.childId),
    ...awaitingInsights.map((item) => item.childId),
  ]);
  for (const profile of profiles) {
    const snapshot = buildChildSnapshot(
      reviewedGestalts
        .filter((gestalt) => gestalt.childId === profile.id)
        .map((gestalt) => ({
          id: gestalt.id,
          phrase: gestalt.phrase,
          meaning: gestalt.meaning,
          communicationFunction: gestalt.communicationFunction,
          contexts: gestalt.contexts,
          createdAt: gestalt.createdAt,
        })),
      childPhrases
        .filter(
          (phrase) => sessionById.get(phrase.sessionId)?.childId === profile.id,
        )
        .map((phrase) => ({
          sessionId: phrase.sessionId,
          phrase: phrase.phrase,
          meaning: phrase.meaning,
          communicationFunction: phrase.communicationFunction,
          context: phrase.context,
          gestaltId: phrase.gestaltId ?? null,
          originalPhrase: phrase.gestaltId
            ? (gestaltById.get(phrase.gestaltId)?.phrase ?? null)
            : null,
          sessionDate:
            sessionById.get(phrase.sessionId)?.createdAt ?? new Date(0),
          frequency: 1,
        })),
      now,
      profile.displayName,
    ).sessionChange;
    const latestSessionAt = snapshot.latestSessionDate
      ? new Date(snapshot.latestSessionDate)
      : null;
    if (!latestSessionAt || latestSessionAt < since) continue;
    snapshot.newFunctions.forEach((item, index) => {
      reviewChildIds.add(profile.id);
      addChange({
        id: `function-${profile.id}-${item.label}-${index}`,
        childId: profile.id,
        category: "new_function",
        label: "New communication function",
        detail: `${item.label} · confirmed in the latest reviewed session.`,
        time: latestSessionAt,
        href: `/language-journey?childId=${profile.id}`,
      });
    });
    snapshot.possibleMitigations.forEach((item, index) => {
      reviewChildIds.add(profile.id);
      addChange({
        id: `mitigation-${profile.id}-${index}`,
        childId: profile.id,
        category: "possible_mitigation",
        label: "Possible mitigation",
        detail: `“${item.originalPhrase}” → “${item.observedVariation}” · ${item.confidence.toLowerCase()} confidence.`,
        time: latestSessionAt,
        href: `/language-journey?childId=${profile.id}`,
      });
    });
  }
  const activityEvents = [
    ...newPhrases.map((item) => ({
      childId: item.childId,
      activity: {
        id: 1_000_000 + item.id,
        author: "Care team member",
        role: "SLP",
        action: "added a reviewed phrase for",
        target: profileById.get(item.childId)?.displayName ?? "a child",
        time: reviewedEvidenceAt(item).toISOString(),
      },
    })),
    ...messages.map((item) => ({
      childId: item.childId,
      activity: {
        id: 2_000_000 + item.id,
        author: "Care team member",
        role: "Care team",
        action: "posted a team message for",
        target: profileById.get(item.childId)?.displayName ?? "a child",
        time: item.createdAt.toISOString(),
      },
    })),
    ...observations.map((item) => ({
      childId: item.childId,
      activity: {
        id: 3_000_000 + item.id,
        author: "Care team member",
        role: "Care team",
        action: "added an observation for",
        target: profileById.get(item.childId)?.displayName ?? "a child",
        time: item.createdAt.toISOString(),
      },
    })),
    ...awaitingInsights
      .filter((item) => item.createdAt >= since)
      .map((item) => ({
        childId: item.childId,
        activity: {
          id: 4_000_000 + item.id,
          author: "Clinical insights",
          role: "Review support",
          action: "flagged an insight for",
          target: profileById.get(item.childId)?.displayName ?? "a child",
          time: item.createdAt.toISOString(),
        },
      })),
    ...phraseObservations.map((item) => ({
      childId: item.childId,
      activity: {
        id: 5_000_000 + item.id,
        author: "Care team member",
        role: "SLP",
        action: "added a phrase observation for",
        target: profileById.get(item.childId)?.displayName ?? "a child",
        time: item.observedAt.toISOString(),
      },
    })),
  ].sort((left, right) =>
    right.activity.time.localeCompare(left.activity.time),
  );
  const activity = activityEvents.slice(0, 12).map((event) => event.activity);
  const newActivityByChild = new Map<number, number>();
  for (const [childId, changes] of changesByChild)
    newActivityByChild.set(childId, changes.length);
  const latestByChild = new Map<number, { time: string; label: string }>();
  for (const event of activityEvents) {
    if (!latestByChild.has(event.childId)) {
      latestByChild.set(event.childId, {
        time: event.activity.time,
        label: `${event.activity.action} ${event.activity.target}`,
      });
    }
  }
  return res.json(
    GetClinicianOverviewResponse.parse({
      caseloadCount: profiles.length,
      activeChildren: profiles.length,
      newPhrasesThisWeek: newPhrasesThisWeek.length,
      pendingReviews: reviewChildIds.size,
      newPhrasesSinceLastSignIn: newPhrases.length,
      newTeamMessages: messages.length,
      aiInsightsAwaitingReview: awaitingInsights.length,
      studentsRequiringReview: reviewChildIds.size,
      changesByChild: profiles.flatMap((profile) => {
        const changes = (changesByChild.get(profile.id) ?? []).sort(
          (left, right) => right.time.localeCompare(left.time),
        );
        return changes.length
          ? [{ childId: profile.id, childName: profile.displayName, changes }]
          : [];
      }),
      children: profiles.map((profile) => ({
        childId: profile.id,
        childName: profile.displayName,
        school: profile.school,
        grade: profile.grade,
        gestaltCount: countByChild.get(profile.id) ?? 0,
        newActivityCount: newActivityByChild.get(profile.id) ?? 0,
        requiresReview: reviewChildIds.has(profile.id),
        latestActivityAt: latestByChild.get(profile.id)?.time ?? null,
        latestActivityLabel:
          latestByChild.get(profile.id)?.label ?? "No new activity",
      })),
      recentActivity: activity,
    }),
  );
});

router.get("/teacher-overview", async (req, res) => {
  const parsed = GetTeacherOverviewQueryParams.safeParse(req.query);
  if (!parsed.success) return fail(res, "The overview date is invalid.");
  const actor = viewerFrom(req);
  if (!actor) {
    return res
      .status(req.echomapAuthFailure ? 403 : 401)
      .json({ error: authenticationError(req) });
  }
  if (actor.role !== "Teacher" || !actor.organizationId) {
    return res
      .status(403)
      .json({
        error:
          "Authorized teacher access is required for this classroom overview.",
      });
  }
  const sinceValue = parsed.data.since ? Date.parse(parsed.data.since) : 0;
  const since = Number.isNaN(sinceValue) ? new Date(0) : new Date(sinceValue);
  const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const profiles = await db
    .select()
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
        inArray(
          childProfilesTable.id,
          actor.childIds.length ? actor.childIds : [-1],
        ),
      ),
    );
  const childIds = profiles.map((profile) => profile.id);
  const scopedChildIds = childIds.length ? childIds : [-1];
  const [gestalts, messages, observations, phraseObservations] =
    await Promise.all([
      db
        .select()
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.organizationId, actor.organizationId),
            isNull(clinicalGestaltsTable.archivedAt),
            inArray(clinicalGestaltsTable.childId, scopedChildIds),
          ),
        )
        .orderBy(desc(clinicalGestaltsTable.createdAt)),
      db
        .select({
          id: teamMessagesTable.id,
          childId: teamMessagesTable.childId,
          messageType: teamMessagesTable.messageType,
          createdAt: teamMessagesTable.createdAt,
        })
        .from(teamMessagesTable)
        .where(
          and(
            eq(teamMessagesTable.organizationId, actor.organizationId),
            inArray(teamMessagesTable.childId, scopedChildIds),
            gte(teamMessagesTable.createdAt, since),
          ),
        )
        .orderBy(desc(teamMessagesTable.createdAt)),
      db
        .select({
          id: clinicalObservationsTable.id,
          childId: clinicalObservationsTable.childId,
          createdAt: clinicalObservationsTable.createdAt,
        })
        .from(clinicalObservationsTable)
        .where(
          and(
            eq(clinicalObservationsTable.organizationId, actor.organizationId),
            inArray(clinicalObservationsTable.childId, scopedChildIds),
            gte(clinicalObservationsTable.createdAt, since),
          ),
        )
        .orderBy(desc(clinicalObservationsTable.createdAt)),
      db
        .select({
          id: phraseObservationsTable.id,
          childId: phraseObservationsTable.childId,
          observedAt: phraseObservationsTable.observedAt,
        })
        .from(phraseObservationsTable)
        .where(
          and(
            eq(phraseObservationsTable.organizationId, actor.organizationId),
            inArray(phraseObservationsTable.childId, scopedChildIds),
            gte(phraseObservationsTable.observedAt, since),
          ),
        )
        .orderBy(desc(phraseObservationsTable.observedAt)),
    ]);
  const reviewedGestalts = gestalts.filter(
    (item) =>
      !item.source.toLocaleLowerCase().includes("review pending") &&
      !item.meaning.toLocaleLowerCase().includes("awaiting clinician review") &&
      item.communicationFunction !== "Not yet reviewed",
  );
  const reviewedEvidenceAt = (item: (typeof reviewedGestalts)[number]) =>
    item.source.toLocaleLowerCase().includes("reviewed session")
      ? item.updatedAt
      : item.createdAt;
  const newPhrases = reviewedGestalts.filter(
    (item) => reviewedEvidenceAt(item) >= since,
  );
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const countByChild = new Map<number, number>();
  reviewedGestalts.forEach((item) =>
    countByChild.set(item.childId, (countByChild.get(item.childId) ?? 0) + 1),
  );
  const activityEvents = [
    ...newPhrases.map((item) => ({
      childId: item.childId,
      activity: {
        id: 1_000_000 + item.id,
        author: "Care team member",
        role: "Care team",
        action: "shared a reviewed phrase for",
        target: profileById.get(item.childId)?.displayName ?? "a student",
        time: reviewedEvidenceAt(item).toISOString(),
      },
    })),
    ...messages.map((item) => ({
      childId: item.childId,
      activity: {
        id: 2_000_000 + item.id,
        author: "Care team member",
        role: "Care team",
        action:
          item.messageType === "question"
            ? "asked a team question for"
            : "posted a team message for",
        target: profileById.get(item.childId)?.displayName ?? "a student",
        time: item.createdAt.toISOString(),
      },
    })),
    ...observations.map((item) => ({
      childId: item.childId,
      activity: {
        id: 3_000_000 + item.id,
        author: "Care team member",
        role: "Care team",
        action: "added an observation for",
        target: profileById.get(item.childId)?.displayName ?? "a student",
        time: item.createdAt.toISOString(),
      },
    })),
    ...phraseObservations.map((item) => ({
      childId: item.childId,
      activity: {
        id: 4_000_000 + item.id,
        author: "Care team member",
        role: "Care team",
        action: "logged a phrase observation for",
        target: profileById.get(item.childId)?.displayName ?? "a student",
        time: item.observedAt.toISOString(),
      },
    })),
  ].sort((left, right) =>
    right.activity.time.localeCompare(left.activity.time),
  );
  const activityByChild = new Map<number, typeof activityEvents>();
  activityEvents.forEach((event) =>
    activityByChild.set(event.childId, [
      ...(activityByChild.get(event.childId) ?? []),
      event,
    ]),
  );
  const attentionChildIds = new Set([
    ...newPhrases.map((item) => item.childId),
    ...messages
      .filter((item) => item.messageType === "question")
      .map((item) => item.childId),
  ]);
  const children = profiles.map((profile) => {
    const latest = activityByChild.get(profile.id)?.[0];
    return {
      childId: profile.id,
      childName: profile.displayName,
      school: profile.school,
      grade: profile.grade,
      gestaltCount: countByChild.get(profile.id) ?? 0,
      newActivityCount: activityByChild.get(profile.id)?.length ?? 0,
      requiresReview: attentionChildIds.has(profile.id),
      latestActivityAt: latest?.activity.time ?? null,
      latestActivityLabel: latest
        ? `${latest.activity.action} ${latest.activity.target}`
        : "No new classroom activity",
    };
  });
  return res.json(
    GetTeacherOverviewResponse.parse({
      caseloadCount: profiles.length,
      activeChildren: profiles.length,
      newPhrasesThisWeek: reviewedGestalts.filter(
        (item) => reviewedEvidenceAt(item) >= thisWeek,
      ).length,
      pendingReviews: attentionChildIds.size,
      newPhrasesSinceLastSignIn: newPhrases.length,
      newTeamMessages: messages.length,
      aiInsightsAwaitingReview: 0,
      studentsRequiringReview: attentionChildIds.size,
      changesByChild: [],
      children,
      recentActivity: activityEvents
        .slice(0, 12)
        .map((event) => event.activity),
    }),
  );
});

router.get("/teacher-phrase-lookup", async (req, res) => {
  const parsed = GetTeacherPhraseLookupQueryParams.safeParse(req.query);
  if (!parsed.success)
    return fail(
      res,
      "Select a student and enter at least two characters to look up a phrase.",
    );
  const actor = viewerFrom(req);
  if (!actor) {
    return res
      .status(req.echomapAuthFailure ? 403 : 401)
      .json({ error: authenticationError(req) });
  }
  if (actor.role !== "Teacher" || !actor.organizationId) {
    return res
      .status(403)
      .json({
        error: "Authorized teacher access is required for phrase lookup.",
      });
  }
  const profiles = await db
    .select({
      id: childProfilesTable.id,
      displayName: childProfilesTable.displayName,
    })
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, parsed.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
        inArray(
          childProfilesTable.id,
          actor.childIds.length ? actor.childIds : [-1],
        ),
      ),
    );
  if (!profiles.length) {
    return res
      .status(403)
      .json({
        error: "You are not authorized to look up phrases for this student.",
      });
  }
  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile.displayName]),
  );
  const matches = await db
    .select()
    .from(clinicalGestaltsTable)
    .where(
      and(
        eq(clinicalGestaltsTable.organizationId, actor.organizationId),
        isNull(clinicalGestaltsTable.archivedAt),
        eq(clinicalGestaltsTable.childId, parsed.data.childId),
        ilike(clinicalGestaltsTable.phrase, `%${parsed.data.query.trim()}%`),
      ),
    )
    .orderBy(desc(clinicalGestaltsTable.updatedAt))
    .limit(12);
  return res.json(
    GetTeacherPhraseLookupResponse.parse(
      matches
        .filter(
          (item) =>
            !item.source.toLocaleLowerCase().includes("review pending") &&
            !item.meaning
              .toLocaleLowerCase()
              .includes("awaiting clinician review") &&
            item.communicationFunction !== "Not yet reviewed",
        )
        .map((item) => {
          const safe = roleSafeGestalt(item);
          return {
            id: item.id,
            childId: item.childId,
            childName: profileById.get(item.childId) ?? "Student",
            phrase: safe.phrase,
            meaning: safe.meaning,
            communicationFunction: safe.function,
          };
        }),
    ),
  );
});

router.get("/frequent-scripts", async (req, res): Promise<void> => {
  const parsed = GetFrequentScriptsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    fail(res, "A child and valid time window are required.");
    return;
  }
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId) {
    res.status(401).json({ error: authenticationError(req) });
    return;
  }
  // This is a clinical evidence aggregation. Parent and Teacher portals keep
  // their smaller, deliberately role-safe dictionary projections.
  if (!canUseClinicalTools(actor)) {
    res
      .status(403)
      .json({
        error: "Frequent Scripts is available in the clinical workspace only.",
      });
    return;
  }
  const summary = await frequentScriptsFor(
    actor.organizationId,
    parsed.data.childId,
    parsed.data.window,
  );
  if (!summary) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  res.json(GetFrequentScriptsResponse.parse(summary));
});

router.get("/recurring-language-patterns", async (req, res): Promise<void> => {
  const parsed = GetRecurringLanguagePatternsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    fail(res, "A child and valid time window are required.");
    return;
  }
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId) {
    res.status(401).json({ error: authenticationError(req) });
    return;
  }
  if (!canUseClinicalTools(actor)) {
    res
      .status(403)
      .json({
        error:
          "Recurring Language Patterns is available in the clinical workspace only.",
      });
    return;
  }
  const result = await recurringLanguagePatternsFor(
    actor.organizationId,
    parsed.data.childId,
    parsed.data.window,
  );
  if (!result) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  const { details: _details, ...summary } = result;
  res.json(GetRecurringLanguagePatternsResponse.parse(summary));
});

router.get(
  "/recurring-language-pattern-detail",
  async (req, res): Promise<void> => {
    const parsed = GetRecurringLanguagePatternDetailQueryParams.safeParse(
      req.query,
    );
    if (!parsed.success) {
      fail(res, "A child, pattern, and valid time window are required.");
      return;
    }
    if (!requireChildAccess(req, res, parsed.data.childId)) return;
    const actor = viewerFrom(req);
    if (!actor?.organizationId) {
      res.status(401).json({ error: authenticationError(req) });
      return;
    }
    if (!canUseClinicalTools(actor)) {
      res
        .status(403)
        .json({
          error:
            "Recurring Language Patterns is available in the clinical workspace only.",
        });
      return;
    }
    const result = await recurringLanguagePatternsFor(
      actor.organizationId,
      parsed.data.childId,
      parsed.data.window,
    );
    if (!result) {
      res.status(404).json({ error: "Child not found" });
      return;
    }
    const detail = result.details.find(
      (pattern) => pattern.id === parsed.data.patternId,
    );
    if (!detail) {
      res.status(404).json({ error: "Recurring language pattern not found" });
      return;
    }
    res.json(GetRecurringLanguagePatternDetailResponse.parse(detail));
  },
);

router.get("/parent-learning-center", async (req, res): Promise<void> => {
  const parsed = GetParentLearningCenterQueryParams.safeParse(req.query);
  if (!parsed.success) {
    fail(res, "A child is required to open the Learning Center.");
    return;
  }
  const actor = requireFamilyLearningAccess(req, res, parsed.data.childId);
  if (!actor?.organizationId) return;
  const center = await parentLearningCenterFor(
    actor as CareTeamActor & { organizationId: number },
    parsed.data.childId,
  );
  res.json(GetParentLearningCenterResponse.parse(center));
});

router.get(
  "/parent-learning-center/module",
  async (req, res): Promise<void> => {
    const parsed = GetParentLearningModuleQueryParams.safeParse(req.query);
    if (!parsed.success) {
      fail(res, "A child and learning module are required.");
      return;
    }
    const actor = requireFamilyLearningAccess(req, res, parsed.data.childId);
    if (!actor?.organizationId) return;
    const center = await parentLearningCenterFor(
      actor as CareTeamActor & { organizationId: number },
      parsed.data.childId,
    );
    const module = center.modules.find(
      (entry) => entry.moduleKey === parsed.data.moduleKey,
    );
    if (!module) {
      res.status(404).json({ error: "Learning module not found." });
      return;
    }
    res.json(
      GetParentLearningModuleResponse.parse({
        ...module,
        resource: center.resource,
      }),
    );
  },
);

router.put(
  "/parent-learning-center/progress",
  async (req, res): Promise<void> => {
    const parsed = UpdateParentLearningProgressBody.safeParse(req.body);
    if (!parsed.success) {
      fail(
        res,
        "A child, learning module, and valid progress update are required.",
      );
      return;
    }
    const actor = requireFamilyLearningAccess(req, res, parsed.data.childId);
    if (!actor?.organizationId) return;
    const { resource, modules } = await ensureParentLearningCenter(
      actor.organizationId,
    );
    const module = modules.find(
      (entry) => entry.moduleKey === parsed.data.moduleKey,
    );
    if (!module) {
      res.status(404).json({ error: "Learning module not found." });
      return;
    }
    const [existing] = await db
      .select()
      .from(parentLearningProgressTable)
      .where(
        and(
          eq(parentLearningProgressTable.organizationId, actor.organizationId),
          eq(parentLearningProgressTable.childId, parsed.data.childId),
          eq(parentLearningProgressTable.userId, actor.userId),
          eq(parentLearningProgressTable.moduleId, module.id),
        ),
      )
      .limit(1);
    const bookmarked = parsed.data.bookmarked ?? existing?.bookmarked ?? false;
    const completed = parsed.data.completed ?? existing?.completed ?? false;
    const lastViewedAt = parsed.data.markViewed
      ? new Date()
      : (existing?.lastViewedAt ?? null);
    const completedAt = completed
      ? (existing?.completedAt ?? new Date())
      : null;
    const values = {
      organizationId: actor.organizationId,
      childId: parsed.data.childId,
      userId: actor.userId,
      resourceId: resource.id,
      moduleId: module.id,
      bookmarked,
      completed,
      lastViewedAt,
      completedAt,
      updatedAt: new Date(),
    };
    const [saved] = existing
      ? await db
          .update(parentLearningProgressTable)
          .set(values)
          .where(
            and(
              eq(parentLearningProgressTable.id, existing.id),
              eq(
                parentLearningProgressTable.organizationId,
                actor.organizationId,
              ),
              eq(parentLearningProgressTable.userId, actor.userId),
              eq(parentLearningProgressTable.childId, parsed.data.childId),
            ),
          )
          .returning()
      : await db.insert(parentLearningProgressTable).values(values).returning();
    if (!saved)
      throw new Error("Learning progress was not returned after save.");
    await writeSecurityAudit({
      actor,
      action: "PARENT_LEARNING_PROGRESS_UPDATED",
      targetType: "parent_learning_module",
      targetId: module.moduleKey,
      childId: parsed.data.childId,
      metadata: {
        bookmarked: saved.bookmarked,
        completed: saved.completed,
        viewed: Boolean(parsed.data.markViewed),
      },
    });
    res.json(
      UpdateParentLearningProgressResponse.parse({
        moduleKey: module.moduleKey,
        bookmarked: saved.bookmarked,
        completed: saved.completed,
        lastViewedAt: saved.lastViewedAt?.toISOString() ?? null,
        completedAt: saved.completedAt?.toISOString() ?? null,
      }),
    );
  },
);

router.put(
  "/parent-learning-center/reflection",
  async (req, res): Promise<void> => {
    const parsed = UpdateParentLearningReflectionBody.safeParse(req.body);
    if (!parsed.success) {
      fail(
        res,
        "A child, learning module, and reflection of 5,000 characters or fewer are required.",
      );
      return;
    }
    const actor = requireFamilyLearningAccess(req, res, parsed.data.childId);
    if (!actor?.organizationId) return;
    const { resource, modules } = await ensureParentLearningCenter(
      actor.organizationId,
    );
    const module = modules.find(
      (entry) => entry.moduleKey === parsed.data.moduleKey,
    );
    if (!module) {
      res.status(404).json({ error: "Learning module not found." });
      return;
    }
    const body = parsed.data.body.trim();
    const [saved] = await db
      .insert(parentLearningReflectionsTable)
      .values({
        organizationId: actor.organizationId,
        childId: parsed.data.childId,
        userId: actor.userId,
        resourceId: resource.id,
        moduleId: module.id,
        body,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          parentLearningReflectionsTable.userId,
          parentLearningReflectionsTable.childId,
          parentLearningReflectionsTable.moduleId,
        ],
        set: {
          body,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!saved)
      throw new Error("Learning reflection was not returned after save.");
    await writeSecurityAudit({
      actor,
      action: "PARENT_LEARNING_REFLECTION_UPDATED",
      targetType: "parent_learning_module",
      targetId: module.moduleKey,
      childId: parsed.data.childId,
      metadata: {
        hasReflection: Boolean(saved.body),
        characterCount: saved.body.length,
      },
    });
    res.json(
      UpdateParentLearningReflectionResponse.parse({
        moduleKey: module.moduleKey,
        body: saved.body,
        updatedAt: saved.updatedAt.toISOString(),
      }),
    );
  },
);

router.get(
  "/parent-learning-center/download",
  async (req, res): Promise<void> => {
    const parsed = DownloadParentLearningHandbookQueryParams.safeParse(
      req.query,
    );
    if (!parsed.success) {
      fail(res, "A child is required to download the handbook.");
      return;
    }
    const actor = requireFamilyLearningAccess(req, res, parsed.data.childId);
    if (!actor?.organizationId) return;
    const { resource } = await ensureParentLearningCenter(actor.organizationId);
    if (!resource.pdfObjectPath || !resource.pdfContentType) {
      res.status(404).json({ error: "Handbook not found." });
      return;
    }
    try {
      const data = await createClinicalKnowledgeObjectStore().get(
        resource.pdfObjectPath,
      );
      await writeSecurityAudit({
        actor,
        action: "PARENT_LEARNING_HANDBOOK_DOWNLOADED",
        targetType: "parent_learning_resource",
        targetId: resource.resourceKey,
        childId: parsed.data.childId,
        metadata: { contentVersion: resource.contentVersion },
      });
      res.setHeader("Content-Type", resource.pdfContentType);
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="EchoMap-Parent-Coaching-Handbook.pdf"',
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.send(data);
    } catch {
      res.status(404).json({ error: "Handbook not found." });
    }
  },
);

router.get("/teacher-resource-center", async (req, res): Promise<void> => {
  const parsed = GetTeacherResourceCenterQueryParams.safeParse(req.query);
  if (!parsed.success)
    return void fail(res, "A child is required to open Teacher Resources.");
  const actor = requireTeacherResourceAccess(req, res, parsed.data.childId);
  if (!actor?.organizationId) return;
  const center = await teacherResourceCenterFor(
    actor as CareTeamActor & { organizationId: number },
    parsed.data.childId,
  );
  res.json(GetTeacherResourceCenterResponse.parse(center));
});

router.put(
  "/teacher-resource-center/progress",
  async (req, res): Promise<void> => {
    const parsed = UpdateTeacherResourceProgressBody.safeParse(req.body);
    if (!parsed.success)
      return void fail(res, "A child and resource are required.");
    const actor = requireTeacherResourceAccess(req, res, parsed.data.childId);
    if (!actor?.organizationId) return;
    const { resource, items } = await ensureTeacherResourceCenter(
      actor.organizationId,
    );
    const item = items.find(
      (entry) => entry.resourceKey === parsed.data.resourceKey,
    );
    if (!item)
      return void res
        .status(404)
        .json({ error: "Teacher resource not found." });
    const now = new Date();
    const [saved] = await db
      .insert(teacherResourceProgressTable)
      .values({
        organizationId: actor.organizationId,
        childId: parsed.data.childId,
        userId: actor.userId,
        resourceId: resource.id,
        itemId: item.id,
        bookmarked: parsed.data.bookmarked ?? false,
        completed: parsed.data.completed ?? false,
        lastViewedAt: parsed.data.markViewed ? now : null,
        completedAt: parsed.data.completed ? now : null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          teacherResourceProgressTable.userId,
          teacherResourceProgressTable.childId,
          teacherResourceProgressTable.itemId,
        ],
        set: {
          bookmarked:
            parsed.data.bookmarked === undefined
              ? sql`${teacherResourceProgressTable.bookmarked}`
              : parsed.data.bookmarked,
          completed:
            parsed.data.completed === undefined
              ? sql`${teacherResourceProgressTable.completed}`
              : parsed.data.completed,
          lastViewedAt: parsed.data.markViewed
            ? now
            : sql`${teacherResourceProgressTable.lastViewedAt}`,
          completedAt:
            parsed.data.completed === undefined
              ? sql`${teacherResourceProgressTable.completedAt}`
              : parsed.data.completed
                ? sql`coalesce(${teacherResourceProgressTable.completedAt}, ${now})`
                : null,
          updatedAt: now,
        },
      })
      .returning();
    if (!saved) throw new Error("Teacher resource progress was not saved.");
    await writeSecurityAudit({
      actor,
      action: "TEACHER_RESOURCE_PROGRESS_UPDATED",
      targetType: "teacher_resource",
      targetId: item.resourceKey,
      childId: parsed.data.childId,
      metadata: { bookmarked: saved.bookmarked, completed: saved.completed },
    });
    res.json(
      UpdateTeacherResourceProgressResponse.parse({
        resourceKey: item.resourceKey,
        bookmarked: saved.bookmarked,
        completed: saved.completed,
        lastViewedAt: saved.lastViewedAt?.toISOString() ?? null,
        completedAt: saved.completedAt?.toISOString() ?? null,
      }),
    );
  },
);

router.get(
  "/teacher-resource-center/download",
  async (req, res): Promise<void> => {
    const parsed = DownloadTeacherResourceHandbookQueryParams.safeParse(
      req.query,
    );
    if (!parsed.success)
      return void fail(
        res,
        "A child is required to download teacher resources.",
      );
    const actor = requireTeacherResourceAccess(req, res, parsed.data.childId);
    if (!actor?.organizationId) return;
    const { resource } = await ensureTeacherResourceCenter(
      actor.organizationId,
    );
    if (!resource.pdfObjectPath || !resource.pdfContentType)
      return void res
        .status(404)
        .json({ error: "Teacher handbook not found." });
    try {
      const data = await createClinicalKnowledgeObjectStore().get(
        resource.pdfObjectPath,
      );
      await writeSecurityAudit({
        actor,
        action: "TEACHER_RESOURCE_HANDBOOK_DOWNLOADED",
        targetType: "teacher_resource",
        targetId: TEACHER_RESOURCE_KEY,
        childId: parsed.data.childId,
        metadata: { contentVersion: resource.contentVersion },
      });
      res.setHeader("Content-Type", resource.pdfContentType);
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="EchoMap-Teacher-Resources.pdf"',
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.send(data);
    } catch {
      res.status(404).json({ error: "Teacher handbook not found." });
    }
  },
);

router.get("/clinician-learning-center", async (req, res): Promise<void> => {
  const actor = requireClinicianLearningAccess(req, res);
  if (!actor) return;
  const center = await clinicianLearningCenterFor(actor);
  res.json(GetClinicianLearningCenterResponse.parse(center));
});

router.put(
  "/clinician-learning-center/progress",
  async (req, res): Promise<void> => {
    const parsed = UpdateClinicianLearningProgressBody.safeParse(req.body);
    if (!parsed.success)
      return void fail(res, "A clinician learning module is required.");
    const actor = requireClinicianLearningAccess(req, res);
    if (!actor) return;
    const { resource, modules } = await ensureClinicianLearningCenter(
      actor.organizationId,
    );
    const module = modules.find(
      (entry) => entry.moduleKey === parsed.data.moduleKey,
    );
    if (!module)
      return void res
        .status(404)
        .json({ error: "Clinician learning module not found." });
    const sectionProgress = parsed.data.lastSectionKey
      ? resolveClinicianLearningSectionProgress(
          module.sections,
          parsed.data.lastSectionKey,
          parsed.data.progressPercent,
        )
      : null;
    if (
      (parsed.data.lastSectionKey && !sectionProgress) ||
      (parsed.data.progressPercent !== undefined && !parsed.data.lastSectionKey)
    )
      return void fail(
        res,
        "Choose a valid section from this clinician learning module.",
      );
    const now = new Date();
    const [saved] = await db
      .insert(clinicianLearningProgressTable)
      .values({
        organizationId: actor.organizationId,
        userId: actor.userId,
        resourceId: resource.id,
        moduleId: module.id,
        bookmarked: parsed.data.bookmarked ?? false,
        completed: parsed.data.completed ?? false,
        lastSectionKey: sectionProgress?.sectionKey ?? null,
        progressPercent: sectionProgress?.progressPercent ?? 0,
        lastViewedAt: parsed.data.markViewed ? now : null,
        completedAt: parsed.data.completed ? now : null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          clinicianLearningProgressTable.organizationId,
          clinicianLearningProgressTable.userId,
          clinicianLearningProgressTable.moduleId,
        ],
        set: {
          bookmarked:
            parsed.data.bookmarked === undefined
              ? sql`${clinicianLearningProgressTable.bookmarked}`
              : parsed.data.bookmarked,
          completed:
            parsed.data.completed === undefined
              ? sql`${clinicianLearningProgressTable.completed}`
              : parsed.data.completed,
          lastSectionKey:
            sectionProgress === null
              ? sql`${clinicianLearningProgressTable.lastSectionKey}`
              : sectionProgress.sectionKey,
          progressPercent:
            sectionProgress === null
              ? sql`${clinicianLearningProgressTable.progressPercent}`
              : sectionProgress.progressPercent,
          lastViewedAt: parsed.data.markViewed
            ? now
            : sql`${clinicianLearningProgressTable.lastViewedAt}`,
          completedAt:
            parsed.data.completed === undefined
              ? sql`${clinicianLearningProgressTable.completedAt}`
              : parsed.data.completed
                ? sql`coalesce(${clinicianLearningProgressTable.completedAt}, ${now})`
                : null,
          updatedAt: now,
        },
      })
      .returning();
    if (!saved) throw new Error("Clinician learning progress was not saved.");
    await writeSecurityAudit({
      actor,
      action: "CLINICIAN_LEARNING_PROGRESS_UPDATED",
      targetType: "clinician_learning_module",
      targetId: module.moduleKey,
      metadata: { bookmarked: saved.bookmarked, completed: saved.completed },
    });
    res.json(
      UpdateClinicianLearningProgressResponse.parse({
        moduleKey: module.moduleKey,
        bookmarked: saved.bookmarked,
        completed: saved.completed,
        progressPercent: saved.progressPercent,
        lastSectionKey: saved.lastSectionKey,
        lastViewedAt: saved.lastViewedAt?.toISOString() ?? null,
        completedAt: saved.completedAt?.toISOString() ?? null,
      }),
    );
  },
);

router.get(
  "/clinician-learning-center/preferences",
  async (req, res): Promise<void> => {
    const actor = requireClinicianLearningAccess(req, res);
    if (!actor) return;
    const [preference] = await db
      .select()
      .from(clinicianLearningPreferencesTable)
      .where(
        and(
          eq(
            clinicianLearningPreferencesTable.organizationId,
            actor.organizationId,
          ),
          eq(clinicianLearningPreferencesTable.userId, actor.userId),
        ),
      )
      .limit(1);
    res.json(
      GetClinicianLearningPreferencesResponse.parse({
        workflowCoachingEnabled: preference?.workflowCoachingEnabled ?? false,
      }),
    );
  },
);

router.put(
  "/clinician-learning-center/preferences",
  async (req, res): Promise<void> => {
    const parsed = UpdateClinicianLearningPreferencesBody.safeParse(req.body);
    if (!parsed.success)
      return void fail(res, "A workflow coaching preference is required.");
    const actor = requireClinicianLearningAccess(req, res);
    if (!actor) return;
    const [saved] = await db
      .insert(clinicianLearningPreferencesTable)
      .values({
        organizationId: actor.organizationId,
        userId: actor.userId,
        workflowCoachingEnabled: parsed.data.workflowCoachingEnabled,
      })
      .onConflictDoUpdate({
        target: [
          clinicianLearningPreferencesTable.organizationId,
          clinicianLearningPreferencesTable.userId,
        ],
        set: {
          workflowCoachingEnabled: parsed.data.workflowCoachingEnabled,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!saved) throw new Error("Workflow coaching preference was not saved.");
    await writeSecurityAudit({
      actor,
      action: "CLINICIAN_WORKFLOW_COACHING_UPDATED",
      targetType: "clinician_learning_preference",
      targetId: actor.userId,
      metadata: { workflowCoachingEnabled: saved.workflowCoachingEnabled },
    });
    res.json(
      UpdateClinicianLearningPreferencesResponse.parse({
        workflowCoachingEnabled: saved.workflowCoachingEnabled,
      }),
    );
  },
);

router.get(
  "/clinician-learning-center/download",
  async (req, res): Promise<void> => {
    const actor = requireClinicianLearningAccess(req, res);
    if (!actor) return;
    await ensureClinicianLearningCenter(actor.organizationId);
    await writeSecurityAudit({
      actor,
      action: "CLINICIAN_LEARNING_HANDBOOK_DOWNLOADED",
      targetType: "clinician_learning_resource",
      targetId: CLINICIAN_LEARNING_RESOURCE_KEY,
      metadata: { contentVersion: "1.0" },
    });
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="EchoMap-Clinician-Learning-Handbook.txt"',
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.send(clinicianLearningHandbookText());
  },
);

router.get("/children", async (req, res) => {
  await ensureSessionStore();
  const actor = viewerFrom(req);
  if (!actor)
    return res
      .status(401)
      .json({ error: "Please sign in to access child profiles." });
  if (actor.organizationId) {
    const profileConditions = [
      eq(childProfilesTable.organizationId, actor.organizationId),
      isNull(childProfilesTable.archivedAt),
    ];
    if (!actor.isAdmin) {
      profileConditions.push(
        inArray(
          childProfilesTable.id,
          actor.childIds.length ? actor.childIds : [-1],
        ),
      );
    }
    const profiles = await db
      .select()
      .from(childProfilesTable)
      .where(and(...profileConditions));
    const childIds = profiles.map((profile) => profile.id);
    const [counts, aacProfiles] = await Promise.all([
      db
        .select({
          childId: clinicalGestaltsTable.childId,
          count: sql<number>`count(*)::int`,
        })
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.organizationId, actor.organizationId),
            isNull(clinicalGestaltsTable.archivedAt),
            inArray(
              clinicalGestaltsTable.childId,
              childIds.length ? childIds : [-1],
            ),
          ),
        )
        .groupBy(clinicalGestaltsTable.childId),
      db
        .select()
        .from(aacProfilesTable)
        .where(
          and(
            eq(aacProfilesTable.organizationId, actor.organizationId),
            inArray(
              aacProfilesTable.childId,
              childIds.length ? childIds : [-1],
            ),
          ),
        ),
    ]);
    const countByChild = new Map(counts.map((row) => [row.childId, row.count]));
    const aacByChild = new Map(
      aacProfiles.map((profile) => [profile.childId, profile]),
    );
    return res.json(
      profiles.map((profile) =>
        childResponseForActor(
          profile,
          actor,
          countByChild.get(profile.id) ?? 0,
          aacByChild.get(profile.id),
        ),
      ),
    );
  }
  return res.json(
    children
      .filter((child) => actor.childIds.includes(child.id))
      .map((child) => ({
        ...child,
        gestaltCount: allGestalts().filter((item) => item.childId === child.id)
          .length,
      })),
  );
});
router.post("/children", async (req, res) => {
  const actor = viewerFrom(req);
  if (!actor)
    return res
      .status(401)
      .json({ error: "Please sign in to create a child profile." });
  const result = CreateChildBody.safeParse(req.body);
  if (!result.success)
    return fail(
      res,
      "Please provide the child's name, school, grade, communication style, and legal-authority confirmation.",
    );
  const input = result.data;
  if (!hasLegalAuthorityConsent(input)) {
    return fail(
      res,
      "Confirm that you have legal authority before creating a child profile.",
    );
  }
  const { legalAuthorityConfirmed: _legalAuthorityConfirmed, ...childInput } =
    input;
  if (actor.organizationId) {
    try {
      const legacyNames = legacyNameParts(childInput.name);
      const firstName = childInput.firstName?.trim() || legacyNames.firstName;
      const lastName = childInput.lastName?.trim() ?? legacyNames.lastName;
      const preferredName = childInput.preferredName?.trim() ?? "";
      const displayName =
        preferredName || [firstName, lastName].filter(Boolean).join(" ");
      const [profile] = await db
        .insert(childProfilesTable)
        .values({
          organizationId: actor.organizationId,
          displayName,
          firstName,
          lastName,
          preferredName,
          pronouns: childInput.pronouns?.trim() || null,
          dateOfBirth: childInput.dateOfBirth
            ? childInput.dateOfBirth.toISOString().slice(0, 10)
            : null,
          school: childInput.school,
          grade: childInput.grade,
          communicationStyle: childInput.communicationStyle,
          profileDetails: {
            age: 0,
            photoUrl: childInput.photoUrl ?? null,
            glpNotes: childInput.glpNotes ?? "",
            strengths: childInput.strengths ?? [],
            sensoryPreferences: childInput.sensoryPreferences ?? [],
            specialInterests: childInput.specialInterests ?? [],
            regulationNotes: childInput.regulationNotes ?? "",
            sensorySupports: childInput.sensorySupports ?? [],
            sensoryChallenges: childInput.sensoryChallenges ?? [],
          },
        })
        .returning();
      if (!profile)
        throw new Error("Child profile was not returned after insert.");
      await db.transaction(async (transaction) => {
        await transaction
          .insert(childProfileConsentRecordsTable)
          .values(
            buildChildProfileConsentRecord({
              childId: profile.id,
              userId: actor.userId,
              confirmedBy: actor.author,
            }),
          );
        await transaction.insert(childCareTeamMembershipsTable).values({
          childId: profile.id,
          userId: actor.userId,
          role: actor.role === "SLP" ? "clinician" : actor.role.toLowerCase(),
        });
      });
      await writeSecurityAudit({
        actor,
        action: "CHILD_PROFILE_CREATED",
        targetType: "child_profile",
        targetId: profile.id,
        childId: profile.id,
      });
      return res.status(201).json(childFromProfile(profile));
    } catch (error) {
      logger.error(
        { err: error, userId: actor.userId },
        "Could not create tenant-scoped child profile",
      );
      return res
        .status(500)
        .json({ error: "We could not securely create the child profile." });
    }
  }
  return res
    .status(403)
    .json({
      error: "Your verified account has no active organization membership.",
    });
});
router.get("/care-team-invitations", async (req, res) => {
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canManageClinicalData(actor.role) && !isNativeDevelopmentDemo(actor)) {
    return res
      .status(403)
      .json({ error: "Only clinicians can view caseload invitations." });
  }
  const invitations = await db
    .select()
    .from(careTeamInvitationsTable)
    .where(
      and(
        eq(careTeamInvitationsTable.organizationId, actor.organizationId),
        inArray(
          careTeamInvitationsTable.childId,
          actor.childIds.length ? actor.childIds : [-1],
        ),
      ),
    );
  return res.json(
    ListCareTeamInvitationsResponse.parse(
      invitations.map((invitation) => ({
        id: String(invitation.id),
        childId: invitation.childId,
        email: invitation.invitedEmail,
        role: invitation.invitedRole,
        status: invitation.status,
        createdAt: invitation.createdAt.toISOString(),
      })),
    ),
  );
});
router.post("/care-team-invitations", async (req, res) => {
  const body = CreateCareTeamInvitationBody.safeParse(req.body);
  if (!body.success)
    return fail(
      res,
      "Add the child, parent or teacher role, and a valid email address.",
    );
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (
    !canManageClinicalData(actor.role) &&
    !actor.isAdmin &&
    !isNativeDevelopmentDemo(actor)
  ) {
    return res
      .status(403)
      .json({
        error:
          "Only organization administrators or clinicians can invite a care-team member.",
      });
  }
  if (!actor.isAdmin && !requireChildAccess(req, res, body.data.childId))
    return;
  const [organization] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, actor.organizationId))
    .limit(1);
  const [controls] = await db
    .select()
    .from(betaControlsTable)
    .where(eq(betaControlsTable.id, 1))
    .limit(1);
  if (
    !organization ||
    organization.disabledAt ||
    (!isNativeDevelopmentDemo(actor) &&
      (!organization.betaApprovedAt || !controls || !controls.enabled))
  ) {
    return res
      .status(403)
      .json({
        error:
          "This organization is not currently approved to invite private-beta members.",
      });
  }
  const [child] = await db
    .select({ id: childProfilesTable.id })
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, body.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .limit(1);
  if (!child)
    return res
      .status(404)
      .json({ error: "Child not found in this organization." });
  const email = body.data.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return fail(res, "Use a valid email address for the invitation.");
  const token = invitationToken();
  const issuance = await db.transaction(async (tx) => {
    await tx
      .select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, actor.organizationId!))
      .limit(1)
      .for("update");
    const dayAgo = new Date(Date.now() - 86_400_000);
    const recent = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(careTeamInvitationsTable)
      .where(
        and(
          eq(careTeamInvitationsTable.organizationId, actor.organizationId!),
          gte(careTeamInvitationsTable.createdAt, dayAgo),
        ),
      );
    if ((controls?.invitationLimitPerDay ?? 25) <= (recent[0]?.count ?? 0))
      return { kind: "limit" as const };
    const [pending] = await tx
      .select({ id: careTeamInvitationsTable.id })
      .from(careTeamInvitationsTable)
      .where(
        and(
          eq(careTeamInvitationsTable.organizationId, actor.organizationId!),
          eq(careTeamInvitationsTable.invitedEmail, email),
          eq(careTeamInvitationsTable.status, "pending"),
        ),
      )
      .limit(1);
    if (pending) return { kind: "duplicate" as const };
    const [invitation] = await tx
      .insert(careTeamInvitationsTable)
      .values({
        organizationId: actor.organizationId!,
        childId: body.data.childId,
        invitedEmail: email,
        invitedRole: body.data.role,
        invitedByUserId: actor.userId,
        tokenHash: invitationTokenHash(token),
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
        accessScope: "child",
        childScope: [body.data.childId],
      })
      .returning();
    return invitation
      ? { kind: "created" as const, invitation }
      : { kind: "failed" as const };
  });
  if (issuance.kind === "limit")
    return res
      .status(429)
      .json({ error: "Invitation limit reached. Try again later." });
  if (issuance.kind === "duplicate")
    return res
      .status(409)
      .json({
        error: "A pending invitation already exists for this email address.",
      });
  if (issuance.kind !== "created")
    return res
      .status(500)
      .json({ error: "The invitation could not be created." });
  const invitation = issuance.invitation;
  await writeSecurityAudit({
    actor,
    action: "CAREGIVER_INVITED_TO_CHILD",
    targetType: "care_team_invitation",
    targetId: invitation.id,
    childId: invitation.childId,
    metadata: { role: invitation.invitedRole },
  });
  return res.status(201).json(
    CreateCareTeamInvitationResponse.parse({
      id: String(invitation.id),
      childId: invitation.childId,
      email: invitation.invitedEmail,
      role: invitation.invitedRole,
      status: invitation.status,
      createdAt: invitation.createdAt.toISOString(),
      invitationPath: `/sign-up?token=${encodeURIComponent(token)}`,
    }),
  );
});
router.get("/team-inbox", async (req, res) => {
  const query = GetTeamInboxQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "The Inbox filters are invalid.");
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (
    query.data.childId !== undefined &&
    !requireChildAccess(req, res, query.data.childId)
  )
    return;
  const profileConditions = [
    eq(childProfilesTable.organizationId, actor.organizationId),
    isNull(childProfilesTable.archivedAt),
    inArray(
      childProfilesTable.id,
      actor.childIds.length ? actor.childIds : [-1],
    ),
  ];
  if (query.data.childId !== undefined)
    profileConditions.push(eq(childProfilesTable.id, query.data.childId));
  const profiles = await db
    .select({ id: childProfilesTable.id, name: childProfilesTable.displayName })
    .from(childProfilesTable)
    .where(and(...profileConditions));
  const scopedChildIds = profiles.map((profile) => profile.id);
  const scopedIds = scopedChildIds.length ? scopedChildIds : [-1];
  const senderRoleStorageValues = query.data.senderRole
    ? (
        {
          SLP: ["clinician", "slp"],
          Parent: ["parent"],
          Teacher: ["teacher"],
          OT: ["ot"],
          Administrator: ["admin", "administrator"],
        } as const
      )[query.data.senderRole]
    : undefined;
  const senderRoleCondition = senderRoleStorageValues
    ? inArray(
        sql<string>`lower(${teamMessagesTable.senderRole})`,
        senderRoleStorageValues,
      )
    : undefined;
  const summaryRows = await db
    .select({
      childId: teamMessagesTable.childId,
      senderUserId: teamMessagesTable.senderUserId,
      body: teamMessagesTable.body,
      createdAt: teamMessagesTable.createdAt,
      readAt: teamMessageReadsTable.readAt,
    })
    .from(teamMessagesTable)
    .leftJoin(
      teamMessageReadsTable,
      and(
        eq(teamMessageReadsTable.messageId, teamMessagesTable.id),
        eq(teamMessageReadsTable.userId, actor.userId),
      ),
    )
    .where(
      and(
        eq(teamMessagesTable.organizationId, actor.organizationId),
        inArray(teamMessagesTable.childId, scopedIds),
        ...(senderRoleCondition ? [senderRoleCondition] : []),
      ),
    )
    .orderBy(desc(teamMessagesTable.createdAt));
  const messageConditions = [
    eq(teamMessagesTable.organizationId, actor.organizationId),
    inArray(teamMessagesTable.childId, scopedIds),
  ];
  if (senderRoleCondition) messageConditions.push(senderRoleCondition);
  if (query.data.childId !== undefined)
    messageConditions.push(eq(teamMessagesTable.childId, query.data.childId));
  if (query.data.search?.trim()) {
    const search = `%${query.data.search.trim()}%`;
    const searchCondition = or(
      ilike(teamMessagesTable.body, search),
      ilike(usersTable.displayName, search),
      ilike(childProfilesTable.displayName, search),
    );
    if (searchCondition) messageConditions.push(searchCondition);
  }
  const messageRows = await db
    .select({
      id: teamMessagesTable.id,
      childId: teamMessagesTable.childId,
      childName: childProfilesTable.displayName,
      senderUserId: teamMessagesTable.senderUserId,
      senderName: usersTable.displayName,
      senderRole: teamMessagesTable.senderRole,
      messageType: teamMessagesTable.messageType,
      audience: teamMessagesTable.audience,
      body: teamMessagesTable.body,
      createdAt: teamMessagesTable.createdAt,
      readAt: teamMessageReadsTable.readAt,
    })
    .from(teamMessagesTable)
    .innerJoin(usersTable, eq(usersTable.id, teamMessagesTable.senderUserId))
    .innerJoin(
      childProfilesTable,
      eq(childProfilesTable.id, teamMessagesTable.childId),
    )
    .leftJoin(
      teamMessageReadsTable,
      and(
        eq(teamMessageReadsTable.messageId, teamMessagesTable.id),
        eq(teamMessageReadsTable.userId, actor.userId),
      ),
    )
    .where(and(...messageConditions))
    .orderBy(
      desc(
        sql<number>`CASE WHEN ${teamMessageReadsTable.readAt} IS NULL AND ${teamMessagesTable.senderUserId} <> ${actor.userId} THEN 1 ELSE 0 END`,
      ),
      desc(teamMessagesTable.createdAt),
      desc(teamMessagesTable.id),
    )
    .limit(200);
  const unreadByChild = new Map<number, number>();
  const latestByChild = new Map<number, (typeof summaryRows)[number]>();
  let totalUnread = 0;
  for (const row of summaryRows) {
    const isRead = Boolean(row.readAt) || row.senderUserId === actor.userId;
    if (!isRead) {
      totalUnread += 1;
      unreadByChild.set(row.childId, (unreadByChild.get(row.childId) ?? 0) + 1);
    }
    if (!latestByChild.has(row.childId)) latestByChild.set(row.childId, row);
  }
  const [members] =
    query.data.childId !== undefined
      ? await Promise.all([
          db
            .select({
              id: childCareTeamMembershipsTable.id,
              name: usersTable.displayName,
              role: childCareTeamMembershipsTable.role,
            })
            .from(childCareTeamMembershipsTable)
            .innerJoin(
              usersTable,
              eq(usersTable.id, childCareTeamMembershipsTable.userId),
            )
            .where(
              and(
                eq(childCareTeamMembershipsTable.childId, query.data.childId),
                eq(childCareTeamMembershipsTable.active, true),
              ),
            ),
        ])
      : [[]];
  return res.json(
    GetTeamInboxResponse.parse({
      childId: query.data.childId ?? null,
      children: profiles.map((profile) => {
        const latest = latestByChild.get(profile.id);
        return {
          childId: profile.id,
          childName: profile.name,
          unreadCount: unreadByChild.get(profile.id) ?? 0,
          messageCount: summaryRows.filter(
            (message) => message.childId === profile.id,
          ).length,
          latestMessageAt: latest?.createdAt ?? null,
          latestMessagePreview: latest?.body ? latest.body.slice(0, 140) : null,
        };
      }),
      members: members.map((member) => ({
        id: member.id,
        name: member.name,
        role: teamRoleLabel(member.role),
        initials: teamMemberInitials(member.name),
      })),
      messages: messageRows.map((message) => ({
        id: message.id,
        childId: message.childId,
        childName: message.childName,
        senderName: message.senderName,
        senderRole: teamRoleLabel(message.senderRole),
        messageType: message.messageType,
        audience: message.audience,
        body: message.body,
        read: Boolean(message.readAt) || message.senderUserId === actor.userId,
        createdAt: message.createdAt,
      })),
      totalUnread,
    }),
  );
});
router.post("/team-inbox", async (req, res) => {
  const body = CreateTeamMessageBody.safeParse(req.body);
  if (!body.success)
    return fail(res, "Write a message before sending it to the team.");
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const messageBody = body.data.body.trim();
  if (!messageBody)
    return fail(res, "Write a message before sending it to the team.");
  const [profile] = await db
    .select({ name: childProfilesTable.displayName })
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, body.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    );
  if (!profile) return res.status(404).json({ error: "Child not found." });
  const [message] = await db
    .insert(teamMessagesTable)
    .values({
      organizationId: actor.organizationId,
      childId: body.data.childId,
      senderUserId: actor.userId,
      senderRole: teamRoleStorageValue(actor.role),
      messageType: body.data.messageType ?? "message",
      audience: "entire_team",
      body: messageBody,
    })
    .returning();
  if (!message)
    return res
      .status(500)
      .json({ error: "The team message could not be saved." });
  await db.insert(teamMessageReadsTable).values({
    messageId: message.id,
    userId: actor.userId,
  });
  await writeSecurityAudit({
    actor,
    action: "CHILD_TEAM_MESSAGE_SENT",
    targetType: "team_message",
    targetId: message.id,
    childId: message.childId,
    metadata: {
      audience: "entire_team",
      messageType: body.data.messageType ?? "message",
    },
  });
  return res.status(201).json(
    CreateTeamMessageResponse.parse({
      id: message.id,
      childId: message.childId,
      childName: profile.name,
      senderName: actor.author,
      senderRole: teamRoleLabel(actor.role),
      messageType: message.messageType,
      audience: message.audience,
      body: message.body,
      read: true,
      createdAt: message.createdAt,
    }),
  );
});
router.post("/team-inbox/read", async (req, res) => {
  const body = MarkTeamMessagesReadBody.safeParse(req.body);
  if (!body.success)
    return fail(res, "Choose at least one message to mark read.");
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const messageIds = [...new Set(body.data.messageIds)];
  const messages = await db
    .select({ id: teamMessagesTable.id, childId: teamMessagesTable.childId })
    .from(teamMessagesTable)
    .where(
      and(
        eq(teamMessagesTable.organizationId, actor.organizationId),
        inArray(teamMessagesTable.id, messageIds),
      ),
    );
  if (
    messages.length !== messageIds.length ||
    messages.some((message) => !canAccessChild(req, message.childId))
  ) {
    return res
      .status(403)
      .json({ error: "You do not have access to one or more team messages." });
  }
  if (messages.length) {
    await db
      .insert(teamMessageReadsTable)
      .values(
        messages.map((message) => ({
          messageId: message.id,
          userId: actor.userId,
        })),
      )
      .onConflictDoUpdate({
        target: [teamMessageReadsTable.messageId, teamMessageReadsTable.userId],
        set: { readAt: new Date() },
      });
  }
  return res.json(
    MarkTeamMessagesReadResponse.parse({ updated: messages.length }),
  );
});
router.get("/child", async (req, res) => {
  await ensureSessionStore();
  const parsed = GetChildQueryParams.safeParse(req.query);
  if (!parsed.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (actor?.organizationId) {
    const [profile] = await db
      .select()
      .from(childProfilesTable)
      .where(
        and(
          eq(childProfilesTable.id, parsed.data.childId),
          eq(childProfilesTable.organizationId, actor.organizationId),
          isNull(childProfilesTable.archivedAt),
        ),
      )
      .limit(1);
    if (!profile) return res.status(404).json({ error: "Child not found" });
    const [[count], [aacProfile]] = await Promise.all([
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(clinicalGestaltsTable)
        .where(
          and(
            eq(clinicalGestaltsTable.organizationId, actor.organizationId),
            eq(clinicalGestaltsTable.childId, profile.id),
            isNull(clinicalGestaltsTable.archivedAt),
          ),
        ),
      db
        .select()
        .from(aacProfilesTable)
        .where(
          and(
            eq(aacProfilesTable.organizationId, actor.organizationId),
            eq(aacProfilesTable.childId, profile.id),
          ),
        )
        .limit(1),
    ]);
    return res.json(
      childResponseForActor(profile, actor, count?.value ?? 0, aacProfile),
    );
  }
  const child = children.find((item) => item.id === parsed.data.childId);
  return child
    ? res.json({
        ...child,
        gestaltCount: allGestalts().filter((item) => item.childId === child.id)
          .length,
      })
    : res.status(404).json({ error: "Child not found" });
});
router.patch("/child", async (req, res) => {
  const query = UpdateChildProfileQueryParams.safeParse(req.query);
  const body = UpdateChildProfileBody.safeParse(req.body);
  if (!query.success || !body.success) {
    return fail(
      res,
      "Check the child's name, school, grade, date of birth, and optional pronouns.",
    );
  }
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canManageClinicalData(actor.role) && !isNativeDevelopmentDemo(actor)) {
    return res
      .status(403)
      .json({ error: "Only clinicians can edit child profile details." });
  }
  const [profile] = await db
    .select()
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, query.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .limit(1);
  if (!profile) return res.status(404).json({ error: "Child not found." });

  const firstName = body.data.firstName.trim();
  const lastName = body.data.lastName.trim();
  const preferredName = body.data.preferredName?.trim() ?? "";
  const school = body.data.school.trim();
  const grade = body.data.grade.trim();
  const pronouns = body.data.pronouns?.trim() || null;
  const dateOfBirth = body.data.dateOfBirth
    ? body.data.dateOfBirth.toISOString().slice(0, 10)
    : null;
  if (!firstName) return fail(res, "First name is required.");
  if (dateOfBirth && dateOfBirth > new Date().toISOString().slice(0, 10)) {
    return fail(res, "Date of birth cannot be in the future.");
  }
  const displayName =
    preferredName || [firstName, lastName].filter(Boolean).join(" ");
  const priorNames = canonicalChildNames(profile);
  const changedFields = [
    ["firstName", priorNames.firstName, firstName],
    ["lastName", priorNames.lastName, lastName],
    ["preferredName", priorNames.preferredName, preferredName],
    ["school", profile.school, school],
    ["grade", profile.grade, grade],
    ["dateOfBirth", profile.dateOfBirth, dateOfBirth],
    ["pronouns", profile.pronouns, pronouns],
  ]
    .filter(([, previous, next]) => previous !== next)
    .map(([field]) => field);
  const [updated] = await db
    .update(childProfilesTable)
    .set({
      displayName,
      firstName,
      lastName,
      preferredName,
      school,
      grade,
      dateOfBirth,
      pronouns,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(childProfilesTable.id, profile.id),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .returning();
  if (!updated) return res.status(404).json({ error: "Child not found." });
  await writeSecurityAudit({
    actor,
    action: "CHILD_PROFILE_UPDATED",
    targetType: "child_profile",
    targetId: updated.id,
    childId: updated.id,
    metadata: { changedFields: changedFields.join(",") },
  });
  const [count] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(clinicalGestaltsTable)
    .where(
      and(
        eq(clinicalGestaltsTable.organizationId, actor.organizationId),
        eq(clinicalGestaltsTable.childId, updated.id),
        isNull(clinicalGestaltsTable.archivedAt),
      ),
    );
  return res.json(childFromProfile(updated, count?.value ?? 0));
});
router.get("/aac-profile", async (req, res) => {
  const query = GetAacProfileQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const [child] = await db
    .select({ id: childProfilesTable.id })
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, query.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .limit(1);
  if (!child) return res.status(404).json({ error: "Child not found." });
  return res.json(
    GetAacProfileResponse.parse(
      await aacProfileResponse(actor.organizationId, child.id, actor),
    ),
  );
});
router.put("/aac-profile", async (req, res) => {
  const query = UpdateAacProfileQueryParams.safeParse(req.query);
  const body = UpdateAacProfileBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(res, "Check the AAC profile fields and try again.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!aacProfileCanEdit(actor)) {
    return res
      .status(403)
      .json({ error: "Only clinicians can update AAC information." });
  }
  const [child] = await db
    .select({ id: childProfilesTable.id })
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, query.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .limit(1);
  if (!child) return res.status(404).json({ error: "Child not found." });
  const communicationModalities = normalizeAacModalities(
    body.data.communicationModalities,
  );
  const otherModalityLabel = communicationModalities.includes("other")
    ? body.data.otherModalityLabel?.trim() || null
    : null;
  const nextValue: AacProfileHistoryValue = {
    communicationModalities,
    otherModalityLabel,
    aacUserStatus: body.data.aacUserStatus,
    deviceVendorId: body.data.deviceVendorId,
    deviceVendorCustomLabel: customLabelFor(
      body.data.deviceVendorId,
      body.data.deviceVendorCustomLabel,
    ),
    deviceModelId: body.data.deviceModelId,
    deviceModelCustomLabel: customLabelFor(
      body.data.deviceModelId,
      body.data.deviceModelCustomLabel,
    ),
    vocabularySystemId: body.data.vocabularySystemId,
    vocabularySystemCustomLabel: customLabelFor(
      body.data.vocabularySystemId,
      body.data.vocabularySystemCustomLabel,
    ),
    accessMethodId: body.data.accessMethodId,
    accessMethodCustomLabel: customLabelFor(
      body.data.accessMethodId,
      body.data.accessMethodCustomLabel,
    ),
    ownershipId: body.data.ownershipId,
    ownershipCustomLabel: customLabelFor(
      body.data.ownershipId,
      body.data.ownershipCustomLabel,
    ),
    notes: body.data.notes?.trim() || null,
  };
  const catalogError = aacProfileCatalogError(nextValue);
  if (catalogError) return fail(res, catalogError);
  try {
    const result = await db.transaction(async (transaction) => {
      const [current] = await transaction
        .select()
        .from(aacProfilesTable)
        .where(
          and(
            eq(aacProfilesTable.organizationId, actor.organizationId!),
            eq(aacProfilesTable.childId, child.id),
          ),
        )
        .for("update")
        .limit(1);
      if ((current?.version ?? 0) !== body.data.version) return null;
      const previousValue =
        current && !current.removedAt ? aacProfileValueFromRow(current) : null;
      const changedFields = aacProfileChangedFields(previousValue, nextValue);
      const unchanged =
        current && !current.removedAt && changedFields.length === 0;
      if (unchanged) return { profile: current, changed: false };
      const confirmedAt = new Date();
      const [profile] = current
        ? await transaction
            .update(aacProfilesTable)
            .set({
              ...nextValue,
              confirmedAt,
              confirmedByUserId: actor.userId,
              confirmedByName: actor.author,
              confirmedByRole: actor.role,
              removedAt: null,
              version: sql`${aacProfilesTable.version} + 1`,
              updatedByUserId: actor.userId,
              updatedByName: actor.author,
              updatedByRole: actor.role,
              updatedAt: new Date(),
            })
            .where(eq(aacProfilesTable.id, current.id))
            .returning()
        : await transaction
            .insert(aacProfilesTable)
            .values({
              organizationId: actor.organizationId!,
              childId: child.id,
              ...nextValue,
              confirmedAt,
              confirmedByUserId: actor.userId,
              confirmedByName: actor.author,
              confirmedByRole: actor.role,
              updatedByUserId: actor.userId,
              updatedByName: actor.author,
              updatedByRole: actor.role,
            })
            .returning();
      if (!profile) throw new Error("aac-profile-save-failed");
      await transaction.insert(aacProfileHistoryTable).values({
        organizationId: actor.organizationId!,
        childId: child.id,
        profileId: profile.id,
        action: previousValue ? "updated" : "created",
        previousModalities: previousValue?.communicationModalities ?? null,
        nextModalities: nextValue.communicationModalities,
        previousOtherModalityLabel: previousValue?.otherModalityLabel ?? null,
        nextOtherModalityLabel: nextValue.otherModalityLabel,
        changedFields: previousValue ? changedFields : Object.keys(nextValue),
        previousValue,
        nextValue,
        actorUserId: actor.userId,
        actorName: actor.author,
        actorRole: actor.role,
      });
      return { profile, changed: true };
    });
    if (!result)
      return res
        .status(409)
        .json({
          error:
            "This AAC profile changed since you opened it. Refresh and try again.",
        });
    if (result.changed) {
      await writeSecurityAudit({
        actor,
        action:
          result.profile.version === 1
            ? "AAC_PROFILE_CREATED"
            : "AAC_PROFILE_UPDATED",
        targetType: "aac_profile",
        targetId: result.profile.id,
        childId: child.id,
        metadata: {
          changedFields: "profile_fields",
          previousValue: body.data.version === 0 ? "none" : "recorded",
          nextValue: "confirmed",
        },
      });
    }
    return res.json(
      UpdateAacProfileResponse.parse(
        await aacProfileResponse(actor.organizationId, child.id, actor),
      ),
    );
  } catch (error: any) {
    if (error?.code === "23505") {
      return res
        .status(409)
        .json({
          error:
            "This AAC profile changed since you opened it. Refresh and try again.",
        });
    }
    throw error;
  }
});
router.delete("/aac-profile", async (req, res) => {
  const query = RemoveAacProfileQueryParams.safeParse(req.query);
  if (!query.success)
    return fail(res, "A child and current profile version are required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!aacProfileCanEdit(actor)) {
    return res
      .status(403)
      .json({ error: "Only clinicians can remove AAC information." });
  }
  const result = await db.transaction(async (transaction) => {
    const [current] = await transaction
      .select()
      .from(aacProfilesTable)
      .where(
        and(
          eq(aacProfilesTable.organizationId, actor.organizationId!),
          eq(aacProfilesTable.childId, query.data.childId),
        ),
      )
      .for("update")
      .limit(1);
    if (!current || current.removedAt) return { status: "missing" as const };
    if (current.version !== query.data.version)
      return { status: "conflict" as const };
    const previousValue = aacProfileValueFromRow(current);
    const [profile] = await transaction
      .update(aacProfilesTable)
      .set({
        ...emptyAacProfileValue(),
        confirmedAt: null,
        confirmedByUserId: null,
        confirmedByName: null,
        confirmedByRole: null,
        removedAt: new Date(),
        version: sql`${aacProfilesTable.version} + 1`,
        updatedByUserId: actor.userId,
        updatedByName: actor.author,
        updatedByRole: actor.role,
        updatedAt: new Date(),
      })
      .where(eq(aacProfilesTable.id, current.id))
      .returning();
    if (!profile) throw new Error("aac-profile-remove-failed");
    await transaction.insert(aacProfileHistoryTable).values({
      organizationId: actor.organizationId!,
      childId: query.data.childId,
      profileId: profile.id,
      action: "removed",
      previousModalities: previousValue.communicationModalities,
      nextModalities: null,
      previousOtherModalityLabel: previousValue.otherModalityLabel,
      nextOtherModalityLabel: null,
      changedFields: Object.keys(previousValue),
      previousValue,
      nextValue: null,
      actorUserId: actor.userId,
      actorName: actor.author,
      actorRole: actor.role,
    });
    return { status: "removed" as const, profile };
  });
  if (result.status === "missing")
    return res.status(404).json({ error: "No current AAC profile was found." });
  if (result.status === "conflict")
    return res
      .status(409)
      .json({
        error:
          "This AAC profile changed since you opened it. Refresh and try again.",
      });
  await writeSecurityAudit({
    actor,
    action: "AAC_PROFILE_REMOVED",
    targetType: "aac_profile",
    targetId: result.profile.id,
    childId: query.data.childId,
    metadata: { changedFields: "profile_fields" },
  });
  return res.json(
    RemoveAacProfileResponse.parse(
      await aacProfileResponse(actor.organizationId, query.data.childId, actor),
    ),
  );
});
router.get("/child-shared-profile", async (req, res) => {
  const query = GetChildSharedProfileQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const [profile] = await db
    .select()
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, query.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .limit(1);
  if (!profile) return res.status(404).json({ error: "Child not found." });
  await ensureLegacySharedProfileEntries(profile);
  return res.json(
    GetChildSharedProfileResponse.parse(
      await sharedProfileResponse(actor.organizationId, profile.id, actor),
    ),
  );
});
router.post("/child-shared-profile", async (req, res) => {
  const query = CreateChildSharedProfileEntryQueryParams.safeParse(req.query);
  const body = CreateChildSharedProfileEntryBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(res, "Add a short shared profile entry.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (
    !canContributeSharedChildContext(actor.role) &&
    !isNativeDevelopmentDemo(actor)
  ) {
    return res
      .status(403)
      .json({
        error:
          "Only a clinician, parent, or teacher can contribute to the shared profile.",
      });
  }
  const [profile] = await db
    .select()
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, query.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .limit(1);
  if (!profile) return res.status(404).json({ error: "Child not found." });
  const value = body.data.value.trim();
  const category = sharedProfileCategory(body.data.section, body.data.category);
  try {
    const created = await db.transaction(async (tx) => {
      const [entry] = await tx
        .insert(sharedChildProfileEntriesTable)
        .values({
          organizationId: actor.organizationId!,
          childId: profile.id,
          section: body.data.section,
          category,
          value,
          normalizedValue: sharedProfileValueKey(value),
          authorUserId: actor.userId,
          authorName: actor.author,
          authorRole: actor.role,
        })
        .returning();
      if (!entry) throw new Error("shared-profile-create-failed");
      await tx.insert(sharedChildProfileHistoryTable).values({
        organizationId: actor.organizationId!,
        childId: profile.id,
        entryId: entry.id,
        section: entry.section,
        action: "created",
        previousValue: null,
        nextValue: entry.value,
        actorUserId: actor.userId,
        actorName: actor.author,
        actorRole: actor.role,
        metadata: { category },
      });
      return entry;
    });
    await writeSecurityAudit({
      actor,
      action: "SHARED_CHILD_PROFILE_ENTRY_CREATED",
      targetType: "shared_child_profile_entry",
      targetId: created.id,
      childId: profile.id,
      metadata: { changedFields: body.data.section },
    });
    return res
      .status(201)
      .json(
        CreateChildSharedProfileEntryResponse.parse(
          sharedProfileEntryResponse(created, actor),
        ),
      );
  } catch (error: any) {
    if (error?.code === "23505")
      return res
        .status(409)
        .json({ error: "That item is already in this section." });
    throw error;
  }
});
router.patch("/child-shared-profile/entries/:entryId", async (req, res) => {
  const params = UpdateChildSharedProfileEntryParams.safeParse(req.params);
  const body = UpdateChildSharedProfileEntryBody.safeParse(req.body);
  if (!params.success || !body.success)
    return fail(res, "Provide a valid shared profile update.");
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const [current] = await db
    .select()
    .from(sharedChildProfileEntriesTable)
    .where(
      and(
        eq(sharedChildProfileEntriesTable.id, params.data.entryId),
        eq(sharedChildProfileEntriesTable.organizationId, actor.organizationId),
        isNull(sharedChildProfileEntriesTable.deletedAt),
      ),
    )
    .limit(1);
  if (!current)
    return res.status(404).json({ error: "Shared profile entry not found." });
  if (!requireChildAccess(req, res, current.childId)) return;
  if (
    !canContributeSharedChildContext(actor.role) &&
    !isNativeDevelopmentDemo(actor)
  ) {
    return res
      .status(403)
      .json({
        error:
          "Only a clinician, parent, or teacher can contribute to the shared profile.",
      });
  }
  if (actor.role !== "SLP" && current.authorUserId !== actor.userId) {
    return res
      .status(403)
      .json({ error: "You can edit only entries you added." });
  }
  const value = body.data.value.trim();
  try {
    const updated = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(sharedChildProfileEntriesTable)
        .where(
          and(
            eq(sharedChildProfileEntriesTable.id, current.id),
            eq(
              sharedChildProfileEntriesTable.organizationId,
              actor.organizationId!,
            ),
            isNull(sharedChildProfileEntriesTable.deletedAt),
          ),
        )
        .for("update")
        .limit(1);
      if (!locked || locked.version !== body.data.version) return null;
      const category = sharedProfileCategory(
        locked.section as SharedProfileSection,
        body.data.category ?? locked.category,
      );
      const [entry] = await tx
        .update(sharedChildProfileEntriesTable)
        .set({
          value,
          normalizedValue: sharedProfileValueKey(value),
          category,
          version: sql`${sharedChildProfileEntriesTable.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sharedChildProfileEntriesTable.id, locked.id),
            isNull(sharedChildProfileEntriesTable.deletedAt),
          ),
        )
        .returning();
      if (!entry) return null;
      await tx.insert(sharedChildProfileHistoryTable).values({
        organizationId: locked.organizationId,
        childId: locked.childId,
        entryId: locked.id,
        section: locked.section,
        action: "updated",
        previousValue: locked.value,
        nextValue: entry.value,
        actorUserId: actor.userId,
        actorName: actor.author,
        actorRole: actor.role,
        metadata: { category },
      });
      return entry;
    });
    if (!updated)
      return res
        .status(409)
        .json({
          error:
            "This entry changed since you opened it. Refresh and try again.",
        });
    await writeSecurityAudit({
      actor,
      action: "SHARED_CHILD_PROFILE_ENTRY_UPDATED",
      targetType: "shared_child_profile_entry",
      targetId: updated.id,
      childId: updated.childId,
      metadata: { changedFields: updated.section },
    });
    return res.json(
      UpdateChildSharedProfileEntryResponse.parse(
        sharedProfileEntryResponse(updated, actor),
      ),
    );
  } catch (error: any) {
    if (error?.code === "23505")
      return res
        .status(409)
        .json({ error: "That item is already in this section." });
    throw error;
  }
});
router.delete(
  "/child-shared-profile/entries/:entryId/versions/:version",
  async (req, res) => {
    const params = DeleteChildSharedProfileEntryParams.safeParse(req.params);
    if (!params.success)
      return res.status(404).json({ error: "Shared profile entry not found." });
    const actor = viewerFrom(req);
    if (!actor?.organizationId)
      return res.status(401).json({ error: authenticationError(req) });
    const [current] = await db
      .select()
      .from(sharedChildProfileEntriesTable)
      .where(
        and(
          eq(sharedChildProfileEntriesTable.id, params.data.entryId),
          eq(
            sharedChildProfileEntriesTable.organizationId,
            actor.organizationId,
          ),
          isNull(sharedChildProfileEntriesTable.deletedAt),
        ),
      )
      .limit(1);
    if (!current)
      return res.status(404).json({ error: "Shared profile entry not found." });
    if (!requireChildAccess(req, res, current.childId)) return;
    if (
      !canContributeSharedChildContext(actor.role) &&
      !isNativeDevelopmentDemo(actor)
    ) {
      return res
        .status(403)
        .json({
          error:
            "Only a clinician, parent, or teacher can contribute to the shared profile.",
        });
    }
    if (actor.role !== "SLP" && current.authorUserId !== actor.userId) {
      return res
        .status(403)
        .json({ error: "You can remove only entries you added." });
    }
    const removed = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(sharedChildProfileEntriesTable)
        .where(
          and(
            eq(sharedChildProfileEntriesTable.id, current.id),
            eq(
              sharedChildProfileEntriesTable.organizationId,
              actor.organizationId!,
            ),
            isNull(sharedChildProfileEntriesTable.deletedAt),
          ),
        )
        .for("update")
        .limit(1);
      if (!locked || locked.version !== params.data.version) return null;
      const [entry] = await tx
        .update(sharedChildProfileEntriesTable)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${sharedChildProfileEntriesTable.version} + 1`,
        })
        .where(
          and(
            eq(sharedChildProfileEntriesTable.id, locked.id),
            isNull(sharedChildProfileEntriesTable.deletedAt),
          ),
        )
        .returning();
      if (!entry) return null;
      await tx.insert(sharedChildProfileHistoryTable).values({
        organizationId: locked.organizationId,
        childId: locked.childId,
        entryId: locked.id,
        section: locked.section,
        action: "deleted",
        previousValue: locked.value,
        nextValue: null,
        actorUserId: actor.userId,
        actorName: actor.author,
        actorRole: actor.role,
        metadata: { category: locked.category },
      });
      return entry;
    });
    if (!removed)
      return res
        .status(409)
        .json({
          error:
            "This entry changed since you opened it. Refresh and try again.",
        });
    await writeSecurityAudit({
      actor,
      action: "SHARED_CHILD_PROFILE_ENTRY_REMOVED",
      targetType: "shared_child_profile_entry",
      targetId: removed.id,
      childId: removed.childId,
      metadata: { changedFields: removed.section },
    });
    return res.status(204).send();
  },
);
router.get("/child-interests", async (req, res) => {
  const query = ListChildInterestsQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const [profile] = await db
    .select()
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, query.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .limit(1);
  if (!profile) return res.status(404).json({ error: "Child not found." });
  return res.json(
    ListChildInterestsResponse.parse(
      childInterestEntries(profile).map((entry) =>
        childInterestResponse(entry, profile.id, actor),
      ),
    ),
  );
});
router.post("/child-interests", async (req, res) => {
  const query = CreateChildInterestQueryParams.safeParse(req.query);
  const body = CreateChildInterestBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(res, "Add an interest before sharing it with the team.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const organizationId = actor.organizationId;
  if (
    !canContributeSharedChildContext(actor.role) &&
    !isNativeDevelopmentDemo(actor)
  ) {
    return res
      .status(403)
      .json({
        error: "Only an SLP, parent, or teacher can contribute interests.",
      });
  }
  const [profile] = await db
    .select()
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, query.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .limit(1);
  if (!profile) return res.status(404).json({ error: "Child not found." });
  const entries = childInterestEntries(profile);
  if (
    entries.some(
      (entry) =>
        interestKey(entry.interest) === interestKey(body.data.interest),
    )
  ) {
    return res
      .status(409)
      .json({ error: "That interest is already on this child's profile." });
  }
  const entry: StoredChildInterest = {
    id: randomUUID(),
    interest: body.data.interest.trim(),
    status: actor.role === "SLP" ? "approved" : "suggested",
    addedAt: now(),
    addedBy: actor.author,
    addedByRole: actor.role,
    addedByUserId: actor.userId,
  };
  await db
    .update(childProfilesTable)
    .set({
      profileDetails: profileDetailsWithInterestEntries(profile, [
        entry,
        ...entries,
      ]),
      updatedAt: new Date(),
    })
    .where(eq(childProfilesTable.id, profile.id));
  await writeSecurityAudit({
    actor,
    action:
      entry.status === "approved"
        ? "CHILD_INTEREST_ADDED"
        : "CHILD_INTEREST_SUGGESTED",
    targetType: "child_interest",
    targetId: profile.id,
    childId: profile.id,
  });
  return res.status(201).json(childInterestResponse(entry, profile.id, actor));
});
router.patch("/child-interests/:interestId", async (req, res) => {
  const params = UpdateChildInterestParams.safeParse(req.params);
  const body = UpdateChildInterestBody.safeParse(req.body);
  if (!params.success || !body.success)
    return fail(res, "Provide a valid interest update.");
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const profiles = await db
    .select()
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
        inArray(
          childProfilesTable.id,
          actor.childIds.length ? actor.childIds : [-1],
        ),
      ),
    );
  const profile = profiles.find((candidate) =>
    childInterestEntries(candidate).some(
      (entry) => entry.id === params.data.interestId,
    ),
  );
  if (!profile)
    return res.status(404).json({ error: "Interest entry not found." });
  if (!requireChildAccess(req, res, profile.id)) return;
  const entries = childInterestEntries(profile);
  const current = entries.find((entry) => entry.id === params.data.interestId);
  if (!current)
    return res.status(404).json({ error: "Interest entry not found." });
  const mayEdit =
    actor.role === "SLP" ||
    (current.status === "suggested" && current.addedByUserId === actor.userId);
  if (!mayEdit)
    return res
      .status(403)
      .json({ error: "Only an SLP can edit approved interests." });
  if (
    entries.some(
      (entry) =>
        entry.id !== current.id &&
        interestKey(entry.interest) === interestKey(body.data.interest),
    )
  ) {
    return res
      .status(409)
      .json({ error: "That interest is already on this child's profile." });
  }
  const updated: StoredChildInterest = {
    ...current,
    interest: body.data.interest.trim(),
    status: actor.role === "SLP" ? "approved" : current.status,
  };
  const nextEntries = entries.map((entry) =>
    entry.id === updated.id ? updated : entry,
  );
  await db
    .update(childProfilesTable)
    .set({
      profileDetails: profileDetailsWithInterestEntries(profile, nextEntries),
      updatedAt: new Date(),
    })
    .where(eq(childProfilesTable.id, profile.id));
  await writeSecurityAudit({
    actor,
    action: "CHILD_INTEREST_UPDATED",
    targetType: "child_interest",
    targetId: profile.id,
    childId: profile.id,
  });
  return res.json(
    UpdateChildInterestResponse.parse(
      childInterestResponse(updated, profile.id, actor),
    ),
  );
});
router.delete("/child-interests/:interestId", async (req, res) => {
  const params = DeleteChildInterestParams.safeParse(req.params);
  if (!params.success)
    return res.status(404).json({ error: "Interest entry not found." });
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const profiles = await db
    .select()
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
        inArray(
          childProfilesTable.id,
          actor.childIds.length ? actor.childIds : [-1],
        ),
      ),
    );
  const profile = profiles.find((candidate) =>
    childInterestEntries(candidate).some(
      (entry) => entry.id === params.data.interestId,
    ),
  );
  if (!profile)
    return res.status(404).json({ error: "Interest entry not found." });
  if (!requireChildAccess(req, res, profile.id)) return;
  const entries = childInterestEntries(profile);
  const current = entries.find((entry) => entry.id === params.data.interestId);
  if (!current)
    return res.status(404).json({ error: "Interest entry not found." });
  const mayDelete =
    actor.role === "SLP" || current.addedByUserId === actor.userId;
  if (!mayDelete)
    return res
      .status(403)
      .json({
        error: "Only the contributor or an SLP can remove this interest.",
      });
  await db
    .update(childProfilesTable)
    .set({
      profileDetails: profileDetailsWithInterestEntries(
        profile,
        entries.filter((entry) => entry.id !== current.id),
      ),
      updatedAt: new Date(),
    })
    .where(eq(childProfilesTable.id, profile.id));
  await writeSecurityAudit({
    actor,
    action: "CHILD_INTEREST_REMOVED",
    targetType: "child_interest",
    targetId: profile.id,
    childId: profile.id,
  });
  return res.status(204).send();
});
router.patch("/child-sensory", async (req, res) => {
  const query = UpdateChildSensoryQueryParams.safeParse(req.query);
  const body = UpdateChildSensoryBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(
      res,
      "Add at least one support or difficult situation, or leave a section empty.",
    );
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (
    !canContributeSharedChildContext(actor.role) &&
    !isNativeDevelopmentDemo(actor)
  ) {
    return res
      .status(403)
      .json({
        error:
          "Only an SLP, parent, or teacher can update home sensory context.",
      });
  }
  const [profile] = await db
    .select()
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.id, query.data.childId),
        eq(childProfilesTable.organizationId, actor.organizationId),
        isNull(childProfilesTable.archivedAt),
      ),
    )
    .limit(1);
  if (!profile) return res.status(404).json({ error: "Child not found." });
  const updatedAt = new Date();
  await db
    .update(childProfilesTable)
    .set({
      profileDetails: {
        ...(profile.profileDetails as Record<string, unknown>),
        sensorySupports: body.data.supports
          .map((item) => item.trim())
          .filter(Boolean),
        sensoryChallenges: body.data.challenges
          .map((item) => item.trim())
          .filter(Boolean),
      },
      updatedAt,
    })
    .where(eq(childProfilesTable.id, profile.id));
  await writeSecurityAudit({
    actor,
    action: "CHILD_SENSORY_CONTEXT_UPDATED",
    targetType: "child_profile",
    targetId: profile.id,
    childId: profile.id,
  });
  return res.json(
    UpdateChildSensoryResponse.parse({
      childId: profile.id,
      supports: body.data.supports.map((item) => item.trim()).filter(Boolean),
      challenges: body.data.challenges
        .map((item) => item.trim())
        .filter(Boolean),
      updatedAt: updatedAt.toISOString(),
    }),
  );
});
const isConservativeNearDuplicate = isConservativeDuplicate;
type EchoMapTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const duplicatePairIds = (leftId: number, rightId: number) =>
  leftId < rightId
    ? ([leftId, rightId] as const)
    : ([rightId, leftId] as const);

const duplicateSuggestionId = (leftId: number, rightId: number) =>
  duplicatePairIds(leftId, rightId).join(":");

const duplicateEvidenceFingerprint = (
  entries: Array<typeof clinicalGestaltsTable.$inferSelect>,
  occurrenceCounts: Map<number, number>,
) =>
  createHash("sha256")
    .update(
      entries
        .slice()
        .sort((left, right) => left.id - right.id)
        .map(
          (entry) =>
            `${entry.id}:${entry.phrase}:${entry.updatedAt.toISOString()}:${occurrenceCounts.get(entry.id) ?? 0}`,
        )
        .join("|"),
    )
    .digest("hex");

const insertTransactionalAudit = (
  transaction: EchoMapTransaction,
  actor: ResolvedCareTeamActor,
  input: {
    action: string;
    targetType: string;
    targetId?: string | number | null;
    childId?: number | null;
    metadata?: Record<string, unknown>;
  },
) =>
  transaction.insert(securityAuditLogsTable).values({
    userId: actor.userId,
    actorName: actor.author,
    actorRole: actor.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId == null ? null : String(input.targetId),
    childId: input.childId ?? null,
    outcome: "success",
    metadata: safeAuditMetadata(input.metadata),
  });

const mergeReviewedGestalts = async (
  transaction: EchoMapTransaction,
  actor: ResolvedCareTeamActor & { organizationId: number },
  childId: number,
  sourceGestaltId: number,
  targetGestaltId: number,
) => {
  const entries = await transaction
    .select()
    .from(clinicalGestaltsTable)
    .where(
      and(
        inArray(clinicalGestaltsTable.id, [sourceGestaltId, targetGestaltId]),
        eq(clinicalGestaltsTable.organizationId, actor.organizationId),
        eq(clinicalGestaltsTable.childId, childId),
        isNull(clinicalGestaltsTable.archivedAt),
      ),
    )
    .for("update");
  const source = entries.find((entry) => entry.id === sourceGestaltId);
  const target = entries.find((entry) => entry.id === targetGestaltId);
  if (!source || !target) return undefined;
  if (!isConservativeNearDuplicate(source.phrase, target.phrase))
    return { unrelated: true as const };
  const occurrences = await transaction
    .select()
    .from(gestaltOccurrencesTable)
    .where(
      and(
        eq(gestaltOccurrencesTable.childId, childId),
        inArray(gestaltOccurrencesTable.gestaltId, [source.id, target.id]),
      ),
    )
    .for("update");
  const sourceOccurrence = occurrences.find(
    (item) => item.gestaltId === source.id,
  );
  const targetOccurrence = occurrences.find(
    (item) => item.gestaltId === target.id,
  );
  const mergedCount =
    (sourceOccurrence?.occurrenceCount ?? 0) +
    (targetOccurrence?.occurrenceCount ?? 0);
  const mergedLastSeen =
    [sourceOccurrence?.lastSeenAt, targetOccurrence?.lastSeenAt]
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? new Date();
  const [canonical] = await transaction
    .update(clinicalGestaltsTable)
    .set({
      contexts: [...new Set([...target.contexts, ...source.contexts])].slice(
        0,
        30,
      ),
      updatedAt: new Date(),
    })
    .where(eq(clinicalGestaltsTable.id, target.id))
    .returning();
  if (!canonical) throw new Error("The canonical phrase could not be updated.");
  await transaction
    .update(therapySessionGestaltsTable)
    .set({ gestaltId: canonical.id })
    .where(eq(therapySessionGestaltsTable.gestaltId, source.id));
  await transaction
    .update(transcriptPhrasesTable)
    .set({ matchedGestaltId: canonical.id })
    .where(eq(transcriptPhrasesTable.matchedGestaltId, source.id));
  await transaction
    .update(gestaltCollaborationNotesTable)
    .set({ gestaltId: canonical.id })
    .where(eq(gestaltCollaborationNotesTable.gestaltId, source.id));
  await transaction
    .update(phraseObservationsTable)
    .set({ gestaltId: canonical.id })
    .where(eq(phraseObservationsTable.gestaltId, source.id));
  await transaction
    .update(clinicalKnowledgeAppliedFactsTable)
    .set({ gestaltId: canonical.id })
    .where(eq(clinicalKnowledgeAppliedFactsTable.gestaltId, source.id));
  const planningRows = await transaction
    .select()
    .from(aacVocabularyPlanningTable)
    .where(
      and(
        eq(aacVocabularyPlanningTable.organizationId, actor.organizationId),
        eq(aacVocabularyPlanningTable.childId, childId),
        inArray(aacVocabularyPlanningTable.gestaltId, [
          source.id,
          canonical.id,
        ]),
      ),
    )
    .for("update");
  const sourcePlanning = planningRows.find(
    (item) => item.gestaltId === source.id,
  );
  const targetPlanning = planningRows.find(
    (item) => item.gestaltId === canonical.id,
  );
  if (sourcePlanning && targetPlanning) {
    await transaction.insert(aacVocabularyPlanningMergeHistoryTable).values({
      organizationId: actor.organizationId,
      childId,
      sourceGestaltId: source.id,
      canonicalGestaltId: canonical.id,
      sourceStatus: sourcePlanning.status,
      sourceCreatedByUserId: sourcePlanning.createdByUserId,
      sourceCreatedAt: sourcePlanning.createdAt,
      canonicalStatus: targetPlanning.status,
      canonicalCreatedByUserId: targetPlanning.createdByUserId,
      canonicalCreatedAt: targetPlanning.createdAt,
      mergedByUserId: actor.userId,
    });
    await transaction
      .delete(aacVocabularyPlanningTable)
      .where(eq(aacVocabularyPlanningTable.id, sourcePlanning.id));
  } else if (sourcePlanning) {
    await transaction
      .update(aacVocabularyPlanningTable)
      .set({
        gestaltId: canonical.id,
        updatedAt: new Date(),
      })
      .where(eq(aacVocabularyPlanningTable.id, sourcePlanning.id));
  }
  await transaction
    .delete(gestaltOccurrencesTable)
    .where(inArray(gestaltOccurrencesTable.gestaltId, [source.id, target.id]));
  if (mergedCount > 0) {
    await transaction.insert(gestaltOccurrencesTable).values({
      childId: canonical.childId,
      gestaltId: canonical.id,
      phrase: canonical.phrase,
      normalizedPhrase: canonical.normalizedPhrase,
      occurrenceCount: mergedCount,
      lastSeenAt: mergedLastSeen,
    });
  }
  await transaction
    .update(clinicalGestaltsTable)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(clinicalGestaltsTable.id, source.id));
  return canonical;
};

router.get("/gestalts", async (req, res) => {
  await ensureSessionStore();
  const parsed = ListGestaltsQueryParams.safeParse(req.query);
  if (!parsed.success) return fail(res, "A child is required.");
  const { childId, search, function: communicationFunction } = parsed.data;
  const query = String(search ?? "").toLowerCase();
  if (!requireChildAccess(req, res, childId)) return;
  const actor = viewerFrom(req);
  if (actor?.organizationId) {
    const rows = await db
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.organizationId, actor.organizationId),
          eq(clinicalGestaltsTable.childId, childId),
          isNull(clinicalGestaltsTable.archivedAt),
        ),
      );
    const visibleGestalts = canUseClinicalTools(actor)
      ? await gestaltsWithCollaboration(rows)
      : rows.map(roleSafeGestalt);
    if (canUseClinicalTools(actor) && rows.length) {
      const planningRows = await db
        .select({
          gestaltId: aacVocabularyPlanningTable.gestaltId,
          status: aacVocabularyPlanningTable.status,
        })
        .from(aacVocabularyPlanningTable)
        .where(
          and(
            eq(aacVocabularyPlanningTable.organizationId, actor.organizationId),
            eq(aacVocabularyPlanningTable.childId, childId),
            inArray(
              aacVocabularyPlanningTable.gestaltId,
              rows.map((row) => row.id),
            ),
          ),
        );
      const planningStatusByGestalt = new Map(
        planningRows.map((row) => [row.gestaltId, row.status]),
      );
      for (const gestalt of visibleGestalts) {
        gestalt.aacPlanningStatus =
          (planningStatusByGestalt.get(
            gestalt.id,
          ) as Gestalt["aacPlanningStatus"]) ?? null;
      }
    }
    return res.json(
      visibleGestalts.filter(
        (item) =>
          (!query ||
            [item.phrase, item.meaning, item.source, item.function].some(
              (field) => field.toLowerCase().includes(query),
            )) &&
          (!communicationFunction || item.function === communicationFunction),
      ),
    );
  }
  res.json(
    allGestalts().filter(
      (item) =>
        item.childId === childId &&
        (!query ||
          [item.phrase, item.meaning, item.source, item.function].some(
            (field) => field.toLowerCase().includes(query),
          )) &&
        (!communicationFunction || item.function === communicationFunction),
    ),
  );
});
router.post("/gestalts", async (req, res) => {
  const query = CreateGestaltQueryParams.safeParse(req.query);
  const body = CreateGestaltBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(
      res,
      "Please complete the gestalt phrase, function, contexts, and emotional state.",
    );
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor) return res.status(401).json({ error: authenticationError(req) });
  if (
    !canSubmitDictionaryPhrase(actor.role) &&
    !isNativeDevelopmentDemo(actor)
  ) {
    return res
      .status(403)
      .json({
        error:
          "Only an SLP, parent, or teacher can add a phrase to the shared dictionary.",
      });
  }
  if (!canUseClinicalTools(actor)) {
    return res
      .status(403)
      .json({
        error:
          "Use the care-team phrase observation flow so an SLP can review the interpretation safely.",
      });
  }

  const normalizedPhrase = normalizePhrase(body.data.phrase);
  const meaning =
    body.data.meaning?.trim() || "Meaning awaits clinician review.";
  const creation = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(${actor.organizationId!}, ${query.data.childId})`,
    );
    await repairCanonicalGestaltsForChild(
      transaction,
      actor.organizationId!,
      query.data.childId,
    );
    const activePhrases = await transaction
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.organizationId, actor.organizationId!),
          eq(clinicalGestaltsTable.childId, query.data.childId),
          isNull(clinicalGestaltsTable.archivedAt),
        ),
      );
    const exactMatch = activePhrases.find(
      (item) =>
        matchPhraseKey(item.phrase) === matchPhraseKey(body.data.phrase),
    );
    if (exactMatch) return { duplicate: exactMatch, kind: "exact" as const };
    const nearMatch = activePhrases.find((item) =>
      isConservativeNearDuplicate(body.data.phrase, item.phrase),
    );
    if (nearMatch && !body.data.allowSimilar)
      return { duplicate: nearMatch, kind: "near" as const };
    const [archivedExact] = await transaction
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.organizationId, actor.organizationId!),
          eq(clinicalGestaltsTable.childId, query.data.childId),
          eq(clinicalGestaltsTable.normalizedPhrase, normalizedPhrase),
        ),
      )
      .limit(1)
      .for("update");
    if (archivedExact?.archivedAt) {
      const [restored] = await transaction
        .update(clinicalGestaltsTable)
        .set({
          phrase: body.data.phrase,
          meaning,
          communicationFunction: body.data.function,
          contexts: body.data.contexts,
          emotionalState: body.data.emotionalState,
          source: "Clinician-reviewed classroom dictionary",
          archivedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(clinicalGestaltsTable.id, archivedExact.id))
        .returning();
      if (restored) return { record: restored };
    }
    const [record] = await transaction
      .insert(clinicalGestaltsTable)
      .values({
        organizationId: actor.organizationId!,
        childId: query.data.childId,
        phrase: body.data.phrase,
        normalizedPhrase,
        meaning,
        communicationFunction: body.data.function,
        contexts: body.data.contexts,
        emotionalState: body.data.emotionalState,
        source: "Clinician-reviewed classroom dictionary",
        createdByUserId: actor.userId,
      })
      .onConflictDoNothing()
      .returning();
    if (record) return { record };
    const [conflicting] = await transaction
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.organizationId, actor.organizationId!),
          eq(clinicalGestaltsTable.childId, query.data.childId),
          eq(clinicalGestaltsTable.normalizedPhrase, normalizedPhrase),
          isNull(clinicalGestaltsTable.archivedAt),
        ),
      )
      .limit(1);
    return { duplicate: conflicting, kind: "exact" as const };
  });
  if (creation.duplicate) {
    return res.status(409).json({
      error:
        creation.kind === "exact"
          ? "That phrase is already in this child’s dictionary. Merge the observation into the existing phrase instead."
          : "A similar phrase already exists. Choose whether to merge the observation or add a distinct phrase.",
      duplicate: creation.duplicate
        ? gestaltFromRecord(creation.duplicate)
        : undefined,
      kind: creation.kind,
    });
  }
  const record = creation.record;
  if (!record)
    return res
      .status(409)
      .json({
        error:
          "That phrase was added by another contributor. Review the existing dictionary entry before continuing.",
      });
  await writeSecurityAudit({
    actor,
    action: actor.role === "SLP" ? "GESTALT_CREATED" : "GESTALT_SUBMITTED",
    targetType: "gestalt",
    targetId: record.id,
    childId: record.childId,
  });
  return res.status(201).json(gestaltFromRecord(record));
});
router.get("/dictionary/duplicate-suggestions", async (req, res) => {
  const query = ListDictionaryDuplicateSuggestionsQueryParams.safeParse(
    req.query,
  );
  if (!query.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor))
    return res
      .status(403)
      .json({ error: "Only an SLP can review duplicate phrase suggestions." });

  const entries = await db
    .select()
    .from(clinicalGestaltsTable)
    .where(
      and(
        eq(clinicalGestaltsTable.organizationId, actor.organizationId),
        eq(clinicalGestaltsTable.childId, query.data.childId),
        isNull(clinicalGestaltsTable.archivedAt),
      ),
    );
  if (entries.length < 2) {
    return res.json(
      ListDictionaryDuplicateSuggestionsResponse.parse({
        childId: query.data.childId,
        suggestions: [],
        generatedAt: new Date(),
      }),
    );
  }
  const [occurrences, decisions] = await Promise.all([
    db
      .select()
      .from(gestaltOccurrencesTable)
      .where(
        and(
          eq(gestaltOccurrencesTable.childId, query.data.childId),
          inArray(
            gestaltOccurrencesTable.gestaltId,
            entries.map((entry) => entry.id),
          ),
        ),
      ),
    db
      .select()
      .from(dictionaryDuplicateSuggestionsTable)
      .where(
        and(
          eq(
            dictionaryDuplicateSuggestionsTable.organizationId,
            actor.organizationId,
          ),
          eq(dictionaryDuplicateSuggestionsTable.childId, query.data.childId),
        ),
      ),
  ]);
  const occurrenceCounts = new Map(
    occurrences
      .filter(
        (row): row is typeof row & { gestaltId: number } =>
          row.gestaltId !== null,
      )
      .map((row) => [row.gestaltId, row.occurrenceCount]),
  );
  const decisionByPair = new Map(
    decisions.map((row) => [
      duplicateSuggestionId(row.firstGestaltId, row.secondGestaltId),
      row,
    ]),
  );
  const suggestions = [];
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < entries.length;
      rightIndex += 1
    ) {
      const left = entries[leftIndex]!;
      const right = entries[rightIndex]!;
      const match = duplicatePhraseMatch(left.phrase, right.phrase);
      if (!match) continue;
      const [firstId, secondId] = duplicatePairIds(left.id, right.id);
      const first = firstId === left.id ? left : right;
      const second = secondId === right.id ? right : left;
      const suggestionId = duplicateSuggestionId(first.id, second.id);
      const fingerprint = duplicateEvidenceFingerprint(
        [first, second],
        occurrenceCounts,
      );
      const decision = decisionByPair.get(suggestionId);
      if (decision?.decision === "keep_separate") continue;
      if (
        decision?.decision === "dismissed" &&
        decision.evidenceFingerprint === fingerprint
      )
        continue;
      suggestions.push({
        suggestionId,
        first: {
          id: first.id,
          phrase: first.phrase,
          meaning: first.meaning,
          function: first.communicationFunction,
          contexts: first.contexts.slice(0, 3),
          occurrences: occurrenceCounts.get(first.id) ?? 0,
        },
        second: {
          id: second.id,
          phrase: second.phrase,
          meaning: second.meaning,
          function: second.communicationFunction,
          contexts: second.contexts.slice(0, 3),
          occurrences: occurrenceCounts.get(second.id) ?? 0,
        },
        reason: match.reason,
        reasonLabel: match.reasonLabel,
        similarityScore: match.score,
      });
    }
  }
  return res.json(
    ListDictionaryDuplicateSuggestionsResponse.parse({
      childId: query.data.childId,
      suggestions,
      generatedAt: new Date(),
    }),
  );
});
router.post("/dictionary/duplicate-suggestions/decision", async (req, res) => {
  const query = DecideDictionaryDuplicateSuggestionQueryParams.safeParse(
    req.query,
  );
  const body = DecideDictionaryDuplicateSuggestionBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(res, "Choose a valid duplicate suggestion decision.");
  if (body.data.firstGestaltId === body.data.secondGestaltId)
    return fail(res, "Choose two different phrases.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor))
    return res
      .status(403)
      .json({ error: "Only an SLP can decide duplicate phrase suggestions." });
  const [firstGestaltId, secondGestaltId] = duplicatePairIds(
    body.data.firstGestaltId,
    body.data.secondGestaltId,
  );
  if (
    body.data.decision === "merge" &&
    body.data.canonicalGestaltId !== firstGestaltId &&
    body.data.canonicalGestaltId !== secondGestaltId
  )
    return fail(res, "Choose which suggested phrase should remain canonical.");

  const result = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(${actor.organizationId!}, ${query.data.childId})`,
    );
    const entries = await transaction
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          inArray(clinicalGestaltsTable.id, [firstGestaltId, secondGestaltId]),
          eq(clinicalGestaltsTable.organizationId, actor.organizationId!),
          eq(clinicalGestaltsTable.childId, query.data.childId),
          isNull(clinicalGestaltsTable.archivedAt),
        ),
      )
      .for("update");
    if (entries.length !== 2) return { unavailable: true as const };
    const match = duplicatePhraseMatch(entries[0]!.phrase, entries[1]!.phrase);
    if (!match) return { unrelated: true as const };
    const occurrenceRows = await transaction
      .select()
      .from(gestaltOccurrencesTable)
      .where(
        and(
          eq(gestaltOccurrencesTable.childId, query.data.childId),
          inArray(gestaltOccurrencesTable.gestaltId, [
            firstGestaltId,
            secondGestaltId,
          ]),
        ),
      )
      .for("update");
    const occurrenceCounts = new Map(
      occurrenceRows
        .filter(
          (row): row is typeof row & { gestaltId: number } =>
            row.gestaltId !== null,
        )
        .map((row) => [row.gestaltId, row.occurrenceCount]),
    );
    const fingerprint = duplicateEvidenceFingerprint(entries, occurrenceCounts);
    const [existingDecision] = await transaction
      .select()
      .from(dictionaryDuplicateSuggestionsTable)
      .where(
        and(
          eq(
            dictionaryDuplicateSuggestionsTable.organizationId,
            actor.organizationId!,
          ),
          eq(dictionaryDuplicateSuggestionsTable.childId, query.data.childId),
          eq(
            dictionaryDuplicateSuggestionsTable.firstGestaltId,
            firstGestaltId,
          ),
          eq(
            dictionaryDuplicateSuggestionsTable.secondGestaltId,
            secondGestaltId,
          ),
        ),
      )
      .for("update");
    if (
      existingDecision?.decision === "keep_separate" &&
      body.data.decision !== "keep_separate"
    ) {
      return { keptSeparate: true as const };
    }
    let canonical: typeof clinicalGestaltsTable.$inferSelect | undefined;
    if (body.data.decision === "merge") {
      const canonicalId = body.data.canonicalGestaltId!;
      const sourceId =
        canonicalId === firstGestaltId ? secondGestaltId : firstGestaltId;
      const merged = await mergeReviewedGestalts(
        transaction,
        actor as ResolvedCareTeamActor & { organizationId: number },
        query.data.childId,
        sourceId,
        canonicalId,
      );
      if (!merged || "unrelated" in merged)
        return { unavailable: true as const };
      canonical = merged;
    }
    const storedDecision =
      body.data.decision === "dismiss"
        ? "dismissed"
        : body.data.decision === "merge"
          ? "merged"
          : "keep_separate";
    await transaction
      .insert(dictionaryDuplicateSuggestionsTable)
      .values({
        organizationId: actor.organizationId!,
        childId: query.data.childId,
        firstGestaltId,
        secondGestaltId,
        evidenceFingerprint: fingerprint,
        decision: storedDecision,
        decisionUserId: actor.userId,
        decisionActorName: actor.author,
        decisionActorRole: actor.role,
        decisionAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          dictionaryDuplicateSuggestionsTable.organizationId,
          dictionaryDuplicateSuggestionsTable.childId,
          dictionaryDuplicateSuggestionsTable.firstGestaltId,
          dictionaryDuplicateSuggestionsTable.secondGestaltId,
        ],
        set: {
          evidenceFingerprint: fingerprint,
          decision: storedDecision,
          decisionUserId: actor.userId,
          decisionActorName: actor.author,
          decisionActorRole: actor.role,
          decisionAt: new Date(),
          updatedAt: new Date(),
        },
      });
    const suggestionId = duplicateSuggestionId(firstGestaltId, secondGestaltId);
    const action =
      body.data.decision === "merge"
        ? "DICTIONARY_DUPLICATE_MERGED"
        : body.data.decision === "keep_separate"
          ? "DICTIONARY_DUPLICATE_KEPT_SEPARATE"
          : "DICTIONARY_DUPLICATE_DISMISSED";
    await insertTransactionalAudit(transaction, actor, {
      action,
      targetType: "dictionary_duplicate_suggestion",
      targetId: suggestionId,
      childId: query.data.childId,
      metadata: {
        changeType: body.data.decision,
        sourceId:
          body.data.decision === "merge"
            ? body.data.canonicalGestaltId === firstGestaltId
              ? secondGestaltId
              : firstGestaltId
            : null,
        targetId: body.data.canonicalGestaltId ?? null,
      },
    });
    if (canonical) {
      await insertTransactionalAudit(transaction, actor, {
        action: "GESTALT_MERGED",
        targetType: "gestalt",
        targetId: canonical.id,
        childId: canonical.childId,
      });
    }
    return { canonical };
  });
  if ("unavailable" in result)
    return res
      .status(404)
      .json({
        error: "One or both phrases are no longer available for this child.",
      });
  if ("unrelated" in result)
    return res
      .status(400)
      .json({
        error:
          "These phrases are no longer a conservative duplicate suggestion.",
      });
  if ("keptSeparate" in result)
    return res
      .status(409)
      .json({
        error:
          "These phrases were explicitly kept separate and cannot be merged.",
      });
  const suggestionId = duplicateSuggestionId(firstGestaltId, secondGestaltId);
  return res.json(
    DecideDictionaryDuplicateSuggestionResponse.parse({
      suggestionId,
      decision: body.data.decision,
      canonicalGestalt: result.canonical
        ? gestaltFromRecord(result.canonical)
        : null,
    }),
  );
});
router.post("/gestalts/merge", async (req, res) => {
  const query = MergeGestaltsQueryParams.safeParse(req.query);
  const body = MergeGestaltsBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(res, "Select the duplicate phrase and the phrase to keep.");
  if (body.data.sourceGestaltId === body.data.targetGestaltId)
    return fail(res, "Choose two different phrases to merge.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor))
    return res
      .status(403)
      .json({ error: "Only an SLP can merge reviewed dictionary phrases." });
  const merged = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(${actor.organizationId!}, ${query.data.childId})`,
    );
    const [firstGestaltId, secondGestaltId] = duplicatePairIds(
      body.data.sourceGestaltId,
      body.data.targetGestaltId,
    );
    const [decision] = await transaction
      .select()
      .from(dictionaryDuplicateSuggestionsTable)
      .where(
        and(
          eq(
            dictionaryDuplicateSuggestionsTable.organizationId,
            actor.organizationId!,
          ),
          eq(dictionaryDuplicateSuggestionsTable.childId, query.data.childId),
          eq(
            dictionaryDuplicateSuggestionsTable.firstGestaltId,
            firstGestaltId,
          ),
          eq(
            dictionaryDuplicateSuggestionsTable.secondGestaltId,
            secondGestaltId,
          ),
        ),
      )
      .for("update");
    if (decision?.decision === "keep_separate")
      return { keptSeparate: true as const };
    const result = await mergeReviewedGestalts(
      transaction,
      actor as ResolvedCareTeamActor & { organizationId: number },
      query.data.childId,
      body.data.sourceGestaltId,
      body.data.targetGestaltId,
    );
    if (result && !("unrelated" in result)) {
      await insertTransactionalAudit(transaction, actor, {
        action: "GESTALT_MERGED",
        targetType: "gestalt",
        targetId: result.id,
        childId: result.childId,
      });
    }
    return result;
  });
  if (!merged)
    return res
      .status(404)
      .json({ error: "One of the phrases is unavailable for this child." });
  if ("unrelated" in merged)
    return res
      .status(400)
      .json({
        error: "Only exact or conservatively similar phrases can be merged.",
      });
  if ("keptSeparate" in merged)
    return res
      .status(409)
      .json({
        error:
          "These phrases were explicitly kept separate and cannot be merged.",
      });
  return res.json(gestaltFromRecord(merged));
});
router.post("/gestalts/comments", async (req, res) => {
  const query = AddGestaltCommentQueryParams.safeParse(req.query);
  const body = AddGestaltCommentBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(res, "A comment is required.");
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const [gestalt] = await db
    .select()
    .from(clinicalGestaltsTable)
    .where(
      and(
        eq(clinicalGestaltsTable.id, query.data.gestaltId),
        eq(clinicalGestaltsTable.organizationId, actor.organizationId),
        isNull(clinicalGestaltsTable.archivedAt),
      ),
    )
    .limit(1);
  if (!gestalt) return res.status(404).json({ error: "Gestalt not found" });
  if (!requireChildAccess(req, res, gestalt.childId)) return;
  const [note] = await db
    .insert(gestaltCollaborationNotesTable)
    .values({
      organizationId: actor.organizationId,
      childId: gestalt.childId,
      gestaltId: gestalt.id,
      authorUserId: actor.userId,
      authorName: actor.author,
      authorRole: actor.role,
      body: body.data.body.trim(),
    })
    .returning();
  if (!note)
    return res.status(500).json({ error: "The team note could not be saved." });
  const comment = {
    id: note.id,
    author: note.authorName,
    role: note.authorRole,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
  };
  await writeSecurityAudit({
    actor,
    action: "GESTALT_COMMENT_CREATED",
    targetType: "gestalt_comment",
    targetId: comment.id,
    childId: gestalt.childId,
  });
  return res.status(201).json(comment);
});
router.post("/phrase-observations", async (req, res) => {
  const query = LogPhraseObservationQueryParams.safeParse(req.query);
  const body = LogPhraseObservationBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(
      res,
      "Add the phrase, classroom context, and observation time.",
    );
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const organizationId = actor.organizationId;
  if (
    !canContributeSharedChildContext(actor.role) &&
    !isNativeDevelopmentDemo(actor)
  ) {
    return res
      .status(403)
      .json({
        error:
          "Only an SLP, parent, or teacher can log a shared phrase observation.",
      });
  }
  const observedAt = new Date(body.data.observedAt);
  if (
    Number.isNaN(observedAt.getTime()) ||
    observedAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    return fail(res, "Use a valid observation time.");
  }
  const normalizedPhrase = normalizePhrase(body.data.phrase);
  const outcome = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(${organizationId}, ${query.data.childId})`,
    );
    const repair = await repairCanonicalGestaltsForChild(
      transaction,
      organizationId,
      query.data.childId,
    );
    const selectedGestaltId = body.data.existingGestaltId
      ? (repair.canonicalIdForGestaltId.get(body.data.existingGestaltId) ??
        body.data.existingGestaltId)
      : undefined;
    const [selectedExisting] = selectedGestaltId
      ? await transaction
          .select()
          .from(clinicalGestaltsTable)
          .where(
            and(
              eq(clinicalGestaltsTable.id, selectedGestaltId),
              eq(clinicalGestaltsTable.organizationId, organizationId),
              eq(clinicalGestaltsTable.childId, query.data.childId),
              isNull(clinicalGestaltsTable.archivedAt),
            ),
          )
          .limit(1)
          .for("update")
      : [];
    if (body.data.existingGestaltId && !selectedExisting)
      return { unavailable: true };
    if (
      selectedExisting &&
      matchPhraseKey(selectedExisting.phrase) !==
        matchPhraseKey(body.data.phrase) &&
      !isConservativeNearDuplicate(body.data.phrase, selectedExisting.phrase)
    )
      return { unrelated: true };
    const activePhrases = selectedExisting
      ? []
      : await transaction
          .select()
          .from(clinicalGestaltsTable)
          .where(
            and(
              eq(clinicalGestaltsTable.organizationId, organizationId),
              eq(clinicalGestaltsTable.childId, query.data.childId),
              isNull(clinicalGestaltsTable.archivedAt),
            ),
          )
          .for("update");
    const exactExisting = activePhrases.find(
      (item) =>
        matchPhraseKey(item.phrase) === matchPhraseKey(body.data.phrase),
    );
    const existing = selectedExisting ?? exactExisting;
    let noteBody = collaborationNoteForPhraseObservation({
      actor,
      details: body.data.details,
      possibleMeaning: body.data.possibleMeaning,
      communicationFunction: body.data.communicationFunction,
      context: body.data.context,
      observedAt,
    });
    const [record] = existing
      ? await transaction
          .update(clinicalGestaltsTable)
          .set({
            contexts: [
              ...new Set([...existing.contexts, body.data.context.trim()]),
            ].slice(0, 30),
            updatedAt: new Date(),
          })
          .where(eq(clinicalGestaltsTable.id, existing.id))
          .returning()
      : await transaction
          .insert(clinicalGestaltsTable)
          .values({
            organizationId,
            childId: query.data.childId,
            phrase: body.data.phrase.trim(),
            normalizedPhrase,
            meaning: "Care-team observation awaiting clinician review",
            communicationFunction: "Not yet reviewed",
            contexts: [body.data.context.trim()],
            emotionalState: "Not documented",
            source: `${actor.role} observation · clinician review pending`,
            createdByUserId: actor.userId,
          })
          .returning();
    if (!record) throw new Error("The phrase observation could not be saved.");
    if (
      selectedExisting &&
      matchPhraseKey(body.data.phrase) !== matchPhraseKey(record.phrase)
    ) {
      noteBody += `\n\nMerged from similar phrase entry: “${body.data.phrase.trim()}”`;
    }
    const [sourceNote] = await transaction
      .insert(gestaltCollaborationNotesTable)
      .values({
        organizationId,
        childId: record.childId,
        gestaltId: record.id,
        authorUserId: actor.userId,
        authorName: actor.author,
        authorRole: actor.role,
        body: noteBody,
      })
      .returning();
    await transaction.insert(phraseObservationsTable).values({
      organizationId,
      childId: record.childId,
      gestaltId: record.id,
      sourceNoteId: sourceNote?.id ?? null,
      observedAt,
      context: body.data.context.trim(),
      communicationFunction: body.data.communicationFunction?.trim() || null,
      authorUserId: actor.userId,
      authorName: actor.author,
      authorRole: actor.role,
    });
    const [occurrence] = await transaction
      .insert(gestaltOccurrencesTable)
      .values({
        childId: record.childId,
        gestaltId: record.id,
        phrase: record.phrase,
        normalizedPhrase: record.normalizedPhrase,
        occurrenceCount: 1,
        lastSeenAt: observedAt,
      })
      .onConflictDoUpdate({
        target: [
          gestaltOccurrencesTable.childId,
          gestaltOccurrencesTable.normalizedPhrase,
        ],
        set: {
          gestaltId: record.id,
          phrase: record.phrase,
          occurrenceCount: sql`${gestaltOccurrencesTable.occurrenceCount} + 1`,
          lastSeenAt: sql`GREATEST(${gestaltOccurrencesTable.lastSeenAt}, ${observedAt})`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return { record, existing: Boolean(existing), occurrence };
  });
  if (outcome.unavailable)
    return res
      .status(404)
      .json({ error: "The selected existing phrase is unavailable." });
  if (outcome.unrelated)
    return res
      .status(400)
      .json({
        error:
          "The selected phrase is not an exact or close match for this observation.",
      });
  const { record, occurrence } = outcome;
  if (!record)
    return res
      .status(500)
      .json({ error: "The phrase observation could not be saved." });
  await writeSecurityAudit({
    actor,
    action: outcome.existing
      ? "PHRASE_OBSERVATION_ADDED"
      : "NEW_PHRASE_OBSERVED",
    targetType: "phrase_observation",
    targetId: record.id,
    childId: record.childId,
  });
  const [gestalt] = canUseClinicalTools(actor)
    ? await gestaltsWithCollaboration([record])
    : [roleSafeGestalt(record)];
  return res.status(201).json(
    LogPhraseObservationResponse.parse({
      gestalt,
      isNew: !outcome.existing,
      totalOccurrences: occurrence?.occurrenceCount ?? 1,
      lastObservedAt: (occurrence?.lastSeenAt ?? observedAt).toISOString(),
    }),
  );
});
router.get("/phrase-observations/recovery", async (req, res) => {
  const query = ListLegacyPhraseObservationsQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor)) {
    return res
      .status(403)
      .json({
        error: "Only an SLP can review historical phrase observations.",
      });
  }
  const [notes, observations, records, recoveries] = await Promise.all([
    db
      .select()
      .from(gestaltCollaborationNotesTable)
      .where(
        and(
          eq(
            gestaltCollaborationNotesTable.organizationId,
            actor.organizationId,
          ),
          eq(gestaltCollaborationNotesTable.childId, query.data.childId),
        ),
      )
      .orderBy(desc(gestaltCollaborationNotesTable.createdAt)),
    db
      .select()
      .from(phraseObservationsTable)
      .where(
        and(
          eq(phraseObservationsTable.organizationId, actor.organizationId),
          eq(phraseObservationsTable.childId, query.data.childId),
        ),
      ),
    db
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.organizationId, actor.organizationId),
          eq(clinicalGestaltsTable.childId, query.data.childId),
        ),
      ),
    db
      .select({
        sourceNoteId: legacyPhraseObservationRecoveriesTable.sourceNoteId,
      })
      .from(legacyPhraseObservationRecoveriesTable)
      .where(
        and(
          eq(
            legacyPhraseObservationRecoveriesTable.organizationId,
            actor.organizationId,
          ),
          eq(
            legacyPhraseObservationRecoveriesTable.childId,
            query.data.childId,
          ),
        ),
      ),
  ]);
  const recoveredNoteIds = new Set(recoveries.map((row) => row.sourceNoteId));
  const recordById = new Map(records.map((record) => [record.id, record]));
  const reviewedActive = records.filter(
    (record) => !record.archivedAt && isClinicallyReviewedGestalt(record),
  );
  const candidates = notes.flatMap((note) => {
    const parsed = parseLegacyPhraseObservationNote(note);
    const source = recordById.get(note.gestaltId);
    if (
      !parsed ||
      !source ||
      recoveredNoteIds.has(note.id) ||
      legacyNoteHasTypedObservation(note, observations)
    )
      return [];
    const exactTarget = reviewedActive.find(
      (record) =>
        matchPhraseKey(record.phrase) === matchPhraseKey(source.phrase),
    );
    return [
      {
        noteId: note.id,
        childId: note.childId,
        sourceGestaltId: note.gestaltId,
        phrase: source.phrase,
        noteBody: note.body,
        authorName: note.authorName,
        authorRole: note.authorRole,
        sharedAt: note.createdAt.toISOString(),
        inferredContext: parsed.context,
        suggestedObservedAt: parsed.observedAt.toISOString(),
        suggestedTargetGestaltId: exactTarget?.id ?? null,
      },
    ];
  });
  return res.json(
    ListLegacyPhraseObservationsResponse.parse({
      items: candidates.slice(0, 100),
      total: candidates.length,
    }),
  );
});
router.post("/phrase-observations/recovery-action", async (req, res) => {
  const query = RecoverLegacyPhraseObservationQueryParams.safeParse(req.query);
  const body = RecoverLegacyPhraseObservationBody.safeParse(req.body);
  if (!query.success || !body.success || body.data.confirmation !== true) {
    return fail(
      res,
      "Confirm the historical note and complete the reviewed phrase details.",
    );
  }
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor)) {
    return res
      .status(403)
      .json({
        error: "Only an SLP can recover historical phrase observations.",
      });
  }
  const observedAt = new Date(body.data.observedAt);
  if (
    Number.isNaN(observedAt.getTime()) ||
    observedAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    return fail(res, "Use a valid historical observation time.");
  }
  const organizationId = actor.organizationId;
  const outcome = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(${organizationId}, ${query.data.childId})`,
    );
    await repairCanonicalGestaltsForChild(
      transaction,
      organizationId,
      query.data.childId,
    );
    const [note] = await transaction
      .select()
      .from(gestaltCollaborationNotesTable)
      .where(
        and(
          eq(gestaltCollaborationNotesTable.id, query.data.noteId),
          eq(gestaltCollaborationNotesTable.organizationId, organizationId),
          eq(gestaltCollaborationNotesTable.childId, query.data.childId),
        ),
      )
      .limit(1)
      .for("update");
    if (!note || !parseLegacyPhraseObservationNote(note))
      return { unavailable: true } as const;
    const [existingRecovery] = await transaction
      .select()
      .from(legacyPhraseObservationRecoveriesTable)
      .where(eq(legacyPhraseObservationRecoveriesTable.sourceNoteId, note.id))
      .limit(1);
    if (existingRecovery) return { alreadyRecovered: true } as const;
    const existingObservations = await transaction
      .select()
      .from(phraseObservationsTable)
      .where(
        and(
          eq(phraseObservationsTable.organizationId, organizationId),
          eq(phraseObservationsTable.childId, query.data.childId),
        ),
      );
    if (legacyNoteHasTypedObservation(note, existingObservations)) {
      return { alreadyAccountedFor: true } as const;
    }
    const [source] = await transaction
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.id, note.gestaltId),
          eq(clinicalGestaltsTable.organizationId, organizationId),
          eq(clinicalGestaltsTable.childId, query.data.childId),
        ),
      )
      .limit(1)
      .for("update");
    if (!source) return { unavailable: true } as const;
    if (
      matchPhraseKey(source.phrase) !== matchPhraseKey(body.data.phrase) &&
      !isConservativeNearDuplicate(source.phrase, body.data.phrase)
    )
      return { unrelated: true } as const;

    const records = await transaction
      .select()
      .from(clinicalGestaltsTable)
      .where(
        and(
          eq(clinicalGestaltsTable.organizationId, organizationId),
          eq(clinicalGestaltsTable.childId, query.data.childId),
        ),
      )
      .for("update");
    let target = body.data.targetGestaltId
      ? records.find(
          (record) =>
            record.id === body.data.targetGestaltId &&
            !record.archivedAt &&
            isClinicallyReviewedGestalt(record),
        )
      : records.find(
          (record) =>
            !record.archivedAt &&
            isClinicallyReviewedGestalt(record) &&
            matchPhraseKey(record.phrase) === matchPhraseKey(body.data.phrase),
        );
    if (body.data.targetGestaltId && !target)
      return { targetUnavailable: true } as const;
    if (
      target &&
      matchPhraseKey(target.phrase) !== matchPhraseKey(body.data.phrase) &&
      !isConservativeNearDuplicate(target.phrase, body.data.phrase)
    )
      return { unrelated: true } as const;

    if (!target) {
      const normalizedPhrase = normalizePhrase(body.data.phrase);
      const pendingExact = records.find(
        (record) =>
          !record.archivedAt &&
          !isClinicallyReviewedGestalt(record) &&
          matchPhraseKey(record.phrase) === matchPhraseKey(body.data.phrase),
      );
      if (pendingExact) {
        await transaction
          .update(clinicalGestaltsTable)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(eq(clinicalGestaltsTable.id, pendingExact.id));
      }
      [target] = await transaction
        .insert(clinicalGestaltsTable)
        .values({
          organizationId,
          childId: query.data.childId,
          phrase: body.data.phrase.trim(),
          normalizedPhrase,
          meaning: body.data.meaning.trim(),
          communicationFunction: body.data.function.trim(),
          contexts: [body.data.context.trim()],
          emotionalState: body.data.emotionalState.trim(),
          source: "Clinician-reviewed historical care-team observation",
          createdByUserId: actor.userId,
        })
        .returning();
    } else {
      [target] = await transaction
        .update(clinicalGestaltsTable)
        .set({
          contexts: [
            ...new Set([...target.contexts, body.data.context.trim()]),
          ].slice(0, 30),
          updatedAt: new Date(),
        })
        .where(eq(clinicalGestaltsTable.id, target.id))
        .returning();
    }
    if (!target) throw new Error("The reviewed phrase could not be saved.");

    const [observation] = await transaction
      .insert(phraseObservationsTable)
      .values({
        organizationId,
        childId: query.data.childId,
        gestaltId: target.id,
        sourceNoteId: note.id,
        observedAt,
        context: body.data.context.trim(),
        communicationFunction: body.data.function.trim(),
        authorUserId: note.authorUserId,
        authorName: note.authorName,
        authorRole: note.authorRole,
      })
      .returning();
    if (!observation)
      throw new Error(
        "The historical phrase observation could not be recovered.",
      );
    await transaction
      .insert(gestaltOccurrencesTable)
      .values({
        childId: query.data.childId,
        gestaltId: target.id,
        phrase: target.phrase,
        normalizedPhrase: target.normalizedPhrase,
        occurrenceCount: 1,
        lastSeenAt: observedAt,
      })
      .onConflictDoUpdate({
        target: [
          gestaltOccurrencesTable.childId,
          gestaltOccurrencesTable.normalizedPhrase,
        ],
        set: {
          gestaltId: target.id,
          phrase: target.phrase,
          occurrenceCount: sql`${gestaltOccurrencesTable.occurrenceCount} + 1`,
          lastSeenAt: sql`GREATEST(${gestaltOccurrencesTable.lastSeenAt}, ${observedAt})`,
          updatedAt: new Date(),
        },
      });
    const [recovery] = await transaction
      .insert(legacyPhraseObservationRecoveriesTable)
      .values({
        organizationId,
        childId: query.data.childId,
        sourceNoteId: note.id,
        sourceGestaltId: source.id,
        targetGestaltId: target.id,
        phraseObservationId: observation.id,
        reviewedByUserId: actor.userId,
        reviewedByName: actor.author,
        meaning: body.data.meaning.trim(),
        communicationFunction: body.data.function.trim(),
        context: body.data.context.trim(),
      })
      .returning();
    if (!recovery) throw new Error("The recovery decision could not be saved.");
    await insertTransactionalAudit(transaction, actor, {
      action: "LEGACY_PHRASE_OBSERVATION_RECOVERED",
      targetType: "phrase_observation_recovery",
      targetId: recovery.id,
      childId: query.data.childId,
    });
    return { recovery, observation, target } as const;
  });
  if ("unavailable" in outcome)
    return res
      .status(404)
      .json({ error: "That historical phrase note is unavailable." });
  if ("alreadyRecovered" in outcome || "alreadyAccountedFor" in outcome) {
    return res
      .status(409)
      .json({
        error: "That historical phrase note has already been accounted for.",
      });
  }
  if ("targetUnavailable" in outcome) {
    return res
      .status(409)
      .json({
        error: "Choose an active clinician-reviewed dictionary phrase.",
      });
  }
  if ("unrelated" in outcome) {
    return res
      .status(400)
      .json({
        error:
          "The reviewed phrase must match or conservatively preserve the shared phrase.",
      });
  }
  return res.status(201).json(
    RecoverLegacyPhraseObservationResponse.parse({
      recoveryId: outcome.recovery.id,
      noteId: outcome.recovery.sourceNoteId,
      phraseObservationId: outcome.observation.id,
      gestalt: gestaltFromRecord(outcome.target),
      recoveredAt: outcome.recovery.recoveredAt.toISOString(),
    }),
  );
});
router.get("/dictionary/insights", async (req, res) => {
  const query = GetDictionaryInsightsQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  const insights = await dictionaryInsightsFor(
    actor.organizationId,
    query.data.childId,
    actor,
  );
  if (!insights) return res.status(404).json({ error: "Child not found" });
  return res.json(insights);
});
router.get("/aac-planning", async (req, res) => {
  const query = ListAacPlanningQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor))
    return res.status(403).json({ error: "Only an SLP can use AAC planning." });
  const entries = await aacPlanningEntriesFor(
    actor.organizationId,
    query.data.childId,
  );
  return res.json({ childId: query.data.childId, entries, generatedAt: now() });
});
router.post("/aac-planning", async (req, res) => {
  const body = CreateAacPlanningBody.safeParse(req.body);
  if (!body.success) return fail(res, "Choose a child dictionary phrase.");
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor))
    return res.status(403).json({ error: "Only an SLP can use AAC planning." });
  const [gestalt] = await db
    .select()
    .from(clinicalGestaltsTable)
    .where(
      and(
        eq(clinicalGestaltsTable.id, body.data.gestaltId),
        eq(clinicalGestaltsTable.organizationId, actor.organizationId),
        eq(clinicalGestaltsTable.childId, body.data.childId),
        isNull(clinicalGestaltsTable.archivedAt),
      ),
    )
    .limit(1);
  if (!gestalt)
    return res.status(404).json({ error: "Dictionary phrase not found." });
  const [planning] = await db
    .insert(aacVocabularyPlanningTable)
    .values({
      organizationId: actor.organizationId,
      childId: body.data.childId,
      gestaltId: gestalt.id,
      status: "candidate",
      createdByUserId: actor.userId,
    })
    .onConflictDoUpdate({
      target: [
        aacVocabularyPlanningTable.childId,
        aacVocabularyPlanningTable.gestaltId,
      ],
      set: { status: "candidate", updatedAt: new Date() },
    })
    .returning();
  if (!planning)
    return res
      .status(500)
      .json({ error: "AAC planning could not be updated." });
  const entry = (
    await aacPlanningEntriesFor(actor.organizationId, body.data.childId)
  ).find((item) => item.id === planning.id);
  if (!entry)
    return res.status(500).json({ error: "AAC planning could not be loaded." });
  await writeSecurityAudit({
    actor,
    action: "AAC_PLANNING_CANDIDATE_ADDED",
    targetType: "aac_planning",
    targetId: planning.id,
    childId: planning.childId,
  });
  return res.status(201).json(CreateAacPlanningResponse.parse(entry));
});
router.patch("/aac-planning/:planningId", async (req, res) => {
  const params = UpdateAacPlanningParams.safeParse(req.params);
  const body = UpdateAacPlanningBody.safeParse(req.body);
  if (!params.success || !body.success)
    return fail(res, "Choose a valid AAC planning decision.");
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor))
    return res.status(403).json({ error: "Only an SLP can use AAC planning." });
  const [existing] = await db
    .select()
    .from(aacVocabularyPlanningTable)
    .where(
      and(
        eq(aacVocabularyPlanningTable.id, params.data.planningId),
        eq(aacVocabularyPlanningTable.organizationId, actor.organizationId),
      ),
    )
    .limit(1);
  if (!existing)
    return res.status(404).json({ error: "AAC planning entry not found." });
  if (!requireChildAccess(req, res, existing.childId)) return;
  const [updated] = await db
    .update(aacVocabularyPlanningTable)
    .set({
      status: body.data.status,
      updatedAt: new Date(),
    })
    .where(eq(aacVocabularyPlanningTable.id, existing.id))
    .returning();
  const entry = (
    await aacPlanningEntriesFor(actor.organizationId, existing.childId)
  ).find((item) => item.id === updated?.id);
  if (!entry)
    return res
      .status(404)
      .json({ error: "The linked dictionary phrase is no longer active." });
  await writeSecurityAudit({
    actor,
    action: "AAC_PLANNING_STATUS_UPDATED",
    targetType: "aac_planning",
    targetId: existing.id,
    childId: existing.childId,
    metadata: { status: body.data.status },
  });
  return res.json(UpdateAacPlanningResponse.parse(entry));
});
router.delete("/aac-planning/:planningId", async (req, res) => {
  const params = RemoveAacPlanningParams.safeParse(req.params);
  if (!params.success) return fail(res, "Choose a valid AAC planning entry.");
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor))
    return res.status(403).json({ error: "Only an SLP can use AAC planning." });
  const [existing] = await db
    .select()
    .from(aacVocabularyPlanningTable)
    .where(
      and(
        eq(aacVocabularyPlanningTable.id, params.data.planningId),
        eq(aacVocabularyPlanningTable.organizationId, actor.organizationId),
      ),
    )
    .limit(1);
  if (!existing)
    return res.status(404).json({ error: "AAC planning entry not found." });
  if (!requireChildAccess(req, res, existing.childId)) return;
  await db
    .delete(aacVocabularyPlanningTable)
    .where(eq(aacVocabularyPlanningTable.id, existing.id));
  await writeSecurityAudit({
    actor,
    action: "AAC_PLANNING_ENTRY_REMOVED",
    targetType: "aac_planning",
    targetId: existing.id,
    childId: existing.childId,
  });
  return res.status(204).end();
});
router.get("/teacher/communication-helper", async (req, res): Promise<void> => {
  const query = GetTeacherCommunicationHelperQueryParams.safeParse(req.query);
  if (!query.success || !query.data.phrase.trim()) {
    fail(res, "Enter a phrase to search.");
    return;
  }
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId) {
    res.status(401).json({ error: authenticationError(req) });
    return;
  }
  if (actor.role !== "Teacher") {
    res
      .status(403)
      .json({
        error: "This classroom helper is available to assigned teachers.",
      });
    return;
  }
  const helper = await teacherCommunicationHelperFor(
    actor.organizationId,
    query.data.childId,
    query.data.phrase.trim(),
  );
  if (!helper) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  res.json(GetTeacherCommunicationHelperResponse.parse(helper));
});
router.get("/phrase-trends", async (req, res) => {
  const query = GetPhraseTrendsQueryParams.safeParse(req.query);
  if (!query.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor)) {
    await writeSecurityAudit({
      actor,
      action: "CLINICAL_ACCESS_DENIED",
      targetType: "phrase_trends",
      childId: query.data.childId,
      outcome: "failure",
    });
    return res
      .status(403)
      .json({
        error: "Only an SLP can view detailed clinical language trends.",
      });
  }
  const from = query.data.from
    ? new Date(query.data.from)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const to = query.data.to ? new Date(query.data.to) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return fail(
      res,
      "The trend start date must be a valid date before the end date.",
    );
  }
  const sessions = await db
    .select()
    .from(therapySessionsTable)
    .where(
      and(
        eq(therapySessionsTable.organizationId, actor.organizationId),
        eq(therapySessionsTable.childId, query.data.childId),
        isNull(therapySessionsTable.archivedAt),
      ),
    );
  const sessionsById = new Map(
    sessions
      .filter((session) => session.createdAt >= from && session.createdAt <= to)
      .map((session) => [session.id, session]),
  );
  const sessionIds = [...sessionsById.keys()];
  const reviewedPhrases = sessionIds.length
    ? await db
        .select()
        .from(therapySessionGestaltsTable)
        .where(inArray(therapySessionGestaltsTable.sessionId, sessionIds))
    : [];
  const childPhrases = childAttributedOnly(reviewedPhrases);
  const reviewedSessionCount = countReviewedChildSessions(reviewedPhrases);
  const transcriptPhraseIds = childPhrases
    .map((phrase) => phrase.transcriptPhraseId)
    .filter((id): id is number => typeof id === "number");
  const transcriptPhrases = transcriptPhraseIds.length
    ? await db
        .select()
        .from(transcriptPhrasesTable)
        .where(inArray(transcriptPhrasesTable.id, transcriptPhraseIds))
    : [];
  const frequencyByTranscriptPhrase = new Map(
    transcriptPhrases.map((phrase) => [phrase.id, phrase.frequency]),
  );
  const trends = new Map<
    string,
    {
      phrase: string;
      gestaltId: number | null;
      totalOccurrences: number;
      contexts: Set<string>;
      points: Map<string, number>;
      meanings: Map<
        string,
        { date: string; meaning: string; context: string; occurrences: number }
      >;
    }
  >();
  const functionTimeline = new Map<
    string,
    { date: string; function: string; occurrences: number }
  >();
  for (const phrase of childPhrases) {
    const session = sessionsById.get(phrase.sessionId);
    if (!session) continue;
    const key = matchPhraseKey(phrase.phrase);
    const current = trends.get(key) ?? {
      phrase: phrase.phrase,
      gestaltId: phrase.gestaltId ?? null,
      totalOccurrences: 0,
      contexts: new Set<string>(),
      points: new Map<string, number>(),
      meanings: new Map<
        string,
        { date: string; meaning: string; context: string; occurrences: number }
      >(),
    };
    const count =
      frequencyByTranscriptPhrase.get(phrase.transcriptPhraseId ?? -1) ?? 1;
    const date = session.createdAt.toISOString().slice(0, 10);
    current.totalOccurrences += count;
    if (phrase.context) current.contexts.add(phrase.context);
    current.points.set(date, (current.points.get(date) ?? 0) + count);
    const meaning = phrase.meaning || "Meaning not documented";
    const context = phrase.context || "Context not documented";
    const meaningKey = `${date}:${meaning}:${context}`;
    const priorMeaning = current.meanings.get(meaningKey);
    current.meanings.set(meaningKey, {
      date,
      meaning,
      context,
      occurrences: (priorMeaning?.occurrences ?? 0) + count,
    });
    const functionLabel = phrase.communicationFunction?.trim();
    if (functionLabel && !/^(unknown|not documented)$/i.test(functionLabel)) {
      const functionKey = `${date}:${functionLabel.toLocaleLowerCase()}`;
      const priorFunction = functionTimeline.get(functionKey);
      functionTimeline.set(functionKey, {
        date,
        function: functionLabel,
        occurrences: (priorFunction?.occurrences ?? 0) + count,
      });
    }
    trends.set(key, current);
  }
  return res.json({
    childId: query.data.childId,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    reviewedSessionCount,
    functionTimeline: [...functionTimeline.values()].sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.function.localeCompare(right.function),
    ),
    trends: [...trends.values()]
      .map((trend) => ({
        phrase: trend.phrase,
        gestaltId: trend.gestaltId,
        totalOccurrences: trend.totalOccurrences,
        contexts: [...trend.contexts],
        points: [...trend.points.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([date, occurrences]) => ({ date, occurrences })),
        meanings: [...trend.meanings.values()].sort(
          (left, right) =>
            left.date.localeCompare(right.date) ||
            left.meaning.localeCompare(right.meaning),
        ),
      }))
      .sort((left, right) => right.totalOccurrences - left.totalOccurrences),
    generatedAt: now(),
  });
});
router.post("/observation-videos/upload-url", async (req, res) => {
  const body = RequestObservationVideoUploadBody.safeParse(req.body);
  if (!body.success)
    return fail(
      res,
      "Please provide a short video and confirm consent to share it.",
    );
  if (!requireChildAccess(req, res, body.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor) return res.status(401).json({ error: authenticationError(req) });
  if (
    !canContributeSharedChildContext(actor.role) &&
    !isNativeDevelopmentDemo(actor)
  ) {
    return res
      .status(403)
      .json({
        error:
          "Only an SLP, parent, or teacher can share an observation video.",
      });
  }
  const contentType = normalizeRecordingUploadContentType(
    body.data.contentType,
  );
  if (!contentType?.startsWith("video/")) {
    return fail(res, "Choose an MP4, WebM, or QuickTime video.");
  }
  if (body.data.sizeBytes > MAX_OBSERVATION_VIDEO_BYTES) {
    return fail(res, "Observation videos must be 50 MB or smaller.");
  }
  if (
    !body.data.consentConfirmed ||
    !validObservationVideoConsent(body.data.consentConfirmedAt)
  ) {
    return fail(
      res,
      "Confirm that you have permission to share this private video.",
    );
  }
  if (!actor.organizationId) {
    return res
      .status(503)
      .json({
        error:
          "A private care-team workspace is required before sharing observation videos.",
      });
  }
  try {
    const reservation =
      await recordingObjectStorage.reserveObservationVideoUpload(
        actor.organizationId,
        body.data.childId,
        contentType,
      );
    const expiresAt = new Date(Date.now() + OBSERVATION_VIDEO_UPLOAD_TTL_MS);
    await db.insert(observationVideoUploadsTable).values({
      id: reservation.videoId,
      organizationId: actor.organizationId,
      childId: body.data.childId,
      stagingObjectPath: reservation.objectPath,
      finalObjectPath: reservation.finalObjectPath,
      contentType,
      sizeBytes: body.data.sizeBytes,
      consentConfirmedAt: validObservationVideoConsent(
        body.data.consentConfirmedAt,
      )!,
      uploadedByUserId: actor.userId,
      expiresAt,
    });
    await writeSecurityAudit({
      actor,
      action: "OBSERVATION_VIDEO_UPLOAD_RESERVED",
      targetType: "observation_video",
      targetId: reservation.videoId,
      childId: body.data.childId,
      metadata: { contentType, sizeBytes: body.data.sizeBytes },
    });
    return res.status(201).json(
      RequestObservationVideoUploadResponse.parse({
        videoId: reservation.videoId,
        uploadUrl: reservation.uploadUrl,
        contentType,
        sizeBytes: body.data.sizeBytes,
        expiresAt: expiresAt.toISOString(),
      }),
    );
  } catch (error) {
    logger.error(
      { err: error, childId: body.data.childId },
      "Could not reserve private observation video upload",
    );
    return res
      .status(503)
      .json({
        error:
          "We couldn’t prepare a private upload right now. Please try again.",
      });
  }
});

router.post("/observations", async (req, res) => {
  const query = CreateObservationQueryParams.safeParse(req.query);
  const body = CreateObservationBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(res, "Please add an observation and context.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor) return res.status(401).json({ error: authenticationError(req) });
  if (
    !canContributeSharedChildContext(actor.role) &&
    !isNativeDevelopmentDemo(actor)
  ) {
    return res
      .status(403)
      .json({
        error: "Only an SLP, parent, or teacher can add a shared observation.",
      });
  }
  const submittedVideo = body.data.video;
  let finalizedVideoPath: string | undefined;
  let videoUpload: typeof observationVideoUploadsTable.$inferSelect | undefined;
  let videoConsentConfirmedAt: Date | undefined;
  if (submittedVideo) {
    videoConsentConfirmedAt = submittedVideo.consentConfirmed
      ? (validObservationVideoConsent(submittedVideo.consentConfirmedAt) ??
        undefined)
      : undefined;
    if (!videoConsentConfirmedAt) {
      return fail(
        res,
        "Confirm that you have permission to share this private video.",
      );
    }
    if (!actor.organizationId) {
      return res
        .status(503)
        .json({
          error:
            "A private care-team workspace is required before attaching observation videos.",
        });
    }
    [videoUpload] = await db
      .update(observationVideoUploadsTable)
      .set({ status: "finalizing", updatedAt: new Date() })
      .where(
        and(
          eq(observationVideoUploadsTable.id, submittedVideo.uploadId),
          eq(observationVideoUploadsTable.organizationId, actor.organizationId),
          eq(observationVideoUploadsTable.childId, query.data.childId),
          eq(observationVideoUploadsTable.uploadedByUserId, actor.userId),
          eq(observationVideoUploadsTable.status, "reserved"),
        ),
      )
      .returning();
    if (!videoUpload || videoUpload.expiresAt < new Date()) {
      if (videoUpload) {
        await db
          .update(observationVideoUploadsTable)
          .set({
            status: "expired",
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(observationVideoUploadsTable.id, videoUpload.id));
        await recordingObjectStorage.delete(videoUpload.stagingObjectPath);
      }
      return fail(
        res,
        "This video upload expired. Choose the video again to request a new private upload.",
      );
    }
    try {
      finalizedVideoPath =
        (await recordingObjectStorage.finalizeObservationVideo(
          videoUpload.stagingObjectPath,
          videoUpload.contentType,
          videoUpload.sizeBytes,
          videoUpload.finalObjectPath!,
        )) ?? undefined;
    } catch (error) {
      await db
        .update(observationVideoUploadsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(observationVideoUploadsTable.id, videoUpload.id));
      if (videoUpload.finalObjectPath)
        await recordingObjectStorage.delete(videoUpload.finalObjectPath);
      logger.error(
        { err: error, childId: query.data.childId },
        "Could not finalize private observation video",
      );
      return res
        .status(503)
        .json({
          error:
            "We couldn’t securely attach this video. Your note was not saved; please try again.",
        });
    }
    if (!finalizedVideoPath) {
      await db
        .update(observationVideoUploadsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(observationVideoUploadsTable.id, videoUpload.id));
      if (videoUpload.finalObjectPath)
        await recordingObjectStorage.delete(videoUpload.finalObjectPath);
      return fail(
        res,
        "The video upload was incomplete or changed. Please choose the video again.",
      );
    }
  }
  if (actor.organizationId) {
    let record: typeof clinicalObservationsTable.$inferSelect | undefined;
    try {
      [record] = await db
        .insert(clinicalObservationsTable)
        .values({
          organizationId: actor.organizationId,
          childId: query.data.childId,
          body: body.data.body,
          context: body.data.context,
          videoObjectPath: finalizedVideoPath,
          videoContentType: videoUpload?.contentType ?? null,
          videoSizeBytes: videoUpload?.sizeBytes ?? null,
          videoConsentConfirmedAt: videoUpload?.consentConfirmedAt ?? null,
          videoConsentConfirmedByUserId: finalizedVideoPath
            ? actor.userId
            : null,
          createdByUserId: actor.userId,
        })
        .returning();
      if (record && videoUpload && finalizedVideoPath) {
        await db
          .update(observationVideoUploadsTable)
          .set({
            observationId: record.id,
            status: "attached",
            attachedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(observationVideoUploadsTable.id, videoUpload.id),
              eq(observationVideoUploadsTable.status, "finalizing"),
            ),
          );
      }
    } catch (error) {
      if (finalizedVideoPath)
        await recordingObjectStorage
          .delete(finalizedVideoPath)
          .catch(() => undefined);
      if (videoUpload) {
        await db
          .update(observationVideoUploadsTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(observationVideoUploadsTable.id, videoUpload.id));
        if (videoUpload.finalObjectPath)
          await recordingObjectStorage
            .delete(videoUpload.finalObjectPath)
            .catch(() => undefined);
      }
      logger.error(
        { err: error, childId: query.data.childId },
        "Could not create observation with private video",
      );
      return res
        .status(500)
        .json({
          error:
            "We couldn’t securely save that observation. Please try again.",
        });
    }
    if (!record)
      return res
        .status(500)
        .json({ error: "The shared observation could not be saved." });
    await writeSecurityAudit({
      actor,
      action:
        actor.role === "SLP"
          ? "CLINICAL_OBSERVATION_CREATED"
          : "SHARED_OBSERVATION_CREATED",
      targetType: "observation",
      targetId: record.id,
      childId: record.childId,
      metadata: {
        hasVideo: Boolean(finalizedVideoPath),
        videoSizeBytes: videoUpload?.sizeBytes ?? null,
      },
    });
    return res
      .status(201)
      .json(observationVideoResponse(record, actor, record.createdByUserId));
  }
  const identity = authorFrom(req);
  if (!identity)
    return res.status(401).json({ error: authenticationError(req) });
  const { author, role } = identity;
  const observation: Observation = {
    id: nextObservationId++,
    childId: query.data.childId,
    author,
    role,
    body: body.data.body,
    context: body.data.context,
    createdAt: now(),
    ...(finalizedVideoPath && videoUpload && videoConsentConfirmedAt
      ? {
          video: {
            objectPath: finalizedVideoPath,
            contentType: videoUpload.contentType,
            sizeBytes: videoUpload.sizeBytes,
            consentConfirmedAt: videoUpload.consentConfirmedAt.toISOString(),
            createdByUserId: actor.userId,
          },
        }
      : {}),
  };
  observations.unshift(observation);
  await writeSecurityAudit({
    actor,
    action:
      actor.role === "SLP"
        ? "CLINICAL_OBSERVATION_CREATED"
        : "SHARED_OBSERVATION_CREATED",
    targetType: "observation",
    targetId: observation.id,
    childId: observation.childId,
    metadata: {
      hasVideo: Boolean(finalizedVideoPath),
      videoSizeBytes: videoUpload?.sizeBytes ?? null,
    },
  });
  res.status(201).json({
    ...observationVideoResponse(
      {
        ...observation,
        videoObjectPath: observation.video?.objectPath,
        videoContentType: observation.video?.contentType,
        videoSizeBytes: observation.video?.sizeBytes,
        videoConsentConfirmedAt: observation.video?.consentConfirmedAt,
      },
      actor,
      actor.userId,
    ),
  });
});

router.get("/observations/:observationId/video", async (req, res) => {
  const params = GetObservationVideoParams.safeParse(req.params);
  if (!params.success)
    return res.status(404).json({ error: "Observation video not found." });
  const actor = viewerFrom(req);
  if (!actor) return res.status(401).json({ error: authenticationError(req) });
  if (actor.organizationId) {
    const [observation] = await db
      .select()
      .from(clinicalObservationsTable)
      .where(
        and(
          eq(clinicalObservationsTable.id, params.data.observationId),
          eq(clinicalObservationsTable.organizationId, actor.organizationId),
        ),
      )
      .limit(1);
    if (!observation?.videoObjectPath || !observation.videoContentType) {
      return res.status(404).json({ error: "Observation video not found." });
    }
    if (!requireChildAccess(req, res, observation.childId)) return;
    if (!canViewObservationVideo(actor, observation.createdByUserId)) {
      await writeSecurityAudit({
        actor,
        action: "OBSERVATION_VIDEO_ACCESS_DENIED",
        targetType: "observation_video",
        targetId: observation.id,
        childId: observation.childId,
        outcome: "failure",
      });
      return res
        .status(403)
        .json({ error: "This video is not available to your care-team role." });
    }
    try {
      const data = await recordingObjectStorage.read(
        observation.videoObjectPath,
      );
      await writeSecurityAudit({
        actor,
        action: "OBSERVATION_VIDEO_ACCESSED",
        targetType: "observation_video",
        targetId: observation.id,
        childId: observation.childId,
      });
      res.setHeader("Content-Type", observation.videoContentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.send(data);
    } catch {
      return res.status(404).json({ error: "Observation video not found." });
    }
  }
  const observation = observations.find(
    (item) => item.id === params.data.observationId,
  );
  if (!observation?.video)
    return res.status(404).json({ error: "Observation video not found." });
  if (!requireChildAccess(req, res, observation.childId)) return;
  if (!canViewObservationVideo(actor, observation.video.createdByUserId)) {
    return res
      .status(403)
      .json({ error: "This video is not available to your care-team role." });
  }
  try {
    const data = await recordingObjectStorage.read(
      observation.video.objectPath,
    );
    res.setHeader("Content-Type", observation.video.contentType);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(data);
  } catch {
    return res.status(404).json({ error: "Observation video not found." });
  }
});

router.get("/sessions", async (req, res) => {
  await ensureSessionStore();
  const parsed = ListSessionsQueryParams.safeParse(req.query);
  if (!parsed.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (!canUseClinicalTools(actor)) {
    if (actor)
      await writeSecurityAudit({
        actor,
        action: "CLINICAL_ACCESS_DENIED",
        targetType: "sessions",
        childId: parsed.data.childId,
        outcome: "failure",
      });
    return res
      .status(403)
      .json({ error: "Only an SLP can view clinical session records." });
  }
  if (actor?.organizationId) {
    const rows = await db
      .select()
      .from(therapySessionsTable)
      .where(
        and(
          eq(therapySessionsTable.organizationId, actor.organizationId),
          eq(therapySessionsTable.childId, parsed.data.childId),
          isNull(therapySessionsTable.archivedAt),
        ),
      )
      .orderBy(desc(therapySessionsTable.createdAt));
    const sessionIds = rows.map((row) => row.id);
    const phrases = sessionIds.length
      ? await db
          .select()
          .from(therapySessionGestaltsTable)
          .where(inArray(therapySessionGestaltsTable.sessionId, sessionIds))
      : [];
    const phrasesBySession = new Map<number, typeof phrases>();
    for (const phrase of phrases)
      phrasesBySession.set(phrase.sessionId, [
        ...(phrasesBySession.get(phrase.sessionId) ?? []),
        phrase,
      ]);
    const audio = sessionIds.length
      ? await db
          .select()
          .from(sessionAudioObjectsTable)
          .where(
            and(
              inArray(sessionAudioObjectsTable.sessionId, sessionIds),
              eq(sessionAudioObjectsTable.purpose, "session_recording"),
              isNull(sessionAudioObjectsTable.deletedAt),
            ),
          )
      : [];
    const audioBySession = new Map(
      audio
        .filter((item) => item.sessionId !== null)
        .map((item) => [item.sessionId!, item]),
    );
    return res.json(
      rows.map((row) => ({
        id: row.id,
        childId: row.childId,
        durationSeconds: row.durationSeconds,
        gestalts: (phrasesBySession.get(row.id) ?? []).map((phrase) => ({
          phrase: phrase.phrase,
          meaning: phrase.meaning,
          function: phrase.communicationFunction,
          context: phrase.context,
          emotionalState: phrase.emotionalState,
          note: phrase.note,
          transcriptPhraseId: phrase.transcriptPhraseId ?? undefined,
        })),
        clinicalObservations: row.clinicalObservations,
        nextSteps: row.nextSteps,
        note: row.note,
        audioId: audioBySession.get(row.id)?.id ?? null,
        audioUrl: audioBySession.has(row.id)
          ? `/api/sessions/${row.id}/audio`
          : null,
        createdAt: row.createdAt.toISOString(),
        createdBy: row.createdByUserId,
        role: "SLP",
        consent: null,
      })),
    );
  }
  res.json(
    sessionStore.sessions
      .filter((session) => session.childId === parsed.data.childId)
      .map(sessionResponse),
  );
});

router.get("/sessions/dashboard", async (req, res) => {
  const actor = viewerFrom(req);
  if (!actor) return res.status(401).json({ error: authenticationError(req) });
  if (!canUseClinicalTools(actor) || !actor.organizationId) {
    return res
      .status(403)
      .json({ error: "Only an SLP can view the sessions dashboard." });
  }
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

  const authorizedChildIds = actor.childIds.length ? actor.childIds : [-1];
  const profiles = await db
    .select()
    .from(childProfilesTable)
    .where(
      and(
        eq(childProfilesTable.organizationId, actor.organizationId),
        inArray(childProfilesTable.id, authorizedChildIds),
        isNull(childProfilesTable.archivedAt),
      ),
    );
  const profileIds = profiles.map((profile) => profile.id);
  if (!profileIds.length) {
    return res.json(
      GetSessionsDashboardResponse.parse({
        requiresReview: [],
        completedSessions: [],
        draftDocumentation: [],
        weeklySnapshot: {
          weekStart: weekStart.toISOString().slice(0, 10),
          sessionsRecorded: 0,
          awaitingReview: 0,
          draftNotes: 0,
          completedNotes: 0,
        },
      }),
    );
  }

  const [transcripts, completedSessions, documentationDrafts, soapDrafts] =
    await Promise.all([
      db
        .select()
        .from(sessionTranscriptsTable)
        .where(
          and(
            inArray(sessionTranscriptsTable.childId, profileIds),
            eq(sessionTranscriptsTable.createdByUserId, actor.userId),
            eq(sessionTranscriptsTable.status, "complete"),
            isNull(sessionTranscriptsTable.sessionId),
          ),
        )
        .orderBy(sessionTranscriptsTable.createdAt, sessionTranscriptsTable.id),
      db
        .select()
        .from(therapySessionsTable)
        .where(
          and(
            eq(therapySessionsTable.organizationId, actor.organizationId),
            inArray(therapySessionsTable.childId, profileIds),
            isNull(therapySessionsTable.archivedAt),
          ),
        )
        .orderBy(
          desc(therapySessionsTable.createdAt),
          desc(therapySessionsTable.id),
        ),
      db
        .select({
          id: clinicalDocumentationTable.id,
          childId: clinicalDocumentationTable.childId,
          title: clinicalDocumentationTable.title,
          status: clinicalDocumentationTable.status,
          updatedAt: clinicalDocumentationTable.updatedAt,
        })
        .from(clinicalDocumentationTable)
        .where(
          and(
            eq(clinicalDocumentationTable.organizationId, actor.organizationId),
            inArray(clinicalDocumentationTable.childId, profileIds),
            inArray(clinicalDocumentationTable.status, ["draft", "finalized"]),
          ),
        )
        .orderBy(desc(clinicalDocumentationTable.updatedAt)),
      db
        .select({
          id: clinicalSoapNotesTable.id,
          childId: clinicalSoapNotesTable.childId,
          status: clinicalSoapNotesTable.status,
          updatedAt: clinicalSoapNotesTable.updatedAt,
        })
        .from(clinicalSoapNotesTable)
        .where(
          and(
            eq(clinicalSoapNotesTable.organizationId, actor.organizationId),
            inArray(clinicalSoapNotesTable.childId, profileIds),
            inArray(clinicalSoapNotesTable.status, ["draft", "finalized"]),
          ),
        )
        .orderBy(desc(clinicalSoapNotesTable.updatedAt)),
    ]);
  const transcriptIds = transcripts.map((transcript) => transcript.id);
  const [segments, reviews, inboxItems, phraseRows] = transcriptIds.length
    ? await Promise.all([
        db
          .select({
            id: transcriptSpeakerSegmentsTable.id,
            transcriptId: transcriptSpeakerSegmentsTable.transcriptId,
          })
          .from(transcriptSpeakerSegmentsTable)
          .where(
            inArray(transcriptSpeakerSegmentsTable.transcriptId, transcriptIds),
          ),
        db
          .select({
            transcriptId: transcriptChildUtteranceReviewsTable.transcriptId,
            disposition: transcriptChildUtteranceReviewsTable.disposition,
          })
          .from(transcriptChildUtteranceReviewsTable)
          .where(
            inArray(
              transcriptChildUtteranceReviewsTable.transcriptId,
              transcriptIds,
            ),
          ),
        db
          .select({
            id: childPhraseInboxItemsTable.id,
            transcriptId: childPhraseInboxItemsTable.transcriptId,
          })
          .from(childPhraseInboxItemsTable)
          .where(
            and(
              eq(
                childPhraseInboxItemsTable.organizationId,
                actor.organizationId,
              ),
              inArray(childPhraseInboxItemsTable.transcriptId, transcriptIds),
              inArray(childPhraseInboxItemsTable.status, [
                "pending",
                "deferred",
              ]),
            ),
          ),
        db
          .select({
            transcriptId: transcriptPhrasesTable.transcriptId,
          })
          .from(transcriptPhrasesTable)
          .where(inArray(transcriptPhrasesTable.transcriptId, transcriptIds)),
      ])
    : [[], [], [], []];
  const childNameById = new Map(
    profiles.map((profile) => [profile.id, canonicalChildNames(profile).name]),
  );

  const requiresReview = transcripts.map((transcript) => {
    const transcriptSegments = segments.filter(
      (segment) => segment.transcriptId === transcript.id,
    );
    const transcriptReviews = reviews.filter(
      (review) => review.transcriptId === transcript.id,
    );
    const activePhraseInboxCount = inboxItems.filter(
      (item) => item.transcriptId === transcript.id,
    ).length;
    const reviewProgress = sessionReviewProgressFor(
      transcriptSegments.length,
      transcriptReviews.map((review) => review.disposition),
      activePhraseInboxCount,
    );
    const workflowStatus =
      reviewProgress.unresolved === 0
        ? activePhraseInboxCount > 0
          ? "child_phrase_inbox"
          : "session_summary"
        : reviewProgress.reviewed > 0
          ? "child_language_review_in_progress"
          : "child_language_review_not_started";
    return {
      transcriptId: transcript.id,
      childId: transcript.childId,
      childName: childNameById.get(transcript.childId) ?? "Assigned child",
      sessionDate: transcript.createdAt.toISOString(),
      workflowStatus,
      reviewProgress: {
        ...reviewProgress,
        phraseCandidates: phraseRows.filter(
          (phrase) => phrase.transcriptId === transcript.id,
        ).length,
      },
      activePhraseInboxCount,
    };
  });

  return res.json(
    GetSessionsDashboardResponse.parse({
      requiresReview,
      completedSessions: completedSessions.map((session) => ({
        sessionId: session.id,
        childId: session.childId,
        childName: childNameById.get(session.childId) ?? "Assigned child",
        sessionDate: session.createdAt.toISOString(),
      })),
      draftDocumentation: [
        ...documentationDrafts
          .filter((document) => document.status === "draft")
          .map((document) => ({
            id: document.id,
            noteType: "document" as const,
            childId: document.childId,
            childName: childNameById.get(document.childId) ?? "Assigned child",
            title: document.title,
            updatedAt: document.updatedAt.toISOString(),
          })),
        ...soapDrafts
          .filter((note) => note.status === "draft")
          .map((note) => ({
            id: note.id,
            noteType: "soap_note" as const,
            childId: note.childId,
            childName: childNameById.get(note.childId) ?? "Assigned child",
            title: `SOAP Note · ${childNameById.get(note.childId) ?? "Assigned child"}`,
            updatedAt: note.updatedAt.toISOString(),
          })),
      ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      weeklySnapshot: {
        weekStart: weekStart.toISOString().slice(0, 10),
        sessionsRecorded: completedSessions.filter(
          (session) => session.createdAt >= weekStart,
        ).length,
        awaitingReview: requiresReview.length,
        draftNotes:
          documentationDrafts.filter((document) => document.status === "draft")
            .length +
          soapDrafts.filter((note) => note.status === "draft").length,
        completedNotes:
          documentationDrafts.filter(
            (document) =>
              document.status === "finalized" &&
              document.updatedAt >= weekStart,
          ).length +
          soapDrafts.filter(
            (note) =>
              note.status === "finalized" && note.updatedAt >= weekStart,
          ).length,
      },
    }),
  );
});

router.get("/sessions/unclear-vocalizations", async (req, res) => {
  const parsed = ListUnclearVocalizationsQueryParams.safeParse(req.query);
  if (!parsed.success) return fail(res, "A child is required.");
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (!canUseClinicalTools(actor) || !actor?.organizationId) {
    if (actor) {
      await writeSecurityAudit({
        actor,
        action: "CLINICAL_ACCESS_DENIED",
        targetType: "unclear_vocalization_review",
        childId: parsed.data.childId,
        outcome: "failure",
      });
    }
    return res
      .status(403)
      .json({ error: "Only an SLP can review unclear vocalizations." });
  }
  return res.json(
    await unclearVocalizationReviewFor(
      parsed.data.childId,
      actor.organizationId,
    ),
  );
});

router.patch("/sessions/unclear-vocalizations/labels", async (req, res) => {
  const query = UpdateUnclearVocalizationLabelQueryParams.safeParse(req.query);
  const body = UpdateUnclearVocalizationLabelBody.safeParse(req.body);
  if (!query.success || !body.success) {
    return fail(
      res,
      "Choose one or more unclear vocalizations and enter a label up to 120 characters.",
    );
  }
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!canUseClinicalTools(actor) || !actor?.organizationId) {
    if (actor) {
      await writeSecurityAudit({
        actor,
        action: "CLINICAL_ACCESS_DENIED",
        targetType: "unclear_vocalization_label",
        childId: query.data.childId,
        outcome: "failure",
      });
    }
    return res
      .status(403)
      .json({ error: "Only an SLP can label unclear vocalizations." });
  }

  const occurrenceBySegmentId = new Map(
    body.data.occurrences.map((occurrence) => [
      occurrence.segmentId,
      occurrence,
    ]),
  );
  if (occurrenceBySegmentId.size !== body.data.occurrences.length) {
    return fail(
      res,
      "Each unclear vocalization can appear only once in a label update.",
    );
  }
  const segmentIds = [...occurrenceBySegmentId.keys()];
  const label = body.data.label?.trim() || null;
  const sessions = await db
    .select({ id: therapySessionsTable.id })
    .from(therapySessionsTable)
    .where(
      and(
        eq(therapySessionsTable.organizationId, actor.organizationId),
        eq(therapySessionsTable.childId, query.data.childId),
        isNull(therapySessionsTable.archivedAt),
      ),
    );
  const sessionIds = sessions.map((session) => session.id);
  const transcripts = sessionIds.length
    ? await db
        .select()
        .from(sessionTranscriptsTable)
        .where(
          and(
            eq(sessionTranscriptsTable.childId, query.data.childId),
            inArray(sessionTranscriptsTable.sessionId, sessionIds),
            eq(sessionTranscriptsTable.status, "complete"),
          ),
        )
    : [];
  const transcriptIds = transcripts.map((transcript) => transcript.id);
  const segments = transcriptIds.length
    ? await db
        .select()
        .from(transcriptSpeakerSegmentsTable)
        .where(
          and(
            inArray(transcriptSpeakerSegmentsTable.id, segmentIds),
            inArray(transcriptSpeakerSegmentsTable.transcriptId, transcriptIds),
            or(
              eq(
                transcriptSpeakerSegmentsTable.intelligibility,
                "partially_intelligible",
              ),
              eq(
                transcriptSpeakerSegmentsTable.intelligibility,
                "unintelligible",
              ),
            ),
          ),
        )
    : [];
  const roles = transcriptIds.length
    ? await db
        .select()
        .from(transcriptSpeakerRolesTable)
        .where(inArray(transcriptSpeakerRolesTable.transcriptId, transcriptIds))
    : [];
  const childRoleKeys = new Set(
    roles
      .filter((role) => normalizedSpeakerRole(role.role) === "child")
      .map((role) => `${role.transcriptId}:${role.speakerLabel}`),
  );
  const eligibleSegments = segments.filter((segment) =>
    childRoleKeys.has(`${segment.transcriptId}:${segment.speakerLabel}`),
  );
  if (eligibleSegments.length !== segmentIds.length) {
    return fail(
      res,
      "Every selected item must be preserved unclear speech from this child’s saved sessions.",
    );
  }

  try {
    await db.transaction(async (transaction) => {
      for (const segment of eligibleSegments) {
        const expectedRevision =
          occurrenceBySegmentId.get(segment.id)?.expectedRevision ?? null;
        const updatedAt = new Date();
        if (expectedRevision === null) {
          const inserted = await transaction
            .insert(transcriptChildUtteranceReviewsTable)
            .values({
              transcriptId: segment.transcriptId,
              segmentId: segment.id,
              disposition:
                segment.intelligibility === "unintelligible"
                  ? "unlabeled"
                  : "pending",
              intelligibilityReviewStatus:
                segment.intelligibility === "unintelligible"
                  ? "unlabeled"
                  : "pending",
              crossSessionLabel: label,
              reviewedByUserId: actor.userId,
              updatedAt,
            })
            .onConflictDoNothing()
            .returning({ id: transcriptChildUtteranceReviewsTable.id });
          if (!inserted.length)
            throw new Error("UNCLEAR_VOCALIZATION_LABEL_CONFLICT");
          continue;
        }
        const updated = await transaction
          .update(transcriptChildUtteranceReviewsTable)
          .set({
            crossSessionLabel: label,
            reviewedByUserId: actor.userId,
            updatedAt,
          })
          .where(
            and(
              eq(
                transcriptChildUtteranceReviewsTable.transcriptId,
                segment.transcriptId,
              ),
              eq(transcriptChildUtteranceReviewsTable.segmentId, segment.id),
              eq(
                transcriptChildUtteranceReviewsTable.updatedAt,
                expectedRevision,
              ),
            ),
          )
          .returning({ id: transcriptChildUtteranceReviewsTable.id });
        if (!updated.length)
          throw new Error("UNCLEAR_VOCALIZATION_LABEL_CONFLICT");
      }
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "UNCLEAR_VOCALIZATION_LABEL_CONFLICT"
    ) {
      return res.status(409).json({
        error:
          "These vocalizations changed after you opened them. Review the refreshed labels before saving again.",
        review: await unclearVocalizationReviewFor(
          query.data.childId,
          actor.organizationId,
        ),
      });
    }
    throw error;
  }
  await writeSecurityAudit({
    actor,
    action: "UNCLEAR_VOCALIZATION_LABEL_UPDATED",
    targetType: "unclear_vocalization_review",
    childId: query.data.childId,
    metadata: {
      segmentCount: segmentIds.length,
      labelApplied: Boolean(label),
    },
  });
  return res.json(
    await unclearVocalizationReviewFor(
      query.data.childId,
      actor.organizationId,
    ),
  );
});

router.get("/sessions/audio/limits", async (_req, res) => {
  return res.json({
    maxAudioUploadBytes: runtimeConfig.recording.maxAudioUploadBytes,
    maxVideoUploadBytes: runtimeConfig.recording.maxVideoUploadBytes,
    maxProviderBytes: runtimeConfig.recording.maxProviderBytes,
    supportedContentTypes: [
      "audio/webm",
      "audio/mp4",
      "audio/ogg",
      "audio/mpeg",
      "audio/wav",
      "audio/x-m4a",
      "video/webm",
      "video/mp4",
      "video/quicktime",
    ],
  });
});

type CalibrationMediaDetails = {
  sourceContainer: string | null;
  sourceAudioCodec: string | null;
  sourceFileExtension: string;
  storageObjectExtension: string;
  durationConversion: "not_required" | "webm_to_wav" | "failed";
  durationParsingError: string | null;
};

const calibrationFileExtension = (contentType: string) =>
  ({
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-m4a": "m4a",
  })[contentType] ?? "bin";

const storageObjectExtension = (objectKey: string) => {
  const extension = path.extname(objectKey).replace(/^\./, "").toLowerCase();
  return extension || "none";
};

const safeProbeText = (value: unknown) =>
  typeof value === "string" && value.length <= 80 ? value : null;

const calibrationProbeDetails = async (filePath: string) => {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=format_name,duration:stream=codec_name,codec_type",
      "-of",
      "json",
      filePath,
    ],
    { timeout: 15_000, maxBuffer: 16 * 1024 },
  );
  const parsed = JSON.parse(stdout) as {
    format?: { format_name?: unknown; duration?: unknown };
    streams?: Array<{ codec_name?: unknown; codec_type?: unknown }>;
  };
  const duration = Number(parsed.format?.duration);
  const audioStream = parsed.streams?.find(
    (stream) => stream.codec_type === "audio",
  );
  return {
    durationSeconds: Number.isFinite(duration) ? duration : null,
    sourceContainer: safeProbeText(parsed.format?.format_name),
    sourceAudioCodec: safeProbeText(audioStream?.codec_name),
  };
};

const missingCalibrationDurationFailure = (): CalibrationFailureDetail => ({
  stage: "duration_probe",
  code: "CALIBRATION_DURATION_UNVERIFIED",
  message:
    "The server could read the uploaded audio but it did not contain a usable duration value.",
  failureKind: "verification_failed",
});

const calibrationDurationMilliseconds = async (
  audio: typeof sessionAudioObjectsTable.$inferSelect,
) => {
  const sourceExtension = calibrationFileExtension(audio.contentType);
  const filePath = path.join(
    tmpdir(),
    `echomap-calibration-${randomUUID()}.${sourceExtension}`,
  );
  const wavPath = `${filePath}.wav`;
  const startedAt = Date.now();
  let media: CalibrationMediaDetails = {
    sourceContainer: null,
    sourceAudioCodec: null,
    sourceFileExtension: sourceExtension,
    storageObjectExtension: storageObjectExtension(audio.objectKey),
    durationConversion: "not_required",
    durationParsingError: null,
  };
  try {
    const bytes = await persistedAudioObjectStore(audio).get(audio.objectKey);
    if (!bytes.length)
      throw new Error("The stored calibration object was empty.");
    await writeFile(filePath, bytes, { mode: 0o600 });
    const source = await calibrationProbeDetails(filePath);
    media = {
      ...media,
      sourceContainer: source.sourceContainer,
      sourceAudioCodec: source.sourceAudioCodec,
    };
    if (source.durationSeconds !== null) {
      return {
        status: "verified" as const,
        durationMilliseconds: Math.round(source.durationSeconds * 1_000),
        elapsedMilliseconds: Date.now() - startedAt,
        media,
      };
    }
    if (
      needsWebmDurationConversion(
        audio.contentType,
        source.sourceContainer,
        source.durationSeconds,
      )
    ) {
      media = {
        ...media,
        durationConversion: "webm_to_wav",
        durationParsingError: "WEBM_DURATION_METADATA_MISSING",
      };
      await execFileAsync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-i",
          filePath,
          "-map",
          "0:a:0",
          "-ac",
          "1",
          "-ar",
          "48000",
          "-f",
          "wav",
          wavPath,
        ],
        { timeout: 15_000, maxBuffer: 16 * 1024 },
      );
      const converted = await calibrationProbeDetails(wavPath);
      if (converted.durationSeconds !== null) {
        return {
          status: "verified" as const,
          durationMilliseconds: Math.round(converted.durationSeconds * 1_000),
          elapsedMilliseconds: Date.now() - startedAt,
          media,
        };
      }
      media = {
        ...media,
        durationParsingError: "CONVERTED_WAV_DURATION_MISSING",
      };
    }
    return {
      status: "failed" as const,
      elapsedMilliseconds: Date.now() - startedAt,
      failure: missingCalibrationDurationFailure(),
      media,
    };
  } catch (error) {
    media = {
      ...media,
      durationConversion:
        media.durationConversion === "webm_to_wav"
          ? "failed"
          : media.durationConversion,
      durationParsingError: media.durationParsingError ?? "MEDIA_PROBE_FAILED",
    };
    return {
      status: "failed" as const,
      elapsedMilliseconds: Date.now() - startedAt,
      failure: classifyCalibrationProbeFailure(error),
      media,
    };
  } finally {
    await Promise.all([
      rm(filePath, { force: true }),
      rm(wavPath, { force: true }),
    ]).catch(() => undefined);
  }
};

const calibrationDiagnostics = (
  audio: typeof sessionAudioObjectsTable.$inferSelect,
  input: {
    stage:
      | "capture"
      | "upload_reservation"
      | "private_upload"
      | "duration_probe"
      | "finalization"
      | "database_save";
    uploadStatus:
      "not_started" | "reserved" | "uploaded" | "finalized" | "failed";
    serverDurationMilliseconds?: number | null;
    verificationStatus: "not_run" | "passed" | "failed";
    failure?: CalibrationFailureDetail;
    media?: CalibrationMediaDetails;
  },
) => ({
  recordedDurationMilliseconds: audio.durationMilliseconds,
  serverDurationMilliseconds: input.serverDurationMilliseconds ?? null,
  fileSizeBytes: audio.sizeBytes,
  contentType: audio.contentType,
  sourceContainer: input.media?.sourceContainer ?? null,
  sourceAudioCodec: input.media?.sourceAudioCodec ?? null,
  sourceFileExtension:
    input.media?.sourceFileExtension ??
    calibrationFileExtension(audio.contentType),
  storageObjectExtension:
    input.media?.storageObjectExtension ??
    storageObjectExtension(audio.objectKey),
  durationConversion: input.media?.durationConversion ?? "not_required",
  durationParsingError: input.media?.durationParsingError ?? null,
  uploadStatus: input.uploadStatus,
  voiceProfileStatus: "not_started" as const,
  verificationStatus: input.verificationStatus,
  stage: input.stage,
  ...(input.failure
    ? {
        errorCode: input.failure.code,
        errorMessage: input.failure.message,
      }
    : {}),
});

router.post("/sessions/preparation", async (req, res) => {
  const parsed = PrepareSessionRecordingBody.safeParse(req.body);
  if (!parsed.success)
    return fail(
      res,
      "A child is required to prepare a private session recording.",
    );
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res
      .status(401)
      .json({ error: "Please sign in to prepare a private recording." });
  if (!canUseClinicalTools(actor))
    return res
      .status(403)
      .json({ error: "Only an SLP can prepare a therapy recording." });
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const [preparation] = await db
    .insert(sessionRecordingPreparationsTable)
    .values({
      id: randomUUID(),
      organizationId: actor.organizationId,
      childId: parsed.data.childId,
      createdByUserId: actor.userId,
      expiresAt,
    })
    .returning();
  await writeSecurityAudit({
    actor,
    action: "SESSION_RECORDING_PREPARED",
    targetType: "session_preparation",
    targetId: preparation!.id,
    childId: parsed.data.childId,
  });
  return res
    .status(201)
    .json({
      id: preparation!.id,
      childId: preparation!.childId,
      expiresAt: preparation!.expiresAt,
      status: preparation!.status,
    });
});

router.post("/sessions/audio/upload-url", async (req, res) => {
  const parsed = RequestSessionAudioUploadBody.safeParse(req.body);
  if (!parsed.success)
    return fail(res, "Please provide recording details before uploading.");
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res
      .status(401)
      .json({ error: "Please sign in to upload a private recording." });
  if (!canUseClinicalTools(actor))
    return res
      .status(403)
      .json({ error: "Only an SLP can upload a therapy recording." });
  if (!parsed.data.consentConfirmed)
    return fail(
      res,
      "Consent confirmation is required before uploading therapy audio.",
    );
  const consentConfirmedAt = new Date(parsed.data.consentConfirmedAt);
  if (
    Number.isNaN(consentConfirmedAt.getTime()) ||
    consentConfirmedAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    return fail(res, "Consent confirmation must include a valid timestamp.");
  }
  const contentType = normalizeRecordingUploadContentType(
    parsed.data.contentType,
  );
  if (!contentType) return fail(res, "This recording format is not supported.");
  const purpose = parsed.data.purpose ?? "session_recording";
  const calibrationRole = parsed.data.calibrationRole ?? null;
  const durationMilliseconds = parsed.data.durationMilliseconds ?? null;
  if (purpose === "speaker_calibration") {
    if (
      (calibrationRole !== "clinician" && calibrationRole !== "caregiver") ||
      durationMilliseconds === null
    ) {
      return fail(
        res,
        "A calibration recording needs a speaker role and a 5–10 second duration.",
      );
    }
  } else if (calibrationRole !== null || durationMilliseconds !== null) {
    return fail(
      res,
      "Only a speaker calibration can include a role or calibration duration.",
    );
  }
  if (!parsed.data.preparationId)
    return fail(
      res,
      "Prepare the session before recording calibration or therapy audio.",
    );
  const [preparation] = await db
    .select()
    .from(sessionRecordingPreparationsTable)
    .where(
      and(
        eq(sessionRecordingPreparationsTable.id, parsed.data.preparationId),
        eq(
          sessionRecordingPreparationsTable.organizationId,
          actor.organizationId,
        ),
        eq(sessionRecordingPreparationsTable.childId, parsed.data.childId),
        eq(sessionRecordingPreparationsTable.createdByUserId, actor.userId),
      ),
    )
    .limit(1);
  if (
    !preparation ||
    preparation.expiresAt <= new Date() ||
    ["revoked", "expired", "completed"].includes(preparation.status)
  ) {
    return fail(
      res,
      "This recording preparation has expired. Start a new session preparation.",
    );
  }
  const uploadLimit = contentType.startsWith("video/")
    ? runtimeConfig.recording.maxVideoUploadBytes
    : runtimeConfig.recording.maxAudioUploadBytes;
  if (parsed.data.sizeBytes > uploadLimit) {
    return res.status(400).json({
      error: "This recording is larger than the current private upload limit.",
      code: "RECORDING_TOO_LARGE",
    });
  }
  try {
    const storageDriver = runtimeConfig.audioStorage.driver;
    const reservation = await recordingObjectStorage.reserveUpload(
      actor.organizationId,
      contentType,
    );
    await db.insert(sessionAudioObjectsTable).values({
      id: reservation.audioId,
      organizationId: actor.organizationId,
      childId: parsed.data.childId,
      preparationId: preparation.id,
      purpose,
      calibrationRole,
      durationMilliseconds,
      storageDriver,
      objectKey: reservation.objectPath,
      contentType,
      sizeBytes: parsed.data.sizeBytes,
      uploadedByUserId: actor.userId,
      consentConfirmedAt,
      consentConfirmedByUserId: actor.userId,
    });
    await writeSecurityAudit({
      actor,
      action: "RECORDING_UPLOAD_URL_ISSUED",
      targetType: "recording",
      targetId: reservation.audioId,
      childId: parsed.data.childId,
      metadata: {
        contentType,
        sizeBytes: parsed.data.sizeBytes,
        storageDriver,
        purpose,
        ...(calibrationRole ? { calibrationRole, durationMilliseconds } : {}),
      },
    });
    return res
      .status(201)
      .json({ ...reservation, contentType, sizeBytes: parsed.data.sizeBytes });
  } catch {
    return res.status(503).json({
      error:
        "We could not securely prepare the recording upload. Please try again.",
      code: "RECORDING_UPLOAD_INCOMPLETE",
    });
  }
});

router.post("/sessions/calibration/complete", async (req, res) => {
  const parsed = CompleteSessionCalibrationBody.safeParse(req.body);
  if (!parsed.success)
    return fail(res, "A 5–10 second calibration recording is required.");
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId)
    return res
      .status(401)
      .json({
        error: "Please sign in to save a private calibration recording.",
      });
  if (!canUseClinicalTools(actor))
    return res
      .status(403)
      .json({
        error: "Only an SLP can prepare a therapy-session calibration.",
      });
  const [audio] = await db
    .select()
    .from(sessionAudioObjectsTable)
    .where(
      and(
        eq(sessionAudioObjectsTable.id, parsed.data.audioId),
        eq(sessionAudioObjectsTable.organizationId, actor.organizationId),
        eq(sessionAudioObjectsTable.childId, parsed.data.childId),
        eq(sessionAudioObjectsTable.uploadedByUserId, actor.userId),
        eq(sessionAudioObjectsTable.purpose, "speaker_calibration"),
        eq(sessionAudioObjectsTable.status, "staged"),
        isNull(sessionAudioObjectsTable.sessionId),
        isNull(sessionAudioObjectsTable.deletedAt),
      ),
    )
    .limit(1);
  if (
    !audio ||
    (audio.calibrationRole !== "clinician" &&
      audio.calibrationRole !== "caregiver")
  ) {
    return res
      .status(404)
      .json({
        error:
          "The calibration recording is unavailable. Please record it again.",
      });
  }
  if (audio.durationMilliseconds !== parsed.data.durationMilliseconds) {
    return fail(
      res,
      "The calibration duration changed. Please record a new 5–10 second reference.",
    );
  }
  const durationProbe = await calibrationDurationMilliseconds(audio);
  logger.info(
    {
      calibrationId: audio.id,
      calibrationRole: audio.calibrationRole,
      contentType: audio.contentType,
      sizeBytes: audio.sizeBytes,
      recordedDurationMilliseconds: audio.durationMilliseconds,
      durationProbeStatus: durationProbe.status,
      durationProbeElapsedMilliseconds: durationProbe.elapsedMilliseconds,
      sourceContainer: durationProbe.media.sourceContainer,
      sourceAudioCodec: durationProbe.media.sourceAudioCodec,
      sourceFileExtension: durationProbe.media.sourceFileExtension,
      storageObjectExtension: durationProbe.media.storageObjectExtension,
      durationConversion: durationProbe.media.durationConversion,
      durationParsingError: durationProbe.media.durationParsingError,
      ...(durationProbe.status === "verified"
        ? { detectedDurationMilliseconds: durationProbe.durationMilliseconds }
        : {
            diagnosticStage: durationProbe.failure.stage,
            diagnosticCode: durationProbe.failure.code,
            diagnosticFailureKind: durationProbe.failure.failureKind,
          }),
    },
    "Calibration duration verification completed",
  );
  if (durationProbe.status === "failed") {
    const diagnostics = calibrationDiagnostics(audio, {
      stage: durationProbe.failure.stage,
      uploadStatus: "uploaded",
      verificationStatus: "failed",
      failure: durationProbe.failure,
      media: durationProbe.media,
    });
    return res.status(400).json({
      error: durationProbe.failure.message,
      code: durationProbe.failure.code,
      diagnostics,
    });
  }
  if (
    durationProbe.durationMilliseconds < 5_000 ||
    durationProbe.durationMilliseconds > 10_000
  ) {
    const failure: CalibrationFailureDetail = {
      stage: "duration_probe",
      code: "CALIBRATION_DURATION_UNVERIFIED",
      message: `The uploaded audio duration was ${(durationProbe.durationMilliseconds / 1_000).toFixed(2)} seconds; calibration recordings must be 5–10 seconds.`,
      failureKind: "verification_failed",
    };
    const diagnostics = calibrationDiagnostics(audio, {
      stage: "duration_probe",
      uploadStatus: "uploaded",
      serverDurationMilliseconds: durationProbe.durationMilliseconds,
      verificationStatus: "failed",
      failure,
      media: durationProbe.media,
    });
    return res
      .status(400)
      .json({ error: failure.message, code: failure.code, diagnostics });
  }
  try {
    const finalObjectPath = await recordingObjectStorage.finalizeExpectedObject(
      audio.objectKey,
      audio.contentType,
      audio.sizeBytes,
      "echomap/session-calibrations",
      `/objects/echomap/session-calibrations/final/${audio.id}`,
    );
    if (!finalObjectPath) {
      const failure = calibrationFinalizationFailure(
        new Error(
          "Finalization integrity check did not match the staged upload",
        ),
      );
      const diagnostics = calibrationDiagnostics(audio, {
        stage: failure.stage,
        uploadStatus: "failed",
        serverDurationMilliseconds: durationProbe.durationMilliseconds,
        verificationStatus: "passed",
        failure,
        media: durationProbe.media,
      });
      return res.status(400).json({
        error: failure.message,
        code: failure.code,
        diagnostics,
      });
    }
    const [ready] = await db
      .update(sessionAudioObjectsTable)
      .set({
        objectKey: finalObjectPath,
        status: "ready",
        durationMilliseconds: durationProbe.durationMilliseconds,
      })
      .where(
        and(
          eq(sessionAudioObjectsTable.id, audio.id),
          eq(sessionAudioObjectsTable.status, "staged"),
          isNull(sessionAudioObjectsTable.sessionId),
        ),
      )
      .returning();
    if (!ready) {
      const failure = calibrationDatabaseSaveFailure(
        new Error("Calibration row update returned no ready record"),
      );
      const diagnostics = calibrationDiagnostics(audio, {
        stage: failure.stage,
        uploadStatus: "finalized",
        serverDurationMilliseconds: durationProbe.durationMilliseconds,
        verificationStatus: "passed",
        failure,
        media: durationProbe.media,
      });
      logger.warn(
        {
          calibrationId: audio.id,
          diagnosticStage: failure.stage,
          diagnosticCode: failure.code,
          diagnosticFailureKind: failure.failureKind,
        },
        "Calibration database state changed before completion",
      );
      return res
        .status(409)
        .json({ error: failure.message, code: failure.code, diagnostics });
    }
    if (ready.calibrationRole === "clinician" && ready.preparationId) {
      await db
        .update(sessionRecordingPreparationsTable)
        .set({ status: "ready" })
        .where(
          and(
            eq(sessionRecordingPreparationsTable.id, ready.preparationId),
            eq(sessionRecordingPreparationsTable.status, "active"),
          ),
        );
    }
    await writeSecurityAudit({
      actor,
      action: "SPEAKER_CALIBRATION_CAPTURED",
      targetType: "speaker_calibration",
      targetId: ready.id,
      childId: ready.childId,
      metadata: {
        calibrationRole: ready.calibrationRole,
        durationMilliseconds: durationProbe.durationMilliseconds,
        contentType: ready.contentType,
        sizeBytes: ready.sizeBytes,
      },
    });
    return res.json({
      audioId: ready.id,
      childId: ready.childId,
      role: ready.calibrationRole,
      durationMilliseconds: durationProbe.durationMilliseconds,
      status: "ready",
      diagnostics: calibrationDiagnostics(ready, {
        stage: "database_save",
        uploadStatus: "finalized",
        serverDurationMilliseconds: durationProbe.durationMilliseconds,
        verificationStatus: "passed",
        media: durationProbe.media,
      }),
    });
  } catch (error) {
    const failure = calibrationFinalizationFailure(error);
    const diagnostics = calibrationDiagnostics(audio, {
      stage: failure.stage,
      uploadStatus: "uploaded",
      serverDurationMilliseconds: durationProbe.durationMilliseconds,
      verificationStatus: "passed",
      failure,
      media: durationProbe.media,
    });
    logger.error(
      {
        calibrationId: audio.id,
        diagnosticStage: failure.stage,
        diagnosticCode: failure.code,
        diagnosticFailureKind: failure.failureKind,
      },
      "Calibration finalization failed",
    );
    return res.status(503).json({
      error: failure.message,
      code: failure.code,
      diagnostics,
    });
  }
});

router.delete("/sessions/calibration", async (req, res) => {
  const parsed = DeleteSessionCalibrationQueryParams.safeParse(req.query);
  if (!parsed.success)
    return fail(res, "A child and calibration reference are required.");
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId || !canUseClinicalTools(actor))
    return res
      .status(403)
      .json({ error: "Only an SLP can revoke a private calibration." });
  const [audio] = await db
    .select()
    .from(sessionAudioObjectsTable)
    .where(
      and(
        eq(sessionAudioObjectsTable.id, parsed.data.audioId),
        eq(sessionAudioObjectsTable.organizationId, actor.organizationId),
        eq(sessionAudioObjectsTable.childId, parsed.data.childId),
        eq(sessionAudioObjectsTable.uploadedByUserId, actor.userId),
        eq(sessionAudioObjectsTable.purpose, "speaker_calibration"),
        isNull(sessionAudioObjectsTable.sessionId),
        isNull(sessionAudioObjectsTable.deletedAt),
      ),
    )
    .limit(1);
  if (!audio)
    return res
      .status(404)
      .json({ error: "The calibration reference is unavailable." });
  await persistedAudioObjectStore(audio).delete(audio.objectKey);
  await db
    .update(sessionAudioObjectsTable)
    .set({ status: "deleted", deletedAt: new Date() })
    .where(eq(sessionAudioObjectsTable.id, audio.id));
  await writeSecurityAudit({
    actor,
    action: "SPEAKER_CALIBRATION_REVOKED",
    targetType: "speaker_calibration",
    targetId: audio.id,
    childId: audio.childId,
  });
  return res.status(204).end();
});

router.post("/sessions/audio", async (req, res) => {
  await ensureSessionStore();
  const parsed = RequestSessionAudioUploadBody.safeParse(req.body);
  if (!parsed.success)
    return fail(res, "Please provide a compatible audio recording.");
  if (!requireChildAccess(req, res, parsed.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor)
    return res
      .status(401)
      .json({ error: "Please sign in to upload a private recording." });
  if (!canUseClinicalTools(actor))
    return res
      .status(403)
      .json({ error: "Only an SLP can upload a therapy recording." });
  if ((parsed.data.purpose ?? "session_recording") !== "session_recording") {
    return fail(
      res,
      "Speaker calibration recordings must use the private upload flow.",
    );
  }
  if (!parsed.data.consentConfirmed) {
    return fail(
      res,
      "Consent confirmation is required before uploading therapy audio.",
    );
  }
  const consentConfirmedAt = new Date(parsed.data.consentConfirmedAt);
  if (
    Number.isNaN(consentConfirmedAt.getTime()) ||
    consentConfirmedAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    return fail(res, "Consent confirmation must include a valid timestamp.");
  }
  const { author } = actor;
  // MediaRecorder commonly includes codec parameters, e.g.
  // "audio/webm;codecs=opus". Some browsers identify WebM audio files as
  // video/webm, so retain that declared type for Data URL validation but store
  // the compatible audio/webm base type.
  const declaredContentType =
    parsed.data.contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  const contentType = normalizeRecordingContentType(parsed.data.contentType);
  if (!contentType) {
    req.log.warn(
      { childId: parsed.data.childId, contentType: declaredContentType },
      "Private recording upload rejected for unsupported format",
    );
    return fail(res, "This recording format is not supported.");
  }
  if (!parsed.data.data)
    return fail(res, "Please provide a compatible audio recording.");
  let data: Buffer;
  try {
    data = decodeUploadedRecording(parsed.data.data, declaredContentType);
  } catch (error) {
    const failure = safeTranscriptionFailure(error);
    req.log.warn(
      { childId: parsed.data.childId, code: failure.code, contentType },
      "Private recording upload rejected",
    );
    return fail(res, failure.message);
  }
  if (data.length > 30 * 1024 * 1024)
    return fail(res, "Recordings must be 30 MB or smaller.");
  const id = randomUUID();
  const extension =
    contentType.includes("mp4") || contentType.includes("m4a")
      ? "m4a"
      : contentType.includes("ogg")
        ? "ogg"
        : contentType.includes("mpeg")
          ? "mp3"
          : contentType.includes("wav")
            ? "wav"
            : "webm";
  const fileName = `${actor.organizationId ?? "development"}/audio/${id}.${extension}`;
  const storedAudio = await audioObjectStore.put({
    key: fileName,
    contentType,
    data,
  });
  const storedAudioMetadata = persistedAudioObjectMetadata(
    runtimeConfig.audioStorage.driver,
    storedAudio,
  );
  req.log.info(
    {
      audioId: id,
      childId: parsed.data.childId,
      contentType,
      sizeBytes: data.length,
    },
    "Private recording stored",
  );
  if (actor.organizationId) {
    try {
      await db.insert(sessionAudioObjectsTable).values({
        id,
        organizationId: actor.organizationId,
        childId: parsed.data.childId,
        purpose: "session_recording",
        ...storedAudioMetadata,
        contentType,
        sizeBytes: data.length,
        uploadedByUserId: actor.userId,
        consentConfirmedAt,
        consentConfirmedByUserId: actor.userId,
      });
      await writeSecurityAudit({
        actor,
        action: "RECORDING_UPLOADED",
        targetType: "recording",
        targetId: id,
        childId: parsed.data.childId,
        metadata: { contentType, sizeBytes: data.length },
      });
      return res
        .status(201)
        .json({ audioId: id, contentType, sizeBytes: data.length });
    } catch (error) {
      await audioObjectStore.delete(storedAudio.key);
      logger.error(
        { err: error, userId: actor.userId },
        "Could not create private audio metadata",
      );
      return res
        .status(500)
        .json({ error: "We could not securely register the recording." });
    }
  }
  const audio: AudioRecord = {
    id,
    fileName: storedAudio.key,
    contentType,
    sizeBytes: data.length,
    owner: author,
    childId: parsed.data.childId,
    consentConfirmedAt: consentConfirmedAt.toISOString(),
    consentConfirmedBy: author,
    sessionId: null,
    createdAt: now(),
  };
  sessionStore.audio.push(audio);
  await saveSessionStore();
  await writeSecurityAudit({
    actor,
    action: "RECORDING_UPLOADED",
    targetType: "recording",
    targetId: audio.id,
    childId: audio.childId,
    metadata: { contentType: audio.contentType, sizeBytes: audio.sizeBytes },
  });
  res
    .status(201)
    .json({
      audioId: audio.id,
      contentType: audio.contentType,
      sizeBytes: audio.sizeBytes,
    });
});

router.get("/sessions/transcription/draft", async (req, res) => {
  const query = GetSessionTranscriptionDraftQueryParams.safeParse(req.query);
  if (!query.success)
    return fail(res, "Select a child profile to reopen transcript review.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor || !canUseClinicalTools(actor) || !actor.organizationId) {
    return res
      .status(403)
      .json({ error: "Only an SLP can reopen transcript review." });
  }
  const [transcript] = await db
    .select()
    .from(sessionTranscriptsTable)
    .where(
      and(
        eq(sessionTranscriptsTable.childId, query.data.childId),
        eq(sessionTranscriptsTable.createdByUserId, actor.userId),
        eq(sessionTranscriptsTable.status, "complete"),
        isNull(sessionTranscriptsTable.sessionId),
        eq(sessionTranscriptsTable.id, query.data.transcriptId),
      ),
    )
    .orderBy(
      desc(sessionTranscriptsTable.updatedAt),
      desc(sessionTranscriptsTable.id),
    )
    .limit(1);
  if (!transcript)
    return res
      .status(404)
      .json({ error: "No unsaved transcript review was found." });
  return res.json(await transcriptResponse(transcript, actor.organizationId));
});

router.get("/sessions/transcription/:transcriptId/audio", async (req, res) => {
  const parsed = GetSessionTranscriptionAudioParams.safeParse(req.params);
  if (!parsed.success)
    return res.status(404).json({ error: "Recording not found." });
  const actor = viewerFrom(req);
  if (!actor || !canUseClinicalTools(actor) || !actor.organizationId) {
    return res
      .status(403)
      .json({ error: "Only an SLP can access private recordings." });
  }
  const [transcript] = await db
    .select()
    .from(sessionTranscriptsTable)
    .where(
      and(
        eq(sessionTranscriptsTable.id, parsed.data.transcriptId),
        eq(sessionTranscriptsTable.createdByUserId, actor.userId),
        isNull(sessionTranscriptsTable.sessionId),
      ),
    )
    .limit(1);
  if (!transcript || !requireChildAccess(req, res, transcript.childId)) {
    return res.status(404).json({ error: "Recording not found." });
  }
  const [audio] = await db
    .select()
    .from(sessionAudioObjectsTable)
    .where(
      and(
        eq(sessionAudioObjectsTable.id, transcript.audioId),
        eq(sessionAudioObjectsTable.organizationId, actor.organizationId),
        eq(sessionAudioObjectsTable.childId, transcript.childId),
        eq(sessionAudioObjectsTable.purpose, "session_recording"),
        isNull(sessionAudioObjectsTable.deletedAt),
      ),
    )
    .limit(1);
  if (!audio) return res.status(404).json({ error: "Recording not found." });
  try {
    const data = await persistedAudioObjectStore(audio).get(audio.objectKey);
    await writeSecurityAudit({
      actor,
      action: "RECORDING_ACCESSED",
      targetType: "recording",
      targetId: audio.id,
      childId: audio.childId,
    });
    res.setHeader("Content-Type", audio.contentType);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(data);
  } catch {
    return res.status(404).json({ error: "Recording not found." });
  }
});

router.post("/sessions/transcription", async (req, res) => {
  await ensureSessionStore();
  const query = TranscribeSessionAudioQueryParams.safeParse(req.query);
  const body = TranscribeSessionAudioBody.safeParse(req.body);
  if (!query.success || !body.success) {
    return fail(
      res,
      "A child and uploaded recording are required for transcription.",
    );
  }
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor) {
    return res
      .status(401)
      .json({ error: "Please sign in to transcribe a private recording." });
  }
  if (!actor.organizationId) {
    return res.status(401).json({ error: authenticationError(req) });
  }
  if (!canUseClinicalTools(actor)) {
    return res
      .status(403)
      .json({ error: "Only an SLP can transcribe a therapy recording." });
  }

  const productionAudio = actor.organizationId
    ? (
        await db
          .select()
          .from(sessionAudioObjectsTable)
          .where(
            and(
              eq(sessionAudioObjectsTable.id, body.data.audioId),
              eq(sessionAudioObjectsTable.organizationId, actor.organizationId),
              eq(sessionAudioObjectsTable.childId, query.data.childId),
              eq(sessionAudioObjectsTable.uploadedByUserId, actor.userId),
              eq(sessionAudioObjectsTable.purpose, "session_recording"),
              isNull(sessionAudioObjectsTable.deletedAt),
            ),
          )
          .limit(1)
      )[0]
    : null;
  const audio = productionAudio
    ? ({
        id: productionAudio.id,
        fileName: productionAudio.objectKey,
        contentType: productionAudio.contentType,
        sizeBytes: productionAudio.sizeBytes,
        owner: actor.author,
        childId: productionAudio.childId,
        consentConfirmedAt: productionAudio.consentConfirmedAt.toISOString(),
        consentConfirmedBy: actor.author,
        sessionId: productionAudio.sessionId,
        createdAt: productionAudio.createdAt.toISOString(),
      } satisfies AudioRecord)
    : sessionStore.audio.find(
        (entry) =>
          entry.id === body.data.audioId && entry.owner === actor.author,
      );
  if (!audio) {
    return res
      .status(404)
      .json({
        error: "The selected recording is unavailable. Please upload it again.",
      });
  }
  if (isManagedObjectStorageDriver(productionAudio?.storageDriver)) {
    const finalizedObjectPath =
      await recordingObjectStorage.finalizeExpectedObject(
        productionAudio.objectKey,
        productionAudio.contentType,
        productionAudio.sizeBytes,
      );
    if (!finalizedObjectPath) {
      return res.status(400).json({
        error:
          "The private recording upload was incomplete or changed. Please upload it again.",
        code: "RECORDING_UPLOAD_INCOMPLETE",
      });
    }
    if (finalizedObjectPath !== productionAudio.objectKey) {
      await db
        .update(sessionAudioObjectsTable)
        .set({ objectKey: finalizedObjectPath })
        .where(eq(sessionAudioObjectsTable.id, productionAudio.id));
      audio.fileName = finalizedObjectPath;
    }
  }
  if (
    audio.childId !== query.data.childId ||
    !audio.consentConfirmedAt ||
    audio.consentConfirmedBy !== actor.author
  ) {
    return fail(
      res,
      "Consent confirmation is required before processing therapy audio.",
    );
  }

  const existing = (
    await db
      .select()
      .from(sessionTranscriptsTable)
      .where(eq(sessionTranscriptsTable.audioId, audio.id))
      .limit(1)
  )[0];
  if (
    existing?.childId !== undefined &&
    existing.childId !== query.data.childId
  ) {
    return res
      .status(403)
      .json({ error: "This recording belongs to another child profile." });
  }
  if (existing?.status === "complete") {
    let transcriptToReturn = existing;
    const [existingProvisionalPhrase] = await db
      .select({ id: transcriptProvisionalPhrasesTable.id })
      .from(transcriptProvisionalPhrasesTable)
      .where(eq(transcriptProvisionalPhrasesTable.transcriptId, existing.id))
      .limit(1);
    if (!existingProvisionalPhrase && existing.rawTranscript.trim()) {
      await db.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(71991, ${existing.id})`,
        );
        const [concurrentPhrase] = await transaction
          .select({ id: transcriptProvisionalPhrasesTable.id })
          .from(transcriptProvisionalPhrasesTable)
          .where(
            eq(transcriptProvisionalPhrasesTable.transcriptId, existing.id),
          )
          .limit(1);
        if (!concurrentPhrase) {
          await rebuildProvisionalTranscriptPhrases(
            transaction,
            existing.id,
            existing.rawTranscript,
          );
        }
      });
    }
    const staleProcessing =
      existing.speakerSeparationStatus === "processing" &&
      existing.speakerSeparationStartedAt &&
      Date.now() - existing.speakerSeparationStartedAt.getTime() >
        2 * 60 * 1000;
    if (staleProcessing) {
      const [timedOutTranscript] = await db
        .update(sessionTranscriptsTable)
        .set({
          speakerSeparationStatus: "failed",
          speakerSeparationCompletedAt: new Date(),
          speakerSeparationFailureCode: "SPEAKER_GROUPING_TIMEOUT",
          speakerSeparationFailureMessage:
            "Speaker grouping did not finish in time. The transcript and provisional phrase review remain available.",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sessionTranscriptsTable.id, existing.id),
            eq(sessionTranscriptsTable.speakerSeparationStatus, "processing"),
          ),
        )
        .returning();
      if (timedOutTranscript) transcriptToReturn = timedOutTranscript;
    }
    if (
      body.data.retrySpeakerSeparation &&
      ["manual", "unavailable", "failed"].includes(
        transcriptToReturn.speakerSeparationStatus,
      )
    ) {
      if (await hasStartedManualTranscriptReview(transcriptToReturn.id)) {
        return res.status(409).json({
          error:
            "Manual Child-language review has started. Speaker grouping cannot be retried without discarding clinician decisions.",
        });
      }
      const [retryingTranscript] = await db
        .update(sessionTranscriptsTable)
        .set({
          speakerSeparationStatus: "pending",
          speakerSeparationCompletedAt: null,
          speakerSeparationFailureCode: null,
          speakerSeparationFailureMessage: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sessionTranscriptsTable.id, transcriptToReturn.id),
            inArray(sessionTranscriptsTable.speakerSeparationStatus, [
              "manual",
              "unavailable",
              "failed",
            ]),
          ),
        )
        .returning();
      if (retryingTranscript) transcriptToReturn = retryingTranscript;
    }
    res.json(
      await transcriptResponse(transcriptToReturn, actor.organizationId),
    );
    if (transcriptToReturn.speakerSeparationStatus === "pending") {
      void (
        productionAudio
          ? persistedAudioObjectStore(productionAudio)
          : audioObjectStore
      )
        .get(audio.fileName)
        .then((audioData) =>
          queueSpeakerSeparation(transcriptToReturn, audioData, req),
        )
        .catch(() => markSpeakerSeparationUnavailable(transcriptToReturn, req));
    }
    return;
  }

  const transcript =
    existing ??
    (
      await db
        .insert(sessionTranscriptsTable)
        .values({
          childId: query.data.childId,
          audioId: audio.id,
          createdBy: actor.author,
          createdByUserId: actor.userId,
          status: "processing",
          provider: `${TRANSCRIPTION_PROVIDER}:${TRANSCRIPTION_MODEL}`,
        })
        .returning()
    )[0];
  if (!transcript) {
    return res
      .status(500)
      .json({ error: "The transcript record could not be created." });
  }

  if (existing) {
    await db
      .update(sessionTranscriptsTable)
      .set({
        status: "processing",
        speakerSeparationStatus: "pending",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(sessionTranscriptsTable.id, transcript.id));
  }

  try {
    const audioData = await (productionAudio
      ? persistedAudioObjectStore(productionAudio).get(audio.fileName)
      : audioObjectStore.get(audio.fileName));
    const knownPhrases = [
      ...new Set(
        (
          await db
            .select({ phrase: clinicalGestaltsTable.phrase })
            .from(clinicalGestaltsTable)
            .where(
              and(
                eq(clinicalGestaltsTable.organizationId, actor.organizationId),
                eq(clinicalGestaltsTable.childId, query.data.childId),
                isNull(clinicalGestaltsTable.archivedAt),
              ),
            )
        )
          .map((gestalt) => gestalt.phrase.trim())
          .filter(Boolean),
      ),
    ].slice(0, 60);
    const phraseExamples = knownPhrases.reduce<string[]>((examples, phrase) => {
      const candidate = [...examples, phrase].join("; ");
      return candidate.length <= 1_000 ? [...examples, phrase] : examples;
    }, []);
    const phrasePrompt = phraseExamples.length
      ? `Use these child-specific phrase spellings when they are clearly spoken. Do not add phrases that are not audible: ${phraseExamples.join("; ")}`
      : undefined;
    req.log.info(
      {
        transcriptId: transcript.id,
        audioId: audio.id,
        childId: query.data.childId,
        contentType: audio.contentType,
        sizeBytes: audio.sizeBytes,
        provider: TRANSCRIPTION_PROVIDER,
        model: TRANSCRIPTION_MODEL,
      },
      "Session transcription started",
    );
    const result = await transcribeRecording(
      audioData,
      phrasePrompt,
      runtimeConfig.recording.maxProviderBytes,
    );
    let childUtterancesDetected = 0;
    const completedTranscript = await db.transaction(async (transaction) => {
      await transaction
        .delete(transcriptPhrasesTable)
        .where(eq(transcriptPhrasesTable.transcriptId, transcript.id));
      await transaction
        .delete(transcriptSpeakerSegmentsTable)
        .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id));
      await transaction
        .delete(transcriptSpeakerRolesTable)
        .where(eq(transcriptSpeakerRolesTable.transcriptId, transcript.id));
      await rebuildChildTranscriptPhrases(transaction, transcript, []);
      await rebuildProvisionalTranscriptPhrases(
        transaction,
        transcript.id,
        result.rawTranscript,
      );
      return (
        await transaction
          .update(sessionTranscriptsTable)
          .set({
            status: "complete",
            rawTranscript: result.rawTranscript,
            speakerSeparationStatus: "pending",
            speakerSeparationAttempt: 0,
            speakerSeparationStartedAt: null,
            speakerSeparationCompletedAt: null,
            speakerSeparationFailureCode: null,
            speakerSeparationFailureMessage: null,
            errorMessage: null,
            provider: `${TRANSCRIPTION_PROVIDER}:${TRANSCRIPTION_MODEL}`,
            updatedAt: new Date(),
          })
          .where(eq(sessionTranscriptsTable.id, transcript.id))
          .returning()
      )[0];
    });
    if (!completedTranscript) {
      throw new Error("The completed transcript could not be persisted.");
    }
    req.log.info(
      {
        transcriptId: transcript.id,
        audioId: audio.id,
        childId: query.data.childId,
        audioLengthSeconds: result.audioDurationSeconds,
        fileSizeBytes: audio.sizeBytes,
        transcriptReturned: Boolean(result.rawTranscript.trim()),
        transcriptCharacterCount: result.rawTranscript.length,
        speakersDetected: 0,
        childUtterancesDetected,
      },
      "Raw session transcript completed before optional speaker separation",
    );
    await writeSecurityAudit({
      actor,
      action: "RECORDING_TRANSCRIBED",
      targetType: "session_transcript",
      targetId: completedTranscript.id,
      childId: query.data.childId,
      metadata: { provider: completedTranscript.provider },
    });
    const response = await transcriptResponse(
      completedTranscript,
      actor.organizationId,
    );
    res.status(existing ? 200 : 201).json(response);
    void queueSpeakerSeparation(completedTranscript, audioData, req);
    return;
  } catch (error) {
    const failure = safeTranscriptionFailure(error);
    req.log.error(
      {
        transcriptId: transcript.id,
        audioId: audio.id,
        childId: query.data.childId,
        contentType: audio.contentType,
        sizeBytes: audio.sizeBytes,
        provider: TRANSCRIPTION_PROVIDER,
        model: TRANSCRIPTION_MODEL,
        code: failure.code,
      },
      "Session transcription failed",
    );
    await db
      .update(sessionTranscriptsTable)
      .set({
        status: "failed",
        errorMessage: failure.message,
        provider: `${TRANSCRIPTION_PROVIDER}:${TRANSCRIPTION_MODEL}`,
        updatedAt: new Date(),
      })
      .where(eq(sessionTranscriptsTable.id, transcript.id));
    return res.status(502).json({ error: failure.message, code: failure.code });
  }
});

router.post("/sessions/transcription/speakers", async (req, res) => {
  const query = UpdateTranscriptSpeakersQueryParams.safeParse(req.query);
  const body = UpdateTranscriptSpeakersBody.safeParse(req.body);
  if (!query.success || !body.success) {
    return fail(res, "A transcript and reviewed speaker roles are required.");
  }
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor || !canUseClinicalTools(actor)) {
    return res
      .status(403)
      .json({
        error: "Only an SLP can confirm speaker roles for therapy analysis.",
      });
  }
  const transcript = (
    await db
      .select()
      .from(sessionTranscriptsTable)
      .where(
        and(
          eq(sessionTranscriptsTable.id, body.data.transcriptId),
          eq(sessionTranscriptsTable.childId, query.data.childId),
        ),
      )
      .limit(1)
  )[0];
  if (!transcript || transcript.status !== "complete") {
    return res
      .status(404)
      .json({
        error: "The completed transcript is unavailable for speaker review.",
      });
  }
  const attachedAudio = (
    await db
      .select({ sessionId: sessionAudioObjectsTable.sessionId })
      .from(sessionAudioObjectsTable)
      .where(eq(sessionAudioObjectsTable.id, transcript.audioId))
      .limit(1)
  )[0];
  const assignments = body.data.speakers ?? [];
  const segmentGroups = body.data.segmentGroups ?? [];
  const forgetProfileIds = body.data.forgetProfileIds ?? [];
  const changesTranscriptAttribution =
    assignments.length > 0 || segmentGroups.length > 0;
  if (
    changesTranscriptAttribution &&
    (transcript.sessionId !== null || attachedAudio?.sessionId)
  ) {
    return fail(
      res,
      "Speaker assignments are locked after this transcript is saved. Start a corrected session so clinical evidence remains auditable.",
    );
  }
  if (
    !assignments.length &&
    !segmentGroups.length &&
    !forgetProfileIds.length
  ) {
    return fail(
      res,
      "Choose a speaker role, group a transcript turn, or remove a remembered profile.",
    );
  }
  if (
    assignments.some(
      (speaker) =>
        !speaker.label.trim() || !speakerRoleValues.has(speaker.role),
    )
  ) {
    return fail(res, "Choose a valid role for each detected speaker.");
  }
  if (
    new Set(assignments.map((speaker) => speaker.label.trim())).size !==
    assignments.length
  ) {
    return fail(res, "Each speaker can have only one role assignment.");
  }
  if (
    assignments.some(
      (speaker) =>
        speaker.rememberProfile &&
        (speaker.role === "unassigned" || speaker.role === "unknown"),
    )
  ) {
    return fail(
      res,
      "Choose a confirmed speaker role before remembering a profile.",
    );
  }
  if (
    new Set(forgetProfileIds).size !== forgetProfileIds.length ||
    forgetProfileIds.some((id) => !Number.isInteger(id) || id < 1)
  ) {
    return fail(res, "Choose valid remembered speaker profiles to remove.");
  }
  const initialSegments = await db
    .select()
    .from(transcriptSpeakerSegmentsTable)
    .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id));
  // Materialize the immutable, explainable review snapshot before a clinician
  // confirms or corrects it. This does not assign a transcript role.
  await persistSpeakerRoleInferences(transcript, actor.organizationId!);
  const segmentById = new Map(
    initialSegments.map((segment) => [segment.id, segment]),
  );
  const detectedSpeakerLabels = new Set(
    initialSegments.map((segment) => segment.speakerLabel),
  );
  if (
    !initialSegments.length ||
    new Set(segmentGroups.map((group) => group.segmentId)).size !==
      segmentGroups.length ||
    segmentGroups.some(
      (group) =>
        !segmentById.has(group.segmentId) ||
        !detectedSpeakerLabels.has(group.speakerLabel.trim()),
    )
  ) {
    return fail(
      res,
      "Each speaker correction must reference a current transcript turn and detected speaker group.",
    );
  }
  const existingRoles = await db
    .select()
    .from(transcriptSpeakerRolesTable)
    .where(eq(transcriptSpeakerRolesTable.transcriptId, transcript.id));
  const reviewedSegmentIds = new Set(
    segmentGroups.map((group) => group.segmentId),
  );
  const correctedLabelBySegmentId = new Map(
    segmentGroups.map((group) => [group.segmentId, group.speakerLabel.trim()]),
  );
  const pendingRoleByLabel = speakerRolesForTranscript(
    existingRoles,
    transcript.id,
  );
  for (const speaker of assignments) {
    pendingRoleByLabel.set(
      speaker.label.trim(),
      normalizedSpeakerRole(speaker.role),
    );
  }
  const projectedSpeakerLabels = new Set(
    initialSegments.map(
      (segment) =>
        correctedLabelBySegmentId.get(segment.id) ?? segment.speakerLabel,
    ),
  );
  const hasUnreviewedChildTurn =
    changesTranscriptAttribution &&
    projectedSpeakerLabels.size > 1 &&
    initialSegments.some((segment) => {
      const label =
        correctedLabelBySegmentId.get(segment.id) ?? segment.speakerLabel;
      const willBeReviewed =
        segment.speakerReviewed || reviewedSegmentIds.has(segment.id);
      return (
        pendingRoleByLabel.get(label) === "child" &&
        speakerConfidenceFrom(segment.speakerConfidence) !== "high" &&
        !willBeReviewed
      );
    });
  if (hasUnreviewedChildTurn) {
    return fail(
      res,
      "Confirm every below-threshold turn in a Child speaker cluster before EchoMap can create Child-only clinical evidence.",
    );
  }
  const projectedSegments = initialSegments.map((segment) => ({
    ...segment,
    speakerLabel:
      correctedLabelBySegmentId.get(segment.id) ?? segment.speakerLabel,
  }));
  for (const assignment of assignments.filter(
    (speaker) => speaker.rememberProfile,
  )) {
    const signatureHashes = new Set(
      projectedSegments
        .filter((segment) => segment.speakerLabel === assignment.label.trim())
        .map((segment) => segment.profileSignatureHash)
        .filter((hash): hash is string => Boolean(hash)),
    );
    if (signatureHashes.size !== 1) {
      return fail(
        res,
        "This speaker cannot be remembered yet because the current transcription provider did not return one stable reusable characteristic.",
      );
    }
  }

  await db.transaction(async (transaction) => {
    if (changesTranscriptAttribution) {
      const [editableTranscript] = await transaction
        .update(sessionTranscriptsTable)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(sessionTranscriptsTable.id, transcript.id),
            isNull(sessionTranscriptsTable.sessionId),
          ),
        )
        .returning({ id: sessionTranscriptsTable.id });
      if (!editableTranscript) {
        throw new Error(
          "Speaker assignments are locked after this transcript is saved.",
        );
      }
    }
    if (forgetProfileIds.length) {
      await transaction
        .update(childSpeakerProfilesTable)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            inArray(childSpeakerProfilesTable.id, forgetProfileIds),
            eq(childSpeakerProfilesTable.childId, query.data.childId),
            eq(childSpeakerProfilesTable.organizationId, actor.organizationId!),
            isNull(childSpeakerProfilesTable.archivedAt),
          ),
        );
    }
    for (const group of segmentGroups) {
      await transaction
        .update(transcriptSpeakerSegmentsTable)
        .set({ speakerLabel: group.speakerLabel.trim(), speakerReviewed: true })
        .where(
          and(
            eq(transcriptSpeakerSegmentsTable.id, group.segmentId),
            eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id),
          ),
        );
    }
    const segments = await transaction
      .select()
      .from(transcriptSpeakerSegmentsTable)
      .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id));
    const knownLabels = new Set(
      segments.map((segment) => segment.speakerLabel),
    );
    if (
      !segments.length ||
      assignments.some((speaker) => !knownLabels.has(speaker.label))
    ) {
      throw new Error(
        "Speaker assignments must match the detected transcript speakers.",
      );
    }
    for (const speaker of assignments) {
      await transaction
        .insert(transcriptSpeakerRolesTable)
        .values({
          transcriptId: transcript.id,
          speakerLabel: speaker.label,
          role: normalizedSpeakerRole(speaker.role),
        })
        .onConflictDoUpdate({
          target: [
            transcriptSpeakerRolesTable.transcriptId,
            transcriptSpeakerRolesTable.speakerLabel,
          ],
          set: { role: speaker.role, updatedAt: new Date() },
        });
    }
    for (const speaker of assignments) {
      const confirmedRole = normalizedSpeakerRole(speaker.role);
      const currentInference = (
        await transaction
          .select()
          .from(transcriptSpeakerRoleInferencesTable)
          .where(
            and(
              eq(
                transcriptSpeakerRoleInferencesTable.transcriptId,
                transcript.id,
              ),
              eq(
                transcriptSpeakerRoleInferencesTable.speakerLabel,
                speaker.label.trim(),
              ),
            ),
          )
          .limit(1)
      )[0];
      if (currentInference) {
        await transaction
          .update(transcriptSpeakerRoleInferencesTable)
          .set({
            state: "confirmed",
            confirmedRole,
            confirmedByUserId: actor.userId,
            confirmedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            eq(transcriptSpeakerRoleInferencesTable.id, currentInference.id),
          );
      }
      if (confirmedRole !== "unassigned" && confirmedRole !== "unknown") {
        await transaction
          .insert(childSpeakerRoleLearningAggregatesTable)
          .values({
            organizationId: actor.organizationId!,
            childId: query.data.childId,
            role: confirmedRole,
            featureKey: "confirmed_role",
            confirmedCount: 1,
            modelVersion: SPEAKER_ROLE_MODEL_VERSION,
          })
          .onConflictDoUpdate({
            target: [
              childSpeakerRoleLearningAggregatesTable.organizationId,
              childSpeakerRoleLearningAggregatesTable.childId,
              childSpeakerRoleLearningAggregatesTable.role,
              childSpeakerRoleLearningAggregatesTable.featureKey,
            ],
            set: {
              confirmedCount: sql`LEAST(${childSpeakerRoleLearningAggregatesTable.confirmedCount} + 1, 20)`,
              updatedAt: new Date(),
            },
          });
      }
    }
    for (const speaker of assignments.filter(
      (assignment) => assignment.rememberProfile,
    )) {
      const signatureHash = [
        ...new Set(
          segments
            .filter((segment) => segment.speakerLabel === speaker.label.trim())
            .map((segment) => segment.profileSignatureHash)
            .filter((hash): hash is string => Boolean(hash)),
        ),
      ][0];
      if (!signatureHash) continue;
      const confidenceScores = segments
        .filter((segment) => segment.speakerLabel === speaker.label.trim())
        .map((segment) =>
          speakerConfidenceScoreFrom(segment.speakerConfidenceScore),
        )
        .filter((score): score is number => score !== null);
      const score = confidenceScores.length
        ? Math.min(...confidenceScores)
        : null;
      await transaction
        .insert(childSpeakerProfilesTable)
        .values({
          organizationId: actor.organizationId!,
          childId: query.data.childId,
          profileSignatureHash: signatureHash,
          role: normalizedSpeakerRole(speaker.role),
          confidenceScore: score,
          createdByUserId: actor.userId,
          reviewedAt: new Date(),
          archivedAt: null,
        })
        .onConflictDoUpdate({
          target: [
            childSpeakerProfilesTable.childId,
            childSpeakerProfilesTable.profileSignatureHash,
          ],
          set: {
            organizationId: actor.organizationId!,
            role: normalizedSpeakerRole(speaker.role),
            confidenceScore: score,
            createdByUserId: actor.userId,
            reviewedAt: new Date(),
            archivedAt: null,
            updatedAt: new Date(),
          },
        });
    }
    const roles = await transaction
      .select()
      .from(transcriptSpeakerRolesTable)
      .where(eq(transcriptSpeakerRolesTable.transcriptId, transcript.id));
    if (changesTranscriptAttribution) {
      // Utterance classifications are explicit segment-level clinician
      // decisions and remain valid when optional speaker guidance changes.
      await rebuildConfirmedChildTranscriptPhrases(transaction, transcript);
      await refreshChildPhraseInboxPointers(transaction, transcript.id);
    }
  });
  const refreshed = (
    await db
      .select()
      .from(sessionTranscriptsTable)
      .where(eq(sessionTranscriptsTable.id, transcript.id))
      .limit(1)
  )[0];
  await writeSecurityAudit({
    actor,
    action:
      forgetProfileIds.length ||
      assignments.some((speaker) => speaker.rememberProfile)
        ? "TRANSCRIPT_SPEAKER_PROFILES_UPDATED"
        : "TRANSCRIPT_SPEAKER_ROLES_UPDATED",
    targetType: "session_transcript",
    targetId: transcript.id,
    childId: query.data.childId,
    metadata: {
      rememberedProfileCount: assignments.filter(
        (speaker) => speaker.rememberProfile,
      ).length,
      removedProfileCount: forgetProfileIds.length,
    },
  });
  return res.json(
    await transcriptResponse(refreshed ?? transcript, actor.organizationId!),
  );
});

router.post("/sessions/transcription/provisional-phrases", async (req, res) => {
  const query = UpdateTranscriptProvisionalPhrasesQueryParams.safeParse(
    req.query,
  );
  const body = UpdateTranscriptProvisionalPhrasesBody.safeParse(req.body);
  if (!query.success || !body.success) {
    return fail(
      res,
      "A transcript and at least one provisional phrase decision are required.",
    );
  }
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor || !canUseClinicalTools(actor) || !actor.organizationId) {
    return res
      .status(403)
      .json({
        error: "Only an SLP can review provisional transcript phrases.",
      });
  }
  const transcript = (
    await db
      .select()
      .from(sessionTranscriptsTable)
      .where(
        and(
          eq(sessionTranscriptsTable.id, body.data.transcriptId),
          eq(sessionTranscriptsTable.childId, query.data.childId),
          eq(sessionTranscriptsTable.createdBy, actor.author),
        ),
      )
      .limit(1)
  )[0];
  if (!transcript || transcript.status !== "complete") {
    return res
      .status(404)
      .json({
        error:
          "The completed transcript is unavailable for provisional phrase review.",
      });
  }
  const reviews = body.data.reviews;
  if (new Set(reviews.map((review) => review.id)).size !== reviews.length) {
    return fail(
      res,
      "Each provisional phrase can appear only once in a review update.",
    );
  }
  const candidates = await db
    .select()
    .from(transcriptProvisionalPhrasesTable)
    .where(
      and(
        eq(transcriptProvisionalPhrasesTable.transcriptId, transcript.id),
        inArray(
          transcriptProvisionalPhrasesTable.id,
          reviews.map((review) => review.id),
        ),
      ),
    );
  if (candidates.length !== reviews.length) {
    return fail(
      res,
      "Every provisional decision must reference a current mixed-speaker phrase candidate.",
    );
  }
  const existingById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  await db.transaction(async (transaction) => {
    for (const review of reviews) {
      const existing = existingById.get(review.id);
      if (!existing) continue;
      const phrase =
        review.phrase === undefined ? existing.phrase : review.phrase.trim();
      const workingMeaning =
        review.workingMeaning === undefined
          ? existing.workingMeaning
          : review.workingMeaning?.trim() || null;
      await transaction
        .update(transcriptProvisionalPhrasesTable)
        .set({
          phrase,
          normalizedPhrase: normalizePhrase(phrase),
          disposition: review.disposition,
          workingMeaning,
          reviewedByUserId: actor.userId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transcriptProvisionalPhrasesTable.id, existing.id),
            eq(transcriptProvisionalPhrasesTable.transcriptId, transcript.id),
          ),
        );
    }
  });
  await writeSecurityAudit({
    actor,
    action: "TRANSCRIPT_PROVISIONAL_PHRASES_REVIEWED",
    targetType: "session_transcript",
    targetId: transcript.id,
    childId: transcript.childId,
    metadata: {
      reviewedCount: reviews.length,
      approvedCount: reviews.filter(
        (review) => review.disposition === "approved",
      ).length,
      dismissedCount: reviews.filter(
        (review) => review.disposition === "dismissed",
      ).length,
      savedForLaterCount: reviews.filter(
        (review) => review.disposition === "saved_for_later",
      ).length,
    },
  });
  return res.json(await transcriptResponse(transcript, actor.organizationId));
});

router.get("/sessions/transcription/phrase-inbox", async (req, res) => {
  const query = ListChildPhraseInboxQueryParams.safeParse(req.query);
  if (!query.success)
    return fail(res, "The Child phrase inbox filters are invalid.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId || !canUseClinicalTools(actor)) {
    return res
      .status(403)
      .json({ error: "Only an SLP can review the Child phrase inbox." });
  }
  const conditions = [
    eq(childPhraseInboxItemsTable.organizationId, actor.organizationId),
    eq(childPhraseInboxItemsTable.childId, query.data.childId),
  ];
  if (query.data.transcriptId !== undefined) {
    conditions.push(
      eq(childPhraseInboxItemsTable.transcriptId, query.data.transcriptId),
    );
  }
  if (query.data.status !== undefined) {
    conditions.push(eq(childPhraseInboxItemsTable.status, query.data.status));
  }
  const rows = await db
    .select()
    .from(childPhraseInboxItemsTable)
    .where(and(...conditions))
    .orderBy(
      desc(childPhraseInboxItemsTable.updatedAt),
      childPhraseInboxItemsTable.id,
    );
  return res.json(
    ListChildPhraseInboxResponse.parse(rows.map(childPhraseInboxResponse)),
  );
});

router.patch(
  "/sessions/transcription/phrase-inbox/:itemId",
  async (req, res) => {
    const params = UpdateChildPhraseInboxParams.safeParse(req.params);
    const body = UpdateChildPhraseInboxBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return fail(
        res,
        "Choose Pending or Deferred and keep the working meaning concise.",
      );
    }
    const actor = viewerFrom(req);
    if (!actor?.organizationId || !canUseClinicalTools(actor)) {
      return res
        .status(403)
        .json({ error: "Only an SLP can update the Child phrase inbox." });
    }
    const [item] = await db
      .select()
      .from(childPhraseInboxItemsTable)
      .where(
        and(
          eq(childPhraseInboxItemsTable.id, params.data.itemId),
          eq(childPhraseInboxItemsTable.organizationId, actor.organizationId),
        ),
      )
      .limit(1);
    if (!item)
      return res
        .status(404)
        .json({ error: "The Child phrase inbox item was not found." });
    if (!requireChildAccess(req, res, item.childId)) return;
    if (item.status === "dictionary_added") {
      return fail(
        res,
        "This phrase has already moved to the communication dictionary.",
      );
    }
    if (item.status === "excluded") {
      return fail(
        res,
        "Re-confirm this utterance as Child before returning it to the inbox.",
      );
    }
    const writeResult = await db.transaction(async (transaction) => {
      const [lockedTranscript] = await transaction
        .select()
        .from(sessionTranscriptsTable)
        .where(eq(sessionTranscriptsTable.id, item.transcriptId))
        .limit(1)
        .for("update");
      if (!lockedTranscript || lockedTranscript.sessionId !== null) {
        return { conflict: true as const };
      }
      const [lockedItem] = await transaction
        .select()
        .from(childPhraseInboxItemsTable)
        .where(
          and(
            eq(childPhraseInboxItemsTable.id, item.id),
            eq(
              childPhraseInboxItemsTable.organizationId,
              actor.organizationId!,
            ),
            eq(childPhraseInboxItemsTable.childId, item.childId),
            inArray(childPhraseInboxItemsTable.status, ["pending", "deferred"]),
          ),
        )
        .limit(1)
        .for("update");
      if (!lockedItem) return { conflict: true as const };
      const nextMeaning =
        body.data.workingMeaning === undefined
          ? lockedItem.workingMeaning
          : body.data.workingMeaning?.trim() || null;
      const [updated] = await transaction
        .update(childPhraseInboxItemsTable)
        .set({
          status: body.data.status,
          workingMeaning: nextMeaning,
          reviewedByUserId: actor.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(childPhraseInboxItemsTable.id, lockedItem.id),
            eq(childPhraseInboxItemsTable.status, lockedItem.status),
          ),
        )
        .returning();
      if (!updated) return { conflict: true as const };
      await transaction
        .update(transcriptChildUtteranceReviewsTable)
        .set({
          meaning: body.data.status === "deferred" ? null : nextMeaning,
          reviewedByUserId: actor.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(
              transcriptChildUtteranceReviewsTable.transcriptId,
              lockedTranscript.id,
            ),
            eq(
              transcriptChildUtteranceReviewsTable.segmentId,
              lockedItem.segmentId,
            ),
            inArray(transcriptChildUtteranceReviewsTable.disposition, [
              "child",
              "confirmed_gestalt",
            ]),
          ),
        );
      await rebuildConfirmedChildTranscriptPhrases(
        transaction,
        lockedTranscript,
      );
      await refreshChildPhraseInboxPointers(transaction, lockedTranscript.id);
      const [finalUpdated] = await transaction
        .select()
        .from(childPhraseInboxItemsTable)
        .where(eq(childPhraseInboxItemsTable.id, updated.id))
        .limit(1);
      if (!finalUpdated) return { conflict: true as const };
      const [updatedTranscript] = await transaction
        .update(sessionTranscriptsTable)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(sessionTranscriptsTable.id, lockedTranscript.id),
            isNull(sessionTranscriptsTable.sessionId),
          ),
        )
        .returning();
      if (!updatedTranscript) return { conflict: true as const };
      return {
        conflict: false as const,
        updated: finalUpdated,
        updatedTranscript,
      };
    });
    if (writeResult.conflict) {
      return res
        .status(409)
        .json({
          error:
            "This phrase changed or the session was saved. Reopen the review and try again.",
        });
    }
    const { updated, updatedTranscript } = writeResult;
    await writeSecurityAudit({
      actor,
      action: "CHILD_PHRASE_INBOX_UPDATED",
      targetType: "child_phrase_inbox_item",
      targetId: updated.id,
      childId: updated.childId,
      metadata: {
        status: updated.status,
        workingMeaningProvided: Boolean(updated.workingMeaning),
        transcriptId: updated.transcriptId,
        segmentId: updated.segmentId,
      },
    });
    return res.json(
      UpdateChildPhraseInboxResponse.parse({
        item: childPhraseInboxResponse(updated),
        transcript: await transcriptResponse(
          updatedTranscript,
          actor.organizationId,
        ),
      }),
    );
  },
);

router.post("/sessions/transcription/child-utterances", async (req, res) => {
  const query = UpdateTranscriptChildUtterancesQueryParams.safeParse(req.query);
  const body = UpdateTranscriptChildUtterancesBody.safeParse(req.body);
  if (!query.success || !body.success) {
    return fail(
      res,
      "A transcript and at least one Child utterance review are required.",
    );
  }
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor?.organizationId || !canUseClinicalTools(actor)) {
    return res
      .status(403)
      .json({
        error: "Only an SLP can review Child utterances for therapy analysis.",
      });
  }
  const transcript = (
    await db
      .select({ transcript: sessionTranscriptsTable })
      .from(sessionTranscriptsTable)
      .innerJoin(
        childProfilesTable,
        eq(childProfilesTable.id, sessionTranscriptsTable.childId),
      )
      .where(
        and(
          eq(sessionTranscriptsTable.id, body.data.transcriptId),
          eq(sessionTranscriptsTable.childId, query.data.childId),
          eq(childProfilesTable.organizationId, actor.organizationId),
        ),
      )
      .limit(1)
  )[0]?.transcript;
  if (!transcript || transcript.status !== "complete") {
    return res
      .status(404)
      .json({
        error:
          "The completed transcript is unavailable for Child utterance review.",
      });
  }
  if (transcript.sessionId !== null) {
    return fail(
      res,
      "Child utterance review is locked after this transcript is saved. Start a corrected session so the clinical evidence remains auditable.",
    );
  }
  const reviews = body.data.reviews;
  if (
    new Set(reviews.map((review) => review.segmentId)).size !== reviews.length
  ) {
    return fail(
      res,
      "Each Child utterance can appear only once in a review update.",
    );
  }
  if (
    reviews.some(
      (review) =>
        (review.meaning !== null &&
          review.meaning !== undefined &&
          review.meaning.length > 2000) ||
        (review.context !== null &&
          review.context !== undefined &&
          review.context.length > 2000) ||
        (review.interpretation !== null &&
          review.interpretation !== undefined &&
          review.interpretation.length > 2000) ||
        (review.note !== null &&
          review.note !== undefined &&
          review.note.length > 2000),
    )
  ) {
    return fail(
      res,
      "Add context, meaning, interpretation, and notes using short clinician-entered text.",
    );
  }
  const segments = await db
    .select()
    .from(transcriptSpeakerSegmentsTable)
    .where(eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id));
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const transcriptSegmentIds = new Set(segments.map((segment) => segment.id));
  if (reviews.some((review) => !transcriptSegmentIds.has(review.segmentId))) {
    return fail(
      res,
      "Every review must reference a current segment from this transcript.",
    );
  }
  if (
    reviews.some((review) => {
      const segment = segmentById.get(review.segmentId);
      return (
        (review.disposition === "child" ||
          review.disposition === "confirmed_gestalt") &&
        (segment?.intelligibility === "unintelligible" ||
          (segment?.intelligibility === "partially_intelligible" &&
            review.intelligibilityReviewStatus !== "confirmed"))
      );
    })
  ) {
    return fail(
      res,
      "Confirm a partial transcription before using it as evidence. Unintelligible vocalizations cannot become dictionary phrases.",
    );
  }
  if (
    reviews.some(
      (review) =>
        review.disposition === "unintelligible" &&
        review.intelligibilityReviewStatus === "confirmed",
    )
  ) {
    return fail(
      res,
      "An Unintelligible decision cannot confirm transcript wording.",
    );
  }
  if (
    reviews.some((review) => {
      if (review.nlaStage === undefined || review.nlaStage === null)
        return false;
      const segment = segmentById.get(review.segmentId);
      return (
        !segment ||
        (review.disposition !== "child" &&
          review.disposition !== "confirmed_gestalt") ||
        segment.intelligibility === "unintelligible" ||
        (segment.intelligibility === "partially_intelligible" &&
          review.intelligibilityReviewStatus !== "confirmed")
      );
    })
  ) {
    return fail(
      res,
      "Assign an NLA Stage only after this turn is confirmed as intelligible Child language.",
    );
  }
  const stageChanges: Array<{
    reviewId: number;
    segmentId: number;
    previousStage: string | null;
    nlaStage: string | null;
    stageChangeType: "assigned" | "revised" | "cleared";
  }> = [];
  const reviewWrite = await db.transaction(async (transaction) => {
    const [lockedTranscript] = await transaction
      .select()
      .from(sessionTranscriptsTable)
      .where(eq(sessionTranscriptsTable.id, transcript.id))
      .limit(1)
      .for("update");
    if (!lockedTranscript || lockedTranscript.sessionId !== null) {
      throw new Error(
        "Child utterance review is locked after this transcript is saved. Start a corrected session so the clinical evidence remains auditable.",
      );
    }
    if (
      lockedTranscript.updatedAt.toISOString() !==
      body.data.expectedUpdatedAt.toISOString()
    ) {
      return { conflict: true as const };
    }
    const currentReviews: Array<
      typeof transcriptChildUtteranceReviewsTable.$inferSelect
    > = await transaction
      .select()
      .from(transcriptChildUtteranceReviewsTable)
      .where(
        eq(transcriptChildUtteranceReviewsTable.transcriptId, transcript.id),
      );
    const existingBySegment = new Map(
      currentReviews.map((review) => [review.segmentId, review]),
    );
    for (const review of reviews) {
      const existing = existingBySegment.get(review.segmentId);
      const context =
        review.context === undefined
          ? (existing?.context ?? null)
          : review.context?.trim() || null;
      const meaning =
        review.meaning === undefined
          ? (existing?.meaning ?? null)
          : review.meaning?.trim() || null;
      const interpretation =
        review.interpretation === undefined
          ? (existing?.interpretation ?? null)
          : review.interpretation?.trim() || null;
      const note =
        review.note === undefined
          ? (existing?.note ?? null)
          : review.note?.trim() || null;
      const segment = segmentById.get(review.segmentId);
      const intelligibilityReviewStatus =
        review.intelligibilityReviewStatus ??
        existing?.intelligibilityReviewStatus ??
        (segment?.intelligibility === "intelligible" ? "confirmed" : "pending");
      const requestedStage =
        review.nlaStage === undefined
          ? (existing?.nlaStage ?? null)
          : review.nlaStage;
      const nextStage =
        review.disposition === "child" ||
        review.disposition === "confirmed_gestalt"
          ? requestedStage
          : null;
      const stageChanged = (existing?.nlaStage ?? null) !== nextStage;
      if (stageChanged) {
        stageChanges.push({
          reviewId: existing?.id ?? 0,
          segmentId: review.segmentId,
          previousStage: existing?.nlaStage ?? null,
          nlaStage: nextStage,
          stageChangeType:
            nextStage === null
              ? "cleared"
              : existing?.nlaStage
                ? "revised"
                : "assigned",
        });
      }
      const stageMetadata =
        nextStage === null
          ? {
              nlaStage: null,
              nlaStageAssignedByUserId: null,
              nlaStageAssignedByRole: null,
              nlaStageAssignedAt: null,
            }
          : stageChanged
            ? {
                nlaStage: nextStage,
                nlaStageAssignedByUserId: actor.userId,
                nlaStageAssignedByRole: actor.role,
                nlaStageAssignedAt: new Date(),
              }
            : {
                nlaStage: existing?.nlaStage ?? nextStage,
                nlaStageAssignedByUserId:
                  existing?.nlaStageAssignedByUserId ?? actor.userId,
                nlaStageAssignedByRole:
                  existing?.nlaStageAssignedByRole ?? actor.role,
                nlaStageAssignedAt: existing?.nlaStageAssignedAt ?? new Date(),
              };
      const values = {
        transcriptId: transcript.id,
        segmentId: review.segmentId,
        disposition: review.disposition,
        intelligibilityReviewStatus,
        context,
        meaning,
        interpretation,
        note,
        ...stageMetadata,
        reviewedByUserId: actor.userId,
        updatedAt: new Date(),
      };
      if (existing) {
        if (stageChanged) {
          const change = stageChanges[stageChanges.length - 1];
          if (change) change.reviewId = existing.id;
        }
        await transaction
          .update(transcriptChildUtteranceReviewsTable)
          .set(values)
          .where(
            and(
              eq(transcriptChildUtteranceReviewsTable.id, existing.id),
              eq(
                transcriptChildUtteranceReviewsTable.transcriptId,
                transcript.id,
              ),
            ),
          );
      } else {
        const [inserted] = await transaction
          .insert(transcriptChildUtteranceReviewsTable)
          .values(values)
          .returning({ id: transcriptChildUtteranceReviewsTable.id });
        if (stageChanged && inserted) {
          const change = stageChanges[stageChanges.length - 1];
          if (change) change.reviewId = inserted.id;
        }
      }
    }
    await rebuildConfirmedChildTranscriptPhrases(transaction, transcript);
    const inboxSummary = await syncChildPhraseInboxForReviews(
      transaction,
      transcript,
      actor.organizationId!,
      actor.userId,
      segments,
      reviews,
    );
    await refreshChildPhraseInboxPointers(transaction, transcript.id);
    await transaction
      .update(sessionTranscriptsTable)
      .set({ updatedAt: new Date() })
      .where(eq(sessionTranscriptsTable.id, transcript.id));
    for (const change of stageChanges) {
      await transaction.insert(securityAuditLogsTable).values({
        userId: actor.userId,
        actorName: actor.author,
        actorRole: actor.role,
        action: "TRANSCRIPT_CHILD_UTTERANCE_NLA_STAGE_CHANGED",
        targetType: "transcript_child_utterance_review",
        targetId: change.reviewId ? String(change.reviewId) : null,
        childId: transcript.childId,
        outcome: "success",
        metadata: safeAuditMetadata({
          organizationId: actor.organizationId,
          transcriptId: transcript.id,
          sessionId: transcript.sessionId,
          segmentId: change.segmentId,
          previousNlaStage: change.previousStage,
          nlaStage: change.nlaStage,
          stageChangeType: change.stageChangeType,
        }),
      });
    }
    return { conflict: false as const, inboxSummary };
  });
  if (reviewWrite.conflict) {
    return res.status(409).json({
      error:
        "This review changed on another device. Reopen the saved review before making more changes.",
    });
  }

  await writeSecurityAudit({
    actor,
    action: "TRANSCRIPT_CHILD_UTTERANCES_REVIEWED",
    targetType: "session_transcript",
    targetId: transcript.id,
    childId: transcript.childId,
    metadata: {
      reviewedCount: reviews.length,
      confirmedGestaltCount: reviews.filter(
        (review) =>
          review.disposition === "child" ||
          review.disposition === "confirmed_gestalt",
      ).length,
      excludedCount: reviews.filter(
        (review) =>
          review.disposition === "not_child" ||
          review.disposition === "not_gestalt",
      ).length,
      contextCount: reviews.filter(
        (review) =>
          review.disposition === "unsure" || review.disposition === "context",
      ).length,
      unlabeledCount: reviews.filter(
        (review) =>
          review.disposition === "unintelligible" ||
          review.disposition === "unlabeled",
      ).length,
      partialTranscriptionConfirmedCount: reviews.filter(
        (review) => review.intelligibilityReviewStatus === "confirmed",
      ).length,
      interpretationProvidedCount: reviews.filter((review) =>
        Boolean(review.interpretation?.trim()),
      ).length,
      meaningProvidedCount: reviews.filter((review) =>
        Boolean(review.meaning?.trim()),
      ).length,
      phraseInboxCreatedCount: reviewWrite.inboxSummary.createdCount,
      phraseInboxUpdatedCount: reviewWrite.inboxSummary.updatedCount,
      phraseInboxExcludedCount: reviewWrite.inboxSummary.excludedCount,
    },
  });
  const [reviewedTranscript] = await db
    .select()
    .from(sessionTranscriptsTable)
    .where(eq(sessionTranscriptsTable.id, transcript.id))
    .limit(1);
  return res.json(
    await transcriptResponse(
      reviewedTranscript ?? transcript,
      actor.organizationId!,
    ),
  );
});

router.post("/sessions", async (req, res) => {
  await ensureSessionStore();
  const query = CreateSessionQueryParams.safeParse(req.query);
  const body = CreateSessionBody.safeParse(req.body);
  if (!query.success || !body.success)
    return fail(res, "Please complete the reviewed phrases and session note.");
  if (!requireChildAccess(req, res, query.data.childId)) return;
  const actor = viewerFrom(req);
  if (!actor)
    return res
      .status(401)
      .json({ error: "Please sign in to save a reviewed therapy session." });
  const { author, role } = actor;
  if (!actor || !canUseClinicalTools(actor))
    return res
      .status(403)
      .json({ error: "Only an SLP can save a reviewed therapy session." });
  if (!body.data.consentConfirmed)
    return fail(
      res,
      "Consent confirmation is required before saving a therapy session.",
    );
  const consentConfirmedAt = new Date(body.data.consentConfirmedAt);
  if (Number.isNaN(consentConfirmedAt.getTime()))
    return fail(res, "Consent confirmation must include a valid timestamp.");
  if (actor.organizationId) {
    const audio = body.data.audioId
      ? (
          await db
            .select()
            .from(sessionAudioObjectsTable)
            .where(
              and(
                eq(sessionAudioObjectsTable.id, body.data.audioId),
                eq(
                  sessionAudioObjectsTable.organizationId,
                  actor.organizationId,
                ),
                eq(sessionAudioObjectsTable.childId, query.data.childId),
                eq(sessionAudioObjectsTable.uploadedByUserId, actor.userId),
                eq(sessionAudioObjectsTable.purpose, "session_recording"),
                isNull(sessionAudioObjectsTable.deletedAt),
              ),
            )
            .limit(1)
        )[0]
      : undefined;
    if (body.data.audioId && (!audio || audio.sessionId !== null)) {
      return res
        .status(400)
        .json({
          error:
            "The selected recording is unavailable. Please upload it again.",
        });
    }
    const calibrationAudioIds = body.data.calibrationAudioIds ?? [];
    const calibrationAudio = calibrationAudioIds.length
      ? await db
          .select()
          .from(sessionAudioObjectsTable)
          .where(
            and(
              inArray(sessionAudioObjectsTable.id, calibrationAudioIds),
              eq(sessionAudioObjectsTable.organizationId, actor.organizationId),
              eq(sessionAudioObjectsTable.childId, query.data.childId),
              eq(sessionAudioObjectsTable.uploadedByUserId, actor.userId),
              eq(sessionAudioObjectsTable.purpose, "speaker_calibration"),
              eq(sessionAudioObjectsTable.status, "ready"),
              isNull(sessionAudioObjectsTable.sessionId),
              isNull(sessionAudioObjectsTable.deletedAt),
            ),
          )
      : [];
    if (calibrationAudio.length !== calibrationAudioIds.length) {
      return res
        .status(400)
        .json({
          error:
            "One of the calibration references is unavailable. Please record it again.",
        });
    }
    if (
      body.data.audioId &&
      calibrationAudio.length &&
      (!audio?.preparationId ||
        calibrationAudio.some(
          (item) => item.preparationId !== audio.preparationId,
        ))
    ) {
      return res
        .status(400)
        .json({
          error:
            "Calibration references must belong to the same prepared recording as the therapy audio.",
        });
    }
    const completedTranscriptForAudio = body.data.audioId
      ? (
          await db
            .select()
            .from(sessionTranscriptsTable)
            .where(
              and(
                eq(sessionTranscriptsTable.audioId, body.data.audioId),
                eq(sessionTranscriptsTable.childId, query.data.childId),
                eq(sessionTranscriptsTable.createdBy, author),
                eq(sessionTranscriptsTable.status, "complete"),
              ),
            )
            .limit(1)
        )[0]
      : undefined;
    if (
      completedTranscriptForAudio &&
      body.data.transcriptionId !== completedTranscriptForAudio.id
    ) {
      return fail(
        res,
        "This recording has a completed transcript. Save only phrases rebuilt from its confirmed Child speaker turns.",
      );
    }
    const transcript = body.data.transcriptionId
      ? (
          await db
            .select()
            .from(sessionTranscriptsTable)
            .where(
              and(
                eq(sessionTranscriptsTable.id, body.data.transcriptionId),
                eq(sessionTranscriptsTable.childId, query.data.childId),
                eq(sessionTranscriptsTable.createdBy, author),
              ),
            )
            .limit(1)
        )[0]
      : undefined;
    if (
      body.data.transcriptionId &&
      (!transcript ||
        transcript.status !== "complete" ||
        transcript.audioId !== body.data.audioId)
    ) {
      return fail(
        res,
        "The completed transcript does not match this recording.",
      );
    }
    for (const phrase of body.data.gestalts) {
      if (phrase.preserveDictionary) {
        if (!transcript || typeof phrase.transcriptPhraseId !== "number") {
          return fail(
            res,
            "Automatic dictionary reuse requires a completed transcript Child phrase.",
          );
        }
        const [activeDictionaryEntry] = await db
          .select({ id: clinicalGestaltsTable.id })
          .from(clinicalGestaltsTable)
          .where(
            and(
              eq(clinicalGestaltsTable.organizationId, actor.organizationId!),
              eq(clinicalGestaltsTable.childId, query.data.childId),
              eq(
                clinicalGestaltsTable.normalizedPhrase,
                normalizePhrase(phrase.phrase),
              ),
              isNull(clinicalGestaltsTable.archivedAt),
            ),
          )
          .limit(1);
        if (!activeDictionaryEntry)
          return fail(
            res,
            "An automatic dictionary reuse must match an active exact phrase.",
          );
      } else if (!phrase.clinicianReviewed) {
        return fail(
          res,
          "Every new or changed phrase must be explicitly clinician-reviewed before saving.",
        );
      } else if (
        !phrase.meaning.trim() ||
        phrase.meaning === "Meaning to explore with the team" ||
        phrase.function === "Unknown"
      ) {
        return fail(
          res,
          "A reviewed exception needs a working meaning and communication function before saving.",
        );
      }
    }
    const transcriptPhraseIds = [
      ...new Set(
        body.data.gestalts
          .map((phrase) => phrase.transcriptPhraseId)
          .filter((id): id is number => typeof id === "number"),
      ),
    ];
    const phraseInboxItemIds = [
      ...new Set(
        body.data.gestalts
          .map((phrase) => phrase.phraseInboxItemId)
          .filter((id): id is number => typeof id === "number"),
      ),
    ];
    const suppliedInboxItemCount = body.data.gestalts.filter(
      (phrase) => typeof phrase.phraseInboxItemId === "number",
    ).length;
    if (
      suppliedInboxItemCount !== phraseInboxItemIds.length ||
      body.data.gestalts.some(
        (phrase) =>
          typeof phrase.phraseInboxItemId === "number" &&
          typeof phrase.transcriptPhraseId !== "number",
      )
    ) {
      return fail(
        res,
        "Each Child Phrase Inbox item must be used once with its exact transcript phrase.",
      );
    }
    if (transcriptPhraseIds.length && !transcript) {
      return fail(
        res,
        "Transcript phrases can only be saved from this session's reviewed Child speaker turns.",
      );
    }
    const childAttributedPhraseIds = new Set<number>();
    if (transcript && transcriptPhraseIds.length) {
      const phraseRows = await db
        .select()
        .from(transcriptPhrasesTable)
        .where(
          and(
            eq(transcriptPhrasesTable.transcriptId, transcript.id),
            inArray(transcriptPhrasesTable.id, transcriptPhraseIds),
          ),
        );
      for (const phrase of phraseRows) {
        if (phrase.attributedRole === "child")
          childAttributedPhraseIds.add(phrase.id);
      }
      if (
        phraseRows.length !== transcriptPhraseIds.length ||
        transcriptPhraseIds.some(
          (phraseId) => !childAttributedPhraseIds.has(phraseId),
        )
      ) {
        return fail(
          res,
          "Only transcript phrases rebuilt from clinician-confirmed Child speaker turns can be saved as clinical evidence.",
        );
      }
    }
    const saved = await db.transaction(async (transaction) => {
      if (transcript) {
        const [liveTranscript] = await transaction
          .select()
          .from(sessionTranscriptsTable)
          .where(eq(sessionTranscriptsTable.id, transcript.id))
          .limit(1)
          .for("update");
        if (!liveTranscript || liveTranscript.sessionId !== null) {
          throw new Error(
            "This transcript was changed or attached while the session was being saved.",
          );
        }
        const [segments, utteranceReviews] = await Promise.all([
          transaction
            .select()
            .from(transcriptSpeakerSegmentsTable)
            .where(
              eq(transcriptSpeakerSegmentsTable.transcriptId, transcript.id),
            ),
          transaction
            .select()
            .from(transcriptChildUtteranceReviewsTable)
            .where(
              eq(
                transcriptChildUtteranceReviewsTable.transcriptId,
                transcript.id,
              ),
            ),
        ]);
        const childSegments = segments.map((segment) => ({
          id: segment.id,
          intelligibility: segment.intelligibility,
        }));
        if (
          hasUnresolvedChildUtteranceReviews(childSegments, utteranceReviews)
        ) {
          throw new Error(
            "Classify every transcript utterance before saving this session. Only explicit Child decisions can become evidence.",
          );
        }
        if (transcriptPhraseIds.length) {
          if (!hasMeaningBackedConfirmedUtterance(utteranceReviews)) {
            throw new Error(
              "Transcript evidence must come from a meaning-backed confirmed Child utterance review.",
            );
          }
        }
        const inboxRows = await transaction
          .select()
          .from(childPhraseInboxItemsTable)
          .where(
            and(
              eq(
                childPhraseInboxItemsTable.organizationId,
                actor.organizationId!,
              ),
              eq(childPhraseInboxItemsTable.childId, query.data.childId),
              eq(childPhraseInboxItemsTable.transcriptId, transcript.id),
              inArray(childPhraseInboxItemsTable.status, [
                "pending",
                "deferred",
              ]),
            ),
          )
          .for("update");
        const inboxById = new Map(inboxRows.map((row) => [row.id, row]));
        const reviewBySegmentId = new Map(
          utteranceReviews.map((review) => [review.segmentId, review]),
        );
        const segmentById = new Map(
          segments.map((segment) => [segment.id, segment]),
        );
        for (const phrase of body.data.gestalts.filter(
          (item) => typeof item.transcriptPhraseId === "number",
        )) {
          const matchingInboxRows = inboxRows.filter(
            (row) =>
              normalizePhrase(row.phrase) === normalizePhrase(phrase.phrase),
          );
          if (
            matchingInboxRows.length &&
            typeof phrase.phraseInboxItemId !== "number"
          ) {
            throw new Error(
              "Choose the exact Child Phrase Inbox item before adding transcript language to the dictionary.",
            );
          }
          if (typeof phrase.phraseInboxItemId === "number") {
            const inboxItem = inboxById.get(phrase.phraseInboxItemId);
            const sourceSegment = inboxItem
              ? segmentById.get(inboxItem.segmentId)
              : undefined;
            const sourceReview = inboxItem
              ? reviewBySegmentId.get(inboxItem.segmentId)
              : undefined;
            if (
              !inboxItem ||
              inboxItem.status !== "pending" ||
              inboxItem.transcriptPhraseId !== phrase.transcriptPhraseId ||
              normalizePhrase(inboxItem.phrase) !==
                normalizePhrase(phrase.phrase) ||
              !sourceSegment ||
              !sourceReview ||
              !canCreatePhraseEvidenceFrom(sourceSegment, sourceReview)
            ) {
              throw new Error(
                "The selected Child Phrase Inbox item is no longer eligible for dictionary review.",
              );
            }
          }
        }
        if (phraseInboxItemIds.some((id) => !inboxById.has(id))) {
          throw new Error(
            "A selected Child Phrase Inbox item changed while the session was being saved.",
          );
        }
      }
      const [session] = await transaction
        .insert(therapySessionsTable)
        .values({
          organizationId: actor.organizationId!,
          childId: query.data.childId,
          durationSeconds: body.data.durationSeconds,
          clinicalObservations: body.data.clinicalObservations,
          nextSteps: body.data.nextSteps,
          note: body.data.note,
          createdByUserId: actor.userId,
        })
        .returning();
      if (!session) throw new Error("Session insert did not return a row.");
      // Insert the durable queue record in this same transaction. A committed
      // reviewed session can therefore never exist without a recoverable
      // engine trigger, even if the process stops immediately after responding.
      const runTrigger: ClinicalInsightRunTrigger = {
        organizationId: actor.organizationId!,
        childId: query.data.childId,
        triggerSessionId: session.id,
      };
      const runIdentity = clinicalInsightRunIdentity(runTrigger);
      await transaction
        .insert(clinicalKnowledgeInsightRunsTable)
        .values({
          ...runTrigger,
          triggeredByUserId: actor.userId,
          ...runIdentity,
          engineVersion: CLINICAL_INSIGHTS_ENGINE_VERSION,
        })
        .onConflictDoNothing();
      const [insightRun] = await transaction
        .select({ id: clinicalKnowledgeInsightRunsTable.id })
        .from(clinicalKnowledgeInsightRunsTable)
        .where(
          and(
            eq(
              clinicalKnowledgeInsightRunsTable.organizationId,
              runTrigger.organizationId,
            ),
            eq(clinicalKnowledgeInsightRunsTable.childId, runTrigger.childId),
            eq(
              clinicalKnowledgeInsightRunsTable.evidenceFingerprint,
              runIdentity.evidenceFingerprint,
            ),
            eq(
              clinicalKnowledgeInsightRunsTable.knowledgeFingerprint,
              runIdentity.knowledgeFingerprint,
            ),
            eq(
              clinicalKnowledgeInsightRunsTable.engineVersion,
              CLINICAL_INSIGHTS_ENGINE_VERSION,
            ),
          ),
        )
        .limit(1);
      if (!insightRun)
        throw new Error(
          "Clinical insight run could not be queued with the reviewed session.",
        );
      const lockedChildAttributedPhraseIds = new Set<number>();
      if (transcript) {
        const [claimedTranscript] = await transaction
          .update(sessionTranscriptsTable)
          .set({ sessionId: session.id, updatedAt: new Date() })
          .where(
            and(
              eq(sessionTranscriptsTable.id, transcript.id),
              isNull(sessionTranscriptsTable.sessionId),
            ),
          )
          .returning({ id: sessionTranscriptsTable.id });
        if (!claimedTranscript) {
          throw new Error(
            "This transcript was changed or attached while the session was being saved.",
          );
        }
        if (transcriptPhraseIds.length) {
          const lockedPhraseRows = await transaction
            .select()
            .from(transcriptPhrasesTable)
            .where(
              and(
                eq(transcriptPhrasesTable.transcriptId, transcript.id),
                inArray(transcriptPhrasesTable.id, transcriptPhraseIds),
              ),
            );
          for (const phrase of lockedPhraseRows) {
            if (phrase.attributedRole === "child")
              lockedChildAttributedPhraseIds.add(phrase.id);
          }
          if (
            lockedPhraseRows.length !== transcriptPhraseIds.length ||
            transcriptPhraseIds.some(
              (phraseId) => !lockedChildAttributedPhraseIds.has(phraseId),
            )
          ) {
            throw new Error(
              "The confirmed Child speaker evidence changed while the session was being saved.",
            );
          }
        }
      }
      // The reviewed session is the dictionary workflow: each reviewed phrase
      // becomes (or updates) the child-scoped canonical entry before it is
      // attached to this session's evidence.
      const dictionaryGestalts: Array<
        typeof clinicalGestaltsTable.$inferSelect
      > = [];
      let phraseInboxDictionaryAddedCount = 0;
      for (const phrase of body.data.gestalts) {
        const normalizedPhrase = normalizePhrase(phrase.phrase);
        const [existingDictionaryGestalt] = phrase.preserveDictionary
          ? await transaction
              .select()
              .from(clinicalGestaltsTable)
              .where(
                and(
                  eq(
                    clinicalGestaltsTable.organizationId,
                    actor.organizationId!,
                  ),
                  eq(clinicalGestaltsTable.childId, query.data.childId),
                  eq(clinicalGestaltsTable.normalizedPhrase, normalizedPhrase),
                  isNull(clinicalGestaltsTable.archivedAt),
                ),
              )
              .limit(1)
              .for("update")
          : [];
        if (phrase.preserveDictionary && !existingDictionaryGestalt) {
          throw new Error(
            "An automatic dictionary reuse must match an active exact phrase at save time.",
          );
        }
        const dictionaryValues = {
          organizationId: actor.organizationId!,
          childId: query.data.childId,
          phrase: phrase.phrase,
          normalizedPhrase,
          meaning: phrase.meaning,
          communicationFunction: phrase.function,
          contexts: phrase.context ? [phrase.context] : [],
          emotionalState: phrase.emotionalState,
          source: "Reviewed session",
          createdByUserId: actor.userId,
        };
        let dictionaryGestalt = existingDictionaryGestalt;
        if (!dictionaryGestalt) {
          [dictionaryGestalt] = await transaction
            .insert(clinicalGestaltsTable)
            .values(dictionaryValues)
            .onConflictDoUpdate({
              target: [
                clinicalGestaltsTable.childId,
                clinicalGestaltsTable.normalizedPhrase,
              ],
              targetWhere: isNull(clinicalGestaltsTable.archivedAt),
              set: {
                phrase: phrase.phrase,
                meaning: phrase.meaning,
                communicationFunction: phrase.function,
                contexts: phrase.context ? [phrase.context] : [],
                emotionalState: phrase.emotionalState,
                source: "Reviewed session",
                archivedAt: null,
                updatedAt: new Date(),
              },
            })
            .returning();
        }
        if (!dictionaryGestalt)
          throw new Error("Dictionary phrase insert did not return a row.");
        dictionaryGestalts.push(dictionaryGestalt);
      }
      if (transcript && phraseInboxItemIds.length) {
        const transitionedInboxRows = await transaction
          .update(childPhraseInboxItemsTable)
          .set({
            status: "dictionary_added",
            reviewedByUserId: actor.userId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(
                childPhraseInboxItemsTable.organizationId,
                actor.organizationId!,
              ),
              eq(childPhraseInboxItemsTable.childId, query.data.childId),
              eq(childPhraseInboxItemsTable.transcriptId, transcript.id),
              eq(childPhraseInboxItemsTable.status, "pending"),
              inArray(childPhraseInboxItemsTable.id, phraseInboxItemIds),
            ),
          )
          .returning({ id: childPhraseInboxItemsTable.id });
        if (transitionedInboxRows.length !== phraseInboxItemIds.length) {
          throw new Error(
            "A Child Phrase Inbox item changed while the session was being saved.",
          );
        }
        phraseInboxDictionaryAddedCount = transitionedInboxRows.length;
      }
      const savedPhrases = body.data.gestalts.length
        ? await transaction
            .insert(therapySessionGestaltsTable)
            .values(
              body.data.gestalts.map((phrase, index) => {
                const dictionaryGestalt = dictionaryGestalts[index];
                const preserved =
                  phrase.preserveDictionary && dictionaryGestalt;
                return {
                  sessionId: session.id,
                  gestaltId: dictionaryGestalt?.id ?? null,
                  transcriptPhraseId: phrase.transcriptPhraseId ?? null,
                  phraseInboxItemId: phrase.phraseInboxItemId ?? null,
                  // A free-text entry is an explicit clinician-reviewed Child capture;
                  // transcript-backed evidence is accepted only after the server gate above.
                  childAttributed: phrase.transcriptPhraseId
                    ? lockedChildAttributedPhraseIds.has(
                        phrase.transcriptPhraseId,
                      )
                    : true,
                  phrase: preserved ? dictionaryGestalt.phrase : phrase.phrase,
                  meaning: preserved
                    ? dictionaryGestalt.meaning
                    : phrase.meaning,
                  communicationFunction: preserved
                    ? dictionaryGestalt.communicationFunction
                    : phrase.function,
                  context: preserved
                    ? (dictionaryGestalt.contexts[0] ?? "")
                    : phrase.context,
                  emotionalState: preserved
                    ? dictionaryGestalt.emotionalState
                    : phrase.emotionalState,
                  note: phrase.note,
                };
              }),
            )
            .returning()
        : [];
      if (audio) {
        const [attachedAudio] = await transaction
          .update(sessionAudioObjectsTable)
          .set({ sessionId: session.id, status: "attached" })
          .where(
            and(
              eq(sessionAudioObjectsTable.id, audio.id),
              isNull(sessionAudioObjectsTable.sessionId),
            ),
          )
          .returning({ id: sessionAudioObjectsTable.id });
        if (!attachedAudio) {
          throw new Error(
            "This recording was attached while the session was being saved.",
          );
        }
      }
      if (calibrationAudio.length) {
        const attachedCalibrations = await transaction
          .update(sessionAudioObjectsTable)
          .set({ sessionId: session.id, status: "attached" })
          .where(
            and(
              inArray(
                sessionAudioObjectsTable.id,
                calibrationAudio.map((item) => item.id),
              ),
              eq(sessionAudioObjectsTable.purpose, "speaker_calibration"),
              eq(sessionAudioObjectsTable.status, "ready"),
              isNull(sessionAudioObjectsTable.sessionId),
            ),
          )
          .returning({ id: sessionAudioObjectsTable.id });
        if (attachedCalibrations.length !== calibrationAudio.length) {
          throw new Error(
            "A calibration reference was attached while the session was being saved.",
          );
        }
      }
      if (audio?.preparationId) {
        await transaction
          .update(sessionRecordingPreparationsTable)
          .set({ status: "completed", completedAt: new Date() })
          .where(
            and(
              eq(sessionRecordingPreparationsTable.id, audio.preparationId),
              inArray(sessionRecordingPreparationsTable.status, [
                "active",
                "ready",
              ]),
            ),
          );
      }
      return {
        session,
        savedPhrases,
        dictionaryGestalts,
        insightRunId: insightRun.id,
        phraseInboxDictionaryAddedCount,
      };
    });
    const response: SavedSession = {
      id: saved.session.id,
      childId: saved.session.childId,
      durationSeconds: saved.session.durationSeconds,
      gestalts: body.data.gestalts,
      gestaltIds: saved.dictionaryGestalts.map((phrase) => phrase.id),
      clinicalObservations: saved.session.clinicalObservations,
      nextSteps: saved.session.nextSteps,
      note: saved.session.note,
      audioId: audio?.id ?? null,
      audioUrl: audio ? `/api/sessions/${saved.session.id}/audio` : null,
      transcriptionId: transcript?.id ?? null,
      createdAt: saved.session.createdAt.toISOString(),
      createdBy: author,
      role,
      consent: {
        confirmed: true,
        confirmedAt: consentConfirmedAt.toISOString(),
        confirmedBy: author,
        childId: query.data.childId,
      },
    };
    if (transcript)
      await applyTranscriptOccurrences(
        transcript.id,
        query.data.childId,
        response.id,
        response.gestalts,
        response.gestaltIds,
      );
    // Persist the deterministic draft as soon as reviewed session evidence is
    // saved. Clinician edits later replace only this content, not its evidence.
    const generatedSoapDraft = await reviewedSoapNoteFor(
      actor.organizationId!,
      query.data.childId,
      response.id,
      actor.userId,
    );
    if (generatedSoapDraft) {
      await db
        .insert(clinicalSoapNotesTable)
        .values({
          organizationId: actor.organizationId!,
          childId: query.data.childId,
          sessionId: response.id,
          content: generatedSoapDraft.content,
          evidenceVersion: 2,
          clinicianEdited: false,
          engineVersion: "reviewed-session-draft-v2",
          citations: generatedSoapDraft.citations,
          updatedByUserId: actor.userId,
        })
        .onConflictDoNothing();
    }
    // Persist the durable run immediately and let the worker complete after
    // this request. The UI never needs a clinician to click a generation
    // control, and an interruption leaves a queued/failed run for retry.
    void runClinicalInsights({
      actor,
      organizationId: actor.organizationId!,
      childId: query.data.childId,
      triggerSessionId: response.id,
      runId: saved.insightRunId,
    });
    await writeSecurityAudit({
      actor,
      action: "SESSION_NOTE_SAVED",
      targetType: "therapy_session",
      targetId: response.id,
      childId: response.childId,
      metadata: {
        hasRecording: Boolean(response.audioId),
        hasTranscript: Boolean(response.transcriptionId),
        phraseInboxDictionaryAddedCount: saved.phraseInboxDictionaryAddedCount,
      },
    });
    return res.status(201).json(sessionResponse(response));
  }
  const audio = body.data.audioId
    ? sessionStore.audio.find(
        (entry) =>
          entry.id === body.data.audioId &&
          entry.owner === author &&
          entry.childId === query.data.childId &&
          entry.consentConfirmedBy === author &&
          Boolean(entry.consentConfirmedAt) &&
          entry.sessionId === null,
      )
    : undefined;
  const savedForTranscript = body.data.transcriptionId
    ? sessionStore.sessions.find(
        (entry) =>
          entry.transcriptionId === body.data.transcriptionId &&
          entry.childId === query.data.childId &&
          entry.createdBy === author,
      )
    : undefined;
  if (savedForTranscript) {
    await applyTranscriptOccurrences(
      body.data.transcriptionId!,
      query.data.childId,
      savedForTranscript.id,
      savedForTranscript.gestalts,
      savedForTranscript.gestaltIds,
    );
    return res.status(200).json(sessionResponse(savedForTranscript));
  }
  if (body.data.audioId && !audio)
    return res
      .status(400)
      .json({
        error: "The selected recording is unavailable. Please upload it again.",
      });
  const transcript = body.data.transcriptionId
    ? (
        await db
          .select()
          .from(sessionTranscriptsTable)
          .where(
            and(
              eq(sessionTranscriptsTable.id, body.data.transcriptionId),
              eq(sessionTranscriptsTable.childId, query.data.childId),
              eq(sessionTranscriptsTable.createdBy, author),
            ),
          )
          .limit(1)
      )[0]
    : undefined;
  if (
    body.data.transcriptionId &&
    (!transcript ||
      transcript.status !== "complete" ||
      transcript.audioId !== body.data.audioId)
  ) {
    return fail(res, "The completed transcript does not match this recording.");
  }
  const id = sessionStore.nextSessionId++;
  const session: SavedSession = {
    id,
    childId: query.data.childId,
    durationSeconds: body.data.durationSeconds,
    gestalts: body.data.gestalts,
    gestaltIds: body.data.gestalts.map(() => sessionStore.nextGestaltId++),
    clinicalObservations: body.data.clinicalObservations,
    nextSteps: body.data.nextSteps,
    note: body.data.note,
    audioId: audio?.id ?? null,
    audioUrl: audio ? `/api/sessions/${id}/audio` : null,
    transcriptionId: transcript?.id ?? null,
    createdAt: now(),
    createdBy: author,
    role,
    consent: {
      confirmed: true,
      confirmedAt: consentConfirmedAt.toISOString(),
      confirmedBy: author,
      childId: query.data.childId,
    },
  };
  if (audio) audio.sessionId = id;
  sessionStore.sessions.unshift(session);
  await saveSessionStore();
  if (transcript) {
    await applyTranscriptOccurrences(
      transcript.id,
      query.data.childId,
      session.id,
      session.gestalts,
      session.gestaltIds,
    );
  }
  await writeSecurityAudit({
    actor,
    action: "SESSION_NOTE_SAVED",
    targetType: "therapy_session",
    targetId: session.id,
    childId: session.childId,
    metadata: {
      hasRecording: Boolean(session.audioId),
      hasTranscript: Boolean(session.transcriptionId),
    },
  });
  res.status(201).json(sessionResponse(session));
});

router.get("/sessions/:sessionId/audio", async (req, res) => {
  await ensureSessionStore();
  const parsed = GetSessionAudioParams.safeParse(req.params);
  if (!parsed.success)
    return res.status(404).json({ error: "Recording not found." });
  const actor = viewerFrom(req);
  if (!canUseClinicalTools(actor)) {
    if (actor)
      await writeSecurityAudit({
        actor,
        action: "CLINICAL_ACCESS_DENIED",
        targetType: "recording",
        targetId: parsed.data.sessionId,
        outcome: "failure",
      });
    return res
      .status(403)
      .json({ error: "Only an SLP can access private recordings." });
  }
  if (actor?.organizationId) {
    const [audio] = await db
      .select()
      .from(sessionAudioObjectsTable)
      .where(
        and(
          eq(sessionAudioObjectsTable.sessionId, parsed.data.sessionId),
          eq(sessionAudioObjectsTable.organizationId, actor.organizationId),
          eq(sessionAudioObjectsTable.purpose, "session_recording"),
          isNull(sessionAudioObjectsTable.deletedAt),
        ),
      )
      .limit(1);
    if (!audio || !requireChildAccess(req, res, audio.childId))
      return res.status(404).json({ error: "Recording not found." });
    try {
      const data = await persistedAudioObjectStore(audio).get(audio.objectKey);
      await writeSecurityAudit({
        actor,
        action: "RECORDING_ACCESSED",
        targetType: "recording",
        targetId: audio.id,
        childId: audio.childId,
      });
      res.setHeader("Content-Type", audio.contentType);
      res.setHeader("Cache-Control", "private, no-store");
      return res.send(data);
    } catch {
      return res.status(404).json({ error: "Recording not found." });
    }
  }
  const session = sessionStore.sessions.find(
    (item) => item.id === parsed.data.sessionId,
  );
  if (!session || !session.audioId)
    return res.status(404).json({ error: "Recording not found." });
  if (!requireChildAccess(req, res, session.childId)) return res.end();
  const audio = sessionStore.audio.find((item) => item.id === session.audioId);
  if (!audio) return res.status(404).json({ error: "Recording not found." });
  try {
    const data = await audioObjectStore.get(audio.fileName);
    const actor = viewerFrom(req);
    if (actor) {
      await writeSecurityAudit({
        actor,
        action: "RECORDING_ACCESSED",
        targetType: "recording",
        targetId: audio.id,
        childId: session.childId,
      });
    }
    res.setHeader("Content-Type", audio.contentType);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(data);
  } catch {
    return res.status(404).json({ error: "Recording not found." });
  }
});

// Private-beta boundary routes. Tokens are opaque random values and only their
// SHA-256 digest is ever persisted or used for lookup.
const invitationTokenHash = hashInvitationToken;
const invitationToken = createInvitationToken;
const safeBetaRequest = (
  request: typeof betaAccessRequestsTable.$inferSelect,
) => ({
  id: request.id,
  status:
    request.status === "approved"
      ? "approved"
      : request.status === "rejected"
        ? "rejected"
        : "received",
  createdAt: request.createdAt.toISOString(),
});
const rawParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const betaActor = (req: Request) => req.echomapActor;

router.post("/beta-access-requests", async (req, res): Promise<void> => {
  const input = req.body as Record<string, unknown>;
  const displayName =
    typeof input.fullName === "string" ? input.fullName.trim() : "";
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const organizationName =
    typeof input.organization === "string" ? input.organization.trim() : "";
  const requestedRole = typeof input.role === "string" ? input.role.trim() : "";
  const message =
    typeof input.message === "string"
      ? input.message.trim().slice(0, 2000)
      : "";
  if (
    !displayName ||
    displayName.length > 200 ||
    !organizationName ||
    organizationName.length > 240 ||
    !["Clinician", "Parent", "Teacher"].includes(requestedRole) ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  ) {
    res
      .status(400)
      .json({
        error:
          "A name, valid email address, role, and organization are required.",
      });
    return;
  }
  const [request] = await db
    .insert(betaAccessRequestsTable)
    .values({
      displayName,
      email,
      organizationName,
      requestedRole,
      message: message || null,
    })
    .returning();
  res.status(201).json(safeBetaRequest(request!));
});

router.get("/admin/beta-access-requests", async (req, res): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  const requests = await db
    .select()
    .from(betaAccessRequestsTable)
    .where(isNull(betaAccessRequestsTable.archivedAt))
    .orderBy(desc(betaAccessRequestsTable.createdAt));
  res.json(
    requests.map((item) => ({
      id: item.id,
      fullName: item.displayName,
      email: item.email,
      role: item.requestedRole,
      organization: item.organizationName,
      message: item.message,
      status: item.status,
      invitationId: item.invitationId,
      createdAt: item.createdAt.toISOString(),
    })),
  );
});

for (const action of ["approve", "reject", "archive"] as const) {
  router.post(
    `/admin/beta-access-requests/:id/${action}`,
    async (req, res): Promise<void> => {
      const actor = requireSuperAdmin(req, res);
      if (!actor) return;
      const id = Number(rawParam(req.params.id));
      if (!Number.isSafeInteger(id) || id < 1) {
        res.status(400).json({ error: "Invalid request." });
        return;
      }
      if (action === "approve") {
        const organizationId = Number(req.body?.organizationId);
        const childId = Number(req.body?.childId);
        if (
          !Number.isSafeInteger(organizationId) ||
          !Number.isSafeInteger(childId)
        ) {
          res
            .status(400)
            .json({
              error: "Approval requires a valid organization and child.",
            });
          return;
        }
        const token = invitationToken();
        const expiresAt = new Date(Date.now() + 7 * 86_400_000);
        const approved = await db.transaction(async (tx) => {
          const [request] = await tx
            .select()
            .from(betaAccessRequestsTable)
            .where(eq(betaAccessRequestsTable.id, id))
            .limit(1)
            .for("update");
          if (!request || request.status !== "pending" || request.archivedAt)
            return null;
          const roleMap: Record<string, "clinician" | "parent" | "teacher"> = {
            Clinician: "clinician",
            Parent: "parent",
            Teacher: "teacher",
          };
          const role = roleMap[request.requestedRole];
          if (!role) return null;
          const [organization] = await tx
            .select()
            .from(organizationsTable)
            .where(
              and(
                eq(organizationsTable.id, organizationId),
                isNull(organizationsTable.archivedAt),
              ),
            )
            .limit(1)
            .for("update");
          const [child] = await tx
            .select({ id: childProfilesTable.id })
            .from(childProfilesTable)
            .where(
              and(
                eq(childProfilesTable.id, childId),
                eq(childProfilesTable.organizationId, organizationId),
                isNull(childProfilesTable.archivedAt),
              ),
            )
            .limit(1);
          const [controls] = await tx
            .select()
            .from(betaControlsTable)
            .where(eq(betaControlsTable.id, 1))
            .limit(1);
          if (
            !organization ||
            organization.disabledAt ||
            !organization.betaApprovedAt ||
            !child ||
            !controls?.enabled
          )
            return null;
          const dayAgo = new Date(Date.now() - 86_400_000);
          const recent = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(careTeamInvitationsTable)
            .where(
              and(
                eq(careTeamInvitationsTable.organizationId, organizationId),
                gte(careTeamInvitationsTable.createdAt, dayAgo),
              ),
            );
          if (
            (controls?.invitationLimitPerDay ?? 25) <= (recent[0]?.count ?? 0)
          )
            return null;
          const [existingInvite] = await tx
            .select({ id: careTeamInvitationsTable.id })
            .from(careTeamInvitationsTable)
            .where(
              and(
                eq(careTeamInvitationsTable.organizationId, organizationId),
                eq(careTeamInvitationsTable.invitedEmail, request.email),
                eq(careTeamInvitationsTable.status, "pending"),
              ),
            )
            .limit(1);
          if (existingInvite) return null;
          const [invite] = await tx
            .insert(careTeamInvitationsTable)
            .values({
              organizationId,
              childId,
              invitedEmail: request.email,
              invitedRole: role,
              invitedByUserId: actor.userId,
              tokenHash: invitationTokenHash(token),
              expiresAt,
              accessScope: "child",
              childScope: [childId],
            })
            .returning();
          if (!invite) return null;
          const [updated] = await tx
            .update(betaAccessRequestsTable)
            .set({
              status: "approved",
              reviewedAt: new Date(),
              reviewedByUserId: actor.userId,
              approvedOrganizationId: organizationId,
              invitationId: invite.id,
            })
            .where(eq(betaAccessRequestsTable.id, id))
            .returning();
          return updated ? { request: updated, invite } : null;
        });
        if (!approved) {
          res
            .status(409)
            .json({
              error:
                "This request cannot be approved for that organization and child.",
            });
          return;
        }
        await writeSecurityAudit({
          actor,
          action: "BETA_REQUEST_APPROVED",
          targetType: "beta_access_request",
          targetId: id,
        });
        res.json({
          id: approved.request.id,
          status: approved.request.status,
          invitationPath: `/sign-up?token=${encodeURIComponent(token)}`,
          expiresAt: approved.invite.expiresAt?.toISOString(),
        });
        return;
      }
      const update =
        action === "archive"
          ? { archivedAt: new Date() }
          : {
              status: "rejected",
              reviewedAt: new Date(),
              reviewedByUserId: actor.userId,
            };
      const [request] = await db
        .update(betaAccessRequestsTable)
        .set(update)
        .where(eq(betaAccessRequestsTable.id, id))
        .returning();
      if (!request) {
        res.status(404).json({ error: "Request not found." });
        return;
      }
      await writeSecurityAudit({
        actor,
        action: `BETA_REQUEST_${action.toUpperCase()}`,
        targetType: "beta_access_request",
        targetId: id,
      });
      res.json({ id: request.id, status: request.status });
    },
  );
}

router.get("/admin/beta-controls", async (req, res): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;
  let [controls] = await db
    .select()
    .from(betaControlsTable)
    .where(eq(betaControlsTable.id, 1))
    .limit(1);
  if (!controls)
    [controls] = await db
      .insert(betaControlsTable)
      .values({ id: 1 })
      .onConflictDoNothing()
      .returning();
  if (!controls)
    [controls] = await db
      .select()
      .from(betaControlsTable)
      .where(eq(betaControlsTable.id, 1))
      .limit(1);
  res.json(controls);
});
router.patch("/admin/beta-controls", async (req, res): Promise<void> => {
  const actor = requireSuperAdmin(req, res);
  if (!actor) return;
  const body = req.body as Record<string, unknown>;
  const values: Record<string, unknown> = { updatedByUserId: actor.userId };
  if (typeof body.enabled === "boolean") values.enabled = body.enabled;
  if (typeof body.defaultCohort === "string" || body.defaultCohort === null)
    values.defaultCohort = body.defaultCohort;
  if (
    Number.isInteger(body.defaultOrganizationUserLimit) &&
    (body.defaultOrganizationUserLimit as number) > 0
  )
    values.defaultOrganizationUserLimit = body.defaultOrganizationUserLimit;
  if (
    Number.isInteger(body.invitationLimitPerDay) &&
    (body.invitationLimitPerDay as number) > 0
  )
    values.invitationLimitPerDay = body.invitationLimitPerDay;
  if (
    typeof body.currentNoticeVersion === "string" &&
    body.currentNoticeVersion.trim()
  )
    values.currentNoticeVersion = body.currentNoticeVersion.trim().slice(0, 80);
  await db
    .insert(betaControlsTable)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: betaControlsTable.id, set: values });
  const [controls] = await db
    .select()
    .from(betaControlsTable)
    .where(eq(betaControlsTable.id, 1))
    .limit(1);
  await writeSecurityAudit({
    actor,
    action: "BETA_CONTROLS_UPDATED",
    targetType: "beta_controls",
    targetId: 1,
  });
  res.json(controls);
});

router.get("/invitations/validate", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token || token.length > 512) {
    res.status(400).json({ valid: false });
    return;
  }
  const [invite] = await db
    .select()
    .from(careTeamInvitationsTable)
    .where(eq(careTeamInvitationsTable.tokenHash, invitationTokenHash(token)))
    .limit(1);
  const valid = Boolean(
    invite &&
    invite.status === "pending" &&
    !invite.revokedAt &&
    invite.expiresAt &&
    invite.expiresAt > new Date(),
  );
  // Do not disclose email, organization, or child identity to a bearer.
  res.json(
    valid
      ? {
          valid: true,
          role: invite!.invitedRole,
          expiresAt: invite!.expiresAt!.toISOString(),
        }
      : { valid: false },
  );
});

router.post("/invitations/accept", async (req, res): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const auth = getAuth(req);
  if (!auth.userId || !token || token.length > 512) {
    res
      .status(400)
      .json({ error: "A signed-in account and invitation are required." });
    return;
  }
  const clerkUser = await clerkClient.users.getUser(auth.userId);
  const verified = clerkUser.emailAddresses.find(
    (entry) => entry.verification?.status === "verified" && entry.emailAddress,
  );
  if (!verified) {
    res
      .status(403)
      .json({
        error:
          "Verify your Clerk email address before accepting an invitation.",
      });
    return;
  }
  const email = verified.emailAddress.toLowerCase();
  const hash = invitationTokenHash(token);
  const result = await db.transaction(async (tx) => {
    // PostgreSQL row lock prevents two concurrent acceptances from both winning.
    await tx.execute(
      sql`SELECT id FROM care_team_invitations WHERE token_hash = ${hash} FOR UPDATE`,
    );
    const [invite] = await tx
      .select()
      .from(careTeamInvitationsTable)
      .where(eq(careTeamInvitationsTable.tokenHash, hash))
      .limit(1);
    if (
      !invite ||
      invite.status !== "pending" ||
      invite.revokedAt ||
      !invite.expiresAt ||
      invite.expiresAt <= new Date() ||
      invite.invitedEmail.toLowerCase() !== email
    )
      return null;
    const [org] = await tx
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, invite.organizationId))
      .limit(1)
      .for("update");
    if (!org || org.disabledAt || org.archivedAt || !org.betaApprovedAt)
      return null;
    const [controls] = await tx
      .select()
      .from(betaControlsTable)
      .where(eq(betaControlsTable.id, 1))
      .limit(1);
    if (!controls?.enabled) return null;
    const [existing] = await tx
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.identityProvider, "clerk"),
          eq(usersTable.providerSubject, auth.userId),
        ),
      )
      .limit(1);
    const userId = existing?.id ?? `clerk_${auth.userId}`;
    if (existing?.disabledAt) return null;
    const roleMap: Record<
      string,
      "clinician" | "parent" | "teacher" | "admin"
    > = {
      clinician: "clinician",
      slp: "clinician",
      parent: "parent",
      teacher: "teacher",
      admin: "admin",
      administrator: "admin",
    };
    const membershipRole = roleMap[invite.invitedRole.toLowerCase()];
    if (!membershipRole || membershipRole === "admin") return null;
    if (!existing)
      await tx
        .insert(usersTable)
        .values({
          id: userId,
          identityProvider: "clerk",
          providerSubject: auth.userId,
          displayName: clerkUser.fullName || clerkUser.username || email,
          email,
          betaApprovedAt: new Date(),
          betaCohort: org.betaCohort,
        });
    else
      await tx
        .update(usersTable)
        .set({
          displayName:
            clerkUser.fullName || clerkUser.username || existing.displayName,
          email,
          betaApprovedAt: new Date(),
          betaCohort: org.betaCohort,
        })
        .where(eq(usersTable.id, userId));
    const [existingMembership] = await tx
      .select({ active: organizationMembershipsTable.active })
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.organizationId, org.id),
          eq(organizationMembershipsTable.userId, userId),
        ),
      )
      .limit(1);
    const activeCount = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.organizationId, org.id),
          eq(organizationMembershipsTable.active, true),
        ),
      );
    const membershipLimit =
      org.betaUserLimit ?? controls?.defaultOrganizationUserLimit ?? null;
    if (
      existingMembership?.active !== true &&
      membershipLimit !== null &&
      (activeCount[0]?.count ?? 0) >= membershipLimit
    )
      return null;
    await tx
      .insert(organizationMembershipsTable)
      .values({
        organizationId: org.id,
        userId,
        role: membershipRole,
        active: true,
      })
      .onConflictDoUpdate({
        target: [
          organizationMembershipsTable.organizationId,
          organizationMembershipsTable.userId,
        ],
        set: { role: membershipRole, active: true },
      });
    const scopedChildren = invite.childScope.length
      ? invite.childScope
      : [invite.childId];
    const validChildren = await tx
      .select({ id: childProfilesTable.id })
      .from(childProfilesTable)
      .where(
        and(
          eq(childProfilesTable.organizationId, org.id),
          inArray(childProfilesTable.id, scopedChildren),
          isNull(childProfilesTable.archivedAt),
        ),
      );
    if (validChildren.length !== new Set(scopedChildren).size) return null;
    for (const childId of scopedChildren)
      await tx
        .insert(childCareTeamMembershipsTable)
        .values({ childId, userId, role: membershipRole, active: true })
        .onConflictDoUpdate({
          target: [
            childCareTeamMembershipsTable.childId,
            childCareTeamMembershipsTable.userId,
          ],
          set: { role: membershipRole, active: true },
        });
    const [accepted] = await tx
      .update(careTeamInvitationsTable)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUserId: userId,
      })
      .where(eq(careTeamInvitationsTable.id, invite.id))
      .returning();
    return accepted;
  });
  if (!result) {
    res.status(403).json({ error: "This invitation cannot be accepted." });
    return;
  }
  res.json({
    accepted: true,
    organizationId: result.organizationId,
    role: result.invitedRole,
  });
});

router.get("/beta-notice", async (req, res): Promise<void> => {
  const actor = betaActor(req);
  if (!actor) {
    res.status(401).json({ error: authenticationError(req) });
    return;
  }
  const [controls] = await db
    .select()
    .from(betaControlsTable)
    .where(eq(betaControlsTable.id, 1))
    .limit(1);
  const version = controls?.currentNoticeVersion ?? "1";
  const [notice] = await db
    .select()
    .from(betaNoticesTable)
    .where(eq(betaNoticesTable.version, version))
    .limit(1);
  const [acknowledgement] = await db
    .select({ id: betaNoticeAcknowledgementsTable.id })
    .from(betaNoticeAcknowledgementsTable)
    .where(
      and(
        eq(betaNoticeAcknowledgementsTable.userId, actor.userId),
        eq(betaNoticeAcknowledgementsTable.noticeVersion, version),
      ),
    )
    .limit(1);
  res.json({
    version,
    text:
      notice?.body ??
      "This private beta requires appropriate care-team authorization and safeguarding of confidential information.",
    acknowledged: Boolean(acknowledgement),
  });
});
router.post("/beta-notice/acknowledge", async (req, res): Promise<void> => {
  const actor = betaActor(req);
  if (!actor) {
    res.status(401).json({ error: authenticationError(req) });
    return;
  }
  const [controls] = await db
    .select()
    .from(betaControlsTable)
    .where(eq(betaControlsTable.id, 1))
    .limit(1);
  const version = controls?.currentNoticeVersion ?? "1";
  await db
    .insert(betaNoticeAcknowledgementsTable)
    .values({ userId: actor.userId, noticeVersion: version })
    .onConflictDoNothing();
  res.json({ acknowledged: true, version });
});

router.post(
  "/admin/access-controls/revoke-invitations",
  async (req, res): Promise<void> => {
    const actor = requireSuperAdmin(req, res);
    if (!actor) return;
    await db
      .update(careTeamInvitationsTable)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revokedByUserId: actor.userId,
      })
      .where(eq(careTeamInvitationsTable.status, "pending"));
    await writeSecurityAudit({
      actor,
      action: "BETA_INVITATIONS_REVOKED",
      targetType: "care_team_invitation",
    });
    res.json({ revoked: true });
  },
);
router.post(
  "/admin/access-controls/:type/:id/:action",
  async (req, res): Promise<void> => {
    const actor = requireSuperAdmin(req, res);
    if (!actor) return;
    const type = rawParam(req.params.type),
      id = rawParam(req.params.id),
      action = rawParam(req.params.action);
    if (
      !id ||
      !["disable", "enable"].includes(action ?? "") ||
      !["users", "organizations"].includes(type ?? "")
    ) {
      res.status(400).json({ error: "Invalid access control request." });
      return;
    }
    const disabledAt = action === "disable" ? new Date() : null;
    if (type === "users")
      await db
        .update(usersTable)
        .set({ disabledAt })
        .where(eq(usersTable.id, id));
    else {
      const orgId = Number(id);
      if (!Number.isSafeInteger(orgId)) {
        res.status(400).json({ error: "Invalid organization." });
        return;
      }
      await db
        .update(organizationsTable)
        .set(
          action === "enable"
            ? { disabledAt: null, betaApprovedAt: new Date() }
            : { disabledAt },
        )
        .where(eq(organizationsTable.id, orgId));
    }
    await writeSecurityAudit({
      actor,
      action: `BETA_${type!.toUpperCase()}_${action!.toUpperCase()}`,
      targetType: type!,
      targetId: id,
    });
    res.json({ updated: true });
  },
);

export default router;
