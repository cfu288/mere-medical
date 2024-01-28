import { ClinicalDocumentCollection } from '../../models/clinical-document/ClinicalDocument.collection';
import { ConnectionDocumentCollection } from '../../models/connection-document/ConnectionDocument.collection';
import { UserDocumentCollection } from '../../models/user-document/UserDocument.collection';
import { UserPreferencesDocumentCollection } from '../../models/user-preferences/UserPreferences.collection';
import { SummaryPagePreferencesCollection } from '../../models/summary-page-preferences/SummaryPagePreferences.collection';
import { VectorStorageDocumentCollection } from '../../models/vector-storage-document/VectorStorageDocument.collection';

export type DatabaseCollections = {
  clinical_documents: ClinicalDocumentCollection;
  connection_documents: ConnectionDocumentCollection;
  user_documents: UserDocumentCollection;
  user_preferences: UserPreferencesDocumentCollection;
  summary_page_preferences: SummaryPagePreferencesCollection;
  vector_storage: VectorStorageDocumentCollection;
};
