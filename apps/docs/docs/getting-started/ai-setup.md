---
sidebar_position: 5
description: Set up AI-powered features with OpenAI or Ollama
---

# Setting Up AI Features with OpenAI and Ollama

This guide will walk you through setting up Mere Medical's experimental AI features, including semantic search and the Q&A assistant. You can choose between using OpenAI's cloud services or running models locally with Ollama.

## Overview

Mere Medical offers optional AI-powered features to enhance your experience:

- **Semantic Search**: Find relevant medical records even when your search terms don't exactly match the content
- **Mere Assistant**: Ask questions about your medical records and get AI-powered answers
- **Document Reranking** (Optional): Use specialized AI models to improve the relevance of search results

:::warning Privacy Considerations

**OpenAI**: Your medical data will be sent to OpenAI's servers for processing. Use this option only for testing with non-sensitive data. Would only recommend this for non-medical data or testing purposes.

**Ollama**: Runs entirely on your local machine. All data processing stays local, making it the recommended option for real medical records.

:::

## Prerequisites

Before enabling AI features, ensure you have:

- Mere Medical running
- For OpenAI: An [OpenAI API key](https://help.openai.com/en/articles/4936850-where-do-i-find-my-api-key)
- For Ollama: [Ollama](https://ollama.com) installed on your local machine

## Option 1: Setting Up with Ollama (Recommended)

Ollama allows you to run AI models locally, keeping all your data private.

### Step 1: Install and Configure Ollama

1. Install Ollama from [ollama.com](https://ollama.com)

2. Pull the required models:

```bash
# For chat functionality (choose one)
ollama pull gpt-oss:20b
ollama pull deepseek-r1:14b
ollama pull qwen2.5:14b-instruct  # Default model
ollama pull qwen2.5:32b-instruct  # Larger, more capable model

# For embeddings/semantic search (choose one)
ollama pull mxbai-embed-large  # Default embedding model
ollama pull nomic-embed-text
ollama pull dengcao/Qwen3-Embedding-4B:Q4_K_M  # Larger embedding model

# Optional: For improved document reranking (choose one)
ollama pull qwen2.5:3b  # Smaller, faster reranking model
ollama pull qwen2.5:7b  # Larger, more accurate reranking model
```

3. Configure the context window for better performance with longer documents:

```bash
# For each model you plan to use, set the context window size
ollama run gpt-oss:20b
>>> /set parameter num_ctx 8192
>>> /bye

ollama run qwen2.5:14b-instruct
>>> /set parameter num_ctx 8192
>>> /bye

# Repeat for other chat models if using different ones
ollama run deepseek-r1:14b
>>> /set parameter num_ctx 8192
>>> /bye

# If using qwen2.5:3b for reranking, configure its context window
ollama run qwen2.5:3b
>>> /set parameter num_ctx 32768
>>> /bye

# If using qwen2.5:7b for reranking instead
ollama run qwen2.5:7b
>>> /set parameter num_ctx 32768
>>> /bye
```

4. Start Ollama (if not already running):

```bash
ollama serve
```

### Step 2: Enable Features in Mere Medical

1. Navigate to the Settings tab in Mere Medical
2. Toggle "Show experimental features"
3. Enable "Mere Assistant"
4. Select "Ollama" as your AI provider
5. Verify the Ollama endpoint (default: `http://localhost:11434`)
6. Configure your preferred models:

   - **Chat Model**: `gpt-oss:20b`, `qwen2.5:14b-instruct` (default), or `deepseek-r1:14b`
   - **Embedding Model**: `mxbai-embed-large` (default) or `nomic-embed-text`
   - **Reranking Model** (Optional): `qwen2.5:3b` (faster) or `qwen2.5:7b` (more accurate) for improved search relevance, or "None" to disable reranking

7. Click "Test Connection" to verify Ollama is accessible from your browser

## Option 2: Setting Up with OpenAI

:::caution Privacy Warning

This option sends your medical data to OpenAI's servers. Only use this for testing with non-sensitive data.

:::

### Step 1: Obtain an OpenAI API Key

1. Create an account at [platform.openai.com](https://platform.openai.com)
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key (you won't be able to see it again)

### Step 2: Enable Features in Mere Medical

1. Navigate to the Settings tab
2. Toggle "Show experimental features"
3. Enable "Mere Assistant"
4. Select "OpenAI" as your AI provider
5. Enter your OpenAI API key

## Using the AI Features

### Document Reranking (Optional)

Document reranking is an optional feature that uses specialized AI models to improve search result relevance:

- **What it does**: After semantic search finds relevant documents, the reranking model re-scores them based on how well they answer your specific question
- **When to use it**: Enable reranking when you want the most accurate answers to complex medical questions
- **Performance trade-off**: Reranking adds processing time but can improve result quality
- **Default**: Disabled by default (select "None" in the Reranking Model dropdown)

To enable reranking with Ollama:

1. Pull a reranking model:
   - `ollama pull qwen2.5:3b` (faster, uses less memory)
   - `ollama pull qwen2.5:7b` (more accurate, uses more memory)
2. Configure its context window as shown above
3. Select it in the Settings under "Reranking Model"

### Semantic Search

Once AI features are enabled and your documents are processed:

1. Go to the Timeline tab
2. Use the search bar to find records
3. Semantic search automatically finds related content

Example searches:

- "high blood sugar" will find diabetes-related records
- "breathing problems" will find respiratory-related records
- "heart issues" will find cardiovascular-related records

### Mere Assistant

1. Click on the "Mere Assistant" tab
2. Ask questions about your medical records
3. The AI will search your records and provide informed answers

Example questions:

- "What were my last cholesterol levels?"
- "Do I have any allergies listed in my records?"
- "When was my last physical exam?"

## Troubleshooting

### Ollama Connection Issues

If Mere can't connect to Ollama:

1. Verify Ollama is running:

```bash
ollama list
```

2. Check the endpoint URL in your browser:

   - Should be: `http://localhost:11434`
   - The browser connects directly to Ollama, not through Docker

3. Test the connection:

```bash
curl http://localhost:11434/api/tags
```

4. Ensure firewall isn't blocking port 11434

5. Check browser console for CORS errors - Ollama should allow browser connections by default

### OpenAI API Errors

Common issues and solutions:

- **Invalid API Key**: Verify your key is correct and has credits
- **Rate Limiting**: OpenAI has usage limits; wait or upgrade your plan
- **Network Issues**: Check your internet connection
