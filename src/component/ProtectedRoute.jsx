import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import SeoHelmet from './SeoHelmet';

const ProtectedRoute = () => {
    const { token, user } = useSelector((state) => state.user);
    const location = useLocation();
    
    
    if (!token) {
        return (
          <>
            <SeoHelmet title="Login Required - MediSign" />
            <Navigate to="/login" replace />
          </>
        );
    }

    const mustCompleteGoogleProfile =
      user?.isGoogleAccount && !user?.profileCompleted;

    if (mustCompleteGoogleProfile && location.pathname !== '/profil') {
      return (
        <>
          <SeoHelmet title="Complete Profile - MediSign" />
          <Navigate to="/profil" replace />
        </>
      );
    }
    
    return (
      <>
        <SeoHelmet title="Protected Route - MediSign" />
        <Outlet />
      </>
    );
};

export default ProtectedRoute;
