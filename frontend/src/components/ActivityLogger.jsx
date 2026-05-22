import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../services/activityService';

const ActivityLogger = () => {
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            logActivity(location.pathname, 'PAGE_VISIT');
        }
    }, [location.pathname, isAuthenticated]);

    return null; // This component doesn't render anything
};

export default ActivityLogger;
