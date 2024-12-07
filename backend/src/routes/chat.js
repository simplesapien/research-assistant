const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { generatePrompt } = require('../utils/prompts');
const searchService = require('../services/search');
const learningService = require('../services/learning');
const intentDetection = require('../services/intentDetection');
const knowledgeRetrieval = require('../services/knowledgeRetrieval');
const aiService = require('../services/ai');
const actionProcessor = require('../services/actionProcessor');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Store conversations in memory (for now)
const conversations = new Map();

// Helper to extract potential insights from AI responses
async function extractInsights(message, aiResponse, tools) {
    try {
        const insightPrompt = `
        Analyze the following conversation and extract ONLY HIGH-VALUE insights about research methodology, tool usage, or market research approaches.
        
        User Query: "${message}"
        Tools Mentioned: ${tools.map(t => t.name).join(', ')}
        Assistant Response: "${aiResponse}"

        An insight should ONLY be extracted if it meets these criteria:
        1. It is specific and actionable
        2. It can be reused in future similar situations
        3. It adds new knowledge not obvious from the tools' descriptions
        4. It provides methodology or strategic guidance

        Extract a MAXIMUM of 2 insights, and ONLY if they meet ALL criteria above.
        Format: TYPE: CONTENT
        Types: methodology, tool_feedback, research_finding, market_insight
        
        If no insights meet ALL criteria, respond with "No insights found."
        
        Rate each insight's value (1-10) based on:
        - Specificity (how precise and clear)
        - Reusability (how applicable to future cases)
        - Novelty (how unique compared to existing knowledge)
        
        Format each insight as:
        TYPE: CONTENT
        Value: [1-10]
        Reason: [Why this insight is valuable]

        Insights:`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo-0125",
            messages: [{ role: "user", content: insightPrompt }],
            temperature: 0.3,
        });

        // Parse insights with their value scores
        const insights = completion.choices[0].message.content
            .split('\n\n')
            .filter(block => block.includes(':'))
            .map(block => {
                const lines = block.split('\n');
                const [type, content] = lines[0].split(':').map(s => s.trim());
                const valueMatch = lines[1]?.match(/Value: (\d+)/);
                const reasonMatch = lines[2]?.match(/Reason: (.+)/);
                
                return {
                    type: type.toLowerCase(),
                    content,
                    value: valueMatch ? parseInt(valueMatch[1]) : 0,
                    reason: reasonMatch ? reasonMatch[1] : ''
                };
            })
            .filter(insight => insight.value >= 7); // Only keep high-value insights

        return insights;
    } catch (error) {
        console.error('Error extracting insights:', error);
        return [];
    }
}

