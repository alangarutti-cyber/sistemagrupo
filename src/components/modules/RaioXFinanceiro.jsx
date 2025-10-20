
    import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useUser } from '@/contexts/UserContext';
    import { useToast } from '@/components/ui/use-toast';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
    import { Upload, Radar, History, Search, FileDown, UtensilsCrossed, FileClock, CheckCircle, XCircle, AlertTriangle, Landmark, Edit, Save, Loader2 } from 'lucide-react';
    import { read, utils } from 'xlsx';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

    const RaioXFinanceiro = () => {
        const { user, companies, userCompanyAccess } = useUser();
        const { toast } = useToast();
        const [activeTab, setActiveTab] = useState('stone');
        const [loading, setLoading] = useState(false);
        const [uploading, setUploading] = useState(false);
        const [ifoodFile, setIfoodFile] = useState(null);
        const [uploadStatus, setUploadStatus] = useState({ status: 'idle', message: '' });

        const [conferenciaData, setConferenciaData] = useState([]);
        const [importLogs, setImportLogs] = useState([]);
        const [stoneRecebimentos, setStoneRecebimentos] = useState([]);
        const [bankAccounts, setBankAccounts] = useState([]);
        const [editingStone, setEditingStone] = useState(null);
        const [isStoneModalOpen, setIsStoneModalOpen] = useState(false);

        const [filters, setFilters] = useState({
            company: 'all',
            startDate: '',
            endDate: '',
            stoneStatus: 'all',
        });

        const allowedCompanies = useMemo(() => {
            if (!user || !companies) return [];
            if (user.is_admin) return companies;
            const allowedCompanyIds = userCompanyAccess?.map(access => access.company_id) || [];
            return companies.filter(c => allowedCompanyIds.includes(c.id));
        }, [user, companies, userCompanyAccess]);

        const allowedCompanyIds = useMemo(() => allowedCompanies.map(c => c.id), [allowedCompanies]);

        const fetchData = useCallback(async () => {
            setLoading(true);
            let companyIds = filters.company === 'all' ? allowedCompanyIds : [parseInt(filters.company)];
            if (companyIds.length === 0) {
                setConferenciaData([]);
                setImportLogs([]);
                setStoneRecebimentos([]);
                setLoading(false);
                return;
            }

            try {
                let conferenciaQuery = supabase.from('ifood_conferencia_view').select('*').in('company_id', companyIds);
                let logsQuery = supabase.from('ifood_logs_view').select('*').in('company_id', companyIds);
                let stoneQuery = supabase.from('recebimentos_stone_view').select('*').in('company_id', companyIds);
                
                const { data: accountsData, error: accountsError } = await supabase.from('bank_accounts').select('id, bank_name, account_number');
                if (accountsError) throw accountsError;
                setBankAccounts(accountsData || []);

                if (filters.startDate) {
                    conferenciaQuery = conferenciaQuery.gte('data', filters.startDate);
                    logsQuery = logsQuery.gte('data_importacao', filters.startDate);
                    stoneQuery = stoneQuery.gte('data_venda', filters.startDate);
                }
                if (filters.endDate) {
                    conferenciaQuery = conferenciaQuery.lte('data', filters.endDate);
                    logsQuery = logsQuery.lte('data_importacao', filters.endDate);
                    stoneQuery = stoneQuery.lte('data_venda', filters.endDate);
                }
                if (filters.stoneStatus !== 'all') {
                    stoneQuery = stoneQuery.eq('status', filters.stoneStatus);
                }

                const [conferenciaRes, logsRes, stoneRes] = await Promise.all([
                    conferenciaQuery.order('data', { ascending: false }),
                    logsQuery.order('data_importacao', { ascending: false }),
                    stoneQuery.order('data_venda', { ascending: false }),
                ]);

                if (conferenciaRes.error) throw conferenciaRes.error;
                if (logsRes.error) throw logsRes.error;
                if (stoneRes.error) throw stoneRes.error;

                setConferenciaData(conferenciaRes.data || []);
                setImportLogs(logsRes.data || []);
                setStoneRecebimentos(stoneRes.data || []);

            } catch (error) {
                toast({ title: "Erro ao buscar dados", description: error.message, variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        }, [filters, allowedCompanyIds, toast]);

        useEffect(() => {
            fetchData();
        }, [fetchData]);
        
        useEffect(() => {
            const channel = supabase.channel('ifood_import_logs_notifications')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ifood_import_logs' }, (payload) => {
                    toast({
                        title: "Processamento iFood Concluído!",
                        description: payload.new.observacoes,
                    });
                    setUploadStatus({ status: 'completed', message: payload.new.observacoes });
                    fetchData();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }, [fetchData, toast]);


        const handleIfoodFileChange = (e) => {
            if (e.target.files && e.target.files[0]) {
                setIfoodFile(e.target.files[0]);
                setUploadStatus({ status: 'idle', message: '' });
            }
        };

        const handleUpload = async () => {
            if (!ifoodFile) {
                toast({ title: 'Nenhum arquivo selecionado', variant: 'destructive' });
                return;
            }
            setUploading(true);
            setUploadStatus({ status: 'processing', message: 'Lendo e enviando planilha...' });

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = utils.sheet_to_json(worksheet, { defval: "" });

                    if (json.length === 0) throw new Error('Planilha iFood está vazia ou em formato inválido.');

                    const restaurantNameKeys = ["Restaurante", "Loja", "Estabelecimento", "Merchant"];
                    let restaurantNameKey = restaurantNameKeys.find(key => json[0][key]);
                    let restaurantName = restaurantNameKey ? json[0][restaurantNameKey] : null;

                    let company;
                    if (restaurantName) {
                        company = companies.find(c => c.name.toLowerCase() === restaurantName.toLowerCase());
                    } else if (filters.company !== 'all') {
                        company = companies.find(c => c.id === parseInt(filters.company));
                        if (company) restaurantName = company.name;
                    }

                    if (!company) {
                        throw new Error(`Restaurante não identificado. Selecione a empresa correta no filtro ou verifique a planilha.`);
                    }

                    const dataToInsert = json.map(row => ({
                        company_id: company.id,
                        arquivo_nome: ifoodFile.name,
                        data_pedido: row["Data do pedido"] || row["Data Pedido"],
                        tipo_transacao: row["Tipo de transação"],
                        categoria: row["Categoria"],
                        descricao: row["Descrição"],
                        valor_bruto: String(row["Valor bruto"] || row["Bruto"] || row["Valor bruto do item"] || 0),
                        valor_taxa: String(row["Taxas"] || row["Taxa"] || row["Valor da taxa"] || 0),
                        valor_liquido: String(row["Valor líquido"] || row["Líquido"] || 0),
                        pedido_id: row["Pedido associado"] || row["ID do pedido"],
                        lote_id: row["Lote"] || row["ID do repasse (lote)"],
                        nome_restaurante: restaurantName,
                    }));

                    const { error: rawInsertError } = await supabase.from('ifood_import_raw').insert(dataToInsert);
                    if (rawInsertError) throw rawInsertError;

                    setUploadStatus({ status: 'waiting', message: `Arquivo enviado. Aguardando processamento automático... (${dataToInsert.length} linhas)` });
                    toast({ title: 'Planilha Recebida', description: 'O processamento foi iniciado em segundo plano. Você será notificado ao final.' });

                } catch (error) {
                    setUploadStatus({ status: 'error', message: error.message });
                    toast({ title: 'Erro na Importação', description: error.message, variant: 'destructive' });
                } finally {
                    setUploading(false);
                    setIfoodFile(null);
                }
            };
            reader.readAsArrayBuffer(ifoodFile);
        };

        const handleOpenStoneModal = (item) => {
            setEditingStone({
                ...item,
                valor_confirmado: item.valor_confirmado || item.valor_liquido,
                conta_id: item.conta_id || ''
            });
            setIsStoneModalOpen(true);
        };

        const handleConfirmStone = async () => {
            if (!editingStone) return;
            setLoading(true);
            
            const valorConfirmado = parseFloat(editingStone.valor_confirmado);
            const valorLiquido = parseFloat(editingStone.valor_liquido);
            let status = 'Pendente';
            if (Math.abs(valorConfirmado - valorLiquido) < 0.01) {
                status = 'Confirmado';
            } else {
                status = 'Divergente';
            }

            const updateData = {
                valor_confirmado: valorConfirmado,
                conta_id: editingStone.conta_id,
                status: status,
                confirmado_por: user.name,
                confirmado_em: new Date().toISOString(),
            };

            const { error } = await supabase.from('stone_recebimentos').update(updateData).eq('id', editingStone.id);

            if (error) {
                toast({ title: 'Erro ao confirmar recebimento', description: error.message, variant: 'destructive' });
                setLoading(false);
                return;
            }

            const { error: dreError } = await supabase.from('dre_entries').insert({
                date: new Date().toISOString().split('T')[0],
                description: `Recebimento Cartão - Venda ${formatDate(editingStone.data_venda)}`,
                amount: valorConfirmado,
                company_id: editingStone.company_id,
                dre_group_id: '9eb73907-d1db-4df2-8879-4565e1b15f0f', // Receita Bruta
            });

            if (dreError) {
                toast({ title: 'Recebimento confirmado, mas falha ao lançar no DRE', description: dreError.message, variant: 'destructive' });
            } else {
                toast({ title: 'Recebimento confirmado e lançado no DRE com sucesso!' });
            }

            setIsStoneModalOpen(false);
            setEditingStone(null);
            fetchData();
        };

        const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
        const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
        const formatDateTime = (dateStr) => dateStr ? new Date(dateStr).toLocaleString('pt-BR', { timeZone: 'UTC' }) : '-';

        const getStatusRowClass = (status) => {
            if (!status) return '';
            const s = status.toLowerCase();
            if (s.includes('✅') || s.includes('confirmado')) return 'bg-green-500/10';
            if (s.includes('⚠️') || s.includes('divergente')) return 'bg-yellow-500/10';
            if (s.includes('❌') || s.includes('pendente')) return 'bg-red-500/10';
            return '';
        };

        const renderTable = (data, columns, onRowClick) => (
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>{columns.map(c => <th key={c.key} scope="col" className="px-6 py-3">{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={columns.length} className="text-center p-8"><Loader2 className="mx-auto animate-spin" /></td></tr>
                        ) : data.length === 0 ? (
                            <tr><td colSpan={columns.length} className="text-center p-8">Nenhum dado encontrado.</td></tr>
                        ) : (
                            data.map((row, index) => (
                                <tr key={row.id || index} className={`border-b dark:border-gray-700 ${onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''} ${columns.some(c => c.key === 'status') ? getStatusRowClass(row.status) : ''}`} onClick={() => onRowClick && onRowClick(row)}>
                                    {columns.map(col => (
                                        <td key={col.key} className="px-6 py-4">{col.render ? col.render(row) : row[col.key]}</td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        );

        const conferenciaColumns = [
            { key: 'data', label: 'Data', render: (row) => formatDate(row.data) },
            { key: 'empresa', label: 'Empresa' },
            { key: 'valor_ifood_liquido', label: 'Valor iFood (Líq.)', render: (row) => formatCurrency(row.valor_ifood_liquido) },
            { key: 'valor_caixa_ifood', label: 'Valor Caixa (iFood)', render: (row) => formatCurrency(row.valor_caixa_ifood) },
            { key: 'diferenca', label: 'Diferença', render: (row) => <span className={row.diferenca !== 0 ? 'font-bold' : ''}>{formatCurrency(row.diferenca)}</span> },
            { key: 'status', label: 'Status', render: (row) => <span className="font-semibold">{row.status}</span> },
        ];

        const logsColumns = [
            { key: 'data_importacao', label: 'Data', render: (row) => formatDateTime(row.data_importacao) },
            { key: 'empresa', label: 'Empresa' },
            { key: 'nome_restaurante', label: 'Restaurante' },
            { key: 'arquivo_nome', label: 'Arquivo' },
            { key: 'total_linhas', label: 'Linhas' },
            { key: 'total_processadas', label: 'Processadas' },
            { key: 'total_ignoradas', label: 'Ignoradas' },
            { key: 'percentual_sucesso', label: '% Sucesso', render: (row) => `${parseFloat(row.percentual_sucesso || 0).toFixed(2)}%` },
            { key: 'observacoes', label: 'Observações' },
        ];

        const stoneColumns = [
            { key: 'empresa', label: 'Empresa' },
            { key: 'data_venda', label: 'Data Venda', render: (row) => formatDate(row.data_venda) },
            { key: 'data_recebimento', label: 'Data Prevista', render: (row) => formatDate(row.data_recebimento) },
            { key: 'valor_bruto', label: 'Valor Bruto', render: (row) => formatCurrency(row.valor_bruto) },
            { key: 'valor_liquido', label: 'Valor Líquido', render: (row) => <span className="font-bold">{formatCurrency(row.valor_liquido)}</span> },
            { key: 'valor_confirmado', label: 'Confirmado', render: (row) => formatCurrency(row.valor_confirmado) },
            { key: 'conta_destino', label: 'Conta Destino' },
            { key: 'status', label: 'Status', render: (row) => <span className="font-semibold">{row.status}</span> },
            { key: 'actions', label: 'Ações', render: (row) => <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenStoneModal(row); }}><Edit className="w-4 h-4" /></Button> },
        ];
        
        const stoneSummary = useMemo(() => {
          const summaryMap = new Map();
          allowedCompanies.forEach(c => {
            summaryMap.set(c.id, {
              company_id: c.id,
              name: c.name,
              bruto: 0,
              liquido: 0,
              confirmado: 0
            });
          });

          stoneRecebimentos.forEach(item => {
            if(item.company_id && summaryMap.has(item.company_id)) {
                const summary = summaryMap.get(item.company_id);
                summary.bruto += item.valor_bruto || 0;
                summary.liquido += item.valor_liquido || 0;
                summary.confirmado += item.valor_confirmado || 0;
            }
          });

          return Array.from(summaryMap.values()).filter(s => s.bruto > 0 || s.liquido > 0 || s.confirmado > 0);
        }, [stoneRecebimentos, allowedCompanies]);


        const UploadStatus = () => {
            if (uploadStatus.status === 'idle') return null;
            const icons = {
                processing: <FileClock className="w-5 h-5 text-blue-500 animate-spin" />,
                waiting: <FileClock className="w-5 h-5 text-yellow-500 animate-pulse" />,
                completed: <CheckCircle className="w-5 h-5 text-green-500" />,
                error: <XCircle className="w-5 h-5 text-red-500" />,
            };
            const colors = { processing: 'blue', waiting: 'yellow', completed: 'green', error: 'red' };
            const color = colors[uploadStatus.status];

            return (
                <div className={`mt-4 p-3 rounded-lg border border-${color}-500/50 bg-${color}-500/10 flex items-center gap-3`}>
                    {icons[uploadStatus.status]}
                    <p className={`text-sm text-${color}-700 dark:text-${color}-300`}>{uploadStatus.message}</p>
                </div>
            );
        };

        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <header>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><Radar className="w-8 h-8 text-primary" />Raio-X Financeiro</h1>
                    <p className="text-muted-foreground mt-1">Conferência automática de repasses do iFood e operadoras de cartão.</p>
                </header>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="ifood"><UtensilsCrossed className="w-4 h-4 mr-2" />Importar iFood</TabsTrigger>
                        <TabsTrigger value="conferencia"><Radar className="w-4 h-4 mr-2" />Conferência iFood</TabsTrigger>
                        <TabsTrigger value="stone"><Landmark className="w-4 h-4 mr-2" />Recebimentos Cartão</TabsTrigger>
                        <TabsTrigger value="historico"><History className="w-4 h-4 mr-2" />Histórico de Importações</TabsTrigger>
                    </TabsList>
                    <Card className="mt-4 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            <div className="lg:col-span-1">
                                <Label>Empresa</Label>
                                <select value={filters.company} onChange={e => setFilters(f => ({ ...f, company: e.target.value }))} className="w-full p-2 mt-1 border rounded-md bg-background">
                                    <option value="all">Todas</option>
                                    {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div><Label>Data Início</Label><Input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} className="mt-1" /></div>
                            <div><Label>Data Fim</Label><Input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} className="mt-1" /></div>
                            <Button onClick={fetchData} disabled={loading}>{loading ? <Loader2 className="animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}Filtrar</Button>
                        </div>
                        {activeTab === 'stone' && (
                            <div className="mt-4">
                                <Label>Status Recebimento</Label>
                                <select value={filters.stoneStatus} onChange={e => setFilters(f => ({ ...f, stoneStatus: e.target.value }))} className="w-full md:w-1/4 p-2 mt-1 border rounded-md bg-background">
                                    <option value="all">Todos</option>
                                    <option value="Pendente">🔸 Pendente</option>
                                    <option value="Confirmado">✅ Confirmado</option>
                                    <option value="Divergente">⚠️ Divergente</option>
                                </select>
                            </div>
                        )}
                    </Card>

                    <TabsContent value="ifood" className="mt-6">
                        <Card>
                            <CardHeader><CardTitle>Importar Planilha Financeira iFood</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-muted-foreground">Faça o upload do relatório financeiro original (.xlsx) exportado do portal iFood. O sistema processará automaticamente.</p>
                                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                                    <Input id="ifood-upload" type="file" onChange={handleIfoodFileChange} accept=".xlsx" className="hidden" />
                                    <Label htmlFor="ifood-upload" className="cursor-pointer">
                                        <Upload className="w-8 h-8 mx-auto text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-600">{ifoodFile ? ifoodFile.name : "Clique ou arraste o arquivo aqui"}</p>
                                    </Label>
                                </div>
                                {filters.company === 'all' && (
                                    <div className="flex items-center gap-2 text-yellow-600">
                                        <AlertTriangle className="w-4 h-4" />
                                        <p className="text-xs">Se a planilha não tiver o nome do restaurante, selecione uma empresa no filtro acima.</p>
                                    </div>
                                )}
                                <Button onClick={handleUpload} disabled={!ifoodFile || uploading}>
                                    {uploading ? <Loader2 className="animate-spin mr-2" /> : <><Upload className="w-4 h-4 mr-2" />Enviar e Processar</>}
                                </Button>
                                <UploadStatus />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="conferencia" className="mt-6">
                        <Card>
                            <CardHeader><CardTitle>Conferência Automática: iFood vs. Caixa</CardTitle></CardHeader>
                            <CardContent>{renderTable(conferenciaData, conferenciaColumns)}</CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="stone" className="mt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {stoneSummary.map(s => (
                                <Card key={s.company_id}>
                                    <CardHeader>
                                        <CardTitle className="text-lg">{s.name}</CardTitle>
                                        <CardDescription>Resumo do Período</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="flex justify-between"><span>Bruto:</span> <span className="font-mono">{formatCurrency(s.bruto)}</span></div>
                                        <div className="flex justify-between font-bold"><span>Líquido:</span> <span className="font-mono text-primary">{formatCurrency(s.liquido)}</span></div>
                                        <div className="flex justify-between"><span>Confirmado:</span> <span className="font-mono">{formatCurrency(s.confirmado)}</span></div>
                                        <div className={`flex justify-between font-bold ${(s.liquido - s.confirmado) !== 0 ? 'text-destructive' : 'text-green-600'}`}><span>Diferença:</span> <span className="font-mono">{formatCurrency(s.liquido - s.confirmado)}</span></div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <Card>
                            <CardHeader><CardTitle>Detalhes dos Recebimentos de Cartão</CardTitle></CardHeader>
                            <CardContent>{renderTable(stoneRecebimentos, stoneColumns, handleOpenStoneModal)}</CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="historico" className="mt-6">
                        <Card>
                            <CardHeader className="flex flex-row justify-between items-center">
                                <CardTitle>Histórico de Importações iFood</CardTitle>
                                <Button variant="outline" onClick={() => toast({ title: "Em breve!", description: "A exportação de relatórios estará disponível em breve." })}><FileDown className="w-4 h-4 mr-2" />Exportar</Button>
                            </CardHeader>
                            <CardContent>{renderTable(importLogs, logsColumns)}</CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Dialog open={isStoneModalOpen} onOpenChange={setIsStoneModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirmar Recebimento</DialogTitle>
                        </DialogHeader>
                        {editingStone && (
                            <div className="space-y-4 py-4">
                                <p><strong>Empresa:</strong> {editingStone.empresa}</p>
                                <p><strong>Data Venda:</strong> {formatDate(editingStone.data_venda)}</p>
                                <p><strong>Data Prevista:</strong> {formatDate(editingStone.data_recebimento)}</p>
                                <p><strong>Valor Bruto:</strong> {formatCurrency(editingStone.valor_bruto)}</p>
                                <p className="font-bold"><strong>Valor Líquido Previsto:</strong> {formatCurrency(editingStone.valor_liquido)}</p>
                                <div>
                                    <Label htmlFor="valor_confirmado">Valor Confirmado</Label>
                                    <Input id="valor_confirmado" type="number" value={editingStone.valor_confirmado} onChange={(e) => setEditingStone(s => ({ ...s, valor_confirmado: e.target.value }))} />
                                </div>
                                <div>
                                    <Label htmlFor="conta_id">Conta de Destino</Label>
                                    <select id="conta_id" value={editingStone.conta_id} onChange={(e) => setEditingStone(s => ({ ...s, conta_id: e.target.value }))} className="w-full p-2 mt-1 border rounded-md bg-background">
                                        <option value="">Selecione uma conta</option>
                                        {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bank_name} - {acc.account_number}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsStoneModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleConfirmStone} disabled={loading}>{loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}Confirmar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </motion.div>
        );
    };

    export default RaioXFinanceiro;
  