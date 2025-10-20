import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Save, Trash2, Upload, Search, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox";
import { useUser } from '@/contexts/UserContext';
import { useOutletContext } from 'react-router-dom';

const FornecedoresContent = ({ user, companies }) => {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [xmlFile, setXmlFile] = useState(null);
  const [xmlData, setXmlData] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importOptions, setImportOptions] = useState({
    addSupplier: true,
    addProducts: true,
    updateStock: true,
    createPayable: true,
  });

  const allowedCompanies = React.useMemo(() => {
    if (!user || !companies) return [];
    if (user.is_admin) return companies;
    const userCompanyIds = user.company_ids?.map(uc => uc.company_id) || [];
    return companies.filter(c => userCompanyIds.includes(c.id));
  }, [user, companies]);

  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  useEffect(() => {
    if (allowedCompanies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(allowedCompanies[0].id);
    }
  }, [allowedCompanies, selectedCompanyId]);

  const fetchSuppliers = useCallback(async () => {
    if (!selectedCompanyId) {
        setSuppliers([]);
        setLoading(false);
        return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', selectedCompanyId)
      .order('name', { ascending: true });

    if (error) {
      toast({ title: "Erro ao buscar fornecedores", description: error.message, variant: "destructive" });
    } else {
      setSuppliers(data);
    }
    setLoading(false);
  }, [toast, selectedCompanyId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/xml') {
      setXmlFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const xmlText = event.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");
        
        const nfeProc = xmlDoc.getElementsByTagName("nfeProc")[0];
        if (!nfeProc) {
            toast({ title: "XML inválido", description: "O arquivo não parece ser uma NF-e processada.", variant: "destructive" });
            return;
        }

        const getTagValue = (tagName, parent = xmlDoc) => {
            const tag = parent.getElementsByTagName(tagName)[0];
            return tag ? tag.textContent : null;
        };

        const emit = xmlDoc.getElementsByTagName("emit")[0];
        const dest = xmlDoc.getElementsByTagName("dest")[0];
        const ide = xmlDoc.getElementsByTagName("ide")[0];
        const total = xmlDoc.getElementsByTagName("ICMSTot")[0];

        const supplierCNPJ = getTagValue("CNPJ", emit);
        const supplierName = getTagValue("xNome", emit);
        const invoiceNumber = getTagValue("nNF", ide);
        const totalValue = getTagValue("vNF", total);
        const dueDateTag = xmlDoc.getElementsByTagName("venc")[0];
        const dueDate = dueDateTag ? getTagValue("dVenc", dueDateTag) : new Date().toISOString().split('T')[0];

        const items = Array.from(xmlDoc.getElementsByTagName("det")).map(item => ({
          code: getTagValue("cProd", item),
          name: getTagValue("xProd", item),
          quantity: parseFloat(getTagValue("qCom", item) || 0),
          unit: getTagValue("uCom", item),
          unitPrice: parseFloat(getTagValue("vUnCom", item) || 0),
          totalPrice: parseFloat(getTagValue("vProd", item) || 0)
        }));

        setXmlData({
          supplier: { name: supplierName, cnpj: supplierCNPJ },
          invoice: { number: invoiceNumber, total: parseFloat(totalValue), dueDate },
          items: items
        });
      };
      reader.readAsText(file);
    } else {
      toast({ title: "Arquivo inválido", description: "Por favor, selecione um arquivo XML.", variant: "destructive" });
    }
  };
  
  const handleImportXml = async () => {
    if (!xmlData) {
        toast({ title: "Sem dados para importar", description: "Carregue um arquivo XML primeiro.", variant: "destructive" });
        return;
    }

    setIsImporting(true);

    try {
        const { data, error } = await supabase.functions.invoke('import-xml-nfe', {
            body: {
                companyId: selectedCompanyId,
                userId: user.id,
                xmlData,
                importOptions,
            }
        });

        if (error || (data && !data.ok && data.message)) {
            throw new Error(data?.message || error?.message || "Erro desconhecido na importação.");
        }
        
        toast({ title: "Importação Concluída!", description: data.message || "Operação realizada com sucesso.", variant: "success" });
        fetchSuppliers(); // Refresh list
        setXmlFile(null);
        setXmlData(null);
        
    } catch (error) {
        toast({ title: "Erro na Importação", description: error.message, variant: "destructive" });
    } finally {
        setIsImporting(false);
    }
  };


  const handleSave = async () => {
    if (!editingSupplier.name) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    const supplierData = { ...editingSupplier, company_id: selectedCompanyId };
    
    let result;
    if (supplierData.id) { // Update
      result = await supabase.from('suppliers').update(supplierData).eq('id', supplierData.id).select();
    } else { // Insert
      const { id, ...insertData } = supplierData;
      result = await supabase.from('suppliers').insert(insertData).select();
    }

    const { data, error } = result;

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Fornecedor ${supplierData.id ? 'atualizado' : 'adicionado'} com sucesso!`, variant: "success" });
      setIsModalOpen(false);
      setEditingSupplier(null);
      fetchSuppliers();
    }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Fornecedor excluído com sucesso!", variant: "success" });
      setSuppliers(suppliers.filter(s => s.id !== id));
    }
  };

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier({ ...supplier });
    } else {
      setEditingSupplier({ id: null, name: '', cnpj: '', category: '', contact: '' });
    }
    setIsModalOpen(true);
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.cnpj && s.cnpj.includes(searchTerm))
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Fornecedores</h1>
         <div className="flex gap-2">
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Importar XML</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                    <DialogTitle>Importar Nota Fiscal (XML)</DialogTitle>
                    <DialogDescription>
                        Faça o upload de um arquivo XML para cadastrar automaticamente o fornecedor, produtos, estoque e contas a pagar.
                    </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                    <Input type="file" accept=".xml" onChange={handleFileChange} />
                    {xmlData && (
                        <div className="p-4 bg-gray-50 rounded-lg border text-sm space-y-3">
                            <p><strong>Fornecedor:</strong> {xmlData.supplier.name} ({xmlData.supplier.cnpj})</p>
                            <p><strong>Nota Fiscal:</strong> Nº {xmlData.invoice.number} | <strong>Total:</strong> R$ {xmlData.invoice.total.toFixed(2)}</p>
                            <p><strong>Itens na nota:</strong> {xmlData.items.length}</p>
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="addSupplier" checked={importOptions.addSupplier} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, addSupplier: checked}))} />
                                    <label htmlFor="addSupplier" className="text-sm font-medium leading-none">Cadastrar/Atualizar Fornecedor</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="addProducts" checked={importOptions.addProducts} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, addProducts: checked}))} />
                                    <label htmlFor="addProducts" className="text-sm font-medium leading-none">Cadastrar/Atualizar Produtos</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="updateStock" checked={importOptions.updateStock} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, updateStock: checked}))} />
                                    <label htmlFor="updateStock" className="text-sm font-medium leading-none">Atualizar Estoque</label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="createPayable" checked={importOptions.createPayable} onCheckedChange={(checked) => setImportOptions(prev => ({...prev, createPayable: checked}))} />
                                    <label htmlFor="createPayable" className="text-sm font-medium leading-none">Lançar Contas a Pagar</label>
                                </div>
                            </div>
                        </div>
                    )}
                    </div>
                    <DialogFooter>
                        <Button onClick={handleImportXml} disabled={!xmlFile || isImporting}>
                            {isImporting ? 'Importando...' : 'Importar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Novo Fornecedor
            </Button>
        </div>
      </div>
      
       <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company-select">Empresa</Label>
               <select
                  id="company-select"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-md bg-gray-50"
                  disabled={allowedCompanies.length === 0}
                >
                  {allowedCompanies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
            </div>
             <div>
                <Label htmlFor="search-supplier">Buscar</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="search-supplier"
                      placeholder="Buscar por nome ou CNPJ"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                </div>
            </div>
          </div>
        </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CNPJ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="4" className="text-center py-10">Carregando...</td></tr>
              ) : filteredSuppliers.length > 0 ? (
                filteredSuppliers.map(supplier => (
                  <motion.tr key={supplier.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{supplier.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.cnpj}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                       <Button variant="ghost" size="icon" onClick={() => openModal(supplier)}><Edit className="w-4 h-4" /></Button>
                       <Button variant="ghost" size="icon" onClick={() => handleDelete(supplier.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr><td colSpan="4" className="text-center py-10 text-gray-500">Nenhum fornecedor encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier?.id ? 'Editar' : 'Novo'} Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input placeholder="Nome do Fornecedor" value={editingSupplier?.name || ''} onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })} />
            <Input placeholder="CNPJ" value={editingSupplier?.cnpj || ''} onChange={(e) => setEditingSupplier({ ...editingSupplier, cnpj: e.target.value })} />
            <Input placeholder="Categoria" value={editingSupplier?.category || ''} onChange={(e) => setEditingSupplier({ ...editingSupplier, category: e.target.value })} />
            <Input placeholder="Contato (Telefone/Email)" value={editingSupplier?.contact || ''} onChange={(e) => setEditingSupplier({ ...editingSupplier, contact: e.target.value })} />
          </div>
          <DialogFooter>
            <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
};

const Fornecedores = () => {
  const outletContext = useOutletContext();
  const userContext = useUser();
  const { user, companies } = outletContext || userContext;

  if (!user || !companies) {
    return <div>Carregando dados do usuário...</div>;
  }

  return <FornecedoresContent user={user} companies={companies} />;
};

export default Fornecedores;