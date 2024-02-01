import { RxDatabase } from 'rxdb';

export interface IVSOptions<T> {
  openAIApiKey?: string; // The OpenAI API key used for generating embeddings.
  maxSizeInMB?: number; // The maximum size of the storage in megabytes. Defaults to 4.8. Cannot exceed 5.
  debounceTime?: number; // The debounce time in milliseconds for saving to local storage. Defaults to 0.
  embeddingModel?: string; // The embedding model used for generating embeddings. Defaults to 'text-embedding-3-large'.
  embedTextsFn?: (texts: string[]) => Promise<number[][]>; // Option for custom embedding function
  rxdb?: RxDatabase<T>; // The RxDB database instance. Defaults to the global database instance.
}
