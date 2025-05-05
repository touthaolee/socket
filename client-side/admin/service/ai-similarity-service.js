// client-side/admin/services/ai-similarity-service.js

// AI Similarity Service for checking question similarity
export const similarityService = {
    // Check similarity between questions
    async checkSimilarity(questions) {
      try {
        if (!questions || questions.length < 2) {
          return [];
        }
        
        const token = getToken();
        
        const response = await fetch('/interac/api/ai/check-similarity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            questions: questions.map(q => ({
              id: q.id,
              text: q.text,
              options: q.options.map(o => o.text)
            }))
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to check similarity');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error checking similarity:', error);
        throw error;
      }
    },
    
    // Show similarity results in the UI
    showSimilarityResults(similarityGroups) {
      const resultsContainer = document.getElementById('similarity-results');
      resultsContainer.innerHTML = '';
      
      if (!similarityGroups || similarityGroups.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state">
            <p>No similar questions found</p>
          </div>
        `;
        return;
      }
      
      similarityGroups.forEach((group, groupIndex) => {
        const groupElement = document.createElement('div');
        groupElement.className = 'similarity-group';
        
        // Determine similarity level
        let similarityLevel = 'Low';
        let similarityClass = 'similarity-low';
        
        if (group.similarityScore > 0.8) {
          similarityLevel = 'High';
          similarityClass = 'similarity-high';
        } else if (group.similarityScore > 0.6) {
          similarityLevel = 'Medium';
          similarityClass = 'similarity-medium';
        }
        
        groupElement.innerHTML = `
          <div class="similarity-header">
            <span>Group ${groupIndex + 1}: <span class="${similarityClass}">${similarityLevel} Similarity (${Math.round(group.similarityScore * 100)}%)</span></span>
          </div>
          <div class="similarity-questions">
            ${group.questions.map(question => `
              <div class="similarity-question">
                <div class="similarity-question-text">${question.text}</div>
                <div class="similarity-actions">
                  <button class="btn-sm edit-similar-btn" data-id="${question.id}">Edit</button>
                  <button class="btn-sm regenerate-similar-btn" data-id="${question.id}">Regenerate</button>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="similarity-recommendation">
            <p>Recommendation: ${getSimilarityRecommendation(group.similarityScore)}</p>
          </div>
        `;
        
        // Add event listeners
        const editButtons = groupElement.querySelectorAll('.edit-similar-btn');
        const regenerateButtons = groupElement.querySelectorAll('.regenerate-similar-btn');
        
        editButtons.forEach(button => {
          button.addEventListener('click', () => {
            editSimilarQuestion(button.dataset.id);
          });
        });
        
        regenerateButtons.forEach(button => {
          button.addEventListener('click', () => {
            regenerateSimilarQuestion(button.dataset.id);
          });
        });
        
        resultsContainer.appendChild(groupElement);
      });
      
      // Show the modal
      const modal = document.getElementById('similarity-check-modal');
      modal.classList.add('active');
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
  
  // Get recommendation based on similarity score
  function getSimilarityRecommendation(score) {
    if (score > 0.8) {
      return 'These questions are testing the same concept. Consider regenerating one of them.';
    } else if (score > 0.6) {
      return 'These questions have overlapping concepts. Consider editing to focus on different aspects.';
    } else {
      return 'These questions are somewhat related but likely test different concepts.';
    }
  }
  
  // Edit a similar question
  function editSimilarQuestion(questionId) {
    // Implementation would be similar to the editQuestion function
    console.log('Edit similar question:', questionId);
    
    // Hide similarity modal
    document.getElementById('similarity-check-modal').classList.remove('active');
    
    // Would typically load the question and open the edit modal
  }
  
  // Regenerate a similar question
  function regenerateSimilarQuestion(questionId) {
    // Implementation would be similar to the regenerateQuestion function
    console.log('Regenerate similar question:', questionId);
    
    // Hide similarity modal
    document.getElementById('similarity-check-modal').classList.remove('active');
    
    // Would typically call the regenerate function
  }