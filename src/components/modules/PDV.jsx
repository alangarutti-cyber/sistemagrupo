
    import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { useUser } from '@/contexts/UserContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Card, CardContent } from '@/components/ui/card';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Command, CommandInput, CommandList, CommandItem, CommandGroup } from '@/components/ui/command';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Label } from '@/components/ui/label';
    import { X, Plus, Minus, Search, Trash2, ChevronDown, UserPlus, FileText, Printer, Utensils, Beer, ShoppingCart, User, Users } from 'lucide-react';
    import PdvReceipt from '@/components/pdv/PdvReceipt';
    import { useReactToPrint } from 'react-to-print';

    const PDV = () => {
        const { toast } = useToast();
        const { user, companies, userCompanyAccess } = useUser();

        const [users, setUsers] = useState([]);
        const [products, setProducts] = useState([]);
        const [customers, setCustomers] = useState([]);
        const [paymentMethods, setPaymentMethods] = useState([]);
        const [printerLocations, setPrinterLocations] = useState([]);

        const [selectedCompanyId, setSelectedCompanyId] = useState(null);
        const [selectedUserId, setSelectedUserId] = useState(null);
        const [pin, setPin] = useState('');
        const [authenticatedUser, setAuthenticatedUser] = useState(null);
        
        const [cart, setCart] = useState([]);
        const [selectedCustomer, setSelectedCustomer] = useState(null);
        const [searchTerm, setSearchTerm] = useState('');
        const [activeCategory, setActiveCategory] = useState('all');
        const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
        const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
        const [payments, setPayments] = useState([]);
        const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', cpf: '' });
        const [saleToPrint, setSaleToPrint] = useState(null);

        const receiptRef = useRef();

        const allowedCompanies = useMemo(() => {
            if (!user || !companies || !userCompanyAccess) return [];
            const allowedIds = userCompanyAccess.map(acc => acc.company_id);
            return companies.filter(c => allowedIds.includes(c.id));
        }, [user, companies, userCompanyAccess]);

        useEffect(() => {
            if (allowedCompanies.length === 1) {
                setSelectedCompanyId(allowedCompanies[0].id);
            }
        }, [allowedCompanies]);
        
        const fetchCompanyUsers = async (companyId) => {
          if (!companyId) return;
          const { data, error } = await supabase
            .rpc('get_pdv_users_for_company', { p_company_id: companyId });

          if (error) {
            toast({ title: 'Erro ao buscar usuários do PDV', description: error.message, variant: 'destructive' });
            setUsers([]);
          } else {
            setUsers(data || []);
          }
        };

        useEffect(() => {
            if (selectedCompanyId) {
                fetchCompanyUsers(selectedCompanyId);
                fetchPDVData(selectedCompanyId);
            }
        }, [selectedCompanyId]);

        const fetchPDVData = async (companyId) => {
            const [productsRes, customersRes, paymentMethodsRes, printerLocationsRes] = await Promise.all([
                supabase.from('products').select('*, category:product_categories(name)').eq('company_id', companyId).eq('show_in_pdv', true).order('name'),
                supabase.from('customers').select('*').eq('company_id', companyId).order('name'),
                supabase.from('payment_methods').select('*').eq('company_id', companyId).order('name'),
                supabase.from('printer_locations').select('*').eq('company_id', companyId)
            ]);

            if (productsRes.error) toast({ title: 'Erro ao buscar produtos', description: productsRes.error.message, variant: 'destructive' });
            if (customersRes.error) toast({ title: 'Erro ao buscar clientes', description: customersRes.error.message, variant: 'destructive' });
            if (paymentMethodsRes.error) toast({ title: 'Erro ao buscar formas de pagamento', description: paymentMethodsRes.error.message, variant: 'destructive' });
            if (printerLocationsRes.error) toast({ title: 'Erro ao buscar locais de impressão', description: printerLocationsRes.error.message, variant: 'destructive' });

            setProducts(productsRes.data || []);
            setCustomers(customersRes.data || []);
            setPaymentMethods(paymentMethodsRes.data || []);
            setPrinterLocations(printerLocationsRes.data || []);
        };

        const handlePinLogin = () => {
            const userToAuth = users.find(u => u.user_id === selectedUserId);
            if (userToAuth && userToAuth.pdv_pin === pin) {
                setAuthenticatedUser(userToAuth);
                toast({ title: `Bem-vindo, ${userToAuth.employee_name}!`, variant: 'success' });
            } else {
                toast({ title: 'PIN incorreto!', variant: 'destructive' });
                setPin('');
            }
        };

        const handleLogout = () => {
            setAuthenticatedUser(null);
            setSelectedUserId(null);
            setPin('');
            setCart([]);
            setSelectedCustomer(null);
        };

        const addToCart = (product) => {
            setCart(prevCart => {
                const existingItem = prevCart.find(item => item.id === product.id);
                if (existingItem) {
                    return prevCart.map(item =>
                        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                    );
                } else {
                    return [...prevCart, { ...product, quantity: 1, notes: '' }];
                }
            });
        };

        const updateQuantity = (productId, amount) => {
            setCart(prevCart => {
                const updatedCart = prevCart.map(item =>
                    item.id === productId ? { ...item, quantity: Math.max(0, item.quantity + amount) } : item
                );
                return updatedCart.filter(item => item.quantity > 0);
            });
        };

        const updateNotes = (productId, notes) => {
            setCart(cart.map(item => item.id === productId ? { ...item, notes } : item));
        };

        const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.sale_price * item.quantity), 0), [cart]);

        const filteredProducts = useMemo(() => {
            return products.filter(product => {
                const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesCategory = activeCategory === 'all' || product.category?.name === activeCategory;
                return matchesSearch && matchesCategory;
            });
        }, [products, searchTerm, activeCategory]);

        const categories = useMemo(() => ['all', ...new Set(products.map(p => p.category?.name).filter(Boolean))], [products]);
        
        const handleAddPayment = () => {
            if (paymentMethods.length > 0) {
                setPayments([...payments, { method_id: paymentMethods[0].id, value: '' }]);
            }
        };

        const updatePayment = (index, field, value) => {
            const newPayments = [...payments];
            newPayments[index][field] = value;
            setPayments(newPayments);
        };

        const removePayment = (index) => {
            setPayments(payments.filter((_, i) => i !== index));
        };

        const totalPaid = useMemo(() => payments.reduce((acc, p) => acc + (parseFloat(p.value) || 0), 0), [payments]);
        const remainingAmount = useMemo(() => subtotal - totalPaid, [subtotal, totalPaid]);

        const handleFinishSale = async () => {
            if (cart.length === 0) {
                toast({ title: 'Carrinho vazio!', variant: 'destructive' });
                return;
            }
            if (Math.abs(remainingAmount) > 0.01) {
                toast({ title: 'Valor pago não confere!', description: `Ainda falta ${formatCurrency(remainingAmount)}`, variant: 'destructive' });
                return;
            }

            const saleData = {
                company_id: selectedCompanyId,
                user_id: authenticatedUser.user_id,
                customer_id: selectedCustomer?.id,
                total_value: subtotal,
                payment_type: payments.map(p => paymentMethods.find(pm => pm.id === p.method_id)?.name).join(', '),
                status: 'Concluída',
                sale_date: new Date().toISOString(),
            };

            const { data: newSale, error: saleError } = await supabase.from('sales').insert(saleData).select().single();

            if (saleError) {
                toast({ title: 'Erro ao criar venda', description: saleError.message, variant: 'destructive' });
                return;
            }

            const saleItems = cart.map(item => ({
                sale_id: newSale.id,
                product_id: item.id,
                quantity: item.quantity,
                unit_price: item.sale_price,
                total_price: item.sale_price * item.quantity,
                observations: item.notes,
            }));

            const { error: itemsError } = await supabase.from('pdv_sales_items').insert(saleItems);
            if (itemsError) {
                toast({ title: 'Erro ao salvar itens da venda', description: itemsError.message, variant: 'destructive' });
                return;
            }
            
            const paymentsData = payments.map(p => ({
                sale_id: newSale.id,
                payment_method_id: p.method_id,
                value: p.value,
                cliente_id: selectedCustomer?.id,
            }));

            const { error: paymentsError } = await supabase.from('pdv_payments').insert(paymentsData);
            if (paymentsError) {
                toast({ title: 'Erro ao salvar pagamentos', description: paymentsError.message, variant: 'destructive' });
                return;
            }

            toast({ title: 'Venda finalizada com sucesso!', variant: 'success' });
            
            const detailedSaleInfo = {
                ...newSale,
                company: allowedCompanies.find(c => c.id === newSale.company_id),
                user: users.find(u => u.user_id === newSale.user_id),
                customer: customers.find(c => c.id === newSale.customer_id),
                items: cart,
                payments: payments.map(p => ({...p, name: paymentMethods.find(pm => pm.id === p.method_id)?.name }))
            };
            setSaleToPrint(detailedSaleInfo);

            await handlePrint(newSale.id);

            setIsPaymentModalOpen(false);
            setCart([]);
            setPayments([]);
            setSelectedCustomer(null);
        };
        
        useEffect(() => {
          if (saleToPrint) {
            handlePrintReceipt();
          }
        }, [saleToPrint]);

        const handlePrintReceipt = useReactToPrint({
          content: () => receiptRef.current,
          onAfterPrint: () => setSaleToPrint(null),
        });

        const handleCreateCustomer = async () => {
            if (!newCustomer.name) {
                toast({ title: 'Nome do cliente é obrigatório.', variant: 'destructive' });
                return;
            }
            const { data: created, error } = await supabase.from('customers').insert({ ...newCustomer, company_id: selectedCompanyId }).select().single();
            if (error) {
                toast({ title: 'Erro ao criar cliente', description: error.message, variant: 'destructive' });
            } else {
                toast({ title: 'Cliente criado com sucesso!', variant: 'success' });
                setCustomers([...customers, created]);
                setSelectedCustomer(created);
                setIsCustomerModalOpen(false);
                setNewCustomer({ name: '', phone: '', cpf: '' });
            }
        };

        const handlePrint = async (saleId) => {
            const { data: saleItems, error: itemsError } = await supabase
                .from('pdv_sales_items')
                .select('*, product:products!inner(id, name, notes, printer_location_id)')
                .eq('sale_id', saleId);

            if (itemsError) {
                toast({ title: "Erro ao buscar itens para impressão", description: itemsError.message, variant: "destructive" });
                return;
            }

            const defaultPrinter = printerLocations.find(p => p.is_default);
            
            const groupedByPrinter = saleItems.reduce((acc, item) => {
                const printerId = item.product.printer_location_id || defaultPrinter?.id;
                if (!printerId) return acc;
                if (!acc[printerId]) {
                    acc[printerId] = [];
                }
                acc[printerId].push({
                    name: item.product.name,
                    qty: item.quantity,
                    notes: item.observations || '',
                });
                return acc;
            }, {});

            const companyDetails = companies.find(c => c.id === selectedCompanyId);

            for (const printerId in groupedByPrinter) {
                const printer = printerLocations.find(p => p.id === parseInt(printerId));
                if (!printer) continue;

                const itemsForPrinter = groupedByPrinter[printerId];
                const job = {
                    printer: {
                        type: printer.ip_address ? "network" : "usb",
                        printer_name: printer.printer_name,
                        ip: printer.ip_address,
                    },
                    job: {
                        title: `Comanda ${printer.name}`,
                        orderNumber: String(saleId).substring(0, 8),
                        company: { name: companyDetails?.name, cnpj: companyDetails?.cnpj },
                        items: itemsForPrinter,
                        totals: { subtotal: subtotal, total: subtotal },
                        footerMsg: "Produção",
                    },
                };
                
                sendToPrinter(job, printer.name);
            }
        };

        const sendToPrinter = async (job, printerName) => {
            try {
                toast({ title: `🖨️ Enviando para impressora ${printerName}...` });
                const response = await fetch('http://localhost:9100/print', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(job),
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result = await response.json();
                if (result.success) {
                    toast({ title: `✅ Comanda impressa com sucesso em ${printerName}!`, variant: 'success' });
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                toast({ title: `⚠️ Impressora ${printerName} não conectada`, description: error.message, variant: 'destructive' });
            }
        };

        const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        
        if (!selectedCompanyId) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
              <Card className="w-full max-w-md">
                <CardContent className="p-6 text-center">
                  <h2 className="text-2xl font-bold mb-4">Selecione uma Empresa</h2>
                  {allowedCompanies.length > 0 ? (
                    <div className="space-y-2">
                      {allowedCompanies.map(c => (
                        <Button key={c.id} className="w-full" onClick={() => setSelectedCompanyId(c.id)}>{c.name}</Button>
                      ))}
                    </div>
                  ) : <p>Você não tem acesso a nenhuma empresa.</p>}
                </CardContent>
              </Card>
            </div>
          );
        }

        if (!authenticatedUser) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                    <Card className="w-full max-w-md">
                        <CardContent className="p-6 space-y-4">
                            <h2 className="text-2xl font-bold text-center">Login PDV</h2>
                            <div>
                              <p className="text-sm font-medium mb-2 text-center text-gray-700">{users.find(u => u.user_id === selectedUserId)?.company_name || "Selecione a empresa acima"}</p>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-between">
                                    {users.find(u => u.user_id === selectedUserId)?.employee_name || "Selecione o operador"}
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                  <Command>
                                    <CommandInput placeholder="Buscar operador..." />
                                    <CommandList>
                                      <CommandGroup>
                                        {users.map(u => (
                                          <CommandItem key={u.user_id} onSelect={() => setSelectedUserId(u.user_id)}>
                                            {u.employee_name}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>

                            <div className="flex justify-center space-x-2">
                                {Array(4).fill(0).map((_, i) => (
                                    <Input key={i} type="password" value={pin[i] || ''} readOnly className="w-12 h-12 text-center text-2xl font-bold" />
                                ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                    <Button key={n} variant="outline" onClick={() => pin.length < 4 && setPin(pin + n)}>{n}</Button>
                                ))}
                                <Button variant="outline" onClick={() => setPin(pin.slice(0, -1))}>Apagar</Button>
                                <Button variant="outline" onClick={() => pin.length < 4 && setPin(pin + 0)}>0</Button>
                                <Button onClick={handlePinLogin} disabled={!selectedUserId || pin.length !== 4}>Entrar</Button>
                            </div>
                            <Button variant="link" onClick={() => setSelectedCompanyId(null)}>Trocar Empresa</Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 h-screen bg-gray-50">
                <div className="flex flex-col p-4">
                    <header className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <User className="w-6 h-6 text-primary" />
                            <h1 className="text-xl font-bold">{authenticatedUser.employee_name}</h1>
                        </div>
                        <Button variant="ghost" onClick={handleLogout}>Sair</Button>
                    </header>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                            placeholder="Buscar produto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
                        {categories.map(category => (
                            <Button
                                key={category}
                                variant={activeCategory === category ? 'default' : 'outline'}
                                onClick={() => setActiveCategory(category)}
                                className="whitespace-nowrap"
                            >
                                {category === 'all' ? 'Todos' : category}
                            </Button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto">
                        <AnimatePresence>
                            {filteredProducts.map(product => (
                                <motion.div
                                    key={product.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    onClick={() => addToCart(product)}
                                    className="cursor-pointer"
                                >
                                    <Card className="flex flex-col items-center justify-center p-2 text-center h-full hover:shadow-lg transition-shadow">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="w-16 h-16 object-cover rounded-md mb-2" src="https://images.unsplash.com/photo-1615946093435-eaafc8241554" />
                                        ) : (
                                            <div className="w-16 h-16 bg-gray-200 rounded-md mb-2 flex items-center justify-center">
                                                <ShoppingCart className="w-8 h-8 text-gray-400" />
                                            </div>
                                        )}
                                        <p className="text-sm font-semibold flex-grow">{product.name}</p>
                                        <p className="text-xs text-green-600 font-bold">{formatCurrency(product.sale_price)}</p>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex flex-col bg-white p-6 shadow-lg">
                    <h2 className="text-2xl font-bold mb-4">Pedido</h2>
                    <div className="mb-4">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                    {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.phone})` : "Selecionar Cliente"}
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar cliente..." />
                                    <CommandList>
                                        <CommandGroup>
                                            <CommandItem onSelect={() => setIsCustomerModalOpen(true)}>
                                                <UserPlus className="mr-2 h-4 w-4" />
                                                Adicionar novo cliente
                                            </CommandItem>
                                            {customers.map(c => (
                                                <CommandItem key={c.id} onSelect={() => setSelectedCustomer(c)}>
                                                    {c.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {selectedCustomer && (
                            <Button variant="ghost" size="sm" className="mt-1 text-red-500" onClick={() => setSelectedCustomer(null)}>Remover Cliente</Button>
                        )}
                    </div>
                    <div className="flex-grow overflow-y-auto -mr-6 pr-6">
                        {cart.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                Seu carrinho está vazio.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {cart.map(item => (
                                    <Card key={item.id} className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{item.name}</p>
                                                <p className="text-sm text-green-600">{formatCurrency(item.sale_price)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button size="icon" variant="outline" onClick={() => updateQuantity(item.id, -1)}><Minus className="w-4 h-4" /></Button>
                                                <span className="w-8 text-center font-bold">{item.quantity}</span>
                                                <Button size="icon" variant="outline" onClick={() => updateQuantity(item.id, 1)}><Plus className="w-4 h-4" /></Button>
                                            </div>
                                        </div>
                                        <Input
                                            placeholder="Observações (ex: sem cebola)"
                                            value={item.notes}
                                            onChange={(e) => updateNotes(item.id, e.target.value)}
                                            className="mt-2"
                                        />
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="mt-6 border-t pt-6 space-y-4">
                        <div className="flex justify-between font-bold text-xl">
                            <span>Total</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <Button className="w-full text-lg py-6" onClick={() => setIsPaymentModalOpen(true)} disabled={cart.length === 0}>
                            Pagamento
                        </Button>
                    </div>
                </div>

                <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>Finalizar Venda</DialogTitle></DialogHeader>
                        <div className="grid grid-cols-2 gap-8 py-4">
                            <div>
                                <h3 className="font-bold mb-2">Resumo do Pedido</h3>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {cart.map(item => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <span>{item.quantity}x {item.name}</span>
                                            <span>{formatCurrency(item.quantity * item.sale_price)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t mt-4 pt-4 flex justify-between font-bold text-lg">
                                    <span>Total</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold mb-2">Pagamentos</h3>
                                <div className="space-y-2">
                                    {payments.map((payment, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <select
                                                value={payment.method_id}
                                                onChange={(e) => updatePayment(index, 'method_id', parseInt(e.target.value))}
                                                className="p-2 border rounded-md w-full"
                                            >
                                                {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                                            </select>
                                            <Input
                                                type="number"
                                                placeholder="Valor"
                                                value={payment.value}
                                                onChange={(e) => updatePayment(index, 'value', e.target.value)}
                                                className="w-32"
                                            />
                                            <Button size="icon" variant="ghost" onClick={() => removePayment(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                        </div>
                                    ))}
                                </div>
                                <Button variant="outline" onClick={handleAddPayment} className="mt-2 w-full">Adicionar Pagamento</Button>
                                <div className="mt-4 space-y-2 text-sm">
                                    <div className="flex justify-between"><span>Total Pago:</span> <span>{formatCurrency(totalPaid)}</span></div>
                                    <div className={`flex justify-between font-bold ${remainingAmount > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                        <span>{remainingAmount > 0 ? 'Faltam:' : 'Troco:'}</span>
                                        <span>{formatCurrency(Math.abs(remainingAmount))}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleFinishSale} disabled={Math.abs(remainingAmount) > 0.01}>Finalizar Venda</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div><Label>Nome</Label><Input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} /></div>
                            <div><Label>Telefone</Label><Input value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} /></div>
                            <div><Label>CPF</Label><Input value={newCustomer.cpf} onChange={e => setNewCustomer({ ...newCustomer, cpf: e.target.value })} /></div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCustomerModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleCreateCustomer}>Salvar Cliente</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <div style={{ display: 'none' }}>
                    {saleToPrint && <PdvReceipt ref={receiptRef} sale={saleToPrint} />}
                </div>

            </div>
        );
    };

    export default PDV;
  