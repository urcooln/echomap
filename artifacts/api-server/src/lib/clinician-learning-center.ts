import { and, asc, eq } from "drizzle-orm";
import {
  clinicianLearningModulesTable,
  clinicianLearningResourcesTable,
  db,
  type ClinicianLearningSection,
} from "@workspace/db";

export const CLINICIAN_LEARNING_RESOURCE_KEY = "clinician-learning-center";
export const CLINICIAN_LEARNING_CONTENT_VERSION = "1.0";
export const CLINICIAN_LEARNING_DISCLAIMER =
  "Educational content only. This center does not make diagnoses. It does not assign NLA stages automatically. It does not generate treatment recommendations. Resources never modify child records, remain separate from clinical documentation, and do not replace clinician judgment.";
export const CLINICIAN_LEARNING_SAFETY_POINTS = [
  "Content is educational only.",
  "It does not make diagnoses or assign NLA stages automatically.",
  "It does not generate treatment recommendations.",
  "Resources never modify child records, remain separate from clinical documentation, and do not replace clinician judgment.",
] as const;

type Definition = {
  moduleKey: string;
  category: string;
  kind: "guide" | "quick_reference" | "case";
  position: number;
  title: string;
  summary: string;
  readingMinutes: number;
  tags: string[];
  workflowContexts: string[];
  sections: ClinicianLearningSection[];
};

const section = (
  heading: string,
  body: string,
  bullets: string[] = [],
  callout?: string,
): ClinicianLearningSection => ({ heading, body, bullets, callout });

