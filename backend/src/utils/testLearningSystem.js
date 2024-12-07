// utils/testLearningSystem.js
require('dotenv').config();
const { MongoClient } = require('mongodb');
const aiService = require('../services/ai');
const intentDetection = require('../services/intentDetection');
const knowledgeRetrieval = require('../services/knowledgeRetrieval');
const databaseService = require('../services/database');

async function testLearningSystem() {
    try {
        // Initialize database connection
        await databaseService.connect();
        await knowledgeRetrieval.initialize();

        console.log('\n=== Testing Learning System ===\n');

        // Test Case 1: Intent Detection
        console.log('1. Testing Intent Detection...');
        const testMessages = [
            {
                message: "Google Trends worked great for finding seasonal patterns, especially when combined with Ahrefs data",
                context: {
                    recentMessages: [
                        { role: 'assistant', content: 'I recommend using Google Trends and Ahrefs for this analysis.' },
                        { role: 'user', content: 'Thanks, I\'ll try that' }
                    ],
                    recommendedTools: [
                        { name: 'Google Trends' },
                        { name: 'Ahrefs' }
                    ]
                }
            },
            {
                message: "The market size data from Statista wasn't very accurate, had to use alternative sources",
                context: {
                    recentMessages: [
                        { role: 'assistant', content: 'Statista might have good market size data for your needs.' }
                    ],
                    recommendedTools: [
                        { name: 'Statista' }
                    ]
                }
            }
        ];

        for (const test of testMessages) {
            console.log(`\nAnalyzing message: "${test.message}"`);
            const intentAnalysis = await intentDetection.analyzeMessage(test.message, test.context);
            console.log('Intent Analysis:', JSON.stringify(intentAnalysis, null, 2));
        }

        // Test Case 2: Knowledge Retrieval
        console.log('\n2. Testing Knowledge Retrieval...');
        const testQueries = [
            {
                query: "What's the best way to validate market demand?",
                context: {
                    conversationHistory: [],
                    currentTopic: "market validation",
                    recentMessages: [],
                    recommendedTools: []
                }
            },
            {
                query: "How can I combine different research tools effectively?",
                context: {
                    conversationHistory: [
                        { role: 'user', content: "I'm trying to do comprehensive market research" },
                        { role: 'assistant', content: "Let's look at some tool combinations" }
                    ],
                    currentTopic: "research methodology",
                    recentMessages: [],
                    recommendedTools: []
                }
            }
        ];

        for (const test of testQueries) {
            console.log(`\nProcessing query: "${test.query}"`);
            
            // Generate contextual vectors
            const vectors = await knowledgeRetrieval.generateContextualVectors(test.query, test.context);
            console.log('Generated vectors for concepts:', vectors.originalConcepts);

            // Perform multi-stage retrieval
            const results = await knowledgeRetrieval.multiStageRetrieval(vectors, test.context);
            console.log('\nInitial results:', results.length);

            // Perform contextual reranking
            const rankedResults = await knowledgeRetrieval.contextualReranking(results, {
                ...test.context,
                query: test.query
            });

            console.log('\nTop ranked results:');
            rankedResults.slice(0, 3).forEach((result, i) => {
                console.log(`\n${i + 1}. Content: ${result.content}`);
                console.log(`   Relevance Score: ${result.relevanceScore}`);
                console.log(`   Reason: ${result.relevanceReason}`);
            });
        }

        // Test Case 3: End-to-End Integration
        console.log('\n3. Testing End-to-End Integration...');
        const integrationTest = {
            message: "I found that combining Google Trends with SEMrush gives better insights than using them separately",
            context: {
                conversationHistory: [
                    { role: 'assistant', content: 'You might want to try both Google Trends and SEMrush' },
                    { role: 'user', content: 'Ok, I\'ll give that a try' }
                ],
                recommendedTools: [
                    { name: 'Google Trends' },
                    { name: 'SEMrush' }
                ],
                currentTopic: "tool combination strategies"
            }
        };

        console.log('\nProcessing integration test...');
        
        // Analyze intent
        const intentAnalysis = await intentDetection.analyzeMessage(
            integrationTest.message,
            integrationTest.context
        );

        // Process actions from intent
        const actions = await intentDetection.processIntentAnalysis(
            intentAnalysis,
            integrationTest.context
        );

        // Retrieve relevant knowledge
        const relevantKnowledge = await knowledgeRetrieval.findRelevantKnowledge(
            integrationTest.message,
            {
                ...integrationTest.context,
                query: integrationTest.message
            }
        );

        console.log('\nIntegration Test Results:');
        console.log('Intent Analysis:', JSON.stringify(intentAnalysis, null, 2));
        console.log('Actions:', JSON.stringify(actions, null, 2));
        console.log('Relevant Knowledge:', JSON.stringify(relevantKnowledge, null, 2));

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await databaseService.disconnect();
        console.log('\nTest completed and connection closed.');
    }
}

// Move helper function after the main function
async function compareSimilarity(vec1, vec2) {
    if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
        throw new Error('Invalid vectors provided for comparison');
    }
    
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (mag1 * mag2);
}

// Only execute if this is the main module
if (require.main === module) {
    testLearningSystem().catch(console.error);
}

module.exports = {
    testLearningSystem,
    compareSimilarity
};