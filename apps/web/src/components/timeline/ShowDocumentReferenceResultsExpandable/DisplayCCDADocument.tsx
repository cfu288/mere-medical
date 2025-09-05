import { useMemo } from 'react';
import { ErrorBoundary } from '../../ErrorBoundary';
import { CCDAStructureDefinitionKeys2_1 } from './CCDAStructureDefinitionKeys2_1';
import { DisplayCCDAElementSection } from './DisplayCCDAElementSection';
import { DisplayCCDARawSection } from './DisplayCCDARawSection';

interface ChunkWithMetadata {
  id: string;
  metadata?: {
    sectionName?: string;
  };
}

export function DisplayCCDADocument({
  ccda,
  matchedChunks,
}: {
  ccda:
    | Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>>
    | undefined;
  matchedChunks?: ChunkWithMetadata[];
}) {
  const matchedSections = useMemo(() => {
    if (!matchedChunks || matchedChunks.length === 0) {
      return new Set<string>();
    }

    const sections = new Set<string>();
    matchedChunks.forEach(chunk => {
      if (chunk.metadata?.sectionName) {
        sections.add(chunk.metadata.sectionName);
      }
    });
    return sections;
  }, [matchedChunks]);
  return (
    <>
      {ccda?.REASON_FOR_REFERRAL_SECTION && (
        <DisplayCCDARawSection
          title="Reason for Referral"
          content={(ccda.REASON_FOR_REFERRAL_SECTION as string) || ''}
          isMatched={matchedSections.has('REASON_FOR_REFERRAL_SECTION')}
          defaultOpen={matchedSections.has('REASON_FOR_REFERRAL_SECTION')}
        />
      )}
      {ccda?.ADMISSION_DIAGNOSIS_SECTION && (
        <DisplayCCDARawSection
          title="Admission Diagnosis"
          content={(ccda.ADMISSION_DIAGNOSIS_SECTION as string) || ''}
          isMatched={matchedSections.has('ADMISSION_DIAGNOSIS_SECTION')}
          defaultOpen={matchedSections.has('ADMISSION_DIAGNOSIS_SECTION')}
        />
      )}
      {ccda?.ADMISSION_MEDICATIONS_SECTION && (
        <DisplayCCDARawSection
          title="Admission Medication"
          content={(ccda.ADMISSION_MEDICATIONS_SECTION as string) || ''}
          isMatched={matchedSections.has('ADMISSION_MEDICATIONS_SECTION')}
          defaultOpen={matchedSections.has('ADMISSION_MEDICATIONS_SECTION')}
        />
      )}
      {ccda?.CHIEF_COMPLAINT_AND_REASON_FOR_VISIT_SECTION && (
        <DisplayCCDARawSection
          title="Chief Complaint and Reason for Visit"
          content={
            (ccda.CHIEF_COMPLAINT_AND_REASON_FOR_VISIT_SECTION as string) || ''
          }
          isMatched={matchedSections.has(
            'CHIEF_COMPLAINT_AND_REASON_FOR_VISIT_SECTION',
          )}
          defaultOpen={matchedSections.has(
            'CHIEF_COMPLAINT_AND_REASON_FOR_VISIT_SECTION',
          )}
        />
      )}
      {ccda?.CHIEF_COMPLAINT_SECTION && (
        <DisplayCCDARawSection
          title="Chief Complaint"
          content={(ccda.CHIEF_COMPLAINT_SECTION as string) || ''}
          isMatched={matchedSections.has('CHIEF_COMPLAINT_SECTION')}
          defaultOpen={matchedSections.has('CHIEF_COMPLAINT_SECTION')}
        />
      )}
      {ccda?.VITAL_SIGNS_SECTION && (
        <ErrorBoundary
          fallbackUI={
            <div>
              There was an error trying to load vital signs. Please submit a{' '}
              <a href="mailto:cfu288@meremedical.co">bug report</a> so we can
              get this fixed!
            </div>
          }
        >
          <DisplayCCDAElementSection
            title="Vital Signs"
            content={(ccda.VITAL_SIGNS_SECTION as JSX.Element) || ''}
            isMatched={matchedSections.has('VITAL_SIGNS_SECTION')}
            defaultOpen={matchedSections.has('VITAL_SIGNS_SECTION')}
          />
        </ErrorBoundary>
      )}
      {ccda?.HISTORY_OF_PRESENT_ILLNESS_SECTION && (
        <ErrorBoundary
          fallbackUI={
            <div>
              There was an error trying to load vital signs. Please submit a{' '}
              <a href="mailto:cfu288@meremedical.co">bug report</a> so we can
              get this fixed!
            </div>
          }
        >
          <DisplayCCDAElementSection
            title="History of Present Illness"
            content={
              (ccda.HISTORY_OF_PRESENT_ILLNESS_SECTION as JSX.Element) || ''
            }
            isMatched={matchedSections.has(
              'HISTORY_OF_PRESENT_ILLNESS_SECTION',
            )}
            defaultOpen={matchedSections.has(
              'HISTORY_OF_PRESENT_ILLNESS_SECTION',
            )}
          />
        </ErrorBoundary>
      )}
      {ccda?.MEDICATIONS_SECTION && (
        <DisplayCCDARawSection
          title="Medications"
          content={(ccda.MEDICATIONS_SECTION as string) || ''}
          isMatched={matchedSections.has('MEDICATIONS_SECTION')}
          defaultOpen={matchedSections.has('MEDICATIONS_SECTION')}
        />
      )}
      {ccda?.IMMUNIZATIONS_SECTION && (
        <DisplayCCDARawSection
          title="Immunizations"
          content={(ccda.IMMUNIZATIONS_SECTION as string) || ''}
          isMatched={matchedSections.has('IMMUNIZATIONS_SECTION')}
          defaultOpen={matchedSections.has('IMMUNIZATIONS_SECTION')}
        />
      )}
      {ccda?.ALLERGIES_AND_INTOLERANCES_SECTION && (
        <DisplayCCDARawSection
          title="Allergies and Intolerances"
          content={(ccda.ALLERGIES_AND_INTOLERANCES_SECTION as string) || ''}
          isMatched={matchedSections.has('ALLERGIES_AND_INTOLERANCES_SECTION')}
          defaultOpen={matchedSections.has(
            'ALLERGIES_AND_INTOLERANCES_SECTION',
          )}
        />
      )}
      {ccda?.FAMILY_HISTORY_SECTION && (
        <DisplayCCDARawSection
          title="Family History"
          content={(ccda.FAMILY_HISTORY_SECTION as string) || ''}
          isMatched={matchedSections.has('FAMILY_HISTORY_SECTION')}
          defaultOpen={matchedSections.has('FAMILY_HISTORY_SECTION')}
        />
      )}
      {ccda?.SOCIAL_HISTORY_SECTION && (
        <DisplayCCDAElementSection
          title="Social History"
          content={(ccda.SOCIAL_HISTORY_SECTION as JSX.Element) || ''}
          isMatched={matchedSections.has('SOCIAL_HISTORY_SECTION')}
          defaultOpen={matchedSections.has('SOCIAL_HISTORY_SECTION')}
        />
      )}
      {ccda?.HEALTH_CONCERNS_SECTION && (
        <DisplayCCDARawSection
          title="Health Concerns"
          content={(ccda.HEALTH_CONCERNS_SECTION as string) || ''}
          isMatched={matchedSections.has('HEALTH_CONCERNS_SECTION')}
          defaultOpen={matchedSections.has('HEALTH_CONCERNS_SECTION')}
        />
      )}
      {ccda?.REVIEW_OF_SYSTEMS_SECTION && (
        <DisplayCCDARawSection
          title="Review of Symptoms"
          content={(ccda.REVIEW_OF_SYSTEMS_SECTION as string) || ''}
          isMatched={matchedSections.has('REVIEW_OF_SYSTEMS_SECTION')}
          defaultOpen={matchedSections.has('REVIEW_OF_SYSTEMS_SECTION')}
        />
      )}
      {ccda?.PROCEDURES_SECTION && (
        <DisplayCCDARawSection
          title="Procedures"
          content={(ccda.PROCEDURES_SECTION as string) || ''}
          isMatched={matchedSections.has('PROCEDURES_SECTION')}
          defaultOpen={matchedSections.has('PROCEDURES_SECTION')}
        />
      )}
      {ccda?.RESULTS_SECTION && (
        <ErrorBoundary
          fallbackUI={
            <div>
              There was an error trying to load vital signs. Please submit a{' '}
              <a href="mailto:cfu288@meremedical.co">bug report</a> so we can
              get this fixed!
            </div>
          }
        >
          <DisplayCCDAElementSection
            title="Results"
            content={(ccda.RESULTS_SECTION as JSX.Element) || ''}
            isMatched={matchedSections.has('RESULTS_SECTION')}
            defaultOpen={matchedSections.has('RESULTS_SECTION')}
          />
        </ErrorBoundary>
      )}
      {ccda?.FINDINGS_SECTION && (
        <DisplayCCDARawSection
          title="Findings"
          content={(ccda.FINDINGS_SECTION as string) || ''}
          isMatched={matchedSections.has('FINDINGS_SECTION')}
          defaultOpen={matchedSections.has('FINDINGS_SECTION')}
        />
      )}
      {ccda?.DICOM_OBJECT_CATALOG_SECTION_DCM_121181 && (
        <DisplayCCDARawSection
          title="Imaging Results"
          content={
            (ccda.DICOM_OBJECT_CATALOG_SECTION_DCM_121181 as string) || ''
          }
          isMatched={matchedSections.has(
            'DICOM_OBJECT_CATALOG_SECTION_DCM_121181',
          )}
          defaultOpen={matchedSections.has(
            'DICOM_OBJECT_CATALOG_SECTION_DCM_121181',
          )}
        />
      )}
      {ccda?.PREOPERATIVE_DIAGNOSIS_SECTION && (
        <DisplayCCDARawSection
          title="Pre Operative Diagnosis"
          content={(ccda.PREOPERATIVE_DIAGNOSIS_SECTION as string) || ''}
          isMatched={matchedSections.has('PREOPERATIVE_DIAGNOSIS_SECTION')}
          defaultOpen={matchedSections.has('PREOPERATIVE_DIAGNOSIS_SECTION')}
        />
      )}
      {ccda?.PROCEDURE_DESCRIPTION_SECTION && (
        <DisplayCCDARawSection
          title="Procedure Description"
          content={(ccda.PROCEDURE_DESCRIPTION_SECTION as string) || ''}
          isMatched={matchedSections.has('PROCEDURE_DESCRIPTION_SECTION')}
          defaultOpen={matchedSections.has('PROCEDURE_DESCRIPTION_SECTION')}
        />
      )}
      {ccda?.PROCEDURE_DISPOSITION_SECTION && (
        <DisplayCCDARawSection
          title="Procedure Disposition"
          content={(ccda.PROCEDURE_DISPOSITION_SECTION as string) || ''}
          isMatched={matchedSections.has('PROCEDURE_DISPOSITION_SECTION')}
          defaultOpen={matchedSections.has('PROCEDURE_DISPOSITION_SECTION')}
        />
      )}
      {ccda?.PROCEDURE_NOTE && (
        <DisplayCCDARawSection
          title="Procedure Note"
          content={(ccda.PROCEDURE_NOTE as string) || ''}
          isMatched={matchedSections.has('PROCEDURE_NOTE')}
          defaultOpen={matchedSections.has('PROCEDURE_NOTE')}
        />
      )}
      {ccda?.SURGERY_DESCRIPTION_SECTION && (
        <DisplayCCDARawSection
          title="Surgery Description"
          content={(ccda.SURGERY_DESCRIPTION_SECTION as string) || ''}
          isMatched={matchedSections.has('SURGERY_DESCRIPTION_SECTION')}
          defaultOpen={matchedSections.has('SURGERY_DESCRIPTION_SECTION')}
        />
      )}
      {ccda?.POSTOPERATIVE_DIAGNOSIS_SECTION && (
        <DisplayCCDARawSection
          title="Post Operative Diagnosis"
          content={(ccda.POSTOPERATIVE_DIAGNOSIS_SECTION as string) || ''}
          isMatched={matchedSections.has('POSTOPERATIVE_DIAGNOSIS_SECTION')}
          defaultOpen={matchedSections.has('POSTOPERATIVE_DIAGNOSIS_SECTION')}
        />
      )}
      {ccda?.POSTPROCEDURE_DIAGNOSIS_SECTION && (
        <DisplayCCDARawSection
          title="Post Procedure Diagnosis"
          content={(ccda.POSTPROCEDURE_DIAGNOSIS_SECTION as string) || ''}
          isMatched={matchedSections.has('POSTPROCEDURE_DIAGNOSIS_SECTION')}
          defaultOpen={matchedSections.has('POSTPROCEDURE_DIAGNOSIS_SECTION')}
        />
      )}
      {ccda?.PROGRESS_NOTE && (
        <DisplayCCDARawSection
          title="Progress Note"
          content={(ccda.PROGRESS_NOTE as string) || ''}
          isMatched={matchedSections.has('PROGRESS_NOTE')}
          defaultOpen={matchedSections.has('PROGRESS_NOTE')}
        />
      )}
      {ccda?.ASSESSMENT_SECTION && (
        <DisplayCCDAElementSection
          title="Assessment"
          content={(ccda.ASSESSMENT_SECTION as JSX.Element) || ''}
          isMatched={matchedSections.has('ASSESSMENT_SECTION')}
          defaultOpen={matchedSections.has('ASSESSMENT_SECTION')}
        />
      )}
      {ccda?.ASSESSMENT_AND_PLAN_SECTION && (
        <DisplayCCDARawSection
          title="Assessment and Plan"
          content={(ccda.ASSESSMENT_AND_PLAN_SECTION as string) || ''}
          isMatched={matchedSections.has('ASSESSMENT_AND_PLAN_SECTION')}
          defaultOpen={matchedSections.has('ASSESSMENT_AND_PLAN_SECTION')}
        />
      )}
      {ccda?.PROBLEM_SECTION && (
        <DisplayCCDARawSection
          title="Problems"
          content={(ccda.PROBLEM_SECTION as string) || ''}
          isMatched={matchedSections.has('PROBLEM_SECTION')}
          defaultOpen={matchedSections.has('PROBLEM_SECTION')}
        />
      )}
      {ccda?.NUTRITION_SECTION && (
        <DisplayCCDARawSection
          title="Nutrition"
          content={(ccda.NUTRITION_SECTION as string) || ''}
          isMatched={matchedSections.has('NUTRITION_SECTION')}
          defaultOpen={matchedSections.has('NUTRITION_SECTION')}
        />
      )}
      {ccda?.PLAN_OF_TREATMENT_SECTION && (
        <DisplayCCDAElementSection
          title="Plan of Treatment"
          content={(ccda.PLAN_OF_TREATMENT_SECTION as JSX.Element) || ''}
          isMatched={matchedSections.has('PLAN_OF_TREATMENT_SECTION')}
          defaultOpen={matchedSections.has('PLAN_OF_TREATMENT_SECTION')}
        />
      )}
      {ccda?.GOALS_SECTION && (
        <DisplayCCDARawSection
          title="Goals"
          content={(ccda.GOALS_SECTION as string) || ''}
          isMatched={matchedSections.has('GOALS_SECTION')}
          defaultOpen={matchedSections.has('GOALS_SECTION')}
        />
      )}
      {ccda?.MEDICAL_EQUIPMENT_SECTION && (
        <DisplayCCDARawSection
          title="Medical Equipment"
          content={(ccda.MEDICAL_EQUIPMENT_SECTION as string) || ''}
          isMatched={matchedSections.has('MEDICAL_EQUIPMENT_SECTION')}
          defaultOpen={matchedSections.has('MEDICAL_EQUIPMENT_SECTION')}
        />
      )}
      {ccda?.ADVANCE_DIRECTIVES_SECTION && (
        <DisplayCCDARawSection
          title="Advance Directives"
          content={(ccda.ADVANCE_DIRECTIVES_SECTION as string) || ''}
          isMatched={matchedSections.has('ADVANCE_DIRECTIVES_SECTION')}
          defaultOpen={matchedSections.has('ADVANCE_DIRECTIVES_SECTION')}
        />
      )}
      {ccda?.INSTRUCTIONS_SECTION && (
        <DisplayCCDARawSection
          title="Instructions"
          content={(ccda.INSTRUCTIONS_SECTION as string) || ''}
          isMatched={matchedSections.has('INSTRUCTIONS_SECTION')}
          defaultOpen={matchedSections.has('INSTRUCTIONS_SECTION')}
        />
      )}
      {ccda?.HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION && (
        <DisplayCCDARawSection
          title="Hospital Discharge Instructions"
          content={
            (ccda.HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION as string) || ''
          }
          isMatched={matchedSections.has(
            'HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION',
          )}
          defaultOpen={matchedSections.has(
            'HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION',
          )}
        />
      )}
      {ccda?.DISCHARGE_MEDICATIONS_SECTION && (
        <DisplayCCDARawSection
          title="Discharge Medications"
          content={(ccda.DISCHARGE_MEDICATIONS_SECTION as string) || ''}
          isMatched={matchedSections.has('DISCHARGE_MEDICATIONS_SECTION')}
          defaultOpen={matchedSections.has('DISCHARGE_MEDICATIONS_SECTION')}
        />
      )}
      {ccda?.DISCHARGE_SUMMARY && (
        <DisplayCCDARawSection
          title="Discharge Summary"
          content={(ccda.DISCHARGE_SUMMARY as string) || ''}
          isMatched={matchedSections.has('DISCHARGE_SUMMARY')}
          defaultOpen={matchedSections.has('DISCHARGE_SUMMARY')}
        />
      )}
      {ccda?.CARE_TEAMS_SECTION && (
        <DisplayCCDAElementSection
          title="Care Team"
          content={(ccda.CARE_TEAMS_SECTION as JSX.Element) || ''}
          isMatched={matchedSections.has('CARE_TEAMS_SECTION')}
          defaultOpen={matchedSections.has('CARE_TEAMS_SECTION')}
        />
      )}
      {ccda?.PAYERS_SECTION && (
        <DisplayCCDARawSection
          title="Payers"
          content={(ccda.PAYERS_SECTION as string) || ''}
          isMatched={matchedSections.has('PAYERS_SECTION')}
          defaultOpen={matchedSections.has('PAYERS_SECTION')}
        />
      )}
      {ccda?.ENCOUNTER_DIAGNOSIS && (
        <DisplayCCDARawSection
          title="Encounter Diagnoses"
          content={(ccda.ENCOUNTER_DIAGNOSIS as string) || ''}
          isMatched={matchedSections.has('ENCOUNTER_DIAGNOSIS')}
          defaultOpen={matchedSections.has('ENCOUNTER_DIAGNOSIS')}
        />
      )}
      {ccda?.ENCOUNTERS_SECTION && (
        <>
          {typeof ccda.ENCOUNTERS_SECTION === 'string' ||
          ccda.ENCOUNTERS_SECTION instanceof String ? (
            <DisplayCCDARawSection
              title="Encounters"
              content={(ccda.ENCOUNTERS_SECTION as string) || ''}
              isMatched={matchedSections.has('ENCOUNTERS_SECTION')}
              defaultOpen={matchedSections.has('ENCOUNTERS_SECTION')}
            />
          ) : (
            <DisplayCCDAElementSection
              title="Encounters"
              content={(ccda.ENCOUNTERS_SECTION as JSX.Element) || ''}
              isMatched={matchedSections.has('ENCOUNTERS_SECTION')}
              defaultOpen={matchedSections.has('ENCOUNTERS_SECTION')}
            />
          )}
        </>
      )}
    </>
  );
}
