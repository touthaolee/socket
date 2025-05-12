/**
 * AI Similarity Service
 * Provides enhanced similarity checking capabilities for quiz questions
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const appConfig = require('../../config/app-config');

class AiSimilarityService {
  constructor() {
    // Initialize Google Generative AI client
    this.genAI = new GoogleGenerativeAI(appConfig.googleAiApiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Cache similarity results to avoid redundant API calls
    this.cache = new Map();
    this.cacheMaxSize = 100;
    
    console.log('AI Similarity Service initialized');
  }
  
  /**
   * Check similarity between a question and a set of other questions
   * @param {string} questionText - The main question to compare
   * @param {string[]} compareQuestions - Questions to compare against
   * @returns {Promise<Object>} Similarity analysis results
   */
  async checkSimilarity(questionText, compareQuestions) {
    try {
      // Validate inputs
      if (!questionText || !compareQuestions || compareQuestions.length === 0) {
        return { hasSimilar: false, matches: [] };
      }
      
      // Prepare the prompt for the AI
      const prompt = this._buildSimilarityPrompt(questionText, compareQuestions);
      
      // Get AI response
      const result = await this._callAiModel(prompt);
      
      // Extract similarity data from AI response
      const similarityResult = this._parseSimilarityResponse(result, compareQuestions);
      
      return similarityResult;
    } catch (error) {
      console.error('Error checking similarity:', error);
      // Return a basic result when there's an error
      return { 
        hasSimilar: false, 
        matches: [],
        error: error.message 
      };
    }
  }
  
  /**
   * Check similarity across a batch of questions
   * @param {string[]} questions - Array of questions to check for similarity
   * @returns {Promise<Array>} Array of similarity results for each question
   */
  async checkBatchSimilarity(questions) {
    try {
      if (!questions || questions.length < 2) {
        return [];
      }
      
      const results = [];
      
      // Compare each question to all others
      for (let i = 0; i < questions.length; i++) {
        const currentQuestion = questions[i];
        const otherQuestions = questions.filter((_, idx) => idx !== i);
        
        // Check similarity
        const result = await this.checkSimilarity(currentQuestion, otherQuestions);
        
        results.push({
          index: i,
          text: currentQuestion,
          ...result
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error in batch similarity check:', error);
      return questions.map(() => ({ hasSimilar: false, matches: [], error: error.message }));
    }
  }
  
  // Private methods
  
  /**
   * Build a prompt for the AI to analyze question similarity
   * @private
   */
  _buildSimilarityPrompt(mainQuestion, compareQuestions) {
    return `I'll provide a main quiz question and a list of other questions. 
Analyze the semantic similarity between the main question and each comparison question.
Focus on the core knowledge or concept being tested, not just surface wording.

Main Question: "${mainQuestion}"

Comparison Questions:
${compareQuestions.map((q, i) => `${i+1}. "${q}"`).join('\n')}

For each comparison question, analyze:
1. Whether it tests the same core knowledge/concept as the main question
2. The similarity percentage (0-100%)
3. Brief explanation of the similarity or differences

Respond in this JSON format:
{
  "matches": [
    {
      "text": "the full question text",
      "similarity": 0.85,
      "explanation": "Both questions test understanding of Newton's Third Law though with different scenarios"
    }
  ],
  "analysisDetails": "Any overall observations about the question set"
}

Include only questions with similarity > 30%. Sort by similarity (highest first).`;
  }
  
  /**
   * Call the AI model with a prompt
   * @private
   */
  async _callAiModel(prompt) {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          maxOutputTokens: 2048,
        },
      });
      
      const responseText = result.response.text();
      return responseText;
    } catch (error) {
      console.error('Error calling AI model:', error);
      throw error;
    }
  }
  
  /**
   * Parse and extract similarity data from AI response
   * @private
   */
  _parseSimilarityResponse(responseText, compareQuestions) {
    try {
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }
      
      // Parse the JSON
      const data = JSON.parse(jsonMatch[0]);
      
      // Make sure we have a matches array
      if (!data.matches) {
        data.matches = [];
      }
      
      // Format and return the result
      return {
        hasSimilar: data.matches.length > 0,
        matches: data.matches,
        analysisDetails: data.analysisDetails || null
      };
    } catch (error) {
      console.error('Error parsing similarity response:', error);
      return { hasSimilar: false, matches: [], error: error.message };
    }
  }
}

// Create and export a singleton instance
const aiSimilarityService = new AiSimilarityService();
module.exports = aiSimilarityService;