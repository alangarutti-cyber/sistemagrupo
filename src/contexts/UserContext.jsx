import React, { createContext, useContext, useMemo } from 'react';

const UserContext = createContext(null);

export const UserProvider = ({ children, value }) => {
  const enhancedValue = useMemo(() => {
    if (!value || !value.user) {
      return value;
    }

    // Enhance user to have access to all modules and companies
    const adminLikeUser = {
      ...value.user,
      is_admin: true, // Treat user as admin for access purposes
    };

    const adminLikeValue = {
      ...value,
      user: adminLikeUser,
      userModules: (value.allModules || []).map(m => ({
        user_id: value.user.id,
        module_id: m.id,
        allowed: true, // Allow all modules
      })),
    };

    return adminLikeValue;
  }, [value]);

  return (
    <UserContext.Provider value={enhancedValue}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === null) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};