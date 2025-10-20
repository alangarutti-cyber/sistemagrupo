import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/use-toast';
import { LayoutDashboard, TrendingUp, TrendingDown, DollarSign, Target, RefreshCw, AlertCircle, CheckCircle, XCircle, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth } from 'date-fns';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString.replace(/-/g, '/')), 'dd/MM/yyyy');
};

const KpiCard = ({ title, value, icon: Icon, isLoading, color }) => (
    <Card className={`relative overflow-hidden border-l-4 border-${color}-500`}>
        <Icon className={`absolute -right-4 -bottom-4 h-20 w-20 text-${color}-500/10`} />
        <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="h-10 w-3/4 bg-muted animate-pulse rounded-md mt-1"></div>
            ) : (
                <div className="text-3xl font-bold text-foreground">{value}</div>
            )}
        </CardContent>
    </Card>
);

const PainelExecutivo = () => {
    const { user, companies, onDataUpdate } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [filterPeriod, setFilterPeriod] = useState('monthly');
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [unitMovements, setUnitMovements] = useState({ receitas: [], despesas: [] });
    const [loadingUnitMovements, setLoadingUnitMovements] = useState(false);
    const [isUndoAlertOpen, setIsUndoAlertOpen] = useState(false);
    const [itemToUndo, setItemToUndo] = useState(null);

    const allowedCompanies = useMemo(() => {
        if (!user || !companies) return [];
        if (user.is_admin) return companies;
        const userCompanyIds = user.company_ids?.map(uc => uc.company_id) || [];
        return companies.filter(c => userCompanyIds.includes(c.id));
    }, [user, companies]);

    const getDateRange = useCallback(() => {
        const today = new Date();
        const startDate = filterPeriod === 'monthly' ? startOfMonth(today) : startOfWeek(today, { weekStartsOn: 1 });
        const endDate = filterPeriod === 'monthly' ? endOfMonth(today) : endOfWeek(today, { weekStartsOn: 1 });
        return { startDate: format(startDate, 'yyyy-MM-dd'), endDate: format(endDate, 'yyyy-MM-dd') };
    }, [filterPeriod]);

    const fetchData = useCallback(async () => {
        if (allowedCompanies.length === 0) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const { startDate, endDate } = getDateRange();
        const today = new Date();
        const allowedCompanyIds = allowedCompanies.map(c => c.id);

        try {
            const [receitasData, despesasData, metasData, weekEvolutionData] = await Promise.all([
                supabase.from('contas_receber').select('company_id, value').in('company_id', allowedCompanyIds).eq('status', 'received').gte('payment_date', startDate).lte('payment_date', endDate),
                supabase.from('contas_pagar').select('company_id, value').in('company_id', allowedCompanyIds).eq('status', 'paid').gte('payment_date', startDate).lte('payment_date', endDate),
                supabase.from('metas_financeiras').select('*').in('company_id', allowedCompanyIds).eq('mes', today.getMonth() + 1).eq('ano', today.getFullYear()),
                Promise.all(Array.from({ length: 6 }).map((_, i) => {
                    const weekDate = subWeeks(today, 5 - i);
                    const start = format(startOfWeek(weekDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                    const end = format(endOfWeek(weekDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                    return supabase.from('contas_receber').select('value').in('company_id', allowedCompanyIds).eq('status', 'received').gte('payment_date', start).lte('payment_date', end);
                }))
            ]);
            
            const totalFaturamento = receitasData.data?.reduce((sum, r) => sum + r.value, 0) || 0;
            const totalDespesas = despesasData.data?.reduce((sum, d) => sum + d.value, 0) || 0;
            const metaFaturamentoGlobal = metasData.data?.reduce((sum, m) => sum + m.meta_faturamento, 0) || 0;
            const metaPercentAtingida = metaFaturamentoGlobal > 0 ? (totalFaturamento / metaFaturamentoGlobal) : 0;
            const cmvGlobal = totalFaturamento * 0.35;
            const lucroConsolidado = totalFaturamento - totalDespesas - cmvGlobal;

            const unitPerformance = allowedCompanies.map(company => {
                const faturamento = receitasData.data?.filter(r => r.company_id === company.id).reduce((s, r) => s + r.value, 0) || 0;
                const despesas = despesasData.data?.filter(d => d.company_id === company.id).reduce((s, d) => s + d.value, 0) || 0;
                const meta = metasData.data?.find(m => m.company_id === company.id);
                const cmvPercent = (meta?.meta_cmv_percent / 100) || 0.35;
                const cmv = faturamento * cmvPercent;
                const lucro = faturamento - despesas - cmv;
                const metaFaturamento = meta?.meta_faturamento || 0;
                const metaAtingida = metaFaturamento > 0 ? (faturamento / metaFaturamento) : 0;
                
                let status = 'green';
                if(lucro < 0) status = 'red';
                else if (metaAtingida < 0.8) status = 'yellow';
                
                return { id: company.id, name: company.name, faturamento, lucro, cmvPercent, metaAtingida, status };
            });

            const weekEvolution = weekEvolutionData.map((res, i) => ({
                name: format(subWeeks(today, 5 - i), 'dd/MM'),
                Faturamento: res.data?.reduce((s, r) => s + r.value, 0) || 0,
            }));

            setData({
                kpis: { totalFaturamento, lucroConsolidado, cmvGlobal, totalDespesas, metaPercentAtingida },
                unitPerformance,
                weekEvolution,
            });

        } catch (error) {
            toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [allowedCompanies, getDateRange, toast]);

    useEffect(() => { fetchData() }, [fetchData]);

    const handleUnitClick = async (unit) => {
        setSelectedUnit(unit);
        setIsUnitModalOpen(true);
        setLoadingUnitMovements(true);
    
        const { startDate, endDate } = getDateRange();
    
        try {
            const [receitas, despesas] = await Promise.all([
                supabase.from('contas_receber').select('*').eq('company_id', unit.id).eq('status', 'received').gte('payment_date', startDate).lte('payment_date', endDate),
                supabase.from('contas_pagar').select('*').eq('company_id', unit.id).eq('status', 'paid').gte('payment_date', startDate).lte('payment_date', endDate),
            ]);
    
            if (receitas.error) throw receitas.error;
            if (despesas.error) throw despesas.error;
    
            setUnitMovements({
                receitas: receitas.data || [],
                despesas: despesas.data || [],
            });
        } catch (error) {
            toast({ title: 'Erro ao buscar movimentações', description: error.message, variant: 'destructive' });
        } finally {
            setLoadingUnitMovements(false);
        }
    };

    const handleUndoClick = (item, type) => {
        setItemToUndo({ ...item, type });
        setIsUndoAlertOpen(true);
    };

    const confirmUndo = async () => {
        if (!itemToUndo) return;

        const { type, ...conta } = itemToUndo;
        const tableName = type === 'receita' ? 'contas_receber' : 'contas_pagar';

        try {
            const { error: updateError } = await supabase
                .from(tableName)
                .update({ status: 'pending', payment_date: null, bank_account_id: null })
                .eq('id', conta.id);

            if (updateError) throw updateError;
            
            if (conta.bank_account_id) {
                const { data: bankAccount, error: accError } = await supabase.from('bank_accounts').select('current_balance').eq('id', conta.bank_account_id).single();
                if (accError) throw accError;

                const newBalance = type === 'receita' 
                    ? bankAccount.current_balance - conta.value 
                    : bankAccount.current_balance + conta.value;
                
                await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', conta.bank_account_id);
                
                await supabase.from('bank_transactions').delete().match({ [tableName === 'contas_pagar' ? 'conta_pagar_id' : 'conta_receber_id']: conta.id });
            }

            toast({ title: "Operação desfeita com sucesso!", variant: "success" });
            fetchData();
            handleUnitClick(selectedUnit);
            if (onDataUpdate) onDataUpdate();

        } catch (error) {
            toast({ title: "Erro ao desfazer operação", description: error.message, variant: "destructive" });
        } finally {
            setIsUndoAlertOpen(false);
            setItemToUndo(null);
        }
    };


    const getStatusIcon = (status) => {
        if (status === 'green') return <CheckCircle className="w-5 h-5 text-green-500" />;
        if (status === 'yellow') return <AlertCircle className="w-5 h-5 text-yellow-500" />;
        return <XCircle className="w-5 h-5 text-red-500" />;
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><LayoutDashboard className="w-8 h-8 text-primary"/>Painel Executivo</h1>
                    <p className="text-muted-foreground mt-1">Visão geral e estratégica do Stout Group.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant={filterPeriod === 'weekly' ? 'default' : 'outline'} onClick={() => setFilterPeriod('weekly')}>Semanal</Button>
                    <Button variant={filterPeriod === 'monthly' ? 'default' : 'outline'} onClick={() => setFilterPeriod('monthly')}>Mensal</Button>
                    <Button onClick={fetchData} variant="outline" size="icon" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </header>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard title="Faturamento Total" value={formatCurrency(data?.kpis.totalFaturamento)} icon={DollarSign} color="blue" isLoading={loading} />
                <KpiCard title="Lucro Consolidado" value={formatCurrency(data?.kpis.lucroConsolidado)} icon={TrendingUp} color="green" isLoading={loading} />
                <KpiCard title="Despesa Total" value={formatCurrency(data?.kpis.totalDespesas)} icon={TrendingDown} color="red" isLoading={loading} />
                <KpiCard title="% Meta Global" value={formatPercent(data?.kpis.metaPercentAtingida)} icon={Target} color="purple" isLoading={loading} />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle>Desempenho por Unidade</CardTitle></CardHeader>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="p-2 text-left font-semibold text-muted-foreground">Unidade</th>
                                    <th className="p-2 text-right font-semibold text-muted-foreground">Faturamento</th>
                                    <th className="p-2 text-right font-semibold text-muted-foreground">Lucro</th>
                                    <th className="p-2 text-right font-semibold text-muted-foreground">CMV%</th>
                                    <th className="p-2 text-center font-semibold text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [...Array(3)].map((_, i) => <tr key={i}><td colSpan="5" className="p-3"><div className="h-4 bg-muted animate-pulse rounded-md"></div></td></tr>)
                                ) : (
                                    data?.unitPerformance.sort((a,b) => b.faturamento - a.faturamento).map(unit => (
                                        <tr key={unit.name} className="border-b last:border-b-0 hover:bg-muted/50 cursor-pointer" onClick={() => handleUnitClick(unit)}>
                                            <td className="p-2 font-medium">{unit.name}</td>
                                            <td className="p-2 text-right">{formatCurrency(unit.faturamento)}</td>
                                            <td className={`p-2 text-right font-semibold ${unit.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(unit.lucro)}</td>
                                            <td className="p-2 text-right">{formatPercent(unit.cmvPercent)}</td>
                                            <td className="p-2 flex justify-center">{getStatusIcon(unit.status)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                <Card>
                     <CardHeader><CardTitle>Alertas Financeiros</CardTitle></CardHeader>
                     <CardContent className="space-y-3">
                        {loading ? <p>Analisando...</p> : 
                            (data?.unitPerformance.filter(u => u.status !== 'green').length > 0 ?
                            data.unitPerformance.filter(u => u.status !== 'green').map(u => (
                                <div key={u.name} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-100/50 border border-yellow-200">
                                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5"/>
                                    <p className="text-sm text-yellow-800">
                                        <span className="font-bold">{u.name}:</span> {u.lucro < 0 ? 'Lucro negativo.' : 'Meta de faturamento abaixo do ideal.'}
                                    </p>
                                </div>
                            ))
                            : <p className="text-sm text-muted-foreground text-center py-10">Nenhum alerta crítico no momento. ✅</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Evolução Semanal do Faturamento (Últimas 6 Semanas)</CardTitle></CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data?.weekEvolution}>
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis tickFormatter={val => `R$${(val/1000)}k`} fontSize={12} />
                            <Tooltip formatter={val => formatCurrency(val)} />
                            <Bar dataKey="Faturamento" fill="#003366" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {selectedUnit && (
                <Dialog open={isUnitModalOpen} onOpenChange={setIsUnitModalOpen}>
                    <DialogContent className="max-w-4xl h-[80vh]">
                        <DialogHeader>
                            <DialogTitle>Movimentações - {selectedUnit.name}</DialogTitle>
                            <DialogDescription>
                                Detalhes das receitas e despesas para o período selecionado.
                            </DialogDescription>
                        </DialogHeader>
                        {loadingUnitMovements ? (
                            <div className="flex items-center justify-center h-full">
                                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <Tabs defaultValue="receitas" className="w-full h-full flex flex-col">
                                <TabsList>
                                    <TabsTrigger value="receitas">Receitas ({unitMovements.receitas.length})</TabsTrigger>
                                    <TabsTrigger value="despesas">Despesas ({unitMovements.despesas.length})</TabsTrigger>
                                </TabsList>
                                <div className="mt-4 flex-grow overflow-auto">
                                    <TabsContent value="receitas">
                                        <MovimentosTable title="Receitas" data={unitMovements.receitas} type="receita" onUndo={handleUndoClick} />
                                    </TabsContent>
                                    <TabsContent value="despesas">
                                        <MovimentosTable title="Despesas" data={unitMovements.despesas} type="despesa" onUndo={handleUndoClick} />
                                    </TabsContent>
                                </div>
                            </Tabs>
                        )}
                    </DialogContent>
                </Dialog>
            )}
             <AlertDialog open={isUndoAlertOpen} onOpenChange={setIsUndoAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação irá reverter o lançamento financeiro. O valor será estornado da conta bancária e o status voltará para "Pendente".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmUndo}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </motion.div>
    );
};

const MovimentosTable = ({ title, data, type, onUndo }) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data && data.length > 0 ? (
                            data.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{formatDate(item.payment_date)}</TableCell>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="outline" size="sm" onClick={() => onUndo(item, type)}>
                                            <Undo2 className="w-4 h-4 mr-1" /> Desfazer
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">Nenhuma movimentação encontrada.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
        <CardFooter>
            <div className="text-right w-full font-bold">
                Total: {formatCurrency(data.reduce((acc, item) => acc + item.value, 0))}
            </div>
        </CardFooter>
    </Card>
);

export default PainelExecutivo;