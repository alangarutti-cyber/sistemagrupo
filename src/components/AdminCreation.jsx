import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { UserPlus, Lock, User, Mail, Loader2 } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { toast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';

    const AdminCreation = ({ onAdminCreated }) => {
      const [name, setName] = useState('Super Admin');
      const [email, setEmail] = useState('admin@stout.com');
      const [password, setPassword] = useState('stout@2024');
      const [loading, setLoading] = useState(false);
      const { signUp } = useAuth();
      const [isReady, setIsReady] = useState(false);

      useEffect(() => {
        // This ensures the page is fully rendered before we consider it ready
        setIsReady(true);
      }, []);

      const handleCreateAdmin = async () => {
        if (!isReady) {
          toast({ title: "Aguarde", description: "A página ainda está carregando.", variant: "destructive" });
          return;
        }
        if (!name || !email || !password) {
          toast({
            title: "⚠️ Campos obrigatórios",
            description: "Por favor, preencha todos os campos.",
            variant: "destructive"
          });
          return;
        }
        if (password.length < 6) {
          toast({
            title: "🔒 Senha fraca",
            description: "A senha deve ter pelo menos 6 caracteres.",
            variant: "destructive"
          });
          return;
        }

        setLoading(true);

        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

        if (authError) {
          setLoading(false);
          toast({
            title: "❌ Erro ao registrar",
            description: authError.message,
            variant: "destructive"
          });
          return;
        }

        if (authData.user) {
          const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          const { data: appUserData, error: appUserError } = await supabase
            .from('app_users')
            .insert({
              name,
              email,
              username,
              password: 'encrypted_by_auth',
              is_admin: true,
              role: 'Super Administrador',
              permissions: {},
              uuid: authData.user.id,
            })
            .select()
            .single();

          if (appUserError) {
            toast({
              title: "❌ Erro ao criar perfil",
              description: appUserError.message,
              variant: "destructive"
            });
          } else {
            toast({
              title: "🎉 Administrador Criado!",
              description: "O usuário principal foi configurado com sucesso.",
            });
            onAdminCreated(appUserData);
          }
        }
        
        setLoading(false);
      };

      return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <div className="glass-effect rounded-2xl p-6 sm:p-8 shadow-2xl">
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full gradient-primary mb-3 sm:mb-4">
                  <UserPlus className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1 sm:mb-2">
                  Criar Administrador
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                  Este será o usuário principal do sistema.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    E-mail de Acesso
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Lock className="w-4 h-4 inline mr-2" />
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 sm:py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <Button
                  onClick={handleCreateAdmin}
                  disabled={loading}
                  className="w-full gradient-primary text-white py-3 sm:py-4 text-base sm:text-lg hover:opacity-90 transition-opacity"
                >
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : 'Criar Administrador'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      );
    };

    export default AdminCreation;