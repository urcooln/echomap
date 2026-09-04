type LegacyNote = {
  id: number;
  gestaltId: number;
  authorUserId: string;
  body: string;
  createdAt: Date;
};

type ExistingObservation = {
  gestaltId: number;
  sourceNoteId: number | null;
  authorUserId: string;
  context: string;
  observedAt: Date;
};

const normalizeContext = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const calendarDay = (value: Date) => value.toISOString().slice(0, 10);

export const parseLegacyPhraseObservationNote = (
  note: Pick<LegacyNote, "body" | "createdAt">,
) => {
  const [heading = ""] = note.body.split("\n");
  const match = heading.match(/^(.+?) phrase observation · (.+?) · (.+)$/i);
  if (!match) return null;
  const parsedDate = new Date(match[3]!.trim());
  return {
    authorRole: match[1]!.trim(),
    context: match[2]!.trim(),
    observedAt: Number.isNaN(parsedDate.getTime()) ? note.createdAt : parsedDate,
  };
};

/**
 * Existing typed rows created alongside a historical note did not originally
 * carry a sourceNoteId. Match only on the strongest preserved provenance so
 * they are not offered for recovery a second time.
 */
export const legacyNoteHasTypedObservation = (
  note: LegacyNote,
  observations: ExistingObservation[],
) => {
  const parsed = parseLegacyPhraseObservationNote(note);
  if (!parsed) return false;
  return observations.some((observation) =>
    observation.sourceNoteId === note.id
    || (
      observation.gestaltId === note.gestaltId
      && observation.authorUserId === note.authorUserId
      && normalizeContext(observation.context) === normalizeContext(parsed.context)
      && calendarDay(observation.observedAt) === calendarDay(parsed.observedAt)
    ));
};