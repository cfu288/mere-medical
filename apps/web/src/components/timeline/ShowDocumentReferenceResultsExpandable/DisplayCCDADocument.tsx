import { ErrorBoundary } from '../../ErrorBoundary';
import { CCDAStructureDefinitionKeys2_1 } from './CCDAStructureDefinitionKeys2_1';
import { DisplayCCDAElementSection } from './DisplayCCDAElementSection';
import { DisplayCCDARawSection } from './DisplayCCDARawSection';

export function DisplayCCDADocument({
  ccda,
}: {
  ccda:
    | Partial<Record<CCDAStructureDefinitionKeys2_1, string | JSX.Element>>
    | undefined;
}) {
  return (
    <>
      {ccda?.REASON_FOR_REFERRAL_SECTION && (
        <DisplayCCDARawSection
          title="Reason for Referral"
          content={(ccda.REASON_FOR_REFERRAL_SECTION as string) || ''}
        />
      )}
      {ccda?.ADMISSION_DIAGNOSIS_SECTION && (
        <DisplayCCDARawSection
          title="Admission Diagnosis"
          content={(ccda.ADMISSION_DIAGNOSIS_SECTION as string) || ''}
        />
      )}
      {ccda?.ADMISSION_MEDICATIONS_SECTION && (
        <DisplayCCDARawSection
          title="Admission Medication"
          content={(ccda.ADMISSION_MEDICATIONS_SECTION as string) || ''}
        />
      )}
      {ccda?.CHIEF_COMPLAINT_AND_REASON_FOR_VISIT_SECTION && (
        <DisplayCCDARawSection
          title="Chief Complaint and Reason for Visit"
          content={
            (ccda.CHIEF_COMPLAINT_AND_REASON_FOR_VISIT_SECTION as string) || ''
          }
        />
      )}
      {ccda?.CHIEF_COMPLAINT_SECTION && (
        <DisplayCCDARawSection
          title="Chief Complaint"
          content={(ccda.CHIEF_COMPLAINT_SECTION as string) || ''}
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
          />
        </ErrorBoundary>
      )}
      {ccda?.HISTORY_OF_PRESENT_ILLNESS_SECTION && (
        <DisplayCCDARawSection
          title="History of Present Illness"
          content={(ccda.HISTORY_OF_PRESENT_ILLNESS_SECTION as string) || ''}
        />
      )}
      {ccda?.MEDICATIONS_SECTION && (
        <DisplayCCDARawSection
          title="Medications"
          content={(ccda.MEDICATIONS_SECTION as string) || ''}
        />
      )}
      {ccda?.IMMUNIZATIONS_SECTION && (
        <DisplayCCDARawSection
          title="Immunizations"
          content={(ccda.IMMUNIZATIONS_SECTION as string) || ''}
        />
      )}
      {ccda?.ALLERGIES_AND_INTOLERANCES_SECTION && (
        <DisplayCCDARawSection
          title="Allergies and Intolerances"
          content={(ccda.ALLERGIES_AND_INTOLERANCES_SECTION as string) || ''}
        />
      )}
      {ccda?.FAMILY_HISTORY_SECTION && (
        <DisplayCCDARawSection
          title="Family History"
          content={(ccda.FAMILY_HISTORY_SECTION as string) || ''}
        />
      )}
      {ccda?.SOCIAL_HISTORY_SECTION && (
        <DisplayCCDARawSection
          title="Social History"
          content={(ccda.SOCIAL_HISTORY_SECTION as string) || ''}
        />
      )}
      {ccda?.HEALTH_CONCERNS_SECTION && (
        <DisplayCCDARawSection
          title="Health Concerns"
          content={(ccda.HEALTH_CONCERNS_SECTION as string) || ''}
        />
      )}
      {ccda?.REVIEW_OF_SYSTEMS_SECTION && (
        <DisplayCCDARawSection
          title="Review of Symptoms"
          content={(ccda.REVIEW_OF_SYSTEMS_SECTION as string) || ''}
        />
      )}
      {ccda?.PROCEDURES_SECTION && (
        <DisplayCCDARawSection
          title="Procedures"
          content={(ccda.PROCEDURES_SECTION as string) || ''}
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
          />
        </ErrorBoundary>
      )}
      {ccda?.FINDINGS_SECTION && (
        <DisplayCCDARawSection
          title="Findings"
          content={(ccda.FINDINGS_SECTION as string) || ''}
        />
      )}
      {ccda?.DICOM_OBJECT_CATALOG_SECTION_DCM_121181 && (
        <DisplayCCDARawSection
          title="Imaging Results"
          content={
            (ccda.DICOM_OBJECT_CATALOG_SECTION_DCM_121181 as string) || ''
          }
        />
      )}
      {ccda?.PREOPERATIVE_DIAGNOSIS_SECTION && (
        <DisplayCCDARawSection
          title="Pre Operative Diagnosis"
          content={(ccda.PREOPERATIVE_DIAGNOSIS_SECTION as string) || ''}
        />
      )}
      {ccda?.PROCEDURE_DESCRIPTION_SECTION && (
        <DisplayCCDARawSection
          title="Procedure Description"
          content={(ccda.PROCEDURE_DESCRIPTION_SECTION as string) || ''}
        />
      )}
      {ccda?.PROCEDURE_DISPOSITION_SECTION && (
        <DisplayCCDARawSection
          title="Procedure Disposition"
          content={(ccda.PROCEDURE_DISPOSITION_SECTION as string) || ''}
        />
      )}
      {ccda?.PROCEDURE_NOTE && (
        <DisplayCCDARawSection
          title="Procedure Note"
          content={(ccda.PROCEDURE_NOTE as string) || ''}
        />
      )}
      {ccda?.SURGERY_DESCRIPTION_SECTION && (
        <DisplayCCDARawSection
          title="Surgery Description"
          content={(ccda.SURGERY_DESCRIPTION_SECTION as string) || ''}
        />
      )}
      {ccda?.POSTOPERATIVE_DIAGNOSIS_SECTION && (
        <DisplayCCDARawSection
          title="Post Operative Diagnosis"
          content={(ccda.POSTOPERATIVE_DIAGNOSIS_SECTION as string) || ''}
        />
      )}
      {ccda?.POSTPROCEDURE_DIAGNOSIS_SECTION && (
        <DisplayCCDARawSection
          title="Post Procedure Diagnosis"
          content={(ccda.POSTPROCEDURE_DIAGNOSIS_SECTION as string) || ''}
        />
      )}
      {ccda?.PROGRESS_NOTE && (
        <DisplayCCDARawSection
          title="Progress Note"
          content={(ccda.PROGRESS_NOTE as string) || ''}
        />
      )}
      {ccda?.ASSESSMENT_SECTION && (
        <DisplayCCDARawSection
          title="Assessment"
          content={(ccda.ASSESSMENT_SECTION as string) || ''}
        />
      )}
      {ccda?.ASSESSMENT_AND_PLAN_SECTION && (
        <DisplayCCDARawSection
          title="Assessment and Plan"
          content={(ccda.ASSESSMENT_AND_PLAN_SECTION as string) || ''}
        />
      )}
      {ccda?.PROBLEM_SECTION && (
        <DisplayCCDARawSection
          title="Problems"
          content={(ccda.PROBLEM_SECTION as string) || ''}
        />
      )}
      {ccda?.NUTRITION_SECTION && (
        <DisplayCCDARawSection
          title="Nutrition"
          content={(ccda.NUTRITION_SECTION as string) || ''}
        />
      )}
      {ccda?.PLAN_OF_TREATMENT_SECTION && (
        <DisplayCCDARawSection
          title="Plan of Treatment"
          content={(ccda.PLAN_OF_TREATMENT_SECTION as string) || ''}
        />
      )}
      {ccda?.GOALS_SECTION && (
        <DisplayCCDARawSection
          title="Goals"
          content={(ccda.GOALS_SECTION as string) || ''}
        />
      )}
      {ccda?.MEDICAL_EQUIPMENT_SECTION && (
        <DisplayCCDARawSection
          title="Medical Equipment"
          content={(ccda.MEDICAL_EQUIPMENT_SECTION as string) || ''}
        />
      )}
      {ccda?.ADVANCE_DIRECTIVES_SECTION && (
        <DisplayCCDARawSection
          title="Advance Directives"
          content={(ccda.ADVANCE_DIRECTIVES_SECTION as string) || ''}
        />
      )}
      {ccda?.INSTRUCTIONS_SECTION && (
        <DisplayCCDARawSection
          title="Instructions"
          content={(ccda.INSTRUCTIONS_SECTION as string) || ''}
        />
      )}
      {ccda?.HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION && (
        <DisplayCCDARawSection
          title="Hospital Discharge Instructions"
          content={
            (ccda.HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION as string) || ''
          }
        />
      )}
      {ccda?.HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION && (
        <DisplayCCDARawSection
          title="Hospital Discharge Instructions"
          content={
            (ccda.HOSPITAL_DISCHARGE_INSTRUCTIONS_SECTION as string) || ''
          }
        />
      )}
      {ccda?.DISCHARGE_MEDICATIONS_SECTION && (
        <DisplayCCDARawSection
          title="Discharge Medications"
          content={(ccda.DISCHARGE_MEDICATIONS_SECTION as string) || ''}
        />
      )}
      {ccda?.DISCHARGE_SUMMARY && (
        <DisplayCCDARawSection
          title="Discharge Summary"
          content={(ccda.DISCHARGE_SUMMARY as string) || ''}
        />
      )}
      {ccda?.CARE_TEAMS_SECTION && (
        <DisplayCCDARawSection
          title="Care Team"
          content={(ccda.CARE_TEAMS_SECTION as string) || ''}
        />
      )}
      {ccda?.PAYERS_SECTION && (
        <DisplayCCDARawSection
          title="Payers"
          content={(ccda.PAYERS_SECTION as string) || ''}
        />
      )}
      {ccda?.ENCOUNTER_DIAGNOSIS && (
        <DisplayCCDARawSection
          title="Encounter Diagnoses"
          content={(ccda.ENCOUNTER_DIAGNOSIS as string) || ''}
        />
      )}
      {ccda?.ENCOUNTERS_SECTION && (
        <DisplayCCDARawSection
          title="Encounters"
          content={(ccda.ENCOUNTERS_SECTION as string) || ''}
        />
      )}
    </>
  );
}
