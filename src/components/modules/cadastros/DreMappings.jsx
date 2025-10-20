import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, Save, Trash2 } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Label } from '@/components/ui/label';

    const DreMappingsTab = ({ companies, user }) => {
      const { toast } = useToast();
      const [mappings, setMappings] = useState([]);
      const [productCategories, setProductCategories] = useState([]);
      const [dreGroups, setDreGroups] = useState([]);
      const [loading, setLoading] = useState(true);
      const [selectedCompany, setSelectedCompany] = useState('');

      const allowedCompanies = user?.is_admin ? companies : companies.filter(c => user?.permissions?.companies?.includes(c.id));

      useEffect(() => {
        if (allowedCompanies && allowedCompanies.length > 0 && !selectedCompany) {
          setSelectedCompany(allowedCompanies[0].id);
        }
      }, [allowedCompanies, selectedCompany]);

      const fetchData = useCallback(async () => {
        if (!selectedCompany) return;
        setLoading(true);

        const { data: mappingsData, error: mappingsError } = await supabase
          .from('dre_group_mappings')
          .select('*, product_category:product_categories(name), dre_group:dre_groups(name)')
          .eq('company_id', selectedCompany);

        const { data: categoriesData, error: categoriesError } = await supabase
          .from('product_categories')
          .select('*');
          // .eq('company_id', selectedCompany); // Temporarily removed to allow cross-company mapping if needed

        const { data: groupsData, error: groupsError } = await supabase
          .from('dre_groups')
          .select('*');

        if (mappingsError || categoriesError || groupsError) {
          toast({ title: "Erro ao buscar dados", description: "Não foi possível carregar os vínculos.", variant: "destructive" });
        } else {
          setMappings(mappingsData || []);
          setProductCategories(categoriesData || []);
          setDreGroups(groupsData || []);
        }

        setLoading(false);
      }, [selectedCompany, toast]);

      useEffect(() => {
        fetchData();
      }, [fetchData]);

      const handleAddMapping = async () => {
        if (dreGroups.length === 0) {
          toast({
            title: "Ação necessária",
            description: "Crie pelo menos um grupo de custo no DRE antes de adicionar um vínculo.",
            variant: "destructive",
          });
          return;
        }

        const { data, error } = await supabase
          .from('dre_group_mappings')
          .insert({ company_id: selectedCompany, dre_group_id: dreGroups[0].id })
          .select('*, product_category:product_categories(name), dre_group:dre_groups(name)')
          .single();

        if (error) {
          toast({ title: "Erro ao adicionar vínculo", description: error.message, variant: "destructive" });
        } else {
          setMappings(prev => [...prev, data]);
        }
      };

      const handleMappingChange = (id, field, value) => {
        setMappings(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
      };

      const handleSaveMapping = async (mapping) => {
        const { product_category, dre_group, ...dataToSave } = mapping;
        const { error } = await supabase
          .from('dre_group_mappings')
          .update(dataToSave)
          .eq('id', mapping.id);

        if (error) {
          toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Vínculo salvo com sucesso!", variant: "success" });
          fetchData();
        }
      };

      const handleDeleteMapping = async (id) => {
        const { error } = await supabase.from('dre_group_mappings').delete().eq('id', id);
        if (error) {
          toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        } else {
          setMappings(prev => prev.filter(m => m.id !== id));
          toast({ title: "Vínculo excluído!", variant: "success" });
        }
      };

      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Label htmlFor="company-select-dre">Empresa</Label>
              <select id="company-select-dre" value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full sm:w-auto mt-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500">
                {allowedCompanies && allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Button onClick={handleAddMapping} className="gradient-primary text-white">
              <Plus className="w-4 h-4 mr-2" /> Novo Vínculo
            </Button>
          </div>

          {loading ? <p>Carregando...</p> : (
            <div className="space-y-4">
              {mappings.map(mapping => (
                <motion.div key={mapping.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-white rounded-xl shadow-md border border-gray-100 flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1 w-full">
                    <Label>Categoria de Produto</Label>
                    <select
                      value={mapping.product_category_id || ''}
                      onChange={(e) => handleMappingChange(mapping.id, 'product_category_id', e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Selecione uma categoria</option>
                      {productCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 w-full">
                    <Label>Grupo de Custo no DRE</Label>
                    <select
                      value={mapping.dre_group_id || ''}
                      onChange={(e) => handleMappingChange(mapping.id, 'dre_group_id', e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Selecione um grupo</option>
                      {dreGroups.map(group => <option key={group.id} value={group.id}>{group.name} ({group.type})</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" onClick={() => handleSaveMapping(mapping)}><Save className="w-4 h-4" /></Button>
                    <Button size="icon" variant="destructive" onClick={() => handleDeleteMapping(mapping.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </motion.div>
              ))}
              {mappings.length === 0 && <p className="text-center text-gray-500 py-8">Nenhum vínculo DRE criado para esta empresa.</p>}
            </div>
          )}
        </motion.div>
      );
    };

    export default DreMappingsTab;