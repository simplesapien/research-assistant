// test-vector-search.js
require('dotenv').config();
const { MongoClient } = require('mongodb');
const aiService = require('../services/ai');

async function testVectorSearch() {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db(process.env.DB_NAME);
    
    try {
        // Test query
        const testQuery = "How do I analyze market trends?";
        const queryEmbedding = await aiService.generateEmbedding(testQuery);

        console.log('\nTesting insights vector search...');
        const insights = await db.collection('insights').aggregate([
            {
                $vectorSearch: {
                    index: "vector_insight_index",
                    path: "embedding",
                    queryVector: queryEmbedding,
                    numCandidates: 10,
                    limit: 3
                }
            },
            {
                $project: {
                    _id: 0,
                    content: 1,
                    type: 1,
                    score: { $meta: "vectorSearchScore" }
                }
            }
        ]).toArray();

        console.log('Found insights:', insights);

        console.log('\nTesting tools vector search...');
        const tools = await db.collection('tools').aggregate([
            {
                $vectorSearch: {
                    index: "vector_search",
                    path: "embedding",
                    queryVector: queryEmbedding,
                    numCandidates: 10,
                    limit: 3
                }
            },
            {
                $project: {
                    _id: 0,
                    name: 1,
                    description: 1,
                    score: { $meta: "vectorSearchScore" }
                }
            }
        ]).toArray();

        console.log('Found tools:', tools);

    } catch (error) {
        console.error('Error during test:', error);
    } finally {
        await client.close();
    }
}

testVectorSearch().catch(console.error);