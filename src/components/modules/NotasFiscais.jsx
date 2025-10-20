import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Download, FilePlus2, Eye, FileText, Search, Trash2, AlertTriangle, FileKey2, Plus, Save, EyeOff, Power, Replace, CheckCircle, Package, Users, FileStack, Banknote } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Label } from '@/components/ui/label';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { Input } from '@/components/ui/input';

    const ConsultaNotasTab = ({ user, companies, companiesWithCerts, loadingCompanies, fetchCertificates }) => {
      const { toast } = useToast();
      const [notas, setNotas] = useState([]);
      const [loading, setLoading] = useState(true);
      const [importing, setImporting] = useState(false);
      const [selectedCompany, setSelectedCompany] = useState('');
      const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
      const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
      const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
      const [selectedNota, setSelectedNota] = useState(null);
      const [processing, setProcessing] = useState(false);
      const [processLog, setProcessLog] = useState([]);

      useEffect(() => {
        if (companiesWithCerts.length > 0 && !selectedCompany) {
          setSelectedCompany(companiesWithCerts[0].id);
        } else if (companiesWithCerts.length === 0 && selectedCompany !== '') {
          setSelectedCompany('');
        }
      }, [companiesWithCerts, selectedCompany]);

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
          .order('data_emissao', { ascending: false });

        if (error) {
          toast({ title: "Erro ao buscar notas fiscais", description: error.message, variant: "destructive" });
        } else {
          setNotas(data);
        }
        setLoading(false);
      }, [toast, selectedCompany]);

      useEffect(() => {
        fetchNotas();
      }, [fetchNotas]);

      const handleFetchNFe = async () => {
        if (!selectedCompany) {
          toast({ title: "Selecione uma empresa", description: "Você precisa selecionar uma empresa com certificado válido.", variant: "warning" });
          return;
        }
        setImporting(true);
        toast({ title: "Iniciando busca na SEFAZ...", description: "Isso pode levar alguns minutos. Aguarde.", variant: "info" });
        try {
          const { data, error } = await supabase.functions.invoke('fetch-nfe-sefaz', {
            body: { company_id: selectedCompany },
          });

          if (error || !data.ok) {
            throw new Error(data?.error || error.message);
          }

          toast({ title: "Busca Concluída!", description: data.message, variant: "success" });
          fetchNotas();
        } catch (error) {
          toast({ title: "Erro na Busca SEFAZ", description: `${error.message}`, variant: "destructive" });
        } finally {
          setImporting(false);
        }
      };

      const handleProcessNota = async () => {
        if (!selectedNota) return;
        setProcessing(true);
        setProcessLog([]);
        try {
          const { data, error } = await supabase.functions.invoke('import-xml-nfe', {
            body: { 
                companyId: selectedCompany,
                userId: user.id,
                notaFiscalId: selectedNota.id,
                importOptions: { addSupplier: true, addProducts: true, updateStock: true, createPayable: true },
             }
          });

          if(error || !data.ok) throw new Error(data?.message || error.message);
          
          setProcessLog(data.log || ['Processamento concluído com sucesso.']);
          toast({ title: "Nota Processada!", description: "A nota fiscal foi processada e integrada ao sistema.", variant: "success" });
          fetchNotas(); // Refresh to update status
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
        if (error) {
          toast({ title: "Erro ao excluir nota", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Nota fiscal excluída com sucesso!", variant: "success" });
          fetchNotas();
        }
        setIsDeleteModalOpen(false);
        setSelectedNota(null);
      };

      const openDetailModal = (nota) => { setSelectedNota(nota); setIsDetailModalOpen(true); };
      const openDeleteModal = (nota) => { setSelectedNota(nota); setIsDeleteModalOpen(true); };
      const openProcessModal = (nota) => { setSelectedNota(nota); setProcessLog([]); setIsProcessModalOpen(true); };
      
      const getStatusChip = (status) => {
        switch (status) {
          case 'Processada':
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Processada</span>;
          case 'Pendente':
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Pendente</span>;
          case 'Erro':
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Erro</span>;
          default:
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{status || 'Pendente'}</span>;
        }
      };

      return (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Notas Importadas da SEFAZ</h2>
            <div className="flex gap-2 w-full md:w-auto">
              <Button onClick={handleFetchNFe} disabled={importing || loadingCompanies || companiesWithCerts.length === 0} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                {importing ? 'Buscando...' : <><Search className="w-4 h-4 mr-2" /> Buscar Novas Notas</>}
              </Button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <Label htmlFor="company-select">Selecione a Empresa (com certificado válido)</Label>
            {loadingCompanies ? (
              <div className="w-full mt-1 p-2 border rounded-md bg-gray-100 animate-pulse h-10"></div>
            ) : (
              <select
                id="company-select"
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full mt-1 p-2 border rounded-md bg-gray-50"
                disabled={companiesWithCerts.length === 0}
              >
                {companiesWithCerts.length > 0 ? (
                  companiesWithCerts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                ) : (
                  <option value="" disabled>Nenhuma empresa com certificado válido encontrada</option>
                )}
              </select>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emitente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan="5" className="text-center py-10">Carregando...</td></tr>
                  ) : notas.length > 0 ? (
                    notas.map(nota => (
                      <motion.tr key={nota.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(nota.data_emissao).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{nota.nome_emitente}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">R$ {parseFloat(nota.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">{getStatusChip(nota.status)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                          {nota.status !== 'Processada' && nota.tipo_operacao === 'entrada' && (
                             <Button variant="ghost" size="icon" onClick={() => openProcessModal(nota)} title="Processar e Integrar Nota">
                                <Package className="w-4 h-4 text-green-600" />
                              </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openDetailModal(nota)} title="Ver Detalhes">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openDeleteModal(nota)} title="Excluir Nota">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr><td colSpan="5" className="text-center py-10 text-gray-500">Nenhuma nota fiscal encontrada. Clique em "Buscar Novas Notas".</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {isProcessModalOpen && <ProcessNotaModal isOpen={isProcessModalOpen} setIsOpen={setIsProcessModalOpen} nota={selectedNota} processing={processing} log={processLog} onConfirm={handleProcessNota} />}
          {isDetailModalOpen && <DetailNotaModal isOpen={isDetailModalOpen} setIsOpen={setIsDetailModalOpen} nota={selectedNota} />}
          {isDeleteModalOpen && <DeleteNotaModal isOpen={isDeleteModalOpen} setIsOpen={setIsDeleteModalOpen} nota={selectedNota} onConfirm={handleDeleteNota} />}
        </div>
      );
    };
    
    const ProcessNotaModal = ({ isOpen, setIsOpen, nota, processing, log, onConfirm }) => (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processar e Integrar Nota Fiscal</DialogTitle>
            <DialogDescription>
              Esta ação irá cadastrar fornecedor, produtos, atualizar estoque e criar uma conta a pagar.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p><strong>Emitente:</strong> {nota?.nome_emitente}</p>
            <p><strong>Valor:</strong> R$ {parseFloat(nota?.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            {log.length > 0 && (
                <div className="mt-4 p-3 bg-gray-900 text-white rounded-md text-xs font-mono max-h-48 overflow-y-auto">
                    {log.map((line, index) => <p key={index}>{line}</p>)}
                </div>
            )}
          </div>
          <DialogFooter>
            <AlertDialogCancel onClick={() => setIsOpen(false)}>Cancelar</AlertDialogCancel>
            <Button onClick={onConfirm} disabled={processing} className="bg-green-600 hover:bg-green-700">
              {processing ? "Processando..." : "Confirmar Integração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    const DetailNotaModal = ({ isOpen, setIsOpen, nota }) => {
        const downloadXml = (xmlContent, fileName) => {
            const blob = new Blob([xmlContent], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Detalhes da Nota Fiscal</DialogTitle>
                </DialogHeader>
                {nota && (
                    <div className="py-4 space-y-4 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><strong>Data de Emissão:</strong><p>{new Date(nota.data_emissao).toLocaleString('pt-BR')}</p></div>
                        <div><strong>Valor Total:</strong><p className="font-bold text-lg">R$ {parseFloat(nota.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                        <div><strong>Operação:</strong> {nota.tipo_operacao}</div>
                        <div className="md:col-span-2"><strong>Emitente:</strong><p>{nota.nome_emitente}</p></div>
                        <div><strong>CNPJ Emitente:</strong><p className="font-mono">{nota.cnpj_emitente}</p></div>
                    </div>
                    <div className="pt-2">
                        <strong className="block mb-1">Chave de Acesso:</strong>
                        <p className="font-mono bg-gray-100 p-2 rounded-md text-xs break-all">{nota.chave_acesso}</p>
                    </div>
                    <div className="pt-2">
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="w-4 h-4"/> XML da Nota</h4>
                        <pre className="bg-gray-100 p-2 rounded-md text-xs overflow-auto max-h-40">{nota.xml}</pre>
                    </div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Fechar</Button>
                    <Button onClick={() => downloadXml(nota?.xml, `${nota?.chave_acesso}.xml`)}><Download className="w-4 h-4 mr-2"/> Baixar XML</Button>
                </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }
    
    const DeleteNotaModal = ({ isOpen, setIsOpen, nota, onConfirm }) => (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                <p>Deseja realmente excluir a nota fiscal de <strong>{nota?.nome_emitente}</strong>?</p>
                <p className="text-red-600 font-bold mt-2">Esta ação não pode ser desfeita.</p>
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );


    const CertificadosTab = ({ companies, user, certificates, loading, fetchCertificates }) => {
      const { toast } = useToast();
      const [isDialogOpen, setIsDialogOpen] = useState(false);
      const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
      const [certificateToHandle, setCertificateToHandle] = useState(null);
      const [newCertificate, setNewCertificate] = useState({
        company_id: '',
        pfx_file: null,
        password: '',
        valid_to: '',
      });
      const [showPassword, setShowPassword] = useState(false);
      const [testingConnection, setTestingConnection] = useState(null);
      const [isSaving, setIsSaving] = useState(false);

      const handleInputChange = (e) => {
        const { id, value } = e.target;
        setNewCertificate(prev => ({ ...prev, [id]: value }));
      };

      const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          if (file.name.split('.').pop().toLowerCase() !== 'pfx') {
            toast({ title: "Formato inválido", description: "Por favor, selecione um arquivo .pfx.", variant: "destructive" });
            e.target.value = '';
            return;
          }
          setNewCertificate(prev => ({ ...prev, pfx_file: file }));
        }
      };

      const handleSaveCertificate = async () => {
        const { company_id, pfx_file, password, valid_to } = newCertificate;
        if (!company_id || !pfx_file || !password || !valid_to) {
          toast({ title: "Campos obrigatórios", description: "Preencha todos os campos para salvar.", variant: "destructive" });
          return;
        }

        setIsSaving(true);
        
        try {
            const reader = new FileReader();
            reader.readAsDataURL(pfx_file);
            reader.onload = async () => {
                const base64Pfx = reader.result.split(',')[1];

                const { data, error } = await supabase.functions.invoke('manage-certificate', {
                  body: {
                    action: certificateToHandle ? 'replace' : 'save',
                    payload: {
                      id: certificateToHandle?.id,
                      company_id,
                      certificate_name: pfx_file.name,
                      base64_pfx: base64Pfx,
                      password,
                      valid_from: new Date().toISOString(),
                      valid_to: valid_to,
                    }
                  }
                });

                setIsSaving(false);

                if (error || (data && data.error)) {
                    throw new Error(error?.message || data.error);
                } else {
                    toast({ title: `Certificado ${certificateToHandle ? 'substituído' : 'salvo'}!`, variant: "success" });
                    fetchCertificates();
                    setIsDialogOpen(false);
                }
            };
            reader.onerror = (error) => {
              throw new Error("Falha ao ler o arquivo do certificado.");
            };
        } catch(error) {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
            setIsSaving(false);
        }
      };

      const handleDeleteCertificate = async () => {
        if (!user.is_admin) {
          toast({ title: "Acesso negado", description: "Apenas administradores podem excluir certificados.", variant: "destructive" });
          return;
        }
        if (!certificateToHandle) return;

        const { data, error } = await supabase.functions.invoke('manage-certificate', {
          body: {
            action: 'delete',
            payload: { certificate_id: certificateToHandle.id }
          }
        });

        if (error || (data && data.error)) {
          toast({ title: "Erro ao excluir", description: error?.message || data.error, variant: "destructive" });
        } else {
          toast({ title: "Certificado excluído com sucesso!", variant: "success" });
          fetchCertificates();
        }

        setIsDeleteDialogOpen(false);
        setCertificateToHandle(null);
      };

      const handleTestConnection = async (certId) => {
        setTestingConnection(certId);
        const { data, error } = await supabase.functions.invoke('test-sefaz-connection', {
          body: { certificate_id: certId }
        });

        if (error || !data.success) {
          toast({ title: "Falha na Conexão SEFAZ", description: data?.message || error?.message, variant: "destructive" });
        } else {
          toast({ title: "Conexão SEFAZ OK!", description: data.message, variant: "success" });
          const { error: updateError } = await supabase.from('digital_certificates').update({ last_sefaz_test: new Date().toISOString() }).eq('id', certId);
          if (!updateError) fetchCertificates();
        }
        setTestingConnection(null);
      };

      const openDialog = (certToReplace = null) => {
        setCertificateToHandle(certToReplace);
        setNewCertificate({
          company_id: certToReplace ? certToReplace.company_id : '',
          pfx_file: null,
          password: '',
          valid_to: '',
        });
        setIsDialogOpen(true);
      };

      const getStatus = (validTo) => {
        const now = new Date();
        const expiry = new Date(validTo);
        const daysDiff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff < 0) return { text: 'Vencido', color: 'text-red-500', icon: <AlertTriangle className="w-4 h-4" /> };
        if (daysDiff <= 30) return { text: 'Vence em breve', color: 'text-yellow-500', icon: <AlertTriangle className="w-4 h-4" /> };
        return { text: 'Válido', color: 'text-green-500', icon: null };
      };

      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Certificados Digitais (A1)</h2>
            <Button onClick={() => openDialog()} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Novo Certificado
            </Button>
          </div>

          {loading ? (
            <p>Carregando certificados...</p>
          ) : certificates.length > 0 ? (
            <div className="overflow-x-auto bg-white p-4 rounded-xl shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último Teste</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {certificates.map(cert => {
                    const status = getStatus(cert.valid_to);
                    return (
                      <motion.tr key={cert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cert.companies.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(cert.valid_to).toLocaleDateString('pt-BR')}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${status.color}`}>
                          <div className="flex items-center gap-2">{status.icon}{status.text}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {cert.last_sefaz_test ? new Date(cert.last_sefaz_test).toLocaleString('pt-BR') : 'Nunca'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleTestConnection(cert.id)} disabled={testingConnection === cert.id}>
                            <Power className={`w-4 h-4 mr-2 ${testingConnection === cert.id ? 'animate-spin' : ''}`} /> Testar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openDialog(cert)}><Replace className="w-4 h-4 mr-2" /> Substituir</Button>
                          <Button variant="destructive" size="sm" onClick={() => { setCertificateToHandle(cert); setIsDeleteDialogOpen(true); }} disabled={!user.is_admin}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <FileKey2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum certificado cadastrado</h3>
              <p className="mt-1 text-sm text-gray-500">Adicione o certificado digital (A1) de suas empresas.</p>
            </div>
          )}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{certificateToHandle ? 'Substituir' : 'Adicionar'} Certificado Digital (A1)</DialogTitle>
                <DialogDescription>
                  O arquivo .pfx e a senha serão armazenados de forma segura e criptografada.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="company_id">Empresa</Label>
                  <select id="company_id" value={newCertificate.company_id} onChange={handleInputChange} className="w-full p-2 border rounded bg-gray-50" disabled={!!certificateToHandle}>
                    <option value="" disabled>Selecione uma empresa</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="pfx_file">Arquivo do Certificado (.pfx)</Label>
                  <Input id="pfx_file" type="file" accept=".pfx" onChange={handleFileChange} />
                </div>
                <div className="relative">
                  <Label htmlFor="password">Senha do Certificado</Label>
                  <Input id="password" type={showPassword ? "text" : "password"} value={newCertificate.password} onChange={handleInputChange} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-gray-500">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div>
                  <Label htmlFor="valid_to">Data de Validade</Label>
                  <Input id="valid_to" type="date" value={newCertificate.valid_to} onChange={handleInputChange} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSaveCertificate} disabled={isSaving}>
                  {isSaving ? 'Salvando...' : <><Save className="w-4 h-4 mr-2" /> Salvar</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                    <p>Deseja realmente excluir o certificado para "{certificateToHandle?.companies.name}"?</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCertificateToHandle(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCertificate} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    };

    const NotasFiscais = ({ user, companies }) => {
      const { toast } = useToast();
      const [certificates, setCertificates] = useState([]);
      const [loadingCerts, setLoadingCerts] = useState(true);
      const [companiesWithCerts, setCompaniesWithCerts] = useState([]);
      const [loadingCompanies, setLoadingCompanies] = useState(true);

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
          : companies.filter(c => user.permissions?.companies?.includes(c.id));

        const filteredCompanies = userAllowedCompanies.filter(c => validCertCompanyIds.includes(c.id));
        
        setCompaniesWithCerts(filteredCompanies);
        setLoadingCompanies(false);
      }, [companies, user.is_admin, user.permissions?.companies, certificates]);

      useEffect(() => {
        if (!loadingCerts) {
          fetchCompaniesWithCerts();
        }
      }, [loadingCerts, fetchCompaniesWithCerts]);

      return (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-gray-800">Notas Fiscais</h1>
          
          <Tabs defaultValue="consulta" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="consulta">Consulta de Notas</TabsTrigger>
              <TabsTrigger value="certificados">Certificados Digitais</TabsTrigger>
            </TabsList>
            <TabsContent value="consulta" className="mt-6">
              <ConsultaNotasTab 
                user={user} 
                companies={companies} 
                companiesWithCerts={companiesWithCerts}
                loadingCompanies={loadingCompanies}
                fetchCertificates={fetchCertificates}
              />
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
        </div>
      );
    };

    export default NotasFiscais;