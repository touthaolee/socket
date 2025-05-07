// server-side/server-services/ai-generation-service.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../logger');

// Check if the GEMINI_API_KEY is present in the environment
if (!process.env.GEMINI_API_KEY) {
  logger.error('CRITICAL ERROR: GEMINI_API_KEY environment variable is not set. AI functions will not work.');
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: Missing GEMINI_API_KEY in environment variables. Make sure your .env file contains a valid API key.');
}

// Initialize Gemini AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Add these imports at the top
const fs = require('fs');
const path = require('path');

// Enhanced rate limiting and retry logic
const aiGenerationState = {
    requestTimestamps: [],
    MAX_REQUESTS_PER_MINUTE: 12,
    lastErrorTime: null
};

// Helper: sleep for ms milliseconds
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Add throttling function to prevent rate limiting
async function throttleIfNeeded() {
    const now = Date.now();
    // Remove timestamps older than 60 seconds
    aiGenerationState.requestTimestamps = aiGenerationState.requestTimestamps.filter(ts => now - ts < 60000);
    
    if (aiGenerationState.requestTimestamps.length >= aiGenerationState.MAX_REQUESTS_PER_MINUTE) {
        const waitTime = 60000 - (now - aiGenerationState.requestTimestamps[0]);
        logger.info(`Rate limit approaching, waiting ${waitTime}ms before next request`);
        await sleep(waitTime + 1000); // Wait a bit extra
        aiGenerationState.requestTimestamps = aiGenerationState.requestTimestamps.filter(ts => now - ts < 60000);
    }
    
    // If we had an error recently, add extra delay
    if (aiGenerationState.lastErrorTime && (now - aiGenerationState.lastErrorTime) < 10000) {
        logger.info('Recent error detected, adding precautionary delay');
        await sleep(2000);
    }
    
    aiGenerationState.requestTimestamps.push(Date.now());
}

// Helper: retry with exponential backoff on 429 errors
async function retryWithBackoff(fn, maxRetries = 5, initialDelay = 2000) {
    let attempt = 0;
    let delay = initialDelay;
    
    while (attempt < maxRetries) {
        try {
            return await fn();
        } catch (err) {
            if (err.message && (err.message.includes('429') || 
                                err.message.includes('Too Many Requests') ||
                                err.message.includes('rate limit'))) {
                logger.warn(`Rate limit hit (attempt ${attempt + 1}/${maxRetries}), waiting ${delay}ms`);
                aiGenerationState.lastErrorTime = Date.now();
                await sleep(delay);
                delay *= 2; // Exponential backoff
                attempt++;
            } else {
                throw err;
            }
        }
    }
    throw new Error('Exceeded max retries due to rate limiting.');
}
// AI Generation Service
// (Removed duplicate or misplaced async generateQuestionBatch function. Use the one defined inside aiGenerationService.)
// Add to aiGenerationService object in ai-generation-service.js

/**
 * Generates concise rationales for all answer options in a question.
 * @param {Object} params - Parameters including question, options, and correctIndex
 * @returns {Promise<string[]>} Array of rationales for each option
 */
