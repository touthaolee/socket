// Export the functions so they can be used in admin-main.js
import { getTokenFromStorage } from '../client-utils/client-helpers.js';

// Access quizzes from window to share state with admin-main.js
let quizzes = [];

// Update the quizzes reference
export function updateQuizzes(newQuizzes) {
  quizzes = newQuizzes;
  
  // Debug log quiz IDs and their types
  if (Array.isArray(quizzes) && quizzes.length > 0) {
    console.log('Quiz IDs loaded:');
    quizzes.forEach(quiz => {
      console.log(`Quiz ID: ${quiz.id} (${typeof quiz.id}), Title: "${quiz.name || quiz.title}"`);
    });
  }
}

// Helper function to debug ID type issues
function debugQuizId(functionName, originalId, convertedId) {
  console.log(`[${functionName}] ID type conversion: original=${originalId} (${typeof originalId}) → converted=${convertedId} (${typeof convertedId})`);
}

export function viewQuiz(quizId) {
  console.log('Viewing quiz:', quizId);
  
  // Convert quizId to number if it's a string (from HTML dataset)
  const id = typeof quizId === 'string' ? parseInt(quizId, 10) : quizId;
  debugQuizId('viewQuiz', quizId, id);
  
  // Find the quiz by ID
  const quiz = quizzes.find(q => q.id === id);
  if (!quiz) {
    console.error('Quiz not found:', quizId);
    return;
  }
  // Get the preview modal and its components
  const previewModal = document.getElementById('quiz-preview-modal');
  const previewTitle = document.getElementById('preview-quiz-name');
  const previewDescription = document.getElementById('preview-quiz-description');
  const previewMeta = document.getElementById('preview-quiz-questions');
  const previewContainer = document.getElementById('preview-questions-container');
  const publishButton = document.getElementById('publish-quiz-btn');
  const editPreviewButton = document.getElementById('edit-quiz-btn');

  // Check if the required DOM elements exist
  if (!previewModal || !previewTitle || !previewDescription || !previewMeta || !previewContainer) {
    console.error('Required preview modal elements not found in the DOM');
    console.log('Missing elements:', {
      modal: !previewModal,
      title: !previewTitle,
      description: !previewDescription,
      meta: !previewMeta,
      container: !previewContainer
    });
    return;
  }

  // Populate the modal with quiz data
  previewTitle.textContent = quiz.name || quiz.title || 'Untitled Quiz';
  previewDescription.textContent = quiz.description || 'No description provided.';
    // Show quiz metadata
  const questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
  previewMeta.innerHTML = `
    <span>${questionCount} Questions</span> | 
    <span>${quiz.timePerQuestion || 30}s per Question</span>
  `;
  
  // Populate questions
  previewContainer.innerHTML = '';
  
  if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
    quiz.questions.forEach((question, qIndex) => {
      const options = Array.isArray(question.options) ? question.options : [];
      
      // Create question element
      const questionElem = document.createElement('div');
      questionElem.className = 'preview-question';
      
      let questionHTML = `
        <div class="preview-question-header">
          <span class="preview-question-number">Question ${qIndex + 1}</span>
        </div>
        <div class="preview-question-text">${question.text}</div>
        <div class="preview-options">
      `;
      
      // Add options
      options.forEach((option, optIndex) => {
        const optionText = typeof option === 'string' ? option : (option.text || '');
        const isCorrect = typeof option === 'object' && option.isCorrect === true;
        
        questionHTML += `
          <div class="preview-option ${isCorrect ? 'correct' : ''}">
            <span class="preview-option-marker">${String.fromCharCode(65 + optIndex)}</span>
            <span class="preview-option-text">${optionText}</span>
          </div>
        `;
      });
      
      questionHTML += `</div>`;
      questionElem.innerHTML = questionHTML;
      previewContainer.appendChild(questionElem);
    });
  } else {
    previewContainer.innerHTML = '<div class="empty-state">No questions found in this quiz.</div>';
  }
    // Update button states and handlers
  if (publishButton) {
    // Show/hide publish button based on current status
    const isPublished = quiz.status === 'published' || quiz.status === 'active';
    publishButton.style.display = isPublished ? 'none' : 'inline-block';
    publishButton.textContent = isPublished ? 'Already Published' : 'Publish Quiz';
    
    // Clear previous event listeners
    publishButton.replaceWith(publishButton.cloneNode(true));
    const newPublishButton = document.getElementById('publish-quiz-btn');
    
    // Add new event listener
    if (newPublishButton) {
      newPublishButton.addEventListener('click', () => {
        publishQuiz(quizId);
      });
    }
  }
    if (editPreviewButton) {
    // Clear previous event listeners
    editPreviewButton.replaceWith(editPreviewButton.cloneNode(true));
    const newEditButton = document.getElementById('edit-quiz-btn');
    
    // Add new event listener
    if (newEditButton) {
      newEditButton.addEventListener('click', () => {
        // Hide the preview modal first
        if (previewModal) {
          previewModal.style.display = 'none';
        }
        // Then edit the quiz
        editQuiz(quizId);
      });
    }
  }
  
  // Show the modal
  if (previewModal) {
    previewModal.style.display = 'flex';
  }
}

