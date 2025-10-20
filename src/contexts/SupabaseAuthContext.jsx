import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [authUser, setAuthUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(null);

  const checkSupabaseConnection = useCallback(async () => {
    try {
      const { error } = await supabase.from('companies').select('id').limit(1);
      if (error && error.code === 'PGRST001') {
        setIsSupabaseConnected(true);
        return true;
      }
      setIsSupabaseConnected(!error);
      return !error;
    } catch (e) {
      setIsSupabaseConnected(false);
      return false;
    }
  }, []);

  const syncUser = useCallback(async (user) => {
    if (!user) return;

    const { data: appUser, error } = await supabase
      .from('app_users')
      .select('id')
      .eq('uuid', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      toast({
        variant: "destructive",
        title: "Erro ao Sincronizar Usuário",
        description: error.message,
      });
      return;
    }

    if (!appUser) {
      const { error: insertError } = await supabase.from('app_users').insert({
        uuid: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email.split('@')[0],
        username: user.email,
        password: 'not_managed_here', 
        is_admin: false,
      });

      if (insertError) {
        toast({
          variant: "destructive",
          title: "Erro ao Criar Perfil de Usuário",
          description: insertError.message,
        });
      } else {
        toast({
          title: "Perfil Criado!",
          description: "Seu perfil de usuário foi criado no sistema.",
        });
      }
    }
  }, [toast]);


  const handleSession = useCallback(async (currentSession) => {
    setSession(currentSession);
    const currentUser = currentSession?.user ?? null;
    setAuthUser(currentUser);
    
    if (currentUser) {
      await syncUser(currentUser);
    }
    
    setLoading(false);
  }, [syncUser]);
  
  useEffect(() => {
    checkSupabaseConnection();

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      handleSession(session);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        handleSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession, checkSupabaseConnection]);

  const signUp = useCallback(async (email, password, options) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign in Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error };
  }, [toast]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign out Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error };
  }, [toast]);

  const value = useMemo(() => ({
    authUser,
    session,
    loading,
    isSupabaseConnected,
    signUp,
    signIn,
    signOut,
  }), [authUser, session, loading, isSupabaseConnected, signUp, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};