export type ChildUtteranceReviewDisposition =
  | "pending"
  | "child"
  | "not_child"
  | "unsure"
  | "unintelligible"
  | "confirmed_gestalt"
  | "not_gestalt"
  | "context"
  | "unlabeled";

export type ChildUtteranceReviewGateRecord = {
  segmentId: number;
  disposition: string;
  meaning: string | null;
  intelligibilityReviewStatus?: string;
};

export type ChildUtteranceReviewGateSegment =
  | number
  | {
      id: number;
      intelligibility: string;
    };

/**
 * Child attribution establishes who spoke; this gate establishes whether the
 * clinician has made an explicit disposition for every Child turn.
 */
export const hasUnresolvedChildUtteranceReviews = (
  childSegments: ChildUtteranceReviewGateSegment[],
  reviews: ChildUtteranceReviewGateRecord[],
) => {
  const reviewBySegmentId = new Map(reviews.map((review) => [review.segmentId, review]));
  return childSegments.some((segment) => {
    const segmentId = typeof segment === "number" ? segment : segment.id;
    const review = reviewBySegmentId.get(segmentId);
    return !review || review.disposition === "pending";
  });
};

export const hasMeaningBackedConfirmedUtterance = (
  reviews: ChildUtteranceReviewGateRecord[],
) => reviews.some(
  (review) =>
    (review.disposition === "child" || review.disposition === "confirmed_gestalt")
    && Boolean(review.meaning?.trim()),
);

export const canCreatePhraseEvidenceFrom = (
  segment: { intelligibility: string },
  review: ChildUtteranceReviewGateRecord,
) =>
  (review.disposition === "child" || review.disposition === "confirmed_gestalt")
  && Boolean(review.meaning?.trim())
  && segment.intelligibility !== "unintelligible"
  && (
    segment.intelligibility !== "partially_intelligible"
    || review.intelligibilityReviewStatus === "confirmed"
  );