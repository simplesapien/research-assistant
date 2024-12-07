// services/learning.js
const aiService = require('./ai');
const db = require('./database');
const { ObjectId } = require('mongodb');

class LearningService {
    constructor() {
        this.insightsCollection = null;
    }

    async initialize() {
        const database = db.getDb();
        this.insightsCollection = database.collection('insights');
    }

    async addInsight(content, type, metadata = {}) {
        if (!this.insightsCollection) await this.initialize();

        try {
            // New: Quality check before adding
            const qualityCheck = await this.checkInsightQuality(content, type);
            if (!qualityCheck.isQualified) {
                console.log('Insight rejected due to quality:', qualityCheck.reason);
                return null;
            }

            // Check for similar existing insights to avoid duplicates
            const similar = await this.findSimilarInsights(content);
            if (similar.length > 0) {
                // Update existing insight's use count instead of adding new one
                await this.insightsCollection.updateOne(
                    { _id: similar[0]._id },
                    { 
                        $inc: { "metadata.useCount": 1 },
                        $set: { "metadata.lastUsed": new Date() }
                    }
                );
                return similar[0];
            }

            // Modified: Enhanced embedding generation
            const textForEmbedding = `${content} ${metadata.tags?.join(' ') || ''}`;
            const embedding = await aiService.generateEmbedding(textForEmbedding);
            
            const insight = {
                content,
                type,
                embedding,
                metadata: {
                    ...metadata,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    useCount: 0,
                    confidence: qualityCheck.confidence,  // New field
                    validatedBy: [],                     // New field
                    source: metadata.source || 'system', // New field
                    relatedTools: metadata.relatedTools || [] // New field
                }
            };

            const result = await this.insightsCollection.insertOne(insight);
            await this.updateLearningMetrics(insight);
            
            return result;
        } catch (error) {
            console.error('Error adding insight:', error);
            throw error;
        }
    }

