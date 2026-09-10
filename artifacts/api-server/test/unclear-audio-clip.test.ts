import assert from "node:assert/strict";
import test from "node:test";
import {
  extractUnclearAudioClip,
  unclearAudioClipWindow,
} from "../src/lib/unclear-audio-clip";

const silentWav = (durationSeconds: number) => {
  const sampleRate = 16_000;
  const sampleCount = sampleRate * durationSeconds;
  const dataSize = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  return wav;
};

test("pads an unclear moment without seeking before the recording", () => {
  assert.deepEqual(unclearAudioClipWindow(100, 800), {
    startMilliseconds: 0,
    clipDurationMilliseconds: 1_150,
  });
});

test("caps retained unclear clips at ten seconds", () => {
  assert.deepEqual(unclearAudioClipWindow(20_000, 30_000), {
    startMilliseconds: 19_750,
    clipDurationMilliseconds: 10_000,
  });
});

test("extracts a playable WAV clip with ffmpeg", async () => {
  const clip = await extractUnclearAudioClip({
    audio: silentWav(2),
    startTimeMilliseconds: 500,
    durationMilliseconds: 500,
  });
  assert.equal(clip.contentType, "audio/wav");
  assert.equal(clip.data.subarray(0, 4).toString("ascii"), "RIFF");
  assert.ok(clip.data.length > 44);
});
