// services/intentDetection.js
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class IntentDetectionService {
    async analyzeMessage(message, context = {}) {
        const recentMessages = context.recentMessages || [];
        const recommendedTools = context.recommendedTools || [];

        const prompt = `
        As a research assistant's intent analyzer, examine this conversation carefully.
        
        Recent conversation context:
        ${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n') || 'No recent messages'}
        
        Tools recently recommended:
        ${recommendedTools.map(t => t.name).join(', ') || 'No tools recommended'}
        
        Latest user message: "${message}"

        Analyze this message for ALL of the following:

        1. SATISFACTION WITH TOOLS
        - Did any tool work well or poorly?
        - Is there implied satisfaction/dissatisfaction?
        - Any specific features mentioned as helpful/unhelpful?

        2. KNOWLEDGE SIGNALS
        - Is the user sharing new information or insights?
        - Are they validating or contradicting existing knowledge?
        - Are they describing a novel approach or methodology?

        3. RESEARCH PATTERNS
        - Is there a workflow or process being described?
        - Are they combining tools in an interesting way?
        - Have they discovered an innovative use case?

        4. MISSING CAPABILITIES
        - Are they expressing a need not met by current tools?
        - Is there a gap in the current knowledge base?
        - Are they requesting functionality we don't have?

        Provide analysis in the following JSON structure. Include ONLY if clearly indicated in the message (no speculation):

        {
            "toolFeedback": [{
                "toolName": string,
                "sentiment": "positive" | "negative" | "neutral",
                "confidence": 0-1,
                "specifics": string[],
                "context": string
            }],
            "newKnowledge": [{
                "type": "insight" | "methodology" | "use_case",
                "content": string,
                "reliability": 0-1,
                "relatedTools": string[]
            }],
            "researchPatterns": [{
                "pattern": string,
                "tools": string[],
                "effectiveness": 0-1
            }],
            "gaps": [{
                "type": "tool" | "knowledge" | "feature",
                "description": string,
                "urgency": 0-1
            }]
        }

        Return null for any category where no clear signals are present.
        `;

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview", // Using GPT-4 for better comprehension
                messages: [{ 
                    role: "system", 
                    content: "You are a precise intent analyzer. Only include information that is clearly indicated in the message. Do not speculate or infer beyond what's explicitly stated or strongly implied."
                },
                {
                    role: "user",
                    content: prompt
                }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error('Intent detection error:', error);
            return {
                toolFeedback: null,
                newKnowledge: null,
                researchPatterns: null,
                gaps: null
            };
        }
    }

    async processIntentAnalysis(analysis, context) {
        if (!analysis) return;

        const actions = [];

        // Process tool feedback
        if (analysis.toolFeedback) {
            for (const feedback of analysis.toolFeedback) {
                if (feedback.confidence > 0.7) {
                    actions.push({
                        type: 'TOOL_FEEDBACK',
                        data: feedback
                    });
                }
            }
        }

        // Process new knowledge
        if (analysis.newKnowledge) {
            for (const knowledge of analysis.newKnowledge) {
                if (knowledge.reliability > 0.6) {
                    actions.push({
                        type: 'NEW_KNOWLEDGE',
                        data: knowledge
                    });
                }
            }
        }

        // Process research patterns
        if (analysis.researchPatterns) {
            for (const pattern of analysis.researchPatterns) {
                if (pattern.effectiveness > 0.7) {
                    actions.push({
                        type: 'RESEARCH_PATTERN',
                        data: pattern
                    });
                }
            }
        }

        // Process gaps
        if (analysis.gaps) {
            actions.push({
                type: 'GAPS',
                data: analysis.gaps
            });
        }

        return actions;
    }
}

module.exports = new IntentDetectionService();