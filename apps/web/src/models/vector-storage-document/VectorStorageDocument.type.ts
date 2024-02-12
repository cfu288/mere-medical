import { BaseDocument } from '../BaseDocument';

export interface VectorStorageDocument extends BaseDocument {
  hash: string; // hash: A hash of the document's text. This is used to quickly check if the document has been changed since it was added to vector storage.
  metadata: {
    [key: string]: any;
  }; // metadata: An object containing additional information about the document. The structure of this object can vary depending on the application.
  timestamp: number; // timestamp: The time when the document was added to the vector storage, represented as a Unix timestamp (milliseconds since the Unix Epoch).
  vectorMag?: number; // vecMag: The magnitude of the document's vector representation. This is precomputed to speed up similarity calculations.
  vector?: number[]; // vector: The vector representation of the document. This is calculated by an embedding model, such as the OpenAI model.
}
