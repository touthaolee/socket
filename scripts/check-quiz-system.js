// This file can be used to check the quiz system status

const fs = require('fs');
const path = require('path');

console.log('Quiz Management System Status Check');
console.log('==================================');

// Check if quizzes.json exists
const quizzesPath = path.join(__dirname, 'data/quizzes.json');
console.log(`Checking quizzes file at: ${quizzesPath}`);

let quizData;
let quizCount = 0;
let hasValidStructure = false;

try {
  if (fs.existsSync(quizzesPath)) {
    console.log('✅ quizzes.json file exists');
    
    // Try to read the file
    try {
      const fileContent = fs.readFileSync(quizzesPath, 'utf8');
      console.log(`✅ File readable (${fileContent.length} bytes)`);
      
      // Try to parse JSON
      try {
        quizData = JSON.parse(fileContent);
        console.log('✅ File contains valid JSON');
        
        // Check structure
        if (quizData && typeof quizData === 'object') {
          if (Array.isArray(quizData.quizzes)) {
            hasValidStructure = true;
            quizCount = quizData.quizzes.length;
            console.log(`✅ File has valid structure with ${quizCount} quizzes`);
          } else {
            console.log('❌ Missing or invalid quizzes array');
          }
        } else {
          console.log('❌ Invalid data structure, expected an object');
        }
      } catch (parseError) {
        console.log('❌ Failed to parse JSON: ' + parseError.message);
      }
    } catch (readError) {
      console.log('❌ Could not read file: ' + readError.message);
    }
  } else {
    console.log('❌ quizzes.json file not found');
  }
} catch (error) {
  console.log('❌ Error checking file: ' + error.message);
}

// Summary
console.log('\nSummary:');
console.log('---------');
console.log(`Quiz File: ${fs.existsSync(quizzesPath) ? 'Exists' : 'Missing'}`);
console.log(`Valid JSON: ${quizData ? 'Yes' : 'No'}`);
console.log(`Valid Structure: ${hasValidStructure ? 'Yes' : 'No'}`);
console.log(`Quiz Count: ${quizCount}`);

if (quizCount > 0 && hasValidStructure) {
  console.log('\nFound Quizzes:');
  console.log('-------------');
  quizData.quizzes.forEach((quiz, index) => {
    console.log(`${index + 1}. "${quiz.name || quiz.title}" - ${quiz.status || 'draft'} - ${quiz.questions?.length || 0} questions`);
  });
  
  console.log('\nEverything appears to be working correctly!');
  console.log('You should see quizzes in the admin UI.');
} else {
  console.log('\nIssues detected. Try running:');
  console.log('node scripts/create-sample-quizzes.js');
  console.log('to create sample quizzes.');
}
