import React, { useState, useEffect, useMemo, useRef } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import * as LucideIcons from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useLocation, useNavigate, Outlet } from 'react-router-dom';
    import { useUser } from '@/contexts/UserContext';
    import { useAuth } from '@/contexts/SupabaseAuthContext';

    const { LogOut, Menu, X, Settings, Bell } = LucideIcons;

    const MainLayout = () => {
      const { onDataUpdate } = useUser();
      const { signOut } = useAuth();
      const location = useLocation();
      const navigate = useNavigate();
      const mainContentRef = useRef(null);
      
      const [activeModule, setActiveModule] = useState('');
      const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
      const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
      const [allModules, setAllModules] = useState([]);
      const [loadingModules, setLoadingModules] = useState(true);
      const sidebarAutoCollapse = true;

      const { user, companies, users } = useUser();

      const handleLogout = async () => {
        await signOut();
        navigate('/login');
      };

      useEffect(() => {
        const currentModule = location.pathname.replace(/^\//, '');
        setActiveModule(currentModule || 'dashboard');
      }, [location.pathname]);

      useEffect(() => {
        const handleResize = () => {
          const mobile = window.innerWidth < 1024;
          setIsMobile(mobile);
          if (!mobile) {
            setIsSidebarOpen(true);
          } else {
            setIsSidebarOpen(false);
          }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
      }, []);

      useEffect(() => {
        const fetchAllModules = async () => {
          if (!user) return;
          setLoadingModules(true);
          try {
            const { data, error } = await supabase.from('modules').select('*');
            if (error) throw error;
            let modules = data || [];
            
            const hardcodedModules = [
                { id: 99, name: 'Lançamento Rápido', path: 'lancamento-rapido', icon: 'Zap', is_active: true },
                { id: 100, name: 'Configurações', path: 'configuracoes', icon: 'Settings', is_active: true },
                { id: 101, name: 'Empresas', path: 'empresas', icon: 'Building2', is_active: true },
                { id: 102, name: 'Respostas IA', path: 'respostas-avaliacoes', icon: 'Sparkles', is_active: true },
                { id: 103, name: 'Saúde Financeira Avançada', path: 'saude-financeira-avancada', icon: 'Activity', is_active: true },
                { id: 104, name: 'Saúde Financeira Rápida', path: 'saude-financeira-rapida', icon: 'Smartphone', is_active: true },
                { id: 105, name: 'Desempenho Diário', path: 'desempenho-diario', icon: 'TrendingUp', is_active: true },
                { id: 106, name: 'Painel Executivo', path: 'painel-executivo', icon: 'LayoutDashboard', is_active: true },
                { id: 107, name: 'Projeção Semanal', path: 'projecao-semanal', icon: 'TrendingUp', is_active: true },
                { id: 108, name: 'Relatório Bot WhatsApp', path: 'relatorio-bot-whatsapp', icon: 'MessageSquare', is_active: true },
                { id: 109, name: 'Relatório Consolidado', path: 'relatorio-consolidado', icon: 'FileBarChart', is_active: true },
                { id: 110, name: 'Relatório Mensal', path: 'relatorio-mensal', icon: 'Calendar', is_active: true },
                { id: 111, name: 'Cadastros', path: 'cadastros', icon: 'Archive', is_active: true },
                { id: 112, name: 'Metas e Projeções', path: 'metas-projecao', icon: 'Target', is_active: true },
                { id: 113, name: 'Super Nota', path: 'super-nota', icon: 'Zap', is_active: true },
                { id: 114, name: 'Logs do Sistema', path: 'logs', icon: 'History', is_active: true },
                { id: 115, name: 'Etiquetas', path: 'etiquetas', icon: 'Ticket', is_active: true },
                { id: 116, name: 'Etiquetas (App Cozinha)', path: 'app/etiquetas', icon: 'Tag', is_active: true },
                { id: 117, name: 'Raio-X Financeiro', path: 'raio-x-financeiro', icon: 'Radar', is_active: true },
            ];

            hardcodedModules.forEach(hcModule => {
                if (!modules.find(m => m.path === hcModule.path)) {
                    modules.push(hcModule);
                }
            });

            setAllModules(modules);
          } catch (error) {
            console.error("Error fetching all modules:", error);
          } finally {
            setLoadingModules(false);
          }
        };
        fetchAllModules();
      }, [user]);

      const allowedModules = useMemo(() => {
        if (loadingModules) return [];
        return allModules; // Removed all filters
      }, [allModules, loadingModules]);

      const handleModuleChange = (path) => {
        if (path.startsWith('app/')) {
            window.open(`/#/${path}`, '_blank');
        } else {
            navigate(`/${path}`);
            if (isMobile && sidebarAutoCollapse) {
                setIsSidebarOpen(false);
            }
            if (mainContentRef.current) {
                mainContentRef.current.scrollTop = 0;
            }
        }
      };

      const sortedModules = useMemo(() => {
        const order = ['dashboard', 'pdv', 'raio-x-financeiro', 'saude-financeira-rapida', 'lancamento-rapido', 'respostas-avaliacoes', 'checklists', 'cadastros', 'etiquetas', 'app/etiquetas', 'financeiro', 'cobrancas', 'pagamento-semanal', 'caixa', 'pedidos', 'estoque', 'dre', 'relatorios', 'super-nota', 'empresas', 'configuracoes', 'logs', 'desempenho-diario', 'painel-executivo', 'projecao-semanal', 'relatorio-bot-whatsapp', 'relatorio-consolidado', 'relatorio-mensal', 'metas-projecao'];

        return [...allowedModules]
          .sort((a, b) => {
            const indexA = order.indexOf(a.path);
            const indexB = order.indexOf(b.path);
            if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
      }, [allowedModules]);
      
      const isFullScreenModule = ['pdv', 'saude-financeira-rapida'].includes(activeModule);

      const outletContext = { user, companies, users, onDataUpdate, handleModuleChange };
      
      if (!user) {
          return (
              <div className="min-h-screen flex items-center justify-center bg-background">
                  <div className="text-xl font-semibold text-foreground">Carregando usuário...</div>
              </div>
          );
      }

      if (isFullScreenModule) {
        return <Outlet context={outletContext} />;
      }

      return (
        <div className="min-h-screen flex bg-background text-foreground">
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ duration: 0.2 }}
                className={`w-64 bg-secondary flex flex-col h-full z-40 ${isMobile ? 'fixed' : 'relative'}`}
              >
                <div className="p-4 border-b border-border flex justify-center items-center">
                  <button onClick={() => handleModuleChange('dashboard')} className="focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
                    <img alt="Stout Group Logo" className="h-12" src="https://horizons-cdn.hostinger.com/6a44e4d1-b151-41db-aa41-6efe480a026e/4907d27c8ad3e4ceaa68b04717459794.jpg" />
                  </button>
                </div>

                <nav className="flex-1 p-4 overflow-y-auto">
                  <div className="space-y-2">
                    {loadingModules ? (
                      <p className="text-center text-muted-foreground">Carregando...</p>
                    ) : (
                      sortedModules.map((module) => {
                        const Icon = LucideIcons[module.icon] || LucideIcons.HelpCircle;
                        const isActive = activeModule === module.path;
                        
                        return (
                          <motion.button
                            key={module.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleModuleChange(module.path)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
                              isActive 
                                ? `bg-primary text-primary-foreground shadow-md` 
                                : 'hover:bg-muted text-secondary-foreground'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="font-semibold">{module.name}</span>
                          </motion.button>
                        );
                      })
                    )}
                  </div>
                </nav>

                <div className="p-4 border-t border-border">
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-primary hover:bg-muted"
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    Sair
                  </Button>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          <div className="flex-1 flex flex-col min-h-screen">
            <header className="bg-card/80 backdrop-blur-sm border-b border-border p-4 sticky top-0 z-30">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="text-foreground hover:text-primary hover:bg-muted"
                >
                  {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </Button>
                
                <h1 className="text-xl md:text-2xl font-bold text-foreground">
                  {allModules.find(m => m.path === activeModule)?.name || 'Dashboard'}
                </h1>
                
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-muted">
                    <Bell className="w-5 h-5" />
                  </Button>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-semibold text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.role}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border">
                      <span className="font-bold text-primary">{user.name.charAt(0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <main ref={mainContentRef} className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-background">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeModule}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Outlet context={outletContext} />
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      );
    };

    export default MainLayout;