import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, FilePlus2, Eye, FileText, Search, Trash2, AlertTriangle, FileKey2, Plus, Save, EyeOff, Power, CheckCircle, Send, Package, BarChart3, Filter, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { useUser } from '@/contexts/UserContext';
import { Checkbox } from '@/components/ui/checkbox';

const SuperNota = () => {
    const { user, companies } = useUser();
    const { toast } = useToast();
    const [certificates, setCertificates] = useState([]);
    const [loadingCerts, setLoadingCerts] = useState(true);
    const [companiesWithCerts, setCompaniesWithCerts] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(true);
    const [activeTab, setActiveTab] = useState('entrada');

    const fetchCertificates = useCallback(async () => {
        setLoadingCerts(true);
        const { data, error } = await supabase
            .from('digital_certificates')
            .select('id, company_id, valid_to, last_sefaz_test, companies(name, cnpj)')
            .order('created_at', { ascending: false });

        if (error) {
            toast({ title: "Erro ao buscar certificados", description: error.message, variant: "destructive" });
        } else {
            setCertificates(data || []);
        }
        setLoadingCerts(false);
    }, [toast]);

    useEffect(() => {
        fetchCertificates();
    }, [fetchCertificates]);

    const fetchCompaniesWithCerts = useCallback(() => {
        setLoadingCompanies(true);
        const now = new Date();
        const validCertCompanyIds = certificates
            .filter(cert => new Date(cert.valid_to) > now)
            .map(cert => cert.company_id);

        const userAllowedCompanies = user.is_admin 
            ? companies 
            : companies.filter(c => user.company_ids?.some(access => access.company_id === c.id));

        const filteredCompanies = userAllowedCompanies.filter(c => validCertCompanyIds.includes(c.id));
        
        setCompaniesWithCerts(filteredCompanies);
        setLoadingCompanies(false);
    }, [companies, user.is_admin, user.company_ids, certificates]);

    useEffect(() => {
        if (!loadingCerts) {
            fetchCompaniesWithCerts();
        }
    }, [loadingCerts, fetchCompaniesWithCerts]);

    const tabInfo = {
        entrada: { icon: <Download className="w-5 h-5" />, title: 'Notas de Entrada' },
        saida: { icon: <Send className="w-5 h-5" />, title: 'Notas de Saída' },
        certificados: { icon: <FileKey2 className="w-5 h-5" />, title: 'Certificados Digitais' },
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
        >
            <header className="bg-card shadow-sm rounded-xl p-4 md:p-6 border">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">{tabInfo[activeTab].icon}</div>
                            Super Nota: {tabInfo[activeTab].title}
                        </h1>
                        <p className="text-muted-foreground mt-1">Gerencie, importe e emita suas notas fiscais de forma centralizada.</p>
                    </div>
                </div>
            </header>
            
            <Tabs defaultValue="entrada" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 bg-card p-1 h-auto rounded-lg border">
                    <TabsTrigger value="entrada" className="py-2.5"><Download className="w-4 h-4 mr-2" />Entrada</TabsTrigger>
                    <TabsTrigger value="saida" className="py-2.5"><Send className="w-4 h-4 mr-2" />Saída</TabsTrigger>
                    <TabsTrigger value="certificados" className="py-2.5"><FileKey2 className="w-4 h-4 mr-2" />Certificados</TabsTrigger>
                </TabsList>

                <TabsContent value="entrada" className="mt-6">
                    <NotasEntradaTab 
                        user={user} 
                        companies={companies}
                        companiesWithCerts={companiesWithCerts}
                        loadingCompanies={loadingCompanies}
                    />
                </TabsContent>
                <TabsContent value="saida" className="mt-6">
                    <NotasSaidaTab companies={companies} />
                </TabsContent>
                <TabsContent value="certificados" className="mt-6">
                    <CertificadosTab 
                        companies={companies} 
                        user={user}
                        certificates={certificates}
                        loading={loadingCerts}
                        fetchCertificates={fetchCertificates}
                    />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

const NotasEntradaTab = ({ user, companies, companiesWithCerts, loadingCompanies }) => {
    const { toast } = useToast();
    const [notas, setNotas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [isManualImportModalOpen, setIsManualImportModalOpen] = useState(false);
    const [selectedNota, setSelectedNota] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [processLog, setProcessLog] = useState([]);

    useEffect(() => {
        if (companiesWithCerts.length > 0 && !selectedCompany) {
            setSelectedCompany(companiesWithCerts[0].id);
        } else if (companiesWithCerts.length === 0 && companies.length > 0 && !selectedCompany) {
            setSelectedCompany(companies[0].id);
        }
    }, [companies, companiesWithCerts, selectedCompany]);

    const fetchNotas = useCallback(async () => {
        if (!selectedCompany) {
            setNotas([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const { data, error } = await supabase
            .from('notas_fiscais')
            .select('*')
            .eq('empresa_id', selectedCompany)
            .eq('tipo_operacao', 'entrada')
            .order('data_emissao', { ascending: false });

        if (error) toast({ title: "Erro ao buscar notas", description: error.message, variant: "destructive" });
        else setNotas(data);
        setLoading(false);
    }, [toast, selectedCompany]);

    useEffect(() => { fetchNotas(); }, [fetchNotas]);

    const handleFetchNFe = async () => {
        if (!selectedCompany) {
            toast({ title: "Selecione uma empresa", description: "É necessário selecionar uma empresa com certificado.", variant: "warning" });
            return;
        }
        setImporting(true);
        toast({ title: "Buscando na SEFAZ...", description: "Aguarde, isso pode levar um momento.", variant: "info" });
        try {
            const { data, error } = await supabase.functions.invoke('fetch-nfe-sefaz', { body: { company_id: selectedCompany } });
            if (error || !data.ok) throw new Error(data?.error || error.message);
            toast({ title: "Busca Concluída!", description: data.message, variant: "success" });
            fetchNotas();
        } catch (error) {
            toast({ title: "Erro na Busca SEFAZ", description: error.message, variant: "destructive" });
        } finally {
            setImporting(false);
        }
    };

    const handleProcessNota = async (importOptions) => {
        if (!selectedNota) return;
        setProcessing(true);
        setProcessLog([]);
        try {
            const { data, error } = await supabase.functions.invoke('import-xml-nfe', {
                body: { companyId: selectedCompany, userId: user.id, notaFiscalId: selectedNota.id, importOptions }
            });
            if(error || !data.ok) throw new Error(data?.message || error.message);
            setProcessLog(data.log || ['Processamento concluído.']);
            toast({ title: "Nota Processada!", variant: "success" });
            setTimeout(() => {
                setIsProcessModalOpen(false);
                fetchNotas();
            }, 1000);
        } catch(e) {
            toast({ title: "Erro ao processar", description: e.message, variant: "destructive" });
            setProcessLog(prev => [...prev, `ERRO: ${e.message}`]);
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteNota = async () => {
        if (!selectedNota) return;
        const { error } = await supabase.from('notas_fiscais').delete().eq('id', selectedNota.id);
        if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        else { toast({ title: "Nota excluída!", variant: "success" }); fetchNotas(); }
        setIsDeleteModalOpen(false);
        setSelectedNota(null);
    };

    const openDetailModal = (nota) => { setSelectedNota(nota); setIsDetailModalOpen(true); };
    const openDeleteModal = (nota) => { setSelectedNota(nota); setIsDeleteModalOpen(true); };
    const openProcessModal = (nota) => { setSelectedNota(nota); setProcessLog([]); setIsProcessModalOpen(true); };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card p-4 rounded-lg border">
                    <Label htmlFor="company-select">Empresa Selecionada</Label>
                    <select id="company-select" value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-background" disabled={companies.length === 0}>
                        {companies.length > 0 ? companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>) : <option value="">Nenhuma empresa cadastrada</option>}
                    </select>
                </div>
                <div className="bg-card p-4 rounded-lg border flex flex-col justify-center">
                    <Button onClick={handleFetchNFe} disabled={importing || loadingCompanies || companiesWithCerts.length === 0} className="w-full bg-blue-600 hover:bg-blue-700">
                        {importing ? 'Buscando...' : <><Search className="w-4 h-4 mr-2" /> Buscar na SEFAZ</>}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">Busca as últimas notas emitidas contra o CNPJ.</p>
                </div>
                <div className="bg-card p-4 rounded-lg border flex flex-col justify-center">
                    <Button onClick={() => setIsManualImportModalOpen(true)} className="w-full bg-green-600 hover:bg-green-700" disabled={!selectedCompany}>
                        <Upload className="w-4 h-4 mr-2" /> Importar XML Manual
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">Importe um arquivo XML de NF-e do seu computador.</p>
                </div>
            </div>
            
            <TabelaNotas notas={notas} loading={loading} onProcess={openProcessModal} onDetail={openDetailModal} onDelete={openDeleteModal} />

            {isProcessModalOpen && <ProcessNotaModal isOpen={isProcessModalOpen} setIsOpen={setIsProcessModalOpen} nota={selectedNota} processing={processing} log={processLog} onConfirm={handleProcessNota} />}
            {isDetailModalOpen && <DetailNotaModal isOpen={isDetailModalOpen} setIsOpen={setIsDetailModalOpen} nota={selectedNota} />}
            {isDeleteModalOpen && <DeleteNotaModal isOpen={isDeleteModalOpen} setIsOpen={setIsDeleteModalOpen} nota={selectedNota} onConfirm={handleDeleteNota} />}
            {isManualImportModalOpen && <ManualImportModal isOpen={isManualImportModalOpen} setIsOpen={setIsManualImportModalOpen} user={user} companyId={selectedCompany} onImportSuccess={fetchNotas} />}
        </div>
    );
};

const ManualImportModal = ({ isOpen, setIsOpen, user, companyId, onImportSuccess }) => {
    const { toast } = useToast();
    const [xmlFile, setXmlFile] = useState(null);
    const [xmlContent, setXmlContent] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [log, setLog] = useState([]);
    const [importOptions, setImportOptions] = useState({
        addSupplier: true,
        addProducts: true,
        updateStock: true,
        createPayable: true,
    });

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && (file.type === 'text/xml' || file.name.toLowerCase().endsWith('.xml'))) {
            setXmlFile(file);
            const reader = new FileReader();
            reader.onload = (event) => setXmlContent(event.target.result);
            reader.readAsText(file);
        } else {
            toast({ title: "Arquivo inválido", description: "Por favor, selecione um arquivo .xml", variant: "destructive" });
            setXmlFile(null);
            setXmlContent('');
        }
    };

    const handleImport = async () => {
        if (!xmlContent || !companyId) {
            toast({ title: "Campos obrigatórios", description: "Selecione um arquivo XML.", variant: "warning" });
            return;
        }
        setIsImporting(true);
        setLog([]);
        try {
            const { data, error } = await supabase.functions.invoke('import-xml-nfe', {
                body: {
                    companyId: companyId,
                    userId: user.id,
                    xmlData: xmlContent,
                    importOptions
                }
            });

            if (error) throw new Error(`Falha na chamada da função: ${error.message}`);
            if (!data.ok) throw new Error(data?.message || 'Ocorreu um erro desconhecido na importação.');

            setLog(data.log || []);
            toast({ title: "Importação Concluída!", description: data.message, variant: "success" });
            setTimeout(() => {
                onImportSuccess();
                setIsOpen(false);
            }, 1000);

        } catch (e) {
            toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
            setLog(prev => [...prev, `ERRO: ${e.message}`]);
        } finally {
            setIsImporting(false);
        }
    };
    
    useEffect(() => {
        if(!isOpen) {
            setXmlFile(null);
            setXmlContent('');
            setIsImporting(false);
            setLog([]);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Importar XML Manualmente</DialogTitle>
                    <DialogDescription>Selecione o arquivo XML e as opções de importação.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label htmlFor="xml-file-input">Arquivo XML</Label>
                        <Input id="xml-file-input" type="file" accept=".xml,text/xml" onChange={handleFileChange} />
                    </div>
                    <div className="space-y-2">
                        <Label>Opções de Importação</Label>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="addSupplier" checked={importOptions.addSupplier} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, addSupplier: checked}))} />
                            <label htmlFor="addSupplier" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Cadastrar fornecedor</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="addProducts" checked={importOptions.addProducts} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, addProducts: checked}))} />
                            <label htmlFor="addProducts" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Cadastrar produtos</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="updateStock" checked={importOptions.updateStock} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, updateStock: checked}))} />
                            <label htmlFor="updateStock" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Atualizar estoque</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="createPayable" checked={importOptions.createPayable} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, createPayable: checked}))} />
                            <label htmlFor="createPayable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Lançar no Contas a Pagar</label>
                        </div>
                    </div>
                    {log.length > 0 && (
                        <div className="mt-4 p-3 bg-gray-900 text-white rounded-md text-xs font-mono max-h-48 overflow-y-auto">
                            {log.map((l, i) => <p key={i}>{l}</p>)}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button onClick={handleImport} disabled={isImporting || !xmlFile || !companyId}>
                        {isImporting ? "Importando..." : "Importar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const NotasSaidaTab = ({ companies }) => {
    const { toast } = useToast();
    return (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">Emissão de Notas de Saída</h3>
            <p className="mt-1 text-sm text-gray-500">Este módulo está em desenvolvimento.</p>
            <Button className="mt-6" onClick={() => toast({ title: "🚧 Em Construção!", description: "A emissão de notas de saída estará disponível em breve."})}>
                Solicitar Funcionalidade
            </Button>
        </div>
    );
};

const CertificadosTab = ({ companies, user, certificates, loading, fetchCertificates }) => {
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [certificateToHandle, setCertificateToHandle] = useState(null);
    const [dialogMode, setDialogMode] = useState('new'); // 'new', 'edit', 'replace'
    const [formData, setFormData] = useState({ company_id: '', pfx_file: null, password: '', valid_to: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [testingConnection, setTestingConnection] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (!file.name.toLowerCase().endsWith('.pfx')) {
                toast({ title: "Formato inválido", description: "Apenas arquivos .pfx são permitidos.", variant: "destructive" });
                e.target.value = '';
            } else {
                setFormData(prev => ({ ...prev, pfx_file: file }));
            }
        }
    };
    
    const handleSave = async () => {
        const { company_id, pfx_file, password, valid_to } = formData;
        if (dialogMode !== 'edit' && (!company_id || !pfx_file || !password || !valid_to)) {
            toast({ title: "Campos obrigatórios", description: "Todos os campos são necessários para criar ou substituir.", variant: "destructive" });
            return;
        }
        if (dialogMode === 'edit' && !valid_to) {
            toast({ title: "Campos obrigatórios", description: "A data de validade é necessária para editar.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const action = dialogMode === 'new' ? 'save' : (dialogMode === 'edit' ? 'edit' : 'replace');
            const payload = { 
                id: certificateToHandle?.id,
                company_id: certificateToHandle?.company_id || company_id, 
                certificate_name: pfx_file?.name,
                password,
                valid_from: certificateToHandle && dialogMode !== 'new' ? undefined : new Date().toISOString(),
                valid_to
            };
            
            const handleFunctionInvoke = async (finalPayload) => {
                const { data, error } = await supabase.functions.invoke('manage-certificate', {
                    body: { action, payload: finalPayload }
                });
                if (error || data?.error) throw new Error(error?.message || data.error);

                const successMessage = dialogMode === 'new' ? 'salvo' : 'atualizado';
                toast({ title: `Certificado ${successMessage}!`, variant: "success" });
                fetchCertificates();
                setIsDialogOpen(false);
            };

            if (pfx_file) {
                const reader = new FileReader();
                reader.readAsDataURL(pfx_file);
                reader.onloadend = async () => {
                    const base64Pfx = reader.result.split(',')[1];
                    await handleFunctionInvoke({ ...payload, base64_pfx: base64Pfx });
                };
            } else { 
                await handleFunctionInvoke(payload);
            }
        } catch (error) {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async () => {
        if (!certificateToHandle) return;
        const { data, error } = await supabase.functions.invoke('manage-certificate', {
            body: { action: 'delete', payload: { certificate_id: certificateToHandle.id } }
        });
        if (error || data?.error) toast({ title: "Erro ao excluir", description: error?.message || data.error, variant: "destructive" });
        else { toast({ title: "Certificado excluído!", variant: "success" }); fetchCertificates(); }
        setIsDeleteDialogOpen(false);
    };

    const handleTest = async (certId) => {
        setTestingConnection(certId);
        const { data, error } = await supabase.functions.invoke('test-sefaz-connection', { body: { certificate_id: certId } });
        if (error || !data.success) toast({ title: "Falha na Conexão SEFAZ", description: data?.message || error?.message, variant: "destructive" });
        else {
            toast({ title: "Conexão SEFAZ OK!", description: data.message, variant: "success" });
            await supabase.from('digital_certificates').update({ last_sefaz_test: new Date().toISOString() }).eq('id', certId);
            fetchCertificates();
        }
        setTestingConnection(null);
    };
    
    const openDialog = (mode, cert = null) => {
        setDialogMode(mode);
        setCertificateToHandle(cert);
        const validToString = cert?.valid_to ? new Date(cert.valid_to).toISOString().split('T')[0] : '';
        setFormData({
            company_id: cert?.company_id || '',
            pfx_file: null,
            password: '',
            valid_to: validToString
        });
        setShowPassword(false);
        setIsDialogOpen(true);
    };

    const dialogTitles = {
        new: 'Novo Certificado',
        edit: 'Editar Certificado',
        replace: 'Substituir Certificado',
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => openDialog('new')}><Plus className="w-4 h-4 mr-2" /> Novo Certificado</Button>
            </div>
            {loading ? <p>Carregando...</p> : certificates.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-lg"><FileKey2 className="mx-auto h-12 w-12 text-gray-400" /><h3 className="mt-2 text-lg font-medium text-gray-900">Nenhum certificado</h3><p className="mt-1 text-sm text-gray-500">Adicione um certificado digital para começar.</p></div>
            ) : (
                <div className="bg-card rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y">
                            <thead className="bg-muted/50"><tr>{['Empresa', 'Validade', 'Status', 'Último Teste', 'Ações'].map(h=><th key={h} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>)}</tr></thead>
                            <tbody className="divide-y">
                                {certificates.map(cert => {
                                    const now = new Date(); const expiry = new Date(cert.valid_to); const daysDiff = (expiry - now) / (1000*60*60*24);
                                    const status = daysDiff < 0 ? {t:'Vencido', c:'text-red-500'} : daysDiff <= 30 ? {t:'Vence em breve', c:'text-yellow-500'} : {t:'Válido', c:'text-green-500'};
                                    return (
                                    <motion.tr key={cert.id} initial={{opacity:0}} animate={{opacity:1}} className="hover:bg-muted/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{cert.companies.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(cert.valid_to).toLocaleDateString('pt-BR')}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${status.c}`}>{status.t}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{cert.last_sefaz_test ? new Date(cert.last_sefaz_test).toLocaleString('pt-BR') : 'Nunca'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => handleTest(cert.id)} disabled={testingConnection === cert.id}><Power className={`w-4 h-4 mr-2 ${testingConnection === cert.id ? 'animate-spin' : ''}`} /> Testar</Button>
                                            <Button variant="outline" size="sm" onClick={() => openDialog('edit', cert)}><Edit className="w-4 h-4 mr-2" /> Editar</Button>
                                            <Button variant="outline" size="sm" onClick={() => openDialog('replace', cert)}><FilePlus2 className="w-4 h-4 mr-2" /> Substituir</Button>
                                            {user.is_admin && <Button variant="destructive" size="sm" onClick={() => { setCertificateToHandle(cert); setIsDeleteDialogOpen(true); }}><Trash2 className="w-4 h-4" /></Button>}
                                        </td>
                                    </motion.tr>
                                );})}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{dialogTitles[dialogMode]}</DialogTitle><DialogDescription>Forneça os dados necessários.</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div><Label>Empresa</Label><select value={formData.company_id} onChange={(e)=>setFormData(p=>({...p, company_id: e.target.value}))} className="w-full p-2 border rounded" disabled={dialogMode !== 'new'}><option value="">Selecione</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                        {dialogMode !== 'edit' && <div><Label>Arquivo .pfx</Label><Input type="file" accept=".pfx" onChange={handleFileChange} /></div>}
                        <div className="relative"><Label>Senha</Label><Input type={showPassword ? "text":"password"} value={formData.password} onChange={(e)=>setFormData(p=>({...p, password:e.target.value}))} placeholder={dialogMode === 'edit' ? 'Deixe em branco para não alterar' : ''} /><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-8">{showPassword?<EyeOff className="w-4"/>:<Eye className="w-4"/>}</button></div>
                        <div><Label>Data de Validade</Label><Input type="date" value={formData.valid_to} onChange={(e)=>setFormData(p=>({...p, valid_to:e.target.value}))} /></div>
                    </div>
                    <DialogFooter><Button onClick={handleSave} disabled={isSaving}>{isSaving?'Salvando...':'Salvar'}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle><AlertDialogDescription>Excluir o certificado de "{certificateToHandle?.companies.name}"? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
    );
};

// --- Componentes de Tabela e Modais ---
const TabelaNotas = ({ notas, loading, onProcess, onDetail, onDelete }) => (
    <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y">
                <thead className="bg-muted/50">
                    <tr>
                        {['Data', 'Emitente', 'Valor', 'Status', 'Ações'].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {loading ? (<tr><td colSpan="5" className="text-center py-10">Carregando notas...</td></tr>)
                    : notas.length === 0 ? (<tr><td colSpan="5" className="text-center py-10 text-muted-foreground">Nenhuma nota encontrada.</td></tr>)
                    : notas.map(nota => (
                        <motion.tr key={nota.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-muted/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(nota.data_emissao).toLocaleDateString('pt-BR')}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{nota.nome_emitente}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">R$ {parseFloat(nota.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-xs">{getStatusChip(nota.status)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-1">
                                {nota.status !== 'Processada' && nota.tipo_operacao === 'entrada' && <Button variant="ghost" size="icon" onClick={() => onProcess(nota)} title="Processar"><Package className="w-4 h-4 text-green-600" /></Button>}
                                <Button variant="ghost" size="icon" onClick={() => onDetail(nota)} title="Ver Detalhes"><Eye className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => onDelete(nota)} title="Excluir"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const getStatusChip = (status) => {
    const variants = {
        Processada: 'bg-green-100 text-green-800',
        Pendente: 'bg-yellow-100 text-yellow-800',
        Cancelada: 'bg-red-100 text-red-800',
        Erro: 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 py-1 font-medium rounded-full ${variants[status] || 'bg-gray-100 text-gray-800'}`}>{status || 'Pendente'}</span>;
};

const ProcessNotaModal = ({ isOpen, setIsOpen, nota, processing, log, onConfirm }) => {
    const [importOptions, setImportOptions] = useState({
        addSupplier: true,
        addProducts: true,
        updateStock: true,
        createPayable: true,
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Processar Nota Fiscal</DialogTitle>
                    <DialogDescription>Integrar dados da NF-e ao sistema.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <p><strong>Emitente:</strong> {nota?.nome_emitente}</p>
                        <p><strong>Valor:</strong> R$ {parseFloat(nota?.valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Opções de Importação</Label>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="procAddSupplier" checked={importOptions.addSupplier} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, addSupplier: checked}))} />
                            <label htmlFor="procAddSupplier" className="text-sm font-medium leading-none">Cadastrar fornecedor</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="procAddProducts" checked={importOptions.addProducts} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, addProducts: checked}))} />
                            <label htmlFor="procAddProducts" className="text-sm font-medium leading-none">Cadastrar produtos</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="procUpdateStock" checked={importOptions.updateStock} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, updateStock: checked}))} />
                            <label htmlFor="procUpdateStock" className="text-sm font-medium leading-none">Atualizar estoque</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="procCreatePayable" checked={importOptions.createPayable} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, createPayable: checked}))} />
                            <label htmlFor="procCreatePayable" className="text-sm font-medium leading-none">Lançar no Contas a Pagar</label>
                        </div>
                    </div>
                    {log.length > 0 && (
                        <div className="mt-4 p-3 bg-gray-900 text-white rounded-md text-xs font-mono max-h-48 overflow-y-auto">
                            {log.map((l, i) => <p key={i}>{l}</p>)}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button onClick={() => onConfirm(importOptions)} disabled={processing} className="bg-green-600 hover:bg-green-700">
                        {processing ? "Processando..." : "Confirmar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const DetailNotaModal = ({ isOpen, setIsOpen, nota }) => (
    <Dialog open={isOpen} onOpenChange={setIsOpen}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Detalhes da Nota Fiscal</DialogTitle></DialogHeader>
        {nota && <div className="py-4 space-y-4 text-sm"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><strong>Data:</strong><p>{new Date(nota.data_emissao).toLocaleString('pt-BR')}</p></div><div><strong>Valor:</strong><p className="font-bold text-lg">R$ {parseFloat(nota.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p></div><div className="md:col-span-2"><strong>Emitente:</strong><p>{nota.nome_emitente}</p></div></div><div className="pt-2"><strong>Chave de Acesso:</strong><p className="font-mono bg-gray-100 p-2 rounded-md text-xs break-all">{nota.chave_acesso}</p></div><div className="pt-2"><h4 className="font-semibold mb-2">XML</h4><pre className="bg-gray-100 p-2 rounded-md text-xs overflow-auto max-h-40">{nota.xml}</pre></div></div>}
        <DialogFooter><Button variant="outline" onClick={() => setIsOpen(false)}>Fechar</Button></DialogFooter>
    </DialogContent></Dialog>
);

const DeleteNotaModal = ({ isOpen, setIsOpen, nota, onConfirm }) => (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Deseja realmente excluir a nota de {nota?.nome_emitente}? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
);


export default SuperNota;