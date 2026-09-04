import type {
  ClinicalDocumentation,
  ClinicalDocumentationList,
} from '@workspace/api-client-react';

export const replaceClinicalDocumentationInList = (
  current: ClinicalDocumentationList | undefined,
  updated: ClinicalDocumentation,
): ClinicalDocumentationList | undefined => {
  if (!current) return current;
  return {
    ...current,
    documents: current.documents.map((document) =>
      document.id === updated.id ? updated : document
    ),
  };
};