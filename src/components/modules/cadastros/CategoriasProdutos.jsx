import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Edit, Save, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CategoriasProdutosTab = ({ companies }) => {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryData, setCategoryData] = useState({ name: '', company_ids: [], show_in_pdv: true });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_categories')
      .select('*, companies:product_category_company_access(company:companies(id, name))');

    if (error) {
      toast({ title: 'Erro ao buscar categorias', description: error.message, variant: 'destructive' });
    } else {
      const formattedData = data.map(cat => ({
        ...cat,
        companies: cat.companies.map(c => c.company)
      }));
      setCategories(formattedData || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleInputChange = (field, value) => {
    setCategoryData(prev => ({ ...prev, [field]: value }));
  };

  const handleCompanySelection = (companyId) => {
    setCategoryData(prev => {
      const newCompanyIds = prev.company_ids.includes(companyId)
        ? prev.company_ids.filter(id => id !== companyId)
        : [...prev.company_ids, companyId];
      return { ...prev, company_ids: newCompanyIds };
    });
  };

  const openForm = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryData({ name: category.name, company_ids: category.companies.map(c => c.id), show_in_pdv: category.show_in_pdv });
    } else {
      setEditingCategory(null);
      setCategoryData({ name: '', company_ids: [], show_in_pdv: true });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
  };

  const handleSaveCategory = async () => {
    if (!categoryData.name || categoryData.company_ids.length === 0) {
      toast({ title: 'Campos obrigatórios', description: 'Nome e pelo menos uma Empresa são obrigatórios.', variant: 'destructive' });
      return;
    }

    let categoryId = editingCategory?.id;
    const dataToSave = {
      name: categoryData.name,
      show_in_pdv: categoryData.show_in_pdv,
    };

    if (editingCategory) {
      const { error: updateError } = await supabase.from('product_categories').update(dataToSave).eq('id', editingCategory.id);
      if (updateError) {
        toast({ title: 'Erro ao atualizar categoria', description: updateError.message, variant: 'destructive' });
        return;
      }
    } else {
      const { data: newCategory, error: insertError } = await supabase.from('product_categories').insert(dataToSave).select('id').single();
      if (insertError) {
        toast({ title: 'Erro ao criar categoria', description: insertError.message, variant: 'destructive' });
        return;
      }
      categoryId = newCategory.id;
    }

    const { error: deleteAccessError } = await supabase.from('product_category_company_access').delete().eq('category_id', categoryId);
    if (deleteAccessError) {
      toast({ title: 'Erro ao atualizar acesso das empresas', description: deleteAccessError.message, variant: 'destructive' });
      return;
    }

    const accessData = categoryData.company_ids.map(company_id => ({ category_id: categoryId, company_id }));
    const { error: insertAccessError } = await supabase.from('product_category_company_access').insert(accessData);

    if (insertAccessError) {
      toast({ title: 'Erro ao salvar acesso das empresas', description: insertAccessError.message, variant: 'destructive' });
    } else {
      toast({ title: `Categoria ${editingCategory ? 'atualizada' : 'criada'} com sucesso!`, variant: 'success' });
      closeForm();
      fetchCategories();
    }
  };

  const confirmDelete = (category) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    const { error } = await supabase.from('product_categories').delete().eq('id', categoryToDelete.id);

    if (error) {
      toast({ title: 'Erro ao deletar categoria', description: 'Verifique se não há produtos associados a ela.', variant: 'destructive' });
    } else {
      toast({ title: 'Categoria deletada com sucesso!', variant: 'success' });
      fetchCategories();
    }
    setIsDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const renderForm = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-6 bg-white rounded-xl shadow-md border border-gray-100 space-y-6">
      <h3 className="text-xl font-bold text-gray-800">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h3>
      <div className="space-y-2">
        <Label htmlFor="name">Nome da Categoria</Label>
        <Input id="name" value={categoryData.name} onChange={e => handleInputChange('name', e.target.value)} />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="show_in_pdv" checked={categoryData.show_in_pdv} onCheckedChange={checked => handleInputChange('show_in_pdv', checked)} />
        <Label htmlFor="show_in_pdv">Exibir no PDV</Label>
      </div>
      <div className="space-y-2">
        <Label>Empresas com Acesso</Label>
        <div className="p-4 border rounded-md max-h-60 overflow-y-auto space-y-2">
          {companies.map(comp => (
            <div key={comp.id} className="flex items-center space-x-2">
              <Checkbox
                id={`company-${comp.id}`}
                checked={categoryData.company_ids.includes(comp.id)}
                onCheckedChange={() => handleCompanySelection(comp.id)}
              />
              <Label htmlFor={`company-${comp.id}`}>{comp.name}</Label>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <Button onClick={handleSaveCategory}><Save className="w-4 h-4 mr-2" /> Salvar</Button>
        <Button onClick={closeForm} variant="ghost"><X className="w-4 h-4 mr-2" /> Voltar</Button>
      </div>
    </motion.div>
  );

  if (isFormOpen) return renderForm();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => openForm()}><PlusCircle className="w-4 h-4 mr-2" /> Nova Categoria</Button>
      </div>
      
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Nome</th>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Empresas</th>
              <th className="p-4 text-center text-sm font-semibold text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="3" className="p-4 text-center">Carregando...</td></tr>
            ) : categories.map(cat => (
              <tr key={cat.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium">{cat.name}</td>
                <td className="p-4 text-sm text-gray-600">
                  {cat.companies.map(c => c.name).join(', ')}
                </td>
                <td className="p-4 text-center space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => openForm(cat)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => confirmDelete(cat)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria "{categoryToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CategoriasProdutosTab;