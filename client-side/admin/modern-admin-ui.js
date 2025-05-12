// Modern VA Quiz Admin UI - Connected to Backend
// Access global services
document.addEventListener('DOMContentLoaded', function() {
  initModernQuizUI();
});

function initModernQuizUI() {
  // Get access to the aiService and similarityService from the global scope
  const { aiService, similarityService } = window;

  const modal = document.getElementById('va-quiz-modal');
  const closeBtn = document.getElementById('va-close-modal');
  const stepper = document.querySelectorAll('.va-step');
  const stepContents = document.querySelectorAll('.va-step-content');
  const backBtn = document.getElementById('va-back-step-btn');
  const nextBtn = document.getElementById('va-next-step-btn');
  const saveBtn = document.getElementById('va-save-quiz-btn');
  const toast = document.getElementById('va-toast');

  if (!modal) return; // Exit if modal elements aren't loaded yet

  let currentStep = 1;
  let quiz = {
    title: '', description: '', time: 30, tags: [],
    questions: []
  };

  function openModal() {
    modal.style.display = 'flex';
    goToStep(1);
  }
  
  function closeModal() { 
    modal.style.display = 'none'; 
  }
  
  if (closeBtn) {
    closeBtn.onclick = closeModal;
  }

  function goToStep(step) {
    currentStep = step;
    stepper.forEach((el, i) => el.classList.toggle('active', i === step-1));
    stepContents.forEach((el, i) => el.classList.toggle('active', i === step-1));
    backBtn.style.display = step === 1 ? 'none' : '';
    nextBtn.style.display = step === 3 ? 'none' : '';
    saveBtn.style.display = step === 3 ? '' : 'none';
    if (step === 2) renderQuestions();
    if (step === 3) renderReview();
  }
  
  if (backBtn) {
    backBtn.onclick = () => goToStep(currentStep-1);
  }
  
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentStep === 1) {
        quiz.title = document.getElementById('va-quiz-title').value.trim();
        quiz.description = document.getElementById('va-quiz-description').value.trim();
        quiz.context = document.getElementById('va-quiz-context').value.trim();
        quiz.time = parseInt(document.getElementById('va-quiz-time').value, 10) || 30;
        quiz.tags = document.getElementById('va-quiz-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
        if (!quiz.title) return showToast('Quiz title required');
      }
      goToStep(currentStep+1);
    };
  }
  
  if (saveBtn) {
    saveBtn.onclick = async () => {
      // Save quiz to backend
      try {
        const token = getTokenFromStorage();
        const payload = {
          title: quiz.title,
          description: quiz.description,
          timePerQuestion: quiz.time,
          questions: quiz.questions.map(q => ({
            text: q.text,
            options: q.options.map((opt, i) => ({
              text: opt,
              isCorrect: q.correct === i
            })),
            rationale: q.rationale
          }))
        };
        
        showToast('Saving quiz...');
        
        const res = await fetch('/interac/api/quiz/quizzes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error(await res.text());
        
        showToast('Quiz saved successfully!');
        closeModal();
        
        // Reload quizzes after saving
        try {
          loadQuizzes(); // This should be defined in admin-main.js
        } catch (error) {
          console.log('Attempted to refresh quiz list');
        }
      } catch (e) {
        showToast('Save failed: ' + e.message);
      }
    };
  }

  const addQuestionBtn = document.getElementById('va-add-question-btn');
  if (addQuestionBtn) {
    addQuestionBtn.onclick = () => {
      quiz.questions.push({
        text: '', options: ['', '', '', ''], correct: 0, rationale: ''
      });
      renderQuestions();
    };
  }

  const aiGenerateBtn = document.getElementById('va-ai-generate-btn');
  if (aiGenerateBtn) {
    aiGenerateBtn.onclick = async () => {
      // AI generate questions for the quiz
      try {
        const token = getTokenFromStorage();
        const topic = quiz.context || quiz.title || 'General Knowledge';
        
        showToast('Generating questions with AI...');
        
        // Use your existing aiService
        aiService.generateQuizQuestions({
          name: quiz.title,
          description: quiz.description,
          aiOptions: {
            topic: topic,
            numQuestions: 5,
            difficulty: 'medium',
            optionsPerQuestion: 4
          }
        }, {
          onProgress: (progress) => {
            // Could add a progress indicator here
          },
          onComplete: (questions) => {
            if (!questions || questions.length === 0) {
              showToast('No questions generated. Try a different topic.');
              return;
            }
            
            // Format questions to match our structure
            questions.forEach(q => {
              quiz.questions.push({
                text: q.text,
                options: Array.isArray(q.options) ? q.options.map(o => typeof o === 'string' ? o : o.text) : [],
                correct: q.correctIndex || 0,
                rationale: q.rationale || ''
              });
            });
            
            renderQuestions();
            showToast(`Added ${questions.length} AI-generated questions!`);
          },
          onError: (error) => {
            showToast('AI generation failed: ' + error.message);
          }
        });
      } catch (e) {
        showToast('AI generation failed: ' + e.message);
      }
    };
  }

  function renderQuestions() {
    const list = document.getElementById('va-questions-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (quiz.questions.length === 0) {
      list.innerHTML = '<p>No questions yet. Add a question or use AI to generate questions.</p>';
      return;
    }
    
    quiz.questions.forEach((q, i) => {
      const card = document.createElement('div');
      card.className = 'va-question-card';
      card.innerHTML = `
        <div class="va-question-header">
          <span class="va-question-number">Q${i+1}</span>
          <input type="text" value="${q.text || ''}" data-qidx="${i}" class="va-qtext" placeholder="Question text">
          <div class="va-question-controls">
            <button type="button" class="va-icon-btn va-edit-btn" data-qidx="${i}" title="Edit question"><i class="fas fa-edit"></i></button>
            <button type="button" class="va-icon-btn va-ai-btn" data-qidx="${i}" title="Regenerate with AI"><i class="fas fa-magic"></i></button>
            <button type="button" class="va-icon-btn va-sim-btn" data-qidx="${i}" title="Check similarity"><i class="fas fa-balance-scale"></i></button>
            <button type="button" class="va-icon-btn va-del-btn" data-qidx="${i}" title="Delete question"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="va-options-container">
          ${q.options.map((opt, j) => `
            <div class="va-option-row">
              <input type="radio" name="correct${i}" id="opt${i}_${j}" ${q.correct===j?'checked':''} data-qidx="${i}" data-oidx="${j}" class="va-qcorrect">
              <label for="opt${i}_${j}" class="va-option-letter">${String.fromCharCode(65+j)}</label>
              <input type="text" value="${opt || ''}" data-qidx="${i}" data-oidx="${j}" class="va-qopt" placeholder="Option ${j+1}">
              <button type="button" class="va-icon-btn va-opt-ai-btn" data-qidx="${i}" data-oidx="${j}" title="Improve this option with AI"><i class="fas fa-bolt"></i></button>
              ${q.options.length > 2 ? `<button type="button" class="va-icon-btn va-opt-del-btn" data-qidx="${i}" data-oidx="${j}" title="Remove option"><i class="fas fa-times"></i></button>` : ''}
            </div>
          `).join('')}
          <button type="button" class="va-btn va-sm va-add-option-btn" data-qidx="${i}">Add Option</button>
        </div>
        <div class="va-rationale-container">
          <label>Rationale: 
            <button type="button" class="va-icon-btn va-generate-rationale-btn" data-qidx="${i}" title="Generate rationale with AI"><i class="fas fa-lightbulb"></i></button>
          </label>
          <textarea data-qidx="${i}" class="va-qrationale" placeholder="Explanation for why the correct answer is right">${q.rationale || ''}</textarea>
        </div>
        <div class="va-question-actions">
          <div class="va-difficulty-selector">
            <label>Difficulty:</label>
            <select class="va-qdiff" data-qidx="${i}">
              <option value="easy" ${q.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
              <option value="medium" ${!q.difficulty || q.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="hard" ${q.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
            </select>
          </div>
          <div class="va-action-buttons">
            <button type="button" class="va-btn va-primary va-ai-btn" data-qidx="${i}">Regenerate</button>
            <button type="button" class="va-btn va-warning va-sim-btn" data-qidx="${i}">Check Similarity</button>
            <button type="button" class="va-btn va-danger va-del-btn" data-qidx="${i}">Delete</button>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
    
    // Wire up events
    list.querySelectorAll('.va-qtext').forEach(inp => inp.oninput = e => {
      quiz.questions[inp.dataset.qidx].text = inp.value;
    });
    
    list.querySelectorAll('.va-qopt').forEach(inp => inp.oninput = e => {
      quiz.questions[inp.dataset.qidx].options[inp.dataset.oidx] = inp.value;
    });
    
    list.querySelectorAll('.va-qcorrect').forEach(inp => inp.onchange = e => {
      quiz.questions[inp.dataset.qidx].correct = parseInt(inp.dataset.oidx, 10);
    });
    
    list.querySelectorAll('.va-qrationale').forEach(inp => inp.oninput = e => {
      quiz.questions[inp.dataset.qidx].rationale = inp.value;
    });
    
    list.querySelectorAll('.va-qdiff').forEach(sel => sel.onchange = e => {
      quiz.questions[sel.dataset.qidx].difficulty = sel.value;
    });
    
    list.querySelectorAll('.va-del-btn').forEach(btn => btn.onclick = e => {
      if (confirm('Are you sure you want to delete this question?')) {
        quiz.questions.splice(btn.dataset.qidx, 1);
        renderQuestions();
      }
    });
    
    list.querySelectorAll('.va-add-option-btn').forEach(btn => btn.onclick = e => {
      const idx = parseInt(btn.dataset.qidx, 10);
      if (quiz.questions[idx].options.length < 6) {
        quiz.questions[idx].options.push('');
        renderQuestions();
      } else {
        showToast('Maximum 6 options per question');
      }
    });
    
    list.querySelectorAll('.va-opt-del-btn').forEach(btn => btn.onclick = e => {
      const qIdx = parseInt(btn.dataset.qidx, 10);
      const oIdx = parseInt(btn.dataset.oidx, 10);
      
      if (quiz.questions[qIdx].options.length > 2) {
        quiz.questions[qIdx].options.splice(oIdx, 1);
        
        // Adjust the correct answer index if needed
        if (quiz.questions[qIdx].correct === oIdx) {
          quiz.questions[qIdx].correct = 0;
        } else if (quiz.questions[qIdx].correct > oIdx) {
          quiz.questions[qIdx].correct--;
        }
        
        renderQuestions();
      } else {
        showToast('Minimum 2 options required');
      }
    });
    
    // AI regenerate for a specific question
    list.querySelectorAll('.va-ai-btn').forEach(btn => btn.onclick = async e => {
      // AI generate for this question
      try {
        const idx = parseInt(btn.dataset.qidx, 10);
        const questionText = quiz.questions[idx].text || "General knowledge question";
        const difficulty = quiz.questions[idx].difficulty || "medium";
        const optionsCount = quiz.questions[idx].options.length;
        
        showToast('Generating new question...');
        
        // Use your existing aiService
        aiService.generateQuizQuestions({
          name: questionText,
          description: quiz.description,
          aiOptions: {
            topic: questionText,
            numQuestions: 1,
            difficulty: difficulty,
            optionsPerQuestion: optionsCount
          }
        }, {
          onComplete: (questions) => {
            if (!questions || questions.length === 0) {
              showToast('No question generated. Try a different topic.');
              return;
            }
            
            // Replace this question with the generated one
            const newQ = questions[0];
            quiz.questions[idx] = {
              text: newQ.text,
              options: Array.isArray(newQ.options) ? newQ.options.map(o => typeof o === 'string' ? o : o.text) : [],
              correct: newQ.correctIndex || 0,
              rationale: newQ.rationale || '',
              difficulty: difficulty
            };
            
            renderQuestions();
            showToast('Question regenerated with AI!');
          },
          onError: (error) => {
            showToast('AI generation failed: ' + error.message);
          }
        });
      } catch (e) {
        showToast('AI generation failed: ' + e.message);
      }
    });
    
    // Generate rationale for a question
    list.querySelectorAll('.va-generate-rationale-btn').forEach(btn => btn.onclick = async e => {
      try {
        const idx = parseInt(btn.dataset.qidx, 10);
        const question = quiz.questions[idx];
        
        if (!question.text || question.options.filter(o => o.trim()).length < 2) {
          showToast('Question text and at least 2 options are required');
          return;
        }
        
        showToast('Generating rationale...');
        
        // Use the aiService to generate a rationale
        const correctAnswer = question.options[question.correct];
        const incorrectAnswers = question.options.filter((_, i) => i !== question.correct);
        
        aiService.generateRationale(
          question.text,
          correctAnswer,
          incorrectAnswers,
          'educational'
        ).then(rationale => {
          if (rationale) {
            quiz.questions[idx].rationale = rationale;
            renderQuestions();
            showToast('Rationale generated!');
          } else {
            showToast('Failed to generate rationale');
          }
        }).catch(error => {
          showToast('Failed to generate rationale: ' + error.message);
        });
      } catch (e) {
        showToast('Failed to generate rationale: ' + e.message);
      }
    });
    
    // Improve an option with AI
    list.querySelectorAll('.va-opt-ai-btn').forEach(btn => btn.onclick = async e => {
      try {
        const qIdx = parseInt(btn.dataset.qidx, 10);
        const oIdx = parseInt(btn.dataset.oidx, 10);
        const question = quiz.questions[qIdx];
        const option = question.options[oIdx];
        
        if (!question.text) {
          showToast('Question text is required');
          return;
        }
        
        showToast('Improving option...');
        
        // Generate an improved option
        aiService.generateImprovedOption(
          question.text,
          option,
          oIdx === question.correct,
          question.options
        ).then(improvedOption => {
          if (improvedOption) {
            quiz.questions[qIdx].options[oIdx] = improvedOption;
            renderQuestions();
            showToast('Option improved!');
          } else {
            showToast('Failed to improve option');
          }
        }).catch(error => {
          showToast('Failed to improve option: ' + error.message);
        });
      } catch (e) {
        showToast('Failed to improve option: ' + e.message);
      }
    });
    
    // Enhanced similarity check
    list.querySelectorAll('.va-sim-btn').forEach(btn => btn.onclick = async e => {
      // Similarity check for this question
      try {
        const idx = parseInt(btn.dataset.qidx, 10);
        const questionText = quiz.questions[idx].text;
        
        if (!questionText) {
          showToast('Question text is empty');
          return;
        }
        
        showToast('Checking similarity...');
        
        // Use your existing similarityService
        similarityService.checkSimilarity(
          questionText, 
          quiz.questions.map(q => q.text).filter((q, i) => i !== idx && q)
        ).then((results) => {
          if (!results || !results.matches || results.matches.length === 0) {
            showToast('No similar questions found');
          } else {
            showToast(`Found ${results.matches.length} similar questions`);
            
            // Enhanced similarity visualization
            results.matches.forEach(match => {
              const matchIdx = quiz.questions.findIndex(q => q.text === match.text);
              if (matchIdx >= 0) {
                const similarCard = list.querySelector(`.va-question-card:nth-child(${matchIdx + 1})`);
                const currentCard = list.querySelector(`.va-question-card:nth-child(${idx + 1})`);
                
                if (similarCard && currentCard) {
                  // Highlight both cards
                  similarCard.style.borderLeft = '5px solid #ffc107';
                  similarCard.style.background = 'rgba(255, 193, 7, 0.1)';
                  currentCard.style.borderLeft = '5px solid #ffc107';
                  currentCard.style.background = 'rgba(255, 193, 7, 0.1)';
                  
                  // Add similarity badge
                  const similarityScore = Math.round(match.similarity * 100);
                  const badge = document.createElement('div');
                  badge.className = 'va-similarity-badge';
                  badge.innerHTML = `<strong>${similarityScore}%</strong> similar to Q${matchIdx + 1}`;
                  badge.style.position = 'absolute';
                  badge.style.top = '0';
                  badge.style.right = '0';
                  badge.style.background = '#ffc107';
                  badge.style.color = '#000';
                  badge.style.padding = '2px 8px';
                  badge.style.borderRadius = '0 0 0 8px';
                  badge.style.fontSize = '12px';
                  
                  // Remove any existing badges
                  const existingBadge = currentCard.querySelector('.va-similarity-badge');
                  if (existingBadge) {
                    existingBadge.remove();
                  }
                  
                  currentCard.style.position = 'relative';
                  currentCard.appendChild(badge);
                  
                  // Scroll to the similar question
                  similarCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  
                  // Add regenerate suggestion
                  if (similarityScore > 80) {
                    const suggestion = document.createElement('div');
                    suggestion.className = 'va-similarity-suggestion';
                    suggestion.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Questions are very similar. Consider regenerating one.`;
                    suggestion.style.background = '#f8d7da';
                    suggestion.style.color = '#721c24';
                    suggestion.style.padding = '8px';
                    suggestion.style.margin = '8px 0';
                    suggestion.style.borderRadius = '4px';
                    suggestion.style.fontSize = '14px';
                    
                    // Remove any existing suggestions
                    const existingSuggestion = currentCard.querySelector('.va-similarity-suggestion');
                    if (existingSuggestion) {
                      existingSuggestion.remove();
                    }
                    
                    currentCard.appendChild(suggestion);
                  }
                  
                  // Auto-clear after 8 seconds
                  setTimeout(() => {
                    similarCard.style.borderLeft = '';
                    similarCard.style.background = '';
                    currentCard.style.borderLeft = '';
                    currentCard.style.background = '';
                    const badge = currentCard.querySelector('.va-similarity-badge');
                    const suggestion = currentCard.querySelector('.va-similarity-suggestion');
                    if (badge) badge.remove();
                    if (suggestion) suggestion.remove();
                  }, 8000);
                }
              }
            });
          }
        }).catch(error => {
          showToast('Similarity check failed: ' + error.message);
        });
      } catch (e) {
        showToast('Similarity check failed: ' + e.message);
      }
    });
  }

  function renderReview() {
    const list = document.getElementById('va-review-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (quiz.questions.length === 0) {
      list.innerHTML = '<p>No questions to review. Please go back and add questions.</p>';
      return;
    }
    
    quiz.questions.forEach((q, i) => {
      if (!q.text) return; // Skip empty questions
      
      const card = document.createElement('div');
      card.className = 'va-question-card';
      card.innerHTML = `
        <b>Q${i+1}:</b> ${q.text}<br>
        ${q.options.map((opt, j) => `
          <span style="color:${q.correct===j?'var(--va-success)':'#333'}">${String.fromCharCode(65+j)}. ${opt}</span>
        `).join(' ')}
        <br><i>Rationale:</i> ${q.rationale || 'No rationale provided'}
      `;
      list.appendChild(card);
    });
  }

  const similarityBtn = document.getElementById('va-similarity-btn');
  if (similarityBtn) {
    similarityBtn.onclick = async () => {
      // Similarity check for all questions
      try {
        const questionTexts = quiz.questions.map(q => q.text).filter(Boolean);
        
        if (questionTexts.length === 0) {
          showToast('No questions to check');
          return;
        }
        
        showToast('Checking similarity across all questions...');
        
        // Use your existing similarityService
        similarityService.checkBatchSimilarity(questionTexts)
          .then(results => {
            if (!results || results.length === 0 || results.every(r => !r.hasSimilar)) {
              showToast('No similar questions found');
            } else {
              const similarCount = results.filter(r => r.hasSimilar).length;
              showToast(`Found ${similarCount} questions with similarity issues`);
              
              // Could enhance this with a detailed similarity report UI
              const reviewList = document.getElementById('va-review-list');
              if (reviewList) {
                results.forEach((result, idx) => {
                  if (result.hasSimilar) {
                    const element = reviewList.querySelector(`.va-question-card:nth-child(${idx + 1})`);
                    if (element) {
                      element.style.borderLeft = '3px solid red';
                      element.style.background = 'rgba(220, 53, 69, 0.05)';
                    }
                  }
                });
              }
            }
          })
          .catch(error => {
            showToast('Similarity check failed: ' + error.message);
          });
      } catch (e) {
        showToast('Similarity check failed: ' + e.message);
      }
    };
  }

  function showToast(msg) {
    if (!toast) return;
    
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  // Helper to get token
  function getTokenFromStorage() {
    return localStorage.getItem('auth_token');
  }

  // Expose the openModernQuizModal function globally
  window.openModernQuizModal = openModal;
}