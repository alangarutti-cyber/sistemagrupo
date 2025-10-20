import React, { useState, useEffect } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Textarea } from '@/components/ui/textarea';
    import { Input } from '@/components/ui/input';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { Clipboard, RefreshCw, Trash2, Sparkles, MessageSquare, History, ChevronDown, ChevronUp, MessageCircle as MessageCircleQuestion } from 'lucide-react';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

    const tones = [
      { id: 'profissional', label: 'Profissional e cordial' },
      { id: 'amigavel', label: 'Amigável e descontraído' },
      { id: 'formal', label: 'Formal e corporativo' },
    ];

    const mockAIReviewResponse = (review, tone, customerName) => {
      const greeting = customerName ? `Olá, ${customerName}! ` : 'Olá! ';
      const responses = {
        profissional: [
          `${greeting}Sentimos muito pela sua experiência. Trabalhamos todos os dias para garantir qualidade e agilidade. Agradecemos o seu feedback e esperamos te surpreender na próxima visita! 🍔🔥`,
          `${greeting}Agradecemos por compartilhar sua avaliação. Levamos seu feedback muito a sério e já estamos verificando o ocorrido para que não se repita. Esperamos ter a chance de oferecer uma experiência muito melhor em breve.`,
          `${greeting}Obrigado pelo seu feedback. Lamentamos que sua experiência não tenha sido perfeita. Sua opinião é valiosa para nós e nos ajuda a melhorar sempre. Conte conosco para uma nova e excellent experiência!`,
        ],
        amigavel: [
          `E aí, ${customerName || 'tudo bem'}? Poxa, que pena que seu pedido não chegou como esperado. Isso não é o padrão da casa! A gente agradece o toque, vamos correr aqui pra ajustar os ponteiros. Dá uma nova chance pra gente te surpreender! 😉`,
          `Opa, ${customerName || ''}! Valeu por mandar a real pra gente. Vacilamos nessa, e pedimos desculpas. Sua opinião ajuda a gente a ficar mais esperto. Na próxima, prometemos caprichar muito mais!`,
          `Que chato isso, hein, ${customerName || ''}? Sentimos muito mesmo. Não é essa a experiência que queremos pra você. Obrigado por nos avisar, vamos usar isso pra melhorar. Tamo junto!`,
        ],
        formal: [
          `Prezado(a) ${customerName || 'cliente'}, lamentamos o ocorrido com seu pedido. Gostaríamos de assegurar que nossos processos estão sendo revisados para evitar que situações como esta voltem a acontecer. Agradecemos seu contato.`,
          `Prezado(a) ${customerName || 'cliente'}, recebemos sua avaliação e pedimos desculpas por qualquer inconveniente. A qualidade de nossos produtos e serviços é nossa prioridade. Estamos à disposição para quaisquer esclarecimentos.`,
          `Agradecemos o seu feedback, ${customerName || 'Prezado(a) Cliente'}. Informamos que as devidas providências serão tomadas para aprimorar nossos serviços. Esperamos poder atendê-lo(a) melhor em uma futura oportunidade.`,
        ],
      };
      return new Promise((resolve) => setTimeout(() => resolve(responses[tone] || responses['profissional']), 1500));
    };

    const mockAIQuestionResponse = (question, customerName) => {
      const greeting = customerName ? `Olá, ${customerName}! ` : 'Olá! ';
      let answer = `${greeting}Obrigado pela sua pergunta! `;

      if (question.toLowerCase().includes('horário')) {
        answer += "Nosso horário de funcionamento é de terça a domingo, das 18h às 23h. Esperamos por você! 😊";
      } else if (question.toLowerCase().includes('endereço')) {
        answer += "Estamos localizados na Rua da Gastronomia, 123 - Centro. É fácil de chegar, venha nos visitar! 📍";
      } else if (question.toLowerCase().includes('delivery') || question.toLowerCase().includes('entrega')) {
        answer += "Sim, fazemos delivery! Você pode pedir pelo iFood ou pelo nosso WhatsApp (XX) 99999-8888. Seu lanche chega quentinho no conforto da sua casa! 🛵💨";
      } else if (question.toLowerCase().includes('vegetariano') || question.toLowerCase().includes('vegano')) {
        answer += "Temos opções vegetarianas deliciosas! Nosso burger 'Verde Burger' é um sucesso. No momento, estamos desenvolvendo opções veganas, fique de olho nas novidades! 🌱";
      } else {
        answer += "Nossa equipe já recebeu sua dúvida e em breve um de nossos atendentes entrará em contato para te ajudar da melhor forma. Agradecemos a paciência!";
      }

      const variations = [
        answer,
        answer.replace('Obrigado pela sua pergunta!', 'Respondendo à sua dúvida:'),
        answer.replace('Olá!', 'Oi, tudo bem?'),
      ];

      return new Promise((resolve) => setTimeout(() => resolve(variations), 1500));
    };

    const ResponseCard = ({ response, onCopy }) => (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-secondary p-4 rounded-lg mt-4 border border-border"
      >
        <p className="text-secondary-foreground">{response}</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={() => onCopy(response)}>
            <Clipboard className="w-4 h-4 mr-2" />
            Copiar
          </Button>
        </div>
      </motion.div>
    );

    const HistoryItem = ({ item, onCopy }) => {
      const [isOpen, setIsOpen] = useState(false);
      const isReview = 'review' in item;
      return (
        <div className="border-b border-border py-3">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
            <div>
              <p className="font-medium text-sm text-foreground truncate max-w-xs md:max-w-md">
                <span className="text-primary mr-1">{isReview ? <MessageSquare className="inline w-4 h-4"/> : <MessageCircleQuestion className="inline w-4 h-4"/>}</span>
                "{isReview ? item.review : item.question}"
              </p>
              <p className="text-xs text-muted-foreground">
                {item.customerName && `Cliente: ${item.customerName} | `}
                {new Date(item.date).toLocaleString('pt-BR')}
              </p>
            </div>
            <Button variant="ghost" size="icon">{isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</Button>
          </div>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-muted/50 p-3 mt-2 rounded-md">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Resposta Gerada {isReview && `(Tom: ${item.toneLabel})`}</p>
                  <p className="text-sm text-foreground mb-2">{item.response}</p>
                  <Button variant="outline" size="sm" onClick={() => onCopy(item.response)}>
                    <Clipboard className="w-3 h-3 mr-1" />
                    Copiar Resposta
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    };

    const Generator = ({ type, onGenerate, isLoading, tones: toneOptions, children }) => {
        const [internalTone, setInternalTone] = useState(toneOptions ? toneOptions[0].id : null);
        
        const handleGenerateClick = () => {
            onGenerate(internalTone);
        };
        
        return (
            <div className="space-y-6">
                {children}
                {type === 'review' && (
                     <div className="space-y-2">
                        <label className="font-medium text-foreground">3. Escolha o tom de voz</label>
                        <div className="flex flex-wrap gap-2">
                            {toneOptions.map((t) => (
                                <Button
                                key={t.id}
                                variant={internalTone === t.id ? 'default' : 'outline'}
                                onClick={() => setInternalTone(t.id)}
                                >
                                {t.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
                <Button onClick={handleGenerateClick} disabled={isLoading} className="w-full">
                    {isLoading ? (
                        <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
                    ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> {type === 'review' ? '4. Gerar Resposta' : '3. Gerar Resposta'}</>
                    )}
                </Button>
            </div>
        );
    };

    const RespostasAvaliacoes = () => {
      const { toast } = useToast();
      const [activeTab, setActiveTab] = useState('review');
      
      const [review, setReview] = useState('');
      const [question, setQuestion] = useState('');

      const [customerName, setCustomerName] = useState('');
      const [responses, setResponses] = useState([]);
      const [isLoading, setIsLoading] = useState(false);
      const [history, setHistory] = useState([]);

      useEffect(() => {
        const storedHistory = localStorage.getItem('stoutResponseHistory');
        if (storedHistory) setHistory(JSON.parse(storedHistory));
      }, []);

      const resetState = () => {
        setResponses([]);
        setIsLoading(false);
      };

      const handleTabChange = (value) => {
        setActiveTab(value);
        resetState();
      };
      
      const handleGenerate = async (tone) => {
        const isReview = activeTab === 'review';
        const text = isReview ? review : question;
        if (!text.trim()) {
          toast({
            title: 'Atenção!',
            description: `Por favor, insira a ${isReview ? 'avaliação' : 'pergunta'} do cliente.`,
            variant: 'destructive',
          });
          return;
        }

        setIsLoading(true);
        setResponses([]);
        
        const generatedResponses = isReview
          ? await mockAIReviewResponse(text, tone, customerName)
          : await mockAIQuestionResponse(text, customerName);

        setResponses(generatedResponses);
        setIsLoading(false);

        const newHistoryItem = {
          ...(isReview ? { review: text, toneId: tone, toneLabel: tones.find(t => t.id === tone)?.label } : { question: text }),
          customerName,
          response: generatedResponses[0],
          date: new Date().toISOString(),
        };
        const updatedHistory = [newHistoryItem, ...history];
        setHistory(updatedHistory);
        localStorage.setItem('stoutResponseHistory', JSON.stringify(updatedHistory));
      };

      const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Copiado!', description: 'A resposta foi copiada para a área de transferência.' });
      };

      const handleClearHistory = () => {
        setHistory([]);
        localStorage.removeItem('stoutResponseHistory');
        toast({ title: 'Histórico Limpo!', description: 'O histórico de respostas foi removido.' });
      };

      return (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <Sparkles className="mx-auto h-12 w-12 text-primary" />
            <h1 className="text-3xl font-bold mt-2">Assistente de Respostas IA</h1>
            <p className="text-muted-foreground mt-2">Gere respostas personalizadas para avaliações e perguntas de clientes em segundos.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-card rounded-xl shadow-md">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="review"><MessageSquare className="w-4 h-4 mr-2"/>Responder Avaliação</TabsTrigger>
                        <TabsTrigger value="question"><MessageCircleQuestion className="w-4 h-4 mr-2"/>Responder Pergunta</TabsTrigger>
                    </TabsList>
                    <TabsContent value="review" className="pt-6">
                        <Generator type="review" onGenerate={handleGenerate} isLoading={isLoading} tones={tones}>
                            <div className="space-y-2">
                                <label htmlFor="review" className="font-medium text-foreground">1. Cole a avaliação do cliente</label>
                                <Textarea id="review" placeholder="Ex: O lanche demorou e veio frio." value={review} onChange={(e) => setReview(e.target.value)} className="min-h-[120px]" />
                            </div>
                             <div className="space-y-2">
                                <label htmlFor="customerNameReview" className="font-medium text-foreground">2. Nome do cliente (opcional)</label>
                                <Input id="customerNameReview" placeholder="Ex: João Silva" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                            </div>
                        </Generator>
                    </TabsContent>
                    <TabsContent value="question" className="pt-6">
                         <Generator type="question" onGenerate={handleGenerate} isLoading={isLoading}>
                            <div className="space-y-2">
                                <label htmlFor="question" className="font-medium text-foreground">1. Insira a pergunta do cliente</label>
                                <Textarea id="question" placeholder="Ex: Qual o horário de funcionamento?" value={question} onChange={(e) => setQuestion(e.target.value)} className="min-h-[120px]" />
                            </div>
                             <div className="space-y-2">
                                <label htmlFor="customerNameQuestion" className="font-medium text-foreground">2. Nome do cliente (opcional)</label>
                                <Input id="customerNameQuestion" placeholder="Ex: Maria" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                            </div>
                        </Generator>
                    </TabsContent>
                </Tabs>
                
                {isLoading && <div className="text-center text-muted-foreground pt-4">Aguarde, nossa IA está preparando a resposta perfeita...</div>}

                <AnimatePresence>
                    {responses.length > 0 && !isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-4 mt-4 border-t border-border">
                        <h3 className="font-semibold text-lg">Respostas Sugeridas:</h3>
                        <Tabs defaultValue="opcao1" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                {responses.slice(0, 3).map((_, index) => <TabsTrigger key={index} value={`opcao${index + 1}`}>Opção {index + 1}</TabsTrigger>)}
                            </TabsList>
                            {responses.slice(0, 3).map((resp, index) => (
                                <TabsContent key={index} value={`opcao${index + 1}`}>
                                    <ResponseCard response={resp} onCopy={handleCopy} />
                                </TabsContent>
                            ))}
                        </Tabs>
                         <Button variant="secondary" onClick={() => handleGenerate(tones.find(t=>t.id === 'profissional').id)} className="w-full">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Gerar Novamente
                        </Button>
                    </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="space-y-6 p-6 bg-card rounded-xl shadow-md">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold flex items-center"><History className="w-5 h-5 mr-2 text-primary"/>Histórico</h2>
                    {history.length > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleClearHistory}>
                            <Trash2 className="w-4 h-4 mr-1" />Limpar
                        </Button>
                    )}
                </div>
                
                <div className="max-h-[400px] overflow-y-auto pr-2">
                    {history.length > 0 ? (
                        history.map((item, index) => <HistoryItem key={index} item={item} onCopy={handleCopy} />)
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            <p>Nenhuma resposta gerada ainda.</p>
                            <p className="text-sm">Seu histórico aparecerá aqui.</p>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      );
    };

    export default RespostasAvaliacoes;