// Edit quiz function
export function editQuiz(quizId) {
  console.log('Editing quiz:', quizId);
  
  // Convert quizId to number if it's a string (from HTML dataset)
  const id = typeof quizId === 'string' ? parseInt(quizId, 10) : quizId;
  debugQuizId('editQuiz', quizId, id);
  
  // Find the quiz by ID
  const quiz = quizzes.find(q => q.id === id);
  if (!quiz) {
    console.error('Quiz not found:', quizId);
    return;
  }
  
  // Check if the QuizDesigner is available
  if (!window.quizDesigner) {
    console.error('Quiz Designer not available - debugging information:');
    console.log('window.quizDesigner:', window.quizDesigner);
    console.log('window keys:', Object.keys(window).filter(k => k.toLowerCase().includes('quiz')));
    
    alert('Quiz Designer not available. Please refresh the page and try again.');
    return;
  }
  
  try {
    console.log('Using quiz designer instance:', window.quizDesigner);
    console.log('Quiz designer methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.quizDesigner)));
    
    // Open the quiz designer with the quiz data
    window.quizDesigner.openWithQuiz(quiz);
    console.log('Quiz successfully opened in designer');
  } catch (error) {
    console.error('Error opening quiz in designer:', error);
    alert('Error opening quiz in designer: ' + error.message);
  }
}

// Delete quiz function
export function deleteQuiz(quizId) {
  console.log('Deleting quiz:', quizId);
  
  // Ask for confirmation
  if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
    return;
  }
  
  // Convert quizId to number if it's a string (from HTML dataset)
  const id = typeof quizId === 'string' ? parseInt(quizId, 10) : quizId;
  debugQuizId('deleteQuiz', quizId, id);
  
  // Find the quiz by ID to show name in confirmation
  const quiz = quizzes.find(q => q.id === id);
  const quizName = quiz ? (quiz.name || quiz.title || 'this quiz') : 'this quiz';
  
  // Double-check with name
  if (!confirm(`Please confirm you want to delete "${quizName}"`)) {
    return;
  }
  
  // Get auth token
  const token = getTokenFromStorage();
  if (!token) {
    console.error('No auth token found!');
    alert('Your session has expired. Please log in again.');
    showAdminLogin();
    return;
  }
    // Send delete request
  fetch(`/interac/api/quiz/quizzes/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to delete quiz');
    }
    return response.json();
  })
  .then(data => {
    console.log('Quiz deleted successfully:', data);
    alert('Quiz deleted successfully');
    
    // Reload quizzes to update the list
    loadQuizzes();
  })
  .catch(error => {
    console.error('Error deleting quiz:', error);
    alert('Error deleting quiz: ' + error.message);
  });
}

// Publish quiz function
export function publishQuiz(quizId) {
  console.log('Publishing quiz:', quizId);
  
  // Convert quizId to number if it's a string (from HTML dataset)
  const id = typeof quizId === 'string' ? parseInt(quizId, 10) : quizId;
  debugQuizId('publishQuiz', quizId, id);
  
  // Find the quiz by ID
  const quiz = quizzes.find(q => q.id === id);
  if (!quiz) {
    console.error('Quiz not found:', quizId);
    return;
  }
  
  // Confirm publish
  if (!confirm(`Are you sure you want to publish "${quiz.name || quiz.title}"? Published quizzes will be available for all users.`)) {
    return;
  }
  
  // Get auth token
  const token = getTokenFromStorage();
  if (!token) {
    console.error('No auth token found!');
    alert('Your session has expired. Please log in again.');
    showAdminLogin();
    return;
  }
    // Send update request to change status
  fetch(`/interac/api/quiz/quizzes/${id}/publish`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'published' })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to publish quiz');
    }
    return response.json();
  })
  .then(data => {
    console.log('Quiz published successfully:', data);
    alert('Quiz published successfully');
    
    // Reload quizzes to update the list
    loadQuizzes();
    
    // Close the preview modal
    const previewModal = document.getElementById('quiz-preview-modal');
    if (previewModal) {
      previewModal.style.display = 'none';
    }
  })
  .catch(error => {
    console.error('Error publishing quiz:', error);
    alert('Error publishing quiz: ' + error.message);
  });
}
