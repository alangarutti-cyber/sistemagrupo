
    import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { PlusCircle, Edit, Save, X, Trash2 } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Checkbox } from '@/components/ui/checkbox';
    import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
    import { useUser } from '@/contexts/UserContext';

    const LocaisImpressao = () => {
        const { companies, user } = useUser();
        const { toast } = useToast();
        const [locations, setLocations] = useState([]);
        const [loading, setLoading] = useState(true);
        const [isFormOpen, setIsFormOpen] = useState(false);
        const [editingLocation, setEditingLocation] = useState(null);
        const [formData, setFormData] = useState({
            name: '',
            company_id: '',
            printer_name: '',
            ip_address: '',
            is_default: false,
        });

        const allowedCompanies = React.useMemo(() => {
            if (!user || !companies) return [];
            if (user.is_admin) return companies;
            const allowedCompanyIds = user.company_ids?.map(c => c.company_id) || [];
            return companies.filter(c => allowedCompanyIds.includes(c.id));
        }, [user, companies]);

        const fetchLocations = useCallback(async () => {
            setLoading(true);
            if (allowedCompanies.length === 0) {
                setLoading(false);
                return;
            }
            const { data, error } = await supabase
                .from('printer_locations')
                .select('*, companies(name)')
                .in('company_id', allowedCompanies.map(c => c.id));
            
            if (error) {
                toast({ title: "Erro ao buscar locais", description: error.message, variant: "destructive" });
            } else {
                setLocations(data);
            }
            setLoading(false);
        }, [toast, allowedCompanies]);

        useEffect(() => {
            fetchLocations();
        }, [fetchLocations]);

        const handleInputChange = (field, value) => {
            setFormData(prev => ({ ...prev, [field]: value }));
        };

        const openForm = (location = null) => {
            if (location) {
                setEditingLocation(location);
                setFormData({
                    id: location.id,
                    name: location.name,
                    company_id: location.company_id,
                    printer_name: location.printer_name,
                    ip_address: location.ip_address,
                    is_default: location.is_default,
                });
            } else {
                setEditingLocation(null);
                setFormData({
                    name: '',
                    company_id: allowedCompanies.length === 1 ? allowedCompanies[0].id : '',
                    printer_name: '',
                    ip_address: '',
                    is_default: false,
                });
            }
            setIsFormOpen(true);
        };

        const closeForm = () => {
            setIsFormOpen(false);
            setEditingLocation(null);
        };

        const handleSave = async () => {
            if (!formData.name || !formData.company_id || !formData.printer_name) {
                toast({ title: "Campos obrigatórios", description: "Nome, Empresa e Nome da Impressora são obrigatórios.", variant: "destructive" });
                return;
            }
            
            const { id, companies, ...dataToSave } = formData;

            const { error } = await (editingLocation
                ? supabase.from('printer_locations').update(dataToSave).eq('id', editingLocation.id)
                : supabase.from('printer_locations').insert(dataToSave)
            );

            if (error) {
                toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
            } else {
                toast({ title: `Local ${editingLocation ? 'atualizado' : 'criado'}!`, variant: "success" });
                closeForm();
                fetchLocations();
            }
        };

        const handleDelete = async (locationId) => {
            const { error } = await supabase.from('printer_locations').delete().eq('id', locationId);
            if (error) {
                toast({ title: "Erro ao excluir", description: "Verifique se o local não está em uso em algum produto.", variant: "destructive" });
            } else {
                toast({ title: "Local excluído!", variant: "success" });
                fetchLocations();
            }
        };

        if (isFormOpen) {
            return (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 bg-white rounded-xl shadow-md border space-y-6">
                    <h3 className="text-xl font-bold">{editingLocation ? 'Editar' : 'Novo'} Local de Impressão</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome do Local</Label>
                            <Input id="name" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} placeholder="Ex: Cozinha, Bar" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="company_id">Empresa</Label>
                            <select id="company_id" value={formData.company_id} onChange={e => handleInputChange('company_id', e.target.value)} className="w-full p-2 border rounded-md bg-background">
                                <option value="">Selecione...</option>
                                {allowedCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="printer_name">Nome da Impressora no Sistema</Label>
                            <Input id="printer_name" value={formData.printer_name} onChange={e => handleInputChange('printer_name', e.target.value)} placeholder="Ex: EPSON_TM_T20" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="ip_address">Endereço IP (opcional)</Label>
                            <Input id="ip_address" value={formData.ip_address || ''} onChange={e => handleInputChange('ip_address', e.target.value)} placeholder="Ex: 192.168.1.100" />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="is_default" checked={formData.is_default} onCheckedChange={c => handleInputChange('is_default', c)} />
                        <Label htmlFor="is_default">Este é o local de impressão padrão</Label>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Salvar</Button>
                        <Button variant="ghost" onClick={closeForm}><X className="w-4 h-4 mr-2" /> Cancelar</Button>
                    </div>
                </motion.div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Locais de Impressão</h2>
                    <Button onClick={() => openForm()}><PlusCircle className="w-4 h-4 mr-2" /> Novo Local</Button>
                </div>
                <div className="bg-white rounded-xl shadow-md border overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-4 text-left font-semibold">Nome</th>
                                <th className="p-4 text-left font-semibold">Empresa</th>
                                <th className="p-4 text-left font-semibold">Nome da Impressora</th>
                                <th className="p-4 text-left font-semibold">IP</th>
                                <th className="p-4 text-center font-semibold">Padrão</th>
                                <th className="p-4 text-center font-semibold">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="p-4 text-center">Carregando...</td></tr>
                            ) : locations.map(loc => (
                                <tr key={loc.id} className="border-b">
                                    <td className="p-4">{loc.name}</td>
                                    <td className="p-4">{loc.companies?.name}</td>
                                    <td className="p-4">{loc.printer_name}</td>
                                    <td className="p-4">{loc.ip_address}</td>
                                    <td className="p-4 text-center">{loc.is_default ? 'Sim' : 'Não'}</td>
                                    <td className="p-4">
                                        <div className="flex justify-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openForm(loc)}><Edit className="w-4 h-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                                        <AlertDialogDescription>Esta ação excluirá permanentemente o local "{loc.name}".</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(loc.id)} className="bg-red-500 hover:bg-red-600">Excluir</AlertDialogAction>
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

    export default LocaisImpressao;
  