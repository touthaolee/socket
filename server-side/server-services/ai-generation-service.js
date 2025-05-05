// server-side/server-services/ai-generation-service.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// AI Generation Service
const aiGenerationService = {
  // Generate a quiz question
  async generateQuestion(topic, difficulty = 'medium', optionsCount = 4, tone = 'educational', specificFocus = null) {
    try {
      // Create the model
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      // Build the prompt
      let prompt = `Generate a multiple-choice quiz question about "${topic}" with the following characteristics:
- Difficulty level: ${difficulty}
- ${optionsCount} answer options (with exactly ONE correct answer)
- Clear and unambiguous wording
- The correct answer should not always be in the same position`;
      
      if (specificFocus) {
        prompt += `\n- Focus specifically on: ${specificFocus}`;
      }
      
      prompt += `\n\nThe question should be educational and test understanding rather than mere memorization.

Please format your response as a JSON object with the following structure:
{
  "text": "The question text",
  "options": [
    { "text": "Option 1", "isCorrect": false, "rationale": "" },
    { "text": "Option 2", "isCorrect": true, "rationale": "Explanation of why this is correct" },
    ...
  ]
}

Make sure to include a thorough rationale for the correct answer in a ${tone} tone.`;
      
      // Generate content
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Parse the JSON response
      let questionObject;
      try {
        // Extract JSON if it's wrapped in markdown code blocks
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                         text.match(/```\n([\s\S]*?)\n```/) || 
                         [null, text];
        
        const jsonContent = jsonMatch[1];
        questionObject = JSON.parse(jsonContent);
        
        // Validate the structure
        if (!questionObject.text || !Array.isArray(questionObject.options)) {
          throw new Error('Invalid question structure');
        }
        
        // Ensure exactly one correct answer
        const correctOptions = questionObject.options.filter(o => o.isCorrect);
        if (correctOptions.length !== 1) {
          throw new Error('Question must have exactly one correct answer');
        }
        
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        throw new Error('Failed to parse AI response');
      }
      
      return questionObject;
    } catch (error) {
      console.error('Error generating question with AI:', error);
      throw error;
    }
  },
  
  // Generate a rationale for a question
  async generateRationale(question, correctAnswer, incorrectAnswers = [], tone = 'educational') {
    try {
      // Create the model
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      // Build the prompt
      const incorrectAnswersText = incorrectAnswers.length > 0 
        ? `\nIncorrect answers:\n${incorrectAnswers.map(a => `- ${a}`).join('\n')}` 
        : '';
      
      const prompt = `Question: ${question}
Correct answer: ${correctAnswer}${incorrectAnswersText}

Please generate a clear and concise explanation for why the correct answer is right and the others are wrong.
Use a ${tone} tone. Keep the explanation under 100 words.`;
      
      // Generate content
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      return text;
    } catch (error) {
      console.error('Error generating rationale with AI:', error);
      throw error;
    }
  },
  
  // Check similarity between questions
  async checkSimilarity(questions) {
    try {
      if (questions.length < 2) {
        return [];
      }
      
      // Create the model
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      // Build the prompt
      const questionsText = questions.map((q, i) => {
        const optionsText = q.options ? q.options.map((o, j) => `  ${String.fromCharCode(97 + j)}) ${o}`).join('\n') : '';
        return `Question ${i + 1}: ${q.text}\n${optionsText}\n`;
      }).join('\n');
      
      const prompt = `I have a set of quiz questions and need to identify groups of questions that are testing the same concept or are too similar.
Please analyze these questions for similarity and group them if they are testing the same concept or knowledge.

${questionsText}

For each group of similar questions, provide:
1. The question numbers that belong to the group
2. A similarity score between 0.0 and 1.0 (where 1.0 means identical concepts)
3. A brief explanation of why they are similar

Format your response as a JSON array of groups:
[
  {
    "questions": [{"id": "question_id", "text": "question text"}],
    "similarityScore": 0.85,
    "explanation": "Both questions test the same concept of..."
  }
]

Only include groups with a similarity score above 0.5. If no questions are similar above this threshold, return an empty array.`;
      
      // Generate content
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Parse the JSON response
      let similarityGroups;
      try {
        // Extract JSON if it's wrapped in markdown code blocks
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                         text.match(/```\n([\s\S]*?)\n```/) || 
                         [null, text];
        
        const jsonContent = jsonMatch[1];
        similarityGroups = JSON.parse(jsonContent);
        
        // Validate the structure
        if (!Array.isArray(similarityGroups)) {
          throw new Error('Invalid similarity groups structure');
        }
        
      } catch (parseError) {
        console.error('Error parsing AI similarity response:', parseError);
        throw new Error('Failed to parse AI response');
      }
      
      return similarityGroups;
    } catch (error) {
      console.error('Error checking similarity with AI:', error);
      throw error;
    }
  },
  
  // Generate a batch of questions
  async generateQuestionBatch(topic, count, config = {}) {
    const questions = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const question = await this.generateQuestion(
          topic,
          config.difficulty || 'medium',
          config.optionsCount || 4,
          config.tone || 'educational',
          config.specificFocuses && config.specificFocuses[i % config.specificFocuses.length]
        );
        
        questions.push(question);
      } catch (error) {
        console.error(`Error generating question ${i+1}:`, error);
        // Continue with the next question
      }
    }
    
    return questions;
  }
};

module.exports = aiGenerationService;