    async updateLearningMetrics(insightData) {
        const database = db.getDb();
        const metricsCollection = database.collection('learning_metrics');

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await metricsCollection.updateOne(
                { date: today },
                {
                    $inc: {
                        [`insightsByType.${insightData.type}`]: 1,
                        totalInsights: 1
                    },
                    $push: {
                        recentInsights: {
                            $each: [{
                                id: insightData._id,
                                type: insightData.type,
                                value: insightData.value,
                                timestamp: new Date()
                            }],
                            $slice: -100 // Keep last 100 insights
                        }
                    },
                    $set: {
                        lastUpdate: new Date()
                    }
                },
                { upsert: true }
            );

            // Update tool success metrics if it's tool feedback
            if (insightData.type === 'tool_feedback' && insightData.metadata?.toolId) {
                await metricsCollection.updateOne(
                    { 'toolMetrics.toolId': insightData.metadata.toolId },
                    {
                        $inc: {
                            'toolMetrics.$.totalUses': 1,
                            'toolMetrics.$.successfulUses': insightData.metadata.success ? 1 : 0
                        },
                        $push: {
                            'toolMetrics.$.recentFeedback': {
                                $each: [{
                                    success: insightData.metadata.success,
                                    timestamp: new Date(),
                                    context: insightData.metadata.queryContext
                                }],
                                $slice: -10 // Keep last 10 feedback items
                            }
                        }
                    }
                );
            }
        } catch (error) {
            console.error('Error updating metrics:', error);
        }
    }

    async findSimilarInsights(content, threshold = 0.95) {
        const queryEmbedding = await aiService.generateEmbedding(content);
        
        return this.insightsCollection.aggregate([
            {
                $vectorSearch: {
                    index: "vector_insight_index",
                    path: "embedding",
                    queryVector: queryEmbedding,
                    numCandidates: 5,
                    limit: 1
                }
            },
            {
                $match: {
                    score: { $gte: threshold }
                }
            }
        ]).toArray();
    }

    async findRelevantInsights(query, context = {}, limit = 3) {
        if (!this.insightsCollection) await this.initialize();

        try {
            const queryEmbedding = await aiService.generateEmbedding(query);
            
            // Using only vector search since we have that index
            const insights = await this.insightsCollection.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_insight_index",
                        path: "embedding",
                        queryVector: queryEmbedding,
                        numCandidates: Math.max(limit * 2, 10), // Ensure enough candidates for good results
                        limit: limit,
                        options: {
                            includeCosineSimilarity: true
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        content: 1,
                        type: 1,
                        metadata: 1,
                        score: { $meta: "vectorSearchScore" }
                    }
                }
            ]).toArray();

            // New: Context-based reranking
            if (insights.length > 0) {
                const rerankedInsights = await this.rerankByContext(insights, query, context);
                this.updateInsightUsage(rerankedInsights.slice(0, limit)).catch(console.error);
                return rerankedInsights.slice(0, limit);
            }

            return [];
        } catch (error) {
            console.error('Error finding insights:', error);
            throw error;
        }
    }

    async addFeedback(toolId, feedback) {
        if (!this.insightsCollection) await this.initialize();

        try {
            const feedbackText = feedback.comment || 
                `Tool ${toolId} was ${feedback.success ? 'successful' : 'unsuccessful'} for its intended use.`;

            return await this.addInsight(feedbackText, 'tool_feedback', {
                toolId,
                success: feedback.success,
                tags: ['feedback', feedback.success ? 'positive' : 'negative']
            });
        } catch (error) {
            console.error('Error adding feedback:', error);
            throw error;
        }
    }

    async getToolInsights(toolId, limit = 5) {
        if (!this.insightsCollection) await this.initialize();

        try {
            // Since we don't have a regular index for toolId, we'll use vector search
            // with the tool's name/description as the query
            const tool = await db.getCollection().findOne(
                { $or: [{ id: toolId }, { _id: toolId }] },
                { projection: { name: 1, description: 1 } }
            );

            if (!tool) {
                throw new Error('Tool not found');
            }

            const queryText = `${tool.name} ${tool.description}`;
            return await this.findRelevantInsights(queryText, limit);
        } catch (error) {
            console.error('Error getting tool insights:', error);
            throw error;
        }
    }

    async summarizeInsights(query) {
        const insights = await this.findRelevantInsights(query, 5);
        
        // If no insights found, return null
        if (!insights.length) return null;

        // Format insights for GPT
        const insightText = insights
            .map(i => `- ${i.content} (Relevance: ${i.score.toFixed(2)})`)
            .join('\n');

        // Get summary from GPT
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "system",
                    content: `Summarize these research insights into 2-3 key points:
                    
                    ${insightText}
                    
                    Focus on practical, actionable takeaways.`
                }],
                temperature: 0.3,
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error summarizing insights:', error);
            return insightText; // Fallback to raw insights if GPT fails
        }
    }

    // Also modify updateToolUsage to store the embedding in the right place
    async updateToolUsage(toolId, metadata) {
        if (!this.insightsCollection) await this.initialize();

        try {
            // Generate embedding from the query context
            const embedding = await aiService.generateEmbedding(metadata.queryContext);

            const insight = {
                type: 'tool_usage',
                content: `Tool ${toolId} was used in research: ${metadata.queryContext}`,
                embedding, // Store at root level where our index exists
                metadata: {
                    toolId,
                    queryContext: metadata.queryContext,
                    timestamp: new Date(),
                    wasRecommended: metadata.wasRecommended || false
                }
            };

            // We store this as an insight so it benefits from our vector search
            await this.addInsight(
                insight.content,
                insight.type,
                insight.metadata
            );

        } catch (error) {
            console.error('Error updating tool usage:', error);
        }
    }

    async getToolUsageInsights(toolId) {
        if (!this.insightsCollection) await this.initialize();

        try {
            const tool = await db.getCollection().findOne(
                { $or: [{ id: toolId }, { _id: toolId }] },
                { projection: { name: 1, description: 1 } }
            );

            if (!tool) return null;

            const queryEmbedding = await aiService.generateEmbedding(
                `${tool.name} ${tool.description} usage patterns research methodology`
            );

            const usageInsights = await this.insightsCollection.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_insight_index",
                        path: "embedding",
                        queryVector: queryEmbedding,
                        numCandidates: 20,
                        limit: 10
                    }
                },
                {
                    $match: {
                        $or: [
                            { type: 'tool_usage' },
                            { type: 'tool_feedback' },
                            { 'metadata.toolId': toolId }
                        ]
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalUses: { 
                            $sum: { 
                                $cond: [{ $eq: ['$type', 'tool_usage'] }, 1, 0] 
                            }
                        },
                        successfulUses: {
                            $sum: {
                                $cond: [
                                    { $and: [
                                        { $eq: ['$type', 'tool_feedback'] },
                                        { $eq: ['$metadata.success', true] }
                                    ]},
                                    1,
                                    0
                                ]
                            }
                        },
                        relatedInsights: { 
                            $push: {
                                content: '$content',
                                type: '$type',
                                timestamp: '$metadata.timestamp',
                                score: { $meta: "vectorSearchScore" }
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalUses: 1,
                        successfulUses: 1,
                        successRate: {
                            $multiply: [
                                {
                                    $divide: [
                                        '$successfulUses',
                                        { $max: ['$totalUses', 1] }
                                    ]
                                },
                                100
                            ]
                        },
                        relatedInsights: {
                            $slice: ['$relatedInsights', 5]
                        }
                    }
                }
            ]).toArray();

            return usageInsights[0] || {
                totalUses: 0,
                successfulUses: 0,
                successRate: 0,
                relatedInsights: []
            };

        } catch (error) {
            console.error('Error getting tool usage insights:', error);
            return null;
        }
    }

    async getSimilarQueryPatterns(query) {
        if (!this.insightsCollection) await this.initialize();

        try {
            const queryEmbedding = await aiService.generateEmbedding(query);

            const patterns = await this.insightsCollection.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_insight_index",
                        path: "embedding",
                        queryVector: queryEmbedding,
                        numCandidates: 10,
                        limit: 5
                    }
                },
                {
                    $match: {
                        type: 'tool_usage'
                    }
                },
                {
                    $group: {
                        _id: '$metadata.toolId',
                        queryContexts: { $push: '$metadata.queryContext' },
                        useCount: { $sum: 1 },
                        averageScore: { 
                            $avg: { $meta: "vectorSearchScore" }
                        }
                    }
                },
                {
                    $sort: { averageScore: -1 }
                }
            ]).toArray();

            return patterns;

        } catch (error) {
            console.error('Error finding similar query patterns:', error);
            return [];
        }
    }

    // Test case -- delete me after
    async testPatternMatching(query = "How do I analyze market trends?") {
        try {
            console.log('Testing pattern matching with query:', query);
            
            // First add some test usage data
            await this.updateToolUsage('google-trends', {
                queryContext: 'How to track market trends over time',
                wasRecommended: true
            });
            
            await this.updateToolUsage('ahrefs', {
                queryContext: 'Best tools for market analysis',
                wasRecommended: true
            });
    
            // Wait a moment for the updates to process
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            // Try to find similar patterns
            const patterns = await this.getSimilarQueryPatterns(query);
            console.log('Found patterns:', JSON.stringify(patterns, null, 2));
            
            return patterns;
        } catch (error) {
            console.error('Test failed:', error);
            throw error;
        }
    }    

    // Also test case to check all contents of insights collection
    // return everyething exxcept for the actual embedding
    async findAllInsights() {
        if (!this.insightsCollection) await this.initialize();
        // return everything except for the embedding
        const insights = await this.insightsCollection.find({}).toArray();
        return insights.map(insight => {
            const { embedding, ...rest } = insight;
            return rest;
        });
    }

    async updateInsight(id, content, type) {
        if (!this.insightsCollection) await this.initialize();

        try {
            const embedding = await aiService.generateEmbedding(content);
            
            const result = await this.insightsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        content,
                        type,
                        embedding,
                        'metadata.updatedAt': new Date()
                    }
                }
            );
            
            return result;
        } catch (error) {
            console.error('Error updating insight:', error);
            throw error;
        }
    }

    async deleteInsight(id) {
        if (!this.insightsCollection) await this.initialize();

        try {
            await this.insightsCollection.deleteOne({ _id: new ObjectId(id) });
        } catch (error) {
            console.error('Error deleting insight:', error);
            throw error;
        }
    }

    // New method
    async checkInsightQuality(content, type) {
        const qualityPrompt = `
        Evaluate this potential insight for quality and usefulness:
        Content: "${content}"
        Type: ${type}

        Evaluate based on these criteria:
        1. Specificity (Is it specific and actionable?)
        2. Novelty (Does it provide new information?)
        3. Reusability (Can it be applied to future situations?)
        4. Clarity (Is it well-expressed and unambiguous?)

        Return a JSON object with:
        {
            "isQualified": boolean,
            "confidence": 0-1,
            "reason": string
        }`;

        const completion = await aiService.getCompletion(qualityPrompt);
        return JSON.parse(completion);
    }

    // New method
    async rerankByContext(insights, query, context) {
        const rerankerPrompt = `
        Given this search query and context, rerank these insights by relevance.
        
        Query: "${query}"
        ${context.currentTopic ? `Current Topic: ${context.currentTopic}` : ''}
        ${context.recentMessages ? `Recent Messages: ${JSON.stringify(context.recentMessages)}` : ''}

        Insights to rank:
        ${insights.map((i, idx) => `${idx + 1}. ${i.content}`).join('\n')}

        Return the indices of insights in order of relevance, with relevance scores (0-1).
        Format: JSON array of objects with "index" and "relevance" properties.`;

        const rankingResult = await aiService.getCompletion(rerankerPrompt);
        const rankings = JSON.parse(rankingResult);

        return rankings
            .map(rank => ({
                ...insights[rank.index - 1],
                contextualRelevance: rank.relevance
            }))
            .sort((a, b) => b.contextualRelevance - a.contextualRelevance);
    }

}

module.exports = new LearningService();