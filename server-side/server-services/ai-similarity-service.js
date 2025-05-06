// server-side/server-services/ai-similarity-service.js

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../logger');

// Initialize Gemini AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Utility function to ensure minimum processing time for UI feedback
const withMinProcessingTime = async (promise, minTime = 1500) => {
    const start = Date.now();
    const result = await promise;
    const elapsed = Date.now() - start;
    if (elapsed < minTime) {
        await new Promise(resolve => setTimeout(resolve, minTime - elapsed));
    }
    return result;
};

const aiSimilarityService = {
    /**
     * Check similarity between quiz questions using AI
     * @param {Array} questions - Array of question objects or question texts
     * @returns {Promise<Object>} Similarity analysis result
     */
    async checkQuestionSimilarity(questions) {
        if (!Array.isArray(questions) || questions.length < 2) {
            return { result: 'Not enough questions to compare.' };
        }
        
        try {
            // Create the model
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            
            // Prepare question texts (handle both object and string format)
            const questionTexts = questions.map((q, i) => {
                const text = typeof q === 'string' ? q : (q.text || q.questionText || '');
                return `Question ${i + 1}: ${text}`;
            }).join('\n\n');
            
            // Build the prompt with clear instructions
            const prompt = `Analyze these quiz questions for similarity. If any questions are testing the same concept or are too similar, identify them. Only point out significant similarities that would make questions redundant.

Questions to analyze:
${questionTexts}

Respond in this format:
- If questions are unique: "All questions are unique."
- If similarities found: "Q[number] and Q[number] are similar because [brief reason]"`;
            
            // Set generation parameters for more consistent results
            const generationConfig = {
                temperature: 0.3, // Lower temperature for more consistent similarity detection
                topK: 1,
                topP: 1,
                maxOutputTokens: 1024,
            };
            
            // Generate content
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig
            });
            
            const response = result.response;
            const analysis = response.text().trim();
            
            // Extract the most relevant part of the AI response
            const simplifiedResponse = analysis.split('\n')[0].trim();
            return { result: simplifiedResponse };
            
        } catch (error) {
            logger.error('AI similarity check error:', error);
            throw new Error('AI similarity check failed: ' + (error.message || 'Unknown error'));
        }
    }
};

module.exports = aiSimilarityService;