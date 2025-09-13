#!/usr/bin/env node

/**
 * NEON DATABASE MULTI-USER ISOLATION TEST
 * Tests the security requirements specified in the protocol:
 * - Create 2 users → each sees only their own data
 * - Upload a document with user A → user B cannot view it
 * - User A deletes a file → only their data is affected
 * - Inspect DB manually → all rows correctly scoped to unique user_id
 * - URL manipulation or dev tools → cannot leak other user's content
 */

const API_BASE = 'http://localhost:5000/api';

// Test credentials
const userA = { username: 'testuser_a', password: 'password123' };
const userB = { username: 'testuser_b', password: 'password123' };

async function makeRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  return response.json();
}

async function registerUser(userData) {
  try {
    return await makeRequest('/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  } catch (error) {
    if (error.message.includes('User already exists')) {
      console.log(`User ${userData.username} already exists, logging in...`);
      return await makeRequest('/login', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
    }
    throw error;
  }
}

async function loginUser(userData) {
  return await makeRequest('/login', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

async function createAssignment(inputText) {
  return await makeRequest('/process-text', {
    method: 'POST',
    body: JSON.stringify({
      inputText,
      llmProvider: 'deepseek',
      inputType: 'text'
    })
  });
}

async function getAssignments() {
  return await makeRequest('/assignments');
}

async function getAssignment(id) {
  return await makeRequest(`/assignments/${id}`);
}

async function deleteAssignment(id) {
  return await makeRequest(`/assignments/${id}`, {
    method: 'DELETE'
  });
}

async function logout() {
  return await makeRequest('/logout', {
    method: 'POST'
  });
}

async function runTests() {
  console.log('🧪 NEON DATABASE MULTI-USER ISOLATION TEST');
  console.log('===========================================');
  
  try {
    // Test 1: Create 2 users
    console.log('\n1. Creating and registering users...');
    const userASession = await registerUser(userA);
    console.log(`✓ User A registered: ${userASession.user.username}`);
    
    await logout();
    
    const userBSession = await registerUser(userB);
    console.log(`✓ User B registered: ${userBSession.user.username}`);
    
    // Test 2: User A creates assignments
    console.log('\n2. User A creating assignments...');
    await logout();
    await loginUser(userA);
    
    const assignmentA1 = await createAssignment('Test assignment from User A #1');
    console.log(`✓ User A created assignment: ${assignmentA1.id}`);
    
    const assignmentA2 = await createAssignment('Test assignment from User A #2');
    console.log(`✓ User A created assignment: ${assignmentA2.id}`);
    
    // Test 3: User B creates assignments
    console.log('\n3. User B creating assignments...');
    await logout();
    await loginUser(userB);
    
    const assignmentB1 = await createAssignment('Test assignment from User B #1');
    console.log(`✓ User B created assignment: ${assignmentB1.id}`);
    
    // Test 4: User isolation - each user sees only their own data
    console.log('\n4. Testing user isolation...');
    
    // User B should only see their own assignments
    const userBAssignments = await getAssignments();
    console.log(`✓ User B sees ${userBAssignments.length} assignments`);
    
    if (userBAssignments.length !== 1) {
      throw new Error(`❌ SECURITY VIOLATION: User B should see 1 assignment but sees ${userBAssignments.length}`);
    }
    
    if (userBAssignments[0].id !== assignmentB1.id) {
      throw new Error(`❌ SECURITY VIOLATION: User B sees wrong assignment`);
    }
    
    // Test 5: User A should not be able to access User B's assignments
    console.log('\n5. Testing cross-user access prevention...');
    await logout();
    await loginUser(userA);
    
    const userAAssignments = await getAssignments();
    console.log(`✓ User A sees ${userAAssignments.length} assignments`);
    
    if (userAAssignments.length !== 2) {
      throw new Error(`❌ SECURITY VIOLATION: User A should see 2 assignments but sees ${userAAssignments.length}`);
    }
    
    // Test 6: Direct URL manipulation - User A tries to access User B's assignment
    console.log('\n6. Testing URL manipulation protection...');
    try {
      await getAssignment(assignmentB1.id);
      throw new Error(`❌ SECURITY VIOLATION: User A was able to access User B's assignment via URL`);
    } catch (error) {
      if (error.message.includes('Assignment not found')) {
        console.log('✓ URL manipulation blocked - User A cannot access User B\'s assignment');
      } else {
        throw error;
      }
    }
    
    // Test 7: User A deletes their own assignment
    console.log('\n7. Testing assignment deletion with user isolation...');
    await deleteAssignment(assignmentA1.id);
    console.log(`✓ User A deleted assignment ${assignmentA1.id}`);
    
    const userAAssignmentsAfterDelete = await getAssignments();
    if (userAAssignmentsAfterDelete.length !== 1) {
      throw new Error(`❌ User A should have 1 assignment after deletion but has ${userAAssignmentsAfterDelete.length}`);
    }
    
    // Test 8: Verify User B's data unaffected
    console.log('\n8. Verifying User B\'s data unaffected...');
    await logout();
    await loginUser(userB);
    
    const userBAssignmentsAfterADelete = await getAssignments();
    if (userBAssignmentsAfterADelete.length !== 1) {
      throw new Error(`❌ User B's data was affected by User A's deletion`);
    }
    
    console.log('✓ User B\'s data remains intact');
    
    // Test 9: User B cannot delete User A's assignments
    console.log('\n9. Testing cross-user deletion prevention...');
    try {
      await deleteAssignment(assignmentA2.id);
      throw new Error(`❌ SECURITY VIOLATION: User B was able to delete User A's assignment`);
    } catch (error) {
      if (error.message.includes('Failed to delete assignment')) {
        console.log('✓ Cross-user deletion blocked');
      } else {
        throw error;
      }
    }
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Multi-user isolation is working correctly');
    console.log('✅ Users can only see their own data');
    console.log('✅ Cross-user access is prevented');
    console.log('✅ URL manipulation is blocked');
    console.log('✅ Data integrity is maintained');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This test requires Node.js 18+ with fetch support');
  process.exit(1);
}

runTests();