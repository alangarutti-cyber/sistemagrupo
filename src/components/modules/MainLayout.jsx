import React, { useState, useEffect, useMemo } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import * as LucideIcons from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import Dashboard from '@/components/modules/Dashboard';
    import DRE from '@/components/modules/DRE';
    import Estoque from '@/components/modules/Estoque';
    import Caixa from '@/components/modules/Caixa';
    import Financeiro from '@/components/modules/Financeiro';
    import Fornecedores from '@/components/modules/Fornecedores';
    import Funcionarios from '@/components/modules/Funcionarios';
    import Configuracoes from '@/components/modules/Configuracoes';
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
    import RelatorioBotWhatsapp from '@/components/modules/RelatorioBotWhatsapp';
    import RelatorioMensal from '@/components/modules/RelatorioMensal';
    import MetasProjecoe from '@/components/modules/MetasProjecoe';
    import DesempenhoDiario from '@/components/modules/DesempenhoDiario';
    import ProjecaoSemanal from '@/components/modules/ProjecaoSemanal';
    import RelatorioConsolidado from '@/components/modules/RelatorioConsolidado';
    import PainelExecutivo from '@/components/modules/PainelExecutivo';
    import PainelWhatsapp from '@/components/modules/PainelWhatsapp';
    import { supabase } from '@/lib/customSupabaseClient';

    const { LogOut, Menu, X, Settings, Bell } = LucideIcons;

    const moduleComponents = {
      dashboard: Dashboard,
      'saude-financeira': SaudeFinanceira,
      'saude-financeira-avancada': SaudeFinanceiraAvancada,
      'saude-financeira-rapida': SaudeFinanceiraRapida,
      lancamentos: Lancamentos,
      'lancamento-rapido': LancamentoRapido,
      pedidos: Pedidos,
      dre: DRE,
      estoque: Estoque,
      caixa: Caixa,
      financeiro: Financeiro,
      cobrancas: Cobrancas,
      bancos: Bancos,
      fornecedores: Fornecedores,
      funcionarios: Funcionarios,
      'maquinas-cartao': MaquinasCartao,
      configuracoes: Configuracoes,
      empresas: Empresas,
      conferencia: Conferencia,
      pdv: PDV,
      'notas-fiscais': NotasFiscais,
      checklists: Checklists,
      relatorios: Relatorios,
      'pagamento-semanal': PagamentoSemanal,
      'respostas-avaliacoes': RespostasAvaliacoes,
      'relatorio-bot-whatsapp': RelatorioBotWhatsapp,
      'relatorio-mensal': RelatorioMensal,
      'metas-projecoes': MetasProjecoe,
      'dashboard-desempenho': DesempenhoDiario,
      'projecao-semanal': ProjecaoSemanal,
      'relatorio-consolidado': RelatorioConsolidado,
      'painel-executivo': PainelExecutivo,
      'painel-whatsapp': PainelWhatsapp,
    };

    const MainLayout = (props) => {
      const { user, onLogout, userModules } = props;
      const [activeModule, setActiveModule] = useState(() => window.location.hash.replace('#', '') || 'dashboard');
      const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
      const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
      const [allModules, setAllModules] = useState([]);
      const [loadingModules, setLoadingModules] = useState(true);
      const sidebarAutoCollapse = true;

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
        const handleHashChange = () => {
          setActiveModule(window.location.hash.replace('#', '') || 'dashboard');
        };

        window.addEventListener('hashchange', handleHashChange);

        return () => {
          window.removeEventListener('hashchange', handleHashChange);
        };
      }, []);

      useEffect(() => {
        const fetchAllModules = async () => {
          if (!user) return;
          setLoadingModules(true);
          try {
            const { data, error } = await supabase.from('modules').select('*').eq('is_active', true);
            if (error) throw error;
            let modules = data || [];
            
            const hardcodedModules = [
                { id: 99, name: 'Lançamento Rápido', path: 'lancamento-rapido', icon: 'Zap' },
                { id: 100, name: 'Configurações', path: 'configuracoes', icon: 'Settings' },
                { id: 101, name: 'Empresas', path: 'empresas', icon: 'Building2' },
                { id: 102, name: 'Respostas IA', path: 'respostas-avaliacoes', icon: 'Sparkles' },
                { id: 103, name: 'Saúde Financeira Avançada', path: 'saude-financeira-avancada', icon: 'Activity' },
                { id: 104, name: 'Saúde Financeira Rápida', path: 'saude-financeira-rapida', icon: 'Smartphone' },
                { id: 105, name: 'Relatório Bot WhatsApp', path: 'relatorio-bot-whatsapp', icon: 'BarChart3' },
                { id: 106, name: 'Relatório Mensal', path: 'relatorio-mensal', icon: 'PieChart' },
                { id: 107, name: 'Metas e Projeções', path: 'metas-projecoes', icon: 'Target' },
                { id: 108, name: 'Desempenho Diário', path: 'dashboard-desempenho', icon: 'Activity' },
                { id: 109, name: 'Projeção Semanal', path: 'projecao-semanal', icon: 'TrendingUp' },
                { id: 110, name: 'Relatório Consolidado', path: 'relatorio-consolidado', icon: 'FileBarChart' },
                { id: 111, name: 'Painel Executivo', path: 'painel-executivo', icon: 'LayoutDashboard' },
                { id: 112, name: 'Painel WhatsApp', path: 'painel-whatsapp', icon: 'MessageCircle' },
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
        if (!user || loadingModules) return [];
        if (user.is_admin || user.role === 'Super Administrador') {
          return allModules;
        }
        const userModuleIds = userModules
          .filter(um => um.user_id === user.id && um.allowed)
          .map(um => um.module_id);
        
        const modules = allModules.filter(m => userModuleIds.includes(m.id));
        
        const hardcodedPaths = [
          'lancamento-rapido', 'configuracoes', 'empresas', 'respostas-avaliacoes', 
          'saude-financeira-avancada', 'saude-financeira-rapida', 'relatorio-bot-whatsapp', 
          'relatorio-mensal', 'metas-projecoes', 'dashboard-desempenho', 'projecao-semanal', 
          'relatorio-consolidado', 'painel-executivo', 'painel-whatsapp'
        ];
        hardcodedPaths.forEach(path => {
            if (!modules.find(m => m.path === path)) {
                const moduleToAdd = allModules.find(m => m.path === path);
                if(moduleToAdd) modules.push(moduleToAdd);
            }
        });
        
        return modules;

      }, [user, userModules, allModules, loadingModules]);

      useEffect(() => {
        if (allowedModules.length > 0) {
          const currentModuleAllowed = allowedModules.some(m => m.path === activeModule);
          if (!currentModuleAllowed) {
            window.location.hash = 'dashboard';
          }
        }
      }, [allowedModules, activeModule]);

      const handleModuleChange = (moduleId) => {
        window.location.hash = moduleId;
        if (isMobile && sidebarAutoCollapse) {
          setIsSidebarOpen(false);
        }
      };

      const handleBackToDashboard = () => {
        handleModuleChange('dashboard');
      };

      const renderModule = () => {
        const Component = moduleComponents[activeModule] || Dashboard;
        if (activeModule === 'pdv') {
          return <Component {...props} onBackToDashboard={handleBackToDashboard} onModuleChange={handleModuleChange} />;
        }
        return <Component {...props} onModuleChange={handleModuleChange} />;
      };

      const sortedModules = useMemo(() => {
        const order = [
          'dashboard', 'painel-executivo', 'dashboard-desempenho', 'projecao-semanal', 'relatorio-consolidado', 'relatorio-mensal',
          'pdv', 'saude-financeira-rapida', 'lancamento-rapido', 'painel-whatsapp', 'respostas-avaliacoes', 'checklists', 
          'saude-financeira', 'saude-financeira-avancada', 'financeiro', 'cobrancas', 'pagamento-semanal', 'caixa', 
          'pedidos', 'estoque', 'dre', 'relatorios', 'relatorio-bot-whatsapp', 'metas-projecoes', 
          'notas-fiscais', 'funcionarios', 'empresas', 'configuracoes'
        ];
        return [...allowedModules].sort((a, b) => {
          const indexA = order.indexOf(a.path);
          const indexB = order.indexOf(b.path);
          if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }, [allowedModules]);

      if (activeModule === 'pdv') {
        return renderModule();
      }
      
      const ActiveComponent = moduleComponents[activeModule];
      if (ActiveComponent && ActiveComponent.name === 'SaudeFinanceiraRapida') {
        return <ActiveComponent {...props} onModuleChange={handleModuleChange} />;
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
                    onClick={onLogout}
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
            <header className="bg-card/80 backdrop-blur-sm border-b border-border p-4 sticky top-0 z-30 print:hidden">
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
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-muted" onClick={() => handleModuleChange('configuracoes')}>
                    <Settings className="w-5 h-5" />
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

            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-background">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderModule()}
              </motion.div>
            </main>
          </div>
        </div>
      );
    };

    export default MainLayout;