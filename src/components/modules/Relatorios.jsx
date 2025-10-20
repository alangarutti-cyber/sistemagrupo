import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, colorClass, trend }) => (
  <motion.div
    whileHover={{ y: -5, boxShadow: "0px 10px 20px rgba(0,0,0,0.1)" }}
    className={`p-6 rounded-xl shadow-lg flex flex-col justify-between text-white ${colorClass}`}
  >
    <div className="flex justify-between items-start">
      <h3 className="font-semibold text-lg">{title}</h3>
      <Icon className="w-6 h-6 opacity-80" />
    </div>
    <div className="mt-4">
      <p className="text-4xl font-bold">{value}</p>
      {trend && <p className="text-sm opacity-90 mt-1">{trend}</p>}
    </div>
  </motion.div>
);

const ReportRow = ({ report }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleGenerate = (reportName) => {
    const reportModuleMap = {
      'Demonstrativo DRE': '/dre',
      'Relatório de Produtos': '/estoque',
      'Relatório de Receitas': '/financeiro',
      'Relatório de Despesas': '/financeiro',
      'Relatório de Cobranças PIX': '/cobrancas',
      'Relatório de Checagem de Rotinas': '/checklists',
    };

    const modulePath = reportModuleMap[reportName];

    if (modulePath) {
      navigate(modulePath);
    } else {
      toast({
        title: '🚧 Funcionalidade em desenvolvimento',
        description: `A geração do "${reportName}" ainda não foi implementada.`,
      });
    }
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
      <div>
        <p className="font-medium text-foreground">{report.name}</p>
        <p className="text-sm text-muted-foreground">{report.description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" onClick={() => handleGenerate(report.name)} className="bg-primary hover:bg-primary/90">
          Acessar Módulo
        </Button>
      </div>
    </div>
  );
};

const Relatorios = ({ user, companies }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
      financeiro: 'R$ 0,00',
      vendas: '0',
      estoque: '0',
    });
    const [reports, setReports] = useState([]);
    const [newReportName, setNewReportName] = useState('');
    const [newReportDescription, setNewReportDescription] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');

    useEffect(() => {
        if (companies && companies.length > 0) {
            setSelectedCompanyId(companies[0].id);
        }
    }, [companies]);

    const fetchReports = useCallback(async () => {
        const { data, error } = await supabase.from('reports').select('*').order('name');
        if (error) {
            toast({ title: "Erro ao buscar relatórios", description: error.message, variant: "destructive" });
        } else {
            setReports(data);
        }
    }, [toast]);

    useEffect(() => {
        const fetchStatsAndReports = async () => {
            setLoading(true);
            await fetchReports();
            
            if (!selectedCompanyId) {
                setLoading(false);
                return;
            }

            try {
                const { data: financeiroData, error: financeiroError } = await supabase
                    .from('contas_receber')
                    .select('value')
                    .eq('company_id', selectedCompanyId)
                    .eq('status', 'received');
                if (financeiroError) throw financeiroError;
                const totalRecebido = financeiroData.reduce((acc, item) => acc + item.value, 0);

                const { data: estoqueData, error: estoqueError } = await supabase
                    .from('products')
                    .select('current_stock')
                    .eq('company_id', selectedCompanyId);
                 if (estoqueError) throw estoqueError;
                const totalEstoque = estoqueData.reduce((acc, item) => acc + (item.current_stock || 0), 0);

                setStats({
                    financeiro: `R$ ${totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    vendas: 'N/A',
                    estoque: totalEstoque.toString(),
                });
            } catch (error) {
                console.error("Error fetching report stats:", error);
                toast({
                    title: 'Erro ao buscar dados de resumo',
                    description: 'Não foi possível carregar os resumos.',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        };

        fetchStatsAndReports();
    }, [selectedCompanyId, toast, fetchReports]);

    const handleAddNewReport = async (e) => {
        e.preventDefault();
        if (!newReportName) {
            toast({ title: "Nome do relatório é obrigatório", variant: "destructive" });
            return;
        }
        setIsAdding(true);
        const { error } = await supabase.from('reports').insert({ name: newReportName, description: newReportDescription });
        if (error) {
            toast({ title: "Erro ao adicionar relatório", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Relatório adicionado com sucesso!", variant: "success" });
            setNewReportName('');
            setNewReportDescription('');
            await fetchReports();
        }
        setIsAdding(false);
    };
    
    return (
        <div className="space-y-8">
            <div className="bg-card p-4 rounded-xl shadow-md">
                <label htmlFor="company-filter" className="block text-sm font-medium text-muted-foreground mb-1">Filtrar por Empresa</label>
                <select
                    id="company-filter"
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full p-2 border rounded-md bg-background"
                    disabled={!companies || companies.length === 0}
                >
                    {companies && companies.length > 0 ? (
                        companies.map((company) => (
                            <option key={company.id} value={company.id}>{company.name}</option>
                        ))
                    ) : (
                        <option>Nenhuma empresa encontrada</option>
                    )}
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard
                    title="Resumo Financeiro"
                    value={loading ? '...' : stats.financeiro}
                    icon={LucideIcons.DollarSign}
                    colorClass="bg-teal-500"
                    trend="+5.2% vs mês passado"
                />
                <StatCard
                    title="Resumo de Vendas"
                    value={loading ? '...' : `${stats.vendas} vendas`}
                    icon={LucideIcons.TrendingUp}
                    colorClass="bg-red-500"
                    trend="+12 vendas hoje"
                />
                <StatCard
                    title="Resumo de Estoque"
                    value={loading ? '...' : `${stats.estoque} em estoque`}
                    icon={LucideIcons.Archive}
                    colorClass="bg-blue-500"
                    trend="3 itens com estoque baixo"
                />
            </div>

            <div className="bg-card p-6 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-foreground mb-4">Relatórios Disponíveis</h2>
                {loading ? <p>Carregando relatórios...</p> : (
                    <div className="divide-y divide-border">
                        {reports.map((report) => (
                            <ReportRow key={report.id} report={report} />
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-card p-6 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-foreground mb-4">Adicionar Novo Tipo de Relatório</h2>
                <form onSubmit={handleAddNewReport} className="space-y-4">
                    <div>
                        <label htmlFor="report-name" className="block text-sm font-medium text-muted-foreground mb-1">Nome do Relatório</label>
                        <Input
                            id="report-name"
                            value={newReportName}
                            onChange={(e) => setNewReportName(e.target.value)}
                            placeholder="Ex: Relatório de Metas de Venda"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="report-desc" className="block text-sm font-medium text-muted-foreground mb-1">Descrição (Opcional)</label>
                        <Textarea
                            id="report-desc"
                            value={newReportDescription}
                            onChange={(e) => setNewReportDescription(e.target.value)}
                            placeholder="Descreva o que este relatório irá mostrar."
                        />
                    </div>
                    <Button type="submit" disabled={isAdding}>
                        {isAdding ? 'Adicionando...' : 'Adicionar Relatório'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default Relatorios;