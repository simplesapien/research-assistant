// services/database.js
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

class DatabaseService {
    constructor() {
        this.client = null;
        this.collection = null;
        this.db = null;  // Add this to store database reference
    }

    async connect() {
        console.log('Starting database connection...');
        
        if (this.collection) {
            console.log('Using existing database connection');
            return this.collection;
        }
    
        try {
            console.log('Attempting to connect to MongoDB...');
            console.log('URI:', process.env.MONGODB_URI ? 'URI exists' : 'URI is missing');
            console.log('DB Name:', process.env.DB_NAME ? 'DB Name exists' : 'DB Name is missing');
    
            this.client = await MongoClient.connect(process.env.MONGODB_URI);
            console.log('MongoDB client connected successfully');
            
            this.db = this.client.db(process.env.DB_NAME);
            console.log('Database selected');
            
            this.collection = this.db.collection('tools');
            console.log('Collection reference created');
            
            const count = await this.collection.countDocuments();
            console.log(`Connected to database: ${process.env.DB_NAME}`);
            console.log(`Number of documents in tools collection: ${count}`);
            
            return this.collection;
        } catch (error) {
            console.error('Database connection error details:', {
                name: error.name,
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            throw error;
        }
    }

    getCollection() {
        if (!this.collection) {
            console.warn('Database not connected when getCollection was called');
            throw new Error('Database not connected. Call connect() first.');
        }
        return this.collection;
    }

    getDb() {
        if (!this.db) {
            console.warn('Database not connected when getDb was called');
            throw new Error('Database not connected. Call connect() first.');
        }
        return this.db;
    }

    async disconnect() {
        if (this.client) {
            console.log('Disconnecting from database...');
            await this.client.close();
            this.client = null;
            this.collection = null;
            this.db = null;
            console.log('Database disconnected successfully');
        }
    }

    async getAllTools() {
        const collection = this.getCollection();
        return await collection.find({}).toArray();
    }

    async getToolById(id) {
        const collection = this.getCollection();
        return await collection.findOne({ _id: new ObjectId(id) });
    }

    async createTool(toolData) {
        const collection = this.getCollection();
        return await collection.insertOne(toolData);
    }

    async updateTool(id, toolData) {
        const collection = this.getCollection();
        return await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: toolData }
        );
    }

    async deleteTool(id) {
        const collection = this.getCollection();
        return await collection.deleteOne({ _id: new ObjectId(id) });
    }
}

module.exports = new DatabaseService();