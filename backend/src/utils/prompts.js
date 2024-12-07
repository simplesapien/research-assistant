// utils/prompts.js
const learningService = require('../services/learning');
const knowledgeRetrievalService = require('../services/knowledgeRetrieval');

// utils/prompts.js
async function generatePrompt(message, relevantTools, relevantInsights) {
    const toolsContext = relevantTools.map(tool => 
        `${tool.name}: ${tool.description}`
    ).join('\n');

    const insightsContext = relevantInsights?.map(insight => 
        `• ${insight.content}`
    ).join('\n') || '';

    return `You are a knowledgeable research assistant with access to both tools and accumulated knowledge.

Available Tools:
${toolsContext}

${insightsContext ? `Relevant Knowledge:\n${insightsContext}\n` : ''}

Guidelines:
1. Use both tools and knowledge to provide comprehensive answers
2. If user's feedback suggests a tool or approach worked/didn't work, learn from that
3. Keep responses natural and conversational
4. If you learn something new from the interaction, remember it for future reference`;
}

module.exports = { generatePrompt };