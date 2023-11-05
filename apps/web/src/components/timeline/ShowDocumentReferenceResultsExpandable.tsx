import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { BundleEntry, DocumentReference } from 'fhir/r2';
import { useEffect, useState } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';
import { useClinicalDoc } from '../hooks/useClinicalDoc';
import { useConnectionDoc } from '../hooks/useConnectionDoc';

const CCDAStructureDefinition2_1 = {
  ADMISSION_DIAGNOSIS_SECTION: ['2.16.840.1.113883.10.20.22.2.43'],
  ADMISSION_MEDICATION: ['2.16.840.1.113883.10.20.22.4.36'],
  ADMISSION_MEDICATIONS_SECTION: ['2.16.840.1.113883.10.20.22.2.44'],
  ADVANCE_DIRECTIVES_SECTION: [
    '2.16.840.1.113883.10.20.22.2.21',
    '2.16.840.1.113883.10.20.22.2.21.1',
  ],
  ADVANCE_DIRECTIVE_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.48'],
  ADVANCE_DIRECTIVE_ORGANIZER: ['2.16.840.1.113883.10.20.22.4.108'],
  AGE_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.31'],
  ALLERGIES_AND_INTOLERANCES_SECTION: [
    '2.16.840.1.113883.10.20.22.2.6',
    '2.16.840.1.113883.10.20.22.2.6.1',
  ],
  ALLERGY_CONCERN_ACT: ['2.16.840.1.113883.10.20.22.4.30'],
  ALLERGY_INTOLERANCE_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.7'],
  ALLERGY_STATUS_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.28'],
  ANESTHESIA_SECTION: ['2.16.840.1.113883.10.20.22.2.25'],
  ASSESSMENT_AND_PLAN_SECTION: ['2.16.840.1.113883.10.20.22.2.9'],
  ASSESSMENT_SCALE_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.69'],
  ASSESSMENT_SCALE_SUPPORTING_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.86'],
  ASSESSMENT_SECTION: ['2.16.840.1.113883.10.20.22.2.8'],
  AUTHORIZATION_ACTIVITY: ['2.16.840.1.113883.10.20.1.19'],
  AUTHOR_PARTICIPATION: ['2.16.840.1.113883.10.20.22.4.119'],
  BIRTH_SEX_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.200'],
  BOUNDARY_OBSERVATION: ['2.16.840.1.113883.10.20.6.2.11'],
  BRAND_NAME_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.301'],
  CAREGIVER_CHARACTERISTICS: ['2.16.840.1.113883.10.20.22.4.72'],
  CARE_PLAN: ['2.16.840.1.113883.10.20.22.1.15'],
  CARE_TEAMS_SECTION: ['2.16.840.1.113883.10.20.22.2.500'],
  CARE_TEAM_MEMBER_ACT: ['2.16.840.1.113883.10.20.22.4.500.1'],
  CARE_TEAM_MEMBER_SCHEDULE_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.500.3'],
  CARE_TEAM_ORGANIZER: ['2.16.840.1.113883.10.20.22.4.500'],
  CARE_TEAM_TYPE_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.500.2'],
  CATALOG_NUMBER_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.302'],
  CHARACTERISTICS_OF_HOME_ENVIRONMENT: ['2.16.840.1.113883.10.20.22.4.109'],
  CHIEF_COMPLAINT_AND_REASON_FOR_VISIT_SECTION: [
    '2.16.840.1.113883.10.20.22.2.13',
  ],
  CHIEF_COMPLAINT_SECTION: ['1.3.6.1.4.1.19376.1.5.3.1.1.13.2.1'],
  CODE_OBSERVATIONS: ['2.16.840.1.113883.10.20.6.2.13'],
  COGNITIVE_STATUS_PROBLEM_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.73'],
  COMMENT_ACTIVITY: ['2.16.840.1.113883.10.20.22.4.64'],
  COMPANY_NAME_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.303'],
  COMPLICATIONS_SECTION: ['2.16.840.1.113883.10.20.22.2.37'],
  CONSULTATION_NOTE: ['2.16.840.1.113883.10.20.22.1.4'],
  CONTINUITY_OF_CARE_DOCUMENT: ['2.16.840.1.113883.10.20.22.1.2'],
  COURSE_OF_CARE_SECTION: ['2.16.840.1.113883.10.20.22.2.64'],
  COVERAGE_ACTIVITY: ['2.16.840.1.113883.10.20.22.4.60'],
  CRITICALITY_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.145'],
  CULTURAL_AND_RELIGIOUS_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.111'],
  DATE_OF_DIAGNOSIS_ACT: ['2.16.840.1.113883.10.20.22.4.502'],
  DECEASED_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.79'],
  DEVICE_IDENTIFIER_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.304'],
  DIAGNOSTIC_IMAGING_REPORT: ['2.16.840.1.113883.10.20.22.1.5'],
  DICOM_OBJECT_CATALOG_SECTION_DCM_121181: ['2.16.840.1.113883.10.20.6.1.1'],
  DISCHARGE_DIAGNOSIS_SECTION: ['2.16.840.1.113883.10.20.22.2.24'],
  DISCHARGE_DIET_SECTION: ['1.3.6.1.4.1.19376.1.5.3.1.3.33'],
  DISCHARGE_MEDICATION: ['2.16.840.1.113883.10.20.22.4.35'],
  DISCHARGE_MEDICATIONS_SECTION: [
    '2.16.840.1.113883.10.20.22.2.11',
    '2.16.840.1.113883.10.20.22.2.11.1',
  ],
  DISCHARGE_SUMMARY: ['2.16.840.1.113883.10.20.22.1.8'],
  DISTINCT_IDENTIFICATION_CODE_OBSERVATION: [
    '2.16.840.1.113883.10.20.22.4.308',
  ],
  DRUG_MONITORING_ACT: ['2.16.840.1.113883.10.20.22.4.123'],
  DRUG_VEHICLE: ['2.16.840.1.113883.10.20.22.4.24'],
  ENCOUNTERS_SECTION: [
    '2.16.840.1.113883.10.20.22.2.22',
    '2.16.840.1.113883.10.20.22.2.22.1',
  ],
  ENCOUNTER_ACTIVITY: ['2.16.840.1.113883.10.20.22.4.49'],
  ENCOUNTER_DIAGNOSIS: ['2.16.840.1.113883.10.20.22.4.80'],
  ENTRY_REFERENCE: ['2.16.840.1.113883.10.20.22.4.122'],
  ESTIMATED_DATE_OF_DELIVERY: ['2.16.840.1.113883.10.20.15.3.1'],
  EXPIRATION_DATE_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.309'],
  EXTERNAL_DOCUMENT_REFERENCE: ['2.16.840.1.113883.10.20.22.4.115'],
  FAMILY_HISTORY_DEATH_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.47'],
  FAMILY_HISTORY_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.46'],
  FAMILY_HISTORY_ORGANIZER: ['2.16.840.1.113883.10.20.22.4.45'],
  FAMILY_HISTORY_SECTION: ['2.16.840.1.113883.10.20.22.2.15'],
  FETUS_SUBJECT_CONTEXT: ['2.16.840.1.113883.10.20.6.2.3'],
  FINDINGS_SECTION: ['2.16.840.1.113883.10.20.6.1.2'],
  FUNCTIONAL_STATUS_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.67'],
  FUNCTIONAL_STATUS_ORGANIZER: ['2.16.840.1.113883.10.20.22.4.66'],
  FUNCTIONAL_STATUS_PROBLEM_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.68'],
  FUNCTIONAL_STATUS_SECTION: ['2.16.840.1.113883.10.20.22.2.14'],
  GENDER_IDENTITY_OBSERVATION: ['2.16.840.1.113883.10.20.34.3.45'],
  GENERAL_STATUS_SECTION: ['2.16.840.1.113883.10.20.2.5'],
  GOALS_SECTION: ['2.16.840.1.113883.10.20.22.2.60'],
  GOAL_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.121'],
  HANDOFF_COMMUNICATION_PARTICIPANTS: ['2.16.840.1.113883.10.20.22.4.141'],
  HEALTH_CONCERNS_SECTION: ['2.16.840.1.113883.10.20.22.2.58'],
  HEALTH_CONCERN_ACT: ['2.16.840.1.113883.10.20.22.4.132'],
  HEALTH_STATUS_EVALUATIONS_AND_OUTCOMES_SECTION: [
    '2.16.840.1.113883.10.20.22.2.61',
  ],
  HEALTH_STATUS_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.5'],
  HIGHEST_PRESSURE_ULCER_STAGE: ['2.16.840.1.113883.10.20.22.4.77'],
  HISTORY_AND_PHYSICAL: ['2.16.840.1.113883.10.20.22.1.3'],
  HISTORY_OF_PRESENT_ILLNESS_SECTION: ['1.3.6.1.4.1.19376.1.5.3.1.3.4'],
  HOSPITAL_ADMISSION_DIAGNOSIS: ['2.16.840.1.113883.10.20.22.4.34'],
  HOSPITAL_CONSULTATIONS_SECTION: ['2.16.840.1.113883.10.20.22.2.42'],
  HOSPITAL_COURSE_SECTION: ['1.3.6.1.4.1.19376.1.5.3.1.3.5'],
  HOSPITAL_DISCHARGE_DIAGNOSIS: ['2.16.840.1.113883.10.20.22.4.33'],
  HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION: ['2.16.840.1.113883.10.20.22.2.41'],
  HOSPITAL_DISCHARGE_PHYSICAL_SECTION: ['1.3.6.1.4.1.19376.1.5.3.1.3.26'],
  HOSPITAL_DISCHARGE_STUDIES_SUMMARY_SECTION: [
    '2.16.840.1.113883.10.20.22.2.16',
  ],
  IMMUNIZATIONS_SECTION: [
    '2.16.840.1.113883.10.20.22.2.2',
    '2.16.840.1.113883.10.20.22.2.2.1',
  ],
  IMMUNIZATION_ACTIVITY: ['2.16.840.1.113883.10.20.22.4.52'],
  IMMUNIZATION_MEDICATION_INFORMATION: ['2.16.840.1.113883.10.20.22.4.54'],
  IMMUNIZATION_REFUSAL_REASON: ['2.16.840.1.113883.10.20.22.4.53'],
  IMPLANTABLE_DEVICE_STATUS_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.305'],
  IMPLANTS_SECTION: ['2.16.840.1.113883.10.20.22.2.33'],
  INDICATION: ['2.16.840.1.113883.10.20.22.4.19'],
  INSTRUCTION: ['2.16.840.1.113883.10.20.22.4.20'],
  INSTRUCTIONS_SECTION: ['2.16.840.1.113883.10.20.22.2.45'],
  INTERVENTIONS_SECTION: ['2.16.840.1.113883.10.20.21.2.3'],
  INTERVENTION_ACT: ['2.16.840.1.113883.10.20.22.4.131'],
  LATEX_SAFETY_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.314'],
  LONGITUDINAL_CARE_WOUND_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.114'],
  LOT_OR_BATCH_NUMBER_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.315'],
  MANUFACTURING_DATE_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.316'],
  MEDICAL_EQUIPMENT_ORGANIZER: ['2.16.840.1.113883.10.20.22.4.135'],
  MEDICAL_EQUIPMENT_SECTION: ['2.16.840.1.113883.10.20.22.2.23'],
  MEDICAL_HISTORY_SECTION: ['2.16.840.1.113883.10.20.22.2.39'],
  MEDICATIONS_ADMINISTERED_SECTION: ['2.16.840.1.113883.10.20.22.2.38'],
  MEDICATIONS_SECTION: [
    '2.16.840.1.113883.10.20.22.2.1',
    '2.16.840.1.113883.10.20.22.2.1.1',
  ],
  MEDICATION_ACTIVITY: ['2.16.840.1.113883.10.20.22.4.16'],
  MEDICATION_DISPENSE: ['2.16.840.1.113883.10.20.22.4.18'],
  MEDICATION_FREE_TEXT_SIG: ['2.16.840.1.113883.10.20.22.4.147'],
  MEDICATION_INFORMATION: ['2.16.840.1.113883.10.20.22.4.23'],
  MEDICATION_SUPPLY_ORDER: ['2.16.840.1.113883.10.20.22.4.17'],
  MENTAL_STATUS_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.74'],
  MENTAL_STATUS_ORGANIZER: ['2.16.840.1.113883.10.20.22.4.75'],
  MENTAL_STATUS_SECTION: ['2.16.840.1.113883.10.20.22.2.56'],
  MODEL_NUMBER_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.317'],
  MRI_SAFETY_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.318'],
  NON_MEDICINAL_SUPPLY_ACTIVITY: ['2.16.840.1.113883.10.20.22.4.50'],
  NOTES_SECTION: ['2.16.840.1.113883.10.20.22.2.65'],
  NOTE_ACTIVITY: ['2.16.840.1.113883.10.20.22.4.202'],
  NUMBER_OF_PRESSURE_ULCERS_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.76'],
  NUTRITIONAL_STATUS_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.124'],
  NUTRITION_ASSESSMENT: ['2.16.840.1.113883.10.20.22.4.138'],
  NUTRITION_RECOMMENDATION: ['2.16.840.1.113883.10.20.22.4.130'],
  NUTRITION_SECTION: ['2.16.840.1.113883.10.20.22.2.57'],
  OBJECTIVE_SECTION: ['2.16.840.1.113883.10.20.21.2.1'],
  OBSERVER_CONTEXT: ['2.16.840.1.113883.10.20.6.2.4'],
  OPERATIVE_NOTE: ['2.16.840.1.113883.10.20.22.1.7'],
  OPERATIVE_NOTE_FLUIDS_SECTION: ['2.16.840.1.113883.10.20.7.12'],
  OPERATIVE_NOTE_SURGICAL_PROCEDURE_SECTION: ['2.16.840.1.113883.10.20.7.14'],
  OUTCOME_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.144'],
  PAST_MEDICAL_HISTORY: ['2.16.840.1.113883.10.20.22.2.20'],
  PATIENT_REFERRAL_ACT: ['2.16.840.1.113883.10.20.22.4.140'],
  PAYERS_SECTION: ['2.16.840.1.113883.10.20.22.2.18'],
  PHYSICAL_EXAM_SECTION: ['2.16.840.1.113883.10.20.2.10'],
  PHYSICIAN_OF_RECORD_PARTICIPANT: ['2.16.840.1.113883.10.20.6.2.2'],
  PHYSICIAN_READING_STUDY_PERFORMER: ['2.16.840.1.113883.10.20.6.2.1'],
  PLANNED_ACT: ['2.16.840.1.113883.10.20.22.4.39'],
  PLANNED_COVERAGE: ['2.16.840.1.113883.10.20.22.4.129'],
  PLANNED_ENCOUNTER: ['2.16.840.1.113883.10.20.22.4.40'],
  PLANNED_IMMUNIZATION_ACTIVITY: ['2.16.840.1.113883.10.20.22.4.120'],
  PLANNED_INTERVENTION_ACT: ['2.16.840.1.113883.10.20.22.4.146'],
  PLANNED_MEDICATION_ACTIVITY: ['2.16.840.1.113883.10.20.22.4.42'],
  PLANNED_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.44'],
  PLANNED_PROCEDURE: ['2.16.840.1.113883.10.20.22.4.41'],
  PLANNED_PROCEDURE_SECTION: ['2.16.840.1.113883.10.20.22.2.30'],
  PLANNED_SUPPLY: ['2.16.840.1.113883.10.20.22.4.43'],
  PLAN_OF_TREATMENT_SECTION: ['2.16.840.1.113883.10.20.22.2.10'],
  POLICY_ACTIVITY: ['2.16.840.1.113883.10.20.22.4.61'],
  POSTOPERATIVE_DIAGNOSIS_SECTION: ['2.16.840.1.113883.10.20.22.2.35'],
  POSTPROCEDURE_DIAGNOSIS: ['2.16.840.1.113883.10.20.22.4.51'],
  POSTPROCEDURE_DIAGNOSIS_SECTION: ['2.16.840.1.113883.10.20.22.2.36'],
  PRECONDITION_FOR_SUBSTANCE_ADMINISTRATION: [
    '2.16.840.1.113883.10.20.22.4.25',
  ],
  PREGNANCY_OBSERVATION: ['2.16.840.1.113883.10.20.15.3.8'],
  PREOPERATIVE_DIAGNOSIS: ['2.16.840.1.113883.10.20.22.4.65'],
  PREOPERATIVE_DIAGNOSIS_SECTION: ['2.16.840.1.113883.10.20.22.2.34'],
  PRESSURE_ULCER_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.70'],
  PRIORITY_PREFERENCE: ['2.16.840.1.113883.10.20.22.4.143'],
  PROBLEM_CONCERN_ACT: ['2.16.840.1.113883.10.20.22.4.3'],
  PROBLEM_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.4'],
  PROBLEM_SECTION: [
    '2.16.840.1.113883.10.20.22.2.5',
    '2.16.840.1.113883.10.20.22.2.5.1',
  ],
  PROBLEM_STATUS: ['2.16.840.1.113883.10.20.22.4.6'],
  PROCEDURES_SECTION: [
    '2.16.840.1.113883.10.20.22.2.7',
    '2.16.840.1.113883.10.20.22.2.7.1',
  ],
  PROCEDURE_ACTIVITY_ACT: ['2.16.840.1.113883.10.20.22.4.12'],
  PROCEDURE_ACTIVITY_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.13'],
  PROCEDURE_ACTIVITY_PROCEDURE: ['2.16.840.1.113883.10.20.22.4.14'],
  PROCEDURE_CONTEXT: ['2.16.840.1.113883.10.20.6.2.5'],
  PROCEDURE_DESCRIPTION_SECTION: ['2.16.840.1.113883.10.20.22.2.27'],
  PROCEDURE_DISPOSITION_SECTION: ['2.16.840.1.113883.10.20.18.2.12'],
  PROCEDURE_ESTIMATED_BLOOD_LOSS_SECTION: ['2.16.840.1.113883.10.20.18.2.9'],
  PROCEDURE_FINDINGS_SECTION: ['2.16.840.1.113883.10.20.22.2.28'],
  PROCEDURE_IMPLANTS_SECTION: ['2.16.840.1.113883.10.20.22.2.40'],
  PROCEDURE_INDICATIONS_SECTION: ['2.16.840.1.113883.10.20.22.2.29'],
  PROCEDURE_NOTE: ['2.16.840.1.113883.10.20.22.1.6'],
  PROCEDURE_SPECIMENS_TAKEN_SECTION: ['2.16.840.1.113883.10.20.22.2.31'],
  PRODUCT_INSTANCE: ['2.16.840.1.113883.10.20.22.4.37'],
  PROGNOSIS_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.113'],
  PROGRESS_NOTE: ['2.16.840.1.113883.10.20.22.1.9'],
  PROGRESS_TOWARD_GOAL_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.110'],
  PROVENANCE_ASSEMBLER_PARTICIPATION: ['2.16.840.1.113883.10.20.22.5.7'],
  PROVENANCE_AUTHOR_PARTICIPATION: ['2.16.840.1.113883.10.20.22.5.6'],
  PURPOSE_OF_REFERENCE_OBSERVATION: ['2.16.840.1.113883.10.20.6.2.9'],
  QUANTITY_MEASUREMENT_OBSERVATION: ['2.16.840.1.113883.10.20.6.2.14'],
  REACTION_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.9'],
  REASON_FOR_REFERRAL_SECTION: ['1.3.6.1.4.1.19376.1.5.3.1.3.1'],
  REASON_FOR_VISIT_SECTION: ['2.16.840.1.113883.10.20.22.2.12'],
  REFERENCED_FRAMES_OBSERVATION: ['2.16.840.1.113883.10.20.6.2.10'],
  REFERRAL_NOTE: ['2.16.840.1.113883.10.20.22.1.14'],
  RESULTS_SECTION: [
    '2.16.840.1.113883.10.20.22.2.3',
    '2.16.840.1.113883.10.20.22.2.3.1',
  ],
  RESULT_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.2'],
  RESULT_ORGANIZER: ['2.16.840.1.113883.10.20.22.4.1'],
  REVIEW_OF_SYSTEMS_SECTION: ['1.3.6.1.4.1.19376.1.5.3.1.3.18'],
  RISK_CONCERN_ACT: ['2.16.840.1.113883.10.20.22.4.136'],
  SECTION_TIME_RANGE_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.201'],
  SELF_CARE_ACTIVITIES: ['2.16.840.1.113883.10.20.22.4.128'],
  SENSORY_STATUS: ['2.16.840.1.113883.10.20.22.4.127'],
  SERIAL_NUMBER_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.319'],
  SERIES_ACT: ['2.16.840.1.113883.10.20.22.4.63'],
  SERVICE_DELIVERY_LOCATION: ['2.16.840.1.113883.10.20.22.4.32'],
  SEVERITY_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.8'],
  SEXUAL_ORIENTATION_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.501'],
  SMOKING_STATUS_MEANINGFUL_USE: ['2.16.840.1.113883.10.20.22.4.78'],
  SOCIAL_HISTORY_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.38'],
  SOCIAL_HISTORY_SECTION: ['2.16.840.1.113883.10.20.22.2.17'],
  SOP_INSTANCE_OBSERVATION: ['2.16.840.1.113883.10.20.6.2.8'],
  STUDY_ACT: ['2.16.840.1.113883.10.20.6.2.6'],
  SUBJECTIVE_SECTION: ['2.16.840.1.113883.10.20.21.2.2'],
  SUBSTANCE_ADMINISTERED_ACT: ['2.16.840.1.113883.10.20.22.4.118'],
  SUBSTANCE_OR_DEVICE_ALLERGY_INTOLERANCE_OBSERVATION: [
    '2.16.840.1.113883.10.20.24.3.90',
  ],
  SURGERY_DESCRIPTION_SECTION: ['2.16.840.1.113883.10.20.22.2.26'],
  SURGICAL_DRAINS_SECTION: ['2.16.840.1.113883.10.20.7.13'],
  TEXT_OBSERVATION: ['2.16.840.1.113883.10.20.6.2.12'],
  TOBACCO_USE: ['2.16.840.1.113883.10.20.22.4.85'],
  TRANSFER_SUMMARY: ['2.16.840.1.113883.10.20.22.1.13'],
  UDI_ORGANIZER: ['2.16.840.1.113883.10.20.22.4.311'],
  UNSTRUCTURED_DOCUMENT: ['2.16.840.1.113883.10.20.22.1.10'],
  US_REALM_ADDRESS: ['2.16.840.1.113883.10.20.22.5.2'],
  US_REALM_DATE_AND_TIME: [
    '2.16.840.1.113883.10.20.22.5.3',
    '2.16.840.1.113883.10.20.22.5.4',
  ],
  US_REALM_HEADER: ['2.16.840.1.113883.10.20.22.1.1'],
  US_REALM_HEADER_FOR_PATIENT_GENERATED_DOCUMENT: [
    '2.16.840.1.113883.10.20.29.1',
  ],
  US_REALM_PATIENT_NAME: ['2.16.840.1.113883.10.20.22.5.1'],
  US_REALM_PERSON_NAME: ['2.16.840.1.113883.10.20.22.5.1.1'],
  VITAL_SIGNS_ORGANIZER: ['2.16.840.1.113883.10.20.22.4.26'],
  VITAL_SIGNS_SECTION: [
    '2.16.840.1.113883.10.20.22.2.4',
    '2.16.840.1.113883.10.20.22.2.4.1',
  ],
  VITAL_SIGN_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.27'],
  WOUND_CHARACTERISTIC: ['2.16.840.1.113883.10.20.22.4.134'],
  WOUND_MEASUREMENT_OBSERVATION: ['2.16.840.1.113883.10.20.22.4.133'],
};

