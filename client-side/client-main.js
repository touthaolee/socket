/**
 * Client-side main entry point
 */
document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const loginView = document.getElementById('login-view');
  const quizSelectionView = document.getElementById('quiz-selection-view');
  const activeQuizView = document.getElementById('active-quiz-view');
  const resultsView = document.getElementById('results-view');
  const loginForm = document.getElementById('login-form');
  const quizList = document.getElementById('quiz-list');
  
  // Mock quiz data
  const quizzes = [
    {
      id: 'quiz1',
      title: 'JavaScript Fundamentals',
      description: 'Test your knowledge of JavaScript basics',
      timeLimit: 30,
      questionCount: 10
    },
    {
      id: 'quiz2',
      title: 'HTML and CSS',
      description: 'Test your knowledge of web design',
      timeLimit: 25,
      questionCount: 8
    },
    {
      id: 'quiz3',
      title: 'Node.js Basics',
      description: 'Learn about server-side JavaScript',
      timeLimit: 40,
      questionCount: 12
    }
  ];
  
  // Render quiz list
  function renderQuizList() {
    quizList.innerHTML = '';
    
    quizzes.forEach(quiz => {
      const quizCard = document.createElement('div');
      quizCard.className = 'quiz-card';
      quizCard.dataset.quizId = quiz.id;
      
      quizCard.innerHTML = 
        '<h3>' + quiz.title + '</h3>' +
        '<p>' + quiz.description + '</p>' +
        '<div class="quiz-meta">' +
          '<span class="quiz-time">Time: ' + quiz.timeLimit + ' sec</span>' +
          '<span class="quiz-questions">Questions: ' + quiz.questionCount + '</span>' +
        '</div>';
      
      quizCard.addEventListener('click', () => {
        console.log('Quiz selected:', quiz.id);
        // Here you would initialize the quiz
      });
      
      quizList.appendChild(quizCard);
    });
  }
  
  // Event Listeners
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    // Mock login
    loginView.classList.add('hidden');
    quizSelectionView.classList.remove('hidden');
    renderQuizList();
  });
  
  // Initialize
  console.log('Interactive Quiz Application initialized');
});