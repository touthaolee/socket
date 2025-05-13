// client-side/admin/quiz-designer.js
import { getTokenFromStorage } from '../client-utils/client-helpers.js';
import { aiService } from './service/ai-service.js';

/**
 * Quiz Designer Module
 * Handles the new quiz creation interface
 */
class QuizDesigner {
  constructor() {
    this.questions = [];
    this.currentEditingQuestionIndex = null;
    this.isGenerating = false;
    this.quizData = {
      name: '',
      description: '',
      timePerQuestion: 30,
      generationMethod: 'ai',
      aiOptions: {
        topic: '',
        numQuestions: 10,
        difficulty: 'medium',
        rationaleTone: 'educational',
        optionsPerQuestion: 4,
        specificFocuses: ''
      },
      questions: []
    };
    
    // Initialize the designer
    this.init();
  }
  
  /**
   * Initialize the quiz designer
   */
  init() {
    // Load HTML components
    this.loadQuizDesignerHTML().then(() => {
      // Initialize UI elements
      this.initUIElements();
      // Set up event listeners
      this.setupEventListeners();
    });
  }
  
  /**
   * Load the quiz designer HTML
   */
  async loadQuizDesignerHTML() {
    try {
      const response = await fetch('/interac/quiz-designer.html');
      const html = await response.text();
      
      // Create a temporary container
      const temp = document.createElement('div');
      temp.innerHTML = html;
      
      // Extract and append the modals
      const modals = temp.querySelectorAll('.modal');
      modals.forEach(modal => {
        document.body.appendChild(modal);
      });        // Initialize CSS if not already loaded
      if (!document.querySelector('link[href*="quiz-designer.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/interac/client-styles/quiz-designer.css';
        document.head.appendChild(link);
      }
      
      return true;
    } catch (error) {
      console.error('Error loading quiz designer HTML', error);
      return false;
    }
  }
  
  /**
   * Initialize UI elements
   */
  initUIElements() {
    // Main modal
    this.designerModal = document.getElementById('quiz-designer-modal');
    
    // Quiz info inputs
    this.quizNameInput = document.getElementById('designer-quiz-name');
    this.quizDescriptionInput = document.getElementById('designer-quiz-description');
    this.timePerQuestionInput = document.getElementById('designer-time-per-question');
    
    // Generation method buttons
    this.methodButtons = document.querySelectorAll('.method-option');
    this.aiOptionsSection = document.getElementById('ai-generation-options');
    this.manualOptionsSection = document.getElementById('manual-entry-options');
    
    // AI generation options
    this.aiTopicInput = document.getElementById('designer-ai-topic');
    this.questionCountInput = document.getElementById('designer-question-count');
    this.difficultySelect = document.getElementById('designer-difficulty');
    this.optionsPerQuestionSelect = document.getElementById('designer-options-per-question');
    this.toneSelect = document.getElementById('designer-tone');
    this.specificFocusesInput = document.getElementById('designer-specific-focuses');
    
    // Designer tabs
    this.designerTabButtons = document.querySelectorAll('.designer-tab-btn');
    this.editorTabContent = document.getElementById('question-editor-tab');
    this.previewTabContent = document.getElementById('quiz-preview-tab');
      // Question container and controls
    this.questionsContainer = document.getElementById('questions-editor-container');
    this.questionCountDisplay = document.getElementById('question-count-display');
    this.generateQuestionsBtn = document.getElementById('generate-questions-btn');
    this.addAiQuestionBtn = document.getElementById('add-ai-question-btn');
    this.addNewQuestionBtn = document.getElementById('add-new-question-btn');
    
    // Preview elements
    this.previewQuestionCount = document.getElementById('preview-question-count');
    this.previewTimePerQuestion = document.getElementById('preview-time-per-question');
    this.quizPreviewContainer = document.getElementById('quiz-preview-container');
    
    // Action buttons
    this.cancelDesignerBtn = document.getElementById('cancel-designer-btn');
    this.saveQuizDraftBtn = document.getElementById('save-quiz-draft-btn');
    this.publishQuizBtn = document.getElementById('publish-quiz-btn');
    
    // Question editor modal
    this.questionEditorModal = document.getElementById('question-editor-modal');
    this.editQuestionTextInput = document.getElementById('edit-question-text');
    this.editOptionsContainer = document.getElementById('edit-options-container');
    this.editRationaleInput = document.getElementById('edit-rationale');
    this.addOptionBtn = document.getElementById('add-option-btn');
    this.saveQuestionBtn = document.getElementById('save-question-btn');
    this.cancelEditQuestionBtn = document.getElementById('cancel-edit-question-btn');
    
    // Generation progress modal
    this.generationProgressModal = document.getElementById('new-generation-progress-modal');
    this.progressPercentage = document.getElementById('progress-percentage');
    this.questionsGeneratedCount = document.getElementById('questions-generated-count');
    this.generationTimeElapsed = document.getElementById('generation-time-elapsed');
    this.generationTimeRemaining = document.getElementById('generation-time-remaining');
    this.generationProgressLog = document.getElementById('generation-progress-log');
    this.cancelGenerationBtn = document.getElementById('cancel-generation-btn');
    
    // Number input controls
    this.decreaseBtn = document.querySelector('.number-btn.decrease');
    this.increaseBtn = document.querySelector('.number-btn.increase');
  }
    /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Show designer modal button
    const newQuizDesignerBtn = document.getElementById('new-quiz-designer-btn');
    if (newQuizDesignerBtn) {
      console.log('Setting up click handler for new quiz designer button');
      newQuizDesignerBtn.addEventListener('click', () => {
        console.log('New quiz designer button clicked');
        this.showDesignerModal();
      });
    } else {
      console.warn('New quiz designer button not found in the DOM');
    }
    
    // Close designer modal button
    const closeDesignerModalBtn = document.querySelector('.close-designer-modal');
    if (closeDesignerModalBtn) {
      closeDesignerModalBtn.addEventListener('click', () => this.hideDesignerModal());
    }
    
    // Generation method buttons
    this.methodButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const method = btn.dataset.method;
        this.setGenerationMethod(method);
      });
    });
    
    // Designer tab buttons
    this.designerTabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchDesignerTab(tab);
      });
    });
    
    // Number input controls
    if (this.decreaseBtn && this.increaseBtn && this.questionCountInput) {
      this.decreaseBtn.addEventListener('click', () => {
        let count = parseInt(this.questionCountInput.value);
        if (count > 5) {
          this.questionCountInput.value = count - 5;
        }
      });
      
      this.increaseBtn.addEventListener('click', () => {
        let count = parseInt(this.questionCountInput.value);
        if (count < 50) {
          this.questionCountInput.value = count + 5;
        }
      });
      
      // Ensure valid number range
      this.questionCountInput.addEventListener('change', () => {
        let value = parseInt(this.questionCountInput.value);
        if (isNaN(value) || value < 5) value = 5;
        if (value > 50) value = 50;
        this.questionCountInput.value = value;
      });
    }
      // Generate questions button
    if (this.generateQuestionsBtn) {
      this.generateQuestionsBtn.addEventListener('click', () => this.generateQuestions());
    }
    
    // Add AI Question button
    if (this.addAiQuestionBtn) {
      this.addAiQuestionBtn.addEventListener('click', () => this.generateSingleQuestion());
    }
    
    // Add new question button
    if (this.addNewQuestionBtn) {
      this.addNewQuestionBtn.addEventListener('click', () => this.openQuestionEditor());
    }
    
    // Save and cancel buttons
    if (this.cancelDesignerBtn) {
      this.cancelDesignerBtn.addEventListener('click', () => this.hideDesignerModal());
    }
    
    if (this.saveQuizDraftBtn) {
      this.saveQuizDraftBtn.addEventListener('click', () => this.saveQuiz('draft'));
    }
    
    if (this.publishQuizBtn) {
      this.publishQuizBtn.addEventListener('click', () => this.saveQuiz('published'));
    }
    
    // Question editor modal events
    if (this.addOptionBtn) {
      this.addOptionBtn.addEventListener('click', () => this.addOptionToEditor());
    }
    
    if (this.saveQuestionBtn) {
      this.saveQuestionBtn.addEventListener('click', () => this.saveQuestionFromEditor());
    }
    
    if (this.cancelEditQuestionBtn) {
      this.cancelEditQuestionBtn.addEventListener('click', () => this.closeQuestionEditor());
    }
    
    // Close question editor modal button
    const closeQuestionEditorModalBtn = document.querySelector('.close-question-editor-modal');
    if (closeQuestionEditorModalBtn) {
      closeQuestionEditorModalBtn.addEventListener('click', () => this.closeQuestionEditor());
    }
    
    // Cancel generation button
    if (this.cancelGenerationBtn) {
      this.cancelGenerationBtn.addEventListener('click', () => {
        this.isGenerating = false;
        this.addGenerationLogEntry('Generation cancelled by user', 'warning');
      });
    }
    
    // Modal click outside to close
    window.addEventListener('click', (e) => {
      if (e.target === this.designerModal) {
        this.hideDesignerModal();
      }
      if (e.target === this.questionEditorModal) {
        this.closeQuestionEditor();
      }
    });
    
    // Form inputs to update quiz data
    if (this.quizNameInput) {
      this.quizNameInput.addEventListener('input', () => {
        this.quizData.name = this.quizNameInput.value;
      });
    }
    
    if (this.quizDescriptionInput) {
      this.quizDescriptionInput.addEventListener('input', () => {
        this.quizData.description = this.quizDescriptionInput.value;
      });
    }
    
    if (this.timePerQuestionInput) {
      this.timePerQuestionInput.addEventListener('input', () => {
        this.quizData.timePerQuestion = parseInt(this.timePerQuestionInput.value) || 30;
        this.updatePreviewMeta();
      });
    }
  }
    /**
   * Show the designer modal
   * @param {boolean} skipReset - If true, skip resetting the designer (used when editing existing quiz)
   */
  showDesignerModal(skipReset = false) {
    // Reset the form if not skipped (we skip when editing an existing quiz)
    if (!skipReset) {
      this.resetDesigner();
    }
    
    // Show the modal
    if (this.designerModal) {
      this.designerModal.style.display = 'flex';
      
      // Force browser reflow
      void this.designerModal.offsetWidth;
      
      // Add active class for animations
      this.designerModal.classList.add('active');
    }
  }
  
  /**
   * Hide the designer modal
   */
  hideDesignerModal() {
    if (this.designerModal) {
      // Remove active class first (for animations)
      this.designerModal.classList.remove('active');
      
      // Then hide after a short delay
      setTimeout(() => {
        this.designerModal.style.display = 'none';
      }, 300);
    }
  }
  
  /**
   * Reset the designer state
   */
  resetDesigner() {
    // Reset the form
    if (this.quizNameInput) this.quizNameInput.value = '';
    if (this.quizDescriptionInput) this.quizDescriptionInput.value = '';
    if (this.timePerQuestionInput) this.timePerQuestionInput.value = '30';
    
    // Reset AI options
    if (this.aiTopicInput) this.aiTopicInput.value = '';
    if (this.questionCountInput) this.questionCountInput.value = '10';
    if (this.difficultySelect) this.difficultySelect.value = 'medium';
    if (this.optionsPerQuestionSelect) this.optionsPerQuestionSelect.value = '4';
    if (this.toneSelect) this.toneSelect.value = 'educational';
    if (this.specificFocusesInput) this.specificFocusesInput.value = '';
    
    // Reset questions
    this.questions = [];
    this.currentEditingQuestionIndex = null;
    
    // Reset quiz data
    this.quizData = {
      name: '',
      description: '',
      timePerQuestion: 30,
      generationMethod: 'ai',
      aiOptions: {
        topic: '',
        numQuestions: 10,
        difficulty: 'medium',
        rationaleTone: 'educational',
        optionsPerQuestion: 4,
        specificFocuses: ''
      },
      questions: []
    };
    
    // Reset question list
    this.updateQuestionList();
    
    // Set generation method to AI (default)
    this.setGenerationMethod('ai');
    
    // Activate editor tab
    this.activateTab('editor');
  }
  
  /**
   * Set the generation method (ai or manual)
   */
  setGenerationMethod(method) {
    // Update UI
    this.methodButtons.forEach(btn => {
      if (btn.dataset.method === method) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // Show/hide options
    if (method === 'ai') {
      this.aiOptionsSection.classList.add('active');
      this.manualOptionsSection.classList.remove('active');
    } else {
      this.aiOptionsSection.classList.remove('active');
      this.manualOptionsSection.classList.add('active');
    }
    
    // Update data
    this.quizData.generationMethod = method;
  }
  
  /**
   * Switch between designer tabs
   */
  switchDesignerTab(tab) {
    // Update tab buttons
    this.designerTabButtons.forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // Show corresponding content
    if (tab === 'editor') {
      this.editorTabContent.classList.add('active');
      this.previewTabContent.classList.remove('active');
    } else if (tab === 'preview') {
      this.editorTabContent.classList.remove('active');
      this.previewTabContent.classList.add('active');
      this.updateQuizPreview();
    }
  }
  
  /**
   * Generate questions using AI
   */
  async generateQuestions() {
    // Get form data
    this.quizData.name = this.quizNameInput.value.trim();
    this.quizData.description = this.quizDescriptionInput.value.trim();
    this.quizData.timePerQuestion = parseInt(this.timePerQuestionInput.value) || 30;
    this.quizData.aiOptions.topic = this.aiTopicInput.value.trim();
    this.quizData.aiOptions.numQuestions = parseInt(this.questionCountInput.value) || 10;
    this.quizData.aiOptions.difficulty = this.difficultySelect.value;
    this.quizData.aiOptions.optionsPerQuestion = parseInt(this.optionsPerQuestionSelect.value) || 4;
    this.quizData.aiOptions.rationaleTone = this.toneSelect.value;
    this.quizData.aiOptions.specificFocuses = this.specificFocusesInput.value.trim();
    
    // Validate
    if (!this.quizData.name) {
      alert('Please enter a quiz name');
      this.quizNameInput.focus();
      return;
    }
    
    if (!this.quizData.aiOptions.topic) {
      alert('Please enter a topic for the quiz');
      this.aiTopicInput.focus();
      return;
    }
    
    // Show generation progress modal
    this.showGenerationProgress();
    
    // Reset for new generation
    this.isGenerating = true;
    const startTime = Date.now();
    
    // Start timer update
    const timerInterval = setInterval(() => {
      if (!this.isGenerating) {
        clearInterval(timerInterval);
        return;
      }
      
      const elapsedMs = Date.now() - startTime;
      this.updateGenerationTimer(elapsedMs);
    }, 1000);
    
    try {
      // Add log entry
      this.addGenerationLogEntry('Starting generation for topic: ' + this.quizData.aiOptions.topic);
      this.addGenerationLogEntry('Connecting to AI service...');
      
      // Configure with proper batch size
      const finalOptions = {
        ...this.quizData.aiOptions,
        batchSize: 10 // Fixed batch size for optimal performance
      };
      
      // Call AI service to generate questions
      await aiService.generateQuizQuestions(
        { ...this.quizData, aiOptions: finalOptions },
        {
          onProgress: (progress, generatedCount, totalCount) => {
            if (!this.isGenerating) return;
            
            // Update progress
            this.updateGenerationProgress(progress, generatedCount, totalCount);
          },
          onBatchComplete: (batch, batchNumber, totalBatches) => {
            if (!this.isGenerating) return;
            
            // Add batch completion log
            this.addGenerationLogEntry(
              `Batch ${batchNumber}/${totalBatches} complete: ${batch.length} questions generated`, 
              'success'
            );
          },          onComplete: (generatedQuestions) => {
            // Clear interval
            clearInterval(timerInterval);
            
            if (!this.isGenerating) {
              this.hideGenerationProgress();
              return;
            }
            
            console.log('[QuizDesigner] onComplete called with questions:', {
              count: generatedQuestions?.length || 0,
              isArray: Array.isArray(generatedQuestions),
              dataType: typeof generatedQuestions,
              sample: generatedQuestions?.[0] ? JSON.stringify(generatedQuestions[0]).substring(0, 100) + '...' : 'none'
            });
            
            // Handle case where we might have received a wrapped response
            if (!Array.isArray(generatedQuestions) && typeof generatedQuestions === 'object') {
              if (generatedQuestions.questions && Array.isArray(generatedQuestions.questions)) {
                console.log('[QuizDesigner] Unwrapping questions from response object');
                generatedQuestions = generatedQuestions.questions;
              } else if (generatedQuestions.success && generatedQuestions.data && Array.isArray(generatedQuestions.data)) {
                console.log('[QuizDesigner] Unwrapping questions from success.data object');
                generatedQuestions = generatedQuestions.data;
              }
            }
            
            // Ensure we always have an array to work with
            if (!Array.isArray(generatedQuestions)) {
              console.error('[QuizDesigner] Expected array but got:', typeof generatedQuestions);
              generatedQuestions = generatedQuestions ? [generatedQuestions] : [];
            }
            
            // Process generated questions
            this.processGeneratedQuestions(generatedQuestions);
            
            // Hide progress modal
            setTimeout(() => {
              this.hideGenerationProgress();
            }, 1000);
          },
          onError: (error) => {
            clearInterval(timerInterval);
            console.error('[QuizDesigner] AI generation error:', error);
            this.addGenerationLogEntry(`Error: ${error.message}`, 'error');
            
            setTimeout(() => {
              this.hideGenerationProgress();
            }, 3000);
          }
        }
      );
    } catch (error) {
      // Clear interval
      clearInterval(timerInterval);
      
      // Log error
      console.error('Error generating questions:', error);
      this.addGenerationLogEntry('Error generating questions: ' + error.message, 'error');
      
      // Hide progress modal after delay
      setTimeout(() => {
        this.hideGenerationProgress();
      }, 3000);
    }
  }  /**
   * Generate a single question with AI
   */
  async generateSingleQuestion() {
    if (this.isGenerating) {
      console.log('Already generating questions, please wait...');
      return;
    }
    
    // Get form data
    this.quizData.aiOptions.topic = this.aiTopicInput ? this.aiTopicInput.value.trim() : '';
    this.quizData.aiOptions.difficulty = this.difficultySelect ? this.difficultySelect.value : 'medium';
    this.quizData.aiOptions.optionsPerQuestion = this.optionsPerQuestionSelect ? parseInt(this.optionsPerQuestionSelect.value) : 4;
    this.quizData.aiOptions.rationaleTone = this.toneSelect ? this.toneSelect.value : 'educational';
    this.quizData.aiOptions.specificFocuses = this.specificFocusesInput ? this.specificFocusesInput.value.trim() : '';
    
    // Validate topic
    if (!this.quizData.aiOptions.topic) {
      alert('Please enter a topic for the question');
      if (this.aiTopicInput) {
        this.aiTopicInput.focus();
      }
      return;
    }
    
    // Show generation progress modal
    this.showGenerationProgress();
    
    // Reset for new generation
    this.isGenerating = true;
    const startTime = Date.now();
    
    // Start timer update
    const timerInterval = setInterval(() => {
      if (!this.isGenerating) {
        clearInterval(timerInterval);
        return;
      }
      
      const elapsedMs = Date.now() - startTime;
      this.updateGenerationTimer(elapsedMs);
    }, 1000);
    
    try {
      // Add log entry
      this.addGenerationLogEntry('Generating a single question for topic: ' + this.quizData.aiOptions.topic);
      this.addGenerationLogEntry('Connecting to AI service...');
      
      // Use the AI service to generate a single question
      const question = await aiService.generateQuizQuestion(
        this.quizData.aiOptions.topic, 
        {
          difficulty: this.quizData.aiOptions.difficulty,
          optionsCount: parseInt(this.quizData.aiOptions.optionsPerQuestion),
          format: 'json',
          tone: this.quizData.aiOptions.rationaleTone,
          specificFocuses: this.quizData.aiOptions.specificFocuses
        }
      );
      
      // Clear interval
      clearInterval(timerInterval);
      
      if (!this.isGenerating) {
        this.hideGenerationProgress();
        return;
      }      // Process the generated question
      if (question) {
        this.addGenerationLogEntry('Question generated successfully!', 'success');
        
        // Process the question to ensure it's in the right format
        const processedQuestion = this.processGeneratedQuestion(question);
        
        if (processedQuestion) {
          // Add the question to our questions array
          this.questions.push(processedQuestion);
          
          // Update the question count display
          this.updateQuestionCount();
          
          // Render the questions
          this.renderQuestionsEditor();
        } else {
          this.addGenerationLogEntry('Failed to process generated question', 'error');
        }
      } else {
        this.addGenerationLogEntry('Failed to generate question (no data returned)', 'error');
      }
      
      // Hide progress modal
      setTimeout(() => {
        this.hideGenerationProgress();
      }, 1000);
      
    } catch (error) {
      // Clear interval
      clearInterval(timerInterval);
      
      // Log error
      console.error('Error generating question:', error);
      this.addGenerationLogEntry('Error generating question: ' + error.message, 'error');
      
      // Hide progress modal after delay
      setTimeout(() => {
        this.hideGenerationProgress();
      }, 3000);
    } finally {
      this.isGenerating = false;
    }
  }
  
  /**
   * Process generated questions
   */
  processGeneratedQuestions(generatedQuestions) {
    console.log('[QuizDesigner] Processing generated questions:', generatedQuestions);
    
    if (!generatedQuestions) {
      console.error('[QuizDesigner] generatedQuestions is null or undefined');
      this.addGenerationLogEntry('No questions were generated (received null)', 'error');
      return;
    }
    
    if (!Array.isArray(generatedQuestions)) {
      console.error('[QuizDesigner] generatedQuestions is not an array:', typeof generatedQuestions);
      
      // Try to convert to array if it's an object with questions
      if (typeof generatedQuestions === 'object' && generatedQuestions.questions) {
        console.log('[QuizDesigner] Attempting to extract questions from object');
        generatedQuestions = Array.isArray(generatedQuestions.questions) ? 
          generatedQuestions.questions : [generatedQuestions.questions];
      } else {
        this.addGenerationLogEntry('No questions were generated (invalid format)', 'error');
        return;
      }
    }
    
    if (generatedQuestions.length === 0) {
      console.error('[QuizDesigner] generatedQuestions array is empty');
      this.addGenerationLogEntry('No questions were generated (empty array)', 'error');
      return;
    }
    
    console.log('[QuizDesigner] Question sample:', JSON.stringify(generatedQuestions[0]).substring(0, 200));      // Process and format questions
    const formattedQuestions = generatedQuestions.map((q, index) => {
      try {
        // Ensure question has all required properties
        if (!q) {
          console.warn(`[QuizDesigner] Question #${index} is null or undefined`);
          return null;
        }
        
        // Handle different question formats
        let questionText = '';
        let options = [];
        let correctIndex = 0;
        let rationale = '';
        
        // Extract question text
        if (typeof q.text === 'string') {
          questionText = q.text;
        } else if (typeof q.question === 'string') {
          questionText = q.question;
        } else if (typeof q === 'string') {
          questionText = q;
        } else {
          console.warn(`[QuizDesigner] Question #${index} has no valid text property:`, q);
          return null;
        }
        
        // Extract options
        if (Array.isArray(q.options) && q.options.length >= 2) {
          options = q.options.map((opt, i) => {
            if (typeof opt === 'string') return opt;
            if (opt && typeof opt === 'object' && opt.text) return opt.text;
            return String(opt || `Option ${i+1}`);
          });
        } else if (Array.isArray(q.answers) && q.answers.length >= 2) {
          options = q.answers.map((ans, i) => {
            if (typeof ans === 'string') return ans;
            if (ans && typeof ans === 'object' && ans.text) return ans.text;
            return String(ans || `Option ${i+1}`);
          });
        } else if (q.option1 && q.option2) {
          // Handle numbered option properties
          for (let i = 1; i <= 10; i++) {
            const optKey = `option${i}`;
            if (q[optKey]) options.push(q[optKey]);
            else break;
          }
        } else {
          console.warn(`[QuizDesigner] Question #${index} has invalid options:`, q);
          return null;
        }
        
        // Extract correct index
        if (typeof q.correctIndex === 'number') {
          correctIndex = q.correctIndex;
        } else if (typeof q.correctAnswer === 'number') {
          correctIndex = q.correctAnswer;
        } else if (typeof q.answer === 'number') {
          correctIndex = q.answer;
        } else if (q.correct !== undefined) {
          correctIndex = q.correct;
        }
        
        // Validate correctIndex
        if (typeof correctIndex !== 'number' || correctIndex < 0 || correctIndex >= options.length) {
          console.warn(`[QuizDesigner] Question #${index} has invalid correctIndex (${correctIndex}), defaulting to 0`);
          correctIndex = 0;
        }
        
        // Extract rationale
        if (typeof q.rationale === 'string') {
          rationale = q.rationale;
        } else if (typeof q.explanation === 'string') {
          rationale = q.explanation;
        } else if (typeof q.feedback === 'string') {
          rationale = q.feedback;
        } else {
          rationale = 'Explanation not provided for this question.';
        }
        
        return {
          text: questionText,
          options: options,
          correctIndex: correctIndex,
          rationale: rationale
        };
      } catch (err) {
        console.error(`[QuizDesigner] Error processing question #${index}:`, err);
        return null;
      }
    }).filter(q => q !== null); // Remove any null questions
      if (formattedQuestions.length === 0) {
      this.addGenerationLogEntry('Failed to process any valid questions', 'error');
      // Try once more with generic question format if we couldn't process any questions
      try {
        const fallbackQuestions = generatedQuestions.map((q, i) => {
          return {
            text: typeof q === 'string' ? q : 
                  (q.text || q.question || `Generated question ${i+1}`),
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctIndex: 0,
            rationale: "Please review this question as it was generated in an unexpected format."
          };
        });
        
        if (fallbackQuestions.length > 0) {
          console.log('[QuizDesigner] Using fallback questions:', fallbackQuestions);
          this.questions = fallbackQuestions;
          this.quizData.questions = fallbackQuestions;
          this.updateQuestionsList();
          this.updateQuestionCount();
          this.updatePreviewMeta();
          this.addGenerationLogEntry(
            `Warning: Generated ${fallbackQuestions.length} questions with default options. You may need to edit them.`,
            'warning'
          );
          return;
        }
      } catch (err) {
        console.error('[QuizDesigner] Fallback generation also failed:', err);
      }
      return;
    }
    
    console.log('[QuizDesigner] Processed questions:', formattedQuestions);
    
    // Update questions array
    this.questions = formattedQuestions;
    this.quizData.questions = formattedQuestions;
    
    // Update UI
    this.updateQuestionsList();
    this.updateQuestionCount();
    this.updatePreviewMeta();
    
    // Add final log entry
    this.addGenerationLogEntry(
      `Generation complete: ${formattedQuestions.length} questions created successfully!`,
      'success'
    );
  }
  
  /**
   * Show generation progress modal
   */
  showGenerationProgress() {
    if (this.generationProgressModal) {
      // Reset progress indicators
      this.progressPercentage.textContent = '0%';
      this.questionsGeneratedCount.textContent = '0/' + this.quizData.aiOptions.numQuestions;
      this.generationTimeElapsed.textContent = '00:00';
      this.generationTimeRemaining.textContent = '--:--';
      
      // Clear log
      this.generationProgressLog.innerHTML = '';
      
      // Update circle gradient
      document.querySelector('.progress-circle').style.background = 'conic-gradient(#3b82f6 0%, #e5e7eb 0%)';
      
      // Show modal
      this.generationProgressModal.style.display = 'flex';
    }
  }
  
  /**
   * Hide generation progress modal
   */
  hideGenerationProgress() {
    if (this.generationProgressModal) {
      this.generationProgressModal.style.display = 'none';
    }
  }
  
  /**
   * Update generation progress
   */
  updateGenerationProgress(progress, generatedCount, totalCount) {
    // Update percentage
    this.progressPercentage.textContent = Math.round(progress) + '%';
    
    // Update questions count
    this.questionsGeneratedCount.textContent = `${generatedCount}/${totalCount}`;
    
    // Update circle gradient
    document.querySelector('.progress-circle').style.background = 
      `conic-gradient(#3b82f6 ${progress}%, #e5e7eb 0%)`;
  }
  
  /**
   * Update generation timer
   */
  updateGenerationTimer(elapsedMs) {
    // Calculate elapsed time
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    
    // Format time
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    this.generationTimeElapsed.textContent = formattedTime;
    
    // Calculate remaining time if we have generated at least one question
    const generatedCount = parseInt(this.questionsGeneratedCount.textContent.split('/')[0]) || 0;
    const totalCount = parseInt(this.questionsGeneratedCount.textContent.split('/')[1]) || this.quizData.aiOptions.numQuestions;
    
    if (generatedCount > 0) {
      const timePerQuestion = elapsedSeconds / generatedCount;
      const remainingQuestions = totalCount - generatedCount;
      const remainingSeconds = Math.round(timePerQuestion * remainingQuestions);
      
      const remainingMinutes = Math.floor(remainingSeconds / 60);
      const remainingSecondsDisplay = remainingSeconds % 60;
      
      const formattedRemaining = `${remainingMinutes.toString().padStart(2, '0')}:${remainingSecondsDisplay.toString().padStart(2, '0')}`;
      this.generationTimeRemaining.textContent = formattedRemaining;
    }
  }
  
  /**
   * Add an entry to the generation log
   */
  addGenerationLogEntry(text, type = '') {
    if (this.generationProgressLog) {
      const entry = document.createElement('div');
      entry.classList.add('log-entry');
      
      if (type) {
        entry.classList.add(type);
      }
      
      entry.textContent = text;
      this.generationProgressLog.appendChild(entry);
      this.generationProgressLog.scrollTop = this.generationProgressLog.scrollHeight;
    }
  }
  
  /**
   * Update the questions list in the editor
   */
  updateQuestionsList() {
    if (!this.questionsContainer) {
      console.warn('Questions container element not found');
      return;
    }
    
    // Clear container
    this.questionsContainer.innerHTML = '';
    
    // Show empty state if no questions
    if (this.questions.length === 0) {
      this.questionsContainer.innerHTML = `
        <div class="empty-state">
          <img src="https://cdn-icons-png.flaticon.com/512/7486/7486754.png" alt="Empty questions" width="120">
          <h3>No Questions Yet</h3>
          <p>Generate questions using AI or add them manually</p>
        </div>
      `;
      return;
    }
    
    // Create a question card for each question
    this.questions.forEach((question, index) => {
      const card = this.createQuestionCard(question, index);
      this.questionsContainer.appendChild(card);
    });
    
    // Update question count
    this.updateQuestionCount();
  }
  
  /**
   * Create a question card element
   */
  createQuestionCard(question, index) {
    const card = document.createElement('div');
    card.classList.add('question-card');
    card.dataset.index = index;
    
    // Create header with question number and actions
    const header = document.createElement('div');
    header.classList.add('question-card-header');
    
    const questionNumber = document.createElement('div');
    questionNumber.classList.add('question-number');
    questionNumber.textContent = `Question ${index + 1}`;
    
    const actions = document.createElement('div');
    actions.classList.add('question-actions');
    
    const editBtn = document.createElement('button');
    editBtn.classList.add('question-action-btn');
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.title = 'Edit Question';
    editBtn.addEventListener('click', () => this.openQuestionEditor(index));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('question-action-btn');
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Delete Question';
    deleteBtn.addEventListener('click', () => this.deleteQuestion(index));
    
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    
    header.appendChild(questionNumber);
    header.appendChild(actions);
    
    // Question text
    const questionText = document.createElement('div');
    questionText.classList.add('question-text');
    questionText.textContent = question.text;
    
    // Options
    const optionsContainer = document.createElement('div');
    optionsContainer.classList.add('question-options');
    
    question.options.forEach((option, optIndex) => {
      const optionEl = document.createElement('div');
      optionEl.classList.add('question-option');
      
      if (optIndex === question.correctIndex) {
        optionEl.classList.add('correct');
      }
      
      const marker = document.createElement('div');
      marker.classList.add('option-marker');
      marker.textContent = String.fromCharCode(65 + optIndex); // A, B, C, D...
      
      const text = document.createElement('div');
      text.classList.add('option-text');
      text.textContent = option;
      
      optionEl.appendChild(marker);
      optionEl.appendChild(text);
      optionsContainer.appendChild(optionEl);
    });
    
    // Explanation/Rationale (initially hidden)
    let explanationVisible = false;
    const explanationToggle = document.createElement('button');
    explanationToggle.classList.add('explanation-toggle');
    explanationToggle.innerHTML = '<i class="fas fa-info-circle"></i> Show Explanation';
    
    const explanation = document.createElement('div');
    explanation.classList.add('question-explanation');
    explanation.style.display = 'none';
    explanation.textContent = question.rationale || 'No explanation provided.';
    
    explanationToggle.addEventListener('click', () => {
      if (explanationVisible) {
        explanation.style.display = 'none';
        explanationToggle.innerHTML = '<i class="fas fa-info-circle"></i> Show Explanation';
      } else {
        explanation.style.display = 'block';
        explanationToggle.innerHTML = '<i class="fas fa-chevron-up"></i> Hide Explanation';
      }
      explanationVisible = !explanationVisible;
    });
    
    // Assemble the card
    card.appendChild(header);
    card.appendChild(questionText);
    card.appendChild(optionsContainer);
    card.appendChild(explanationToggle);
    card.appendChild(explanation);
    
    return card;
  }
  
  /**
   * Update question count display
   */
  updateQuestionCount() {
    if (this.questionCountDisplay) {
      this.questionCountDisplay.textContent = `${this.questions.length} questions`;
    }
  }
  
  /**
   * Alternative name for updateQuestionCount to maintain compatibility
   */
  updateQuestionCountDisplay() {
    this.updateQuestionCount();
  }
  
  /**
   * Update preview metadata
   */
  updatePreviewMeta() {
    if (this.previewQuestionCount) {
      this.previewQuestionCount.textContent = `${this.questions.length} questions`;
    }
    
    if (this.previewTimePerQuestion) {
      this.previewTimePerQuestion.textContent = `${this.quizData.timePerQuestion}s per question`;
    }
  }
  
  /**
   * Open the question editor
   */
  openQuestionEditor(index = null) {
    this.currentEditingQuestionIndex = index;
    
    // Clear form
    this.editQuestionTextInput.value = '';
    this.editRationaleInput.value = '';
    this.editOptionsContainer.innerHTML = '';
    
    if (index !== null && this.questions[index]) {
      // Editing existing question
      const question = this.questions[index];
      this.editQuestionTextInput.value = question.text;
      this.editRationaleInput.value = question.rationale || '';
      
      // Add options
      question.options.forEach((option, optIndex) => {
        this.addOptionToEditor(option, optIndex === question.correctIndex);
      });
    } else {
      // New question - add default number of options
      const optionCount = parseInt(this.optionsPerQuestionSelect.value) || 4;
      for (let i = 0; i < optionCount; i++) {
        this.addOptionToEditor('', i === 0); // First option selected by default
      }
    }
    
    // Show modal
    this.questionEditorModal.style.display = 'flex';
  }
  
  /**
   * Close the question editor
   */
  closeQuestionEditor() {
    this.questionEditorModal.style.display = 'none';
    this.currentEditingQuestionIndex = null;
  }
  
  /**
   * Add an option to the question editor
   */
  addOptionToEditor(optionText = '', isCorrect = false) {
    const optionRow = document.createElement('div');
    optionRow.classList.add('option-row');
    
    // Radio button for correct answer
    const optionCorrect = document.createElement('div');
    optionCorrect.classList.add('option-correct');
    
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'correct-option';
    radio.checked = isCorrect;
    
    optionCorrect.appendChild(radio);
    
    // Option text input
    const optionTextContainer = document.createElement('div');
    optionTextContainer.classList.add('option-text-container');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.classList.add('option-text');
    input.placeholder = `Option ${this.editOptionsContainer.children.length + 1}`;
    input.value = optionText;
    
    optionTextContainer.appendChild(input);
    
    // Remove button
    const optionActions = document.createElement('div');
    optionActions.classList.add('option-actions');
    
    const removeBtn = document.createElement('button');
    removeBtn.classList.add('remove-option-btn');
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.addEventListener('click', () => {
      // Don't allow fewer than 2 options
      if (this.editOptionsContainer.children.length > 2) {
        optionRow.remove();
      } else {
        alert('A question must have at least 2 options');
      }
    });
    
    optionActions.appendChild(removeBtn);
    
    // Assemble the row
    optionRow.appendChild(optionCorrect);
    optionRow.appendChild(optionTextContainer);
    optionRow.appendChild(optionActions);
    
    this.editOptionsContainer.appendChild(optionRow);
  }
  
  /**
   * Save question from the editor
   */
  saveQuestionFromEditor() {
    // Get form data
    const questionText = this.editQuestionTextInput.value.trim();
    const rationale = this.editRationaleInput.value.trim();
    
    // Get options and correct index
    const options = [];
    let correctIndex = -1;
    
    const optionRows = this.editOptionsContainer.querySelectorAll('.option-row');
    optionRows.forEach((row, index) => {
      const optionText = row.querySelector('.option-text').value.trim();
      const isCorrect = row.querySelector('input[type="radio"]').checked;
      
      if (optionText) {
        options.push(optionText);
        if (isCorrect) {
          correctIndex = index;
        }
      }
    });
    
    // Validate
    if (!questionText) {
      alert('Please enter a question');
      this.editQuestionTextInput.focus();
      return;
    }
    
    if (options.length < 2) {
      alert('Please add at least 2 options');
      return;
    }
    
    if (correctIndex === -1) {
      alert('Please select a correct answer');
      return;
    }
    
    // Create question object
    const question = {
      text: questionText,
      options,
      correctIndex,
      rationale
    };
    
    // Add or update question
    if (this.currentEditingQuestionIndex !== null) {
      // Update existing question
      this.questions[this.currentEditingQuestionIndex] = question;
    } else {
      // Add new question
      this.questions.push(question);
    }
    
    // Update quiz data
    this.quizData.questions = this.questions;
    
    // Update UI
    this.updateQuestionsList();
    this.updatePreviewMeta();
    
    // Close editor
    this.closeQuestionEditor();
  }
  
  /**
   * Delete a question
   */
  deleteQuestion(index) {
    if (confirm('Are you sure you want to delete this question?')) {
      this.questions.splice(index, 1);
      this.quizData.questions = this.questions;
      this.updateQuestionsList();
      this.updatePreviewMeta();
    }
  }
  
  /**
   * Update quiz preview
   */
  updateQuizPreview() {
    if (!this.quizPreviewContainer) return;
    
    // Show empty state if no questions
    if (this.questions.length === 0) {
      this.quizPreviewContainer.innerHTML = `
        <div class="empty-preview">
          <p>Add questions to see a preview of your quiz</p>
        </div>
      `;
      return;
    }
    
    // Get quiz info
    const quizName = this.quizNameInput.value.trim() || 'Untitled Quiz';
    const quizDescription = this.quizDescriptionInput.value.trim() || 'No description provided.';
    
    // Create preview HTML
    let previewHTML = `
      <div class="quiz-preview-header">
        <h2>${quizName}</h2>
        <p>${quizDescription}</p>
        <div class="quiz-meta">
          <span>${this.questions.length} Questions</span> | 
          <span>${this.quizData.timePerQuestion}s per Question</span>
        </div>
      </div>
      <div class="quiz-preview-questions">
    `;
    
    // Add preview of first 3 questions (or all if fewer)
    const previewQuestions = this.questions.slice(0, 3);
    previewQuestions.forEach((question, index) => {
      previewHTML += `
        <div class="preview-question">
          <div class="preview-question-header">
            <span class="preview-question-number">Question ${index + 1}</span>
          </div>
          <div class="preview-question-text">${question.text}</div>
          <div class="preview-options">
      `;
      
      question.options.forEach((option, optIndex) => {
        const isCorrect = optIndex === question.correctIndex;
        previewHTML += `
          <div class="preview-option ${isCorrect ? 'correct' : ''}">
            <span class="preview-option-marker">${String.fromCharCode(65 + optIndex)}</span>
            <span class="preview-option-text">${option}</span>
          </div>
        `;
      });
      
      previewHTML += `
          </div>
        </div>
      `;
    });
    
    // Show indicator if there are more questions
    if (this.questions.length > 3) {
      previewHTML += `
        <div class="more-questions-indicator">
          <p>+ ${this.questions.length - 3} more questions</p>
        </div>
      `;
    }
    
    previewHTML += `
      </div>
    `;
    
    // Set the preview HTML
    this.quizPreviewContainer.innerHTML = previewHTML;
  }
  
  /**
   * Save the quiz
   */  async saveQuiz(status = 'draft') {
    // Get quiz data from form
    this.quizData.name = this.quizNameInput.value.trim();
    this.quizData.description = this.quizDescriptionInput.value.trim();
    this.quizData.timePerQuestion = parseInt(this.timePerQuestionInput.value) || 30;
    this.quizData.status = status;
    
    console.log(`Saving quiz with status: ${status}`);
    
    // Validate
    if (!this.quizData.name) {
      alert('Please enter a quiz name');
      this.quizNameInput.focus();
      return;
    }
    
    if (this.questions.length === 0) {
      alert('Please add at least one question');
      return;
    }
    
    try {
      // Format data for server
      const serverQuizData = {
        title: this.quizData.name,
        description: this.quizData.description || '',
        questions: this.questions.map(q => ({
          text: q.text,
          options: q.options.map((opt, index) => ({
            text: opt,
            isCorrect: index === q.correctIndex
          }))
        })),
        timePerQuestion: this.quizData.timePerQuestion,
        status: this.quizData.status
      };
        console.log('Mapped questions from:', this.questions);
      console.log('Saving quiz data to server:', serverQuizData);      // Get token
      const token = getTokenFromStorage();
      if (!token) {
        console.error('No authentication token found, redirecting to login');
        alert('Your session has expired. Please log in again.');
        // Try redirecting to login
        if (typeof showAdminLogin === 'function') {
          showAdminLogin();
        }
        throw new Error('No authentication token found');
      }
        // Determine if this is a new quiz or an update to an existing one
      const isUpdate = this.editingQuizId !== undefined && this.editingQuizId !== null;
      const url = isUpdate 
        ? `/interac/api/quiz/quizzes/${this.editingQuizId}`
        : '/interac/api/quiz/quizzes';
      const method = isUpdate ? 'PATCH' : 'POST';
      
      console.log(`${isUpdate ? 'Updating' : 'Creating'} quiz with ${method} to ${url}`);
      
      // If we're updating an existing quiz, include the ID in the data
      if (isUpdate) {
        serverQuizData.id = this.editingQuizId;
      }
      
      // Save quiz
      console.log('Saving quiz data to server with token:', token.substring(0, 10) + '...');
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify(serverQuizData)
      });
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error('Server error response:', responseText);
        throw new Error('Failed to save quiz: ' + responseText);
      }
      
      const responseData = await response.json();
      console.log('Server response after saving quiz:', responseData);      // Handle successful save
      alert(`Quiz ${status === 'published' ? 'published' : 'saved'} successfully!`);
      
      // Refresh quiz list
      console.log('Looking for loadQuizzes function:', typeof window.loadQuizzes);
      if (typeof window.loadQuizzes === 'function') {
        console.log('Calling window.loadQuizzes to refresh quiz list');
        await window.loadQuizzes();
      } else if (typeof loadQuizzes === 'function') {
        console.log('Calling loadQuizzes directly');
        await loadQuizzes();
      } else {
        console.warn('loadQuizzes function not found - quiz list may not update automatically');
      }
      
      // Close modal
      this.hideDesignerModal();
    } catch (error) {
      console.error('Error saving quiz:', error);
      alert('Error saving quiz: ' + error.message);
    }
  }
    /**
   * Open the designer with an existing quiz for editing
   * @param {Object} quiz - The quiz object to edit
   */
  openWithQuiz(quiz) {
    console.log('Opening quiz designer with existing quiz:', quiz);
    
    if (!quiz || typeof quiz !== 'object') {
      console.error('Invalid quiz object:', quiz);
      alert('Cannot edit quiz: Invalid quiz data');
      return;
    }
    
    try {
      // Store the quiz ID for later (used when saving updates)
      this.editingQuizId = quiz.id;
      
      // Reset the designer first
      this.resetDesigner();
      
      // Populate the form with quiz data
      this.quizNameInput.value = quiz.name || quiz.title || '';
      this.quizDescriptionInput.value = quiz.description || '';
      this.timePerQuestionInput.value = quiz.timePerQuestion || 30;
      
      // Set the generation method to manual since we're editing an existing quiz
      this.setGenerationMethod('manual');
      
      // Convert questions to our internal format if needed
      this.questions = [];
      if (Array.isArray(quiz.questions)) {
        quiz.questions.forEach(question => {
          // Handle different question formats
          if (question.options) {
            const options = Array.isArray(question.options) 
              ? question.options.map(opt => typeof opt === 'string' ? opt : opt.text || '')
              : [];
            
            // Find the correct option
            let correctIndex = 0;
            if (Array.isArray(question.options)) {
              correctIndex = question.options.findIndex(opt => 
                typeof opt === 'object' && opt !== null && opt.isCorrect === true
              );
              if (correctIndex === -1) correctIndex = 0;
            }
            
            this.questions.push({
              text: question.text || '',
              options: options,
              correctIndex: correctIndex,
              rationale: question.rationale || ''
            });
          }
        });
      }
      
      // Update the display
      this.updateQuestionCount();
      this.renderQuestionsEditor();
      this.renderQuizPreview();
        // Switch to the editor tab
      this.switchDesignerTab('editor');
      
      // Show the modal, but skip reset since we already populated the form
      this.showDesignerModal(true);
      
      console.log('Quiz loaded successfully into designer');
    } catch (error) {
      console.error('Error opening quiz in designer:', error);
      alert(`Error opening quiz in designer: ${error.message}`);
    }
  }
  
  /**
   * Reset the designer to its initial state
   */
  resetDesigner() {
    // Clear form fields
    this.quizNameInput.value = '';
    this.quizDescriptionInput.value = '';
    this.timePerQuestionInput.value = 30;
    
    // Reset to AI generation method by default for new quizzes
    this.setGenerationMethod('ai');
    
    // Reset AI options
    this.aiTopicInput.value = '';
    this.questionCountInput.value = 10;
    this.difficultySelect.value = 'medium';
    this.optionsPerQuestionSelect.value = 4;
    this.toneSelect.value = 'educational';
    this.specificFocusesInput.value = '';
    
    // Clear questions
    this.questions = [];
    this.updateQuestionCountDisplay();
    this.renderQuestionsEditor();
    this.renderQuizPreview();
      // Clear editing ID
    this.editingQuizId = null;
    
    // Log that the designer has been reset
    console.log('Designer has been reset');
  }
  
  /**
   * Render the questions editor (alias for updateQuestionsList)
   */
  renderQuestionsEditor() {
    this.updateQuestionsList();
  }
  
  /**
   * Render the quiz preview (alias for updateQuizPreview)
   */
  renderQuizPreview() {
    this.updateQuizPreview();
  }
  
  /**
   * Process a single generated question
   * @param {Object} question - The question object to process
   * @returns {Object|null} - The processed question or null if invalid
   */
  processGeneratedQuestion(question) {
    console.log('[QuizDesigner] Processing single generated question:', question);
    
    if (!question) {
      console.error('[QuizDesigner] Generated question is null or undefined');
      return null;
    }
    
    try {
      // Handle different question formats
      let questionText = '';
      let options = [];
      let correctIndex = 0;
      let rationale = '';
      
      // Extract question text
      if (typeof question.text === 'string') {
        questionText = question.text;
      } else if (typeof question.question === 'string') {
        questionText = question.question;
      } else if (typeof question === 'string') {
        questionText = question;
      } else {
        console.warn('[QuizDesigner] Question has no valid text property:', question);
        return null;
      }
      
      // Extract options
      if (Array.isArray(question.options) && question.options.length >= 2) {
        options = question.options.map((opt, i) => {
          if (typeof opt === 'string') return opt;
          if (opt && typeof opt === 'object' && opt.text) return opt.text;
          return String(opt || `Option ${i+1}`);
        });
      } else if (Array.isArray(question.answers) && question.answers.length >= 2) {
        options = question.answers.map((ans, i) => {
          if (typeof ans === 'string') return ans;
          if (ans && typeof ans === 'object' && ans.text) return ans.text;
          return String(ans || `Option ${i+1}`);
        });
      } else if (question.option1 && question.option2) {
        // Handle numbered option properties
        for (let i = 1; i <= 10; i++) {
          const optKey = `option${i}`;
          if (question[optKey]) options.push(question[optKey]);
          else break;
        }
      } else {
        console.warn('[QuizDesigner] Question has invalid options:', question);
        return null;
      }
      
      // Extract correct index
      if (typeof question.correctIndex === 'number') {
        correctIndex = question.correctIndex;
      } else if (typeof question.correctAnswer === 'number') {
        correctIndex = question.correctAnswer;
      } else if (typeof question.answer === 'number') {
        correctIndex = question.answer;
      } else if (question.correct !== undefined) {
        correctIndex = question.correct;
      }
      
      // Validate correctIndex
      if (typeof correctIndex !== 'number' || correctIndex < 0 || correctIndex >= options.length) {
        console.warn(`[QuizDesigner] Question has invalid correctIndex (${correctIndex}), defaulting to 0`);
        correctIndex = 0;
      }
      
      // Extract rationale
      if (typeof question.rationale === 'string') {
        rationale = question.rationale;
      } else if (typeof question.explanation === 'string') {
        rationale = question.explanation;
      } else if (typeof question.feedback === 'string') {
        rationale = question.feedback;
      } else {
        rationale = 'Explanation not provided for this question.';
      }
      
      return {
        text: questionText,
        options: options,
        correctIndex: correctIndex,
        rationale: rationale
      };
    } catch (err) {
      console.error('[QuizDesigner] Error processing question:', err);
      return null;
    }
  }
}

