import React from 'react';
import { Outlet } from 'react-router-dom';
import MainLayout from '@/components/MainLayout';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';

const LayoutWrapper = () => {
    const { user, companies, users, onDataUpdate, userModules } = useUser();
    const { signOut } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <MainLayout 
            user={user}
            onLogout={handleLogout}
            userModules={userModules}
            companies={companies}
            allUsers={users}
            onDataUpdate={onDataUpdate}
        >
            <Outlet context={{ user, companies, users, onDataUpdate, userModules }} />
        </MainLayout>
    );
};

export default LayoutWrapper;