// client-side/admin/service/ai-similarity-service.js

/**
 * Client-side AI Similarity Service
 * Communicates with the server-side similarity service to analyze quiz questions
 */

import { showToast } from '../../client-utils/ui-utils.js';

class AiSimilarityService {
  /**
   * Check similarity between a specific question and others
   * @param {string} questionText - The main question to check
   * @param {Array<string>} compareQuestions - Questions to compare against
   * @returns {Promise<Object>} - Similarity analysis results
   */
  async checkSimilarity(questionText, compareQuestions) {
    try {
      const response = await fetch('/api/ai/similarity/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mainQuestion: questionText,
          compareQuestions: compareQuestions
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Similarity check failed: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in similarity check:', error);
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
   * @param {Array<string>} questions - Array of questions to check
   * @returns {Promise<Array>} - Array of similarity results
   */
  async checkBatchSimilarity(questions) {
    try {
      // Show loading UI
      const loadingToast = this._showLoadingToast('Analyzing question similarity...');
      
      const response = await fetch('/api/ai/similarity/batch-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questions })
      });
      
      // Hide loading UI
      this._hideLoadingToast(loadingToast);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batch similarity check failed: ${errorText}`);
      }
      
      const results = await response.json();
      
      // Show success message if we found similar questions
      const similarCount = results.filter(r => r.hasSimilar).length;
      if (similarCount > 0) {
        this._showSuccessToast(`Found ${similarCount} questions with potential similarity`);
      } else {
        this._showSuccessToast('No similar questions found');
      }
      
      return results;
    } catch (error) {
      console.error('Error in batch similarity check:', error);
      this._showErrorToast(`Error checking question similarity: ${error.message}`);
      return questions.map(() => ({ hasSimilar: false, matches: [], error: error.message }));
    }
  }
  
  /**
   * Show a loading toast notification
   * @private
   */
  _showLoadingToast(message) {
    return showToast(
      `<div class="d-flex align-items-center">
        <div class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <span>${message}</span>
      </div>`,
      'info',
      0
    );
  }
  
  /**
   * Hide a loading toast notification
   * @private
   */
  _hideLoadingToast(toast) {
    if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
  }
  
  /**
   * Show a success toast notification
   * @private
   */
  _showSuccessToast(message) {
    showToast(message, 'success', 3000);
  }
  
  /**
   * Show an error toast notification
   * @private
   */
  _showErrorToast(message) {
    showToast(message, 'error', 5000);
  }
}

// Create and export a singleton instance
const similarityService = new AiSimilarityService();
window.similarityService = similarityService; // Make it globally available

export { similarityService };

export default similarityService;

export const similarityMethods = {
  checkSimilarity: (questionText, compareQuestions) => similarityService.checkSimilarity(questionText, compareQuestions),
  checkBatchSimilarity: (questions) => similarityService.checkBatchSimilarity(questions)
};