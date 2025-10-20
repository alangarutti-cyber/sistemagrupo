import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/use-toast';
import { Target, Save, Copy, Wand2, TrendingUp, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const MetasProjecoe = () => {
    const { user, companies } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [metas, setMetas] = useState([]);
    const [realizado, setRealizado] = useState({});
    const [projections, setProjections] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [historyData, setHistoryData] = useState([]);
    
    const [currentCompanyId, setCurrentCompanyId] = useState('');
    const [currentDate, setCurrentDate] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

    const [formData, setFormData] = useState({
        meta_faturamento: '',
        meta_despesas: '',
        meta_lucro: '',
        meta_cmv_percent: '',
        observacoes: ''
    });

    const allowedCompanies = useMemo(() => {
        if (!user || !companies) return [];
        if (user.is_admin) return companies;
        return companies.filter(c => user.company_ids?.some(uc => uc.company_id === c.id));
    }, [user, companies]);

    useEffect(() => {
        if (allowedCompanies.length > 0 && !currentCompanyId) {
            setCurrentCompanyId(allowedCompanies[0].id);
        }
    }, [allowedCompanies, currentCompanyId]);

    const fetchData = useCallback(async () => {
        if (!currentCompanyId) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const { month, year } = currentDate;
        const mesReferencia = `${year}-${String(month).padStart(2, '0')}-01`;

        try {
            // Fetch Metas
            const { data: metaData, error: metaError } = await supabase
                .from('metas_financeiras')
                .select('*')
                .eq('company_id', currentCompanyId)
                .eq('mes', month)
                .eq('ano', year)
                .single();
            if (metaError && metaError.code !== 'PGRST116') throw metaError;

            if (metaData) {
                setFormData({
                    meta_faturamento: metaData.meta_faturamento || '',
                    meta_despesas: metaData.meta_despesas || '',
                    meta_lucro: metaData.meta_lucro || '',
                    meta_cmv_percent: metaData.meta_cmv_percent || '',
                    observacoes: metaData.observacoes || ''
                });
            } else {
                 setFormData({ meta_faturamento: '', meta_despesas: '', meta_lucro: '', meta_cmv_percent: '', observacoes: '' });
            }

            // Fetch Realizado
            const { data: dreData, error: dreError } = await supabase.rpc('get_dre_data', {
              p_company_ids: [currentCompanyId],
              p_month: mesReferencia
            });
            if (dreError) throw dreError;
            setRealizado(dreData);

            // Fetch Projections
            const { data: history, error: historyError } = await supabase.rpc('get_financial_summary_last_months', {
              p_company_ids: [currentCompanyId],
              p_months_count: 6
            });
            if (historyError) throw historyError;
            
            const avgRevenue = history.reduce((sum, item) => sum + item.total_revenue, 0) / history.length;
            const nextMonths = [1, 2, 3].map(i => addMonths(new Date(), i));

            setProjections(nextMonths.map(date => ({
                month: format(date, 'MMM/yy', { locale: ptBR }),
                Conservador: avgRevenue * 1.03,
                Realista: avgRevenue * 1.06,
                Otimista: avgRevenue * 1.10
            })));

            // Fetch History
            const { data: allMetas, error: allMetasError } = await supabase
              .from('metas_financeiras')
              .select('*, companies(name)')
              .eq('company_id', currentCompanyId)
              .order('ano', { ascending: false })
              .order('mes', { ascending: false });
            if(allMetasError) throw allMetasError;

            const historyPromises = allMetas.map(async (meta) => {
                const { data: dre } = await supabase.rpc('get_dre_data', {
                    p_company_ids: [meta.company_id],
                    p_month: `${meta.ano}-${String(meta.mes).padStart(2, '0')}-01`
                });
                return { ...meta, real: dre };
            });
            const fullHistory = await Promise.all(historyPromises);
            setHistoryData(fullHistory);


        } catch (error) {
            toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [currentCompanyId, currentDate, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const newAlerts = [];
        if (!realizado || !formData) return;
        const { receita_bruta, lucro_liquido, cmv } = realizado;
        
        const cmvPercent = receita_bruta > 0 ? (cmv / receita_bruta) : 0;
        if (cmvPercent > 0.35) {
            newAlerts.push({ type: 'danger', message: `CMV Real em ${ (cmvPercent * 100).toFixed(2)}%, acima do limite de 35%.`, icon: AlertTriangle });
        }

        const profitMargin = receita_bruta > 0 ? (lucro_liquido / receita_bruta) : 0;
        if (profitMargin < 0.10 && profitMargin > 0) {
            newAlerts.push({ type: 'warning', message: `Margem de Lucro em ${(profitMargin * 100).toFixed(2)}%, abaixo do ideal de 10%.`, icon: AlertTriangle });
        }
        
        const achievement = formData.meta_faturamento > 0 ? (receita_bruta / formData.meta_faturamento) : 0;
        if (achievement >= 1) {
            newAlerts.push({ type: 'success', message: `Meta de faturamento atingida em ${(achievement * 100).toFixed(2)}%!`, icon: CheckCircle2 });
        }
        setAlerts(newAlerts);
    }, [realizado, formData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveMeta = async (e) => {
        e.preventDefault();
        const { month, year } = currentDate;
        const { meta_faturamento, meta_despesas, meta_lucro, meta_cmv_percent, observacoes } = formData;
        
        const { error } = await supabase.from('metas_financeiras').upsert({
            company_id: currentCompanyId, mes: month, ano: year,
            meta_faturamento: meta_faturamento || null,
            meta_despesas: meta_despesas || null,
            meta_lucro: meta_lucro || null,
            meta_cmv_percent: meta_cmv_percent || null,
            observacoes: observacoes || null,
            updated_at: new Date().toISOString()
        }, { onConflict: 'company_id,mes,ano' }).select();

        if (error) {
            toast({ title: 'Erro ao salvar meta', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Meta salva com sucesso!', variant: 'success' });
            fetchData();
        }
    };
    
    const copyLastMonth = async () => {
        const lastMonthDate = subMonths(new Date(currentDate.year, currentDate.month - 1), 1);
        const lastMes = lastMonthDate.getMonth() + 1;
        const lastAno = lastMonthDate.getFullYear();

        const { data, error } = await supabase.from('metas_financeiras')
            .select('*')
            .eq('company_id', currentCompanyId)
            .eq('mes', lastMes)
            .eq('ano', lastAno)
            .single();

        if (error || !data) {
            toast({ title: 'Nenhuma meta encontrada para o mês anterior', variant: 'destructive' });
        } else {
            setFormData(prev => ({
                ...prev,
                meta_faturamento: data.meta_faturamento || '',
                meta_despesas: data.meta_despesas || '',
                meta_lucro: data.meta_lucro || '',
                meta_cmv_percent: data.meta_cmv_percent || '',
                observacoes: `Copiado de ${lastMes}/${lastAno}`
            }));
            toast({ title: 'Metas do mês anterior copiadas!' });
        }
    };
    
    const renderKpiCard = (title, metaValue, realValue) => {
        const meta = parseFloat(metaValue) || 0;
        const real = parseFloat(realValue) || 0;
        const diff = real - meta;
        const diffPercent = meta > 0 ? (diff / meta) * 100 : 0;
        const achievement = meta > 0 ? (real / meta) * 100 : 0;

        let diffColor = "text-gray-500";
        if (diff > 0) diffColor = "text-green-500";
        if (diff < 0) diffColor = "text-red-500";

        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-2xl font-bold">{formatCurrency(real)}</p>
                    <p className="text-xs text-muted-foreground">Meta: {formatCurrency(meta)}</p>
                </CardContent>
                <CardFooter className="text-xs flex-col items-start">
                    <div className={`font-semibold flex items-center ${diffColor}`}>
                        <TrendingUp className="w-4 h-4 mr-1" />
                        <span>{formatCurrency(diff)} ({diffPercent.toFixed(2)}%)</span>
                    </div>
                    <p className="text-muted-foreground mt-1">Atingido: {achievement.toFixed(2)}%</p>
                </CardFooter>
            </Card>
        )
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><Target className="w-8 h-8 text-primary"/>Metas e Projeções</h1>
                <p className="text-muted-foreground mt-1">Defina, acompanhe e projete a saúde financeira do seu negócio.</p>
            </header>

            <div className="flex gap-4 items-center">
                <select value={currentCompanyId} onChange={e => setCurrentCompanyId(e.target.value)} className="p-2 border rounded-md bg-background focus:ring-primary focus:border-primary">
                    {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                 <Input type="month" value={`${currentDate.year}-${String(currentDate.month).padStart(2, '0')}`} onChange={e => {
                    const [year, month] = e.target.value.split('-');
                    setCurrentDate({ year: parseInt(year), month: parseInt(month) });
                }} className="w-48" />
            </div>

            <div className="flex flex-wrap gap-2">
                {alerts.map((alert, idx) => {
                    const colors = {
                        danger: 'bg-red-100 text-red-800 border-red-300',
                        warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                        success: 'bg-green-100 text-green-800 border-green-300'
                    };
                    return(
                        <div key={idx} className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border ${colors[alert.type]}`}>
                            <alert.icon className="w-5 h-5"/>
                            <span>{alert.message}</span>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderKpiCard("Faturamento", formData.meta_faturamento, realizado?.receita_bruta)}
                {renderKpiCard("Despesas", formData.meta_despesas, realizado?.despesas_operacionais)}
                {renderKpiCard("Lucro Líquido", formData.meta_lucro, realizado?.lucro_liquido)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">Projeção de Faturamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={projections}>
                                <XAxis dataKey="month" fontSize={12}/>
                                <YAxis tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} fontSize={12}/>
                                <Tooltip formatter={(val) => formatCurrency(val)} />
                                <Legend />
                                <Line type="monotone" dataKey="Conservador" stroke="#facc15" strokeDasharray="5 5" />
                                <Line type="monotone" dataKey="Realista" stroke="#4ade80" strokeWidth={2}/>
                                <Line type="monotone" dataKey="Otimista" stroke="#3b82f6" strokeDasharray="3 3"/>
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Definir Metas para {currentDate.month}/{currentDate.year}</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleSaveMeta} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><Label>Meta Faturamento (R$)</Label><Input type="number" name="meta_faturamento" value={formData.meta_faturamento} onChange={handleInputChange} /></div>
                                <div><Label>Meta Despesas (R$)</Label><Input type="number" name="meta_despesas" value={formData.meta_despesas} onChange={handleInputChange} /></div>
                                <div><Label>Meta Lucro (R$)</Label><Input type="number" name="meta_lucro" value={formData.meta_lucro} onChange={handleInputChange} /></div>
                                <div><Label>Meta CMV (%)</Label><Input type="number" name="meta_cmv_percent" value={formData.meta_cmv_percent} onChange={handleInputChange} /></div>
                            </div>
                            <div>
                                <Label>Observações</Label>
                                <Input name="observacoes" value={formData.observacoes} onChange={handleInputChange} />
                            </div>
                             <div className="flex flex-wrap gap-2 justify-end pt-4">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="secondary"><History className="w-4 h-4 mr-2"/>Ver Histórico</Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl">
                                        <DialogHeader><DialogTitle>Histórico de Metas e Resultados</DialogTitle></DialogHeader>
                                        <div className="max-h-[60vh] overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Mês/Ano</TableHead>
                                                        <TableHead>Meta Receita</TableHead>
                                                        <TableHead>Real Receita</TableHead>
                                                        <TableHead>% Atingido</TableHead>
                                                        <TableHead>Meta Lucro</TableHead>
                                                        <TableHead>Real Lucro</TableHead>
                                                        <TableHead>Real CMV %</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {historyData.map(item => {
                                                        const ach = item.meta_faturamento > 0 ? (item.real?.receita_bruta || 0) / item.meta_faturamento : 0;
                                                        const cmvPerc = item.real?.receita_bruta > 0 ? (item.real?.cmv || 0) / item.real.receita_bruta : 0;
                                                        return (
                                                            <TableRow key={item.id}>
                                                                <TableCell>{item.mes}/{item.ano}</TableCell>
                                                                <TableCell>{formatCurrency(item.meta_faturamento)}</TableCell>
                                                                <TableCell>{formatCurrency(item.real?.receita_bruta)}</TableCell>
                                                                <TableCell>{(ach * 100).toFixed(2)}%</TableCell>
                                                                <TableCell>{formatCurrency(item.meta_lucro)}</TableCell>
                                                                <TableCell>{formatCurrency(item.real?.lucro_liquido)}</TableCell>
                                                                <TableCell>{(cmvPerc * 100).toFixed(2)}%</TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <Button type="button" variant="outline" onClick={copyLastMonth}><Copy className="w-4 h-4 mr-2"/>Copiar Mês Anterior</Button>
                                <Button type="submit"><Save className="w-4 h-4 mr-2"/>Salvar Meta</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    );
};

export default MetasProjecoe;