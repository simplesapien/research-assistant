// services/knowledgeRetrieval.js
const aiService = require('./ai');
const db = require('./database');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

class KnowledgeRetrievalService {
    constructor() {
        this.insightsCollection = null;
    }

    async initialize() {
        if (!this.insightsCollection) {
            const database = await db.getDb();
            this.insightsCollection = database.collection('insights');
        }
    }

    async generateContextualVectors(query, context) {
        try {
            // Generate main embedding
            const mainEmbedding = await aiService.generateEmbedding(query);
            
            // Extract key concepts
            const conceptPrompt = `
            Extract key concepts from this query in the context of research and tools.
            Query: "${query}"
            ${context.conversationHistory ? `Recent context: ${context.conversationHistory.slice(-2).map(m => m.content).join(' ')}` : ''}
            
            Return a JSON object with this structure:
            {
                "concepts": ["concept1", "concept2", "concept3"]
            }
            
            Focus on research methodology, tool usage, and specific requirements.`;

            const conceptCompletion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                messages: [{ 
                    role: "user", 
                    content: conceptPrompt 
                }],
                temperature: 0.3,
                response_format: { type: "json_object" }
            });

            const conceptsData = JSON.parse(conceptCompletion.choices[0].message.content);
            const concepts = conceptsData.concepts || [];

            // Generate embeddings for each concept
            const conceptEmbeddings = await Promise.all(
                concepts.map(concept => aiService.generateEmbedding(concept))
            );

            return {
                main: mainEmbedding,
                concepts: conceptEmbeddings,
                originalConcepts: concepts
            };
        } catch (error) {
            console.error('Error generating contextual vectors:', error);
            throw error;
        }
    }

    async multiStageRetrieval(vectors, context) {
        try {
            await this.initialize();
            const { main, concepts, originalConcepts } = vectors;
            
            // Stage 1: Broad retrieval using main vector
            const mainResults = await this.insightsCollection.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_insight_index",
                        path: "embedding",
                        queryVector: main,
                        numCandidates: 20,
                        limit: 10
                    }
                },
                {
                    $addFields: {
                        mainScore: { $meta: "vectorSearchScore" }
                    }
                }
            ]).toArray();

            // Stage 2: Concept-based retrieval
            const conceptResults = await Promise.all(concepts.map(async (conceptVector, index) => {
                return this.insightsCollection.aggregate([
                    {
                        $vectorSearch: {
                            index: "vector_insight_index",
                            path: "embedding",
                            queryVector: conceptVector,
                            numCandidates: 10,
                            limit: 5
                        }
                    },
                    {
                        $addFields: {
                            conceptScore: { $meta: "vectorSearchScore" },
                            matchedConcept: originalConcepts[index]
                        }
                    }
                ]).toArray();
            }));

            // Combine and deduplicate results
            const allResults = [...mainResults, ...conceptResults.flat()];
            const uniqueResults = Array.from(
                new Map(allResults.map(item => [item._id.toString(), item])).values()
            );

            return uniqueResults;
        } catch (error) {
            console.error('Error in multi-stage retrieval:', error);
            return [];
        }
    }

    async contextualReranking(results, context) {
        if (results.length === 0) return [];

        try {
            const rankingPrompt = `
            Rerank these knowledge items based on their relevance to the current context.
            
            Current query: "${context.query}"
            ${context.conversationHistory ? `Recent messages: ${context.conversationHistory.slice(-2).map(m => m.content).join('\n')}` : ''}
            ${context.currentTopic ? `Current topic: ${context.currentTopic}` : ''}

            Knowledge items:
            ${results.map((r, i) => `${i + 1}. ${r.content}`).join('\n')}

            Return a JSON object with this structure:
            {
                "rankings": [
                    {
                        "index": number,
                        "relevanceScore": number between 0-1,
                        "reason": "string explaining why"
                    }
                ]
            }

            Only include items with relevance > 0.6.`;

            const rankingCompletion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                messages: [{ role: "user", content: rankingPrompt }],
                temperature: 0.3,
                response_format: { type: "json_object" }
            });

            const rankingsData = JSON.parse(rankingCompletion.choices[0].message.content);
            const rankings = rankingsData.rankings || [];

            // Apply rankings to results
            const rankedResults = rankings
                .map(ranking => ({
                    ...results[ranking.index - 1],
                    relevanceScore: ranking.relevanceScore,
                    relevanceReason: ranking.reason
                }))
                .filter(result => result.relevanceScore > 0.6)
                .sort((a, b) => b.relevanceScore - a.relevanceScore);

            return rankedResults;
        } catch (error) {
            console.error('Error in contextual reranking:', error);
            return results; // Return original results if reranking fails
        }
    }

    async findRelevantKnowledge(query, context = {}) {
        try {
            const vectors = await this.generateContextualVectors(query, context);
            const results = await this.multiStageRetrieval(vectors, context);
            return await this.contextualReranking(results, {
                ...context,
                query
            });
        } catch (error) {
            console.error('Error finding relevant knowledge:', error);
            return [];
        }
    }
}

module.exports = new KnowledgeRetrievalService();