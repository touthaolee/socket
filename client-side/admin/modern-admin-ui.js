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
        const topic = quiz.title || 'General Knowledge';
        
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
        <label>Q${i+1}: <input type="text" value="${q.text || ''}" data-qidx="${i}" class="va-qtext" placeholder="Question text"></label>
        <div>
          ${q.options.map((opt, j) => `
            <label>
              <input type="radio" name="correct${i}" ${q.correct===j?'checked':''} data-qidx="${i}" data-oidx="${j}" class="va-qcorrect">
              <input type="text" value="${opt || ''}" data-qidx="${i}" data-oidx="${j}" class="va-qopt" placeholder="Option ${j+1}">
            </label>
          `).join('<br>')}
        </div>
        <label>Rationale: <input type="text" value="${q.rationale || ''}" data-qidx="${i}" class="va-qrationale"></label>
        <div class="va-question-actions">
          <button type="button" class="va-btn va-primary va-edit-btn" data-qidx="${i}">Edit</button>
          <button type="button" class="va-btn va-success va-ai-btn" data-qidx="${i}">AI Generate</button>
          <button type="button" class="va-btn va-warning va-sim-btn" data-qidx="${i}">Similarity</button>
          <button type="button" class="va-btn va-secondary va-del-btn" data-qidx="${i}">Delete</button>
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
    
    list.querySelectorAll('.va-del-btn').forEach(btn => btn.onclick = e => {
      quiz.questions.splice(btn.dataset.qidx, 1);
      renderQuestions();
    });
    
    list.querySelectorAll('.va-ai-btn').forEach(btn => btn.onclick = async e => {
      // AI generate for this question
      try {
        const idx = parseInt(btn.dataset.qidx, 10);
        const questionText = quiz.questions[idx].text || "General knowledge question";
        
        showToast('Generating new question...');
        
        // Use your existing aiService
        aiService.generateQuizQuestions({
          name: questionText,
          description: quiz.description,
          aiOptions: {
            topic: questionText,
            numQuestions: 1,
            difficulty: 'medium',
            optionsPerQuestion: 4
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
              rationale: newQ.rationale || ''
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
        ).then(result => {
          if (!result || !result.matches || result.matches.length === 0) {
            showToast('No similar questions found');
          } else {
            showToast(`Found ${result.matches.length} similar questions`);
            
            // Highlight similar questions (could enhance this UI further)
            result.matches.forEach(match => {
              const matchIdx = quiz.questions.findIndex(q => q.text === match.text);
              if (matchIdx >= 0) {
                const element = list.querySelector(`.va-question-card:nth-child(${matchIdx + 1})`);
                if (element) {
                  element.style.borderLeft = '3px solid red';
                  setTimeout(() => {
                    element.style.borderLeft = '';
                  }, 3000);
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
    
    list.querySelectorAll('.va-edit-btn').forEach(btn => btn.onclick = e => {
      const idx = parseInt(btn.dataset.qidx, 10);
      const qText = document.querySelector(`.va-qtext[data-qidx="${idx}"]`);
      if (qText) {
        qText.focus();
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