const baseClinicianLearningModuleDefinitions: Definition[] = [
  {
    moduleKey: "childled-foundations",
    category: "ChildLed Foundations",
    kind: "guide",
    position: 1,
    title: "Turning Communication into Shared Understanding",
    summary: "How reviewed observations move through ChildLed without replacing clinical judgment.",
    readingMinutes: 6,
    tags: ["foundations", "evidence", "dictionary", "workflow"],
    workflowContexts: ["session", "child-language-review", "dictionary", "reports"],
    sections: [
      section("Why ChildLed exists", "Communication is observed across home, school, therapy, and everyday life. Important language can be scattered across recordings, notes, conversations, and team members.\n\nChildLed helps organize those observations into a shared, reviewable record so families, educators, and clinicians can recognize patterns over time while preserving clinician judgment."),
      section("The evidence boundary", "ChildLed separates captured language, clinician review, shared dictionary entries, AAC planning, and documentation so each transition remains visible and intentional.", ["Before language becomes part of a child's communication record:", "Language must be captured.", "Child language must be reviewed.", "Evidence must be confirmed.", "Working meanings must be considered in context.", "Clinical decisions remain under clinician control.", "Each step creates a clear trail from observation to documentation."]),
      section("What ChildLed helps organize", "ChildLed helps teams:", ["Track communication across settings.", "Preserve reviewed language examples.", "Build a shared communication dictionary.", "Identify recurring phrases and language patterns.", "Support AAC vocabulary planning.", "Compare communication over time.", "Create draft documentation from reviewed evidence."], "ChildLed organizes information so meaningful language is easier to find and discuss."),
      section("Shared understanding, not automatic conclusions", "ChildLed does not determine what a child means, diagnose a language profile, assign an NLA stage, select treatment targets, or make clinical decisions.\n\nA workflow status describes what has been reviewed—not what a clinician should conclude.\n\nClinical interpretation remains the responsibility of the care team."),
    ],
  },
  {
    moduleKey: "evidence-review-workflow",
    category: "Evidence Review Workflow",
    kind: "guide",
    position: 2,
    title: "Evidence Review Workflow",
    summary: "A step-by-step map from a recording to reviewed language and documentation.",
    readingMinutes: 7,
    tags: ["recording", "child language review", "phrase inbox", "session summary"],
    workflowContexts: ["session", "child-language-review", "phrase-inbox", "dictionary", "reports"],
    sections: [
      section("Review in sequence", "Complete each decision at the point where its evidence is available.", ["Review the transcript without treating diarization as identity.", "Classify each turn as Child, Not Child, Unsure, or Unintelligible.", "Use the Phrase Inbox to confirm meaning and dictionary intent.", "Create summaries only from reviewed evidence."]),
      section("Pause when uncertainty matters", "Unsure and Unintelligible are valid durable outcomes. They preserve uncertainty instead of pressuring a reviewer to guess."),
    ],
  },
  {
    moduleKey: "communication-dictionary-framework",
    category: "Communication Dictionary Framework",
    kind: "guide",
    position: 3,
    title: "Communication Dictionary Framework",
    summary: "Build useful entries from exact phrases, observed contexts, and revisable working meanings.",
    readingMinutes: 6,
    tags: ["dictionary", "working meaning", "context", "longitudinal tracking"],
    workflowContexts: ["dictionary", "phrase-inbox"],
    sections: [
      section("Preserve the exact phrase", "Keep the child’s observed language recognizable. Add context and a working meaning beside it rather than rewriting it into an adult interpretation."),
      section("Let meaning stay revisable", "A working meaning is a contextual hypothesis supported by observations across people and settings.", ["Name the observed context.", "Distinguish what happened from what may have been communicated.", "Update the entry when new reviewed evidence changes understanding."]),
    ],
  },
  {
    moduleKey: "nla-clinical-overview",
    category: "Natural Language Acquisition (NLA)",
    kind: "guide",
    position: 4,
    title: "NLA-Informed Observation",
    summary: "Use NLA concepts as an educational lens while preserving individualized clinical judgment.",
    readingMinutes: 8,
    tags: ["NLA", "stages", "mitigation", "mini-chunks", "scoring errors"],
    workflowContexts: ["child-language-review", "dictionary"],
    sections: [
      section("Observe before assigning", "NLA terminology can organize questions about form and flexibility, but a single utterance or transcript cannot establish a stage.", ["Consider patterns across contexts and time.", "Separate repetition, mitigation, and flexible generation from assumptions about intent.", "Document uncertainty when evidence is mixed."]),
      section("Common scoring errors", "Avoid assigning a stage from length alone, treating every repetition as a gestalt, or using a suggested label as a durable clinical decision.", [], "ChildLed never assigns an NLA stage automatically."),
    ],
  },
  {
    moduleKey: "gestalt-context-analysis",
    category: "Gestalt Language Processing",
    kind: "guide",
    position: 5,
    title: "Gestalts, Scripts, and Context Analysis",
    summary: "Review possible scripts through source, affect, context, and repeated use.",
    readingMinutes: 7,
    tags: ["gestalts", "scripts", "context", "working meanings"],
    workflowContexts: ["child-language-review", "dictionary"],
    sections: [
      section("A possible script is not a conclusion", "Repeated or media-linked language may be meaningful, but its function and working meaning still require contextual review."),
      section("Collect context consistently", "Note what happened before and after, communication partners, activity, affect, regulation, and how others responded.", ["Look for stable patterns across observations.", "Keep literal words separate from inferred meaning.", "Invite information from family and school without turning it into automatic evidence."]),
    ],
  },
  {
    moduleKey: "language-sampling-reliability",
    category: "Language Sampling",
    kind: "guide",
    position: 6,
    title: "Language Sampling & Reliability",
    summary: "Handle attribution, unclear speech, context, and reliability conservatively.",
    readingMinutes: 7,
    tags: ["language sample", "unintelligible", "reliability", "communication function"],
    workflowContexts: ["session", "child-language-review"],
    sections: [
      section("Preserve uncertainty", "Mark Unintelligible when words cannot be supported and Unsure when attribution or classification is unresolved. Do not repair unclear language into a guessed phrase."),
      section("Reliability considerations", "Review recording quality, context coverage, partner effects, and sampling length before generalizing beyond the observed session.", ["Use exact timestamps when available.", "Confirm partial transcriptions before they enter evidence.", "Treat speaker suggestions as navigation aids only."]),
    ],
  },
  {
    moduleKey: "aac-implementation-workflow",
    category: "AAC Implementation",
    kind: "guide",
    position: 7,
    title: "AAC Planning Workflow",
    summary: "Connect reviewed communication evidence to collaborative AAC planning without programming a device automatically.",
    readingMinutes: 7,
    tags: ["AAC", "vocabulary", "core", "fringe", "family collaboration"],
    workflowContexts: ["aac-planning", "dictionary"],
    sections: [
      section("Start from meaningful communication", "Vocabulary candidates should reflect reviewed communication, access needs, participation priorities, and the child’s current system—not frequency alone."),
      section("Keep planning collaborative", "Document a candidate, rationale, and decision status so the team can review it with the AAC user and relevant partners.", ["Balance personally meaningful fringe vocabulary with broadly useful core words.", "Protect access to existing vocabulary.", "Do not add, remove, or reorganize device vocabulary from ChildLed."]),
    ],
  },
  {
    moduleKey: "communication-partner-coaching",
    category: "Communication Partner Coaching",
    kind: "guide",
    position: 8,
    title: "Communication Partner Coaching",
    summary: "Support declarative language, reduced prompt dependency, and consistent environments.",
    readingMinutes: 6,
    tags: ["declarative language", "prompt dependency", "environmental supports", "consistency"],
    workflowContexts: ["session", "reports"],
    sections: [
      section("Shift from testing to connection", "Declarative comments can share information or perspective without requiring a correct response.", ["Replace rapid questions with observations.", "Build in wait time.", "Honor speech, AAC, gesture, movement, and silence."]),
      section("Coach the environment", "Consistency means shared principles and access supports—not identical scripts or rigid compliance across home, school, and therapy."),
    ],
  },
  {
    moduleKey: "nla-stage-guide",
    category: "Clinical Quick References",
    kind: "quick_reference",
    position: 9,
    title: "NLA Stage Guide (0–6)",
    summary: "A compact educational overview of the commonly described NLA progression.",
    readingMinutes: 4,
    tags: ["NLA", "stage 0", "stage 1", "stage 2", "stage 3", "stage 4", "stage 5", "stage 6"],
    workflowContexts: ["child-language-review", "dictionary"],
    sections: [
      section("Use as a reference, not a classifier", "Stage descriptions summarize a conceptual framework and must be considered alongside longitudinal samples and individualized assessment.", ["0: prelinguistic and multimodal communication.", "1: whole gestalts.", "2: mitigated gestalts and recombinations.", "3: isolated words and flexible combinations.", "4–6: increasingly complex self-generated grammar."]),
    ],
  },
  {
    moduleKey: "stage-two-mitigation-examples",
    category: "Clinical Quick References",
    kind: "quick_reference",
    position: 10,
    title: "Stage 2 Mitigation & Mini-Chunk Examples",
    summary: "Examples of possible recombination patterns to support careful observation.",
    readingMinutes: 4,
    tags: ["mitigation", "mini-chunks", "stage 2", "examples"],
    workflowContexts: ["child-language-review"],
    sections: [
      section("Look for reusable parts", "A possible mitigation combines recognizable portions of previously heard gestalts. Confirm the history and context before applying a label.", ["“Let’s get…” + a new ending.", "A familiar carrier phrase with a changed person, place, or action.", "Two known chunks recombined for the current moment."]),
    ],
  },
  {
    moduleKey: "working-meaning-examples",
    category: "Clinical Quick References",
    kind: "quick_reference",
    position: 11,
    title: "Working Meaning Examples",
    summary: "Write contextual, revisable meanings without overstating certainty.",
    readingMinutes: 3,
    tags: ["working meaning", "context", "examples"],
    workflowContexts: ["child-language-review", "phrase-inbox", "dictionary"],
    sections: [
      section("Prefer contextual language", "Describe the pattern and degree of confidence.", ["“Often observed when requesting continuation during movement play.”", "“May signal a need to pause when the room becomes loud; confirm across settings.”", "“Used during shared excitement in two reviewed sessions.”"], "Avoid definitive translations such as “This always means…” when evidence is contextual."),
    ],
  },
  {
    moduleKey: "communication-function-reference",
    category: "Clinical Quick References",
    kind: "quick_reference",
    position: 12,
    title: "Communication Function Reference",
    summary: "Observable prompts for considering functions while leaving the decision to the clinician.",
    readingMinutes: 3,
    tags: ["communication function", "request", "protest", "comment", "regulation"],
    workflowContexts: ["child-language-review", "dictionary"],
    sections: [
      section("Ask what changed in the interaction", "Consider whether the communication sought access, refusal, connection, information sharing, transition support, regulation, or self-advocacy.", ["What happened immediately before?", "How did partners respond?", "Did the pattern recur in similar contexts?"]),
    ],
  },
  {
    moduleKey: "declarative-imperative-examples",
    category: "Clinical Quick References",
    kind: "quick_reference",
    position: 13,
    title: "Declarative vs Imperative Language",
    summary: "Contrast language that shares information with language that directs or tests.",
    readingMinutes: 3,
    tags: ["declarative", "imperative", "questions", "comments"],
    workflowContexts: ["session", "reports"],
    sections: [
      section("Examples", "Use the distinction to reflect on interaction demands, not to ban questions or directions.", ["“What color is it?” → “I see a bright blue one.”", "“Say help.” → “I can help.”", "“Put it away.” → “It looks like cleanup time.”"]),
    ],
  },
  {
    moduleKey: "aac-vocabulary-checklist",
    category: "Clinical Quick References",
    kind: "quick_reference",
    position: 14,
    title: "AAC Vocabulary Selection Checklist",
    summary: "Questions to review before advancing a vocabulary candidate.",
    readingMinutes: 3,
    tags: ["AAC", "vocabulary", "checklist", "core", "fringe"],
    workflowContexts: ["aac-planning"],
    sections: [
      section("Before making a planning decision", "Confirm that the candidate is meaningful, accessible, collaborative, and supported by reviewed context.", ["Was it selected with the AAC user’s communication and autonomy in mind?", "Is the rationale based on reviewed evidence rather than frequency alone?", "Has the team considered existing vocabulary and motor/access patterns?", "Is the decision reversible and documented?"]),
    ],
  },
  {
    moduleKey: "child-language-review-decision-guide",
    category: "Clinical Quick References",
    kind: "quick_reference",
    position: 15,
    title: "Child Language Review Decision Guide",
    summary: "A concise reference for Child, Not Child, Unsure, and Unintelligible decisions.",
    readingMinutes: 3,
    tags: ["child language review", "child", "not child", "unsure", "unintelligible"],
    workflowContexts: ["child-language-review"],
    sections: [
      section("Choose the most supportable disposition", "Classify only what the available recording and context support.", ["Child: the turn is attributable to the child.", "Not Child: the turn is attributable to another speaker.", "Unsure: attribution or classification cannot be supported.", "Unintelligible: words cannot be transcribed reliably."], "Speaker suggestions and AI labels never complete this decision."),
    ],
  },
  {
    moduleKey: "case-from-transcript-to-dictionary",
    category: "Case-Based Learning",
    kind: "case",
    position: 16,
    title: "Case Example: Transcript to Dictionary",
    summary: "An anonymized demonstration of how one phrase moves through review.",
    readingMinutes: 6,
    tags: ["case example", "transcript", "working meaning", "dictionary"],
    workflowContexts: ["child-language-review", "phrase-inbox", "dictionary"],
    sections: [{
      heading: "Educational demonstration",
      body: "This fictionalized example illustrates workflow reasoning and is not a clinical template.",
      example: {
        transcript: "Child: “We gotta go!” during cleanup after looking toward the door.",
        childLanguageDecision: "Child — confirmed from the recording; no identity inference used.",
        workingMeaning: "May signal anticipation of leaving or a need for the transition to begin; review across contexts.",
        communicationFunction: "Possible transition support or self-advocacy; clinician selects only after contextual review.",
        dictionaryEntry: "Exact phrase preserved with cleanup context and a provisional working meaning.",
      },
    }],
  },
  {
    moduleKey: "case-dictionary-to-aac-summary",
    category: "Case-Based Learning",
    kind: "case",
    position: 17,
    title: "Case Example: Dictionary to AAC Planning & Summary",
    summary: "An anonymized demonstration of downstream decisions remaining separate.",
    readingMinutes: 6,
    tags: ["case example", "AAC planning", "session summary", "documentation"],
    workflowContexts: ["aac-planning", "reports"],
    sections: [{
      heading: "Educational demonstration",
      body: "The same reviewed phrase can inform separate planning and documentation decisions without automatically causing either.",
      example: {
        dictionaryEntry: "“Different one” observed across two reviewed sessions during selection activities.",
        aacPlanningDecision: "Candidate for team review because it may support choice-making; no device change occurs in ChildLed.",
        sessionSummary: "Observed the exact phrase in two selection contexts. Working meaning remains provisional and was not generalized beyond the sample.",
      },
    }],
  },
  {
    moduleKey: "childled-workflow-training",
    category: "ChildLed Workflow Training",
    kind: "guide",
    position: 18,
    title: "ChildLed Workflow Training",
    summary: "A practical map of recording, review, Phrase Inbox, dictionary, AAC planning, and documentation.",
    readingMinutes: 8,
    tags: ["recording", "phrase inbox", "dictionary", "AAC", "reports"],
    workflowContexts: ["session", "child-language-review", "phrase-inbox", "dictionary", "aac-planning", "reports"],
    sections: [
      section("Move forward deliberately", "Each ChildLed area answers a different question: what was captured, whose turn it was, what may be meaningful, what belongs in the shared dictionary, what warrants AAC planning, and what can be documented."),
      section("Use coaching when learning the workflow", "Workflow Coaching adds educational prompts beside relevant tools. It can be disabled at any time and never completes a decision."),
    ],
  },
];

