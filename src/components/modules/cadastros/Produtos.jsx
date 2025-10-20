
    import React, { useState, useEffect, useCallback, useRef } from 'react';
    import { motion } from 'framer-motion';
    import { PlusCircle, Edit, Save, X, Upload, Trash2, ChevronsUpDown, Download, UploadCloud, FileSpreadsheet, ArrowRight, Loader2, AlertTriangle, SortAsc, SortDesc, Search } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Checkbox } from '@/components/ui/checkbox';
    import { Textarea } from '@/components/ui/textarea';
    import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
    import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
    import * as XLSX from 'xlsx';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { useUser } from '@/contexts/UserContext';

    const FichaTecnicaTab = ({ product, allProducts, onCostChange }) => {
      const { toast } = useToast();
      const [recipeItems, setRecipeItems] = useState([]);
      const [loading, setLoading] = useState(false);
      const [totalCost, setTotalCost] = useState(0);

      const fetchRecipeItems = useCallback(async () => {
        if (!product?.id) return;
        setLoading(true);
        const { data, error } = await supabase
          .from('recipe_items')
          .select('*, ingredient:products(id, name, cost_price, unit)')
          .eq('product_id', product.id);

        if (error) {
          toast({ title: 'Erro ao buscar ficha técnica', variant: 'destructive' });
        } else {
          setRecipeItems(data || []);
        }
        setLoading(false);
      }, [product?.id, toast]);

      useEffect(() => {
        fetchRecipeItems();
      }, [fetchRecipeItems]);

      const stableOnCostChange = useCallback(onCostChange, [onCostChange]);

      useEffect(() => {
        const cost = recipeItems.reduce((acc, item) => {
          const ingredientCost = item.ingredient?.cost_price || 0;
          return acc + (ingredientCost * item.quantity);
        }, 0);
        setTotalCost(cost);
        stableOnCostChange(cost);
      }, [recipeItems, stableOnCostChange]);

      const handleAddIngredient = async (ingredientId) => {
        if (recipeItems.some(item => item.ingredient_id === ingredientId)) {
          toast({ title: 'Ingrediente já adicionado', variant: 'destructive' });
          return;
        }
        const { data, error } = await supabase
          .from('recipe_items')
          .insert({ product_id: product.id, ingredient_id: ingredientId, quantity: 1 })
          .select('*, ingredient:products(id, name, cost_price, unit)')
          .single();
        
        if (error) {
          toast({ title: 'Erro ao adicionar ingrediente', variant: 'destructive' });
        } else {
          setRecipeItems(prev => [...prev, data]);
        }
      };

      const handleQuantityChange = async (itemId, newQuantity) => {
        const quantity = parseFloat(newQuantity);
        if (isNaN(quantity) || quantity < 0) return;

        setRecipeItems(prev => prev.map(item => item.id === itemId ? { ...item, quantity } : item));

        const { error } = await supabase
          .from('recipe_items')
          .update({ quantity })
          .eq('id', itemId);
        
        if (error) {
          toast({ title: 'Erro ao atualizar quantidade', variant: 'destructive' });
        }
      };

      const handleRemoveIngredient = async (itemId) => {
        const { error } = await supabase.from('recipe_items').delete().eq('id', itemId);
        if (error) {
          toast({ title: 'Erro ao remover ingrediente', variant: 'destructive' });
        } else {
          setRecipeItems(prev => prev.filter(item => item.id !== itemId));
        }
      };

      return (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <IngredientCombobox allProducts={allProducts} onSelect={handleAddIngredient} />
            <div className="text-left sm:text-right">
              <p className="text-sm text-gray-600">Custo Total da Ficha</p>
              <p className="text-xl sm:text-2xl font-bold text-indigo-600">R$ {totalCost.toFixed(2)}</p>
            </div>
          </div>
          
          {loading ? <p>Carregando...</p> : (
            <div className="space-y-2">
              {recipeItems.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-2 rounded-md bg-gray-50">
                  <p className="flex-1 font-medium">{item.ingredient?.name}</p>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      className="w-24 h-8"
                    />
                    <span className="text-sm text-gray-500">{item.ingredient?.unit}</span>
                  </div>
                  <p className="w-full sm:w-28 text-left sm:text-right text-sm">R$ {( (item.ingredient?.cost_price || 0) * item.quantity).toFixed(2)}</p>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveIngredient(item.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    const IngredientCombobox = ({ allProducts, onSelect }) => {
      const [open, setOpen] = useState(false);

      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full sm:w-[300px] justify-between">
              Adicionar Insumo
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full sm:w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Buscar insumo..." />
              <CommandEmpty>Nenhum insumo encontrado.</CommandEmpty>
              <CommandGroup className="max-h-60 overflow-y-auto">
                {allProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => {
                      onSelect(product.id);
                      setOpen(false);
                    }}
                  >
                    {product.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      );
    };

    const EditableCell = ({ value, onSave, type = 'text' }) => {
      const [isEditing, setIsEditing] = useState(false);
      const [currentValue, setCurrentValue] = useState(value);
      const inputRef = useRef(null);

      useEffect(() => {
        setCurrentValue(value);
      }, [value]);

      useEffect(() => {
        if (isEditing) {
          inputRef.current?.focus();
          inputRef.current?.select();
        }
      }, [isEditing]);

      const handleBlur = () => {
        setIsEditing(false);
        if (currentValue !== value) {
          onSave(currentValue);
        }
      };

      const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
          handleBlur();
        } else if (e.key === 'Escape') {
          setCurrentValue(value);
          setIsEditing(false);
        }
      };

      if (isEditing) {
        return (
          <Input
            ref={inputRef}
            type={type}
            value={currentValue === null ? '' : currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="h-8"
          />
        );
      }

      return (
        <div onClick={() => setIsEditing(true)} className="cursor-pointer p-2 min-h-[40px]">
          {type === 'number' && typeof value === 'number' && value !== null ? `R$ ${value.toFixed(2)}` : value || ''}
        </div>
      );
    };

    const ProdutosTab = ({ companies }) => {
      const { toast } = useToast();
      const { user } = useUser();
      const [products, setProducts] = useState([]);
      const [categories, setCategories] = useState([]);
      const [printerLocations, setPrinterLocations] = useState([]);
      const [loading, setLoading] = useState(true);
      const [isFormOpen, setIsFormOpen] = useState(false);
      const [editingProduct, setEditingProduct] = useState(null);
      const [productData, setProductData] = useState({});
      const [formTab, setFormTab] = useState('geral');
      const [selectedCompanies, setSelectedCompanies] = useState(new Set());
      const fileInputRef = useRef(null);
      const [importSummary, setImportSummary] = useState(null);
      const [categoryFilter, setCategoryFilter] = useState('');
      const [companyFilter, setCompanyFilter] = useState('');
      const [searchTerm, setSearchTerm] = useState('');
      const [sortOrder, setSortOrder] = useState('asc');
      const [isUploading, setIsUploading] = useState(false);
      const imageUploadInputRef = useRef(null);
      const [showPriceAlert, setShowPriceAlert] = useState(false);
      const [justification, setJustification] = useState('');
      const [justificationCallback, setJustificationCallback] = useState(null);
      const userHasPermission = user.is_admin || user.role === 'Administrador' || user.role === 'Produção';


      const resetProductData = () => ({
        name: '', is_active: true, category_id: '', unit: 'UN',
        cost_price: '', sale_price: '', sale_price_2: '', sale_price_3: '', custom_code: '',
        description: '', image_url: '', min_stock: '', current_stock: '',
        storage_location: '', recipe_cost: 0, show_in_pdv: true,
        input_unit: '', conversion_factor: '', shelf_life_manipulated_hours: '',
        validade_dias_ambiente: '', validade_dias_congelado: '', printer_location_id: null
      });

      const fetchInitialData = useCallback(async () => {
        setLoading(true);
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*, product_categories(name), product_company_access(company_id)');
        
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('product_categories')
          .select('*, companies:product_category_company_access(company_id)');

        const { data: locationsData, error: locationsError } = await supabase
          .from('printer_locations')
          .select('*');

        if (productsError || categoriesError || locationsError) {
          toast({ title: 'Erro ao buscar dados', description: productsError?.message || categoriesError?.message || locationsError?.message, variant: 'destructive' });
        } else {
          const productsWithAccess = productsData.map(p => ({
            ...p,
            company_access: p.product_company_access.map(pca => pca.company_id)
          }));
          
          const categoriesWithAccess = categoriesData.map(c => ({
            ...c,
            company_access: c.companies.map(ca => ca.company_id)
          }));

          setProducts(productsWithAccess || []);
          setCategories(categoriesWithAccess || []);
          setPrinterLocations(locationsData || []);
        }
        setLoading(false);
      }, [toast]);

      useEffect(() => {
        fetchInitialData();
      }, [fetchInitialData]);

      const handleProductInputChange = useCallback((field, value) => {
        setProductData(prev => ({ ...prev, [field]: value }));
      }, []);

      const handleCostChange = useCallback((cost) => {
        setProductData(prev => ({...prev, recipe_cost: cost}));
      }, []);

      const handleCompanySelection = (companyId) => {
        setSelectedCompanies(prev => {
          const newSet = new Set(prev);
          if (newSet.has(companyId)) {
            newSet.delete(companyId);
          } else {
            newSet.add(companyId);
          }
          return newSet;
        });
      };

      const openForm = (product = null) => {
        if (product) {
          setEditingProduct(product);
          setProductData({ ...resetProductData(), ...product });
          setSelectedCompanies(new Set(product.company_access || []));
        } else {
          setEditingProduct(null);
          setProductData(resetProductData());
          setSelectedCompanies(new Set(companies.map(c => c.id)));
        }
        setFormTab('geral');
        setIsFormOpen(true);
      };

      const closeForm = () => {
        setIsFormOpen(false);
        setEditingProduct(null);
      };

      const proceedWithSave = async (justificationText = '') => {
        if (!productData.name || selectedCompanies.size === 0) {
          toast({ title: 'Campos obrigatórios', description: 'Nome e pelo menos uma Loja são obrigatórios.', variant: 'destructive' });
          return;
        }

        if (productData.input_unit && (!productData.unit || !productData.conversion_factor)) {
          toast({ title: 'Conversão Incompleta', description: 'Se a Unidade de Entrada for informada, o Fator de Conversão e a Unidade de Estoque também devem ser preenchidos.', variant: 'destructive' });
          return;
        }

        const conversionFactor = parseFloat(productData.conversion_factor);
        if (productData.conversion_factor && (isNaN(conversionFactor) || conversionFactor <= 0)) {
          toast({ title: 'Fator de Conversão Inválido', description: 'O Fator de Conversão deve ser um número maior que zero.', variant: 'destructive' });
          return;
        }

        const parseNumeric = (value) => {
            if (value === null || value === '') return null;
            const num = parseFloat(String(value).replace(',', '.'));
            return isNaN(num) ? null : num;
        };

        const parseIntValue = (value) => {
          if (value === null || value === '') return null;
          const num = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
          return isNaN(num) ? null : num;
        }

        const dataToSave = {
          ...productData,
          cost_price: parseNumeric(productData.cost_price),
          sale_price: parseNumeric(productData.sale_price),
          sale_price_2: parseNumeric(productData.sale_price_2),
          sale_price_3: parseNumeric(productData.sale_price_3),
          min_stock: parseNumeric(productData.min_stock),
          current_stock: parseNumeric(productData.current_stock),
          category_id: productData.category_id || null,
          recipe_cost: parseNumeric(productData.recipe_cost),
          conversion_factor: parseNumeric(productData.conversion_factor),
          input_unit: productData.input_unit || null,
          shelf_life_manipulated_hours: parseNumeric(productData.shelf_life_manipulated_hours),
          validade_dias_ambiente: parseIntValue(productData.validade_dias_ambiente),
          validade_dias_congelado: parseIntValue(productData.validade_dias_congelado),
          printer_location_id: productData.printer_location_id || null,
        };
        
        delete dataToSave.id;
        delete dataToSave.created_at;
        delete dataToSave.product_categories;
        delete dataToSave.product_company_access;
        delete dataToSave.company_access;

        let error;
        let savedProduct;
        if (editingProduct) {
          const { data, error: updateError } = await supabase.from('products').update(dataToSave).eq('id', editingProduct.id).select().single();
          error = updateError;
          savedProduct = data;
        } else {
          const { data, error: insertError } = await supabase.from('products').insert(dataToSave).select().single();
          error = insertError;
          savedProduct = data;
        }

        if (error) {
          toast({ title: 'Erro ao salvar produto', description: error.message, variant: 'destructive' });
          return;
        }
        
        if (justificationText) {
          toast({
            title: 'Auditoria: Preço de Venda Menor que Custo',
            description: `Justificativa: ${justificationText}`,
            duration: 7000
          });
        }

        const { error: deleteAccessError } = await supabase.from('product_company_access').delete().eq('product_id', savedProduct.id);
        if (deleteAccessError) {
          toast({ title: 'Erro ao atualizar lojas', description: deleteAccessError.message, variant: 'destructive' });
          return;
        }

        const accessToInsert = Array.from(selectedCompanies).map(company_id => ({ product_id: savedProduct.id, company_id }));
        if (accessToInsert.length > 0) {
          const { error: insertAccessError } = await supabase.from('product_company_access').insert(accessToInsert);
          if (insertAccessError) {
            toast({ title: 'Erro ao salvar lojas', description: insertAccessError.message, variant: 'destructive' });
            return;
          }
        }

        toast({ title: `Produto ${editingProduct ? 'atualizado' : 'criado'} com sucesso!`, variant: 'success' });
        if (!editingProduct) {
          setEditingProduct(savedProduct);
          setProductData({ ...resetProductData(), ...savedProduct });
          setFormTab('ficha');
        } else {
          closeForm();
        }
        fetchInitialData();
      }

      const handleSaveProduct = () => {
        const costPrice = parseFloat(productData.cost_price);
        const salePrice = parseFloat(productData.sale_price);

        if (!isNaN(costPrice) && !isNaN(salePrice) && salePrice < costPrice) {
            setJustificationCallback(() => () => proceedWithSave(justification));
            setShowPriceAlert(true);
        } else {
            proceedWithSave();
        }
      };
      
      const handlePriceAlertConfirm = () => {
          if(justification.trim() === '') {
              toast({ title: "Justificativa obrigatória", description: "Por favor, informe o motivo para o preço de venda ser menor que o custo.", variant: "destructive" });
              return;
          }
          if (justificationCallback) {
              justificationCallback();
          }
          setShowPriceAlert(false);
          setJustification('');
          setJustificationCallback(null);
      };

      const handlePriceAlertCancel = () => {
          setShowPriceAlert(false);
          setJustification('');
          setJustificationCallback(null);
      };

      const handleDeleteProduct = async (productId) => {
        const { error: accessError } = await supabase.from('product_company_access').delete().eq('product_id', productId);
        const { error: recipeError } = await supabase.from('recipe_items').delete().eq('product_id', productId);
        const { error: recipeIngredientError } = await supabase.from('recipe_items').delete().eq('ingredient_id', productId);
        
        if (accessError || recipeError || recipeIngredientError) {
          toast({ title: 'Erro ao remover dependências do produto.', variant: 'destructive' });
          return;
        }

        const { error } = await supabase.from('products').delete().eq('id', productId);
        
        if (error) {
          toast({ title: 'Erro ao excluir produto', description: 'Verifique se ele não está sendo usado em movimentações ou pedidos.', variant: 'destructive' });
        } else {
          toast({ title: 'Produto excluído com sucesso!', variant: 'success' });
          fetchInitialData();
        }
      };

      const handleExportTemplate = () => {
        const headers = [
          "name", "category_name", "unit", "cost_price", "sale_price", "sale_price_2", "sale_price_3", "custom_code",
          "description", "min_stock", "current_stock", "storage_location", "is_active", "show_in_pdv",
          "company_names (separadas por vírgula)"
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Produtos");
        XLSX.writeFile(wb, "modelo_produtos.xlsx");
        toast({ title: "Modelo para importação exportado!" });
      };
      
      const handleExportProducts = () => {
        const categoriesMap = new Map(categories.map(c => [c.id, c.name]));
        const companiesMap = new Map(companies.map(c => [c.id, c.name]));

        const dataToExport = products.map(p => ({
            "name": p.name,
            "category_name": p.category_id ? categoriesMap.get(p.category_id) : "",
            "unit": p.unit,
            "cost_price": p.cost_price,
            "sale_price": p.sale_price,
            "sale_price_2": p.sale_price_2,
            "sale_price_3": p.sale_price_3,
            "custom_code": p.custom_code,
            "description": p.description,
            "min_stock": p.min_stock,
            "current_stock": p.current_stock,
            "storage_location": p.storage_location,
            "is_active": p.is_active,
            "show_in_pdv": p.show_in_pdv,
            "company_names (separadas por vírgula)": p.company_access.map(id => companiesMap.get(id)).join(", "),
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Produtos Cadastrados");
        XLSX.writeFile(wb, "produtos_cadastrados.xlsx");
        toast({ title: "Planilha de produtos exportada com sucesso!" });
      };

      const handleImportFile = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            await processImport(json);
          } catch (error) {
            toast({ title: "Erro ao ler o arquivo", description: error.message, variant: "destructive" });
          }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
      };

      const processImport = async (data) => {
        let importedCount = 0;
        let updatedCount = 0;
        let ignoredCount = 0;
        const ignoredReasons = [];

        const categoriesMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
        const companiesMap = new Map(companies.map(c => [c.name.toLowerCase(), c.id]));

        for (const row of data) {
          if (!row.name) {
            ignoredCount++;
            ignoredReasons.push(`Linha ignorada: Nome do produto é obrigatório.`);
            continue;
          }

          const category_id = row.category_name ? categoriesMap.get(row.category_name.toLowerCase()) : null;
          const companyNames = (row["company_names (separadas por vírgula)"] || "").split(',').map(name => name.trim().toLowerCase());
          const company_ids = companyNames.map(name => companiesMap.get(name)).filter(id => id);

          if (company_ids.length === 0) {
            ignoredCount++;
            ignoredReasons.push(`Produto "${row.name}": Nenhuma loja válida encontrada.`);
            continue;
          }

          const productPayload = {
            name: row.name,
            category_id: category_id,
            unit: row.unit || 'UN',
            cost_price: row.cost_price ? parseFloat(row.cost_price) : null,
            sale_price: row.sale_price ? parseFloat(row.sale_price) : null,
            sale_price_2: row.sale_price_2 ? parseFloat(row.sale_price_2) : null,
            sale_price_3: row.sale_price_3 ? parseFloat(row.sale_price_3) : null,
            custom_code: row.custom_code || null,
            description: row.description || null,
            min_stock: row.min_stock ? parseFloat(row.min_stock) : null,
            current_stock: row.current_stock ? parseFloat(row.current_stock) : null,
            storage_location: row.storage_location || null,
            is_active: row.is_active !== undefined ? Boolean(row.is_active) : true,
            show_in_pdv: row.show_in_pdv !== undefined ? Boolean(row.show_in_pdv) : true,
          };

          const { data: existingProduct, error: findError } = await supabase
            .from('products')
            .or(`name.eq.${row.name},custom_code.eq.${row.custom_code}`)
            .limit(1)
            .single();

          if (findError && findError.code !== 'PGRST116') {
            ignoredCount++;
            ignoredReasons.push(`Produto "${row.name}": Erro ao verificar existência (${findError.message}).`);
            continue;
          }

          let savedProduct;
          if (existingProduct) {
            const { data, error } = await supabase.from('products').update(productPayload).eq('id', existingProduct.id).select().single();
            if (error) {
              ignoredCount++;
              ignoredReasons.push(`Produto "${row.name}": Erro ao atualizar (${error.message}).`);
              continue;
            }
            savedProduct = data;
            updatedCount++;
          } else {
            const { data, error } = await supabase.from('products').insert(productPayload).select().single();
            if (error) {
              ignoredCount++;
              ignoredReasons.push(`Produto "${row.name}": Erro ao inserir (${error.message}).`);
              continue;
            }
            savedProduct = data;
            importedCount++;
          }

          await supabase.from('product_company_access').delete().eq('product_id', savedProduct.id);
          const accessToInsert = company_ids.map(id => ({ product_id: savedProduct.id, company_id: id }));
          await supabase.from('product_company_access').insert(accessToInsert);
        }

        setImportSummary({ importedCount, updatedCount, ignoredCount, ignoredReasons });
        fetchInitialData();
      };

      const handleQuickEditSave = async (productId, field, value) => {
          let parsedValue = value;
          if (['cost_price', 'sale_price', 'sale_price_2', 'sale_price_3'].includes(field)) {
              parsedValue = String(value).includes(',') ? parseFloat(String(value).replace(',', '.')) : parseFloat(value);
          }
          if (['validade_dias_ambiente', 'validade_dias_congelado'].includes(field)) {
            parsedValue = value === '' ? null : parseInt(value, 10);
            if (isNaN(parsedValue)) parsedValue = null;
          }

          const { error } = await supabase
              .from('products')
              .update({ [field]: parsedValue })
              .eq('id', productId);

          if (error) {
              toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
              fetchInitialData();
          } else {
              toast({ title: 'Produto atualizado!', variant: 'success' });
              setProducts(prev => prev.map(p => p.id === productId ? { ...p, [field]: parsedValue } : p));
          }
      };


      const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `product_images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('private_files')
          .upload(filePath, file);

        if (uploadError) {
          toast({ title: "Erro no upload da imagem", description: uploadError.message, variant: "destructive" });
          setIsUploading(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('private_files')
          .getPublicUrl(filePath);

        if (!publicUrl) {
          toast({ title: "Erro ao obter URL da imagem", variant: "destructive" });
          setIsUploading(false);
          return;
        }

        handleProductInputChange('image_url', publicUrl);
        setIsUploading(false);
        toast({ title: "Imagem enviada com sucesso!" });
      };

      const filteredAndSortedProducts = products
        .filter(p => 
          (!categoryFilter || p.category_id?.toString() === categoryFilter) &&
          (!companyFilter || p.company_access.includes(parseInt(companyFilter))) &&
          (p.name.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => {
          if (sortOrder === 'asc') {
            return a.name.localeCompare(b.name);
          } else {
            return b.name.localeCompare(a.name);
          }
        });

      const renderForm = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-6 bg-white rounded-xl shadow-md border border-gray-100 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <h3 className="text-xl font-bold text-gray-800">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
            <div className="flex flex-wrap border-b border-gray-200 mt-4 sm:mt-0">
              <button onClick={() => setFormTab('geral')} className={`px-3 py-2 text-sm font-medium ${formTab === 'geral' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}>Geral</button>
              <button onClick={() => setFormTab('detalhes')} className={`px-3 py-2 text-sm font-medium ${formTab === 'detalhes' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}>Mais Detalhes</button>
              <button onClick={() => setFormTab('estoque')} className={`px-3 py-2 text-sm font-medium ${formTab === 'estoque' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}>Estoque</button>
              <button onClick={() => setFormTab('ficha')} disabled={!editingProduct} className={`px-3 py-2 text-sm font-medium ${formTab === 'ficha' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'} disabled:opacity-50 disabled:cursor-not-allowed`}>Ficha Técnica</button>
            </div>
          </div>

          {formTab === 'geral' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 space-y-2"><Label htmlFor="name">Nome do Produto</Label><Input id="name" value={productData.name} onChange={e => handleProductInputChange('name', e.target.value)} /></div>
              <div className="lg:col-span-1 space-y-2">
                <Label htmlFor="category_id">Categoria</Label>
                <select id="category_id" value={productData.category_id || ''} onChange={e => handleProductInputChange('category_id', e.target.value)} className="w-full p-2 border rounded bg-white">
                  <option value="">Sem Categoria</option>
                  {categories
                    .filter(cat => Array.from(selectedCompanies).some(sc => cat.company_access.includes(sc)))
                    .map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>

              <div className="lg:col-span-4 space-y-2">
                <Label>Conversão de Unidade (Compra para Estoque)</Label>
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <Label htmlFor="input_unit" className="text-xs text-muted-foreground">Unidade de Entrada</Label>
                        <Input id="input_unit" placeholder="Ex: Pacote" value={productData.input_unit || ''} onChange={e => handleProductInputChange('input_unit', e.target.value)} />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground self-center mt-4" />
                    <div className="flex-1">
                        <Label htmlFor="conversion_factor" className="text-xs text-muted-foreground">Fator de Conversão</Label>
                        <Input id="conversion_factor" type="number" placeholder="Ex: 2.24" value={productData.conversion_factor || ''} onChange={e => handleProductInputChange('conversion_factor', e.target.value)} />
                    </div>
                     <div className="flex-1">
                        <Label htmlFor="unit" className="text-xs text-muted-foreground">Unidade de Estoque/Venda</Label>
                        <Input id="unit" placeholder="Ex: KG" value={productData.unit || ''} onChange={e => handleProductInputChange('unit', e.target.value)} />
                    </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1">Ex: 1 <span className="font-bold">{productData.input_unit || 'Unidade de Entrada'}</span> equivale a <span className="font-bold">{productData.conversion_factor || 'Fator'}</span> <span className="font-bold">{productData.unit || 'Unidade de Estoque'}</span>.</p>
              </div>
              
              <div className="space-y-2"><Label htmlFor="cost_price">Preço de Custo (un. entrada)</Label><Input id="cost_price" type="number" value={productData.cost_price || ''} onChange={e => handleProductInputChange('cost_price', e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="sale_price">Preço de Venda</Label><Input id="sale_price" type="number" value={productData.sale_price || ''} onChange={e => handleProductInputChange('sale_price', e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="sale_price_2">Preço de Revenda</Label><Input id="sale_price_2" type="number" value={productData.sale_price_2 || ''} onChange={e => handleProductInputChange('sale_price_2', e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="sale_price_3">Preço Especial</Label><Input id="sale_price_3" type="number" value={productData.sale_price_3 || ''} onChange={e => handleProductInputChange('sale_price_3', e.target.value)} /></div>
              
              <div className="lg:col-span-4 grid grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="custom_code">Código Personalizado</Label><Input id="custom_code" value={productData.custom_code || ''} onChange={e => handleProductInputChange('custom_code', e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label htmlFor="printer_location_id">Local de Impressão</Label>
                    <select id="printer_location_id" value={productData.printer_location_id || ''} onChange={e => handleProductInputChange('printer_location_id', e.target.value)} className="w-full p-2 border rounded bg-white">
                      <option value="">Nenhum (usar padrão)</option>
                      {printerLocations.filter(loc => selectedCompanies.has(loc.company_id)).map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                  </div>
                  {userHasPermission && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="validade_dias_ambiente" className="flex items-center">🕓 Validade (dias) – Temp. ambiente</Label>
                        <Input id="validade_dias_ambiente" type="number" placeholder="Ex: 3 dias" value={productData.validade_dias_ambiente || ''} onChange={e => handleProductInputChange('validade_dias_ambiente', e.target.value.replace(/[^0-9]/g, ''))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="validade_dias_congelado" className="flex items-center">❄️ Validade (dias) – Congelado</Label>
                        <Input id="validade_dias_congelado" type="number" placeholder="Ex: 180 dias" value={productData.validade_dias_congelado || ''} onChange={e => handleProductInputChange('validade_dias_congelado', e.target.value.replace(/[^0-9]/g, ''))} />
                      </div>
                    </>
                  )}

                  <div className="space-y-2"><Label htmlFor="shelf_life_manipulated_hours">Validade Pós-Manipulação (horas)</Label><Input id="shelf_life_manipulated_hours" type="number" placeholder="Ex: 48" value={productData.shelf_life_manipulated_hours || ''} onChange={e => handleProductInputChange('shelf_life_manipulated_hours', e.target.value)} /></div>
                  <div className="flex items-center space-x-2"><Checkbox id="is_active" checked={productData.is_active} onCheckedChange={checked => handleProductInputChange('is_active', checked)} /><Label htmlFor="is_active">Produto Ativo</Label></div>
                  <div className="flex items-center space-x-2"><Checkbox id="show_in_pdv" checked={productData.show_in_pdv} onCheckedChange={checked => handleProductInputChange('show_in_pdv', checked)} /><Label htmlFor="show_in_pdv">Disponível no PDV</Label></div>
                </div>
                <div className="space-y-2">
                  <Label>Lojas com Acesso</Label>
                  <div className="p-3 border rounded-md max-h-32 overflow-y-auto space-y-2">
                    {companies.map(company => (
                      <div key={company.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`company-${company.id}`}
                          checked={selectedCompanies.has(company.id)}
                          onCheckedChange={() => handleCompanySelection(company.id)}
                        />
                        <Label htmlFor={`company-${company.id}`}>{company.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {formTab === 'detalhes' && (
            <div className="space-y-6">
              <div className="space-y-2"><Label htmlFor="description">Descrição</Label><Textarea id="description" value={productData.description || ''} onChange={e => handleProductInputChange('description', e.target.value)} rows={4} /></div>
              <div>
                <Label>Foto do Produto (400x400px)</Label>
                <div className="mt-2 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center bg-gray-50">
                    {productData.image_url ? <img src={productData.image_url} alt="Preview" className="w-full h-full object-cover rounded-md" /> : <span className="text-gray-400 text-sm">Preview</span>}
                  </div>
                  <input type="file" ref={imageUploadInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                  <Button type="button" variant="outline" onClick={() => imageUploadInputRef.current.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    {isUploading ? 'Enviando...' : 'Upload'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {formTab === 'estoque' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="min_stock">Estoque Mínimo (em unidade de estoque)</Label><Input id="min_stock" type="number" value={productData.min_stock || ''} onChange={e => handleProductInputChange('min_stock', e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="current_stock">Estoque Atual (em unidade de estoque)</Label><Input id="current_stock" type="number" value={productData.current_stock || ''} onChange={e => handleProductInputChange('current_stock', e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="storage_location">Local de Armazenamento</Label><Input id="storage_location" value={productData.storage_location || ''} onChange={e => handleProductInputChange('storage_location', e.target.value)} /></div>
            </div>
          )}

          {formTab === 'ficha' && editingProduct && (
            <FichaTecnicaTab 
              product={editingProduct} 
              allProducts={products}
              onCostChange={handleCostChange}
            />
          )}

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button onClick={handleSaveProduct}><Save className="w-4 h-4 mr-2" /> Salvar</Button>
            <Button onClick={closeForm} variant="ghost"><X className="w-4 h-4 mr-2" /> Voltar</Button>
          </div>
        </motion.div>
      );

      if (isFormOpen) return renderForm();

      return (
        <div className="space-y-6">
          <AlertDialog open={showPriceAlert} onOpenChange={setShowPriceAlert}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="text-yellow-500" />
                          Preço de Venda Abaixo do Custo
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                          O preço de venda informado é menor que o preço de custo. Por favor, forneça uma justificativa para esta ação. Esta informação será registrada para fins de auditoria.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                      placeholder="Digite a justificativa aqui..."
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                  />
                  <AlertDialogFooter>
                      <Button variant="ghost" onClick={handlePriceAlertCancel}>Cancelar</Button>
                      <Button onClick={handlePriceAlertConfirm}>Confirmar e Salvar</Button>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Produtos Gerais</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleExportProducts}><FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar</Button>
              <Button variant="outline" onClick={handleExportTemplate}><Download className="w-4 h-4 mr-2" /> Modelo</Button>
              <Button variant="outline" onClick={() => fileInputRef.current.click()}><UploadCloud className="w-4 h-4 mr-2" /> Importar</Button>
              <input type="file" ref={fileInputRef} onChange={handleImportFile} className="hidden" accept=".xlsx, .xls" />
              <Button onClick={() => openForm()}><PlusCircle className="w-4 h-4 mr-2" /> Novo Produto</Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <div className="relative w-full sm:w-auto flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                    placeholder="Buscar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                />
            </div>
            <div className="w-full sm:w-auto">
                <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full p-2 border rounded-md bg-white text-sm h-10"
                >
                <option value="">Todas as Lojas</option>
                {companies.map(comp => <option key={comp.id} value={comp.id}>{comp.name}</option>)}
                </select>
            </div>
            <div className="w-full sm:w-auto">
                <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full p-2 border rounded-md bg-white text-sm h-10"
                >
                <option value="">Todas as Categorias</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
            </div>
            <Button
                variant="outline"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="w-full sm:w-auto"
            >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4 mr-2" /> : <SortDesc className="w-4 h-4 mr-2" />}
                Classificar
            </Button>
          </div>
          
          {importSummary && (
            <AlertDialog open={!!importSummary} onOpenChange={() => setImportSummary(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Resumo da Importação</AlertDialogTitle>
                  <AlertDialogDescription>
                    <p>Importados: {importSummary.importedCount}</p>
                    <p>Atualizados: {importSummary.updatedCount}</p>
                    <p>Ignorados: {importSummary.ignoredCount}</p>
                    {importSummary.ignoredCount > 0 && (
                      <div className="mt-4 max-h-40 overflow-y-auto text-xs bg-gray-100 p-2 rounded">
                        <strong>Motivos:</strong>
                        <ul className="list-disc pl-5">
                          {importSummary.ignoredReasons.slice(0, 10).map((reason, i) => <li key={i}>{reason}</li>)}
                          {importSummary.ignoredReasons.length > 10 && <li>... e mais {importSummary.ignoredReasons.length - 10} erros.</li>}
                        </ul>
                      </div>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogAction onClick={() => setImportSummary(null)}>Fechar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Produto</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Unidade</th>
                  <th className="p-4 text-right text-sm font-semibold text-gray-600">Custo</th>
                  <th className="p-4 text-right text-sm font-semibold text-gray-600">Venda</th>
                  <th className="p-4 text-right text-sm font-semibold text-gray-600">Revenda</th>
                  <th className="p-4 text-right text-sm font-semibold text-gray-600">Especial</th>
                  {userHasPermission && <th className="p-4 text-center text-sm font-semibold text-gray-600">Val. Ambiente (dias)</th>}
                  {userHasPermission && <th className="p-4 text-center text-sm font-semibold text-gray-600">Val. Congelado (dias)</th>}
                  <th className="p-4 text-center text-sm font-semibold text-gray-600">Status</th>
                  <th className="p-4 text-center text-sm font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={userHasPermission ? 10 : 8} className="p-4 text-center">Carregando...</td></tr>
                ) : filteredAndSortedProducts.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium">{p.name}</td>
                    <td className="p-0 text-center text-sm w-24">
                      <EditableCell
                        value={p.unit || ''}
                        onSave={(newValue) => handleQuickEditSave(p.id, 'unit', newValue)}
                      />
                    </td>
                    <td className="p-0 text-right text-sm w-32">
                       <EditableCell
                        value={p.cost_price}
                        onSave={(newValue) => handleQuickEditSave(p.id, 'cost_price', newValue)}
                        type="number"
                      />
                    </td>
                    <td className="p-0 text-right text-sm w-32">
                       <EditableCell
                        value={p.sale_price}
                        onSave={(newValue) => handleQuickEditSave(p.id, 'sale_price', newValue)}
                        type="number"
                      />
                    </td>
                    <td className="p-0 text-right text-sm w-32">
                       <EditableCell
                        value={p.sale_price_2}
                        onSave={(newValue) => handleQuickEditSave(p.id, 'sale_price_2', newValue)}
                        type="number"
                      />
                    </td>
                    <td className="p-0 text-right text-sm w-32">
                       <EditableCell
                        value={p.sale_price_3}
                        onSave={(newValue) => handleQuickEditSave(p.id, 'sale_price_3', newValue)}
                        type="number"
                      />
                    </td>
                    {userHasPermission && (
                      <td className="p-0 text-center text-sm w-40">
                        <EditableCell
                          value={p.validade_dias_ambiente}
                          onSave={(newValue) => handleQuickEditSave(p.id, 'validade_dias_ambiente', newValue)}
                          type="number"
                        />
                      </td>
                    )}
                    {userHasPermission && (
                      <td className="p-0 text-center text-sm w-40">
                        <EditableCell
                          value={p.validade_dias_congelado}
                          onSave={(newValue) => handleQuickEditSave(p.id, 'validade_dias_congelado', newValue)}
                          type="number"
                        />
                      </td>
                    )}
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {p.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center items-center">
                        <Button variant="ghost" size="icon" onClick={() => openForm(p)}><Edit className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Isso excluirá permanentemente o produto "{p.name}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteProduct(p.id)} className="bg-red-500 hover:bg-red-600">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    export default ProdutosTab;
  