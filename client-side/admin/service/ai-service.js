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