// server-side/server-services/ai-generation-service.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../logger');
const aiSimilarityService = require('./ai-similarity-service');

// Check if the GEMINI_API_KEY is present in the environment
if (!process.env.GEMINI_API_KEY) {
  logger.error('CRITICAL ERROR: GEMINI_API_KEY environment variable is not set. AI functions will not work.');
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: Missing GEMINI_API_KEY in environment variables. Make sure your .env file contains a valid API key.');
}

// Initialize Gemini AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy-key-for-initialization");

// Test connection to the API
async function testGeminiConnection() {
  try {
    logger.info('Testing connection to Gemini API...');
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent('Hello, are you working?');
    logger.info('Successfully connected to Gemini API');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Gemini API:', error);
    return false;
  }
}

// Run the test (but don't wait for it)
testGeminiConnection().then(success => {
  if (!success) {
    logger.error('Gemini API connection test failed - AI features will not work properly');
  }
});

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
  "First option text",
  "Second option text",
  "Third option text",
  "Fourth option text"
],
"correctIndex": 0,
"rationale": "Explanation of why the correct answer is right"
}`;
            
            // Generate content
            logger.info('Sending request to Gemini API');
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            
            logger.info('Successfully received response from Gemini API');
            logger.info(`Received response of length: ${text.length} characters`);
            
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
                
                // Validate the structure and potentially fix the formatting
                if (!questionObject.text || !Array.isArray(questionObject.options)) {
                    logger.error('Invalid question structure:', questionObject);
                    throw new Error('Invalid question structure: missing text or options array');
                }
                
                // Ensure correctIndex is valid
                if (typeof questionObject.correctIndex !== 'number' || 
                    questionObject.correctIndex < 0 || 
                    questionObject.correctIndex >= questionObject.options.length) {
                    // Default to first option if missing
                    questionObject.correctIndex = 0;
                }
                
                // Ensure rationale exists
                if (!questionObject.rationale) {
                    questionObject.rationale = `This is the correct answer: ${questionObject.options[questionObject.correctIndex]}`;
                }
                
                logger.info('Successfully generated and validated question');
                return questionObject;
            } catch (parseError) {
                logger.error('Error parsing AI response:', parseError);
                logger.error('Response content:', text.substring(0, 500)); // Log first 500 chars of response
                throw new Error(`Failed to parse AI response: ${parseError.message}`);
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
      // Apply throttling
      await throttleIfNeeded();
      
      return await retryWithBackoff(async () => {
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
        return response.text();
      });
    } catch (error) {
      logger.error('Error generating rationale with AI:', error);
      throw error;
    }
  },
  
  // Check similarity between questions
  async checkSimilarity(questions) {
    try {
      if (questions.length < 2) {
        return [];
      }
      
      return await aiSimilarityService.checkBatchSimilarity(
        questions.map(q => typeof q === 'string' ? q : q.text)
      );
    } catch (error) {
      logger.error('Error checking similarity with AI:', error);
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
        
        // Small delay between questions to avoid hitting rate limits
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
  },
  
  // Generate an improved option for a specific question
  async generateImprovedOption(question, option, isCorrect, otherOptions = []) {
    try {
      // Apply throttling
      await throttleIfNeeded();
      
      return await retryWithBackoff(async () => {
        // Create the model
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        // Build the prompt
        const otherOptionsText = otherOptions.length > 0 
          ? `\nOther options in this question:\n${otherOptions.map(o => `- ${o}`).join('\n')}` 
          : '';
        
        const correctStatus = isCorrect ? 'correct' : 'incorrect';
        
        const prompt = `I need to improve this ${correctStatus} answer option for a multiple-choice question.

Question: ${question}
Current option: ${option}${otherOptionsText}

Please generate an improved version of this ${correctStatus} option that meets these criteria:
- More clear and specific
- Appropriate level of detail
- Maintains its ${correctStatus}ness
- Distinct from other options
- Similar in length and style to other options
- No partial correctness if it's supposed to be incorrect

