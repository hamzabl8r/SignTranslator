import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

const ProtectedRoute = () => {
    const { token, user } = useSelector((state) => state.user);
    const location = useLocation();
    
    
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    const mustCompleteGoogleProfile =
      user?.isGoogleAccount && !user?.profileCompleted;

    if (mustCompleteGoogleProfile && location.pathname !== '/profil') {
      return <Navigate to="/profil" replace />;
    }
    
    return <Outlet />;
};

export default ProtectedRoute;
