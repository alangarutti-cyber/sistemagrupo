import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package, AlertTriangle, PlusCircle, History, Save, X, Check, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const Estoque = ({ user, companies, userCompanyAccess }) => {
  const { toast } = useToast();
  const [selectedCompany, setSelectedCompany] = useState('');
  const [activeTab, setActiveTab] = useState('produtos');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stockCounts, setStockCounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [countingState, setCountingState] = useState({ categoryId: '', items: {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [isZeroingStock, setIsZeroingStock] = useState(false);

  const [allowedCompanies, setAllowedCompanies] = useState([]);

  useEffect(() => {
    if (user && companies && userCompanyAccess) {
      const userCompanyIds = userCompanyAccess.filter(access => access.user_id === user.id).map(access => access.company_id);
      const accessibleCompanies = companies.filter(c => userCompanyIds.includes(c.id));
      if (user.is_admin) {
        setAllowedCompanies(companies);
        if (companies.length > 0) setSelectedCompany(companies[0].id);
      } else {
        setAllowedCompanies(accessibleCompanies);
        if (accessibleCompanies.length > 0) setSelectedCompany(accessibleCompanies[0].id);
      }
    }
  }, [user, companies, userCompanyAccess]);

  const fetchData = useCallback(async () => {
    if (!selectedCompany) {
      setProducts([]);
      setCategories([]);
      setStockCounts([]);
      return;
    }
    setLoading(true);
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*, product_categories(name), product_company_access!inner(company_id)')
      .eq('product_company_access.company_id', selectedCompany);

    const { data: categoriesData, error: categoriesError } = await supabase
      .from('product_categories')
      .select('*, companies:product_category_company_access!inner(company_id)')
      .eq('companies.company_id', selectedCompany);

    const { data: countsData, error: countsError } = await supabase
      .from('stock_counts')
      .select('*, user:app_users!stock_counts_user_id_fkey(name), category:product_categories(name), approver:app_users!stock_counts_approved_by_fkey(name)')
      .eq('company_id', selectedCompany)
      .order('start_date', { ascending: false });

    if (productsError || categoriesError || countsError) {
      toast({ title: "Erro ao buscar dados", description: productsError?.message || categoriesError?.message || countsError?.message, variant: "destructive" });
    } else {
      setProducts(productsData || []);
      setCategories(categoriesData || []);
      setStockCounts(countsData || []);
    }
    setLoading(false);
  }, [selectedCompany, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startNewCount = () => {
    setIsCounting(true);
    setCountingState({ categoryId: '', items: {} });
  };

  const handleCountingChange = (productId, value) => {
    setCountingState(prev => ({
      ...prev,
      items: { ...prev.items, [productId]: value }
    }));
  };

  const handleSaveCount = async () => {
    if (!countingState.categoryId) {
      toast({ title: "Selecione uma categoria", variant: "destructive" });
      return;
    }

    const { data: stockCount, error: countError } = await supabase
      .from('stock_counts')
      .insert({
        company_id: selectedCompany,
        user_id: user.id,
        start_date: new Date().toISOString(),
        status: 'pending_approval',
        category_id: countingState.categoryId,
      })
      .select()
      .single();

    if (countError) {
      toast({ title: "Erro ao criar contagem", description: countError.message, variant: "destructive" });
      return;
    }

    const itemsToInsert = products
      .filter(p => p.category_id === countingState.categoryId)
      .map(p => ({
        stock_count_id: stockCount.id,
        product_id: p.id,
        expected_stock: p.current_stock,
        counted_stock: parseFloat(countingState.items[p.id] || 0),
        difference: parseFloat(countingState.items[p.id] || 0) - p.current_stock,
      }));

    const { error: itemsError } = await supabase.from('stock_count_items').insert(itemsToInsert);

    if (itemsError) {
      toast({ title: "Erro ao salvar itens da contagem", description: itemsError.message, variant: "destructive" });
    } else {
      toast({ title: "Contagem salva com sucesso!", description: "Aguardando aprovação do administrador.", variant: "success" });
      setIsCounting(false);
      fetchData();
    }
  };

  const handleZeroStock = async () => {
    setIsZeroingStock(true);
    const { data: companyProducts, error: productsError } = await supabase
      .from('product_company_access')
      .select('product_id')
      .eq('company_id', selectedCompany);

    if (productsError) {
      toast({ title: "Erro ao buscar produtos da empresa", description: productsError.message, variant: "destructive" });
      setIsZeroingStock(false);
      return;
    }

    const productIds = companyProducts.map(p => p.product_id);

    if (productIds.length === 0) {
      toast({ title: "Nenhum produto encontrado para esta empresa", variant: "warning" });
      setIsZeroingStock(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({ current_stock: 0 })
      .in('id', productIds);

    if (updateError) {
      toast({ title: "Erro ao zerar estoque", description: updateError.message, variant: "destructive" });
    } else {
      toast({ title: "Estoque zerado com sucesso!", description: `Todos os produtos da empresa selecionada foram zerados.`, variant: "success" });
      fetchData();
    }
    setIsZeroingStock(false);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const countingProducts = products.filter(p => p.category_id === countingState.categoryId);

  if (isCounting) {
    return (
      <div className="space-y-6 p-4 sm:p-0">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-effect rounded-xl p-6 space-y-6">
          <h2 className="text-2xl font-bold text-gray-800">Nova Contagem de Estoque</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <Label>Categoria</Label>
              <select
                value={countingState.categoryId}
                onChange={e => setCountingState(prev => ({ ...prev, categoryId: parseInt(e.target.value) }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione uma categoria</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </div>

          {countingState.categoryId && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Produtos</h3>
              <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                {countingProducts.map(product => (
                  <div key={product.id} className="grid grid-cols-3 items-center gap-4 p-2 rounded-md bg-gray-50">
                    <Label className="col-span-2">{product.name}</Label>
                    <Input
                      type="number"
                      placeholder="Qtd."
                      value={countingState.items[product.id] || ''}
                      onChange={e => handleCountingChange(product.id, e.target.value)}
                      className="text-right"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Button onClick={handleSaveCount} className="gradient-success text-white"><Save className="w-4 h-4 mr-2" /> Salvar Contagem</Button>
            <Button onClick={() => setIsCounting(false)} variant="ghost"><X className="w-4 h-4 mr-2" /> Cancelar</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-0">
      <div className="glass-effect rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <Label>Empresa</Label>
            <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500">
              <option value="" disabled>Selecione uma empresa</option>
              {allowedCompanies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2 md:col-span-2">
            <Button onClick={startNewCount} className="w-full gradient-primary text-white" disabled={!selectedCompany}><PlusCircle className="w-4 h-4 mr-2" />Nova Contagem</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={!selectedCompany || isZeroingStock}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isZeroingStock ? 'animate-spin' : ''}`} />
                  {isZeroingStock ? 'Zerando...' : 'Zerar Estoque'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você tem certeza que deseja zerar o estoque de TODOS os produtos para a empresa selecionada? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleZeroStock} className="bg-red-600 hover:bg-red-700">Sim, Zerar Estoque</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="glass-effect rounded-xl p-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveTab('produtos')} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${activeTab === 'produtos' ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100 text-gray-600'}`}>Produtos</button>
          <button onClick={() => setActiveTab('historico')} className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all text-sm ${activeTab === 'historico' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}`}>Histórico</button>
        </div>
      </div>

      {loading ? <div className="text-center p-10">Carregando...</div> : (
        <>
          {activeTab === 'produtos' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input 
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.length > 0 ? filteredProducts.map((product, index) => {
                  const isLowStock = product.current_stock < product.min_stock;
                  return (
                    <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={`glass-effect rounded-xl p-4 border-l-4 relative ${isLowStock ? 'border-red-500' : 'border-green-500'}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-800 pr-8">{product.name}</h3>
                          <p className="text-sm text-gray-600">{product.product_categories?.name}</p>
                        </div>
                        {isLowStock && <AlertTriangle className="w-5 h-5 text-red-500" />}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-gray-600">Estoque:</span><span className={`font-semibold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>{product.current_stock || 0} {product.unit}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-600">Mínimo:</span><span className="font-medium">{product.min_stock || 0} {product.unit}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-600">Custo Unit.:</span><span className="font-medium">R$ {parseFloat(product.cost_price || 0).toFixed(2)}</span></div>
                      </div>
                    </motion.div>
                  );
                }) : <p className="col-span-full text-center p-10 text-gray-500">Nenhum produto encontrado.</p>}
              </div>
            </div>
          )}
          {activeTab === 'historico' && (
            <div className="glass-effect rounded-xl overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Data</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Responsável</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Categoria</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="p-4 text-left text-sm font-semibold text-gray-600">Aprovador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stockCounts.map(count => (
                    <tr key={count.id}>
                      <td className="p-4">{new Date(count.start_date).toLocaleDateString()}</td>
                      <td className="p-4">{count.user?.name}</td>
                      <td className="p-4">{count.category?.name}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          count.status === 'approved' ? 'bg-green-100 text-green-800' :
                          count.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {count.status === 'pending_approval' ? 'Pendente' : count.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                        </span>
                      </td>
                      <td className="p-4">{count.approver?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Estoque;