Provide ONLY the improved option text, nothing else.`;
        
        // Generate content
        const result = await model.generateContent(prompt);
        const response = result.response;
        let improvedOption = response.text().trim();
        
        // Clean up any markdown or extra text
        if (improvedOption.startsWith('"') && improvedOption.endsWith('"')) {
          improvedOption = improvedOption.substring(1, improvedOption.length - 1);
        }
        
        // Ensure the improved option isn't too long compared to others
        const avgLength = otherOptions.reduce((sum, opt) => sum + opt.length, 0) / Math.max(1, otherOptions.length);
        if (improvedOption.length > avgLength * 2) {
          improvedOption = improvedOption.substring(0, Math.floor(avgLength * 1.5)) + '...';
        }
        
        return improvedOption;
      });
    } catch (error) {
      logger.error('Error generating improved option with AI:', error);
      // Fallback
      if (!option || option.trim() === '') {
        return isCorrect ? 
          'The correct answer to this question' : 
          'An incorrect but plausible answer';
      }
      return option;
    }
  },
  
  // Generate rationales for all options in a question
  async generateOptionRationales(question, options, correctIndex) {
    try {
      // Apply throttling
      await throttleIfNeeded();
      
      return await retryWithBackoff(async () => {
        // Create the model
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        // Build the prompt
        let optionsText = '';
        for (let i = 0; i < options.length; i++) {
          const isCorrect = i === correctIndex;
          optionsText += `Option ${String.fromCharCode(65 + i)} (${isCorrect ? 'CORRECT' : 'INCORRECT'}): ${options[i]}\n`;
        }
        
        const prompt = `For this multiple-choice question, provide a concise explanation for why each option is correct or incorrect.
The question is: "${question}"

${optionsText}

For each option, write a brief explanation. Format your response as a JSON array of rationales, one per option:

[
  "Rationale for Option A goes here",
  "Rationale for Option B goes here",
  ...
]

