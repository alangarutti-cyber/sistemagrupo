import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { Plus, Search, Edit, Trash2, Upload, X, Save, User, Building, FileDown, FileUp, MoreHorizontal, MessageSquare, DollarSign } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
    import { Checkbox } from "@/components/ui/checkbox";
    import { Label } from '@/components/ui/label';
    import Cobrancas from '@/components/modules/Cobrancas';

    const ClientesTab = ({ user, companies }) => {
      const { toast } = useToast();
      const [clientes, setClientes] = useState([]);
      const [loading, setLoading] = useState(false);
      const [searchTerm, setSearchTerm] = useState('');
      const [statusFilter, setStatusFilter] = useState('Todos');
      const [isFormOpen, setIsFormOpen] = useState(false);
      const [editingCliente, setEditingCliente] = useState(null);
      const [selectedClientes, setSelectedClientes] = useState([]);
      const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
      const [isCobrancaOpen, setIsCobrancaOpen] = useState(false);
      const [clienteParaCobranca, setClienteParaCobranca] = useState(null);

      const filteredClientes = useMemo(() => {
        return clientes.filter(cliente => {
          const searchLower = searchTerm.toLowerCase();
          const matchesSearch = searchTerm === '' ||
            cliente.name?.toLowerCase().includes(searchLower) ||
            cliente.document1?.toLowerCase().includes(searchLower) ||
            cliente.phone?.toLowerCase().includes(searchLower);
          
          const matchesStatus = statusFilter === 'Todos' || cliente.status === statusFilter;

          return matchesSearch && matchesStatus;
        });
      }, [clientes, searchTerm, statusFilter]);

      const fetchClientes = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from('clientes')
          .select('*, company:companies(name), editor:app_users(name)')
          .order('name', { ascending: true });
          
        if (error) {
          toast({ title: 'Erro ao buscar clientes', description: error.message, variant: 'destructive' });
        } else {
          setClientes(data);
        }
        setLoading(false);
      }, [toast]);

      useEffect(() => {
        fetchClientes();
      }, [fetchClientes]);

      const handleOpenForm = (cliente = null) => {
        setEditingCliente(cliente);
        setIsFormOpen(true);
      };

      const handleCloseForm = () => {
        setEditingCliente(null);
        setIsFormOpen(false);
      };

      const handleDelete = async (clienteId) => {
        const { error } = await supabase.from('clientes').delete().eq('id', clienteId);
        if (error) {
          toast({ title: 'Erro ao excluir cliente', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Cliente excluído com sucesso!' });
          fetchClientes();
        }
      };

      const handleSelectionChange = (clienteId) => {
        setSelectedClientes(prev => 
          prev.includes(clienteId) ? prev.filter(id => id !== clienteId) : [...prev, clienteId]
        );
      };

      const handleSelectAll = (e) => {
        if (e.target.checked) {
          setSelectedClientes(filteredClientes.map(c => c.id));
        } else {
          setSelectedClientes([]);
        }
      };

      const handleWhatsAppClick = (cliente) => {
        if (!cliente.phone) {
          toast({ title: 'Telefone inválido', description: 'O cliente não possui um número de telefone cadastrado.', variant: 'destructive' });
          return;
        }
        const phone = cliente.phone.replace(/\D/g, '');
        if (phone.length < 10) {
          toast({ title: 'Telefone inválido', description: 'O formato do telefone é inválido.', variant: 'destructive' });
          return;
        }
        const url = `https://api.whatsapp.com/send?phone=55${phone}&text=Olá%20${encodeURIComponent(cliente.name)},%20tudo%20bem?%20Aqui%20é%20da%20Stout%20Group!`;
        window.open(url, '_blank');
      };

      const handleCobrancaClick = (cliente) => {
        setClienteParaCobranca(cliente);
        setIsCobrancaOpen(true);
      };

      const handleExportTemplate = () => {
        toast({ title: 'Funcionalidade em desenvolvimento' });
      };

      const handleImport = (e) => {
        toast({ title: 'Funcionalidade em desenvolvimento' });
      };

      return (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4 justify-between items-center">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative min-w-[250px]">
                <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-2 border rounded-md bg-background">
                <option>Todos</option>
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExportTemplate}><FileDown className="mr-2 h-4 w-4" /> Modelo</Button>
              <Button asChild variant="outline"><label htmlFor="import-file"><FileUp className="mr-2 h-4 w-4" /> Importar<input type="file" id="import-file" className="hidden" onChange={handleImport} accept=".xlsx, .xls" /></label></Button>
              {selectedClientes.length > 0 && <Button onClick={() => setIsBulkEditOpen(true)}><Edit className="mr-2 h-4 w-4" /> Editar em Massa</Button>}
              <Button onClick={() => handleOpenForm()}><Plus className="mr-2 h-4 w-4" /> Novo Cliente</Button>
            </div>
          </div>

          {loading ? <p>Carregando...</p> : (
            <div className="bg-card rounded-lg border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-muted-foreground">
                      <th className="p-3 w-10"><Checkbox onCheckedChange={handleSelectAll} checked={selectedClientes.length === filteredClientes.length && filteredClientes.length > 0} /></th>
                      <th className="p-3 text-left font-medium">Nome</th>
                      <th className="p-3 text-left font-medium hidden md:table-cell">CPF/CNPJ</th>
                      <th className="p-3 text-left font-medium hidden lg:table-cell">Telefone</th>
                      <th className="p-3 text-left font-medium hidden lg:table-cell">Cidade</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClientes.map((cliente) => (
                      <tr key={cliente.id} className="border-b hover:bg-muted/50">
                        <td className="p-3"><Checkbox onCheckedChange={() => handleSelectionChange(cliente.id)} checked={selectedClientes.includes(cliente.id)} /></td>
                        <td className="p-3 font-medium">{cliente.name}</td>
                        <td className="p-3 hidden md:table-cell">{cliente.document1}</td>
                        <td className="p-3 hidden lg:table-cell">{cliente.phone}</td>
                        <td className="p-3 hidden lg:table-cell">{cliente.city}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${cliente.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{cliente.status}</span>
                        </td>
                        <td className="p-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => handleOpenForm(cliente)}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleWhatsAppClick(cliente)} className="text-green-600 focus:text-green-700"><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCobrancaClick(cliente)} className="text-blue-600 focus:text-blue-700"><DollarSign className="mr-2 h-4 w-4" /> Enviar Cobrança</DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive-foreground focus:bg-destructive"><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Isso excluirá permanentemente o cliente.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(cliente.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="sm:max-w-4xl">
              <DialogHeader><DialogTitle>{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>
              <ClienteForm cliente={editingCliente} onSaveSuccess={() => { handleCloseForm(); fetchClientes(); }} onCancel={handleCloseForm} user={user} companies={companies} />
            </DialogContent>
          </Dialog>
          
          <Dialog open={isCobrancaOpen} onOpenChange={setIsCobrancaOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Nova Cobrança para {clienteParaCobranca?.name}</DialogTitle></DialogHeader>
              <CobrancaForm clientePredefinido={clienteParaCobranca} onSaveSuccess={() => setIsCobrancaOpen(false)} onCancel={() => setIsCobrancaOpen(false)} user={user} companies={companies} clientes={clientes} />
            </DialogContent>
          </Dialog>

          <BulkEditDialog 
            isOpen={isBulkEditOpen} 
            setIsOpen={setIsBulkEditOpen} 
            selectedIds={selectedClientes} 
            onBulkUpdateSuccess={() => { fetchClientes(); setSelectedClientes([]); }}
            companies={companies}
          />
        </div>
      );
    };

    const ClienteForm = ({ cliente, onSaveSuccess, onCancel, user, companies, isDialog = false }) => {
      const { toast } = useToast();
      const [formData, setFormData] = useState({
        name: '', document1: '', document2: '', birth_date: '', phone: '', email: '',
        street: '', number: '', neighborhood: '', city: '', state: '', zip_code: '',
        person_type: 'Física', credit_limit: '', default_payment_condition: '',
        observations: '', status: 'Ativo', image_url: '', company_id: null
      });
      const [isUploading, setIsUploading] = useState(false);

      useEffect(() => {
        if (cliente) {
          setFormData(Object.keys(formData).reduce((acc, key) => {
            acc[key] = cliente[key] ?? formData[key];
            return acc;
          }, {}));
        } else {
          setFormData({
            name: '', document1: '', document2: '', birth_date: '', phone: '', email: '',
            street: '', number: '', neighborhood: '', city: '', state: '', zip_code: '',
            person_type: 'Física', credit_limit: '', default_payment_condition: '',
            observations: '', status: 'Ativo', image_url: '', company_id: companies.length === 1 ? companies[0].id : null
          });
        }
      }, [cliente, companies]);

      const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
      };

      const handlePhoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
        if (value.length > 9) value = `${value.slice(0, 10)}-${value.slice(10)}`;
        setFormData(prev => ({ ...prev, phone: value }));
      };

      const handleCreditLimitChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = (Number(value) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        setFormData(prev => ({ ...prev, credit_limit: value }));
      };

      const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage.from('private_files').upload(`clientes_fotos/${fileName}`, file);

        if (error) {
          toast({ title: 'Erro no upload da imagem', description: error.message, variant: 'destructive' });
        } else {
          const { data: { publicUrl } } = supabase.storage.from('private_files').getPublicUrl(`clientes_fotos/${fileName}`);
          setFormData(prev => ({ ...prev, image_url: publicUrl }));
          toast({ title: 'Imagem enviada com sucesso!' });
        }
        setIsUploading(false);
      };

      const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.document1) {
          const { data: existing, error: checkError } = await supabase
            .from('clientes')
            .select('id')
            .eq('document1', formData.document1)
            .neq('id', cliente?.id || '00000000-0000-0000-0000-000000000000')
            .single();
          if (existing) {
            toast({ title: 'CPF/CNPJ já cadastrado', variant: 'destructive' });
            return;
          }
        }
        
        const credit_limit_numeric = formData.credit_limit ? parseFloat(formData.credit_limit.replace('R$', '').replace('.', '').replace(',', '.')) : null;

        const dataToSave = { 
          ...formData, 
          credit_limit: credit_limit_numeric,
          birth_date: formData.birth_date || null,
          last_edited_by: user.id,
          last_edited_at: new Date().toISOString(),
        };

        const { error } = cliente 
          ? await supabase.from('clientes').update(dataToSave).eq('id', cliente.id)
          : await supabase.from('clientes').insert(dataToSave);

        if (error) {
          toast({ title: 'Erro ao salvar cliente', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: `Cliente ${cliente ? 'atualizado' : 'criado'} com sucesso!` });
          onSaveSuccess();
        }
      };

      const formContent = (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1 flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border overflow-hidden">
                {formData.image_url ? <img src={formData.image_url} alt="Foto do cliente" className="w-full h-full object-cover" /> : (formData.person_type === 'Física' ? <User className="w-16 h-16 text-muted-foreground" /> : <Building className="w-16 h-16 text-muted-foreground" />)}
              </div>
              <Button asChild variant="outline"><label htmlFor="image-upload"><Upload className="mr-2 h-4 w-4" /> {isUploading ? 'Enviando...' : 'Enviar Foto'}<input id="image-upload" type="file" className="hidden" onChange={handleImageUpload} disabled={isUploading} /></label></Button>
            </div>
            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><Label>Nome Completo / Razão Social</Label><Input name="name" value={formData.name} onChange={handleChange} required /></div>
              <div><Label>Tipo de Pessoa</Label><select name="person_type" value={formData.person_type} onChange={handleChange} className="w-full p-2 border rounded-md bg-background"><option value="Física">Física</option><option value="Jurídica">Jurídica</option></select></div>
              <div><Label>Status</Label><select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded-md bg-background"><option value="Ativo">Ativo</option><option value="Inativo">Inativo</option></select></div>
              <div><Label>{formData.person_type === 'Física' ? 'CPF' : 'CNPJ'}</Label><Input name="document1" value={formData.document1} onChange={handleChange} /></div>
              <div><Label>{formData.person_type === 'Física' ? 'RG' : 'Inscrição Estadual'}</Label><Input name="document2" value={formData.document2} onChange={handleChange} /></div>
              <div><Label>{formData.person_type === 'Física' ? 'Data de Nascimento' : 'Data de Fundação'}</Label><Input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} /></div>
              <div><Label>Telefone</Label><Input name="phone" value={formData.phone} onChange={handlePhoneChange} placeholder="(99) 99999-9999" /></div>
              <div className="sm:col-span-2"><Label>E-mail</Label><Input type="email" name="email" value={formData.email} onChange={handleChange} /></div>
            </div>
          </div>
          <div className="space-y-4 border-t pt-6">
            <h3 className="font-semibold">Endereço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
              <div className="sm:col-span-4"><Label>Rua</Label><Input name="street" value={formData.street} onChange={handleChange} /></div>
              <div className="sm:col-span-2"><Label>Número</Label><Input name="number" value={formData.number} onChange={handleChange} /></div>
              <div className="sm:col-span-3"><Label>Bairro</Label><Input name="neighborhood" value={formData.neighborhood} onChange={handleChange} /></div>
              <div className="sm:col-span-3"><Label>Cidade</Label><Input name="city" value={formData.city} onChange={handleChange} /></div>
              <div className="sm:col-span-2"><Label>UF</Label><Input name="state" value={formData.state} onChange={handleChange} maxLength="2" /></div>
              <div className="sm:col-span-2"><Label>CEP</Label><Input name="zip_code" value={formData.zip_code} onChange={handleChange} /></div>
            </div>
          </div>
          <div className="space-y-4 border-t pt-6">
            <h3 className="font-semibold">Financeiro e Observações</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Limite de Crédito</Label><Input name="credit_limit" value={formData.credit_limit} onChange={handleCreditLimitChange} placeholder="R$ 0,00" /></div>
              <div><Label>Condição de Pagamento Padrão</Label><Input name="default_payment_condition" value={formData.default_payment_condition} onChange={handleChange} /></div>
              <div><Label>Empresa Vinculada</Label><select name="company_id" value={formData.company_id || ''} onChange={handleChange} className="w-full p-2 border rounded-md bg-background"><option value="">Nenhuma</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="sm:col-span-2"><Label>Observações Gerais</Label><Textarea name="observations" value={formData.observations} onChange={handleChange} /></div>
            </div>
          </div>
          <DialogFooter className="pt-6">
            <Button type="button" variant="destructive" onClick={onCancel}><X className="mr-2 h-4 w-4" /> Cancelar</Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700"><Save className="mr-2 h-4 w-4" /> Salvar</Button>
          </DialogFooter>
        </form>
      );

      if (isDialog) {
        return formContent;
      }

      return <div className="p-4">{formContent}</div>;
    };

    const CobrancaForm = ({ clientePredefinido, onSaveSuccess, onCancel, user, companies, clientes }) => {
      const { toast } = useToast();
      const [formData, setFormData] = useState({
        cliente_id: '', company_id: '', valor: '', data_vencimento: '', forma_pagamento: 'PIX', observacoes: '', status: 'Pendente', link_pagamento: ''
      });

      useEffect(() => {
        if (clientePredefinido) {
          setFormData(prev => ({
            ...prev,
            cliente_id: clientePredefinido.id,
            company_id: clientePredefinido.company_id || '',
          }));
        }
      }, [clientePredefinido]);

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

        const { error } = await supabase.from('cobrancas').insert(dataToSave);

        if (error) {
          toast({ title: 'Erro ao salvar cobrança', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: `Cobrança criada com sucesso!` });
          onSaveSuccess();
        }
      };

      return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
          <div><Label>Cliente</Label><select name="cliente_id" value={formData.cliente_id} onChange={handleChange} className="w-full p-2 border rounded-md bg-background" required disabled><option value="">Selecione um cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><Label>Empresa</Label><select name="company_id" value={formData.company_id} onChange={handleChange} className="w-full p-2 border rounded-md bg-background" required><option value="">Selecione uma empresa</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
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

    const BulkEditDialog = ({ isOpen, setIsOpen, selectedIds, onBulkUpdateSuccess, companies }) => {
      const { toast } = useToast();
      const [updateData, setUpdateData] = useState({ status: '', company_id: '' });

      const handleBulkUpdate = async () => {
        const dataToUpdate = {};
        if (updateData.status) dataToUpdate.status = updateData.status;
        if (updateData.company_id) dataToUpdate.company_id = updateData.company_id;

        if (Object.keys(dataToUpdate).length === 0) {
          toast({ title: "Nenhuma alteração selecionada", variant: "destructive" });
          return;
        }

        const { error } = await supabase.from('clientes').update(dataToUpdate).in('id', selectedIds);

        if (error) {
          toast({ title: "Erro na atualização em massa", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Clientes atualizados com sucesso!" });
          onBulkUpdateSuccess();
          setIsOpen(false);
        }
      };

      return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar {selectedIds.length} Clientes em Massa</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Status</Label>
                <select value={updateData.status} onChange={(e) => setUpdateData(p => ({...p, status: e.target.value}))} className="w-full p-2 border rounded-md bg-background">
                  <option value="">Manter original</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
              <div>
                <Label>Empresa Vinculada</Label>
                <select value={updateData.company_id} onChange={(e) => setUpdateData(p => ({...p, company_id: e.target.value}))} className="w-full p-2 border rounded-md bg-background">
                  <option value="">Manter original</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button onClick={handleBulkUpdate}>Atualizar Clientes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default ClienteForm;