// Create an instance of the QuizDesigner and make it globally available
document.addEventListener('DOMContentLoaded', () => {
  console.log('Creating QuizDesigner instance');
  try {
    // Initialize the quiz designer
    window.quizDesigner = new QuizDesigner();
    console.log('QuizDesigner instance created and assigned to window.quizDesigner');
  } catch (error) {
    console.error('Error initializing QuizDesigner:', error);
  }
});

// Add console warning for quizDesigner access
const originalGetProperty = Object.getOwnPropertyDescriptor(Object.prototype, 'get');

// Helper function to check if quizDesigner has been accessed
function checkQuizDesignerAccess() {
  if (!window.quizDesigner) {
    console.warn('⚠️ window.quizDesigner is being accessed but is not defined! This may cause errors with quiz functionality.');
    console.trace('Stack trace for quizDesigner access:');
  }
  return window.quizDesigner;
}

// Set up property interceptor for quizDesigner
try {
  Object.defineProperty(window, 'quizDesigner', {
    configurable: true,
    get: function() {
      return checkQuizDesignerAccess();
    },
    set: function(value) {
      console.log('✅ quizDesigner has been initialized:', value);
      // Remove the interceptor once it's properly set
      Object.defineProperty(window, 'quizDesigner', {
        configurable: true,
        writable: true,
        value: value
      });
    }
  });
  
  console.log('Quiz designer property interceptor set up for debugging');
} catch (error) {
  console.error('Failed to set up quizDesigner property interceptor:', error);
}

// Export the QuizDesigner class
export { QuizDesigner };