Keep each rationale concise and educational.`;
        
        // Generate content
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        // Parse the JSON response
        try {
          // Extract JSON if it's wrapped in markdown code blocks
          const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                           text.match(/```\n([\s\S]*?)\n```/) || 
                           [null, text];
          
          const jsonContent = jsonMatch[1].trim();
          const rationales = JSON.parse(jsonContent);
          
          if (!Array.isArray(rationales) || rationales.length !== options.length) {
            throw new Error(`Expected ${options.length} rationales, received ${rationales ? rationales.length : 0}`);
          }
          
          return rationales;
        } catch (parseError) {
          logger.error('Error parsing option rationales:', parseError);
          
          // Fallback: generate a single rationale for the correct answer
          const correctOption = options[correctIndex];
          const mainRationale = await this.generateRationale(
            question, 
            correctOption, 
            options.filter((_, i) => i !== correctIndex)
          );
          
          // Create simple rationales for each option
          return options.map((_, idx) => {
            if (idx === correctIndex) {
              return `This is correct. ${mainRationale}`;
            } else {
              return `This is incorrect. The correct answer is: ${correctOption}. ${mainRationale}`;
            }
          });
        }
      });
    } catch (error) {
      logger.error('Error generating option rationales with AI:', error);
      
      // Basic fallback
      return options.map((_, idx) => 
        idx === correctIndex ? 
          'This is the correct answer.' : 
          'This answer is incorrect.'
      );
    }
  },
  
  // Generate a diverse batch of questions with automatic similarity checking
  async generateDiverseQuestionBatch(topic, count, config = {}) {
    try {
      logger.info(`Generating diverse batch of ${count} questions for topic: "${topic}"`);
      
      const {
        difficulty = 'medium',
        tone = 'educational',
        ensureDiversity = true,
        maxSimilarityScore = 0.7,
        progressCallback = () => {}
      } = config;
      
      // Initial batch - generate more questions than needed to allow for filtering
      const initialBatchSize = Math.min(count * 1.5, count + 5);
      
      logger.info(`Starting with initial batch of ${initialBatchSize} questions`);
      
      const initialResult = await this.generateQuestionBatch(topic, initialBatchSize, {
        difficulty,
        tone,
        progressCallback: (progress) => {
          // Report adjusted progress (max 70% for the initial generation phase)
          const adjustedProgress = {
            ...progress,
            percentComplete: Math.round((progress.percentComplete * 0.7))
          };
          progressCallback(adjustedProgress);
        }
      });
      
      let finalQuestions = initialResult.questions;
      
      // If we need to ensure diversity and have enough questions to filter
      if (ensureDiversity && finalQuestions.length > count) {
        logger.info('Checking for similar questions to filter');
        progressCallback({
          percentComplete: 75,
          status: 'Analyzing question similarity',
          completed: finalQuestions.length,
          total: initialBatchSize
        });
        
        // Get just the question texts for similarity checking
        const questionTexts = finalQuestions.map(q => q.text);
        
        // Check for similar questions
        const similarityResults = await aiSimilarityService.checkBatchSimilarity(questionTexts);
        
        // Map of questions that should be filtered out (similar to others)
        const filterOutIndices = new Set();
        
        // First, just count how many questions have similarities
        const similarQuestionCount = similarityResults.filter(r => r.hasSimilar).length;
        logger.info(`Found ${similarQuestionCount} questions with similarity concerns`);
        
        // Process similarity groups to filter out redundant questions
        // Start with the most similar pairs and work down
        const allPairs = [];
        
        // Collect all pairs with their similarity scores
        similarityResults.forEach(result => {
          if (result.hasSimilar) {
            result.matches.forEach(match => {
              allPairs.push({
                index1: result.index,
                index2: match.index,
                similarity: match.similarity
              });
            });
          }
        });
        
        // Sort by similarity (highest first)
        allPairs.sort((a, b) => b.similarity - a.similarity);
        
        // Process pairs from most similar to least
        for (const pair of allPairs) {
          // If this pair is very similar and we haven't already filtered both
          if (pair.similarity >= maxSimilarityScore && 
              !filterOutIndices.has(pair.index1) && 
              !filterOutIndices.has(pair.index2)) {
            
            // Decide which one to keep - prefer to keep the one that isn't similar to others
            const idx1HasOtherSimilar = similarityResults[pair.index1].matches.length > 1;
            const idx2HasOtherSimilar = similarityResults[pair.index2].matches.length > 1;
            
            if (idx1HasOtherSimilar && !idx2HasOtherSimilar) {
              filterOutIndices.add(pair.index1);
            } else if (!idx1HasOtherSimilar && idx2HasOtherSimilar) {
              filterOutIndices.add(pair.index2);
            } else {
              // If both or neither have other similarities, keep the more complex one
              // (usually the longer question is more nuanced)
              const q1Length = finalQuestions[pair.index1].text.length;
              const q2Length = finalQuestions[pair.index2].text.length;
              
              if (q1Length > q2Length) {
                filterOutIndices.add(pair.index2);
              } else {
                filterOutIndices.add(pair.index1);
              }
            }
          }
        }
        
        logger.info(`Filtering out ${filterOutIndices.size} similar questions`);
        
        // Filter out similar questions
        finalQuestions = finalQuestions.filter((_, index) => !filterOutIndices.has(index));
        
        progressCallback({
          percentComplete: 85,
          status: 'Filtered similar questions',
          completed: finalQuestions.length,
          total: count
        });
        
        // If we've filtered too many, generate a few more
        if (finalQuestions.length < count) {
          const additionalNeeded = count - finalQuestions.length;
          logger.info(`Generating ${additionalNeeded} additional questions to reach target count`);
          
          const additionalResult = await this.generateQuestionBatch(topic, additionalNeeded, {
            difficulty,
            tone,
            progressCallback: (progress) => {
              // Report adjusted progress for the additional generation phase
              const adjustedProgress = {
                ...progress,
                percentComplete: 85 + Math.round((progress.percentComplete * 0.15))
              };
              progressCallback(adjustedProgress);
            }
          });
          
          finalQuestions = [...finalQuestions, ...additionalResult.questions];
        }
      }
      
      // Trim to the requested count
      finalQuestions = finalQuestions.slice(0, count);
      
      // Final progress update
      progressCallback({
        percentComplete: 100,
        status: 'Complete',
        completed: finalQuestions.length,
        total: count,
        isComplete: true
      });
      
      return {
        success: finalQuestions.length > 0,
        questions: finalQuestions,
        count: finalQuestions.length,
        requestedCount: count
      };
    } catch (error) {
      logger.error('Error generating diverse question batch:', error);
      throw error;
    }
  }
};

module.exports = aiGenerationService;