const coverageTags: Record<string, string[]> = {
  "nla-clinical-overview": ["NLA overview", "stage decision support", "common scoring errors"],
  "gestalt-context-analysis": ["identifying gestalts", "working meanings", "script recognition", "longitudinal tracking"],
  "language-sampling-reliability": ["reviewing child utterances", "handling unintelligible speech", "context collection"],
  "aac-implementation-workflow": ["selecting vocabulary candidates", "dictionary-to-AAC handoff", "moving dictionary phrases to AAC planning"],
  "communication-partner-coaching": ["questions vs comments", "home-school-therapy consistency"],
  "childled-workflow-training": ["recording sessions", "Child Language Review", "Phrase Inbox", "dictionary management", "session summary creation", "reports and documentation"],
};

export const clinicianLearningModuleDefinitions: Definition[] = baseClinicianLearningModuleDefinitions.map((module) => ({
  ...module,
  tags: [...new Set([...module.tags, ...(coverageTags[module.moduleKey] ?? [])])],
  sections: module.sections.map((item, index) => ({
    ...item,
    sectionKey: `${module.moduleKey}-${index + 1}`,
    clinicalNote: item.clinicalNote ?? (index === 0 && module.kind !== "case"
      ? "Apply this educational reference to the available evidence and document your own clinical reasoning; ChildLed does not complete the decision."
      : undefined),
    checklist: item.checklist ?? (index === module.sections.length - 1
      ? [
          "Review the directly observed evidence and context.",
          "Record uncertainty instead of filling gaps with inference.",
          "Keep educational guidance separate from the child record and clinical decision.",
        ]
      : undefined),
    links: item.links ?? (module.moduleKey === "aac-implementation-workflow" && index === 0
      ? [{
          label: "ASHA AAC Practice Portal",
          url: "https://www.asha.org/practice-portal/clinical-topics/augmentative-and-alternative-communication/",
          kind: "article" as const,
        }]
      : undefined),
  })),
}));

