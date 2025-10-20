import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useUser } from '@/contexts/UserContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { toast } from '@/components/ui/use-toast';
    import { format } from 'date-fns';

    const SystemLogs = () => {
      const { companies } = useUser();
      const [logs, setLogs] = useState([]);
      const [loading, setLoading] = useState(false);
      const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        companyId: 'all',
      });
      const [pagination, setPagination] = useState({ page: 0, pageSize: 20 });
      const [totalLogs, setTotalLogs] = useState(0);

      const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
          let query = supabase
            .from('system_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

          if (filters.startDate) {
            query = query.gte('created_at', new Date(filters.startDate).toISOString());
          }
          if (filters.endDate) {
            query = query.lte('created_at', new Date(filters.endDate + 'T23:59:59').toISOString());
          }
          if (filters.companyId !== 'all') {
            query = query.eq('company_id', filters.companyId);
          }

          const from = pagination.page * pagination.pageSize;
          const to = from + pagination.pageSize - 1;
          query = query.range(from, to);

          const { data, error, count } = await query;

          if (error) throw error;

          setLogs(data);
          setTotalLogs(count);
        } catch (error) {
          toast({
            title: "Erro ao buscar logs",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }, [filters, pagination, toast]);

      useEffect(() => {
        fetchLogs();
      }, [fetchLogs]);

      const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
      };

      const handleSearch = () => {
        setPagination({ page: 0, pageSize: 20 });
        fetchLogs();
      };
      
      const totalPages = Math.ceil(totalLogs / pagination.pageSize);

      const handlePageChange = (newPage) => {
          if (newPage >= 0 && newPage < totalPages) {
              setPagination(prev => ({ ...prev, page: newPage }));
          }
      }

      const getActionClass = (action) => {
        switch(action) {
          case 'INSERT': return 'bg-green-100 text-green-800';
          case 'UPDATE': return 'bg-yellow-100 text-yellow-800';
          case 'DELETE': return 'bg-red-100 text-red-800';
          default: return 'bg-gray-100 text-gray-800';
        }
      };

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Logs do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
                <Input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
                <select name="companyId" value={filters.companyId} onChange={handleFilterChange} className="w-full p-2 border rounded bg-background">
                  <option value="all">Todas as Empresas</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? 'Buscando...' : 'Buscar'}
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Registro ID</TableHead>
                      <TableHead>Empresa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center">Carregando...</TableCell></TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center">Nenhum log encontrado.</TableCell></TableRow>
                    ) : (
                      logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell>{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                          <TableCell>{log.user_email || 'Sistema'}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getActionClass(log.action)}`}>
                              {log.action}
                            </span>
                          </TableCell>
                          <TableCell>{log.table_name}</TableCell>
                          <TableCell>{log.record_id}</TableCell>
                          <TableCell>{companies.find(c => c.id === log.company_id)?.name || 'N/A'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                      Página {pagination.page + 1} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                      <Button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 0}>
                          Anterior
                      </Button>
                      <Button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page + 1 >= totalPages}>
                          Próxima
                      </Button>
                  </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    };

    export default SystemLogs;