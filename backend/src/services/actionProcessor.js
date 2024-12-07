const learningService = require('./learning');

class ActionProcessor {
    async processAction(action, context = {}) {
        try {
            switch (action.type?.toUpperCase()) {
                case 'TOOL_FEEDBACK':
                    return await this.processFeedback(action.data);
                case 'NEW_KNOWLEDGE':
                    return await this.processKnowledge(action.data);
                case 'RESEARCH_PATTERN':
                    return await this.processPattern(action.data);
                case 'GAPS':
                case 'GAP':
                    return await this.processGap(action.data);
                default:
                    console.warn(`Skipping unknown action type: ${action.type}`);
                    return null;
            }
        } catch (error) {
            console.error(`Error processing action ${action.type}:`, error);
            return null;
        }
    }

    async processFeedback(data) {
        if (!data || !data.toolName) return null;
        
        const content = data.specifics && Array.isArray(data.specifics) 
            ? data.specifics.join('. ')
            : `Feedback received for ${data.toolName}`;

        return await learningService.addInsight(
            content,
            'tool_feedback',
            {
                toolName: data.toolName,
                sentiment: data.sentiment || 'neutral',
                confidence: data.confidence || 0.5
            }
        );
    }

    async processKnowledge(data) {
        return await learningService.addInsight(
            data.content,
            data.type,
            {
                reliability: data.reliability,
                relatedTools: data.relatedTools
            }
        );
    }

    async processPattern(data) {
        return await learningService.addInsight(
            data.pattern,
            'research_pattern',
            {
                tools: data.tools,
                effectiveness: data.effectiveness
            }
        );
    }

    async processGap(data) {
        return await learningService.addInsight(
            data.description,
            `gap_${data.type}`,
            {
                urgency: data.urgency,
                gapType: data.type
            }
        );
    }
}

module.exports = new ActionProcessor(); 