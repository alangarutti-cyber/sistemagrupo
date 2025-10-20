import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useUser } from '@/contexts/UserContext';
    import { useToast } from '@/components/ui/use-toast';
    import { PieChart, DollarSign, TrendingDown, TrendingUp, Percent, Target, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';
    import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
    import { ptBR } from 'date-fns/locale';

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    const KpiCard = ({ title, value, icon: Icon, color, isLoading }) => (
      <Card className={`border-l-4 ${color}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-8 w-3/4 bg-muted animate-pulse rounded-md"></div> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
      </Card>
    );

    const RelatorioMensal = () => {
      const { user, companies } = useUser();
      const { toast } = useToast();
      const [loading, setLoading] = useState(true);
      const [data, setData] = useState([]);
      const [kpis, setKpis] = useState({});
      const [costStructure, setCostStructure] = useState([]);
      const [monthlyRevenue, setMonthlyRevenue] = useState([]);
      const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
      const [lastUpdated, setLastUpdated] = useState(new Date());

      const allowedCompanies = useMemo(() => {
        if (!user || !companies) return [];
        if (user.is_admin) return companies;
        const userCompanyIds = user.company_ids?.map(uc => uc.company_id) || [];
        return companies.filter(c => userCompanyIds.includes(c.id));
      }, [user, companies]);

      const fetchData = useCallback(async () => {
        if (allowedCompanies.length === 0) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const startDate = format(startOfMonth(new Date(selectedMonth)), 'yyyy-MM-dd');
        const endDate = format(endOfMonth(new Date(selectedMonth)), 'yyyy-MM-dd');
        const allowedCompanyIds = allowedCompanies.map(c => c.id);

        try {
          const [receitasData, despesasData, quickEntriesData, employeePaymentsData, metasData] = await Promise.all([
            supabase.from('contas_receber').select('company_id, value').in('company_id', allowedCompanyIds).eq('status', 'received').gte('payment_date', startDate).lte('payment_date', endDate),
            supabase.from('contas_pagar').select('company_id, value').in('company_id', allowedCompanyIds).eq('status', 'paid').gte('payment_date', startDate).lte('payment_date', endDate),
            supabase.from('quick_entries').select('company_id, type, value').in('company_id', allowedCompanyIds).gte('created_at', startDate).lte('created_at', endDate),
            supabase.from('employee_payments').select('company_id, total_value').in('company_id', allowedCompanyIds).gte('start_date', startDate).lte('end_date', endDate).eq('status', 'Aprovado'),
            supabase.from('metas_financeiras').select('*').in('company_id', allowedCompanyIds).eq('mes', new Date(selectedMonth).getUTCMonth() + 1).eq('ano', new Date(selectedMonth).getUTCFullYear()),
          ]);

          if (receitasData.error || despesasData.error || quickEntriesData.error || employeePaymentsData.error || metasData.error) {
            throw receitasData.error || despesasData.error || quickEntriesData.error || employeePaymentsData.error || metasData.error;
          }

          const consolidatedData = allowedCompanies.map(company => {
            const companyId = company.id;
            const receitas = (receitasData.data?.filter(r => r.company_id === companyId).reduce((sum, r) => sum + r.value, 0) || 0) +
                             (quickEntriesData.data?.filter(q => q.company_id === companyId && q.type === 'receita').reduce((sum, q) => sum + q.value, 0) || 0);
            
            const despesas = despesasData.data?.filter(d => d.company_id === companyId).reduce((sum, d) => sum + d.value, 0) || 0;
            const quickDespesas = quickEntriesData.data?.filter(q => q.company_id === companyId && q.type === 'despesa').reduce((sum, q) => sum + q.value, 0) || 0;
            
            const folha = employeePaymentsData.data?.filter(p => p.company_id === companyId).reduce((sum, p) => sum + p.total_value, 0) || 0;
            
            const meta = metasData.data?.find(m => m.company_id === companyId);
            const cmvPercent = meta?.meta_cmv_percent ? meta.meta_cmv_percent / 100 : 0.35; // Use meta or default
            const cmv = receitas * cmvPercent;
            const custosFixos = despesas + quickDespesas;
            const lucroBruto = receitas - cmv;
            const lucroLiquido = lucroBruto - custosFixos - folha;
            
            return {
              company_id: companyId,
              name: company.name,
              receitaTotal: receitas,
              cmv,
              custosFixos,
              folha,
              lucroBruto,
              lucroLiquido,
              metaFaturamento: meta?.meta_faturamento || 0,
            };
          });

          setData(consolidatedData);

          const totalReceita = consolidatedData.reduce((sum, d) => sum + d.receitaTotal, 0);
          const totalDespesa = consolidatedData.reduce((sum, d) => sum + d.custosFixos + d.folha, 0);
          const totalLucroBruto = consolidatedData.reduce((sum, d) => sum + d.lucroBruto, 0);
          const totalLucroLiquido = consolidatedData.reduce((sum, d) => sum + d.lucroLiquido, 0);
          const totalCmv = consolidatedData.reduce((sum, d) => sum + d.cmv, 0);
          const totalFolha = consolidatedData.reduce((sum, d) => sum + d.folha, 0);
          const totalCustosFixos = consolidatedData.reduce((sum, d) => sum + d.custosFixos, 0);

          setKpis({
            receitaTotal: totalReceita,
            despesaTotal: totalDespesa,
            lucroBruto: totalLucroBruto,
            lucroLiquido: totalLucroLiquido,
            cmvPercent: totalReceita > 0 ? totalCmv / totalReceita : 0,
            ticketMedio: 150, // Placeholder
          });

          setCostStructure([
            { name: 'CMV', value: totalCmv },
            { name: 'Folha', value: totalFolha },
            { name: 'Custos Fixos', value: totalCustosFixos },
          ]);

          const monthPromises = Array.from({ length: 6 }).map((_, i) => {
            const date = subMonths(new Date(), i);
            const start = format(startOfMonth(date), 'yyyy-MM-dd');
            const end = format(endOfMonth(date), 'yyyy-MM-dd');
            return supabase.from('contas_receber').select('value').in('company_id', allowedCompanyIds).eq('status', 'received').gte('payment_date', start).lte('payment_date', end);
          });
          const monthlyResults = await Promise.all(monthPromises.map(p => p.catch(e => ({ data: [], error: e }))));
          const revenueData = monthlyResults.map((res, i) => ({
            name: format(subMonths(new Date(), i), 'MMM', { locale: ptBR }),
            faturamento: res.data?.reduce((sum, r) => sum + r.value, 0) || 0,
          })).reverse();
          setMonthlyRevenue(revenueData);

        } catch (error) {
          toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
        } finally {
          setLoading(false);
          setLastUpdated(new Date());
        }
      }, [selectedMonth, allowedCompanies, toast]);

      useEffect(() => {
        fetchData();
      }, [fetchData]);

      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><PieChart className="w-8 h-8 text-primary"/>Relatório Consolidado Mensal</h1>
              <p className="text-muted-foreground mt-1">Sua visão completa do desempenho financeiro do mês.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Atualizado em: {format(lastUpdated, 'HH:mm:ss')}</span>
              <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Recalcular
              </Button>
            </div>
          </header>

          <div className="bg-card p-4 rounded-xl shadow-sm">
            <label htmlFor="month-filter" className="block text-sm font-medium text-muted-foreground mb-1">Filtrar por Mês</label>
            <Input id="month-filter" type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full md:w-auto" />
          </div>

          <section>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard title="Receita Total" value={formatCurrency(kpis.receitaTotal)} icon={DollarSign} color="border-green-500" isLoading={loading} />
              <KpiCard title="Despesa Total" value={formatCurrency(kpis.despesaTotal)} icon={TrendingDown} color="border-red-500" isLoading={loading} />
              <KpiCard title="Lucro Bruto" value={formatCurrency(kpis.lucroBruto)} icon={TrendingUp} color="border-blue-500" isLoading={loading} />
              <KpiCard title="Lucro Líquido" value={formatCurrency(kpis.lucroLiquido)} icon={TrendingUp} color="border-sky-500" isLoading={loading} />
              <KpiCard title="CMV" value={formatPercent(kpis.cmvPercent)} icon={Percent} color="border-orange-500" isLoading={loading} />
              <KpiCard title="Ticket Médio" value={formatCurrency(kpis.ticketMedio)} icon={Target} color="border-purple-500" isLoading={loading} />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Evolução Mensal do Faturamento</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyRevenue}>
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(val) => formatCurrency(val)} />
                    <Legend />
                    <Line type="monotone" dataKey="faturamento" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Estrutura de Custos</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie data={costStructure} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {costStructure.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val) => formatCurrency(val)} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card>
              <CardHeader><CardTitle>Lucro por Unidade</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(val) => formatCurrency(val)} />
                    <Legend />
                    <Bar dataKey="lucroBruto" name="Lucro Bruto" fill="#82ca9d" />
                    <Bar dataKey="lucroLiquido" name="Lucro Líquido" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card>
              <CardHeader><CardTitle>Tabela Detalhada</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-muted">
                    <tr>
                      {['Empresa', 'Receita Total', 'CMV', 'Custos Fixos', 'Folha', 'Lucro Bruto', 'Lucro Líquido', '% Cumprido'].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-gray-200">
                    {loading ? (
                      [...Array(3)].map((_, i) => <tr key={i}><td colSpan="8" className="p-4"><div className="h-4 bg-muted animate-pulse rounded-md"></div></td></tr>)
                    ) : data.map(item => {
                      const percentualCumprido = item.metaFaturamento > 0 ? item.receitaTotal / item.metaFaturamento : 0;
                      const cumpriuMeta = percentualCumprido >= 1;
                      return (
                        <tr key={item.company_id}>
                          <td className="px-6 py-4 whitespace-nowrap font-medium">{item.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(item.receitaTotal)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(item.cmv)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(item.custosFixos)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(item.folha)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(item.lucroBruto)}</td>
                          <td className={`px-6 py-4 whitespace-nowrap font-semibold ${item.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.lucroLiquido)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${cumpriuMeta ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(percentualCumprido)}</span>
                              {cumpriuMeta ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>
        </motion.div>
      );
    };

    export default RelatorioMensal;