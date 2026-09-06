import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  clinicalKnowledgeChunksTable,
  clinicalKnowledgeIngestionJobsTable,
  clinicalKnowledgeSourcesTable,
  clinicalKnowledgeSourceVersionsTable,
  db,
} from "@workspace/db";
import { storeClinicalKnowledgeObject } from "./clinical-knowledge-object-storage";
import { encryptAtRest } from "./encryption";
import {
  chunkKnowledgeSource,
  extractKnowledgeSourceText,
  KNOWLEDGE_SOURCE_ADAPTER_VERSION,
} from "./clinical-knowledge-processing";
import { runtimeConfig } from "./runtime-config";
import { logger } from "./logger";

type PackagedKnowledgeSource = {
  filename: string;
  title: string;
  citation: string;
  tags: string[];
};

const packagedSources: PackagedKnowledgeSource[] = [
  {
    filename:
      "ChildLed_Clinical_Knowledge_Base__A_Comprehensive_GLP_Reference_1787509206363.pdf",
    title:
      "ChildLed Clinical Knowledge Base: A Comprehensive GLP Reference Guide",
    citation:
      "ChildLed Clinical Knowledge Base: A Comprehensive GLP Reference Guide",
    tags: [
      "GLP",
      "NLA",
      "gestalts",
      "communication functions",
      "parent coaching",
    ],
  },
  {
    filename:
      "ChildLed_AI__Clinical_Assessment_Protocol_&_Goal_Template_Manua_1787509198760.pdf",
    title:
      "ChildLed AI: Clinical Assessment Protocol & Goal Template Manual for Gestalt Language Processors",
    citation:
      "ChildLed AI: Clinical Assessment Protocol & Goal Template Manual for Gestalt Language Processors",
    tags: ["GLP", "assessment", "SOAP", "goals", "mitigation"],
  },
];

const encrypted = (value: string) =>
  encryptAtRest(Buffer.from(value, "utf8")).toString("base64");

const sourcePaths = (filename: string) => [
  path.resolve(process.cwd(), "dist", "clinical-knowledge", filename),
  path.resolve(process.cwd(), "clinical-knowledge", filename),
  path.resolve(process.cwd(), "attached_assets", filename),
  path.resolve(process.cwd(), "..", "attached_assets", filename),
  path.resolve(process.cwd(), "..", "..", "attached_assets", filename),
];

const readPackagedSource = async (filename: string) => {
  const missingPaths: string[] = [];

  for (const sourcePath of sourcePaths(filename)) {
    try {
      return await readFile(sourcePath);
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        missingPaths.push(sourcePath);
        continue;
      }

      throw err;
    }
  }

  const error = new Error(
    `Packaged clinical knowledge source was not found: ${filename}`,
  ) as NodeJS.ErrnoException & { attemptedPaths: string[] };
  error.code = "ENOENT";
  error.attemptedPaths = missingPaths;
  throw error;
};

const activeProvisioning = new Map<number, Promise<void>>();

/**
 * Packaged clinical references are provisioned per organization using the same
 * private store and encrypted-chunk contract as clinician uploads. This runs
 * only after a verified clinician has an application organization membership.
 */
export const ensurePackagedClinicalKnowledge = async (
  organizationId: number,
  userId: string,
) => {
  const inFlight = activeProvisioning.get(organizationId);
  if (inFlight) return inFlight;
  const provisioning = (async () => {
    for (const packaged of packagedSources) {
      let data: Buffer;
      try {
        data = await readPackagedSource(packaged.filename);
      } catch (err: any) {
        if (err?.code === "ENOENT") {
          logger.warn(
            { filename: packaged.filename, attemptedPaths: err.attemptedPaths },
            "Packaged clinical knowledge missing; skipping provisioning in this environment",
          );
          continue;
        }
        throw err;
      }
      let extracted;
      try {
        extracted = await extractKnowledgeSourceText(data, "application/pdf");
      } catch (err: any) {
        if (err?.code === "SOURCE_UNREADABLE") {
          logger.warn(
            { filename: packaged.filename },
            "Packaged clinical knowledge is unreadable; skipping provisioning",
          );
          continue;
        }
        throw err;
      }
      const existing = await db
        .select({ id: clinicalKnowledgeSourceVersionsTable.id })
        .from(clinicalKnowledgeSourceVersionsTable)
        .innerJoin(
          clinicalKnowledgeSourcesTable,
          eq(
            clinicalKnowledgeSourceVersionsTable.sourceId,
            clinicalKnowledgeSourcesTable.id,
          ),
        )
        .where(
          and(
            eq(clinicalKnowledgeSourcesTable.organizationId, organizationId),
            eq(
              clinicalKnowledgeSourceVersionsTable.checksum,
              extracted.checksum,
            ),
          ),
        )
        .limit(1);
      if (existing[0]) continue;
      const chunks = chunkKnowledgeSource(extracted.text);
      if (!chunks.length) {
        throw new Error(
          `Packaged clinical source ${packaged.title} has no readable chunks.`,
        );
      }
      const stored = await storeClinicalKnowledgeObject({
        organizationId,
        key: `packaged/${packaged.filename}`,
        contentType: "application/pdf",
        data,
      });
      await db.transaction(async (tx) => {
        const [source] = await tx
          .insert(clinicalKnowledgeSourcesTable)
          .values({
            organizationId,
            title: packaged.title,
            sourceType: "Uploaded clinical PDF",
            authorship: "ChildLed clinical reference",
            citation: packaged.citation,
            tags: packaged.tags,
            status: "processing",
            createdByUserId: userId,
          })
          .returning();
        const [version] = await tx
          .insert(clinicalKnowledgeSourceVersionsTable)
          .values({
            sourceId: source.id,
            version: 1,
            storageDriver: runtimeConfig.audioStorage.driver,
            storageKey: stored.key,
            contentType: stored.contentType,
            sizeBytes: stored.sizeBytes,
            checksum: extracted.checksum,
            extractorId: KNOWLEDGE_SOURCE_ADAPTER_VERSION,
            extractionStatus: "processing",
            createdByUserId: userId,
          })
          .returning();
        const [job] = await tx
          .insert(clinicalKnowledgeIngestionJobsTable)
          .values({
            sourceVersionId: version.id,
            adapterId: KNOWLEDGE_SOURCE_ADAPTER_VERSION,
          })
          .returning();
        await tx.insert(clinicalKnowledgeChunksTable).values(
          chunks.map((chunk) => ({
            sourceId: source.id,
            sourceVersionId: version.id,
            ordinal: chunk.ordinal,
            page: chunk.page,
            section: chunk.section,
            encryptedText: encrypted(chunk.text),
          })),
        );
        await tx
          .update(clinicalKnowledgeSourceVersionsTable)
          .set({ extractionStatus: "ready" })
          .where(eq(clinicalKnowledgeSourceVersionsTable.id, version.id));
        await tx
          .update(clinicalKnowledgeSourcesTable)
          .set({ status: "ready", activeVersionId: version.id })
          .where(eq(clinicalKnowledgeSourcesTable.id, source.id));
        await tx
          .update(clinicalKnowledgeIngestionJobsTable)
          .set({ status: "complete", completedAt: new Date() })
          .where(eq(clinicalKnowledgeIngestionJobsTable.id, job.id));
      });
    }
  })();
  activeProvisioning.set(organizationId, provisioning);
  try {
    await provisioning;
  } finally {
    activeProvisioning.delete(organizationId);
  }
};
