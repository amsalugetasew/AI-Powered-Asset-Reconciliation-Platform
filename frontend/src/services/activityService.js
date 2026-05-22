import axios from 'axios';

export const logActivity = async (pageVisited, actionPerformed) => {
    try {
        const token = localStorage.getItem('token');
        // Only log if the user is logged in
        if (!token) return;
        
        await axios.post('/api/activity/log', {
            page_visited: pageVisited,
            action_performed: actionPerformed
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
};
