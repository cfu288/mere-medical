import { ClinicalDocument } from "./ClinicalDocument";

export type CreateClinicalDocument<T = any> = Omit<ClinicalDocument<T>, "_rev">;
