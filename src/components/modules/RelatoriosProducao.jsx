import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Input } from '@/components/ui/input';
    import { Button } from '@/components/ui/button';
    import { PieChart, Download } from 'lucide-react';
    import { format } from 'date-fns';
    import jsPDF from 'jspdf';
    import 'jspdf-autotable';

    const RelatoriosProducao = ({ user, companies, userCompanyAccess }) => {
        const { toast } = useToast();
        const [reports, setReports] = useState([]);
        const [loading, setLoading] = useState(false);
        const [filters, setFilters] = useState({ company_id: '', startDate: '', endDate: '' });
        
        const allowedCompanies = companies.filter(c => user.is_admin || userCompanyAccess.some(ua => ua.company_id === c.id));

        const fetchReports = useCallback(async () => {
            if (!filters.company_id) return;

            setLoading(true);
            try {
                let query = supabase.from('view_production_report').select('*').eq('company_id', filters.company_id);

                if (filters.startDate) query = query.gte('production_date', filters.startDate);
                if (filters.endDate) query = query.lte('production_date', filters.endDate);

                const { data, error } = await query.order('production_date', { ascending: false });

                if (error) throw error;
                setReports(data || []);
            } catch (error) {
                toast({ title: "Erro ao buscar relatórios", description: error.message, variant: "destructive" });
            } finally {
                setLoading(false);
            }
        }, [filters, toast]);

        useEffect(() => {
            if (allowedCompanies.length > 0 && !filters.company_id) {
                setFilters(f => ({ ...f, company_id: allowedCompanies[0].id }));
            }
        }, [allowedCompanies, filters.company_id]);

        useEffect(() => {
            fetchReports();
        }, [fetchReports]);
        
        const handleFilterChange = (field, value) => {
            setFilters(prev => ({ ...prev, [field]: value }));
        };

        const handleExportPDF = () => {
            if (reports.length === 0) {
              toast({ title: "Nenhum dado para exportar", variant: "warning" });
              return;
            }
            const doc = new jsPDF();
            const company = allowedCompanies.find(c => c.id === filters.company_id);
    
            doc.setFontSize(18);
            doc.text(`Relatório de Produção - ${company?.name || ''}`, 14, 22);
            doc.setFontSize(10);
            doc.text(`Período: ${format(new Date(filters.startDate || Date.now()), 'dd/MM/yy')} a ${format(new Date(filters.endDate || Date.now()), 'dd/MM/yy')}`, 14, 30);
    
            const tableColumn = ["Data", "Produto", "Lote", "Qtd. Planej.", "Qtd. Prod.", "Perda", "Eficiência (%)", "Status"];
            const tableRows = [];
    
            reports.forEach(report => {
              const reportData = [
                format(new Date(report.production_date), 'dd/MM/yyyy'),
                report.product_name,
                report.batch_code,
                report.quantity_planned,
                report.quantity_produced,
                report.loss,
                parseFloat(report.efficiency_percent).toFixed(2),
                report.status,
              ];
              tableRows.push(reportData);
            });
    
            doc.autoTable({
              head: [tableColumn],
              body: tableRows,
              startY: 40,
              headStyles: { fillColor: [22, 163, 74] },
            });
    
            doc.save(`relatorio-producao-${company?.name || 'empresa'}.pdf`);
            toast({ title: "Exportação concluída!" });
        };


        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold flex items-center gap-3"><PieChart /> Relatórios de Produção</h1>

                <div className="bg-card p-4 rounded-xl shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <select value={filters.company_id} onChange={e => handleFilterChange('company_id', e.target.value)} className="w-full p-2 border rounded-md bg-background">
                            <option value="">Selecione uma Empresa</option>
                            {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <Input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} />
                        <Input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} />
                        <Button onClick={handleExportPDF} disabled={loading}><Download className="w-4 h-4 mr-2" /> Exportar PDF</Button>
                    </div>
                </div>

                <div className="bg-card p-4 rounded-xl shadow-sm overflow-x-auto">
                    {loading ? <p>Carregando relatórios...</p> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="p-2 text-left font-semibold">Data</th>
                                    <th className="p-2 text-left font-semibold">Produto</th>
                                    <th className="p-2 text-left font-semibold">Lote</th>
                                    <th className="p-2 text-left font-semibold">Status</th>
                                    <th className="p-2 text-right font-semibold">Eficiência</th>
                                    <th className="p-2 text-right font-semibold">Perda</th>
                                    <th className="p-2 text-left font-semibold">Validade</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map(report => (
                                    <tr key={report.order_id} className="border-b last:border-b-0 hover:bg-muted/50">
                                        <td className="p-2">{format(new Date(report.production_date), 'dd/MM/yyyy')}</td>
                                        <td className="p-2">{report.product_name}</td>
                                        <td className="p-2">{report.batch_code}</td>
                                        <td className="p-2">{report.status}</td>
                                        <td className={`p-2 text-right font-bold ${report.efficiency_percent >= 98 ? 'text-green-600' : 'text-yellow-600'}`}>{parseFloat(report.efficiency_percent).toFixed(2)}%</td>
                                        <td className={`p-2 text-right font-bold ${report.loss > 0 ? 'text-red-600' : ''}`}>{report.loss}</td>
                                        <td className={`p-2 font-semibold ${report.validity_status === 'Vencido' ? 'text-red-600' : report.validity_status === 'Vence em breve' ? 'text-yellow-600' : 'text-green-600'}`}>
                                            {report.validity_status} ({format(new Date(report.expiration_date), 'dd/MM/yy')})
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        );
    }

    export default RelatoriosProducao;