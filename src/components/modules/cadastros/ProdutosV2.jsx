import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, Search, Filter, X, Save, Upload, Edit, Package, DollarSign, Image as ImageIcon, Info, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ProductForm = ({ product, onSaveSuccess, onCancel, companies, categories, allProducts, user }) => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("geral");
    const [formData, setFormData] = useState({
        name: '', is_active: true, category_id: null, unit: 'UN', cost_price: '', sale_price: '', sale_price_2: '', sale_price_3: '',
        custom_code: '', description: '', image_url: '', min_stock: '', current_stock: '',
        storage_location: '', recipe_cost: 0, show_in_pdv: true, input_unit: '', conversion_factor: ''
    });
    const [selectedCompanies, setSelectedCompanies] = useState(new Set());
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (product) {
            setFormData({ 
              ...product,
              sale_price_2: product.sale_price_2 || '',
              sale_price_3: product.sale_price_3 || ''
            });
            setSelectedCompanies(new Set(product.company_access || []));
        } else {
            setFormData({
                name: '', is_active: true, category_id: null, unit: 'UN', cost_price: '', sale_price: '', sale_price_2: '', sale_price_3: '',
                custom_code: '', description: '', image_url: '', min_stock: '', current_stock: '',
                storage_location: '', recipe_cost: 0, show_in_pdv: true, input_unit: '', conversion_factor: ''
            });
            setSelectedCompanies(new Set(companies.map(c => c.id)));
        }
    }, [product, companies]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleCompanySelection = (companyId) => {
        setSelectedCompanies(prev => {
            const newSet = new Set(prev);
            newSet.has(companyId) ? newSet.delete(companyId) : newSet.add(companyId);
            return newSet;
        });
    };

    const handleSave = async () => {
        if (!formData.name || selectedCompanies.size === 0) {
            toast({ title: 'Campos obrigatórios', description: 'Nome e ao menos uma empresa são obrigatórios.', variant: 'destructive' });
            return;
        }

        const parseNumeric = (value) => {
            if (value === null || value === '') return null;
            const num = parseFloat(String(value).replace(',', '.'));
            return isNaN(num) ? null : num;
        };

        const dataToSave = { ...formData };
        ['cost_price', 'sale_price', 'sale_price_2', 'sale_price_3', 'min_stock', 'current_stock', 'recipe_cost', 'conversion_factor'].forEach(key => {
            dataToSave[key] = parseNumeric(dataToSave[key]);
        });
        
        delete dataToSave.id;
        delete dataToSave.created_at;
        delete dataToSave.product_categories;
        delete dataToSave.product_company_access;
        delete dataToSave.company_access;

        const { data: savedProduct, error } = await (product
            ? supabase.from('products').update(dataToSave).eq('id', product.id)
            : supabase.from('products').insert(dataToSave)
        ).select().single();

        if (error) {
            toast({ title: 'Erro ao salvar produto', description: error.message, variant: 'destructive' });
            return;
        }

        await supabase.from('product_company_access').delete().eq('product_id', savedProduct.id);
        const accessData = Array.from(selectedCompanies).map(company_id => ({ product_id: savedProduct.id, company_id }));
        if (accessData.length > 0) {
            const { error: accessError } = await supabase.from('product_company_access').insert(accessData);
            if (accessError) {
                 toast({ title: 'Erro ao salvar acesso', description: accessError.message, variant: 'destructive' });
                 return;
            }
        }
        
        toast({ title: `Produto ${product ? 'atualizado' : 'criado'}!`, variant: 'success' });
        onSaveSuccess();
    };

    return (
        <DialogContent className="max-w-4xl h-full sm:h-auto sm:max-h-[90vh]">
            <DialogHeader>
                <DialogTitle>{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col h-full overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col overflow-hidden">
                    <TabsList className="shrink-0">
                        <TabsTrigger value="geral"><Info className="w-4 h-4 mr-2"/>Geral</TabsTrigger>
                        <TabsTrigger value="preco"><DollarSign className="w-4 h-4 mr-2"/>Preços</TabsTrigger>
                        <TabsTrigger value="estoque"><Package className="w-4 h-4 mr-2"/>Estoque</TabsTrigger>
                        <TabsTrigger value="visual"><ImageIcon className="w-4 h-4 mr-2"/>Visual</TabsTrigger>
                    </TabsList>
                    <div className="flex-grow overflow-y-auto p-1 pr-4 mt-2">
                        <TabsContent value="geral" className="space-y-4">
                            <div className="space-y-2"><Label htmlFor="name">Nome</Label><Input id="name" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} /></div>
                            <div className="space-y-2"><Label htmlFor="category_id">Categoria</Label>
                                <select id="category_id" value={formData.category_id || ''} onChange={e => handleInputChange('category_id', e.target.value)} className="w-full p-2 border rounded bg-background">
                                    <option value="">Sem Categoria</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2"><Label>Empresas</Label>
                                <div className="p-3 border rounded-md max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
                                    {companies.map(c => (<div key={c.id} className="flex items-center gap-2"><Checkbox id={`comp-${c.id}`} checked={selectedCompanies.has(c.id)} onCheckedChange={() => handleCompanySelection(c.id)} /><Label htmlFor={`comp-${c.id}`}>{c.name}</Label></div>))}
                                </div>
                            </div>
                             <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2"><Checkbox id="is_active" checked={formData.is_active} onCheckedChange={c => handleInputChange('is_active', c)} /><Label htmlFor="is_active">Ativo</Label></div>
                                <div className="flex items-center space-x-2"><Checkbox id="show_in_pdv" checked={formData.show_in_pdv} onCheckedChange={c => handleInputChange('show_in_pdv', c)} /><Label htmlFor="show_in_pdv">Visível no PDV</Label></div>
                             </div>
                        </TabsContent>
                        <TabsContent value="preco" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2"><Label htmlFor="cost_price">Preço de Custo</Label><Input id="cost_price" type="number" value={formData.cost_price || ''} onChange={e => handleInputChange('cost_price', e.target.value)} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2"><Label htmlFor="sale_price">Preço de Venda 1</Label><Input id="sale_price" type="number" value={formData.sale_price || ''} onChange={e => handleInputChange('sale_price', e.target.value)} /></div>
                                <div className="space-y-2"><Label htmlFor="sale_price_2">Preço de Venda 2</Label><Input id="sale_price_2" type="number" value={formData.sale_price_2 || ''} onChange={e => handleInputChange('sale_price_2', e.target.value)} /></div>
                                <div className="space-y-2"><Label htmlFor="sale_price_3">Preço de Venda 3</Label><Input id="sale_price_3" type="number" value={formData.sale_price_3 || ''} onChange={e => handleInputChange('sale_price_3', e.target.value)} /></div>
                            </div>
                        </TabsContent>
                         <TabsContent value="estoque" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label htmlFor="unit">Unidade de Estoque</Label><Input id="unit" value={formData.unit} onChange={e => handleInputChange('unit', e.target.value)} /></div>
                                <div className="space-y-2"><Label htmlFor="custom_code">Código/SKU</Label><Input id="custom_code" value={formData.custom_code} onChange={e => handleInputChange('custom_code', e.target.value)} /></div>
                                <div className="space-y-2"><Label htmlFor="min_stock">Estoque Mínimo</Label><Input id="min_stock" type="number" value={formData.min_stock} onChange={e => handleInputChange('min_stock', e.target.value)} /></div>
                                <div className="space-y-2"><Label htmlFor="current_stock">Estoque Atual</Label><Input id="current_stock" type="number" value={formData.current_stock} onChange={e => handleInputChange('current_stock', e.target.value)} /></div>
                            </div>
                        </TabsContent>
                        <TabsContent value="visual" className="space-y-4">
                             <div className="space-y-2"><Label htmlFor="description">Descrição</Label><Textarea id="description" value={formData.description || ''} onChange={e => handleInputChange('description', e.target.value)} /></div>
                             {/* Image upload logic would go here */}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
            <DialogFooter className="mt-4 shrink-0">
                <DialogClose asChild><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button></DialogClose>
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4"/> Salvar</Button>
            </DialogFooter>
        </DialogContent>
    );
};

