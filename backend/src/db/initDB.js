require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const databaseService = require('../services/database');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Read tools from JSON file
const toolsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools.json'), 'utf8'));
const tools = toolsData.tools;

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

async function populateDatabase() {
  try {
    const collection = await databaseService.connect();
    
    // Clear existing data
    await collection.deleteMany({});
    console.log('Cleared existing data');

    // Insert new tools with embeddings
    for (const tool of tools) {
      const textForEmbedding = `${tool.name} ${tool.description} ${tool.tags.join(' ')}`;
      const embedding = await generateEmbedding(textForEmbedding);
      
      await collection.insertOne({
        ...tool,
        embedding,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Inserted: ${tool.name}`);
    }

    // Create indexes
    await collection.createIndex({ name: 'text', description: 'text', tags: 'text' });
    await collection.createIndex({ tags: 1 });
    await collection.createIndex({ type: 1 });
    await collection.createIndex({ pricing: 1 });
    console.log('Created indexes');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await databaseService.disconnect();
    console.log('Database connection closed');
  }
}

populateDatabase().catch(console.error);