type CCDAStructureDefinitionKeys2_1 = keyof typeof CCDAStructureDefinition2_1;

const LOINC_CODE_SYSTEM = '2.16.840.1.113883.6.1';

function parseDateString(d: string) {
  const year = d.substring(0, 4);
  const month = d.substring(4, 6);
  const day = d.length > 6 ? d.substring(6, 8) : '00';
  // hours need conditional check for length
  const hour = d.length > 8 ? d.substring(8, 10) : '00';
  // minutes need conditional check for length
  const minute = d.length > 10 ? d.substring(10, 12) : '00';
  // seconds need conditional check for length
  const second = d.length > 12 ? d.substring(12, 14) : '00';
  const offset = d.substring(14);
  const date = new Date(
    Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    )
  );
  // conditionally subtract offset from date to handle dates missing +0000
  if (offset) {
    const offsetHours = parseInt(offset.substring(0, 3));
    const offsetMinutes = parseInt(offset.substring(3));
    date.setHours(date.getHours() - offsetHours);
    date.setMinutes(date.getMinutes() - offsetMinutes);
  }

  return date.toLocaleString();
}

function parseCCDAResultsSection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = [...(sections as unknown as HTMLElement[])]?.filter(
    (s) =>
      Array.isArray(id)
        ? id.includes(
            s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ||
              ''
          )
        : s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ===
          id
  );

  if (!matchingSections) {
    return null;
  }

  console.log(
    [...matchingSections.map((x) => x.getElementsByTagName('entry'))]?.map(
      (x) =>
        [...x]
          .map((y) => y.getElementsByTagName('code'))
          ?.map((z) => [...z]?.[0]?.textContent)
    )
  );

  const matchingSectionsDisplayNames = [
    ...matchingSections.map((x) => x.getElementsByTagName('entry')),
  ]?.map((x) =>
    [...x]
      .map((y) => y.getElementsByTagName('code'))
      ?.map((z) => [...z]?.[0]?.textContent)
  )?.[0];

  const sectionComponents = [
    ...(matchingSections as unknown as HTMLElement[]),
  ]?.map((e) =>
    [...e.getElementsByTagName('entry')].map((x) =>
      x.getElementsByTagName('component')
    )
  );

  console.log(sectionComponents);

  if (!sectionComponents || sectionComponents.length === 0) {
    return null;
  }

  const listComponents = [];

  for (const components of sectionComponents) {
    for (const [index, components1] of [...components].entries()) {
      const kp: Record<
        string,
        {
          title: string;
          value: string | null;
          unit: string | null;
          datetime: string | null;
          datetimeLow: string | null;
          datetimeHigh: string | null;
          referenceRangeLow: string | null;
          referenceRangeHigh: string | null;
          referenceRangeText: string | null;
          isOutOfRange?: boolean | '' | null;
        }
      > = {};
      for (const component of components1) {
        const codeId = component
          ?.getElementsByTagName('code')[0]
          .getAttribute('code');
        const codeSystem = component
          ?.getElementsByTagName('code')[0]
          .getAttribute('codeSystem');
        const codeDisplayName =
          component
            ?.getElementsByTagName('code')[0]
            .getAttribute('displayName') ||
          component?.getElementsByTagName('originalText')?.[0]?.textContent ||
          '';
        if (codeSystem === LOINC_CODE_SYSTEM && codeId) {
          kp[codeId] = {
            title: codeDisplayName,
            value:
              component
                ?.getElementsByTagName('value')?.[0]
                ?.getAttribute('value') ||
              component
                ?.getElementsByTagName('value')?.[0]
                ?.getAttribute('displayName') ||
              component?.getElementsByTagName('value')?.[0]?.textContent,
            unit: component
              ?.getElementsByTagName('value')?.[0]
              ?.getAttribute('unit'),
            datetime: component
              ?.getElementsByTagName('effectiveTime')?.[0]
              ?.getAttribute('value'),
            datetimeLow: component
              ?.getElementsByTagName('effectiveTime')?.[0]
              ?.getElementsByTagName('low')?.[0]
              ?.getAttribute('value'),
            datetimeHigh: component
              ?.getElementsByTagName('effectiveTime')?.[0]
              ?.getElementsByTagName('high')?.[0]
              ?.getAttribute('value'),
            referenceRangeText: component
              ?.getElementsByTagName('referenceRange')?.[0]
              ?.getElementsByTagName('text')?.[0]?.textContent,
            referenceRangeLow: component
              ?.getElementsByTagName('referenceRange')?.[0]
              ?.getElementsByTagName('low')?.[0]
              ?.getAttribute('value'),
            referenceRangeHigh: component
              ?.getElementsByTagName('referenceRange')?.[0]
              ?.getElementsByTagName('high')?.[0]
              ?.getAttribute('value'),
          };
          kp[codeId] = {
            ...kp[codeId],
            isOutOfRange:
              kp[codeId].value &&
              kp[codeId].referenceRangeLow &&
              kp[codeId].referenceRangeHigh &&
              (parseFloat(kp[codeId].value || '') <
                parseFloat(kp[codeId].referenceRangeLow || '') ||
                parseFloat(kp[codeId].value || '') >
                  parseFloat(kp[codeId].referenceRangeHigh || '')),
          };
        }
      }
      const uniqueDates = new Set([
        ...Object.values(kp).map((v) => v.datetime),
        ...Object.values(kp).map((v) => v.datetimeLow),
        ...Object.values(kp).map((v) => v.datetimeHigh),
      ]);

      listComponents.push({
        title: matchingSectionsDisplayNames[index],
        kp,
        uniqueDates,
      });
    }
  }

  return (
    <>
      {listComponents.map((c) => (
        <ResultComponentSection
          matchingSectionsDisplayName={c.title as string}
          kp={c.kp}
          uniqueDates={c.uniqueDates}
        />
      ))}
    </>
  );
}

