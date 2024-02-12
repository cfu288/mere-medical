export interface IVSDocument {
  id: string; // id: A unique identifier for the document. This is usually the document's ID in the database.
  hash: string; // hash: A hash of the document's text. This is used to quickly check if the document has been changed since it was added to vector storage.
  metadata: {
    [key: string]: any;
  }; // metadata: An object containing additional information about the document. The structure of this object can vary depending on the application.
  text?: string; // text: The actual text of the document. This is what is used to calculate the document's vector representation.
  chunk?: IVSChunkMeta;
  model?: string; // model: The name of the embedding model used to calculate the document's vector representation.
  // chunk: If the document is too long to be processed by the embedding model, it is split into chunks. This field contains information about the chunk.
  timestamp: number; // timestamp: The time when the document was added to the vector storage, represented as a Unix timestamp (milliseconds since the Unix Epoch).
  vectorMag?: number; // vecMag: The magnitude of the document's vector representation. This is precomputed to speed up similarity calculations.
  vector?: number[]; // vector: The vector representation of the document. This is calculated by an embedding model, such as the OpenAI model.
}

export interface IVSSimilaritySearchItem extends IVSDocument {
  score: number; // score: This is the cosine similarity score for the document. It ranges from 0 to 1, where 1 means the document is extremely similar or identical to the prompt, and a score close to 0 indicates that the document is dissimilar to the prompt.
}

export interface IVSChunkMeta {
  offset: number;
  size: number;
}
