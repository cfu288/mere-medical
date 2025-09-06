// FHIR resource types that have corresponding card components for rendering
export const RENDERABLE_RESOURCE_TYPES = [
  'Observation',
  'DiagnosticReport',
  'MedicationStatement',
  'DocumentReference',
  'Condition',
  'Immunization',
  'Procedure',
  'Encounter',
] as const;
