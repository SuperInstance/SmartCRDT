/**
 * Sample code for testing the code assistant
 */

const API_URL = 'https://api.example.com';

// Function with missing error handling
async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}

// Function with too many parameters
function createUser(name, email, age, country, phone, role) {
  console.log('Creating user:', name);
  // TODO: Implement
}

// Unused variable
const unusedVar = 42;

// Magic numbers
function calculateLimit(value) {
  return value * 1.5 + 100;
}

// Hardcoded secret
const API_KEY = "sk-1234567890abcdef";

// Console statement
function logData(data) {
  console.log('Data:', data);
}

module.exports = { fetchData, createUser, calculateLimit, logData };
