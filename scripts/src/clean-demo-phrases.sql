BEGIN;

WITH target_gestalts AS (
  SELECT id, child_id, organization_id
  FROM clinical_gestalts
  WHERE organization_id = 1
    AND child_id = 1
    AND normalized_phrase IN (
      'parent journey a5fumk',
      'testing phrase hu2c6',
      'classroom helper test phrase xr0yat'
    )
),
deleted_facts AS (
  DELETE FROM clinical_knowledge_applied_facts
  WHERE gestalt_id IN (SELECT id FROM target_gestalts)
     OR (organization_id = 1 AND child_id = 1 AND normalized_phrase IN (
       'parent journey a5fumk',
       'testing phrase hu2c6',
       'classroom helper test phrase xr0yat'
     ))
),
deleted_notes AS (
  DELETE FROM gestalt_collaboration_notes
  WHERE gestalt_id IN (SELECT id FROM target_gestalts)
),
deleted_occurrences AS (
  DELETE FROM gestalt_occurrences
  WHERE gestalt_id IN (SELECT id FROM target_gestalts)
     OR (child_id = 1 AND normalized_phrase IN (
       'parent journey a5fumk',
       'testing phrase hu2c6',
       'classroom helper test phrase xr0yat'
     ))
),
deleted_observations AS (
  DELETE FROM clinical_observations
  WHERE organization_id = 1 AND child_id = 1
    AND body ILIKE ANY (ARRAY[
      '%Parent journey a5FuMk%',
      '%Testing phrase hu2c6%',
      '%classroom helper test phrase xr0YAT%'
    ])
)
DELETE FROM clinical_gestalts
WHERE id IN (SELECT id FROM target_gestalts);

COMMIT;