function ResultComponentSection({
  matchingSectionsDisplayName,
  kp,
  uniqueDates,
}: {
  matchingSectionsDisplayName: string;
  kp: Record<
    string,
    {
      title: string;
      value: string | null;
      unit: string | null;
      datetime: string | null;
      datetimeLow: string | null;
      datetimeHigh: string | null;
      referenceRangeLow: string | null;
      referenceRangeHigh: string | null;
      referenceRangeText: string | null;
      isOutOfRange?: boolean | '' | null;
    }
  >;
  uniqueDates: Set<string | null>;
}) {
  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button className="mb-1 w-full rounded-md bg-gray-50 p-1 font-bold">
            <div className="flex w-full items-center justify-between">
              {matchingSectionsDisplayName}
              <ChevronRightIcon
                className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                  open ? 'rotate-90 transform' : ''
                }`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="m-1 text-sm text-gray-700">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
                  >
                    Title
                  </th>
                  <th
                    scope="col"
                    className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
                  >
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Object.values(kp).map((v) => (
                  <tr>
                    <td className="whitespace-nowrap py-1 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                      {v.title}
                      <p className="col-span-3 self-center text-xs font-light text-gray-600">
                        {v.referenceRangeLow && v.referenceRangeHigh
                          ? `Range: ${v.referenceRangeLow}${v.unit} - ${v.referenceRangeHigh}${v.unit}`
                          : v.referenceRangeText
                          ? `Range: ${v.referenceRangeText}`
                          : ''}
                      </p>
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-1 text-sm text-gray-900 ${
                        v.isOutOfRange ? 'text-red-700' : ''
                      }`}
                    >
                      {v.value}
                      {v.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 mb-4 text-sm font-semibold italic text-gray-900">
              {uniqueDates.size > 0 &&
                `Results taken at ${[...uniqueDates]
                  .filter((d) => !!d)
                  .map((d) => {
                    // also handle dates that are shorter like "20230314"
                    d = d!;
                    return parseDateString(d);
                  })
                  .join(' ,')}`}
            </p>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}

