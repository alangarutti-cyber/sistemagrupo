import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Copy, Loader2, Save } from 'lucide-react';

const IntegracaoWhatsApp = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    instance_id: '',
    api_token: '',
    base_url: 'https://api.z-api.io/instances',
    webhook_secret: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [dbSettingsId, setDbSettingsId] = useState(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : null;
  const webhookUrl = projectRef && settings.webhook_secret 
    ? `https://${projectRef}.functions.supabase.co/whatsapp-listener?key=${settings.webhook_secret}` 
    : '';

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('whatsapp_settings').select('*').limit(1).single();
      if (data) {
        setSettings({
          instance_id: data.instance_id || '',
          api_token: data.api_token || '',
          base_url: data.base_url || 'https://api.z-api.io/instances',
          webhook_secret: data.webhook_secret || '',
        });
        setDbSettingsId(data.id);
      } else if (error && error.code !== 'PGRST116') {
        toast({ title: 'Erro ao buscar configurações', description: error.message, variant: 'destructive' });
      }
      setLoading(false);
    };
    fetchSettings();
  }, [toast]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const settingsData = {
      ...settings,
      webhook_secret: settings.webhook_secret || `stout_${crypto.randomUUID()}`
    };

    let response;
    if (dbSettingsId) {
      response = await supabase.from('whatsapp_settings').update(settingsData).eq('id', dbSettingsId).select().single();
    } else {
      response = await supabase.from('whatsapp_settings').insert(settingsData).select().single();
    }
    
    const { data, error } = response;
    
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      setSettings(data);
      setDbSettingsId(data.id);
      toast({ title: 'Sucesso!', description: 'Configurações salvas.', className: 'bg-green-500 text-white' });
    }
    setSaving(false);
  };
  
  const testConnection = async () => {
    if (!settings.instance_id || !settings.api_token) {
      toast({ title: 'Credenciais ausentes', description: 'Preencha o Instance ID e o API Token.', variant: 'destructive'});
      return;
    }
    setTesting(true);
    setTestResult(null);
    const url = `${settings.base_url}/${settings.instance_id}/token/${settings.api_token}/status`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && data.connected) {
        setTestResult({ success: true, message: 'Conectado com sucesso!' });
      } else {
        setTestResult({ success: false, message: data.error || 'Falha na conexão. Verifique as credenciais.' });
      }
    } catch (error) {
      setTestResult({ success: false, message: `Erro de rede: ${error.message}` });
    }
    setTesting(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: 'Copiado!', description: 'URL do Webhook copiada para a área de transferência.'});
  };

  if (loading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Configuração da Integração Z-API</CardTitle>
            <CardDescription>Insira as credenciais da sua instância na Z-API para ativar o bot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="instance_id">Instance ID</Label>
              <Input id="instance_id" value={settings.instance_id} onChange={(e) => setSettings({ ...settings, instance_id: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api_token">API Token</Label>
              <Input id="api_token" type="password" value={settings.api_token} onChange={(e) => setSettings({ ...settings, api_token: e.target.value })} required />
            </div>
             <div className="space-y-2">
              <Label htmlFor="base_url">Base URL</Label>
              <Input id="base_url" value={settings.base_url} onChange={(e) => setSettings({ ...settings, base_url: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook_secret">Webhook Secret (Opcional)</Label>
              <Input id="webhook_secret" value={settings.webhook_secret} onChange={(e) => setSettings({ ...settings, webhook_secret: e.target.value })} placeholder="Gerado automaticamente se deixado em branco"/>
            </div>

            {webhookUrl && (
              <div className="space-y-2">
                <Label>URL do Webhook (para configurar na Z-API)</Label>
                <div className="flex items-center gap-2">
                  <Input value={webhookUrl} readOnly className="bg-muted"/>
                  <Button type="button" size="icon" variant="ghost" onClick={copyToClipboard}><Copy className="w-4 h-4"/></Button>
                </div>
                 <p className="text-sm text-muted-foreground">Configure este webhook na Z-API para receber mensagens dos eventos: "Mensagens Recebidas".</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Testar Conexão
              </Button>
              {testResult && (
                <div className={`flex items-center gap-1 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? <CheckCircle className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
                  {testResult.message}
                </div>
              )}
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
              Salvar
            </Button>
          </CardFooter>
        </Card>
      </form>
    </motion.div>
  );
};

export default IntegracaoWhatsApp;