import assert from "node:assert/strict";
import test from "node:test";
import { duplicatePhraseMatch } from "../src/lib/dictionary-duplicate-matcher";

test("classifies explainable formatting differences", () => {
  assert.equal(duplicatePhraseMatch("Let's go", "Let's go")?.reason, "exact");
  assert.equal(duplicatePhraseMatch("LET'S GO", "let's go")?.reason, "capitalization");
  assert.equal(duplicatePhraseMatch("Let's go!", "Lets go")?.reason, "punctuation");
  assert.equal(duplicatePhraseMatch("Let's   go", "Let's go")?.reason, "whitespace");
});

test("permits conservative single-character spelling differences", () => {
  const match = duplicatePhraseMatch("I want train", "I want trains");
  assert.equal(match?.reason, "minor_spelling");
  assert.ok((match?.score ?? 0) > 0.9);
});

test("does not collapse clinically distinct phrase structures", () => {
  assert.equal(duplicatePhraseMatch("Go", "Let's go"), null);
  assert.equal(duplicatePhraseMatch("I need help", "Need help"), null);
  assert.equal(duplicatePhraseMatch("I want help", "I need help"), null);
});

test("suggests the requested Let's go variants pairwise", () => {
  const variants = ["Let's go!", "Lets go", "LET'S GO"];
  for (let left = 0; left < variants.length; left += 1) {
    for (let right = left + 1; right < variants.length; right += 1) {
      assert.ok(duplicatePhraseMatch(variants[left]!, variants[right]!));
    }
  }
});