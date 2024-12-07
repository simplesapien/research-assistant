require('dotenv').config();
const OpenAI = require('openai');

class AIService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async detectQueryIntent(query) {
        try {
            const response = await this.openai.completions.create({
                model: "gpt-3.5-turbo-instruct",
                prompt: `Analyze the following query and classify it into exactly one of these categories: 'ideation', 'validation', or 'technical'. Only respond with one of these three words.

Query: "${query}"

Consider:
- Ideation: Questions about new ideas, trends, innovation, and market opportunities
- Validation: Questions about market size, competition, customer feedback, and verification
- Technical: Questions about implementation, APIs, technology feasibility, and development

Classification:`,
                max_tokens: 10,
                temperature: 0.3
            });

            const intent = response.choices[0].text.trim().toLowerCase();
            const validIntents = ['ideation', 'validation', 'technical'];
            return validIntents.includes(intent) ? intent : 'ideation';
        } catch (error) {
            console.error('Error detecting query intent:', error);
            return 'ideation';
        }
    }

    async generateEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    }

    async getCompletion(prompt) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
                response_format: { type: "json_object" }
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Completion error:', error);
            throw error;
        }
    }

    async getCurrentTopic(conversationHistory) {
        try {
            // Get the last few messages for context
            const recentMessages = conversationHistory
                .filter(msg => msg.role !== 'system')
                .slice(-3)
                .map(msg => msg.content)
                .join('\n');

            const topicPrompt = `
            Based on these recent messages, what is the main topic being discussed? 
            Provide a single, brief topic label (max 3 words):
            
            ${recentMessages}`;

            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                messages: [{ role: "user", content: topicPrompt }],
                temperature: 0.3,
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('Error determining topic:', error);
            return 'general inquiry'; // fallback topic
        }
    }
}

module.exports = new AIService(); 