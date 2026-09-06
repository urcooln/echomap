import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  parentLearningModulesTable,
  parentLearningResourcesTable,
  type ParentLearningSection,
} from "@workspace/db";
import { storeClinicalKnowledgeObject } from "./clinical-knowledge-object-storage";

export const PARENT_LEARNING_RESOURCE_KEY = "parent-coaching-handbook";
export const PARENT_LEARNING_CONTENT_VERSION = "1.0";
export const PARENT_LEARNING_RESOURCE_TITLE = "ChildLed Parent Coaching Handbook";
export const PARENT_LEARNING_RESOURCE_SUBTITLE =
  "An affirming guide for supporting communication development at home.";
export const PARENT_LEARNING_PDF_FILENAME =
  "childled-parent-resources_1788210961456.pdf";
export const PARENT_LEARNING_DISCLAIMER =
  "These resources are educational invitations for connection and observation. They do not replace individualized therapy recommendations, diagnosis, treatment, or guidance from your child’s care team.";

type ParentLearningModuleDefinition = {
  moduleKey: string;
  position: number;
  title: string;
  summary: string;
  readingMinutes: number;
  sections: ParentLearningSection[];
  tryThisAtHome: string[];
};

export const parentLearningModuleDefinitions: ParentLearningModuleDefinition[] = [
  {
    moduleKey: "home-play-space-setup",
    position: 1,
    title: "Home Play Space Setup",
    summary: "Create a low-pressure place for child-led play, connection, and language to unfold.",
    readingMinutes: 4,
    sections: [
      {
        heading: "Start with the 3-2-1 play space",
        body: "A simple, uncluttered environment can make it easier to notice what draws your child in. Keep three activities available, include two familiar favorites your child can use independently, and add one novel mystery item without directing your child toward it.",
        bullets: [
          "3 activities available: display three distinct toy sets or activity zones.",
          "2 familiar favorites: choose activities your child already knows and enjoys.",
          "1 novel mystery: offer something new and let discovery happen naturally.",
        ],
      },
      {
        heading: "Narrate instead of testing",
        body: "Try decreasing commands and direct questions during play. Warm, declarative comments can join your child’s experience without asking them to perform.",
        bullets: [
          "Notice what is happening: “Oh, a big crash!”",
          "Share a possibility: “Let’s build a bridge!”",
          "Use neutral, playful language: “It’s time to run!”",
        ],
      },
      {
        heading: "Make room for silence",
        body: "Quiet moments can reduce sensory and auditory overload, give modeled language time to settle, and leave space for your child to initiate what is on their mind. Speak naturally and warmly, without expecting a repeat.",
        callout: "Connection comes before compliance. Follow your child’s lead and let their communication arrive in its own time.",
      },
    ],
    tryThisAtHome: [
      "Choose one small play area and set out three activity options before your child joins you.",
      "During ten minutes of play, replace questions with a few warm observations, then pause.",
      "Notice which familiar activity helps your child feel most comfortable and share that observation with the care team if useful.",
    ],
  },
  {
    moduleKey: "no-you-rule-perspective-shift",
    position: 2,
    title: "The No-You Rule & Perspective Shift Modeling",
    summary: "Model language from the child’s or shared perspective so repeated scripts can be useful in the moment.",
    readingMinutes: 5,
    sections: [
      {
        heading: "Why perspective matters",
        body: "When children learn language in whole, meaningful chunks, they may repeat exactly what they hear. A question like “Do you want water?” can be stored as the script for asking for water. Modeling from the speaker’s perspective can make the same chunk more usable.",
      },
      {
        heading: "Shift the words you model",
        body: "Instead of centering “you” questions or directions, try first-person, shared, neutral, or action-oriented frames.",
        bullets: [
          "“Are you hungry?” → “I’m hungry!” or “Time for a snack!”",
          "“Do you want to play trains?” → “Let’s play trains!” or “We can build a track!”",
          "“You need to go potty.” → “Gotta go potty.” or “Time to go.”",
          "“Do you like this one?” → “That’s so cool!” or “I love it!”",
          "“Be careful, don’t fall!” → “Gotta hold on!” or “Watch out!”",
          "“What did you make?” → “Oh look! We built a big house!”",
        ],
      },
      {
        heading: "Offer variety without pressure",
        body: "Across daily routines, naturally mix starter frames such as “Let’s…,” “It’s…,” “That’s…,” “We gotta…,” “Gotta…,” “I’m…,” and “I wanna….” Your child does not need to repeat them for the modeling to be meaningful.",
        callout: "These are invitations, not drills. Keep your voice natural, warm, and connected to what is happening together.",
      },
    ],
    tryThisAtHome: [
      "Pick one routine, such as snack or getting ready, and prepare two first-person or shared-perspective phrases.",
      "When you catch yourself asking a question, try turning it into a comment about your shared experience.",
      "Keep a note of language that felt natural for your family; do not track whether your child repeated it.",
    ],
  },
  {
    moduleKey: "media-detective-plan",
    position: 3,
    title: "Media Detective Plan",
    summary: "Look at the context, source, and emotional theme around a script instead of assuming its literal meaning.",
    readingMinutes: 5,
    sections: [
      {
        heading: "Scripting can carry meaning",
        body: "Delayed echolalia may come from a highly emotional or memorable moment in a show, song, movie, book, or conversation. The words may not be literal; the script may be connected to how the child feels or what they need.",
      },
      {
        heading: "Follow the three-step investigator protocol",
        bullets: [
          "Notice context and body language: what happened before and after, and what were your child’s actions, gaze, energy, and sensory-emotional cues?",
          "Trace the original source: list favorite media and ask siblings or familiar adults whether they recognize the line.",
          "Uncover the emotional theme: consider what the characters were feeling in that scene and whether that feeling fits the moment.",
        ],
      },
      {
        heading: "Search with care",
        body: "If a source remains a mystery, adults can independently search closed-caption and transcript databases. These services may contain mature content, so do not place raw search results in front of children.",
        bullets: [
          "Yarn and Playphrase can help match short spoken clips.",
          "Subzin and Popmystic can search film and television subtitles.",
        ],
        callout: "A possible source is a clue for conversation, not proof of what a child means. Keep noticing and checking in with the child and care team.",
      },
    ],
    tryThisAtHome: [
      "When a script appears, jot down one detail from just before and just after it rather than interpreting it immediately.",
      "Make a short list of favorite shows, songs, books, and family phrases to revisit together.",
      "If you search for a source, do it privately as an adult and bring only the safe, relevant context back to your family conversation.",
    ],
  },
  {
    moduleKey: "supporting-hyperlexic-glps",
    position: 4,
    title: "Supporting Hyperlexic GLPs",
    summary: "Connect strong visual decoding interests with shared, flexible meaning-making.",
    readingMinutes: 5,
    sections: [
      {
        heading: "Honor visual interests",
        body: "Some gestalt language processors are also hyperlexic and may be deeply interested in letters, numbers, and words. A child may decode text beautifully while still building flexible oral language and comprehension.",
      },
      {
        heading: "Explore shared literacy",
        bullets: [
          "Use wordless picture books to open space for shared observation and natural oral language.",
          "Try conversation-rich books, such as the Elephant & Piggie series, with expressive dialogue and character perspectives.",
          "Create personalized books with photos of favorite people, sensory joys, and language your child already uses or hears naturally.",
          "Turn on closed captions so spoken language and written words can be experienced together.",
        ],
      },
      {
        heading: "Keep reading interactive",
        body: "Reading is a shared experience, not a performance test. Point to pictures, reference details, enjoy the characters, and model light emotional commentary. Avoid asking a child to read aloud to prove comprehension.",
        callout: "Follow curiosity, celebrate shared joy, and let meaning grow through connection.",
      },
    ],
    tryThisAtHome: [
      "Choose a wordless book and spend a few minutes commenting on what you both notice.",
      "Make one simple personalized page using a family photo and a phrase that naturally fits the moment.",
      "Enable captions during one favorite video and notice whether your child enjoys the added visual information.",
    ],
  },
];