export const resolveClinicianLearningSectionProgress = (
  sections: ClinicianLearningSection[],
  sectionKey: string,
  claimedPercent?: number,
) => {
  const index = sections.findIndex((section) => section.sectionKey === sectionKey);
  if (index < 0 || sections.length === 0) return null;
  const progressPercent = Math.round(((index + 1) / sections.length) * 100);
  if (claimedPercent !== undefined && claimedPercent !== progressPercent) return null;
  return { sectionKey, progressPercent };
};

const inFlight = new Map<number, Promise<{
  resource: typeof clinicianLearningResourcesTable.$inferSelect;
  modules: Array<typeof clinicianLearningModulesTable.$inferSelect>;
}>>();

export const ensureClinicianLearningCenter = async (organizationId: number) => {
  const prior = inFlight.get(organizationId);
  if (prior) return prior;
  const work = (async () => {
    await db.insert(clinicianLearningResourcesTable).values({
      organizationId,
      resourceKey: CLINICIAN_LEARNING_RESOURCE_KEY,
      title: "Clinician Learning Center",
      description: "Professional learning, clinical quick references, and workflow coaching for evidence-aware ChildLed practice.",
      contentVersion: CLINICIAN_LEARNING_CONTENT_VERSION,
    }).onConflictDoUpdate({
      target: [clinicianLearningResourcesTable.organizationId, clinicianLearningResourcesTable.resourceKey],
      set: {
        title: "Clinician Learning Center",
        description: "Professional learning, clinical quick references, and workflow coaching for evidence-aware ChildLed practice.",
        contentVersion: CLINICIAN_LEARNING_CONTENT_VERSION,
        updatedAt: new Date(),
      },
    });
    const [resource] = await db.select().from(clinicianLearningResourcesTable).where(and(
      eq(clinicianLearningResourcesTable.organizationId, organizationId),
      eq(clinicianLearningResourcesTable.resourceKey, CLINICIAN_LEARNING_RESOURCE_KEY),
    )).limit(1);
    if (!resource) throw new Error("Clinician Learning Center could not be initialized.");
    for (const module of clinicianLearningModuleDefinitions) {
      await db.insert(clinicianLearningModulesTable).values({ resourceId: resource.id, ...module })
        .onConflictDoUpdate({
          target: [clinicianLearningModulesTable.resourceId, clinicianLearningModulesTable.moduleKey],
          set: { ...module, updatedAt: new Date() },
        });
    }
    const modules = await db.select().from(clinicianLearningModulesTable)
      .where(eq(clinicianLearningModulesTable.resourceId, resource.id))
      .orderBy(asc(clinicianLearningModulesTable.position));
    return { resource, modules };
  })();
  inFlight.set(organizationId, work);
  try {
    return await work;
  } finally {
    inFlight.delete(organizationId);
  }
};

export const clinicianLearningHandbookText = () => [
  "CHILDLED CLINICIAN LEARNING CENTER",
  CLINICIAN_LEARNING_DISCLAIMER,
  "",
  ...clinicianLearningModuleDefinitions.flatMap((module) => [
    module.title.toUpperCase(),
    module.summary,
    ...module.sections.flatMap((item) => [
      item.heading,
      item.body ?? "",
      ...(item.bullets ?? []).map((bullet) => `- ${bullet}`),
      item.callout ? `Note: ${item.callout}` : "",
       item.clinicalNote ? `Clinical note: ${item.clinicalNote}` : "",
       ...(item.checklist ?? []).map((entry) => `[ ] ${entry}`),
       ...(item.links ?? []).map((link) => `${link.label}: ${link.url}`),
    ]),
    "",
  ]),
].filter(Boolean).join("\n");