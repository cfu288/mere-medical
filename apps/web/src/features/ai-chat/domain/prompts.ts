import { PreparedDocuments } from './types';

export const MEDICAL_AI_SYSTEM_PROMPT = `You are a helpful medical AI assistant. You have access to the patient's medical records and should provide accurate, relevant information based on those records.

Important guidelines:
- Only reference information that is explicitly stated in the provided medical records
- Be clear when information is not available in the records
- Use simple, easy-to-understand language
- Cite specific dates or document types when referencing information
- Be empathetic and supportive in your responses`;

/**
 * Builds the user prompt for RAG operations
 */
export function buildRAGUserPrompt(
  query: string,
  documents: PreparedDocuments,
): string {
  return `Patient Question: ${query}

Relevant Medical Records (${documents.texts.length} sections from ${documents.sourceDocs.length} documents):

${documents.texts
  .map(
    (doc, i) => `
[${i + 1}] ${doc.date ? `Date: ${doc.date}` : 'No date'} | ${doc.resourceType || 'Unknown type'}
${doc.text}
`,
  )
  .join('\n---\n')}

Please provide a helpful response to the patient's question based on these medical records.`;
}

/**
 * Creates the system prompt for reranking
 */
export function createRerankingPrompt(query: string): string {
  return `Rate each document's relevance to: "${query}"

You will receive documents labeled as DOCUMENT 1, DOCUMENT 2, etc.

Return a JSON object mapping document numbers to scores (0-10):
{"1": 8, "2": 3, "3": 9, "4": 2, "5": 7}

Scoring guidelines:
- 9-10: Document directly answers the query with specific medical data (exact test results, diagnoses, etc.)
- 7-8: Document is highly relevant and contains related medical information
- 5-6: Document is somewhat relevant but may be tangential
- 3-4: Document mentions related concepts but lacks specific relevance
- 0-2: Document is unrelated to the query

IMPORTANT: 
- Use exactly this format
- Include ALL document numbers
- Scores must be 0-10
- Return ONLY the JSON object, nothing else`;
}
