import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps student rows concise and reveals compliance by service", async () => {
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const pageStart = appSource.indexOf("function CaseloadOverviewPage(");
  const pageEnd = appSource.indexOf(
    "\nconst childProfileIncomplete",
    pageStart,
  );
  const pageSource = appSource.slice(pageStart, pageEnd);
  const desktopStudentStart = pageSource.indexOf(
    "data-testid={`overview-student-${student.childId}`}",
  );
  const desktopStudentEnd = pageSource.indexOf(
    "{expanded && student.serviceRequirements.length",
    desktopStudentStart,
  );
  const desktopStudentRow = pageSource.slice(
    desktopStudentStart,
    desktopStudentEnd,
  );
  const mobileStudentStart = pageSource.indexOf(
    "data-testid={`overview-student-mobile-${student.childId}`}",
  );
  const mobileStudentEnd = pageSource.indexOf(
    "{expanded ? (",
    mobileStudentStart,
  );
  const mobileStudentRow = pageSource.slice(
    mobileStudentStart,
    mobileStudentEnd,
  );

  assert.match(pageSource, /const \[expandedStudents, setExpandedStudents\]/);
  assert.match(pageSource, /useState<Set<number>>\(\s*\(\) => new Set\(\)/);
  assert.match(desktopStudentRow, /colSpan=\{4\}/);
  assert.match(desktopStudentRow, /active service/);
  assert.doesNotMatch(
    desktopStudentRow,
    /statusBadge\(student\.serviceStatus\)/,
  );
  assert.doesNotMatch(
    desktopStudentRow,
    /total(?:Required|Completed|Missed|Remaining)/,
  );
  assert.doesNotMatch(
    mobileStudentRow,
    /statusBadge\(student\.serviceStatus\)/,
  );
  assert.match(pageSource, /statusBadge\(service\.status\)/);
  assert.match(
    pageSource,
    /serviceStatus === "on_track" \|\| serviceStatus === "complete"/,
  );
  assert.match(appSource, /label: "Behind on sessions"/);
  assert.match(appSource, /label: "Below expected pace"/);
  assert.match(pageSource, /service\.sessionsCompleted/);
  assert.match(pageSource, /service\.sessionsMissed/);
  assert.match(pageSource, /service\.sessionsRemaining/);
  assert.match(pageSource, /service\.outstandingMakeups/);
  assert.match(pageSource, /service\.minutesCompleted/);
  assert.match(pageSource, /service\.minutesRemaining/);
  assert.match(pageSource, /service\.lastSessionDate/);
  assert.match(pageSource, /Sessions: \{service\.sessionsRemaining\}/);
  assert.match(pageSource, /Minutes: \{service\.minutesRemaining\} min/);
  assert.match(pageSource, /Makeups: \{service\.outstandingMakeups\}/);
  assert.match(pageSource, /Sessions delivered/);
  assert.match(pageSource, /Outstanding makeups/);
  assert.match(pageSource, /service\.customFrequencyDescription/);
  assert.match(pageSource, /onOpenCareTeam\(student\.childId\)/);
  assert.match(pageSource, /Choose a service to log/);
  assert.match(pageSource, /table-fixed/);
  assert.doesNotMatch(pageSource, /overflow-x-auto/);
});
