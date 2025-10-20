import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Check, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";

const Configuracoes = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('empresas');
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyToDelete, setCompanyToDelete] = useState(null);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          cnpj,
          phone,
          email,
          address,
          sectors,
          app_users!app_users_company_id_fkey(*)
        `);
      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      const { data: usersData, error: usersError } = await supabase
        .from('app_users')
        .select('*');
      if (usersError) throw usersError;
      setUsers(usersData || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleEdit = (company) => {
    setSelectedCompany({
      ...company,
      responsible_id: company.app_users?.id || null,
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedCompany({
      name: '',
      cnpj: '',
      phone: '',
      email: '',
      address: '',
      responsible_id: null,
      sectors: [],
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (company) => {
    setCompanyToDelete(company);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!companyToDelete) return;
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyToDelete.id);
      if (error) throw error;
      toast({ title: "Sucesso!", description: "Empresa removida." });
      fetchInitialData();
      setIsDeleteConfirmOpen(false);
      setCompanyToDelete(null);
    } catch (error) {
      toast({
        title: "Erro ao remover empresa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const upsertData = {
      name: selectedCompany.name,
      cnpj: selectedCompany.cnpj,
      phone: selectedCompany.phone,
      email: selectedCompany.email,
      address: selectedCompany.address,
      sectors: selectedCompany.sectors || [],
    };
    
    let query;
    if (selectedCompany.id) {
      query = supabase.from('companies').update(upsertData).eq('id', selectedCompany.id);
    } else {
      query = supabase.from('companies').insert(upsertData);
    }

    try {
      const { error } = await query;
      if (error) throw error;
      toast({ title: "Sucesso!", description: `Empresa ${selectedCompany.id ? 'atualizada' : 'criada'} com sucesso.` });
      fetchInitialData();
      setIsModalOpen(false);
      setSelectedCompany(null);
    } catch (error) {
      toast({
        title: "Erro ao salvar empresa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => a.name.localeCompare(b.name));
  }, [companies]);
  
  const responsibleUser = (company) => {
    if (!company.app_users || company.app_users.length === 0) return 'N/D';
    return company.app_users[0].name;
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
          <CardDescription>Gerencie as configurações do seu sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('empresas')}
              className={`px-4 py-2 text-sm font-medium ${activeTab === 'empresas' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            >
              Empresas
            </button>
          </div>
          <div className="pt-6">
            {activeTab === 'empresas' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Empresas Cadastradas</h3>
                  <Button onClick={handleAddNew}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Nova Empresa
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center">Carregando...</TableCell>
                        </TableRow>
                      ) : sortedCompanies.length > 0 ? (
                        sortedCompanies.map((company) => (
                          <TableRow key={company.id}>
                            <TableCell className="font-medium">{company.name}</TableCell>
                            <TableCell>{company.cnpj}</TableCell>
                            <TableCell>{responsibleUser(company)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(company)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(company)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center">Nenhuma empresa encontrada.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isModalOpen && selectedCompany && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle>{selectedCompany.id ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
              <DialogDescription>
                Preencha as informações da empresa.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Nome</Label>
                  <Input id="name" value={selectedCompany.name} onChange={(e) => setSelectedCompany({ ...selectedCompany, name: e.target.value })} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="cnpj" className="text-right">CNPJ</Label>
                  <Input id="cnpj" value={selectedCompany.cnpj} onChange={(e) => setSelectedCompany({ ...selectedCompany, cnpj: e.target.value })} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">Telefone</Label>
                  <Input id="phone" value={selectedCompany.phone} onChange={(e) => setSelectedCompany({ ...selectedCompany, phone: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" type="email" value={selectedCompany.email} onChange={(e) => setSelectedCompany({ ...selectedCompany, email: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="address" className="text-right">Endereço</Label>
                  <Input id="address" value={selectedCompany.address} onChange={(e) => setSelectedCompany({ ...selectedCompany, address: e.target.value })} className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a empresa "{companyToDelete?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Configuracoes;