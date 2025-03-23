import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Get the Python API URL from environment variable with a fallback
// Since both services are on the same machine, localhost works best
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5001';
console.log('Using Python API URL:', PYTHON_API_URL);

// Function to find potential matches by making requests to the Python matching service
export async function findPotentialMatches(description, type) {
    if (!description || typeof description !== 'string') {
        console.error('Invalid description provided to findPotentialMatches');
        return { 
            similarity_score: 0, 
            error: 'Invalid description provided'
        };
    }

    try {
        // Send request to matching service with a timeout
        console.log(`Sending match request to ${PYTHON_API_URL}/match`);
        const response = await axios.post(`${PYTHON_API_URL}/match`, {
            lost_desc: type === 'lost' ? description : '',
            found_desc: type === 'found' ? description : ''
        }, {
            timeout: 5000 // 5 second timeout
        });

        // Return the response data or an empty array if data is invalid
        if (response.data && typeof response.data === 'object') {
            console.log('Received match response:', response.data);
            return response.data;
        } else {
            console.error('Invalid response from matching service:', response.data);
            return { similarity_score: 0 };
        }
    } catch (error) {
        // Provide more detailed error logging
        if (error.response) {
            // The request was made and the server responded with a status code outside the 2xx range
            console.error('Error from matching service:', error.response.status, error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from matching service:', error.request);
        } else {
            // Something happened in setting up the request
            console.error('Error setting up request to matching service:', error.message);
        }
        
        // Return a structured error response
        return { 
            similarity_score: 0, 
            error: error.message || 'Failed to connect to matching service'
        };
    }
}