const ProductCard = ({ product, onEdit }) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="rounded-xl overflow-hidden shadow-lg bg-card border border-border group relative"
    >
        <div className="h-40 bg-muted flex items-center justify-center">
            {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover"/>
            ) : (
                <ImageIcon className="w-12 h-12 text-muted-foreground"/>
            )}
        </div>
        <div className="p-4">
            <h3 className="font-bold text-lg truncate" title={product.name}>{product.name}</h3>
            <p className="text-sm text-muted-foreground">{product.product_categories?.name || 'Sem Categoria'}</p>
            <div className="flex justify-between items-center mt-3">
                <div className="text-sm">
                    <p className="text-red-500">C: R$ {parseFloat(product.cost_price || 0).toFixed(2)}</p>
                    <p className="text-green-500 font-semibold">V1: R$ {parseFloat(product.sale_price || 0).toFixed(2)}</p>
                    {product.sale_price_2 && <p className="text-blue-500 font-semibold">V2: R$ {parseFloat(product.sale_price_2).toFixed(2)}</p>}
                    {product.sale_price_3 && <p className="text-purple-500 font-semibold">V3: R$ {parseFloat(product.sale_price_3).toFixed(2)}</p>}
                </div>
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Estoque</p>
                    <p className="font-bold text-lg">{parseFloat(product.current_stock || 0)} <span className="text-xs">{product.unit}</span></p>
                </div>
            </div>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => onEdit(product)}>
                <Edit className="h-4 w-4"/>
            </Button>
        </div>
         <div className={`absolute top-2 left-2 px-2 py-1 text-xs rounded-full ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {product.is_active ? 'Ativo' : 'Inativo'}
        </div>
    </motion.div>
);


const ProdutosV2Tab = ({ user, companies }) => {
    const { toast } = useToast();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('*, product_categories(name), company_access:product_company_access(company_id)');
        
        const { data: categoriesData, error: categoriesError } = await supabase
            .from('product_categories')
            .select('*');

        if (productsError || categoriesError) {
            toast({ title: 'Erro ao buscar dados', variant: 'destructive' });
        } else {
            setProducts(productsData.map(p => ({...p, company_access: p.company_access.map(ca => ca.company_id)})) || []);
            setCategories(categoriesData || []);
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => { fetchData() }, [fetchData]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = searchTerm === '' || p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === '' || String(p.category_id) === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchTerm, categoryFilter]);
    
    const handleOpenForm = (product = null) => {
        setEditingProduct(product);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setEditingProduct(null);
        setIsFormOpen(false);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Cadastro de Produtos V2</h1>
            
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input placeholder="Buscar produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                        </div>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="p-2 border rounded-md bg-background w-full sm:w-auto">
                            <option value="">Todas as Categorias</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <Button onClick={() => handleOpenForm()} className="w-full md:w-auto">
                        <PlusCircle className="mr-2 h-4 w-4" /> Novo Produto
                    </Button>
                </CardContent>
            </Card>

            {loading ? (
                <p className="text-center text-muted-foreground">Carregando produtos...</p>
            ) : (
                <AnimatePresence>
                    <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {filteredProducts.map(product => (
                            <ProductCard key={product.id} product={product} onEdit={handleOpenForm} />
                        ))}
                    </motion.div>
                </AnimatePresence>
            )}
             {!loading && filteredProducts.length === 0 && (
                <div className="text-center py-16 bg-card rounded-xl border-dashed border-2">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground"/>
                    <h3 className="mt-2 text-lg font-semibold">Nenhum produto encontrado</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Tente ajustar seus filtros ou cadastre um novo produto.</p>
                </div>
            )}
            
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                 {isFormOpen && <ProductForm product={editingProduct} onSaveSuccess={() => { handleCloseForm(); fetchData(); }} onCancel={handleCloseForm} companies={companies} categories={categories} user={user} allProducts={products} />}
            </Dialog>
        </div>
    );
};

export default ProdutosV2Tab;