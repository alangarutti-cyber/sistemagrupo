import React, { useState, useEffect, useCallback, useRef } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import { ShoppingCart, List, Trash2, Plus, Minus, Send, PackageSearch, FileText, MoreVertical, Circle, CheckCircle2, Loader, Truck, XCircle, MessageSquare, ArrowRight, ShieldAlert } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import html2pdf from 'html2pdf.js';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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

    const statusConfig = {
      'Pendente': { icon: Circle, color: 'text-yellow-500', bg: 'bg-yellow-100' },
      'Em Separação': { icon: Loader, color: 'text-blue-500', bg: 'bg-blue-100' },
      'Entregue': { icon: Truck, color: 'text-green-500', bg: 'bg-green-100' },
      'Recebido': { icon: CheckCircle2, color: 'text-teal-500', bg: 'bg-teal-100' },
      'Cancelado': { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100' },
    };

    const Pedidos = ({ user, companies, userCompanyAccess }) => {
      const { toast } = useToast();
      const [activeTab, setActiveTab] = useState('criar');
      const [allowedCompanies, setAllowedCompanies] = useState([]);
      const [selectedCompany, setSelectedCompany] = useState('');
      const [categories, setCategories] = useState([]);
      const [selectedCategory, setSelectedCategory] = useState('');
      const [products, setProducts] = useState([]);
      const [cart, setCart] = useState([]);
      const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
      const [sentOrders, setSentOrders] = useState([]);
      const [loading, setLoading] = useState(false);
      const [productInputs, setProductInputs] = useState({});
      const pdfRefs = useRef({});
      const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
      const [orderToDelete, setOrderToDelete] = useState(null);

      useEffect(() => {
        if (user && companies && userCompanyAccess) {
          if (user.is_admin || user.role === 'Super Administrador') {
            setAllowedCompanies(companies);
            if (companies.length > 0) {
              setSelectedCompany(companies[0].id);
            }
          } else {
            const userCompanyIds = userCompanyAccess
              .filter(access => access.user_id === user.id)
              .map(access => access.company_id);
            const accessibleCompanies = companies.filter(c => userCompanyIds.includes(c.id));
            setAllowedCompanies(accessibleCompanies);
            if (accessibleCompanies.length > 0) {
              setSelectedCompany(accessibleCompanies[0].id);
            }
          }
        }
      }, [user, companies, userCompanyAccess]);

      const fetchCategories = useCallback(async () => {
        if (!selectedCompany) return;
        setLoading(true);
        const { data, error } = await supabase.rpc('get_categories_for_company', { p_company_id: selectedCompany });
        if (error) {
          toast({ title: 'Erro ao buscar categorias', variant: 'destructive' });
        } else {
          setCategories(data);
        }
        setLoading(false);
      }, [selectedCompany, toast]);

      useEffect(() => {
        fetchCategories();
      }, [fetchCategories]);

      const fetchProducts = useCallback(async () => {
        if (!selectedCompany || !selectedCategory) {
          setProducts([]);
          return;
        }
        setLoading(true);
        const { data, error } = await supabase
          .from('products')
          .select('*, product_company_access!inner(*)')
          .eq('category_id', selectedCategory)
          .eq('product_company_access.company_id', selectedCompany)
          .eq('is_active', true);

        if (error) {
          toast({ title: 'Erro ao buscar produtos', variant: 'destructive' });
        } else {
          setProducts(data);
          const initialInputs = {};
          data.forEach(p => {
              initialInputs[p.id] = { quantity: '', unit: p.unit };
          });
          setProductInputs(initialInputs);
        }
        setLoading(false);
      }, [selectedCompany, selectedCategory, toast]);

      useEffect(() => {
        fetchProducts();
      }, [fetchProducts]);

      const fetchSentOrders = useCallback(async () => {
        setLoading(true);
        let query = supabase
          .from('supply_orders')
          .select('*, companies(name, phone), app_users(name), supply_order_items(*, products(*, product_categories(name)))')
          .order('created_at', { ascending: false });

        if (!user.is_admin && user.role !== 'Super Administrador') {
            const userCompanyIds = userCompanyAccess
              .filter(access => access.user_id === user.id)
              .map(access => access.company_id);
            query = query.in('company_id', userCompanyIds);
        }

        const { data, error } = await query;

        if (error) {
          toast({ title: 'Erro ao buscar pedidos enviados', variant: 'destructive', description: error.message });
        } else {
          setSentOrders(data);
        }
        setLoading(false);
      }, [toast, user, userCompanyAccess]);

      useEffect(() => {
        if (activeTab === 'enviados') {
          fetchSentOrders();
        }
      }, [activeTab, fetchSentOrders]);

      const handleProductInputChange = (productId, field, value) => {
        setProductInputs(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [field]: value
            }
        }));
      };

      const handleAddCategoryItemsToCart = () => {
        const itemsToAdd = products
          .map(product => {
            const input = productInputs[product.id] || { quantity: 0, unit: product.unit };
            const quantity = parseFloat(input.quantity) || 0;
            return { product, quantity, selectedUnit: input.unit };
          })
          .filter(item => item.quantity > 0);

        if (itemsToAdd.length === 0) {
          toast({
            title: 'Nenhum item para adicionar',
            description: 'Por favor, insira a quantidade para pelo menos um produto.',
            variant: 'destructive',
          });
          return;
        }

        setCart(prevCart => {
            const newCart = [...prevCart];
            itemsToAdd.forEach(({ product, quantity, selectedUnit }) => {
              const { cost_price, input_unit, unit, conversion_factor } = product;
              let quantityInBaseUnit = quantity;
              let unitCost = 0;

              if (cost_price != null) {
                  unitCost = cost_price / (conversion_factor || 1);
                  if (selectedUnit === input_unit && conversion_factor) {
                      quantityInBaseUnit = quantity * conversion_factor;
                      unitCost = cost_price;
                  }
              }

              const totalCost = quantity * unitCost;
        
              const existingItemIndex = newCart.findIndex(item => item.id === product.id && item.ordered_unit === selectedUnit);
        
              if (existingItemIndex > -1) {
                const existingItem = newCart[existingItemIndex];
                existingItem.ordered_quantity += quantity;
                existingItem.quantity += quantityInBaseUnit;
                existingItem.total_cost += totalCost;
              } else {
                newCart.push({ 
                    ...product, 
                    quantity: quantityInBaseUnit, 
                    ordered_unit: selectedUnit, 
                    ordered_quantity: quantity,
                    unit_cost: unitCost,
                    total_cost: totalCost
                });
              }
            });
            return newCart;
        });

        toast({
          title: 'Itens adicionados!',
          description: `${itemsToAdd.length} tipo(s) de produto(s) foram adicionados/atualizados no pedido.`,
        });

        const initialInputs = {};
        products.forEach(p => {
          initialInputs[p.id] = { quantity: '', unit: p.unit };
        });
        setProductInputs(initialInputs);
      };

      const updateQuantity = (productId, newQuantity) => {
        if (newQuantity < 1) {
          setCart(prevCart => prevCart.filter(item => item.id !== productId));
        } else {
          setCart(prevCart =>
            prevCart.map(item =>
              item.id === productId ? { ...item, quantity: newQuantity } : item
            )
          );
        }
      };

      const handleSendOrder = async () => {
        if (cart.length === 0 || !selectedCompany) {
          toast({ title: 'Pedido vazio ou empresa não selecionada', variant: 'destructive' });
          return;
        }

        setLoading(true);
        const { data: orderData, error: orderError } = await supabase
          .from('supply_orders')
          .insert({
            company_id: selectedCompany,
            user_id: user.id,
            order_date: orderDate,
            status: 'Pendente'
          })
          .select()
          .single();

        if (orderError) {
          toast({ title: 'Erro ao criar pedido', description: orderError.message, variant: 'destructive' });
          setLoading(false);
          return;
        }

        const orderItems = cart.map(item => ({
          order_id: orderData.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.unit_cost,
          total_price: item.total_cost,
          ordered_unit: item.ordered_unit,
          ordered_quantity: item.ordered_quantity
        }));

        const { error: itemsError } = await supabase.from('supply_order_items').insert(orderItems);

        if (itemsError) {
          toast({ title: 'Erro ao adicionar itens ao pedido', description: itemsError.message, variant: 'destructive' });
          await supabase.from('supply_orders').delete().eq('id', orderData.id);
        } else {
          await supabase.from('supply_order_history').insert({ order_id: orderData.id, user_id: user.id, status: 'Pendente' });
          toast({ title: 'Pedido enviado com sucesso!' });
          setCart([]);
        }
        setLoading(false);
      };

      const handleStatusChange = async (orderId, newStatus) => {
        setLoading(true);
        const { error: updateError } = await supabase
          .from('supply_orders')
          .update({ status: newStatus })
          .eq('id', orderId);

        if (updateError) {
          toast({ title: 'Erro ao atualizar status', description: updateError.message, variant: 'destructive' });
        } else {
          await supabase.from('supply_order_history').insert({ order_id: orderId, user_id: user.id, status: newStatus });
          toast({ title: 'Status atualizado com sucesso!' });
          fetchSentOrders();
        }
        setLoading(false);
      };

      const confirmDeleteOrder = (orderId) => {
        setOrderToDelete(orderId);
        setIsDeleteDialogOpen(true);
      };

      const handleDeleteOrder = async () => {
        if (!orderToDelete) return;
        setLoading(true);

        const { error: itemsError } = await supabase.from('supply_order_items').delete().eq('order_id', orderToDelete);
        if (itemsError) {
          toast({ title: 'Erro ao remover itens do pedido', description: itemsError.message, variant: 'destructive' });
          setLoading(false);
          return;
        }

        const { error: historyError } = await supabase.from('supply_order_history').delete().eq('order_id', orderToDelete);
        if (historyError) {
          toast({ title: 'Erro ao remover histórico do pedido', description: historyError.message, variant: 'destructive' });
          setLoading(false);
          return;
        }

        const { error: orderError } = await supabase.from('supply_orders').delete().eq('id', orderToDelete);
        if (orderError) {
          toast({ title: 'Erro ao remover pedido', description: orderError.message, variant: 'destructive' });
        } else {
          toast({ title: 'Pedido removido com sucesso!' });
          setSentOrders(prev => prev.filter(order => order.id !== orderToDelete));
        }

        setLoading(false);
        setIsDeleteDialogOpen(false);
        setOrderToDelete(null);
      };

      const getPdfOptions = (order) => ({
        margin: [10, 10, 10, 10],
        filename: `pedido_${order.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      });

      const generatePDF = (order) => {
        const element = pdfRefs.current[order.id];
        if (!element) {
          toast({ title: 'Erro ao encontrar conteúdo para PDF', variant: 'destructive' });
          return;
        }
        toast({ title: 'Gerando PDF...', description: 'Aguarde um momento.' });
        html2pdf().from(element).set(getPdfOptions(order)).save();
      };

      const sendWhatsApp = async (order) => {
        const element = pdfRefs.current[order.id];
        if (!element) {
          toast({ title: 'Erro ao encontrar conteúdo para PDF', variant: 'destructive' });
          return;
        }

        const companyPhone = order.companies?.phone?.replace(/\D/g, '');
        if (!companyPhone) {
          toast({ title: 'Telefone da empresa não encontrado!', variant: 'destructive' });
          return;
        }

        toast({ title: 'Preparando para enviar via WhatsApp...', description: 'Gerando PDF...' });

        try {
          const pdfBlob = await html2pdf().from(element).set(getPdfOptions(order)).output('blob');
          const pdfFile = new File([pdfBlob], `pedido_${order.id}.pdf`, { type: 'application/pdf' });

          if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
              files: [pdfFile],
              title: `Pedido de Insumos #${order.id}`,
              text: `Olá! Segue o pedido de insumos #${order.id}.`,
            });
          } else {
            const text = encodeURIComponent(`Olá! Segue o pedido de insumos #${order.id}. Por favor, veja o PDF que será enviado a seguir.`);
            window.open(`https://wa.me/${companyPhone}?text=${text}`, '_blank');
            toast({
              title: 'Abra o WhatsApp',
              description: 'O PDF foi gerado. Por favor, anexe-o manualmente na conversa do WhatsApp que foi aberta.',
              duration: 10000,
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(pdfBlob);
            link.download = `pedido_${order.id}.pdf`;
            link.click();
            URL.revokeObjectURL(link.href);
          }
        } catch (error) {
          toast({ title: 'Erro ao compartilhar via WhatsApp', description: error.message, variant: 'destructive' });
        }
      };

      const getAvailableStatusChanges = (currentStatus) => {
        const isAdmin = user.is_admin || user.role === 'Super Administrador';
        const isCentralStock = user.role === 'Estoque';
        const isUnitUser = !isAdmin && !isCentralStock;

        const transitions = {
          'Pendente': ['Em Separação', 'Cancelado'],
          'Em Separação': ['Entregue', 'Cancelado'],
          'Entregue': ['Recebido'],
          'Recebido': [],
          'Cancelado': [],
        };

        const allowed = transitions[currentStatus] || [];

        if (isAdmin) return allowed;
        if (isCentralStock) {
          return allowed.filter(s => ['Em Separação', 'Entregue'].includes(s));
        }
        if (isUnitUser) {
          return allowed.filter(s => s === 'Recebido');
        }
        return [];
      };

      const TabButton = ({ tabName, label, icon: Icon }) => (
        <button
          onClick={() => setActiveTab(tabName)}
          className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-t-lg transition-colors ${
            activeTab === tabName
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon className="w-5 h-5" />
          {label}
        </button>
      );

      const renderCreateOrder = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-4">1. Selecionar Produtos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Empresa</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-md bg-background text-foreground"
                  disabled={loading}
                >
                  {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Categoria</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-md bg-background text-foreground"
                  disabled={loading || !selectedCompany}
                >
                  <option value="">Selecione uma</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto pr-2">
              {loading && <p className="text-muted-foreground">Carregando produtos...</p>}
              {!loading && products.length === 0 && selectedCategory && <p className="text-muted-foreground">Nenhum produto encontrado nesta categoria.</p>}
              <div className="space-y-2">
                {products.map(product => {
                  const hasAlternativeUnit = product.input_unit && product.conversion_factor;
                  return (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                      <div>
                        <p className="font-semibold text-foreground">{product.name}</p>
                        <p className="text-sm text-muted-foreground">Estoque: {product.current_stock || 0} {product.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Qtd"
                          className="w-24 text-center"
                          value={productInputs[product.id]?.quantity || ''}
                          onChange={(e) => handleProductInputChange(product.id, 'quantity', e.target.value)}
                          min="0"
                        />
                        {hasAlternativeUnit ? (
                          <select 
                            className="w-28 p-2 border rounded-md bg-background text-foreground text-sm" 
                            value={productInputs[product.id]?.unit || product.unit}
                            onChange={(e) => handleProductInputChange(product.id, 'unit', e.target.value)}
                          >
                            <option value={product.unit}>{product.unit}</option>
                            <option value={product.input_unit}>{product.input_unit}</option>
                          </select>
                        ) : (
                          <span className="w-28 text-center text-sm p-2 bg-muted rounded-md">{product.unit}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {products.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button onClick={handleAddCategoryItemsToCart}>
                  Adicionar Itens ao Pedido
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>

          <div className="bg-card p-6 rounded-xl shadow-sm flex flex-col">
            <h2 className="text-xl font-bold text-foreground mb-4">2. Resumo do Pedido</h2>
            <div className="flex-grow overflow-y-auto pr-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <PackageSearch className="w-12 h-12 mb-2" />
                  <p>Seu pedido está vazio.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.ordered_quantity} {item.ordered_unit} x {(item.unit_cost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                      <div className="flex items-center gap-2">
                         <p className="font-semibold text-sm text-foreground">{(item.total_cost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        <Button size="icon" variant="destructive" onClick={() => setCart(cart.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6 border-t pt-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Data do Pedido</label>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button onClick={handleSendOrder} className="w-full mt-4" disabled={loading || cart.length === 0}>
                <Send className="w-4 h-4 mr-2" />
                {loading ? 'Enviando...' : 'Enviar Pedido'}
              </Button>
            </div>
          </div>
        </div>
      );

      const renderSentOrders = () => {
        const groupedItems = (items) => {
          if (!items) return {};
          return items.reduce((acc, item) => {
            const categoryName = item.products?.product_categories?.name || 'Sem Categoria';
            if (!acc[categoryName]) {
              acc[categoryName] = [];
            }
            acc[categoryName].push(item);
            return acc;
          }, {});
        };

        return (
          <div className="bg-card p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-4">Pedidos Enviados</h2>
            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <p className="text-muted-foreground">Carregando pedidos...</p>
              ) : sentOrders.length === 0 ? (
                <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
              ) : (
                <div className="space-y-4">
                  {sentOrders.map(order => {
                    const config = statusConfig[order.status] || statusConfig['Pendente'];
                    const Icon = config.icon;
                    const availableStatuses = getAvailableStatusChanges(order.status);
                    const totalOrderValue = order.supply_order_items.reduce((sum, item) => sum + (item.total_price || 0), 0);
                    const isAdmin = user.is_admin || user.role === 'Super Administrador';

                    return (
                      <div key={order.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start flex-wrap gap-2">
                          <div>
                            <p className="font-bold text-foreground">Pedido #{order.id}</p>
                            <p className="text-sm text-muted-foreground">Empresa: {order.companies.name}</p>
                            <p className="text-sm text-muted-foreground">Data: {new Date(order.order_date).toLocaleDateString()}</p>
                            <p className="text-sm text-muted-foreground">Solicitado por: {order.app_users.name}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.color}`}>
                              <Icon className="w-4 h-4" />
                              {order.status}
                            </span>
                            <Button variant="outline" size="sm" onClick={() => generatePDF(order)}>
                              <FileText className="w-4 h-4 mr-2" />
                              PDF
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => sendWhatsApp(order)} className="bg-green-500 hover:bg-green-600 text-white">
                              <MessageSquare className="w-4 h-4 mr-2" />
                              WhatsApp
                            </Button>
                            {isAdmin && (
                                <Button variant="destructive" size="sm" onClick={() => confirmDeleteOrder(order.id)}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Remover
                                </Button>
                            )}
                            {availableStatuses.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  {availableStatuses.map(status => (
                                    <DropdownMenuItem key={status} onClick={() => handleStatusChange(order.id, status)}>
                                      Mudar para {status}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 border-t pt-2">
                          <p className="font-semibold text-foreground mb-2">Itens:</p>
                          <ul className="list-none space-y-1 text-sm text-muted-foreground">
                            {order.supply_order_items.map(item => (
                              <li key={item.id}>{item.products.name} - {item.ordered_quantity || item.quantity} {item.ordered_unit || item.products.unit}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="fixed -left-[9999px] top-0">
                          <div ref={el => pdfRefs.current[order.id] = el} className="p-4 font-sans text-black bg-white" style={{ width: '190mm', boxSizing: 'border-box' }}>
                            <header className="flex justify-between items-center pb-4 border-b-2 border-gray-300">
                              <img alt="Stout Group Logo" className="h-12" src="https://horizons-cdn.hostinger.com/6a44e4d1-b151-41db-aa41-6efe480a026e/4907d27c8ad3e4ceaa68b04717459794.jpg" />
                              <div className="text-right">
                                <h1 className="text-xl font-bold text-center">Pedido de Insumos #{order.id}</h1>
                              </div>
                            </header>
                            <section className="my-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                              <div><strong>Empresa:</strong> {order.companies.name}</div>
                              <div><strong>Solicitante:</strong> {order.app_users.name}</div>
                              <div><strong>Data:</strong> {new Date(order.order_date).toLocaleDateString()}</div>
                              <div><strong>Status:</strong> {order.status}</div>
                            </section>
                            <main>
                              {Object.entries(groupedItems(order.supply_order_items)).map(([category, items]) => (
                                <div key={category} className="mb-4">
                                  <h2 className="text-base font-bold border-b-2 border-dashed border-gray-400 pb-1 mb-2 text-center uppercase tracking-wider">
                                    {category}
                                  </h2>
                                  <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                                    <colgroup>
                                      <col style={{ width: '40%' }} />
                                      <col style={{ width: '15%' }} />
                                      <col style={{ width: '22.5%' }} />
                                      <col style={{ width: '22.5%' }} />
                                    </colgroup>
                                    <thead>
                                      <tr className="border-b border-gray-300">
                                        <th className="text-left pb-1 pr-2">Produto</th>
                                        <th className="text-right pb-1 pr-2">Qtd.</th>
                                        <th className="text-right pb-1 pr-2">Vl. Unit.</th>
                                        <th className="text-right pb-1">Vl. Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {items.map(item => {
                                        const unitPrice = item.unit_price || (item.products?.cost_price / (item.products?.conversion_factor || 1));
                                        const totalPrice = item.total_price || (item.quantity * unitPrice);
                                        const orderedUnit = item.ordered_unit || item.products.unit;
                                        const orderedQuantity = item.ordered_quantity || item.quantity;
                                        return (
                                          <tr key={item.id}>
                                            <td className="pt-1 pr-2" style={{ wordWrap: 'break-word' }}>{item.products.name}</td>
                                            <td className="text-right pt-1 pr-2">{orderedQuantity} {orderedUnit}</td>
                                            <td className="text-right pt-1 pr-2">{(unitPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="text-right pt-1">{(totalPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </main>
                            <section className="mt-6 pt-3 border-t-2 border-gray-300 flex justify-end">
                                <div className="text-right">
                                    <div className="text-base font-bold">
                                        <span>VALOR TOTAL DO PEDIDO: </span>
                                        <span>{totalOrderValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                </div>
                            </section>
                            <footer className="text-center text-xs text-gray-500 pt-3 border-t mt-6">
                              Exportado em: {new Date().toLocaleString()}
                            </footer>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      };

      return (
        <>
          <div className="space-y-6">
            <div className="flex border-b">
              <TabButton tabName="criar" label="Criar Pedido" icon={ShoppingCart} />
              <TabButton tabName="enviados" label="Pedidos Enviados" icon={List} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'criar' ? renderCreateOrder() : renderSentOrders()}
              </motion.div>
            </AnimatePresence>
          </div>
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente o pedido #{orderToDelete} e todos os seus dados associados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setOrderToDelete(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteOrder} disabled={loading}>
                  {loading ? 'Removendo...' : 'Sim, remover pedido'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    };

    export default Pedidos;