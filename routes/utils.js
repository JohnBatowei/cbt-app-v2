// utils.js

/**
 * Shuffle an array using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} - A new array with the shuffled elements.
 */
function shuffleArray(array) {
    const shuffledArray = [...array]; // Create a copy of the array
    for (let i = shuffledArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]]; // Swap elements
    }
    return shuffledArray;
  }
  
  
  
  // Export the utility functions
  module.exports = { shuffleArray };
  