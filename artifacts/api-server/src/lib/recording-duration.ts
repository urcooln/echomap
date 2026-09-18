import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const probeRecordingDurationMilliseconds = async (
  audio: Buffer,
  contentType: string,
) => {
  if (!audio.length) throw new Error("The recording was empty.");
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
  const filePath = join(
    tmpdir(),
    `childled-recording-duration-${randomUUID()}.${extension}`,
  );
  try {
    await writeFile(filePath, audio, { mode: 0o600 });
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_type:format=duration",
        "-of",
        "json",
        filePath,
      ],
      { timeout: 30_000, maxBuffer: 16 * 1024 },
    );
    const details = JSON.parse(stdout) as {
      streams?: Array<{ codec_type?: string }>;
      format?: { duration?: string };
    };
    if (!details.streams?.some((stream) => stream.codec_type === "audio")) {
      throw new Error("The uploaded file has no audio stream.");
    }
    // Decode the stream so forged or missing container duration metadata cannot reduce usage.
    const decoded = await execFileAsync(
      "ffmpeg",
      [
        "-nostats",
        "-loglevel",
        "error",
        "-i",
        filePath,
        "-map",
        "0:a:0",
        "-f",
        "null",
        "-",
        "-progress",
        "pipe:1",
      ],
      { timeout: 300_000, maxBuffer: 64 * 1024 },
    );
    const times = [...decoded.stdout.matchAll(/^out_time_us=(\d+)$/gm)];
    const microseconds = Number(times.at(-1)?.[1]);
    const durationMilliseconds = Math.round(microseconds / 1_000);
    if (
      !Number.isSafeInteger(durationMilliseconds) ||
      durationMilliseconds < 1
    ) {
      throw new Error("The uploaded recording duration could not be verified.");
    }
    return durationMilliseconds;
  } finally {
    await rm(filePath, { force: true });
  }
};