const resourceSourcePath = () =>
  path.resolve(process.cwd(), "dist", "parent-resources", PARENT_LEARNING_PDF_FILENAME);

const resourcesInFlight = new Map<number, Promise<{
  resource: typeof parentLearningResourcesTable.$inferSelect;
  modules: typeof parentLearningModulesTable.$inferSelect[];
}>>();

export const ensureParentLearningCenter = async (organizationId: number) => {
  const existing = resourcesInFlight.get(organizationId);
  if (existing) return existing;

  const provisioning = (async () => {
    await db.insert(parentLearningResourcesTable).values({
      organizationId,
      resourceKey: PARENT_LEARNING_RESOURCE_KEY,
      title: PARENT_LEARNING_RESOURCE_TITLE,
      subtitle: PARENT_LEARNING_RESOURCE_SUBTITLE,
      contentVersion: PARENT_LEARNING_CONTENT_VERSION,
    }).onConflictDoNothing({
      target: [parentLearningResourcesTable.organizationId, parentLearningResourcesTable.resourceKey],
    });

    const [resource] = await db.select().from(parentLearningResourcesTable).where(and(
      eq(parentLearningResourcesTable.organizationId, organizationId),
      eq(parentLearningResourcesTable.resourceKey, PARENT_LEARNING_RESOURCE_KEY),
    )).limit(1);
    if (!resource) throw new Error("Parent Learning Center resource could not be initialized.");

    for (const module of parentLearningModuleDefinitions) {
      await db.insert(parentLearningModulesTable).values({
        resourceId: resource.id,
        moduleKey: module.moduleKey,
        position: module.position,
        title: module.title,
        summary: module.summary,
        readingMinutes: module.readingMinutes,
        sections: module.sections,
        tryThisAtHome: module.tryThisAtHome,
      }).onConflictDoNothing({
        target: [parentLearningModulesTable.resourceId, parentLearningModulesTable.moduleKey],
      });
    }

    let currentResource = resource;
    if (!currentResource.pdfObjectPath) {
      const data = await readFile(resourceSourcePath());
      const stored = await storeClinicalKnowledgeObject({
        organizationId,
        key: `parent-resources/${PARENT_LEARNING_PDF_FILENAME}`,
        contentType: "application/pdf",
        data,
      });
      const [updated] = await db.update(parentLearningResourcesTable).set({
        pdfObjectPath: stored.key,
        pdfContentType: stored.contentType,
        pdfSizeBytes: stored.sizeBytes,
        updatedAt: new Date(),
      }).where(and(
        eq(parentLearningResourcesTable.id, resource.id),
        eq(parentLearningResourcesTable.organizationId, organizationId),
      )).returning();
      if (updated) currentResource = updated;
    }

    const modules = await db.select().from(parentLearningModulesTable).where(
      eq(parentLearningModulesTable.resourceId, currentResource.id),
    ).orderBy(asc(parentLearningModulesTable.position));
    return { resource: currentResource, modules };
  })();

  resourcesInFlight.set(organizationId, provisioning);
  try {
    return await provisioning;
  } finally {
    resourcesInFlight.delete(organizationId);
  }
};