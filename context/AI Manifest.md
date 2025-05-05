AI-MANIFEST.md
Project Overview

Project Name: Interactive Quiz Application
Purpose: Create an engaging real-time quiz platform with live participation
Target Audience: Educators, trainers, and participants seeking interactive learning experiences
Business Goals: Increase engagement, provide immediate feedback, and track learning progress
Success Metrics: User participation rates, quiz completion rates, response accuracy

Directory Structure

server-side/: All server-side code
client-side/: All client-side code
shared/: Code shared between client and server
config/: Application configuration

Key Files

server.js: Main server entry point
server-side/server-main.js: Server initialization
client-side/client-main.js: Client entry point

Implementation Plan
1. Server Core

 Basic Express setup
 Socket.io integration
 Session management

2. Authentication System

 JWT implementation
 Login/logout endpoints
 Token validation

3. Quiz Management

 Quiz data structure
 Participant tracking
 Question delivery
 Answer validation

4. Client Interface

 Login screen
 Quiz selection
 Active participation
 Results display

Development Guidelines

Use explicit file naming with domain prefixes (server-, client-, shared-)
Implement comprehensive error handling at all boundaries
Include JSDoc comments for all public methods
Write tests for critical functionality

Socket.io Event Protocol
Event NameDirectionPayloadDescriptionjoin_quizClient→Server{ quizId }Join a specific quizquiz_stateServer→Client{ status, currentQuestion, ... }Current quiz statesubmit_answerClient→Server{ quizId, questionId, answer }Submit an answeranswer_resultServer→Client{ correct, explanation, score }Answer feedback
Data Structures
Quiz
json{
  "id": "string",
  "title": "string",
  "description": "string",
  "questions": [Question],
  "timeLimit": "number (seconds)"
}
Question
json{
  "id": "string",
  "text": "string",
  "options": [{"id": "string", "text": "string"}],
  "correctOptionId": "string",
  "explanation": "string"
}
AI Collaboration Guidelines
When requesting AI assistance with this project:

Specific Components: Ask for complete implementations of specific components
Context: Provide information about how the component fits into the application
Interfaces: Clearly define the inputs, outputs, and dependencies
Error Cases: Specify how edge cases and errors should be handled

Feature Roadmap
Phase 1: Core Functionality

User authentication
Basic quiz creation
Quiz participation
Simple results display

Phase 2: Enhanced Features

Real-time participant tracking
Advanced quiz types
Detailed analytics
Customizable themes

Phase 3: Expansion


Team competition mode
Integration with learning management systems
Mobile-optimized experience
Offline support
You raise an excellent point about designing directory structures with AI agents in mind. Naming conflicts and ambiguous file locations can indeed cause confusion for AI assistants parsing code.

## AI-Friendly Directory Structure Recommendations


```
/interac/
├── server.js               # Main server entry point (instead of app.js)
├── client/                 # All client-side code
│   ├── css/
│   │   ├── main-styles.css     # Instead of style.css
│   │   └── participant-styles.css 
│   ├── js/
│   │   ├── client-main.js      # Instead of main.js
│   │   └── client-types.js     # Instead of messageTypes.js
```

### 2. Use Prefix/Suffix Conventions

Add clear prefixes or suffixes to indicate the role of each file:

```
/interac/
├── server/
│   ├── server-config.js
│   ├── server-routes.js
│   └── server-middleware.js
├── client/
│   ├── client-config.js
│   ├── client-auth.js
│   └── client-quiz.js
```

### 3. Create an AI-Specific README or Manifest

Include a special manifest file for AI tools:

```
/interac/
├── AI-MANIFEST.md          # Special file explaining codebase for AI agents
```

### 4. Use Domain-Specific Folders with Self-Contained Logic

Organize by feature domains that contain all related files:

```
/interac/
├── auth-domain/            # Authentication domain
│   ├── auth-server.js      # Server-side auth code
│   ├── auth-client.js      # Client-side auth code
│   └── auth-types.js       # Shared types
├── quiz-domain/            # Quiz domain
│   ├── quiz-server.js      # Server-side quiz code
│   ├── quiz-client.js      # Client-side quiz code
│   └── quiz-types.js       # Shared types
```

### 5. Explicit Named Directories for Server vs Client

Instead of relying on conventional names like "public", use explicit naming:

```
/interac/
├── server-side/            # Very explicit server-side code
├── client-side/            # Very explicit client-side code
└── shared/                 # Code used by both client and server
```

### Practical AI-Optimized Structure

Combining these principles, here's a practical directory structure optimized for AI agents:

```
/interac/
├── AI-MANIFEST.md          # AI-focused documentation
│
├── server-side/            # Explicitly server-side code
│   ├── server-main.js      # Main server entry point
│   ├── server-socket/      # Socket.io server implementation
│   │   ├── socket-events.js
│   │   └── socket-handlers.js
│   ├── server-api/         # REST API endpoints
│   │   ├── api-auth.js
│   │   └── api-quiz.js
│   └── server-services/    # Business logic services
│       ├── auth-service.js
│       └── quiz-service.js
│
├── client-side/            # Explicitly client-side code
│   ├── client-main.js      # Client entry point
│   ├── client-socket/      # Socket.io client implementation
│   │   └── socket-client.js
│   ├── client-components/  # UI components
│   │   ├── quiz-question.js
│   │   └── quiz-results.js
│   ├── client-styles/      # CSS styles
│   │   └── client-styles.css
│   └── client-utils/       # Client utilities
│       └── client-helpers.js
│
├── shared/                 # Shared between client and server
│   ├── shared-constants.js # Constants used everywhere
│   ├── shared-types.js     # Type definitions
│   └── shared-utils.js     # Shared utility functions
│
├── config/                 # Configuration
│   └── app-config.js
│
└── server.js               # Application entry point
```

This structure:

1. Uses explicit naming conventions with `server-`, `client-`, and `shared-` prefixes
2. Avoids duplicate file names entirely
3. Groups code by both function and domain
4. Makes it very clear which code runs where

With this structure, an AI agent can more confidently understand:
- Which files belong to which part of the application
- Where to find specific functionality
- How to modify code without introducing conflicts
]