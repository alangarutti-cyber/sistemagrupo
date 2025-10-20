import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileKey2, Plus, Upload, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const CertificadosTab = ({ companies }) => {
  const { toast } = useToast();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [certificateToDelete, setCertificateToDelete] = useState(null);
  const [newCertificate, setNewCertificate] = useState({
    company_id: '',
    certificate_name: '',
    pfx_file: null,
    password: '',
    valid_from: '',
    valid_to: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('digital_certificates')
      .select('*, companies(name)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: "Erro ao buscar certificados", description: error.message, variant: "destructive" });
    } else {
      setCertificates(data);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setNewCertificate(prev => ({ ...prev, [id]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setNewCertificate(prev => ({ ...prev, pfx_file: e.target.files[0] }));
    }
  };

  const handleSaveCertificate = async () => {
    const { company_id, pfx_file, password, valid_to } = newCertificate;
    if (!company_id || !pfx_file || !password || !valid_to) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos para salvar.", variant: "destructive" });
      return;
    }

    toast({
      title: "🚧 Funcionalidade em desenvolvimento",
      description: "O upload e armazenamento seguro de certificados ainda não foi implementado. Esta é uma demonstração visual.",
    });
    
    // Placeholder logic
    const mockCertificate = {
        id: Date.now(),
        company_id,
        certificate_name: pfx_file.name,
        pfx_file_path: `secure/path/${pfx_file.name}`,
        password_encrypted: '********',
        valid_from: new Date().toISOString(),
        valid_to: new Date(valid_to).toISOString(),
        companies: { name: companies.find(c => c.id == company_id)?.name || 'N/A' }
    };
    setCertificates(prev => [mockCertificate, ...prev]);
    setIsDialogOpen(false);
  };

  const handleDeleteCertificate = async () => {
    toast({
      title: "🚧 Funcionalidade em desenvolvimento",
      description: "A exclusão de certificados ainda não foi implementada.",
    });
    setIsDeleteDialogOpen(false);
  };

  const openDialog = () => {
    setNewCertificate({ company_id: '', certificate_name: '', pfx_file: null, password: '', valid_from: '', valid_to: '' });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Certificados Digitais (A1)</h2>
        <Button onClick={openDialog} className="gradient-primary text-white">
          <Plus className="w-4 h-4 mr-2" /> Novo Certificado
        </Button>
      </div>

      {loading ? (
        <p>Carregando certificados...</p>
      ) : certificates.length > 0 ? (
        <div className="space-y-4">
          {certificates.map(cert => (
            <motion.div
              key={cert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-effect rounded-xl p-4 border-l-4 border-blue-500 flex justify-between items-center"
            >
              <div className="flex items-center gap-4">
                <FileKey2 className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="font-semibold">{cert.companies.name}</p>
                  <p className="text-sm text-gray-600">{cert.certificate_name}</p>
                  <p className="text-xs text-gray-500">
                    Válido até: {new Date(cert.valid_to).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => {
                  setCertificateToDelete(cert);
                  setIsDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <FileKey2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum certificado cadastrado</h3>
          <p className="mt-1 text-sm text-gray-500">Adicione o certificado digital (A1) de suas empresas.</p>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Certificado Digital (A1)</DialogTitle>
            <DialogDescription>
              O arquivo .pfx e a senha serão armazenados de forma segura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="company_id">Empresa</Label>
              <select id="company_id" value={newCertificate.company_id} onChange={handleInputChange} className="w-full p-2 border rounded">
                <option value="" disabled>Selecione uma empresa</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="pfx_file">Arquivo do Certificado (.pfx)</Label>
              <Input id="pfx_file" type="file" accept=".pfx" onChange={handleFileChange} />
            </div>
            <div className="relative">
              <Label htmlFor="password">Senha do Certificado</Label>
              <Input id="password" type={showPassword ? "text" : "password"} value={newCertificate.password} onChange={handleInputChange} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-gray-500">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div>
              <Label htmlFor="valid_to">Data de Validade</Label>
              <Input id="valid_to" type="date" value={newCertificate.valid_to} onChange={handleInputChange} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCertificate}><Save className="w-4 h-4 mr-2" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir o certificado para "{certificateToDelete?.companies.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCertificate}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CertificadosTab;