import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useUser } from '@/contexts/UserContext';
    import { useToast } from '@/components/ui/use-toast';
    import { format, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays } from 'date-fns';
    import { DollarSign, Target, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, ZoomIn } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useOutletContext, useNavigate } from 'react-router-dom';

    const formatCurrency = (value) => {
      if (typeof value !== 'number' || isNaN(value)) return 'R$ 0,00';
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatPercent = (value) => {
      if (typeof value !== 'number' || isNaN(value)) return '0.0%';
      return `${(value * 100).toFixed(1)}%`;
    };

    const InfoCard = ({ icon: Icon, title, value, statusColor, isLoading }) => (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className={`bg-card rounded-2xl p-4 shadow-lg border-l-4 border-${statusColor}-500`}
      >
        <div className="flex items-center gap-4">
          <div className={`p-3 bg-${statusColor}-100 rounded-full`}>
            <Icon className={`w-6 h-6 text-${statusColor}-600`} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {isLoading ? (
              <div className="h-7 bg-muted rounded w-28 animate-pulse mt-1"></div>
            ) : (
              <p className="text-xl font-bold text-foreground">{value}</p>
            )}
          </div>
        </div>
      </motion.div>
    );

    const AlertCard = ({ message }) => (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-6 h-6"/>
            <span className="font-semibold text-sm">{message}</span>
        </div>
    );

    const SaudeFinanceiraRapida = () => {
      const { user, companies, userCompanyAccess } = useUser();
      const { toast } = useToast();
      const { onModuleChange } = useOutletContext();
      const navigate = useNavigate();
      const [data, setData] = useState(null);
      const [loading, setLoading] = useState(true);
      const [isRefreshing, setIsRefreshing] = useState(false);
      
      const allowedCompanies = useMemo(() => user.is_admin ? companies : companies.filter(c => userCompanyAccess.some(access => access.user_id === user.id && access.company_id === c.id)), [user, companies, userCompanyAccess]);
      
      const [selectedCompanyId, setSelectedCompanyId] = useState(allowedCompanies[0]?.id);

      const handleModuleChange = (path) => {
        if (onModuleChange) {
            onModuleChange(path);
        } else {
            navigate(`/${path}`);
        }
      }

      const fetchData = useCallback(async (isRefresh = false) => {
        if (!selectedCompanyId) {
          setLoading(false);
          setData(null);
          return;
        }
        if (isRefresh) setIsRefreshing(true);
        else setLoading(true);

        try {
          const today = new Date();
          const todayStr = format(today, 'yyyy-MM-dd');
          const weekStart = startOfWeek(today, { weekStartsOn: 0 });
          const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

          const [
            { data: todayDataResult, error: todayError },
            { data: weekData, error: weekError }
          ] = await Promise.all([
            supabase
              .from('saude_financeira_resumo')
              .select('*')
              .eq('empresa_id', selectedCompanyId)
              .eq('data', todayStr)
              .maybeSingle(),
            supabase
              .from('saude_financeira_resumo')
              .select('faturamento, custos_fixos, custos_variaveis, cmv')
              .eq('empresa_id', selectedCompanyId)
              .gte('data', format(weekStart, 'yyyy-MM-dd'))
              .lte('data', format(weekEnd, 'yyyy-MM-dd'))
          ]);

          if (todayError) throw todayError;
          if (weekError) throw weekError;
          
          const todayData = todayDataResult || {};

          const faturamentoSemanal = weekData.reduce((acc, curr) => acc + (curr.faturamento || 0), 0);
          const diasRestantes = Math.max(1, differenceInDays(weekEnd, today));
          const diasPassados = eachDayOfInterval({ start: weekStart, end: today }).length;
          const mediaDiaria = diasPassados > 0 ? faturamentoSemanal / diasPassados : 0;
          const previsaoFinal = faturamentoSemanal + (mediaDiaria * diasRestantes);

          setData({
            hoje: {
              faturamento: todayData?.faturamento ?? 0,
              cmvPercent: todayData?.cmv ?? 0,
              custos: (todayData?.custos_fixos ?? 0) + (todayData?.custos_variaveis ?? 0),
              lucro: todayData?.lucro_prejuizo ?? 0,
            },
            meta: {
              diaria: todayData?.meta_dia ?? 0,
              falta: Math.max(0, (todayData?.meta_dia ?? 0) - (todayData?.faturamento ?? 0)),
            },
            semana: {
              acumulado: faturamentoSemanal,
              previsao: previsaoFinal,
            },
          });

        } catch (err) {
          console.error("Erro ao buscar saúde financeira:", err);
          toast({ title: 'Erro ao carregar dados', description: err.message, variant: 'destructive' });
          setData(null);
        } finally {
          setLoading(false);
          setIsRefreshing(false);
        }
      }, [selectedCompanyId, toast]);

      useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(true), 15 * 60 * 1000); // 15 minutes
        return () => clearInterval(interval);
      }, [fetchData]);

      const { status, alertMessage } = useMemo(() => {
        if (!data) return { status: { color: 'gray-500', text: 'Carregando' }, alertMessage: null };
        
        let status = { color: 'yellow', text: 'Atenção' };
        let alertMessage = null;

        if (data.hoje.lucro > (data.meta.diaria * 0.1)) status = { color: 'green', text: 'Positivo' };
        if (data.hoje.lucro < 0) status = { color: 'red', text: 'Negativo' };
        
        if (data.hoje.cmvPercent > 0.4) {
          alertMessage = "Atenção: CMV alto hoje.";
          if (status.color !== 'red') status = { color: 'yellow', text: 'Atenção' };
        } else if (data.hoje.faturamento < data.meta.diaria * 0.8) {
          alertMessage = "Atenção: Faturamento abaixo de 80% da meta.";
        }

        return { status, alertMessage };
      }, [data]);
      
      const selectedCompanyName = useMemo(() => allowedCompanies.find(c => c.id === selectedCompanyId)?.name, [selectedCompanyId, allowedCompanies]);

      const handleRefresh = () => {
        fetchData(true);
        toast({title: "Dados atualizados!", description: "As informações foram recarregadas."});
      };

      return (
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
          <header className="fixed top-0 left-0 right-0 bg-card/80 backdrop-blur-sm p-4 shadow-md z-10">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-lg font-bold">Saúde Rápida</h1>
                <p className="text-sm text-muted-foreground">{selectedCompanyName} - {format(new Date(), "dd/MM/yyyy")}</p>
              </div>
              <Button onClick={handleRefresh} variant="ghost" size="icon" disabled={isRefreshing}>
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            {allowedCompanies.length > 1 && (
                <select
                  value={selectedCompanyId}
                  onChange={e => setSelectedCompanyId(Number(e.target.value))}
                  className="w-full mt-2 px-3 py-2 rounded-lg border bg-background text-foreground border-border focus:ring-2 focus:ring-primary"
                >
                  {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            )}
          </header>

          <main className="flex-1 pt-32 pb-24 p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !data ? (
                <div className="text-center text-muted-foreground mt-16">
                    <p>Sem dados financeiros para hoje.</p>
                    <p className="text-sm">Verifique se o fechamento de caixa foi realizado.</p>
                </div>
            ) : (
              <div className="space-y-5">
                <motion.div 
                    className={`bg-${status.color}-500 text-white p-6 rounded-2xl shadow-xl text-center`}
                    initial={{opacity: 0, y: -20}} animate={{opacity: 1, y: 0}}
                >
                    <p className="text-sm uppercase tracking-wider">{status.text}</p>
                    <p className="text-4xl font-bold">{formatCurrency(data.hoje.lucro)}</p>
                    <p className="text-xs opacity-80">Lucro/Prejuízo de Hoje</p>
                </motion.div>
                
                {alertMessage && <AlertCard message={alertMessage} />}

                <div className="space-y-4">
                  <h2 className="font-semibold text-lg flex items-center gap-2"><DollarSign className="w-5 h-5 text-primary" />Hoje</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoCard icon={TrendingUp} title="Faturamento" value={formatCurrency(data.hoje.faturamento)} statusColor="green" isLoading={loading} />
                    <InfoCard icon={TrendingDown} title="Custos" value={formatCurrency(data.hoje.custos)} statusColor="red" isLoading={loading} />
                  </div>
                  <InfoCard icon={TrendingDown} title="CMV" value={formatPercent(data.hoje.cmvPercent)} statusColor={data.hoje.cmvPercent > 0.4 ? 'red' : 'blue'} isLoading={loading} />
                </div>

                <div className="space-y-4">
                  <h2 className="font-semibold text-lg flex items-center gap-2"><Target className="w-5 h-5 text-primary" />Meta</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoCard icon={Target} title="Meta do Dia" value={formatCurrency(data.meta.diaria)} statusColor="blue" isLoading={loading} />
                    <InfoCard icon={TrendingDown} title="Faltam" value={formatCurrency(data.meta.falta)} statusColor="yellow" isLoading={loading} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="font-semibold text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Semana</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoCard icon={DollarSign} title="Faturado" value={formatCurrency(data.semana.acumulado)} statusColor="green" isLoading={loading} />
                    <InfoCard icon={TrendingUp} title="Previsão" value={formatCurrency(data.semana.previsao)} statusColor="purple" isLoading={loading} />
                  </div>
                </div>
                
              </div>
            )}
          </main>

          <footer className="fixed bottom-0 left-0 right-0 p-4">
            <Button
              onClick={() => handleModuleChange('saude-financeira-avancada')}
              className="w-full h-14 rounded-full text-lg shadow-2xl"
            >
              <ZoomIn className="w-6 h-6 mr-3" />
              Ver Detalhado
            </Button>
          </footer>
        </div>
      );
    };

    export default SaudeFinanceiraRapida;