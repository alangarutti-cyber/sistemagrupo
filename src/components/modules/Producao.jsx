import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
    import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
    import { Factory, PlusCircle, ChevronsUpDown, Package, Calendar, User, Tag, Play, CheckCircle, Info, Printer, Search, ListFilter, BookOpen, Warehouse, Move } from 'lucide-react';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
    import { format } from 'date-fns';

    const statusConfig = {
      Pendente: { color: 'bg-yellow-500', text: 'Pendente' },
      'Em Andamento': { color: 'bg-blue-500', text: 'Em Andamento' },
      Concluída: { color: 'bg-green-500', text: 'Concluída' },
      Cancelada: { color: 'bg-red-500', text: 'Cancelada' },
    };

    const Combobox = ({ options, value, onSelect, placeholder, searchPlaceholder }) => {
      const [open, setOpen] = useState(false);
      const selectedOption = options.find(opt => opt.id === value);
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between">
              {selectedOption ? selectedOption.name : placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder={searchPlaceholder} />
              <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map(option => (
                  <CommandItem
                    key={option.id}
                    value={option.name}
                    onSelect={() => { onSelect(option.id); setOpen(false); }}
                  >
                    {option.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      );
    };

    const OrderCard = ({ order, onAction }) => (
      <motion.div layout className="bg-card rounded-xl shadow-md border p-4 flex flex-col space-y-3">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg text-foreground pr-4">{order.product_name || 'Produto não encontrado'}</h3>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full text-white ${statusConfig[order.status]?.color || 'bg-gray-400'}`}>
            {statusConfig[order.status]?.text || 'Desconhecido'}
          </span>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="flex items-center gap-2"><Package className="w-4 h-4" /> <strong>{order.quantity_planned} {order.unit}</strong></p>
          <p className="flex items-center gap-2"><Tag className="w-4 h-4" /> Lote: <strong>{order.batch_code}</strong></p>
          <p className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Validade: <strong>{order.expiration_date ? format(new Date(order.expiration_date), 'dd/MM/yyyy') : 'N/A'}</strong></p>
          <p className="flex items-center gap-2"><User className="w-4 h-4" /> Resp: {order.produced_by_name || 'N/A'}</p>
        </div>
        <div className="flex-grow"></div>
        <div className="flex items-center justify-end flex-wrap gap-2 pt-2 border-t">
          {order.status === 'Pendente' && <Button size="sm" variant="outline" onClick={() => onAction('start', order)}><Play className="w-4 h-4 mr-1" /> Iniciar</Button>}
          {order.status === 'Em Andamento' && <Button size="sm" variant="success" onClick={() => onAction('finish', order)}><CheckCircle className="w-4 h-4 mr-1" /> Finalizar</Button>}
          <Button size="sm" variant="secondary" onClick={() => onAction('details', order)}><Info className="w-4 h-4 mr-1" /> Detalhes</Button>
          <Button size="sm" variant="secondary" onClick={() => onAction('print', order)}><Printer className="w-4 h-4 mr-1" /> Etiquetas</Button>
        </div>
      </motion.div>
    );

    const OrderForm = ({ order, companies, products, employees, onSave, onCancel, user, userCompanyAccess }) => {
      const [formData, setFormData] = useState({
        company_id: '',
        product_id: '',
        quantity_planned: '',
        produced_by_id: '',
        notes: '',
        shelf_life_days: '',
        ...order
      });

      const allowedCompanies = useMemo(() => companies.filter(c => user.is_admin || userCompanyAccess.some(ua => ua.company_id === c.id)), [companies, user, userCompanyAccess]);
      const filteredProducts = useMemo(() => formData.company_id ? products.filter(p => p.product_company_access.some(pca => pca.company_id === formData.company_id)) : [], [products, formData.company_id]);
      const filteredEmployees = useMemo(() => formData.company_id ? employees.filter(e => e.company_id === formData.company_id) : [], [employees, formData.company_id]);

      useEffect(() => {
        if (order) {
            setFormData({
                company_id: '',
                product_id: '',
                quantity_planned: '',
                produced_by_id: '',
                notes: '',
                shelf_life_days: '',
                ...order
            });
        }
      }, [order]);

      useEffect(() => {
        if (formData.product_id) {
          const product = products.find(p => p.id === formData.product_id);
          if (product) {
            setFormData(prev => ({ ...prev, unit: product.unit, shelf_life_days: product.shelf_life_days || '' }));
          }
        }
      }, [formData.product_id, products]);
      
      const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

      const handleSubmit = () => {
        const product = products.find(p => p.id === formData.product_id);
        const employee = employees.find(e => e.id === formData.produced_by_id);
        const dataToSave = {
          ...formData,
          product_name: product?.name,
          produced_by_name: employee?.name,
          unit: product?.unit,
          quantity_produced: formData.quantity_planned, // Default produced to planned
        };
        onSave(dataToSave);
      };

      return (
        <div className="space-y-4 p-1">
          <h2 className="text-2xl font-bold">{order ? 'Editar Ordem' : 'Nova Ordem de Produção'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Empresa</Label><Combobox options={allowedCompanies} value={formData.company_id} onSelect={val => handleChange('company_id', val)} placeholder="Selecione a Empresa" searchPlaceholder="Buscar empresa..." /></div>
            <div><Label>Produto</Label><Combobox options={filteredProducts} value={formData.product_id} onSelect={val => handleChange('product_id', val)} placeholder="Selecione o Produto" searchPlaceholder="Buscar produto..." /></div>
            <div><Label>Quantidade a Produzir</Label><Input type="number" value={formData.quantity_planned} onChange={e => handleChange('quantity_planned', e.target.value)} /></div>
            <div><Label>Responsável</Label><Combobox options={filteredEmployees} value={formData.produced_by_id} onSelect={val => handleChange('produced_by_id', val)} placeholder="Selecione o Responsável" searchPlaceholder="Buscar funcionário..." /></div>
            <div><Label>Validade (Dias)</Label><Input type="number" placeholder="Automático pelo cadastro" value={formData.shelf_life_days} onChange={e => handleChange('shelf_life_days', e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea value={formData.notes} onChange={e => handleChange('notes', e.target.value)} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit}>Salvar Ordem</Button>
            <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          </div>
        </div>
      );
    };
    
    const DetailsModal = ({ order, onCancel }) => {
      const [movements, setMovements] = useState([]);
      const [loading, setLoading] = useState(true);

      useEffect(() => {
        const fetchMovements = async () => {
          if (!order) return;
          setLoading(true);
          const { data, error } = await supabase
            .from('production_movements')
            .select('*')
            .eq('order_id', order.id)
            .order('movement_date', { ascending: false });

          if (error) {
            console.error("Error fetching movements:", error);
          } else {
            setMovements(data);
          }
          setLoading(false);
        };
        fetchMovements();
      }, [order]);

      return (
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Detalhes da Ordem de Produção #{order.id}</AlertDialogTitle>
            <AlertDialogDescription>Lote: {order.batch_code}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Move />Movimentações de Estoque</h3>
            {loading ? <p>Carregando...</p> : (
                movements.length > 0 ? (
                <ul className="space-y-2">
                    {movements.map(mov => (
                    <li key={mov.id} className={`flex justify-between items-center p-2 rounded-md ${mov.movement_type === 'entrada' ? 'bg-green-100' : 'bg-red-100'}`}>
                        <div>
                        <p className="font-semibold">{mov.product_name}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(mov.movement_date), 'dd/MM/yy HH:mm')}</p>
                        </div>
                        <p className={`font-bold ${mov.movement_type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                        {mov.movement_type === 'entrada' ? '+' : '-'}{mov.quantity} {mov.unit}
                        </p>
                    </li>
                    ))}
                </ul>
                ) : <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada para esta ordem.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancel}>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      );
    };


    const Producao = ({ user, companies, userCompanyAccess, onModuleChange }) => {
      const { toast } = useToast();
      const [orders, setOrders] = useState([]);
      const [products, setProducts] = useState([]);
      const [employees, setEmployees] = useState([]);
      const [loading, setLoading] = useState(true);
      const [filters, setFilters] = useState({ company_id: '', status: '', search: '' });
      const [modal, setModal] = useState({ type: null, data: null });

      const allowedCompanies = useMemo(() => companies.filter(c => user.is_admin || userCompanyAccess.some(ua => ua.company_id === c.id)), [companies, user, userCompanyAccess]);
      
      const fetchData = useCallback(async (currentFilters, companyIds) => {
        if (companyIds.length === 0) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const { data: productsData, error: productsError } = await supabase.from('products').select('*, product_company_access(company_id)');
          if (productsError) throw productsError;
          setProducts(productsData || []);
          
          const { data: employeesData, error: employeesError } = await supabase.from('employees').select('*').in('company_id', companyIds);
          if (employeesError) throw employeesError;
          setEmployees(employeesData || []);

          let query = supabase.from('production_orders').select('*').order('created_at', { ascending: false });
          
          if(currentFilters.company_id) {
            query = query.eq('company_id', currentFilters.company_id);
          } else {
            query = query.in('company_id', companyIds);
          }
          if (currentFilters.status) query = query.eq('status', currentFilters.status);
          if (currentFilters.search) query = query.or(`product_name.ilike.%${currentFilters.search}%,batch_code.ilike.%${currentFilters.search}%`);

          const { data: ordersData, error: ordersError } = await query;
          if (ordersError) throw ordersError;
          setOrders(ordersData || []);

        } catch (error) {
          toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
        } finally {
          setLoading(false);
        }
      }, [toast]);
      
      useEffect(() => {
        const companyIds = allowedCompanies.map(c => c.id);
        let currentFilters = { ...filters };
        
        if (companyIds.length > 0 && !filters.company_id) {
            const newCompanyId = companyIds[0].id;
            currentFilters.company_id = newCompanyId;
            setFilters(f => ({ ...f, company_id: newCompanyId }));
        }

        if (companyIds.length > 0) {
            fetchData(currentFilters, companyIds);
        } else {
            setLoading(false);
        }
    }, [allowedCompanies, filters.company_id, filters.status, filters.search, fetchData]);


      const handleSaveOrder = async (orderData) => {
        try {
          const { id, ...data } = orderData;
          let result;
          if (id) {
            result = await supabase.from('production_orders').update(data).eq('id', id);
          } else {
            result = await supabase.from('production_orders').insert(data);
          }
          if (result.error) throw result.error;
          toast({ title: 'Ordem salva com sucesso!' });
          setModal({ type: null, data: null });
          const companyIds = allowedCompanies.map(c => c.id);
          fetchData(filters, companyIds);
        } catch (error) {
          toast({ title: 'Erro ao salvar ordem', description: error.message, variant: 'destructive' });
        }
      };
      
      const handleAction = async (action, order) => {
        if (action === 'details') {
            setModal({ type: 'details', data: order });
            return;
        }
        if (action === 'print') {
            onModuleChange('impressao-etiquetas');
            return;
        }

        let newStatus = '';
        let updateData = {};
        if (action === 'start') {
            newStatus = 'Em Andamento';
            updateData = { status: newStatus };
        }
        if (action === 'finish') {
            newStatus = 'Concluída';
            updateData = { status: newStatus, quantity_produced: order.quantity_planned };
        }

        if(newStatus){
            const { error } = await supabase.from('production_orders').update(updateData).eq('id', order.id);
            if(error){
                toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive'});
            } else {
                toast({ title: `Ordem #${order.id} ${newStatus.toLowerCase()}!`});
                const companyIds = allowedCompanies.map(c => c.id);
                fetchData(filters, companyIds);
            }
        }
      };
      
      const handleFilterChange = (field, value) => setFilters(prev => ({ ...prev, [field]: value }));

      return (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold flex items-center gap-3"><Factory /> Módulo de Produção</h1>

          <div className="bg-card p-4 rounded-xl shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select value={filters.company_id} onChange={e => handleFilterChange('company_id', parseInt(e.target.value))} className="w-full p-2 border rounded-md bg-background"><option value="">Todas Empresas</option>{allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="w-full p-2 border rounded-md bg-background"><option value="">Todos Status</option>{Object.keys(statusConfig).map(s => <option key={s} value={s}>{s}</option>)}</select>
              <Input placeholder="Buscar por produto ou lote..." value={filters.search} onChange={e => handleFilterChange('search', e.target.value)} />
            </div>
            <div className="flex justify-between items-center">
                <Button onClick={() => setModal({ type: 'form', data: null })}><PlusCircle className="w-4 h-4 mr-2" /> Nova Ordem</Button>
            </div>
          </div>
          
          {loading ? <p>Carregando ordens...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {orders.map(order => <OrderCard key={order.id} order={order} onAction={handleAction} />)}
            </div>
          )}

          <AlertDialog open={modal.type === 'form' || modal.type === 'details'} onOpenChange={() => modal.type && setModal({ type: null, data: null })}>
              {modal.type === 'form' && <AlertDialogContent className="max-w-3xl"><OrderForm order={modal.data} companies={companies} products={products} employees={employees} onSave={handleSaveOrder} onCancel={() => setModal({ type: null, data: null })} userCompanyAccess={userCompanyAccess} user={user} /></AlertDialogContent>}
              {modal.type === 'details' && <DetailsModal order={modal.data} onCancel={() => setModal({ type: null, data: null })} />}
          </AlertDialog>
        </div>
      );
    };

    export default Producao;