import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface PrivateRouteProps {
  children: ReactNode;
  requiredRole?: 'manager' | 'admin';
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (requiredRole && user) {
    const roleHierarchy: Record<UserRole, number> = { employee: 0, manager: 1, admin: 2 };
    if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
      return (
        <Result status="403" title="Доступ запрещён" subTitle="У вас недостаточно прав."
          extra={<Button type="primary" href="/dashboard">На главную</Button>} />
      );
    }
  }

  return <>{children}</>;
};

export default PrivateRoute;