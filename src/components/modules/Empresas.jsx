import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import { Building2, PlusCircle, Trash2, Edit, Save, X } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import {
      AlertDialog,
      AlertDialogAction,
      AlertDialogCancel,
      AlertDialogContent,
      AlertDialogDescription,
      AlertDialogFooter,
      AlertDialogHeader,
      AlertDialogTitle,
      AlertDialogTrigger,
    } from "@/components/ui/alert-dialog";

    const Empresas = ({ companies: initialCompanies, onDataUpdate }) => {
      const { toast } = useToast();
      const [companies, setCompanies] = useState(initialCompanies || []);
      const [newCompany, setNewCompany] = useState({ name: '', cnpj: '', email: '', phone: '', zip_code: '', street: '', number: '', neighborhood: '', city: '', state: '' });
      const [editingCompanyId, setEditingCompanyId] = useState(null);
      const [editingCompanyData, setEditingCompanyData] = useState(null);

      const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCompany(prev => ({ ...prev, [name]: value }));
      };
      
      const fetchAddressByCep = async (cep, targetState) => {
          const cleanCep = cep.replace(/\D/g, '');
          if (cleanCep.length !== 8) return;
          
          try {
              const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
              if(!response.ok) throw new Error('CEP não encontrado');
              const data = await response.json();
              if (data.erro) {
                  toast({ title: "CEP não encontrado", description: "Por favor, verifique o CEP digitado.", variant: "destructive" });
                  return;
              }
              const update = {
                  street: data.logradouro,
                  neighborhood: data.bairro,
                  city: data.localidade,
                  state: data.uf,
              };
              if (targetState === 'new') {
                  setNewCompany(prev => ({ ...prev, ...update }));
              } else if (targetState === 'edit') {
                  setEditingCompanyData(prev => ({ ...prev, ...update }));
              }
          } catch (error) {
              toast({ title: "Erro ao buscar CEP", description: error.message, variant: "destructive" });
          }
      };


      const handleAddCompany = async () => {
        if (!newCompany.name || !newCompany.cnpj) {
          toast({
            title: 'Campos obrigatórios',
            description: 'Nome e CNPJ são necessários para cadastrar uma nova empresa.',
            variant: 'destructive',
          });
          return;
        }

        const { data, error } = await supabase
          .from('companies')
          .insert({
            ...newCompany,
            uuid: '00000000-0000-0000-0000-000000000000' // Placeholder
          })
          .select()
          .single();

        if (error) {
          toast({
            title: 'Erro ao adicionar empresa',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Sucesso!',
            description: 'Empresa adicionada.',
            variant: 'success',
          });
          setNewCompany({ name: '', cnpj: '', email: '', phone: '', zip_code: '', street: '', number: '', neighborhood: '', city: '', state: '' });
          onDataUpdate();
        }
      };

      const handleDeleteCompany = async (companyId) => {
        const { error } = await supabase.from('companies').delete().eq('id', companyId);

        if (error) {
          toast({
            title: 'Erro ao excluir empresa',
            description: 'Verifique se a empresa não está vinculada a outros cadastros.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Empresa excluída!',
            variant: 'success',
          });
          onDataUpdate();
        }
      };
      
      const handleEditClick = (company) => {
        setEditingCompanyId(company.id);
        setEditingCompanyData({ ...company });
      };

      const handleCancelEdit = () => {
        setEditingCompanyId(null);
        setEditingCompanyData(null);
      };

      const handleUpdateCompany = async () => {
        const { id, uuid, created_at, ...updateData } = editingCompanyData;
        const { data, error } = await supabase
          .from('companies')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
           toast({
            title: 'Erro ao atualizar empresa',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Empresa atualizada!',
            variant: 'success',
          });
          setEditingCompanyId(null);
          setEditingCompanyData(null);
          onDataUpdate();
        }
      };
      
      const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditingCompanyData(prev => ({...prev, [name]: value}));
      };

      React.useEffect(() => {
        setCompanies(initialCompanies || []);
      }, [initialCompanies]);

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">Gerenciamento de Empresas</h1>
            </div>
          </div>

          <motion.div className="bg-card p-6 rounded-xl shadow-md border">
            <h2 className="text-lg font-semibold mb-4">Adicionar Nova Empresa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input name="name" placeholder="Nome da Empresa" value={newCompany.name} onChange={handleInputChange} className="lg:col-span-2" />
              <Input name="cnpj" placeholder="CNPJ" value={newCompany.cnpj} onChange={handleInputChange} />
              <Input name="email" placeholder="E-mail" value={newCompany.email} onChange={handleInputChange} />
              <Input name="phone" placeholder="Telefone" value={newCompany.phone} onChange={handleInputChange} />
               <Input name="zip_code" placeholder="CEP" value={newCompany.zip_code} onChange={handleInputChange} onBlur={(e) => fetchAddressByCep(e.target.value, 'new')} />
              <Input name="street" placeholder="Rua" value={newCompany.street} onChange={handleInputChange} className="lg:col-span-2" />
              <Input name="number" placeholder="Número" value={newCompany.number} onChange={handleInputChange} />
              <Input name="neighborhood" placeholder="Bairro" value={newCompany.neighborhood} onChange={handleInputChange} />
              <Input name="city" placeholder="Cidade" value={newCompany.city} onChange={handleInputChange} />
              <Input name="state" placeholder="Estado" value={newCompany.state} onChange={handleInputChange} />
            </div>
            <Button onClick={handleAddCompany} className="mt-4">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Empresa
            </Button>
          </motion.div>

          <div className="space-y-4">
            {companies.map(company => (
              <motion.div
                key={company.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-card p-4 rounded-xl shadow-sm border"
              >
                {editingCompanyId === company.id ? (
                  <div className="space-y-3">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                       <Input name="name" value={editingCompanyData.name || ''} onChange={handleEditInputChange} placeholder="Nome da Empresa" className="lg:col-span-2"/>
                       <Input name="cnpj" value={editingCompanyData.cnpj || ''} onChange={handleEditInputChange} placeholder="CNPJ"/>
                       <Input name="email" value={editingCompanyData.email || ''} onChange={handleEditInputChange} placeholder="E-mail"/>
                       <Input name="phone" value={editingCompanyData.phone || ''} onChange={handleEditInputChange} placeholder="Telefone"/>
                       <Input name="zip_code" value={editingCompanyData.zip_code || ''} onChange={handleEditInputChange} placeholder="CEP" onBlur={(e) => fetchAddressByCep(e.target.value, 'edit')}/>
                       <Input name="street" value={editingCompanyData.street || ''} onChange={handleEditInputChange} placeholder="Rua" className="lg:col-span-2"/>
                       <Input name="number" value={editingCompanyData.number || ''} onChange={handleEditInputChange} placeholder="Número"/>
                       <Input name="neighborhood" value={editingCompanyData.neighborhood || ''} onChange={handleEditInputChange} placeholder="Bairro"/>
                       <Input name="city" value={editingCompanyData.city || ''} onChange={handleEditInputChange} placeholder="Cidade"/>
                       <Input name="state" value={editingCompanyData.state || ''} onChange={handleEditInputChange} placeholder="Estado"/>
                    </div>
                     <div className="flex gap-2 mt-2">
                       <Button onClick={handleUpdateCompany} size="sm"><Save className="mr-2 h-4 w-4"/>Salvar</Button>
                       <Button onClick={handleCancelEdit} variant="ghost" size="sm"><X className="mr-2 h-4 w-4"/>Cancelar</Button>
                     </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <h3 className="font-bold text-lg">{company.name}</h3>
                      <p className="text-sm text-muted-foreground">CNPJ: {company.cnpj}</p>
                      <p className="text-sm text-muted-foreground">Email: {company.email || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">Telefone: {company.phone || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">
                        Endereço: {company.street || ''} {company.number || ''}, {company.neighborhood || ''} - {company.city || ''}/{company.state || ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEditClick(company)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Isso excluirá permanentemente a empresa e todos os dados associados a ela.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCompany(company.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      );
    };

    export default Empresas;