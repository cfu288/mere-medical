import { OAuthConfig, TenantConfig } from './types.js';

export const EPIC_DEFAULT_SCOPES = ['openid', 'fhirUser'];

export const CERNER_DEFAULT_SCOPES = [
  'fhirUser',
  'offline_access',
  'openid',
  'patient/AllergyIntolerance.read',
  'patient/Appointment.read',
  'patient/Binary.read',
  'patient/CarePlan.read',
  'patient/CareTeam.read',
  'patient/Condition.read',
  'patient/Consent.read',
  'patient/Contract.read',
  'patient/Coverage.read',
  'patient/DiagnosticReport.read',
  'patient/DocumentReference.read',
  'patient/Device.read',
  'patient/Encounter.read',
  'patient/FamilyMemberHistory.read',
  'patient/Goal.read',
  'patient/Immunization.read',
  'patient/InsurancePlan.read',
  'patient/Media.read',
  'patient/MedicationAdministration.read',
  'patient/MedicationDispense.read',
  'patient/MedicationRequest.read',
  'patient/MedicationStatement.read',
  'patient/NutritionOrder.read',
  'patient/Observation.read',
  'patient/Patient.read',
  'patient/Person.read',
  'patient/Practitioner.read',
  'patient/Procedure.read',
  'patient/Provenance.read',
  'patient/Questionnaire.read',
  'patient/QuestionnaireResponse.read',
  'patient/RelatedPerson.read',
  'patient/Schedule.read',
  'patient/ServiceRequest.read',
  'patient/Slot.read',
  'patient/Specimen.read',
];

export interface OAuthConfigOptions {
  clientId: string;
  publicUrl: string;
  redirectPath: string;
  scopes: string[];
  tenant: TenantConfig;
}

export interface OnPatientConfigOptions {
  clientId: string;
  publicUrl: string;
  redirectPath: string;
}

export function buildEpicOAuthConfig(options: OAuthConfigOptions): OAuthConfig {
  return {
    clientId: options.clientId,
    redirectUri: `${options.publicUrl}${options.redirectPath}`,
    scopes: options.scopes,
    tenant: options.tenant,
  };
}

export function buildCernerOAuthConfig(options: OAuthConfigOptions): OAuthConfig {
  return {
    clientId: options.clientId,
    redirectUri: `${options.publicUrl}${options.redirectPath}`,
    scopes: options.scopes,
    tenant: options.tenant,
  };
}

export function buildOnPatientAuthUrl(options: OnPatientConfigOptions): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: `${options.publicUrl}${options.redirectPath}`,
    scope: 'patient/*.read',
    response_type: 'code',
  });

  return `https://onpatient.com/o/authorize/?${params.toString()}`;
}
