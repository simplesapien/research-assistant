const aiService = require('./ai');
const db = require('./database');

class SearchService {
    constructor() {
        this.collection = null;
        // Configurable parameters
        this.semanticWeight = 0.6;
        this.keywordWeight = 0.4;
        this.stopWords = new Set([
            'the', 'and', 'for', 'that', 'this', 'with', 'in', 
            'on', 'at', 'to', 'of', 'is', 'are'
        ]);
    }

    async initialize() {
        this.collection = await db.getCollection();
    }

    async generateEmbedding(text) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid input text');
            }
            
            const cleanedText = text.trim()
                .toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .replace(/\s+/g, ' ');
                
            const embedding = await aiService.generateEmbedding(cleanedText);
            
            // Normalize embedding vector
            const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            return embedding.map(val => val / magnitude);
        } catch (error) {
            console.error('Embedding generation error:', error);
            throw error;
        }
    }

    extractKeywords(text) {
        const keywords = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2)
            .filter(word => !this.stopWords.has(word));

        // Use Map to track keyword frequency
        const keywordFrequency = new Map();
        keywords.forEach(word => {
            keywordFrequency.set(word, (keywordFrequency.get(word) || 0) + 1);
        });

        // Return unique keywords sorted by frequency
        return [...new Set(
            Array.from(keywordFrequency.entries())
                .sort(([, freqA], [, freqB]) => freqB - freqA)
                .map(([word]) => word)
        )];
    }

    async searchTools(query, options = {}) {
        console.log('\n=== Starting New Search ===');
        console.log('Query:', query);
        console.log('Options:', JSON.stringify(options, null, 2));

        const {
            searchType = 'hybrid',
            filters = {},
            limit = 5,
            threshold = 0.1
        } = options;

        try {
            let results = [];
            console.log(`Executing ${searchType} search...`);
            
            switch (searchType) {
                case 'hybrid':
                    results = await this.hybridSearch(query, { filters, limit });
                    break;
                case 'semantic':
                    results = await this.semanticSearch(query, filters, limit);
                    break;
                case 'keyword':
                    results = await this.keywordSearch(query, filters, limit);
                    break;
            }

            console.log('\nResults before filtering:');
            results.forEach(r => console.log(`- ${r.name}: score=${r.score?.toFixed(3)}`));
            
            const filteredResults = results.filter(result => result.score >= threshold);
            
            console.log(`\nResults count: ${results.length}`);
            console.log(`Results after threshold (${threshold}): ${filteredResults.length}`);

            if (filteredResults.length > 0) {
                console.log('\nFiltered results:');
                filteredResults.forEach(r => console.log(`- ${r.name}: score=${r.score?.toFixed(3)}`));
            }
            
            return filteredResults;
        } catch (error) {
            console.error('Search error:', error);
            throw error;
        }
    }

    async semanticSearch(query, filters, limit) {
        console.log('Starting semanticSearch');
        const embedding = await this.generateEmbedding(query);
        const results = await this.performVectorSearch(embedding, filters, limit);
        return results;
    }

    async keywordSearch(query, filters, limit) {
        console.log('Starting keywordSearch');
        const keywords = this.extractKeywords(query);
        const results = await this.performKeywordSearch(keywords.join(' '), filters, limit);
        return results;
    }

    async hybridSearch(query, options = {}) {
        console.log('Starting hybridSearch');
        const { filters = {}, limit = 5 } = options;
        
        try {
            const [vectorResults, keywordResults] = await Promise.all([
                this.performVectorSearch(await this.generateEmbedding(query), filters, limit * 2),
                this.performKeywordSearch(query, filters, limit * 2)
            ]);

            const mergedResults = this.mergeSearchResults(vectorResults, keywordResults, limit);
            return mergedResults;
        } catch (error) {
            console.error('Hybrid search error:', error);
            throw error;
        }
    }

    async performVectorSearch(embedding, filters, limit) {
        console.log('\n=== Vector Search ===');
        console.log('Embedding length:', embedding.length);
        
        try {
            const pipeline = [
                {
                    $vectorSearch: {
                        index: "vector_search",
                        path: "embedding",
                        queryVector: embedding,
                        numCandidates: Math.max(limit * 4, 100), // Increased candidate pool
                        limit: Math.max(limit * 2, 50),
                        options: {
                            includeCosineSimilarity: true
                        }
                    }
                },
                {
                    $addFields: {
                        score: { $meta: "vectorSearchScore" },
                        cosineSimilarity: { $meta: "vectorSearchScore" },
                        searchType: "semantic"
                    }
                }
            ];

            if (Object.keys(filters).length > 0) {
                const filterStage = this.buildFilterStage(filters);
                pipeline.push({ $match: filterStage });
            }

            // Add scoring adjustments
            pipeline.push({
                $addFields: {
                    adjustedScore: {
                        $multiply: [
                            "$score",
                            { $add: [
                                1,
                                { $cond: [
                                    { $regexMatch: { 
                                        input: "$name", 
                                        regex: new RegExp(embedding.toString().slice(0, 100), "i") 
                                    }},
                                    0.2,
                                    0
                                ]}
                            ]}
                        ]
                    }
                }
            });

            pipeline.push({ $sort: { adjustedScore: -1 } });
            pipeline.push({ $limit: limit });

            const results = await this.collection.aggregate(pipeline).toArray();
            console.log(`Vector search returned ${results.length} results`);
            
            // Normalize scores
            const maxScore = Math.max(...results.map(r => r.adjustedScore || 0), 1);
            return results.map(r => ({
                ...r,
                score: (r.adjustedScore || 0) / maxScore
            }));
        } catch (error) {
            console.error('Vector search error:', error.message);
            throw error;
        }
    }

    async performKeywordSearch(query, filters, limit) {
        console.log('\n=== Keyword Search ===');
        
        try {
            const pipeline = [
                {
                    $search: {
                        index: "default",
                        compound: {
                            must: [{
                                text: {
                                    query: query,
                                    path: ["name", "description", "tags", "useCases.description", "useCases.method"],
                                    fuzzy: {
                                        maxEdits: 2,
                                        prefixLength: 1
                                    }
                                }
                            }]
                        }
                    }
                },
                {
                    $addFields: {
                        score: { $meta: "searchScore" },
                        searchType: "keyword"
                    }
                }
            ];

            if (Object.keys(filters).length > 0) {
                const filterStage = this.buildFilterStage(filters);
                pipeline.push({ $match: filterStage });
            }

            pipeline.push({ $limit: limit });

            const results = await this.collection.aggregate(pipeline).toArray();
            return results;
        } catch (error) {
            console.error('Keyword search error:', error);
            throw error;
        }
    }

    mergeSearchResults(semanticResults, keywordResults, limit) {
        const resultsMap = new Map();
        
        // Process and normalize both result sets
        const processResults = (results, searchType, weight) => {
            const maxScore = Math.max(...results.map(r => r.score || 0), 1);
            results.forEach(result => {
                const id = result._id?.toString();
                const normalizedScore = (result.score || 0) / maxScore;
                const weightedScore = normalizedScore * weight;
                
                if (!resultsMap.has(id)) {
                    resultsMap.set(id, {
                        ...result,
                        score: weightedScore,
                        matchDetails: {
                            [searchType]: normalizedScore,
                            weighted: weightedScore
                        }
                    });
                } else {
                    const existing = resultsMap.get(id);
                    const newScore = Math.max(existing.score, weightedScore);
                    resultsMap.set(id, {
                        ...existing,
                        score: newScore,
                        matchDetails: {
                            ...existing.matchDetails,
                            [searchType]: normalizedScore,
                            weighted: weightedScore
                        }
                    });
                }
            });
        };

        processResults(semanticResults, 'semantic', this.semanticWeight);
        processResults(keywordResults, 'keyword', this.keywordWeight);

        // Sort and apply diversity penalty
        return Array.from(resultsMap.values())
            .sort((a, b) => b.score - a.score)
            .map((result, index) => ({
                ...result,
                score: result.score * Math.pow(0.98, index) // Small penalty for lower ranks
            }))
            .slice(0, limit);
    }

    buildFilterStage(filters) {
        const filterCriteria = {};
        
        if (filters.tags?.length > 0) {
            filterCriteria.tags = { $in: filters.tags };
        }
        if (filters.type) {
            filterCriteria.type = filters.type;
        }
        if (filters.pricing) {
            filterCriteria.pricing = filters.pricing;
        }
        if (filters.categories?.length > 0) {
            filterCriteria.categories = { $in: filters.categories };
        }
        
        return filterCriteria;
    }
}

module.exports = new SearchService();