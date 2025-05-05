// client-side/client-components/quiz-results.js
import { initQuizComponents } from './quiz-questions.js';

// Elements
const resultsModal = document.getElementById('results-modal');
const finalScore = document.getElementById('final-score');
const correctAnswers = document.getElementById('correct-answers');
const timeTaken = document.getElementById('time-taken');
const resultsFeedback = document.getElementById('results-feedback');
const reviewAnswersBtn = document.getElementById('review-answers');
const backToQuizzesBtn = document.getElementById('back-to-quizzes');

// Last quiz results
let lastResults = null;

// Initialize results components
export function initResultsComponents() {
  // Close results modal
  document.querySelector('.close-results').addEventListener('click', () => {
    closeResultsModal();
  });
  
  // Back to quizzes button
  backToQuizzesBtn.addEventListener('click', () => {
    closeResultsModal();
  });
  
  // Review answers button
  reviewAnswersBtn.addEventListener('click', () => {
    closeResultsModal();
    reviewAnswers();
  });
  
  // Initialize quiz components
  initQuizComponents();
}

// Show quiz results
export function showResults(results) {
  lastResults = results;
  
  // Update UI elements
  finalScore.textContent = `${results.score}%`;
  correctAnswers.textContent = `${results.correctAnswers}/${results.totalQuestions}`;
  
  // Format time taken
  const minutes = Math.floor(results.timeTaken / 60);
  const seconds = results.timeTaken % 60;
  timeTaken.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Provide feedback based on score
  let feedback = '';
  if (results.score >= 90) {
    feedback = "Excellent! You've mastered this topic.";
  } else if (results.score >= 70) {
    feedback = 'Great job! You have a solid understanding of this material.';
  } else if (results.score >= 50) {
    feedback = 'Good effort! Review the topics you missed to improve your knowledge.';
  } else {
    feedback = 'Keep practicing! This topic needs more review.';
  }
  resultsFeedback.textContent = feedback;
  
  // Show the modal
  resultsModal.classList.remove('hidden');
  resultsModal.classList.add('active');
  
  // Update user profile stats
  updateUserStats(results);
}

// Close the results modal
function closeResultsModal() {
  resultsModal.classList.remove('active');
  setTimeout(() => {
    resultsModal.classList.add('hidden');
  }, 300);
}

// Update user profile statistics
async function updateUserStats(results) {
  try {
    // Get current stats
    const quizzesCompleted = parseInt(document.getElementById('quizzes-completed').textContent) || 0;
    const avgScore = parseInt(document.getElementById('avg-score').textContent) || 0;
    
    // Calculate new stats
    const newQuizzesCompleted = quizzesCompleted + 1;
    const newAvgScore = Math.round((avgScore * quizzesCompleted + results.score) / newQuizzesCompleted);
    
    // Update UI
    document.getElementById('quizzes-completed').textContent = newQuizzesCompleted;
    document.getElementById('avg-score').textContent = `${newAvgScore}%`;
    
    // Add to activity list
    addActivityItem(results);
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
}

// Add activity item to recent activity
function addActivityItem(results) {
  const activityList = document.getElementById('activity-list');
  const emptyState = activityList.querySelector('.empty-state');
  
  if (emptyState) {
    activityList.innerHTML = '';
  }
  
  const activityItem = document.createElement('div');
  activityItem.className = 'activity-item';
  
  const now = new Date();
  const formattedDate = now.toLocaleString();
  
  activityItem.innerHTML = `
    <p>Completed quiz: <strong>${results.quizTitle}</strong></p>
    <p>Score: <strong>${results.score}%</strong> (${results.correctAnswers}/${results.totalQuestions})</p>
    <div class="activity-date">${formattedDate}</div>
  `;
  
  activityList.insertBefore(activityItem, activityList.firstChild);
}

// Review quiz answers
function reviewAnswers() {
  // Implementation for reviewing quiz answers would go here
  // This would show the questions again with correct/incorrect indicators
  alert('Review functionality would show your answers with explanations');
}