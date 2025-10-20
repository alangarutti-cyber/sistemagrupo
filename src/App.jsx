
import React, { useState, useEffect, useCallback } from "react";
    import { HashRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
    import { Helmet } from "react-helmet";
    import { Toaster } from "@/components/ui/toaster";
    import { toast } from "@/components/ui/use-toast";
    import LoginScreen from "@/components/LoginScreen";
    import MainLayout from "@/components/MainLayout";
    import InitialSetup from "@/components/InitialSetup";
    import { supabase } from "@/lib/customSupabaseClient";
    import { AuthProvider, useAuth } from "@/contexts/SupabaseAuthContext";
    import AdminCreation from "@/components/AdminCreation";
    import { Button } from "@/components/ui/button";
    import { UserProvider, useUser } from "@/contexts/UserContext";

    // Importa todos os componentes de módulo
    import Dashboard from '@/components/modules/Dashboard';
    import DRE from '@/components/modules/DRE';
    import Estoque from '@/components/modules/Estoque';
    import Caixa from '@/components/modules/Caixa';
    import Financeiro from '@/components/modules/Financeiro';
    import Fornecedores from '@/components/modules/Fornecedores';
    import Funcionarios from '@/components/modules/Funcionarios';
    import Empresas from '@/components/modules/Empresas';
    import Conferencia from '@/components/modules/Conferencia';
    import MaquinasCartao from '@/components/modules/MaquinasCartao';
    import Lancamentos from '@/components/modules/Lancamentos';
    import LancamentoRapido from '@/components/modules/LancamentoRapido';
    import Pedidos from '@/components/modules/Pedidos';
    import Bancos from '@/components/modules/Bancos';
    import SaudeFinanceira from '@/components/modules/SaudeFinanceira';
    import SaudeFinanceiraAvancada from '@/components/modules/SaudeFinanceiraAvancada';
    import SaudeFinanceiraRapida from '@/components/modules/SaudeFinanceiraRapida';
    import Cobrancas from '@/components/modules/Cobrancas';
    import PDV from '@/components/modules/PDV';
    import NotasFiscais from '@/components/modules/NotasFiscais';
    import Checklists from '@/components/modules/Checklists';
    import Relatorios from '@/components/modules/Relatorios';
    import PagamentoSemanal from '@/components/modules/PagamentoSemanal';
    import RespostasAvaliacoes from '@/components/modules/RespostasAvaliacoes';
    import UnidadesMedida from '@/components/modules/cadastros/UnidadesMedida';
    import Configuracoes from '@/components/modules/Configuracoes';
    import DesempenhoDiario from '@/components/modules/DesempenhoDiario';
    import PainelExecutivo from '@/components/modules/PainelExecutivo';
    import ProjecaoSemanal from '@/components/modules/ProjecaoSemanal';
    import RelatorioBotWhatsapp from '@/components/modules/RelatorioBotWhatsapp';
    import RelatorioConsolidado from '@/components/modules/RelatorioConsolidado';
    import RelatorioMensal from '@/components/modules/RelatorioMensal';
    import Cadastros from '@/components/modules/Cadastros';
    import MetasProjecoe from '@/components/modules/MetasProjecoe';
    import SuperNota from '@/components/modules/SuperNota';
    import SystemLogs from '@/components/modules/SystemLogs';
    import Etiquetas from '@/components/modules/Etiquetas';
    import EtiquetasCozinha from '@/components/modules/EtiquetasCozinha';
    import RaioXFinanceiro from '@/components/modules/RaioXFinanceiro';
    import LocaisImpressao from '@/components/modules/cadastros/LocaisImpressao';
    import FormasPagamento from '@/components/modules/cadastros/FormasPagamento';

    const AppContent = () => {
      const { session, loading: authLoading, isSupabaseConnected } = useAuth();
      const [initialState, setInitialState] = useState({
        isSetupComplete: null,
        hasAdmin: null,
        loading: true,
      });
      const [fetchTrigger, setFetchTrigger] = useState(0);

      useEffect(() => {
        document.documentElement.classList.remove("dark");
      }, []);

      useEffect(() => {
        const checkInitialState = async () => {
          if (!isSupabaseConnected) {
            setInitialState({ isSetupComplete: false, hasAdmin: false, loading: false });
            return;
          }
          setInitialState(prev => ({ ...prev, loading: true }));
          try {
            const { count: companiesCount, error: companiesError } = await supabase.from("companies").select("*", { count: "exact", head: true });
            if (companiesError) {
              if (companiesError.code === "PGRST001" || (companiesError.message.includes("relation") && companiesError.message.includes("does not exist"))) {
                setInitialState({ isSetupComplete: false, hasAdmin: false, loading: false });
                return;
              }
              throw companiesError;
            }

            const setupDone = companiesCount > 0;
            if (!setupDone) {
              setInitialState({ isSetupComplete: false, hasAdmin: false, loading: false });
              return;
            }

            const { count: adminCount, error: adminError } = await supabase.from("app_users").select("*", { count: "exact", head: true }).eq("is_admin", true);
            if (adminError) throw adminError;
            
            setInitialState({ isSetupComplete: true, hasAdmin: adminCount > 0, loading: false });
          } catch (error) {
            console.error("Error during initial state check:", error);
            toast({ title: "Erro ao verificar estado inicial", description: error.message, variant: "destructive" });
            setInitialState({ isSetupComplete: false, hasAdmin: false, loading: false });
          }
        };
        
        if (isSupabaseConnected !== null) {
          checkInitialState();
        }
      }, [isSupabaseConnected, fetchTrigger]);

      const handleSetupComplete = async (companiesToInsert) => {
        if (!isSupabaseConnected) {
          toast({ title: "Erro de Conexão", variant: "destructive" });
          return;
        }
        const { error } = await supabase.from("companies").insert(companiesToInsert);
        if (error) {
          toast({ title: "Erro ao salvar empresas", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Sucesso!", description: "Empresas cadastradas." });
          setFetchTrigger(t => t + 1);
        }
      };

      const handleAdminCreated = () => setFetchTrigger(t => t + 1);

      if (authLoading || initialState.loading || isSupabaseConnected === null) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-xl font-semibold text-foreground">Carregando Sistema...</div>
          </div>
        );
      }

      if (session) {
        return <Outlet />;
      }

      if (isSupabaseConnected && !initialState.isSetupComplete) {
        return (
          <>
            <Helmet><title>Stout System | Configuração Inicial</title></Helmet>
            <InitialSetup onComplete={handleSetupComplete} />
          </>
        );
      }
      
      if (isSupabaseConnected && initialState.isSetupComplete && !initialState.hasAdmin) {
        return (
          <>
            <Helmet><title>Stout System | Criar Administrador</title></Helmet>
            <AdminCreation onAdminCreated={handleAdminCreated} />
          </>
        );
      }

      return <Navigate to="/login" replace />;
    };

    const UserDataLoader = ({ children }) => {
        const { authUser, session, signOut } = useAuth();
        const [userData, setUserData] = useState({
            user: null,
            companies: [],
            users: [],
            userCompanyAccess: [],
            userModules: [],
            allModules: [],
            loading: true,
        });
        const [fetchTrigger, setFetchTrigger] = useState(0);

        const fetchData = useCallback(async (currentAuthUser) => {
            setUserData(prev => ({...prev, loading: true}));
            try {
                const { data: appUsers, error: appUserError } = await supabase
                    .from("app_users")
                    .select("*, company_ids:user_company_access(company_id)")
                    .eq("uuid", currentAuthUser.id)
                    .single();

                if (appUserError && appUserError.code !== 'PGRST116') throw appUserError;
                
                const userToSet = appUsers;

                if (userToSet) {
                    const [
                        { data: allCompanies },
                        { data: allUsers },
                        { data: allUserCompanyAccess },
                        { data: allUserModules },
                        { data: modulesData },
                    ] = await Promise.all([
                        supabase.from("companies").select("*"),
                        supabase.from("app_users").select("*, company_ids:user_company_access(company_id)"),
                        supabase.from("user_company_access").select("*"),
                        supabase.from("user_modules").select("*"),
                        supabase.from("modules").select("*"),
                    ]);

                    setUserData({
                        user: userToSet,
                        companies: allCompanies || [],
                        users: allUsers || [],
                        userCompanyAccess: allUserCompanyAccess || [],
                        userModules: allUserModules || [],
                        allModules: modulesData || [],
                        loading: false,
                    });
                } else {
                    setUserData(prev => ({...prev, user: null, loading: false}));
                }
            } catch (error) {
                console.error("Error loading user data:", error);
                toast({ title: "Erro ao carregar dados do usuário", description: error.message, variant: "destructive" });
                setUserData(prev => ({...prev, loading: false}));
            }
        }, []);

        useEffect(() => {
            if (authUser) {
                fetchData(authUser);
            } else {
                setUserData({
                    user: null,
                    companies: [],
                    users: [],
                    userCompanyAccess: [],
                    userModules: [],
                    allModules: [],
                    loading: false,
                });
            }
        }, [authUser, fetchTrigger, fetchData]);

        if (userData.loading) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="text-xl font-semibold text-foreground">Carregando Dados...</div>
                </div>
            );
        }
        
        if (!userData.user && session) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
                    <div>
                        <h2 className="text-2xl font-bold text-destructive">Usuário não encontrado</h2>
                        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">O usuário logado foi autenticado, mas seu perfil não foi encontrado no sistema. Por favor, <span className="font-semibold text-primary">saia e tente novamente</span> para que o sistema possa criar ou sincronizar seu perfil.</p>
                        <Button onClick={async () => await signOut()} className="mt-6 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg">Sair</Button>
                    </div>
                </div>
            );
        }
        
        const userContextValue = {
            ...userData,
            onDataUpdate: () => setFetchTrigger((t) => t + 1),
        };

        return <UserProvider value={userContextValue}>{children}</UserProvider>;
    };

    const ModuleWrapper = ({ component: Component, ...props }) => {
      const userContext = useUser();
      if (!userContext.user) {
        return null;
      }
      return <Component {...userContext} {...props} />;
    };


    function App() {
      return (
        <Router>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={
                <>
                  <Helmet><title>Stout System | Login</title></Helmet>
                  <LoginScreen />
                </>
              } />
              <Route element={<AppContent />}>
                <Route path="/" element={
                  <UserDataLoader>
                    <MainLayout />
                  </UserDataLoader>
                }>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<ModuleWrapper component={Dashboard} />} />
                  <Route path="saude-financeira" element={<ModuleWrapper component={SaudeFinanceira} />} />
                  <Route path="saude-financeira-avancada" element={<ModuleWrapper component={SaudeFinanceiraAvancada} />} />
                  <Route path="saude-financeira-rapida" element={<ModuleWrapper component={SaudeFinanceiraRapida} />} />
                  <Route path="lancamentos" element={<ModuleWrapper component={Lancamentos} />} />
                  <Route path="lancamento-rapido" element={<ModuleWrapper component={LancamentoRapido} />} />
                  <Route path="pedidos" element={<ModuleWrapper component={Pedidos} />} />
                  <Route path="dre" element={<ModuleWrapper component={DRE} />} />
                  <Route path="estoque" element={<ModuleWrapper component={Estoque} />} />
                  <Route path="caixa" element={<ModuleWrapper component={Caixa} />} />
                  <Route path="financeiro" element={<ModuleWrapper component={Financeiro} />} />
                  <Route path="cobrancas" element={<ModuleWrapper component={Cobrancas} />} />
                  <Route path="bancos" element={<ModuleWrapper component={Bancos} />} />
                  <Route path="fornecedores" element={<ModuleWrapper component={Fornecedores} />} />
                  <Route path="funcionarios" element={<ModuleWrapper component={Funcionarios} />} />
                  <Route path="maquinas-cartao" element={<ModuleWrapper component={MaquinasCartao} />} />
                  <Route path="empresas" element={<ModuleWrapper component={Empresas} />} />
                  <Route path="conferencia" element={<ModuleWrapper component={Conferencia} />} />
                  <Route path="raio-x-financeiro" element={<ModuleWrapper component={RaioXFinanceiro} />} />
                  <Route path="pdv" element={<ModuleWrapper component={PDV} />} />
                  <Route path="notas-fiscais" element={<ModuleWrapper component={NotasFiscais} />} />
                  <Route path="checklists" element={<ModuleWrapper component={Checklists} />} />
                  <Route path="relatorios" element={<ModuleWrapper component={Relatorios} />} />
                  <Route path="pagamento-semanal" element={<ModuleWrapper component={PagamentoSemanal} />} />
                  <Route path="respostas-avaliacoes" element={<ModuleWrapper component={RespostasAvaliacoes} />} />
                  <Route path="unidades-medida" element={<ModuleWrapper component={UnidadesMedida} />} />
                  <Route path="locais-impressao" element={<ModuleWrapper component={LocaisImpressao} />} />
                  <Route path="configuracoes" element={<ModuleWrapper component={Configuracoes} />} />
                  <Route path="desempenho-diario" element={<ModuleWrapper component={DesempenhoDiario} />} />
                  <Route path="painel-executivo" element={<ModuleWrapper component={PainelExecutivo} />} />
                  <Route path="projecao-semanal" element={<ModuleWrapper component={ProjecaoSemanal} />} />
                  <Route path="relatorio-bot-whatsapp" element={<ModuleWrapper component={RelatorioBotWhatsapp} />} />
                  <Route path="relatorio-consolidado" element={<ModuleWrapper component={RelatorioConsolidado} />} />
                  <Route path="relatorio-mensal" element={<ModuleWrapper component={RelatorioMensal} />} />
                  <Route path="cadastros" element={<ModuleWrapper component={Cadastros} />} />
                  <Route path="cadastros/formas-pagamento" element={<ModuleWrapper component={FormasPagamento} />} />
                  <Route path="metas-projecao" element={<ModuleWrapper component={MetasProjecoe} />} />
                  <Route path="super-nota" element={<ModuleWrapper component={SuperNota} />} />
                  <Route path="logs" element={<ModuleWrapper component={SystemLogs} />} />
                  <Route path="etiquetas" element={<ModuleWrapper component={Etiquetas} />} />
                </Route>
                <Route path="/app/etiquetas" element={
                  <UserDataLoader>
                    <ModuleWrapper component={EtiquetasCozinha} />
                  </UserDataLoader>
                } />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
          </AuthProvider>
        </Router>
      );
    }

    export default App;
