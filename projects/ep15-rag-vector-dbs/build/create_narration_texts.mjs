import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('projects/ep15-rag-vector-dbs/build/narration');
fs.mkdirSync(OUT_DIR, { recursive: true });

const actMatches = [
  { act: 1, text: `Large language models have a dirty secret: their internal memories are frozen in stone. Everything they know was baked into billions of numerical weights during pretraining. When you ask about events from yesterday, private company databases, or rare medical papers, the model faces a brutal choice: admit ignorance, or hallucinate with total confidence.

To fix this, engineers tried stuffing entire libraries directly into the prompt context window. But context windows are not free. Full self-attention scales quadratically with length—meaning doubling your document count quadruples your compute cost. Worse, models suffer from "Lost in the Middle"—routinely forgetting critical facts buried in long documents.

To build true enterprise intelligence, we don't need a bigger stomach. We need an external brain. Welcome to Retrieval-Augmented Generation—or RAG.` },
  { act: 2, text: `Computers cannot read concepts; they only understand numbers. The secret foundation of RAG is the dense embedding model.

Take a chunk of text—a paragraph, an email, or a code snippet. An embedding neural network compresses that entire block of text into a single high-dimensional coordinate vector—often fifteen hundred and thirty-six dimensions long.

In this mathematical universe, semantic similarity becomes physical proximity. The phrase "furious storm" and the phrase "raging tempest" share almost identical coordinates, even though they use completely different letters.

To measure how relevant a document is to your question, we convert your prompt into a query vector, point both vectors into hyperspace, and calculate the cosine of the angle between them. When the angle is zero, the cosine is one—an exact semantic match.` },
  { act: 3, text: `Calculating cosine similarity against ten documents takes milliseconds. But what happens when your enterprise vector database holds one hundred million documents? A brute-force linear search across all vectors would choke your GPU clusters and bankrupt your server budget.

This is where modern vector databases like Pinecone, Milvus, and Qdrant use HNSW: Hierarchical Navigable Small World graphs.

Imagine a multi-story transportation network. The top layer is an interstate highway: it has very few exits and takes massive leaps across conceptual space. The middle layers are regional roads. And the ground layer is a dense city grid connecting close neighbors.

When a query arrives, the search engine starts at the top layer, takes large greedy jumps toward the closest vector cluster, drops down a floor, and zooms in until it finds the exact nearest neighbors in logarithmic time. One hundred million vectors searched in five milliseconds.` },
  { act: 4, text: `Before text enters your vector database, it must be chunked. And chunking is an engineering art form.

Slice your documents too small—say, twenty words—and you destroy the surrounding context. Slice them too large—say, two thousand words—and the embedding vector averages out into a blurry, generic fog. Production systems use recursive character chunking with sliding overlaps, preserving paragraph cohesion.

Yet even the most advanced embeddings have a critical blind spot: exact keyword lookups. If a user queries a specific part serial number, a patient ID, or an API function name, dense semantic vectors often fail because random alphanumeric strings don't carry rich semantic meaning.

The production standard is Hybrid Search. We run traditional BM25 keyword matching alongside dense vector similarity, and combine their scores using Reciprocal Rank Fusion. You get the conceptual intuition of neural nets, paired with the exact precision of an inverted index.` },
  { act: 5, text: `Your hybrid retriever just pulled the top fifty candidate passages from your database. But bi-encoder retrieval has an inherent limitation: it encoded your query and your documents separately. It never let the specific words of your question directly interact with the words of the answer.

Enter the Cross-Encoder Reranker.

Unlike the initial retriever, the reranker takes your question and a candidate document, glues them together, and feeds them jointly through deep transformer cross-attention layers. Every word in the query attends to every word in the passage.

Because this full attention is computationally heavy, you don't run it across millions of documents. You run it only across the top fifty candidates. The reranker instantly exposes semantic impostors, reshuffles the deck, and delivers the top three flawless paragraphs directly to your LLM.` },
  { act: 6, text: `Naive RAG was a one-shot pipeline: ask a question, grab five paragraphs, hope for the best. Modern RAG is an active, autonomous reasoning system.

With Agentic and Self-RAG, the language model generates special reflection tokens. It evaluates its own certainty: does this prompt actually require retrieval? Once documents arrive, it critiques them: are these sources truly relevant, or contradictory? And before printing the final answer, it verifies attribution: is every single sentence grounded by factual evidence?

If the retrieved context is insufficient, the agent doesn't give up—it reformulates the search query, browses external APIs, and cross-checks sources.

By bridging frozen neural weights with high-speed vector geometry, we gave AI the ultimate superpower: an infinite, verified, and living memory.` }
];

for (const item of actMatches) {
  const filePath = path.join(OUT_DIR, `act${item.act}.txt`);
  fs.writeFileSync(filePath, item.text.trim());
  console.log(`Wrote ${filePath} (${item.text.length} chars)`);
}
