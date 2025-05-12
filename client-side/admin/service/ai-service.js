// client-side/admin/services/ai-service.js

// AI Service for quiz generation
export const aiService = {
    // Generate a single quiz question
    async generateQuizQuestion(topic, config = {}) {
      try {
        const token = getToken();
        
        console.log('Generating question for topic:', topic, 'with config:', config);
        
        const response = await fetch('/interac/api/ai/generate-question', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            topic,
            difficulty: config.difficulty || 'medium',
            rationaleTone: config.rationaleTone || 'educational',
            optionsCount: config.optionsPerQuestion || 4,
            specificFocus: config.specificFocuses ? config.specificFocuses[0] : null
          })
        });
        
        if (!response.ok) {
          try {
            const errorData = await response.json();
            console.error('Server error details:', errorData);
            
            // If we have detailed error information, show it in the UI
            if (errorData && errorData.details) {
              // Display a more user-friendly error in the console
              let errorMessage = `Server error (${response.status}): ${errorData.error}`;
              
              if (errorData.details.message) {
                errorMessage += ` - ${errorData.details.message}`;
              }
              
              if (errorData.details.suggestion) {
                errorMessage += `\nSuggestion: ${errorData.details.suggestion}`;
              }
              
              throw new Error(errorMessage);
            } else {
              throw new Error(errorData.error || `Server error: ${response.status}`);
            }
          } catch (parseError) {
            // If we can't parse the error response
            throw new Error(`Server error: ${response.status}`);
          }
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error generating question:', error);
        
        // Provide fallback if there's a network error or other issue
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          console.warn('Network error detected, using fallback question generation');
          return this.generateMockQuestion(topic, config);
        }
        
        throw error;
      }
    },
    
    // Generate multiple questions
    async generateQuestions(topic, count, config = {}) {
      try {
        console.log('[AI Service] generateQuestions called:', { topic, count, config });
        const questions = [];
        
        // Implement throttling to prevent overloading the AI service
        const maxConcurrent = 2; // Maximum concurrent requests
        const requestsPerMinute = 20; // Rate limit
        
        // Create batches
        const batches = [];
        for (let i = 0; i < count; i += maxConcurrent) {
          batches.push(Array(Math.min(maxConcurrent, count - i)).fill(null));
        }
        
        // Process batches with throttling
        let requestsThisMinute = 0;
        let minuteStart = Date.now();
        
        for (const batch of batches) {
          // Check rate limit
          if (requestsThisMinute >= requestsPerMinute) {
            const elapsed = Date.now() - minuteStart;
            if (elapsed < 60000) {
              // Wait until the minute is up
              await new Promise(resolve => setTimeout(resolve, 60000 - elapsed + 100));
            }
            requestsThisMinute = 0;
            minuteStart = Date.now();
          }
          // Process batch with retries
          const batchPromises = batch.map(() => {
            requestsThisMinute++;
            // Try up to 3 times with exponential backoff
            return this.generateWithRetry(() => this.generateQuizQuestion(topic, config), 3);
          });
          const batchResults = await Promise.all(batchPromises);
          console.log('[AI Service] Batch results:', batchResults);
          questions.push(...batchResults);
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        console.log('[AI Service] All questions generated:', questions);
        return questions;
      } catch (error) {
        console.error('Error generating questions:', error);
        throw error;
      }
    },
    
    // Generate quiz questions with progress callbacks
    async generateQuizQuestions(options, callbacks) {
      try {
        console.log('[AI Service] generateQuizQuestions called:', options);
        const { 
          topic, 
          numQuestions, 
          difficulty, 
          optionsPerQuestion, 
          rationaleTone,
          specificFocuses,
          batchSize = 10  // Changed default to 10
        } = options;
        
        const { 
          onProgress, 
          onBatchComplete, 
          onComplete, 
          onError,
          shouldContinue = () => true 
        } = callbacks;
        
        // Initialize results array
        const questions = [];
        const totalBatches = Math.ceil(numQuestions / batchSize);
        let currentBatch = 1;
        let generatedCount = 0;
        
        // Process in batches for better UX
        while (generatedCount < numQuestions) {
          // Check if generation should continue
          if (!shouldContinue()) {
            onError(new Error('Generation cancelled by user'));
            return;
          }
          // Calculate how many to generate in this batch
          const batchCount = Math.min(batchSize, numQuestions - generatedCount);
          try {
            // Generate this batch
            const config = {
              difficulty,
              rationaleTone,
              optionsPerQuestion,
              specificFocuses: specificFocuses ? specificFocuses.split(',').map(f => f.trim()) : []
            };
            // Report start of batch generation
            onProgress(
              (generatedCount / numQuestions) * 100,
              generatedCount,
              numQuestions
            );
            console.log('[AI Service] Generating batch:', { topic, batchCount, config });
            // Use existing method to generate a batch
            const batchQuestions = await this.generateQuestions(topic, batchCount, config);
            // Add to results
            questions.push(...batchQuestions);
            generatedCount += batchQuestions.length;
            
            // Report batch completion
            onBatchComplete(batchQuestions, currentBatch, totalBatches);
            
            // Report progress
            onProgress(
              (generatedCount / numQuestions) * 100,
              generatedCount,
              numQuestions
            );
            
            currentBatch++;
          } catch (error) {
            console.error(`[AI Service] Error in batch ${currentBatch}:`, error);
            // Continue with next batch despite errors
          }
          
          // Add small delay between batches
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.log('[AI Service] All batches complete, questions:', questions);
        // Complete
        onComplete(questions);
        return questions;
      } catch (error) {
        console.error('[AI Service] Error generating quiz questions:', error);
        onError(error);
        throw error;
      }
    },
    
    // Generate with retry logic
    async generateWithRetry(generationFn, maxRetries = 3, baseDelay = 1000) {
      let lastError;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await generationFn();
        } catch (error) {
          console.error(`Attempt ${attempt + 1} failed:`, error);
          lastError = error;
          
          // Exponential backoff
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      throw lastError;
    },
    
    // Generate rationale for a question
    async generateRationale(question, correct, incorrect, tone = 'educational') {
      try {
        const token = getToken();
        
        const response = await fetch('/interac/api/ai/generate-rationale', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            question,
            correctAnswer: correct,
            incorrectAnswers: incorrect,
            tone
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate rationale');
        }
        
        const data = await response.json();
        return data.rationale;
      } catch (error) {
        console.error('Error generating rationale:', error);
        throw error;
      }
    },
    
    // Generate a mock question when the server fails
    generateMockQuestion(topic, config = {}) {
      console.log('Generating mock question for topic:', topic);
      const difficulty = config.difficulty || 'medium';
      const optionsCount = config.optionsPerQuestion || 4;
      
      // Create a basic placeholder question
      const question = {
        text: `Sample question about ${topic} (${difficulty} difficulty)`,
        options: [],
        correctIndex: 0,
        rationale: `This is a sample rationale for a question about ${topic}.`
      };
      
      // Generate some plausible options
      for (let i = 0; i < optionsCount; i++) {
        question.options.push(`Sample option ${i + 1} for ${topic}`);
      }
      
      return question;
    },
    
    // Generate an improved answer option for a specific question
    async generateImprovedOption(questionText, currentOption, isCorrect, allOptions) {
      try {
        const token = getToken();
        
        const response = await fetch('/interac/api/ai/improve-option', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            question: questionText,
            option: currentOption,
            isCorrect,
            otherOptions: allOptions.filter(opt => opt !== currentOption)
          })
        });
        
        if (!response.ok) {
          // If server endpoint doesn't exist yet, generate locally
          if (response.status === 404) {
            return this.generateImprovedOptionLocally(questionText, currentOption, isCorrect, allOptions);
          }
          throw new Error('Failed to improve option');
        }
        
        const data = await response.json();
        return data.improvedOption;
      } catch (error) {
        console.error('Error improving option:', error);
        // Fallback to local generation
        return this.generateImprovedOptionLocally(questionText, currentOption, isCorrect, allOptions);
      }
    },
    
    // Fallback method to generate improved options client-side when server method unavailable
    generateImprovedOptionLocally(questionText, currentOption, isCorrect, allOptions) {
      // If the option is empty, create a basic one
      if (!currentOption.trim()) {
        if (isCorrect) {
          return `The correct answer regarding ${questionText.split(' ').slice(0, 3).join(' ')}...`;
        } else {
          return `A plausible but incorrect answer about ${questionText.split(' ').slice(0, 3).join(' ')}...`;
        }
      }
      
      // Otherwise enhance the existing option
      let improved = currentOption;
      
      // Make the option more clear and specific
      if (improved.length < 15) {
        improved = `${improved} - ${isCorrect ? 'this is the correct choice because...' : 'this is incorrect because...'}`;
      }
      
      // Ensure it's distinct from other options
      const similarOptions = allOptions.filter(opt => 
        opt !== currentOption && 
        opt.toLowerCase().includes(currentOption.toLowerCase())
      );
      
      if (similarOptions.length > 0) {
        improved = `${improved} (distinct from other options)`;
      }
      
      return improved;
    },
    
    // Check for similar questions with improved visualization
    async checkBatchSimilarity(questions) {
      try {
        const token = getToken();
        
        const response = await fetch('/interac/api/ai/check-similarity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ questions })
        });
        
        if (!response.ok) {
          throw new Error('Failed to check similarity');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error checking batch similarity:', error);
        // Fallback to basic similarity check
        return this.generateBasicSimilarityCheck(questions);
      }
    },
    
    // Generate a basic similarity check when the server fails
    generateBasicSimilarityCheck(questions) {
      const results = [];
      
      // Simple local similarity algorithm (basic word overlap)
      for (let i = 0; i < questions.length; i++) {
        const q1 = questions[i].toLowerCase();
        const words1 = new Set(q1.split(/\W+/).filter(w => w.length > 3));
        
        let hasSimilar = false;
        const matches = [];
        
        for (let j = 0; j < questions.length; j++) {
          if (i === j) continue;
          
          const q2 = questions[j].toLowerCase();
          const words2 = new Set(q2.split(/\W+/).filter(w => w.length > 3));
          
          // Count word overlap
          let overlapCount = 0;
          for (const word of words1) {
            if (words2.has(word)) overlapCount++;
          }
          
          // Calculate similarity
          const similarity = overlapCount / Math.max(words1.size, words2.size);
          
          if (similarity > 0.4) {
            hasSimilar = true;
            matches.push({
              index: j,
              text: questions[j],
              similarity: similarity
            });
          }
        }
        
        results.push({
          index: i,
          text: questions[i],
          hasSimilar,
          matches
        });
      }
      
      return results;
    },
    
    // Bulk generate questions for a quiz
    async bulkGenerateQuestions(topic, count, config = {}, callbacks = {}) {
      const {
        onStart = () => {},
        onProgress = () => {},
        onComplete = () => {},
        onError = () => {}
      } = callbacks;
      
      try {
        onStart();
        
        // Use existing batch generation function
        const questions = await this.generateQuizQuestions(
          {
            topic,
            numQuestions: count,
            difficulty: config.difficulty || 'medium',
            optionsPerQuestion: config.optionsPerQuestion || 4,
            rationaleTone: config.tone || 'educational',
            specificFocuses: config.specificFocuses || '',
            batchSize: config.batchSize || 5
          },
          {
            onProgress,
            onBatchComplete: (batch, current, total) => {
              if (callbacks.onBatchComplete) {
                callbacks.onBatchComplete(batch, current, total);
              }
            },
            onComplete: (allQuestions) => {
              // Check for potential similar questions before completing
              this.checkBatchSimilarity(allQuestions.map(q => q.text))
                .then(similarityResult => {
                  // Tag questions with similarity data
                  const taggedQuestions = allQuestions.map((q, idx) => {
                    const similarityData = similarityResult.find(r => r.index === idx);
                    return {
                      ...q,
                      similarityData: similarityData || { hasSimilar: false }
                    };
                  });
                  
                  // Count similar questions
                  const similarCount = similarityResult.filter(r => r.hasSimilar).length;
                  
                  onComplete(taggedQuestions, { 
                    similarCount, 
                    totalCount: allQuestions.length 
                  });
                })
                .catch(error => {
                  // If similarity check fails, still return the questions
                  console.error('Similarity check failed but returning questions anyway:', error);
                  onComplete(allQuestions, { similarCount: 0, totalCount: allQuestions.length });
                });
            },
            onError
          }
        );
        
        return questions;
      } catch (error) {
        console.error('Bulk generation error:', error);
        onError(error);
        throw error;
      }
    },
    
    // Generate comprehensive rationales for all options in a question
    async generateOptionRationales(question, options, correctIndex) {
      try {
        const token = getToken();
        
        const response = await fetch('/interac/api/ai/generate-option-rationales', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            question,
            options,
            correctIndex
          })
        });
        
        if (!response.ok) {
          // If server endpoint doesn't exist, fall back to regular rationale generation
          if (response.status === 404) {
            const correctOption = options[correctIndex];
            const otherOptions = options.filter((_, i) => i !== correctIndex);
            const mainRationale = await this.generateRationale(question, correctOption, otherOptions);
            
            // Create simple rationales for each option
            return options.map((opt, idx) => {
              if (idx === correctIndex) {
                return mainRationale;
              } else {
                return `This is incorrect. ${mainRationale}`;
              }
            });
          }
          throw new Error('Failed to generate option rationales');
        }
        
        const data = await response.json();
        return data.rationales;
      } catch (error) {
        console.error('Error generating option rationales:', error);
        // Basic fallback
        return options.map((_, idx) => 
          idx === correctIndex ? 
            'This is the correct answer.' : 
            'This answer is incorrect.'
        );
      }
    },      async generateQuizQuestions({ name, description, aiOptions }, callbacks = {}) {
        const { onProgress, onComplete, onError } = callbacks;
        try {
            console.log('[AI] [generateQuizQuestions] Button clicked. Params:', { name, description, aiOptions });
            console.log('[AI] [generateQuizQuestions] Callbacks provided:', { 
                hasProgressCB: !!onProgress, 
                hasCompleteCB: !!onComplete, 
                hasErrorCB: !!onError 
            });
            
            if (!name) {
                console.warn('[AI] [generateQuizQuestions] No quiz name provided');
                if (onError) onError(new Error('Quiz name is required'));
                return;
            }
            if (!aiOptions || !aiOptions.topic) {
                console.warn('[AI] [generateQuizQuestions] No topic provided in aiOptions:', aiOptions);
                if (onError) onError(new Error('Quiz topic is required'));
                return;
            }
            // Add more logging before/after fetch
            console.log('[AI] [generateQuizQuestions] Sending request to backend with:', aiOptions);
            const response = await fetch('/interac/api/ai/generate-questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    topic: aiOptions.topic,
                    numQuestions: aiOptions.numQuestions,
                    difficulty: aiOptions.difficulty,
                    tone: aiOptions.tone
                })
            });
            console.log('[AI] [generateQuizQuestions] Received response status:', response.status);            const data = await response.json();
            console.log('[AI] [generateQuizQuestions] Response data:', data);
            
            // Check data structure more thoroughly
            console.log('[AI] [generateQuizQuestions] Response analysis:', {
                hasData: !!data,
                isSuccess: data?.success,
                hasQuestions: !!data?.questions,
                questionsIsArray: Array.isArray(data?.questions),
                questionsLength: data?.questions?.length || 0,
                firstQuestion: data?.questions?.[0] ? JSON.stringify(data.questions[0]).substring(0, 100) + '...' : 'none'
            });
            
            // Handle various response formats
            let questionsToReturn = [];
            
            if (data && Array.isArray(data.questions) && data.questions.length > 0) {
                console.log('[AI] [generateQuizQuestions] Successfully received questions:', data.questions.length);
                questionsToReturn = data.questions;
            } else if (data && data.success && Array.isArray(data.questions)) {
                console.log('[AI] [generateQuizQuestions] Successfully received questions in success format:', data.questions.length);
                questionsToReturn = data.questions;
            } else if (data && Array.isArray(data)) {
                // Handle case where response might be a direct array of questions
                console.log('[AI] [generateQuizQuestions] Received direct array of questions:', data.length);
                questionsToReturn = data;
            } else {
                console.error('[AI] [generateQuizQuestions] Invalid response format:', data);
                if (onError) onError(new Error('Invalid response format from AI backend: ' + JSON.stringify(data)));
                return [];
            }
            
            // Verify questions format before calling callbacks
            const validQuestions = questionsToReturn.filter(q => q && q.text && Array.isArray(q.options));
            console.log('[AI] [generateQuizQuestions] Valid questions count:', validQuestions.length);
            
            if (validQuestions.length > 0) {
                if (onProgress) onProgress(100, validQuestions.length, aiOptions.numQuestions);
                if (onComplete) {
                    console.log('[AI] [generateQuizQuestions] Calling onComplete with', validQuestions.length, 'questions');
                    onComplete(validQuestions);
                }
                return validQuestions;
            } else {
                console.error('[AI] [generateQuizQuestions] No valid questions found in response');
                if (onError) onError(new Error('No valid questions found in response'));
                return [];
            }
        } catch (err) {
            console.error('[AI] [generateQuizQuestions] Error:', err);
            if (onError) onError(err);
            return [];
        }
    }
  };
  
  // Helper function to get token
  function getToken() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication token not found');
    }
    return token;
  }