import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  chunkKnowledgeSource,
  extractKnowledgeSourceText,
} from "../src/lib/clinical-knowledge-processing";

const protocolPdf = path.resolve(
  process.cwd(),
  "../../attached_assets/ChildLed_AI__Clinical_Assessment_Protocol_&_Goal_Template_Manua_1787509198760.pdf",
);

test("the packaged GLP assessment PDF extracts page-aware, citable knowledge chunks", async () => {
  const extracted = await extractKnowledgeSourceText(await readFile(protocolPdf), "application/pdf");
  const chunks = chunkKnowledgeSource(extracted.text);
  assert.match(extracted.text, /SOAP/i);
  assert.match(extracted.text, /mitigation/i);
  assert.equal(extracted.checksum.length, 64);
  assert.ok(chunks.length > 4);
  assert.ok(chunks.some((chunk) => chunk.page !== null && chunk.page > 1));
  assert.ok(chunks.some((chunk) => /SOAP|Clinical Documentation/i.test(chunk.section ?? "")));
});