router.post('/', async (req, res) => {
    const { 
        message, 
        sessionId,
        feedback,
        model = "gpt-3.5-turbo-0125",
        searchOptions = {
            searchType: 'hybrid',
            limit: 5,
            threshold: 0.7,
            filters: {}
        }
    } = req.body;

    try {
        // Handle feedback if provided
        if (feedback) {
            await learningService.addInsight(
                feedback.comment || `Tool ${feedback.toolId} was ${feedback.success ? 'successful' : 'unsuccessful'} for its intended use.`,
                'tool_feedback',
                {
                    toolId: feedback.toolId,
                    success: feedback.success,
                    tags: ['tool-feedback', feedback.success ? 'success' : 'failure']
                }
            );
            
            // If this is just a feedback submission, return early
            if (!message) {
                return res.json({ status: 'Feedback recorded' });
            }
        }

        // Search for relevant tools and insights
        const [relevantTools, relevantInsights] = await Promise.all([
            searchService.searchTools(message, searchOptions),
            learningService.findRelevantInsights(message)
        ]);
        
        // Add new tool usage tracking and pattern-based sorting
        if (relevantTools.length > 0) {
            // Track tool usage
            await Promise.all(relevantTools.map(tool => 
                learningService.updateToolUsage(tool.id || tool._id, {
                    queryContext: message,
                    wasRecommended: true
                })
            ));

            // Get similar successful patterns to enhance response
            const similarPatterns = await learningService.getSimilarQueryPatterns(message);
            if (similarPatterns.length > 0) {
                // Adjust tool rankings based on past successful patterns
                relevantTools.sort((a, b) => {
                    const aPattern = similarPatterns.find(p => p._id === (a.id || a._id));
                    const bPattern = similarPatterns.find(p => p._id === (b.id || b._id));
                    return (bPattern?.averageScore || 0) - (aPattern?.averageScore || 0);
                });
            }
        }

        // Generate system prompt with context
        let systemPrompt = await generatePrompt(message, relevantTools, relevantInsights);

        // Get or initialize conversation history
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, [{ role: "system", content: systemPrompt }]);
        }

        const conversationHistory = conversations.get(sessionId);
        conversationHistory.push({ role: "user", content: message });

        // After getting conversation history but before the OpenAI completion
        const context = {
            recentMessages: conversationHistory.slice(-3),
            recommendedTools: relevantTools,
            currentTopic: await aiService.getCurrentTopic(conversationHistory),
            query: message
        };

        // Analyze intent and retrieve knowledge
        const [intentAnalysis, relevantKnowledge] = await Promise.all([
            intentDetection.analyzeMessage(message, context),
            knowledgeRetrieval.findRelevantKnowledge(message, context)
        ]);

        // Process any actions from intent analysis
        if (intentAnalysis) {
            const context = {
                query: message,
                recommendedTools: relevantTools
            };

            const actions = [];
            if (intentAnalysis.toolFeedback) actions.push({ type: 'TOOL_FEEDBACK', data: intentAnalysis.toolFeedback });
            if (intentAnalysis.newKnowledge) actions.push({ type: 'NEW_KNOWLEDGE', data: intentAnalysis.newKnowledge });
            if (intentAnalysis.researchPatterns) actions.push({ type: 'RESEARCH_PATTERN', data: intentAnalysis.researchPatterns });
            if (intentAnalysis.gaps) actions.push({ type: 'GAP', data: intentAnalysis.gaps });

            // Process actions using the action processor
            await Promise.all(actions.map(action => actionProcessor.processAction(action, context)));
        }

        // Update the system prompt with new knowledge
        systemPrompt = await generatePrompt(message, relevantTools, relevantKnowledge);
        conversationHistory[0] = { role: "system", content: systemPrompt };

        const completion = await openai.chat.completions.create({
            model: model,
            messages: conversationHistory,
            temperature: 0.7,
        });

        const reply = completion.choices[0].message;
        conversationHistory.push(reply);

        // Extract and store insights
        const insights = await extractInsights(message, reply.content, relevantTools);
        for (const insight of insights) {
            await learningService.addInsight(
                insight.content, 
                insight.type,
                {
                    source: 'ai_extraction',
                    tags: [insight.type, 'auto-extracted'],
                    relatedTools: relevantTools.map(t => t.id || t._id)
                }
            );
        }

        // Manage conversation length
        if (conversationHistory.length > 10) {
            const systemMessages = conversationHistory.filter(msg => msg.role === "system");
            const recentMessages = conversationHistory.slice(-8);
            conversations.set(sessionId, [...systemMessages, ...recentMessages]);
        }

        // Calculate some basic metrics about the response
        const responseMetrics = {
            toolCount: relevantTools.length,
            insightCount: relevantInsights.length,
            newInsightsExtracted: insights.length,
            responseLength: reply.content.length
        };


        res.json({ 
            response: reply.content,
            relevantTools,
            insights: relevantInsights.length > 0 ? relevantInsights : undefined,
            newInsights: insights.length > 0 ? insights : undefined,
            searchMetadata: {
                type: searchOptions.searchType,
                appliedFilters: searchOptions.filters,
                resultCount: relevantTools.length
            },
            metrics: responseMetrics
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
            error: 'Chat request failed',
            details: error.message
        });
    }
});
// Optional: Add an endpoint to get insights for a specific topic
router.get('/insights', async (req, res) => {
    try {
        const { query, limit = 5 } = req.query;
        const insights = await learningService.findRelevantInsights(query, parseInt(limit));
        res.json({ insights });
    } catch (error) {
        console.error('Error fetching insights:', error);
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
});

// Optional: Add an endpoint to get tool feedback statistics
router.get('/tool-feedback/:toolId', async (req, res) => {
    try {
        const { toolId } = req.params;
        const stats = await learningService.getFeedbackStats(toolId);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching tool feedback:', error);
        res.status(500).json({ error: 'Failed to fetch tool feedback' });
    }
});

module.exports = router;