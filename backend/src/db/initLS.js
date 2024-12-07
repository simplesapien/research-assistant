require('dotenv').config();
const OpenAI = require('openai');
const databaseService = require('../services/database');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

async function initializeLearningSystem() {
  try {
    await databaseService.connect();
    const db = databaseService.getDb();

    // Drop existing collections if they exist
    const collections = ['insights', 'learning_metrics'];
    for (const collectionName of collections) {
      if (await db.listCollections({ name: collectionName }).hasNext()) {
        await db.collection(collectionName).drop();
        console.log(`Dropped existing ${collectionName} collection`);
      }
    }

    // Create insights collection
    await db.createCollection('insights');
    const insightsCollection = db.collection('insights');
    
    // Create regular indexes
    await insightsCollection.createIndex({ type: 1 });
    await insightsCollection.createIndex({ "metadata.tags": 1 });
    await insightsCollection.createIndex({ 
      content: "text", 
      "metadata.tags": "text" 
    });

    console.log('Initialized insights collection and regular indexes');

    // Get sample insights from insights.json
    const { researchInsights } = require('./insights.json');

    // Insert seed insights with embeddings
    for (const insight of researchInsights) {
      const embedding = await generateEmbedding(insight.content);
      await insightsCollection.insertOne({
        ...insight,
        embedding
      });
      console.log(`Inserted insight: ${insight.content.substring(0, 50)}...`);
    }

    // Create learning metrics collection
    await db.createCollection('learning_metrics');
    const metricsCollection = db.collection('learning_metrics');
    
    await metricsCollection.createIndex({ timestamp: 1 });
    await metricsCollection.createIndex({ "insightId": 1 });

    console.log('Initialized learning metrics collection');

    // Insert initial metrics document
    await metricsCollection.insertOne({
      totalInsights: researchInsights.length,
      insightsByType: {
        methodology: 1,
        research_finding: 1
      },
      lastUpdate: new Date(),
      systemVersion: "1.0.0"
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await databaseService.disconnect();
    console.log('Database connection closed');
  }
}

initializeLearningSystem().catch(console.error);