import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, Edit, Trash2, Save, X, FileDown, MessageSquare, MoreHorizontal, Filter, AlertTriangle, Download, FileText, BarChart2, Send, QrCode, Copy } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Label } from '@/components/ui/label';
    import { Checkbox } from '@/components/ui/checkbox';
    import * as XLSX from 'xlsx';
    import jsPDF from 'jspdf';
    import 'jspdf-autotable';
    import { useUser } from '@/contexts/UserContext';

    const Cobrancas = () => {
      const { user, companies } = useUser();
      const { toast } = useToast();
      const [cobrancas, setCobrancas] = useState([]);
      const [clientes, setClientes] = useState([]);
      const [loading, setLoading] = useState(true);
      const [isFormOpen, setIsFormOpen] = useState(false);
      const [editingCobranca, setEditingCobranca] = useState(null);
      const [selectedCobrancas, setSelectedCobrancas] = useState([]);
      const [isPixModalOpen, setIsPixModalOpen] = useState(false);
      const [pixData, setPixData] = useState(null);
      const [cobrancaParaPix, setCobrancaParaPix] = useState(null);
      const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
      const [cobrancaToDelete, setCobrancaToDelete] = useState(null);

      const [companyFilter, setCompanyFilter] = useState('all');
      const [clientFilter, setClientFilter] = useState('all');
      const [statusFilter, setStatusFilter] = useState('all');
      const [periodFilter, setPeriodFilter] = useState('30');

      const fetchCobrancas = useCallback(async () => {
        setLoading(true);
        let query = supabase
          .from('cobrancas')
          .select('*, cliente:clientes(id, name, phone, email), empresa:companies(name), responsavel:app_users(name)');

        if (companyFilter !== 'all') query = query.eq('company_id', companyFilter);
        if (clientFilter !== 'all') query = query.eq('cliente_id', clientFilter);
        if (statusFilter !== 'all') query = query.eq('status', statusFilter);

        if (periodFilter !== 'all') {
          const date = new Date();
          date.setDate(date.getDate() - parseInt(periodFilter));
          query = query.gte('data_emissao', date.toISOString().split('T')[0]);
        }

        const { data, error } = await query.order('data_vencimento', { ascending: false });

        if (error) {
          toast({ title: 'Erro ao buscar cobranças', description: error.message, variant: 'destructive' });
        } else {
          const today = new Date().toISOString().split('T')[0];
          const updatedData = data.map(c => ({
            ...c,
            status: c.status === 'Pendente' && c.data_vencimento < today ? 'Vencido' : c.status,
          }));
          setCobrancas(updatedData);
        }
        setLoading(false);
      }, [toast, companyFilter, clientFilter, statusFilter, periodFilter]);

      const fetchClientes = useCallback(async () => {
        const { data, error } = await supabase.from('clientes').select('id, name').order('name');
        if (error) {
          toast({ title: 'Erro ao buscar clientes', description: error.message, variant: 'destructive' });
        } else {
          setClientes(data);
        }
      }, [toast]);

      useEffect(() => {
        fetchCobrancas();
        fetchClientes();
      }, [fetchCobrancas, fetchClientes]);

      const filteredCobrancas = useMemo(() => cobrancas, [cobrancas]);

      const handleOpenForm = (cobranca = null, clientePredefinido = null) => {
        if (clientePredefinido) {
          const cliente = clientes.find(c => c.id === clientePredefinido.id);
          setEditingCobranca({
            cliente_id: cliente?.id,
            company_id: cliente?.company_id || '',
          });
        } else {
          setEditingCobranca(cobranca);
        }
        setIsFormOpen(true);
      };

      const handleCloseForm = () => {
        setEditingCobranca(null);
        setIsFormOpen(false);
      };

      const openDeleteDialog = (cobranca) => {
        setCobrancaToDelete(cobranca);
        setIsDeleteAlertOpen(true);
      };

      const handleDelete = async () => {
        if (!cobrancaToDelete) return;
        const { error } = await supabase.from('cobrancas').delete().eq('id', cobrancaToDelete.id);
        if (error) {
          toast({ title: 'Erro ao excluir cobrança', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Cobrança excluída com sucesso!' });
          fetchCobrancas();
        }
        setIsDeleteAlertOpen(false);
        setCobrancaToDelete(null);
      };

      const handleSendWhatsApp = (cobranca) => {
        const cliente = cobranca.cliente;
        if (!cliente || !cliente.phone) {
          toast({ title: 'Cliente sem número de WhatsApp cadastrado.', variant: 'destructive' });
          return;
        }
        const phone = cliente.phone.replace(/\D/g, '');
        if (phone.length < 10) {
          toast({ title: 'Telefone inválido', description: 'O formato do telefone é inválido.', variant: 'destructive' });
          return;
        }
        
        const message = `Olá ${cliente.name}, segue sua cobrança de R$${cobranca.valor.toFixed(2)} com vencimento em ${new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR')}. Link para pagamento: ${cobranca.link_pagamento || 'Link não disponível'}`;
        const url = `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
      };

      const handleBulkWhatsApp = () => {
        const selected = cobrancas.filter(c => selectedCobrancas.includes(c.id));
        if (selected.length === 0) {
          toast({ title: 'Nenhuma cobrança selecionada', variant: 'warning' });
          return;
        }
        selected.forEach(handleSendWhatsApp);
      };

      const handleStatusChange = async (cobranca, newStatus) => {
        const today = new Date().toISOString().split('T')[0];
        const updateData = { status: newStatus, data_pagamento: newStatus === 'Pago' ? today : null };

        const { error } = await supabase.from('cobrancas').update(updateData).eq('id', cobranca.id);

        if (error) {
          toast({ title: "Erro ao atualizar status", variant: "destructive" });
          return;
        }

        if (newStatus === 'Pago') {
          const { data: dreGroup, error: dreError } = await supabase.from('dre_groups').select('id').eq('name', 'Recebimentos de Clientes').single();
          if (dreError) {
            toast({ title: "Grupo DRE 'Recebimentos de Clientes' não encontrado.", variant: "warning" });
          }

          const { data: contaReceber, error: insertError } = await supabase.from('contas_receber').insert({
            description: `Pagamento cliente ${cobranca.cliente.name}`,
            value: cobranca.valor,
            due_date: cobranca.data_vencimento,
            status: 'received',
            company_id: cobranca.company_id,
            payment_date: today,
            dre_group_id: dreGroup?.id,
          }).select().single();

          if (insertError) {
            toast({ title: "Erro ao criar lançamento financeiro", variant: "destructive" });
          } else {
            await supabase.from('cobrancas').update({ contas_receber_id: contaReceber.id }).eq('id', cobranca.id);
          }
        } else if (cobranca.status === 'Pago' && newStatus !== 'Pago' && cobranca.contas_receber_id) {
          await supabase.from('contas_receber').delete().eq('id', cobranca.contas_receber_id);
          await supabase.from('cobrancas').update({ contas_receber_id: null }).eq('id', cobranca.id);
        }

        toast({ title: "Status atualizado!", variant: "success" });
        fetchCobrancas();
      };

      const getStatusClass = (status) => {
        switch (status) {
          case 'Pendente': return 'bg-yellow-100 text-yellow-800';
          case 'Pago': return 'bg-green-100 text-green-800';
          case 'Vencido': return 'bg-red-100 text-red-800';
          default: return 'bg-gray-100 text-gray-800';
        }
      };

      const handleSelectionChange = (cobrancaId) => {
        setSelectedCobrancas(prev => 
          prev.includes(cobrancaId) ? prev.filter(id => id !== cobrancaId) : [...prev, cobrancaId]
        );
      };

      const handleSelectAll = (e) => {
        if (e.target.checked) {
          setSelectedCobrancas(filteredCobrancas.map(c => c.id));
        } else {
          setSelectedCobrancas([]);
        }
      };

      const exportPDF = () => {
        const doc = new jsPDF();
        doc.text("Relatório de Cobranças", 14, 16);
        doc.autoTable({
          head: [['Cliente', 'Empresa', 'Valor', 'Vencimento', 'Status']],
          body: filteredCobrancas.map(c => [c.cliente.name, c.empresa.name, `R$ ${c.valor.toFixed(2)}`, new Date(c.data_vencimento).toLocaleDateString('pt-BR'), c.status]),
        });
        doc.save('cobrancas.pdf');
      };

      const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredCobrancas.map(c => ({
          Cliente: c.cliente.name,
          Empresa: c.empresa.name,
          Valor: c.valor,
          Vencimento: c.data_vencimento,
          Status: c.status,
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cobranças");
        XLSX.writeFile(wb, "cobrancas.xlsx");
      };

      const vencendoHoje = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return cobrancas.filter(c => c.data_vencimento === today && c.status === 'Pendente');
      }, [cobrancas]);

      const handleGeneratePix = async (cobranca) => {
        setCobrancaParaPix(cobranca);
        setPixData(null);
        setIsPixModalOpen(true);

        try {
          const { data: functionData, error: functionError } = await supabase.functions.invoke('generate-pix-payment', {
            body: JSON.stringify({
              transaction_amount: cobranca.valor,
              description: `Cobrança Stout System - ${cobranca.cliente.name}`,
              payer_email: cobranca.cliente.email || 'cliente@email.com',
              external_reference: cobranca.id,
            }),
          });

          if (functionError) throw functionError;
          
          setPixData({
            qrCodeBase64: functionData.point_of_interaction.transaction_data.qr_code_base64,
            qrCode: functionData.point_of_interaction.transaction_data.qr_code,
          });

        } catch (error) {
          toast({ title: 'Erro ao gerar PIX', description: error.message, variant: 'destructive' });
          setIsPixModalOpen(false);
        }
      };

      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Cobranças</h1>
          </div>

          <div className="bg-card p-4 rounded-lg border shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><Label>Empresa</Label><select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="w-full p-2 border rounded-md bg-background"><option value="all">Todas</option>{companies?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><Label>Cliente</Label><select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="w-full p-2 border rounded-md bg-background"><option value="all">Todos</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><Label>Status</Label><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-2 border rounded-md bg-background"><option value="all">Todos</option><option value="Pendente">Pendente</option><option value="Pago">Pago</option><option value="Vencido">Vencido</option></select></div>
              <div><Label>Período</Label><select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className="w-full p-2 border rounded-md bg-background"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="all">Todos</option></select></div>
            </div>
            {vencendoHoje.length > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-md flex justify-between items-center">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-3" />
                  <p><span className="font-bold">{vencendoHoje.length} cobranças vencendo hoje</span> — total R$ {vencendoHoje.reduce((acc, c) => acc + c.valor, 0).toFixed(2)}</p>
                </div>
                <Button onClick={handleBulkWhatsApp}><Send className="mr-2 h-4 w-4" /> Enviar em lote via WhatsApp</Button>
              </div>
            )}
          </div>

          {loading ? <p>Carregando...</p> : (
            <div className="bg-card rounded-lg border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-muted-foreground">
                      <th className="p-3 w-10"><Checkbox onCheckedChange={handleSelectAll} checked={selectedCobrancas.length === filteredCobrancas.length && filteredCobrancas.length > 0} /></th>
                      <th className="p-3 text-left font-medium">Cliente</th>
                      <th className="p-3 text-left font-medium hidden md:table-cell">Telefone</th>
                      <th className="p-3 text-left font-medium hidden lg:table-cell">Vencimento</th>
                      <th className="p-3 text-left font-medium">Valor</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCobrancas.map((cobranca) => (
                      <tr key={cobranca.id} className="border-b hover:bg-muted/50">
                        <td className="p-3"><Checkbox onCheckedChange={() => handleSelectionChange(cobranca.id)} checked={selectedCobrancas.includes(cobranca.id)} /></td>
                        <td className="p-3 font-medium">{cobranca.cliente?.name || 'Cliente não encontrado'}</td>
                        <td className="p-3 hidden md:table-cell">{cobranca.cliente?.phone || 'Sem número'}</td>
                        <td className="p-3 hidden lg:table-cell">{new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR')}</td>
                        <td className="p-3">R$ {cobranca.valor.toFixed(2)}</td>
                        <td className="p-3">
                          <select value={cobranca.status} onChange={(e) => handleStatusChange(cobranca, e.target.value)} className={`p-1 border rounded-md text-xs ${getStatusClass(cobranca.status)}`}>
                            <option value="Pendente">Pendente</option>
                            <option value="Pago">Pago</option>
                            <option value="Vencido">Vencido</option>
                          </select>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleGeneratePix(cobranca)}><QrCode className="h-4 w-4 text-blue-600" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleSendWhatsApp(cobranca)}><MessageSquare className="h-4 w-4 text-green-600" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenForm(cobranca)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(cobranca)}><Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportPDF}><FileDown className="mr-2 h-4 w-4" /> Exportar PDF</Button>
              <Button variant="outline" onClick={exportExcel}><FileText className="mr-2 h-4 w-4" /> Exportar Excel</Button>
              <Button variant="outline" onClick={() => toast({title: "Em desenvolvimento"})}><BarChart2 className="mr-2 h-4 w-4" /> Relatório Consolidado</Button>
            </div>
            <Button onClick={() => handleOpenForm()}><Plus className="mr-2 h-4 w-4" /> Nova Cobrança</Button>
          </div>

          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>{editingCobranca?.id ? 'Editar Cobrança' : 'Nova Cobrança'}</DialogTitle></DialogHeader>
              <CobrancaForm cobranca={editingCobranca} onSaveSuccess={() => { handleCloseForm(); fetchCobrancas(); }} onCancel={handleCloseForm} user={user} companies={companies} clientes={clientes} />
            </DialogContent>
          </Dialog>

          <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso excluirá permanentemente a cobrança para <strong>{cobrancaToDelete?.cliente?.name}</strong> no valor de <strong>R$ {cobrancaToDelete?.valor.toFixed(2)}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={isPixModalOpen} onOpenChange={setIsPixModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pagamento PIX - Mercado Pago</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center p-4 space-y-4">
                {pixData ? (
                  <>
                    <img src={`data:image/jpeg;base64,${pixData.qrCodeBase64}`} alt="PIX QR Code" className="w-64 h-64 border rounded-lg" />
                    <p className="text-sm text-center text-muted-foreground">Escaneie o QR Code para pagar</p>
                    <div className="w-full p-2 bg-muted rounded-md break-words text-xs text-center">
                      {pixData.qrCode}
                    </div>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(pixData.qrCode);
                        toast({ title: 'Código PIX copiado!' });
                      }}
                      className="w-full"
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copiar Código
                    </Button>
                  </>
                ) : (
                  <p>Gerando QR Code...</p>
                )}
                <p className="text-xs text-muted-foreground text-center">Aguardando pagamento. O status será atualizado automaticamente.</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      );
    };

    const CobrancaForm = ({ cobranca, onSaveSuccess, onCancel, user, companies, clientes }) => {
      const { toast } = useToast();
      const [formData, setFormData] = useState({
        cliente_id: '', company_id: '', valor: '', data_vencimento: '', forma_pagamento: 'PIX', observacoes: '', status: 'Pendente', link_pagamento: ''
      });

      useEffect(() => {
        if (cobranca) {
          setFormData({
            cliente_id: cobranca.cliente_id || '',
            company_id: cobranca.company_id || '',
            valor: cobranca.valor || '',
            data_vencimento: cobranca.data_vencimento || '',
            forma_pagamento: cobranca.forma_pagamento || 'PIX',
            observacoes: cobranca.observacoes || '',
            status: cobranca.status || 'Pendente',
            link_pagamento: cobranca.link_pagamento || ''
          });
        } else {
          setFormData({
            cliente_id: '', company_id: '', valor: '', data_vencimento: '', forma_pagamento: 'PIX', observacoes: '', status: 'Pendente', link_pagamento: ''
          });
        }
      }, [cobranca]);

      const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
      };

      const handleValorChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = (Number(value) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        setFormData(prev => ({ ...prev, valor: value.replace('R$ ', '') }));
      };

      const handleSubmit = async (e) => {
        e.preventDefault();
        
        const valorNumerico = parseFloat(formData.valor.toString().replace('.', '').replace(',', '.'));

        const dataToSave = {
          ...formData,
          valor: valorNumerico,
          responsavel_id: user.id,
          data_pagamento: formData.status === 'Pago' ? new Date().toISOString().split('T')[0] : null,
        };

        const { error } = cobranca?.id
          ? await supabase.from('cobrancas').update(dataToSave).eq('id', cobranca.id)
          : await supabase.from('cobrancas').insert(dataToSave);

        if (error) {
          toast({ title: 'Erro ao salvar cobrança', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: `Cobrança ${cobranca?.id ? 'atualizada' : 'criada'} com sucesso!` });
          onSaveSuccess();
        }
      };

      return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
          <div><Label>Cliente</Label><select name="cliente_id" value={formData.cliente_id} onChange={handleChange} className="w-full p-2 border rounded-md bg-background" required><option value="">Selecione um cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><Label>Empresa</Label><select name="company_id" value={formData.company_id} onChange={handleChange} className="w-full p-2 border rounded-md bg-background" required><option value="">Selecione uma empresa</option>{companies?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Valor</Label><Input name="valor" value={formData.valor} onChange={handleValorChange} placeholder="0,00" required /></div>
            <div><Label>Data de Vencimento</Label><Input type="date" name="data_vencimento" value={formData.data_vencimento} onChange={handleChange} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Forma de Pagamento</Label><select name="forma_pagamento" value={formData.forma_pagamento} onChange={handleChange} className="w-full p-2 border rounded-md bg-background"><option>PIX</option><option>Cartão de Crédito</option><option>Boleto</option><option>Dinheiro</option><option>Transferência</option></select></div>
            <div><Label>Status</Label><select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded-md bg-background"><option>Pendente</option><option>Pago</option><option>Vencido</option></select></div>
          </div>
          <div><Label>Link de Pagamento (Opcional)</Label><Input name="link_pagamento" value={formData.link_pagamento} onChange={handleChange} placeholder="https://seu-link.com/pagar" /></div>
          <div><Label>Observações</Label><Textarea name="observacoes" value={formData.observacoes} onChange={handleChange} /></div>
          <DialogFooter className="pt-6">
            <Button type="button" variant="destructive" onClick={onCancel}><X className="mr-2 h-4 w-4" /> Cancelar</Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700"><Save className="mr-2 h-4 w-4" /> Salvar</Button>
          </DialogFooter>
        </form>
      );
    };

    export default Cobrancas;