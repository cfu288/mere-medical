export interface IVSDocument {
  id: string; // id: A unique identifier for the document. This is usually the document's ID in the database.
  hits?: number; // hits: Optional field that counts the number of times this document has been returned in a similarity search. Omitted if 0.
  metadata: {
    [key: string]: any;
  }; // metadata: An object containing additional information about the document. The structure of this object can vary depending on the application.
  text?: string; // text: The actual text of the document. This is what is used to calculate the document's vector representation.
  chunk?: { offset: number; size: number };
  model?: string; // model: The name of the embedding model used to calculate the document's vector representation.
  // chunk: If the document is too long to be processed by the embedding model, it is split into chunks. This field contains information about the chunk.
  timestamp: number; // timestamp: The time when the document was added to the vector storage, represented as a Unix timestamp (milliseconds since the Unix Epoch).
  vectorMag?: number; // vecMag: The magnitude of the document's vector representation. This is precomputed to speed up similarity calculations.
  vector?: number[]; // vector: The vector representation of the document. This is calculated by an embedding model, such as the OpenAI model.
}

export interface IVSSimilaritySearchItem extends IVSDocument {
  score: number; // score: This is the cosine similarity score for the document. It ranges from 0 to 1, where 1 means the document is extremely similar or identical to the prompt, and a score close to 0 indicates that the document is dissimilar to the prompt.
}
