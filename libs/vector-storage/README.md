# Vector Storage

Original Source found [here](https://github.com/nitaiaharoni1/vector-storage/blob/master/README.md).

Vector Storage is a lightweight and efficient vector database that stores document vectors in the browser's IndexedDB. This package allows you to perform semantic similarity searches on text documents using vector embeddings. Semantic search refers to the ability to understand the meaning and context of text documents and queries, enabling more accurate and relevant search results. Vector Storage leverages OpenAI embeddings to convert text documents into vectors and provides an interface for searching similar documents based on cosine similarity.

## Features

- Store and manage document vectors in IndexedDB
- Perform similarity searches on text documents
- Filter search results based on metadata or text content
- Automatically manage storage size and remove least recently used documents when space limit is reached

## Cosine Similarity Algorithm

Cosine similarity is a measure of similarity between two non-zero vectors in an inner product space. It is defined as
the cosine of the angle between the two vectors. The cosine similarity value ranges from -1 to 1, where 1 indicates
complete similarity, 0 indicates no similarity, and -1 indicates complete dissimilarity.

In this package, cosine similarity is used to measure the similarity between document vectors and the query vector. The
cosine similarity score is calculated using the dot product of the vectors, divided by the product of their magnitudes.

## LRU Mechanism

The Least Recently Used (LRU) mechanism is used to manage the storage size and automatically remove documents when the storage size exceeds the specified limit. Documents are sorted by their hit counter (ascending) and then by their timestamp (ascending). Documents with the lowest hit count and oldest timestamps are removed first until the storage size is below the limit.

## Installation

Install the package using npm:

```bash
npm i vector-storage
```

## Usage

Here is a basic example of how to use the VectorStorage class:

```javascript
import { VectorStorage } from 'vector-storage';

// Create an instance of VectorStorage
const vectorStore = new VectorStorage({ openAIApiKey: 'your-openai-api-key' });

// Add a text document to the store
await vectorStore.addText('The quick brown fox jumps over the lazy dog.', {
  category: 'example',
});

// Perform a similarity search
const results = await vectorStore.similaritySearch({
  query: 'A fast fox leaps over a sleepy hound.',
});

// Display the search results
console.log(results);
```

## API

### VectorStorage

The main class for managing document vectors in IndexedDB.

#### constructor(options: IVSOptions)

Creates a new instance of VectorStorage.

**options**: An object containing the following properties:

```typescript
interface IVSOptions {
  openAIApiKey: string; // The OpenAI API key used for generating embeddings.
  openaiModel?: string; // The OpenAI model used for generating embeddings. Defaults to 'text-embedding-3-large'.
}
```

### addText(text: string, metadata: object): Promise<IVSDocument>

Adds a text document to the store and returns the created document.

- **text**: The text content of the document.
- **metadata**: An object containing metadata associated with the document.

### addTexts(texts: string[], metadatas: object[]): Promise<IVSDocument[]>

Adds multiple text documents to the store and returns an array of created documents.

- **texts**: An array of text contents for the documents.
- **metadatas**: An array of metadata objects associated with the documents.

### similaritySearch(params: ISimilaritySearchParams): Promise<IVSDocument[]>

Performs a similarity search on the stored documents and returns an array of matching documents.

**params**: An object containing the following properties:

- **query**: The query text or vector for the search.
- **k** (optional): The number of top results to return (default: 4).
- **filterOptions** (optional): An object specifying filter criteria for the search.

### IVSDocument Interface

The IVSDocument interface represents a document object stored in the vector database. It contains the following properties:

```typescript
interface IVSDocument {
  metadata: object; // The metadata associated with the document for filtering.
  text: string; // The text content of the document.
  timestamp: number; // The timestamp indicating when the document was added to the store.
  vectorMag: number; // The magnitude of the document vector.
  vector: number[]; // The vector representation of the document.
}
```

## Contributing

Contributions to this project are welcome! If you would like to contribute, please follow these steps:

1. Fork the repository on GitHub.
2. Clone your fork to your local machine.
3. Create a new branch for your changes.
4. Make your changes and commit them to your branch.
5. Push your changes to your fork on GitHub.
6. Open a pull request from your branch to the main repository.

Please ensure that your code follows the project's coding style and that all tests pass before submitting a pull request. If you find any bugs or have suggestions for improvements, feel free to open an issue on GitHub.

## License

This project is licensed under the MIT License. See the LICENSE file for the full license text.

Copyright (c) Christopher Fu. All rights reserved.
