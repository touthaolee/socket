/**
 * Shared constants between client and server
 */
const EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // Authentication events
  AUTH_SUCCESS: 'auth:success',
  AUTH_ERROR: 'auth:error',
  
  // Quiz events
  JOIN_QUIZ: 'join_quiz',
  QUIZ_STATE: 'quiz_state',
  SUBMIT_ANSWER: 'submit_answer',
  ANSWER_RESULT: 'answer_result',
  QUIZ_END: 'quiz_end',
  
  // Admin events
  START_QUIZ: 'admin:start_quiz',
  END_QUIZ: 'admin:end_quiz',
  NEXT_QUESTION: 'admin:next_question'
};

// Error codes
const ERROR_CODES = {
  INVALID_AUTH: 'auth/invalid',
  SESSION_EXPIRED: 'auth/expired',
  PERMISSION_DENIED: 'auth/permission-denied',
  QUIZ_NOT_FOUND: 'quiz/not-found',
  QUIZ_ALREADY_STARTED: 'quiz/already-started',
  QUIZ_NOT_STARTED: 'quiz/not-started',
  ANSWER_INVALID: 'quiz/invalid-answer',
  ANSWER_DUPLICATE: 'quiz/duplicate-answer'
};

module.exports = {
  EVENTS,
  ERROR_CODES
};