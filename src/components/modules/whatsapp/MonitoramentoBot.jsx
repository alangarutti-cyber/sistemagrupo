import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, CheckCircle, AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MonitoramentoBot = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ total: 0, receitas: 0, despesas: 0, saldo: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState({ connected: false, message: 'Verificando...' });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error: fetchError } = await supabase
      .from('quick_entries')
      .select('*, app_users(name), companies(name)')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    if (fetchError) {
      toast({ title: 'Erro ao buscar monitoramento', description: fetchError.message, variant: 'destructive' });
      setError('Falha ao carregar os dados.');
    } else {
      setEntries(data || []);
      const newStats = (data || []).reduce((acc, entry) => {
        acc.total += 1;
        if (entry.type === 'receita') {
          acc.receitas += Number(entry.value);
        } else {
          acc.despesas += Number(entry.value);
        }
        return acc;
      }, { total: 0, receitas: 0, despesas: 0 });
      newStats.saldo = newStats.receitas - newStats.despesas;
      setStats(newStats);
    }
    setIsLoading(false);
  }, [toast]);
  
  const checkConnection = async () => {
    const { data: settings, error: settingsError } = await supabase.from('whatsapp_settings').select('*').limit(1).single();
    if (settingsError || !settings) {
        setStatus({ connected: false, message: 'Configuração não encontrada.' });
        return;
    }
    
    if(!settings.base_url || !settings.instance_id || !settings.api_token) {
        setStatus({ connected: false, message: 'Credenciais incompletas.' });
        return;
    }

    const url = `${settings.base_url}/${settings.instance_id}/token/${settings.api_token}/status`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (response.ok && data.connected) {
            setStatus({ connected: true, message: 'Conectado e operando.' });
        } else {
            setStatus({ connected: false, message: data.error || 'Desconectado.' });
        }
    } catch (err) {
        setStatus({ connected: false, message: 'Falha na verificação.' });
    }
  };

  useEffect(() => {
    fetchData();
    checkConnection();
  }, [fetchData]);
  
  const handleRefresh = () => {
      fetchData();
      checkConnection();
  };

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <motion.div className="space-y-6">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-xl font-bold">Monitoramento do Bot WhatsApp</h2>
                <p className="text-muted-foreground">Atividade de hoje e status da conexão.</p>
            </div>
            <div className="flex items-center gap-4">
                 <div className={`flex items-center gap-2 p-2 rounded-lg ${status.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {status.connected ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <div className="text-sm">
                        <p className="font-semibold">Status: {status.connected ? 'Conectado' : 'Desconectado'}</p>
                        <p>{status.message}</p>
                    </div>
                </div>
                <button onClick={handleRefresh} disabled={isLoading} className="p-2 rounded-full hover:bg-muted transition-colors">
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>
        </div>
      
      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : error ? (
        <div className="text-center text-red-500 p-8">{error}</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total de Lançamentos" value={stats.total} />
            <StatCard title="Receitas" value={formatCurrency(stats.receitas)} isCurrency />
            <StatCard title="Despesas" value={formatCurrency(stats.despesas)} isCurrency />
            <StatCard title="Saldo do Dia" value={formatCurrency(stats.saldo)} isCurrency />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Últimos Lançamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum lançamento hoje via WhatsApp.</p>
              ) : (
                <div className="space-y-4">
                  {entries.map(entry => (
                    <div key={entry.id} className="flex flex-col sm:flex-row justify-between items-start p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                         <div className={`flex items-center justify-center rounded-full w-10 h-10 ${entry.type === 'receita' ? 'bg-green-100' : 'bg-red-100'}`}>
                           {entry.type === 'receita' ? <ArrowUp className="w-5 h-5 text-green-600"/> : <ArrowDown className="w-5 h-5 text-red-600"/>}
                        </div>
                        <div>
                          <p className="font-semibold">{entry.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.app_users?.name || 'Usuário desc.'} em {entry.companies?.name || 'Empresa desc.'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right mt-2 sm:mt-0">
                        <p className={`font-bold text-lg ${entry.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(entry.value)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(entry.created_at), "HH:mm 'de' dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
           <Card>
            <CardHeader>
              <CardTitle>Logs Técnicos (Últimos 10)</CardTitle>
            </CardHeader>
            <CardContent>
                 <pre className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto text-xs max-h-96">
                    {JSON.stringify(entries.slice(0, 10).map(e => e.raw), null, 2)}
                </pre>
            </CardContent>
           </Card>
        </>
      )}
    </motion.div>
  );
};

const StatCard = ({ title, value }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export default MonitoramentoBot;