function parseCCDAVitalsSection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = [...(sections as unknown as HTMLElement[])]?.filter(
    (s) =>
      Array.isArray(id)
        ? id.includes(
            s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ||
              ''
          )
        : s?.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ===
          id
  );
  if (!matchingSections) {
    return null;
  }

  const components = [...(matchingSections as unknown as HTMLElement[])]?.map(
    (e) => e?.getElementsByTagName('component')
  )?.[0];

  if (!components) {
    return null;
  }

  const kp: Record<
    string,
    {
      title: string;
      value: string | null;
      unit: string | null;
      datetime: string | null;
    }
  > = {};
  for (const component of components) {
    const codeId = component
      ?.getElementsByTagName('code')[0]
      .getAttribute('code');
    const codeSystem = component
      ?.getElementsByTagName('code')[0]
      .getAttribute('codeSystem');
    const codeDisplayName = component
      ?.getElementsByTagName('code')[0]
      .getAttribute('displayName');
    if (codeSystem === LOINC_CODE_SYSTEM && codeId) {
      kp[codeId] = {
        title:
          codeDisplayName ||
          component?.getElementsByTagName('originalText')?.[0]?.innerHTML,
        value:
          component
            ?.getElementsByTagName('value')?.[0]
            ?.getAttribute('value') ||
          component
            ?.getElementsByTagName('value')?.[0]
            ?.getAttribute('displayName'),
        unit: component
          ?.getElementsByTagName('value')?.[0]
          ?.getAttribute('unit'),
        datetime: component
          ?.getElementsByTagName('effectiveTime')?.[0]
          ?.getAttribute('value'),
      };
    }
  }

  const uniqueDates = new Set([...Object.values(kp).map((v) => v.datetime)]);

  return (
    <>
      <table className="min-w-full divide-y divide-gray-300">
        <thead>
          <tr>
            <th
              scope="col"
              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Title
            </th>
            <th
              scope="col"
              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
            >
              Value
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {Object.values(kp).map((v) => (
            <tr>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                {v.title}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                {v.value}
                {v.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 mb-4 text-sm font-semibold italic text-gray-900">
        Vitals taken at{' '}
        {[...uniqueDates]
          .filter((d) => !!d)
          .map((d) => {
            d = d!;
            return parseDateString(d);
          })
          .join(' ,')}
      </p>
    </>
  );
}

function parseCCDASection(
  sections: HTMLCollectionOf<HTMLElement>,
  id: string[] | string
) {
  const matchingSections = [...(sections as unknown as HTMLElement[])]?.filter(
    (s) =>
      Array.isArray(id)
        ? id.includes(
            s.getElementsByTagName('templateId')?.[0]?.getAttribute('root') ||
              ''
          )
        : s.getElementsByTagName('templateId')?.[0]?.getAttribute('root') === id
  );

  return [...(matchingSections as unknown as HTMLElement[])]
    ?.map((x) => x.innerHTML)
    .flat()
    .join();
}

function parseCCDA(
  raw: string
): Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(raw, 'text/xml');
  const sections = xmlDoc.getElementsByTagName('section');
  const parsedDoc: Partial<
    Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>
  > = {};

  for (const [key, val] of Object.entries(CCDAStructureDefinition2_1)) {
    const k = key as CCDAStructureDefinitionKeys2_1;
    if (k === 'VITAL_SIGNS_SECTION') {
      parsedDoc[k] = parseCCDAVitalsSection(sections, val) as JSX.Element;
    } else if (k === 'RESULTS_SECTION') {
      parsedDoc[k] = parseCCDAResultsSection(sections, val) as JSX.Element;
    } else {
      parsedDoc[k] = parseCCDASection(sections, val);
    }
  }

  return parsedDoc;
}

function checkIfXmlIsCCDA(xml: string): boolean {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('ClinicalDocument');
    return sections.length > 0;
  } catch (e) {
    return false;
  }
}

export function ShowDocumentResultsExpandable({
  item,
  expanded,
  setExpanded,
}: {
  item: ClinicalDocument<BundleEntry<DocumentReference>>;
  expanded: boolean;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const cd = useConnectionDoc(item.connection_record_id),
    [ccda, setCCDA] = useState<
      | Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>>
      | undefined
    >(undefined),
    attachmentUrl = item.data_record.raw.resource?.content?.[0].attachment.url,
    attachment = useClinicalDoc(attachmentUrl),
    [hasLoadedDocument, setHasLoadedDocument] = useState(false);

  useEffect(() => {
    if (expanded) {
      if (
        attachment?.get('data_record.content_type') === 'application/xml' &&
        checkIfXmlIsCCDA(attachment.get('data_record.raw'))
      ) {
        const parsedDoc = parseCCDA(attachment.get('data_record.raw'));
        setHasLoadedDocument(true);
        setCCDA(parsedDoc);
      } else {
        setHasLoadedDocument(true);
      }
    }
  }, [expanded, cd, attachment]);

  return (
    <Modal open={expanded} setOpen={setExpanded}>
      <div className="flex flex-col">
        <ModalHeader
          title={item.metadata?.display_name || ''}
          setClose={() => setExpanded(false)}
        />
        <div className="max-h-full  scroll-py-3 p-3">
          <div
            className={`${
              expanded ? '' : 'hidden'
            } rounded-lg border border-solid border-gray-200`}
          >
            <p className="text-md whitespace-wrap overflow-x-scroll p-4 text-gray-900">
              {!hasLoadedDocument && 'Loading...'}
              <DisplayCCDADocument ccda={ccda} />
              {hasLoadedDocument && !ccda && (
                <p>
                  Sorry, looks like we were unable to get the linked document
                </p>
              )}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DisplayCCDADocument({
  ccda,
}: {
  ccda:
    | Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>>
    | undefined;
}) {
  return (
    <>
      {ccda?.REASON_FOR_REFERRAL_SECTION && (
        <DisplayCCDASection
          title="Reason for Referral"
          content={(ccda.REASON_FOR_REFERRAL_SECTION as string) || ''}
        />
      )}
      {ccda?.ADMISSION_DIAGNOSIS_SECTION && (
        <DisplayCCDASection
          title="Admission Diagnosis"
          content={(ccda.ADMISSION_DIAGNOSIS_SECTION as string) || ''}
        />
      )}
      {ccda?.ADMISSION_MEDICATIONS_SECTION && (
        <DisplayCCDASection
          title="Admission Medication"
          content={(ccda.ADMISSION_MEDICATIONS_SECTION as string) || ''}
        />
      )}
      {ccda?.CHIEF_COMPLAINT_AND_REASON_FOR_VISIT_SECTION && (
        <DisplayCCDASection
          title="Chief Complaint and Reason for Visit"
          content={
            (ccda.CHIEF_COMPLAINT_AND_REASON_FOR_VISIT_SECTION as string) || ''
          }
        />
      )}
      {ccda?.CHIEF_COMPLAINT_SECTION && (
        <DisplayCCDASection
          title="Chief Complaint"
          content={(ccda.CHIEF_COMPLAINT_SECTION as string) || ''}
        />
      )}
      {ccda?.VITAL_SIGNS_SECTION && (
        <DisplayCCDAVitalSignsSection
          title="Vital Signs"
          content={(ccda.VITAL_SIGNS_SECTION as JSX.Element) || ''}
        />
      )}
      {ccda?.HISTORY_OF_PRESENT_ILLNESS_SECTION && (
        <DisplayCCDASection
          title="History of Present Illness"
          content={(ccda.HISTORY_OF_PRESENT_ILLNESS_SECTION as string) || ''}
        />
      )}
      {ccda?.MEDICATIONS_SECTION && (
        <DisplayCCDASection
          title="Medications"
          content={(ccda.MEDICATIONS_SECTION as string) || ''}
        />
      )}
      {ccda?.IMMUNIZATIONS_SECTION && (
        <DisplayCCDASection
          title="Immunizations"
          content={(ccda.IMMUNIZATIONS_SECTION as string) || ''}
        />
      )}
      {ccda?.ALLERGIES_AND_INTOLERANCES_SECTION && (
        <DisplayCCDASection
          title="Allergies and Intolerances"
          content={(ccda.ALLERGIES_AND_INTOLERANCES_SECTION as string) || ''}
        />
      )}
      {ccda?.FAMILY_HISTORY_SECTION && (
        <DisplayCCDASection
          title="Family History"
          content={(ccda.FAMILY_HISTORY_SECTION as string) || ''}
        />
      )}
      {ccda?.SOCIAL_HISTORY_SECTION && (
        <DisplayCCDASection
          title="Social History"
          content={(ccda.SOCIAL_HISTORY_SECTION as string) || ''}
        />
      )}
      {ccda?.HEALTH_CONCERNS_SECTION && (
        <DisplayCCDASection
          title="Health Concerns"
          content={(ccda.HEALTH_CONCERNS_SECTION as string) || ''}
        />
      )}
      {ccda?.REVIEW_OF_SYSTEMS_SECTION && (
        <DisplayCCDASection
          title="Review of Symptoms"
          content={(ccda.REVIEW_OF_SYSTEMS_SECTION as string) || ''}
        />
      )}
      {ccda?.PROCEDURES_SECTION && (
        <DisplayCCDASection
          title="Procedures"
          content={(ccda.PROCEDURES_SECTION as string) || ''}
        />
      )}
      {ccda?.RESULTS_SECTION && (
        <DisplayCCDAVitalSignsSection
          title="Results"
          content={(ccda.RESULTS_SECTION as JSX.Element) || ''}
        />
      )}
      {ccda?.FINDINGS_SECTION && (
        <DisplayCCDASection
          title="Findings"
          content={(ccda.FINDINGS_SECTION as string) || ''}
        />
      )}
      {ccda?.DICOM_OBJECT_CATALOG_SECTION_DCM_121181 && (
        <DisplayCCDASection
          title="Imaging Results"
          content={
            (ccda.DICOM_OBJECT_CATALOG_SECTION_DCM_121181 as string) || ''
          }
        />
      )}
      {ccda?.PREOPERATIVE_DIAGNOSIS_SECTION && (
        <DisplayCCDASection
          title="Pre Operative Diagnosis"
          content={(ccda.PREOPERATIVE_DIAGNOSIS_SECTION as string) || ''}
        />
      )}
      {ccda?.PROCEDURE_DESCRIPTION_SECTION && (
        <DisplayCCDASection
          title="Procedure Description"
          content={(ccda.PROCEDURE_DESCRIPTION_SECTION as string) || ''}
        />
      )}
      {ccda?.PROCEDURE_DISPOSITION_SECTION && (
        <DisplayCCDASection
          title="Procedure Disposition"
          content={(ccda.PROCEDURE_DISPOSITION_SECTION as string) || ''}
        />
      )}
      {ccda?.PROCEDURE_NOTE && (
        <DisplayCCDASection
          title="Procedure Note"
          content={(ccda.PROCEDURE_NOTE as string) || ''}
        />
      )}
      {ccda?.SURGERY_DESCRIPTION_SECTION && (
        <DisplayCCDASection
          title="Surgery Description"
          content={(ccda.SURGERY_DESCRIPTION_SECTION as string) || ''}
        />
      )}
      {ccda?.POSTOPERATIVE_DIAGNOSIS_SECTION && (
        <DisplayCCDASection
          title="Post Operative Diagnosis"
          content={(ccda.POSTOPERATIVE_DIAGNOSIS_SECTION as string) || ''}
        />
      )}
      {ccda?.POSTPROCEDURE_DIAGNOSIS_SECTION && (
        <DisplayCCDASection
          title="Post Procedure Diagnosis"
          content={(ccda.POSTPROCEDURE_DIAGNOSIS_SECTION as string) || ''}
        />
      )}
      {ccda?.PROGRESS_NOTE && (
        <DisplayCCDASection
          title="Progress Note"
          content={(ccda.PROGRESS_NOTE as string) || ''}
        />
      )}
      {ccda?.ASSESSMENT_SECTION && (
        <DisplayCCDASection
          title="Assessment"
          content={(ccda.ASSESSMENT_SECTION as string) || ''}
        />
      )}
      {ccda?.ASSESSMENT_AND_PLAN_SECTION && (
        <DisplayCCDASection
          title="Assessment and Plan"
          content={(ccda.ASSESSMENT_AND_PLAN_SECTION as string) || ''}
        />
      )}
      {ccda?.PROBLEM_SECTION && (
        <DisplayCCDASection
          title="Problems"
          content={(ccda.PROBLEM_SECTION as string) || ''}
        />
      )}
      {ccda?.NUTRITION_SECTION && (
        <DisplayCCDASection
          title="Nutrition"
          content={(ccda.NUTRITION_SECTION as string) || ''}
        />
      )}
      {ccda?.PLAN_OF_TREATMENT_SECTION && (
        <DisplayCCDASection
          title="Plan of Treatment"
          content={(ccda.PLAN_OF_TREATMENT_SECTION as string) || ''}
        />
      )}
      {ccda?.GOALS_SECTION && (
        <DisplayCCDASection
          title="Goals"
          content={(ccda.GOALS_SECTION as string) || ''}
        />
      )}
      {ccda?.MEDICAL_EQUIPMENT_SECTION && (
        <DisplayCCDASection
          title="Medical Equipment"
          content={(ccda.MEDICAL_EQUIPMENT_SECTION as string) || ''}
        />
      )}
      {ccda?.ADVANCE_DIRECTIVES_SECTION && (
        <DisplayCCDASection
          title="Advance Directives"
          content={(ccda.ADVANCE_DIRECTIVES_SECTION as string) || ''}
        />
      )}
      {ccda?.INSTRUCTIONS_SECTION && (
        <DisplayCCDASection
          title="Instructions"
          content={(ccda.INSTRUCTIONS_SECTION as string) || ''}
        />
      )}
      {ccda?.HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION && (
        <DisplayCCDASection
          title="Hospital Discharge Instructions"
          content={
            (ccda.HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION as string) || ''
          }
        />
      )}
      {ccda?.HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION && (
        <DisplayCCDASection
          title="Hospital Discharge Instructions"
          content={
            (ccda.HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION as string) || ''
          }
        />
      )}
      {ccda?.DISCHARGE_MEDICATIONS_SECTION && (
        <DisplayCCDASection
          title="Discharge Medications"
          content={(ccda.DISCHARGE_MEDICATIONS_SECTION as string) || ''}
        />
      )}
      {ccda?.DISCHARGE_SUMMARY && (
        <DisplayCCDASection
          title="Discharge Summary"
          content={(ccda.DISCHARGE_SUMMARY as string) || ''}
        />
      )}
      {ccda?.CARE_TEAMS_SECTION && (
        <DisplayCCDASection
          title="Care Team"
          content={(ccda.CARE_TEAMS_SECTION as string) || ''}
        />
      )}
      {ccda?.PAYERS_SECTION && (
        <DisplayCCDASection
          title="Payers"
          content={(ccda.PAYERS_SECTION as string) || ''}
        />
      )}
      {ccda?.ENCOUNTER_DIAGNOSIS && (
        <DisplayCCDASection
          title="Encounter Diagnoses"
          content={(ccda.ENCOUNTER_DIAGNOSIS as string) || ''}
        />
      )}
      {ccda?.ENCOUNTERS_SECTION && (
        <DisplayCCDASection
          title="Encounters"
          content={(ccda.ENCOUNTERS_SECTION as string) || ''}
        />
      )}
    </>
  );
}

function DisplayCCDASection({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button className="mb-2 w-full rounded-md bg-gray-100 p-2 font-bold">
            <div className="flex w-full items-center justify-between">
              {title}
              <ChevronRightIcon
                className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                  open ? 'rotate-90 transform' : ''
                }`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="m-4 text-sm text-gray-700">
            <p
              className="p-2"
              dangerouslySetInnerHTML={{
                __html: content || '',
              }}
            ></p>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}

function DisplayCCDAVitalSignsSection({
  title,
  content,
}: {
  title: string;
  content: JSX.Element;
}) {
  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button className="mb-2 w-full rounded-md bg-gray-100 p-2 font-bold">
            <div className="flex w-full items-center justify-between">
              {title}
              <ChevronRightIcon
                className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                  open ? 'rotate-90 transform' : ''
                }`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="m-4 text-sm text-gray-700">
            {content}
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