async function generateConciseRationalesForAllOptions({ question, options, correctIndex, style = 'serious' }) {
  // Apply throttling
  await throttleIfNeeded();
  
  return await retryWithBackoff(async () => {
      try {
          // Create the model
          const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
          
          // Build a prompt that asks for rationales for all options at once
          let optionsText = '';
          for (let i = 0; i < options.length; i++) {
              const isCorrect = i === correctIndex;
              optionsText += `Option ${String.fromCharCode(65 + i)}: ${options[i]}\n`;
          }
          
          const prompt = `For this multiple-choice question, provide a concise explanation (rationale) for why each option is correct or incorrect.
The question is: "${question}"

${optionsText}
The correct answer is: Option ${String.fromCharCode(65 + correctIndex)}

For each option, write a 1-2 sentence explanation in a ${style} tone. Format your response as a JSON array of rationales, one per option:

[
"Rationale for Option A goes here",
"Rationale for Option B goes here",
...
]

Keep each rationale concise and straightforward, focusing on key points.`;
          
          // Generate content with specific configuration for concise responses
          const generationConfig = {
              temperature: 0.7,
              maxOutputTokens: 1024,
          };
          
          const result = await model.generateContent({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig
          });
          
          const response = result.response;
          const text = response.text();
          
          // Parse the JSON response
          try {
              // Extract JSON array if it's wrapped in markdown code blocks
              const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                               text.match(/```\n([\s\S]*?)\n```/) || 
                               [null, text];
              
              const jsonContent = jsonMatch[1].trim();
              const rationales = JSON.parse(jsonContent);
              
              // Validate that we have the right number of rationales
              if (!Array.isArray(rationales) || rationales.length !== options.length) {
                  throw new Error(`Expected ${options.length} rationales, but received ${rationales.length}`);
              }
              
              return rationales;
          } catch (parseError) {
              logger.error('Error parsing rationales response:', parseError);
              
              // Fallback: manually extract rationales using regex patterns
              const rationaleParts = text.match(/Option [A-Z]:\s*(.*?)(?=\n\nOption [A-Z]:|$)/gs);
              
              if (rationaleParts && rationaleParts.length === options.length) {
                  return rationaleParts.map(part => {
                      const rationaleLine = part.replace(/Option [A-Z]:/, '').trim();
                      return rationaleLine || 'No rationale provided.';
                  });
              }
              
              // Last resort fallback
              return options.map((_, i) => {
                  return i === correctIndex ? 
                      'This is the correct answer.' : 
                      'This answer is incorrect.';
              });
          }
      } catch (error) {
          logger.error('Error generating rationales with AI:', error);
          throw error;
      }
      });
}
// Simple similarity helper function
function similarity(str1, str2) {
  // Normalize strings
  const s1 = str1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const s2 = str2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  
  // Count matching words
  const matches = s1.filter(word => s2.includes(word)).length;
  
  // Calculate similarity ratio
  return matches / Math.max(s1.length, s2.length);
}
const aiGenerationService = {
  // Generate a quiz question
// Inside aiGenerationService object

async generateQuestion(topic, difficulty = 'medium', optionsCount = 4, tone = 'educational', specificFocus = null) {
  // Apply throttling
  await throttleIfNeeded();
  
  return await retryWithBackoff(async () => {
      try {
          // Enhanced debug logging
          logger.info(`Starting question generation for topic: "${topic}", difficulty: ${difficulty}, options: ${optionsCount}`);
          if (!process.env.GEMINI_API_KEY) {
            logger.error('GEMINI_API_KEY is missing. Cannot generate question.');
            throw new Error('API key configuration error: GEMINI_API_KEY is missing');
          }
          
          // Create the model
          const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
          logger.info('Gemini model initialized successfully');
          
          // Enhanced prompt for better quality questions
          let prompt = `Generate a high-quality multiple-choice quiz question about "${topic}" with the following specifications:
- Difficulty level: ${difficulty} (ensure appropriate cognitive challenge)
- ${optionsCount} answer options with exactly ONE correct answer
- Each option should be plausible but only one clearly correct
- The correct answer should not be obviously different from wrong answers
- Ensure all options are similar in length and style to avoid giving clues
- The question should test understanding, not just recall`;
          
          if (specificFocus) {
              prompt += `\n- Focus specifically on: ${specificFocus}`;
          }
          
          prompt += `\n\nPlease format your response as a JSON object with the following structure:
{
"text": "The question text goes here",
"options": [
  { "text": "First option text", "isCorrect": false, "rationale": "Brief explanation of why this is incorrect" },
  { "text": "Second option text", "isCorrect": true, "rationale": "Thorough explanation of why this is correct" },
  ...
]
}`;
          
          // Set more specific generation parameters for better quality
          const generationConfig = {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
          };
          
          // Generate content
          logger.info('Sending request to Gemini API');
          try {
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig
            });
            logger.info('Successfully received response from Gemini API');
            
            const response = result.response;
            const text = response.text();
            
            // Enhanced parsing logic with better error handling
            let questionObject;
            try {
                // Extract JSON if it's wrapped in markdown code blocks
                const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                                 text.match(/```\n([\s\S]*?)\n```/) || 
                                 [null, text];
                
                const jsonContent = jsonMatch[1].trim();
                logger.info(`Parsing JSON response of length: ${jsonContent.length} characters`);
                questionObject = JSON.parse(jsonContent);
                
                // Validate the structure
                if (!questionObject.text || !Array.isArray(questionObject.options)) {
                    throw new Error('Invalid question structure: missing text or options array');
                }
                
                // Ensure exactly one correct answer
                const correctOptions = questionObject.options.filter(o => o.isCorrect);
                if (correctOptions.length !== 1) {
                    throw new Error(`Question must have exactly one correct answer, found ${correctOptions.length}`);
                }
                
                // Ensure all options have rationales
                questionObject.options.forEach(option => {
                    if (!option.rationale || option.rationale.trim() === '') {
                        option.rationale = option.isCorrect 
                            ? "This is the correct answer." 
                            : "This answer is incorrect.";
                    }
                });
                
                logger.info('Successfully generated and validated question');
                return questionObject;
            } catch (parseError) {
                logger.error('Error parsing AI response:', parseError);
                logger.error('Response content:', text.substring(0, 500)); // Log first 500 chars of response
                throw new Error(`Failed to parse AI response: ${parseError.message}`);
            }
          } catch (apiError) {
            logger.error('Gemini API call failed:', apiError);
            if (apiError.message && apiError.message.includes('API key')) {
              logger.error('API key issue detected. Check your GEMINI_API_KEY configuration.');
            }
            throw apiError;
          }
      } catch (error) {
          logger.error('Error generating question with AI:', error);
          throw error;
      }
  });
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
  
  // Generate a batch of questions with progress tracking and duplicate checking
  async generateQuestionBatch(topic, count, config = {}) {
    const questions = [];
    const errors = [];
    let progress = 0;
    const progressCallback = config.progressCallback || (() => {});
    // Initial progress update
    progressCallback({
      completed: 0,
      total: count,
      percentComplete: 0,
      questions: [],
      errors: []
    });
    const startTime = Date.now();
    for (let i = 0; i < count; i++) {
      try {
        // Progress estimation
        const elapsedMs = Date.now() - startTime;
        const averageTimePerQuestion = i > 0 ? elapsedMs / i : 0;
        const estimatedTotalTimeMs = averageTimePerQuestion * count;
        const estimatedRemainingMs = Math.max(0, estimatedTotalTimeMs - elapsedMs);
        progressCallback({
          completed: i,
          total: count,
          percentComplete: Math.round((i / count) * 100),
          averageTimePerQuestion,
          estimatedRemainingMs,
          questions,
          errors,
          currentIndex: i
        });
        // Generate question with specific focus if provided
        const specificFocus = config.specificFocuses?.[i % config.specificFocuses.length];
        await throttleIfNeeded();
        const question = await this.generateQuestion(
          topic,
          config.difficulty || 'medium',
          config.optionsCount || 4,
          config.tone || 'educational',
          specificFocus
        );
        if (config.addTimestamp) {
          question.generatedAt = new Date().toISOString();
        }
        // Duplicate check
        const isDuplicate = questions.some(q => similarity(q.text, question.text) > 0.8);
        if (!isDuplicate) {
          questions.push(question);
          logger.info(`Generated question ${i+1}/${count}: ${question.text.substring(0, 50)}...`);
        } else {
          logger.warn(`Duplicate question detected at index ${i}, regenerating`);
          i--; // Retry this index
          continue;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`Error generating question ${i+1}/${count}:`, error);
        errors.push({
          index: i,
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString()
        });
        if (errors.length < count / 2) {
          logger.info(`Will retry question ${i+1}`);
          i--; // Retry this index
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    // Final progress update
    progressCallback({
      completed: questions.length,
      total: count,
      percentComplete: Math.round((questions.length / count) * 100),
      estimatedRemainingMs: 0,
      questions,
      errors,
      isComplete: true
    });
    return {
      success: questions.length > 0,
      questions,
      errors: errors.length > 0 ? errors : undefined,
      count: questions.length,
      requestedCount: count
    };
  }
};

module.exports = aiGenerationService;