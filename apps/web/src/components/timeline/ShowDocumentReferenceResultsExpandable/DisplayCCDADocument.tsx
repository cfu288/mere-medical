import { CCDAStructureDefinitionKeys2_1 } from './CCDAStructureDefinitionKeys2_1';
import { DisplayCCDAVitalSignsSection } from './DisplayCCDAVitalSignsSection';
import { DisplayCCDASection } from './DisplayCCDASection';

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
