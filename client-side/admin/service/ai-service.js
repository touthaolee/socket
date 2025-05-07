// client-side/admin/services/ai-service.js

// AI Service for quiz generation
export const aiService = {
    // Generate a single quiz question
    async generateQuizQuestion(topic, config = {}) {
      try {
        const token = getToken();
        
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
          throw new Error('Failed to generate question');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error generating question:', error);
        throw error;
      }
    },
    
    // Generate multiple questions
    async generateQuestions(topic, count, config = {}) {
      try {
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
          questions.push(...batchResults);
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        return questions;
      } catch (error) {
        console.error('Error generating questions:', error);
        throw error;
      }
    },
    
    // Generate quiz questions with progress callbacks
    async generateQuizQuestions(options, callbacks) {
      try {
        const { 
          topic, 
          numQuestions, 
          difficulty, 
          optionsPerQuestion, 
          rationaleTone,
          specificFocuses,
          batchSize = 5
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
            console.error(`Error in batch ${currentBatch}:`, error);
            // Continue with next batch despite errors
          }
          
          // Add small delay between batches
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Complete
        onComplete(questions);
        return questions;
      } catch (error) {
        console.error('Error generating quiz questions:', error);
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