import axios from 'axios';

// Function to find potential matches by making requests to the Python matching service
export async function findPotentialMatches(description, type) {
    try {
        const response = await axios.post('http://192.168.18.18:5000/match', {
            lost_desc: type === 'lost' ? description : '',
            found_desc: type === 'found' ? description : ''
        });

        return response.data;
    } catch (error) {
        console.error('Error calling matching service:', error);
        return [];
    }
}